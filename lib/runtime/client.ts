// lib/runtime/client.ts — 메인 스레드 런타임 클라이언트 (브라우저 전용, React 비의존)
// 역할: 워커 부트, 준비 전 큐잉, 요청/응답 매핑, 진행률·stdout 이벤트,
//       타임아웃 → 인터럽트(SAB) → 실패 시 terminate+재부트 폴백.

import type { IncludeIndex, OutputMode, OutputSelection } from "@/types/workbook";
import {
  BOOT_PACKAGES,
  DEFAULT_PYODIDE_INDEX_URL,
  INTERRUPT_SIGINT,
  type MainToWorker,
  type RangeSnapshot,
  type RunPayload,
  type VariableInfo,
  type WorkerToMain,
} from "./protocol";
import initDefaultPy from "./py/init_default.py";

/** UI 기본 초기화 스크립트 (lib/runtime/py/init_default.py 원문) */
export const DEFAULT_INIT_SCRIPT: string = initDefaultPy;

export type RuntimeStatusName =
  | "idle"
  | "loading"
  | "ready"
  | "running"
  | "error"
  | "rebooting";

export interface RuntimeEvents {
  progress: { pct: number; label: string };
  status: RuntimeStatusName;
  stdout: { id: number; chunk: string };
  stderr: { id: number; chunk: string };
  reboot: void;
}

interface Pending {
  resolve: (msg: WorkerToMain) => void;
  reject: (err: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
  /** run/repl 등 실행형 요청 — 상태 "실행 중" 표시 대상 */
  busy: boolean;
}

interface BootOpts {
  initScript: string;
  indexURL: string;
}

export class RuntimeClient {
  private worker!: Worker;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  /** ready 전에 들어온 요청 큐 — "런타임 준비 후 실행됩니다" (설계서 §4.7) */
  private queue: (MainToWorker & { id: number })[] = [];
  private status: RuntimeStatusName = "idle";
  private listeners = new Map<keyof RuntimeEvents, Set<(payload: never) => void>>();
  private sharedInterrupt: { sab: SharedArrayBuffer; view: Uint8Array } | null = null;
  private bootOpts: BootOpts | null = null;
  private bootPromise: Promise<void> | null = null;
  private bootSettle: { resolve: () => void; reject: (e: Error) => void } | null = null;
  private readyFlag = false;
  private versions: { pyVersion: string; pyodideVersion: string } | null = null;

  /** 블록/REPL 기본 타임아웃(초). 워크북 설정으로 덮어쓸 수 있다 */
  defaultTimeoutSec = 60;

  constructor() {
    if (
      typeof SharedArrayBuffer !== "undefined" &&
      typeof crossOriginIsolated !== "undefined" &&
      crossOriginIsolated
    ) {
      const sab = new SharedArrayBuffer(1);
      this.sharedInterrupt = { sab, view: new Uint8Array(sab) };
    }
    this.spawn();
  }

  // ── 이벤트 ──────────────────────────────────────────────

