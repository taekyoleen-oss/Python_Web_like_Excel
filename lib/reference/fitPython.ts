/**
 * 모델 적합 탭 — 안내용 파이썬 코드 생성. 화면의 적합(pyFit.ts의 FIT_SCRIPT)과
 * 같은 방법(같은 scipy 호출·같은 고정 모수)을 독립 실행 가능한 스크립트로
 * 재현한다. 데이터는 코드에 직접 임베드(최대 2000개, 초과분은 안내 주석).
 *
 * 사용자 결정(2026-07-16): 모든 코드는 초보자가 읽을 수 있게 단계별 설명
 * 주석을 충분히 달고, 몬테카를로 시뮬레이션은 분포마다 방법·주의점이 다르므로
 * 분포별 전용 코드(severitySimCode/frequencySimCode)를 따로 생성한다
 * (코드 팝업의 '시뮬레이션' 탭). React 의존 없음.
 */
import type { FitData } from "./fitData";
import type { FitParamOut } from "./pyFit";

const EMBED_CAP = 2000;

/** 숫자 배열 → 파이썬 리스트 리터럴(12개/줄 줄바꿈, 상한 초과 시 절단 주석). */
function pyArray(values: number[], indent = "    "): { code: string; truncated: boolean } {
  const vals = values.slice(0, EMBED_CAP);
  const lines: string[] = [];
  for (let i = 0; i < vals.length; i += 12) {
    lines.push(indent + vals.slice(i, i + 12).map((v) => String(v)).join(", ") + ",");
  }
  return {
    code: `[\n${lines.join("\n")}\n]`,
    truncated: values.length > EMBED_CAP,
  };
}

function truncNote(total: number): string {
  return `# ⚠ 데이터가 많아 앞 ${EMBED_CAP}개만 임베드했습니다(전체 ${total}개).\n# 전체 분석은 원본을 CSV로 저장해 pd.read_csv 등으로 불러오세요.\n`;
}

function p(params: FitParamOut[] | undefined, name: string): number {
  return params?.find((q) => q.name === name)?.value ?? NaN;
}

function f(v: number): string {
  if (!Number.isFinite(v)) return "float('nan')";
  return String(Math.round(v * 1e6) / 1e6);
}

/* ─────────────── 분포 id ↔ scipy 표현(적합·표본추출 공용) ─────────────── */

/** 적합된 파라미터로 frozen 분포 생성 식. */
export function sevFrozenExpr(id: string, params: FitParamOut[]): string {
  switch (id) {
    case "normal":
      return `stats.norm(${f(p(params, "mu"))}, ${f(p(params, "sigma"))})`;
    case "lognormal":
      return `stats.lognorm(${f(p(params, "sigma"))}, 0, np.exp(${f(p(params, "mu"))}))`;
    case "exponential":
      return `stats.expon(0, ${f(1 / p(params, "lambda"))})`;
    case "weibull":
      return `stats.weibull_min(${f(p(params, "k"))}, 0, ${f(p(params, "lambda"))})`;
    case "gamma":
      return `stats.gamma(${f(p(params, "alpha"))}, 0, ${f(p(params, "theta"))})`;
    case "beta":
      return `stats.beta(${f(p(params, "alpha"))}, ${f(p(params, "beta"))})`;
    case "pareto2":
      return `stats.lomax(${f(p(params, "alpha"))}, 0, ${f(p(params, "theta"))})`;
    case "pareto1":
      return `stats.pareto(${f(p(params, "alpha"))}, 0, ${f(p(params, "theta_min"))})`;
    case "genpareto":
      return `stats.genpareto(${f(p(params, "xi"))}, 0, ${f(p(params, "sigma"))})`;
    default:
      return "stats.norm()";
  }
}

/**
 * 제로팽창 분포 헬퍼(파이썬) — scipy에 없어 재현 코드에도 직접 정의를 넣는다.
 * frequencyFitCode(zip/zinb)·frequencySimCode·monteCarloCode에서 공유.
 */
export const ZI_PY_CLASS = `# 제로팽창 분포 헬퍼 — scipy에는 없어 직접 정의합니다.
# 원리: 확률 pi로 '무조건 0'(구조적 0), (1-pi)로 기저분포(poisson/nbinom)를 따릅니다.
class ZeroInflated:
    def __init__(self, pi, base):
        self.pi = pi; self.base = base           # base = scipy 이산분포(frozen)
    def pmf(self, k):
        k = np.asarray(k, float)
        p0 = self.pi + (1 - self.pi) * self.base.pmf(0)    # k=0은 두 경로가 합쳐짐
        return np.where(k == 0, p0, (1 - self.pi) * self.base.pmf(k))
    def logpmf(self, k):
        return np.log(np.clip(self.pmf(k), 1e-300, None))
    def cdf(self, k):
        return self.pi + (1 - self.pi) * self.base.cdf(np.asarray(k, float))
    def sf(self, k):
        return 1.0 - self.cdf(k)
    def mean(self):
        return (1 - self.pi) * self.base.mean()
    def var(self):
        m, v = self.base.mean(), self.base.var()
        return (1 - self.pi) * (v + m * m) - ((1 - self.pi) * m) ** 2
    def rvs(self, size, random_state=None):
        rng = random_state if random_state is not None else np.random
        return np.where(rng.random(size) < self.pi, 0, self.base.rvs(size, random_state=rng))`;

export function freqFrozenExpr(id: string, params: FitParamOut[]): string {
  switch (id) {
    case "poisson":
      return `stats.poisson(${f(p(params, "lambda"))})`;
    case "negbinom":
      return `stats.nbinom(${f(p(params, "r"))}, ${f(p(params, "p"))})`;
    case "binomial":
      return `stats.binom(${Math.round(p(params, "n"))}, ${f(p(params, "p"))})`;
    case "zip":
      return `ZeroInflated(${f(p(params, "pi"))}, stats.poisson(${f(p(params, "lambda"))}))`;
    case "zinb": {
      const r = p(params, "r");
      const mu = p(params, "mu");
      return `ZeroInflated(${f(p(params, "pi"))}, stats.nbinom(${f(r)}, ${f(r / (r + mu))}))`;
    }
    default:
      return "stats.poisson(1)";
  }
}

