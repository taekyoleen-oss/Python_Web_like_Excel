// CSV 열기/내보내기 — SheetJS 재사용 (활성 시트만, 값만)

import * as XLSX from "xlsx";
import type { Sheet } from "@/types/workbook";
import { sheetToWs, wsToSheet } from "./xlsx";

/** 활성 시트 → CSV 문자열 (불리언 TRUE/FALSE·날짜 ISO) */
export function sheetToCsv(sheet: Sheet): string {
  return XLSX.utils.sheet_to_csv(sheetToWs(sheet));
}

/** CSV 텍스트 → Sheet */
export function csvToSheet(text: string, name: string): Sheet {
  const wb = XLSX.read(text, { type: "string", cellDates: true });
  return wsToSheet(wb.Sheets[wb.SheetNames[0]], name);
}
