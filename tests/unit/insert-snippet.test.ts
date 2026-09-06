// 부록 F.1 — 스니펫 삽입: 덧붙이기(1 undo) + 계산 순서를 보장하는 새 블록 배치
import { beforeEach, describe, expect, it } from "vitest";
import {
  appendSnippetToBlock,
  insertSnippetAsBlock,
  placeAdjacentAnchor,
} from "@/lib/grid/insert-snippet";
import { blocksInOrder, useWorkbookStore } from "@/lib/grid/model";

const st = () => useWorkbookStore.getState();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const orderIds = () => blocksInOrder(st().workbook).map((b) => b.id);

beforeEach(() => {
  st().newWorkbook();
});

describe("appendSnippetToBlock", () => {
  it("빈 줄 구분으로 덧붙이고, 빈 블록이면 대체한다", () => {
    const sid = st().activeSheetId;
    const id = st().addPyBlock(sid, { r: 0, c: 0 })!;
    expect(appendSnippetToBlock(id, "# ▸ A\nb = 2")).toBe(true);
    expect(st().workbook.pyBlocks[0].code).toBe("# ▸ A\nb = 2"); // 빈 블록 → 대체

    st().setBlockCode(id, "a = 1\n"); // 끝 공백·개행은 정리된다
    appendSnippetToBlock(id, "# ▸ B\nc = 3");
    expect(st().workbook.pyBlocks[0].code).toBe("a = 1\n\n# ▸ B\nc = 3");
  });

  it("Ctrl+Z 한 번(= undo 한 단계)에 덧붙이기 전으로 돌아간다", async () => {
    const sid = st().activeSheetId;
    const id = st().addPyBlock(sid, { r: 0, c: 0 })!;
    await sleep(350);
    st().setBlockCode(id, "a = 1");
    await sleep(350);
    appendSnippetToBlock(id, "# ▸ A\nb = 2");
    await sleep(350);
    useWorkbookStore.temporal.getState().undo();
    expect(st().workbook.pyBlocks[0].code).toBe("a = 1");
  });

  it("마크다운·없는 블록은 거부", () => {
    const sid = st().activeSheetId;
    const md = st().addPyBlock(sid, { r: 0, c: 0 }, "markdown")!;
    expect(appendSnippetToBlock(md, "x")).toBe(false);
    expect(appendSnippetToBlock("ghost", "x")).toBe(false);
  });
});

describe("placeAdjacentAnchor (순수 배치)", () => {
  it("아래: 같은 열의 바로 다음 행", () => {
    const sid = st().activeSheetId;
    const ref = st().addPyBlock(sid, { r: 0, c: 3 })!;
    expect(placeAdjacentAnchor(st().workbook, ref, "below")).toEqual({
      sheetId: sid,
      r: 1,
      c: 3,
    });
  });

  it("위: 같은 열의 바로 앞 행 (이웃과 기준 사이)", () => {
    const sid = st().activeSheetId;
    st().addPyBlock(sid, { r: 0, c: 2 });
    const ref = st().addPyBlock(sid, { r: 5, c: 2 })!;
    expect(placeAdjacentAnchor(st().workbook, ref, "above")).toEqual({
      sheetId: sid,
      r: 4,
      c: 2,
    });
  });

  it("같은 열이 막히면 순서가 유지되는 다른 빈 위치로 폴백", () => {
    const sid = st().activeSheetId;
    const ref = st().addPyBlock(sid, { r: 0, c: 3 })!;
    const next = st().addPyBlock(sid, { r: 2, c: 3 })!;
    // 같은 열 사이 행(1,3)을 값 셀로 막는다
    st().setCells(sid, [{ r: 1, c: 3, cell: { v: "막힘", t: "s" } }]);
    const spot = placeAdjacentAnchor(st().workbook, ref, "below")!;
    expect(spot).not.toBeNull();
    // 배치 결과가 실제로 (ref, spot, next) 순서를 만든다
    const p = { r: spot.r, c: spot.c };
    const after = (a: { r: number; c: number }, b: { r: number; c: number }) =>
      a.r < b.r || (a.r === b.r && a.c < b.c);
    expect(after({ r: 0, c: 3 }, p)).toBe(true);
    expect(after(p, { r: 2, c: 3 })).toBe(true);
    void next;
  });

  it("사이 공간이 전혀 없으면 null (바로 옆 앵커 + 모든 후보 점유)", () => {
    const sid = st().activeSheetId;
    const ref = st().addPyBlock(sid, { r: 0, c: 0 })!;
    st().addPyBlock(sid, { r: 0, c: 1 }); // 계산 순서상 바로 다음
    const sheet = st().workbook.sheets[0];
    // (0,0)과 (0,1) 사이 후보는 없다 — 남은 스캔 폭 전부 값으로 채울 필요도 없이 빈 구간
    expect(placeAdjacentAnchor(st().workbook, ref, "below")).toBeNull();
    void sheet;
  });

  it("위인데 기준이 (0,0)이면 null → 폴백 대상", () => {
    const sid = st().activeSheetId;
    const ref = st().addPyBlock(sid, { r: 0, c: 0 })!;
    expect(placeAdjacentAnchor(st().workbook, ref, "above")).toBeNull();
  });

  it("값·spill 셀·다른 블록 앵커 위에는 절대 놓지 않는다", () => {
    const sid = st().activeSheetId;
    const ref = st().addPyBlock(sid, { r: 0, c: 0 })!;
    st().setCells(sid, [
      { r: 1, c: 0, cell: { v: 1, t: "n" } },
      { r: 2, c: 0, cell: { v: "x", t: "s", src: "spill-tag" } },
    ]);
    const spot = placeAdjacentAnchor(st().workbook, ref, "below")!;
    expect(spot).toEqual({ sheetId: sid, r: 3, c: 0 });
  });
});