/** 개별 데이터 MLE 적합 호출 줄(들) — FIT_SCRIPT와 동일한 고정 모수. */
function sevFitLines(id: string): string {
  switch (id) {
    case "normal":
      return `# 정규분포의 MLE는 공식이 있습니다: mu=표본평균, sigma=표본표준편차
mu, sigma = stats.norm.fit(x)
dist = stats.norm(mu, sigma)          # 추정 파라미터로 분포를 '고정(frozen)'
print(f"mu={mu:.6g}, sigma={sigma:.6g}")
k = 2  # 추정한 파라미터 개수(AIC·BIC 계산에 사용)`;
    case "lognormal":
      return `# floc=0: 위치모수를 0으로 고정 — '값에 로그를 취하면 정규'가 되는 표준 모수화
s, _, scale = stats.lognorm.fit(x, floc=0)
mu, sigma = np.log(scale), s          # scipy 표현을 교과서 기호(mu, sigma)로 변환
dist = stats.lognorm(s, 0, scale)
print(f"mu={mu:.6g}, sigma={sigma:.6g}")
k = 2`;
    case "exponential":
      return `# 지수분포 MLE: lambda = 1/표본평균 (scipy는 scale=1/lambda 로 표현)
_, scale = stats.expon.fit(x, floc=0)
lam = 1 / scale
dist = stats.expon(0, scale)
print(f"lambda={lam:.6g}")
k = 1`;
    case "weibull":
      return `# 와이블: c=형상(고장률 증감), scale=척도. floc=0으로 위치 고정
c, _, scale = stats.weibull_min.fit(x, floc=0)
dist = stats.weibull_min(c, 0, scale)
print(f"k(형상)={c:.6g}, lambda(척도)={scale:.6g}")
k = 2`;
    case "gamma":
      return `# 감마: a=형상(alpha), scale=척도(theta). 평균 = alpha*theta
a, _, scale = stats.gamma.fit(x, floc=0)
dist = stats.gamma(a, 0, scale)
print(f"alpha={a:.6g}, theta={scale:.6g}")
k = 2`;
    case "beta":
      return `# 베타: [0,1] 구간 분포 — floc=0, fscale=1로 구간을 고정하고 a,b만 추정
a, b, _, _ = stats.beta.fit(x, floc=0, fscale=1)
dist = stats.beta(a, b)
print(f"alpha={a:.6g}, beta={b:.6g}")
k = 2`;
    case "pareto2":
      return `# 2모수 파레토(Lomax): 두꺼운 꼬리 손해분포. c=알파(작을수록 꼬리 두꺼움)
c, _, scale = stats.lomax.fit(x, floc=0)
dist = stats.lomax(c, 0, scale)
print(f"alpha={c:.6g}, theta={scale:.6g}")
k = 2`;
    case "pareto1":
      return `# 1모수 파레토: 하한 theta를 관측 최솟값으로 고정하고 알파만 추정
theta = float(np.min(x))
b, _, _ = stats.pareto.fit(x, floc=0, fscale=theta)
dist = stats.pareto(b, 0, theta)
print(f"alpha={b:.6g}, theta(고정)={theta:.6g}")
k = 1`;
    case "genpareto":
      return `# GPD(일반화 파레토): 임계값 초과(POT) 이론의 표준 꼬리 분포.
# xi=형상(클수록 두꺼운 꼬리·xi≥1이면 평균 발산), sigma=척도. floc=0으로 위치 고정
c, _, scale = stats.genpareto.fit(x, floc=0)
dist = stats.genpareto(c, 0, scale)
print(f"xi(형상)={c:.6g}, sigma(척도)={scale:.6g}")
k = 2`;
    default:
      return "";
  }
}

/** 그룹 데이터용 make/init 파이썬 조각 — FIT_SCRIPT의 스펙과 동일. */
function groupedSpecLines(id: string): string {
  switch (id) {
    case "normal":
      return `make = lambda t: stats.norm(t[0], np.exp(t[1]))
t0 = [m, np.log(sd)]                        # 초기값: 근사 평균·표준편차
names, k = ["mu", "sigma"], 2
unpack = lambda t: (t[0], np.exp(t[1]))`;
    case "lognormal":
      return `mu0 = np.log(m**2 / np.sqrt(v + m**2)); s0 = np.sqrt(max(np.log(1 + v/m**2), 1e-6))
make = lambda t: stats.lognorm(np.exp(t[1]), 0, np.exp(t[0]))
t0 = [mu0, np.log(s0)]                      # 초기값: 적률 정합(모멘트 매칭)
names, k = ["mu", "sigma"], 2
unpack = lambda t: (t[0], np.exp(t[1]))`;
    case "exponential":
      return `make = lambda t: stats.expon(0, np.exp(-t[0]))
t0 = [np.log(1/m)]                          # 초기값: lambda = 1/평균
names, k = ["lambda"], 1
unpack = lambda t: (np.exp(t[0]),)`;
    case "weibull":
      return `make = lambda t: stats.weibull_min(np.exp(t[0]), 0, np.exp(t[1]))
t0 = [np.log(1.2), np.log(m)]
names, k = ["k", "lambda"], 2
unpack = lambda t: (np.exp(t[0]), np.exp(t[1]))`;
    case "gamma":
      return `make = lambda t: stats.gamma(np.exp(t[0]), 0, np.exp(t[1]))
t0 = [np.log(max(m**2/v, 1e-3)), np.log(max(v/m, 1e-9))]   # 적률 정합 초기값
names, k = ["alpha", "theta"], 2
unpack = lambda t: (np.exp(t[0]), np.exp(t[1]))`;
    case "beta":
      return `c0 = max(m*(1-m)/v - 1, 0.2)
make = lambda t: stats.beta(np.exp(t[0]), np.exp(t[1]))
t0 = [np.log(max(m*c0, 0.1)), np.log(max((1-m)*c0, 0.1))]
names, k = ["alpha", "beta"], 2
unpack = lambda t: (np.exp(t[0]), np.exp(t[1]))`;
    case "pareto2":
      return `make = lambda t: stats.lomax(np.exp(t[0]), 0, np.exp(t[1]))
t0 = [np.log(2.5), np.log(m*1.5)]
names, k = ["alpha", "theta"], 2
unpack = lambda t: (np.exp(t[0]), np.exp(t[1]))`;
    case "genpareto":
      return `make = lambda t: stats.genpareto(t[0], 0, np.exp(t[1]))
t0 = [0.1, np.log(m)]                        # xi(형상)는 음수도 가능 → log 변환 없이 그대로
names, k = ["xi", "sigma"], 2
unpack = lambda t: (t[0], np.exp(t[1]))`;
    case "pareto1":
      return `theta = float(np.min(lo))                   # 하한 θ = 최소 구간 하한(고정)
make = lambda t: stats.pareto(np.exp(t[0]), 0, theta)
t0 = [np.log(2.0)]
names, k = ["alpha"], 1
unpack = lambda t: (np.exp(t[0]),)`;
    default:
      return "";
  }
}

/** 절단·검열 코드용 스펙 조각 — grouped와 동일하되 pareto1 하한만 관측 최솟값. */
function truncSpecLines(id: string): string {
  if (id === "pareto1") {
    return `theta = float(np.min(xu))                   # 하한 θ = 비검열 관측 최솟값(고정)
make = lambda t: stats.pareto(np.exp(t[0]), 0, theta)
t0 = [np.log(2.0)]
names, k = ["alpha"], 1
unpack = lambda t: (np.exp(t[0]),)`;
  }
  return groupedSpecLines(id);
}

