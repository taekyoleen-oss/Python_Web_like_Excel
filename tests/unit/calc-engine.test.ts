// M5 계산 엔진 단위 테스트 — Pyodide 없이 전부 mock (G4 로직 커버)

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  buildGraph,
  calcOrder,
  dirtyPropagation,
  resolveRefs,
  RunCoordinator,
  type CalcBlock,
  type CalcHost,
  type SheetRange,
  type WorkbookView,
} from "@/lib/runtime/calc-engine";
import type { RunPayload } from "@/lib/runtime/protocol";
import type { CellRange, OutputSelection } from "@/types/workbook";

const blk = (
  id: string,
  anchor: { r: number; c: number },
  code = "",
  over: Partial<CalcBlock> = {},
): CalcBlock => ({
  id,
  sheetId: "s1",
  anchor,
  code,
  outputMode: "values",
  includeIndex: "auto",
  ...over,
});

const sr = (r0: number, c0: number, r1: number, c1: number, sheetId = "s1"): SheetRange => ({
  r0,
  c0,
  r1,
  c1,
  sheetId,
});

const range = (r0: number, c0: number, r1: number, c1: number): CellRange => ({ r0, c0, r1, c1 });

describe("resolveRefs", () => {
  test("무접두 참조는 자기 시트, 시트 참조는 resolveSheet, 미지·오류 참조는 건너뜀", () => {
    const out = resolveRefs(["A1:B2", "Sheet2!C3", "없는시트!A1", "###"], "s1", (n) =>
      n === "Sheet2" ? "s2" : undefined,
    );
    expect(out).toEqual([sr(0, 0, 1, 1), sr(2, 2, 2, 2, "s2")]);
  });
});

describe("buildGraph", () => {
  test("값 모드: B의 참조가 A의 spill과 겹치면 B→A 의존", () => {
    const blocks = [blk("A", { r: 0, c: 0 }), blk("B", { r: 10, c: 0 })];
    const resolved = new Map([
      ["A", []],
      ["B", [sr(2, 0, 2, 0)]], // A의 spill(0,0-4,1) 안
    ]);
    const g = buildGraph(blocks, resolved, new Map([["A", range(0, 0, 4, 1)]]));
    expect([...g.deps.get("B")!]).toEqual(["A"]);
    expect([...g.dependents.get("A")!]).toEqual(["B"]);
  });

  test("값 모드 spill 미실행(없음) → 앵커 1×1로 간주", () => {
    const blocks = [blk("A", { r: 3, c: 3 }), blk("B", { r: 10, c: 0 })];
    const resolved = new Map([
      ["A", []],
      ["B", [sr(3, 3, 3, 3)]],
    ]);
    const g = buildGraph(blocks, resolved, new Map());
    expect(g.deps.get("B")!.has("A")).toBe(true);
  });

  test("객체 모드: 앵커 셀만 의존 대상 (spill 범위 무시)", () => {
    const blocks = [
      blk("A", { r: 0, c: 0 }, "", { outputMode: "object" }),
      blk("B", { r: 10, c: 0 }),
      blk("C", { r: 20, c: 0 }),
    ];
    const resolved = new Map([
      ["A", []],
      ["B", [sr(0, 0, 0, 0)]], // 앵커 → 의존
      ["C", [sr(1, 0, 5, 5)]], // 앵커 밖 → 비의존 (spill이 있어도 객체 모드는 무시)
    ]);
    const g = buildGraph(blocks, resolved, new Map([["A", range(0, 0, 9, 9)]]));
    expect(g.deps.get("B")!.has("A")).toBe(true);
    expect(g.deps.get("C")!.size).toBe(0);
  });

  test("다른 시트의 같은 좌표는 겹치지 않는다", () => {
    const blocks = [blk("A", { r: 0, c: 0 }), blk("B", { r: 5, c: 0 }, "", { sheetId: "s2" })];
    const resolved = new Map([
      ["A", []],
      ["B", [sr(0, 0, 0, 0, "s2")]], // s2!A1 — A는 s1
    ]);
    const g = buildGraph(blocks, resolved, new Map([["A", range(0, 0, 0, 0)]]));
    expect(g.deps.get("B")!.size).toBe(0);
  });

  test("순수 함수: spill 변경 → 다시 부르면 그래프가 바뀐다", () => {
    const blocks = [blk("A", { r: 0, c: 0 }), blk("B", { r: 10, c: 0 })];
    const resolved = new Map([
      ["A", []],
      ["B", [sr(5, 0, 5, 0)]],
    ]);
    const before = buildGraph(blocks, resolved, new Map([["A", range(0, 0, 2, 0)]]));
    expect(before.deps.get("B")!.size).toBe(0);
    const after = buildGraph(blocks, resolved, new Map([["A", range(0, 0, 6, 0)]]));
    expect(after.deps.get("B")!.has("A")).toBe(true);
  });
});

