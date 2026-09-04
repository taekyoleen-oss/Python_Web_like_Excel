/**
 * 확률분포 탭(/datalab) 카탈로그 — 연속형 8종·이산형 3종.
 * 각 분포: 파라미터 스펙 · pdf/pmf · cdf(연속) · 적률(정의여부 포함) ·
 * KaTeX 수식 문자열 · 현재 파라미터가 반영된 파이썬(scipy.stats) 코드.
 *
 * React 의존 없음(순수 데이터+함수). p는 파라미터 key→값 맵.
 */
import {
  betaln,
  centralFromRaw,
  factln,
  lgamma,
  logChoose,
  lowerRegGamma,
  normStdCdf,
  quantileBisection,
  regIncBeta,
} from "./distMath";

export type ChipColor =
  | "blue"
  | "teal"
  | "amber"
  | "rose"
  | "violet"
  | "green"
  | "slate"
  | "cyan";

export interface DistParam {
  key: string; // 코드/수식 변수명 (mu, sigma, alpha …)
  label: string; // 표시 라벨
  tex: string; // KaTeX 기호 (\\mu 등)
  def: number; // 기본값
  min: number;
  max: number;
  step: number;
  integer?: boolean; // 슬라이더 정수 스텝(n 등)
}

export interface StatValue {
  label: string; // 평균·분산·표준편차·왜도·초과첨도
  tex: string; // 기호 수식 (KaTeX)
  value: number | null; // 계산값 — 정의 안 되면 null
  note?: string; // 정의 조건 (예: "α > 2 필요")
}

export type Params = Record<string, number>;

/**
 * 파이썬 코드 조립 스펙 — 단일(접미사 "")과 비교(A는 "_a", B는 "_b") 코드가
 * 같은 정의를 재사용한다. 접미사는 변수명에 붙어 두 분포를 한 스크립트에
 * 담아도 이름이 충돌하지 않게 한다.
 */
export interface PySpec {
  label: string; // 주석용 라벨 (분포명+파라미터)
  assign: string; // 파라미터 변수 할당 줄
  expr: string; // scipy.stats 생성자 (assign 변수를 사용)
  kmax?: string; // 이산형 그래프 k 상한 (파이썬 식, dist<접미사> 참조 가능)
}

interface DistBase {
  id: string;
  name: string; // 한글
  en: string; // 영문
  color: ChipColor;
  params: DistParam[];
  blurb: string; // 한 줄 설명
  usage?: string; // 보험 용례 배지 (심도·빈도·손해율 등) — 짧게
  cdfTex: string; // CDF 수식
  stats: (p: Params) => StatValue[];
  pySpec: (p: Params, sfx: string) => PySpec;
}

export interface ContinuousDist extends DistBase {
  kind: "continuous";
  pdfTex: string;
  pdf: (x: number, p: Params) => number;
  cdf: (x: number, p: Params) => number;
  domain: (p: Params) => [number, number]; // 그래프 x범위
}

export interface DiscreteDist extends DistBase {
  kind: "discrete";
  pmfTex: string;
  pmf: (k: number, p: Params) => number;
  kMax: (p: Params) => number; // 그래프 상한 k
}

export type Distribution = ContinuousDist | DiscreteDist;

/* ───────────────────────────── 통계량 헬퍼 ───────────────────────────── */

function stat(
  label: string,
  tex: string,
  value: number | null,
  note?: string
): StatValue {
  return { label, tex, value, note };
}

/** 평균·분산·표준편차·왜도·초과첨도 5행을 정형으로 만든다. */
function stats5(
  texs: { mean: string; var: string; std: string; skew: string; kurt: string },
  m: { mean: number | null; variance: number | null; skew: number | null; kurt: number | null },
  notes?: { mean?: string; var?: string; skew?: string; kurt?: string }
): StatValue[] {
  const std =
    m.variance === null || m.variance < 0 ? null : Math.sqrt(m.variance);
  return [
    stat("평균", texs.mean, m.mean, notes?.mean),
    stat("분산", texs.var, m.variance, notes?.var),
    stat("표준편차", texs.std, std, notes?.var),
    stat("왜도", texs.skew, m.skew, notes?.skew),
    stat("초과첨도", texs.kurt, m.kurt, notes?.kurt),
  ];
}

/* ───────────────────────── 파이썬 코드 템플릿 ───────────────────────── */

/** 보기 좋은 숫자 문자열 — 정수는 정수로, 나머지는 불필요한 0 제거. */
export function fmtParam(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return String(Math.round(v * 1e6) / 1e6);
}

/** 평균(파선)·중위수(점선) 세로선 — 화면 그래프의 마커와 같은 표시. */
const PY_MARKERS = `# 평균(파선)·중위수(점선) — 값이 유한할 때만 (파레토 α≤1 등은 평균 미정의)
for _ax in ax:
    for _v, _ls in [(float(dist.mean()), "--"), (float(dist.median()), ":")]:
        if np.isfinite(_v):
            _ax.axvline(_v, color="gray", ls=_ls, lw=1)`;

const PY_STATS = `# 통계량 (평균·분산·표준편차·왜도·초과첨도)
mean, var, skew, kurt = dist.stats(moments="mvsk")
print(f"평균={float(mean):.4f}  분산={float(var):.4f}  표준편차={float(var)**0.5:.4f}")
print(f"왜도={float(skew):.4f}  초과첨도={float(kurt):.4f}")`;

/** 위험측도(VaR·TVaR) 계산 줄 — 연속형은 화면 그래프와 같은 y-치환 적분으로. */
function pyRiskContinuous(q: number): string {
  return `# 위험측도 VaR·TVaR — 꼬리 신뢰수준 q (계리·리스크관리 지표)
q = ${fmtParam(q)}
VaR = dist.ppf(q)                                  # q 확률로 손해가 이 값 이하
# TVaR = E[X | X>VaR] = (1/(1-q))∫_q^1 ppf(u)du (=CTE, 최악 (1-q) 구간 평균 손해).
# u=1-(1-q)e^{-y} 로 치환하면 u→1 특이점이 y→∞ 지수감쇠로 바뀌어, 파레토처럼
# 두꺼운 꼬리도 안정적으로 적분됩니다 (dist.expect의 quad는 이때 과소적분/경고).
N = 800; Ymax = 50.0; h = Ymax / N                 # N은 짝수 (심프슨 규칙)
y = np.linspace(0, Ymax, N + 1)
u = np.minimum(1 - (1 - q) * np.exp(-y), 1 - 1e-15)
w = np.ones(N + 1); w[1:-1:2] = 4; w[2:-1:2] = 2   # 심프슨 가중치 (양끝1·홀4·짝2)
TVaR = float(np.sum(w * dist.ppf(u) * np.exp(-y)) * h / 3)
print(f"VaR({q})={float(VaR):.4f}  TVaR({q})={float(TVaR):.4f}")`;
}