/** 면책 d·한도 u 반영(좌측 절단·우측 검열) 적합 코드 — 화면 계산과 동일 우도. */
function severityFitCodeTruncated(
  id: string,
  name: string,
  data: FitData
): string {
  const arr = pyArray(data.values);
  const d = data.deductible ?? 0;
  const u = data.limit;
  return `# ══════════════════════════════════════════════════════
# ${name} 적합 — 면책·한도 반영(좌측 절단·우측 검열) MLE
# ══════════════════════════════════════════════════════
# 실제 보험 클레임 데이터의 특징(값은 원손해액 기준):
#  · 면책(d) 미만 사고는 청구되지 않아 데이터에 아예 없습니다 → '좌측 절단'
#  · 한도(u) 이상 사고는 u로 기록됩니다 → '우측 검열'(정확한 값 대신 "u 이상"만 앎)
# 이런 데이터에 보통의 .fit()을 쓰면 파라미터가 편향됩니다. 관측 규약에 맞는
# 우도를 직접 만들어 수치최적화합니다(화면의 적합 계산과 동일한 방법):
#   비검열(d<x<u): log f(x) - log S(d)   /   검열(x≥u): log S(u) - log S(d)
#   (S = 1 - F 생존함수. S(d)로 나누는 것이 'd 이상만 관측된다'는 절단 보정)
import numpy as np
from scipy import stats
from scipy.optimize import minimize
import matplotlib.pyplot as plt

# 1) 데이터 입력 — 기록된 손해액(u 이상은 u로 기록되어 있음)
${arr.truncated ? truncNote(data.values.length) : ""}x = np.array(${arr.code}, float)
d = ${f(d)}          # 면책(deductible) — 이 금액 미만 사고는 데이터에 없음
u = ${u !== undefined ? f(u) : "np.inf"}          # 보상한도(limit) — u 이상은 u로 기록${u === undefined ? " (미적용=무한대)" : ""}

xu = x[x < u]                  # 비검열 관측(실제 값을 아는 사고)
nc = int(np.sum(x >= u))       # 검열 관측 수(u 이상이라는 것만 아는 사고)
n  = len(x)
print(f"관측 {n}건 = 비검열 {len(xu)}건 + 검열 {nc}건")

# 2) 초기값용 근사 적률 — 비검열 값 기준(최적화 출발점일 뿐, 결과가 아님)
m = float(np.mean(xu)); v = max(float(np.var(xu)), 1e-12); sd = float(np.sqrt(v))

# 3) 이 분포의 파라미터 변환 — log를 취해 최적화 중 항상 양수를 보장
${truncSpecLines(id)}

# 4) 절단·검열 음의 로그우도(작을수록 좋음)
def nll(t):
    try:
        fr = make(t)
        ll = float(np.sum(fr.logpdf(xu)))          # 비검열: log f(x)
        if not np.isfinite(ll):
            return 1e12
        if d > 0:
            Sd = float(fr.sf(d))                   # 절단 보정: 모든 관측을 S(d)로 나눔
            if not (np.isfinite(Sd) and Sd > 0):
                return 1e12
            ll -= n * np.log(Sd)
        if nc > 0:
            Su = float(fr.sf(u))                   # 검열: 값 대신 P(X≥u)=S(u) 사용
            if not (np.isfinite(Su) and Su > 0):
                return 1e12
            ll += nc * np.log(Su)
        return -ll
    except Exception:
        return 1e12

# 5) Nelder-Mead 최적화 — 미분 없이 동작하는 견고한 방법
res = minimize(nll, t0, method="Nelder-Mead",
               options={"maxiter": 4000, "xatol": 1e-9, "fatol": 1e-10})
dist = make(res.x)
logL = -res.fun
print("파라미터:", dict(zip(names, np.round(unpack(res.x), 6))))
print(f"logL={logL:.4f}  AIC={2*k - 2*logL:.4f}  BIC={k*np.log(n) - 2*logL:.4f}")

# 6) 조건부 KS 검정 — F*(x)=(F(x)-F(d))/(F(u)-F(d)) 기준, 비검열 관측만
#    (검열 관측은 '정확한 값'이 없어 KS에서 제외합니다. A²·χ²도 같은 이유로 생략)
Fd = float(dist.cdf(d)) if d > 0 else 0.0
Fu = float(dist.cdf(u)) if np.isfinite(u) else 1.0
ks = stats.kstest(xu, lambda z: np.clip((dist.cdf(z) - Fd) / (Fu - Fd), 0, 1))
print(f"KS D={ks.statistic:.4f}  p={ks.pvalue:.4f}  (조건부 CDF 기준·근사)")

# 7) 그림 — 기록값 히스토그램 vs 관측 조건부 밀도 f(x)/S(d)
#    (한도가 있으면 u 자리에 검열 뭉치(마지막 막대 스파이크)가 생기는 것이 정상)
xs = np.sort(xu)
hi = float(np.max(x))
xg = np.linspace(max(float(xs[0]), d), hi, 300)
plt.figure(figsize=(6, 3.2))
plt.hist(x, bins="auto", density=True, alpha=0.3, label="recorded")
plt.plot(xg, dist.pdf(xg) / (1 - Fd), "r-", label="fitted (conditional)")
plt.legend(); plt.title("PDF — 관측 조건부"); plt.tight_layout(); plt.show()

# 8) QQ-plot — (d,u) 절단 조건부 분위수 vs 비검열 관측(검열 관측 제외)
nn = len(xs)
pp = (np.arange(1, nn + 1) - 0.5) / nn
theo = dist.ppf(Fd + pp * (Fu - Fd))
plt.figure(figsize=(4, 4))
plt.scatter(theo, xs, s=10)
lim_ = [float(xs[0]), float(xs[-1])]
plt.plot(lim_, lim_, "k--", lw=1)
plt.xlabel("Theoretical (conditional)"); plt.ylabel("Sample (uncensored)")
plt.title(f"Q-Q plot — 검열 {nc}건 제외")
plt.tight_layout(); plt.show()`;
}

/* ─────────────────────────── 심도 적합 코드 ─────────────────────────── */

