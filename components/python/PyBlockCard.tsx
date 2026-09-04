"use client";

// 블록 카드 (Colab 스타일 셀) — 왼쪽 원형 ▶ + hover 시 떠오르는 우상단 툴바(위·아래·편집·삭제·더보기).
// 헤더에는 접기·앵커·제목·상태만 남기고 보조 조작은 ⋮ 메뉴로 모은다.
// kind==='markdown'이면 실행 UI 없이 마크다운 편집/미리보기만 (셀에 아무것도 쓰지 않는다).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CaretDown,
  CaretRight,
  DotsThreeVertical,
  Eye,
  NotePencil,
  Play,
  TrashSimple,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
import { renderMarkdown } from "@/lib/grid/markdown";
import { useWorkbookStore } from "@/lib/grid/model";
import { moveBlock, runBlock } from "@/lib/grid/run-block";
import { getRuntimeClient } from "@/lib/runtime/client";
import { cn } from "@/lib/utils";
import { cellKey, type OutputMode, type OutputSelection, type PyBlock } from "@/types/workbook";

/** Radix Select는 빈 값을 못 쓴다 — '마지막 표현식' 자리표시 값 */
const LAST_EXPR = "__last__";

const store = () => useWorkbookStore.getState();

function statusBadge(block: PyBlock, running: boolean) {
  if (running) {
    return <Badge className="bg-warning/15 text-warning-text">실행 중</Badge>;
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

/** 출력 선택 변경 → dirty 표시 + (자동 모드) 재실행. 필터링은 런타임이 한다 */
const applyOutput = (blockId: string, patch: OutputSelection) => {
  store().setBlockOutput(blockId, patch);
  notifyWorkbookEdit([], [blockId]);
};

/** 출력 변수 — 런타임 전역 변수 목록(inspect) + '마지막 표현식' */
function VariableSelect({ block }: { block: PyBlock }) {
  const [vars, setVars] = useState<string[]>([]);
  const loaded = useRef(false);

  const refresh = useCallback(async () => {
    const client = getRuntimeClient();
    if (client.getStatus() !== "ready") return;
    try {
      setVars((await client.inspect()).map((v) => v.name));
      loaded.current = true;
    } catch {
      /* 재부트 중 등 — 다음 열기에서 회복 */
    }
  }, []);

  // 실행이 끝나면 갱신 (한 번이라도 목록을 연 카드만 — 유휴 inspect 폭주 방지)
  const ranAt = block.last?.ranAt;
  useEffect(() => {
    if (loaded.current) void refresh();
  }, [ranAt, refresh]);

  const current = block.output?.variable;
  const names = current && !vars.includes(current) ? [current, ...vars] : vars;

  return (
    <Select
      value={current ?? LAST_EXPR}
      onValueChange={(v) =>
        applyOutput(block.id, { variable: v === LAST_EXPR ? undefined : v })
      }
      onOpenChange={(open) => {
        if (open) void refresh();
      }}
    >
      <SelectTrigger className="h-6 w-32 text-xs" aria-label="출력 변수">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={LAST_EXPR}>마지막 표현식</SelectItem>
        {names.map((n) => (
          <SelectItem key={n} value={n} className="font-mono">
            {n}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * 결과 표의 열 이름. 객체 모드는 preview.columns, 값 모드는 preview가 없으므로
 * spill 헤더 행(전부 문자열)에서 읽는다.
 * ponytail: 열을 거른 뒤에는 남은 열만 보인다 — '전체'로 되돌리면 목록도 복구된다.
 */
function useTableColumns(block: PyBlock): string[] {
  const sheet = useWorkbookStore((s) =>
    s.workbook.sheets.find((sh) => sh.id === block.sheetId),
  );
  const preview = block.last?.preview as
    | { kind?: string; columns?: string[] }
    | undefined;
  const selected = block.output?.columns ?? [];
  let names: string[] = [];
  if (preview?.kind === "table" && preview.columns) {
    names = preview.columns;
  } else {
    const rg = block.last?.spillRange;
    if (sheet && rg && block.last?.kind === "table" && rg.r1 > rg.r0) {
      for (let c = rg.c0; c <= rg.c1; c++) {
        const cell = sheet.cells[cellKey(rg.r0, c)];
        if (!cell || cell.t !== "s") {
          names = []; // 헤더 행이 아니다 (Series·목록 등)
          break;
        }
        names.push(String(cell.v ?? ""));
      }
      if (names[0] === "") names.shift(); // index 라벨 열
    }
  }
  return [...names, ...selected.filter((c) => !names.includes(c))];
}

/** 열 선택 — 마지막 결과가 표일 때만 표시 */
function ColumnsMenu({ block }: { block: PyBlock }) {
  const all = useTableColumns(block);
  if (all.length === 0) return null;

  const selected = block.output?.columns;
  const current = selected ?? all;
  const commit = (next: string[]) => {
    const full = next.length === 0 || next.length === all.length;
    applyOutput(block.id, { columns: full ? undefined : next });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 px-2 text-xs" aria-label="열 선택">
          열 {selected ? `${selected.length}/${all.length}` : "전체"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
        <DropdownMenuCheckboxItem
          checked={!selected}
          onSelect={(e) => e.preventDefault()}
          onCheckedChange={() => commit(all)}
        >
          전체
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {all.map((c) => (
          <DropdownMenuCheckboxItem
            key={c}
            checked={current.includes(c)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(v) =>
              commit(v ? [...all.filter((x) => current.includes(x) || x === c)] : current.filter((x) => x !== c))
            }
            className="font-mono text-xs"
          >
            {c}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** 출력 행: 변수·열·행 제한 (출력 위치 지정은 ⋮ 메뉴) */
function OutputRow({ block }: { block: PyBlock }) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b bg-muted/20 px-2 py-1">
      <span className="text-xs text-muted-foreground">출력</span>
      <VariableSelect block={block} />
      <ColumnsMenu block={block} />
      <Input
        type="number"
        min={1}
        inputMode="numeric"
        value={block.output?.rowLimit ?? ""}
        placeholder="상위 N행"
        aria-label="상위 N행"
        onChange={(e) => {
          const n = Number(e.target.value);
          applyOutput(block.id, {
            rowLimit: Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined,
          });
        }}
        className="h-6 w-24 px-1.5"
      />
    </div>
  );
}

/** 앵커 셀로 이동 (헤더 주소 버튼 · ⋮ 메뉴 공용) */
function goToAnchor(block: PyBlock): void {
  const st = store();
  st.setActiveSheet(block.sheetId);
  st.setSelection({
    r0: block.anchor.r,
    c0: block.anchor.c,
    r1: block.anchor.r,
    c1: block.anchor.c,
  });
}

/** ⋮ 더보기 — 헤더에서 밀어낸 보조 조작 */
function MoreMenu({ block, onRun }: { block: PyBlock; onRun: () => void }) {
  const isMarkdown = block.kind === "markdown";
  const collapsed = !!block.collapsed;
  const picking = useWorkbookStore((s) => s.anchorPickingBlockId === block.id);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label="더보기" title="더보기">
          <DotsThreeVertical weight="bold" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {!isMarkdown && (
          <>
            <DropdownMenuItem onClick={onRun}>
              실행
              <DropdownMenuShortcut>Ctrl+Enter</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>출력 모드</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={block.outputMode}
              onValueChange={(v) => store().setBlockOutputMode(block.id, v as OutputMode)}
            >
              <DropdownMenuRadioItem value="values">값 (셀로 펼치기)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="object">객체 (카드)</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          onClick={() => store().setAnchorPicking(picking ? null : block.id)}
        >
          {isMarkdown ? "위치 지정" : "출력 위치 지정"}
          {picking && <DropdownMenuShortcut>지정 중</DropdownMenuShortcut>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => goToAnchor(block)}>앵커 셀로 이동</DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => store().setBlockCollapsed(block.id, !collapsed)}
        >
          {collapsed ? "펼치기" : "접기"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function PyBlockCard({
  block,
  isFirst,
  isLast,
}: {
  block: PyBlock;
  /** 계산 순서상 처음/마지막 — ↑↓ 비활성화용 (패널이 계산해 넘긴다) */
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const isMarkdown = block.kind === "markdown";
  const running = useWorkbookStore((s) => !!s.runningBlocks[block.id]);
  const dirty = useWorkbookStore((s) => !!s.dirtyBlocks[block.id]);
  const hovered = useWorkbookStore((s) => s.hoverBlockId === block.id);
  const picking = useWorkbookStore((s) => s.anchorPickingBlockId === block.id);
  const focusRequested = useWorkbookStore((s) => s.focusBlockId === block.id);
  const sheetName = useWorkbookStore(
    (s) => s.workbook.sheets.find((sh) => sh.id === block.sheetId)?.name ?? "?",
  );
  const collapsed = !!block.collapsed;
  const cardRef = useRef<HTMLDivElement>(null);
  const mdRef = useRef<HTMLTextAreaElement>(null);
  const codeRef = useRef(block.code);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // 노트북처럼: 새 마크다운은 편집 상태로 열리고, 미리보기 더블클릭으로 다시 편집
  const [editingMd, setEditingMd] = useState(isMarkdown && !block.markdown);
  // §4.7 <640: 인라인 편집 대신 전체 화면 편집기
  const [narrow, setNarrow] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  // 외부 변경(undo 등)으로 코드가 바뀌면 ▶ 커밋 기준도 따라간다
  useEffect(() => {
    codeRef.current = block.code;
  }, [block.code]);

  // 목차·블록으로 이동 → 카드 노출 (코드 블록은 CodeEditor가 포커스까지 처리)
  useEffect(() => {
    if (!focusRequested) return;
    cardRef.current?.scrollIntoView({ block: "nearest" });
    if (isMarkdown) {
      mdRef.current?.focus();
      store().setFocusBlock(null);
    }
  }, [focusRequested, isMarkdown]);

  /** 코드 확정. notify면 자동 재계산/dirty 배지 통지 (§2.3.3 코드 저장 → dirty) */
  const commitCode = (value: string, notify: boolean) => {
    clearTimeout(debounceRef.current);
    const changed =
      store().workbook.pyBlocks.find((b) => b.id === block.id)?.code !== value;
    store().setBlockCode(block.id, value);
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

  const anchorLabel = `${sheetName}!${formatA1({
    r0: block.anchor.r,
    c0: block.anchor.c,
    r1: block.anchor.r,
    c1: block.anchor.c,
  })}`;

  const rendered = useMemo(
    () => (isMarkdown ? renderMarkdown(block.markdown ?? "") : null),
    [isMarkdown, block.markdown],
  );

  return (
    <div
      ref={cardRef}
      className={cn(
        "group relative rounded border bg-card transition-shadow",
        hovered && "border-primary/60 shadow-[0_0_0_2px_#EAF3FA]", // spill hover → 카드 강조 (§4.8)
        picking && "border-primary",
      )}
      data-block-id={block.id}
      data-block-kind={isMarkdown ? "markdown" : "code"}
    >
      {/* 헤더 — 접기·앵커·상태·제목만 */}
      <div className="flex items-center gap-1.5 border-b bg-muted/40 px-2 py-1">
        <button
          onClick={() => store().setBlockCollapsed(block.id, !collapsed)}
          className="text-muted-foreground hover:text-foreground"
          aria-label={collapsed ? "블록 펼치기" : "블록 접기"}
          aria-expanded={!collapsed}
          title={collapsed ? "펼치기" : "접기"}
        >
          {collapsed ? <CaretRight className="size-3.5" /> : <CaretDown className="size-3.5" />}
        </button>
        <button
          onClick={() => goToAnchor(block)}
          className="shrink-0 font-mono text-xs text-foreground/80 hover:text-primary"
          title="앵커 셀로 이동"
        >
          {anchorLabel}
        </button>
        {isMarkdown ? (
          <Badge variant="secondary">마크다운</Badge>
        ) : (
          <>
            {statusBadge(block, running)}
            {dirty && !running && (
              <span
                className="size-1.5 shrink-0 rounded-full bg-warning"
                title="변경됨 — 재실행 필요"
                aria-label="dirty"
              />
            )}
          </>
        )}
        {isMarkdown ? (
          <span className="min-w-0 flex-1 truncate text-xs font-medium">
            {block.title || <span className="text-muted-foreground">제목 없음</span>}
          </span>
        ) : (
          <Input
            value={block.title ?? ""}
            onChange={(e) => store().setBlockTitle(block.id, e.target.value)}
            placeholder="제목 없음"
            aria-label="블록 제목"
            className="h-6 min-w-0 flex-1 px-1.5"
          />
        )}
      </div>

      {/* 떠 있는 셀 툴바 — hover·포커스에서만 보이지만 DOM에는 항상 있어 Tab으로 닿는다 */}
      <div
        data-testid="cell-toolbar"
        className="pointer-events-none absolute right-1 top-0.5 z-10 flex items-center rounded border bg-card p-0.5 opacity-0 shadow-sm transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
      >
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={isFirst}
          onClick={() => moveBlock(block.id, "up")}
          aria-label="위로"
          title={isFirst ? "첫 블록입니다" : "위로 — 앞 블록과 실행 순서·자리 바꾸기"}
        >
          <ArrowUp />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={isLast}
          onClick={() => moveBlock(block.id, "down")}
          aria-label="아래로"
          title={isLast ? "마지막 블록입니다" : "아래로 — 뒤 블록과 실행 순서·자리 바꾸기"}
        >
          <ArrowDown />
        </Button>
        {isMarkdown && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setEditingMd((v) => !v)}
            aria-label="편집/미리보기 전환"
            title="편집/미리보기 전환"
          >
            <NotePencil />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => store().removePyBlock(block.id)}
          aria-label="블록 삭제"
          title="블록 삭제"
        >
          <TrashSimple />
        </Button>
        <MoreMenu block={block} onRun={run} />
      </div>

      {/* 본문 — 왼쪽 원형 실행 레일 + 내용 */}
      {!collapsed && (
        <div className="flex">
          <div className="flex w-9 shrink-0 justify-center py-1.5">
            {isMarkdown ? (
              <Button
                variant="ghost"
                className="size-7 rounded-full p-0"
                onClick={() => setEditingMd((v) => !v)}
                aria-label={editingMd ? "마크다운 미리보기" : "마크다운 편집"}
                title={editingMd ? "미리보기" : "편집"}
              >
                {editingMd ? <Eye /> : <NotePencil />}
              </Button>
            ) : (
              <Button
                variant="ghost"
                className="size-7 rounded-full border p-0 hover:bg-accent"
                onClick={run}
                disabled={running}
                aria-label="실행"
                title="실행 (Ctrl+Enter)"
              >
                <Play weight="fill" className="text-primary" />
              </Button>
            )}
          </div>

          <div className="min-w-0 flex-1 border-l">
            {isMarkdown ? (
              editingMd ? (
                <textarea
                  ref={mdRef}
                  value={block.markdown ?? ""}
                  onChange={(e) => store().setBlockMarkdown(block.id, e.target.value)}
                  onBlur={() => setEditingMd(false)}
                  rows={6}
                  placeholder={"# 제목\n\n설명을 적으세요. **굵게**, `코드`, [링크](https://example.com)"}
                  aria-label="마크다운"
                  className="w-full resize-y bg-card p-2 font-mono text-xs outline-none placeholder:text-muted-foreground"
                />
              ) : (
                <div
                  onDoubleClick={() => setEditingMd(true)}
                  data-testid="markdown-preview"
                  className="space-y-1 px-2 py-2"
                  title="더블클릭하여 편집"
                >
                  {block.markdown?.trim() ? (
                    rendered
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      더블클릭하여 마크다운을 입력하세요
                    </p>
                  )}
                </div>
              )
            ) : (
              <>
                <OutputRow block={block} />
                {narrow ? (
                  <>
                    <button
                      onClick={() => setEditorOpen(true)}
                      className="w-full truncate bg-code-bg px-2 py-2 text-left font-mono text-xs text-muted-foreground"
                    >
                      {block.code.split("\n")[0] || "코드 편집 (전체 화면)…"}
                    </button>
                    <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
                      <DialogContent className="h-[85vh] max-w-full p-3">
                        <DialogHeader>
                          <DialogTitle className="text-sm">{anchorLabel} 코드 편집</DialogTitle>
                        </DialogHeader>
                        <div className="min-h-0 flex-1 overflow-auto rounded border">
                          <CodeEditor
                            blockId={block.id}
                            sheetId={block.sheetId}
                            value={block.code}
                            onChange={onChange}
                            onRun={run}
                            className="max-h-full"
                          />
                        </div>
                        <Button onClick={run} disabled={running} className="shrink-0">
                          실행 (Ctrl+Enter)
                        </Button>
                      </DialogContent>
                    </Dialog>
                  </>
                ) : (
                  <CodeEditor
                    blockId={block.id}
                    sheetId={block.sheetId}
                    value={block.code}
                    onChange={onChange}
                    onRun={run}
                    placeholder={'df = xl("A1:C10", headers=True)\ndf.describe()'}
                  />
                )}
                {block.last?.status === "error" && block.last.summaryKo && (
                  <div className="border-t px-2 py-1 text-xs text-destructive">
                    {block.last.summaryKo}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
