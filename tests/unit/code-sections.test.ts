// 부록 F.2·F.3 — 코드 섹션 주석 추출·제목 폴백
import { describe, expect, it } from "vitest";
import { codeSections, codeTitle } from "@/lib/grid/code-sections";
import { buildToc } from "@/lib/grid/markdown";
import { snippetInsertCode, WRANGLE_SNIPPET_GROUPS } from "@/lib/reference/wrangleSnippets";
import type { PyBlock } from "@/types/workbook";

describe("codeSections", () => {
  it("마커 우선순위: ── 박스 · ▸ · %% · 단락 첫 # 제목", () => {
    const code = [
      "# ── 데이터 준비 ──", // 0
      "x = 1",
      "",
      "# ▸ 필터", // 3
      "y = 2",
      "",
      "# %% 집계", // 6
      "z = 3",
      "",
      "# 마무리 정리", // 9
      "w = 4",
    ].join("\n");
    expect(codeSections(code)).toEqual([
      { title: "데이터 준비", line: 0 },
      { title: "필터", line: 3 },
      { title: "집계", line: 6 },
      { title: "마무리 정리", line: 9 },
    ]);
  });

  it("단락 규칙: 첫 줄·빈 줄 다음 # 만 섹션, 코드 줄 바로 뒤 주석은 제외", () => {
    const code = "# 첫 줄 제목\nx = 1\n# 중간 주석\n\n# 새 단락 제목\ny = 2";
    expect(codeSections(code)).toEqual([
      { title: "첫 줄 제목", line: 0 },
      { title: "새 단락 제목", line: 4 },
    ]);
  });

  it("▸ 스니펫 삽입 형식: 라벨만 섹션이 되고 설명 줄은 제외", () => {
    const sn = WRANGLE_SNIPPET_GROUPS[0].snippets[0];
    const sections = codeSections(snippetInsertCode(sn));
    expect(sections[0]).toEqual({ title: sn.label, line: 0 });
    // 두 번째 줄(# 설명)은 단락 시작이 아니므로 섹션이 아니다
    expect(sections.find((s) => s.line === 1)).toBeUndefined();
  });

  it("노이즈 제외: shebang·코딩 선언·장식 전용·들여쓴 주석", () => {
    const code = [
      "#!/usr/bin/env python",
      "# -*- coding: utf-8 -*-",
      "# ────────────",
      "def f():",
      "    # 들여쓴 주석",
      "    return 1",
    ].join("\n");
    expect(codeSections(code)).toEqual([]);
  });

  it("연속 중복 제목은 하나만, 제목은 60자 컷", () => {
    const dup = "# ▸ 같은 제목\n# ▸ 같은 제목\nx = 1";
    expect(codeSections(dup)).toEqual([{ title: "같은 제목", line: 0 }]);
    const long = `# ${"a".repeat(80)}`;
    const [sec] = codeSections(long);
    expect(sec.title).toBe(`${"a".repeat(60)}…`);
  });

  it("빈 코드·주석 없는 코드는 빈 목록", () => {
    expect(codeSections("")).toEqual([]);
    expect(codeSections("x = 1\ny = 2")).toEqual([]);
  });
});

describe("codeTitle (제목 폴백, 부록 F.3)", () => {
  it("첫 섹션 제목을 쓴다", () => {
    expect(codeTitle("# ▸ 히스토그램\n# 설명\nplt.hist(x)")).toBe("히스토그램");
  });

  it("섹션이 없으면 첫 # 주석 줄에서 유도", () => {
    expect(codeTitle("x = 1\n# 결과 정리\ny = 2")).toBe("결과 정리");
  });

  it("주석이 없으면 빈 문자열", () => {
    expect(codeTitle("")).toBe("");
    expect(codeTitle("x = 1")).toBe("");
  });

  it("buildToc: 제목 없는 코드 블록은 코드 주석 → 앵커 주소 순으로 폴백", () => {
    const base = {
      sheetId: "s1",
      outputMode: "values",
      includeIndex: "auto",
    } as const;
    const withComment: PyBlock = {
      ...base,
      id: "c1",
      anchor: { r: 0, c: 0 },
      code: "# ▸ 준비\nx = 1",
    };
    const noComment: PyBlock = { ...base, id: "c2", anchor: { r: 2, c: 3 }, code: "y = 2" };
    const titled: PyBlock = {
      ...base,
      id: "c3",
      anchor: { r: 4, c: 0 },
      code: "# ▸ 무시\nz = 3",
      title: "명시 제목",
    };
    expect(buildToc([withComment, noComment, titled]).map((e) => e.label)).toEqual([
      "준비",
      "D3",
      "명시 제목",
    ]);
  });
});
