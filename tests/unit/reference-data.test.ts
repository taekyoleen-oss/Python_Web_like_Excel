// R1: 이식된 참조 데이터의 무결성 스모크 — 개수·필수 필드 (부록 E.1)
import { describe, expect, it } from "vitest";
import { EXCEL_FUNCTIONS } from "@/lib/reference/excelFunctions";
import { STAT_METHODS, STAT_CATEGORIES } from "@/lib/reference/statMethods";
import { METHOD_THEORY } from "@/lib/reference/methodTheory";
import { METHOD_EXCEL_CODE } from "@/lib/reference/methodExcelCode";
import { ALL_DISTS, CONTINUOUS_DISTS, DISCRETE_DISTS, defaultParams } from "@/lib/reference/distributions";
import { WRANGLE_SNIPPET_GROUPS } from "@/lib/reference/wrangleSnippets";
import { PLOT_SNIPPET_GROUPS } from "@/lib/reference/plotSnippets";

describe("참조 데이터 이식 무결성", () => {
  it("엑셀 함수 69종, 필수 필드 존재", () => {
    expect(EXCEL_FUNCTIONS.length).toBe(69);
    for (const f of EXCEL_FUNCTIONS) {
      expect(f.id).toBeTruthy();
      expect(f.name).toBeTruthy();
      expect(f.syntax).toBeTruthy();
      expect(f.examples.length).toBeGreaterThan(0);
    }
  });

  it("통계 메서드 ~50종 + 카테고리 5종", () => {
    expect(STAT_METHODS.length).toBeGreaterThanOrEqual(50);
    expect(STAT_CATEGORIES.length).toBe(5);
    for (const m of STAT_METHODS) {
      expect(m.sections.length).toBeGreaterThan(0);
      expect(m.sections.every((s) => s.code.trim().length > 0)).toBe(true);
    }
  });

  it("이론·엑셀 코드 레지스트리가 메서드 id와 연결", () => {
    const ids = new Set(STAT_METHODS.map((m) => m.id));
    for (const k of Object.keys(METHOD_THEORY)) expect(ids.has(k)).toBe(true);
    for (const k of Object.keys(METHOD_EXCEL_CODE)) expect(ids.has(k)).toBe(true);
    expect(Object.keys(METHOD_THEORY).length).toBeGreaterThanOrEqual(45);
  });

  it("분포 11종(연속 8 + 이산 3), pdf/cdf 수치 정상", () => {
    expect(CONTINUOUS_DISTS.length).toBe(8);
    expect(DISCRETE_DISTS.length).toBe(3);
    for (const d of ALL_DISTS) {
      const p = defaultParams(d);
      const stats = d.stats(p);
      expect(stats.length).toBe(5);
      if (d.kind === "continuous") {
        const [lo, hi] = d.domain(p);
        const mid = (lo + hi) / 2;
        expect(Number.isFinite(d.pdf(mid, p))).toBe(true);
        expect(d.cdf(hi, p)).toBeGreaterThan(d.cdf(lo + (hi - lo) * 0.01, p));
      } else {
        expect(Number.isFinite(d.pmf(1, p))).toBe(true);
      }
    }
  });

  it("스니펫 그룹(핸들링 52 · 그래프 20)", () => {
    const w = WRANGLE_SNIPPET_GROUPS.flatMap((g) => g.snippets);
    const pl = PLOT_SNIPPET_GROUPS.flatMap((g) => g.snippets);
    expect(w.length).toBeGreaterThanOrEqual(50);
    expect(pl.length).toBeGreaterThanOrEqual(18);
  });
});
