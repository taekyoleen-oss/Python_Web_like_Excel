// 통계·머신러닝 파이썬 사전 — /datalab 상단 워드클라우드(MethodCloud) 데이터.
// weight(1~5)는 실무 사용 빈도 → 클라우드 글자 크기. 같은 카테고리는 같은 클러스터에 모인다.
// 코드는 pandas·numpy·scipy·statsmodels·scikit-learn 기준, 예제는 보험 실무 데이터 흐름.
// 보험·계리(actuarial) 8종은 파일 비대화를 막기 위해 lib/actuarialMethods.ts로 분리해 스프레드로 합류한다.

import { ACTUARIAL_METHODS } from "./actuarialMethods";
import { STEPWISE_METHODS } from "./stepwiseMethods";
import { withResultSections } from "./modelResultSections";
import type { MethodTrack } from "./methodTracks";

export type MethodCategoryId = "basic" | "model" | "ml" | "actuarial" | "wrangle";

/** 칩 뮤트 팔레트(--chip-*) 한정 스코프 — 카테고리 고정색 */
export type MethodChipColor = "blue" | "violet" | "teal" | "rose" | "amber";

export interface MethodCategory {
  id: MethodCategoryId;
  label: string;
  color: MethodChipColor;
  hint: string;
}

export interface MethodCodeSection {
  /** 코드 블록 제목 — 블록 단위 부분 복사의 기준 */
  title: string;
  /** 블록 앞 설명(선택) */
  desc?: string;
  /**
   * 코드 수준 — 미지정 시 "basic"으로 취급한다.
   * "basic": 하이퍼파라미터·변수를 명시적으로 지정해 탐색 없이 바로 결과를 산출(초보자의 첫 실행 경로).
   * "advanced": 최적화·튜닝(엘보·실루엣·GridSearch)·교차검증·진단·규제 경로·시뮬레이션.
   * 섹션 배열은 기본 → 고급 순으로 둔다.
   */
  level?: "basic" | "advanced";
  /** 분석 트랙(공통/전통적 분석/머신러닝) — 미지정 시 코드로 자동 판정(lib/methodTracks) */
  track?: MethodTrack;
  code: string;
}

/** 주요 파라미터·옵션 해설 한 줄 — 팝업 '주요 파라미터·옵션' 섹션 */
export interface MethodParam {
  name: string;
  desc: string;
}

export interface StatMethod {
  id: string;
  /** 클라우드에 표시되는 한글 이름 */
  name: string;
  en: string;
  category: MethodCategoryId;
  /** 실무 사용 빈도 1~5 — 클수록 글자가 크고 사분면 중심에 가깝다(가로축) */
  weight: 1 | 2 | 3 | 4 | 5;
  /** 체감 난이도 1~5 — 사분면 세로축: 중심선에서 멀수록 어렵다 */
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** 주요 파라미터·옵션 해설 — 팝업 '주요 파라미터·옵션' 섹션 */
  params: MethodParam[];
  /**
   * 웹 실행기(Pyodide) 지원 수준 — 미지정 시 "full".
   * "none": 필요한 패키지가 브라우저에 없어 실행 불가.
   * "partial": 일부 블록만 실행 가능(대체 코드로 우회).
   */
  webSupport?: "full" | "partial" | "none";
  /** 웹 제한 안내 문구(webSupport가 none/partial일 때) */
  webNote?: string;
  /** 한 줄 요약 (툴팁·팝업 서브타이틀) */
  summary: string;
  /** 개념·용도 설명 — "\n\n"으로 문단 구분 */
  intro: string;
  /** 해석·주의 포인트(선택) */
  tips?: string;
  sections: MethodCodeSection[];
}

/** 전체 코드 결합 — 블록 제목을 주석으로 달아 이어붙임(복사·실행기 로드 공용) */
export function methodFullCode(m: StatMethod): string {
  return m.sections
    .map((s) => `# ── ${s.title} ──\n${s.code.trim()}`)
    .join("\n\n\n");
}

// 단계 표식(# ①,# ②,…)으로 시작하는 줄 — 계리 코드의 논리 단계 경계
const STEP_MARK = /^#\s*[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/;

/**
 * 한 코드 블록을 단계(# ①,# ②,…) 앞에 "# %%" 셀 구분자를 넣어 단계별로 나눈다.
 * 파이썬 실행기·주피터·엑셀(=PY())에서 셀/단계 단위로 분리 실행하기 좋게 한다.
 * (첫 단계 앞에는 넣지 않음 — 임포트·준비 줄이 첫 셀에 남도록)
 */
export function stepifyCode(code: string): string {
  const lines = code.split("\n");
  const out: string[] = [];
  let seen = false;
  for (const line of lines) {
    if (STEP_MARK.test(line)) {
      if (seen) out.push("# %%");
      seen = true;
    }
    out.push(line);
  }
  return out.join("\n");
}

/**
 * 최상위(들여쓰기 0) 블록 경계에서 셀 분리 — 빈 줄 다음이 최상위 줄이면 자른다.
 * try/except·for·def 등 들여쓴 블록은 통째로 유지(중간에서 안 잘림 → 실행 안전).
 * 단계 표식(# ①)이 없는 방법의 코드를 데이터 로드·적합·평가 등으로 자연스레 나눈다.
 */
function splitByTopLevelBlanks(code: string): string[] {
  const lines = code.split("\n");
  const cells: string[] = [];
  let cur: string[] = [];
  const flush = () => {
    const t = cur.join("\n").trim();
    if (t) cells.push(t);
    cur = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "" && cur.length > 0) {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === "") j++;
      // 다음 비어있지 않은 줄이 최상위(들여쓰기 없음)면 셀 경계
      if (j < lines.length && !/^\s/.test(lines[j])) {
        flush();
        continue; // 셀 사이 빈 줄은 버린다
      }
    }
    cur.push(line);
  }
  flush();
  return cells;
}

/**
 * 코드를 단계별 셀 목록으로 분리. 우선순위:
 * ① "# %%" 명시 구분자 → ② "# ①" 단계 표식(2개+) → ③ 최상위 빈 줄 경계.
 * 어느 경우든 셀들을 순서대로 실행하면 원본과 동일(변수 공유). 단일 블록이면 [코드] 하나.
 */
