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
import PasteImportDialog, { startPasteFlow } from "@/components/grid/PasteImportDialog";
import SheetGrid from "@/components/grid/SheetGrid";
import SheetTabs from "@/components/grid/SheetTabs";
import BottomPanel from "@/components/panels/BottomPanel";
import PythonPanel from "@/components/python/PythonPanel";
import {
  loadWorkbookData,
  openWorkbookFile,
  SAMPLE_LIFE_TABLE,
} from "@/components/shell/FileMenu";
import Header from "@/components/shell/Header";
import { RuntimeStatus } from "@/components/shell/RuntimeStatus";
import StatusBar from "@/components/shell/StatusBar";
import { parseClipboard } from "@/lib/grid/clipboard/parse";
import { serializeRange } from "@/lib/grid/clipboard/serialize";
import { useWorkbookStore } from "@/lib/grid/model";
import { addBlockAtSelection } from "@/lib/grid/run-block";
import { DEFAULT_INIT_SCRIPT, getRuntimeClient } from "@/lib/runtime/client";
import { useAutosave } from "@/lib/storage/autosave";
import { getWorkbook, loadSettings, saveSettings } from "@/lib/storage/db";

/** 텍스트 입력 요소 안이면 true — 전역 단축키·클립보드 가로채기 금지 */
const isTextInput = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  return (
    !!el &&
    (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)
  );
};

export default function WorkbookShell() {
  const saveStatus = useAutosave();
  const [restored, setRestored] = useState(false);
  const [splitRatio, setSplitRatio] = useState(72);
  const [bottomHeight, setBottomHeight] = useState(24);
  // 런타임 싱글턴 — 첫 클라이언트 렌더에서 생성 (ssr:false 페이지)
  const [runtime] = useState(() => getRuntimeClient());

  // 런타임 백그라운드 부트 (멱등)
  useEffect(() => {
    void runtime.boot({ initScript: DEFAULT_INIT_SCRIPT });
  }, [runtime]);

  // Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z) — 텍스트 입력 중에는 네이티브 undo에 양보
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (isTextInput(e.target)) return; // 셀 편집기·제목 입력 등에서는 네이티브 텍스트 undo
      const key = e.key.toLowerCase();
      if (key === "p" && e.shiftKey) {
        e.preventDefault();
        addBlockAtSelection(); // ＋ Python 블록 (§2.3.1)
        return;
      }
      if (key !== "z" && key !== "y") return;
      e.preventDefault();
      const temporal = useWorkbookStore.temporal.getState();
      if (key === "y" || e.shiftKey) temporal.redo();
      else temporal.undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // 그리드 포커스 상태의 붙여넣기/복사 — glide 내장 copy/paste는 SheetGrid에서 꺼 둠
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (isTextInput(e.target) || !e.clipboardData) return;
      const html = e.clipboardData.getData("text/html") || undefined;
      const text = e.clipboardData.getData("text/plain") || undefined;
      if (!html && !text) return;
      e.preventDefault();
      void startPasteFlow(parseClipboard({ html, text }));
    };
    const onCopy = (e: ClipboardEvent) => {
      if (isTextInput(e.target) || !e.clipboardData) return;
      const domSelection = window.getSelection();
      if (domSelection && !domSelection.isCollapsed) return; // 페이지 텍스트 선택 중 → 기본 복사에 양보
      const { selection, workbook, activeSheetId } = useWorkbookStore.getState();
      if (!selection) return;
      const sheet = workbook.sheets.find((s) => s.id === activeSheetId);
      if (!sheet) return;
      const { text, html } = serializeRange(sheet, selection);
      e.clipboardData.setData("text/plain", text);
      e.clipboardData.setData("text/html", html);
      e.preventDefault();
    };
    window.addEventListener("paste", onPaste);
    window.addEventListener("copy", onCopy);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("copy", onCopy);
    };
  }, []);

  // 마운트 시: 설정 + 마지막 워크북 복원. 없거나 실패하면 생명표 샘플 (§2.2 첫 방문)
  useEffect(() => {
    (async () => {
      try {
        const settings = await loadSettings();
        if (settings?.splitRatio) setSplitRatio(settings.splitRatio);
        if (settings?.bottomPanelHeight) setBottomHeight(settings.bottomPanelHeight);
        const wb = settings?.lastWorkbookId
          ? await getWorkbook(settings.lastWorkbookId)
          : undefined;
        if (wb) useWorkbookStore.getState().loadWorkbook(wb);
        else loadWorkbookData(SAMPLE_LIFE_TABLE);
      } catch {
        loadWorkbookData(SAMPLE_LIFE_TABLE);
      } finally {
        setRestored(true);
        // e2e 테스트가 복원 완료를 기다릴 수 있게 신호
        (window as unknown as { __pygridReady?: boolean }).__pygridReady = true;
      }
    })();
  }, []);

  // 그리드 영역 드래그 앤 드롭 열기 (§1.5)
  const [dropActive, setDropActive] = useState(false);
  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes("Files")) {
        e.preventDefault();
        setDropActive(true);
      }
    },
    onDragLeave: () => setDropActive(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDropActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void openWorkbookFile(file);
    },
  };

  // 드래그 종료 후 한 번 호출됨 — 분할 비율·하단 패널 높이를 설정 스토어에 보존 (§3.2)
  const onLayoutChanged = (layout: Record<string, number>) => {
    if (layout.grid) void saveSettings({ splitRatio: layout.grid });
  };
  const onVerticalLayoutChanged = (layout: Record<string, number>) => {
    if (layout.bottom) void saveSettings({ bottomPanelHeight: layout.bottom });
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen flex-col bg-background">
        <Header>
          <RuntimeStatus client={runtime} />
        </Header>
        <GridToolbar />
        <ResizablePanelGroup
          key={restored ? "restored-v" : "initial-v"} // 설정 로드 후 defaultSize 반영을 위해 재마운트
          orientation="vertical"
          className="min-h-0 flex-1"
          onLayoutChanged={onVerticalLayoutChanged}
        >
          <ResizablePanel id="main" defaultSize={`${100 - bottomHeight}%`} minSize="30%">
            <ResizablePanelGroup
              orientation="horizontal"
              className="min-h-0"
              onLayoutChanged={onLayoutChanged}
            >
              <ResizablePanel id="grid" defaultSize={`${splitRatio}%`} minSize="40%">
                <div
                  {...dropHandlers}
                  className={`flex h-full min-w-0 flex-col ${dropActive ? "ring-2 ring-inset ring-primary" : ""}`}
                >
                  <SheetGrid />
                  <SheetTabs />
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel id="python" defaultSize={`${100 - splitRatio}%`} minSize="15%">
                <PythonPanel />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel id="bottom" defaultSize={`${bottomHeight}%`} minSize="10%">
            <div className="h-full border-t">
              <BottomPanel client={runtime} />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
        <StatusBar saveStatus={saveStatus} />
        <PasteImportDialog />
      </div>
    </TooltipProvider>
  );
}