  on<K extends keyof RuntimeEvents>(
    event: K,
    fn: (payload: RuntimeEvents[K]) => void,
  ): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn as (payload: never) => void);
    return () => set.delete(fn as (payload: never) => void);
  }

  private emit<K extends keyof RuntimeEvents>(event: K, payload: RuntimeEvents[K]): void {
    this.listeners.get(event)?.forEach((fn) => (fn as (p: RuntimeEvents[K]) => void)(payload));
  }

  getStatus(): RuntimeStatusName {
    return this.status;
  }

  /** ready 이후에만 값이 있다 */
  getVersions(): { pyVersion: string; pyodideVersion: string } | null {
    return this.versions;
  }

  private setStatus(s: RuntimeStatusName): void {
    if (this.status === s) return;
    this.status = s;
    this.emit("status", s);
  }

  // ── 부트/워커 수명 ──────────────────────────────────────

  private spawn(): void {
    // ponytail: ["type"] 계산 키는 의도적 해크다. webpack WorkerPlugin은 non-module 출력에서
    // 정적 `type: "module"`을 `type: undefined`(클래식 워커)로 강제 재작성하는데, Pyodide 314+는
    // 클래식 워커에서 부트를 거부한다("Classic web workers are not supported"). 계산 키 프로퍼티는
    // WorkerPlugin.parseObjectExpression이 건드리지 않고 그대로 통과시킨다(otherElements).
    // webpack 업그레이드로 깨지면 같은 오류가 다시 나타난다 → 그때 public/ 정적 워커로 전환.
    this.worker = new Worker(new URL("../../workers/pyodide.worker.ts", import.meta.url), {
      ["type"]: "module",
    });
    this.worker.onmessage = (ev: MessageEvent<WorkerToMain>) => this.handle(ev.data);
    this.worker.onerror = (ev) => {
      const err = new Error(ev.message || "워커 오류");
      if (!this.readyFlag) {
        this.setStatus("error");
        this.bootSettle?.reject(err);
        this.bootSettle = null;
      }
      // 워커가 ready 이후 죽으면 대기 중 요청(analyze/inspect 포함)이 영원히
      // 매달리지 않도록 전부 거부한다
      for (const p of this.pending.values()) {
        if (p.timer) clearTimeout(p.timer);
        p.reject(err);
      }
      this.pending.clear();
      if (this.readyFlag) this.refreshStatus();
    };
  }

  /** 부트(멱등). StrictMode 이중 호출 시 같은 프라미스를 돌려준다 */
  boot(opts: { initScript?: string; indexURL?: string; timeoutSec?: number } = {}): Promise<void> {
    if (this.bootPromise) return this.bootPromise;
    if (opts.timeoutSec) this.defaultTimeoutSec = opts.timeoutSec;
    this.bootOpts = {
      initScript: opts.initScript ?? this.bootOpts?.initScript ?? DEFAULT_INIT_SCRIPT,
      indexURL:
        opts.indexURL ??
        this.bootOpts?.indexURL ??
        process.env.NEXT_PUBLIC_PYODIDE_INDEX_URL ??
        DEFAULT_PYODIDE_INDEX_URL,
    };
    this.setStatus("loading");
    this.bootPromise = new Promise<void>((resolve, reject) => {
      this.bootSettle = { resolve, reject };
    });
    this.post({
      t: "boot",
      indexURL: this.bootOpts.indexURL,
      packages: BOOT_PACKAGES,
      initScript: this.bootOpts.initScript,
      fontUrl: "/fonts/Pretendard-Regular.otf",
    });
    if (this.sharedInterrupt) {
      this.post({ t: "setInterruptBuffer", buffer: this.sharedInterrupt.sab });
    }
    return this.bootPromise;
  }

  /** 실행 중단. SAB로 SIGINT를 보내고, 2초 안에 결과가 없거나 비격리 환경이면
   *  워커를 종료·재부트한다(변수 초기화 — 'reboot' 이벤트로 UI에 알림) */
  interrupt(): void {
    const inflight = [...this.pending.keys()];
    if (inflight.length === 0) return;
    if (this.sharedInterrupt && this.readyFlag) {
      this.sharedInterrupt.view[0] = INTERRUPT_SIGINT;
      setTimeout(() => {
        if (inflight.some((id) => this.pending.has(id))) void this.terminateAndReboot();
      }, 2000);
    } else {
      void this.terminateAndReboot();
    }
  }

  /** 워커 종료 후 같은 설정으로 재부트. 대기 중 요청은 모두 거부된다 */
  async terminateAndReboot(): Promise<void> {
    if (this.status === "rebooting") return;
    this.worker.terminate();
    const err = new Error("런타임이 재설정되어 실행이 중단되었습니다");
    for (const p of this.pending.values()) {
      if (p.timer) clearTimeout(p.timer);
      p.reject(err);
    }
    this.pending.clear();
    this.queue = [];
    this.bootSettle?.reject(err);
    this.bootSettle = null;
    this.bootPromise = null;
    this.readyFlag = false;
    if (this.sharedInterrupt) this.sharedInterrupt.view[0] = 0;
    this.setStatus("rebooting");
    this.emit("reboot", undefined);
    this.spawn();
    await this.boot(); // bootOpts 유지 — 같은 initScript로 재부트
  }

  // ── 요청/응답 ───────────────────────────────────────────

  private post(msg: MainToWorker): void {
    this.worker.postMessage(msg);
  }

  private request(
    msg: MainToWorker & { id: number },
    opts: { busy?: boolean; timeoutSec?: number } = {},
  ): Promise<WorkerToMain> {
    return new Promise<WorkerToMain>((resolve, reject) => {
      const timer = opts.timeoutSec
        ? setTimeout(() => this.interrupt(), opts.timeoutSec * 1000)
        : undefined;
      this.pending.set(msg.id, { resolve, reject, timer, busy: opts.busy ?? false });
      if (this.readyFlag) {
        this.post(msg);
        this.refreshStatus();
      } else {
        this.queue.push(msg); // 준비 전 큐잉 — ready 시 flush
      }
    });
  }

  private settle(id: number, msg: WorkerToMain): void {
    const p = this.pending.get(id);
    if (!p) return;
    if (p.timer) clearTimeout(p.timer);
    this.pending.delete(id);
    // 타임아웃으로 SIGINT를 썼는데 그 직후 정상 응답이 온 경우, 남은 신호가
    // 다음 실행을 오염시키지 않도록 버퍼를 비운다
    if (this.sharedInterrupt) this.sharedInterrupt.view[0] = 0;
    p.resolve(msg);
    this.refreshStatus();
  }

  private refreshStatus(): void {
    if (!this.readyFlag) return;
    let busy = false;
    for (const p of this.pending.values()) {
      if (p.busy) {
        busy = true;
        break;
      }
    }
    this.setStatus(busy ? "running" : "ready");
  }

  private handle(msg: WorkerToMain): void {
    switch (msg.t) {
      case "progress":
        this.emit("progress", { pct: msg.pct, label: msg.label });
        break;
      case "ready": {
        this.readyFlag = true;
        this.versions = { pyVersion: msg.pyVersion, pyodideVersion: msg.pyodideVersion };
        this.bootSettle?.resolve();
        this.bootSettle = null;
        const q = this.queue;
        this.queue = [];
        for (const m of q) this.post(m);
        this.refreshStatus();
        break;
      }
      case "bootError": {
        this.setStatus("error");
        const err = new Error(msg.message);
        this.bootSettle?.reject(err);
        this.bootSettle = null;
        for (const p of this.pending.values()) {
          if (p.timer) clearTimeout(p.timer);
          p.reject(err);
        }
        this.pending.clear();
        this.queue = [];
        break;
      }
      case "stdout":
        this.emit("stdout", { id: msg.id, chunk: msg.chunk });
        break;
      case "stderr":
        this.emit("stderr", { id: msg.id, chunk: msg.chunk });
        break;
      default:
        if ("id" in msg) this.settle(msg.id, msg);
    }
  }

  // ── 공개 API ────────────────────────────────────────────

  /** 블록 실행. output(출력 선택)을 주면 마지막 표현식 대신 지정 변수·열·행이 결과가 된다 */
  async run(
    blockId: string,
    code: string,
    snapshots: Record<string, RangeSnapshot> = {},
    outputMode: OutputMode = "object",
    includeIndex: IncludeIndex = "auto",
    timeoutSec = this.defaultTimeoutSec,
    output?: OutputSelection,
  ): Promise<RunPayload> {
    const id = this.nextId++;
    const res = (await this.request(
      { t: "run", id, blockId, code, snapshots, outputMode, includeIndex, output },
      { busy: true, timeoutSec },
    )) as Extract<WorkerToMain, { t: "result" }>;
    const { t: _t, id: _id, blockId: _blockId, ...payload } = res;
    return payload as RunPayload;
  }

  /** 콘솔 REPL 한 줄 실행. stdout/stderr는 이벤트로 스트리밍된다 */
  async repl(
    code: string,
    timeoutSec = this.defaultTimeoutSec,
  ): Promise<{ repr: string | null; traceback?: string }> {
    const id = this.nextId++;
    const res = (await this.request(
      { t: "repl", id, code },
      { busy: true, timeoutSec },
    )) as Extract<WorkerToMain, { t: "replResult" }>;
    return { repr: res.repr, traceback: res.traceback };
  }

  /** xl() 참조 추출. M3는 빈 배열(M4에서 xl.py ast 분석 추가) */
  async analyze(code: string): Promise<string[]> {
    const id = this.nextId++;
    const res = await this.request({ t: "analyze", id, code });
    if (res.t === "analyzeError") throw new Error(res.message);
    return (res as Extract<WorkerToMain, { t: "analyzed" }>).refs;
  }

  /** 전역 변수 목록(변수 탭) */
  async inspect(): Promise<VariableInfo[]> {
    const id = this.nextId++;
    const res = (await this.request({ t: "inspect", id })) as Extract<
      WorkerToMain,
      { t: "variables" }
    >;
    return res.vars;
  }

  /** 워커 안 best-effort 리셋(사용자 전역 삭제 + 초기화 스크립트 재실행).
   *  initScript를 주면 그 스크립트로 재설정하고, 이후 재부트에도 그 스크립트를 쓴다.
   *  완전 초기화는 terminateAndReboot() */
  async reset(initScript?: string): Promise<void> {
    const script = initScript ?? this.bootOpts?.initScript ?? DEFAULT_INIT_SCRIPT;
    if (this.bootOpts) {
      this.bootOpts.initScript = script;
    } else {
      // 부트 전 reset 호출(큐잉됨): boot()과 같은 규칙으로 indexURL 결정
      this.bootOpts = {
        initScript: script,
        indexURL: process.env.NEXT_PUBLIC_PYODIDE_INDEX_URL ?? DEFAULT_PYODIDE_INDEX_URL,
      };
    }
    const id = this.nextId++;
    await this.request(
      { t: "resetRuntime", id, initScript: script },
      { busy: true, timeoutSec: this.defaultTimeoutSec },
    );
  }
}

// ── 싱글턴 ────────────────────────────────────────────────

let singleton: RuntimeClient | null = null;

/** 앱 전역 런타임 클라이언트(워크북당 1 워커). 브라우저에서만 호출할 것 */
export function getRuntimeClient(): RuntimeClient {
  if (!singleton) singleton = new RuntimeClient();
  return singleton;
}
