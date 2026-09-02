"use client";

// 전체 레이아웃 — 설계서 §4.3: 헤더 / 툴바 / [그리드+시트 탭 | Python 패널] / 하단 패널 / 상태 바

import { useEffect, useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { TooltipProvider } from "@/components/ui/tooltip";
import GridToolbar from "@/components/grid/GridToolbar";
import SheetGrid from "@/components/grid/SheetGrid";
import SheetTabs from "@/components/grid/SheetTabs";
import Header from "@/components/shell/Header";
import StatusBar from "@/components/shell/StatusBar";
import { useWorkbookStore } from "@/lib/grid/model";
import { useAutosave } from "@/lib/storage/autosave";
import { getWorkbook, loadSettings, saveSettings } from "@/lib/storage/db";

export default function WorkbookShell() {
  const saveStatus = useAutosave();
  const [restored, setRestored] = useState(false);
  const [splitRatio, setSplitRatio] = useState(72);

  // Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z) — 텍스트 입력 중에는 네이티브 undo에 양보
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return; // 셀 편집기·제목 입력 등에서는 네이티브 텍스트 undo
      }
      const key = e.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      e.preventDefault();
      const temporal = useWorkbookStore.temporal.getState();
      if (key === "y" || e.shiftKey) temporal.redo();
      else temporal.undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // 마운트 시: 설정 + 마지막 워크북 복원 (없으면 스토어 초기 새 워크북 유지)
  useEffect(() => {
    (async () => {
      try {
        const settings = await loadSettings();
        if (settings?.splitRatio) setSplitRatio(settings.splitRatio);
        if (settings?.lastWorkbookId) {
          const wb = await getWorkbook(settings.lastWorkbookId);
          if (wb) useWorkbookStore.getState().loadWorkbook(wb);
        }
      } finally {
        setRestored(true);
        // e2e 테스트가 복원 완료를 기다릴 수 있게 신호
        (window as unknown as { __pygridReady?: boolean }).__pygridReady = true;
      }
    })();
  }, []);

  // 드래그 종료 후 한 번 호출됨 — 분할 비율을 설정 스토어에 보존
  const onLayoutChanged = (layout: Record<string, number>) => {
    if (layout.grid) void saveSettings({ splitRatio: layout.grid });
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen flex-col bg-background">
        <Header />
        <GridToolbar />
        <ResizablePanelGroup
          key={restored ? "restored" : "initial"} // 설정 로드 후 defaultSize 반영을 위해 재마운트
          orientation="horizontal"
          className="min-h-0 flex-1"
          onLayoutChanged={onLayoutChanged}
        >
          <ResizablePanel id="grid" defaultSize={`${splitRatio}%`} minSize="40%">
            <div className="flex h-full min-w-0 flex-col">
              <SheetGrid />
              <SheetTabs />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel id="python" defaultSize={`${100 - splitRatio}%`} minSize="15%">
            <div className="flex h-full flex-col border-l bg-code-bg">
              <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                Python 패널
              </div>
              <div className="flex-1" />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
        <div className="h-40 shrink-0 border-t">
          <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
            진단·미리보기·변수·콘솔
          </div>
        </div>
        <StatusBar saveStatus={saveStatus} />
      </div>
    </TooltipProvider>
  );
}
