// lib/runtime/converters.ts — 워커 결과(OutCell) → 워크북 Cell. 순수 함수만(스토어 비의존).

import type { OutCell } from "./protocol";
import type { Cell, CellRange } from "@/types/workbook";

/** OutCell 2D → Cell 2D. v:null은 빈 셀(서식 없음)로 취급한다 */
export function toCells(out: OutCell[][]): Cell[][] {
  return out.map((row) =>
    row.map((c): Cell => (c.v === null ? { v: null, t: c.t } : { v: c.v, t: c.t, ...(c.f ? { f: c.f } : {}) })),
  );
}

/** 앵커 + 결과 shape → spill 범위 (끝 포함) */
export function spillRange(anchor: { r: number; c: number }, rows: number, cols: number): CellRange {
  return { r0: anchor.r, c0: anchor.c, r1: anchor.r + rows - 1, c1: anchor.c + cols - 1 };
}