/** 위험측도(VaR·TVaR) 계산 줄 — 이산형은 E[X | X>=VaR] 를 pmf 합으로. */
function pyRiskDiscrete(q: number): string {
  return `# 위험측도 VaR·TVaR — 꼬리 신뢰수준 q (계리·리스크관리 지표)
q = ${fmtParam(q)}
VaR = int(dist.ppf(q))                             # q 확률로 건수가 이 값 이하
ks = np.arange(VaR, int(dist.ppf(0.999999)) + 1)   # VaR 이상 꼬리 구간
TVaR = float(np.sum(ks * dist.pmf(ks)) / np.sum(dist.pmf(ks)))  # E[X | X>=VaR]
print(f"VaR={VaR}  TVaR={TVaR:.4f}")`;
}

function pyContinuous(spec: PySpec, q: number): string {
  return `import numpy as np
from scipy import stats
import matplotlib.pyplot as plt

# ${spec.label}
# 파라미터를 넣어 분포를 '고정(frozen)'하면 dist.pdf / cdf / ppf / rvs 를
# 바로 쓸 수 있습니다 (pdf=밀도, cdf=누적확률, ppf=분위수(cdf의 역함수), rvs=난수)
${spec.assign}
dist = ${spec.expr}

# PDF·CDF 그래프 — x범위는 0.1%~99.9% 분위수로 잡아 꼬리까지 보이게
# (matplotlib 한글 폰트 이슈로 축 라벨은 영문)
x = np.linspace(dist.ppf(0.001), dist.ppf(0.999), 400)
fig, ax = plt.subplots(1, 2, figsize=(9, 3.2))
ax[0].plot(x, dist.pdf(x)); ax[0].set_title("PDF")
ax[1].plot(x, dist.cdf(x)); ax[1].set_title("CDF")

${PY_MARKERS}
plt.tight_layout(); plt.show()

${PY_STATS}

${pyRiskContinuous(q)}`;
}

function pyDiscrete(spec: PySpec, q: number): string {
  return `import numpy as np
from scipy import stats
import matplotlib.pyplot as plt

# ${spec.label}
# 파라미터를 넣어 분포를 '고정(frozen)'하면 dist.pmf / cdf / ppf / rvs 를
# 바로 쓸 수 있습니다 (pmf=확률질량 P(X=k), cdf=누적확률, rvs=난수)
${spec.assign}
dist = ${spec.expr}

# PMF(스템)·CDF(계단) 그래프 — 이산형은 정수 k에서만 확률이 있습니다
k = np.arange(0, ${spec.kmax} + 1)
fig, ax = plt.subplots(1, 2, figsize=(9, 3.2))
ax[0].vlines(k, 0, dist.pmf(k)); ax[0].plot(k, dist.pmf(k), "o", ms=4); ax[0].set_title("PMF")
ax[1].step(k, dist.cdf(k), where="post"); ax[1].set_title("CDF")

${PY_MARKERS}
plt.tight_layout(); plt.show()

${PY_STATS}

${pyRiskDiscrete(q)}`;
}

/* 1모수 파레토의 고정 하한(θ) — 파라미터가 아닌 상수 */
const PARETO1_THETA = 1;

/* ═══════════════════════════ 연속형 분포 ═══════════════════════════ */

const NORMAL: ContinuousDist = {
  kind: "continuous",
  id: "normal",
  name: "정규분포",
  en: "Normal",
  color: "blue",
  blurb: "종형 대칭 분포 — 오차·평균의 극한(중심극한정리).",
  usage: "합계·평균 (중심극한)",
  params: [
    { key: "mu", label: "μ (평균)", tex: "\\mu", def: 0, min: -5, max: 5, step: 0.1 },
    { key: "sigma", label: "σ (표준편차)", tex: "\\sigma", def: 1, min: 0.2, max: 4, step: 0.1 },
  ],
  pdfTex: "f(x)=\\dfrac{1}{\\sigma\\sqrt{2\\pi}}\\;e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}",
  cdfTex: "F(x)=\\dfrac12\\!\\left[1+\\operatorname{erf}\\!\\left(\\dfrac{x-\\mu}{\\sigma\\sqrt2}\\right)\\right]",
  pdf: (x, p) => {
    const z = (x - p.mu) / p.sigma;
    return Math.exp(-0.5 * z * z) / (p.sigma * Math.sqrt(2 * Math.PI));
  },
  cdf: (x, p) => normStdCdf((x - p.mu) / p.sigma),
  domain: (p) => [p.mu - 4 * p.sigma, p.mu + 4 * p.sigma],
  stats: (p) =>
    stats5(
      { mean: "\\mu", var: "\\sigma^2", std: "\\sigma", skew: "0", kurt: "0" },
      { mean: p.mu, variance: p.sigma * p.sigma, skew: 0, kurt: 0 }
    ),
  pySpec: (p, sfx) => ({
    label: `정규분포 Normal(mu=${fmtParam(p.mu)}, sigma=${fmtParam(p.sigma)})`,
    assign: `mu${sfx}, sigma${sfx} = ${fmtParam(p.mu)}, ${fmtParam(p.sigma)}`,
    expr: `stats.norm(loc=mu${sfx}, scale=sigma${sfx})`,
  }),
};

