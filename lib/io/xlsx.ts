// XLSX 열기/내보내기 — SheetJS 0.20.3 (값만: spill 값 포함, 코드·서식 제외)

import * as XLSX from "xlsx";
import { cellKey, parseCellKey, type Cell, type Sheet } from "@/types/workbook";
import { createSheet } from "@/lib/grid/model";

const pad2 = (n: number) => String(n).padStart(2, "0");

const dateToIso = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** SheetJS 워크시트 → Sheet (셀 타입 매핑 n/s/b/d, 날짜 ISO) */
export function wsToSheet(ws: XLSX.WorkSheet, name: string): Sheet {
  const sheet = createSheet(name);
  const ref = ws["!ref"];
  if (!ref) return sheet;
  const range = XLSX.utils.decode_range(ref);
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr] as XLSX.CellObject | undefined;
      if (!cell || cell.v === undefined || cell.v === null) continue;
      let out: Cell;
      switch (cell.t) {
        case "n":
          out = { v: cell.v as number, t: "n" };
          break;
        case "b":
          out = { v: cell.v as boolean, t: "b" };
          break;
        case "d":
          out = { v: dateToIso(cell.v as Date), t: "d", f: "yyyy-mm-dd" };
          break;
        default: {
          const s = String(cell.v);
          if (s === "") continue;
          out = { v: s, t: "s" };
        }
      }
      sheet.cells[cellKey(r, c)] = out;
    }
  }
  sheet.rowCount = Math.max(sheet.rowCount, range.e.r + 1);
  sheet.colCount = Math.max(sheet.colCount, range.e.c + 1);
  return sheet;
}

/** CSV/XLSX 파일 데이터 → Sheet[] (시트 이름 유지) */
export function sheetsFromFileData(data: ArrayBuffer): Sheet[] {
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  return wb.SheetNames.map((name) => wsToSheet(wb.Sheets[name], name));
}

/** Sheet → SheetJS 워크시트 (사용 범위만, 값만: 날짜 ISO 문자열·불리언 그대로) */
export function sheetToWs(sheet: Sheet): XLSX.WorkSheet {
  let maxR = 0;
  let maxC = 0;
  const keys = Object.keys(sheet.cells);
  for (const key of keys) {
    const { r, c } = parseCellKey(key);
    if (r > maxR) maxR = r;
    if (c > maxC) maxC = c;
  }
  const aoa: (string | number | boolean | null)[][] = Array.from(
    { length: keys.length === 0 ? 1 : maxR + 1 },
    () => new Array(maxC + 1).fill(null),
  );
  for (const key of keys) {
    const { r, c } = parseCellKey(key);
    aoa[r][c] = sheet.cells[key].v;
  }
  return XLSX.utils.aoa_to_sheet(aoa);
}

/** 전 시트 → .xlsx Blob */
export function sheetsToXlsxBlob(sheets: Sheet[]): Blob {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    // Excel 시트 이름 제약(31자·금지 문자)은 SheetJS가 오류를 내므로 최소 정리
    const name = sheet.name.replace(/[\\/?*[\]:]/g, "_").slice(0, 31) || "Sheet";
    XLSX.utils.book_append_sheet(wb, sheetToWs(sheet), name);
  }
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
