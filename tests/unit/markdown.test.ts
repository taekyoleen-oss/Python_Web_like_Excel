import { describe, expect, it } from "vitest";
import { isValidElement, type ReactNode } from "react";
import {
  applyMdAction,
  buildToc,
  markdownHeadings,
  markdownTitle,
  parseMarkdown,
  renderMarkdown,
} from "@/lib/grid/markdown";
import type { PyBlock } from "@/types/workbook";

/** 렌더 결과에서 태그 이름과 평문을 모은다 (원시 HTML이 없음을 증명) */
function collect(node: ReactNode, tags: string[] = [], text: string[] = []) {
  if (node === null || node === undefined || typeof node === "boolean") return { tags, text };
  if (Array.isArray(node)) {
    for (const n of node) collect(n, tags, text);
    return { tags, text };
  }
  if (typeof node === "string" || typeof node === "number") {
    text.push(String(node));
    return { tags, text };
  }
  if (isValidElement(node)) {
    tags.push(String(node.type));
    collect((node.props as { children?: ReactNode }).children, tags, text);
  }
  return { tags, text };
}

const render = (src: string) => collect(renderMarkdown(src));

/** 렌더 트리에서 첫 번째 태그의 props를 찾는다 */
function findTag(node: ReactNode, tag: string): Record<string, unknown> | undefined {
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findTag(n, tag);
      if (hit) return hit;
    }
    return undefined;
  }
  if (!isValidElement(node)) return undefined;
  if (node.type === tag) return node.props as Record<string, unknown>;
  return findTag((node.props as { children?: ReactNode }).children, tag);
}

