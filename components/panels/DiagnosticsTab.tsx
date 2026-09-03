"use client";

// 진단 탭 — 블록별 stdout/stderr/traceback + 한국어 요약, 셀·블록 이동 링크 (§4.4)

import { Badge } from "@/components/ui/badge";
import { formatA1 } from "@/lib/grid/a1";
import { useWorkbookStore } from "@/lib/grid/model";
import { blocksInOrder } from "@/lib/grid/run-block";
import type { PyBlock } from "@/types/workbook";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  ok: { label: "성공", cls: "bg-primary/10 text-primary" },
  error: { label: "오류", cls: "bg-destructive/10 text-destructive" },
  spill: { label: "#SPILL!", cls: "bg-destructive/10 text-destructive" },
};

function BlockRow({ block, sheetName }: { block: PyBlock; sheetName: string }) {
  const anchorLabel = `${sheetName}!${formatA1({
    r0: block.anchor.r,
    c0: block.anchor.c,
    r1: block.anchor.r,
    c1: block.anchor.c,
  })}`;
  const last = block.last;
  const status = last ? STATUS_LABEL[last.status] : undefined;

  const goToCell = () => {
    const st = useWorkbookStore.getState();
    st.setActiveSheet(block.sheetId);
    st.setSelection({
      r0: block.anchor.r,
      c0: block.anchor.c,
      r1: block.anchor.r,
      c1: block.anchor.c,
    });
  };

  const detail = [
    last?.stdout && `── stdout ──\n${last.stdout}`,
    last?.stderr && `── stderr ──\n${last.stderr}`,
    last?.traceback && `── traceback ──\n${last.traceback}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="border-b px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="font-mono">{anchorLabel}</span>
        {status && <Badge className={status.cls}>{status.label}</Badge>}
        <span className="text-muted-foreground">
          {last ? `${last.durationMs}ms` : "실행 전"}
        </span>
        <div className="ml-auto flex gap-2">
          <button onClick={goToCell} className="text-primary hover:underline">
            셀로 이동
          </button>
          <button
            onClick={() => useWorkbookStore.getState().setFocusBlock(block.id)}
            className="text-primary hover:underline"
          >
            블록으로 이동
          </button>
        </div>
      </div>
      {last?.summaryKo && (
        <p className={last.status === "ok" ? "mt-1" : "mt-1 text-destructive"}>
          {last.summaryKo}
        </p>
      )}
      {detail && (
        <details className="mt-1">
          <summary className="cursor-pointer text-muted-foreground">
            stdout / stderr / traceback
          </summary>
          <pre className="mt-1 overflow-x-auto rounded bg-code-bg p-2 font-mono text-[11px] leading-4">
            {detail}
          </pre>
        </details>
      )}
    </div>
  );
}

export default function DiagnosticsTab() {
  const workbook = useWorkbookStore((s) => s.workbook);
  const blocks = blocksInOrder(workbook);
  const sheetName = (id: string) =>
    workbook.sheets.find((s) => s.id === id)?.name ?? "?";

  if (blocks.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
        Python 블록이 없습니다
      </p>
    );
  }
  return (
    <div>
      {blocks.map((b) => (
        <BlockRow key={b.id} block={b} sheetName={sheetName(b.sheetId)} />
      ))}
    </div>
  );
}
