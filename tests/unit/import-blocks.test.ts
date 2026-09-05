// R3: "블록으로 보내기" — 마크다운 제목 + 섹션별 코드 블록을 한 undo 단계로 생성 (부록 E)
import { beforeEach, describe, expect, it } from "vitest";
import { createReferenceBlocks, sendToWorkbook } from "@/lib/grid/import-blocks";
import { useWorkbookStore } from "@/lib/grid/model";
import { cellKey } from "@/types/workbook";

const st = () => useWorkbookStore.getState();

beforeEach(() => {
  st().newWorkbook();
});

describe("createReferenceBlocks / sendToWorkbook", () => {
  it("마크다운 1개 + 섹션별 코드 블록 N개, 제목 배선", () => {
    const ids = createReferenceBlocks("선형회귀 (Linear Regression)", [
      { title: "statsmodels — 요약표", code: "import statsmodels.api as sm" },
      { title: "scikit-learn — 예측", code: "from sklearn.linear_model import LinearRegression" },
    ]);
    expect(ids).toHaveLength(3);
    const blocks = st().workbook.pyBlocks;
    expect(blocks).toHaveLength(3);
    const [md, c1, c2] = blocks;
    expect(md.kind).toBe("markdown");
    expect(md.markdown).toBe("# 선형회귀 (Linear Regression)");
    expect(md.title).toBe("선형회귀 (Linear Regression)"); // 목차 제목 = 첫 헤딩
    expect(c1.kind).toBeUndefined();
    expect(c1.title).toBe("statsmodels — 요약표");
    expect(c1.code).toContain("statsmodels");
    expect(c1.outputs).toHaveLength(1); // 코드 블록은 출력 1개 보장
    expect(c2.title).toBe("scikit-learn — 예측");
  });

  it("한 트랜잭션 = 한 undo 단계", () => {
    createReferenceBlocks("t", [{ code: "a=1" }, { code: "b=2" }]);
    expect(st().workbook.pyBlocks).toHaveLength(3);
    useWorkbookStore.temporal.getState().undo();
    expect(st().workbook.pyBlocks).toHaveLength(0);
  });

  it("앵커는 사용 범위 + 2열 여백, 세로 2행 간격", () => {
    // 데이터가 0~2열에 있으면 새 블록은 4열부터
    const sheetId = st().activeSheetId;
    st().setCells(sheetId, [
      { r: 0, c: 0, cell: { v: "x", t: "s" } },
      { r: 5, c: 2, cell: { v: 1, t: "n" } },
    ]);
    const ids = createReferenceBlocks("t", [{ code: "a=1" }, { code: "b=2" }]);
    const blocks = st().workbook.pyBlocks.filter((b) => ids.includes(b.id));
    expect(blocks.map((b) => b.anchor)).toEqual([
      { r: 0, c: 4 },
      { r: 2, c: 4 },
      { r: 4, c: 4 },
    ]);
  });

  it("앵커가 사용 셀·기존 블록 앵커와 절대 겹치지 않는다", () => {
    const sheetId = st().activeSheetId;
    st().setCells(sheetId, [
      { r: 9, c: 0, cell: { v: "used", t: "s" } },
      { r: 0, c: 2, cell: { v: "conflict", t: "s" } },
    ]);
    // 기존 블록 앵커(2,4)도 사용 범위 → 후보 열은 4+2=6
    st().addPyBlock(sheetId, { r: 2, c: 4 });
    const ids = createReferenceBlocks("t", [{ code: "a=1" }]);
    const blocks = st().workbook.pyBlocks.filter((b) => ids.includes(b.id));
    expect(blocks.every((b) => b.anchor.c === 6)).toBe(true);
    // 어떤 앵커도 값 있는 셀·다른 블록 앵커 위에 없다
    const sheet = st().workbook.sheets[0];
    const all = st().workbook.pyBlocks;
    for (const b of blocks) {
      expect(sheet.cells[cellKey(b.anchor.r, b.anchor.c)]).toBeUndefined();
      expect(
        all.filter((x) => x.anchor.r === b.anchor.r && x.anchor.c === b.anchor.c),
      ).toHaveLength(1);
    }
  });

  it("빈 시트면 0열부터 시작, 섹션 없으면 아무것도 만들지 않는다", () => {
    expect(createReferenceBlocks("t", [])).toEqual([]);
    const ids = createReferenceBlocks("t", [{ code: "a=1" }]);
    const blocks = st().workbook.pyBlocks;
    expect(ids).toHaveLength(2);
    expect(blocks[0].anchor).toEqual({ r: 0, c: 0 });
  });

  it("sendToWorkbook은 워크북 뷰 전환 + 첫 블록 포커스", () => {
    st().setView("reference");
    const ids = sendToWorkbook("t", [{ code: "a=1" }]);
    expect(st().view).toBe("workbook");
    expect(st().focusBlockId).toBe(ids[0]);
  });
});