const LOGNORMAL: ContinuousDist = {
  kind: "continuous",
  id: "lognormal",
  name: "로그정규분포",
  en: "Lognormal",
  color: "blue",
  blurb: "로그를 취하면 정규 — 오른쪽 꼬리, 손해심도 모형화에 자주 쓰임.",
  usage: "심도 — 1건 손해액",
  params: [
    { key: "mu", label: "μ (로그평균)", tex: "\\mu", def: 0, min: -2, max: 3, step: 0.1 },
    { key: "sigma", label: "σ (로그표준편차)", tex: "\\sigma", def: 0.5, min: 0.1, max: 2, step: 0.05 },
  ],
  pdfTex:
    "f(x)=\\dfrac{1}{x\\sigma\\sqrt{2\\pi}}\\;e^{-\\frac{(\\ln x-\\mu)^2}{2\\sigma^2}},\\quad x>0",
  cdfTex: "F(x)=\\dfrac12\\!\\left[1+\\operatorname{erf}\\!\\left(\\dfrac{\\ln x-\\mu}{\\sigma\\sqrt2}\\right)\\right]",
  pdf: (x, p) => {
    if (x <= 0) return 0;
    const z = (Math.log(x) - p.mu) / p.sigma;
    return Math.exp(-0.5 * z * z) / (x * p.sigma * Math.sqrt(2 * Math.PI));
  },
  cdf: (x, p) => (x <= 0 ? 0 : normStdCdf((Math.log(x) - p.mu) / p.sigma)),
  domain: (p) => [0, Math.exp(p.mu + 3.2 * p.sigma)],
  stats: (p) => {
    const s2 = p.sigma * p.sigma;
    const mean = Math.exp(p.mu + s2 / 2);
    const variance = (Math.exp(s2) - 1) * Math.exp(2 * p.mu + s2);
    const skew = (Math.exp(s2) + 2) * Math.sqrt(Math.exp(s2) - 1);
    const kurt =
      Math.exp(4 * s2) + 2 * Math.exp(3 * s2) + 3 * Math.exp(2 * s2) - 6;
    return stats5(
      {
        mean: "e^{\\mu+\\sigma^2/2}",
        var: "(e^{\\sigma^2}\\!-\\!1)\\,e^{2\\mu+\\sigma^2}",
        std: "\\sqrt{\\operatorname{Var}}",
        skew: "(e^{\\sigma^2}\\!+\\!2)\\sqrt{e^{\\sigma^2}\\!-\\!1}",
        kurt: "e^{4\\sigma^2}\\!+\\!2e^{3\\sigma^2}\\!+\\!3e^{2\\sigma^2}\\!-\\!6",
      },
      { mean, variance, skew, kurt }
    );
  },
  pySpec: (p, sfx) => ({
    label: `로그정규분포 Lognormal(mu=${fmtParam(p.mu)}, sigma=${fmtParam(p.sigma)})`,
    assign: `mu${sfx}, sigma${sfx} = ${fmtParam(p.mu)}, ${fmtParam(p.sigma)}`,
    expr: `stats.lognorm(s=sigma${sfx}, scale=np.exp(mu${sfx}))`,
  }),
};

const EXPONENTIAL: ContinuousDist = {
  kind: "continuous",
  id: "exponential",
  name: "지수분포",
  en: "Exponential",
  color: "blue",
  blurb: "무기억성 — 사건 간 대기시간. rate λ(=1/평균).",
  usage: "대기시간 (무기억)",
  params: [
    { key: "lam", label: "λ (rate)", tex: "\\lambda", def: 1, min: 0.1, max: 3, step: 0.05 },
  ],
  pdfTex: "f(x)=\\lambda e^{-\\lambda x},\\quad x\\ge 0",
  cdfTex: "F(x)=1-e^{-\\lambda x}",
  pdf: (x, p) => (x < 0 ? 0 : p.lam * Math.exp(-p.lam * x)),
  cdf: (x, p) => (x < 0 ? 0 : 1 - Math.exp(-p.lam * x)),
  domain: (p) => [0, -Math.log(0.001) / p.lam],
  stats: (p) =>
    stats5(
      {
        mean: "1/\\lambda",
        var: "1/\\lambda^2",
        std: "1/\\lambda",
        skew: "2",
        kurt: "6",
      },
      {
        mean: 1 / p.lam,
        variance: 1 / (p.lam * p.lam),
        skew: 2,
        kurt: 6,
      }
    ),
  pySpec: (p, sfx) => ({
    label: `지수분포 Exponential(lambda=${fmtParam(p.lam)})`,
    assign: `lam${sfx} = ${fmtParam(p.lam)}`,
    expr: `stats.expon(scale=1/lam${sfx})`,
  }),
};

const WEIBULL: ContinuousDist = {
  kind: "continuous",
  id: "weibull",
  name: "와이블분포",
  en: "Weibull",
  color: "blue",
  blurb: "형상 k로 고장률이 감소·일정·증가 — 신뢰성·수명 분석.",
  usage: "수명·지속기간",
  params: [
    { key: "k", label: "k (형상)", tex: "k", def: 1.5, min: 0.3, max: 5, step: 0.1 },
    { key: "lam", label: "λ (척도)", tex: "\\lambda", def: 1, min: 0.2, max: 5, step: 0.1 },
  ],
  pdfTex:
    "f(x)=\\dfrac{k}{\\lambda}\\!\\left(\\dfrac{x}{\\lambda}\\right)^{k-1}\\!e^{-(x/\\lambda)^k},\\quad x\\ge 0",
  cdfTex: "F(x)=1-e^{-(x/\\lambda)^{k}}",
  pdf: (x, p) => {
    if (x < 0) return 0;
    const { k, lam } = p;
    if (x === 0) return k < 1 ? Infinity : k === 1 ? k / lam : 0;
    const z = x / lam;
    return (k / lam) * Math.pow(z, k - 1) * Math.exp(-Math.pow(z, k));
  },
  cdf: (x, p) => (x < 0 ? 0 : 1 - Math.exp(-Math.pow(x / p.lam, p.k))),
  domain: (p) => [0, p.lam * Math.pow(-Math.log(0.001), 1 / p.k)],
  stats: (p) => {
    const g = (i: number) => Math.exp(lgamma(1 + i / p.k));
    const g1 = g(1);
    const g2 = g(2);
    const g3 = g(3);
    const g4 = g(4);
    const mean = p.lam * g1;
    const variance = p.lam * p.lam * (g2 - g1 * g1);
    const v = g2 - g1 * g1;
    const skew = (g3 - 3 * g1 * g2 + 2 * g1 ** 3) / Math.pow(v, 1.5);
    const kurt =
      (g4 - 4 * g1 * g3 + 6 * g1 * g1 * g2 - 3 * g1 ** 4) / (v * v) - 3;
    return stats5(
      {
        mean: "\\lambda\\,\\Gamma\\!\\left(1+\\tfrac1k\\right)",
        var: "\\lambda^2\\!\\left[\\Gamma\\!\\left(1+\\tfrac2k\\right)-\\Gamma\\!\\left(1+\\tfrac1k\\right)^2\\right]",
        std: "\\sqrt{\\operatorname{Var}}",
        skew: "\\dfrac{\\Gamma_3-3\\Gamma_1\\Gamma_2+2\\Gamma_1^3}{(\\Gamma_2-\\Gamma_1^2)^{3/2}}",
        kurt: "\\dfrac{\\Gamma_4-4\\Gamma_1\\Gamma_3+6\\Gamma_1^2\\Gamma_2-3\\Gamma_1^4}{(\\Gamma_2-\\Gamma_1^2)^2}-3",
      },
      { mean, variance, skew, kurt }
    );
  },
  pySpec: (p, sfx) => ({
    label: `와이블분포 Weibull(k=${fmtParam(p.k)}, lambda=${fmtParam(p.lam)})`,
    assign: `k${sfx}, lam${sfx} = ${fmtParam(p.k)}, ${fmtParam(p.lam)}`,
    expr: `stats.weibull_min(c=k${sfx}, scale=lam${sfx})`,
  }),
};