describe("calcOrder", () => {
  test("독립 블록은 (시트 순, 앵커 행, 열)로 정렬", () => {
    const blocks = [
      blk("d", { r: 0, c: 5 }, "", { sheetId: "s2" }),
      blk("c", { r: 1, c: 0 }),
      blk("b", { r: 0, c: 3 }),
      blk("a", { r: 0, c: 3 }, "", { sheetId: "s2" }), // s2, 같은 행, 앞 열
    ];
    const g = buildGraph(blocks, new Map(blocks.map((b) => [b.id, []])), new Map());
    const { order, cycle } = calcOrder(blocks, ["s1", "s2"], g);
    expect(order).toEqual(["b", "c", "a", "d"]);
    expect(cycle).toEqual([]);
  });

  test("의존성이 기본 순서를 이긴다 (G4: A→B)", () => {
    // B(위쪽)가 A(아래쪽) spill을 참조 → A 먼저
    const blocks = [blk("B", { r: 0, c: 0 }, 'xl("A11")'), blk("A", { r: 10, c: 0 })];
    const resolved = new Map([
      ["B", [sr(10, 0, 10, 0)]],
      ["A", []],
    ]);
    const g = buildGraph(blocks, resolved, new Map([["A", range(10, 0, 12, 0)]]));
    expect(calcOrder(blocks, ["s1"], g).order).toEqual(["A", "B"]);
  });

  test("순환: 구성원 전부 cycle, order에서 제외. 독립 블록은 정상 정렬 (G4)", () => {
    const blocks = [blk("A", { r: 0, c: 0 }), blk("B", { r: 5, c: 0 }), blk("C", { r: 9, c: 0 })];
    const resolved = new Map([
      ["A", [sr(5, 0, 5, 0)]], // A→B 참조
      ["B", [sr(0, 0, 0, 0)]], // B→A 참조 (상호)
      ["C", []],
    ]);
    const g = buildGraph(
      blocks,
      resolved,
      new Map([
        ["A", range(0, 0, 0, 0)],
        ["B", range(5, 0, 5, 0)],
      ]),
    );
    const { order, cycle } = calcOrder(blocks, ["s1"], g);
    expect(cycle).toEqual(["A", "B"]);
    expect(order).toEqual(["C"]);
  });

  test("순환의 하위 블록은 순환이 아니므로 order에 남는다", () => {
    const blocks = [blk("A", { r: 0, c: 0 }), blk("B", { r: 5, c: 0 }), blk("D", { r: 9, c: 0 })];
    const resolved = new Map([
      ["A", [sr(5, 0, 5, 0)]],
      ["B", [sr(0, 0, 0, 0)]],
      ["D", [sr(0, 0, 0, 0)]], // D는 순환(A)을 참조하지만 스스로는 순환 아님
    ]);
    const g = buildGraph(
      blocks,
      resolved,
      new Map([
        ["A", range(0, 0, 0, 0)],
        ["B", range(5, 0, 5, 0)],
      ]),
    );
    const { order, cycle } = calcOrder(blocks, ["s1"], g);
    expect(cycle).toEqual(["A", "B"]);
    expect(order).toEqual(["D"]);
  });

  test("결정론: 같은 입력 → 같은 순서", () => {
    const blocks = [blk("x", { r: 2, c: 2 }), blk("y", { r: 2, c: 2 }), blk("z", { r: 0, c: 0 })];
    const g = buildGraph(blocks, new Map(blocks.map((b) => [b.id, []])), new Map());
    const a = calcOrder(blocks, ["s1"], g);
    const b = calcOrder(blocks, ["s1"], g);
    expect(a.order).toEqual(b.order);
    expect(a.order).toEqual(["z", "x", "y"]); // 동좌표는 id로 결정
  });
});

