"use client";

// 하단 시트 탭 — 클릭 전환 · 더블클릭 이름 변경 · 우클릭 메뉴 · ＋ 추가

import { useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { useWorkbookStore } from "@/lib/grid/model";

export default function SheetTabs() {
  const sheets = useWorkbookStore((s) => s.workbook.sheets);
  const activeSheetId = useWorkbookStore((s) => s.activeSheetId);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);

  const store = () => useWorkbookStore.getState();

  const commitRename = () => {
    if (editing) {
      store().renameSheet(editing.id, editing.value);
      setEditing(null);
    }
  };

  return (
    <div className="flex h-8 shrink-0 items-center gap-0.5 overflow-x-auto border-t bg-muted/60 px-1">
      {sheets.map((sheet, i) =>
        editing?.id === sheet.id ? (
          <input
            key={sheet.id}
            autoFocus
            value={editing.value}
            onChange={(e) => setEditing({ id: sheet.id, value: e.target.value })}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setEditing(null);
            }}
            className="h-6 w-24 rounded border border-input bg-background px-2 text-xs outline-none focus:border-ring"
            aria-label="시트 이름 변경"
          />
        ) : (
          <ContextMenu key={sheet.id}>
            <ContextMenuTrigger asChild>
              <button
                onClick={() => store().setActiveSheet(sheet.id)}
                onDoubleClick={() => setEditing({ id: sheet.id, value: sheet.name })}
                className={cn(
                  "h-7 shrink-0 border-b-2 px-3 text-xs transition-colors",
                  sheet.id === activeSheetId
                    ? "border-primary bg-background font-medium text-foreground" // 대비 4.5:1 — 인디케이터만 primary
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {sheet.name}
              </button>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem
                onClick={() => setEditing({ id: sheet.id, value: sheet.name })}
              >
                이름 바꾸기
              </ContextMenuItem>
              <ContextMenuItem disabled={i === 0} onClick={() => store().moveSheet(sheet.id, -1)}>
                왼쪽으로 이동
              </ContextMenuItem>
              <ContextMenuItem
                disabled={i === sheets.length - 1}
                onClick={() => store().moveSheet(sheet.id, 1)}
              >
                오른쪽으로 이동
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                variant="destructive"
                disabled={sheets.length <= 1}
                onClick={() => store().removeSheet(sheet.id)}
              >
                삭제
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ),
      )}
      <button
        onClick={() => store().addSheet()}
        aria-label="시트 추가"
        title="시트 추가"
        className="ml-1 flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        ＋
      </button>
    </div>
  );
}