const GAMMA: ContinuousDist = {
  kind: "continuous",
  id: "gamma",
  name: "감마분포",
  en: "Gamma",
  color: "blue",
  blurb: "지수분포 합의 일반화 — 양의 연속량(손해심도) 모형.",
  usage: "심도 — 1건 손해액",
  params: [
    { key: "alpha", label: "α (형상)", tex: "\\alpha", def: 2, min: 0.3, max: 10, step: 0.1 },
    { key: "theta", label: "θ (척도)", tex: "\\theta", def: 1, min: 0.2, max: 5, step: 0.1 },
  ],
  pdfTex:
    "f(x)=\\dfrac{1}{\\Gamma(\\alpha)\\theta^{\\alpha}}\\,x^{\\alpha-1}e^{-x/\\theta},\\quad x>0",
  cdfTex: "F(x)=\\dfrac{\\gamma(\\alpha,\\,x/\\theta)}{\\Gamma(\\alpha)}=P\\!\\left(\\alpha,\\tfrac{x}{\\theta}\\right)",
  pdf: (x, p) => {
    if (x <= 0) return p.alpha < 1 ? Infinity : x === 0 && p.alpha === 1 ? 1 / p.theta : 0;
    return Math.exp(
      (p.alpha - 1) * Math.log(x) -
        x / p.theta -
        lgamma(p.alpha) -
        p.alpha * Math.log(p.theta)
    );
  },
  cdf: (x, p) => (x <= 0 ? 0 : lowerRegGamma(p.alpha, x / p.theta)),
  domain: (p) => {
    const cdf = (x: number) => (x <= 0 ? 0 : lowerRegGamma(p.alpha, x / p.theta));
    const hi = p.theta * (p.alpha + 12 * Math.sqrt(p.alpha) + 12);
    return [0, quantileBisection(cdf, 0.999, 0, hi)];
  },
  stats: (p) =>
    stats5(
      {
        mean: "\\alpha\\theta",
        var: "\\alpha\\theta^2",
        std: "\\sqrt{\\alpha}\\,\\theta",
        skew: "2/\\sqrt{\\alpha}",
        kurt: "6/\\alpha",
      },
      {
        mean: p.alpha * p.theta,
        variance: p.alpha * p.theta * p.theta,
        skew: 2 / Math.sqrt(p.alpha),
        kurt: 6 / p.alpha,
      }
    ),
  pySpec: (p, sfx) => ({
    label: `감마분포 Gamma(alpha=${fmtParam(p.alpha)}, theta=${fmtParam(p.theta)})`,
    assign: `alpha${sfx}, theta${sfx} = ${fmtParam(p.alpha)}, ${fmtParam(p.theta)}`,
    expr: `stats.gamma(a=alpha${sfx}, scale=theta${sfx})`,
  }),
};

const BETA: ContinuousDist = {
  kind: "continuous",
  id: "beta",
  name: "베타분포",
  en: "Beta",
  color: "blue",
  blurb: "[0,1] 구간 비율·확률 모형 — 베이지안 사전분포로도 쓰임.",
  usage: "손해율 (0~1)",
  params: [
    { key: "alpha", label: "α", tex: "\\alpha", def: 2, min: 0.3, max: 8, step: 0.1 },
    { key: "beta", label: "β", tex: "\\beta", def: 2, min: 0.3, max: 8, step: 0.1 },
  ],
  pdfTex:
    "f(x)=\\dfrac{x^{\\alpha-1}(1-x)^{\\beta-1}}{B(\\alpha,\\beta)},\\quad 0\\le x\\le 1",
  cdfTex: "F(x)=I_x(\\alpha,\\beta)\\;\\text{(정규화 불완전 베타)}",
  pdf: (x, p) => {
    if (x <= 0 || x >= 1) {
      // 끝점 발산·0 처리(그래프는 유한 클램프)
      if (x <= 0) return p.alpha < 1 ? Infinity : p.alpha === 1 ? 1 / Math.exp(betaln(p.alpha, p.beta)) : 0;
      return p.beta < 1 ? Infinity : p.beta === 1 ? 1 / Math.exp(betaln(p.alpha, p.beta)) : 0;
    }
    return Math.exp(
      (p.alpha - 1) * Math.log(x) +
        (p.beta - 1) * Math.log(1 - x) -
        betaln(p.alpha, p.beta)
    );
  },
  cdf: (x, p) => regIncBeta(x, p.alpha, p.beta),
  domain: () => [0, 1],
  stats: (p) => {
    const a = p.alpha;
    const b = p.beta;
    const s = a + b;
    const mean = a / s;
    const variance = (a * b) / (s * s * (s + 1));
    const skew =
      (2 * (b - a) * Math.sqrt(s + 1)) / ((s + 2) * Math.sqrt(a * b));
    const kurt =
      (6 * ((a - b) ** 2 * (s + 1) - a * b * (s + 2))) /
      (a * b * (s + 2) * (s + 3));
    return stats5(
      {
        mean: "\\dfrac{\\alpha}{\\alpha+\\beta}",
        var: "\\dfrac{\\alpha\\beta}{(\\alpha+\\beta)^2(\\alpha+\\beta+1)}",
        std: "\\sqrt{\\operatorname{Var}}",
        skew: "\\dfrac{2(\\beta-\\alpha)\\sqrt{\\alpha+\\beta+1}}{(\\alpha+\\beta+2)\\sqrt{\\alpha\\beta}}",
        kurt: "\\dfrac{6[(\\alpha-\\beta)^2(\\alpha+\\beta+1)-\\alpha\\beta(\\alpha+\\beta+2)]}{\\alpha\\beta(\\alpha+\\beta+2)(\\alpha+\\beta+3)}",
      },
      { mean, variance, skew, kurt }
    );
  },
  pySpec: (p, sfx) => ({
    label: `베타분포 Beta(alpha=${fmtParam(p.alpha)}, beta=${fmtParam(p.beta)})`,
    assign: `a${sfx}, b${sfx} = ${fmtParam(p.alpha)}, ${fmtParam(p.beta)}`,
    expr: `stats.beta(a=a${sfx}, b=b${sfx})`,
  }),
};