describe("dirtyPropagation", () => {
  const blocks = [
    blk("A", { r: 0, c: 0 }, 'xl("D1")'),
    blk("B", { r: 5, c: 0 }, 'xl("A1")'),
    blk("C", { r: 9, c: 0 }),
  ];
  const resolved = new Map([
    ["A", [sr(0, 3, 0, 3)]], // D1
    ["B", [sr(0, 0, 0, 0)]], // A1 = A의 spill
    ["C", []],
  ]);
  const g = buildGraph(blocks, resolved, new Map([["A", range(0, 0, 1, 0)]]));

  test("편집 범위가 참조와 겹치면 그 블록 + 하위 전부 dirty", () => {
    expect(dirtyPropagation(resolved, g, [sr(0, 3, 0, 3)], [])).toEqual(new Set(["A", "B"]));
  });

  test("코드 수정 블록 + 하위 dirty", () => {
    expect(dirtyPropagation(resolved, g, [], ["A"])).toEqual(new Set(["A", "B"]));
    expect(dirtyPropagation(resolved, g, [], ["B"])).toEqual(new Set(["B"]));
  });

  test("겹치지 않으면 빈 집합", () => {
    expect(dirtyPropagation(resolved, g, [sr(50, 50, 60, 60)], [])).toEqual(new Set());
  });
});

// ── RunCoordinator ───────────────────────────────────────

type HostEvent =
  | { kind: "busy"; id: string }
  | { kind: "result"; id: string; payload: RunPayload; cells: unknown; spill: CellRange | null };

function makeHost(cells: Record<string, { v: number; t: "n" }> = {}) {
  const events: HostEvent[] = [];
  const host: CalcHost = {
    getCell: (sheetId, r, c) => cells[`${sheetId}:${r}:${c}`],
    resolveSheet: (name) => (name === "Sheet2" ? "s2" : undefined),
    onBusy: (id) => events.push({ kind: "busy", id }),
    onResult: (id, payload, cellsOut, spill) =>
      events.push({ kind: "result", id, payload, cells: cellsOut, spill }),
  };
  return { host, events };
}

