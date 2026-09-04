/**
 * 분석 트랙(큰 카테고리) — 한 방법 안에 전통 통계와 머신러닝 코드가 섞여 있을 때
 * '공통 적용 / 전통적 분석 / 머신러닝'으로 나눠 각 흐름이 이어지게 한다(사용자 요청 2026-07-30).
 *
 * 섹션에 track이 지정돼 있으면 그대로 쓰고, 없으면 코드에서 쓰는 라이브러리로 판정한다
 * (statsmodels·scipy = 전통적 분석 · scikit-learn = 머신러닝 · 둘 다 없으면 공통).
 * 트랙이 하나뿐인 방법은 화면에 트랙 머리를 띄우지 않는다(불필요한 소음 방지).
 */

export type MethodTrack = "common" | "classic" | "ml";

export const TRACK_ORDER: MethodTrack[] = ["common", "classic", "ml"];

export const TRACK_META: Record<
  MethodTrack,
  { label: string; hint: string; color: "slate" | "violet" | "teal" }
> = {
  common: {
    label: "공통 적용",
    hint: "데이터 로드·변수 설정·시각화 — 아래 두 방식에 공통으로 쓰입니다",
    color: "slate",
  },
  classic: {
    label: "전통적 분석",
    hint: "statsmodels·scipy — 계수·p값·적합도로 '설명'하는 통계 모형",
    color: "violet",
  },
  ml: {
    label: "머신러닝",
    hint: "scikit-learn — 학습·검증으로 '예측' 성능을 높이는 접근",
    color: "teal",
  },
};

// 전통 통계(statsmodels·scipy) 신호
const RE_CLASSIC =
  /\b(statsmodels|smf\.\w+|sm\.(OLS|GLM|Logit|Poisson|families|stats)|ARIMA|acorr_ljungbox|variance_inflation_factor|het_breuschpagan|durbin_watson|wald_test_terms)\b/;
// 머신러닝(scikit-learn) 신호
const RE_ML = /\b(sklearn|make_pipeline|train_test_split|cross_val\w*|GridSearchCV)\b/;
// scipy 검정 — 전통 통계로 본다
const RE_SCIPY = /\b(from scipy|scipy\.stats|stats\.(ttest|chi2|f_oneway|kruskal|shapiro|levene|pearsonr|spearmanr|mannwhitneyu|norm|lognorm|gamma|weibull))/;

/**
 * 섹션 하나의 트랙 — 명시값 우선, 없으면 코드로 판정.
 * 라이브러리 신호가 없으면 fallback(그 방법의 주 트랙)을 따른다 — 예: 군집 방법의
 * '프로파일링' 셀처럼 앞 셀 결과만 쓰는 코드가 '공통'으로 새는 것을 막는다.
 */
export function trackOf(
  s: { code: string; track?: MethodTrack },
  fallback: MethodTrack = "common"
): MethodTrack {
  if (s.track) return s.track;
  const code = s.code;
  // statsmodels 적합이 있으면 sklearn.metrics를 곁들여도 '전통적 분석'
  if (RE_CLASSIC.test(code)) return "classic";
  if (RE_ML.test(code)) return "ml";
  if (RE_SCIPY.test(code)) return "classic";
  return fallback;
}

/**
 * 이 방법의 주 트랙 — 라이브러리 신호가 뚜렷한 섹션들로 정한다.
 * 전통·ML이 섞여 있으면(둘 다 있으면) 신호 없는 섹션은 '공통'으로 둔다.
 */
function mainTrack(sections: { code: string; track?: MethodTrack }[]): MethodTrack {
  const kinds = new Set(
    sections
      .map((s) => (s.track ? s.track : trackOf(s)))
      .filter((t) => t !== "common")
  );
  return kinds.size === 1 ? [...kinds][0] : "common";
}

/** 트랙 순서(공통 → 전통 → 머신러닝)로 안정 정렬 — 각 흐름이 끊기지 않게 모은다 */
export function groupByTrack<T extends { code: string; track?: MethodTrack }>(
  sections: T[]
): T[] {
  const fb = mainTrack(sections);
  return TRACK_ORDER.flatMap((t) => sections.filter((s) => trackOf(s, fb) === t));
}

/**
 * 트랙(공통 → 전통 → ML) · 수준(기본 → 고급) 순으로 재배열 — 각 트랙의 흐름이 이어진다.
 */
export function orderSections<
  T extends { code: string; track?: MethodTrack; level?: "basic" | "advanced" }
>(sections: T[]): T[] {
  const fb = mainTrack(sections);
  return TRACK_ORDER.flatMap((t) => {
    const inTrack = sections.filter((s) => trackOf(s, fb) === t);
    return [
      ...inTrack.filter((s) => (s.level ?? "basic") === "basic"),
      ...inTrack.filter((s) => (s.level ?? "basic") === "advanced"),
    ];
  });
}

/** 트랙 머리를 화면에 표시할지 — 전통/ML 코드가 하나라도 있으면 표시(머신러닝만 있어도 표시) */
export function showTracks(
  sections: { code: string; track?: MethodTrack }[]
): boolean {
  const fb = mainTrack(sections);
  return sections.some((s) => trackOf(s, fb) !== "common");
}

/** 섹션 목록을 화면 표시용 트랙과 함께 — UI가 머리(헤더)를 그릴 때 쓴다 */
export function withTracks<T extends { code: string; track?: MethodTrack }>(
  sections: T[]
): { section: T; track: MethodTrack }[] {
  const fb = mainTrack(sections);
  return sections.map((s) => ({ section: s, track: trackOf(s, fb) }));
}

/** 이 방법에 트랙이 2개 이상인가 — 1개면 화면에 트랙 머리를 띄우지 않는다 */
export function hasMultipleTracks(
  sections: { code: string; track?: MethodTrack }[]
): boolean {
  const fb = mainTrack(sections);
  return new Set(sections.map((s) => trackOf(s, fb))).size > 1;
}
