"use client";

// 헤더 — 로고 · 편집 가능한 워크북 제목 · 파일 메뉴 자리표시 · 런타임 상태 슬롯

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useWorkbookStore } from "@/lib/grid/model";

export default function Header({ children }: { children?: ReactNode }) {
  const title = useWorkbookStore((s) => s.workbook.title);
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft !== null) {
      useWorkbookStore.getState().setTitle(draft);
      setDraft(null);
    }
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-4">
      <span className="font-display text-lg font-semibold tracking-tight">
        PyGrid Studio
      </span>
      <Separator orientation="vertical" className="h-5" />
      {draft !== null ? (
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setDraft(null);
          }}
          className="h-7 w-56 text-sm"
          aria-label="워크북 제목"
        />
      ) : (
        <button
          onClick={() => setDraft(title)}
          title="클릭하여 제목 수정"
          className="rounded px-2 py-1 text-sm text-foreground/80 hover:bg-muted"
        >
          {title}
        </button>
      )}
      <Button variant="ghost" size="sm" disabled className="text-muted-foreground">
        최근 · 열기 · 저장 ▾
      </Button>
      <div className="ml-auto flex items-center gap-2">
        {children ?? (
          <div id="runtime-status-slot" className="text-xs text-muted-foreground" />
        )}
      </div>
    </header>
  );
}