describe("마크다운 파서", () => {
  it("헤딩 1~6 레벨", () => {
    const nodes = parseMarkdown("# 하나\n### 셋\n###### 여섯\n####### 일곱");
    expect(nodes.filter((n) => n.t === "heading").map((n) => n.level)).toEqual([1, 3, 6]);
    expect(markdownHeadings("# 하나\n### 셋")).toEqual([
      { level: 1, text: "하나" },
      { level: 3, text: "셋" },
    ]);
    // #이 7개면 헤딩이 아니라 평문 문단
    expect(nodes.at(-1)).toMatchObject({ t: "para" });
    expect(render("# 제목").tags).toContain("h1");
  });

  it("굵게·기울임·인라인 코드", () => {
    const [para] = parseMarkdown("보통 **굵게** 그리고 *기울임* 과 `코드` 끝");
    expect(para).toMatchObject({ t: "para" });
    expect(para.t === "para" && para.children.map((c) => c.t)).toEqual([
      "text",
      "strong",
      "text",
      "em",
      "text",
      "code",
      "text",
    ]);
    const { tags, text } = render("**굵게** *기울임* `코드`");
    expect(tags).toEqual(expect.arrayContaining(["p", "strong", "em", "code"]));
    expect(text.join("")).toContain("굵게");
  });

  it("코드 펜스 — 내부 문법은 해석하지 않는다", () => {
    const nodes = parseMarkdown("```python\ndf = xl(\"A1\")\n# 주석 **굵게**\n```\n뒤 문단");
    expect(nodes[0]).toEqual({
      t: "code",
      lang: "python",
      text: 'df = xl("A1")\n# 주석 **굵게**',
    });
    expect(nodes[1]).toMatchObject({ t: "para" });
    const { tags, text } = render("```\nraw\n```");
    expect(tags).toEqual(["pre", "code"]);
    expect(text).toEqual(["raw"]);
  });

  it("순서 없는/있는 목록", () => {
    const nodes = parseMarkdown("- 하나\n- 둘\n\n1. 첫째\n2. 둘째\n평문");
    expect(nodes[0]).toMatchObject({ t: "list", ordered: false });
    expect(nodes[0].t === "list" && nodes[0].items).toHaveLength(2);
    expect(nodes[1]).toMatchObject({ t: "list", ordered: true });
    expect(nodes[2]).toMatchObject({ t: "para" });
    const { tags } = render("- 하나\n1. 첫째");
    expect(tags).toEqual(expect.arrayContaining(["ul", "ol", "li"]));
  });

  it("중첩 목록 — 2칸·탭 들여쓰기, 종류가 바뀌면 새 목록", () => {
    const nodes = parseMarkdown("- 하나\n  - 하나-1\n\t- 하나-2\n- 둘");
    expect(nodes).toHaveLength(1);
    const list = nodes[0];
    if (list.t !== "list") throw new Error("목록이 아님");
    expect(list.items).toHaveLength(2);
    const sub = list.items[0].list;
    expect(sub?.items.map((x) => x.children[0])).toEqual([
      { t: "text", v: "하나-1" },
      { t: "text", v: "하나-2" },
    ]);
    expect(list.items[1].list).toBeUndefined();

    // 중첩은 상위 li 안에 들어간다 (ul > li > ul > li)
    const { tags } = render("- 하나\n  1. 안쪽");
    expect(tags).toEqual(["ul", "li", "ol", "li"]);

    // 같은 깊이에서 종류가 바뀌면 형제 목록
    const mixed = parseMarkdown("- 하나\n1. 첫째");
    expect(mixed.map((n) => n.t)).toEqual(["list", "list"]);
  });

  it("인용(>) — 좌측 세로 바 + 안쪽 문법도 해석", () => {
    const nodes = parseMarkdown("> 목차(Context)\n> - 항목\n\n밖 문단");
    expect(nodes[0].t).toBe("quote");
    if (nodes[0].t !== "quote") throw new Error("인용이 아님");
    expect(nodes[0].children.map((n) => n.t)).toEqual(["para", "list"]);
    expect(nodes[1]).toMatchObject({ t: "para" });

    const quote = findTag(renderMarkdown("> 인용문"), "blockquote");
    expect(String(quote?.className)).toContain("border-l-2");
    expect(render("> 인용문").text.join("")).toBe("인용문");
  });

  it("혼합 문서 — 헤딩·인용·중첩 목록·코드가 순서대로", () => {
    const { tags, text } = render(
      "# 제목 🚀\n> 인용\n\n- 하나\n  - 안쪽\n\n```py\nx = 1\n```",
    );
    expect(tags).toEqual([
      "h1",
      "blockquote",
      "p",
      "ul",
      "li",
      "ul",
      "li",
      "pre",
      "code",
    ]);
    expect(text.join("|")).toBe("제목 🚀|인용|하나|안쪽|x = 1"); // 이모지는 평문 그대로
  });

  it("링크 — 새 창 + noopener, 안전하지 않은 주소는 평문", () => {
    const [para] = parseMarkdown("[문서](https://example.com/a) 참고");
    expect(para.t === "para" && para.children[0]).toEqual({
      t: "link",
      v: "문서",
      href: "https://example.com/a",
    });
    const anchor = findTag(renderMarkdown("[문서](https://example.com)"), "a");
    expect(anchor).toMatchObject({
      href: "https://example.com",
      target: "_blank",
      rel: "noopener noreferrer",
    });

    // javascript: 주소는 링크로 만들지 않고 원문 평문으로 남긴다
    const evil = parseMarkdown("[클릭](javascript:alert(1))");
    expect(evil[0]).toEqual({
      t: "para",
      children: [{ t: "text", v: "[클릭](javascript:alert(1))" }],
    });
    expect(render("[클릭](javascript:alert(1))").tags).toEqual(["p"]);
  });

  it("구분선·문단·줄바꿈", () => {
    const nodes = parseMarkdown("첫 줄\n둘째 줄\n\n---\n다음 문단");
    expect(nodes[0].t === "para" && nodes[0].children.map((c) => c.t)).toEqual([
      "text",
      "br",
      "text",
    ]);
    expect(nodes[1]).toEqual({ t: "hr" });
    expect(render("---").tags).toEqual(["hr"]);
  });

  it("지원하지 않는 문법은 평문 — HTML은 절대 해석하지 않는다", () => {
    const src = '<img src=x onerror=alert(1)> <b>굵게</b> > 인용 | 표 |';
    const nodes = parseMarkdown(src);
    expect(nodes).toEqual([{ t: "para", children: [{ t: "text", v: src }] }]);
    const { tags, text } = render(src);
    expect(tags).toEqual(["p"]); // img·b 같은 태그가 생기지 않는다
    expect(text.join("")).toBe(src); // 원문 그대로 보인다
  });

  it("제목 추출: 첫 헤딩 → 없으면 첫 줄", () => {
    expect(markdownTitle("\n\n## 분석 결과\n본문")).toBe("분석 결과");
    expect(markdownTitle("본문만 있음\n둘째 줄")).toBe("본문만 있음");
    expect(markdownTitle("   ")).toBe("");
    expect(markdownTitle(`# ${"가".repeat(50)}`)).toHaveLength(41); // 40자 + …
  });
});

