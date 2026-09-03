"use client";

// 상태 바 — 선택 범위(A1) · 시트 수 · 계산 모드/블록 자리표시 · 자동 저장 상태

import { formatA1 } from "@/lib/grid/a1";
import { setCalcModeEverywhere } from "@/lib/grid/calc-host";
import { useWorkbookStore } from "@/lib/grid/model";
import type { SaveStatus } from "@/lib/storage/autosave";

const SAVE_LABEL: Record<SaveStatus, string> = {
  saved: "✓ 저장됨",
  saving: "저장 중…",
  error: "저장 오류 — 파일로 내보내 백업하세요",
};

export default function StatusBar({ saveStatus }: { saveStatus: SaveStatus }) {
  const selection = useWorkbookStore((s) => s.selection);
  const sheetCount = useWorkbookStore((s) => s.workbook.sheets.length);
  const calcMode = useWorkbookStore((s) => s.workbook.calcMode);
  const blockCount = useWorkbookStore((s) => s.workbook.pyBlocks.length);
  const dirtyCount = useWorkbookStore((s) => Object.keys(s.dirtyBlocks).length);

  return (
    <div className="flex h-7 shrink-0 items-center gap-4 border-t bg-muted/60 px-3 text-xs text-muted-foreground">
      <span className="font-mono">{selection ? formatA1(selection) : "선택 없음"}</span>
      <span>시트 {sheetCount}</span>
      <span className="ml-auto">
        블록 {blockCount}
        {dirtyCount > 0 ? ` (dirty ${dirtyCount})` : ""}
      </span>
      <button
        onClick={() => setCalcModeEverywhere(calcMode === "auto" ? "manual" : "auto")}
        className={calcMode === "manual" ? "font-medium text-warning" : "hover:text-foreground"}
        title="클릭하여 자동/수동 전환"
      >
        계산 {calcMode === "auto" ? "자동" : "수동"}
      </button>
      <span className={saveStatus === "error" ? "font-medium text-destructive" : ""}>
        {SAVE_LABEL[saveStatus]}
      </span>
    </div>
  );
}
