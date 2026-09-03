"use client";

// PY 블록 카드 — 헤더(앵커·모드·상태·실행·삭제) + CodeMirror 편집기

import { useEffect, useRef } from "react";
import { Play, TrashSimple } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CodeEditor from "@/components/python/CodeEditor";
import { formatA1 } from "@/lib/grid/a1";
import { notifyWorkbookEdit } from "@/lib/grid/calc-host";
import { useWorkbookStore } from "@/lib/grid/model";
import { runBlock } from "@/lib/grid/run-block";
import { cn } from "@/lib/utils";
import type { OutputMode, PyBlock } from "@/types/workbook";

function statusBadge(block: PyBlock, running: boolean) {
  if (running) {
    return <Badge className="bg-warning/15 text-warning">실행 중</Badge>;
  }
  switch (block.last?.status) {
    case "ok":
      return <Badge className="bg-primary/10 text-primary">성공</Badge>;
    case "error":
      return <Badge variant="destructive">오류</Badge>;
    case "spill":
      return <Badge variant="destructive">#SPILL!</Badge>;
    default:
      return <Badge variant="secondary">준비</Badge>;
  }
}

export default function PyBlockCard({ block }: { block: PyBlock }) {
  const running = useWorkbookStore((s) => !!s.runningBlocks[block.id]);
  const dirty = useWorkbookStore((s) => !!s.dirtyBlocks[block.id]);
  const hovered = useWorkbookStore((s) => s.hoverBlockId === block.id);
  const sheetName = useWorkbookStore(
    (s) => s.workbook.sheets.find((sh) => sh.id === block.sheetId)?.name ?? "?",
  );
  const codeRef = useRef(block.code);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  // 외부 변경(undo 등)으로 코드가 바뀌면 ▶ 커밋 기준도 따라간다
  useEffect(() => {
    codeRef.current = block.code;
  }, [block.code]);

  /** 코드 확정. notify면 자동 재계산/dirty 배지 통지 (§2.3.3 코드 저장 → dirty) */
  const commitCode = (value: string, notify: boolean) => {
    clearTimeout(debounceRef.current);
    const changed =
      useWorkbookStore.getState().workbook.pyBlocks.find((b) => b.id === block.id)?.code !==
      value;
    useWorkbookStore.getState().setBlockCode(block.id, value);
    if (notify && changed) notifyWorkbookEdit([], [block.id]);
  };

  const onChange = (value: string) => {
    codeRef.current = value;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => commitCode(value, true), 500);
  };

  const run = () => {
    commitCode(codeRef.current, false); // ▶가 직접 실행하므로 통지 없이 확정만 (이중 실행 방지)
    void runBlock(block.id);
  };

  const goToAnchor = () => {
    const st = useWorkbookStore.getState();
    st.setActiveSheet(block.sheetId);
    st.setSelection({
      r0: block.anchor.r,
      c0: block.anchor.c,
      r1: block.anchor.r,
      c1: block.anchor.c,
    });
  };

  const anchorLabel = `${sheetName}!${formatA1({
    r0: block.anchor.r,
    c0: block.anchor.c,
    r1: block.anchor.r,
    c1: block.anchor.c,
  })}`;

  return (
    <div
      className={cn(
        "rounded border bg-card transition-shadow",
        hovered && "border-primary/60 shadow-[0_0_0_2px_#EAF3FA]", // spill hover → 카드 강조 (§4.8)
      )}
      data-block-id={block.id}
    >
      <div className="flex items-center gap-1.5 border-b bg-muted/40 px-2 py-1">
        <button
          onClick={goToAnchor}
          className="font-mono text-xs text-foreground/80 hover:text-primary"
          title="앵커 셀로 이동"
        >
          {anchorLabel}
        </button>
        <Select
          value={block.outputMode}
          onValueChange={(v) =>
            useWorkbookStore.getState().setBlockOutputMode(block.id, v as OutputMode)
          }
        >
          <SelectTrigger className="h-6 w-16 text-xs" aria-label="출력 모드">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="values">값</SelectItem>
            <SelectItem value="object">객체</SelectItem>
          </SelectContent>
        </Select>
        {statusBadge(block, running)}
        {dirty && !running && (
          <span
            className="size-1.5 shrink-0 rounded-full bg-warning"
            title="변경됨 — 재실행 필요"
            aria-label="dirty"
          />
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={run}
            disabled={running}
            aria-label="실행"
            title="실행 (Ctrl+Enter)"
          >
            <Play className="text-primary" weight="fill" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => useWorkbookStore.getState().removePyBlock(block.id)}
            aria-label="블록 삭제"
            title="블록 삭제"
          >
            <TrashSimple />
          </Button>
        </div>
      </div>
      <CodeEditor
        blockId={block.id}
        sheetId={block.sheetId}
        value={block.code}
        onChange={onChange}
        onRun={run}
        placeholder={'df = xl("A1:C10", headers=True)\ndf.describe()'}
      />
      {block.last?.status === "error" && block.last.summaryKo && (
        <div className="border-t px-2 py-1 text-xs text-destructive">
          {block.last.summaryKo}
        </div>
      )}
    </div>
  );
}
