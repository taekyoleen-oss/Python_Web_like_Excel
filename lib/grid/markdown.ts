// 마크다운 블록 파서·렌더러 — 의존성 없이 React 엘리먼트를 직접 만든다.
// 원시 HTML을 절대 해석하지 않으므로(dangerouslySetInnerHTML 없음) .pygrid.json 공유가 안전하다.
// 지원: #~###### 헤딩 · **굵게** · *기울임* · `인라인 코드` · ``` 코드 블록 ·
//       -/*/+·1. 목록(중첩) · > 인용 · [텍스트](주소) · --- 구분선 · 문단/줄바꿈.
//       그 밖의 문법은 평문.

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

/** 목록 항목 — 중첩 목록(2칸·탭 들여쓰기)을 자식으로 가질 수 있다 */
export interface MdListItem {
  children: Inline[];
  list?: MdListNode;
}

export interface MdListNode {
  t: "list";
  ordered: boolean;
  items: MdListItem[];
}

export type MdNode =
  | { t: "heading"; level: number; children: Inline[] }
  | { t: "para"; children: Inline[] }
  | { t: "code"; lang: string; text: string }
  | MdListNode
  | { t: "quote"; children: MdNode[] }
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

/** 들여쓰기 폭 — 탭은 2칸으로 센다 */
const indentWidth = (s: string): number => s.replace(/\t/g, "  ").length;

const LIST_RE = /^(\s*)(?:([-*+])|(\d+)[.)])\s+(.*)$/;
const QUOTE_RE = /^\s{0,3}>\s?(.*)$/;

export function parseMarkdown(src: string): MdNode[] {
  const lines = src.split(/\r?\n/);
  const out: MdNode[] = [];
  let para: string[] = [];
  /** 열려 있는 목록들 (들여쓰기 오름차순) — 중첩 목록 구성용 */
  let stack: { indent: number; node: MdListNode }[] = [];

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
  /** 목록 밖의 블록이 시작되면 열린 목록을 닫는다 */
  const closeLists = () => {
    stack = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = /^\s*```(.*)$/.exec(line);
    if (fence) {
      flushPara();
      closeLists();
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
    const quote = QUOTE_RE.exec(line);
    if (quote) {
      flushPara();
      closeLists();
      const body = [quote[1]];
      while (i + 1 < lines.length) {
        const next = QUOTE_RE.exec(lines[i + 1]);
        if (!next) break;
        body.push(next[1]);
        i++;
      }
      out.push({ t: "quote", children: parseMarkdown(body.join("\n")) });
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      closeLists();
      out.push({ t: "heading", level: h[1].length, children: inlineTokens(h[2].trim()) });
      continue;
    }
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushPara();
      closeLists();
      out.push({ t: "hr" });
      continue;
    }
    const li = LIST_RE.exec(line);
    if (li) {
      flushPara();
      const indent = indentWidth(li[1]);
      const ordered = li[3] !== undefined;
      const item: MdListItem = { children: inlineTokens(li[4]) };
      while (stack.length > 0 && stack[stack.length - 1].indent > indent) stack.pop();
      const top = stack[stack.length - 1];
      if (top && top.indent === indent) {
        if (top.node.ordered === ordered) {
          top.node.items.push(item);
          continue;
        }
        stack.pop(); // 같은 깊이에서 종류가 바뀌면 새 목록
      }
      const node: MdListNode = { t: "list", ordered, items: [item] };
      const parent = stack[stack.length - 1];
      if (parent) {
        const last = parent.node.items[parent.node.items.length - 1];
        if (last) last.list = node;
        else parent.node.items.push({ children: [], list: node });
      } else {
        out.push(node);
      }
      stack.push({ indent, node });
      continue;
    }
    closeLists();
    para.push(line);
  }
  flushPara();
  return out;
}

// ── 렌더 ────────────────────────────────────────────────

// h1은 크게, h2부터 뚜렷하게 작아진다 (부록 D.3 — 참고 문서의 제목 대비)
const H_CLASS = [
  "mt-2 font-heading text-[19px] font-bold leading-6",
  "mt-2 font-heading text-[15px] font-semibold leading-5",
  "mt-1 text-[13px] font-semibold",
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

/** 목록(중첩 포함) → ul/ol. 중첩 목록은 상위 li 안에 들어간다 */
function listElement(node: MdListNode, key: number | string): ReactNode {
  return createElement(
    node.ordered ? "ol" : "ul",
    {
      key,
      className: node.ordered
        ? "ml-4 list-decimal space-y-0.5"
        : "ml-4 list-disc space-y-0.5",
    },
    ...node.items.map((item, j) =>
      createElement(
        "li",
        { key: j },
        ...inlineNodes(item.children),
        item.list ? listElement(item.list, "sub") : null,
      ),
    ),
  );
}

function renderNode(node: MdNode, i: number): ReactNode {
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
      return listElement(node, i);
    case "quote":
      return createElement(
        "blockquote",
        {
          key: i,
          className: "my-1 space-y-1 border-l-2 border-border pl-2 text-muted-foreground",
        },
        ...node.children.map((child, j) => renderNode(child, j)),
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
}

/** 마크다운 본문 → React 엘리먼트 배열 (원시 HTML 해석 없음) */
export function renderMarkdown(src: string): ReactNode[] {
  return parseMarkdown(src).map(renderNode);
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
