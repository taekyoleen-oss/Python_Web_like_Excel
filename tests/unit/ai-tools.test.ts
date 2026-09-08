// 부록 L.1·L.3 — 도구 실행기: 값 전송 상한·잘림 표시, list_sheets 값 미포함,
// propose_cells의 spill 거부·수식 경고, 제안 적용(1 undo·spill 보호).
import { beforeEach, describe, expect, it } from "vitest";
import {
  applyCellProposal,
  MAX_CELLS,
  MAX_CHARS,
  MAX_ROWS,
  runTool,
  TOOL_DEFS,
  type CellProposal,
} from "@/lib/ai/tools";
import { useWorkbookStore } from "@/lib/grid/model";
import { cellKey, type Cell } from "@/types/workbook";

const st = () => useWorkbookStore.getState();
const sid = () => st().workbook.sheets[0].id;

beforeEach(() => {
  st().newWorkbook();
});

/** r0..r1 × c0..c1 채우기 */
function fill(rows: number, cols: number, make: (r: number, c: number) => Cell): void {
  const edits = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) edits.push({ r, c, cell: make(r, c) });
  }
  st().setCells(sid(), edits);
}

describe("도구 스키마", () => {
  it("L.1의 5개 도구가 Anthropic tool 형식으로 정의된다", () => {
    expect(TOOL_DEFS.map((t) => t.name)).toEqual([
      "list_sheets",
      "read_range",
      "list_blocks",
      "propose_cells",
      "propose_block",
    ]);
    for (const t of TOOL_DEFS) {
      expect(t.description.length).toBeGreaterThan(10);
      expect(t.input_schema.type).toBe("object");
    }
  });
});

describe("list_sheets — 값 미포함", () => {
  it("시트명·사용 범위·헤더만 반환하고 데이터 값은 없다", () => {
    fill(3, 2, (r, c) => (r === 0 ? { v: c === 0 ? "보험금" : "연도", t: "s" } : { v: 987654, t: "n" }));
    const out = runTool("list_sheets", {});
    const json = JSON.stringify(out.result);
    expect(json).toContain("보험금");
    expect(json).not.toContain("987654");
    expect(out.summary).toContain("시트 목록");
  });
});

describe("read_range — 상한과 잘림 표시 (L.3)", () => {
  it("범위 값·열 유형을 반환한다", () => {
    st().setCells(sid(), [
      { r: 0, c: 0, cell: { v: "연도", t: "s" } },
      { r: 1, c: 0, cell: { v: 2026, t: "n" } },
      { r: 1, c: 1, cell: { v: true, t: "b" } },
    ]);
    const out = runTool("read_range", { ref: "A1:B2" });
    const res = out.result as {
      ok: boolean;
      values: unknown[][];
      truncated: boolean;
      returnedRef: string;
      colTypes: string[];
    };
    expect(res.ok).toBe(true);
    expect(res.values).toEqual([
      ["연도", null],
      [2026, true],
    ]);
    expect(res.truncated).toBe(false);
    expect(res.returnedRef).toBe("Sheet1!A1:B2");
    expect(res.colTypes).toEqual(["s", "b"]); // 열별 최빈 유형
    expect(out.summary).toBe("Sheet1!A1:B2 읽음 · 2행×2열");
    expect(out.ref).toMatchObject({ sheetId: sid(), r0: 0, c0: 0, r1: 1, c1: 1 });
  });

  it(`${MAX_ROWS}행 초과 요청은 잘라내고 truncated + 실제 반환 범위를 알린다`, () => {
    fill(5, 1, (r) => ({ v: r, t: "n" }));
    const out = runTool("read_range", { ref: "A1:A400" });
    const res = out.result as { rows: number; truncated: boolean; returnedRef: string; note: string };
    expect(res.rows).toBe(MAX_ROWS);
    expect(res.truncated).toBe(true);
    expect(res.returnedRef).toBe(`Sheet1!A1:A${MAX_ROWS}`);
    expect(res.note).toContain("잘렸습니다");
    expect(out.summary).toContain("잘림");
  });

  it(`셀 수 상한(${MAX_CELLS})으로 행이 더 줄어든다`, () => {
    const out = runTool("read_range", { ref: "A1:AX400" }); // 50열
    const res = out.result as { rows: number; cols: number; truncated: boolean };
    expect(res.cols).toBe(50);
    expect(res.rows).toBe(MAX_CELLS / 50); // 100행
    expect(res.rows * res.cols).toBeLessThanOrEqual(MAX_CELLS);
    expect(res.truncated).toBe(true);
  });

  it("maxRows 인수로 더 적게 읽을 수 있다", () => {
    fill(10, 1, (r) => ({ v: r, t: "n" }));
    const res = runTool("read_range", { ref: "A1:A10", maxRows: 3 }).result as { rows: number };
    expect(res.rows).toBe(3);
  });

  it(`셀당 ${MAX_CHARS}자를 넘는 문자열은 잘린다`, () => {
    st().setCells(sid(), [{ r: 0, c: 0, cell: { v: "가".repeat(500), t: "s" } }]);
    const res = runTool("read_range", { ref: "A1" }).result as {
      values: string[][];
      truncated: boolean;
    };
    expect(res.values[0][0]).toHaveLength(MAX_CHARS + 1); // + 말줄임표
    expect(res.truncated).toBe(true);
  });

  it("잘못된 참조·없는 시트는 throw하지 않고 사유를 결과로 돌려준다", () => {
    expect((runTool("read_range", { ref: "!!" }).result as { ok: boolean }).ok).toBe(false);
    const missing = runTool("read_range", { ref: "없는시트!A1" }).result as {
      ok: boolean;
      reason: string;
    };
    expect(missing.ok).toBe(false);
    expect(missing.reason).toContain("시트를 찾을 수 없습니다");
  });
});

