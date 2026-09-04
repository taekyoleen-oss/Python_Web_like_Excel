// 마크다운 블록 파서·렌더러 — 의존성 없이 React 엘리먼트를 직접 만든다.
// 원시 HTML을 절대 해석하지 않으므로(dangerouslySetInnerHTML 없음) .pygrid.json 공유가 안전하다.
// 지원: #~###### 헤딩 · **굵게** · *기울임* · `인라인 코드` · ``` 코드 블록 ·
//       -/*/+·1. 목록 · [텍스트](주소) · --- 구분선 · 문단/줄바꿈. 그 밖의 문법은 평문.

import { createElement, type ReactNode } from "react";
import type { BlockKind, PyBlock, RunStatus } from "@/types/workbook";
import { formatA1 } from "./a1";

export type Inline =
  | { t: "text"; v: string }
  | { t: "strong"; v: string }
  | { t: "em"; v: string }
  | { t: "code"; v: string }
  | { t: "link"; v: string; href: string }
  | { t: "br"; v: "" };

export type MdNode =
  | { t: "heading"; level: number; children: Inline[] }
  | { t: "para"; children: Inline[] }
  | { t: "code"; lang: string; text: string }
  | { t: "list"; ordered: boolean; items: Inline[][] }
  | { t: "hr" };

// 코드 스팬 우선(그 안의 *·[]는 서식이 아니다) → 굵게 → 기울임 → 링크
const INLINE_RE =
  /`([^`\n]+)`|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|\[([^\]\n]*)\]\(([^)\s]*)\)/g;

/** javascript: 등 실행 가능한 주소는 링크로 만들지 않는다 (공유 파일 = 신뢰 경계) */
const SAFE_HREF = /^(?:https?:\/\/|mailto:|#|\/)/i;

function inlineTokens(text: string): Inline[] {
  const out: Inline[] = [];
  const pushText = (v: string) => {
    if (v === "") return;
    const prev = out[out.length - 1];
    if (prev?.t === "text") prev.v += v; // 인접 평문은 하나로
    else out.push({ t: "text", v });
  };
  let last = 0;
  for (const m of text.matchAll(INLINE_RE)) {
    pushText(text.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[1] !== undefined) out.push({ t: "code", v: m[1] });
    else if (m[2] !== undefined) out.push({ t: "strong", v: m[2] });
    else if (m[3] !== undefined) out.push({ t: "em", v: m[3] });
    else if (SAFE_HREF.test(m[5])) out.push({ t: "link", v: m[4], href: m[5] });
    else pushText(m[0]); // 안전하지 않은 주소 → 원문 그대로 평문
  }
  pushText(text.slice(last));
  return out;
}

export function parseMarkdown(src: string): MdNode[] {
  const lines = src.split(/\r?\n/);
  const out: MdNode[] = [];
  let para: string[] = [];

  const flushPara = () => {
    if (para.length === 0) return;
    const children: Inline[] = [];
    para.forEach((line, i) => {
      if (i > 0) children.push({ t: "br", v: "" });
      children.push(...inlineTokens(line));
    });
    out.push({ t: "para", children });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = /^\s*```(.*)$/.exec(line);
    if (fence) {
      flushPara();
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      out.push({ t: "code", lang: fence[1].trim(), text: body.join("\n") });
      continue; // i는 닫는 fence(또는 끝) — for의 i++가 건너뛴다
    }
    if (line.trim() === "") {
      flushPara();
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      out.push({ t: "heading", level: h[1].length, children: inlineTokens(h[2].trim()) });
      continue;
    }
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushPara();
      out.push({ t: "hr" });
      continue;
    }
    const li = /^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/.exec(line);
    if (li) {
      flushPara();
      const ordered = li[2] !== undefined;
      const prev = out[out.length - 1];
      const item = inlineTokens(li[3]);
      if (prev?.t === "list" && prev.ordered === ordered) prev.items.push(item);
      else out.push({ t: "list", ordered, items: [item] });
      continue;
    }
    para.push(line);
  }
  flushPara();
  return out;
}

// ── 렌더 ────────────────────────────────────────────────

const H_CLASS = [
  "mt-1 font-heading text-[15px] font-semibold",
  "mt-1 font-heading text-[13px] font-semibold",
  "mt-1 text-xs font-semibold",
  "mt-1 text-xs font-semibold text-foreground/80",
  "mt-1 text-xs font-semibold text-muted-foreground",
  "mt-1 text-xs font-semibold text-muted-foreground",
];