/** 파레토(2모수, Loss Models/Lomax): f=αθ^α/(x+θ)^{α+1}, x>0 */
const PARETO2: ContinuousDist = {
  kind: "continuous",
  id: "pareto2",
  name: "파레토분포 (2모수)",
  en: "Pareto (two-parameter, Lomax)",
  color: "blue",
  blurb: "두꺼운 꼬리 손해분포 — Loss Models 관례(θ 이동). 적률은 α 조건부 존재.",
  usage: "심도 꼬리 — 대형손해",
  params: [
    { key: "alpha", label: "α (형상)", tex: "\\alpha", def: 3, min: 0.5, max: 8, step: 0.1 },
    { key: "theta", label: "θ (척도)", tex: "\\theta", def: 1000, min: 100, max: 5000, step: 100 },
  ],
  pdfTex:
    "f(x)=\\dfrac{\\alpha\\theta^{\\alpha}}{(x+\\theta)^{\\alpha+1}},\\quad x>0",
  cdfTex: "F(x)=1-\\left(\\dfrac{\\theta}{x+\\theta}\\right)^{\\alpha}",
  pdf: (x, p) => {
    if (x < 0) return 0;
    return Math.exp(
      Math.log(p.alpha) +
        p.alpha * Math.log(p.theta) -
        (p.alpha + 1) * Math.log(x + p.theta)
    );
  },
  cdf: (x, p) => (x < 0 ? 0 : 1 - Math.pow(p.theta / (x + p.theta), p.alpha)),
  domain: (p) => [0, p.theta * (Math.pow(1 - 0.95, -1 / p.alpha) - 1)],
  stats: (p) => paretoStats(p.alpha, p.theta, false),
  pySpec: (p, sfx) => ({
    label: `파레토(2모수) Lomax(alpha=${fmtParam(p.alpha)}, theta=${fmtParam(p.theta)})`,
    assign: `alpha${sfx}, theta${sfx} = ${fmtParam(p.alpha)}, ${fmtParam(p.theta)}`,
    expr: `stats.lomax(c=alpha${sfx}, scale=theta${sfx})`,
  }),
};

/** 파레토(1모수, single-parameter): f=αθ^α/x^{α+1}, x>θ(θ 고정) */
const PARETO1: ContinuousDist = {
  kind: "continuous",
  id: "pareto1",
  name: "파레토분포 (1모수)",
  en: "Single-parameter Pareto",
  color: "blue",
  blurb: `하한 θ=${PARETO1_THETA} 고정, 형상 α만 추정 — 초과손해(θ 이상) 모형.`,
  usage: "심도 꼬리 — 초과손해",
  params: [
    { key: "alpha", label: "α (형상)", tex: "\\alpha", def: 3, min: 0.5, max: 8, step: 0.1 },
  ],
  pdfTex: `f(x)=\\dfrac{\\alpha\\,\\theta^{\\alpha}}{x^{\\alpha+1}},\\quad x>\\theta=${PARETO1_THETA}`,
  cdfTex: `F(x)=1-\\left(\\dfrac{\\theta}{x}\\right)^{\\alpha},\\quad \\theta=${PARETO1_THETA}`,
  pdf: (x, p) => {
    if (x < PARETO1_THETA) return 0;
    return Math.exp(
      Math.log(p.alpha) +
        p.alpha * Math.log(PARETO1_THETA) -
        (p.alpha + 1) * Math.log(x)
    );
  },
  cdf: (x, p) =>
    x < PARETO1_THETA ? 0 : 1 - Math.pow(PARETO1_THETA / x, p.alpha),
  domain: (p) => [
    PARETO1_THETA,
    PARETO1_THETA * Math.pow(1 - 0.95, -1 / p.alpha),
  ],
  stats: (p) => paretoStats(p.alpha, PARETO1_THETA, true),
  pySpec: (p, sfx) => ({
    label: `파레토(1모수) Pareto(alpha=${fmtParam(p.alpha)}, theta=${PARETO1_THETA})`,
    assign: `alpha${sfx}, theta${sfx} = ${fmtParam(p.alpha)}, ${PARETO1_THETA}`,
    expr: `stats.pareto(b=alpha${sfx}, scale=theta${sfx})`,
  }),
};

/**
 * 파레토 적률 — 원적률에서 중심적률로. single=true는 1모수(x>θ),
 * false는 2모수(Lomax). 각 적률은 α > 차수일 때만 존재.
 * 1모수: E[X^k]=αθ^k/(α−k). 2모수: E[X^k]=θ^k·k!/∏_{i=1}^k(α−i).
 */
function paretoStats(alpha: number, theta: number, single: boolean): StatValue[] {
  const raw = (k: number): number | null => {
    if (alpha <= k) return null;
    if (single) return (alpha * Math.pow(theta, k)) / (alpha - k);
    let num = Math.pow(theta, k);
    for (let i = 1; i <= k; i++) num *= i / (alpha - i);
    return num;
  };
  const m1 = raw(1);
  const m2 = raw(2);
  const m3 = raw(3);
  const m4 = raw(4);
  let mean: number | null = m1;
  let variance: number | null = null;
  let skew: number | null = null;
  let kurt: number | null = null;
  if (m1 !== null && m2 !== null) {
    const cm =
      m3 !== null && m4 !== null
        ? centralFromRaw(m1, m2, m3, m4)
        : { variance: m2 - m1 * m1, skewness: NaN, excessKurtosis: NaN };
    variance = cm.variance;
    if (m3 !== null) skew = centralFromRaw(m1, m2, m3, m4 ?? 0).skewness;
    if (m4 !== null && m3 !== null) kurt = centralFromRaw(m1, m2, m3, m4).excessKurtosis;
  }
  const meanTex = single
    ? "\\dfrac{\\alpha\\theta}{\\alpha-1}"
    : "\\dfrac{\\theta}{\\alpha-1}";
  return stats5(
    {
      mean: meanTex,
      var: "E[X^2]-E[X]^2",
      std: "\\sqrt{\\operatorname{Var}}",
      skew: "\\dfrac{\\mu_3}{\\sigma^3}",
      kurt: "\\dfrac{\\mu_4}{\\sigma^4}-3",
    },
    { mean, variance, skew, kurt },
    {
      mean: "α > 1 필요",
      var: "α > 2 필요",
      skew: "α > 3 필요",
      kurt: "α > 4 필요",
    }
  );
}

