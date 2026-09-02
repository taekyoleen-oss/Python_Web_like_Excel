import { describe, expect, it } from "vitest";
import { createWorkbookStore } from "@/lib/grid/model";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const fresh = () => {
  const store = createWorkbookStore();
  return { store, sheetId: store.getState().workbook.sheets[0].id };
};

const cells = (store: ReturnType<typeof createWorkbookStore>) =>
  store.getState().workbook.sheets[0].cells;

describe("워크북 스토어", () => {
  it("기본 새 워크북: Sheet1 200×26, timeoutSec 60, calcMode auto", () => {
    const { store } = fresh();
    const wb = store.getState().workbook;
    expect(wb.sheets).toHaveLength(1);
    expect(wb.sheets[0].name).toBe("Sheet1");
    expect(wb.sheets[0].rowCount).toBe(200);
    expect(wb.sheets[0].colCount).toBe(26);
    expect(wb.calcMode).toBe("auto");
    expect(wb.settings).toEqual({ timeoutSec: 60, inferTypesOnPaste: true });
  });

  it("셀 설정·삭제·범위 지우기", () => {
    const { store, sheetId } = fresh();
    expect(store.getState().setCellValue(sheetId, 1, 2, { v: 42, t: "n" })).toBe(true);
    expect(cells(store)["1:2"]).toEqual({ v: 42, t: "n" });
    store.getState().setCellValue(sheetId, 1, 2, null);
    expect(cells(store)["1:2"]).toBeUndefined();

    store.getState().setCells(sheetId, [
      { r: 0, c: 0, cell: { v: "a", t: "s" } },
      { r: 0, c: 1, cell: { v: "b", t: "s" } },
      { r: 5, c: 5, cell: { v: 1, t: "n" } },
    ]);
    store.getState().clearRange(sheetId, { r0: 0, c0: 0, r1: 0, c1: 3 });
    expect(cells(store)["0:0"]).toBeUndefined();
    expect(cells(store)["0:1"]).toBeUndefined();
    expect(cells(store)["5:5"]).toBeDefined();
  });

  it("행 삽입/삭제 시 키 이동", () => {
    const { store, sheetId } = fresh();
    store.getState().setCells(sheetId, [
      { r: 0, c: 0, cell: { v: "머리", t: "s" } },
      { r: 5, c: 3, cell: { v: 7, t: "n" } },
    ]);
    store.getState().insertRows(sheetId, 2, 2);
    expect(store.getState().workbook.sheets[0].rowCount).toBe(202);
    expect(cells(store)["0:0"]).toBeDefined(); // 삽입 지점 이전은 그대로
    expect(cells(store)["5:3"]).toBeUndefined();
    expect(cells(store)["7:3"]).toEqual({ v: 7, t: "n" });

    store.getState().deleteRows(sheetId, 0, 1); // 첫 행 삭제
    expect(cells(store)["0:0"]).toBeUndefined();
    expect(cells(store)["6:3"]).toEqual({ v: 7, t: "n" });
    expect(store.getState().workbook.sheets[0].rowCount).toBe(201);
  });

  it("열 삽입/삭제 시 키·colWidths 이동", () => {
    const { store, sheetId } = fresh();
    store.getState().setCellValue(sheetId, 0, 4, { v: "x", t: "s" });
    store.getState().setColWidth(sheetId, 4, 120);
    store.getState().insertCols(sheetId, 2, 3);
    expect(cells(store)["0:7"]).toEqual({ v: "x", t: "s" });
    expect(store.getState().workbook.sheets[0].colWidths).toEqual({ 7: 120 });
    expect(store.getState().workbook.sheets[0].colCount).toBe(29);

    store.getState().deleteCols(sheetId, 0, 2);
    expect(cells(store)["0:5"]).toEqual({ v: "x", t: "s" });
    expect(store.getState().workbook.sheets[0].colWidths).toEqual({ 5: 120 });
    expect(store.getState().workbook.sheets[0].colCount).toBe(27);

    // frozenCols는 colCount - 1로 클램프 (setFrozenCols와 같은 불변식)
    store.getState().setFrozenCols(sheetId, 26);
    store.getState().deleteCols(sheetId, 0, 25);
    const sheet = store.getState().workbook.sheets[0];
    expect(sheet.colCount).toBe(2);
    expect(sheet.frozenCols).toBe(1);
  });

  it("undo/redo — temporal (300ms 스로틀 간격)", async () => {
    const { store, sheetId } = fresh();
    store.getState().setCellValue(sheetId, 0, 0, { v: "a", t: "s" });
    await sleep(350);
    store.getState().setCellValue(sheetId, 0, 0, { v: "b", t: "s" });
    await sleep(350);

    const temporal = store.temporal.getState();
    temporal.undo();
    expect(cells(store)["0:0"]).toEqual({ v: "a", t: "s" });
    temporal.undo();
    expect(cells(store)["0:0"]).toBeUndefined();
    temporal.redo();
    expect(cells(store)["0:0"]).toEqual({ v: "a", t: "s" });
    temporal.redo();
    expect(cells(store)["0:0"]).toEqual({ v: "b", t: "s" });
  });

  it("selection·activeSheet 변경은 이력에 남지 않는다", async () => {
    const { store, sheetId } = fresh();
    store.getState().setCellValue(sheetId, 0, 0, { v: 1, t: "n" });
    await sleep(350);
    const depth = store.temporal.getState().pastStates.length;
    store.getState().setSelection({ r0: 0, c0: 0, r1: 3, c1: 3 });
    store.getState().setSelection(null);
    await sleep(350);
    expect(store.temporal.getState().pastStates.length).toBe(depth);
  });

  it("src 잠긴 셀 편집 거부", () => {
    const { store, sheetId } = fresh();
    store.getState().setCells(sheetId, [
      { r: 0, c: 0, cell: { v: 1, t: "n", src: "blk1" } },
    ]);
    expect(store.getState().setCellValue(sheetId, 0, 0, { v: 2, t: "n" })).toBe(false);
    expect(cells(store)["0:0"].v).toBe(1);
    // clearRange도 잠긴 셀은 남긴다
    store.getState().clearRange(sheetId, { r0: 0, c0: 0, r1: 0, c1: 0 });
    expect(cells(store)["0:0"].v).toBe(1);
  });

  it("시트 추가/이름 변경/이동/삭제", () => {
    const { store } = fresh();
    store.getState().addSheet();
    const wb = store.getState().workbook;
    expect(wb.sheets).toHaveLength(2);
    expect(wb.sheets[1].name).toBe("Sheet2");
    expect(store.getState().activeSheetId).toBe(wb.sheets[1].id);

    const id2 = wb.sheets[1].id;
    store.getState().renameSheet(id2, "결과");
    expect(store.getState().workbook.sheets[1].name).toBe("결과");

    store.getState().moveSheet(id2, -1);
    expect(store.getState().workbook.sheets[0].id).toBe(id2);

    store.getState().removeSheet(id2);
    expect(store.getState().workbook.sheets).toHaveLength(1);
    // 마지막 시트는 삭제 불가
    store.getState().removeSheet(store.getState().workbook.sheets[0].id);
    expect(store.getState().workbook.sheets).toHaveLength(1);
  });

  it("addSheetWithCells: 시트 생성+채우기가 undo 한 번에 되돌아간다", async () => {
    const { store, sheetId } = fresh();
    store.getState().setCellValue(sheetId, 0, 0, { v: 1, t: "n" });
    await sleep(350);
    store.getState().addSheetWithCells([
      { r: 0, c: 0, cell: { v: "x", t: "s" } },
      { r: 250, c: 30, cell: { v: 2, t: "n" } }, // rowCount/colCount 자동 확장
    ]);
    await sleep(350);
    const wb = store.getState().workbook;
    expect(wb.sheets).toHaveLength(2);
    expect(wb.sheets[1].cells["0:0"]).toEqual({ v: "x", t: "s" });
    expect(wb.sheets[1].rowCount).toBe(251);
    expect(wb.sheets[1].colCount).toBe(31);
    expect(store.getState().activeSheetId).toBe(wb.sheets[1].id);

    store.temporal.getState().undo();
    expect(store.getState().workbook.sheets).toHaveLength(1);
    expect(store.getState().workbook.sheets[0].cells["0:0"]).toEqual({ v: 1, t: "n" });
  });

  it("newWorkbook/loadWorkbook은 이력을 초기화한다", async () => {
    const { store, sheetId } = fresh();
    store.getState().setCellValue(sheetId, 0, 0, { v: 1, t: "n" });
    await sleep(350);
    expect(store.temporal.getState().pastStates.length).toBeGreaterThan(0);
    store.getState().newWorkbook();
    await sleep(350);
    expect(store.temporal.getState().pastStates.length).toBe(0);
    expect(store.getState().workbook.sheets[0].cells).toEqual({});
  });
});
