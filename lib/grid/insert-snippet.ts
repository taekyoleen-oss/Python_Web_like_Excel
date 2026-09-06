// 부록 F.1 — 코드 삽입 팝업의 삽입 경로.
// · appendSnippetToBlock: 기준 블록 코드 끝에 덧붙임(빈 블록이면 대체) — setBlockCode 1회 = 1 undo.
//   재계산 통지(notifyWorkbookEdit)는 호출한 컴포넌트가 한다(단위 테스트에서 워커 미생성).
// · placeAdjacentAnchor(순수): 계산 순서(시트 순 → 앵커 행 → 열)상 기준 블록 바로 앞/뒤가
//   되는 빈 앵커. 같은 열의 인접 행 우선, 없으면 기준~순서 이웃 '사이' 구간을 행 우선 스캔.
// · insertSnippetAsBlock: 위 배치로 새 블록 생성(1 setState = 1 undo, 자동 실행 없음).
//   배치 실패·기준 없음이면 createReferenceBlocks 폴백(빈 영역) — ordered:false로 알려
//   toast 안내는 호출부가 띄운다.

import type { PyBlock, Workbook } from "@/types/workbook";
import { createReferenceBlocks } from "./import-blocks";
import { blocksInOrder, cellTaken, useWorkbookStore } from "./model";
import { newId, normalizeBlock } from "./outputs";

export interface AnchorSpot {
  sheetId: string;
  r: number;
  c: number;
}

/** 기준 블록 코드 끝에 덧붙인다(빈 줄 구분, 빈 블록이면 대체). 성공 여부 반환 */
export function appendSnippetToBlock(blockId: string, text: string): boolean {
  const st = useWorkbookStore.getState();
  const block = st.workbook.pyBlocks.find((b) => b.id === blockId);
  if (!block || block.kind === "markdown") return false;
  const base = block.code.replace(/\s+$/, "");
  st.setBlockCode(blockId, base === "" ? text : `${base}\n\n${text}`);
  return true;
}

const before = (a: { r: number; c: number }, b: { r: number; c: number }): boolean =>
  a.r < b.r || (a.r === b.r && a.c < b.c);

/** 같은 열 인접 행·폴백 스캔의 행 상한 — 실사용 밀도에서 수 회면 끝난다 */
const ROW_CAP = 200;

/**
 * 계산 순서상 기준 블록 바로 앞(above)/뒤(below)가 되는 빈 앵커 (기준 블록과 같은 시트).
 * 이웃이 다른 시트면 이 시트 안에서는 그 방향의 경계가 없다(시트 순이 우선이므로 안전).
 * 순서를 보장하는 빈 자리가 없으면 null.
 */
export function placeAdjacentAnchor(
  wb: Workbook,
  refId: string,
  dir: "above" | "below",
): AnchorSpot | null {
  const ordered = blocksInOrder(wb);
  const i = ordered.findIndex((b) => b.id === refId);
  if (i < 0) return null;
  const ref = ordered[i];
  const sheet = wb.sheets.find((s) => s.id === ref.sheetId);
  if (!sheet) return null;
  const neighbour = ordered[dir === "below" ? i + 1 : i - 1];
  const n = neighbour && neighbour.sheetId === ref.sheetId ? neighbour.anchor : null;

  const free = (r: number, c: number): boolean =>
    r >= 0 && c >= 0 && !cellTaken(sheet, wb.pyBlocks, r, c);
  /** 후보가 계산 순서상 기준과 이웃 '사이'에 드는가 */
  const inBetween = (r: number, c: number): boolean => {
    const p = { r, c };
    if (dir === "below") return before(ref.anchor, p) && (!n || before(p, n));
    return before(p, ref.anchor) && (!n || before(n, p));
  };

  // 1) 같은 열의 인접 행 — 기준에서 가까운 순
  const step = dir === "below" ? 1 : -1;
  for (let k = 1; k <= ROW_CAP; k++) {
    const r = ref.anchor.r + step * k;
    if (r < 0) break;
    if (!inBetween(r, ref.anchor.c)) break; // 단조 — 더 가면 전부 범위 밖
    if (free(r, ref.anchor.c)) return { sheetId: sheet.id, r, c: ref.anchor.c };
  }

  // 2) 폴백 — 기준~이웃 사이 구간을 행 우선으로 스캔 (열은 사용 폭 + 여유 2열)
  const colCap = Math.max(sheet.colCount, ref.anchor.c + 1, (n?.c ?? 0) + 1) + 2;
  const rLo = dir === "below" ? ref.anchor.r : (n?.r ?? Math.max(0, ref.anchor.r - ROW_CAP));
  const rHi = dir === "below" ? (n?.r ?? ref.anchor.r + ROW_CAP) : ref.anchor.r;
  for (let r = rLo; r <= rHi; r++) {
    for (let c = 0; c < colCap; c++) {
      if (inBetween(r, c) && free(r, c)) return { sheetId: sheet.id, r, c };
    }
  }
  return null;
}

/**
 * 스니펫을 새 코드 블록으로 삽입 — 계산 순서상 기준 블록 바로 앞/뒤 배치.
 * 배치 불가·기준 없음이면 빈 영역 폴백(ordered:false). 자동 실행 없음.
 */
export function insertSnippetAsBlock(
  refId: string | null,
  dir: "above" | "below",
  title: string,
  code: string,
): { id: string; ordered: boolean } | null {
  const spot = refId
    ? placeAdjacentAnchor(useWorkbookStore.getState().workbook, refId, dir)
    : null;
  if (!spot) {
    const ids = createReferenceBlocks(null, [{ title, code }]);
    return ids[0] ? { id: ids[0], ordered: false } : null;
  }
  const block: PyBlock = {
    id: newId(),
    sheetId: spot.sheetId,
    anchor: { r: spot.r, c: spot.c },
    code,
    outputMode: "values",
    includeIndex: "auto",
    title,
  };
  normalizeBlock(block); // 코드 블록은 출력 1개 보장
  useWorkbookStore.setState((state) => {
    state.workbook.pyBlocks.push(block);
  }); // 1 setState = 1 undo 단계
  return { id: block.id, ordered: true };
}
