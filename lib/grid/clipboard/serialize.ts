// 범위 → 클립보드 직렬화 — 설계서 §4.5.4
// TSV: 서식 없는 원값. HTML: <table> + mso-number-format으로 Excel이 유형을 인식.

import { cellKey, type Cell, type CellRange, type Sheet } from "@/types/workbook";
import { formatCellDisplay } from "@/lib/grid/format";

const rawText = (cell: Cell): string => {
  if (cell.t === "b") return cell.v ? "TRUE" : "FALSE";
  return String(cell.v ?? ""); // 날짜는 저장값이 이미 ISO, 오류는 코드 문자열
};

const tsvEscape = (s: string): string =>
  /[\t\n\r"]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;

const htmlEscape = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function serializeRange(
  sheet: Sheet,
  range: CellRange,
): { text: string; html: string } {
  const r0 = Math.min(range.r0, range.r1);
  const r1 = Math.max(range.r0, range.r1);
  const c0 = Math.min(range.c0, range.c1);
  const c1 = Math.max(range.c0, range.c1);
  const textRows: string[] = [];
  const htmlRows: string[] = [];
  for (let r = r0; r <= r1; r++) {
    const t: string[] = [];
    const h: string[] = [];
    for (let c = c0; c <= c1; c++) {
      const cell = sheet.cells[cellKey(r, c)];
      if (!cell || cell.v === null) {
        t.push("");
        h.push("<td></td>");
        continue;
      }
      t.push(tsvEscape(rawText(cell)));
      // mso-number-format: Excel 자체 출력과 같게 서식 문자 이스케이프 (예: \#\,\#\#0)
      const mso = cell.f
        ? ` style='mso-number-format:"${cell.f.replace(/[-.#,]/g, "\\$&")}"'`
        : "";
      const display = htmlEscape(formatCellDisplay(cell)).replace(/\n/g, "<br>");
      h.push(`<td${mso}>${display}</td>`);
    }
    textRows.push(t.join("\t"));
    htmlRows.push(`<tr>${h.join("")}</tr>`);
  }
  return {
    text: textRows.join("\r\n") + "\r\n",
    html: `<table>${htmlRows.join("")}</table>`,
  };
}
