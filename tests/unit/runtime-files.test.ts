// R4 파일 I/O 클라이언트 로직 — 워커 mock으로 메시지 형태·준비 전 큐잉·재부트 재기록 검증

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { RuntimeClient } from "@/lib/runtime/client";
import type { MainToWorker, WorkerToMain } from "@/lib/runtime/protocol";

// client.ts의 `import initDefaultPy from "./py/init_default.py"`(webpack asset/source)를 대체
vi.mock("@/lib/runtime/py/init_default.py", () => ({ default: "# init" }));

class FakeWorker {
  static instances: FakeWorker[] = [];
  posted: { msg: MainToWorker; transfer: Transferable[] }[] = [];
  onmessage: ((ev: { data: WorkerToMain }) => void) | null = null;
  onerror: ((ev: { message?: string }) => void) | null = null;
  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(msg: MainToWorker, transfer?: Transferable[]): void {
    this.posted.push({ msg, transfer: transfer ?? [] });
  }
  terminate(): void {}
  emit(msg: WorkerToMain): void {
    this.onmessage?.({ data: msg });
  }
  writes(): { msg: Extract<MainToWorker, { t: "writeFile" }>; transfer: Transferable[] }[] {
    return this.posted.filter(
      (p): p is { msg: Extract<MainToWorker, { t: "writeFile" }>; transfer: Transferable[] } =>
        p.msg.t === "writeFile",
    );
  }
}

const READY: WorkerToMain = { t: "ready", pyVersion: "3.14.0", pyodideVersion: "314.0.6" };

beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RuntimeClient 파일 I/O", () => {
  test("writeFile — ready 전 큐잉, ready 후 transferable과 함께 전송·fileWritten으로 resolve", async () => {
    const c = new RuntimeClient();
    const w = FakeWorker.instances[0];
    const data = new Uint8Array([1, 2, 3]);
    const p = c.writeFile("data.json", data);
    expect(w.posted).toHaveLength(0); // 준비 전 — 큐에만 있다

    w.emit(READY);
    const writes = w.writes();
    // ready 시 캐시 재기록 + 큐 flush — 둘 다 같은 내용(중복 무해)
    expect(writes.length).toBeGreaterThanOrEqual(1);
    for (const { msg, transfer } of writes) {
      expect(msg.path).toBe("data.json");
      expect(new Uint8Array(msg.bytes)).toEqual(new Uint8Array([1, 2, 3]));
      expect(transfer).toContain(msg.bytes); // ArrayBuffer transfer
    }
    for (const { msg } of writes) w.emit({ t: "fileWritten", id: msg.id });
    await expect(p).resolves.toBeUndefined();
    expect(c.listFiles()).toEqual(["data.json"]);
  });

  test("writeFile — 캐시는 호출자 버퍼와 분리(사본)", () => {
    const c = new RuntimeClient();
    const data = new Uint8Array([9, 9]);
    void c.writeFile("a.bin", data).catch(() => undefined);
    data[0] = 0; // 호출자가 원본을 바꿔도
    const w = FakeWorker.instances[0];
    w.emit(READY);
    const { msg } = w.writes()[0];
    expect(new Uint8Array(msg.bytes)).toEqual(new Uint8Array([9, 9]));
  });

  test("readFile — fileRead의 bytes를 Uint8Array로 반환", async () => {
    const c = new RuntimeClient();
    const w = FakeWorker.instances[0];
    w.emit(READY);
    const p = c.readFile("out.json");
    const msg = w.posted.find((x) => x.msg.t === "readFile")!.msg as Extract<
      MainToWorker,
      { t: "readFile" }
    >;
    expect(msg.path).toBe("out.json");
    w.emit({ t: "fileRead", id: msg.id, bytes: new Uint8Array([65, 66]).buffer });
    await expect(p).resolves.toEqual(new Uint8Array([65, 66]));
  });

  test("readFile — fileError(파일 없음)는 한국어 메시지로 reject", async () => {
    const c = new RuntimeClient();
    const w = FakeWorker.instances[0];
    w.emit(READY);
    const p = c.readFile("없는파일.json");
    const msg = w.posted.find((x) => x.msg.t === "readFile")!.msg as Extract<
      MainToWorker,
      { t: "readFile" }
    >;
    w.emit({ t: "fileError", id: msg.id, message: "파일을 찾을 수 없습니다: 없는파일.json" });
    await expect(p).rejects.toThrow("파일을 찾을 수 없습니다");
  });

  test("경로 검증 — '/'·'\\'·'..'·빈 이름 거부, 캐시에도 남지 않음", async () => {
    const c = new RuntimeClient();
    const u8 = new Uint8Array([1]);
    for (const bad of ["a/b.json", "..", "../x", "a\\b", ""]) {
      await expect(c.writeFile(bad, u8)).rejects.toThrow("파일 이름은 경로 없이");
      await expect(c.readFile(bad)).rejects.toThrow("파일 이름은 경로 없이");
    }
    expect(c.listFiles()).toEqual([]);
    expect(FakeWorker.instances[0].posted).toHaveLength(0); // 워커로 나가지도 않는다
  });

  test("재부트 — 진행 중 writeFile은 reject되지만 캐시본이 새 워커 ready 때 재기록된다", async () => {
    const c = new RuntimeClient();
    const w1 = FakeWorker.instances[0];
    void c.boot();
    w1.emit(READY);

    // 정상 기록 1건
    const p1 = c.writeFile("data.json", new Uint8Array([7, 8]));
    w1.emit({ t: "fileWritten", id: w1.writes()[0].msg.id });
    await p1;

    // 재부트 중 매달린 요청은 거부
    const hanging = c.writeFile("late.json", new Uint8Array([1]));
    const rebootP = c.terminateAndReboot();
    await expect(hanging).rejects.toThrow("런타임이 재설정");

    const w2 = FakeWorker.instances[1];
    expect(w2.posted.some((x) => x.msg.t === "boot")).toBe(true); // 같은 설정으로 재부트
    w2.emit(READY);
    await rebootP;

    // 캐시된 두 파일 모두 자동 재기록 (late.json도 캐시에는 들어갔다)
    const paths = w2.writes().map((x) => x.msg.path).sort();
    expect(paths).toEqual(["data.json", "late.json"]);
    const dataMsg = w2.writes().find((x) => x.msg.path === "data.json")!.msg;
    expect(new Uint8Array(dataMsg.bytes)).toEqual(new Uint8Array([7, 8]));
    expect(c.listFiles().sort()).toEqual(["data.json", "late.json"]);
  });
});
