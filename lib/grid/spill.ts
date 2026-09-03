// spill 충돌 검사 — 설계서 §2.3.6·CLAUDE.md §4
// 충돌: 이 블록 소유가 아닌 비어 있지 않은 셀, 다른 블록의 spill 셀·앵커와 겹침.
// 시트 경계 초과는 충돌이 아니다(applyBlockResult가 시트를 늘린다).

import { cellKey, type PyBlock, type Sheet } from "@/types/workbook";
import { colToLetter } from "./a1";

export function checkSpillConflict(
  sheet: Sheet,
  blocks: PyBlock[],
  blockId: string,
  anchor: { r: number; c: number },
  shape: [rows: number, cols: number],
): string | null {
  const [rows, cols] = shape;
  const r1 = anchor.r + rows - 1;
  const c1 = anchor.c + cols - 1;

  // 다른 블록의 앵커가 범위 안에 있으면 충돌 (아직 셀이 없어도)
  for (const other of blocks) {
    if (other.id === blockId || other.sheetId !== sheet.id) continue;
    if (
      other.anchor.r >= anchor.r &&
      other.anchor.r <= r1 &&
      other.anchor.c >= anchor.c &&
      other.anchor.c <= c1
    ) {
      return `다른 Python 블록(${colToLetter(other.anchor.c)}${other.anchor.r + 1})과 겹칩니다`;
    }
  }

  for (let r = anchor.r; r <= r1; r++) {
    for (let c = anchor.c; c <= c1; c++) {
      const cell = sheet.cells[cellKey(r, c)];
      if (!cell) continue;
      if (cell.src === blockId) continue; // 자기 spill 교체는 허용
      if (r === anchor.r && c === anchor.c && !cell.src) continue; // 앵커 셀은 블록 소유
      if (cell.src) {
        return `다른 블록의 결과(${colToLetter(c)}${r + 1})와 겹칩니다`;
      }
      if (cell.v !== null && cell.v !== "") {
        return `비어 있지 않은 셀(${colToLetter(c)}${r + 1})과 겹칩니다`;
      }
    }
  }
  return null;
}