describe("목차 구성", () => {
  const md = (id: string, r: number, markdown: string): PyBlock => ({
    id,
    sheetId: "s1",
    anchor: { r, c: 0 },
    code: "",
    outputMode: "values",
    includeIndex: "auto",
    kind: "markdown",
    markdown,
  });
  const code = (id: string, r: number, extra: Partial<PyBlock> = {}): PyBlock => ({
    id,
    sheetId: "s1",
    anchor: { r, c: 3 },
    code: "1+1",
    outputMode: "values",
    includeIndex: "auto",
    ...extra,
  });

  it("헤딩 계층 + 코드 블록은 직전 헤딩 아래 잎", () => {
    const toc = buildToc([
      md("m1", 0, "# 개요\n## 데이터"),
      code("c1", 1),
      md("m2", 2, "### 결론"),
      code("c2", 3, { title: "요약", last: { status: "error", stdout: "", stderr: "", durationMs: 1, ranAt: "" } }),
    ]);
    expect(toc.map((e) => [e.level, e.label, e.kind])).toEqual([
      [1, "개요", "markdown"],
      [2, "데이터", "markdown"],
      [3, "D2", "code"], // 제목 없으면 앵커 주소
      [3, "결론", "markdown"],
      [4, "요약", "code"],
    ]);
    expect(toc[4].status).toBe("error");
    expect(toc[0].blockId).toBe("m1");
    expect(toc[1].blockId).toBe("m1"); // 같은 블록의 두 번째 헤딩
  });

  it("헤딩 없는 마크다운·빈 목차", () => {
    expect(buildToc([])).toEqual([]);
    const toc = buildToc([md("m1", 0, "그냥 메모"), md("m2", 1, "")]);
    expect(toc.map((e) => [e.level, e.label])).toEqual([
      [1, "그냥 메모"],
      [1, "(빈 마크다운)"],
    ]);
  });
});

describe("이미지 (부록 J.1)", () => {
  it("data:image/*·https: src만 <img>로 렌더", () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    let img = findTag(renderMarkdown(`![차트](${png})`), "img");
    expect(img).toMatchObject({ src: png, alt: "차트" });
    img = findTag(renderMarkdown("![외부](https://example.com/a.png)"), "img");
    expect(img).toMatchObject({ src: "https://example.com/a.png" });
  });

  it("javascript:·data:text/html 등 위험 src는 평문으로", () => {
    for (const src of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "http://insecure.example/a.png",
      "vbscript:x",
    ]) {
      const md = `![x](${src})`;
      const { tags, text } = collect(renderMarkdown(md));
      expect(tags).not.toContain("img");
      expect(text.join("")).toContain(`![x](${src.split(",")[0]}`.slice(0, 10));
    }
  });

  it("이미지 alt는 제목·목차 텍스트에 포함된다", () => {
    expect(markdownTitle("![그림](data:image/png;base64,AA==) 설명")).toContain("그림");
  });
});

describe("applyMdAction (부록 J.1 서식 툴바)", () => {
  it("제목: 현재 줄 접두어 교체 (기존 헤딩 제거 후)", () => {
    expect(applyMdAction("제목입니다", 3, 3, "h2").text).toBe("## 제목입니다");
    expect(applyMdAction("# 제목", 4, 4, "h3").text).toBe("### 제목");
    expect(applyMdAction("첫줄\n둘째줄", 6, 6, "h1").text).toBe("첫줄\n# 둘째줄");
  });

  it("하위 제목: 위 헤딩 +1 단계 (없으면 #, 최하 ###)", () => {
    const r1 = applyMdAction("# 큰제목\n본문", 9, 9, "subheading");
    expect(r1.text).toBe("# 큰제목\n본문\n## ");
    expect(r1.start).toBe(r1.text.length);
    expect(applyMdAction("본문뿐", 1, 1, "subheading").text).toBe("본문뿐\n# ");
    expect(applyMdAction("### 깊음\n글", 9, 9, "subheading").text).toBe("### 깊음\n글\n### ");
  });

  it("굵게·인라인 코드: 선택 감싸기, 빈 선택은 커서를 가운데로", () => {
    const r = applyMdAction("안녕 세상", 3, 5, "bold");
    expect(r.text).toBe("안녕 **세상**");
    expect([r.start, r.end]).toEqual([3, 9]);
    const empty = applyMdAction("ab", 1, 1, "code");
    expect(empty.text).toBe("a``b");
    expect(empty.start).toBe(2);
  });

  it("목록: 선택된 각 줄에 접두어 (번호 목록은 증가)", () => {
    expect(applyMdAction("하나\n둘\n셋", 0, 8, "ul").text).toBe("- 하나\n- 둘\n- 셋");
    expect(applyMdAction("하나\n둘", 0, 4, "ol").text).toBe("1. 하나\n2. 둘");
    // 기존 목록 마커는 교체
    expect(applyMdAction("- 하나", 3, 3, "ol").text).toBe("1. 하나");
  });

  it("구분선: 현재 줄 뒤에 --- 삽입", () => {
    expect(applyMdAction("문단", 1, 1, "hr").text).toBe("문단\n\n---\n");
    expect(applyMdAction("", 0, 0, "hr").text).toBe("\n---\n");
  });
});
