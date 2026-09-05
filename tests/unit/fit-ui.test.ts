// R4: statInfos 추출 무결성 + '시트에서 가져오기' 선택 범위 파싱 (부록 E)
import { beforeEach, describe, expect, it } from "vitest";
import { STAT_INFOS } from "@/lib/reference/statInfos";
import { selectionToCells } from "@/lib/grid/import-blocks";
import { detectFormat } from "@/lib/reference/fitData";
import { useWorkbookStore } from "@/lib/grid/model";

const st = () => useWorkbookStore.getState();

describe("STAT_INFOS 추출 무결성", () => {
  it("8종 키·필수 필드", () => {
    const keys = ["logL", "aic", "bic", "ksD", "ksP", "a2", "chi2", "chi2P"];
    expect(Object.keys(STAT_INFOS).sort()).toEqual([...keys].sort());
    for (const k of keys) {
      const info = STAT_INFOS[k];
      expect(info.key).toBe(k);
      expect(info.name.length).toBeGreaterThan(0);
      expect(info.full.length).toBeGreaterThan(0);
      expect(info.desc.length).toBeGreaterThan(10);
      expect(info.criteria.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("selectionToCells — 시트에서 가져오기", () => {
  beforeEach(() => {
    st().newWorkbook();
  });

  it("선택 없음 → 안내 오류", () => {
    const r = selectionToCells();
    expect("error" in r && r.error).toContain("선택");
  });

  it("2열(연도+값) 범위 → string[][] + fitData 파서가 yearValue로 감지", () => {
    const sheetId = st().activeSheetId;
    st().setCells(sheetId, [
      { r: 0, c: 0, cell: { v: "연도", t: "s" } },
      { r: 0, c: 1, cell: { v: "보험금", t: "s" } },
      { r: 1, c: 0, cell: { v: 2024, t: "n" } },
      { r: 1, c: 1, cell: { v: 1200, t: "n" } },
      { r: 2, c: 0, cell: { v: 2024, t: "n" } },
      { r: 2, c: 1, cell: { v: 800, t: "n" } },
      { r: 3, c: 0, cell: { v: 2025, t: "n" } },
      { r: 3, c: 1, cell: { v: 950, t: "n" } },
    ]);
    st().setSelection({ r0: 0, c0: 0, r1: 3, c1: 1 });
    const r = selectionToCells();
    if ("error" in r) throw new Error(r.error);
    expect(r.cells).toEqual([
      ["연도", "보험금"],
      ["2024", "1200"],
      ["2024", "800"],
      ["2025", "950"],
    ]);
    // fitData 파서와 배선 확인 — 헤더 인식 + 연도+값 감지
    const det = detectFormat(r.cells);
    expect(det.kind).toBe("yearValue");
    expect(det.headers).toEqual(["연도", "보험금"]);
    expect(det.rows.length).toBe(3);
  });

  it("빈 셀은 빈 문자열, 4열 이상·빈 범위는 오류", () => {
    const sheetId = st().activeSheetId;
    st().setCells(sheetId, [{ r: 0, c: 0, cell: { v: 10, t: "n" } }]);
    st().setSelection({ r0: 0, c0: 0, r1: 1, c1: 1 });
    const ok = selectionToCells();
    if ("error" in ok) throw new Error(ok.error);
    expect(ok.cells).toEqual([
      ["10", ""],
      ["", ""],
    ]);

    st().setSelection({ r0: 0, c0: 0, r1: 0, c1: 3 }); // 4열
    expect("error" in selectionToCells()).toBe(true);

    st().setSelection({ r0: 10, c0: 5, r1: 12, c1: 6 }); // 빈 범위
    expect("error" in selectionToCells()).toBe(true);
  });
});