describe("list_blocks", () => {
  it("제목·앵커·코드·note·오류 상태를 반환한다", () => {
    const id = st().addPyBlock(sid(), { r: 2, c: 1 })!;
    st().setBlockCode(id, "df.sum()");
    st().setBlockTitle(id, "합계");
    st().setBlockNote(id, "설명 문단");
    st().applyBlockResult(id, [], {
      last: {
        status: "error",
        stdout: "",
        stderr: "",
        traceback: "Traceback…NameError: name 'df'",
        summaryKo: "이름 오류",
        durationMs: 1,
        ranAt: new Date().toISOString(),
      },
    });
    const res = runTool("list_blocks", {}).result as {
      blocks: { title: string; anchor: string; code: string; note: string; summaryKo: string }[];
    };
    expect(res.blocks).toHaveLength(1);
    expect(res.blocks[0]).toMatchObject({
      title: "합계",
      anchor: "Sheet1!B3",
      code: "df.sum()",
      note: "설명 문단",
      summaryKo: "이름 오류",
    });
    expect(res.blocks[0]).toHaveProperty("traceback");
  });
});

describe("propose_cells — 적용하지 않고 제안만 (L.1)", () => {
  it("제안 객체를 만들고 결과로는 { proposed, id }만 돌려준다 (셀은 그대로)", () => {
    const out = runTool("propose_cells", {
      ref: "C1",
      values: [["합계"], [30]],
      reason: "요약 값을 옆 열에 적었습니다",
    });
    expect(out.result).toEqual({ proposed: true, id: expect.any(String) });
    expect(out.proposal).toMatchObject({ kind: "cells", label: "Sheet1!C1:C2" });
    // 시트는 아직 바뀌지 않았다
    expect(st().workbook.sheets[0].cells[cellKey(0, 2)]).toBeUndefined();
  });

  it("spill(src) 셀이 하나라도 있으면 거부하고 사유를 돌려준다", () => {
    st().setCells(sid(), [{ r: 0, c: 2, cell: { v: 1, t: "n", src: "blk:out" } }]);
    const out = runTool("propose_cells", { ref: "C1", values: [[1]], reason: "x" });
    const res = out.result as { ok: boolean; reason: string };
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("spill");
    expect(out.proposal).toBeUndefined();
    expect(out.summary).toContain("거부");
  });

  it("수식 셀 덮어쓰기는 경고 플래그로만 알린다(허용)", () => {
    st().setCells(sid(), [{ r: 0, c: 2, cell: { v: 3, t: "n", fx: "=1+2" } }]);
    const out = runTool("propose_cells", { ref: "C1", values: [[9]], reason: "x" });
    expect((out.result as { warning: string }).warning).toContain("수식 셀 1개");
    expect((out.proposal as CellProposal).formulaCells).toBe(1);
  });

  it("1차원 values는 1열로 본다 / 상한 초과는 거부", () => {
    const one = runTool("propose_cells", { ref: "C1", values: [1, 2, 3], reason: "x" });
    expect((one.proposal as CellProposal).values).toEqual([[1], [2], [3]]);
    const big = runTool("propose_cells", {
      ref: "A1",
      values: Array.from({ length: MAX_CELLS + 1 }, (_, i) => [i]),
      reason: "x",
    });
    expect((big.result as { ok: boolean }).ok).toBe(false);
  });
});

