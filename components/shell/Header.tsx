"use client";

// 헤더 (1행) — 좌: 로고 + 편집 가능한 워크북 제목 / 중앙: 뷰 전환 / 우: 런타임 상태.
// 좌·우 그룹이 flex-1로 같은 폭을 가져가므로 뷰 전환은 뷰포트 기준 정중앙에 놓인다.
// 파일 계열 메뉴(파일·샘플·최근·? 단축키)는 셸 바(ShellBar)로 내려갔다.

import { useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWorkbookStore } from "@/lib/grid/model";
import { saveSettings } from "@/lib/storage/db";

/** 상단 뷰 전환 세그먼트 (부록 E R2) — 두 뷰 모두 마운트 유지, 선택은 설정에 저장 */
function ViewSwitch() {
  const view = useWorkbookStore((s) => s.view);
  const select = (v: "workbook" | "reference") => {
    useWorkbookStore.getState().setView(v);
    void saveSettings({ view: v });
  };
  const cls = (active: boolean) =>
    `rounded px-2.5 py-1 text-xs transition-colors ${
      active
        ? "bg-background font-medium text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    }`;
  return (
    <div
      role="tablist"
      aria-label="화면 뷰 전환"
      data-testid="view-switch"
      className="flex shrink-0 items-center gap-0.5 rounded-md bg-muted p-0.5"
    >
      <button
        role="tab"
        aria-selected={view === "workbook"}
        data-testid="view-workbook"
        onClick={() => select("workbook")}
        className={cls(view === "workbook")}
      >
        워크북
      </button>
      <button
        role="tab"
        aria-selected={view === "reference"}
        data-testid="view-reference"
        onClick={() => select("reference")}
        className={cls(view === "reference")}
      >
        {/* 좁은 폭에서는 라벨 축약 — 중앙 정렬이 좌우 그룹을 밀어내지 않게 */}
        <span className="hidden sm:inline">데이터 예제/분석</span>
        <span className="sm:hidden">예제/분석</span>
      </button>
    </div>
  );
}

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
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
      {/* 좌 그룹 — flex-1(우 그룹과 동일 폭) + min-w-0으로 제목이 먼저 줄어든다 */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex shrink-0 flex-col leading-none">
          <span className="font-display text-lg font-semibold tracking-tight">
            시트기반 파이썬
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            Sheet Python
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  aria-label="브라우저 파이썬의 한계 안내"
                  className="rounded-full border px-1 leading-3 hover:bg-muted"
                >
                  ⓘ
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-72 whitespace-pre-line text-left">
                {[
                  "브라우저(WASM)에서 실행되는 파이썬의 한계:",
                  "· 첫 접속 시 런타임 로드(~10초)와 패키지 첫 import에 지연이 있습니다",
                  "· 패키지는 Pyodide 제공분과 순수 파이썬(micropip)만 사용 가능합니다",
                  "· 데이터 크기는 브라우저 탭 메모리에 제한됩니다",
                  "· 임의 네트워크·파일 시스템 접근은 제한됩니다",
                ].join("\n")}
              </TooltipContent>
            </Tooltip>
          </span>
        </div>
        <Separator orientation="vertical" className="h-6 shrink-0" />
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
            className="h-8 w-56 text-base"
            aria-label="워크북 제목"
          />
        ) : (
          <button
            onClick={() => setDraft(title)}
            title="클릭하여 제목 수정"
            className="truncate rounded px-2 py-1 text-base font-medium text-foreground/80 hover:bg-muted"
          >
            {title}
          </button>
        )}
      </div>

      {/* 중앙 — 뷰포트 정중앙 */}
      <ViewSwitch />

      {/* 우 그룹 — 런타임 상태 */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        {children ?? (
          <div id="runtime-status-slot" className="text-xs text-muted-foreground" />
        )}
      </div>
    </header>
  );
}