export function severityFitCode(id: string, name: string, data: FitData): string {
  if (
    data.kind !== "grouped" &&
    ((data.deductible ?? 0) > 0 || data.limit !== undefined)
  ) {
    return severityFitCodeTruncated(id, name, data);
  }
  if (data.kind === "grouped") {
    const g = data.groups ?? [];
    const lo = pyArray(g.map((r) => r.lo));
    const hi = pyArray(g.map((r) => r.hi));
    const n = pyArray(g.map((r) => r.count));
    return `# ══════════════════════════════════════════════════════
# ${name} 적합 — 그룹(구간) 데이터의 최대우도추정(MLE)
# ══════════════════════════════════════════════════════
# 그룹 데이터는 '값이 구간 [a, b] 안에 몇 건'만 알고 개별 값은 모릅니다.
# 그래서 "구간에 들어갈 확률 F(b)-F(a)를 건수만큼 곱한 우도"를 가장 크게
# 만드는 파라미터를 수치최적화로 찾습니다(Loss Models 교과서 방식).
import numpy as np
from scipy import stats
from scipy.optimize import minimize
import matplotlib.pyplot as plt

# 1) 데이터 입력 — 각 구간의 [최소, 최대, 건수]
lo = np.array(${lo.code})
hi = np.array(${hi.code})
n  = np.array(${n.code}, float)

# 2) 초기값 계산용 근사 적률 — 구간 중간값을 건수로 가중평균
total = n.sum()
mids = (lo + hi) / 2
m = float(np.average(mids, weights=n))            # 근사 평균
v = max(float(np.average((mids - m)**2, weights=n)), 1e-12)   # 근사 분산
sd = np.sqrt(v)

# 3) 이 분포의 파라미터 변환 — log를 취해 최적화 중 항상 양수를 보장
${groupedSpecLines(id)}

# 4) 음의 로그우도(작을수록 좋음) — 이것을 최소화하면 우도 최대화와 같음
def nll(t):
    try:
        fr = make(t)
        pr = fr.cdf(hi) - fr.cdf(lo)          # 각 구간에 들어갈 확률
        if not np.all(np.isfinite(pr)) or np.any(pr <= 0):
            return 1e12                        # 확률 0/음수면 큰 벌점
        return -float(np.sum(n * np.log(pr)))  # -Σ 건수×log(구간확률)
    except Exception:
        return 1e12

# 5) Nelder-Mead 최적화 — 미분 없이 동작하는 견고한 방법
res = minimize(nll, t0, method="Nelder-Mead",
               options={"maxiter": 4000, "xatol": 1e-9, "fatol": 1e-10})
dist = make(res.x)
logL = -res.fun
print("파라미터:", dict(zip(names, np.round(unpack(res.x), 6))))
# AIC·BIC: 적합도(logL)에 파라미터 수(k) 벌점을 더한 비교 지표 — 작을수록 좋음
print(f"logL={logL:.4f}  AIC={2*k - 2*logL:.4f}  BIC={k*np.log(total) - 2*logL:.4f}")

# 6) 카이제곱 적합도 검정 — 구간별 '관측 건수 vs 모형이 예측한 건수' 비교
E = total * (dist.cdf(hi) - dist.cdf(lo))     # 기대도수
ok = E > 0
chi2 = float(np.sum((n[ok] - E[ok])**2 / E[ok]))
df = int(ok.sum()) - 1 - k                     # 자유도 = 구간수 - 1 - 파라미터수
print(f"chi2={chi2:.4f}  df={df}  p={stats.chi2.sf(chi2, df):.4f}" if df > 0
      else f"chi2={chi2:.4f}  (df≤0 — 구간 수 부족)")

# 7) 그림으로 확인 — 왼쪽: 밀도 막대+적합 PDF, 오른쪽: 누적(ogive)+적합 CDF
xg = np.linspace(lo.min(), hi.max(), 300)
fig, ax = plt.subplots(1, 2, figsize=(9, 3.2))
ax[0].bar(lo, n/(total*(hi-lo)), width=hi-lo, align="edge", alpha=0.3, label="empirical")
ax[0].plot(xg, dist.pdf(xg), "r-", label="fitted"); ax[0].set_title("PDF"); ax[0].legend()
ax[1].step(np.r_[lo[0], hi], np.r_[0, np.cumsum(n)/total], where="post", label="ogive")
ax[1].plot(xg, dist.cdf(xg), "r-", label="fitted"); ax[1].set_title("CDF"); ax[1].legend()
plt.tight_layout(); plt.show()

# 8) QQ-plot — 점이 점선(45°)에 가까울수록 적합이 좋습니다
cum = np.cumsum(n)/total
keep = cum < 1 - 1e-9
plt.figure(figsize=(4, 4))
plt.scatter(dist.ppf(cum[keep]), hi[keep], s=18)
lim = [min(lo.min(), 0), hi.max()*1.05]
plt.plot(lim, lim, "k--", lw=1)
plt.xlabel("Theoretical"); plt.ylabel("Empirical"); plt.title("Q-Q plot")
plt.tight_layout(); plt.show()`;
  }

  const arr = pyArray(data.values);
  return `# ══════════════════════════════════════════════════════
# ${name} 적합 — 개별 데이터의 최대우도추정(MLE)
# ══════════════════════════════════════════════════════
# MLE(최대우도추정)란? "지금 관측된 데이터가 나올 확률(우도)을 가장 크게
# 만드는 파라미터"를 찾는 표준 추정법입니다. scipy의 .fit()이 이를 수행합니다.
import numpy as np
from scipy import stats
import matplotlib.pyplot as plt

# 1) 데이터 입력
${arr.truncated ? truncNote(data.values.length) : ""}x = np.array(${arr.code})

# 2) MLE 적합
${sevFitLines(id)}

# 3) 적합 통계량 — logL은 클수록, AIC·BIC는 작을수록 좋습니다
#    (AIC = 2k - 2logL : 파라미터 수 k에 벌점을 줘 과적합을 억제)
n = len(x)
logL = float(np.sum(dist.logpdf(x)))
print(f"logL={logL:.4f}  AIC={2*k - 2*logL:.4f}  BIC={k*np.log(n) - 2*logL:.4f}")

# 4) KS 검정 — 경험 CDF와 적합 CDF의 최대 거리 D. p≥0.05면 기각 못 함
#    (주의: 파라미터를 같은 데이터에서 추정했으므로 p는 근사·관대)
ks = stats.kstest(x, dist.cdf)
print(f"KS D={ks.statistic:.4f}  p={ks.pvalue:.4f}")

# 5) Anderson-Darling A² — 꼬리 차이에 민감(대형 손해 적합 판단에 유용)
xs = np.sort(x); F = np.clip(dist.cdf(xs), 1e-12, 1-1e-12)
i = np.arange(1, n+1)
a2 = -n - np.mean((2*i - 1) * (np.log(F) + np.log(1 - F[::-1])))
print(f"A²={a2:.4f}")

# 6) 그림으로 확인 — 히스토그램·ECDF 위에 적합 곡선이 잘 얹히는지 보세요
xg = np.linspace(xs[0], xs[-1], 300)
fig, ax = plt.subplots(1, 2, figsize=(9, 3.2))
ax[0].hist(x, bins="auto", density=True, alpha=0.3, label="empirical")
ax[0].plot(xg, dist.pdf(xg), "r-", label="fitted"); ax[0].set_title("PDF"); ax[0].legend()
ax[1].plot(xs, np.arange(1, n+1)/n, drawstyle="steps-post", label="ECDF")
ax[1].plot(xg, dist.cdf(xg), "r-", label="fitted"); ax[1].set_title("CDF"); ax[1].legend()
plt.tight_layout(); plt.show()

# 7) QQ-plot — 정렬한 데이터 vs 같은 확률 위치의 이론 분위수.
#    점이 45° 점선에 가까울수록 좋고, 오른쪽 끝이 위로 휘면 실제 꼬리가 모형보다 두꺼움
pp = (np.arange(1, n+1) - 0.5) / n
plt.figure(figsize=(4, 4))
plt.scatter(dist.ppf(pp), xs, s=10)
lim = [xs[0], xs[-1]]
plt.plot(lim, lim, "k--", lw=1)
plt.xlabel("Theoretical"); plt.ylabel("Sample"); plt.title("Q-Q plot")
plt.tight_layout(); plt.show()`;
}

/* ─────────────────────────── 빈도 적합 코드 ─────────────────────────── */