describe("propose_block", () => {
  it("대상 블록 id를 주면 앵커 칩 라벨을 만든다", () => {
    const id = st().addPyBlock(sid(), { r: 2, c: 1 })!;
    st().setBlockTitle(id, "손해율");
    const out = runTool("propose_block", { code: "x = 1", title: "수정안", targetBlockId: id });
    expect(out.result).toEqual({ proposed: true, id: expect.any(String) });
    expect(out.proposal).toMatchObject({
      kind: "block",
      code: "x = 1",
      targetBlockId: id,
      targetLabel: "Sheet1!B3 · 손해율",
    });
    expect(st().workbook.pyBlocks).toHaveLength(1); // 블록은 생성되지 않았다
  });

  it("빈 코드는 거부", () => {
    expect((runTool("propose_block", { code: "  " }).result as { ok: boolean }).ok).toBe(false);
  });
});

describe("applyCellProposal — 사용자가 [적용]을 누를 때만", () => {
  const proposal = (): CellProposal =>
    runTool("propose_cells", {
      ref: "C1",
      values: [["합계", 10], ["평균", 5]],
      reason: "x",
    }).proposal as CellProposal;

  it("한 트랜잭션 = 1 undo 단계로 반영된다", () => {
    const p = proposal();
    const before = useWorkbookStore.temporal.getState().pastStates.length;
    const res = applyCellProposal(p);
    expect(res).toEqual({ range: { sheetId: sid(), r0: 0, c0: 2, r1: 1, c1: 3 } });
    expect(st().workbook.sheets[0].cells[cellKey(0, 2)]?.v).toBe("합계");
    expect(st().workbook.sheets[0].cells[cellKey(1, 3)]?.v).toBe(5);
    expect(useWorkbookStore.temporal.getState().pastStates.length).toBe(before + 1);

    useWorkbookStore.temporal.getState().undo();
    expect(st().workbook.sheets[0].cells[cellKey(0, 2)]).toBeUndefined();
  });

  it("적용 시점에 spill 셀이 생겼으면 아무것도 쓰지 않고 사유를 돌려준다", () => {
    const p = proposal();
    st().setCells(sid(), [{ r: 1, c: 3, cell: { v: 1, t: "n", src: "blk:out" } }]);
    const res = applyCellProposal(p);
    expect(res).toHaveProperty("error");
    expect(st().workbook.sheets[0].cells[cellKey(0, 2)]).toBeUndefined();
  });

  it("문자열 값은 붙여넣기와 같은 유형 추론을 거친다", () => {
    const p = runTool("propose_cells", { ref: "C1", values: [["1,234", "12.5%"]], reason: "x" })
      .proposal as CellProposal;
    applyCellProposal(p);
    expect(st().workbook.sheets[0].cells[cellKey(0, 2)]).toMatchObject({ v: 1234, t: "n" });
    expect(st().workbook.sheets[0].cells[cellKey(0, 3)]).toMatchObject({ v: 0.125, t: "n" });
  });
});
