"use client";

// Python 패널 — 블록 목록(계산 순서) + 스니펫·초기화 스크립트 + 참조 삽입 바 (§2.3.2)

import { useMemo } from "react";
import InitScriptDialog from "@/components/python/InitScriptDialog";
import PyBlockCard from "@/components/python/PyBlockCard";
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
        onClick={() => editorRegistry.get(lastEditorBlockId)?.(ref)}
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

  return (
    <div className="flex h-full flex-col border-l bg-code-bg">
      <div className="flex items-center gap-1 border-b px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Python 패널 · 블록 {blocks.length}
        </span>
        <div className="ml-auto flex items-center">
          <SnippetMenu />
          <InitScriptDialog />
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {blocks.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">
            셀을 선택하고 ＋ Python 블록을 누르세요
            <br />
            (Ctrl+Shift+P)
          </p>
        ) : (
          blocks.map((block) => <PyBlockCard key={block.id} block={block} />)
        )}
      </div>
      <RefInsertBar />
    </div>
  );
}
