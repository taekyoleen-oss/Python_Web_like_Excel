// 부록 G.1 — 자리표시자 감지·치환 (이름만 바꾼다, 로직 불변)
import { describe, expect, it } from "vitest";
import {
  detectPlaceholders,
  substitutePlaceholders,
} from "@/lib/grid/snippet-placeholders";

describe("detectPlaceholders", () => {
  it("df·한국어 열 자리표시자·{{range}}를 종류별로 감지 (중복은 1회)", () => {
    const code = 'x = df["그룹열"]\ny = df.groupby("값열")\nz = {{range}}\ndf.head()';
    expect(detectPlaceholders(code)).toEqual([
      { token: "df", kind: "variable" },
      { token: "그룹열", kind: "column" },
      { token: "값열", kind: "column" },
      { token: "{{range}}", kind: "range" },
    ]);
  });

  it("식별자 경계: dfx·mydf·df2·x.df는 감지하지 않는다", () => {
    expect(detectPlaceholders("dfx = 1\nmydf = 2\ndf2 = 3\nx.df")).toEqual([]);
    // 진짜 df만
    expect(detectPlaceholders("df.head(); (df)")).toEqual([
      { token: "df", kind: "variable" },
    ]);
  });

  it("따옴표 안 한국어 …열 만 열 자리표시자 (일반 문자열·따옴표 없는 텍스트 제외)", () => {
    expect(detectPlaceholders('a = "premium"\n# 그룹열 이라는 말')).toEqual([]);
    expect(detectPlaceholders("b = '행열'")).toEqual([{ token: "행열", kind: "column" }]);
  });
});

describe("substitutePlaceholders", () => {
  it("변수: 경계 안전 치환 — dfx·x.df는 그대로", () => {
    const code = "df = dfx\ny = df.sum()\nz = x.df";
    expect(substitutePlaceholders(code, { df: "policy" })).toBe(
      "policy = dfx\ny = policy.sum()\nz = x.df",
    );
  });

  it("열: 따옴표 종류 보존, 같은 토큰 전부 교체", () => {
    const code = "g = df.groupby(\"그룹열\")['그룹열']";
    expect(substitutePlaceholders(code, { 그룹열: "product" })).toBe(
      "g = df.groupby(\"product\")['product']",
    );
  });

  it("{{range}}: 리터럴 교체", () => {
    expect(substitutePlaceholders("d = {{range}}", { "{{range}}": 'xl("A1:B5")' })).toBe(
      'd = xl("A1:B5")',
    );
  });

  it("map에 없는·빈·동일 값 토큰은 그대로 (치환 안 함)", () => {
    const code = 'df["값열"]';
    expect(substitutePlaceholders(code, {})).toBe(code);
    expect(substitutePlaceholders(code, { df: "", 값열: "값열" })).toBe(code);
  });

  it("이름만 바꾼다 — 로직·다른 문자열은 불변", () => {
    const code = '# df 설명\ndf.query("premium > 0")';
    expect(substitutePlaceholders(code, { df: "pol" })).toBe(
      '# pol 설명\npol.query("premium > 0")',
    );
  });
});