function makeClient() {
  const analyzeCalls: string[] = [];
  const runCalls: {
    blockId: string;
    snapshots: Record<string, unknown>;
    output?: OutputSelection;
  }[] = [];
  const ok: RunPayload = {
    ok: true,
    kind: "table",
    cells: [[{ v: 1, t: "n" }], [{ v: 2, t: "n" }]],
    stdout: "",
    stderr: "",
    durationMs: 1,
  };
  const client = {
    async analyze(code: string): Promise<string[]> {
      analyzeCalls.push(code);
      if (code.includes("BAD")) throw new Error("xl() 인수는 문자열 리터럴이어야 합니다");
      return [...code.matchAll(/xl\("([^"]+)"/g)].map((m) => m[1]);
    },
    async run(
      blockId: string,
      _code: string,
      snapshots: Record<string, unknown>,
      _outputMode?: string,
      _includeIndex?: string,
      _timeoutSec?: number,
      output?: OutputSelection,
    ) {
      runCalls.push({ blockId, snapshots, output });
      return ok;
    },
  };
  return { client, analyzeCalls, runCalls };
}

describe("RunCoordinator", () => {
  test("runAll: 위상 순서 실행, busy 선통지, 스냅샷·toCells·spillRange 적용", async () => {
    const { client, runCalls } = makeClient();
    const { host, events } = makeHost({ "s1:10:0": { v: 7, t: "n" } });
    const co = new RunCoordinator(client, host);
    // B(위)가 A(아래, spill A11:A12)를 참조 → A 먼저
    const view: WorkbookView = {
      blocks: [blk("B", { r: 0, c: 0 }, 'xl("A11")'), blk("A", { r: 10, c: 0 }, "1")],
      sheetOrder: ["s1"],
      spills: new Map([["A", range(10, 0, 11, 0)]]),
    };
    await co.runAll(view);
    expect(runCalls.map((r) => r.blockId)).toEqual(["A", "B"]);
    expect(events.filter((e) => e.kind === "busy").map((e) => e.id)).toEqual(["A", "B"]);
    // B의 스냅샷: A11 단일 셀 → scalar, 값은 getCell에서
    expect(runCalls[1].snapshots).toEqual({
      A11: { values: [[7]], types: [["n"]], scalar: true },
    });
    const resB = events.find((e) => e.kind === "result" && e.id === "B");
    expect(resB && resB.kind === "result" && resB.cells).toEqual([[{ v: 1, t: "n" }], [{ v: 2, t: "n" }]]);
    expect(resB && resB.kind === "result" && resB.spill).toEqual(range(0, 0, 1, 0));
  });

  test("순환 구성원 → PyGridCycleError '순환 참조', 실행 제외 (G4)", async () => {
    const { client, runCalls } = makeClient();
    const { host, events } = makeHost();
    const co = new RunCoordinator(client, host);
    const view: WorkbookView = {
      blocks: [blk("A", { r: 0, c: 0 }, 'xl("A6")'), blk("B", { r: 5, c: 0 }, 'xl("A1")')],
      sheetOrder: ["s1"],
      spills: new Map([
        ["A", range(0, 0, 0, 0)],
        ["B", range(5, 0, 5, 0)],
      ]),
    };
    await co.runAll(view);
    expect(runCalls).toEqual([]);
    const errs = events.filter((e) => e.kind === "result");
    expect(errs.map((e) => e.id).sort()).toEqual(["A", "B"]);
    for (const e of errs) {
      expect(e.kind === "result" && !e.payload.ok && e.payload.errorType).toBe("PyGridCycleError");
      expect(e.kind === "result" && !e.payload.ok && e.payload.message).toBe("순환 참조");
    }
  });

  test("analyze 오류 → PyGridAnalyzeError + 한국어 메시지, 캐시로 analyze 1회", async () => {
    const { client, analyzeCalls } = makeClient();
    const { host, events } = makeHost();
    const co = new RunCoordinator(client, host);
    const view: WorkbookView = {
      blocks: [blk("A", { r: 0, c: 0 }, "BAD xl(ref)")],
      sheetOrder: ["s1"],
      spills: new Map(),
    };
    await co.runAll(view);
    const res = events.find((e) => e.kind === "result");
    expect(res && res.kind === "result" && !res.payload.ok && res.payload.errorType).toBe(
      "PyGridAnalyzeError",
    );
    expect(res && res.kind === "result" && !res.payload.ok && res.payload.message).toBe(
      "xl() 인수는 문자열 리터럴이어야 합니다",
    );
    await co.runAll(view);
    expect(analyzeCalls.filter((c) => c === "BAD xl(ref)")).toHaveLength(1); // 코드 해시 캐시
  });

  test("교차 시트 스냅샷 + 미지 시트 → PyGridRefError", async () => {
    const { client, runCalls } = makeClient();
    const { host, events } = makeHost({ "s2:0:0": { v: 3, t: "n" } });
    const co = new RunCoordinator(client, host);
    const view: WorkbookView = {
      blocks: [
        blk("A", { r: 0, c: 0 }, 'xl("Sheet2!A1")'),
        blk("B", { r: 5, c: 0 }, 'xl("없는시트!A1")'),
      ],
      sheetOrder: ["s1"],
      spills: new Map(),
    };
    await co.runAll(view);
    expect(runCalls[0].snapshots).toEqual({
      "Sheet2!A1": { values: [[3]], types: [["n"]], scalar: true },
    });
    const errB = events.find((e) => e.kind === "result" && e.id === "B");
    expect(errB && errB.kind === "result" && !errB.payload.ok && errB.payload.errorType).toBe(
      "PyGridRefError",
    );
  });

  test("runBlocks: 시드 + 하위 의존만 실행", async () => {
    const { client, runCalls } = makeClient();
    const { host } = makeHost();
    const co = new RunCoordinator(client, host);
    const view: WorkbookView = {
      blocks: [
        blk("A", { r: 0, c: 0 }, "1"),
        blk("B", { r: 5, c: 0 }, 'xl("A1")'),
        blk("C", { r: 9, c: 0 }, "3"),
      ],
      sheetOrder: ["s1"],
      spills: new Map([["A", range(0, 0, 0, 0)]]),
    };
    await co.runBlocks(["A"], view);
    expect(runCalls.map((r) => r.blockId)).toEqual(["A", "B"]); // C 제외
  });

  test("block.output이 client.run으로 그대로 전달된다", async () => {
    const { client, runCalls } = makeClient();
    const { host } = makeHost();
    const co = new RunCoordinator(client, host);
    const output = { variable: "df", columns: ["a"], rowLimit: 5 };
    const view: WorkbookView = {
      blocks: [blk("A", { r: 0, c: 0 }, "1", { output })],
      sheetOrder: ["s1"],
      spills: new Map(),
    };
    await co.runAll(view);
    expect(runCalls[0].output).toEqual(output);
  });

  describe("자동 모드 디바운스", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    test("500ms 안의 연속 편집은 한 번으로 묶인다; 수동 모드는 무시", async () => {
      const { client, runCalls } = makeClient();
      const { host } = makeHost();
      const co = new RunCoordinator(client, host);
      const view: WorkbookView = {
        blocks: [blk("A", { r: 0, c: 0 }, 'xl("D1")')],
        sheetOrder: ["s1"],
        spills: new Map(),
      };
      co.notifyEdit([sr(0, 3, 0, 3)], [], view);
      co.notifyEdit([sr(0, 3, 0, 3)], [], view);
      await vi.advanceTimersByTimeAsync(499);
      expect(runCalls).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(1);
      await co.whenIdle();
      expect(runCalls.map((r) => r.blockId)).toEqual(["A"]); // 한 번만

      co.mode = "manual";
      co.notifyEdit([sr(0, 3, 0, 3)], [], view);
      await vi.advanceTimersByTimeAsync(1000);
      await co.whenIdle();
      expect(runCalls).toHaveLength(1); // 수동: 실행 없음
    });
  });
});