export function frequencyFitCode(
  id: string,
  name: string,
  counts: number[]
): string {
  const arr = pyArray(counts);
  let fit: string;
  if (id === "poisson") {
    fit = `# 포아송의 MLE는 간단합니다: lambda = 연평균 건수
lam = counts.mean()
dist = stats.poisson(lam)
print(f"lambda={lam:.6g}")
k = 1`;
  } else if (id === "negbinom") {
    fit = `# 음이항 MLE — 분산>평균(과산포)인 건수에 적합.
# p는 r로부터 공식(p = r/(r+평균))으로 정해지므로 r 하나만 수치최적화(프로파일 우도)
from scipy.optimize import minimize_scalar
mean = counts.mean()
def nll(logr):                                   # 음의 로그우도(작을수록 좋음)
    r = np.exp(logr); p = r / (r + mean)
    v = -float(np.sum(stats.nbinom.logpmf(counts, r, p)))
    return v if np.isfinite(v) else 1e12
res = minimize_scalar(nll, bounds=(np.log(1e-2), np.log(1e4)), method="bounded")
r = float(np.exp(res.x)); p = r / (r + mean)
dist = stats.nbinom(r, p)
print(f"r={r:.6g}, p={p:.6g}")   # r이 아주 크면 포아송과 거의 같아집니다
k = 2`;
  } else if (id === "binomial") {
    fit = `# 이항 MLE — n(시행수)은 정수라서 관측 최대값부터 하나씩 대입해 탐색,
# 각 n에서 p = 평균/n 으로 두고 로그우도가 가장 큰 조합을 고릅니다
mean = counts.mean(); kobs = max(int(counts.max()), 1)
best = None
for nn in range(kobs, kobs*10 + 21):
    pp = mean / nn
    if not (0 < pp < 1):
        continue
    ll = float(np.sum(stats.binom.logpmf(counts, nn, pp)))
    if np.isfinite(ll) and (best is None or ll > best[0]):
        best = (ll, nn, pp)
ll, n_hat, p_hat = best
dist = stats.binom(n_hat, p_hat)
print(f"n={n_hat}, p={p_hat:.6g}")
k = 2`;
  } else if (id === "zip") {
    fit = `${ZI_PY_CLASS}
from scipy.optimize import minimize
# 제로팽창 포아송(ZIP) — 청구 자체가 없던 해(구조적 0)가 많은 빈도에 적합.
# pi(구조적 0 확률)·lambda(포아송 평균)를 커스텀 우도로 동시 추정합니다
# (scipy에 ZIP MLE가 없어 음의 로그우도를 직접 만들어 최소화).
cf = counts.astype(float); mean = cf.mean(); p0hat = float((cf == 0).mean())
lam0 = max(mean, 0.5)                             # 초기값(모멘트 근사)
pi0 = min(max((p0hat - np.exp(-lam0)) / (1 - np.exp(-lam0) + 1e-9), 0.02), 0.9)
nz = float((cf == 0).sum()); pos = cf[cf > 0]
def nll(t):
    pi = 1/(1+np.exp(-t[0])); lam = np.exp(t[1])  # 로짓·로그로 제약(0<pi<1, lam>0)
    p0 = pi + (1-pi)*np.exp(-lam)                 # P(N=0) = 구조적 0 + 포아송의 0
    if not (0 < p0 < 1): return 1e12
    ll = nz*np.log(p0) + np.sum(np.log(1-pi) + stats.poisson.logpmf(pos, lam))
    return -ll if np.isfinite(ll) else 1e12
res = minimize(nll, [np.log(pi0/(1-pi0)), np.log(lam0)], method="Nelder-Mead",
               options={"maxiter": 4000, "xatol": 1e-9, "fatol": 1e-10})
pi = 1/(1+np.exp(-res.x[0])); lam = np.exp(res.x[1])
dist = ZeroInflated(pi, stats.poisson(lam))
print(f"pi(구조적 0 확률)={pi:.6g}, lambda={lam:.6g}")
k = 2`;
  } else {
    fit = `${ZI_PY_CLASS}
from scipy.optimize import minimize
# 제로팽창 음이항(ZINB) — 구조적 0 + 과산포(분산>평균)를 함께 다루는 빈도 모형.
# pi·r(음이항 형상)·mu(평균)를 커스텀 우도로 동시 추정합니다.
cf = counts.astype(float); mean = cf.mean(); p0hat = float((cf == 0).mean())
mu0 = max(mean, 0.5); pi0 = min(max(p0hat - np.exp(-mu0), 0.02), 0.9)
nz = float((cf == 0).sum()); pos = cf[cf > 0]
def nll(t):
    pi = 1/(1+np.exp(-t[0])); r = np.exp(t[1]); mu = np.exp(t[2])
    p = r/(r+mu); base0 = float(stats.nbinom.pmf(0, r, p))
    p0 = pi + (1-pi)*base0
    if not (0 < p0 < 1): return 1e12
    ll = nz*np.log(p0) + np.sum(np.log(1-pi) + stats.nbinom.logpmf(pos, r, p))
    return -ll if np.isfinite(ll) else 1e12
res = minimize(nll, [np.log(pi0/(1-pi0)), np.log(5.0), np.log(mu0)],
               method="Nelder-Mead", options={"maxiter": 6000, "xatol": 1e-9, "fatol": 1e-10})
pi = 1/(1+np.exp(-res.x[0])); r = np.exp(res.x[1]); mu = np.exp(res.x[2]); p = r/(r+mu)
dist = ZeroInflated(pi, stats.nbinom(r, p))
print(f"pi={pi:.6g}, r={r:.6g}, mu={mu:.6g}")
k = 3`;
  }
  return `# ══════════════════════════════════════════════════════
# ${name} 적합 — 연도별 사고건수(빈도)의 최대우도추정(MLE)
# ══════════════════════════════════════════════════════
# 빈도 모형은 '1년에 사고가 몇 건 나는가(N)'의 분포입니다.
# 포아송(평균=분산) / 음이항(분산>평균, 과산포) / 이항(분산<평균)이 대표 후보입니다.
import numpy as np
from scipy import stats
import matplotlib.pyplot as plt

# 1) 데이터 입력 — 연도별 건수(사고가 없던 해는 0)
${arr.truncated ? truncNote(counts.length) : ""}counts = np.array(${arr.code})

# 2) MLE 적합
${fit}

# 3) 적합 통계량 — logL 클수록, AIC·BIC 작을수록 좋음
ny = len(counts)
logL = float(np.sum(dist.logpmf(counts)))
print(f"logL={logL:.4f}  AIC={2*k - 2*logL:.4f}  BIC={k*np.log(ny) - 2*logL:.4f}")

# 4) 카이제곱 검정 — '건수가 k인 해가 몇 번'(관측) vs 모형 예측(기대) 비교
#    K를 넘는 꼬리 확률은 마지막 칸에 합산합니다
K = int(counts.max())
obs = np.bincount(counts, minlength=K+1).astype(float)
E = ny * np.array([dist.pmf(j) for j in range(K+1)])
E[-1] += ny * float(dist.sf(K))
ok = E > 0
chi2 = float(np.sum((obs[ok] - E[ok])**2 / E[ok]))
df = int(ok.sum()) - 1 - k
print(f"chi2={chi2:.4f}  df={df}  p={stats.chi2.sf(chi2, df):.4f}" if df > 0
      else f"chi2={chi2:.4f}  (df≤0 — 관측 건수 종류 부족)")

# 5) 그림으로 확인 — 경험 확률(막대) vs 적합 PMF(선+점)
kk = np.arange(0, K + 3)
plt.figure(figsize=(5.5, 3.2))
plt.bar(np.arange(K+1), obs/ny, width=0.35, alpha=0.4, label="empirical")
plt.plot(kk, dist.pmf(kk), "ro-", ms=4, lw=1, label="fitted")
plt.xlabel("연간 건수 k"); plt.ylabel("P(N=k)"); plt.legend()
plt.tight_layout(); plt.show()`;
}

/* ───────────────── 분포별 몬테카를로 시뮬레이션 코드 ───────────────── */

/** 심도 분포별 특성 안내·대안 표본추출법 — 초보자용 시뮬레이션 탭. */
const SEV_SIM_NOTES: Record<
  string,
  { intro: string; alt: string; caution?: string }
