import { describe, expect, it } from "vitest";
import { parseWorkbookJson, serializeWorkbook } from "@/lib/io/workbook-json";
import { createWorkbookStore, isRangeBold } from "@/lib/grid/model";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const fresh = () => {
  const store = createWorkbookStore();
  return { store, sid: store.getState().workbook.sheets[0].id };
};
const cells = (store: ReturnType<typeof createWorkbookStore>) =>
  store.getState().workbook.sheets[0].cells;

describe("applyCellStyle (부록 J.2)", () => {
  it("범위 병합 적용 — 값 있는 셀은 st 병합, 빈 셀은 {v:null} 서식 셀 생성", () => {
    const { store, sid } = fresh();
    store.getState().setCellValue(sid, 0, 0, { v: 1, t: "n" });
    store.getState().applyCellStyle(sid, { r0: 0, c0: 0, r1: 0, c1: 1 }, { b: true });
    expect(cells(store)["0:0"]).toEqual({ v: 1, t: "n", st: { b: true } });
    expect(cells(store)["0:1"]).toEqual({ v: null, t: "s", st: { b: true } });
    // 크기 추가 병합 — 굵게 유지
    store.getState().applyCellStyle(sid, { r0: 0, c0: 0, r1: 0, c1: 0 }, { fs: 16 });
    expect(cells(store)["0:0"].st).toEqual({ b: true, fs: 16 });
  });

  it("서식 제거 — b:false·fs:null. 서식만 있던 빈 셀은 삭제된다", () => {
    const { store, sid } = fresh();
    store.getState().applyCellStyle(sid, { r0: 0, c0: 0, r1: 0, c1: 0 }, { b: true, fs: 20 });
    store.getState().applyCellStyle(sid, { r0: 0, c0: 0, r1: 0, c1: 0 }, { fs: null });
    expect(cells(store)["0:0"].st).toEqual({ b: true });
    store.getState().applyCellStyle(sid, { r0: 0, c0: 0, r1: 0, c1: 0 }, { b: false });
    expect(cells(store)["0:0"]).toBeUndefined(); // 빈 서식 셀 정리
  });

  it("src(spill) 셀은 제외", () => {
    const { store, sid } = fresh();
    store.getState().setCells(sid, [{ r: 0, c: 0, cell: { v: 7, t: "n", src: "b:o" } }]);
    store.getState().applyCellStyle(sid, { r0: 0, c0: 0, r1: 0, c1: 0 }, { b: true });
    expect(cells(store)["0:0"].st).toBeUndefined();
  });

  it("굵게 토글 판정 isRangeBold — 전부 굵어야 true, src 셀은 판정 제외", () => {
    const { store, sid } = fresh();
    const sheet = () => store.getState().workbook.sheets[0];
    const range = { r0: 0, c0: 0, r1: 0, c1: 1 };
    expect(isRangeBold(sheet(), range)).toBe(false);
    store.getState().applyCellStyle(sid, { r0: 0, c0: 0, r1: 0, c1: 0 }, { b: true });
    expect(isRangeBold(sheet(), range)).toBe(false); // 절반만 굵음
    store.getState().applyCellStyle(sid, range, { b: true });
    expect(isRangeBold(sheet(), range)).toBe(true);
    store.getState().setCells(sid, [{ r: 0, c: 2, cell: { v: 1, t: "n", src: "b:o" } }]);
    expect(isRangeBold(sheet(), { ...range, c1: 2 })).toBe(true); // src는 제외
  });

  it("한 트랜잭션 = 한 undo 단계", async () => {
    const { store, sid } = fresh();
    store.getState().setCellValue(sid, 0, 0, { v: 1, t: "n" });
    await sleep(350);
    store.getState().applyCellStyle(sid, { r0: 0, c0: 0, r1: 1, c1: 1 }, { b: true, fs: 16 });
    await sleep(350);
    store.temporal.getState().undo();
    expect(cells(store)["0:0"]).toEqual({ v: 1, t: "n" });
    expect(cells(store)["1:1"]).toBeUndefined();
  });

  it("st는 .pygrid.json 왕복에 보존된다", () => {
    const { store, sid } = fresh();
    store.getState().setCellValue(sid, 0, 0, { v: "머리", t: "s", st: { b: true, fs: 16 } });
    const restored = parseWorkbookJson(serializeWorkbook(store.getState().workbook));
    expect(restored.sheets[0].cells["0:0"]).toEqual({
      v: "머리",
      t: "s",
      st: { b: true, fs: 16 },
    });
  });
});

describe("executedRefs (부록 J.3)", () => {
  it("기록·갱신·제거 — 블록 삭제·새 워크북 시 정리", () => {
    const { store, sid } = fresh();
    const id = store.getState().addPyBlock(sid, { r: 0, c: 5 })!;
    const refs = [{ sheetId: sid, r0: 0, c0: 0, r1: 2, c1: 1 }];
    store.getState().setExecutedRefs(id, refs);
    expect(store.getState().executedRefs[id]).toEqual(refs);
    store.getState().setExecutedRefs(id, null); // 실패 실행 → 제거
    expect(store.getState().executedRefs[id]).toBeUndefined();

    store.getState().setExecutedRefs(id, refs);
    store.getState().removePyBlock(id);
    expect(store.getState().executedRefs[id]).toBeUndefined();

    const id2 = store.getState().addPyBlock(sid, { r: 0, c: 7 })!;
    store.getState().setExecutedRefs(id2, refs);
    store.getState().newWorkbook();
    expect(store.getState().executedRefs).toEqual({});
  });

  it("showRefs 토글 (기본 켬)", () => {
    const { store } = fresh();
    expect(store.getState().showRefs).toBe(true);
    store.getState().setShowRefs(false);
    expect(store.getState().showRefs).toBe(false);
  });
});