export function splitCodeCells(code: string): string[] {
  const text = code.replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  if (/^# ?%%/m.test(text)) {
    return text
      .split(/^# ?%%.*$/m)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const marks = (text.match(new RegExp(STEP_MARK.source, "gm")) || []).length;
  if (marks >= 2) {
    return stepifyCode(text)
      .split(/^# ?%%.*$/m)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return splitByTopLevelBlanks(text);
}

/** 셀 목록 → "# %%" 구분 스크립트(실행기가 동일하게 셀로 분리). */
export function cellsToScript(cells: string[]): string {
  return cells.join("\n\n# %%\n");
}

export const STAT_CATEGORIES: MethodCategory[] = [
  {
    id: "basic",
    label: "기초 통계",
    color: "blue",
    hint: "분포 요약과 가설검정 — 분석의 출발점",
  },
  {
    id: "model",
    label: "회귀·통계모형",
    color: "violet",
    hint: "관계를 수식으로 — 설명과 예측",
  },
  {
    id: "ml",
    label: "머신러닝",
    color: "teal",
    hint: "전통 ML — 지도·비지도 학습과 검증",
  },
  {
    id: "actuarial",
    label: "보험·계리",
    color: "rose",
    hint: "위험률·준비금·요율 — 보험 고유의 계산",
  },
  {
    id: "wrangle",
    label: "데이터 핸들링",
    color: "amber",
    hint: "pandas 기본기 — 선택·결합·집계·변형",
  },
];

const RAW_METHODS: StatMethod[] = [
  /* ───────────────────────── 기초 통계 (basic) ───────────────────────── */
  {
    id: "desc-stats",
    name: "기술통계량",
    en: "Descriptive Statistics",
    category: "basic",
    weight: 5,
    difficulty: 1,
    params: [
      { name: "describe(percentiles=[...])", desc: "기본 25·50·75% 외에 원하는 분위수를 지정합니다. 예: percentiles=[0.1, 0.9, 0.99] — 보험 손해액이면 99% 꼬리 확인에 유용." },
      { name: "describe(include=...)", desc: "기본은 수치형만 요약. 'object'면 문자 열만(고유값·최빈값), 'all'이면 전체 열을 한 표로 요약합니다." },
      { name: "mean(skipna=...) 등 공통 옵션", desc: "통계 메서드 공통으로 결측 제외 여부를 정합니다(기본 True). False면 결측이 하나라도 있으면 결과가 NaN." },
      { name: "quantile(q, interpolation=...)", desc: "분위수 위치가 관측값 사이일 때의 보간 방식 — 'linear'(기본)·'nearest'·'lower'·'higher'. 규제 보고 기준에 따라 맞춥니다." },
      { name: "value_counts(normalize=, dropna=)", desc: "normalize=True면 빈도 대신 비율, dropna=False면 결측도 하나의 범주로 셉니다." },
    ],
    summary: "평균·중앙값·표준편차·분위수로 데이터 분포를 한눈에 요약",
    intro:
      "데이터를 받으면 가장 먼저 수행하는 요약 — 중심·산포·분포 모양을 숫자로 파악합니다.\n\n- 중심: 평균·중앙값 / 산포: 표준편차·분위수 / 모양: 왜도·첨도\n- 전체 그림과 이상치·결측 존재 여부를 첫눈에 확인\n- 손해액처럼 꼬리가 긴 분포는 평균이 대형 사고에 끌려 올라감 — 중앙값·분위수와 함께 해석",
    tips: "- 평균과 중앙값의 차이가 크면 분포가 비대칭(왜도)이라는 신호\n- describe()의 count가 열마다 다르면 결측치 존재 → 결측 처리로 연결",
    sections: [
      {
        title: "기본 요약 — describe()와 개별 통계량",
        desc: "describe() 한 줄로 수치형 열 전체를 요약하고, 필요한 통계량은 개별 메서드로 뽑습니다.",
        level: "basic",
        code: `import pandas as pd

df = pd.read_excel("claims.xlsx")   # 보험금 청구 데이터 예시

# 수치형 전체 요약: 개수·평균·표준편차·최소·사분위수·최대
print(df.describe())
# 범주형(문자) 열 요약: 고유값 수·최빈값
print(df.describe(include="object"))

# 개별 통계량
print(df["claim_amt"].mean())      # 평균
print(df["claim_amt"].median())    # 중앙값 — 꼬리가 긴 분포에서 더 대표적
print(df["claim_amt"].std())       # 표준편차
print(df["claim_amt"].quantile([0.25, 0.5, 0.75, 0.99]))  # 분위수(99% 등 임의 지정)
print(df["claim_amt"].skew())      # 왜도 > 0 이면 오른쪽 꼬리
print(df["claim_amt"].kurt())      # 첨도 — 꼬리의 두꺼움
print(df["product"].value_counts())  # 범주별 빈도`,
      },
      {
        title: "그룹별 요약 — 한 번에 여러 통계량",
        desc: "groupby와 agg를 결합하면 상품군·성별 등 그룹 단위 요약표가 바로 나옵니다.",
        level: "basic",
        code: `# 상품군별 손해액 요약표
summary = df.groupby("product")["claim_amt"].agg(
    건수="count",
    평균="mean",
    중앙값="median",
    표준편차="std",
    최대="max",
)
print(summary.round(1))`,
      },
    ],
  },
  {
    id: "correlation",
    name: "상관분석",
    en: "Correlation",
    category: "basic",
    weight: 4,
    difficulty: 2,
    params: [
      { name: "corr(method=...)", desc: "'pearson'(선형, 기본)·'spearman'(순위 — 이상치 강건)·'kendall'(소표본 안정). 이상치 의심 시 spearman으로 교차 확인." },
      { name: "corr(min_periods=...)", desc: "상관 계산에 필요한 최소 관측쌍 수. 결측이 많은 열에서 관측 몇 개로 계산된 미덥지 않은 상관을 걸러냅니다." },
      { name: "corr(numeric_only=True)", desc: "문자 열이 섞인 DataFrame에서 수치형만 골라 계산합니다." },
      { name: "stats.pearsonr / spearmanr", desc: "p-value가 필요하면 scipy를 씁니다. spearmanr는 nan_policy='omit'으로 결측 제외를 지원합니다." },
    ],
    summary: "두 연속형 변수의 선형(피어슨)·순위(스피어만) 관계 강도를 -1~+1로 측정",
    intro:
      "두 변수가 함께 움직이는 정도를 -1(완전 음)~+1(완전 양) 계수로 요약합니다.\n\n- 피어슨: 선형 관계 / 스피어만: 순위 기반 — 비선형 단조·이상치에 강건\n- 모델링 전 변수 관계 훑기, 설명변수 간 다중공선성 점검의 기본 도구\n- 보험 예: 연령·BMI와 보험료의 연관 강도 확인",
    tips: "- 상관은 인과가 아님 — 산점도를 함께 확인\n- 피어슨은 이상치 몇 개에 크게 흔들림 → 의심되면 스피어만으로 교차 검증",
    sections: [
      {
        title: "상관계수와 상관행렬",
        level: "basic",
        code: `import pandas as pd

df = pd.read_excel("policy.xlsx")

# 두 변수의 상관계수
print(df["age"].corr(df["premium"]))                 # 피어슨(기본)
print(df["age"].corr(df["premium"], method="spearman"))  # 스피어만(순위)

# 수치형 전체 상관행렬
corr = df.select_dtypes("number").corr()
print(corr.round(2))`,
      },
      {
        title: "유의성 검정과 히트맵",
        desc: "scipy로 p-value까지 확인하고, 행렬은 히트맵으로 보면 빠르게 읽힙니다.",
        level: "advanced",
        code: `from scipy import stats
import matplotlib.pyplot as plt

# (연결) 기본 섹션 없이 단독 실행해도 되도록 — df·corr가 없으면 샘플로 즉석 준비
try:
    corr
except NameError:
    import pandas as pd
    df = pd.read_excel("policy.xlsx")
    corr = df.select_dtypes("number").corr()

r, p = stats.pearsonr(df["age"], df["premium"])
print(f"r={r:.3f}, p-value={p:.4f}")   # p < 0.05 이면 상관이 0이라는 가설 기각

plt.figure(figsize=(7, 6))
plt.imshow(corr, cmap="Blues", vmin=-1, vmax=1)
plt.xticks(range(len(corr)), corr.columns, rotation=45)
plt.yticks(range(len(corr)), corr.columns)
plt.colorbar(label="correlation")
plt.tight_layout()
plt.show()`,
      },
    ],
  },
  {
    id: "t-test",
    name: "t-검정",
    en: "t-test",
    category: "basic",
    weight: 4,
    difficulty: 2,
    params: [
      { name: "equal_var (ttest_ind)", desc: "True면 등분산 가정(Student t), False면 Welch t — 두 집단 분산이 같다는 가정이 불필요해 False를 기본으로 권장합니다." },
      { name: "alternative", desc: "'two-sided'(기본, 다르다)·'greater'·'less'(단측 — 방향 가설이 명확할 때). 세 함수(1samp·ind·rel) 공통." },
      { name: "nan_policy", desc: "'propagate'(기본 — 결측 있으면 결과 NaN)·'omit'(결측 제외 후 계산)." },
      { name: "popmean (ttest_1samp)", desc: "일표본 검정의 비교 기준값 — 예: 가정 평균 100만 원." },
      { name: "trim (ttest_ind)", desc: "0~0.5 비율만큼 양끝을 잘라낸 절사 t-검정(Yuen) — 이상치 영향을 완화합니다." },
    ],
    summary: "두 집단(또는 한 집단과 기준값)의 평균 차이가 우연인지 검정",
    intro:
      "평균 차이가 표본의 우연한 흔들림인지 실제 차이인지 판단하는 기본 가설검정입니다.\n\n- 일표본: 한 집단 평균 vs 기준값 / 독립표본: 두 집단 비교 / 대응표본: 같은 대상의 전후\n- 보험 예: 남녀 평균 청구액 차이, 제도 개정 전후 평균 손해율 변화",
    tips: "- 독립 이표본은 equal_var=False(Welch)가 안전 — 등분산 가정 불필요\n- p-value와 함께 평균 차이의 크기(효과 크기)도 반드시 보고",
    sections: [
      {
        title: "일표본·독립 이표본·대응표본",
        level: "basic",
        code: `from scipy import stats
import pandas as pd

df = pd.read_excel("claims.xlsx")

# ① 일표본: 평균 청구액이 100만 원과 다른가?
t, p = stats.ttest_1samp(df["claim_amt"], popmean=1_000_000)
print(f"일표본  t={t:.3f}, p={p:.4f}")

# ② 독립 이표본: 남녀의 평균 청구액이 다른가? (Welch — 등분산 가정 불필요)
male = df.loc[df["sex"] == "M", "claim_amt"]
female = df.loc[df["sex"] == "F", "claim_amt"]
t, p = stats.ttest_ind(male, female, equal_var=False)
print(f"이표본  t={t:.3f}, p={p:.4f}")

# ③ 대응표본: 같은 계약의 개정 전/후 보험료 비교
t, p = stats.ttest_rel(df["prem_before"], df["prem_after"])
print(f"대응    t={t:.3f}, p={p:.4f}")

# p < 0.05 → 유의수준 5%에서 '차이가 없다'는 귀무가설 기각`,
      },
      {
        title: "가정 점검·효과크기 — 정규성·등분산·Cohen's d",
        desc: "t-검정 전 가정을 확인하고, p-value와 함께 효과 크기를 보고합니다.",
        level: "advanced",
        code: `from scipy import stats
import numpy as np

# (연결) 기본 섹션 없이 단독 실행해도 되도록 — male·female이 없으면 샘플로 즉석 준비
try:
    male
except NameError:
    import pandas as pd
    df = pd.read_excel("claims.xlsx")
    male = df.loc[df["sex"] == "M", "claim_amt"]
    female = df.loc[df["sex"] == "F", "claim_amt"]

# ① 정규성(집단별 Shapiro) — p < 0.05 이면 정규 위배(→ Mann-Whitney 대체 고려)
for name, g in [("남", male), ("여", female)]:
    s = g.dropna()
    p = stats.shapiro(s.sample(min(len(s), 5000), random_state=0))[1]
    print(f"{name} 정규성 p = {p:.4f}")

# ② 등분산성(Levene) — p < 0.05 이면 분산이 다름(Welch t가 안전)
lev_p = stats.levene(male.dropna(), female.dropna())[1]
print(f"Levene 등분산 p = {lev_p:.4f}  ({'분산 다름' if lev_p < 0.05 else '등분산 양호'})")

# ③ 효과 크기(Cohen's d) — 0.2 작음·0.5 중간·0.8 큼 (유의성과 별개로 크기 보고)
a, b = male.dropna(), female.dropna()
sp = np.sqrt(((len(a)-1)*a.var(ddof=1) + (len(b)-1)*b.var(ddof=1)) / (len(a)+len(b)-2))
d = (a.mean() - b.mean()) / sp
print(f"Cohen's d = {d:.3f}")`,
      },
    ],
  },
  {
    id: "chi-square",
    name: "카이제곱 검정",
    en: "Chi-square Test",
    category: "basic",
    weight: 3,
    difficulty: 2,
    params: [
      { name: "chi2_contingency(correction=...)", desc: "2×2 표의 Yates 연속성 보정(기본 True). 표본이 충분히 크면 False로 원래 통계량을 씁니다." },
      { name: "chi2_contingency(lambda_=...)", desc: "통계량 계열 선택 — 'log-likelihood'면 G-검정으로 계산합니다." },
      { name: "crosstab(normalize=...)", desc: "'index'(행 기준 %)·'columns'(열 기준 %)·'all'(전체 %) — 해석용 비율표." },
      { name: "crosstab(margins=True)", desc: "행·열 합계(All)를 붙입니다. margins_name으로 이름 변경." },
      { name: "stats.fisher_exact(table)", desc: "기대빈도가 작은 2×2 표의 대안(정확검정) — 카이제곱 근사가 불안할 때." },
    ],
    summary: "두 범주형 변수의 독립성(연관성) 여부를 교차표로 검정",
    intro:
      "범주형 변수 두 개가 서로 관련이 있는지(독립성)를 교차표로 검정합니다.\n\n- 교차표(crosstab)의 관측빈도 vs '독립 가정' 기대빈도 차이를 카이제곱 통계량으로 측정\n- 차이가 클수록 p-value가 작아져 '연관 있음'으로 결론\n- 보험 예: 성별×상품 선택, 연령대×해지 여부의 연관성",
    tips: "- 기대빈도 5 미만 칸이 전체의 20% 이상이면 부정확 — 범주 통합 또는 fisher_exact(2×2)\n- 유의해도 '어떤 칸'이 기여했는지는 기대빈도와의 잔차로 확인",
    sections: [
      {
        title: "교차표 + 독립성 검정",
        level: "basic",
        code: `import pandas as pd
from scipy import stats

df = pd.read_excel("policy.xlsx")

# 연령대 × 해지여부 교차표
table = pd.crosstab(df["age_band"], df["lapsed"])
print(table)

chi2, p, dof, expected = stats.chi2_contingency(table)
print(f"chi2={chi2:.2f}, p={p:.4f}, 자유도={dof}")

# 기대빈도 확인 — 5 미만 칸이 많으면 검정 신뢰도 저하
print(pd.DataFrame(expected, index=table.index, columns=table.columns).round(1))

# 비율로 보면 해석이 쉬움 (행 기준 %)
print(pd.crosstab(df["age_band"], df["lapsed"], normalize="index").round(3))`,
      },
      {
        title: "효과크기 — Cramér's V·조정된 잔차",
        desc: "연관의 세기(Cramér's V)와 기여 칸을 봅니다 — 칸별 판정은 Pearson 아닌 조정된 잔차로 합니다.",
        level: "advanced",
        code: `import numpy as np

# (연결) 기본 섹션 없이 단독 실행해도 되도록 — 교차표·검정 결과가 없으면 즉석 준비
try:
    table
except NameError:
    import pandas as pd
    from scipy import stats
    df = pd.read_excel("policy.xlsx")
    table = pd.crosstab(df["age_band"], df["lapsed"])
    chi2, p, dof, expected = stats.chi2_contingency(table)

# ① Cramér's V — 0(무관)~1(완전연관). 0.1 약함·0.3 중간·0.5 강함
n = table.values.sum()
k = min(table.shape) - 1
cramers_v = np.sqrt(chi2 / (n * k)) if k > 0 else np.nan
print(f"Cramér's V = {cramers_v:.3f}")

# ② Pearson 잔차 — 각 칸의 χ² 기여도(Σ r² = χ²). '진단용'이지 판정 기준이 아니다.
#    귀무가설에서 Var(r_ij) = (1−p_i·)(1−p_·j) < 1 이라 ±2로 판정하면 지나치게
#    보수적이다(실제 발화율이 명목 4.55%보다 훨씬 낮아 주도 칸을 놓친다).
pear_resid = (table.values - expected) / np.sqrt(expected)
print("Pearson 잔차 (χ² 기여도 — 상대 비교용):")
print(pd.DataFrame(pear_resid, index=table.index, columns=table.columns).round(2))

# ③ 조정된 잔차(adjusted residual) — 귀무가설에서 근사적으로 N(0,1).
#    |값| > 2 판정은 '이' 잔차에 적용한다(≈ 유의수준 5%).
row_p = table.values.sum(axis=1, keepdims=True) / n     # 행 비율 p_i·
col_p = table.values.sum(axis=0, keepdims=True) / n     # 열 비율 p_·j
adj_resid = (table.values - expected) / np.sqrt(expected * (1 - row_p) * (1 - col_p))
print("\\n조정된 잔차 (|값| > 2 = 연관을 주도하는 칸):")
print(pd.DataFrame(adj_resid, index=table.index, columns=table.columns).round(2))

# ④ 두 잔차의 배율 확인 — 같은 칸인데 판정이 갈릴 수 있다
print("\\n조정/Pearson 배율:")
print(pd.DataFrame(adj_resid / pear_resid, index=table.index,
                   columns=table.columns).round(2))`,
      },
    ],
  },
  {
    id: "anova",
    name: "분산분석(ANOVA)",
    en: "ANOVA",
    category: "basic",
    weight: 3,
    difficulty: 3,
    params: [
      { name: "anova_lm(typ=...)", desc: "제곱합 방식 1·2·3. 집단 크기가 불균형하거나 요인이 여러 개면 typ=2(또는 3)를 씁니다." },
      { name: "C(변수) — formula 범주 선언", desc: "C(product)처럼 범주형임을 명시. C(x, Treatment(reference='A'))로 기준 범주를 바꿀 수 있습니다." },
      { name: "pairwise_tukeyhsd(alpha=...)", desc: "사후검정 유의수준(기본 0.05). 결과의 reject 열이 True인 쌍이 유의하게 다른 집단." },
      { name: "등분산 깨졌을 때", desc: "anova_oneway(use_var='unequal')(Welch ANOVA) 또는 비모수 Kruskal-Wallis로 대체합니다." },
    ],
    summary: "세 개 이상 집단의 평균이 모두 같은지 한 번에 검정",
    intro:
      "세 개 이상 집단의 평균이 모두 같은지 한 번에 검정합니다.\n\n- t-검정 반복 시 누적되는 1종 오류(우연한 유의)를 F 검정 한 번으로 회피\n- F = 집단 간 분산 ÷ 집단 내 분산 — 클수록 평균 차이가 실재\n- 보험 예: 상품군 A·B·C·D의 평균 손해액, 채널별 평균 유지 기간 비교",
    tips: "- 유의해도 '어느 집단끼리' 다른지는 모름 → 사후검정(Tukey HSD)으로 쌍별 비교\n- 집단별 분산이 크게 다르면 Welch ANOVA·비모수(Kruskal-Wallis) 고려",
    sections: [
      {
        title: "일원 분산분석 — scipy",
        level: "basic",
        code: `from scipy import stats
import pandas as pd

df = pd.read_excel("claims.xlsx")

groups = [g["claim_amt"].values for _, g in df.groupby("product")]
f, p = stats.f_oneway(*groups)
print(f"F={f:.2f}, p={p:.4f}")   # p < 0.05 → 적어도 한 집단의 평균이 다름`,
      },
      {
        title: "분산분석표 + 사후검정(Tukey HSD)",
        desc: "statsmodels로 분산분석표를 만들고, 유의하면 어느 쌍이 다른지 Tukey로 확인합니다.",
        level: "advanced",
        code: `import statsmodels.api as sm
import statsmodels.formula.api as smf
from statsmodels.stats.multicomp import pairwise_tukeyhsd

# (연결) 기본 섹션 없이 단독 실행해도 되도록 — 샘플(claims) 기준으로 df 준비
try:
    df["claim_amt"]
except (NameError, KeyError):
    import pandas as pd
    df = pd.read_excel("claims.xlsx")

model = smf.ols("claim_amt ~ C(product)", data=df).fit()
print(sm.stats.anova_lm(model, typ=2))   # 분산분석표

tukey = pairwise_tukeyhsd(df["claim_amt"], df["product"], alpha=0.05)
print(tukey.summary())   # reject=True 인 쌍이 유의하게 다른 집단`,
      },
      {
        title: "가정 점검·효과크기 — 등분산(Levene)·잔차 정규성·eta²",
        desc: "분산분석의 등분산·정규성 가정을 확인하고 효과 크기를 보고합니다.",
        level: "advanced",
        code: `from scipy import stats
import statsmodels.api as sm

# (연결) 앞 섹션 없이 단독 실행해도 되도록 — groups·model이 없으면 즉석 준비
try:
    groups
    model
except NameError:
    import pandas as pd
    import statsmodels.formula.api as smf
    df = pd.read_excel("claims.xlsx")
    groups = [gr["claim_amt"].values for _, gr in df.groupby("product")]
    model = smf.ols("claim_amt ~ C(product)", data=df).fit()

# ① 등분산성(Levene) — p < 0.05 이면 분산이 달라 비모수(Kruskal) 대안 권장
lev_p = stats.levene(*groups)[1]
print(f"Levene 등분산 p = {lev_p:.4f}  ({'분산 다름' if lev_p < 0.05 else '등분산 양호'})")
if lev_p < 0.05:
    print(f"→ 등분산 위배: Kruskal-Wallis p = {stats.kruskal(*groups)[1]:.4f} (비모수 대안)")

# ② 잔차 정규성(Shapiro) — model은 위 ols 적합
r = model.resid
print(f"잔차 Shapiro p = {stats.shapiro(r.sample(min(len(r), 5000), random_state=0))[1]:.4f}")

# ③ 효과 크기(eta²) — 전체 분산 중 집단이 설명하는 비율. 0.01 작음·0.06 중간·0.14 큼
tbl = sm.stats.anova_lm(model, typ=2)
eta_sq = tbl["sum_sq"].iloc[0] / tbl["sum_sq"].sum()
print(f"eta² = {eta_sq:.3f}")`,
      },
    ],
  },
  {
    id: "normality",
    name: "정규성 검정",
    en: "Normality Test",
    category: "basic",
    weight: 2,
    difficulty: 2,
    params: [
      { name: "shapiro(x)", desc: "소표본(수십~수천)에 적합. 5,000건 초과면 근사 경고가 나므로 표본 추출 후 검정하거나 시각 판단을 병행합니다." },
      { name: "kstest(x, 'norm', args=(m, s))", desc: "Kolmogorov-Smirnov — 비교 분포와 모수(평균·표준편차)를 직접 지정해야 합니다. 지정 없이 표준정규와 비교하는 실수 주의." },
      { name: "anderson(x, dist='norm')", desc: "Anderson-Darling — p-value 대신 유의수준별 임계값 표로 판정하며 꼬리에 민감합니다." },
      { name: "probplot(x, dist=...)", desc: "Q-Q 플롯의 비교 분포 변경 — 'lognorm' 등으로 바꿔 로그정규 적합 여부도 확인할 수 있습니다." },
    ],
    summary: "데이터가 정규분포를 따르는지 검정·시각 확인 — 모수 검정의 전제 점검",
    intro:
      "데이터가 정규분포를 따르는지 검정과 그림으로 점검합니다.\n\n- t-검정·ANOVA·회귀 잔차 등 모수 기법의 전제 확인\n- Shapiro-Wilk: 소표본에 적합한 검정 / Q-Q 플롯: 시각 확인\n- 정규성이 깨지면 로그 변환·비모수로 우회 — 보험 손해액은 대개 로그 변환 후 분석",
    tips: "- 표본 수천 건 이상이면 사소한 편차에도 p-value가 유의 — 대표본은 Q-Q 플롯·히스토그램 등 시각 판단이 실용적",
    sections: [
      {
        title: "Shapiro-Wilk + Q-Q 플롯",
        level: "basic",
        code: `from scipy import stats
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_excel("claims.xlsx")
x = df["claim_amt"].dropna()

stat, p = stats.shapiro(x.sample(min(len(x), 5000), random_state=0))
print(f"Shapiro-Wilk p={p:.4f}")   # p < 0.05 → 정규 아님

fig, axes = plt.subplots(1, 2, figsize=(10, 4))
axes[0].hist(x, bins=50)
axes[0].set_title("histogram")
stats.probplot(x, dist="norm", plot=axes[1])   # 점들이 직선 위면 정규에 가까움
plt.tight_layout()
plt.show()

# 오른쪽 꼬리가 길면 로그 변환 후 재확인
stat, p = stats.shapiro(np.log1p(x).sample(min(len(x), 5000), random_state=0))
print(f"log 변환 후 p={p:.4f}")`,
      },
    ],
  },
  {
    id: "nonparametric",
    name: "비모수 검정",
    en: "Mann-Whitney · Wilcoxon · Kruskal",
    category: "basic",
    weight: 2,
    difficulty: 3,
    params: [
      { name: "alternative", desc: "세 검정 공통 — 'two-sided'(기본)·'greater'·'less' 단측 지정." },
      { name: "mannwhitneyu(method=...)", desc: "p-value 계산 방식 — 'auto'(기본)·'exact'(소표본 정확)·'asymptotic'(대표본 근사)." },
      { name: "wilcoxon(zero_method=...)", desc: "전후 차이가 0인 쌍의 처리 — 'wilcox'(기본, 제외)·'pratt'(순위에 포함) — 동점이 많으면 결과가 달라집니다." },
      { name: "kruskal(nan_policy='omit')", desc: "결측을 제외하고 검정합니다." },
    ],
    summary: "정규성 가정 없이 순위로 집단 차이를 검정 — t-검정·ANOVA의 대체재",
    intro:
      "정규성 가정 없이 원자료 대신 순위(rank)를 사용해 집단 차이를 검정합니다.\n\n- Mann-Whitney U: 독립 두 집단(t-검정 대체) / Wilcoxon 부호순위: 대응 표본 / Kruskal-Wallis: 3집단 이상(ANOVA 대체)\n- 이상치·긴 꼬리에 강건, 소표본에도 적용\n- 보험 예: 손해액처럼 치우친 데이터의 집단 비교",
    tips: "- 검정 대상은 '평균'이 아니라 분포(중앙값) 위치의 차이\n- 보고 시 평균 대신 집단별 중앙값을 함께 제시",
    sections: [
      {
        title: "Mann-Whitney · Wilcoxon · Kruskal-Wallis",
        level: "basic",
        code: `from scipy import stats
import pandas as pd

df = pd.read_excel("claims.xlsx")

# ① 독립 두 집단 (t-검정의 비모수 대체)
male_amt = df.loc[df["sex"] == "M", "claim_amt"]
female_amt = df.loc[df["sex"] == "F", "claim_amt"]
u, p = stats.mannwhitneyu(male_amt, female_amt, alternative="two-sided")
print(f"Mann-Whitney p={p:.4f}")

# ② 대응 표본 (대응 t-검정의 비모수 대체)
w, p = stats.wilcoxon(df["prem_before"], df["prem_after"])
print(f"Wilcoxon p={p:.4f}")

# ③ 세 집단 이상 (ANOVA의 비모수 대체)
groups = [g["claim_amt"].values for _, g in df.groupby("product")]
h, p = stats.kruskal(*groups)
print(f"Kruskal-Wallis p={p:.4f}")

# 보고용: 집단별 중앙값
print(df.groupby("product")["claim_amt"].median())`,
      },
    ],
  },
  {
    id: "distributions",
    name: "분포 적합·난수 생성",
    en: "Distributions · Fitting · Simulation",
    category: "basic",
    weight: 3,
    difficulty: 3,
    params: [
      { name: "stats.<dist>.fit(data, floc=0)", desc: "MLE로 분포 모수 추정 — 반환은 (shape…, loc, scale). floc=0으로 위치를 0에 고정하면 손해액 같은 양의 분포가 안정적으로 적합됩니다." },
      { name: "pdf·cdf·ppf·rvs", desc: "확률밀도·누적확률·분위수·난수 생성. ppf(0.995)=99.5% 분위(꼬리 위험), rvs(size=, random_state=)로 재현 표본." },
      { name: "stats.kstest(x, '<dist>', args=params)", desc: "적합 분포와의 Kolmogorov–Smirnov 적합도 검정 — p가 크면 그 분포로 볼 만합니다(대표본에서는 사소한 차이도 기각)." },
      { name: "np.random.default_rng(seed)", desc: "권장 난수 생성기(Generator) — normal·lognormal·gamma·poisson 등 메서드. seed로 재현성 확보." },
      { name: "rng.choice(a, size, replace=)", desc: "범주 추출·부트스트랩 — replace=True로 복원추출(부트스트랩), p=로 확률 지정." },
    ],
    summary: "주요 분포의 모양·적합(MLE)·적합도와 재현 가능한 난수 생성 — 손해액·건수 모형화의 기초",
    intro:
      "손해액·사고건수 데이터를 이론 분포로 요약(적합)하고 난수로 시뮬레이션합니다.\n\n- 적합: 어떤 분포에 가까운지 그림·검정으로 확인 / 시뮬레이션: 난수로 미래 시나리오·꼬리 위험 실험\n- 심도(손해액): 로그정규·감마·와이블 / 건수: 포아송·음이항\n- 적합 분포는 요율 산출·준비금·재보험 설계의 출발점",
    tips: "- 양의 분포(로그정규·감마)는 floc=0으로 위치 고정해야 안정 적합\n- 대표본 KS 검정은 사소한 차이도 기각 — AIC 비교·Q-Q 플롯 병행\n- 난수는 default_rng(seed)로 재현성 확보",
    sections: [
      {
        title: "주요 분포의 모양 — pdf·pmf 그리기",
        desc: "연속(심도 후보)·이산(건수 후보) 분포의 형태를 눈으로 익힙니다.",
        level: "basic",
        code: `import numpy as np
import matplotlib.pyplot as plt
from scipy import stats

fig, ax = plt.subplots(1, 2, figsize=(11, 4))

# 연속 분포 — 손해심도 후보(오른쪽 꼬리). matplotlib 한글 폰트가 없어 라벨은 영문.
x = np.linspace(0.01, 20, 400)
ax[0].plot(x, stats.norm(8, 2).pdf(x), label="normal(8,2)")
ax[0].plot(x, stats.lognorm(s=0.6, scale=np.exp(2)).pdf(x), label="lognormal")
ax[0].plot(x, stats.gamma(a=2, scale=2).pdf(x), label="gamma(2,2)")
ax[0].plot(x, stats.expon(scale=4).pdf(x), label="expon(scale=4)")
ax[0].set_title("continuous pdf (severity)"); ax[0].legend()

# 이산 분포 — 사고건수 후보
k = np.arange(0, 12)
ax[1].vlines(k, 0, stats.poisson(2).pmf(k), color="C0", label="poisson(2)")
ax[1].vlines(k + 0.25, 0, stats.nbinom(n=3, p=0.5).pmf(k), color="C1", label="nbinom(3,0.5)")
ax[1].set_title("discrete pmf (counts)"); ax[1].legend()
plt.tight_layout(); plt.show()`,
      },
      {
        title: "지정 분포로 적합·난수 생성 — 분포 하나를 골라 바로 산출",
        desc: "후보를 비교하기 전에, 분포를 하나(로그정규) 지정해 MLE로 적합하고 평균·분위수·난수까지 한 번에 뽑아 봅니다.",
        level: "basic",
        code: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy import stats

df = pd.read_excel("claims.xlsx")
x = df["claim_amt"].dropna()
x = x[x > 0]                         # 양수만 — 로그정규의 정의역

# ① 분포를 하나 지정한다: 손해심도의 표준 후보인 로그정규.
#    바꿔볼 만한 값: stats.gamma · stats.weibull_min · stats.expon (아래 코드는 그대로 동작)
DIST = stats.lognorm

# ② MLE(최대가능도추정 — 관측된 데이터가 가장 그럴듯해지는 모수를 찾는 방법)로 적합.
#    floc=0 은 위치를 0에 고정 — 손해액은 0 미만이 없으므로 양의 분포에서 권장.
params = DIST.fit(x, floc=0)
print("추정 모수 (shape…, loc, scale):", np.round(params, 4))

# ③ frozen 분포 = 모수를 고정해 둔 객체. pdf·cdf·ppf·sf·rvs를 바로 쓸 수 있다.
fitted = DIST(*params)
print(f"이론 평균 {fitted.mean():,.0f} · 실제 평균 {x.mean():,.0f}")
print(f"이론 중앙값 {fitted.median():,.0f} · 실제 중앙값 {x.median():,.0f}")
print(f"99.5% 분위(VaR) {fitted.ppf(0.995):,.0f}")

# ④ 적합이 그럴듯한지 간단 확인 — 상위 10% 기준 초과확률을 이론↔실제로 대조
thr = x.quantile(0.9)
print(f"{thr:,.0f}원 초과확률: 이론 {fitted.sf(thr):.3f} · 실제 {(x > thr).mean():.3f}")

# ⑤ 적합 분포에서 난수 생성 — random_state 고정으로 재현 가능
sample = fitted.rvs(size=10_000, random_state=42)
print(f"난수 평균 {sample.mean():,.0f} · 난수 99.5% {np.quantile(sample, 0.995):,.0f}")

# ⑥ 히스토그램 위에 적합 pdf 겹쳐 그리기(한글 폰트가 없어 라벨은 영문)
grid = np.linspace(x.min(), x.quantile(0.99), 300)
plt.figure(figsize=(7, 4))
plt.hist(x, bins=40, density=True, alpha=0.45, label="observed")
plt.plot(grid, fitted.pdf(grid), lw=2, label="fitted lognormal")
plt.xlabel("claim amount"); plt.ylabel("density"); plt.legend()
plt.tight_layout(); plt.show()`,
      },
      {
        title: "데이터에 분포 적합(MLE) + 적합도 비교",
        desc: "여러 후보를 MLE로 적합하고 AIC·KS로 최적 분포를 고릅니다.",
        level: "advanced",
        code: `import numpy as np
import pandas as pd
from scipy import stats

df = pd.read_excel("claims.xlsx")
x = df["claim_amt"].dropna()
x = x[x > 0]                        # 양수만(로그정규·감마 전제)

candidates = ["lognorm", "gamma", "expon", "weibull_min"]
rows = []
for name in candidates:
    dist = getattr(stats, name)
    params = dist.fit(x, floc=0)             # 위치 0 고정
    ll = np.sum(dist.logpdf(x, *params))     # 로그우도
    aic = 2 * len(params) - 2 * ll
    ks_p = stats.kstest(x, name, args=params).pvalue
    rows.append({"분포": name, "AIC": aic, "KS_p": ks_p})

result = pd.DataFrame(rows).sort_values("AIC")   # AIC 작을수록 우수
print(result.to_string(index=False))
print("최적 분포(AIC 최소):", result.iloc[0]["분포"])`,
      },
      {
        title: "난수 생성·시뮬레이션 — 집합손해·부트스트랩",
        desc: "적합 모수로 미래를 시뮬레이션하고, 부트스트랩으로 평균의 불확실성을 잽니다.",
        level: "advanced",
        code: `import numpy as np
import pandas as pd

rng = np.random.default_rng(42)     # 재현 가능한 생성기

# 심도(로그정규)·건수(포아송) → 집합손해 몬테카를로
n_claims = rng.poisson(0.8, size=10_000)
total = np.array([rng.lognormal(13.2, 0.9, k).sum() if k else 0.0
                  for k in n_claims])
print(f"총손해 평균 {total.mean():,.0f} · 99.5%(VaR) {np.quantile(total, 0.995):,.0f}")

# 부트스트랩 — 평균 손해액의 95% 신뢰구간(분포 가정 없이)
df = pd.read_excel("claims.xlsx")
x = df["claim_amt"].dropna().to_numpy()
boot = np.array([rng.choice(x, size=len(x), replace=True).mean()
                 for _ in range(2000)])
lo, hi = np.quantile(boot, [0.025, 0.975])
print(f"평균 95% 부트스트랩 CI = [{lo:,.0f}, {hi:,.0f}]")`,
      },
    ],
  },
  /* ─────────────────────── 회귀·통계모형 (model) ─────────────────────── */
  {
    id: "linear-regression",
    name: "선형회귀",
    en: "Linear Regression",
    category: "model",
    weight: 5,
    difficulty: 2,
    params: [
      { name: "ols(formula) — 식 문법", desc: "C(x) 범주형, np.log(y) 변환, x1:x2(상호작용만)·x1*x2(주효과+상호작용), - 1(절편 제거)까지 식으로 표현합니다." },
      { name: "fit(cov_type='HC3')", desc: "이분산(잔차 깔때기 모양)일 때 강건 표준오차로 p-value를 보정합니다." },
      { name: "conf_int(alpha=...)", desc: "계수 신뢰구간 수준 — 기본 0.05(95%). 보고서 기준에 맞춰 조정." },
      { name: "LinearRegression(fit_intercept=...)", desc: "절편 포함 여부(기본 True). 원점 통과가 이론적으로 맞을 때만 False." },
      { name: "LinearRegression(positive=True)", desc: "계수를 비음수로 제약 — 요율 인자처럼 음수가 비논리적인 경우." },
    ],
    summary: "연속형 목표변수를 설명변수의 선형 결합으로 설명·예측하는 기본 모형",
    intro:
      "연속형 목표를 설명변수의 선형 결합(y = b0 + b1·x1 + …)으로 설명·예측하는 통계 모델링의 출발점입니다.\n\n- 계수·p-value·신뢰구간으로 '무엇이 얼마나 영향을 주는가' 설명\n- 설명 목적=statsmodels(요약표), 예측 파이프라인=scikit-learn\n- 보험 예: 나이·성별·BMI로 보험료 수준 설명",
    tips: "- R²는 설명력이지 인과가 아님 — 해석 전 잔차 플롯(등분산·선형성) 점검\n- 다중공선성은 VIF > 10 주의\n- 변수 척도가 다르면 표준화 후 계수 크기 비교",
    sections: [
      {
        title: "statsmodels — 회귀 요약표 (설명 중심)",
        level: "basic",
        code: `import pandas as pd
import statsmodels.formula.api as smf

df = pd.read_excel("policy.xlsx")

# 보험료 ~ 나이 + 성별(범주) + BMI
model = smf.ols("premium ~ age + C(sex) + bmi", data=df).fit()
print(model.summary())
# 읽는 법:
#  coef      — 다른 변수가 고정일 때 해당 변수 1단위 증가의 효과
#  P>|t|     — 0.05 미만이면 유의
#  [0.025, 0.975] — 계수의 95% 신뢰구간
#  R-squared — 모형이 설명하는 분산 비율`,
      },
      {
        title: "scikit-learn — 학습·예측 (예측 중심)",
        level: "basic",
        code: `from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score
import numpy as np

X = df[["age", "bmi", "dependents"]]
y = df["premium"]
X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)

reg = LinearRegression().fit(X_tr, y_tr)
pred = reg.predict(X_te)

print(dict(zip(X.columns, reg.coef_.round(2))))       # 계수
print(f"RMSE = {np.sqrt(mean_squared_error(y_te, pred)):,.0f}")
print(f"R2   = {r2_score(y_te, pred):.3f}")`,
      },
      {
        title: "잔차 진단",
        desc: "잔차가 0 주위에 무작위로 흩어져 있어야 선형·등분산 가정이 성립합니다.",
        level: "advanced",
        code: `import matplotlib.pyplot as plt

# (연결) 앞 섹션 없이 단독 실행해도 되도록 — 예측값이 없으면 샘플로 즉석 준비
try:
    pred
except NameError:
    import pandas as pd
    from sklearn.linear_model import LinearRegression
    from sklearn.model_selection import train_test_split
    df = pd.read_excel("policy.xlsx")
    X = df[["age", "bmi", "dependents"]]
    y = df["premium"]
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)
    pred = LinearRegression().fit(X_tr, y_tr).predict(X_te)

resid = y_te - pred
plt.scatter(pred, resid, s=8, alpha=0.5)
plt.axhline(0, color="gray", lw=1)
plt.xlabel("predicted")
plt.ylabel("residual")
plt.show()
# 깔때기 모양(분산 증가) → 로그 변환·가중회귀 고려
# 곡선 패턴 → 비선형 항(다항·구간화) 고려`,
      },
      {
        title: "회귀 가정 진단 — 다중공선성·등분산성·자기상관·정규성",
        desc: "계수 해석 전 필수 점검 — statsmodels ols 적합 결과 model과 df를 그대로 사용합니다.",
        level: "advanced",
        code: `import numpy as np
import pandas as pd
import statsmodels.api as sm
from statsmodels.stats.outliers_influence import variance_inflation_factor
from statsmodels.stats.diagnostic import het_breuschpagan
from statsmodels.stats.stattools import durbin_watson
from scipy import stats

# (연결) 앞 섹션 없이 단독 실행해도 되도록 — ols 적합(model)이 없으면 즉석 준비
try:
    model.resid
except (NameError, AttributeError):
    import statsmodels.formula.api as smf
    df = pd.read_excel("policy.xlsx")
    model = smf.ols("premium ~ age + C(sex) + bmi", data=df).fit()

# ① 다중공선성(VIF) — 보통 VIF > 10 이면 공선성 우려(계수·부호 불안정)
num_cols = ["age", "bmi", "dependents"]
Xc = sm.add_constant(df[num_cols].dropna())
vif = pd.DataFrame({
    "변수": Xc.columns,
    "VIF": [variance_inflation_factor(Xc.values, i) for i in range(Xc.shape[1])],
})
print("[VIF]\\n", vif.round(2), "\\n")

# ② 등분산성(Breusch-Pagan) — p < 0.05 이면 이분산(등분산 위배 → 강건 표준오차)
bp_stat, bp_p, _, _ = het_breuschpagan(model.resid, model.model.exog)
print(f"Breusch-Pagan p = {bp_p:.4f}  ({'이분산 의심' if bp_p < 0.05 else '등분산 양호'})")

# ③ 자기상관(Durbin-Watson) — 2 근처면 무자기상관(1.5~2.5 양호)
print(f"Durbin-Watson  = {durbin_watson(model.resid):.3f}")

# ④ 잔차 정규성(Shapiro) — p < 0.05 이면 정규 위배
r = model.resid
sh_p = stats.shapiro(r.sample(min(len(r), 5000), random_state=0))[1]
print(f"잔차 Shapiro p = {sh_p:.4f}  ({'정규 아님' if sh_p < 0.05 else '정규 양호'})")`,
      },
      {
        title: "규제·제약 옵션 — Ridge/Lasso(특정 alpha)·비음수·절편",
        desc: "선형회귀에 규제·제약 조건을 걸어 산출합니다 — 규제는 특정 alpha 직접 지정 가능.",
        level: "advanced",
        code: `from sklearn.linear_model import LinearRegression, Ridge, Lasso
from sklearn.model_selection import train_test_split
import pandas as pd

# (연결) 앞 섹션 없이 단독 실행해도 되도록 — df가 없으면 샘플로 즉석 준비
try:
    df["premium"]
except (NameError, KeyError):
    df = pd.read_excel("policy.xlsx")

X = df[["age", "bmi", "dependents"]]
y = df["premium"]
X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)

# ① 규제(penalty) — 계수 크기에 벌점. alpha↑ 이면 계수를 더 강하게 수축(과적합·공선성 완화)
ridge = Ridge(alpha=5.0).fit(X_tr, y_tr)     # L2: 고르게 축소
lasso = Lasso(alpha=0.1).fit(X_tr, y_tr)     # L1: 일부 계수 0(변수 선택)

# ② 비음수 제약 — 계수 ≥ 0 (요율 인자처럼 음수가 비논리적일 때)
nonneg = LinearRegression(positive=True).fit(X_tr, y_tr)

# ③ 절편 제거 — 원점 통과가 이론적으로 맞을 때만
no_int = LinearRegression(fit_intercept=False).fit(X_tr, y_tr)

for name, m in [("Ridge(5)", ridge), ("Lasso(0.1)", lasso), ("비음수", nonneg)]:
    print(name, dict(zip(X.columns, m.coef_.round(2))))
# 규제 강도(alpha)는 값에 민감하니 척도가 다르면 StandardScaler로 표준화 후 비교하세요.`,
      },
      {
        title: "시뮬레이션(난수 생성) — 합성데이터·부트스트랩·몬테카를로",
        desc: "알려진 계수로 데이터를 만들어 추정 절차를 검증하고, 재표집으로 불확실성을 잽니다. (샘플 없이 바로 실행)",
        level: "advanced",
        code: `import numpy as np
import pandas as pd
import statsmodels.formula.api as smf

rng = np.random.default_rng(0)
n = 500

# ① 참 계수(β=100, 2, -5)로 합성 데이터 생성 → 추정이 계수를 복원하는지 검증
sim = pd.DataFrame({"x1": rng.normal(50, 10, n), "x2": rng.normal(0, 1, n)})
sim["y"] = 100 + 2.0 * sim["x1"] - 5.0 * sim["x2"] + rng.normal(0, 8, n)
fit = smf.ols("y ~ x1 + x2", data=sim).fit()
print("추정 계수:", fit.params.round(2).to_dict())   # 100·2·-5 근처면 절차가 건전

# ② 부트스트랩 — 계수의 95% 신뢰구간(분포 가정 없이 재표집)
coefs = np.array([
    smf.ols("y ~ x1 + x2", data=sim.sample(n, replace=True)).fit().params.values
    for _ in range(500)
])
print("x1 계수 95% CI =", np.round(np.quantile(coefs[:, 1], [0.025, 0.975]), 3))

# ③ 몬테카를로 예측구간 — 잔차를 재표집해 예측 불확실성 반영
mu = fit.predict(pd.DataFrame({"x1": [55], "x2": [0.5]})).iloc[0]
draws = mu + rng.choice(fit.resid.to_numpy(), 10_000, replace=True)
print(f"예측 {mu:,.1f} · 90% 구간 [{np.quantile(draws, 0.05):,.1f}, {np.quantile(draws, 0.95):,.1f}]")`,
      },
    ],
  },
  {
    id: "logistic-regression",
    name: "로지스틱 회귀",
    en: "Logistic Regression",
    category: "model",
    weight: 5,
    difficulty: 3,
    params: [
      { name: "C", desc: "규제 강도의 역수(기본 1.0) — 작을수록 규제가 강해 계수가 줄어듭니다. 과적합이면 낮추고, 과소적합이면 높입니다." },
      { name: "penalty", desc: "'l2'(기본)·'l1'(계수 일부를 0으로 — 변수 선택)·'elasticnet'·None. solver와 짝이 맞아야 합니다('l1'은 liblinear/saga)." },
      { name: "class_weight", desc: "'balanced'면 클래스 빈도 역수로 가중 — 해지 5%처럼 불균형할 때 소수 클래스를 놓치지 않게 합니다." },
      { name: "solver / max_iter", desc: "'lbfgs'(기본)·'liblinear'(소규모)·'saga'(대규모·L1). 수렴 경고가 나면 max_iter를 1000 이상으로." },
      { name: "statsmodels .fit(disp=0)", desc: "최적화 로그 출력을 숨깁니다. 요약표는 summary()로." },
    ],
    summary: "이진 결과(해지/유지, 사고/무사고)의 확률을 모형화 — 오즈비로 해석",
    intro:
      "이진 결과(0/1)가 일어날 확률을 모형화하는 분류의 기본 모형입니다.\n\n- 오즈비 exp(계수): 변수 1단위 증가 시 사건의 오즈가 몇 배가 되는지\n- 출력이 확률이라 임계값(기본 0.5)을 업무 비용에 맞게 조정 가능\n- 보험 예: 해지 예측·사고 발생·언더라이팅 승인",
    tips: "- 불균형(해지 5% 등)이면 accuracy 무의미 — ROC-AUC·재현율로 평가, class_weight='balanced' 고려\n- 오즈비는 '확률이 몇 배'가 아니라 '오즈가 몇 배'임에 주의",
    sections: [
      {
        title: "statsmodels — 오즈비 해석",
        level: "basic",
        code: `import numpy as np
import statsmodels.formula.api as smf

# 목표변수는 0/1 이어야 합니다(불리언이면 변환 — statsmodels formula 요구).
# 원본 df는 건드리지 않고 사본에서 변환.
d = df.assign(lapsed=df["lapsed"].astype(int))

model = smf.logit("lapsed ~ age + premium_ratio + C(channel)", data=d).fit()
print(model.summary())

# 오즈비: exp(coef) — 1보다 크면 해지 위험 증가 요인
odds = np.exp(model.params)
conf = np.exp(model.conf_int())
print(pd.concat([odds.rename("OR"), conf], axis=1).round(3))`,
      },
      {
        title: "scikit-learn — 학습·확률 예측·평가",
        level: "basic",
        code: `from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, classification_report

X = df[["age", "premium_ratio", "tenure_months"]]
y = df["lapsed"]
X_tr, X_te, y_tr, y_te = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42
)

clf = LogisticRegression(max_iter=1000, class_weight="balanced")
clf.fit(X_tr, y_tr)

proba = clf.predict_proba(X_te)[:, 1]        # 해지 확률
print(f"ROC-AUC = {roc_auc_score(y_te, proba):.3f}")

# 업무 비용에 맞춰 임계값 조정 (기본 0.5 대신 0.3 등)
pred = (proba >= 0.3).astype(int)
print(classification_report(y_te, pred))`,
      },
      {
        title: "진단·성능 — 다중공선성(VIF)·의사결정계수·분류 지표",
        desc: "설명변수 공선성과 모형 적합도·분류 성능을 함께 점검합니다.",
        level: "advanced",
        code: `import numpy as np
import pandas as pd
import statsmodels.api as sm
from statsmodels.stats.outliers_influence import variance_inflation_factor
from sklearn.metrics import (confusion_matrix, accuracy_score,
                             roc_auc_score, average_precision_score)

# (연결) 앞 섹션 없이 단독 실행해도 되도록 — model(logit)·proba가 없으면 즉석 준비
try:
    model.prsquared
    proba
except (NameError, AttributeError):
    import statsmodels.formula.api as smf
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import train_test_split
    df = pd.read_excel("policy.xlsx")
    d = df.assign(lapsed=df["lapsed"].astype(int))
    model = smf.logit("lapsed ~ age + premium_ratio + C(channel)", data=d).fit(disp=0)
    X = df[["age", "premium_ratio", "tenure_months"]]
    y = df["lapsed"].astype(int)
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42)
    proba = LogisticRegression(max_iter=1000).fit(X_tr, y_tr).predict_proba(X_te)[:, 1]

# ① 다중공선성(VIF) — 설명변수끼리 상관이 높으면 오즈비 해석 불안정
feats = ["age", "premium_ratio", "tenure_months"]
Xc = sm.add_constant(df[feats].dropna())
vif = [variance_inflation_factor(Xc.values, i) for i in range(Xc.shape[1])]
print("[VIF]", dict(zip(Xc.columns, np.round(vif, 2))))

# ② McFadden 유사결정계수(pseudo R²) — 0.2~0.4면 양호(선형회귀 R²보다 낮게 나옴)
print(f"McFadden pseudo R2 = {model.prsquared:.3f}")

# ③ 분류 성능 — 정확도·ROC-AUC·PR-AUC·혼동행렬(임계값 0.5)
pred05 = (proba >= 0.5).astype(int)
print(f"정확도    = {accuracy_score(y_te, pred05):.3f}")
print(f"ROC-AUC   = {roc_auc_score(y_te, proba):.3f}")
print(f"PR-AUC    = {average_precision_score(y_te, proba):.3f}  (불균형에 민감)")
print("혼동행렬\\n", confusion_matrix(y_te, pred05))`,
      },
      {
        title: "ROC 곡선·분류 결과 시각화 — PCA 2축 투영",
        desc: "판별력(ROC 곡선·AUC)과 분류 결과를 그림으로 확인합니다. 특성이 3개라 결과는 PCA로 2차원에 압축해 예측 클래스·오분류를 눈으로 봅니다.",
        level: "advanced",
        code: `import numpy as np
import matplotlib.pyplot as plt
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.decomposition import PCA
from sklearn.metrics import roc_curve, auc

# (연결) df(policy 샘플)가 없으면 read_excel 폴백 — 단독 실행 가능
try:
    df
except NameError:
    import pandas as pd
    df = pd.read_excel("policy.xlsx")

feats = ["age", "premium_ratio", "tenure_months"]
X = df[feats].astype(float)
y = df["lapsed"].astype(int)
X_tr, X_te, y_tr, y_te = train_test_split(
    X, y, test_size=0.3, stratify=y, random_state=42)

clf = LogisticRegression(max_iter=1000, class_weight="balanced").fit(X_tr, y_tr)
proba = clf.predict_proba(X_te)[:, 1]        # 해지 확률
pred = (proba >= 0.5).astype(int)            # 0.5 기준 예측 클래스

# ① ROC 곡선 — 참양성률(TPR) vs 거짓양성률(FPR). AUC가 1에 가까울수록 판별력↑
fpr, tpr, _ = roc_curve(y_te, proba)
roc_auc = auc(fpr, tpr)

# ② 분류 결과 — 특성 3개를 PCA로 2차원 압축해 예측 클래스·오분류를 눈으로 확인
pca = PCA(n_components=2).fit(X_tr)
Z = pca.transform(X_te)
yte = y_te.to_numpy()
correct = pred == yte                         # 맞춘 표본 마스크

fig, ax = plt.subplots(1, 2, figsize=(11, 4.5))
ax[0].plot(fpr, tpr, color="#3E6AE1", lw=2, label=f"ROC (AUC={roc_auc:.3f})")
ax[0].plot([0, 1], [0, 1], "--", color="#94A3B8", label="random")
ax[0].set_xlabel("FPR"); ax[0].set_ylabel("TPR")
ax[0].set_title("ROC curve"); ax[0].legend(loc="lower right")

sc = ax[1].scatter(Z[correct, 0], Z[correct, 1], c=pred[correct],
                   cmap="coolwarm", s=16, alpha=0.75)
ax[1].scatter(Z[~correct, 0], Z[~correct, 1], marker="x", c="black",
              s=32, linewidths=1.2, label="misclassified")
ax[1].set_xlabel("PC1"); ax[1].set_ylabel("PC2")
ax[1].set_title("prediction on PCA 2D"); ax[1].legend(loc="best")
fig.colorbar(sc, ax=ax[1], label="predicted class")
plt.tight_layout(); plt.show()`,
      },
      {
        title: "규제 조건 — penalty(l1/l2/elasticnet)·C로 강도 지정",
        desc: "기본 L2 규제에서 penalty·C를 바꿔 각각 산출합니다 — C는 규제 강도의 역수(작을수록 강함).",
        level: "advanced",
        code: `from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split

# (연결) 앞 섹션 없이 단독 실행해도 되도록 — df가 없으면 샘플로 즉석 준비
try:
    df["lapsed"]
except (NameError, KeyError):
    import pandas as pd
    df = pd.read_excel("policy.xlsx")

X = df[["age", "premium_ratio", "tenure_months"]]
y = df["lapsed"].astype(int)
X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2,
                                          stratify=y, random_state=42)

variants = {
    "L2, C=1":     LogisticRegression(penalty="l2", C=1.0, max_iter=1000),
    "L2, C=0.05":  LogisticRegression(penalty="l2", C=0.05, max_iter=1000),      # 강한 규제
    "L1, C=0.5":   LogisticRegression(penalty="l1", C=0.5, solver="liblinear"),   # 변수 선택
    "ElasticNet":  LogisticRegression(penalty="elasticnet", C=0.5, l1_ratio=0.5,
                                      solver="saga", max_iter=5000),
}
for name, clf in variants.items():
    clf.fit(X_tr, y_tr)
    nz = int((clf.coef_[0] != 0).sum())
    print(f"{name}: 0아닌 계수 {nz}개, test 정확도 {clf.score(X_te, y_te):.3f}")

# statsmodels로 L1 규제 적합 — 변수 선택 + 오즈비 해석
import statsmodels.formula.api as smf
import numpy as np
d = df.assign(lapsed=df["lapsed"].astype(int))
reg = smf.logit("lapsed ~ age + premium_ratio + tenure_months",
                data=d).fit_regularized(alpha=0.1, disp=0)   # alpha=벌점 강도
print("규제 오즈비:", np.exp(reg.params).round(3).to_dict())`,
      },
      {
        title: "시뮬레이션(난수 생성) — 로짓으로 이진결과 생성·오즈비 복원",
        desc: "참 계수로 0/1 결과를 시뮬레이션해 로지스틱이 오즈비를 복원하는지 검증합니다. (샘플 없이 바로 실행)",
        level: "advanced",
        code: `import numpy as np
import pandas as pd
import statsmodels.formula.api as smf

rng = np.random.default_rng(1)
n = 2000

# 참 계수로 로짓 → 확률 → 베르누이(0/1) 생성
d = pd.DataFrame({"age": rng.normal(45, 12, n), "ratio": rng.normal(0.3, 0.1, n)})
lin = -3 + 0.04 * d["age"] + 2.0 * d["ratio"]
prob = 1 / (1 + np.exp(-lin))
d["lapsed"] = (rng.random(n) < prob).astype(int)

m = smf.logit("lapsed ~ age + ratio", data=d).fit(disp=0)
print("추정 계수:", m.params.round(3).to_dict())      # -3·0.04·2.0 근처
print("오즈비:", np.exp(m.params).round(3).to_dict())

# 부트스트랩으로 오즈비 신뢰구간
ors = [np.exp(smf.logit("lapsed ~ age + ratio",
        data=d.sample(n, replace=True)).fit(disp=0).params["age"])
       for _ in range(300)]
print("age 오즈비 95% CI =", np.round(np.quantile(ors, [0.025, 0.975]), 3))`,
      },
    ],
  },
  /* 전통적 변수선택(전진·후진·stepwise) 2종 — lib/stepwiseMethods.ts */
  ...STEPWISE_METHODS,
  {
    id: "glm",
    name: "일반화선형모형(GLM)",
    en: "GLM — Poisson · NegBinom · Gamma",
    category: "model",
    weight: 3,
    difficulty: 4,
    params: [
      { name: "family", desc: "목표변수 분포 — Poisson(건수)·NegativeBinomial(과산포, 분산=μ+α·μ²)·Gamma(심도)·Binomial(비율)·Tweedie(순보험료)." },
      { name: "link", desc: "링크함수. Gamma의 기본은 inverse이므로 요율 승수 해석을 원하면 link=Log()를 명시해야 합니다." },
      { name: "offset / exposure", desc: "노출 반영 — offset=np.log(exposure) 또는 exposure=... (내부에서 log 적용, 계수 1 고정). 노출이 다른 계약을 섞을 때 필수." },
      { name: "var_weights / freq_weights", desc: "관측 가중 — 심도 모형에서 건수 가중, 집계 데이터 사용 시 빈도 가중." },
      { name: "fit(scale='X2')", desc: "과산포 보정(quasi-Poisson) — 분산이 평균보다 클 때 표준오차를 부풀려 과신을 막습니다. 대안: 음이항 family." },
    ],
    summary: "빈도(포아송·과산포 시 음이항)·심도(감마) 등 정규 아닌 분포를 링크함수로 모형화 — 보험료 산출의 표준",
    intro:
      "목표변수의 분포(포아송·감마 등)와 링크함수를 명시해 선형회귀를 확장한 모형 — 보험요율 산출의 표준입니다.\n\n- 사고 건수=포아송, 사고 금액=감마(모두 로그 링크)로 빈도×심도 요율 산출\n- 로그 링크에서 exp(계수)=승수(relativity) — 요율 상대도를 바로 획득\n- 노출이 다른 계약은 offset=log(exposure)로 반영",
    tips: "- 노출(경과 계약년수)이 다르면 offset=log(exposure) 필수\n- 포아송에서 분산>평균(과산포)이면 음이항 또는 quasi-Poisson 고려",
    sections: [
      {
        title: "사고빈도 — 포아송 GLM (노출 offset)",
        level: "basic",
        code: `import numpy as np
import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf

# 예시용 합성 경험데이터 g(seed 42) — 실제로는 내 데이터로 바꾸세요.
# 필요한 열: 등급 요인(연령대·지역·차종) + exposure(경과 계약년수) + n_claims(사고 건수)
rng = np.random.default_rng(42)
n = 3000
g = pd.DataFrame({
    "age_band": rng.choice(["20대", "30대", "40대", "50대+"], n, p=[.2, .3, .3, .2]),
    "region":   rng.choice(["수도권", "광역시", "기타"], n, p=[.5, .3, .2]),
    "car_type": rng.choice(["소형", "중형", "대형"], n, p=[.4, .4, .2]),
    "exposure": rng.uniform(0.3, 1.0, n).round(3),
})
lam = (g["age_band"].map({"20대": .25, "30대": .15, "40대": .12, "50대+": .18})
       * np.where(g["car_type"] == "대형", 1.5, 1.0) * g["exposure"])
g["n_claims"] = rng.poisson(lam)
g["claim_amt"] = np.where(g["n_claims"] > 0,
                          rng.lognormal(13, .8, n) * g["n_claims"], 0).round()

# 포아송 GLM — 노출(exposure)은 log-offset으로
freq = smf.glm(
    "n_claims ~ C(age_band) + C(region) + C(car_type)",
    data=g,
    family=sm.families.Poisson(),
    offset=np.log(g["exposure"]),
).fit()
print(freq.summary())

# 요율 상대도(relativity): exp(coef)
print(np.exp(freq.params).round(3))
# 예: age_band[30대] = 0.62 → 기준(20대) 대비 빈도 0.62배`,
      },
      {
        title: "사고심도 — 감마 GLM",
        level: "basic",
        code: `# 사고가 난 건만 대상으로 평균 사고금액 모형화 — ① 섹션의 g·freq를 이어서 사용
sev_df = g[g["n_claims"] > 0].copy()
sev_df["avg_claim"] = sev_df["claim_amt"] / sev_df["n_claims"]

sev = smf.glm(
    "avg_claim ~ C(age_band) + C(car_type)",
    data=sev_df,
    family=sm.families.Gamma(link=sm.families.links.Log()),
).fit()
print(np.exp(sev.params).round(3))

# 순보험료 = 빈도 예측 × 심도 예측
g["pure_premium"] = freq.predict(g) / g["exposure"] * sev.predict(g)
print(g["pure_premium"].describe().round(0))`,
      },
      {
        title: "적합도 진단 — 과산포·이탈도",
        desc: "포아송 모형(freq)의 과산포 여부와 적합도를 점검합니다.",
        level: "advanced",
        code: `import numpy as np
import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf

# (연결) 앞 섹션 없이 단독 실행해도 되도록 — freq(포아송 GLM)가 없으면 즉석 준비
try:
    freq
except NameError:
    rng = np.random.default_rng(42)
    n = 3000
    g = pd.DataFrame({
        "age_band": rng.choice(["20대", "30대", "40대", "50대+"], n, p=[.2, .3, .3, .2]),
        "region":   rng.choice(["수도권", "광역시", "기타"], n, p=[.5, .3, .2]),
        "car_type": rng.choice(["소형", "중형", "대형"], n, p=[.4, .4, .2]),
        "exposure": rng.uniform(0.3, 1.0, n).round(3),
    })
    lam = (g["age_band"].map({"20대": .25, "30대": .15, "40대": .12, "50대+": .18})
           * np.where(g["car_type"] == "대형", 1.5, 1.0) * g["exposure"])
    g["n_claims"] = rng.poisson(lam)
    freq = smf.glm("n_claims ~ C(age_band) + C(region) + C(car_type)", data=g,
                   family=sm.families.Poisson(), offset=np.log(g["exposure"])).fit()

# ① 과산포(overdispersion): Pearson chi2 / 자유도 ≈ 1이 이상.
#    1보다 크게 벗어나면 과산포 → 음이항 또는 fit(scale='X2')로 표준오차 보정
pearson_chi2 = freq.pearson_chi2
dof = freq.df_resid
print(f"Pearson chi2/df = {pearson_chi2 / dof:.3f}  (>1.2 면 과산포 의심)")

# ② 이탈도 기반 적합도: Deviance/df, 유사결정계수
print(f"Deviance/df     = {freq.deviance / dof:.3f}")
print(f"pseudo R2(dev)  = {1 - freq.deviance / freq.null_deviance:.3f}")
print(f"AIC = {freq.aic:.1f}   BIC = {freq.bic:.1f}")

# ③ 과산포가 크면 표준오차를 보정해 재적합(quasi-Poisson)
freq_qp = freq.model.fit(scale="X2")
print("\\n[quasi-Poisson 보정 후 p-value 일부]")
print(freq_qp.pvalues.round(4).head())`,
      },
      {
        title: "과산포 건수 — 음이항 GLM (NB2)",
        desc: "과산포(분산>평균) 건수는 음이항(분산=μ+α·μ²)으로 — 우도 기반이라 AIC 비교 가능.",
        level: "advanced",
        code: `import numpy as np
import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf

# (연결) 앞 섹션 없이 단독 실행해도 되도록 — 예시 경험데이터 g가 없으면 즉석 합성
try:
    g
except NameError:
    rng = np.random.default_rng(42)
    n = 3000
    g = pd.DataFrame({
        "age_band": rng.choice(["20대", "30대", "40대", "50대+"], n, p=[.2, .3, .3, .2]),
        "region":   rng.choice(["수도권", "광역시", "기타"], n, p=[.5, .3, .2]),
        "car_type": rng.choice(["소형", "중형", "대형"], n, p=[.4, .4, .2]),
        "exposure": rng.uniform(0.3, 1.0, n).round(3),
    })
    lam = (g["age_band"].map({"20대": .25, "30대": .15, "40대": .12, "50대+": .18})
           * np.where(g["car_type"] == "대형", 1.5, 1.0) * g["exposure"])
    g["n_claims"] = rng.poisson(lam)

# ① α(과산포 파라미터)를 함께 MLE로 추정 — discrete 음이항(NB2)
nb = smf.negativebinomial(
    "n_claims ~ C(age_band) + C(region) + C(car_type)",
    data=g,
    offset=np.log(g["exposure"]),
).fit()
print(nb.summary())
alpha_hat = float(nb.params["alpha"])    # 0에 가까우면 사실상 포아송, 크면 과산포 강함
print(f"추정 과산포 alpha = {alpha_hat:.4f}")

# 요율 상대도 — alpha는 분산 파라미터라 상대도 해석에서 제외
relativity = np.exp(nb.params.drop("alpha"))
print(relativity.round(3))

# ② 같은 α를 GLM 프레임에 넣어 적합(요율 산출 파이프라인을 GLM으로 통일할 때)
nb_glm = smf.glm(
    "n_claims ~ C(age_band) + C(region) + C(car_type)",
    data=g,
    family=sm.families.NegativeBinomial(alpha=max(alpha_hat, 1e-6)),
    offset=np.log(g["exposure"]),
).fit()
print(np.exp(nb_glm.params).round(3))

# ③ 포아송 대비 개선 확인 — AIC가 작아지면 음이항 채택 근거
pois = smf.glm(
    "n_claims ~ C(age_band) + C(region) + C(car_type)",
    data=g, family=sm.families.Poisson(),
    offset=np.log(g["exposure"]),
).fit()
print(f"AIC  Poisson={pois.aic:.1f}   NegBinom={nb.aic:.1f}")`,
      },
      {
        title: "규제 GLM — fit_regularized(alpha·L1_wt)",
        desc: "변수 많은 GLM에 규제로 과적합·불안정 계수를 억제합니다 — alpha=벌점 강도, L1_wt=L1 비중(1=Lasso식).",
        level: "advanced",
        code: `import numpy as np
import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf

# (연결) 앞 섹션 없이 단독 실행해도 되도록 — 예시 경험데이터 g가 없으면 즉석 합성
try:
    g
except NameError:
    rng = np.random.default_rng(42)
    n = 3000
    g = pd.DataFrame({
        "age_band": rng.choice(["20대", "30대", "40대", "50대+"], n, p=[.2, .3, .3, .2]),
        "region":   rng.choice(["수도권", "광역시", "기타"], n, p=[.5, .3, .2]),
        "car_type": rng.choice(["소형", "중형", "대형"], n, p=[.4, .4, .2]),
        "exposure": rng.uniform(0.3, 1.0, n).round(3),
    })
    lam = (g["age_band"].map({"20대": .25, "30대": .15, "40대": .12, "50대+": .18})
           * np.where(g["car_type"] == "대형", 1.5, 1.0) * g["exposure"])
    g["n_claims"] = rng.poisson(lam)

# 포아송 빈도 GLM을 규제 적합 — 상관 높은 요인이 많을 때 상대도 안정화
freq_reg = smf.glm(
    "n_claims ~ C(age_band) + C(region) + C(car_type)",
    data=g,
    family=sm.families.Poisson(),
    offset=np.log(g["exposure"]),
).fit_regularized(alpha=0.05, L1_wt=1.0)   # L1_wt=1 → Lasso식 변수선택
print(np.exp(freq_reg.params).round(3))    # 상대도(규제로 1=중립 쪽으로 수축)

# alpha를 키우면 계수가 더 강하게 0/1(중립)로 수축 → 편향↑·분산↓`,
      },
      {
        title: "관측 vs 예측 시각화 — 등급별 빈도·요율 상대도",
        desc: "적합한 GLM이 데이터를 얼마나 재현하는지(등급별 관측·예측 사고건수)와 요율 상대도 exp(계수)를 그림으로 확인합니다.",
        level: "advanced",
        code: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import statsmodels.api as sm
import statsmodels.formula.api as smf

# (연결) 앞 ①·② 섹션의 g·freq가 있으면 아래 준비 블록(--- 준비 끝 ---)을 지우세요
rng = np.random.default_rng(42)
n = 3000
g = pd.DataFrame({
    "age_band": rng.choice(["20대", "30대", "40대", "50대+"], n, p=[.2, .3, .3, .2]),
    "region":   rng.choice(["수도권", "광역시", "기타"], n, p=[.5, .3, .2]),
    "car_type": rng.choice(["소형", "중형", "대형"], n, p=[.4, .4, .2]),
    "exposure": rng.uniform(0.3, 1.0, n).round(3),
})
lam = (g["age_band"].map({"20대": .25, "30대": .15, "40대": .12, "50대+": .18})
       * np.where(g["car_type"] == "대형", 1.5, 1.0) * g["exposure"])
g["n_claims"] = rng.poisson(lam)
freq = smf.glm("n_claims ~ C(age_band) + C(region) + C(car_type)", data=g,
               family=sm.families.Poisson(), offset=np.log(g["exposure"])).fit()
# --- 준비 끝 ---

g["pred"] = freq.predict(g, offset=np.log(g["exposure"]))   # 노출 반영 예측 건수(관측과 같은 기준)

# ① 관측 vs 예측 — 연령대별 평균 사고건수를 나란히(모형이 데이터를 재현하는지)
order = ["20대", "30대", "40대", "50대+"]
byband = g.groupby("age_band")[["n_claims", "pred"]].mean().reindex(order)

# ② 요율 상대도 — exp(계수), 기준등급 대비 승수(1이면 기준과 동일)
rel = np.exp(freq.params.filter(like="age_band"))
rel_labels = [s.split("[T.")[-1].rstrip("]") for s in rel.index]

fig, ax = plt.subplots(1, 2, figsize=(11, 4.2))
xpos = np.arange(len(byband))
ax[0].bar(xpos - 0.2, byband["n_claims"], width=0.4, color="#3E6AE1", label="observed")
ax[0].bar(xpos + 0.2, byband["pred"], width=0.4, color="#B4531F", label="predicted")
ax[0].set_xticks(xpos); ax[0].set_xticklabels(order)
ax[0].set_ylabel("mean claims"); ax[0].legend()
ax[0].set_title("observed vs predicted (by age band)")

ax[1].barh(range(len(rel)), rel.values, color="#3E6AE1")
ax[1].set_yticks(range(len(rel))); ax[1].set_yticklabels(rel_labels)
ax[1].axvline(1, ls="--", color="#94A3B8")     # 1 = 기준등급(20대)
ax[1].set_xlabel("relativity  exp(coef)"); ax[1].set_title("age-band relativity")
plt.tight_layout(); plt.show()`,
      },
    ],
  },
  {
    id: "regularized",
    name: "Ridge·Lasso",
    en: "Regularized Regression",
    category: "model",
    weight: 3,
    difficulty: 3,
    params: [
      { name: "alpha", desc: "벌점 강도 — 클수록 계수가 강하게 줄어듭니다. RidgeCV·LassoCV에 후보 목록(np.logspace)을 주면 교차검증으로 자동 선택." },
      { name: "l1_ratio (ElasticNet)", desc: "L1 비중 — 0이면 Ridge, 1이면 Lasso. 상관 높은 변수 그룹을 함께 남기고 싶으면 0.2~0.5." },
      { name: "max_iter / tol", desc: "Lasso 수렴 실패 경고 시 max_iter를 10000 이상으로 늘리거나 tol을 완화합니다." },
      { name: "cv", desc: "교차검증 폴드 수(기본 5). 시계열 데이터면 TimeSeriesSplit 객체를 전달." },
      { name: "positive=True (Lasso)", desc: "계수 비음수 제약." },
    ],
    summary: "계수에 벌점을 줘 과적합을 억제 — Lasso는 변수 선택까지 수행",
    intro:
      "계수 크기에 벌점(penalty)을 부과해 과적합을 억제하는 회귀입니다.\n\n- Ridge(L2): 계수를 고르게 축소 / Lasso(L1): 일부 계수를 0으로 — 변수 선택\n- alpha는 교차검증으로 선택, 학습 전 표준화(StandardScaler) 사실상 필수\n- 보험 예: 상관 높은 요율 인자가 많을 때 계수 안정화",
    tips: "- Lasso의 0 계수는 '중요하지 않다'가 아니라 '상관 그룹 중 하나만 남김'일 수 있음\n- 상관 그룹 전체를 유지하려면 ElasticNet(L1+L2 혼합)",
    sections: [
      {
        title: "특정 alpha로 각각 산출 — Ridge·Lasso·ElasticNet",
        desc: "규제 강도(alpha)를 직접 지정해 각 모델을 바로 산출 — 값을 바꿔 편향·분산 절충 비교.",
        level: "basic",
        code: `from sklearn.linear_model import Ridge, Lasso, ElasticNet
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
import pandas as pd

df = pd.read_excel("policy.xlsx")

# ① 사용할 변수를 직접 지정 — 규제 모형은 결측을 받지 못하므로 결측 행 제외(또는 대체)
feats = ["age", "bmi", "dependents", "income", "tenure_months", "n_contracts"]
d = df[feats + ["premium"]].dropna()
X, y = d[feats], d["premium"]
X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)

# ② alpha를 조건으로 고정한 여러 모델(표준화는 규제의 전제)
#    시작값은 Ridge 1·Lasso 0.1 — 0.01~100을 훑으며 수축 정도를 비교해 보세요.
#    (적정 alpha는 y 스케일에 좌우됩니다. 보험료처럼 값이 크면 alpha도 크게 잡아야 효과가 보입니다.)
models = {
    "Ridge(α=1)":   make_pipeline(StandardScaler(), Ridge(alpha=1.0)),
    "Ridge(α=10)":  make_pipeline(StandardScaler(), Ridge(alpha=10.0)),
    "Lasso(α=0.1)": make_pipeline(StandardScaler(), Lasso(alpha=0.1, max_iter=10000)),
    "Lasso(α=1)":   make_pipeline(StandardScaler(), Lasso(alpha=1.0, max_iter=10000)),
    "ElasticNet(α=0.1,l1=0.5)":
        make_pipeline(StandardScaler(), ElasticNet(alpha=0.1, l1_ratio=0.5, max_iter=10000)),
}
for name, m in models.items():
    m.fit(X_tr, y_tr)
    coef = pd.Series(m[-1].coef_, index=X_tr.columns)
    print(f"{name:26s} R²(test)={m.score(X_te, y_te):.3f}  0계수={int((coef == 0).sum())}개")
# alpha↑ → 계수 수축 강화(Lasso는 0 증가). 각 모델의 계수는 m[-1].coef_ 로 확인.

# ▶ 아래 '공통 평가·그래프' 섹션이 그대로 이어받도록 대표 모델을 하나 지정
model = models["Lasso(α=0.1)"]        # 다른 모델로 바꿔도 됩니다`,
      },
      {
        title: "표준화 파이프라인 + 교차검증으로 alpha 선택",
        desc: "alpha를 교차검증으로 탐색합니다 — 기본 섹션에서 만든 X_tr·y_tr을 그대로 사용.",
        level: "advanced",
        code: `from sklearn.linear_model import RidgeCV, LassoCV
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import numpy as np
import pandas as pd

# (연결) ① 섹션을 건너뛰고 이 섹션부터 실행해도 되도록 — 분할이 없으면 즉석 준비
try:
    X_tr
except NameError:
    df = pd.read_excel("policy.xlsx")
    feats = ["age", "bmi", "dependents", "income", "tenure_months", "n_contracts"]
    d = df[feats + ["premium"]].dropna()
    X, y = d[feats], d["premium"]
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)

alphas = np.logspace(-3, 3, 50)

ridge = make_pipeline(StandardScaler(), RidgeCV(alphas=alphas, cv=5))
lasso = make_pipeline(StandardScaler(), LassoCV(alphas=alphas, cv=5, max_iter=10000))
ridge.fit(X_tr, y_tr)
lasso.fit(X_tr, y_tr)

print("ridge alpha =", ridge[-1].alpha_)
print("lasso alpha =", lasso[-1].alpha_)

# Lasso 변수 선택 결과 — 계수 0이 아닌 변수만
coef = pd.Series(lasso[-1].coef_, index=X_tr.columns)
print(coef[coef != 0].sort_values(key=abs, ascending=False).round(3))
print(f"제외된 변수 수: {(coef == 0).sum()}")

# ▶ 공통 평가·그래프 섹션이 이어받도록 — CV가 고른 Lasso를 대표 모델로
model = lasso`,
      },
      {
        title: "공통 평가·그래프 — ①(지정)·②(탐색) 어느 경로든 이어서",
        desc: "두 경로 모두 공통 변수 model로 끝나므로, 이 섹션은 어느 쪽 뒤에 실행해도 에러 없이 이어집니다.",
        level: "basic",
        code: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.metrics import mean_squared_error, r2_score

# (연결) 앞 섹션 없이 이 섹션만 실행해도 되도록 — model이 없으면 기본 Lasso로 즉석 준비
try:
    model, X_te
except NameError:
    from sklearn.linear_model import Lasso
    from sklearn.model_selection import train_test_split
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    df = pd.read_excel("policy.xlsx")
    feats = ["age", "bmi", "dependents", "income", "tenure_months", "n_contracts"]
    d = df[feats + ["premium"]].dropna()
    X, y = d[feats], d["premium"]
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)
    model = make_pipeline(StandardScaler(), Lasso(alpha=0.1, max_iter=10000)).fit(X_tr, y_tr)

# ① 시험셋 성능 — 지정·탐색 어느 경로든 같은 잣대로 평가
pred = model.predict(X_te)
print(f"R²(test) = {r2_score(y_te, pred):.3f}")
print(f"RMSE     = {np.sqrt(mean_squared_error(y_te, pred)):,.0f}")

# ② 그래프 — 예측 vs 실측(45° 근처면 양호) + 표준화 계수(0 = Lasso가 제외한 변수)
fig, ax = plt.subplots(1, 2, figsize=(11, 4))
ax[0].scatter(y_te, pred, s=10, alpha=0.5)
lim = [min(y_te.min(), pred.min()), max(y_te.max(), pred.max())]
ax[0].plot(lim, lim, color="gray", lw=1)
ax[0].set_xlabel("actual"); ax[0].set_ylabel("predicted")
ax[0].set_title("prediction vs actual")

coef = pd.Series(model[-1].coef_, index=X_te.columns).sort_values()
ax[1].barh(coef.index, coef.values, color="#3E6AE1")
ax[1].axvline(0, color="gray", lw=1)
ax[1].set_title("standardized coefficients")
plt.tight_layout(); plt.show()`,
      },
    ],
  },
  {
    id: "time-series",
    name: "시계열 분석",
    en: "Time Series — ARIMA",
    category: "model",
    weight: 2,
    difficulty: 4,
    params: [
      { name: "order=(p, d, q)", desc: "자기회귀 차수 p·차분 횟수 d·이동평균 차수 q. ACF/PACF 그림 또는 pmdarima.auto_arima로 선택합니다." },
      { name: "seasonal_order=(P, D, Q, s)", desc: "계절 성분 차수와 주기 s — 월별 데이터는 s=12, 분기는 s=4." },
      { name: "seasonal_decompose(model=...)", desc: "'additive'(변동 폭 일정)·'multiplicative'(수준에 비례해 진폭 증가 — 매출·보험료 수입에 흔함)." },
      { name: "trend", desc: "'n'(없음)·'c'(상수)·'t'(선형 추세) — 차분 후 드리프트 포함 여부." },
      { name: "get_forecast(steps).summary_frame(alpha=...)", desc: "예측 평균과 (1-alpha) 예측구간을 표로 — 기본 95%." },
    ],
    summary: "추세·계절성을 분해하고 ARIMA로 미래 값을 예측",
    intro:
      "시간 순서가 있는 데이터를 추세·계절성으로 분해하고 ARIMA로 예측합니다.\n\n- 분해(decompose)로 추세·계절성·잔차를 먼저 눈으로 확인\n- ARIMA(p, d, q)=자기회귀+차분+이동평균 — 차수는 ACF/PACF 또는 auto_arima\n- 보험 예: 월별 보험료 수입·청구 건수 12개월 예측",
    tips: "- 무작위 분할 금지 — 학습=과거, 검증=미래로 시간 순서 유지\n- 예측구간이 먼 기간일수록 넓어지는 것은 정상(장기 예측의 불확실성)",
    sections: [
      {
        title: "분해 + ARIMA 적합·예측",
        desc: "차수 (p, d, q)를 직접 지정해 적합·예측합니다 — 월별 출발점은 (1, 1, 1)+계절(1, 1, 1, 12).",
        level: "basic",
        code: `import numpy as np
import pandas as pd
from statsmodels.tsa.seasonal import seasonal_decompose
from statsmodels.tsa.arima.model import ARIMA

# 내 파일이 있으면 읽고, 없거나 읽지 못하면 합성 월별 시계열(추세+계절)로 대체 —
# 웹 실행기·로컬 어디서든 바로 실행됩니다(실제 분석은 파일명·열 이름만 바꾸세요).
try:
    ts = (
        pd.read_excel("monthly_claims.xlsx", parse_dates=["month"])
        .set_index("month")["n_claims"]
        .asfreq("MS")
    )
except Exception:
    rng = np.random.default_rng(7)
    idx = pd.date_range("2021-01", periods=60, freq="MS")
    base = 800 + np.arange(60) * 4 + 120 * np.sin(2 * np.pi * np.arange(60) / 12)
    ts = pd.Series((base + rng.normal(0, 40, 60)).round(), index=idx, name="n_claims")
    print("monthly_claims.xlsx 없음 → 합성 시계열(60개월)로 진행")

# ① 추세·계절성 분해
seasonal_decompose(ts, model="additive").plot()

# ② ARIMA 적합 — (p, d, q) = (자기회귀, 차분, 이동평균) 차수
model = ARIMA(ts, order=(1, 1, 1),
              seasonal_order=(1, 1, 1, 12)).fit()   # 월별 계절성 12
print(model.summary())

# ③ 12개월 예측 + 95% 예측구간
fc = model.get_forecast(steps=12)
out = fc.summary_frame()          # mean, mean_ci_lower, mean_ci_upper
print(out.round(1))`,
      },
      {
        title: "차수 탐색·모형 비교 — AIC 격자·시간순 검증",
        desc: "후보 차수를 AIC로 훑어 고릅니다 — 기본 섹션에서 만든 ts를 그대로 사용.",
        level: "advanced",
        code: `import itertools
import numpy as np
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA

# (연결) 기본 섹션 없이 단독 실행해도 되도록 — ts가 없으면 파일→합성 순으로 준비
try:
    ts
except NameError:
    try:
        ts = (
            pd.read_excel("monthly_claims.xlsx", parse_dates=["month"])
            .set_index("month")["n_claims"]
            .asfreq("MS")
        )
    except Exception:
        rng = np.random.default_rng(7)
        idx = pd.date_range("2021-01", periods=60, freq="MS")
        base = 800 + np.arange(60) * 4 + 120 * np.sin(2 * np.pi * np.arange(60) / 12)
        ts = pd.Series((base + rng.normal(0, 40, 60)).round(), index=idx, name="n_claims")

# ① (p, d, q) 후보를 격자로 훑어 AIC 최소 조합 탐색
#    범위를 넓히면 오래 걸리니 p·q는 0~2, d는 0~1에서 시작합니다.
rows = []
for p, d, q in itertools.product(range(3), range(2), range(3)):
    try:
        res = ARIMA(ts, order=(p, d, q)).fit()
        rows.append({"order": (p, d, q), "AIC": res.aic, "BIC": res.bic})
    except Exception:
        continue                      # 수렴 실패 조합은 건너뜁니다

grid = pd.DataFrame(rows).sort_values("AIC").reset_index(drop=True)
print(grid.head(5).round(1))
best = tuple(grid.loc[0, "order"])
print("AIC 최소 차수:", best)   # ΔAIC 2 이내는 사실상 동급 → 더 단순한 차수를 택하세요

# ② 시간순 검증 — 마지막 12개월을 미래로 남겨 예측 오차 비교(무작위 분할 금지)
train, test = ts.iloc[:-12], ts.iloc[-12:]
for order in [(1, 1, 1), best]:
    fc = ARIMA(train, order=order).fit().get_forecast(steps=len(test)).predicted_mean
    rmse = float(np.sqrt(np.mean((test.to_numpy() - fc.to_numpy()) ** 2)))
    mape = float(np.mean(np.abs((test.to_numpy() - fc.to_numpy()) / test.to_numpy())) * 100)
    print(f"order={order}  RMSE={rmse:,.1f}  MAPE={mape:.1f}%")
# AIC 순위와 실제 예측오차 순위는 다를 수 있습니다 — 최종 차수는 시간순 검증 결과로 정하세요.`,
      },
    ],
  },
  {
    id: "survival",
    name: "생존분석",
    en: "Survival — Kaplan-Meier · Cox",
    category: "model",
    weight: 2,
    difficulty: 5,
    webSupport: "none",
    webNote:
      "lifelines 패키지가 브라우저 실행기에 포함되어 있지 않아 웹에서는 실행되지 않습니다. 로컬 파이썬(pip install lifelines)에서 이용하세요.",
    params: [
      { name: "fit(durations, event_observed)", desc: "KM 공통 입력 — 관찰 기간과 사건 지표(1=사건 발생, 0=중도절단). 절단을 1로 잘못 코딩하면 결과가 완전히 왜곡됩니다." },
      { name: "CoxPHFitter(penalizer=...)", desc: "0.01~0.1의 소량 규제 — 변수가 많거나 수렴이 불안정할 때 안정화." },
      { name: "fit(..., strata=[...])", desc: "비례위험 가정이 깨진 변수를 층화 처리 — 계수는 추정하지 않되 기저위험을 층별로 분리합니다." },
      { name: "check_assumptions(df, p_value_threshold=...)", desc: "비례위험 가정 진단 — 위반 변수와 처방(층화·시간상호작용)을 제안해 줍니다." },
      { name: "predict_survival_function(X)", desc: "개별 계약의 시점별 생존(유지) 확률 곡선 예측." },
    ],
    summary: "'언제 사건이 일어나는가'를 분석 — 해지·사망·부도까지의 시간, 중도절단 처리",
    intro:
      "사건(해지·사망)이 일어나기까지의 시간을 분석하며, 중도절단(censoring) 계약을 버리지 않고 활용합니다.\n\n- Kaplan-Meier: 시점별 생존(유지)율 곡선\n- Cox 비례위험: 요인별 위험비(hazard ratio) 추정\n- 보험 예: 계약 해지율·사망률·재가입 행동 분석",
    tips: "- exp(coef)=위험비 — 1.3이면 해지 위험을 30% 높인다는 뜻\n- 비례위험 가정(위험비가 시간에 일정)은 check_assumptions로 점검\n- 설치: pip install lifelines",
    sections: [
      {
        title: "Kaplan-Meier 유지율 곡선",
        desc: "모수 추정 없이 관측만으로 시점별 유지율을 그립니다 — 생존분석의 첫 결과.",
        level: "basic",
        code: `from lifelines import KaplanMeierFitter
import matplotlib.pyplot as plt

# duration: 관찰 기간(월), event: 1=해지 발생, 0=관찰 종료(중도절단)
kmf = KaplanMeierFitter()

ax = plt.subplot()
for channel, g in df.groupby("channel"):
    kmf.fit(g["duration"], g["event"], label=channel)
    kmf.plot_survival_function(ax=ax)
plt.xlabel("경과월")
plt.ylabel("유지율")
plt.show()

print(kmf.median_survival_time_)   # 유지율이 50%가 되는 시점`,
      },
      {
        title: "Cox 비례위험 모형 — 해지 요인 분석",
        desc: "설명변수를 직접 지정해 적합하고 위험비(HR)를 읽습니다.",
        level: "basic",
        code: `from lifelines import CoxPHFitter

cox = CoxPHFitter()
cox.fit(
    df[["duration", "event", "age", "premium_ratio", "has_rider"]],
    duration_col="duration",
    event_col="event",
)
cox.print_summary()   # exp(coef) = 위험비(HR)
# 읽는 법: exp(coef)=1.3 → 해당 요인이 해지 위험을 30% 높임(1보다 작으면 낮춤)`,
      },
      {
        title: "가정 진단·층화·규제 — 비례위험 점검과 모형 비교",
        desc: "기본 섹션의 cox 적합 결과를 받아 가정을 점검하고, 위반 시 처방(층화)·안정화(규제)를 비교합니다.",
        level: "advanced",
        code: `from lifelines import CoxPHFitter

cols = ["duration", "event", "age", "premium_ratio", "has_rider"]

# ① 비례위험 가정 점검 — 위반 변수와 처방(층화·시간 상호작용)을 함께 안내합니다
cox.check_assumptions(df[cols], p_value_threshold=0.05, show_plots=False)

# ② 가정이 깨진 변수(또는 기저위험이 다른 집단)는 층화 — 계수는 추정하지 않고 기저위험만 분리
cox_st = CoxPHFitter().fit(df[cols + ["channel"]], duration_col="duration",
                           event_col="event", strata=["channel"])
print("[층화 Cox]\\n", cox_st.summary[["exp(coef)", "p"]].round(3))

# ③ 소량 규제(penalizer) — 변수가 많거나 수렴이 불안정할 때 계수를 안정화(0.01~0.1)
cox_pen = CoxPHFitter(penalizer=0.1).fit(df[cols], duration_col="duration", event_col="event")

# ④ 모형 비교 — C-index(0.5=무작위, 1=완벽)가 크고 AIC가 작을수록 좋습니다
for name, m in [("기본", cox), ("층화(channel)", cox_st), ("penalizer=0.1", cox_pen)]:
    print(f"{name:14s} C-index={m.concordance_index_:.3f}  logL={m.log_likelihood_:,.1f}")
print(f"AIC(부분우도): 기본 {cox.AIC_partial_:,.1f} vs 규제 {cox_pen.AIC_partial_:,.1f}")
# 층화 모형은 부분우도의 기준이 달라져 AIC를 다른 모형과 직접 비교하면 안 됩니다 — C-index로 보세요.`,
      },
    ],
  },
  {
    id: "loss-functions",
    name: "손실함수·비용민감 학습",
    en: "Loss Functions & Cost-sensitive Learning",
    category: "model",
    weight: 3,
    difficulty: 3,
    params: [
      { name: "loss (회귀)", desc: "회귀 손실 선택 — 평균=MSE(squared_error), 중앙값·강건=MAE(absolute_error), 절충=Huber, 꼬리 분위수(VaR)=pinball." },
      { name: "epsilon (HuberRegressor)", desc: "제곱↔절대 전환 경계(관례 1.35) — epsilon 밖 잔차는 선형으로만 벌해 이상치 영향 차단. 작을수록 더 강건." },
      { name: "quantile / solver (QuantileRegressor)", desc: "예측할 분위수(0~1) — 0.9면 VaR(90%). solver='highs'(scipy 내장, 웹 실행 가능) 권장." },
      { name: "loss='poisson' (HistGradientBoostingRegressor)", desc: "부스팅 목적함수를 Poisson deviance로 — 건수 데이터에 MSE보다 적합(항상 양의 예측). 'gamma'·'squared_error'도 가능." },
      { name: "power (TweedieRegressor)", desc: "Var(Y)=φ·μ^p의 지수 — 1<p<2가 순보험료(복합 포아송–감마). 출발점 1.5, 평가는 d2_tweedie_score." },
      { name: "임계값·비용비(FN:FP)", desc: "FN·FP 비용이 같을 때만 0.5가 최적 — 다르면 총비용 최소 임계값을 격자 탐색(청구/사기 심사의 핵심 레버)." },
    ],
    summary:
      "예측오차를 한 수로 요약하는 손실함수를 이해·선택 — MSE·MAE부터 분위수(VaR)·Poisson/Tweedie deviance·비대칭 비용 임계값까지",
    intro:
      "손실함수는 예측오차를 한 숫자로 압축한 것 — '어떤 손실로 학습하느냐'가 모델이 무엇을 잘 맞추는지를 정합니다.\n\n- MSE=평균, MAE=중앙값, 분위수(pinball)=특정 백분위수를 겨냥\n- 보험 데이터는 두꺼운 꼬리·0 뭉침이 흔해 손실 선택이 특히 중요\n- MSE·MAE·RMSE → Huber·분위수(VaR) → Poisson/Tweedie deviance → 비대칭 비용 임계값 순으로 진행\n- 요율산정 전체 흐름은 'pure-premium'·'GLM' 항목과 연계",
    tips: "- MSE/RMSE=큰 오차 회피, MAE=이상치 강건, 분위수=꼬리(안전할증·재보험 한도) 예측\n- 건수·순보험료는 MSE 대신 Poisson·Tweedie deviance가 편향 작음\n- 불균형 분류는 정확도 대신 '업무 비용'을 목적함수로 임계값 이동",
    sections: [
      {
        title: "회귀 손실 이해 — MSE·MAE·RMSE",
        desc: "예측 vs 실제에서 세 손실을 직접 계산하고, 이상치 1건이 MSE를 어떻게 키우는지(MAE는 강건) 시연합니다.",
        level: "basic",
        code: `import numpy as np
from sklearn.metrics import mean_squared_error, mean_absolute_error

rng = np.random.default_rng(42)

# ── 1) 손실이란? 예측이 실제에서 얼마나 벗어났는지(오차)를 '한 개의 숫자'로 압축한 것.
#    모델 학습은 이 숫자(손실)를 가장 작게 만드는 방향으로 계수를 조정하는 과정이다.
# 실제 손해액(만원)과 어떤 모델의 예측값 — 대체로 잘 맞지만 완벽하진 않다.
y_true = np.array([100.0, 120.0, 95.0, 110.0, 130.0, 105.0, 115.0, 125.0])
y_pred = np.array([103.0, 116.0, 99.0, 108.0, 133.0, 101.0, 118.0, 121.0])

err = y_pred - y_true          # 잔차(residual) = 예측 − 실제
print("잔차:", err)

# ── 2) 세 손실을 '직접' 계산해 정의를 눈으로 확인 (라이브러리 값과 대조)
mse = np.mean(err ** 2)                 # 평균제곱오차 — 오차를 제곱해 평균
mae = np.mean(np.abs(err))              # 평균절대오차 — 오차의 절댓값을 평균
rmse = np.sqrt(mse)                     # 제곱근을 씌워 원래 단위(만원)로 되돌림
print(f"\\n[직접 계산]  MSE={mse:.3f}  MAE={mae:.3f}  RMSE={rmse:.3f}")

# sklearn으로 교차 확인 — 값이 같아야 정상
print(f"[sklearn]    MSE={mean_squared_error(y_true, y_pred):.3f} "
      f" MAE={mean_absolute_error(y_true, y_pred):.3f} "
      f" RMSE={np.sqrt(mean_squared_error(y_true, y_pred)):.3f}")
print("→ RMSE는 MSE에 √를 씌운 값이라 '예측이 평균 몇 만원 빗나가나'로 바로 읽힌다(단위가 원자료와 같음).")

# ── 3) 핵심 시연: 이상치(대형 사고) 1건이 들어오면 MSE가 어떻게 폭발하는가
#    한 계약의 실제 손해액을 500만원 크게(대형 사고), 나머지는 그대로 두고 다시 계산.
y_true_out = y_true.copy()
y_true_out[3] += 500.0                  # 4번째 관측이 이상치로 돌변
err_out = y_pred - y_true_out
mse_out = np.mean(err_out ** 2)
mae_out = np.mean(np.abs(err_out))
print(f"\\n[이상치 1건 추가 후]  MSE={mse_out:,.1f}  MAE={mae_out:.3f}  RMSE={np.sqrt(mse_out):.3f}")
print(f"→ MSE는 {mse:.1f} → {mse_out:,.0f}  ({mse_out / mse:.0f}배 폭증)  |  "
      f"MAE는 {mae:.2f} → {mae_out:.2f}  ({mae_out / mae:.1f}배)")
print("  이유: MSE는 오차를 '제곱'해 큰 오차에 훨씬 큰 벌점을 준다(약 500의 제곱 ≈ 25만).")
print("  MAE는 절댓값이라 이상치 1건의 영향이 1/n로 희석돼 강건(robust)하다.")

# ── 4) 언제 무엇을 쓰나 — 실무 판단 요약
print("\\n[선택 가이드]")
print(" · MSE/RMSE : 큰 오차를 특히 피하고 싶을 때(대형 사고 과소예측이 치명적). 단, 이상치에 민감.")
print(" · MAE      : 이상치가 흔한 손해액·중앙값 성격의 예측. 오차를 '금액 그대로' 해석하고 싶을 때.")
print(" · RMSE     : MSE로 학습하되 보고는 원단위로 — 실무에서 가장 흔한 조합.")`,
      },
      {
        title: "이상치 강건·분위수 손실 — Huber·pinball",
        desc: "Huber로 이상치 강건 회귀, QuantileRegressor(0.9)로 90% 분위수(VaR) 예측·시각화.",
        level: "advanced",
        code: `import numpy as np
import matplotlib.pyplot as plt
from sklearn.linear_model import LinearRegression, HuberRegressor, QuantileRegressor

rng = np.random.default_rng(42)

# ── 1) 데이터 — 나이(age)에 따라 손해액이 오르는 관계 + 대형 사고(이상치) 몇 건
n = 200
age = rng.uniform(20, 70, n)
loss = 30 + 1.2 * age + rng.normal(0, 12, n)      # 참 관계: 기울기 1.2
# 이상치 주입 — 상위 6건을 대형 사고로 크게 부풀림(꼬리가 두꺼운 손해액의 전형)
idx = rng.choice(n, 6, replace=False)
loss[idx] += rng.uniform(120, 260, 6)
X = age.reshape(-1, 1)

# ── 2) 손실함수가 다르면 적합선이 달라진다
#    OLS(제곱손실)는 이상치에 끌려가고, Huber는 큰 오차를 선형으로만 벌해 강건하다.
ols = LinearRegression().fit(X, loss)
# Huber: |오차|<epsilon는 제곱(MSE처럼), 그 밖은 절대값(MAE처럼) — 이상치 영향을 잘라낸다.
huber = HuberRegressor(epsilon=1.35, alpha=0.0).fit(X, loss)
print(f"OLS   기울기={ols.coef_[0]:.3f}  (이상치에 끌려 참값 1.2에서 벗어남)")
print(f"Huber 기울기={huber.coef_[0]:.3f}  (참값 1.2에 더 가까움 — 강건)")
print(f"Huber가 벌점을 선형으로 줄여 down-weight한 관측: {int(huber.outliers_.sum())}건 / {n}건 "
      "(epsilon 밖 잔차 — 주입한 대형사고 6건을 포함해 꼬리 관측 전반)")

# ── 3) 분위수 회귀 — '평균'이 아니라 '분위수'를 예측한다
#    pinball(핀볼) 손실: 과소예측과 과대예측에 서로 다른 벌점을 줘 원하는 분위수로 선을 끌어올린다.
#      L_q(y, f) = max(q·(y−f), (q−1)·(y−f))   — q=0.9면 과소예측(y>f)에 9배 무겁게 벌점
#    q=0.9 선은 "관측의 약 90%가 이 아래" → 보험의 VaR(Value at Risk) 개념과 정확히 같다.
def pinball(y, f, q):
    d = y - f
    return np.mean(np.maximum(q * d, (q - 1) * d))

quantiles = [0.5, 0.9, 0.99]
models = {}
for q in quantiles:
    # solver='highs'는 선형계획 기반 — scipy에 포함되어 웹(Pyodide)에서도 동작
    qr = QuantileRegressor(quantile=q, alpha=0.0, solver="highs").fit(X, loss)
    models[q] = qr
    covered = np.mean(loss <= qr.predict(X))       # 실제로 선 아래 비율(≈ q여야 정상)
    print(f"q={q}: 기울기={qr.coef_[0]:.3f}, 절편={qr.intercept_:.1f}, "
          f"선 아래 비율={covered:.2f}, pinball={pinball(loss, qr.predict(X), q):.3f}")
print("→ q=0.9 예측선 = '90% 확률로 이 금액을 넘지 않는다' = 세그먼트별 손해액 VaR(90%). "
      "요율 안전할증·재보험 부보한도 설정의 직접 근거가 된다.")

# ── 4) 여러 분위수를 겹쳐 그리기 — 중앙(0.5)·꼬리(0.9·0.99)가 부챗살처럼 벌어진다
order = np.argsort(age)
xs = age[order].reshape(-1, 1)
plt.figure(figsize=(7, 5))
plt.scatter(age, loss, s=14, alpha=0.4, color="#3E6AE1", label="관측(손해액)")
plt.plot(xs, ols.predict(xs), "--", color="#94A3B8", lw=1.6, label="OLS 평균선")
colors = {0.5: "#0E9F8E", 0.9: "#E0A400", 0.99: "#D8574F"}
for q in quantiles:
    plt.plot(xs, models[q].predict(xs), color=colors[q], lw=2, label=f"분위수 q={q}")
plt.xlabel("가입연령")
plt.ylabel("손해액(만원)")
plt.title("분위수 회귀 — 평균선(OLS) 위로 꼬리 분위수가 벌어짐")
plt.legend(fontsize=9)
plt.tight_layout()
plt.show()`,
      },
      {
        title: "포아송·Tweedie deviance — 순보험료 부스팅",
        desc: "Poisson 부스팅으로 사고건수, Tweedie로 순보험료 직접 적합 — deviance가 MSE보다 적절함을 확인('pure-premium' 항목 연계).",
        level: "advanced",
        code: `import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import TweedieRegressor
from sklearn.metrics import mean_poisson_deviance, d2_tweedie_score
from sklearn.model_selection import train_test_split

rng = np.random.default_rng(42)

# ── 1) 합성 포트폴리오 4000건 — 위험특성 → 빈도·순보험료
#    순보험료(총손해액/노출)는 '0이 잔뜩 뭉치고(무사고), 사고 계약만 양의 꼬리'를 갖는다.
n = 4000
age = rng.uniform(20, 70, n)
region = rng.integers(0, 3, n)                      # 지역 0/1/2
exposure = rng.uniform(0.3, 1.0, n).round(2)        # 노출(경과 계약년수)
# 참 빈도: 로그선형(나이·지역이 곱으로 작용) × 노출
lam = np.exp(-2.3 + 0.02 * age + 0.25 * region) * exposure
n_claims = rng.poisson(lam)                          # 사고 건수 ~ Poisson
# 건별 심도 ~ 감마(shape=2), 총손해액 = 건수 × 심도 합
sev_scale = np.exp(4.0 + 0.01 * age)                 # 평균심도도 나이에 따라 소폭 증가
total_loss = np.array([rng.gamma(2.0 * k, sev_scale[i] / 2.0) if k > 0 else 0.0
                       for i, k in enumerate(n_claims)])
df = pd.DataFrame({"age": age, "region": region.astype(float),
                   "exposure": exposure, "n_claims": n_claims, "total_loss": total_loss})
print(f"계약 {n}건 · 무사고 비율 {(df.n_claims == 0).mean():.1%} · 총사고 {int(df.n_claims.sum())}건")

X = df[["age", "region"]]
Xtr, Xte, itr, ite = train_test_split(np.arange(n), np.arange(n), test_size=0.25,
                                      random_state=42)  # 인덱스로 split해 여러 타깃 공유
Xtr, Xte = X.iloc[itr], X.iloc[ite]

# ── 2) 빈도 부스팅 — loss="poisson"이 왜 MSE보다 적절한가
#    사고 건수는 0,1,2… 양의 정수에 오른쪽으로 치우친 분포. MSE는 이 분포에 대칭 벌점을 줘
#    큰 건수의 과대예측을 과하게 벌하고 음수 예측도 허용한다. Poisson deviance는 '건수 데이터의
#    최대우도'에 대응하는 손실이라 편향이 작고 항상 양의 예측을 낸다.
y_freq = df["n_claims"].values / df["exposure"].values     # 노출 보정 = 연율화 빈도
w = df["exposure"].values                                  # 노출을 표본가중치로
gb_pois = HistGradientBoostingRegressor(loss="poisson", learning_rate=0.05,
                                        max_iter=300, max_depth=3, random_state=42)
gb_pois.fit(Xtr, y_freq[itr], sample_weight=w[itr])
gb_mse = HistGradientBoostingRegressor(loss="squared_error", learning_rate=0.05,
                                       max_iter=300, max_depth=3, random_state=42)
gb_mse.fit(Xtr, y_freq[itr], sample_weight=w[itr])
# 평가도 Poisson deviance로(작을수록 우수). 예측이 0 이하가 되지 않도록 클립.
p_pois = np.clip(gb_pois.predict(Xte), 1e-6, None)
p_mse = np.clip(gb_mse.predict(Xte), 1e-6, None)
print("\\n[빈도 예측 — 낮을수록 우수]")
print(f"  Poisson 손실 학습 → 검증 Poisson deviance = {mean_poisson_deviance(y_freq[ite], p_pois, sample_weight=w[ite]):.4f}")
print(f"  MSE     손실 학습 → 검증 Poisson deviance = {mean_poisson_deviance(y_freq[ite], p_mse, sample_weight=w[ite]):.4f}")
print("  → 건수 데이터에 맞는 손실(Poisson)로 학습한 모델이 같은 척도에서 더 낮은 편차를 낸다.")

# ── 3) 순보험료 직접 적합 — Tweedie(1<power<2) 손실
#    순보험료 y=총손해액/노출은 '0 뭉침 + 양의 연속 꼬리' = 복합 포아송-감마 = Tweedie(power≈1.5).
#    d2_tweedie_score는 Tweedie deviance 기반 R² (1=완벽, 0=평균예측 수준, 클수록 우수).
y_pp = df["total_loss"].values / df["exposure"].values     # 순보험료(연율화)
w = df["exposure"].values                                  # 노출 가중치
power = 1.5
tw = TweedieRegressor(power=power, alpha=0.0, link="log", max_iter=1000)
tw.fit(Xtr, y_pp[itr], sample_weight=w[itr])
gb_tw = HistGradientBoostingRegressor(loss="squared_error", learning_rate=0.05,
                                      max_iter=300, max_depth=3, random_state=42)
gb_tw.fit(Xtr, np.log1p(y_pp[itr]), sample_weight=w[itr])   # MSE는 로그변환으로 겨우 대응
pred_tw = np.clip(tw.predict(Xte), 1e-6, None)
pred_gb = np.clip(np.expm1(gb_tw.predict(Xte)), 1e-6, None)
print("\\n[순보험료 예측 — D² Tweedie score, 높을수록 우수]")
print(f"  TweedieRegressor(power=1.5) : D2 = {d2_tweedie_score(y_pp[ite], pred_tw, power=power):.4f}")
print(f"  MSE(log변환) 부스팅         : D2 = {d2_tweedie_score(y_pp[ite], pred_gb, power=power):.4f}")
print(f"  총량 균형: 예측 순보험료 합 {pred_tw.sum():,.0f} vs 실제 {y_pp[ite].sum():,.0f}")
print("  → deviance 계열 손실은 왜곡분포(양수·치우침)에서 MSE보다 편향이 작고 총량도 잘 맞춘다.")`,
      },
      {
        title: "분류 손실·비대칭 비용 — log loss vs hinge, 임계값 최적화",
        desc: "log loss·hinge 비교 후, 미탐≠오탐 비용일 때 총비용 최소 임계값을 탐색합니다(청구/사기 심사).",
        level: "advanced",
        code: `import numpy as np
import matplotlib.pyplot as plt
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss, hinge_loss, confusion_matrix
from sklearn.model_selection import train_test_split

rng = np.random.default_rng(42)

# ── 1) 데이터 — 사기(또는 고액) 청구 여부(1=사기). 실무처럼 불균형(사기 ~15%).
n = 3000
x1 = rng.normal(0, 1, n)          # 심사 지표 A(예: 청구/보험료 비율)
x2 = rng.normal(0, 1, n)          # 심사 지표 B(예: 가입 후 경과월 역수)
lin = -2.6 + 1.5 * x1 + 1.1 * x2
p = 1 / (1 + np.exp(-lin))
y = (rng.random(n) < p).astype(int)
X = np.column_stack([x1, x2])
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.3, stratify=y, random_state=42)
print(f"사기 비율 = {y.mean():.1%} (불균형 — 정확도만 보면 '전부 정상' 예측이 85%로 무의미)")

# ── 2) 분류 손실 두 가지의 성격 — 개념 비교
#    · log loss(로그손실, = 이진 교차엔트로피): 확률 예측을 벌한다. 확신을 갖고 틀리면(p→1인데 실제 0)
#      벌점이 무한대로 커진다 → 잘 보정된 '확률'이 필요할 때. 로지스틱 회귀가 최소화하는 손실.
#    · hinge loss(경첩손실): SVM이 쓰는 '마진' 손실. 결정경계에서 충분히 떨어져 맞으면 벌점 0,
#      경계 근처·틀림에만 선형 벌점 → 확률이 아니라 '경계'가 목적일 때.
clf = LogisticRegression(max_iter=1000, class_weight="balanced").fit(Xtr, ytr)
proba = clf.predict_proba(Xte)[:, 1]
dfun = clf.decision_function(Xte)         # 부호 있는 결정함수값(마진) — hinge 입력용
print(f"\\nlog loss  = {log_loss(yte, proba):.4f}   (0에 가까울수록 확률 예측이 정확)")
print(f"hinge loss= {hinge_loss(yte, dfun):.4f}   (0에 가까울수록 마진 여유 있게 정분류)")

# ── 3) 비대칭 비용 — 미탐(사기를 놓침)과 오탐(정상을 사기로 의심)의 대가가 다르다
#    실무 예: 사기 1건을 놓치면(FN) 평균 지급손실 300만원, 정상을 오탐(FP)하면 조사·민원비용 20만원.
#    기본 임계값 0.5는 '두 오류가 같은 비용'일 때만 최적 → 비용이 다르면 임계값을 옮겨야 한다.
COST_FN = 300.0   # False Negative(사기 미탐) 1건 비용(만원)
COST_FP = 20.0    # False Positive(정상 오탐) 1건 비용(만원)

thresholds = np.linspace(0.02, 0.98, 97)
total_cost = []
for t in thresholds:
    pred = (proba >= t).astype(int)
    tn, fp, fn, tp = confusion_matrix(yte, pred).ravel()
    total_cost.append(fp * COST_FP + fn * COST_FN)
total_cost = np.array(total_cost)
t_star = thresholds[int(np.argmin(total_cost))]

# 기본 0.5 vs 비용최적 임계값 비교
def report(t):
    pred = (proba >= t).astype(int)
    tn, fp, fn, tp = confusion_matrix(yte, pred).ravel()
    cost = fp * COST_FP + fn * COST_FN
    print(f"  임계값 {t:.2f}: 미탐(FN)={fn:3d}  오탐(FP)={fp:3d}  총비용={cost:8,.0f}만원")

print(f"\\n미탐 비용 {COST_FN}만원 ≫ 오탐 비용 {COST_FP}만원 → 임계값을 낮춰 더 적극적으로 잡아내는 게 이득")
report(0.50)
report(t_star)
saved = total_cost[int(np.argmin(np.abs(thresholds - 0.5)))] - total_cost.min()
print(f"→ 비용최소 임계값 = {t_star:.2f}  (총비용 {total_cost.min():,.0f}만원, 0.5 대비 {saved:,.0f}만원 절감)")
print("  정확도(accuracy)가 아니라 '업무 비용'을 목적함수로 두면 최적 임계값이 0.5에서 크게 벗어난다.")

# ── 4) 비용곡선 — 임계값에 따른 총비용이 U자를 그리며 최소점을 지난다
plt.figure(figsize=(7, 5))
plt.plot(thresholds, total_cost, color="#3E6AE1", lw=2)
plt.axvline(0.5, ls="--", color="#94A3B8", lw=1.4, label="기본 임계값 0.5")
plt.axvline(t_star, ls="-", color="#D8574F", lw=1.8, label=f"비용최소 {t_star:.2f}")
plt.scatter([t_star], [total_cost.min()], color="#D8574F", zorder=5)
plt.xlabel("판정 임계값 (이 확률 이상이면 '사기'로 심사)")
plt.ylabel("총 기대비용(만원)")
plt.title(f"비대칭 비용곡선 — 미탐 {COST_FN:.0f} vs 오탐 {COST_FP:.0f}만원")
plt.legend(fontsize=9)
plt.tight_layout()
plt.show()`,
      },
    ],
  },
  /* ───────────────────────── 머신러닝 (ml) ───────────────────────── */
  {
    id: "decision-tree",
    name: "의사결정나무",
    en: "Decision Tree",
    category: "ml",
    weight: 3,
    difficulty: 2,
    params: [
      { name: "max_depth", desc: "나무 최대 깊이 — 과적합 제어 1순위. 3~5로 시작해 규칙을 읽고, 깊이를 늘릴수록 암기에 가까워집니다." },
      { name: "min_samples_leaf", desc: "잎 노드의 최소 표본 수 — 클수록 단순·안정. 소수 표본으로 만든 억지 규칙을 막습니다." },
      { name: "criterion", desc: "분할 품질 기준 — 분류 'gini'(기본)·'entropy', 회귀 'squared_error'·'absolute_error'(이상치 강건)." },
      { name: "class_weight", desc: "'balanced'로 불균형 클래스 보정." },
      { name: "ccp_alpha", desc: "비용-복잡도 사후 가지치기 강도 — cost_complexity_pruning_path로 후보를 얻어 교차검증으로 선택합니다." },
    ],
    summary: "if-then 규칙의 나무 구조로 분류·회귀 — 눈으로 읽히는 모델",
    intro:
      "데이터를 '나이 ≥ 45인가?' 같은 질문으로 반복 분할해 if-then 규칙의 나무를 만드는, 설명 가능성이 높은 모델입니다.\n\n- 나무 그림에서 규칙을 그대로 읽음 — 스케일링·더미변수 없이 작동\n- 단독은 과적합되기 쉬워 예측력은 랜덤포레스트·부스팅(앙상블)에 밀림\n- 보험 예: 해지 세그먼트 규칙 발견·심사 기준 정의",
    tips: "- max_depth·min_samples_leaf를 제한하지 않으면 학습 데이터를 통째로 암기\n- 깊이 3~5 얕은 나무로 규칙을 읽고, 예측력이 필요하면 앙상블로",
    sections: [
      {
        title: "지정 하이퍼파라미터로 학습·예측·평가 (max_depth=4)",
        desc: "샘플(policy)로 바로 실행되는 자체 완결형 — 값을 직접 지정해 탐색 없이 결과를 봅니다.",
        level: "basic",
        code: `from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import (accuracy_score, roc_auc_score,
                             confusion_matrix, classification_report)

# ① 변수 지정 — 설명변수(X)와 목표변수(y)를 직접 골라 씁니다.
X = df[["age", "premium", "bmi", "tenure_months", "n_contracts"]]
y = df["lapsed"].astype(int)
X_tr, X_te, y_tr, y_te = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42)

# ② 하이퍼파라미터를 코드에 직접 지정 — 탐색 없이 정해진 값으로 바로 결과를 봅니다.
est = DecisionTreeClassifier(
    max_depth=4,              # 깊이 제한(과적합 제어 1순위) — 3~5로 시작, 늘릴수록 암기에 가까워짐
    min_samples_leaf=50,      # 잎 노드 최소 표본 — 20~100, 클수록 단순·안정
    class_weight="balanced",  # 해지(소수 클래스) 보정 — 불균형 데이터면 사실상 필수
    random_state=42,          # 재현성 — 같은 값이면 항상 같은 나무
).fit(X_tr, y_tr)

# ③ 예측 → 평가
proba = est.predict_proba(X_te)[:, 1]
pred = est.predict(X_te)

print(f"정확도   = {accuracy_score(y_te, pred):.3f}")
print(f"ROC-AUC  = {roc_auc_score(y_te, proba):.3f}")   # 0.5=무작위, 1.0=완벽
print("혼동행렬\\n", confusion_matrix(y_te, pred))
print(classification_report(y_te, pred, target_names=["유지", "해지"]))`,
      },
      {
        title: "나무 시각화 — 규칙 그대로 읽기",
        desc: "위 기본 셀을 먼저 실행해 X_tr·y_tr를 만든 뒤 실행하세요.",
        level: "basic",
        code: `from sklearn.tree import DecisionTreeClassifier, plot_tree
import matplotlib.pyplot as plt

tree = DecisionTreeClassifier(
    max_depth=4,              # 과적합 제어의 핵심
    min_samples_leaf=50,      # 잎 노드 최소 표본
    class_weight="balanced",
    random_state=42,
).fit(X_tr, y_tr)

plt.figure(figsize=(16, 8))
plot_tree(tree, feature_names=X_tr.columns,
          class_names=["유지", "해지"], filled=True, fontsize=9)
plt.show()

print(f"train 정확도 {tree.score(X_tr, y_tr):.3f}")
print(f"test  정확도 {tree.score(X_te, y_te):.3f}")
# 두 값의 차이가 크면 과적합 → max_depth를 줄일 것`,
      },
      {
        title: "가지치기(ccp_alpha) 튜닝 — 비용-복잡도 경로 + 교차검증",
        desc: "가지치기 강도를 교차검증으로 고릅니다 — 기본 셀의 X_tr·y_tr·proba를 그대로 사용.",
        level: "advanced",
        code: `import numpy as np
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import cross_val_score
from sklearn.metrics import roc_auc_score
import matplotlib.pyplot as plt

# (연결) 기본 섹션 없이 단독 실행해도 되도록 — 학습 분할이 없으면 샘플로 즉석 준비
try:
    X_tr
except NameError:
    import pandas as pd
    from sklearn.model_selection import train_test_split
    df = pd.read_excel("policy.xlsx")
    X = df[["age", "premium", "bmi", "tenure_months", "n_contracts"]]
    y = df["lapsed"].astype(int)
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42)

# ① 가지치기 강도(alpha) 후보를 데이터에서 뽑습니다 — 값을 지정하는 기본 단계와 반대 방향.
base = DecisionTreeClassifier(class_weight="balanced", random_state=42)
path = base.cost_complexity_pruning_path(X_tr, y_tr)
alphas = np.unique(path.ccp_alphas[path.ccp_alphas > 0])   # 0(가지치기 없음)은 제외
alphas = alphas[:: max(1, len(alphas) // 20)]              # 후보가 많으면 20개 내외로 솎기

# ② 후보마다 5-겹 교차검증 AUC
scores = [cross_val_score(
    DecisionTreeClassifier(ccp_alpha=a, class_weight="balanced", random_state=42),
    X_tr, y_tr, cv=5, scoring="roc_auc").mean() for a in alphas]

best_alpha = float(alphas[int(np.argmax(scores))])
print(f"best ccp_alpha = {best_alpha:.6f}  (CV ROC-AUC {max(scores):.3f})")

plt.plot(alphas, scores, marker="o")
plt.xlabel("ccp_alpha"); plt.ylabel("CV ROC-AUC"); plt.show()

# ③ 선택된 alpha로 최종 학습 → 기본(max_depth=4)과 비교해 더 나은 쪽을 채택
pruned = DecisionTreeClassifier(ccp_alpha=best_alpha, class_weight="balanced",
                                random_state=42).fit(X_tr, y_tr)
print(f"잎 노드 수 = {pruned.get_n_leaves()}, 깊이 = {pruned.get_depth()}")
print(f"가지치기 test ROC-AUC = {roc_auc_score(y_te, pruned.predict_proba(X_te)[:, 1]):.3f}")
try:
    print(f"기본(max_depth=4) test ROC-AUC = {roc_auc_score(y_te, proba):.3f}")
except NameError:
    pass   # 기본 섹션(proba)을 건너뛴 경우 비교 생략`,
      },
      {
        title: "PCA 2축 결정경계 시각화",
        desc: "PCA 2축 평면에 나무의 계단형 결정경계를 그립니다 — 전체 변수 모델이 아닌 2D 투영 직관용.",
        level: "advanced",
        code: `import matplotlib.pyplot as plt
import pandas as pd
from sklearn.datasets import make_classification
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.tree import DecisionTreeClassifier
from sklearn.inspection import DecisionBoundaryDisplay

# 합성 데이터(자체 완결용) — 실제로는 X=df[[...]], y=df["lapsed"]를 씁니다
X, y = make_classification(n_samples=500, n_features=5, n_informative=3,
                           n_redundant=1, n_classes=2, random_state=42)
cols = ["age", "premium", "bmi", "tenure_months", "n_contracts"]
df = pd.DataFrame(X, columns=cols); df["lapsed"] = y

# ① 스케일링 → PCA로 변수 5개를 2축으로 압축(결정경계를 평면에 그리기 위함)
X_scaled = StandardScaler().fit_transform(df[cols])
P = PCA(n_components=2, random_state=42).fit_transform(X_scaled)

# ② 주의: 여기서 적합하는 나무는 '원변수 5개' 모델이 아니라 'PCA 2축' 위의 모델입니다.
#    경계를 눈으로 보기 위한 직관용 2D 투영일 뿐, 실제 예측 모델은 전체 변수로 따로 학습하세요.
clf2d = DecisionTreeClassifier(max_depth=4, random_state=42).fit(P, y)

# ③ 2축 평면에 결정경계를 색으로 칠하고 실제 점을 위에 겹쳐 그림
fig, ax = plt.subplots(figsize=(7, 6))
DecisionBoundaryDisplay.from_estimator(clf2d, P, response_method="predict",
                                       alpha=0.3, cmap="coolwarm", ax=ax)
ax.scatter(P[:, 0], P[:, 1], c=y, s=12, edgecolor="k", linewidth=0.3, cmap="coolwarm")
ax.set_xlabel("PC1"); ax.set_ylabel("PC2")
ax.set_title("의사결정나무 결정경계 (PCA 2축 투영 · 직관용)")
plt.show()

# 나무는 축에 평행한 계단 모양 경계를 만듭니다 — 이 특성이 눈에 바로 보입니다.
print(f"2D 투영 모델 학습 정확도 = {clf2d.score(P, y):.3f}  (전체 변수 모델과 다를 수 있음)")`,
      },
    ],
  },
  {
    id: "random-forest",
    name: "랜덤포레스트",
    en: "Random Forest",
    category: "ml",
    weight: 4,
    difficulty: 3,
    params: [
      { name: "n_estimators", desc: "나무 수 — 많을수록 안정되지만 수익은 체감(300~1000이면 충분). 늘려서 나빠지지는 않습니다." },
      { name: "max_features", desc: "분할마다 고려할 후보 변수 수 — 분류 기본 'sqrt'. 낮출수록 나무가 다양해져 과적합이 줄어듭니다." },
      { name: "min_samples_leaf", desc: "잎 최소 표본 — 개별 나무의 과적합 제어. 10~50 수준부터 시도." },
      { name: "oob_score=True", desc: "부트스트랩에 안 뽑힌 표본으로 계산하는 무료 검증 점수 — 별도 검증셋 없이 성능 감을 잡을 수 있습니다." },
      { name: "class_weight", desc: "'balanced'(전체 기준)·'balanced_subsample'(부트스트랩 표본 기준) 불균형 보정." },
      { name: "n_jobs=-1", desc: "모든 코어로 병렬 학습." },
    ],
    summary: "수백 그루의 나무를 배깅으로 평균 — 튜닝 없이도 강한 범용 베이스라인",
    intro:
      "부트스트랩 표본과 무작위 변수 선택으로 만든 나무 수백 그루의 예측을 평균(투표)하는 앙상블입니다.\n\n- 개별 나무의 과적합이 상쇄 — 튜닝 거의 없이 안정적인 범용 성능\n- 변수 중요도를 부산물로 제공해 빠른 탐색 도구로도 활용\n- 보험 예: 해지·사고 예측의 강한 베이스라인",
    tips: "- 불순도 기반 feature_importances_는 범주 수 많은 변수에 과대평가 경향\n- 중요한 의사결정에는 permutation_importance로 교차 확인",
    sections: [
      {
        title: "지정 하이퍼파라미터로 학습·예측·평가 (n_estimators=300, max_depth=6)",
        desc: "샘플(policy)로 바로 실행되는 자체 완결형 — 값을 직접 지정해 탐색 없이 결과를 봅니다.",
        level: "basic",
        code: `from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (accuracy_score, roc_auc_score,
    average_precision_score, confusion_matrix, classification_report)

# ① 변수 지정 — 설명변수(X)와 목표변수(y)를 직접 골라 씁니다.
X = df[["age", "premium", "bmi", "tenure_months", "n_contracts"]]
y = df["lapsed"].astype(int)
X_tr, X_te, y_tr, y_te = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42)

# ② 하이퍼파라미터를 코드에 직접 지정 — 탐색 없이 정해진 값으로 바로 결과를 봅니다.
est = RandomForestClassifier(
    n_estimators=300,         # 나무 수 — 300~1000이면 충분(많을수록 안정, 느려짐)
    max_depth=6,              # 나무 깊이 — 4~10, None이면 끝까지 키움(과적합↑)
    min_samples_leaf=20,      # 잎 최소 표본 — 10~50, 클수록 단순·안정
    max_features="sqrt",      # 분할 후보 변수 수 — 분류 기본값, 낮출수록 나무가 다양해짐
    class_weight="balanced",  # 해지(소수 클래스) 보정
    n_jobs=-1,                # 모든 코어로 병렬 학습
    random_state=42,          # 재현성
).fit(X_tr, y_tr)

# ③ 예측 → 평가
proba = est.predict_proba(X_te)[:, 1]
pred = est.predict(X_te)

print(f"정확도   = {accuracy_score(y_te, pred):.3f}")
print(f"ROC-AUC  = {roc_auc_score(y_te, proba):.3f}")   # 0.5=무작위, 1.0=완벽
print(f"PR-AUC   = {average_precision_score(y_te, proba):.3f}")   # 불균형이면 ROC보다 정직
print("혼동행렬\\n", confusion_matrix(y_te, pred))
print(classification_report(y_te, pred, target_names=["유지", "해지"]))`,
      },
      {
        title: "변수 중요도 — 불순도 기반 vs 순열 중요도",
        desc: "기본 셀의 X_tr·X_te를 그대로 씁니다 — 중요도 해석은 기본 실행 뒤에.",
        level: "advanced",
        code: `from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.metrics import roc_auc_score
import pandas as pd

# (연결) 기본 섹션 없이 단독 실행해도 되도록 — 학습 분할이 없으면 샘플로 즉석 준비
try:
    X_tr
except NameError:
    from sklearn.model_selection import train_test_split
    df = pd.read_excel("policy.xlsx")
    X = df[["age", "premium", "bmi", "tenure_months", "n_contracts"]]
    y = df["lapsed"].astype(int)
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42)

rf = RandomForestClassifier(
    n_estimators=500,
    min_samples_leaf=20,
    class_weight="balanced",
    n_jobs=-1,
    random_state=42,
).fit(X_tr, y_tr)

proba = rf.predict_proba(X_te)[:, 1]
print(f"ROC-AUC = {roc_auc_score(y_te, proba):.3f}")

# 불순도 기반 중요도 (빠른 훑기)
imp = pd.Series(rf.feature_importances_, index=X_tr.columns)
print(imp.sort_values(ascending=False).round(3))

# 순열 중요도 (더 신뢰할 만한 확인)
pi = permutation_importance(rf, X_te, y_te, n_repeats=10, random_state=42)
print(pd.Series(pi.importances_mean, index=X_te.columns)
      .sort_values(ascending=False).round(4))`,
      },
    ],
  },
  {
    id: "gradient-boosting",
    name: "그래디언트 부스팅",
    en: "Gradient Boosting — XGBoost · LightGBM",
    category: "ml",
    weight: 4,
    difficulty: 4,
    webSupport: "partial",
    webNote:
      "LightGBM·XGBoost는 브라우저 실행기에서 사용할 수 없습니다. 다만 예제의 sklearn HistGradientBoosting 블록은 그대로 실행됩니다.",
    params: [
      { name: "learning_rate", desc: "나무 하나의 기여 축소 비율 — 0.03~0.1 권장. 낮출수록 성능은 안정되지만 나무 수를 늘려야 합니다." },
      { name: "n_estimators / max_iter", desc: "최대 나무 수 — 조기 종료와 함께 크게(1000~5000) 잡고 멈춤은 검증 성능에 맡깁니다." },
      { name: "num_leaves · max_depth", desc: "나무 복잡도 — LightGBM은 num_leaves(기본 31)가 주 손잡이. 과적합이면 낮춥니다." },
      { name: "early_stopping(rounds)", desc: "검증 지표가 rounds회 개선 없으면 중단 — eval_set과 함께 사실상 필수." },
      { name: "subsample · colsample_bytree", desc: "나무마다 행·열을 일부만 사용(0.7~0.9) — 무작위성으로 과적합 완화." },
      { name: "scale_pos_weight / class_weight", desc: "불균형 보정 — XGBoost는 (음성 수/양성 수)를 scale_pos_weight로." },
    ],
    summary: "이전 나무의 오차를 다음 나무가 보정 — 정형 데이터 예측력의 사실상 표준",
    intro:
      "나무를 순차 추가하며 직전 예측의 오차를 다음 나무가 보정하는 부스팅 방식입니다.\n\n- 정형(표) 데이터 예측력의 사실상 표준 — XGBoost·LightGBM이 대표 구현체\n- 순차 학습이라 과적합 위험 — 조기 종료(early stopping)와 함께가 정석\n- 보험 예: 해지·사고빈도 예측, 순보험료 모델링",
    tips: "- learning_rate를 낮추고(0.03~0.1) n_estimators를 크게 잡아 조기 종료에 맡기는 조합이 안전\n- 외부 라이브러리를 못 쓰면 sklearn HistGradientBoosting이 좋은 대체재",
    sections: [
      {
        title: "지정 하이퍼파라미터로 학습·예측·평가 (learning_rate=0.1, max_iter=200)",
        desc: "sklearn HistGB 자체 완결형 — 조기 종료 없이 지정 값만으로 브라우저에서 바로 실행됩니다.",
        level: "basic",
        code: `from sklearn.model_selection import train_test_split
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import (accuracy_score, roc_auc_score,
    average_precision_score, confusion_matrix, classification_report)

# ① 변수 지정 — 부스팅은 스케일링·더미 없이 수치형을 그대로 받습니다.
X = df[["age", "premium", "bmi", "tenure_months", "n_contracts"]]
y = df["lapsed"].astype(int)
X_tr, X_te, y_tr, y_te = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42)

# ② 하이퍼파라미터를 코드에 직접 지정 — 나무 수를 자동으로 정하지 않습니다.
est = HistGradientBoostingClassifier(
    learning_rate=0.1,        # 나무 하나의 기여 — 0.03~0.1, 낮추면 max_iter를 늘립니다
    max_iter=200,             # 나무 수 — learning_rate와 반비례로 조정(0.05면 400~800)
    max_depth=3,              # 나무 깊이 — 3~6, 얕은 나무를 여러 개 쌓는 것이 부스팅의 정석
    min_samples_leaf=20,      # 잎 최소 표본 — 10~50
    l2_regularization=1.0,    # 과적합 억제 — 0~10, 클수록 보수적
    early_stopping=False,     # 기본 단계에서는 지정한 max_iter를 그대로 사용(아래 고급과 대비)
    random_state=42,          # 재현성
).fit(X_tr, y_tr)

# ③ 예측 → 평가
proba = est.predict_proba(X_te)[:, 1]
pred = est.predict(X_te)

print(f"train 정확도 = {est.score(X_tr, y_tr):.3f}")
print(f"정확도   = {accuracy_score(y_te, pred):.3f}")
print(f"ROC-AUC  = {roc_auc_score(y_te, proba):.3f}")   # 0.5=무작위, 1.0=완벽
print(f"PR-AUC   = {average_precision_score(y_te, proba):.3f}")
print("혼동행렬\\n", confusion_matrix(y_te, pred))
print(classification_report(y_te, pred, target_names=["유지", "해지"], zero_division=0))
# train 정확도만 높고 test가 낮으면 과적합 → max_iter·max_depth를 줄이거나 l2를 키우세요.`,
      },
      {
        title: "LightGBM — 조기 종료 학습",
        desc: "나무 수를 지정하지 않고 검증 성능이 멈출 때까지 자동으로 늘립니다(브라우저 실행기에서는 불가).",
        level: "advanced",
        code: `# lightgbm은 웹 실행기(Pyodide)·미설치 환경에 없을 수 있음 — 없으면 건너뛰고
# 아래 'sklearn 내장 대체재(HistGradientBoosting)' 섹션을 사용하세요.
try:
    import lightgbm as lgb
    HAS_LGB = True
except ImportError:
    HAS_LGB = False
    print("lightgbm 미설치 → 이 섹션 건너뜀 (로컬: pip install lightgbm)")

# (연결) 기본 섹션 없이 단독 실행해도 되도록 — 학습 분할이 없으면 샘플로 즉석 준비
try:
    X_tr
except NameError:
    import pandas as pd
    from sklearn.model_selection import train_test_split
    df = pd.read_excel("policy.xlsx")
    X = df[["age", "premium", "bmi", "tenure_months", "n_contracts"]]
    y = df["lapsed"].astype(int)
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42)

if HAS_LGB:
    from sklearn.metrics import roc_auc_score

    model = lgb.LGBMClassifier(
        n_estimators=2000,
        learning_rate=0.05,
        num_leaves=31,
        class_weight="balanced",
        random_state=42,
    )
    model.fit(
        X_tr, y_tr,
        eval_set=[(X_te, y_te)],
        eval_metric="auc",
        callbacks=[lgb.early_stopping(100)],   # 100회 개선 없으면 중단
    )
    print(f"best iteration = {model.best_iteration_}")
    print(f"ROC-AUC = {roc_auc_score(y_te, model.predict_proba(X_te)[:, 1]):.3f}")`,
      },
      {
        title: "sklearn 내장 대체재 — HistGradientBoosting 조기 종료",
        desc: "추가 설치 없이 결측치를 그대로 받습니다 — 기본 셀과 달리 나무 수를 검증 성능에 맡김.",
        level: "advanced",
        code: `from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import roc_auc_score

hgb = HistGradientBoostingClassifier(
    max_iter=1000,
    learning_rate=0.05,
    early_stopping=True,
    validation_fraction=0.15,
    random_state=42,
).fit(X_tr, y_tr)

print(f"ROC-AUC = {roc_auc_score(y_te, hgb.predict_proba(X_te)[:, 1]):.3f}")`,
      },
      {
        title: "조기 종료 모형 성능 평가 — 정확도·ROC-AUC·리포트 (HistGB, 브라우저 실행 가능)",
        desc: "브라우저 가능한 HistGB 자체 완결형 — 조기 종료로 나무 수를 정한 모형을 평가합니다.",
        level: "advanced",
        code: `from sklearn.model_selection import train_test_split
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import (accuracy_score, roc_auc_score,
    average_precision_score, confusion_matrix, classification_report)

X = df[["age", "premium", "bmi", "tenure_months", "n_contracts"]]
y = df["lapsed"].astype(int)
X_tr, X_te, y_tr, y_te = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42)

est = HistGradientBoostingClassifier(max_iter=800, learning_rate=0.05,
    early_stopping=True, validation_fraction=0.15, random_state=42).fit(X_tr, y_tr)
proba = est.predict_proba(X_te)[:, 1]
pred = est.predict(X_te)

print(f"정확도   = {accuracy_score(y_te, pred):.3f}")
print(f"ROC-AUC  = {roc_auc_score(y_te, proba):.3f}")
print(f"PR-AUC   = {average_precision_score(y_te, proba):.3f}")
print("혼동행렬\\n", confusion_matrix(y_te, pred))
print(classification_report(y_te, pred, target_names=["유지", "해지"]))`,
      },
    ],
  },
  {
    id: "svm",
    name: "SVM",
    en: "Support Vector Machine",
    category: "ml",
    weight: 2,
    difficulty: 4,
    params: [
      { name: "C", desc: "오분류 허용도 — 클수록 훈련 데이터에 밀착(과적합 위험), 작을수록 마진 우선. 로그 스케일(0.1~100)로 탐색." },
      { name: "kernel", desc: "'rbf'(기본, 비선형)·'linear'(고차원·텍스트)·'poly'. 선형으로 충분하면 LinearSVC가 훨씬 빠릅니다." },
      { name: "gamma", desc: "rbf 경계의 유연성 — 'scale'(기본) 권장. 클수록 국소적 경계로 과적합." },
      { name: "probability=True", desc: "predict_proba 활성화 — 내부 교차검증을 돌려 학습이 크게 느려집니다. 점수만 필요하면 decision_function 사용." },
      { name: "class_weight='balanced'", desc: "불균형 클래스 보정." },
    ],
    summary: "마진을 최대로 하는 경계면으로 분류 — 커널로 비선형 경계까지",
    intro:
      "두 클래스 사이 여유(마진)가 가장 큰 경계면을 찾는 분류기입니다.\n\n- 커널 트릭으로 비선형 경계까지 — 표본 적고 차원 높은 문제에 강점\n- 거리 기반이라 스케일링 필수\n- 표본 수만 건 이상이면 급격히 느려짐 — 대용량은 트리 계열이 실용적\n- 보험 예: 소규모 심사 데이터 분류",
    tips: "- C(오분류 허용)·gamma(경계 유연성)가 성능을 좌우 — 로그 스케일 그리드로 함께 탐색\n- 확률이 필요하면 probability=True(느려짐) 대신 decision_function 값도 방법",
    sections: [
      {
        title: "지정 하이퍼파라미터로 학습·예측·평가 (C=1.0 · rbf · gamma='scale')",
        desc: "스케일링 포함 자체 완결형 — 기본값을 지정해 탐색 없이 바로 결과를 봅니다.",
        level: "basic",
        code: `from sklearn.model_selection import train_test_split
from sklearn.svm import SVC
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (accuracy_score, roc_auc_score,
                             confusion_matrix, classification_report)

# ① 변수 지정 — SVM은 거리 기반이라 StandardScaler 스케일링이 필수입니다.
X = df[["age", "premium", "bmi", "tenure_months", "n_contracts"]]
y = df["lapsed"].astype(int)
X_tr, X_te, y_tr, y_te = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42)

# ② 하이퍼파라미터를 코드에 직접 지정 — 탐색 없이 기본값으로 바로 결과를 봅니다.
est = make_pipeline(
    StandardScaler(),         # 스케일링 → SVC 순서로 묶어 test 정보 누출을 막습니다
    SVC(
        kernel="rbf",         # 커널 — 'rbf'(비선형 기본)·'linear'(고차원·텍스트)·'poly'
        C=1.0,                # 오분류 허용도 — 기본값 1.0에서 시작, 0.1~100을 로그 스케일로
        gamma="scale",        # 경계 유연성 — 'scale'(기본) 권장, 키우면 국소적·과적합
        class_weight="balanced",  # 해지(소수 클래스) 보정
        probability=True,     # predict_proba 활성화(내부 CV로 느려짐) — 점수만이면 decision_function
        random_state=42,      # 재현성
    ),
).fit(X_tr, y_tr)

# ③ 예측 → 평가
proba = est.predict_proba(X_te)[:, 1]
pred = est.predict(X_te)

print(f"정확도   = {accuracy_score(y_te, pred):.3f}")
print(f"ROC-AUC  = {roc_auc_score(y_te, proba):.3f}")   # 0.5=무작위, 1.0=완벽
print("혼동행렬\\n", confusion_matrix(y_te, pred))
print(classification_report(y_te, pred, target_names=["유지", "해지"], zero_division=0))`,
      },
      {
        title: "스케일링 파이프라인 + 그리드 탐색",
        desc: "C·gamma를 교차검증으로 고릅니다 — 기본 셀의 X_tr·y_tr를 그대로 사용.",
        level: "advanced",
        code: `from sklearn.svm import SVC
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import GridSearchCV

# (연결) 기본 섹션 없이 단독 실행해도 되도록 — 학습 분할이 없으면 샘플로 즉석 준비
try:
    X_tr
except NameError:
    import pandas as pd
    from sklearn.model_selection import train_test_split
    df = pd.read_excel("policy.xlsx")
    X = df[["age", "premium", "bmi", "tenure_months", "n_contracts"]]
    y = df["lapsed"].astype(int)
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42)

pipe = make_pipeline(StandardScaler(), SVC(kernel="rbf"))

grid = GridSearchCV(
    pipe,
    {"svc__C": [0.1, 1, 10, 100],
     "svc__gamma": ["scale", 0.01, 0.1, 1]},
    cv=5, scoring="roc_auc", n_jobs=-1,
).fit(X_tr, y_tr)

print(grid.best_params_)
print(f"CV best AUC = {grid.best_score_:.3f}")
print(f"test  score = {grid.score(X_te, y_te):.3f}")`,
      },
      {
        title: "PCA 2축 결정경계 시각화",
        desc: "PCA 2축 평면에 rbf 곡선 경계를 그립니다 — 전체 변수 모델이 아닌 2D 투영 직관용.",
        level: "advanced",
        code: `import matplotlib.pyplot as plt
import pandas as pd
from sklearn.datasets import make_classification
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.svm import SVC
from sklearn.inspection import DecisionBoundaryDisplay

# 합성 데이터(자체 완결용) — 실제로는 X=df[[...]], y=df["lapsed"]를 씁니다
X, y = make_classification(n_samples=500, n_features=5, n_informative=3,
                           n_redundant=1, n_classes=2, random_state=42)
cols = ["age", "premium", "bmi", "tenure_months", "n_contracts"]
df = pd.DataFrame(X, columns=cols); df["lapsed"] = y

# ① SVM은 거리 기반이라 스케일링이 필수 → 그다음 PCA로 2축 압축
X_scaled = StandardScaler().fit_transform(df[cols])
P = PCA(n_components=2, random_state=42).fit_transform(X_scaled)

# ② 주의: 여기 SVC는 '원변수 5개' 모델이 아니라 'PCA 2축' 위의 모델입니다.
#    rbf 커널의 곡선 경계를 눈으로 보기 위한 직관용 2D 투영이며, 실제 모델은 전체 변수로 학습하세요.
clf2d = SVC(kernel="rbf", C=1.0, gamma="scale", random_state=42).fit(P, y)

# ③ 2축 평면에 결정경계를 색으로 칠하고 실제 점을 위에 겹쳐 그림
fig, ax = plt.subplots(figsize=(7, 6))
DecisionBoundaryDisplay.from_estimator(clf2d, P, response_method="predict",
                                       alpha=0.3, cmap="coolwarm", ax=ax)
ax.scatter(P[:, 0], P[:, 1], c=y, s=12, edgecolor="k", linewidth=0.3, cmap="coolwarm")
ax.set_xlabel("PC1"); ax.set_ylabel("PC2")
ax.set_title("SVM(rbf) 결정경계 (PCA 2축 투영 · 직관용)")
plt.show()

# rbf 커널은 나무의 계단 경계와 달리 매끈하게 휘어지는 경계를 그립니다 — 차이가 눈에 보입니다.
print(f"2D 투영 모델 학습 정확도 = {clf2d.score(P, y):.3f}  (전체 변수 모델과 다를 수 있음)")`,
      },
    ],
  },
  {
    id: "knn",
    name: "KNN",
    en: "k-Nearest Neighbors",
    category: "ml",
    weight: 2,
    difficulty: 2,
    params: [
      { name: "n_neighbors", desc: "이웃 수 k — 작으면 노이즈에 민감(과적합), 크면 경계가 뭉개짐. 홀수로 동점을 피하고 교차검증으로 선택." },
      { name: "weights", desc: "'uniform'(모든 이웃 동일 표)·'distance'(가까울수록 큰 가중) — 밀도가 불균일하면 distance가 유리." },
      { name: "metric / p", desc: "거리 정의 — 기본 민코프스키 p=2(유클리드), p=1이면 맨해튼. 스케일링과 함께 결과를 좌우합니다." },
      { name: "n_jobs=-1", desc: "예측 시 이웃 탐색 병렬화 — KNN은 예측이 느린 모델입니다." },
    ],
    summary: "가장 가까운 k개 이웃의 다수결·평균으로 예측 — 학습이 없는 게으른 모델",
    intro:
      "가장 가까운 k개 이웃의 다수결(분류)·평균(회귀)으로 예측하는, 학습 과정이 없는 모델입니다.\n\n- 개념이 직관적 — 베이스라인·유사 계약 찾기에 적합\n- 거리 계산이 전부라 스케일링이 결과를 좌우\n- 차원이 많으면 '가깝다'가 무의미해지는 차원의 저주에 취약",
    tips: "- k 작으면 노이즈에 민감(과적합), 크면 경계가 뭉개짐(과소적합)\n- 홀수 k로 동점을 피하고 교차검증으로 k 선택",
    sections: [
      {
        title: "지정 하이퍼파라미터로 학습·예측·평가 (n_neighbors=5)",
        desc: "스케일링 포함 자체 완결형 — k를 직접 지정해 탐색 없이 바로 결과를 봅니다.",
        level: "basic",
        code: `from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (accuracy_score, roc_auc_score,
                             confusion_matrix, classification_report)

# ① 변수 지정 — KNN도 거리 기반이라 StandardScaler 스케일링이 필수입니다.
X = df[["age", "premium", "bmi", "tenure_months", "n_contracts"]]
y = df["lapsed"].astype(int)
X_tr, X_te, y_tr, y_te = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42)

# ② 하이퍼파라미터를 코드에 직접 지정 — 탐색 없이 정해진 k로 바로 결과를 봅니다.
est = make_pipeline(
    StandardScaler(),         # 스케일링 → KNN 순서로 묶어 test 정보 누출을 막습니다
    KNeighborsClassifier(
        n_neighbors=5,        # 이웃 수 k — 5부터 시작, 홀수로 동점 회피(3~25를 CV로 조정)
        weights="distance",   # 'uniform'(모든 이웃 동일 표)·'distance'(가까울수록 큰 가중)
        metric="minkowski", p=2,  # 거리 정의 — p=2 유클리드(기본), p=1 맨해튼
        n_jobs=-1,            # 이웃 탐색 병렬화 — KNN은 예측이 느립니다
    ),
).fit(X_tr, y_tr)

# ③ 예측 → 평가
proba = est.predict_proba(X_te)[:, 1]
pred = est.predict(X_te)

print(f"정확도   = {accuracy_score(y_te, pred):.3f}")
print(f"ROC-AUC  = {roc_auc_score(y_te, proba):.3f}")   # 0.5=무작위, 1.0=완벽
print("혼동행렬\\n", confusion_matrix(y_te, pred))
print(classification_report(y_te, pred, target_names=["유지", "해지"], zero_division=0))`,
      },
      {
        title: "k 선택 — 교차검증 곡선",
        desc: "k를 교차검증 곡선으로 고릅니다 — 기본 셀의 X_tr·y_tr를 그대로 사용.",
        level: "advanced",
        code: `from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import cross_val_score
import matplotlib.pyplot as plt

# (연결) 기본 섹션 없이 단독 실행해도 되도록 — 학습 분할이 없으면 샘플로 즉석 준비
try:
    X_tr
except NameError:
    import pandas as pd
    from sklearn.model_selection import train_test_split
    df = pd.read_excel("policy.xlsx")
    X = df[["age", "premium", "bmi", "tenure_months", "n_contracts"]]
    y = df["lapsed"].astype(int)
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42)

ks = range(1, 40, 2)
scores = [
    cross_val_score(
        make_pipeline(StandardScaler(), KNeighborsClassifier(n_neighbors=k)),
        X_tr, y_tr, cv=5, scoring="roc_auc",
    ).mean()
    for k in ks
]

plt.plot(list(ks), scores, marker="o")
plt.xlabel("k")
plt.ylabel("CV ROC-AUC")
plt.show()

best_k = list(ks)[scores.index(max(scores))]
print(f"best k = {best_k}")`,
      },
      {
        title: "선택된 k로 최종 학습·평가 — 기본(k=5)과 비교",
        desc: "교차검증 셀의 best_k를 그대로 사용해 기본(k=5)과 성능을 비교합니다.",
        level: "advanced",
        code: `from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (accuracy_score, roc_auc_score,
                             confusion_matrix, classification_report)

# (연결) ② 탐색을 건너뛰었으면 best_k 기본값으로, 분할이 없으면 샘플로 즉석 준비
try:
    X_tr
except NameError:
    import pandas as pd
    from sklearn.model_selection import train_test_split
    df = pd.read_excel("policy.xlsx")
    X = df[["age", "premium", "bmi", "tenure_months", "n_contracts"]]
    y = df["lapsed"].astype(int)
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42)
try:
    best_k
except NameError:
    best_k = 7    # ② k 선택 곡선을 실행했다면 거기서 고른 값이 그대로 쓰입니다

tuned = make_pipeline(StandardScaler(),
    KNeighborsClassifier(n_neighbors=best_k, weights="distance")).fit(X_tr, y_tr)
proba_t = tuned.predict_proba(X_te)[:, 1]
pred_t = tuned.predict(X_te)

print(f"k = {best_k}")
print(f"정확도   = {accuracy_score(y_te, pred_t):.3f}")
print(f"ROC-AUC  = {roc_auc_score(y_te, proba_t):.3f}")
print("혼동행렬\\n", confusion_matrix(y_te, pred_t))
print(classification_report(y_te, pred_t, target_names=["유지", "해지"], zero_division=0))
# 기본(k=5)의 ROC-AUC와 비교해 개선이 미미하면 단순한 쪽을 택하는 편이 낫습니다.`,
      },
      {
        title: "PCA 2축 결정경계 시각화",
        desc: "PCA 2축 평면에 이웃 기반 경계를 그립니다 — 전체 변수 모델이 아닌 2D 투영 직관용.",
        level: "advanced",
        code: `import matplotlib.pyplot as plt
import pandas as pd
from sklearn.datasets import make_classification
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.neighbors import KNeighborsClassifier
from sklearn.inspection import DecisionBoundaryDisplay
from sklearn.model_selection import cross_val_score

# 합성 데이터(자체 완결용) — 실제로는 X=df[[...]], y=df["lapsed"]를 씁니다
X, y = make_classification(n_samples=500, n_features=5, n_informative=3,
                           n_redundant=1, n_classes=2, random_state=42)
cols = ["age", "premium", "bmi", "tenure_months", "n_contracts"]
df = pd.DataFrame(X, columns=cols); df["lapsed"] = y

# ① KNN도 거리 기반이라 스케일링이 필수 → 그다음 PCA로 2축 압축
X_scaled = StandardScaler().fit_transform(df[cols])
P = PCA(n_components=2, random_state=42).fit_transform(X_scaled)

# ② 주의: 여기 KNN은 '원변수 5개' 모델이 아니라 'PCA 2축' 위의 모델입니다.
#    이웃 기반 경계를 눈으로 보기 위한 직관용 2D 투영이며, 실제 모델은 전체 변수로 학습하세요.
clf2d = KNeighborsClassifier(n_neighbors=15, weights="distance").fit(P, y)

# ③ 2축 평면에 결정경계를 색으로 칠하고 실제 점을 위에 겹쳐 그림
fig, ax = plt.subplots(figsize=(7, 6))
DecisionBoundaryDisplay.from_estimator(clf2d, P, response_method="predict",
                                       alpha=0.3, cmap="coolwarm", ax=ax)
ax.scatter(P[:, 0], P[:, 1], c=y, s=12, edgecolor="k", linewidth=0.3, cmap="coolwarm")
ax.set_xlabel("PC1"); ax.set_ylabel("PC2")
ax.set_title("KNN(k=15) 결정경계 (PCA 2축 투영 · 직관용)")
plt.show()

# k가 작으면 경계가 울퉁불퉁(과적합), 크면 매끈해집니다 — k를 바꿔가며 경계 모양을 보세요.
# 거리가중 KNN은 학습 정확도가 항상 1.0(자기 자신이 가장 가까운 이웃)이라 5겹 CV로 평가합니다.
cv_acc = cross_val_score(clf2d, P, y, cv=5).mean()
print(f"2D 투영 모델 5겹 CV 정확도 = {cv_acc:.3f}  (전체 변수 모델과 다를 수 있음)")`,
      },
    ],
  },
  {
    id: "naive-bayes",
    name: "나이브 베이즈",
    en: "Naive Bayes",
    category: "ml",
    weight: 1,
    difficulty: 2,
    params: [
      { name: "alpha (MultinomialNB)", desc: "라플라스 평활(기본 1.0) — 학습에 없던 단어의 확률이 0이 되는 문제를 막습니다. 0.1~1 사이 튜닝." },
      { name: "var_smoothing (GaussianNB)", desc: "분산에 더하는 안정화 항 — 분산 0인 변수로 인한 수치 문제 방지." },
      { name: "class_prior", desc: "클래스 사전확률 수동 지정 — 실제 모집단 비율이 학습 데이터와 다를 때." },
      { name: "TfidfVectorizer(min_df, max_df, ngram_range)", desc: "전처리 짝꿍 — 희귀 단어 컷(min_df)·과빈출 컷(max_df)·(1,2)면 2단어 구까지 반영." },
    ],
    summary: "변수 독립을 가정한 베이즈 정리 기반 분류 — 텍스트 분류의 고전",
    intro:
      "베이즈 정리에 '변수 독립' 가정을 더해 클래스 확률을 계산하는 빠른 분류기입니다.\n\n- 가정이 비현실적이어도 실전에서 의외로 잘 작동 — 학습·예측이 매우 빠름\n- 연속형 변수는 GaussianNB, 단어 빈도는 MultinomialNB\n- 보험 예: 민원 유형 자동 분류 등 텍스트 문제의 고전 베이스라인",
    tips: "- 출력 확률은 순위는 맞지만 값이 0·1 근처 극단으로 치우침\n- 확률 값을 업무 판단에 쓰려면 보정(calibration) 필요",
    sections: [
      {
        title: "지정 적합 — 연속형 변수로 해지 예측(GaussianNB)",
        desc: "하이퍼파라미터를 지정해 탐색 없이 바로 결과를 봅니다 — 샘플로 그대로 실행.",
        level: "basic",
        code: `from sklearn.naive_bayes import GaussianNB
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score
import pandas as pd

# ① 연속형 변수에는 GaussianNB(각 변수를 정규분포로 가정) — 단어 빈도면 아래 MultinomialNB
X = df[["age", "premium", "bmi", "tenure_months", "n_contracts"]]
y = df["lapsed"].astype(int)
X_tr, X_te, y_tr, y_te = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42
)

# ② 하이퍼파라미터를 지정해 바로 적합 — 탐색 없이 결과부터 봅니다
#    var_smoothing=1e-9(기본) = 분산에 더하는 안정화 항, 분산이 0에 가까운 변수의 수치 오류 방지
#    priors: 모집단 해지율이 학습 데이터와 다르면 priors=[0.82, 0.18]처럼 직접 지정
nb = GaussianNB(var_smoothing=1e-9)
nb.fit(X_tr, y_tr)

# ③ 성능 확인 — 불균형(해지 18%)이라 정확도보다 재현율·AUC를 봅니다
#    샘플의 lapsed는 무작위로 만든 열이라 AUC가 0.5 근처(=찍기)로 나오는 것이 정상입니다.
#    'AUC 0.5 = 이 변수들로는 설명이 안 된다'를 읽는 연습으로 보고, 실제 데이터로 바꿔 확인하세요.
#    zero_division=0: 한 클래스를 아예 예측하지 않을 때 정밀도를 0으로(경고 대신)
proba = nb.predict_proba(X_te)[:, 1]
print(classification_report(y_te, nb.predict(X_te),
                            target_names=["유지", "해지"], zero_division=0))
print(f"ROC-AUC = {roc_auc_score(y_te, proba):.3f}")

# ④ 나이브 베이즈가 무엇을 보고 판단하는지 — 클래스별 변수 평균(theta_)
print("클래스별 변수 평균")
print(pd.DataFrame(nb.theta_, columns=X.columns, index=["유지", "해지"]).round(2))`,
      },
      {
        title: "텍스트 분류 — 민원 유형 자동 분류",
        level: "basic",
        code: `from sklearn.naive_bayes import MultinomialNB
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import make_pipeline
from sklearn.metrics import classification_report
import pandas as pd

# 소형 예시 민원 데이터(자체완결) — 실제로는 내 데이터의 텍스트·라벨 열로 바꾸세요
texts = pd.DataFrame({
    "complaint_text": [
        "보험금 지급이 한 달째 지연되고 있습니다", "청구한 보험금이 아직도 안 나왔어요",
        "지급 심사가 너무 오래 걸립니다", "보험금 입금이 예정일보다 늦어요",
        "설계사가 상품 내용을 잘못 설명했습니다", "가입할 때 설명과 보장이 다릅니다",
        "약관과 다른 설명을 듣고 가입했습니다", "판매 과정에서 중요한 내용을 못 들었어요",
        "해지 환급금이 생각보다 적습니다", "해지 절차가 복잡하고 오래 걸립니다",
        "해지 신청을 했는데 처리가 안 됩니다", "환급금 계산 내역을 알고 싶습니다",
    ],
    "category": ["지급지연"] * 4 + ["불완전판매"] * 4 + ["해지"] * 4,
})

# 표본이 작으므로 전량 학습(시연) — 실제 데이터면 train_test_split을 쓰세요
nb = make_pipeline(TfidfVectorizer(), MultinomialNB())
nb.fit(texts["complaint_text"], texts["category"])
print(classification_report(texts["category"], nb.predict(texts["complaint_text"])))

# 새 민원 분류
print(nb.predict(["보험금 지급이 한 달째 지연되고 있습니다",
                  "설계사 설명이 실제 보장과 달라요"]))`,
      },
      {
        title: "확률 보정 — 예측 확률을 업무에 쓰려면",
        desc: "0·1로 쏠리는 확률을 보정하고 전후를 Brier 점수·보정 곡선으로 비교합니다.",
        level: "advanced",
        code: `from sklearn.naive_bayes import GaussianNB
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.metrics import brier_score_loss
from sklearn.model_selection import train_test_split
import matplotlib.pyplot as plt

X = df[["age", "premium", "bmi", "tenure_months", "n_contracts"]]
y = df["lapsed"].astype(int)
X_tr, X_te, y_tr, y_te = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42
)

# 나이브 베이즈 확률은 독립 가정 탓에 0·1로 쏠립니다 — 순위는 맞아도 값 자체는 못 믿습니다.
# 확률을 업무 계산(예: 기대손실 = 해지확률 × 금액)에 넣으려면 보정이 필요합니다.
raw = GaussianNB().fit(X_tr, y_tr)
cal = CalibratedClassifierCV(GaussianNB(), method="isotonic", cv=5).fit(X_tr, y_tr)

p_raw = raw.predict_proba(X_te)[:, 1]
p_cal = cal.predict_proba(X_te)[:, 1]

# Brier 점수 = (예측확률 − 실제)²의 평균 — 낮을수록 확률이 잘 맞습니다
# (샘플의 lapsed는 무작위라 원래 쏠림이 적어 개선 폭이 거의 없습니다 —
#  실제 텍스트·다변량 데이터에서는 보정 전후 차이가 뚜렷합니다)
print(f"Brier 원본 {brier_score_loss(y_te, p_raw):.4f} → 보정 {brier_score_loss(y_te, p_cal):.4f}")

# 보정 곡선: 대각선에 가까울수록 '예측 30%'가 실제로 30% 발생한다는 뜻
for name, p in [("원본", p_raw), ("보정", p_cal)]:
    frac, mean_pred = calibration_curve(y_te, p, n_bins=5, strategy="quantile")
    plt.plot(mean_pred, frac, marker="o", label=name)
plt.plot([0, 1], [0, 1], "k--", lw=1, label="완벽 보정")
plt.xlabel("예측 확률"); plt.ylabel("실제 발생 비율"); plt.legend()
plt.show()`,
      },
    ],
  },
  {
    id: "kmeans",
    name: "K-평균 군집",
    en: "K-means Clustering",
    category: "ml",
    weight: 3,
    difficulty: 3,
    params: [
      { name: "n_clusters", desc: "군집 수 k — 알고리즘이 정해주지 않습니다. 엘보(inertia 감소 둔화)와 실루엣 점수를 함께 보고 선택." },
      { name: "n_init", desc: "서로 다른 초기 중심으로 반복하는 횟수 — 국소해 방지. 10 이상 권장(최신 버전 기본 'auto')." },
      { name: "init", desc: "'k-means++'(기본, 좋은 초기 중심)·'random'. 바꿀 일은 드뭅니다." },
      { name: "random_state", desc: "재현성 고정 — 세그먼트 번호가 실행마다 바뀌지 않게." },
      { name: "max_iter / tol", desc: "수렴 반복 상한·허용 오차 — 대용량에서 조정." },
    ],
    summary: "라벨 없는 데이터를 k개 그룹으로 — 고객 세분화의 기본 도구",
    intro:
      "정답 라벨 없이 서로 가까운 점끼리 k개 군집으로 묶는 대표적 비지도 학습입니다.\n\n- 군집 중심을 반복 갱신하는 단순 알고리즘\n- k는 분석자가 결정 — 엘보(관성 감소)·실루엣 점수(응집도)를 함께 보고 선택\n- 보험 예: 고객 세분화·계약 포트폴리오 분류",
    tips: "- 거리 기반이라 스케일링 필수\n- 군집은 '발견'이 아니라 '요약' — 군집별 평균 프로파일에 업무 언어로 이름을 붙여야 실무 의미",
    sections: [
      {
        title: "특정 K로 군집화 — K를 지정해 바로 결과 보기",
        desc: "K를 직접 지정해 군집·프로파일까지 읽습니다 — 최적 K 탐색은 아래 고급 섹션.",
        level: "basic",
        code: `from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
import pandas as pd
import matplotlib.pyplot as plt

# ① 군집에 쓸 변수 — 거리 기반이라 스케일링(평균0·표준편차1)이 먼저입니다
cols = ["age", "premium", "n_contracts", "tenure_months"]
scaler = StandardScaler()
X_scaled = scaler.fit_transform(df[cols])

# ② K를 직접 지정해 바로 군집 — K=3은 예시(마케팅에서 3개 세그먼트를 원할 때처럼)
#    최적 K 탐색(엘보·실루엣)은 아래 고급 섹션. 우선 2~5를 바꿔가며 감을 잡습니다.
#    n_init=10 = 초기 중심을 10번 바꿔 시도(국소해 방지), random_state=42 = 재현용 고정 시드
km = KMeans(n_clusters=3, n_init=10, random_state=42)
df["segment"] = km.fit_predict(X_scaled)

# ③ 군집 크기 — 한 군집에 몰리거나 몇 건짜리 군집이 나오면 K·변수를 다시 봅니다
print("군집 크기")
print(df["segment"].value_counts().sort_index())

# ④ 군집 중심을 원래 단위로 되돌려 읽기 — 스케일 역변환해야 '나이 52세'처럼 해석됩니다
centers = pd.DataFrame(scaler.inverse_transform(km.cluster_centers_), columns=cols)
centers.index.name = "segment"
print("군집 중심(원 스케일)")
print(centers.round(1))

# ⑤ 군집별 프로파일 — 업무 언어로 이름 붙이는 근거
profile = df.groupby("segment")[cols].mean()
profile["n"] = df["segment"].value_counts().sort_index()
print("군집 프로파일")
print(profile.round(1))
# 예: 고연령·고보험료·장기 유지 군집 → 'VIP 장기고객'

# ⑥ 변수 4개를 PCA 2축으로 눌러 담아 눈으로 확인(군집 중심은 X 표시)
proj = PCA(n_components=2, random_state=42).fit(X_scaled)
P, Pc = proj.transform(X_scaled), proj.transform(km.cluster_centers_)
plt.scatter(P[:, 0], P[:, 1], c=df["segment"], s=10, alpha=0.5, cmap="viridis")
plt.scatter(Pc[:, 0], Pc[:, 1], c="red", marker="X", s=200, edgecolor="white")
plt.xlabel("PC1"); plt.ylabel("PC2"); plt.title("K=3 군집 (PCA 2축)")
plt.show()`,
      },
      {
        title: "k 선택 — 엘보 + 실루엣",
        level: "advanced",
        code: `from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score
import matplotlib.pyplot as plt

X_scaled = StandardScaler().fit_transform(
    df[["age", "premium", "n_contracts", "tenure_months"]]
)

inertias, silhouettes = [], []
for k in range(2, 11):
    km = KMeans(n_clusters=k, n_init=10, random_state=42).fit(X_scaled)
    inertias.append(km.inertia_)
    silhouettes.append(silhouette_score(X_scaled, km.labels_))

fig, axes = plt.subplots(1, 2, figsize=(10, 4))
axes[0].plot(range(2, 11), inertias, marker="o"); axes[0].set_title("elbow")
axes[1].plot(range(2, 11), silhouettes, marker="o"); axes[1].set_title("silhouette")
plt.show()`,
      },
      {
        title: "군집 적용 + 프로파일링",
        desc: "위에서 탐색한 결과로 k를 정한 뒤(예: 4) 최종 군집을 확정하고 해석합니다.",
        level: "advanced",
        code: `km = KMeans(n_clusters=4, n_init=10, random_state=42).fit(X_scaled)
df["segment"] = km.labels_

# 군집별 평균 프로파일 — 업무 언어로 이름 붙이는 근거
profile = df.groupby("segment")[
    ["age", "premium", "n_contracts", "tenure_months"]
].agg(["mean", "count"])
print(profile.round(1))
# 예: segment 2 = 고연령·고보험료·장기 유지 → 'VIP 장기고객'`,
      },
    ],
  },
  {
    id: "hierarchical",
    name: "계층적 군집",
    en: "Hierarchical Clustering",
    category: "ml",
    weight: 1,
    difficulty: 3,
    params: [
      { name: "linkage(method=...)", desc: "병합 기준 — 'ward'(군집 내 분산 최소, 균형 잡힌 군집)·'average'·'complete'·'single'(사슬 현상 주의)." },
      { name: "linkage(metric=...)", desc: "거리 정의 — ward는 유클리드 전용. 다른 거리가 필요하면 average/complete와 조합." },
      { name: "fcluster(t, criterion=...)", desc: "'maxclust'(군집 수 지정)·'distance'(병합 거리 임계로 자르기) — 덴드로그램을 보고 결정." },
      { name: "dendrogram(truncate_mode='lastp', p=...)", desc: "마지막 p개 병합만 표시 — 표본이 많을 때 그림 간소화." },
    ],
    summary: "가까운 것부터 병합해 나무(덴드로그램)로 — k를 미리 정하지 않아도 됨",
    intro:
      "가까운 점(군집)끼리 차례로 병합한 과정을 나무 그림(덴드로그램)으로 남기는 군집법입니다.\n\n- 그림을 적절한 높이에서 잘라 군집 수를 사후 결정 — K-평균과 보완 관계\n- 모든 쌍의 거리를 계산해 수천 건 이상이면 느림 — 대용량은 표본으로 구조 확인 후 K-평균으로 확정\n- 보험 예: 계약자 그룹 구조 탐색",
    sections: [
      {
        title: "군집 수를 지정해 바로 절단",
        desc: "덴드로그램을 그리기 전에, 원하는 군집 수를 지정해 결과부터 확인합니다.",
        level: "basic",
        code: `from sklearn.cluster import AgglomerativeClustering
from sklearn.preprocessing import StandardScaler

# ① 거리 기반이라 스케일링이 먼저 — 단위가 큰 보험료가 거리를 독점하지 않게
cols = ["age", "premium", "tenure_months"]
X_scaled = StandardScaler().fit_transform(df[cols])

# ② 군집 수를 직접 지정해 바로 절단 — n_clusters=3은 예시(2~5를 바꿔가며 확인)
#    linkage="ward" = 병합 시 군집 내 분산이 가장 적게 늘어나는 쌍부터(가장 무난한 기본값)
#    적정 군집 수 탐색(덴드로그램)·연결법 비교는 아래 고급 섹션 참조
hc = AgglomerativeClustering(n_clusters=3, linkage="ward")
df["cluster"] = hc.fit_predict(X_scaled)

# ③ 군집 크기 — 한 군집이 대부분을 삼키면 연결법·변수를 다시 봅니다
print("군집 크기")
print(df["cluster"].value_counts().sort_index())

# ④ 군집별 평균 프로파일 — K-평균과 같은 방식으로 업무 언어를 붙입니다
profile = df.groupby("cluster")[cols].mean()
profile["n"] = df["cluster"].value_counts().sort_index()
print(profile.round(1))`,
      },
      {
        title: "덴드로그램 + 군집 잘라내기",
        level: "advanced",
        code: `from scipy.cluster.hierarchy import linkage, dendrogram, fcluster
from sklearn.preprocessing import StandardScaler
import matplotlib.pyplot as plt

X_scaled = StandardScaler().fit_transform(df[["age", "premium", "tenure_months"]])

Z = linkage(X_scaled, method="ward")   # ward: 군집 내 분산 최소화

plt.figure(figsize=(12, 5))
dendrogram(Z, truncate_mode="lastp", p=30)
plt.ylabel("병합 거리")
plt.show()

# 덴드로그램을 보고 군집 수 결정 → 라벨 부여
df["cluster"] = fcluster(Z, t=4, criterion="maxclust")
print(df["cluster"].value_counts())`,
      },
      {
        title: "연결법 비교 — ward·average·complete·single",
        desc: "병합 기준만 바꿔 결과 차이를 비교합니다 — 위 셀의 X_scaled를 그대로 사용.",
        level: "advanced",
        code: `from scipy.cluster.hierarchy import linkage, fcluster
from sklearn.metrics import silhouette_score
import pandas as pd

for method in ["ward", "average", "complete", "single"]:
    lab = fcluster(linkage(X_scaled, method=method), t=4, criterion="maxclust")
    sizes = pd.Series(lab).value_counts().sort_index().tolist()
    print(f"{method:9s} silhouette={silhouette_score(X_scaled, lab):+.3f} 군집크기={sizes}")

# single은 가까운 점을 사슬처럼 이어붙여 한 군집이 거의 전부를 삼키기 쉽습니다(chaining).
# 실루엣 점수가 높아도 [597, 1, 1, 1] 같은 크기 분포면 업무적으로 쓸 수 없습니다 —
# 점수 하나만 보지 말고 군집 크기 분포를 반드시 함께 확인하세요.`,
      },
      {
        title: "군집을 PCA 2차원에 투영 — 눈으로 분리 확인",
        desc: "군집 라벨을 PCA 2축 산점도에 색으로 얹어 분리 여부를 눈으로 확인합니다.",
        level: "advanced",
        code: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.datasets import make_blobs
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import AgglomerativeClustering
from sklearn.decomposition import PCA

# 합성 데이터 — 실제로는 df[["age","premium",...]]를 씁니다(여기선 자체 완결용 합성)
# make_blobs = 뭉쳐 있는 군집을 일부러 만들어 주는 함수(random_state=42로 재현 고정)
X, _ = make_blobs(n_samples=400, centers=4, n_features=5,
                  cluster_std=1.6, random_state=42)
cols = ["age", "premium", "bmi", "tenure_months", "n_contracts"]
df = pd.DataFrame(X, columns=cols)

# ① 거리 기반이라 스케일링이 먼저 — 단위 큰 변수가 거리를 독점하지 않게(평균0·표준편차1)
X_scaled = StandardScaler().fit_transform(df[cols])

# ② 계층적 군집으로 라벨 부여 — 군집 수 4를 지정(ward = 군집 내 분산이 가장 적게 늘게 병합)
labels = AgglomerativeClustering(n_clusters=4, linkage="ward").fit_predict(X_scaled)

# ③ 변수 5개를 PCA 2축으로 눌러 담아 눈으로 확인 — 군집이 실제로 갈라지는지 보기 위함
proj = PCA(n_components=2, random_state=42).fit(X_scaled)
P = proj.transform(X_scaled)
ev = proj.explained_variance_ratio_

# ④ 산점도 — 군집 라벨로 색을 나누고, 군집별 중심(점들의 평균 위치)을 X로 표시
plt.figure(figsize=(7, 6))
plt.scatter(P[:, 0], P[:, 1], c=labels, s=12, alpha=0.6, cmap="viridis")
for k in np.unique(labels):
    cx, cy = P[labels == k, 0].mean(), P[labels == k, 1].mean()
    plt.scatter(cx, cy, c="red", marker="X", s=200, edgecolor="white")
    plt.text(cx, cy, f"  {k}", fontsize=12, weight="bold")
plt.xlabel(f"PC1 ({ev[0]:.1%})"); plt.ylabel(f"PC2 ({ev[1]:.1%})")
plt.title("계층적 군집 → PCA 2축 투영 (X=군집 중심)")
plt.show()

# 군집이 PCA 평면에서 서로 떨어져 보이면 실제로 분리가 잘 된 것입니다.
# 겹쳐 보이면: 2축 누적 설명분산이 낮거나(아래 %) 군집 수가 과·부족일 수 있습니다.
print(f"2축 누적 설명분산 = {ev.sum():.1%}")`,
      },
    ],
  },
  {
    id: "pca",
    name: "주성분분석(PCA)",
    en: "Principal Component Analysis",
    category: "ml",
    weight: 3,
    difficulty: 4,
    params: [
      { name: "n_components", desc: "정수면 성분 개수, 0~1 실수면 그 비율의 설명분산을 채우는 최소 개수 자동 선택(예: 0.9), 'mle'면 자동 추정." },
      { name: "whiten=True", desc: "각 성분의 분산을 1로 정규화 — PCA 출력을 다른 모델 입력으로 쓸 때." },
      { name: "svd_solver", desc: "'auto'(기본)·'randomized'(대규모 데이터 근사 고속)." },
      { name: "fit vs transform", desc: "학습 데이터에만 fit하고 검증·신규 데이터는 transform만 — 정보 누수 방지의 기본기." },
    ],
    summary: "상관된 여러 변수를 소수의 축으로 압축 — 차원 축소·시각화·다중공선성 해소",
    intro:
      "분산이 큰 방향부터 새 축(주성분)을 찾아 상관된 여러 변수를 소수 축으로 압축합니다.\n\n- 수십 개 변수를 2~3축으로 줄여 시각화, 회귀 전 다중공선성 해소 전처리\n- 로딩을 읽으면 '종합 규모 축'·'위험 성향 축' 같은 해석 가능\n- 보험 예: 계약 특성 변수 축약 후 세분화·시각화",
    tips: "- 분산 기반이라 스케일링 없이 쓰면 단위 큰 변수가 축을 독점\n- 성분 수는 누적 설명분산 80~90% 기준이 관례",
    sections: [
      {
        title: "2개 성분 지정 — 설명분산·2차원 산점도·로딩",
        desc: "성분 수 2를 지정해 바로 그림을 봅니다 — 성분 수 선택은 아래 고급 섹션.",
        level: "basic",
        code: `from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
import pandas as pd
import matplotlib.pyplot as plt

# ① 압축할 변수와 색으로 구분할 라벨 — 샘플로 바로 실행(실제 데이터면 열 이름만 교체)
X = df[["age", "premium", "bmi", "tenure_months", "n_contracts"]]
y = df["lapsed"].astype(int)

# ② 분산이 큰 방향을 찾는 방법이라 스케일링이 먼저 — 단위 큰 변수의 축 독점 방지
X_scaled = StandardScaler().fit_transform(X)

# ③ 성분 수를 2로 지정 — 눈으로 보려면 2축이 기본
#    (누적 설명분산 기준으로 성분 수를 고르는 방법은 아래 고급 섹션)
pca2 = PCA(n_components=2, random_state=42)
P = pca2.fit_transform(X_scaled)

# ④ 이 2축이 원래 정보의 몇 %를 담고 있나 — 낮으면 2D 그림만으로 결론내면 안 됩니다
ev = pca2.explained_variance_ratio_
print(f"PC1 {ev[0]:.1%} · PC2 {ev[1]:.1%} · 2축 합계 {ev.sum():.1%}")

# ⑤ 2차원 산점도 — 라벨(해지 여부)로 색을 나눠 군집·이상치를 눈으로 확인
plt.scatter(P[:, 0], P[:, 1], c=y, s=8, alpha=0.5, cmap="coolwarm")
plt.xlabel(f"PC1 ({ev[0]:.1%})"); plt.ylabel(f"PC2 ({ev[1]:.1%})")
plt.title("PCA 2축 투영")
plt.show()

# ⑥ 로딩 — 각 축이 어떤 변수의 조합인지(절댓값이 큰 변수가 그 축의 정체)
loadings = pd.DataFrame(pca2.components_.T, index=X.columns, columns=["PC1", "PC2"])
print(loadings.round(3))
# 예: PC1에 premium·n_contracts가 크게 실리면 → '거래 규모 축'으로 이름 붙일 수 있습니다`,
      },
      {
        title: "성분 수 결정 — 누적 설명분산 + 로딩",
        desc: "누적 설명분산으로 채택 성분 수를 정합니다 — 위 셀의 X·y를 그대로 사용.",
        level: "advanced",
        code: `from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
import pandas as pd
import matplotlib.pyplot as plt

# (연결) 기본 섹션 없이 단독 실행해도 되도록 — X·y가 없으면 샘플로 즉석 준비
try:
    X
    y
except NameError:
    df = pd.read_excel("policy.xlsx")
    X = df[["age", "premium", "bmi", "tenure_months", "n_contracts"]]
    y = df["lapsed"].astype(int)

X_scaled = StandardScaler().fit_transform(X)

pca = PCA()
Z = pca.fit_transform(X_scaled)

# 성분별 설명분산 — 누적 80~90%까지 채택
ratio = pca.explained_variance_ratio_
print(pd.Series(ratio.cumsum().round(3), name="누적설명분산"))

# 첫 두 성분으로 산점도 (라벨 색)
plt.scatter(Z[:, 0], Z[:, 1], c=y, s=8, alpha=0.5, cmap="coolwarm")
plt.xlabel("PC1"); plt.ylabel("PC2")
plt.show()

# 로딩: 각 주성분이 어떤 변수의 조합인지
loadings = pd.DataFrame(pca.components_[:2].T,
                        index=X.columns, columns=["PC1", "PC2"])
print(loadings.round(3))`,
      },
      {
        title: "whiten·파이프라인 — PCA를 모델 입력으로",
        desc: "설명분산 비율로 성분 수를 자동 선택해 누수 없이 모델에 연결합니다 — 위 셀의 X·y 사용.",
        level: "advanced",
        code: `from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score

# n_components=0.9 → 누적 설명분산 90%를 채우는 최소 성분 수를 PCA가 스스로 선택
# whiten=True → 각 성분의 분산을 1로 맞춰, 뒤에 오는 모델이 축 크기에 휘둘리지 않게
pipe = Pipeline([
    ("scaler", StandardScaler()),
    ("pca", PCA(n_components=0.9, whiten=True, random_state=42)),
    ("clf", LogisticRegression(max_iter=1000, class_weight="balanced")),
])

# 스케일러·PCA를 파이프라인 안에 넣어야 각 폴드에서 학습 폴드에만 fit — 정보 누수 방지
scores = cross_val_score(pipe, X, y, cv=5, scoring="roc_auc")
print(f"PCA(90%)+로지스틱 AUC = {scores.mean():.3f} ± {scores.std():.3f}")

pipe.fit(X, y)
print("자동 선택된 성분 수:", pipe.named_steps["pca"].n_components_, f"(원 변수 {X.shape[1]}개)")
# 샘플처럼 변수들이 서로 거의 무상관이면 압축할 여지가 없어 성분 수가 줄지 않습니다.
# PCA는 '변수들이 서로 상관되어 있을 때' 효과가 나는 방법입니다 — 먼저 상관행렬을 확인하세요.`,
      },
      {
        title: "t-SNE — 비선형 2차원 임베딩 대안",
        desc: "선형 PCA와 비선형 t-SNE 임베딩을 나란히 비교합니다 — 계산량·거리 왜곡 주의.",
        level: "advanced",
        code: `import matplotlib.pyplot as plt
import pandas as pd
from sklearn.datasets import make_classification
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE

# 합성 데이터(자체 완결용) — 실제로는 X=df[[...]], y=색으로 나눌 라벨을 씁니다
X, y = make_classification(n_samples=500, n_features=6, n_informative=4,
                           n_redundant=1, n_classes=3, n_clusters_per_class=1,
                           random_state=42)
cols = ["age", "premium", "bmi", "tenure_months", "n_contracts", "claims"]
df = pd.DataFrame(X, columns=cols); df["grade"] = y

# ① 분산 기반이라 스케일링이 먼저
X_scaled = StandardScaler().fit_transform(df[cols])

# ② PCA: 선형 — 분산이 큰 방향으로 곧게 투영(빠르고 해석 가능, 축=원변수의 조합)
P = PCA(n_components=2, random_state=42).fit_transform(X_scaled)

# ③ t-SNE: 비선형 — 가까운 점들의 '이웃 관계'를 보존해 군집을 더 잘 떼어 놓습니다
#    perplexity = 각 점이 고려하는 이웃 수(보통 5~50, 표본이 적으면 낮춤)
#    init="pca" = PCA 결과에서 출발(무작위 시작보다 안정적·재현적)
#    random_state=42 = 재현 고정
#    주의: 계산량이 큽니다(수천 건 이상이면 느림). 또 축 자체와 군집 사이 '거리'는
#          해석하면 안 됩니다(t-SNE는 국소 이웃만 보존하고 전역 거리는 왜곡).
emb = TSNE(n_components=2, perplexity=30, init="pca",
           random_state=42).fit_transform(X_scaled)

# ④ 같은 데이터를 PCA와 t-SNE로 나란히 비교 — 군집이 얼마나 더 잘 갈리는지
fig, axes = plt.subplots(1, 2, figsize=(12, 5))
axes[0].scatter(P[:, 0], P[:, 1], c=y, s=12, alpha=0.6, cmap="viridis")
axes[0].set_title("PCA (선형)"); axes[0].set_xlabel("PC1"); axes[0].set_ylabel("PC2")
axes[1].scatter(emb[:, 0], emb[:, 1], c=y, s=12, alpha=0.6, cmap="viridis")
axes[1].set_title("t-SNE (비선형)"); axes[1].set_xlabel("dim 1"); axes[1].set_ylabel("dim 2")
plt.show()

# 대개 t-SNE 쪽에서 군집이 더 또렷이 뭉쳐 보입니다 — 다만 '시각화 전용'이며,
# 이 좌표를 회귀·군집의 입력으로 넣는 것은 권하지 않습니다(거리 왜곡·비결정 재현 한계).
print("PCA·t-SNE 임베딩 완료 — 좌우 그림의 군집 분리를 비교하세요.")`,
      },
    ],
  },
  {
    id: "cross-validation",
    name: "교차검증·튜닝",
    en: "Cross-validation · GridSearchCV",
    category: "ml",
    weight: 4,
    difficulty: 3,
    params: [
      { name: "train_test_split(stratify=y)", desc: "클래스 비율을 유지한 계층 분할 — 분류 문제 기본. test_size로 비율(0.2 등) 지정." },
      { name: "cv", desc: "정수(분류는 자동 StratifiedKFold)·KFold(shuffle=True)·TimeSeriesSplit(시계열은 순서 유지 필수)." },
      { name: "scoring", desc: "'roc_auc'·'f1'·'neg_root_mean_squared_error' 등 문자열 지표 — 업무 목표에 맞는 지표로 튜닝해야 의미가 있습니다." },
      { name: "GridSearchCV(param_grid, n_jobs, refit)", desc: "탐색 격자·병렬 수·최적 조합 자동 재학습(기본 True). 파이프라인 파라미터는 '단계이름__파라미터' 표기." },
      { name: "RandomizedSearchCV(n_iter)", desc: "격자 대신 무작위 n_iter개 조합 — 파라미터가 많을 때 같은 예산으로 더 넓게 탐색." },
    ],
    summary: "데이터를 여러 번 나눠 성능을 안정적으로 추정하고 하이퍼파라미터를 탐색",
    intro:
      "데이터를 k조각으로 나눠 k번 학습·평가한 평균으로 성능을 안정적으로 추정하는 절차입니다.\n\n- 한 번의 train/test 분할은 운에 좌우 — 여러 번 나눠 평균으로 보고\n- GridSearchCV는 이 위에서 하이퍼파라미터 조합을 체계적으로 탐색\n- 어떤 모델이든 '성능 수치를 믿어도 되는가'를 보장하는 공통 인프라",
    tips: "- 분류는 stratify(계층 분할)로 클래스 비율 유지\n- 스케일링·인코딩은 Pipeline 안에 넣어 검증 폴드 정보 누수(data leakage) 차단",
    sections: [
      {
        title: "한 번 나눠 한 번 평가 — 가장 단순한 검증",
        desc: "8:2 단일 분할로 학습·평가합니다 — 교차검증이 왜 필요한지도 드러납니다.",
        level: "basic",
        code: `from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, roc_auc_score

# ① 설명변수와 목표 — 샘플로 바로 실행(실제 데이터면 열 이름만 교체)
X = df[["age", "premium", "bmi", "tenure_months", "n_contracts"]]
y = df["lapsed"].astype(int)

# ② 8:2로 한 번만 나눕니다 — test_size=0.2는 관례(데이터가 적으면 0.3)
#    stratify=y: 해지 비율을 학습·평가에 똑같이 유지(분류의 기본)
#    random_state=42: 같은 분할을 재현하기 위한 고정 시드(숫자 자체에 의미는 없음)
X_tr, X_te, y_tr, y_te = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42
)
print(f"학습 {len(X_tr)}건 · 평가 {len(X_te)}건 | 해지율 학습 {y_tr.mean():.1%} · 평가 {y_te.mean():.1%}")

# ③ 하이퍼파라미터를 지정해 바로 학습 — 탐색(GridSearchCV)은 아래 고급 섹션
model = LogisticRegression(max_iter=1000, class_weight="balanced")
model.fit(X_tr, y_tr)

# ④ 한 번 평가한 성능
proba = model.predict_proba(X_te)[:, 1]
print(f"정확도 {accuracy_score(y_te, model.predict(X_te)):.3f} · AUC {roc_auc_score(y_te, proba):.3f}")

# ⑤ 주의: 이 숫자 하나는 '어떻게 나뉘었나'라는 운에 흔들립니다.
#    시드만 바꿔 같은 모델을 다시 평가해 보면 값이 꽤 달라집니다 —
#    그래서 아래 고급 섹션에서 여러 번 나눠 평균(교차검증)으로 보고합니다.
for seed in [0, 1, 2]:
    Xa, Xb, ya, yb = train_test_split(X, y, test_size=0.2, stratify=y, random_state=seed)
    m = LogisticRegression(max_iter=1000, class_weight="balanced").fit(Xa, ya)
    print(f"  random_state={seed} → AUC {roc_auc_score(yb, m.predict_proba(Xb)[:, 1]):.3f}")`,
      },
      {
        title: "k-겹 교차검증 — 평균±표준편차로 보고",
        level: "advanced",
        code: `from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.linear_model import LogisticRegression

# 샘플로 바로 실행 — 실제 데이터면 열 이름만 교체
X = df[["age", "premium", "bmi", "tenure_months", "n_contracts"]]
y = df["lapsed"].astype(int)
model = LogisticRegression(max_iter=1000, class_weight="balanced")

# 최종 평가용 test는 처음에 떼어놓고 끝까지 봉인
X_tr, X_te, y_tr, y_te = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42
)

# 5-겹 교차검증 — 평균 ± 표준편차로 보고
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
scores = cross_val_score(model, X_tr, y_tr, cv=cv, scoring="roc_auc")
print(f"AUC = {scores.mean():.3f} ± {scores.std():.3f}")`,
      },
      {
        title: "GridSearchCV — 파이프라인째 튜닝",
        level: "advanced",
        code: `from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GridSearchCV

pipe = Pipeline([
    ("scaler", StandardScaler()),
    ("clf", LogisticRegression(max_iter=1000)),
])

grid = GridSearchCV(
    pipe,
    {"clf__C": [0.01, 0.1, 1, 10],
     "clf__class_weight": [None, "balanced"]},
    cv=5, scoring="roc_auc", n_jobs=-1,
).fit(X_tr, y_tr)

print(grid.best_params_, f"CV AUC={grid.best_score_:.3f}")
print(f"봉인해둔 test AUC = {grid.score(X_te, y_te):.3f}")`,
      },
      {
        title: "여러 분할 전략 — KFold·Stratified·Repeated·TimeSeries·Group",
        desc: "문제 성격에 맞는 분할기로 같은 모델을 검증합니다 — 위 셀의 X·y·model 사용.",
        level: "advanced",
        code: `from sklearn.model_selection import (KFold, StratifiedKFold, RepeatedKFold,
    TimeSeriesSplit, GroupKFold, cross_val_score)

splitters = {
    "KFold(5,shuffle)":  KFold(n_splits=5, shuffle=True, random_state=0),
    "StratifiedKFold(5)": StratifiedKFold(n_splits=5, shuffle=True, random_state=0),  # 분류 기본(클래스 비율 유지)
    "RepeatedKFold(5x3)": RepeatedKFold(n_splits=5, n_repeats=3, random_state=0),      # 반복으로 더 안정
}
for name, cv in splitters.items():
    s = cross_val_score(model, X, y, cv=cv, scoring="roc_auc")
    print(f"{name:20s} AUC {s.mean():.3f} ± {s.std():.3f}")

# 시계열: 과거로 학습·미래로 검증(순서 유지 — 절대 shuffle 금지)
print("TimeSeriesSplit 폴드 수:", TimeSeriesSplit(n_splits=5).get_n_splits())

# 그룹 누수 방지: 같은 고객이 학습·검증에 동시에 들어가지 않게
gs = cross_val_score(model, X, y, cv=GroupKFold(n_splits=5),
                     groups=df["customer_id"], scoring="roc_auc")
print(f"GroupKFold(고객 기준) AUC {gs.mean():.3f} ± {gs.std():.3f}")`,
      },
      {
        title: "다중 지표·예측 수집 — cross_validate·cross_val_predict",
        desc: "여러 지표를 한 번에 평가하고, out-of-fold 예측으로 과적합 없는 혼동행렬을 만듭니다.",
        level: "advanced",
        code: `from sklearn.model_selection import cross_validate, cross_val_predict
from sklearn.metrics import confusion_matrix
import pandas as pd

# 한 번에 여러 지표(+학습/검증 시간)
cvres = cross_validate(model, X, y, cv=5,
    scoring=["roc_auc", "average_precision", "f1"], return_train_score=True)
print(pd.DataFrame(cvres).filter(like="test_").mean().round(3))

# 각 표본이 '검증 폴드에 있을 때'의 예측 → 혼동행렬(누수 없는 진단)
oof = cross_val_predict(model, X, y, cv=5)
print("out-of-fold 혼동행렬\\n", confusion_matrix(y, oof))`,
      },
      {
        title: "중첩 교차검증 — 튜닝과 평가 분리(편향 없는 성능)",
        desc: "안쪽 루프에서 튜닝, 바깥 루프에서 '튜닝을 포함한 절차 전체'의 일반화 성능을 추정합니다.",
        level: "advanced",
        code: `from sklearn.model_selection import GridSearchCV, cross_val_score, StratifiedKFold
from sklearn.linear_model import LogisticRegression

inner = StratifiedKFold(5, shuffle=True, random_state=1)
outer = StratifiedKFold(5, shuffle=True, random_state=2)

grid = GridSearchCV(LogisticRegression(max_iter=1000),
                    {"C": [0.1, 1, 10]}, cv=inner, scoring="roc_auc")
# 바깥 루프가 안쪽 튜닝을 감싸므로 test 누수 없이 절차 전체를 평가
nested = cross_val_score(grid, X, y, cv=outer, scoring="roc_auc")
print(f"nested CV AUC = {nested.mean():.3f} ± {nested.std():.3f}")`,
      },
    ],
  },
  {
    id: "model-eval",
    name: "모델 평가 지표",
    en: "Evaluation Metrics",
    category: "ml",
    weight: 3,
    difficulty: 3,
    params: [
      { name: "confusion_matrix(normalize=...)", desc: "'true'면 행(실제 클래스) 기준 비율 — 클래스 크기가 달라도 읽기 쉬워집니다." },
      { name: "classification_report(target_names, digits)", desc: "클래스 표시 이름과 소수 자릿수 지정." },
      { name: "roc_auc_score(average=...)", desc: "다중 클래스면 'macro'(클래스 동일 가중)·'weighted'(빈도 가중), multi_class='ovr' 지정." },
      { name: "f1_score(average=...)", desc: "'binary'(기본)·'macro'·'micro'·'weighted' — 불균형 다중 분류 보고 시 macro를 함께." },
      { name: "RMSE 계산", desc: "신버전 root_mean_squared_error, 구버전 mean_squared_error 후 np.sqrt(squared=False 지원 상이)." },
    ],
    summary: "혼동행렬·정밀도·재현율·ROC-AUC·RMSE — 문제에 맞는 자로 재기",
    intro:
      "혼동행렬·정밀도·재현율·ROC-AUC·RMSE 등 문제에 맞는 자로 모델을 평가합니다.\n\n- 분류는 혼동행렬에서 출발 — 정밀도↔재현율은 상충, 임계값 무관 종합 지표는 ROC-AUC\n- 회귀는 RMSE(큰 오차에 민감)·MAE(평균 오차)·R²를 함께\n- 불균형 클래스에서 accuracy는 착시 — 해지·사기 예측은 재현율·PR-AUC로",
    tips: "- 놓치는 비용이 큰 문제(해지 예측)는 재현율, 오탐 비용이 큰 문제(마케팅 발송)는 정밀도 우선\n- PR-AUC는 심한 불균형에서 ROC-AUC보다 민감",
    sections: [
      {
        title: "평가 대상 준비 — 지정 설정으로 분류·회귀 모델 학습",
        desc: "아래 섹션들이 쓰는 model(분류)·reg(회귀)를 미리 학습해 둡니다 — 샘플로 그대로 실행.",
        level: "basic",
        code: `from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression, LinearRegression

# 하이퍼파라미터는 지정값 그대로 — 여기서는 '지표 읽는 법'에만 집중합니다.

# ① 분류: 해지 여부 예측 → model·X_te·y_te
X = df[["age", "premium", "bmi", "tenure_months", "n_contracts"]]
y = df["lapsed"].astype(int)
X_tr, X_te, y_tr, y_te = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42
)
model = LogisticRegression(max_iter=1000, class_weight="balanced").fit(X_tr, y_tr)

# ② 회귀: 보험료 예측 → reg·Xr_te·yr_te (목표가 달라 변수를 따로 둡니다)
Xr = df[["age", "bmi", "tenure_months", "n_contracts"]]
yr = df["premium"]
Xr_tr, Xr_te, yr_tr, yr_te = train_test_split(Xr, yr, test_size=0.2, random_state=42)
reg = LinearRegression().fit(Xr_tr, yr_tr)

print(f"준비 완료 — 분류 평가 {len(X_te)}건(해지 {y_te.sum()}건) · 회귀 평가 {len(Xr_te)}건")`,
      },
      {
        title: "분류 — 혼동행렬·리포트·ROC 곡선",
        level: "basic",
        code: `from sklearn.metrics import (
    confusion_matrix, classification_report,
    roc_auc_score, RocCurveDisplay,
)
import matplotlib.pyplot as plt

pred = model.predict(X_te)
proba = model.predict_proba(X_te)[:, 1]

print(confusion_matrix(y_te, pred))
#           예측0   예측1
#  실제0 [[ TN     FP ]
#  실제1  [ FN     TP ]]

print(classification_report(y_te, pred, target_names=["유지", "해지"]))
print(f"ROC-AUC = {roc_auc_score(y_te, proba):.3f}")

RocCurveDisplay.from_predictions(y_te, proba)
plt.show()`,
      },
      {
        title: "회귀 — RMSE·MAE·R²",
        level: "basic",
        code: `from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import numpy as np

pred = reg.predict(Xr_te)
print(f"RMSE = {np.sqrt(mean_squared_error(yr_te, pred)):,.0f}")  # 큰 오차에 민감
print(f"MAE  = {mean_absolute_error(yr_te, pred):,.0f}")          # 평균적 오차 크기
print(f"R2   = {r2_score(yr_te, pred):.3f}")                      # 설명 분산 비율`,
      },
      {
        title: "임계값 선택 — 업무 비용으로 컷오프 정하기 + PR 곡선",
        desc: "오탐·미탐 비용으로 임계값을 직접 고릅니다 — 위 셀의 model·X_te·y_te 사용.",
        level: "advanced",
        code: `from sklearn.metrics import (precision_recall_curve, average_precision_score,
    PrecisionRecallDisplay)
import numpy as np
import matplotlib.pyplot as plt

# (연결) 앞 섹션 없이 단독 실행해도 되도록 — 분류 model이 없으면 샘플로 즉석 준비
try:
    model, X_te
except NameError:
    import pandas as pd
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import train_test_split
    df = pd.read_excel("policy.xlsx")
    X = df[["age", "premium", "bmi", "tenure_months", "n_contracts"]]
    y = df["lapsed"].astype(int)
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42)
    model = LogisticRegression(max_iter=1000, class_weight="balanced").fit(X_tr, y_tr)

proba = model.predict_proba(X_te)[:, 1]

# PR-AUC — 심한 불균형에서 ROC-AUC보다 민감. 기준선(=양성 비율)과 비교해야 의미가 있습니다.
print(f"PR-AUC = {average_precision_score(y_te, proba):.3f} (찍기 수준 기준선 {y_te.mean():.3f})")
PrecisionRecallDisplay.from_predictions(y_te, proba)
plt.show()

# 임계값은 업무 비용으로 고릅니다.
# 예: 해지를 놓치면(FN) 500만원 손실, 불필요한 방어 마케팅(FP)은 20만원 비용
COST_FN, COST_FP = 5_000_000, 200_000

def total_cost(t):
    pred_t = (proba >= t).astype(int)
    fn = int(((y_te == 1) & (pred_t == 0)).sum())   # 놓친 해지
    fp = int(((y_te == 0) & (pred_t == 1)).sum())   # 헛방어
    return fn * COST_FN + fp * COST_FP

_, _, thr = precision_recall_curve(y_te, proba)
costs = [total_cost(t) for t in thr]
best = int(np.argmin(costs))

print(f"비용 최소 임계값 = {thr[best]:.3f} → 예상 비용 {costs[best]:,}원")
print(f"관례적 0.5 임계값  → 예상 비용 {total_cost(0.5):,}원")
# 놓치는 비용(FN)이 헛방어 비용(FP)보다 크면 임계값은 0.5보다 낮아집니다
# — 조금 헛방어를 하더라도 해지를 더 많이 잡는 쪽이 싸기 때문입니다.`,
      },
    ],
  },
  {
    id: "imbalanced",
    name: "불균형 데이터 처리",
    en: "Imbalanced Data",
    category: "ml",
    weight: 3,
    difficulty: 3,
    params: [
      { name: 'class_weight="balanced"', desc: "각 클래스 손실을 빈도 역수로 가중해 드문 양성을 강조 — RandomForest는 'balanced_subsample'도 가능." },
      { name: "resample(replace, n_samples, random_state)", desc: "sklearn.utils.resample — 복원추출(오버샘플)·비복원추출(언더샘플)로 재표집. 별도 패키지 없이 리샘플링을 처리하며 훈련셋에만 적용합니다." },
      { name: "sample_weight (fit 인자)", desc: "데이터를 복제하지 않고 표본별 손실 가중만으로 오버샘플과 같은 효과 — 메모리·학습이 가볍습니다." },
      { name: "predict_proba 임계값", desc: "predict()의 0.5는 관례일 뿐. 임계값을 낮추면 재현율↑·정밀도↓로 움직이므로 업무 비용으로 직접 고릅니다." },
      { name: "average_precision_score (PR-AUC)", desc: "심한 불균형에서 accuracy·ROC-AUC보다 민감한 평가 지표 — 찍기 수준 기준선(=양성 비율)과 비교해야 의미가 있습니다." },
      { name: "stratify=y (train_test_split)", desc: "훈련·평가 양쪽에 드문 양성을 같은 비율로 분배 — 리샘플링·가중 이전에 반드시 해두는 기본 전제." },
    ],
    summary: "드문 양성(사기·희귀사고·조기해지)을 놓치지 않게 — 가중·임계값·리샘플링",
    intro:
      "사기·희귀사고·조기해지처럼 양성이 전체의 몇 %뿐인 불균형 문제를 다룹니다.\n\n- accuracy는 착시 — 양성 5%면 전부 '음성'으로 찍어도 정확도 95%\n- 대응 3축: ① 학습 가중(class_weight·sample_weight) ② 임계값 이동 ③ 리샘플링\n- 평가는 accuracy 대신 재현율·PR-AUC — scikit-learn만으로 충분",
    tips: "- 리샘플링·가중은 순위 능력(PR-AUC)보다 0.5 임계값의 재현율을 올리는 효과 — 임계값·비용 조정을 먼저 검토\n- 리샘플링은 훈련셋에만 적용, 평가셋은 원래 불균형 그대로",
    sections: [
      {
        title: "문제 진단·기본 대응 — accuracy의 함정과 class_weight",
        desc: "합성 사기 데이터(양성 5%)로 accuracy 착시를 확인하고 class_weight로 재현율을 올립니다.",
        level: "basic",
        code: `# 사기·희귀사고·조기해지처럼 '양성(1)'이 드문 문제를 다룹니다.
# 합성 보험사기 데이터: 청구 10,000건 중 사기는 약 5%.
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (classification_report, confusion_matrix,
                             recall_score, precision_score,
                             average_precision_score, roc_auc_score)

rng = np.random.default_rng(42)   # seed 42 — 결과 재현
N = 10_000

# 특성: 청구금액(로그정규)·가입후경과월·과거청구횟수·야간사고여부
claim_amt = rng.lognormal(mean=6.0, sigma=1.0, size=N)      # 건당 청구금액
tenure    = rng.integers(1, 120, size=N)                    # 가입 후 경과월
past_cnt  = rng.poisson(0.8, size=N)                        # 과거 청구 횟수
night     = rng.integers(0, 2, size=N)                      # 야간 사고(1)

# 사기 성향 점수 — 금액↑·경과월↓·과거청구↑·야간이면 사기 확률↑
z = (0.0009 * claim_amt + 0.9 * past_cnt + 0.6 * night
     - 0.015 * tenure - 4.4)
p_fraud = 1 / (1 + np.exp(-z))
fraud = rng.binomial(1, p_fraud)                            # 실제 사기 여부(양성=1)

df = pd.DataFrame({
    "claim_amt": claim_amt, "tenure": tenure,
    "past_cnt": past_cnt, "night": night, "fraud": fraud,
})

# 1) 불균형 비율부터 확인 — 얼마나 드문가?
n_pos = int(df["fraud"].sum())
rate = df["fraud"].mean()
print(f"전체 {N:,}건 중 사기 {n_pos}건 (양성 비율 {rate:.1%})")
print(f"불균형 비율(음성:양성) = {(N - n_pos) / n_pos:.1f} : 1")
print()

X = df[["claim_amt", "tenure", "past_cnt", "night"]]
y = df["fraud"]
# stratify=y — 훈련/평가 양쪽에 드문 양성이 같은 비율로 들어가게 유지
X_tr, X_te, y_tr, y_te = train_test_split(
    X, y, test_size=0.3, stratify=y, random_state=42)

# 2) accuracy의 함정 — '전부 정상'이라고만 찍어도 정확도는 높다
dummy_pred = np.zeros(len(y_te), dtype=int)       # 무조건 음성(정상) 예측
acc_dummy = (dummy_pred == y_te).mean()
print(f"[함정] 모두 '정상'으로 예측 → 정확도 {acc_dummy:.1%} … 하지만 사기는 한 건도 못 잡음")
print(f"        재현율(잡아낸 사기 비율) = {recall_score(y_te, dummy_pred, zero_division=0):.3f}")
print()

# 3) 기본 대응 — class_weight='balanced'로 드문 클래스에 가중
#    (양성을 틀리는 손실을 자동으로 크게 잡아, 소수 클래스를 더 신경 쓰게 함)
base = LogisticRegression(max_iter=2000).fit(X_tr, y_tr)                      # 가중 없음
bal  = LogisticRegression(max_iter=2000, class_weight="balanced").fit(X_tr, y_tr)

for name, mdl in [("가중 없음", base), ("class_weight=balanced", bal)]:
    pred = mdl.predict(X_te)
    proba = mdl.predict_proba(X_te)[:, 1]
    print(f"── {name} ──")
    print(f"  정확도 {(pred == y_te).mean():.3f} · "
          f"재현율 {recall_score(y_te, pred, zero_division=0):.3f} · "
          f"정밀도 {precision_score(y_te, pred, zero_division=0):.3f}")
    # PR-AUC(=Average Precision): 불균형에서 accuracy·ROC-AUC보다 민감한 핵심 지표
    print(f"  PR-AUC {average_precision_score(y_te, proba):.3f} "
          f"(찍기 기준선 {y_te.mean():.3f}) · ROC-AUC {roc_auc_score(y_te, proba):.3f}")
print()

# 4) 혼동행렬·리포트로 마무리 확인 — 어디를 놓치고 어디를 헛짚나
pred_bal = bal.predict(X_te)
print("혼동행렬 [행=실제, 열=예측]  (0=정상, 1=사기)")
print(confusion_matrix(y_te, pred_bal))
print(classification_report(y_te, pred_bal, target_names=["정상", "사기"], zero_division=0))

# 해석: 불균형에서는 accuracy가 높아도 무의미할 수 있습니다.
# 드문 사기를 '얼마나 잡아내는가(재현율)'와 PR-AUC로 평가하는 것이 출발점입니다.`,
      },
      {
        title: "임계값 이동 + 비용곡선 — 총비용 최소 컷오프",
        desc: "미탐(FN)·오탐(FP) 비용을 반영해 총비용 최소 임계값을 직접 고릅니다.",
        level: "advanced",
        code: `# predict_proba의 0.5는 관례일 뿐. 재현율↔정밀도를 업무 목적에 맞게 옮기고,
# 미탐(FN)·오탐(FP) 비용을 반영해 '총비용 최소' 임계값을 직접 고릅니다.
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (precision_recall_curve, recall_score,
                             precision_score, confusion_matrix)

rng = np.random.default_rng(42)   # seed 42 — 재현
N = 10_000
claim_amt = rng.lognormal(6.0, 1.0, N)
tenure    = rng.integers(1, 120, N)
past_cnt  = rng.poisson(0.8, N)
night     = rng.integers(0, 2, N)
z = 0.0009 * claim_amt + 0.9 * past_cnt + 0.6 * night - 0.015 * tenure - 4.4
fraud = rng.binomial(1, 1 / (1 + np.exp(-z)))     # 양성(사기) 약 5%

df = pd.DataFrame({"claim_amt": claim_amt, "tenure": tenure,
                   "past_cnt": past_cnt, "night": night, "fraud": fraud})
X = df[["claim_amt", "tenure", "past_cnt", "night"]]
y = df["fraud"]
X_tr, X_te, y_tr, y_te = train_test_split(
    X, y, test_size=0.3, stratify=y, random_state=42)

model = LogisticRegression(max_iter=2000).fit(X_tr, y_tr)
proba = model.predict_proba(X_te)[:, 1]           # 양성일 추정확률

# 1) 임계값 이동 — 낮출수록 사기를 더 많이 잡지만(재현율↑) 헛짚음도 늘어남(정밀도↓)
print("임계값별 재현율·정밀도 (사기 탐지)")
print(f"{'임계값':>6} {'재현율':>8} {'정밀도':>8} {'적발수':>8}")
for t in [0.5, 0.3, 0.2, 0.1, 0.05]:
    pred_t = (proba >= t).astype(int)
    rec = recall_score(y_te, pred_t, zero_division=0)
    prec = precision_score(y_te, pred_t, zero_division=0)
    print(f"{t:>6.2f} {rec:>8.3f} {prec:>8.3f} {int(pred_t.sum()):>8}")
print("→ 임계값을 낮추면 재현율↑·정밀도↓ (상충 관계)")
print()

# 2) 비용곡선 — 미탐·오탐 비용을 넣어 '총비용 최소' 임계값 찾기
#    사기를 놓치면(FN) 지급 손실 300만원, 정상 청구를 사기로 의심(FP)하면
#    조사·고객불만 비용 50만원이라고 가정합니다(값은 실무 데이터로 대체).
COST_FN, COST_FP = 3_000_000, 500_000

def total_cost(t):
    pred_t = (proba >= t).astype(int)
    fn = int(((y_te == 1) & (pred_t == 0)).sum())   # 놓친 사기
    fp = int(((y_te == 0) & (pred_t == 1)).sum())   # 헛조사
    return fn * COST_FN + fp * COST_FP

grid = np.linspace(0.01, 0.99, 99)
costs = np.array([total_cost(t) for t in grid])
best_t = grid[int(np.argmin(costs))]

print(f"비용 최소 임계값 = {best_t:.2f} → 총비용 {total_cost(best_t):,.0f}원")
print(f"관례적 0.50 임계값 → 총비용 {total_cost(0.5):,.0f}원")
print(f"절감액 = {total_cost(0.5) - total_cost(best_t):,.0f}원")
# 놓치는 비용(FN)이 헛짚는 비용(FP)보다 크므로 최적 임계값은 0.5보다 낮아집니다.
print()
print("최적 임계값에서의 혼동행렬 [행=실제, 열=예측]")
print(confusion_matrix(y_te, (proba >= best_t).astype(int)))

# 3) 시각화 — 비용곡선과 최적점
plt.figure(figsize=(7, 4))
plt.plot(grid, costs / 1e6, color="#3E6AE1", label="총비용")
plt.axvline(best_t, color="#B45309", linestyle="--",
            label=f"최소 임계값 {best_t:.2f}")
plt.axvline(0.5, color="#94A3B8", linestyle=":", label="관례 0.5")
plt.xlabel("임계값(threshold)"); plt.ylabel("총비용 (백만원)")
plt.title("미탐·오탐 비용 반영 총비용 곡선")
plt.legend(); plt.tight_layout()
plt.show()

# 해석: 임계값은 통계가 아니라 '비용'이 정합니다. FN이 비싸면 임계값을 낮춰
# 재현율을 확보하고, FP가 비싸면 높여 정밀도를 지키는 것이 원칙입니다.`,
      },
      {
        title: "리샘플링 — 오버·언더샘플 vs sample_weight (sklearn만)",
        desc: "resample 오버·언더샘플과 sample_weight를 대조합니다 — SMOTE는 주석 개념만(웹 미설치).",
        level: "advanced",
        code: `# 드문 양성 클래스를 늘리거나(오버샘플) 다수 음성을 줄여(언더샘플) 균형을 맞춥니다.
# 별도 패키지(imbalanced-learn/SMOTE) 없이 sklearn.utils.resample 로만 처리합니다.
import numpy as np
import pandas as pd
from sklearn.utils import resample
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import recall_score, precision_score, average_precision_score

rng = np.random.default_rng(42)   # seed 42
N = 10_000
claim_amt = rng.lognormal(6.0, 1.0, N)
tenure    = rng.integers(1, 120, N)
past_cnt  = rng.poisson(0.8, N)
night     = rng.integers(0, 2, N)
z = 0.0009 * claim_amt + 0.9 * past_cnt + 0.6 * night - 0.015 * tenure - 4.4
fraud = rng.binomial(1, 1 / (1 + np.exp(-z)))     # 양성(사기) 약 5%

df = pd.DataFrame({"claim_amt": claim_amt, "tenure": tenure,
                   "past_cnt": past_cnt, "night": night, "fraud": fraud})
feat = ["claim_amt", "tenure", "past_cnt", "night"]

# 중요: 리샘플링은 '훈련셋에만' 적용합니다. 평가셋은 원래 불균형 그대로 두어야
#       실제 운영 성능을 정직하게 측정할 수 있습니다.
train, test = train_test_split(df, test_size=0.3, stratify=df["fraud"],
                               random_state=42)
X_te, y_te = test[feat], test["fraud"]

def evaluate(train_df, tag):
    mdl = LogisticRegression(max_iter=2000).fit(train_df[feat], train_df["fraud"])
    proba = mdl.predict_proba(X_te)[:, 1]
    pred = (proba >= 0.5).astype(int)
    print(f"{tag:<22} 훈련 양성비 {train_df['fraud'].mean():.2%} · "
          f"재현율 {recall_score(y_te, pred, zero_division=0):.3f} · "
          f"정밀도 {precision_score(y_te, pred, zero_division=0):.3f} · "
          f"PR-AUC {average_precision_score(y_te, proba):.3f}")

pos = train[train["fraud"] == 1]      # 소수(사기)
neg = train[train["fraud"] == 0]      # 다수(정상)
print(f"훈련셋 원본 — 정상 {len(neg)} · 사기 {len(pos)}")
print()

# 0) 기준선 — 원본 불균형 그대로
evaluate(train, "① 원본(불균형)")

# 1) 오버샘플링 — 소수(사기)를 복원추출로 다수 크기까지 늘림
pos_over = resample(pos, replace=True, n_samples=len(neg), random_state=42)
train_over = pd.concat([neg, pos_over])
evaluate(train_over, "② 소수 오버샘플")

# 2) 언더샘플링 — 다수(정상)를 비복원추출로 소수 크기까지 줄임
neg_under = resample(neg, replace=False, n_samples=len(pos), random_state=42)
train_under = pd.concat([neg_under, pos])
evaluate(train_under, "③ 다수 언더샘플")

# 3) 리샘플링 없이 sample_weight — 데이터 복제 대신 손실 가중으로 같은 효과
#    (오버샘플과 개념이 같지만 데이터를 늘리지 않아 메모리·학습이 가볍습니다)
w = np.where(train["fraud"] == 1, len(neg) / len(pos), 1.0)   # 소수에 큰 가중
mdl_w = LogisticRegression(max_iter=2000).fit(
    train[feat], train["fraud"], sample_weight=w)
proba_w = mdl_w.predict_proba(X_te)[:, 1]
pred_w = (proba_w >= 0.5).astype(int)
print(f"{'④ sample_weight':<22} 훈련 양성비 {train['fraud'].mean():.2%}(원본) · "
      f"재현율 {recall_score(y_te, pred_w, zero_division=0):.3f} · "
      f"정밀도 {precision_score(y_te, pred_w, zero_division=0):.3f} · "
      f"PR-AUC {average_precision_score(y_te, proba_w):.3f}")

# ─ SMOTE는 개념만(웹 실행기에 미설치) ─
# SMOTE(Synthetic Minority Over-sampling): 단순 복제 대신 소수 샘플과 그 이웃 사이를
# 선형 보간해 '새로운' 합성 양성을 만듭니다(과적합 완화). imbalanced-learn 패키지가
# 필요하므로 여기서는 사용하지 않고, sklearn.utils.resample 오버샘플로 대체했습니다.

# 해석: 리샘플링은 PR-AUC(순위 능력)를 크게 바꾸지 않지만, 0.5 임계값에서의
# 재현율을 끌어올립니다 — 사실상 '임계값 이동'과 비슷한 효과입니다. 언더샘플은
# 데이터 손실로 분산이 커질 수 있고, 오버샘플/가중은 소수 패턴을 과신할 위험이
# 있으니, 리샘플링보다 임계값·비용 조정을 먼저 검토하는 것이 안전합니다.`,
      },
    ],
  },
  {
    id: "calibration",
    name: "확률 캘리브레이션",
    en: "Probability Calibration",
    category: "ml",
    weight: 2,
    difficulty: 3,
    params: [
      { name: "calibration_curve(n_bins, strategy)", desc: "예측확률을 몇 구간으로 묶을지(n_bins)와 분할 방식 — 'uniform'(등폭)·'quantile'(구간당 표본 수 균등, 확률 분포가 치우쳤을 때 안정)." },
      { name: "CalibratedClassifierCV(method)", desc: "'isotonic'(비모수 단조 계단, 데이터 넉넉할 때 유연)·'sigmoid'(Platt 로지스틱, 데이터 적을 때 안정적으로 S자 한 개로 교정)." },
      { name: "CalibratedClassifierCV(cv)", desc: "교차검증 fold 수 — 교정 함수를 학습 데이터 누수 없이 적합. 'prefit'이면 이미 학습된 모델에 별도 보정셋으로만 교정." },
      { name: "CalibratedClassifierCV(ensemble)", desc: "True(기본)면 fold별 보정기를 앙상블 평균, False면 하나의 보정기만 적합 — 대용량에서 가볍게." },
      { name: "brier_score_loss(pos_label)", desc: "양성 클래스 라벨 지정 — 예측확률과 0/1 실제값의 평균제곱오차(낮을수록 확률이 정확)." },
    ],
    summary: "예측 확률 자체가 실제 빈도와 맞는가 — 순위(AUC) 너머 요율의 전제",
    intro:
      "모델이 말한 확률 값 자체가 실제 빈도와 맞는지 진단·교정하는 절차입니다.\n\n- AUC는 순위만 봄 — '확률 0.3' 계약들이 실제 약 30% 발생해야 보정된 것\n- 진단은 캘리브레이션 곡선·Brier 점수, 교정은 isotonic·sigmoid\n- 보험 예: 순수보험료=사고확률×심도 — 과신 확률을 요율에 쓰면 고위험 과다·저위험 과소 책정으로 역선택",
    tips: "- 캘리브레이션은 AUC와 무관하게 따로 확인 — 순위가 완벽해도 확률은 과신일 수 있음\n- 곡선이 45°선 아래로 처지면 과신(예측>실제)\n- 데이터 적으면 sigmoid, 넉넉하면 isotonic이 안전",
    sections: [
      {
        title: "캘리브레이션 곡선·Brier — 확률이 실제 빈도와 맞는지 검진",
        desc: "'평균 예측확률 vs 실제 빈도' 곡선과 Brier 점수로 진단합니다 — 과신 모델로 시연.",
        level: "basic",
        code: `import numpy as np
import matplotlib.pyplot as plt
from sklearn.naive_bayes import GaussianNB
from sklearn.model_selection import train_test_split
from sklearn.calibration import calibration_curve
from sklearn.metrics import brier_score_loss, roc_auc_score

rng = np.random.default_rng(42)
n = 4000

# 합성 계약 데이터 — 해지 여부(1=해지)를 예측한다고 가정
# 진짜 신호(signal)로 해지 확률을 만들고, 라벨은 그 확률로 베르누이 추출
age = rng.normal(45, 12, n)
tenure = rng.uniform(1, 120, n)          # 유지 개월
signal = 0.05 * (age - 45) - 0.015 * (tenure - 60)
p_true = 1 / (1 + np.exp(-signal))
y = rng.binomial(1, p_true)

# 일부러 과신하는 모델: 같은 신호의 상관 높은 '복사본' 6개를 독립 변수인 척 투입
# 나이브 베이즈는 변수 독립을 가정 → 중복 증거를 곱해 확률을 0/1 극단으로 밀어붙임
X = np.column_stack([signal + rng.normal(0, 0.6, n) for _ in range(6)])

X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.3,
                                          stratify=y, random_state=42)
model = GaussianNB().fit(X_tr, y_tr)
proba = model.predict_proba(X_te)[:, 1]   # 해지 예측 확률

# 순위 성능(AUC)은 멀쩡할 수 있다 — 그래도 확률 값은 틀릴 수 있음
print(f"AUC(순위 성능)      = {roc_auc_score(y_te, proba):.3f}")
print(f"Brier score(확률 정확도) = {brier_score_loss(y_te, proba):.4f}  (낮을수록 좋음)")
print(f"실제 평균 해지율    = {y_te.mean():.3f}")
print(f"예측 평균 해지율    = {proba.mean():.3f}  (실제와 벌어지면 편향 신호)")

# 캘리브레이션 곡선: 예측확률을 10구간으로 묶어 '평균 예측확률' vs '실제 빈도' 비교
frac_pos, mean_pred = calibration_curve(y_te, proba, n_bins=10, strategy="quantile")
print("\\n예측확률 구간별  [평균예측 → 실제빈도]")
for mp, fp in zip(mean_pred, frac_pos):
    flag = "과신(예측>실제)" if mp > fp + 0.03 else ("과소" if mp < fp - 0.03 else "양호")
    print(f"  {mp:5.3f} → {fp:5.3f}   {flag}")

plt.figure(figsize=(5.5, 5.5))
plt.plot([0, 1], [0, 1], "k--", label="완벽한 보정(45°)")
plt.plot(mean_pred, frac_pos, "o-", color="#3E6AE1", label="이 모델")
plt.xlabel("평균 예측 확률")
plt.ylabel("실제 해지 빈도")
plt.title("Calibration curve — 곡선이 45°선 아래면 과신")
plt.legend()
plt.tight_layout()
plt.show()

# 해석: 45°선 '아래'에 있는 점 = 그 구간에서 모델이 말한 확률보다 실제 빈도가 낮음 → 과신.
# 요율·기대손해에 확률을 그대로 쓰려면 이 곡선이 45°선에 붙어 있어야 안전합니다.`,
      },
      {
        title: "재보정 — CalibratedClassifierCV로 과신 확률 바로잡기",
        desc: "isotonic·sigmoid 두 방식으로 재보정 전후 곡선과 Brier를 비교합니다.",
        level: "advanced",
        code: `import numpy as np
import matplotlib.pyplot as plt
from sklearn.naive_bayes import GaussianNB
from sklearn.model_selection import train_test_split
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.metrics import brier_score_loss

rng = np.random.default_rng(42)
n = 4000
age = rng.normal(45, 12, n)
tenure = rng.uniform(1, 120, n)
signal = 0.05 * (age - 45) - 0.015 * (tenure - 60)
p_true = 1 / (1 + np.exp(-signal))
y = rng.binomial(1, p_true)
# 상관 높은 복사본 6개 → 나이브 베이즈가 과신
X = np.column_stack([signal + rng.normal(0, 0.6, n) for _ in range(6)])

X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.3,
                                          stratify=y, random_state=42)

# 원본(과신) 모델
base = GaussianNB().fit(X_tr, y_tr)
proba_raw = base.predict_proba(X_te)[:, 1]

# 재보정 두 방식 — 학습 데이터에서 교차검증으로 교정 함수를 학습
#  isotonic: 단조 계단 함수(비모수) — 데이터가 넉넉할 때 유연
#  sigmoid : 로지스틱(Platt) — 데이터가 적을 때 안정적, S자 한 개로 교정
iso = CalibratedClassifierCV(GaussianNB(), method="isotonic", cv=5).fit(X_tr, y_tr)
sig = CalibratedClassifierCV(GaussianNB(), method="sigmoid", cv=5).fit(X_tr, y_tr)
proba_iso = iso.predict_proba(X_te)[:, 1]
proba_sig = sig.predict_proba(X_te)[:, 1]

# Brier 점수 비교(낮을수록 확률이 정확) — 순위(AUC)는 재보정해도 거의 안 변함
print("Brier score (낮을수록 좋음)")
for name, p in [("원본(과신)", proba_raw), ("isotonic", proba_iso), ("sigmoid", proba_sig)]:
    print(f"  {name:10s} = {brier_score_loss(y_te, p):.4f}")
print(f"\\n실제 평균 해지율 = {y_te.mean():.3f}")
print(f"예측 평균  원본 {proba_raw.mean():.3f} · isotonic {proba_iso.mean():.3f} · sigmoid {proba_sig.mean():.3f}")

# 재보정 전후 캘리브레이션 곡선 겹쳐 그리기
plt.figure(figsize=(6, 6))
plt.plot([0, 1], [0, 1], "k--", label="완벽한 보정")
for name, p, c in [("원본(과신)", proba_raw, "#C0392B"),
                   ("isotonic", proba_iso, "#3E6AE1"),
                   ("sigmoid", proba_sig, "#27AE60")]:
    fp, mp = calibration_curve(y_te, p, n_bins=10, strategy="quantile")
    plt.plot(mp, fp, "o-", color=c, label=name)
plt.xlabel("평균 예측 확률")
plt.ylabel("실제 해지 빈도")
plt.title("재보정 전후 Calibration curve")
plt.legend()
plt.tight_layout()
plt.show()

# 해석: 재보정 후 곡선이 45°선에 더 붙고 Brier가 내려가면 확률이 개선된 것.
# 원본의 극단 확률(0.99 등)이 실제 빈도 쪽으로 당겨져 요율 산정에 쓸 수 있게 됩니다.`,
      },
      {
        title: "왜 요율에 중요한가 — 보정 안 된 확률로 기대손해를 쓸 때의 위험",
        desc: "과신 확률을 순수보험료(사고확률×심도)에 쓸 때의 편향을 재보정 전후로 대조합니다.",
        level: "advanced",
        code: `import numpy as np
import matplotlib.pyplot as plt
from sklearn.naive_bayes import GaussianNB
from sklearn.model_selection import train_test_split
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import brier_score_loss

rng = np.random.default_rng(42)
n = 4000
age = rng.normal(45, 12, n)
tenure = rng.uniform(1, 120, n)
signal = 0.05 * (age - 45) - 0.015 * (tenure - 60)
p_true = 1 / (1 + np.exp(-signal))
y = rng.binomial(1, p_true)                 # 1 = 사고 발생
X = np.column_stack([signal + rng.normal(0, 0.6, n) for _ in range(6)])

X_tr, X_te, y_tr, y_te, sig_tr, sig_te = train_test_split(
    X, y, signal, test_size=0.3, stratify=y, random_state=42)

# 계약별 사고 심도(사고 시 지급액) — 여기서는 단순화해 300만원 고정으로 가정
severity = 3_000_000.0

# 과신 모델 vs 재보정(isotonic) 모델의 사고확률
base = GaussianNB().fit(X_tr, y_tr)
cal = CalibratedClassifierCV(GaussianNB(), method="isotonic", cv=5).fit(X_tr, y_tr)
p_raw = base.predict_proba(X_te)[:, 1]
p_cal = cal.predict_proba(X_te)[:, 1]

# 순수보험료(기대손해) = 사고확률 × 심도 → 포트폴리오 합계
expected_raw = (p_raw * severity).sum()
expected_cal = (p_cal * severity).sum()
actual_loss = (y_te * severity).sum()       # 실제 발생한 총손해

print(f"평가 계약 수            = {len(y_te):,}건")
print(f"실제 총손해            = {actual_loss:15,.0f} 원")
print(f"과신 모델 예측 총손해   = {expected_raw:15,.0f} 원  "
      f"(오차 {expected_raw/actual_loss - 1:+.1%})")
print(f"재보정 예측 총손해      = {expected_cal:15,.0f} 원  "
      f"(오차 {expected_cal/actual_loss - 1:+.1%})")
print(f"\\nBrier  원본 {brier_score_loss(y_te, p_raw):.4f} → 재보정 {brier_score_loss(y_te, p_cal):.4f}")

# 세분 요율의 위험: 위험군(사고확률 상위)에서 과신이 특히 커진다
order = np.argsort(-p_raw)
top = order[:len(order) // 5]               # 예측 위험 상위 20%
print("\\n[예측 위험 상위 20% 구간]")
print(f"  실제 사고율         = {y_te[top].mean():.3f}")
print(f"  과신 모델 평균 확률 = {p_raw[top].mean():.3f}  → 보험료 과다 청구 위험")
print(f"  재보정 평균 확률    = {p_cal[top].mean():.3f}")

labels = ["실제\\n총손해", "과신 모델\\n예측", "재보정\\n예측"]
vals = [actual_loss, expected_raw, expected_cal]
plt.figure(figsize=(6, 4.5))
plt.bar(labels, vals, color=["#555555", "#C0392B", "#3E6AE1"])
plt.axhline(actual_loss, color="#555555", ls="--", lw=1)
plt.ylabel("포트폴리오 총손해 (원)")
plt.title("보정 안 된 확률 → 예측 총손해 편향")
plt.tight_layout()
plt.show()

# 해석: 과신 확률을 그대로 순수보험료에 넣으면 포트폴리오 합계가 실제 총손해와 어긋나
# 요율이 전반적으로 높거나 낮게 책정됩니다. 특히 고위험군의 과다 청구·저위험군의
# 과소 책정이 동시에 생겨 역선택을 부릅니다 — 요율 산정 전 재보정이 필요한 이유입니다.`,
      },
    ],
  },
  {
    id: "anomaly",
    name: "이상치 탐지",
    en: "Anomaly Detection",
    category: "ml",
    weight: 2,
    difficulty: 3,
    params: [
      { name: "contamination", desc: "데이터에 섞인 이상치 비율의 사전 추정치 — 표시 건수를 좌우합니다. 크게 잡으면 많이 표시(재현율↑·오탐↑), 작게 잡으면 확실한 것만. 'auto'도 가능." },
      { name: "n_estimators (IsolationForest)", desc: "격리 트리 개수 — 많을수록 점수가 안정적입니다(기본 100, 200 권장). 값을 늘려도 과적합 위험은 없습니다." },
      { name: "n_neighbors (LOF)", desc: "국소 밀도를 계산할 이웃 수 — 결과에 가장 민감한 값입니다. 작으면 아주 국소적인 이상, 크면 넓은 범위의 이상을 봅니다(기본 20)." },
      { name: "novelty (LOF)", desc: "False(기본)면 학습 데이터 자체를 채점, True면 정상만 학습한 뒤 새 관측을 predict로 판정 — 실시간 감시 시스템에 씁니다." },
      { name: "decision_function / score_samples", desc: "이상 점수 산출 — decision_function은 0 미만이면 이상, score_samples는 클수록 정상. 임계값을 직접 정할 때 사용." },
    ],
    summary: "라벨 없이 비정상 청구를 찾는 IsolationForest·LOF·EllipticEnvelope",
    intro:
      "라벨 없이 다수와 동떨어진 관측을 골라내는 비지도 학습입니다.\n\n- IsolationForest=전역(홀로 빨리 격리)·LOF=국소(이웃보다 성긴 밀도)·EllipticEnvelope=정규 타원 가정\n- 방법마다 강약이 달라 여러 결과가 합의되는 건을 신뢰\n- 보험 예: 비정상 청구·사기 심사의 1차 스크리닝 — 우선 검토 순위 부여",
    tips: "- '이상'은 통계적 이례일 뿐 곧 '사기'가 아님 — 최종 판단은 심사·조사 등 도메인 검토 필수\n- 세 방법 모두 표시한 합의 건이 우선 검토 1순위",
    sections: [
      {
        title: "IsolationForest 기본 — 학습·이상 점수·상위 이상치·산점도",
        desc: "contamination을 지정해 이상 점수·상위 이상치·산점도를 확인합니다 — 합성 청구 데이터로 실행.",
        level: "basic",
        code: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.ensemble import IsolationForest

# 합성 청구 데이터 — 정상 청구 + 비정상(과다/이례) 청구 5%
rng = np.random.default_rng(42)
n_normal = 570
n_anom = 30  # 전체의 5%

# 정상: 건당 손해액(만원)과 처리일수가 서로 붙어 다니는 정상 군집
amt_n = rng.lognormal(mean=5.0, sigma=0.35, size=n_normal)      # 대략 100~250만원대
days_n = 0.02 * amt_n + rng.normal(7, 1.5, size=n_normal)       # 금액에 비례한 처리일수
# 비정상: 손해액이 비정상적으로 크거나 처리일수 패턴이 어긋난 청구
amt_a = rng.lognormal(mean=6.4, sigma=0.5, size=n_anom)         # 훨씬 큰 금액
days_a = rng.normal(4, 3, size=n_anom)                          # 큰 금액인데 처리일수는 짧음(이상)

df = pd.DataFrame({
    "claim_amt": np.concatenate([amt_n, amt_a]),
    "process_days": np.concatenate([days_n, days_a]),
    "is_fraud": np.concatenate([np.zeros(n_normal), np.ones(n_anom)]).astype(int),  # 참고용(모델은 안 씀)
})
df = df.sample(frac=1, random_state=42).reset_index(drop=True)  # 뒤섞기
X = df[["claim_amt", "process_days"]]
print("데이터 크기:", X.shape, "| 실제 비정상 건수(참고):", int(df["is_fraud"].sum()))

# IsolationForest: 무작위로 특성을 쪼개 관측을 격리할 때, 이상치는 몇 번 안 쪼개도 홀로 분리됩니다.
# contamination = 데이터에 섞인 이상치 비율의 사전 추정치(여기서는 5%로 지정).
iso = IsolationForest(contamination=0.05, n_estimators=200, random_state=42)
iso.fit(X)

# 이상 점수: score_samples는 클수록 정상. decision_function은 0 미만이면 이상으로 판정됩니다.
df["anomaly_score"] = iso.decision_function(X)   # 음수일수록 더 이상함
df["pred"] = iso.predict(X)                       # 1=정상, -1=이상
df["is_outlier"] = (df["pred"] == -1).astype(int)

n_flag = int(df["is_outlier"].sum())
print(f"모델이 이상으로 표시한 건수: {n_flag}건 (지정 비율 5% ~ {0.05*len(df):.0f}건)")

# 상위 이상치 표 — 점수가 가장 낮은(가장 이상한) 순으로
top = df.sort_values("anomaly_score").head(10)
print("\\n[상위 이상치 10건] anomaly_score가 낮을수록 이상")
print(top[["claim_amt", "process_days", "anomaly_score", "is_outlier"]]
      .round(2).to_string(index=False))

# 참고: 실제 사기 라벨과 얼마나 겹치는지(라벨은 학습에 안 썼음)
hit = int(((df["is_outlier"] == 1) & (df["is_fraud"] == 1)).sum())
print(f"\\n표시된 이상치 중 실제 비정상과 겹친 건수: {hit}/{n_flag} "
      f"(실무에서는 이 목록을 심사자에게 우선 검토 대상으로 넘깁니다)")

# 2변수 산점도 — 이상치를 빨간 X로 강조
plt.figure(figsize=(7, 5))
normal = df[df["is_outlier"] == 0]
outlier = df[df["is_outlier"] == 1]
plt.scatter(normal["claim_amt"], normal["process_days"],
            s=18, alpha=0.5, label="정상")
plt.scatter(outlier["claim_amt"], outlier["process_days"],
            s=90, marker="x", linewidths=2, color="crimson", label="이상치")
plt.xlabel("건당 손해액(만원)")
plt.ylabel("처리일수")
plt.title("IsolationForest 이상치 탐지")
plt.legend()
plt.tight_layout()
plt.show()

print("\\n해석: 손해액이 크면서도 처리일수 패턴이 정상 군집에서 벗어난 점들이 이상치로 잡힙니다.")
print("contamination을 크게 잡으면 더 많이 표시(재현율↑·오탐↑), 작게 잡으면 확실한 것만 표시됩니다.")`,
      },
      {
        title: "LOF·EllipticEnvelope 비교 — 방법별 강약",
        desc: "세 방법을 같은 데이터에 적용해 강약을 비교합니다 — novelty=True(정상만 학습) 포함.",
        level: "advanced",
        code: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.covariance import EllipticEnvelope

# 합성 데이터 — 정상 군집 + 비정상 5%
rng = np.random.default_rng(42)
n_normal, n_anom = 570, 30
amt_n = rng.lognormal(mean=5.0, sigma=0.35, size=n_normal)
days_n = 0.02 * amt_n + rng.normal(7, 1.5, size=n_normal)
amt_a = rng.lognormal(mean=6.4, sigma=0.5, size=n_anom)
days_a = rng.normal(4, 3, size=n_anom)

df = pd.DataFrame({
    "claim_amt": np.concatenate([amt_n, amt_a]),
    "process_days": np.concatenate([days_n, days_a]),
    "is_fraud": np.concatenate([np.zeros(n_normal), np.ones(n_anom)]).astype(int),
})
df = df.sample(frac=1, random_state=42).reset_index(drop=True)
X = df[["claim_amt", "process_days"]].values
CONT = 0.05  # 세 방법 공통 오염 비율

# 1) IsolationForest — 전역(global): 트리 격리 깊이. 전체에서 동떨어진 값에 강함.
iso = IsolationForest(contamination=CONT, n_estimators=200, random_state=42)
df["iso"] = (iso.fit_predict(X) == -1).astype(int)

# 2) LOF — 국소(local): 이웃 대비 밀도 비교. 주변보다 성긴 곳의 점을 잡음.
#    fit_predict는 학습 데이터 자체를 채점(비지도).
lof = LocalOutlierFactor(n_neighbors=20, contamination=CONT)
df["lof"] = (lof.fit_predict(X) == -1).astype(int)

# 참고: novelty=True는 '정상만으로 학습 후 새 관측을 판정'하는 모드(감시 시스템에 유용)
lof_nov = LocalOutlierFactor(n_neighbors=20, novelty=True)
lof_nov.fit(X[df["is_fraud"].values == 0])  # 정상만 학습
df["lof_novelty"] = (lof_nov.predict(X) == -1).astype(int)

# 3) EllipticEnvelope — 타원 가정: 데이터가 하나의 정규 덩어리라 보고 마할라노비스 거리로 판정.
ell = EllipticEnvelope(contamination=CONT, random_state=42)
df["ell"] = (ell.fit_predict(X) == -1).astype(int)

# 방법별 표시 건수와 실제 비정상 적중 비교(라벨은 참고용)
print("방법별 이상치 표시 건수 및 실제 비정상 적중")
for col, name in [("iso", "IsolationForest(전역)"),
                  ("lof", "LOF(국소)"),
                  ("lof_novelty", "LOF novelty(정상학습)"),
                  ("ell", "EllipticEnvelope(타원가정)")]:
    flagged = int(df[col].sum())
    hit = int(((df[col] == 1) & (df["is_fraud"] == 1)).sum())
    print(f"  {name:26s}: 표시 {flagged:2d}건 · 실제 적중 {hit:2d}/{int(df['is_fraud'].sum())}")

# 세 방법이 모두 이상으로 본 '합의' 건은 신뢰도가 높습니다.
df["votes"] = df[["iso", "lof", "ell"]].sum(axis=1)
consensus = int((df["votes"] == 3).sum())
print(f"\\n세 방법 모두 일치(합의) 이상치: {consensus}건 (우선 심사 1순위 후보)")

# 시각화 — 각 방법이 잡은 이상치를 나란히
methods = [("iso", "IsolationForest (전역)"),
           ("lof", "LOF (국소 밀도)"),
           ("ell", "EllipticEnvelope (타원 가정)")]
fig, axes = plt.subplots(1, 3, figsize=(15, 4.5), sharex=True, sharey=True)
for ax, (col, title) in zip(axes, methods):
    normal = df[df[col] == 0]
    out = df[df[col] == 1]
    ax.scatter(normal["claim_amt"], normal["process_days"], s=14, alpha=0.4, label="정상")
    ax.scatter(out["claim_amt"], out["process_days"], s=70, marker="x",
               linewidths=1.8, color="crimson", label="이상치")
    ax.set_title(title)
    ax.set_xlabel("건당 손해액(만원)")
    ax.legend(loc="upper left", fontsize=8)
axes[0].set_ylabel("처리일수")
plt.tight_layout()
plt.show()

print("\\n[방법별 강약 정리]")
print(" - IsolationForest: 전역 이상에 강하고 빠름·고차원에 견고. 국소 밀도 차이는 놓칠 수 있음.")
print(" - LOF: 이웃 대비 밀도로 국소 이상을 포착. n_neighbors에 민감하고 새 데이터엔 novelty 필요.")
print(" - EllipticEnvelope: 데이터가 하나의 정규 덩어리일 때 정확. 다봉·비대칭이면 가정이 깨져 부정확.")`,
      },
      {
        title: "지도학습 부재 시 평가 — 라벨 유무로 갈리는 검증",
        desc: "라벨이 일부 있으면 ROC-AUC·PR-AUC로 순위 성능을 검증합니다 — 없으면 도메인 검토가 유일.",
        level: "advanced",
        code: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.ensemble import IsolationForest
from sklearn.metrics import roc_auc_score, average_precision_score, precision_recall_curve

# 합성 데이터 — 사후에 조사로 확인된 사기 라벨이 일부 존재한다고 가정
rng = np.random.default_rng(42)
n_normal, n_anom = 570, 30
amt_n = rng.lognormal(mean=5.0, sigma=0.35, size=n_normal)
days_n = 0.02 * amt_n + rng.normal(7, 1.5, size=n_normal)
amt_a = rng.lognormal(mean=6.4, sigma=0.5, size=n_anom)
days_a = rng.normal(4, 3, size=n_anom)

df = pd.DataFrame({
    "claim_amt": np.concatenate([amt_n, amt_a]),
    "process_days": np.concatenate([days_n, days_a]),
    "is_fraud": np.concatenate([np.zeros(n_normal), np.ones(n_anom)]).astype(int),
})
df = df.sample(frac=1, random_state=42).reset_index(drop=True)
X = df[["claim_amt", "process_days"]].values
y = df["is_fraud"].values  # 조사로 확인된 실제 사기 라벨

iso = IsolationForest(contamination=0.05, n_estimators=200, random_state=42)
iso.fit(X)

# 핵심: 라벨 유무로 검증 방식이 갈립니다.
# decision_function은 클수록 정상이므로, '이상 점수'는 부호를 뒤집어 클수록 이상하게 만듭니다.
anomaly_score = -iso.decision_function(X)

# (A) 라벨이 있을 때 — 점수의 '순위' 성능을 ROC-AUC / PR-AUC로 검증
# 임계값을 정하지 않고, 이상할수록 점수가 높은지(순위)만 봅니다.
auc = roc_auc_score(y, anomaly_score)          # 무작위=0.5, 완벽=1.0
ap = average_precision_score(y, anomaly_score)  # PR-AUC — 불균형에서 ROC보다 민감
base = y.mean()  # 찍기 수준(양성 비율)
print("[라벨이 있을 때 - 이상 점수 검증]")
print(f"  ROC-AUC = {auc:.3f}  (0.5=무작위, 1.0=완벽)")
print(f"  PR-AUC  = {ap:.3f}  (찍기 기준선 = 양성비율 {base:.3f})")
print(f"  -> PR-AUC가 기준선({base:.3f})보다 충분히 높으면 점수가 사기를 잘 골라낸다는 뜻입니다.")

# 상위 k건만 심사한다면? — 실무 예산은 유한하므로 상위 정밀도(precision@k)가 중요합니다.
order = np.argsort(-anomaly_score)  # 이상 점수 높은 순
for k in (20, 50):
    topk = order[:k]
    prec_k = y[topk].mean()
    recall_k = y[topk].sum() / y.sum()
    print(f"  상위 {k}건 심사 시: 정밀도(precision@{k})={prec_k:.2f} · "
          f"실제 사기 {int(y[topk].sum())}건 포착(재현율 {recall_k:.2f})")

# PR 곡선 시각화
prec, rec, _ = precision_recall_curve(y, anomaly_score)
plt.figure(figsize=(7, 5))
plt.plot(rec, prec, lw=2, label=f"PR 곡선 (AP={ap:.3f})")
plt.axhline(base, ls="--", color="gray", label=f"찍기 기준선 {base:.3f}")
plt.xlabel("재현율 (실제 사기 중 잡아낸 비율)")
plt.ylabel("정밀도 (표시 중 실제 사기 비율)")
plt.title("이상 점수의 PR 곡선 - 라벨로 검증")
plt.legend()
plt.tight_layout()
plt.show()

# (B) 라벨이 없을 때 — 도메인 검토가 유일한 검증
print("\\n[라벨이 없을 때 - 도메인 검토 필요]")
print("  ROC-AUC 같은 지표는 정답이 있어야 계산됩니다. 라벨이 전혀 없다면:")
print("  1) 이상 점수 상위 건을 심사자가 직접 열어 '왜 이상한지' 설명이 되는지 확인")
top = df.assign(anomaly_score=anomaly_score).sort_values("anomaly_score", ascending=False).head(5)
print(top[["claim_amt", "process_days", "anomaly_score"]].round(2).to_string(index=False))
print("  2) contamination을 바꿔 표시 건수가 심사 가능 범위인지, 결과가 안정적인지 점검")
print("  3) 일부라도 라벨을 확보(과거 적발 사례 등)해 (A)의 순위 검증으로 넘어가는 것이 목표")
print("\\n주의: 이상 탐지의 '이상'은 통계적 이례일 뿐, 곧 '사기'는 아닙니다.")
print("      최종 판단은 반드시 도메인 전문가(심사·조사) 검토를 거쳐야 합니다.")`,
      },
    ],
  },
  /* ───────────────────────── 보험·계리 (actuarial) ───────────────────────── */
  ...ACTUARIAL_METHODS,
  /* ─────────────────────── 데이터 핸들링 (wrangle) ─────────────────────── */
  {
    id: "data-loading",
    name: "데이터 입력",
    en: "read_csv · read_excel · DataFrame",
    category: "wrangle",
    weight: 5,
    difficulty: 1,
    params: [
      { name: "sep / encoding", desc: "CSV 구분자('\\t'·';')와 인코딩 — 한글이 깨지면 encoding='cp949'." },
      { name: "sheet_name", desc: "엑셀 시트 이름 또는 순번(0부터). None이면 전 시트를 딕셔너리로." },
      { name: "header / skiprows / usecols", desc: "머리글 행 위치·건너뛸 행 수·읽을 열 범위(\"A:F\" 또는 열 이름 리스트)." },
      { name: "parse_dates / dtype", desc: "날짜로 인식할 열 지정 · 열 자료형 고정(계약번호 앞자리 0 보존 등)." },
      { name: "na_values", desc: "'-'·'없음' 같은 표기를 결측(NaN)으로 취급." },
    ],
    summary: "CSV·엑셀·JSON·직접 입력 — 다양한 형태의 데이터를 DataFrame으로 가져오는 첫 단계",
    intro:
      "모든 분석의 첫 셀 — 파일·주소·직접 입력을 DataFrame으로 만듭니다.\n\n- CSV: read_csv — 구분자·인코딩·헤더 유무를 옵션으로 흡수\n- 엑셀: read_excel — 시트·시작 행·열 범위 지정, 여러 시트 일괄 읽기\n- JSON·중첩 구조: json_normalize로 평탄화\n- 소형 표(요율표·매핑표): dict로 직접 생성",
    tips: "- 읽은 직후 df.shape·df.dtypes·df.head()로 '행 수·자료형·모양'을 반드시 확인\n- 숫자·날짜가 문자(object)로 읽혔으면 to_numeric·to_datetime으로 정리 후 분석",
    sections: [
      {
        title: "CSV·엑셀 읽기 — 자주 쓰는 옵션",
        level: "basic",
        code: `import pandas as pd

# CSV — 흔한 변형을 옵션으로 처리(필요한 것만 남기세요)
# df = pd.read_csv("data.csv", sep=",", encoding="cp949",
#                  header=0, usecols=["policy_id", "premium"],
#                  na_values=["-", "없음"], dtype={"policy_id": str})

# 엑셀 — 시트·범위 지정
df = pd.read_excel("policy.xlsx", sheet_name=0)   # 시트 이름 또는 순번

# 읽은 직후 3종 확인 — 행×열, 자료형, 앞 5행
print(df.shape)
print(df.dtypes)
df.head()`,
      },
      {
        title: "여러 시트·직접 입력·형 정리",
        level: "basic",
        code: `import pandas as pd

# ① 모든 시트 읽어 세로로 합치기
sheets = pd.read_excel("policy.xlsx", sheet_name=None)   # {시트명: df}
all_df = pd.concat(sheets, names=["sheet"]).reset_index(level=0)

# ② 소형 표 직접 입력 — 요율표·매핑표
rate = pd.DataFrame({
    "age_band": ["20-29", "30-39", "40-49"],
    "rate":     [0.0012, 0.0018, 0.0031],
})

# ③ 문자로 읽힌 숫자·날짜 정리(불량 값은 NaN/NaT)
# df["premium"] = pd.to_numeric(df["premium"], errors="coerce")
# df["issue_date"] = pd.to_datetime(df["issue_date"], errors="coerce")

rate`,
      },
    ],
  },
  {
    id: "select-rows-cols",
    name: "행·열 선택",
    en: "loc · iloc",
    category: "wrangle",
    weight: 5,
    difficulty: 1,
    params: [
      { name: "loc[행, 열]", desc: "라벨 기준 — 라벨·라벨 목록·슬라이스(끝 포함)·불리언 마스크 모두 허용. 값 대입도 loc로(경고 없는 안전한 방법)." },
      { name: "iloc[행, 열]", desc: "정수 위치 기준 — 파이썬 슬라이스 규칙(끝 제외)·음수 인덱스 허용." },
      { name: "at / iat", desc: "단일 값 전용 고속 접근 — 루프 안에서 한 칸씩 읽고 쓸 때 loc보다 빠릅니다." },
      { name: "select_dtypes(include/exclude)", desc: "'number'·'object'·'datetime' 등 자료형으로 열 묶음 선택." },
      { name: "filter(items/like/regex)", desc: "열 이름 패턴 선택 — like='_amt'면 이름에 _amt가 든 열 전부." },
    ],
    summary: "라벨 기준 loc, 위치(정수) 기준 iloc — 특정 행·열을 꺼내는 기본 문법",
    intro:
      "데이터에서 원하는 행·열을 꺼내는 pandas 기본 문법입니다.\n\n- loc: 라벨(인덱스·열 이름) 기준 [행, 열] — 콜론(:)은 전부\n- iloc: 위치(0부터 정수) 기준 [행, 열]\n- 보험 예: 60세 이상 행의 보험료 열만 → df.loc[df[\"age\"]>=60, \"premium\"]",
    tips: "- loc 슬라이스(a:c)는 끝 포함, iloc(0:3)는 끝 제외 — 파이썬 리스트와 같은 쪽은 iloc\n- 한 열은 df[\"col\"](Series), 여러 열은 df[[\"a\",\"b\"]](대괄호 두 겹, DataFrame)",
    sections: [
      {
        title: "열 선택",
        level: "basic",
        code: `import pandas as pd

df = pd.read_excel("policy.xlsx")

s = df["premium"]                    # 한 열 → Series
sub = df[["policy_id", "premium"]]   # 여러 열 → DataFrame (대괄호 두 겹)

num = df.select_dtypes("number")     # 자료형으로 선택
amt = df.filter(like="_amt")         # 이름 패턴으로 선택 (…_amt 열 전부)`,
      },
      {
        title: "행·[행, 열] 선택 — loc와 iloc",
        level: "basic",
        code: `# loc — 라벨 기준 [행, 열]
df.loc[0]                                  # 인덱스 라벨 0인 행
df.loc[0:4, ["policy_id", "premium"]]      # 라벨 0~4 (끝 포함!)
df.loc[df["age"] >= 60, "premium"]         # 조건 행 + 특정 열

# iloc — 위치 기준 [행, 열]
df.iloc[0]                # 첫 행
df.iloc[:5, :3]           # 앞 5행 × 앞 3열 (끝 제외)
df.iloc[-10:]             # 마지막 10행
df.iloc[[0, 5, 9], [1, 2]]  # 흩어진 위치 지정

# 값 하나만 빠르게
df.at[0, "premium"]       # 라벨 기준 단일 값
df.iat[0, 3]              # 위치 기준 단일 값`,
      },
    ],
  },
  {
    id: "filter-condition",
    name: "조건 필터링",
    en: "Boolean Indexing · query",
    category: "wrangle",
    weight: 5,
    difficulty: 1,
    params: [
      { name: "& | ~ 와 괄호", desc: "그리고(&)·또는(|)·부정(~) — and/or/not은 쓸 수 없고, 각 조건은 반드시 괄호로 감쌉니다." },
      { name: "between(left, right, inclusive=...)", desc: "구간 조건 — 'both'(기본, 양끝 포함)·'neither'·'left'·'right'." },
      { name: "str.contains(pat, na=, case=, regex=)", desc: "문자열 포함 — na=False로 결측 처리 필수, case=False 대소문자 무시, regex=False면 문자 그대로." },
      { name: "query(expr)", desc: "SQL처럼 읽히는 조건식 — 외부 변수는 @변수, 공백 포함 열 이름은 백틱으로 감쌉니다." },
      { name: "where(cond, other=...)", desc: "필터와 달리 행을 유지한 채 조건 거짓인 곳만 NaN(또는 대체값)으로 바꿉니다." },
    ],
    summary: "조건식으로 참인 행만 추출 — &(그리고) |(또는) 와 괄호가 핵심",
    intro:
      "조건식의 True/False 마스크를 df[...]에 넣어 참인 행만 남깁니다.\n\n- 복수 조건: and/or 대신 &·|, 각 조건은 반드시 괄호로\n- 조건이 길면 query()가 SQL WHERE처럼 읽기 좋은 대안\n- 보험 예: 40~60세 종신 계약, 서울·경기 계약만 추출",
    tips: "- 부정은 ~(물결): df[~mask]\n- 문자열 조건은 str.contains, 구간은 between이 간결\n- 필터 결과 수정 시 .copy()로 SettingWithCopyWarning 예방",
    sections: [
      {
        title: "불리언 인덱싱 — 단일·복수 조건",
        level: "basic",
        code: `# 단일 조건
seniors = df[df["age"] >= 60]

# 복수 조건 — & | 와 괄호 필수
target = df[(df["age"] >= 40) & (df["age"] < 60) & (df["product"] == "종신")]
either = df[(df["region"] == "서울") | (df["region"] == "경기")]

# 부정(~), 구간(between), 문자열 포함(str.contains)
active = df[~df["lapsed"]]
mid = df[df["premium"].between(50_000, 150_000)]        # 양끝 포함
cancer = df[df["product_name"].str.contains("암", na=False)]`,
      },
      {
        title: "query — SQL처럼 읽히는 조건식",
        level: "basic",
        code: `# 같은 조건을 query로 — 열 이름을 따옴표 없이 그대로 사용
target = df.query("40 <= age < 60 and product == '종신'")

# 외부 변수는 @ 로 참조
min_prem = 100_000
high = df.query("premium >= @min_prem and not lapsed")

# 결과 건수 빠른 확인
print(len(target), "건 /", len(df), "건")`,
      },
    ],
  },
  {
    id: "isin",
    name: "isin 발췌",
    en: "isin",
    category: "wrangle",
    weight: 3,
    difficulty: 1,
    params: [
      { name: "isin(values)", desc: "리스트·set·Series(다른 표의 열) 모두 허용 — Series를 주면 명단 대조가 한 줄." },
      { name: "~ (반전)", desc: "~df['col'].isin([...]) — 목록에 없는 행만(제외 필터)." },
      { name: "df.isin(dict)", desc: "DataFrame 단위 — {'열이름': [목록]}으로 열마다 다른 목록을 검사." },
      { name: "다중 열 조합 대조", desc: "두 열 이상 조합의 존재 여부는 isin 대신 merge(how='inner') 또는 how='left'+indicator가 정확합니다." },
    ],
    summary: "값이 목록 안에 있는 행만 추출 — ==를 여러 번 잇는 것보다 간결·빠름",
    intro:
      "값이 목록 안에 있는 행만 뽑는 다중 일치 필터입니다.\n\n- (x==a)|(x==b)… 나열 대신 isin([a,b,c]) 한 번 — 목록이 길어도 성능 안정\n- 다른 표의 열을 넘기면 명단 대조 한 줄 — 보험 예: VIP 명단에 있는 계약만\n- ~ 반전으로 '목록에 없는 행'(제외 필터)",
    tips: "- 제외 필터: ~df[\"col\"].isin([...])\n- 대조 기준 열에 결측이 섞여 있으면 dropna() 후 넘기는 것이 안전",
    sections: [
      {
        title: "목록 포함·제외·명단 대조",
        level: "basic",
        code: `# 특정 상품군만 추출
picked = df[df["product"].isin(["종신", "정기", "암보험"])]

# 목록에 없는 행 (제외)
others = df[~df["product"].isin(["종신", "정기", "암보험"])]

# 다른 DataFrame의 명단과 대조 — VIP 고객의 계약만
vip = pd.read_excel("vip_list.xlsx")
vip_contracts = df[df["customer_id"].isin(vip["customer_id"])]

# 여러 열 동시 대조는 merge가 더 적합 (join·merge 항목 참고)
print(len(vip_contracts), "건")`,
      },
    ],
  },
  {
    id: "conditional",
    name: "조건 분기",
    en: "np.where · np.select · case",
    category: "wrangle",
    weight: 3,
    difficulty: 2,
    params: [
      { name: "np.where(cond, a, b)", desc: "이항 분기(IF) — 조건이 참이면 a, 거짓이면 b. 중첩보다는 np.select 권장." },
      { name: "np.select(condlist, choicelist, default)", desc: "다중 분기(CASE WHEN) — 위에서부터 첫 번째 참인 조건이 이기므로 조건 순서가 결과를 바꿉니다." },
      { name: "pd.cut(bins, labels, right, include_lowest)", desc: "경계 직접 구간화 — right=False면 [a, b) 왼쪽 포함. 경계 밖 값은 NaN이 되므로 양끝을 넉넉히." },
      { name: "pd.qcut(q, labels, duplicates=...)", desc: "분위수 균등 구간화 — 같은 값이 몰려 경계가 겹치면 duplicates='drop'." },
      { name: "Series.case_when([(cond, val), ...])", desc: "pandas 2.2+ — 메서드 체인 안에서 다중 분기를 이어 쓸 수 있습니다." },
    ],
    summary: "if/else·CASE WHEN을 벡터 연산으로 — 조건에 따라 다른 값을 부여",
    intro:
      "엑셀 IF·SQL CASE WHEN에 해당하는 조건 분기 벡터 연산입니다.\n\n- 이항 분기: np.where(조건, 참값, 거짓값)\n- 다중 분기: np.select(조건 목록, 값 목록, 기본값) — 행별 apply보다 수십 배 빠름\n- 구간화(연령대·금액대): 조건 나열 대신 pd.cut이 간결·안전\n- 보험 예: 손해율 1.0·0.8·0.6 기준 적자/주의/양호 등급",
    tips: "- np.select는 위에서부터 첫 번째 참인 조건이 이김 — 조건 순서가 결과를 바꿈\n- pandas 2.2+는 메서드 체인 친화적인 Series.case_when도 가능",
    sections: [
      {
        title: "이항·다중 분기 — np.where · np.select",
        level: "basic",
        code: `import numpy as np

# 이항 분기 (IF)
df["risk"] = np.where(df["age"] >= 60, "고위험", "일반")

# 다중 분기 (CASE WHEN) — 첫 번째 참인 조건 적용
conditions = [
    df["loss_ratio"] >= 1.0,
    df["loss_ratio"] >= 0.8,
    df["loss_ratio"] >= 0.6,
]
choices = ["적자", "주의", "양호"]
df["grade"] = np.select(conditions, choices, default="우수")

print(df["grade"].value_counts())`,
      },
      {
        title: "구간화 — pd.cut · pd.qcut",
        level: "basic",
        code: `# 경계를 직접 지정 (연령대)
df["age_band"] = pd.cut(
    df["age"],
    bins=[0, 20, 30, 40, 50, 60, 120],
    labels=["~19", "20대", "30대", "40대", "50대", "60+"],
    right=False,          # [20, 30) — 왼쪽 포함
)

# 분위수로 균등 분할 (보험료 4분위)
df["prem_q"] = pd.qcut(df["premium"], q=4, labels=["Q1", "Q2", "Q3", "Q4"])

print(pd.crosstab(df["age_band"], df["prem_q"]))`,
      },
    ],
  },
  {
    id: "join-merge",
    name: "join·merge",
    en: "merge · concat",
    category: "wrangle",
    weight: 4,
    difficulty: 2,
    params: [
      { name: "how", desc: "'inner'(양쪽 다 있는 키만)·'left'(왼쪽 전부 유지)·'right'·'outer'(둘 다 전부)·'cross'(모든 조합)." },
      { name: "on / left_on·right_on", desc: "결합 키 — 양쪽 이름이 같으면 on, 다르면 left_on·right_on. 여러 키는 리스트로." },
      { name: "validate", desc: "'one_to_one'·'one_to_many' 등 관계 선언 — 위반 시 에러를 내 잘못된 결합(행 폭증)을 사전에 잡습니다." },
      { name: "indicator=True", desc: "_merge 열(both/left_only/right_only) 추가 — 매칭 실패 규모 검증에 필수적인 습관." },
      { name: "suffixes=('_x', '_y')", desc: "양쪽에 같은 이름의 열이 있을 때 붙는 접미사 — ('_계약', '_고객')처럼 의미 있게." },
      { name: "concat(axis, ignore_index, keys)", desc: "같은 구조 쌓기 — axis=0 세로(기본)·1 가로, keys로 출처 라벨 유지." },
    ],
    summary: "키를 기준으로 두 표를 옆으로 결합(SQL JOIN) — how 옵션이 결과를 좌우",
    intro:
      "흩어진 두 표를 공통 키로 옆으로 결합(SQL JOIN)합니다.\n\n- how: 'inner'(양쪽 다 있는 키만)·'left'(왼쪽 전부 유지)·'outer'(둘 다 전부)\n- 같은 구조를 위아래로 쌓을 때는 merge 대신 concat(월별 파일 합치기)\n- 보험 예: 계약 테이블 + 고객 마스터를 customer_id로 결합",
    tips: "- 결합 후 행 수가 예상과 다르면 키 중복(1:N, N:M) 의심 — validate=\"one_to_many\"가 에러로 잡아 줌\n- indicator=True로 각 행의 출처(both/left_only) 확인 — 매칭 실패 검증",
    sections: [
      {
        title: "merge — SQL JOIN 4종",
        level: "basic",
        code: `contracts = pd.read_excel("contracts.xlsx")   # 계약 (customer_id 포함)
customers = pd.read_excel("customers.xlsx")   # 고객 마스터

# LEFT JOIN — 계약은 전부 유지, 고객 정보 붙이기
merged = contracts.merge(customers, on="customer_id", how="left")

# 키 이름이 서로 다를 때
merged = contracts.merge(
    customers, left_on="cust_id", right_on="customer_id", how="left"
)

# 검증 옵션 — 결합 품질 확인
merged = contracts.merge(
    customers, on="customer_id", how="left",
    validate="many_to_one",   # 고객이 중복이면 에러로 알려줌
    indicator=True,           # _merge 열: both / left_only
)
print(merged["_merge"].value_counts())   # left_only가 많으면 매칭 실패 다수`,
      },
      {
        title: "concat — 위아래로 쌓기",
        level: "basic",
        code: `# 월별 파일을 하나로
jan = pd.read_excel("claims_2026_01.xlsx")
feb = pd.read_excel("claims_2026_02.xlsx")
all_claims = pd.concat([jan, feb], ignore_index=True)

# 어떤 파일에서 왔는지 표시하며 쌓기
all_claims = pd.concat({"1월": jan, "2월": feb}, names=["월"]).reset_index(0)`,
      },
    ],
  },
  {
    id: "groupby",
    name: "groupby 집계",
    en: "groupby · agg · transform",
    category: "wrangle",
    weight: 5,
    difficulty: 2,
    params: [
      { name: "agg(이름=(열, 함수))", desc: "이름 있는 집계 — 결과 열 이름까지 한 번에. 함수는 'mean' 문자열·np 함수·lambda 모두 허용." },
      { name: "transform(func)", desc: "집계 결과를 원본 행 수 그대로 반환 — '자기 그룹 평균 대비 비율' 같은 파생변수의 표준 방법." },
      { name: "filter(func)", desc: "그룹 조건으로 그룹째 채택/제외 — 예: 계약 100건 이상 지점만." },
      { name: "as_index=False", desc: "그룹 키를 인덱스 대신 일반 열로 — 결과를 바로 표로 다룰 때 편리(reset_index 생략)." },
      { name: "dropna=False", desc: "키 값이 NaN인 행도 하나의 그룹으로 유지(기본은 제외)." },
      { name: "observed=True", desc: "범주형 키에서 실제 등장한 조합만 집계 — 미등장 조합의 빈 행 방지." },
    ],
    summary: "그룹별 합계·평균·건수 — 엑셀 피벗의 코드판이자 분석의 중심 동작",
    intro:
      "그룹 단위 합계·평균·건수를 만드는 분석의 중심 동작입니다.\n\n- groupby(키) 후 agg — 이름 있는 집계로 결과 열 이름까지 한 번에\n- transform: 집계 결과를 원본 행 수 그대로 — '자기 그룹 평균 대비 비율' 파생변수\n- 보험 예: 상품별 평균 보험료, 지점별 월별 청구 건수",
    tips: "- 여러 키로 묶으면 멀티인덱스 — 표로 다루려면 reset_index()\n- 그룹 조건으로 그룹째 거르기(우량 지점만)는 filter",
    sections: [
      {
        title: "agg — 이름 있는 집계",
        level: "basic",
        code: `# 상품 × 채널별 요약표
summary = (
    df.groupby(["product", "channel"])
    .agg(
        건수=("policy_id", "count"),
        보험료합계=("premium", "sum"),
        평균보험료=("premium", "mean"),
        평균연령=("age", "mean"),
    )
    .reset_index()
)
print(summary.round(1))`,
      },
      {
        title: "transform·filter — 그룹값을 행으로, 그룹째 거르기",
        level: "basic",
        code: `# 자기 상품군 평균 대비 보험료 비율 (행 수 유지)
df["prem_vs_group"] = df["premium"] / df.groupby("product")["premium"].transform("mean")

# 그룹 내 순번 (계약자별 최신 계약 = 1)
df["nth"] = df.sort_values("issue_date", ascending=False).groupby("customer_id").cumcount() + 1

# 계약 100건 이상인 지점만 남기기 (그룹째 필터)
big = df.groupby("branch").filter(lambda g: len(g) >= 100)
print(big["branch"].nunique(), "개 지점")`,
      },
    ],
  },
  {
    id: "apply",
    name: "apply·map",
    en: "apply · map",
    category: "wrangle",
    weight: 4,
    difficulty: 2,
    params: [
      { name: "map(dict 또는 함수)", desc: "Series 값 하나씩 변환 — dict 매핑에 없는 값은 NaN이 됩니다(누락 코드 점검 기회)." },
      { name: "map(..., na_action='ignore')", desc: "결측은 함수에 넣지 않고 그대로 NaN 유지 — 함수가 NaN에서 죽는 것을 방지." },
      { name: "apply(func, axis=1)", desc: "행 전체를 받아 여러 열 조합 계산 — 유연하지만 파이썬 루프라 느립니다. 벡터화 가능하면 그쪽 우선." },
      { name: "apply(..., result_type='expand')", desc: "함수가 리스트/Series를 반환하면 여러 열로 펼칩니다." },
      { name: "replace(dict)", desc: "map과 달리 매핑에 없는 값은 원래 값 유지 — 일부 코드만 바꿀 때는 replace가 안전." },
    ],
    summary: "임의의 함수를 열·행 단위로 적용 — 유연하지만 벡터 연산이 있으면 그쪽 먼저",
    intro:
      "내장 연산으로 어려운 사용자 정의 로직을 열·행 단위로 적용합니다.\n\n- Series.map: 값 하나씩 변환 — 코드→이름 사전 매핑\n- df.apply(axis=1): 행 전체를 받아 여러 열 조합 계산\n- apply는 파이썬 루프라 느림 — 벡터 연산으로 되면 항상 그쪽 우선\n- 보험 예: 연령·청구건수 조합으로 심사 등급 부여",
    tips: "- 성능 순서: 벡터 연산 > map(사전) > apply\n- 수십만 행에 apply(axis=1) 전에 np.where·groupby.transform 대체 가능성 먼저 검토",
    sections: [
      {
        title: "map — 값 변환·사전 매핑",
        level: "basic",
        code: `# 사전으로 코드 → 이름 매핑
code_map = {"L": "생명", "H": "건강", "A": "상해"}
df["product_nm"] = df["product_cd"].map(code_map)

# 함수 적용 (값 하나씩)
df["premium_만원"] = df["premium"].map(lambda x: round(x / 10_000, 1))

# 매핑에 없는 코드는 NaN — 확인 습관
print(df.loc[df["product_nm"].isna(), "product_cd"].unique())`,
      },
      {
        title: "apply — 여러 열 조합 (필요할 때만)",
        level: "basic",
        code: `# 행 전체를 받아 조건 조합 — axis=1
def risk_grade(row):
    if row["age"] >= 65 and row["claim_cnt"] >= 3:
        return "정밀심사"
    if row["age"] >= 65 or row["claim_cnt"] >= 3:
        return "주의"
    return "일반"

df["grade"] = df.apply(risk_grade, axis=1)

# 같은 로직의 벡터 버전 — 대용량에서는 이쪽
import numpy as np
old, freq = df["age"] >= 65, df["claim_cnt"] >= 3
df["grade"] = np.select([old & freq, old | freq], ["정밀심사", "주의"], "일반")`,
      },
    ],
  },
  {
    id: "pivot",
    name: "pivot_table·melt",
    en: "pivot_table · melt",
    category: "wrangle",
    weight: 3,
    difficulty: 2,
    params: [
      { name: "aggfunc", desc: "집계 함수 — 'mean'(기본)·'sum'·'count'·리스트(여러 개)·dict(값 열마다 다르게)." },
      { name: "margins / margins_name", desc: "행·열 합계 추가와 그 라벨('All' 기본)." },
      { name: "fill_value", desc: "조합이 없는 빈 칸 채움 — 0으로 채우기 전에 '거래 없음'과 '0원'의 업무적 차이를 확인." },
      { name: "melt(id_vars, value_vars, var_name, value_name)", desc: "wide→long — 유지할 식별 열, 녹일 열, 결과 열 이름 지정." },
      { name: "pivot vs pivot_table", desc: "pivot은 집계 없는 재배열(중복 조합 있으면 에러), pivot_table은 aggfunc로 집계 — 중복 가능성이 있으면 pivot_table." },
    ],
    summary: "행×열 교차 요약표(엑셀 피벗)와 그 역변환(wide→long)",
    intro:
      "행×열 교차 요약표(엑셀 피벗)와 역방향 변환(wide→long)을 만듭니다.\n\n- pivot_table: index(행)·columns(열)·values(값)·aggfunc(집계), margins=True면 합계 추가\n- melt: 월별 열이 옆으로 늘어선 wide 표를 분석용 세로형(long)으로\n- 보험 예: 상품(행)×연령대(열) 평균 보험료 교차표",
    tips: "- 빈 칸(NaN)은 fill_value=0으로 채우되 '거래 없음'과 '0원'의 업무적 차이 확인\n- groupby+unstack도 같은 결과 — 편한 쪽 사용",
    sections: [
      {
        title: "pivot_table — 교차 요약표",
        level: "basic",
        code: `# 상품(행) × 연령대(열) 평균 보험료
pt = pd.pivot_table(
    df,
    index="product",
    columns="age_band",
    values="premium",
    aggfunc="mean",
    margins=True, margins_name="전체",   # 합계 행·열
    fill_value=0,
)
print(pt.round(0))

# 여러 값·여러 집계 동시
pt2 = pd.pivot_table(df, index="product",
                     values=["premium", "claim_amt"],
                     aggfunc={"premium": "mean", "claim_amt": ["sum", "count"]})`,
      },
      {
        title: "melt — wide를 long으로",
        level: "basic",
        code: `# 월별 열(1월, 2월, …)이 옆으로 늘어선 표를 세로로
wide = pd.read_excel("monthly_report.xlsx")   # 지점 | 1월 | 2월 | 3월 …
long = wide.melt(
    id_vars="지점",
    var_name="월",
    value_name="실적",
)
print(long.head())
# long 형태여야 groupby·시각화·시계열 분석이 자연스러움`,
      },
    ],
  },
  {
    id: "missing",
    name: "결측치 처리",
    en: "isna · fillna · dropna",
    category: "wrangle",
    weight: 4,
    difficulty: 2,
    params: [
      { name: "dropna(subset, how, thresh)", desc: "subset=기준 열 목록, how='any'(하나라도 결측)·'all'(전부 결측), thresh=행이 살아남을 최소 유효값 수." },
      { name: "fillna(value)", desc: "단일 값 또는 {'열': 값} dict로 열마다 다른 값 — 수치형 중앙값·범주형 '미상'이 무난한 기본." },
      { name: "ffill() / bfill()", desc: "직전/직후 값으로 채움 — 시계열·정렬된 데이터 전용. limit로 연속 채움 상한." },
      { name: "interpolate(method, limit)", desc: "'linear'(기본)·'time'(시간 간격 반영) 보간 — 시계열 수치에 자연스러움." },
      { name: "replace([...], np.nan)", desc: "공백·'-'·'N/A' 같은 숨은 결측 문자를 진짜 NaN으로 — 결측 집계 전에 필수." },
    ],
    summary: "결측 파악 → 삭제 또는 대체 — 분석 전 반드시 거치는 관문",
    intro:
      "결측을 파악하고 삭제·대체하는 분석 전 필수 관문입니다.\n\n- 파악: isna().sum()으로 열별 결측 규모 확인\n- 소수면 dropna 삭제, 다수면 fillna 대체 — 수치형 중앙값(이상치에 강건)·범주형 최빈값/'미상'\n- 결측이 특정 집단에 몰리면(보험 예: 고연령 고객 소득 미기재) 삭제·대체 모두 편향 위험 — 결측 여부 자체를 변수로 보존",
    tips: "- '  '(공백)·'-' 같은 숨은 결측은 replace로 진짜 NaN으로 바꾼 뒤 집계\n- 시계열은 평균 대체보다 ffill·interpolate가 자연스러움",
    sections: [
      {
        title: "결측 파악 — 숨은 결측까지",
        level: "basic",
        code: `import numpy as np

# 숨은 결측(공백·대시)을 진짜 NaN으로
df = df.replace(["", " ", "-", "N/A"], np.nan)

# 열별 결측 수·비율
na = df.isna().sum()
print(pd.DataFrame({"결측수": na, "비율": (na / len(df)).round(3)})
      .query("결측수 > 0").sort_values("결측수", ascending=False))

# 특정 집단에 몰렸는지 확인
print(df.groupby("channel")["income"].apply(lambda s: s.isna().mean()).round(3))`,
      },
      {
        title: "삭제·대체·보간",
        level: "basic",
        code: `# 핵심 열이 빈 행만 삭제
df = df.dropna(subset=["policy_id", "premium"])

# 수치형: 중앙값 / 범주형: '미상'
df["income"] = df["income"].fillna(df["income"].median())
df["job"] = df["job"].fillna("미상")

# 그룹별 중앙값으로 더 정교하게
df["income"] = df["income"].fillna(
    df.groupby("age_band")["income"].transform("median")
)

# 시계열: 직전 값 유지·선형 보간
ts = ts.ffill()
ts = ts.interpolate(method="linear")

# 결측 여부 자체를 변수로 보존
df["income_missing"] = df["income"].isna().astype(int)`,
      },
    ],
  },
  {
    id: "sort-dedup",
    name: "정렬·중복·순위",
    en: "sort_values · drop_duplicates · rank",
    category: "wrangle",
    weight: 2,
    difficulty: 1,
    params: [
      { name: "sort_values(by, ascending=[...])", desc: "복수 키 정렬 — ascending을 리스트로 주면 키마다 방향 혼합. na_position='first'로 결측 위치 제어." },
      { name: "drop_duplicates(subset, keep)", desc: "subset=중복 판단 열, keep='first'(기본)·'last'·False(중복 전부 제거) — 지우기 전 정렬이 무엇을 남길지 결정합니다." },
      { name: "duplicated(keep)", desc: "중복 여부 마스크 — 삭제 전에 어떤 행이 걸리는지 눈으로 확인." },
      { name: "rank(method, ascending, pct)", desc: "동점 처리 'average'(기본)·'min'·'dense', pct=True면 백분위 순위." },
      { name: "nlargest / nsmallest(n, columns)", desc: "상·하위 N — 전체 정렬보다 빠르고 의도가 명확." },
    ],
    summary: "정렬, 중복 제거(기준·유지 규칙), 순위·상위 N — 마무리 손질 3종",
    intro:
      "정렬·중복 제거·순위 등 결과 표의 마무리 손질입니다.\n\n- sort_values: 복수 키·방향 혼합 정렬\n- drop_duplicates: 기준 열(subset)·남길 행(keep) 지정 중복 제거\n- 실무 단골(보험 예): 정렬+keep 조합으로 고객별 최신 계약 1건, rank·nlargest로 상위 N",
    tips: "- drop_duplicates 전에 반드시 정렬 — keep='first'가 남길 행은 행 순서가 결정\n- 삭제 전 duplicated()로 어떤 행이 중복인지 눈으로 확인",
    sections: [
      {
        title: "정렬·중복 제거·최신 1건",
        level: "basic",
        code: `# 복수 키 정렬 — 상품 오름차순, 보험료 내림차순
df = df.sort_values(["product", "premium"], ascending=[True, False])

# 중복 확인 후 제거
print(df.duplicated(subset=["customer_id", "product"]).sum(), "건 중복")
dedup = df.drop_duplicates(subset=["customer_id", "product"], keep="first")

# 고객별 최신 계약 1건 — 정렬 + keep 조합
latest = (
    df.sort_values("issue_date", ascending=False)
    .drop_duplicates(subset="customer_id", keep="first")
)`,
      },
      {
        title: "순위·상위 N",
        level: "basic",
        code: `# 지점별 실적 순위 (동점은 평균 순위)
df["rank"] = df["sales"].rank(ascending=False, method="min")

# 상위·하위 N — 정렬보다 빠르고 간결
top10 = df.nlargest(10, "claim_amt")
bottom5 = df.nsmallest(5, "loss_ratio")

# 그룹 내 순위 — 채널별 실적 1등
df["rank_in_ch"] = df.groupby("channel")["sales"].rank(ascending=False, method="min")
winners = df[df["rank_in_ch"] == 1]`,
      },
    ],
  },
];

/**
 * 최종 목록 — 각 방법에 "결과를 표·수식으로" 섹션(열 자동 선택·계수 표·적합도 지표)을
 * lib/modelResultSections.ts에서 자동 생성해 기본 섹션 뒤에 붙인다(파이썬·엑셀 두 탭 공통).
 */
export const STAT_METHODS: StatMethod[] = withResultSections(RAW_METHODS);