> = {
  normal: {
    intro: `# [정규분포 특성] 좌우 대칭 종형 — 표본이 평균 주변에 대칭으로 흩어집니다.`,
    alt: `# 다른 방법: numpy 기본 생성기로도 같은 분포를 만들 수 있습니다
#   xs_alt = rng.normal(mu, sigma, n_sim)`,
    caution: `# ⚠ 정규분포는 음수도 나옵니다 — 손해액(양수) 모형이라면
#   np.maximum(xs, 0) 처리나 로그정규 같은 양수 분포를 고려하세요.`,
  },
  lognormal: {
    intro: `# [로그정규 특성] '로그를 취하면 정규' — 오른쪽 꼬리가 긴 양수 분포로
# 손해심도 모형의 대표 선수입니다.`,
    alt: `# 다른 방법(원리 이해용): 정규 난수를 만들어 exp를 취해도 같은 분포입니다
#   xs_alt = np.exp(rng.normal(mu, sigma, n_sim))`,
  },
  exponential: {
    intro: `# [지수분포 특성] 무기억성(과거와 무관) — 사건 간 대기시간의 기본 모형.`,
    alt: `# 다른 방법(역변환법): 균등난수 U를 CDF의 역함수에 넣으면 원하는 분포가 됩니다
#   U = rng.uniform(size=n_sim);  xs_alt = -np.log(1 - U) / lam`,
  },
  weibull: {
    intro: `# [와이블 특성] 형상 k에 따라 고장률이 감소(k<1)·일정(k=1)·증가(k>1).`,
    alt: `# 다른 방법(역변환법): CDF F(x)=1-exp(-(x/λ)^k)를 뒤집으면
#   U = rng.uniform(size=n_sim);  xs_alt = lam * (-np.log(1 - U))**(1/k)`,
  },
  gamma: {
    intro: `# [감마 특성] 지수분포 여러 개의 합을 일반화 — 양수 연속량(심도) 모형.`,
    alt: `# 다른 방법: numpy 기본 생성기
#   xs_alt = rng.gamma(shape=alpha, scale=theta, size=n_sim)`,
  },
  beta: {
    intro: `# [베타 특성] 0~1 사이 비율(손해율·해지율 등) 모형 — 금액이 아니라 '비율'을
# 시뮬레이션한다는 점만 기억하세요.`,
    alt: `# 다른 방법: numpy 기본 생성기
#   xs_alt = rng.beta(a, b, size=n_sim)`,
  },
  pareto2: {
    intro: `# [2모수 파레토(Lomax) 특성] 아주 두꺼운 꼬리 — 대형 손해가 드물지만
# 한 번 나면 매우 큰 상황을 표현합니다.`,
    alt: `# 다른 방법(역변환법): F(x)=1-(θ/(x+θ))^α 를 뒤집으면
#   U = rng.uniform(size=n_sim);  xs_alt = theta * ((1 - U)**(-1/alpha) - 1)`,
    caution: `# ⚠ 꼬리가 두꺼워 표본 평균이 천천히 수렴합니다. α≤1이면 이론 평균이
#   무한대라 표본을 늘려도 평균이 안정되지 않습니다(분위수는 안정적).`,
  },
  pareto1: {
    intro: `# [1모수 파레토 특성] 하한 θ 이상에서만 값이 나오는 두꺼운 꼬리 분포 —
# '초과손해(θ 이상 구간)' 모형입니다.`,
    alt: `# 다른 방법(역변환법): F(x)=1-(θ/x)^α 를 뒤집으면
#   U = rng.uniform(size=n_sim);  xs_alt = theta * (1 - U)**(-1/alpha)`,
    caution: `# ⚠ α가 작으면 꼬리가 매우 두꺼워 표본 평균 수렴이 느립니다(α≤1이면 발산).`,
  },
  genpareto: {
    intro: `# [일반화 파레토(GPD) 특성] 임계값 초과(peaks-over-threshold)의 극한분포 —
# 재보험·대형손해 꼬리 모형의 표준입니다. xi(형상)가 꼬리 두께를 지배합니다
# (xi>0 발산형 두꺼운 꼬리, xi=0 지수, xi<0 유한 상한).`,
    alt: `# 다른 방법(역변환법): xi≠0이면 F(x)=1-(1+xi·x/sigma)^(-1/xi)를 뒤집어
#   U = rng.uniform(size=n_sim);  xs_alt = sigma/xi * ((1 - U)**(-xi) - 1)`,
    caution: `# ⚠ xi≥1이면 이론 평균이 무한대, xi≥0.5면 분산이 무한대입니다 — 표본
#   평균·표준편차가 안정되지 않을 수 있으니 분위수·VaR로 판단하세요.`,
  },
};

/**
 * 심도 분포 전용 몬테카를로 코드 — 코드 팝업 '시뮬레이션' 탭.
 * 분포별 특성·대안 표본추출·주의점을 함께 설명한다(초보자 대상).
 */
export function severitySimCode(
  id: string,
  name: string,
  params: FitParamOut[]
): string {
  const note = SEV_SIM_NOTES[id] ?? SEV_SIM_NOTES.normal;
  const paramCmt = params.map((q) => `${q.name}=${f(q.value)}`).join(", ");
  return `# ══════════════════════════════════════════════════════
# 몬테카를로 시뮬레이션 — ${name} (적합 결과: ${paramCmt})
# ══════════════════════════════════════════════════════
# 몬테카를로란? 적합된 분포에서 난수(가상의 손해액)를 아주 많이 뽑아,
# 수식으로 구하기 어려운 값(분위수·초과확률·한도 적용 기대지급액 등)을
# "많이 뽑아 비율/평균 내기"로 근사하는 방법입니다. 표본이 많을수록 정확합니다.
${note.intro}
import numpy as np
from scipy import stats
import matplotlib.pyplot as plt

# 1) 적합된 분포를 그대로 고정(frozen) — 숫자는 화면의 적합 결과입니다
dist = ${sevFrozenExpr(id, params)}

# 2) 난수 생성기 — seed(42)를 고정하면 실행할 때마다 같은 결과(재현 가능)
rng = np.random.default_rng(42)

# 3) 표본 추출 — rvs = random variates(난수 표본)
n_sim = 100_000
xs = dist.rvs(n_sim, random_state=rng)
${note.alt}

# 4) 검증 — 표본 평균·표준편차가 이론값과 비슷해야 시뮬레이션이 맞습니다
print(f"[검증] 표본 평균={xs.mean():,.4f}  vs  이론 평균={float(dist.mean()):,.4f}")
print(f"[검증] 표본 표준편차={xs.std():,.4f}  vs  이론={float(dist.std()):,.4f}")
${note.caution ? `${note.caution}\n` : ""}
# 5) 분위수 — 예: 99% 분위수는 '100번 중 99번은 이 값 이하'라는 뜻(VaR 개념)
for q in [0.50, 0.75, 0.90, 0.95, 0.99, 0.995]:
    print(f"  {q:>5.1%} 분위수 = {np.quantile(xs, q):,.2f}")

# 6) 초과확률 — 특정 값을 넘을 확률을 '넘은 표본의 비율'로 근사
threshold = np.quantile(xs, 0.95)          # 예시 임계값: 95% 분위수
print(f"P(X > {threshold:,.2f}) ≈ {(xs > threshold).mean():.4f}  (이론: {float(dist.sf(threshold)):.4f})")

# 7) 그림 — 시뮬레이션 히스토그램 위에 적합 PDF가 겹치면 성공
plt.figure(figsize=(6, 3.2))
plt.hist(xs, bins=80, density=True, alpha=0.45, label="simulated")
xg = np.linspace(np.quantile(xs, 0.001), np.quantile(xs, 0.995), 300)
plt.plot(xg, dist.pdf(xg), "r-", lw=1.5, label="fitted PDF")
plt.legend(); plt.title("Monte Carlo vs fitted PDF")
plt.tight_layout(); plt.show()

# 8) 실무 응용 — 자기부담금(ded)과 보상한도(lim)를 적용한 기대지급액
#    지급액 = min( max(X - ded, 0), lim - ded )  ← np.clip 한 줄로 계산
ded = float(np.quantile(xs, 0.25))          # 예시: 25% 분위수를 자기부담금으로
lim = float(np.quantile(xs, 0.99))          # 예시: 99% 분위수를 한도로
paid = np.clip(xs - ded, 0, lim - ded)
print(f"자기부담금 {ded:,.0f} · 한도 {lim:,.0f} 적용 시 기대지급액 = {paid.mean():,.2f}")
print(f"(한도 없이 전액 지급하면 기대지급액 = {np.maximum(xs - ded, 0).mean():,.2f})")

# ▸ 빈도(연간 건수)와 결합한 '연간 총손해 S = X1+…+XN' 시뮬레이션은
#   화면 하단 [몬테카를로 시뮬레이션으로 이어가기 → 코드 보기]를 참고하세요.`;
}

