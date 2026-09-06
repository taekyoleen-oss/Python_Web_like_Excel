"use client";

// 부록 F.1 — 코드 삽입 팝업: 그룹(핸들링 12 + 그래프 3) → 스니펫(그래프는 SVG 미리보기)
// → 삽입될 코드 전체 미리보기 → [현재 블록에 추가 | 아래 새 블록으로 | 위 새 블록으로].
// 기준 블록 = 마지막으로 편집기 포커스를 받은 코드 블록. Enter = 마지막 사용 위치로 삽입.
// 새 블록은 자동 실행하지 않는다.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CodeBlock } from "@/components/reference/code-popup";
import { PLOT_META, PlotSampleSvg } from "@/components/reference/PlotSampleSvg";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatA1 } from "@/lib/grid/a1";
import { notifyWorkbookEdit } from "@/lib/grid/calc-host";
import { codeTitle } from "@/lib/grid/code-sections";
import { appendSnippetToBlock, insertSnippetAsBlock } from "@/lib/grid/insert-snippet";
import { useWorkbookStore } from "@/lib/grid/model";
import { PLOT_SNIPPET_GROUPS, plotInsertCode } from "@/lib/reference/plotSnippets";
import { WRANGLE_SNIPPET_GROUPS, snippetInsertCode } from "@/lib/reference/wrangleSnippets";
import { cn } from "@/lib/utils";

type Placement = "append" | "below" | "above";

interface Group {
  key: string;
  kind: "wrangle" | "plot";
  label: string;
  snippets: { id: string; label: string; desc: string; code: string }[];
}

const GROUPS: Group[] = [
  ...WRANGLE_SNIPPET_GROUPS.map((g) => ({
    key: `w:${g.id}`,
    kind: "wrangle" as const,
    label: g.label,
    snippets: g.snippets,
  })),
  ...PLOT_SNIPPET_GROUPS.map((g) => ({
    key: `p:${g.id}`,
    kind: "plot" as const,
    label: g.label,
    snippets: g.snippets,
  })),
];

function GroupList({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (key: string) => void;
}) {
  const section = (kind: Group["kind"], title: string) => (
    <>
      <p className="px-2 pb-0.5 pt-2 text-[11px] font-semibold text-muted-foreground">
        {title}
      </p>
      {GROUPS.filter((g) => g.kind === kind).map((g) => (
        <button
          key={g.key}
          onClick={() => onSelect(g.key)}
          aria-pressed={g.key === active}
          className={cn(
            "block w-full truncate px-2 py-1 text-left text-xs hover:bg-accent",
            g.key === active ? "bg-accent font-medium text-primary" : "text-foreground/80",
          )}
        >
          {g.label}
        </button>
      ))}
    </>
  );
  return (
    <div className="w-44 shrink-0 overflow-y-auto rounded border py-1">
      {section("wrangle", "핸들링")}
      {section("plot", "그래프")}
    </div>
  );
}