function inlineNodes(items: Inline[]): ReactNode[] {
  return items.map((n, i) => {
    switch (n.t) {
      case "strong":
        return createElement("strong", { key: i, className: "font-semibold" }, n.v);
      case "em":
        return createElement("em", { key: i, className: "italic" }, n.v);
      case "code":
        return createElement(
          "code",
          { key: i, className: "rounded bg-muted px-1 font-mono text-[11px]" },
          n.v,
        );
      case "link":
        return createElement(
          "a",
          {
            key: i,
            href: n.href,
            target: "_blank",
            rel: "noopener noreferrer",
            className: "text-primary underline underline-offset-2",
          },
          n.v,
        );
      case "br":
        return createElement("br", { key: i });
      default:
        return n.v;
    }
  });
}

/** 마크다운 본문 → React 엘리먼트 배열 (원시 HTML 해석 없음) */
export function renderMarkdown(src: string): ReactNode[] {
  return parseMarkdown(src).map((node, i) => {
    switch (node.t) {
      case "heading":
        return createElement(
          `h${node.level}`,
          { key: i, className: H_CLASS[node.level - 1] },
          ...inlineNodes(node.children),
        );
      case "code":
        return createElement(
          "pre",
          {
            key: i,
            className:
              "overflow-x-auto rounded border bg-code-bg p-2 font-mono text-[11px] leading-4",
          },
          createElement("code", null, node.text),
        );
      case "list":
        return createElement(
          node.ordered ? "ol" : "ul",
          {
            key: i,
            className: node.ordered
              ? "ml-4 list-decimal space-y-0.5"
              : "ml-4 list-disc space-y-0.5",
          },
          ...node.items.map((item, j) =>
            createElement("li", { key: j }, ...inlineNodes(item)),
          ),
        );
      case "hr":
        return createElement("hr", { key: i, className: "my-2 border-border" });
      default:
        return createElement(
          "p",
          { key: i, className: "text-xs leading-5" },
          ...inlineNodes(node.children),
        );
    }
  });
}

// ── 제목·목차 ────────────────────────────────────────────

const inlineText = (items: Inline[]): string =>
  items.map((n) => (n.t === "br" ? " " : n.v)).join("");

export interface MdHeading {
  level: number;
  text: string;
}

export function markdownHeadings(src: string): MdHeading[] {
  return parseMarkdown(src)
    .filter((n): n is Extract<MdNode, { t: "heading" }> => n.t === "heading")
    .map((n) => ({ level: n.level, text: inlineText(n.children) }));
}

const truncate = (s: string, n = 40): string =>
  s.length > n ? `${s.slice(0, n)}…` : s;

/** 마크다운 블록 제목: 첫 헤딩 → 없으면 첫 비어 있지 않은 줄 */
export function markdownTitle(src: string): string {
  const first = markdownHeadings(src)[0];
  if (first) return truncate(first.text);
  const line = src.split(/\r?\n/).find((l) => l.trim() !== "");
  return line ? truncate(line.trim()) : "";
}

export interface TocEntry {
  key: string;
  blockId: string;
  /** 들여쓰기 단계 (1~6). 마크다운은 헤딩 레벨, 코드는 직전 헤딩 + 1 */
  level: number;
  label: string;
  kind: BlockKind;
  status?: RunStatus;
}

export const anchorLabel = (b: PyBlock): string =>
  formatA1({ r0: b.anchor.r, c0: b.anchor.c, r1: b.anchor.r, c1: b.anchor.c });

/** 계산 순서로 정렬된 블록 → 목차. 코드 블록은 직전 마크다운 헤딩 아래 잎으로 들어간다 */
export function buildToc(ordered: PyBlock[]): TocEntry[] {
  const out: TocEntry[] = [];
  let depth = 0; // 직전 마크다운 헤딩 레벨
  for (const b of ordered) {
    if (b.kind === "markdown") {
      const headings = markdownHeadings(b.markdown ?? "");
      if (headings.length === 0) {
        out.push({
          key: b.id,
          blockId: b.id,
          level: Math.min(depth + 1, 6),
          label: b.title || markdownTitle(b.markdown ?? "") || "(빈 마크다운)",
          kind: "markdown",
        });
        continue;
      }
      headings.forEach((h, i) => {
        out.push({
          key: `${b.id}:${i}`,
          blockId: b.id,
          level: h.level,
          label: h.text || "(제목 없음)",
          kind: "markdown",
        });
        depth = h.level;
      });
      continue;
    }
    out.push({
      key: b.id,
      blockId: b.id,
      level: Math.min(depth + 1, 6),
      label: b.title?.trim() || anchorLabel(b),
      kind: "code",
      status: b.last?.status,
    });
  }
  return out;
}
