"use client";

// 상태 바 — 선택 범위(A1) · 시트 수 · 계산 모드/블록 자리표시 · 자동 저장 상태

import { formatA1 } from "@/lib/grid/a1";
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

  return (
    <div className="flex h-7 shrink-0 items-center gap-4 border-t bg-muted/60 px-3 text-xs text-muted-foreground">
      <span className="font-mono">{selection ? formatA1(selection) : "선택 없음"}</span>
      <span>시트 {sheetCount}</span>
      <span className="ml-auto">계산 자동 · 블록 0</span>
      <span className={saveStatus === "error" ? "font-medium text-destructive" : ""}>
        {SAVE_LABEL[saveStatus]}
      </span>
    </div>
  );
}