describe("insertSnippetAsBlock", () => {
  it("아래/위 — 계산 순서상 기준 바로 뒤/앞, 제목·출력 1개 보장, 자동 실행 없음", () => {
    const sid = st().activeSheetId;
    const ref = st().addPyBlock(sid, { r: 3, c: 2 })!;
    const below = insertSnippetAsBlock(ref, "below", "아래 스니펫", "# ▸ 아래\nx = 1")!;
    expect(below.ordered).toBe(true);
    const above = insertSnippetAsBlock(ref, "above", "위 스니펫", "# ▸ 위\ny = 2")!;
    expect(above.ordered).toBe(true);

    expect(orderIds()).toEqual([above.id, ref, below.id]);
    const created = st().workbook.pyBlocks.find((b) => b.id === below.id)!;
    expect(created.title).toBe("아래 스니펫");
    expect(created.code).toBe("# ▸ 아래\nx = 1");
    expect(created.outputs).toHaveLength(1);
    expect(created.last).toBeUndefined(); // 실행되지 않았다
    expect(st().runningBlocks).toEqual({});
  });

  it("한 삽입 = 한 undo 단계", async () => {
    const sid = st().activeSheetId;
    const ref = st().addPyBlock(sid, { r: 0, c: 0 })!;
    await sleep(350);
    insertSnippetAsBlock(ref, "below", "t", "x = 1");
    await sleep(350);
    expect(st().workbook.pyBlocks).toHaveLength(2);
    useWorkbookStore.temporal.getState().undo();
    expect(st().workbook.pyBlocks).toHaveLength(1);
  });

  it("기준 없음·배치 불가 → 빈 영역 폴백(ordered:false)", () => {
    // 기준 없음
    const noRef = insertSnippetAsBlock(null, "below", "t1", "a = 1")!;
    expect(noRef.ordered).toBe(false);
    expect(st().workbook.pyBlocks.some((b) => b.id === noRef.id)).toBe(true);

    st().newWorkbook();
    // 기준 (0,0)의 '위'는 순서 보장 위치가 없다
    const sid = st().activeSheetId;
    const ref = st().addPyBlock(sid, { r: 0, c: 0 })!;
    const res = insertSnippetAsBlock(ref, "above", "t2", "b = 2")!;
    expect(res.ordered).toBe(false);
    const block = st().workbook.pyBlocks.find((b) => b.id === res.id)!;
    expect(block.title).toBe("t2");
  });
});
