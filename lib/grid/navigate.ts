// 엑셀식 Ctrl+방향키 데이터 끝 점프 — 순수 함수 (SheetGrid가 소비)

import { cellKey, type Sheet } from "@/types/workbook";

export type Dir = "up" | "down" | "left" | "right";

const DELTA: Record<Dir, [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

/** "비어 있지 않음" = cells에 키가 있고 v가 null이 아님 */
const filled = (sheet: Sheet, r: number, c: number): boolean => {
  const cell = sheet.cells[cellKey(r, c)];
  return cell !== undefined && cell.v !== null;
};

/**
 * 엑셀 Ctrl+방향키 규칙:
 * - 현재 셀과 인접 셀이 모두 차 있으면 → 연속 데이터 구간의 끝
 * - 그 외(인접 셀이 비어 있거나 현재 셀이 비어 있음) → 그 방향의 다음 비어 있지 않은 셀,
 *   없으면 그리드 끝. 결과는 항상 0..rowCount-1 / 0..colCount-1로 클램프.
 */
export function dataEdge(
  sheet: Sheet,
  from: { r: number; c: number },
  dir: Dir,
): { r: number; c: number } {
  const [dr, dc] = DELTA[dir];
  const maxR = sheet.rowCount - 1;
  const maxC = sheet.colCount - 1;
  const inBounds = (r: number, c: number) => r >= 0 && r <= maxR && c >= 0 && c <= maxC;

  let r = Math.min(maxR, Math.max(0, from.r));
  let c = Math.min(maxC, Math.max(0, from.c));
  if (!inBounds(r + dr, c + dc)) return { r, c }; // 이미 그리드 끝

  if (filled(sheet, r, c) && filled(sheet, r + dr, c + dc)) {
    // 연속 데이터 구간의 끝으로
    while (inBounds(r + dr, c + dc) && filled(sheet, r + dr, c + dc)) {
      r += dr;
      c += dc;
    }
    return { r, c };
  }
  // 다음 비어 있지 않은 셀로 (없으면 그리드 끝)
  r += dr;
  c += dc;
  while (inBounds(r, c) && !filled(sheet, r, c)) {
    r += dr;
    c += dc;
  }
  return inBounds(r, c)
    ? { r, c }
    : { r: Math.min(maxR, Math.max(0, r)), c: Math.min(maxC, Math.max(0, c)) };
}
