"use client";

/**
 * 함수·방법 검색 — 엑셀함수·파이썬코드 탭 공용.
 * 입력하면 자동완성 팝업(이름+간단 설명)이 뜨고, 선택/Enter 시 아래에 검색 결과를
 * 5개/페이지로 보여 준다(페이지 이동). 결과를 누르면 onOpen(id)으로 상세 다이얼로그를 연다.
 * 소스: Actuarial_Platform FunctionSearch.tsx (토큰만 이 앱에 맞춤).
 */
import { useMemo, useRef, useState } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";

export interface SearchItem {
  id: string;
  /** 표시 이름(함수명 등) */
  name: string;
  /** 한 줄 요약 */
  summary: string;
  /** 부가 표기(영문명·카테고리 등, 선택) */
  meta?: string;
  /** 칩 색(--chip-*), 선택 */
  color?: string;
}

const PAGE_SIZE = 5;

/** 이름 시작 > 이름 포함 > 부가표기 포함 > 요약 포함 순 랭킹 */
function rankItems(items: SearchItem[], q: string): SearchItem[] {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  const scored: { it: SearchItem; s: number }[] = [];
  for (const it of items) {
    const name = it.name.toLowerCase();
    const summary = it.summary.toLowerCase();
    const meta = (it.meta ?? "").toLowerCase();
    let s = -1;
    if (name.startsWith(query)) s = 100;
    else if (name.includes(query)) s = 80;
    else if (meta.includes(query)) s = 55;
    else if (summary.includes(query)) s = 40;
    if (s >= 0) scored.push({ it, s });
  }
  scored.sort((a, b) => b.s - a.s || a.it.name.localeCompare(b.it.name));
  return scored.map((x) => x.it);
}

export function FunctionSearch({
  items,
  onOpen,
  placeholder = "함수 이름·설명으로 검색",
}: {
  items: SearchItem[];
  onOpen: (id: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [committed, setCommitted] = useState<string>("");
  const [page, setPage] = useState(0);
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const suggestions = useMemo(() => rankItems(items, query).slice(0, 8), [items, query]);
  const results = useMemo(() => rankItems(items, committed), [items, committed]);
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount - 1);
  const pageItems = results.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE);

  const commit = (q: string) => {
    setCommitted(q.trim());
    setPage(0);
    setFocused(false);
  };
  const clear = () => {
    setQuery("");
    setCommitted("");
    setPage(0);
  };

  const showDropdown = focused && query.trim().length > 0 && suggestions.length > 0;

  const dot = (color?: string, size = "h-2 w-2") =>
    color ? (
      <span
        className={`${size} shrink-0 rounded-full`}
        style={{ background: `var(--chip-${color}-fg)` }}
        aria-hidden
      />
    ) : null;

  return (
    <div className="mb-6">
      {/* 검색 입력 + 자동완성 팝업 */}
      <div className="relative">
        <div className="flex items-center gap-2 rounded-full border bg-card px-3.5 py-2 focus-within:border-foreground">
          <MagnifyingGlass size={16} className="shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (blurTimer.current) clearTimeout(blurTimer.current);
              setFocused(true);
            }}
            onBlur={() => {
              blurTimer.current = setTimeout(() => setFocused(false), 120);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit(query);
              else if (e.key === "Escape") setFocused(false);
            }}
            placeholder={placeholder}
            aria-label="함수 검색"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={clear}
              aria-label="지우기"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X size={15} />
            </button>
          ) : null}
        </div>

        {showDropdown ? (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border bg-card py-1 shadow-lg">
            {suggestions.map((it) => (
              <button
                key={it.id}
                type="button"
                // mousedown이 blur보다 먼저 발생 → 선택 유실 방지
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(query)}
                className="flex w-full flex-col items-start gap-0.5 px-3.5 py-2 text-left hover:bg-muted"
              >
                <span className="flex w-full items-center gap-1.5">
                  {dot(it.color, "h-1.5 w-1.5")}
                  <span className="font-mono text-[13.5px] font-semibold text-foreground">
                    {it.name}
                  </span>
                  {it.meta ? (
                    <span className="truncate text-[11px] text-muted-foreground">{it.meta}</span>
                  ) : null}
                </span>
                <span className="w-full truncate text-[12px] text-muted-foreground">
                  {it.summary}
                </span>
              </button>
            ))}
            <p className="border-t px-3.5 pb-1 pt-1.5 text-[11px] text-muted-foreground">
              Enter 또는 항목 선택 → 아래에 전체 검색 결과가 표시됩니다
            </p>
          </div>
        ) : null}
      </div>

      {/* 검색 결과(아래) — 5개/페이지 + 페이지 이동 */}
      {committed ? (
        <div className="mt-4 rounded-lg border bg-muted/40 p-4">
          {results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              &lsquo;{committed}&rsquo; 검색 결과가 없습니다.
            </p>
          ) : (
            <>
              <div className="mb-1 flex items-center justify-between gap-3">
                <p className="text-[12.5px] font-medium text-foreground">
                  &lsquo;{committed}&rsquo; 검색 결과 {results.length}개 — 항목을 누르면 상세
                  설명이 열립니다
                </p>
                <button
                  type="button"
                  onClick={clear}
                  className="shrink-0 text-[12px] text-muted-foreground hover:text-foreground"
                >
                  검색 지우기
                </button>
              </div>
              <ul className="divide-y divide-border">
                {pageItems.map((it) => (
                  <li key={it.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(it.id)}
                      className="flex w-full flex-col items-start gap-0.5 rounded px-1 py-2.5 text-left transition-colors hover:bg-card"
                    >
                      <span className="flex items-center gap-1.5">
                        {dot(it.color)}
                        <span className="font-mono text-[14px] font-semibold text-foreground">
                          {it.name}
                        </span>
                        {it.meta ? (
                          <span className="text-[11.5px] text-muted-foreground">{it.meta}</span>
                        ) : null}
                      </span>
                      <span className="text-[12.5px] leading-relaxed text-muted-foreground">
                        {it.summary}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {pageCount > 1 ? (
                <div className="mt-3 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={pageSafe === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className="rounded border px-2.5 py-1 text-[12px] text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    ◀ 이전
                  </button>
                  <span className="text-[12px] tabular-nums text-muted-foreground">
                    {pageSafe + 1} / {pageCount}
                  </span>
                  <button
                    type="button"
                    disabled={pageSafe >= pageCount - 1}
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    className="rounded border px-2.5 py-1 text-[12px] text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    다음 ▶
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
