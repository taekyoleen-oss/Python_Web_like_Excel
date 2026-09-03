"use client";

// Python 패널 — 블록 목록(기본 계산 순서: 시트 순 → 앵커 행 → 열)

import { useMemo } from "react";
import PyBlockCard from "@/components/python/PyBlockCard";
import { blocksInOrder } from "@/lib/grid/run-block";
import { useWorkbookStore } from "@/lib/grid/model";

export default function PythonPanel() {
  const workbook = useWorkbookStore((s) => s.workbook);
  const blocks = useMemo(() => blocksInOrder(workbook), [workbook]);

  return (
    <div className="flex h-full flex-col border-l bg-code-bg">
      <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
        Python 패널 · 블록 {blocks.length}
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
    </div>
  );
}