/* ═══════════════════════════ 이산형 분포 ═══════════════════════════ */

const BINOMIAL: DiscreteDist = {
  kind: "discrete",
  id: "binomial",
  name: "이항분포",
  en: "Binomial",
  color: "violet",
  blurb: "성공확률 p인 독립시행 n회 중 성공 횟수.",
  usage: "사고 여부 (0/1 합)",
  params: [
    { key: "n", label: "n (시행수)", tex: "n", def: 20, min: 1, max: 50, step: 1, integer: true },
    { key: "p", label: "p (성공확률)", tex: "p", def: 0.5, min: 0.01, max: 0.99, step: 0.01 },
  ],
  pmfTex:
    "P(X=k)=\\binom{n}{k}p^{k}(1-p)^{n-k},\\quad k=0,\\dots,n",
  cdfTex: "F(k)=\\displaystyle\\sum_{i=0}^{k}\\binom{n}{i}p^{i}(1-p)^{n-i}",
  pmf: (k, p) => {
    const n = Math.round(p.n);
    if (k < 0 || k > n) return 0;
    return Math.exp(
      logChoose(n, k) + k * Math.log(p.p) + (n - k) * Math.log(1 - p.p)
    );
  },
  kMax: (p) => Math.round(p.n),
  stats: (p) => {
    const n = p.n;
    const q = 1 - p.p;
    const npq = n * p.p * q;
    return stats5(
      {
        mean: "np",
        var: "np(1-p)",
        std: "\\sqrt{np(1-p)}",
        skew: "\\dfrac{1-2p}{\\sqrt{np(1-p)}}",
        kurt: "\\dfrac{1-6p(1-p)}{np(1-p)}",
      },
      {
        mean: n * p.p,
        variance: npq,
        skew: (1 - 2 * p.p) / Math.sqrt(npq),
        kurt: (1 - 6 * p.p * q) / npq,
      }
    );
  },
  pySpec: (p, sfx) => ({
    label: `이항분포 Binomial(n=${Math.round(p.n)}, p=${fmtParam(p.p)})`,
    assign: `n${sfx}, p${sfx} = ${Math.round(p.n)}, ${fmtParam(p.p)}`,
    expr: `stats.binom(n${sfx}, p${sfx})`,
    kmax: `n${sfx}`,
  }),
};

const POISSON: DiscreteDist = {
  kind: "discrete",
  id: "poisson",
  name: "포아송분포",
  en: "Poisson",
  color: "violet",
  blurb: "단위구간당 평균 λ회 발생하는 희귀사건 건수 — 사고건수 모형.",
  usage: "빈도 — 연간 건수",
  params: [
    { key: "lam", label: "λ (평균)", tex: "\\lambda", def: 3, min: 0.1, max: 20, step: 0.1 },
  ],
  pmfTex: "P(X=k)=\\dfrac{e^{-\\lambda}\\lambda^{k}}{k!},\\quad k=0,1,\\dots",
  cdfTex: "F(k)=e^{-\\lambda}\\displaystyle\\sum_{i=0}^{k}\\dfrac{\\lambda^{i}}{i!}",
  pmf: (k, p) => {
    if (k < 0) return 0;
    return Math.exp(-p.lam + k * Math.log(p.lam) - factln(k));
  },
  kMax: (p) => Math.ceil(p.lam + 4 * Math.sqrt(p.lam) + 8),
  stats: (p) =>
    stats5(
      {
        mean: "\\lambda",
        var: "\\lambda",
        std: "\\sqrt{\\lambda}",
        skew: "1/\\sqrt{\\lambda}",
        kurt: "1/\\lambda",
      },
      {
        mean: p.lam,
        variance: p.lam,
        skew: 1 / Math.sqrt(p.lam),
        kurt: 1 / p.lam,
      }
    ),
  pySpec: (p, sfx) => ({
    label: `포아송분포 Poisson(lambda=${fmtParam(p.lam)})`,
    assign: `lam${sfx} = ${fmtParam(p.lam)}`,
    expr: `stats.poisson(lam${sfx})`,
    kmax: `int(dist${sfx}.ppf(0.999))`,
  }),
};

const NEGBINOM: DiscreteDist = {
  kind: "discrete",
  id: "negbinom",
  name: "음이항분포",
  en: "Negative Binomial",
  color: "violet",
  blurb: "r번째 성공까지의 실패 횟수 — 과산포(분산>평균) 건수 모형.",
  usage: "빈도 — 과산포 건수",
  params: [
    { key: "r", label: "r (성공 목표수)", tex: "r", def: 5, min: 1, max: 20, step: 1 },
    { key: "p", label: "p (성공확률)", tex: "p", def: 0.5, min: 0.05, max: 0.95, step: 0.05 },
  ],
  pmfTex:
    "P(X=k)=\\binom{k+r-1}{k}p^{r}(1-p)^{k},\\quad k=0,1,\\dots",
  cdfTex: "F(k)=\\displaystyle\\sum_{i=0}^{k}\\binom{i+r-1}{i}p^{r}(1-p)^{i}",
  pmf: (k, p) => {
    if (k < 0) return 0;
    // C(k+r−1, k) = Γ(k+r)/(Γ(r)·k!) — r 실수 허용
    return Math.exp(
      lgamma(k + p.r) -
        lgamma(p.r) -
        factln(k) +
        p.r * Math.log(p.p) +
        k * Math.log(1 - p.p)
    );
  },
  kMax: (p) => {
    const mean = (p.r * (1 - p.p)) / p.p;
    const sd = Math.sqrt((p.r * (1 - p.p)) / (p.p * p.p));
    return Math.ceil(mean + 4 * sd + 8);
  },
  stats: (p) => {
    const q = 1 - p.p;
    const mean = (p.r * q) / p.p;
    const variance = (p.r * q) / (p.p * p.p);
    return stats5(
      {
        mean: "\\dfrac{r(1-p)}{p}",
        var: "\\dfrac{r(1-p)}{p^2}",
        std: "\\sqrt{\\operatorname{Var}}",
        skew: "\\dfrac{2-p}{\\sqrt{r(1-p)}}",
        kurt: "\\dfrac{p^2-6p+6}{r(1-p)}",
      },
      {
        mean,
        variance,
        skew: (2 - p.p) / Math.sqrt(p.r * q),
        kurt: (p.p * p.p - 6 * p.p + 6) / (p.r * q),
      }
    );
  },
  pySpec: (p, sfx) => ({
    label: `음이항분포 NegBinom(r=${fmtParam(p.r)}, p=${fmtParam(p.p)})`,
    assign: `r${sfx}, p${sfx} = ${fmtParam(p.r)}, ${fmtParam(p.p)}`,
    expr: `stats.nbinom(n=r${sfx}, p=p${sfx})`,
    kmax: `int(dist${sfx}.ppf(0.999))`,
  }),
};

