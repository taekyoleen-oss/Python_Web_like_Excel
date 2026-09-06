// 부록 G.1 — 스니펫 자리표시자 감지·치환 (순수).
// 대상: 대표 변수 `df`(식별자 경계 안전), 한국어 열 자리표시자 `"…열"`(따옴표 안 1~8자,
// 예: "그룹열"·"값열" — 이식된 스니펫 데이터에는 현재 없음, 규칙만 유지), `{{range}}`.
// 치환은 이름만 바꾼다 — 로직·구조·문자열 내용은 건드리지 않는다(G.1 원칙).

export type PlaceholderKind = "variable" | "column" | "range";

export interface Placeholder {
  /** 치환 키 — variable: 식별자, column: 따옴표 안 텍스트, range: "{{range}}" */
  token: string;
  kind: PlaceholderKind;
}

/** 감지용 통합 정규식 (CodeMirror 데코레이션과 공유). df는 식별자 경계, .df 속성 제외 */
export const PLACEHOLDER_RE =
  /(?<![A-Za-z0-9_.])df(?![A-Za-z0-9_])|(["'])([가-힣]{1,8}열)\1|\{\{range\}\}/g;

/** 코드에 등장하는 서로 다른 자리표시자(등장 순) */
export function detectPlaceholders(code: string): Placeholder[] {
  const out: Placeholder[] = [];
  const seen = new Set<string>();
  for (const m of code.matchAll(PLACEHOLDER_RE)) {
    const token = m[2] ?? m[0]; // 열 자리표시자는 따옴표 안 텍스트가 키
    if (seen.has(token)) continue;
    seen.add(token);
    out.push({
      token,
      kind: m[2] ? "column" : m[0] === "{{range}}" ? "range" : "variable",
    });
  }
  return out;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * 선택한 치환 적용. map에 없는(또는 빈 값) 토큰은 그대로 둔다.
 * variable: 식별자 경계 치환(`dfx`·`mydf`·`x.df` 미변경) · column: 따옴표 안만 교체 ·
 * range: 리터럴 교체.
 */
export function substitutePlaceholders(
  code: string,
  map: Record<string, string>,
): string {
  let out = code;
  for (const [token, value] of Object.entries(map)) {
    if (!value || value === token) continue;
    if (token === "{{range}}") {
      out = out.split("{{range}}").join(value);
    } else if (/^[가-힣]{1,8}열$/.test(token)) {
      out = out.replace(
        new RegExp(`(["'])${escapeRe(token)}\\1`, "g"),
        (_, q: string) => `${q}${value}${q}`,
      );
    } else {
      out = out.replace(
        new RegExp(`(?<![A-Za-z0-9_.])${escapeRe(token)}(?![A-Za-z0-9_])`, "g"),
        value,
      );
    }
  }
  return out;
}