export default function SnippetInsertDialog() {
  const [open, setOpen] = useState(false);
  const [groupKey, setGroupKey] = useState(GROUPS[0].key);
  const [snippetId, setSnippetId] = useState(GROUPS[0].snippets[0]?.id ?? "");
  const [lastPlacement, setLastPlacement] = useState<Placement>("below");

  // 기준 블록 = 마지막으로 편집기 포커스를 받은 코드 블록 (v1.2 lastEditorBlockId)
  const refBlock = useWorkbookStore((s) =>
    s.workbook.pyBlocks.find((b) => b.id === s.lastEditorBlockId && b.kind !== "markdown"),
  );
  const refSheetName = useWorkbookStore((s) =>
    refBlock ? s.workbook.sheets.find((sh) => sh.id === refBlock.sheetId)?.name : undefined,
  );

  const group = GROUPS.find((g) => g.key === groupKey) ?? GROUPS[0];
  const snippet = group.snippets.find((s) => s.id === snippetId) ?? group.snippets[0];
  const insertText = useMemo(() => {
    if (!snippet) return "";
    return group.kind === "plot" ? plotInsertCode(snippet) : snippetInsertCode(snippet);
  }, [group.kind, snippet]);

  const selectGroup = (key: string) => {
    setGroupKey(key);
    const g = GROUPS.find((x) => x.key === key);
    setSnippetId(g?.snippets[0]?.id ?? "");
  };

  const doInsert = (placement: Placement) => {
    if (!snippet) return;
    let targetId: string;
    if (placement === "append") {
      if (!refBlock || !appendSnippetToBlock(refBlock.id, insertText)) return;
      notifyWorkbookEdit([], [refBlock.id]); // 타이핑 커밋과 같은 통지 경로 (§2.3.3)
      targetId = refBlock.id;
    } else {
      const res = insertSnippetAsBlock(refBlock?.id ?? null, placement, snippet.label, insertText);
      if (!res) {
        toast.error("블록을 만들 수 없습니다 (활성 시트 없음)");
        return;
      }
      if (refBlock && !res.ordered) {
        toast("순서를 보장할 빈 위치가 없어 빈 영역에 배치했습니다 — ↑↓로 순서를 조정하세요");
      }
      targetId = res.id;
    }
    setLastPlacement(placement);
    setOpen(false);
    // 닫힘 뒤 대상 블록 포커스 (focusBlock 메커니즘 — CodeEditor가 이어받는다)
    requestAnimationFrame(() => {
      const st = useWorkbookStore.getState();
      st.setFocusBlock(targetId);
      st.setSelectedBlock(targetId);
    });
  };

  const refLabel = refBlock
    ? refBlock.title?.trim() ||
      codeTitle(refBlock.code) ||
      `${refSheetName ?? "?"}!${formatA1({
        r0: refBlock.anchor.r,
        c0: refBlock.anchor.c,
        r1: refBlock.anchor.r,
        c1: refBlock.anchor.c,
      })}`
    : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 shrink-0 px-2 text-xs">
          코드 삽입
        </Button>
      </DialogTrigger>
      <DialogContent
        className="flex h-[85vh] max-w-[960px] flex-col gap-2 sm:max-w-[960px]"
        onCloseAutoFocus={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
          e.preventDefault();
          doInsert(lastPlacement === "append" && !refBlock ? "below" : lastPlacement);
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-sm">코드 삽입 — 핸들링·그래프 스니펫</DialogTitle>
          <DialogDescription className="text-xs">
            스니펫을 고르면 삽입될 코드가 그대로 보입니다. Enter = 마지막 사용 위치로 삽입.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 gap-2">
          <GroupList active={group.key} onSelect={selectGroup} />

          {/* 스니펫 목록 — 그래프는 SVG 미리보기 썸네일 */}
          <div className="w-64 shrink-0 overflow-y-auto rounded border py-1">
            {group.snippets.map((s) => {
              const activeSnip = s.id === snippet?.id;
              const meta = group.kind === "plot" ? PLOT_META[s.id] : undefined;
              return (
                <button
                  key={s.id}
                  onClick={() => setSnippetId(s.id)}
                  aria-pressed={activeSnip}
                  className={cn(
                    "flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-accent",
                    activeSnip && "bg-accent",
                  )}
                >
                  {meta && (
                    <span className="w-16 shrink-0 overflow-hidden rounded border bg-card">
                      <PlotSampleSvg shape={meta.shape} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-xs",
                        activeSnip ? "font-medium text-primary" : "font-medium",
                      )}
                    >
                      {s.label}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {s.desc}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* 삽입될 코드 전체 미리보기 (# ▸ 라벨 + # 설명 접두 포함) */}
          <div
            className="min-w-0 flex-1 overflow-y-auto rounded border px-2 pb-2"
            data-testid="snippet-code-preview"
          >
            {snippet ? (
              <CodeBlock code={insertText} codeFz={12} />
            ) : (
              <p className="p-4 text-xs text-muted-foreground">스니펫을 선택하세요</p>
            )}
          </div>
        </div>

        {/* 삽입 위치 — 정확히 세 버튼 (기준 블록 없으면 새 블록 하나로 축약) */}
        <div className="flex shrink-0 items-center gap-1.5 border-t pt-2">
          <span className="mr-auto min-w-0 truncate text-xs text-muted-foreground">
            {refLabel ? `기준 블록: ${refLabel}` : "기준 블록 없음 — 새 블록은 빈 영역에 만듭니다"}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={!refBlock || !snippet}
            title={refBlock ? "기준 블록 코드 끝에 덧붙입니다" : "블록 편집기를 먼저 클릭하세요"}
            onClick={() => doInsert("append")}
          >
            현재 블록에 추가
          </Button>
          {refBlock ? (
            <>
              <Button
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={!snippet}
                title="계산 순서상 기준 블록 바로 다음에 새 블록을 만듭니다"
                onClick={() => doInsert("below")}
              >
                아래 새 블록으로
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={!snippet}
                title="계산 순서상 기준 블록 바로 앞에 새 블록을 만듭니다"
                onClick={() => doInsert("above")}
              >
                위 새 블록으로
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={!snippet}
              onClick={() => doInsert("below")}
            >
              새 블록으로
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
