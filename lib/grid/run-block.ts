// 블록 실행 공개 API — M5: RunCoordinator(calc-engine) 배선. 반영 로직은 calc-host.ts.

import { toast } from "sonner";
import type { PyBlock, Workbook } from "@/types/workbook";
import { getCoordinator, makeView, toastIfQueued } from "./calc-host";
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

/** 툴바 ＋ Python 블록 / Ctrl+Shift+P */
export function addBlockAtSelection(): void {
  const st = useWorkbookStore.getState();
  const anchor = st.selection
    ? { r: st.selection.r0, c: st.selection.c0 }
    : { r: 0, c: 0 };
  const id = st.addPyBlock(st.activeSheetId, anchor);
  if (id === null) {
    toast.error("이 셀에는 블록을 만들 수 없습니다 (이미 블록 앵커이거나 spill 셀입니다)");
    return;
  }
  st.setFocusBlock(id);
}
