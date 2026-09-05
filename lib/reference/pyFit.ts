/**
 * 모델 적합 탭 — Pyodide(scipy) 적합 엔진. 사용자 결정으로 계산은 전부
 * 브라우저 파이썬(scipy)에서 수행한다(안내되는 파이썬 코드와 결과 일치).
 *
 * 흐름: 입력 JSON을 가상 FS(_fit_input.json)에 쓰고 FIT_SCRIPT를 실행,
 * 마지막 표현식(json.dumps)을 파싱해 돌려준다. Pyodide 런타임은
 * lib/pyRunner.ts의 싱글턴(getPyodide)을 재사용 — 파이썬 실행기와 캐시 공유.
 *
 * 방법 요약(스크립트 내 구현):
 *  - 개별 데이터: scipy .fit MLE(위치모수 floc=0 고정 — 플랫폼 모수화와 일치),
 *    logL·AIC·BIC·KS(D,p)·Anderson-Darling A², QQ 분위수(최대 150점), 오버레이 곡선.
 *  - 개별 데이터 + 면책 d·한도 u: 좌측 절단·우측 검열 우도
 *    [비검열 log f(x)−log S(d), 검열 log S(u)−log S(d)]를 Nelder-Mead로 최대화
 *    (grouped_specs의 log-모수 재사용). KS는 조건부 CDF·비검열만, A²·χ²는 '—'.
 *  - 그룹 데이터: 구간 우도(Loss Models) Σ nᵢ·log[F(bᵢ)−F(aᵢ)]를 Nelder-Mead로
 *    최대화(모수는 log 변환으로 양수 보장), χ²(관측·기대도수)·p, ogive QQ.
 *  - 빈도(연도별 건수): 포아송(λ=평균 MLE)·음이항(r 프로파일 MLE)·이항(n 정수
 *    탐색+p=평균/n), χ²(꼬리 합산)·p, 건수 QQ.
 */
// 소스의 pyRunner(별도 Pyodide 인스턴스) 결합은 끊었다 — 이 앱의 워커 런타임으로 실행한다(R4).
export type RunPhase = "boot" | "pkg" | "run";

/* ───────────────────────────── 타입 ───────────────────────────── */

export interface FitParamOut {
  name: string;
  value: number;
}

export interface FitResultRow {
  id: string;
  ok: boolean;
  error?: string;
  params?: FitParamOut[];
  /** 추정 모수 개수(AIC·BIC의 k) */
  k?: number;
  logL?: number | null;
  aic?: number | null;
  bic?: number | null;
  ksD?: number | null;
  ksP?: number | null;
  a2?: number | null;
  chi2?: number | null;
  chi2P?: number | null;
  chi2Df?: number | null;
  /** grid에 대한 밀도·누적 y값(연속형) — null은 미정의 지점 */
  pdfY?: (number | null)[];
  cdfY?: (number | null)[];
  /** kGrid에 대한 PMF·CDF(빈도) */
  pmfY?: (number | null)[];
  qq?: { theo: number[]; samp: number[] };
}

export interface FitRunResult {
  severity: FitResultRow[];
  frequency: FitResultRow[];
}

export interface FitPayload {
  mode: "individual" | "grouped";
  values?: number[];
  groups?: { lo: number[]; hi: number[]; n: number[] };
  /** 심도 오버레이 곡선 x그리드 */
  grid: number[];
  sevDists: string[];
  freq?: { counts: number[]; dists: string[]; kGrid: number[] } | null;
  /**
   * 면책 d(좌측 절단) — null/미지정=0. individual 모드 전용.
   * d>0 또는 limit 지정 시 절단·검열 우도 수치최적화 경로로 전환된다
   * (둘 다 미지정이면 기존 scipy .fit 경로 그대로 — 회귀 없음).
   */
  deductible?: number | null;
  /** 보상한도 u(우측 검열, x≥u는 u로 기록) — null/미지정=∞. */
  limit?: number | null;
}

/* ─────────────────────────── 파이썬 스크립트 ─────────────────────────── */

