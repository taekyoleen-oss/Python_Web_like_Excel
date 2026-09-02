// 셀 표시 서식 — Cell.f 힌트('0.0%', '#,##0', 'yyyy-mm-dd')를 표시 문자열로

import type { Cell } from "@/types/workbook";

const PCT_RE = /^0(?:\.(0+))?%$/;
const THOUSANDS_RE = /^#,##0(?:\.(0+))?$/;

export function formatCellDisplay(cell: Cell): string {
  const { v, t, f } = cell;
  if (v === null || v === undefined) return "";
  if (t === "e") return String(v);
  if (t === "b") return v ? "TRUE" : "FALSE";
  if (t === "d") {
    const s = String(v);
    // 'yyyy-mm-dd' 서식 또는 자정 타임스탬프면 날짜 부분만
    if (f === "yyyy-mm-dd" || /^\d{4}-\d{2}-\d{2}(T00:00(:00(\.0+)?)?Z?)?$/.test(s)) {
      return s.slice(0, 10);
    }
    return s;
  }
  if (t === "n" && typeof v === "number") {
    let m: RegExpExecArray | null;
    if (f && (m = PCT_RE.exec(f))) {
      const digits = m[1]?.length ?? 0;
      return `${(v * 100).toFixed(digits)}%`;
    }
    if (f && (m = THOUSANDS_RE.exec(f))) {
      const digits = m[1]?.length ?? 0;
      return v.toLocaleString("en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
    }
    return String(v);
  }
  return String(v);
}