// ── 마크다운 블록(v1.1): 실행 대상 아님 ────────────────────

describe("마크다운 블록 제외", () => {
  const mdView = (): WorkbookView => ({
    blocks: [
      blk("M", { r: 0, c: 0 }, "## 요약 xl(A1)", { kind: "markdown" }),
      blk("A", { r: 5, c: 0 }, 'xl("A1")'),
    ],
    sheetOrder: ["s1"],
    spills: new Map([
      ["M", range(0, 0, 0, 0)],
      ["A", range(5, 0, 5, 0)],
    ]),
  });

  test("buildGraph: 노드도 의존 대상도 아니다", () => {
    const v = mdView();
    const resolved = new Map([
      ["M", [sr(5, 0, 5, 0)]], // M→A 참조(무시돼야 함)
      ["A", [sr(0, 0, 0, 0)]], // A→M 앵커 참조(의존 아님)
    ]);
    const g = buildGraph(v.blocks, resolved, v.spills);
    expect(g.deps.has("M")).toBe(false);
    expect(g.dependents.has("M")).toBe(false);
    expect(g.deps.get("A")!.size).toBe(0);
  });

  test("calcOrder: order·cycle 어디에도 없다 (상호 참조여도 순환 아님)", () => {
    const v = mdView();
    const resolved = new Map([
      ["M", [sr(5, 0, 5, 0)]],
      ["A", [sr(0, 0, 0, 0)]],
    ]);
    const g = buildGraph(v.blocks, resolved, v.spills);
    const { order, cycle } = calcOrder(v.blocks, ["s1"], g);
    expect(order).toEqual(["A"]);
    expect(cycle).toEqual([]);
  });

  test("dirtyPropagation: 마크다운 편집·참조 겹침 모두 dirty 아님", () => {
    const v = mdView();
    const resolved = new Map([
      ["M", [sr(0, 3, 0, 3)]],
      ["A", [sr(0, 3, 0, 3)]],
    ]);
    const g = buildGraph(v.blocks, resolved, v.spills);
    expect(dirtyPropagation(resolved, g, [], ["M"])).toEqual(new Set());
    expect(dirtyPropagation(resolved, g, [sr(0, 3, 0, 3)], [])).toEqual(new Set(["A"]));
  });

  test("runAll: analyze·run·onBusy·onResult 모두 없음", async () => {
    const { client, analyzeCalls, runCalls } = makeClient();
    const { host, events } = makeHost();
    const co = new RunCoordinator(client, host);
    const view: WorkbookView = {
      blocks: [
        blk("M", { r: 0, c: 0 }, "## 요약 xl(A1)", { kind: "markdown" }),
        blk("A", { r: 5, c: 0 }, "1"),
      ],
      sheetOrder: ["s1"],
      spills: new Map(),
    };
    await co.runAll(view);
    expect(runCalls.map((r) => r.blockId)).toEqual(["A"]);
    expect(analyzeCalls).toEqual(["1"]); // 마크다운 본문은 워커로 가지 않는다
    expect(events.map((e) => e.id)).not.toContain("M");
  });

  test("runBlocks(마크다운 시드) → 아무것도 실행되지 않는다", async () => {
    const { client, runCalls } = makeClient();
    const { host, events } = makeHost();
    const co = new RunCoordinator(client, host);
    const view: WorkbookView = {
      blocks: [
        blk("M", { r: 0, c: 0 }, "", { kind: "markdown" }),
        blk("A", { r: 5, c: 0 }, "1"),
      ],
      sheetOrder: ["s1"],
      spills: new Map(),
    };
    await co.runBlocks(["M"], view);
    expect(runCalls).toEqual([]);
    expect(events).toEqual([]);
  });
});