/** 빈도 분포별 특성 안내 — 시뮬레이션 탭. */
const FREQ_SIM_NOTES: Record<string, string> = {
  poisson: `# [포아송 특성] 평균 = 분산. 사고 발생이 서로 독립이고 발생률이 일정할 때의
# 기본 빈도 모형입니다.`,
  negbinom: `# [음이항 특성] 분산 > 평균(과산포). 연도마다 위험수준이 달라지는(이질적)
# 포트폴리오의 건수 모형으로 포아송보다 현실적일 때가 많습니다.`,
  binomial: `# [이항 특성] 분산 < 평균(과소산포). 시행수 n이 정해진 성공 횟수 모형 —
# 계약 n건 중 사고 난 건수 같은 상황에 맞습니다.`,
  zip: `# [제로팽창 포아송(ZIP) 특성] '무사고 해(구조적 0)'가 포아송이 예측하는 것보다
# 훨씬 많은 빈도에 적합. 확률 pi로 무조건 0, (1-pi)로 포아송(lambda)를 섞습니다.`,
  zinb: `# [제로팽창 음이항(ZINB) 특성] 구조적 0 과다 + 과산포(분산>평균)를 동시에
# 표현. 확률 pi로 무조건 0, (1-pi)로 음이항(r, mu)를 섞습니다.`,
};

/**
 * 빈도 분포 전용 몬테카를로 코드 — 연간 건수 시뮬레이션(초보자 설명 포함).
 */
export function frequencySimCode(
  id: string,
  name: string,
  params: FitParamOut[]
): string {
  const paramCmt = params.map((q) => `${q.name}=${f(q.value)}`).join(", ");
  const isZi = id === "zip" || id === "zinb";
  return `# ══════════════════════════════════════════════════════
# 몬테카를로 시뮬레이션 — ${name} 빈도 (적합 결과: ${paramCmt})
# ══════════════════════════════════════════════════════
# 빈도 시뮬레이션은 '가상의 1년'을 수만 번 반복해 연간 사고건수 N을 만들어 보고,
# 무사고 확률·대량사고 확률 같은 값을 '비율 세기'로 근사하는 방법입니다.
${FREQ_SIM_NOTES[id] ?? ""}
import numpy as np
from scipy import stats
import matplotlib.pyplot as plt
${isZi ? `\n${ZI_PY_CLASS}\n` : ""}
# 1) 적합된 분포 고정(frozen) — 숫자는 화면의 적합 결과입니다
dist = ${freqFrozenExpr(id, params)}

# 2) 난수 생성기(seed 고정 = 재현 가능)
rng = np.random.default_rng(42)

# 3) 2만 년치 연간 건수 시뮬레이션
n_years = 20_000
N = dist.rvs(n_years, random_state=rng)

# 4) 검증 — 표본 평균·분산이 이론값과 비슷한지, 그리고
#    평균과 분산의 관계(포아송 =, 음이항 >, 이항 <)도 확인해 보세요
print(f"[검증] 표본 평균={N.mean():.4f}  vs  이론={float(dist.mean()):.4f}")
print(f"[검증] 표본 분산={N.var():.4f}  vs  이론={float(dist.var()):.4f}")

# 5) 확률 근사 — 무사고 확률과 '많이 나는 해' 확률
print(f"P(N = 0)  ≈ {(N == 0).mean():.4f}   (이론: {float(dist.pmf(0)):.4f})")
k_hi = int(np.quantile(N, 0.99))
print(f"P(N ≥ {k_hi}) ≈ {(N >= k_hi).mean():.4f}   (이론: {float(dist.sf(k_hi - 1)):.4f})")

# 6) 그림 — 시뮬레이션 빈도(막대) vs 이론 PMF(선+점)
K = int(N.max())
kk = np.arange(0, K + 1)
emp = np.bincount(N, minlength=K + 1) / n_years
plt.figure(figsize=(5.5, 3.2))
plt.bar(kk, emp, width=0.5, alpha=0.4, label="simulated")
plt.plot(kk, dist.pmf(kk), "ro-", ms=4, lw=1, label="fitted PMF")
plt.xlabel("연간 건수 k"); plt.ylabel("P(N=k)"); plt.legend()
plt.tight_layout(); plt.show()

# ▸ 심도(1건당 손해액)와 결합한 '연간 총손해 S = X1+…+XN' 시뮬레이션은
#   화면 하단 [몬테카를로 시뮬레이션으로 이어가기 → 코드 보기]를 참고하세요.`;
}

/* ───────────────────────── 집합손해 몬테카를로 코드 ───────────────────────── */

/**
 * 시뮬레이션 이어가기 코드(하단 섹션) — 빈도+심도가 모두 있으면 집합손해
 * S=ΣX(연간 총손해)·VaR·TVaR, 심도만이면 표본추출·분위수.
 * du(면책·한도)가 있으면 지급액 분포 섹션을 실제 입력값으로 추가한다
 * (기본 표본은 원손해 기준 유지 — 사용자 규약).
 */