/* ═══════════════════════════ 그룹·조회 ═══════════════════════════ */

export const CONTINUOUS_DISTS: ContinuousDist[] = [
  NORMAL,
  LOGNORMAL,
  EXPONENTIAL,
  WEIBULL,
  GAMMA,
  BETA,
  PARETO2,
  PARETO1,
];

export const DISCRETE_DISTS: DiscreteDist[] = [BINOMIAL, POISSON, NEGBINOM];

export const ALL_DISTS: Distribution[] = [
  ...CONTINUOUS_DISTS,
  ...DISCRETE_DISTS,
];

export function defaultParams(d: Distribution): Params {
  const p: Params = {};
  for (const par of d.params) p[par.key] = par.def;
  return p;
}

/** 같은 종류(연속/이산)의 분포 목록 — 비교 대상 후보. */
export function peersOf(d: Distribution): Distribution[] {
  return d.kind === "continuous" ? CONTINUOUS_DISTS : DISCRETE_DISTS;
}

/* ═══════════════════════ 평균·중위수 (그래프 마커용) ═══════════════════════ */

/** 평균 — 정의되지 않거나(파레토 α≤1) 발산하면 null. */
export function meanOf(d: Distribution, p: Params): number | null {
  const v = d.stats(p).find((s) => s.label === "평균")?.value;
  return v !== undefined && v !== null && Number.isFinite(v) ? v : null;
}

/**
 * p-분위수 — 연속형은 CDF 이분법(도메인을 브래킷으로, 필요 시 상한 확장),
 * 이산형은 누적확률이 prob에 처음 도달하는 k(수치 잔차로 못 닿으면 상한 k).
 * QQ-plot·중위수 마커 공용.
 */
export function quantileOf(
  d: Distribution,
  p: Params,
  prob: number
): number | null {
  if (!(prob > 0 && prob < 1)) return null;
  if (d.kind === "continuous") {
    const [lo, hi] = d.domain(p);
    const q = quantileBisection((x) => d.cdf(x, p), prob, lo, hi);
    return Number.isFinite(q) ? q : null;
  }
  const kMax = Math.max(1, d.kMax(p));
  let acc = 0;
  for (let k = 0; k <= kMax; k++) {
    acc += d.pmf(k, p);
    if (acc >= prob) return k;
  }
  return kMax;
}

/** 정규분포 분위수 — QQ-plot 기준선(모멘트 정합 정규)용. */
export function normalQuantile(
  mu: number,
  sigma: number,
  prob: number
): number {
  const z = quantileBisection((x) => normStdCdf(x), prob, -10, 10);
  return mu + sigma * z;
}

/** 중위수 — 0.5 분위수. */
export function medianOf(d: Distribution, p: Params): number | null {
  return quantileOf(d, p, 0.5);
}

/* ═══════════════════════ 위험측도 (VaR·TVaR) ═══════════════════════ */

/**
 * VaR_q (Value at Risk) — q 분위수. "q 확률로 손해가 이 값 이하"라는 의미.
 * quantileOf 재사용(연속=CDF 이분법, 이산=누적 첫 도달 k).
 */
export function valueAtRisk(
  d: Distribution,
  p: Params,
  q: number
): number | null {
  return quantileOf(d, p, q);
}

/**
 * TVaR_q (=CTE, Conditional Tail Expectation) = E[X | X > VaR_q] —
 * 최악 (1−q) 구간의 평균 손해. VaR보다 꼬리 위험을 더 잘 반영한다.
 *
 * 연속형: TVaR_q = (1/(1−q))∫_q^1 ppf(u)du 를 u=1−(1−q)e^{−y} 치환으로
 *   ∫_0^∞ ppf(1−(1−q)e^{−y})·e^{−y} dy 로 바꿔 심프슨 적분한다. 이 치환은
 *   u→1의 적분 특이점을 y→∞의 지수감쇠로 바꿔 두꺼운 꼬리도 안정적으로 적분한다
 *   (scipy .expect의 quad가 발산 경고를 내는 파레토 α≲2에서도 수렴).
 *   ppf는 CDF 이분법(quantileBisection). 평균이 유한할 때만 정의(파레토 α≤1 등은 null).
 * 이산형: E[X | X≥VaR] = Σ_{k≥V} k·pmf(k) / Σ_{k≥V} pmf(k).
 *
 * 로컬 scipy 대조: 정규·로그정규·감마·파레토2 등 상대오차 ~3e−8
 * (_workspace/phase3/py/riskmeasure_check.py).
 */
export function tailValueAtRisk(
  d: Distribution,
  p: Params,
  q: number
): number | null {
  if (!(q > 0 && q < 1)) return null;

  if (d.kind === "continuous") {
    // 평균이 발산하면(파레토 α≤1) TVaR도 발산 → 정의 안 됨
    if (meanOf(d, p) === null) return null;
    const [lo, hi0] = d.domain(p);
    const cdf = (x: number) => d.cdf(x, p);
    const oneMinusQ = 1 - q;
    // TVaR = (1/(1-q))∫_q^1 VaR_u du 를 u=1-(1-q)e^{-y} 치환으로 계산(y→∞ 지수 감쇠).
    // 한계: 극단적 두꺼운 꼬리(파레토 α가 1에 근접, 대략 α<1.4)에서는 u가 1-1e-15 클램프에
    // 걸려(≈y=30) 그보다 안쪽 꼬리를 double로 표현 못 해 값이 수 % 과소된다. Ymax를 키워도
    // 해소되지 않는다(원인은 절단이 아니라 u→1 배정밀도 saturation) — 근본 해결은 각 분포에
    // 생존함수(isf)를 두어 s=1-u 공간에서 적분해야 하며, 그러면 코드생성(scipy .ppf)과의
    // 일치가 깨진다. α≈1은 TVaR 자체가 거의 발산하는 영역이라 현 근사를 유지한다.
    const N = 800; // 짝수 (심프슨)
    const Ymax = 50;
    const h = Ymax / N;
    let total = 0;
    for (let i = 0; i <= N; i++) {
      const y = i * h;
      let u = 1 - oneMinusQ * Math.exp(-y);
      if (u >= 1) u = 1 - 1e-15;
      const x = quantileBisection(cdf, u, lo, hi0);
      const term = x * Math.exp(-y);
      const w = i === 0 || i === N ? 1 : i % 2 === 1 ? 4 : 2;
      total += w * term;
    }
    const tvar = (total * h) / 3;
    return Number.isFinite(tvar) ? tvar : null;
  }

  // 이산형 — E[X | X≥VaR]
  const V = quantileOf(d, p, q);
  if (V === null) return null;
  const kMax = Math.max(V, d.kMax(p));
  let num = 0;
  let den = 0;
  for (let k = V; k <= kMax; k++) {
    const pk = d.pmf(k, p);
    num += k * pk;
    den += pk;
  }
  return den > 0 ? num / den : null;
}