export const FIT_SCRIPT = `
import json, math, warnings
import numpy as np
from scipy import stats
from scipy.optimize import minimize, minimize_scalar

warnings.filterwarnings("ignore")

with open("_fit_input.json", "r", encoding="utf-8") as _f:
    INP = json.load(_f)

def _num(v):
    try:
        v = float(v)
    except Exception:
        return None
    return v if math.isfinite(v) else None

def _arr(a):
    return [_num(v) for v in np.asarray(a, float).tolist()]

OUT = {"severity": [], "frequency": []}
GRID = np.asarray(INP.get("grid") or [], float)

# ───── 심도: 개별 데이터 MLE (floc=0 — 플랫폼 모수화와 일치) ─────
def fit_sev_individual(did, x):
    if did == "normal":
        mu, sig = stats.norm.fit(x)
        return stats.norm(mu, sig), [("mu", mu), ("sigma", sig)], 2
    if did == "lognormal":
        s, _, sc = stats.lognorm.fit(x, floc=0)
        return stats.lognorm(s, 0, sc), [("mu", math.log(sc)), ("sigma", s)], 2
    if did == "exponential":
        _, sc = stats.expon.fit(x, floc=0)
        return stats.expon(0, sc), [("lambda", 1.0 / sc)], 1
    if did == "weibull":
        c, _, sc = stats.weibull_min.fit(x, floc=0)
        return stats.weibull_min(c, 0, sc), [("k", c), ("lambda", sc)], 2
    if did == "gamma":
        a, _, sc = stats.gamma.fit(x, floc=0)
        return stats.gamma(a, 0, sc), [("alpha", a), ("theta", sc)], 2
    if did == "beta":
        a, b, _, _ = stats.beta.fit(x, floc=0, fscale=1)
        return stats.beta(a, b), [("alpha", a), ("beta", b)], 2
    if did == "pareto2":
        c, _, sc = stats.lomax.fit(x, floc=0)
        return stats.lomax(c, 0, sc), [("alpha", c), ("theta", sc)], 2
    if did == "pareto1":
        th = float(np.min(x))
        b, _, _ = stats.pareto.fit(x, floc=0, fscale=th)
        return stats.pareto(b, 0, th), [("alpha", b), ("theta_min", th)], 1
    if did == "genpareto":
        # 일반화 파레토(GPD) — POT(임계값 초과) 이론의 표준 꼬리 분포.
        # xi=형상(>0 두꺼운 꼬리·발산 가능, <0 유한 상한), sigma=척도. loc=0 고정.
        c, _, sc = stats.genpareto.fit(x, floc=0)
        return stats.genpareto(c, 0, sc), [("xi", c), ("sigma", sc)], 2
    raise ValueError("unknown dist: " + did)

def gof_individual(fr, k, x):
    n = len(x)
    logL = float(np.sum(fr.logpdf(x)))
    aic = 2 * k - 2 * logL
    bic = k * math.log(n) - 2 * logL
    ks = stats.kstest(x, fr.cdf)
    xs = np.sort(x)
    F = np.clip(fr.cdf(xs), 1e-12, 1 - 1e-12)
    i = np.arange(1, n + 1)
    a2 = float(-n - np.mean((2 * i - 1) * (np.log(F) + np.log(1 - F[::-1]))))
    return logL, aic, bic, float(ks.statistic), float(ks.pvalue), a2

def qq_points(fr, xs, m=150):
    n = len(xs)
    if n <= m:
        pp = (np.arange(1, n + 1) - 0.5) / n
        samp = np.asarray(xs, float)
    else:
        pp = (np.arange(1, m + 1) - 0.5) / m
        samp = np.quantile(np.asarray(xs, float), pp)
    theo = fr.ppf(pp)
    okm = np.isfinite(theo) & np.isfinite(samp)
    return {"theo": _arr(theo[okm]), "samp": _arr(samp[okm])}

# ───── 심도: 그룹 데이터 — 구간 우도 MLE(모수 log 변환) ─────
def grouped_specs(A, B, N):
    mids = (A + B) / 2.0
    m = float(np.average(mids, weights=N))
    v = max(float(np.average((mids - m) ** 2, weights=N)), 1e-12)
    sd = math.sqrt(v)
    sp = {}
    sp["normal"] = dict(
        make=lambda t: stats.norm(t[0], math.exp(t[1])),
        t0=[m, math.log(sd)],
        disp=lambda t: [("mu", t[0]), ("sigma", math.exp(t[1]))], k=2)
    if m > 0:
        mu0 = math.log(m * m / math.sqrt(v + m * m))
        s0 = math.sqrt(max(math.log(1 + v / (m * m)), 1e-6))
        sp["lognormal"] = dict(
            make=lambda t: stats.lognorm(math.exp(t[1]), 0, math.exp(t[0])),
            t0=[mu0, math.log(s0)],
            disp=lambda t: [("mu", t[0]), ("sigma", math.exp(t[1]))], k=2)
        sp["exponential"] = dict(
            make=lambda t: stats.expon(0, math.exp(-t[0])),
            t0=[math.log(1 / m)],
            disp=lambda t: [("lambda", math.exp(t[0]))], k=1)
        sp["weibull"] = dict(
            make=lambda t: stats.weibull_min(math.exp(t[0]), 0, math.exp(t[1])),
            t0=[math.log(1.2), math.log(m)],
            disp=lambda t: [("k", math.exp(t[0])), ("lambda", math.exp(t[1]))], k=2)
        sp["gamma"] = dict(
            make=lambda t: stats.gamma(math.exp(t[0]), 0, math.exp(t[1])),
            t0=[math.log(max(m * m / v, 1e-3)), math.log(max(v / m, 1e-9))],
            disp=lambda t: [("alpha", math.exp(t[0])), ("theta", math.exp(t[1]))], k=2)
        sp["pareto2"] = dict(
            make=lambda t: stats.lomax(math.exp(t[0]), 0, math.exp(t[1])),
            t0=[math.log(2.5), math.log(m * 1.5)],
            disp=lambda t: [("alpha", math.exp(t[0])), ("theta", math.exp(t[1]))], k=2)
        # GPD — xi(형상)는 음수도 가능하므로 log 변환 없이 그대로(t[0]), sigma만 exp
        sp["genpareto"] = dict(
            make=lambda t: stats.genpareto(t[0], 0, math.exp(t[1])),
            t0=[0.1, math.log(m)],
            disp=lambda t: [("xi", t[0]), ("sigma", math.exp(t[1]))], k=2)
    if 0 <= float(np.min(A)) and float(np.max(B)) <= 1:
        c0 = max(m * (1 - m) / v - 1, 0.2)
        sp["beta"] = dict(
            make=lambda t: stats.beta(math.exp(t[0]), math.exp(t[1])),
            t0=[math.log(max(m * c0, 0.1)), math.log(max((1 - m) * c0, 0.1))],
            disp=lambda t: [("alpha", math.exp(t[0])), ("beta", math.exp(t[1]))], k=2)
    th1 = float(np.min(A))
    if th1 > 0:
        sp["pareto1"] = dict(
            make=lambda t: stats.pareto(math.exp(t[0]), 0, th1),
            t0=[math.log(2.0)],
            disp=lambda t: [("alpha", math.exp(t[0])), ("theta_min", th1)], k=1)
    return sp

def fit_grouped(spec, A, B, N):
    def nll(t):
        try:
            fr = spec["make"](t)
            p = fr.cdf(B) - fr.cdf(A)
            if not np.all(np.isfinite(p)) or np.any(p <= 0):
                return 1e12
            return -float(np.sum(N * np.log(p)))
        except Exception:
            return 1e12
    res = minimize(nll, spec["t0"], method="Nelder-Mead",
                   options={"maxiter": 4000, "xatol": 1e-9, "fatol": 1e-10})
    if not math.isfinite(res.fun) or res.fun >= 1e11:
        raise ValueError("optimize_failed")
    t = res.x
    return spec["make"](t), spec["disp"](t), spec["k"], -float(res.fun)

def chi2_grouped(fr, A, B, N, k):
    total = float(np.sum(N))
    E = total * (fr.cdf(B) - fr.cdf(A))
    ok = E > 0
    chi2 = float(np.sum((N[ok] - E[ok]) ** 2 / E[ok]))
    df = int(ok.sum()) - 1 - k
    p = float(stats.chi2.sf(chi2, df)) if df > 0 else None
    return chi2, p, df

def qq_grouped(fr, B, N):
    total = float(np.sum(N))
    cum = np.cumsum(N) / total
    keep = cum < 1 - 1e-9
    theo = fr.ppf(cum[keep])
    samp = np.asarray(B, float)[keep]
    okm = np.isfinite(theo)
    return {"theo": _arr(theo[okm]), "samp": _arr(samp[okm])}

# ───── 심도: 면책 d(좌측 절단)·한도 u(우측 검열) 반영 MLE ─────
# 관측 규약: 값은 원손해액. d 미만 미관측, u 이상은 u로 기록.
# 우도: 비검열(d<x<u) log f(x) - log S(d) / 검열(x>=u) log S(u) - log S(d)
# 모수화·초기값·최적화는 그룹 적합과 같은 스펙(grouped_specs, log 모수)을 재사용.
def fit_truncated(spec, xu, nc, n, d, u):
    def nll(t):
        try:
            fr = spec["make"](t)
            ll = float(np.sum(fr.logpdf(xu)))
            if not math.isfinite(ll):
                return 1e12
            if d > 0:
                Sd = float(fr.sf(d))
                if not (math.isfinite(Sd) and Sd > 0):
                    return 1e12
                ll -= n * math.log(Sd)
            if nc > 0:
                Su = float(fr.sf(u))
                if not (math.isfinite(Su) and Su > 0):
                    return 1e12
                ll += nc * math.log(Su)
            return -ll
        except Exception:
            return 1e12
    res = minimize(nll, spec["t0"], method="Nelder-Mead",
                   options={"maxiter": 4000, "xatol": 1e-9, "fatol": 1e-10})
    if not math.isfinite(res.fun) or res.fun >= 1e11:
        raise ValueError("optimize_failed")
    t = res.x
    return spec["make"](t), spec["disp"](t), spec["k"], -float(res.fun)

def ks_conditional(fr, xu, d, u):
    # 조건부 CDF F*(x)=(F(x)-F(d))/(F(u)-F(d)) 기준 — 비검열 관측만
    Fd = float(fr.cdf(d)) if d > 0 else 0.0
    Fu = float(fr.cdf(u)) if math.isfinite(u) else 1.0
    den = Fu - Fd
    if not (den > 0 and math.isfinite(den)) or len(xu) < 2:
        return None, None
    ks = stats.kstest(xu, lambda z: np.clip((fr.cdf(z) - Fd) / den, 0.0, 1.0))
    return float(ks.statistic), float(ks.pvalue)

def qq_truncated(fr, xu, d, u, m=150):
    # (d,u) 절단 조건부 분위수 vs 비검열 관측 분위수
    xs = np.sort(np.asarray(xu, float))
    nn = len(xs)
    if nn <= m:
        pp = (np.arange(1, nn + 1) - 0.5) / nn
        samp = xs
    else:
        pp = (np.arange(1, m + 1) - 0.5) / m
        samp = np.quantile(xs, pp)
    Fd = float(fr.cdf(d)) if d > 0 else 0.0
    Fu = float(fr.cdf(u)) if math.isfinite(u) else 1.0
    theo = fr.ppf(Fd + pp * (Fu - Fd))
    okm = np.isfinite(theo) & np.isfinite(samp)
    return {"theo": _arr(theo[okm]), "samp": _arr(samp[okm])}

def curves_truncated(fr, d, u):
    # 오버레이 곡선 — 히스토그램(기록값)과 같은 스케일의 관측 조건부:
    # 밀도 f(x)/S(d) (d<x<u), 누적 (F(x)-F(d))/S(d) (x>=u는 1 — u에 검열 원자)
    Fd = float(fr.cdf(d)) if d > 0 else 0.0
    Sd = max(1.0 - Fd, 1e-300)
    py = fr.pdf(GRID) / Sd
    cy = np.clip((fr.cdf(GRID) - Fd) / Sd, 0.0, 1.0)
    py = np.where(GRID < d, np.nan, py)
    cy = np.where(GRID < d, np.nan, cy)
    if math.isfinite(u):
        py = np.where(GRID > u, np.nan, py)
        cy = np.where(GRID >= u, 1.0, cy)
    return _arr(py), _arr(cy)

# ───── 제로팽창(ZIP/ZINB) 헬퍼 — scipy에 없어 직접 정의 ─────
# 확률 pi로 '구조적 0', (1-pi)로 기저 이산분포(poisson/nbinom)를 섞은 혼합분포.
class ZeroInflated:
    def __init__(self, pi, base):
        self.pi = pi; self.base = base
    def pmf(self, k):
        k = np.asarray(k, float)
        base0 = self.pi + (1 - self.pi) * self.base.pmf(0)
        return np.where(k == 0, base0, (1 - self.pi) * self.base.pmf(k))
    def logpmf(self, k):
        return np.log(np.clip(self.pmf(k), 1e-300, None))
    def cdf(self, k):
        return self.pi + (1 - self.pi) * self.base.cdf(np.asarray(k, float))
    def sf(self, k):
        return 1.0 - self.cdf(k)
    def mean(self):
        return (1 - self.pi) * self.base.mean()
    def var(self):
        mm, vv = self.base.mean(), self.base.var()
        return (1 - self.pi) * (vv + mm * mm) - ((1 - self.pi) * mm) ** 2
    def ppf(self, q):
        q = np.atleast_1d(np.asarray(q, float)); out = np.empty(q.shape)
        for i, qq in enumerate(q):
            k = 0
            while k < 200000 and float(self.cdf(k)) < qq - 1e-12:
                k += 1
            out[i] = k
        return out

def _sig(z):
    return 1.0 / (1.0 + math.exp(-z))

# ───── 빈도(연도별 건수) MLE ─────
def fit_freq(fid, c):
    n = len(c)
    mean = float(np.mean(c))
    if fid == "poisson":
        fr = stats.poisson(mean)
        params = [("lambda", mean)]; k = 1
    elif fid == "negbinom":
        def nll(logr):
            r = math.exp(logr)
            p = r / (r + mean)
            v = -float(np.sum(stats.nbinom.logpmf(c, r, p)))
            return v if math.isfinite(v) else 1e12
        res = minimize_scalar(nll, bounds=(math.log(1e-2), math.log(1e4)), method="bounded")
        r = math.exp(res.x)
        p = r / (r + mean)
        fr = stats.nbinom(r, p)
        params = [("r", r), ("p", p)]; k = 2
    elif fid == "binomial":
        kobs = max(int(np.max(c)), 1)
        best = None
        for nn in range(kobs, kobs * 10 + 21):
            pp = mean / nn
            if not (0 < pp < 1):
                continue
            ll = float(np.sum(stats.binom.logpmf(c, nn, pp)))
            if math.isfinite(ll) and (best is None or ll > best[0]):
                best = (ll, nn, pp)
        if best is None:
            raise ValueError("binomial_fit_failed")
        fr = stats.binom(best[1], best[2])
        params = [("n", best[1]), ("p", best[2])]; k = 2
    elif fid == "zip":
        cf = np.asarray(c, float)
        p0hat = float(np.mean(cf == 0))
        lam0 = max(mean, 0.5)
        pi0 = min(max((p0hat - math.exp(-lam0)) / (1 - math.exp(-lam0) + 1e-9), 0.02), 0.9)
        nz = float(np.sum(cf == 0)); pos = cf[cf > 0]
        def nll(t):
            pi = _sig(t[0]); lam = math.exp(t[1])
            p0 = pi + (1 - pi) * math.exp(-lam)
            if not (0 < p0 < 1):
                return 1e12
            ll = nz * math.log(p0) + float(np.sum(math.log(1 - pi) + stats.poisson.logpmf(pos, lam)))
            return -ll if math.isfinite(ll) else 1e12
        res = minimize(nll, [math.log(pi0 / (1 - pi0)), math.log(lam0)], method="Nelder-Mead",
                       options={"maxiter": 4000, "xatol": 1e-9, "fatol": 1e-10})
        pi = _sig(res.x[0]); lam = math.exp(res.x[1])
        fr = ZeroInflated(pi, stats.poisson(lam))
        params = [("pi", pi), ("lambda", lam)]; k = 2
    elif fid == "zinb":
        cf = np.asarray(c, float)
        p0hat = float(np.mean(cf == 0))
        mu0 = max(mean, 0.5); pi0 = min(max(p0hat - math.exp(-mu0), 0.02), 0.9)
        nz = float(np.sum(cf == 0)); pos = cf[cf > 0]
        def nll(t):
            pi = _sig(t[0]); r = math.exp(t[1]); mu = math.exp(t[2])
            p = r / (r + mu); base0 = float(stats.nbinom.pmf(0, r, p))
            p0 = pi + (1 - pi) * base0
            if not (0 < p0 < 1):
                return 1e12
            ll = nz * math.log(p0) + float(np.sum(math.log(1 - pi) + stats.nbinom.logpmf(pos, r, p)))
            return -ll if math.isfinite(ll) else 1e12
        res = minimize(nll, [math.log(pi0 / (1 - pi0)), math.log(5.0), math.log(mu0)],
                       method="Nelder-Mead", options={"maxiter": 6000, "xatol": 1e-9, "fatol": 1e-10})
        pi = _sig(res.x[0]); r = math.exp(res.x[1]); mu = math.exp(res.x[2]); p = r / (r + mu)
        fr = ZeroInflated(pi, stats.nbinom(r, p))
        params = [("pi", pi), ("r", r), ("mu", mu)]; k = 3
    else:
        raise ValueError("unknown freq dist: " + fid)
    logL = float(np.sum(fr.logpmf(c)))
    aic = 2 * k - 2 * logL
    bic = k * math.log(n) - 2 * logL
    return fr, params, k, logL, aic, bic

def chi2_freq(fr, c, k):
    n = len(c)
    K = int(np.max(c))
    obs = np.bincount(np.asarray(c, int), minlength=K + 1).astype(float)
    E = n * np.array([float(fr.pmf(j)) for j in range(K + 1)])
    E[-1] += n * float(fr.sf(K))  # 꼬리(>K)를 마지막 빈에 합산
    ok = E > 0
    chi2 = float(np.sum((obs[ok] - E[ok]) ** 2 / E[ok]))
    df = int(ok.sum()) - 1 - k
    p = float(stats.chi2.sf(chi2, df)) if df > 0 else None
    return chi2, p, df

# ───── 실행 ─────
mode = INP["mode"]
if mode == "individual":
    x = np.asarray(INP.get("values") or [], float)
    _d = INP.get("deductible")
    _u = INP.get("limit")
    d = float(_d) if _d is not None else 0.0
    u = float(_u) if _u is not None else math.inf
    trunc = (d > 0) or math.isfinite(u)
    if not trunc:
        # 면책·한도 미적용 — 기존 scipy .fit 경로 그대로(회귀 없음)
        for did in INP.get("sevDists") or []:
            row = {"id": did, "ok": False}
            try:
                fr, params, k = fit_sev_individual(did, x)
                logL, aic, bic, D, ksp, a2 = gof_individual(fr, k, x)
                row.update(ok=True, k=k,
                           params=[{"name": a, "value": _num(b)} for a, b in params],
                           logL=_num(logL), aic=_num(aic), bic=_num(bic),
                           ksD=_num(D), ksP=_num(ksp), a2=_num(a2),
                           pdfY=_arr(fr.pdf(GRID)), cdfY=_arr(fr.cdf(GRID)),
                           qq=qq_points(fr, np.sort(x)))
            except Exception as e:
                row["error"] = str(e)[:300]
            OUT["severity"].append(row)
    else:
        # 면책·한도 반영 — 절단·검열 우도 수치최적화
        xu = x[x < u]                    # 비검열(실제 값을 아는) 관측
        nc = int(np.sum(x >= u))         # 검열(u 이상이라는 것만 아는) 관측 수
        n = len(x)
        SPECS = grouped_specs(xu, xu, np.ones(len(xu)))  # 초기값용 적률 = 비검열 값
        for did in INP.get("sevDists") or []:
            row = {"id": did, "ok": False}
            try:
                if did not in SPECS:
                    raise ValueError("not_supported_for_data")
                fr, params, k, logL = fit_truncated(SPECS[did], xu, nc, n, d, u)
                aic = 2 * k - 2 * logL
                bic = k * math.log(n) - 2 * logL
                D, ksp = ks_conditional(fr, xu, d, u)
                py_, cy_ = curves_truncated(fr, d, u)
                row.update(ok=True, k=k,
                           params=[{"name": a, "value": _num(b)} for a, b in params],
                           logL=_num(logL), aic=_num(aic), bic=_num(bic),
                           ksD=_num(D) if D is not None else None,
                           ksP=_num(ksp) if ksp is not None else None,
                           a2=None,  # A²는 검열 데이터에 표준 정의 없음 — '—' 표시
                           pdfY=py_, cdfY=cy_,
                           qq=qq_truncated(fr, xu, d, u))
            except Exception as e:
                row["error"] = str(e)[:300]
            OUT["severity"].append(row)
elif mode == "grouped":
    G = INP["groups"]
    A = np.asarray(G["lo"], float)
    B = np.asarray(G["hi"], float)
    N = np.asarray(G["n"], float)
    SPECS = grouped_specs(A, B, N)
    for did in INP.get("sevDists") or []:
        row = {"id": did, "ok": False}
        try:
            if did not in SPECS:
                raise ValueError("not_supported_for_data")
            fr, params, k, logL = fit_grouped(SPECS[did], A, B, N)
            ntot = float(np.sum(N))
            aic = 2 * k - 2 * logL
            bic = k * math.log(ntot) - 2 * logL
            c2, c2p, df = chi2_grouped(fr, A, B, N, k)
            row.update(ok=True, k=k,
                       params=[{"name": a, "value": _num(b)} for a, b in params],
                       logL=_num(logL), aic=_num(aic), bic=_num(bic),
                       chi2=_num(c2), chi2P=_num(c2p) if c2p is not None else None,
                       chi2Df=df,
                       pdfY=_arr(fr.pdf(GRID)), cdfY=_arr(fr.cdf(GRID)),
                       qq=qq_grouped(fr, B, N))
        except Exception as e:
            row["error"] = str(e)[:300]
        OUT["severity"].append(row)

FREQ = INP.get("freq")
if FREQ:
    c = np.asarray(FREQ["counts"], int)
    kg = np.asarray(FREQ["kGrid"], int)
    for fid in FREQ.get("dists") or []:
        row = {"id": fid, "ok": False}
        try:
            fr, params, k, logL, aic, bic = fit_freq(fid, c)
            c2, c2p, df = chi2_freq(fr, c, k)
            row.update(ok=True, k=k,
                       params=[{"name": a, "value": _num(b)} for a, b in params],
                       logL=_num(logL), aic=_num(aic), bic=_num(bic),
                       chi2=_num(c2), chi2P=_num(c2p) if c2p is not None else None,
                       chi2Df=df,
                       pmfY=_arr(fr.pmf(kg)), cdfY=_arr(fr.cdf(kg)),
                       qq=qq_points(fr, np.sort(c)))
        except Exception as e:
            row["error"] = str(e)[:300]
        OUT["frequency"].append(row)

with open("_fit_output.json", "w", encoding="utf-8") as _f:
    json.dump(OUT, _f)
`;
// 소스와의 차이는 위 꼬리뿐 — 소스는 마지막 표현식 json.dumps(OUT)를 repl 반환값으로 썼지만,
// repl repr 문자열 파싱은 취약해 FS 파일(_fit_output.json)로 회수한다(R4).

/* ─────────────────────────── 실행 래퍼 ─────────────────────────── */

// 구현: lib/reference/fit-runner.ts (워커 런타임 writeFile/repl/readFile 어댑터)
export { runDistributionFit } from "./fit-runner";