export function monteCarloCode(
  sev: { id: string; name: string; params: FitParamOut[] },
  freq?: { id: string; name: string; params: FitParamOut[] } | null,
  du?: { d?: number; u?: number } | null
): string {
  const sevExpr = sevFrozenExpr(sev.id, sev.params);
  const duActive = du && ((du.d ?? 0) > 0 || du.u !== undefined);
  const dLit = f(du?.d ?? 0);
  const uLit = du?.u !== undefined ? f(du.u) : "np.inf";
  if (!freq) {
    const duBlock = duActive
      ? `

# ── 면책 d·한도 u 반영 지급액(입력값 반영) ──
# 면책 d 미만 사고는 청구되지 않으므로 '청구 1건'의 원손해는 조건부 X|X>d 입니다.
# 역변환법: F(d)~1 구간의 균등난수를 ppf에 넣으면 X|X>d 표본이 됩니다.
d, u = ${dLit}, ${uLit}
Fd = float(sev.cdf(d)) if d > 0 else 0.0
U = rng.uniform(Fd, 1.0, size=n_sim)
x_claims = sev.ppf(U)                     # X | X > d 표본(청구된 사고의 원손해)
paid = np.clip(x_claims - d, 0, (u - d) if np.isfinite(u) else np.inf)
print(f"청구 1건당 기대지급액(면책·한도 반영) = {paid.mean():,.2f}")
if np.isfinite(u):
    print(f"한도 도달(u-d 전액 지급) 비율 ≈ {(x_claims >= u).mean():.4f}")`
      : `

# 응용: 자기부담금(ded)·보상한도(lim) 적용 후 기대지급액
# ded, lim = 1000, 50000
# paid = np.clip(xs - ded, 0, lim - ded)
# print("기대지급액:", paid.mean())`;
    return `# ══════════════════════════════════════════════════════
# 몬테카를로 — 적합된 심도분포(${sev.name})에서 표본추출
# ══════════════════════════════════════════════════════
# 적합된 분포에서 가상의 손해액을 대량으로 뽑아 분위수·기대지급액을 근사합니다.
# (각 분포 행의 [코드 → 시뮬레이션 탭]에 분포별 상세 설명이 있습니다)
import numpy as np
from scipy import stats
import matplotlib.pyplot as plt

rng = np.random.default_rng(42)         # seed 고정 = 재현 가능
sev = ${sevExpr}                         # 화면의 적합 파라미터 반영

n_sim = 100_000
xs = sev.rvs(n_sim, random_state=rng)   # rvs = 난수 표본 추출

print(f"평균={xs.mean():,.2f}  표준편차={xs.std():,.2f}")
for q in [0.50, 0.75, 0.90, 0.95, 0.99, 0.995]:
    print(f"  {q:.1%} 분위수 = {np.quantile(xs, q):,.2f}")

plt.figure(figsize=(6, 3.2))
plt.hist(xs, bins=80, density=True, alpha=0.5)
plt.title("Simulated severity"); plt.tight_layout(); plt.show()${duBlock}`;
  }

  const freqExpr = freqFrozenExpr(freq.id, freq.params);
  const dPos = (du?.d ?? 0) > 0;
  // 면책 d>0이면 빈도 N은 '청구된 사고(X>d)'만 센 값이므로 심도도 조건부 X|X>d 로
  // 뽑아야 총손해 S가 정합한다(무조건부 표본을 쓰면 평균·VaR·TVaR가 체계적으로 과소).
  const duHead = duActive
    ? `
d, u = ${dLit}, ${uLit}                   # 화면 입력의 면책·한도`
    : "";
  const sevDraw = dPos
    ? `# 빈도 N은 '청구된 사고(X>d)'만 세어 적합됐으므로, 심도도 같은 기준인
# 조건부 X|X>d 로 뽑습니다(무조건부로 뽑으면 S가 체계적으로 과소평가됨).
# 역변환법: F(d)~1 구간의 균등난수를 ppf에 넣으면 X|X>d 표본이 됩니다.
Fd = float(sev.cdf(d))
all_x = sev.ppf(rng.uniform(Fd, 1.0, size=total))   # 청구 1건당 원손해(X|X>d)`
    : `all_x = sev.rvs(total, random_state=rng)`;
  const grossNote = dPos
    ? `
# ※ 여기서 S는 '청구된 사고(X>d)의 원손해 합' — 면책 미만 소액사고는 청구되지
#    않으므로 애초에 집계 대상이 아닙니다. 실제 지급액은 아래 블록에서 산출합니다.
`
    : "";
  const duBlockAgg = duActive
    ? `

# ── 면책 d·한도 u 반영 연간 총지급액(입력값 반영) ──
# 위 2)에서 뽑은 청구별 원손해 all_x에 면책·한도를 적용해 '지급액'으로 환산합니다
# (같은 표본을 쓰므로 원손해 S와 지급 S_paid가 같은 사고 집합에 대응).
paid_x = np.clip(all_x - d, 0, (u - d) if np.isfinite(u) else np.inf)
S_paid = np.array([paid_x[idx[i]:idx[i+1]].sum() for i in range(n_years)])
print(f"연간 총지급 평균={S_paid.mean():,.2f}")
for q in [0.95, 0.99]:
    vq = np.quantile(S_paid, q)
    print(f"  지급 기준 VaR {q:.0%} = {vq:,.2f}   TVaR {q:.0%} = {S_paid[S_paid >= vq].mean():,.2f}")`
    : "";
  return `# ══════════════════════════════════════════════════════
# 몬테카를로 집합손해모형 — 연간 총손해 S = X1 + … + XN
# ══════════════════════════════════════════════════════
# '1년'을 이렇게 시뮬레이션합니다:
#   ① 빈도분포에서 그 해의 사고건수 N을 뽑고
#   ② 심도분포에서 손해액 X를 N개 뽑아
#   ③ 모두 더하면 그 해의 총손해 S
# 이것을 수만 년 반복하면 S의 분포(평균·VaR·TVaR)를 알 수 있습니다.
# 빈도 N ~ ${freq.name}, 심도 X ~ ${sev.name} (화면의 적합 결과 반영)
import numpy as np
from scipy import stats
import matplotlib.pyplot as plt
${freq.id === "zip" || freq.id === "zinb" ? `\n${ZI_PY_CLASS}\n` : ""}
rng = np.random.default_rng(42)          # seed 고정 = 재현 가능
freq = ${freqExpr}
sev  = ${sevExpr}

# 1) 연도별 사고건수 N을 한꺼번에 생성
n_years = 20_000                          # 시뮬레이션 연수
N = freq.rvs(n_years, random_state=rng)

# 2) 필요한 심도를 '한 번에' 뽑아 연도별로 잘라 담기(루프보다 훨씬 빠름)
S = np.zeros(n_years)
total = int(N.sum())${duHead}
${sevDraw}
idx = np.r_[0, np.cumsum(N)]              # 연도별 시작 위치
for i in range(n_years):
    S[i] = all_x[idx[i]:idx[i+1]].sum()   # 그 해의 총손해
${grossNote}
# 3) 결과 — VaR(분위수)와 TVaR(그 분위수를 넘는 해들의 평균 손해)
print(f"연간 건수 평균={N.mean():.3f}  연간 총손해 평균={S.mean():,.2f}")
for q in [0.95, 0.99]:
    var_q = np.quantile(S, q)             # VaR: 'q 확률로는 이 이하'
    tvar_q = S[S >= var_q].mean()         # TVaR: 최악 (1-q) 구간의 평균
    print(f"  VaR {q:.0%} = {var_q:,.2f}   TVaR {q:.0%} = {tvar_q:,.2f}")

# 4) 총손해 분포 그림 — 오른쪽 꼬리가 위험(자본)의 근거가 됩니다
plt.figure(figsize=(6, 3.2))
plt.hist(S, bins=80, density=True, alpha=0.5)
plt.axvline(np.quantile(S, 0.99), color="r", ls="--", lw=1, label="VaR 99%")
plt.title("Aggregate loss S"); plt.legend(); plt.tight_layout(); plt.show()

# 응용: 재보험 초과손해(XL) 층별 기대손해 — 층(att~lim)에 걸리는 손해만 출재
# att, lim = np.quantile(S, 0.90), np.quantile(S, 0.99)
# ceded = np.clip(S - att, 0, lim - att)
# print("층별 기대손해(출재):", ceded.mean())${duBlockAgg}`;
}
