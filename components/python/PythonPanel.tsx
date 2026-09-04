"use client";

// Python 패널 — [블록] 목록(계산 순서) · [목차] + 스니펫·초기화 스크립트 + 참조 삽입 바 (§2.3.2)

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import InitScriptDialog from "@/components/python/InitScriptDialog";
import PyBlockCard from "@/components/python/PyBlockCard";
import SnippetMenu from "@/components/python/SnippetMenu";
import { editorRegistry } from "@/components/python/CodeEditor";
import { buildToc, type TocEntry } from "@/lib/grid/markdown";
import { blocksInOrder } from "@/lib/grid/run-block";
import { useWorkbookStore } from "@/lib/grid/model";
import { xlRefForSelection } from "@/lib/grid/xl-ref";
import { cn } from "@/lib/utils";

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

/** 실행 상태 점 — 오류는 destructive, 성공은 primary(Python 관여) */
function StatusDot({ entry }: { entry: TocEntry }) {
  if (entry.kind === "markdown") return null;
  const cls =
    entry.status === "error" || entry.status === "spill"
      ? "bg-destructive"
      : entry.status === "ok"
        ? "bg-primary"
        : "bg-muted-foreground/40";
  return <span className={cn("size-1.5 shrink-0 rounded-full", cls)} aria-hidden />;
}

export default function PythonPanel() {
  const workbook = useWorkbookStore((s) => s.workbook);
  const blocks = useMemo(() => blocksInOrder(workbook), [workbook]);
  const toc = useMemo(() => buildToc(blocks), [blocks]);
  const [tab, setTab] = useState("blocks");

  const allCollapsed = blocks.length > 0 && blocks.every((b) => b.collapsed);

  /** 목차 클릭 — 블록 탭의 카드로 이동 + 그리드 선택을 앵커로 */
  const goToBlock = (blockId: string) => {
    const st = useWorkbookStore.getState();
    const block = st.workbook.pyBlocks.find((b) => b.id === blockId);
    if (!block) return;
    setTab("blocks");
    st.setBlockCollapsed(blockId, false);
    st.setActiveSheet(block.sheetId);
    st.setSelection({
      r0: block.anchor.r,
      c0: block.anchor.c,
      r1: block.anchor.r,
      c1: block.anchor.c,
    });
    // 블록 탭 콘텐츠가 마운트된 뒤 포커스 신호를 보낸다
    requestAnimationFrame(() => useWorkbookStore.getState().setFocusBlock(blockId));
  };

  return (
    <div className="flex h-full flex-col border-l bg-code-bg">
      <Tabs
        value={tab}
        onValueChange={setTab}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="flex items-center gap-2 border-b px-2 py-1.5">
          <TabsList className="h-6 bg-muted/60">
            <TabsTrigger value="blocks" className="h-5 px-2 text-xs">
              블록
            </TabsTrigger>
            <TabsTrigger value="toc" className="h-5 px-2 text-xs">
              목차
            </TabsTrigger>
          </TabsList>
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

        <TabsContent value="blocks" className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
          {blocks.length === 0 ? (
            <p className="px-2 py-8 text-center text-xs text-muted-foreground">
              셀을 선택하고 ＋ Python 블록을 누르세요
              <br />
              (Ctrl+Shift+P)
            </p>
          ) : (
            blocks.map((block) => <PyBlockCard key={block.id} block={block} />)
          )}
        </TabsContent>

        <TabsContent value="toc" className="min-h-0 flex-1 overflow-y-auto p-1">
          {toc.length === 0 ? (
            <p className="px-2 py-8 text-center text-xs text-muted-foreground">
              마크다운 블록으로 제목을 추가하면 목차가 만들어집니다
            </p>
          ) : (
            <ul>
              {toc.map((entry) => (
                <li key={entry.key}>
                  <button
                    onClick={() => goToBlock(entry.blockId)}
                    style={{ paddingLeft: `${(entry.level - 1) * 12 + 8}px` }}
                    className={cn(
                      "flex w-full items-center gap-1.5 rounded py-1 pr-2 text-left text-xs hover:bg-accent",
                      entry.kind === "markdown"
                        ? "font-medium text-foreground"
                        : "font-mono text-muted-foreground",
                    )}
                  >
                    <StatusDot entry={entry} />
                    <span className="truncate">{entry.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
      <RefInsertBar />
    </div>
  );
}
