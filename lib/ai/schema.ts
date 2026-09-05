// AI 컨텍스트 수집 (부록 E R6) — 시트 스키마(값 미전송: 이름·범위·헤더 행만) +
// 런타임 변수 스키마(inspect) + 워커 FS 파일 + 이전 블록 코드.

import { cellKey, type Workbook } from "@/types/workbook";
import { formatA1 } from "@/lib/grid/a1";
import { blocksInOrder, useWorkbookStore } from "@/lib/grid/model";
import { usedRange } from "@/lib/io/data-import";

export interface SheetSchema {
  name: string;
  /** 사용 범위 A1 (예: "A1:F601") — xl() 참조에 그대로 쓸 수 있다 */
  range: string;
  /** 첫 행 문자열(헤더 후보, 최대 60열). 데이터 값은 전송하지 않는다 */
  headers: string[];
  rows: number;
}

/** 워크북 → 시트 스키마 (순수 함수, 셀 값은 헤더 행 외 미포함) */
export function sheetSchemas(workbook: Workbook): SheetSchema[] {
  return workbook.sheets.map((sheet) => {
    const r = usedRange(sheet);
    const headers: string[] = [];
    for (let c = r.c0; c <= Math.min(r.c1, r.c0 + 59); c++) {
      const cell = sheet.cells[cellKey(r.r0, c)];
      headers.push(cell == null || cell.v == null ? "" : String(cell.v));
    }
    return {
      name: sheet.name,
      range: formatA1(r),
      headers,
      rows: r.r1 - r.r0 + 1,
    };
  });
}

/** 대상 블록 이전(계산 순서)의 코드 블록 코드 — blockId 없으면 전체 */
export function priorCode(workbook: Workbook, blockId?: string): string {
  const blocks = blocksInOrder(workbook).filter((b) => b.kind !== "markdown");
  const upto = blockId ? blocks.findIndex((b) => b.id === blockId) : blocks.length;
  return blocks
    .slice(0, upto < 0 ? blocks.length : upto)
    .map((b) => b.code)
    .filter((c) => c.trim() !== "")
    .join("\n\n# ── 다음 블록 ──\n");
}

/**
 * user message용 컨텍스트 JSON + 이전 코드. 런타임이 준비 전이거나 실패하면
 * vars/files는 빈 값으로 폴백한다(요청은 계속 진행).
 */
export async function collectContext(
  blockId?: string,
): Promise<{ schema: string; priorCode: string }> {
  const wb = useWorkbookStore.getState().workbook;
  let vars: unknown[] = [];
  let files: string[] = [];
  try {
    const { getRuntimeClient } = await import("@/lib/runtime/client");
    const client = getRuntimeClient();
    files = client.listFiles().filter((f) => !f.startsWith("_"));
    if (client.getStatus() === "ready") vars = await client.inspect();
  } catch {
    // 런타임 미준비 — 시트 스키마만으로 진행
  }
  return {
    schema: JSON.stringify({ sheets: sheetSchemas(wb), vars, files }, null, 0),
    priorCode: priorCode(wb, blockId),
  };
}
