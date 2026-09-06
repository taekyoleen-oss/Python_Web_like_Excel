"use client";

// Python 패널 — 블록 목록(계산 순서) + 스니펫·초기화 스크립트 + 참조 삽입 바 (§2.3.2).
// 목차는 전용 패널(TocPanel)로 분리되었다 (부록 D.2).

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { AiGenerateBar } from "@/components/python/AiAssist";
import InitScriptDialog from "@/components/python/InitScriptDialog";
import PyBlockCard from "@/components/python/PyBlockCard";
import SnippetInsertDialog from "@/components/python/SnippetInsertDialog";
import SnippetMenu from "@/components/python/SnippetMenu";
import { editorRegistry } from "@/components/python/CodeEditor";
import { blocksInOrder } from "@/lib/grid/run-block";
import { useWorkbookStore } from "@/lib/grid/model";
import { xlRefForSelection } from "@/lib/grid/xl-ref";

function RefInsertBar() {
  const selection = useWorkbookStore((s) => s.selection);
  const lastEditorBlockId = useWorkbookStore((s) => s.lastEditorBlockId);
  const block = useWorkbookStore((s) =>
    s.workbook.pyBlocks.find((b) => b.id === s.lastEditorBlockId),
  );
  if (!selection || !lastEditorBlockId || !block) return null;
  const ref = xlRefForSelection(block.sheetId);
  if (!ref) return null;

  return (
    <div className="border-t bg-accent/60 px-2 py-1.5">
      <button
        onClick={() => editorRegistry.get(lastEditorBlockId)?.insert(ref)}
        className="w-full truncate rounded border border-primary/40 bg-background px-2 py-1 text-left font-mono text-xs text-primary hover:bg-accent"
        title="블록 코드의 커서 위치에 참조 삽입"
      >
        {ref} 삽입
      </button>
    </div>
  );
}

export default function PythonPanel() {
  const workbook = useWorkbookStore((s) => s.workbook);
  const blocks = useMemo(() => blocksInOrder(workbook), [workbook]);

  const allCollapsed = blocks.length > 0 && blocks.every((b) => b.collapsed);

  return (
    <div className="flex h-full flex-col border-l bg-code-bg">
      <div className="flex items-center gap-2 border-b px-2 py-1.5">
        <span className="text-xs font-medium">블록</span>
        <span className="text-xs text-muted-foreground">{blocks.length}</span>
        <div className="ml-auto flex items-center">
          {blocks.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => useWorkbookStore.getState().setAllCollapsed(!allCollapsed)}
            >
              {allCollapsed ? "모두 펼치기" : "모두 접기"}
            </Button>
          )}
          <SnippetMenu />
          <InitScriptDialog />
        </div>
      </div>
      {/* 상단 행 — 코드 삽입(부록 F.1) + ✦ AI 생성 바 */}
      <div className="flex items-center border-b pl-2">
        <SnippetInsertDialog />
        <AiGenerateBar />
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {blocks.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">
            셀을 선택하고 ＋ Python 블록을 누르세요
            <br />
            (Ctrl+Shift+P)
          </p>
        ) : (
          blocks.map((block, i) => (
            <PyBlockCard
              key={block.id}
              block={block}
              isFirst={i === 0}
              isLast={i === blocks.length - 1}
            />
          ))
        )}
      </div>
      <RefInsertBar />
    </div>
  );
}
