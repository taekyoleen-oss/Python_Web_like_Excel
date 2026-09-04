// 블록 실행 공개 API — M5: RunCoordinator(calc-engine) 배선. 반영 로직은 calc-host.ts.

import { toast } from "sonner";
import type { BlockKind, PyBlock, Workbook } from "@/types/workbook";
import { formatA1 } from "./a1";
import { getCoordinator, makeView, notifyWorkbookEdit, toastIfQueued } from "./calc-host";
import { useWorkbookStore } from "./model";

/** ▶ 단일 실행: 해당 블록 + 하위 의존 블록을 위상 순서로 (§2.4) */
export async function runBlock(blockId: string): Promise<void> {
  toastIfQueued();
  await getCoordinator().runBlocks([blockId], makeView());
}

/** 전체 실행 — 변수 공유만으로 이어진 블록의 순서는 여기서만 보장된다(§2.4) */
export async function runAllBlocks(): Promise<void> {
  toastIfQueued();
  await getCoordinator().runAll(makeView());
}

/** 기본 계산 순서: 시트 순 → 앵커 행 → 열 (패널 나열용) */
export function blocksInOrder(workbook: Workbook): PyBlock[] {
  const sheetIndex = new Map(workbook.sheets.map((s, i) => [s.id, i]));
  return [...workbook.pyBlocks].sort(
    (a, b) =>
      (sheetIndex.get(a.sheetId) ?? 0) - (sheetIndex.get(b.sheetId) ?? 0) ||
      a.anchor.r - b.anchor.r ||
      a.anchor.c - b.anchor.c,
  );
}

function addAtSelection(kind: BlockKind): void {
  const st = useWorkbookStore.getState();
  const anchor = st.selection
    ? { r: st.selection.r0, c: st.selection.c0 }
    : { r: 0, c: 0 };
  const id = st.addPyBlock(st.activeSheetId, anchor, kind);
  if (id === null) {
    toast.error("이 셀에는 블록을 만들 수 없습니다 (이미 블록 앵커이거나 spill 셀입니다)");
    return;
  }
  st.setFocusBlock(id);
}

/** 툴바 ＋ Python 블록 / Ctrl+Shift+P */
export const addBlockAtSelection = (): void => addAtSelection("code");

/** 툴바 ＋ 마크다운 — 실행되지 않는 문서 블록 (앵커는 위치·목차 대상일 뿐) */
export const addMarkdownAtSelection = (): void => addAtSelection("markdown");

/** 출력 위치 지정 확정 — 실패는 사유 toast, 성공은 자동 모드에서 재실행(수동은 dirty 배지) */
export function applyAnchorPick(
  blockId: string,
  sheetId: string,
  anchor: { r: number; c: number },
): void {
  const err = useWorkbookStore.getState().setBlockAnchor(blockId, anchor, sheetId);
  if (err) {
    toast.error(err);
    return;
  }
  const st = useWorkbookStore.getState();
  st.setAnchorPicking(null);
  const block = st.workbook.pyBlocks.find((b) => b.id === blockId);
  toast(
    `출력 위치를 ${formatA1({ r0: anchor.r, c0: anchor.c, r1: anchor.r, c1: anchor.c })}(으)로 옮겼습니다`,
  );
  if (block && block.kind !== "markdown") notifyWorkbookEdit([], [blockId]);
}