/* ═══════════════════════ 파이썬 코드 생성 ═══════════════════════ */

/** 단일 분포 코드 — 변수 접미사 없음. q는 위험측도(VaR·TVaR) 신뢰수준. */
export function singlePython(d: Distribution, p: Params, q = 0.99): string {
  const spec = d.pySpec(p, "");
  return d.kind === "continuous"
    ? pyContinuous(spec, q)
    : pyDiscrete(spec, q);
}

/**
 * 두 분포를 겹쳐 그리는 비교 코드 — A는 `_a`, B는 `_b` 접미사라 변수 충돌이 없다.
 * UI가 같은 종류끼리만 비교하도록 제한하므로 a·b의 kind는 같다고 본다.
 */
export function comparePython(
  a: Distribution,
  pa: Params,
  b: Distribution,
  pb: Params,
  q = 0.99
): string {
  const sa = a.pySpec(pa, "_a");
  const sb = b.pySpec(pb, "_b");

  const bothContinuous = a.kind === "continuous" && b.kind === "continuous";
  const risk = bothContinuous
    ? `# 위험측도 VaR·TVaR — 꼬리 신뢰수준 q (=CTE, 최악 (1-q) 구간 평균)
# TVaR=E[X|X>VaR]=(1/(1-q))∫_q^1 ppf(u)du. u=1-(1-q)e^{-y} 치환으로 u→1 특이점을
# y→∞ 지수감쇠로 바꿔 두꺼운 꼬리(파레토 등)도 안정 적분 (dist.expect의 quad는 과소적분)
q = ${fmtParam(q)}
_N = 800; _Ymax = 50.0; _h = _Ymax / _N            # _N은 짝수 (심프슨 규칙)
_y = np.linspace(0, _Ymax, _N + 1)
_u = np.minimum(1 - (1 - q) * np.exp(-_y), 1 - 1e-15)
_w = np.ones(_N + 1); _w[1:-1:2] = 4; _w[2:-1:2] = 2
for _name, _d in [("A", dist_a), ("B", dist_b)]:
    VaR = _d.ppf(q)
    TVaR = float(np.sum(_w * _d.ppf(_u) * np.exp(-_y)) * _h / 3)
    print(f"[{_name}] VaR({q})={float(VaR):.4f}  TVaR({q})={float(TVaR):.4f}")`
    : `# 위험측도 VaR·TVaR — 꼬리 신뢰수준 q (이산형은 E[X | X>=VaR])
q = ${fmtParam(q)}
for _name, _d in [("A", dist_a), ("B", dist_b)]:
    VaR = int(_d.ppf(q))
    ks = np.arange(VaR, int(_d.ppf(0.999999)) + 1)
    TVaR = float(np.sum(ks * _d.pmf(ks)) / np.sum(_d.pmf(ks)))
    print(f"[{_name}] VaR={VaR}  TVaR={TVaR:.4f}")`;

  const head = `import numpy as np
from scipy import stats
import matplotlib.pyplot as plt

# A: ${sa.label}
${sa.assign}
dist_a = ${sa.expr}

# B: ${sb.label}
${sb.assign}
dist_b = ${sb.expr}`;

  const markers = `# 평균(파선)·중위수(점선) — A는 파랑, B는 보라
for _ax in ax:
    for _d, _c in [(dist_a, "tab:blue"), (dist_b, "tab:purple")]:
        for _v, _ls in [(float(_d.mean()), "--"), (float(_d.median()), ":")]:
            if np.isfinite(_v):
                _ax.axvline(_v, color=_c, ls=_ls, lw=1, alpha=0.6)
plt.tight_layout(); plt.show()`;

  const tail = `# 통계량 비교 (평균·분산·표준편차·왜도·초과첨도)
for _name, _d in [("A", dist_a), ("B", dist_b)]:
    mean, var, skew, kurt = _d.stats(moments="mvsk")
    print(f"[{_name}] 평균={float(mean):.4f}  분산={float(var):.4f}  표준편차={float(var)**0.5:.4f}")
    print(f"     왜도={float(skew):.4f}  초과첨도={float(kurt):.4f}")`;

  if (a.kind === "continuous" && b.kind === "continuous") {
    return `${head}

# 두 분포를 한 그래프에 — x범위는 두 분포의 합집합 (축 라벨은 영문)
lo = min(dist_a.ppf(0.001), dist_b.ppf(0.001))
hi = max(dist_a.ppf(0.999), dist_b.ppf(0.999))
x = np.linspace(lo, hi, 400)
fig, ax = plt.subplots(1, 2, figsize=(9, 3.2))
ax[0].plot(x, dist_a.pdf(x), label="A"); ax[0].plot(x, dist_b.pdf(x), ls="--", label="B")
ax[0].set_title("PDF"); ax[0].legend()
ax[1].plot(x, dist_a.cdf(x), label="A"); ax[1].plot(x, dist_b.cdf(x), ls="--", label="B")
ax[1].set_title("CDF"); ax[1].legend()

${markers}

${tail}

${risk}`;
  }

  const kmaxA = sa.kmax ?? "int(dist_a.ppf(0.999))";
  const kmaxB = sb.kmax ?? "int(dist_b.ppf(0.999))";
  return `${head}

# 두 분포를 한 그래프에 — k범위는 두 분포의 합집합
k = np.arange(0, max(${kmaxA}, ${kmaxB}) + 1)
fig, ax = plt.subplots(1, 2, figsize=(9, 3.2))
ax[0].plot(k, dist_a.pmf(k), "o-", ms=3, lw=1, label="A")
ax[0].plot(k, dist_b.pmf(k), "s--", ms=3, lw=1, label="B")
ax[0].set_title("PMF"); ax[0].legend()
ax[1].step(k, dist_a.cdf(k), where="post", label="A")
ax[1].step(k, dist_b.cdf(k), where="post", ls="--", label="B")
ax[1].set_title("CDF"); ax[1].legend()

${markers}

${tail}

${risk}`;
}
