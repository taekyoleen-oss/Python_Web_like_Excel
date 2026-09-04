/**
 * 확률분포 탭(/datalab) 전용 수치·특수함수 모듈 — 브라우저에서 scipy 없이
 * pdf/pmf·cdf·적률을 즉시 계산하기 위한 순수 함수 모음.
 *
 * 구현 근거: Lanczos 근사(logΓ), Abramowitz & Stegun 7.1.26(erf),
 * Numerical Recipes(정규화 불완전 감마·베타 연분수). 표시(소수 4자리) 목적의
 * 정확도로 충분하다. React 의존 없음 → 단위 검증이 쉽다.
 */

const SQRT2 = Math.SQRT2;
const LN_SQRT_2PI = 0.5 * Math.log(2 * Math.PI);

/* ─────────────────────────── logΓ (Lanczos g=7) ─────────────────────────── */

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028,
  771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** 로그 감마 함수 logΓ(z). z>0 권장(음수는 반사공식으로 처리). */
export function lgamma(z: number): number {
  if (z < 0.5) {
    // 반사공식: Γ(z)Γ(1−z) = π / sin(πz)
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  }
  z -= 1;
  let x = LANCZOS[0];
  for (let i = 1; i < LANCZOS.length; i++) x += LANCZOS[i] / (z + i);
  const t = z + LANCZOS.length - 1.5;
  return LN_SQRT_2PI + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/** 감마 함수 Γ(z). */
export function gammafn(z: number): number {
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gammafn(1 - z));
  return Math.exp(lgamma(z));
}

/** log B(a,b) = logΓ(a)+logΓ(b)−logΓ(a+b). */
export function betaln(a: number, b: number): number {
  return lgamma(a) + lgamma(b) - lgamma(a + b);
}

/** log n! = logΓ(n+1). */
export function factln(n: number): number {
  return lgamma(n + 1);
}

/** log C(n,k). */
export function logChoose(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity;
  return factln(n) - factln(k) - factln(n - k);
}

/* ────────────────────────────────── erf ────────────────────────────────── */

/** 오차함수 erf(x) — A&S 7.1.26 (최대오차 ~1.5e-7). */
export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

/** 표준정규 CDF Φ(z). */
export function normStdCdf(z: number): number {
  return 0.5 * (1 + erf(z / SQRT2));
}

/* ──────────────────── 정규화 하부 불완전 감마 P(a,x) ──────────────────── */

const FPMIN = 1e-300;

/** 급수 전개 (x < a+1). */
function gammpSeries(a: number, x: number): number {
  let ap = a;
  let sum = 1 / a;
  let del = sum;
  for (let n = 0; n < 500; n++) {
    ap += 1;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * 1e-15) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
}

/** 연분수 전개로 Q(a,x)=1−P (x ≥ a+1). */
function gammqCF(a: number, x: number): number {
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
}

/** 정규화 하부 불완전 감마 P(a,x) = γ(a,x)/Γ(a). 감마·카이제곱·포아송 CDF의 기초. */
export function lowerRegGamma(a: number, x: number): number {
  if (x <= 0 || a <= 0) return 0;
  if (x < a + 1) return gammpSeries(a, x);
  return 1 - gammqCF(a, x);
}

/* ──────────────────── 정규화 불완전 베타 I_x(a,b) ──────────────────── */

/** Numerical Recipes betacf. */
function betacf(a: number, b: number, x: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 500; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return h;
}

/** 정규화 불완전 베타 I_x(a,b). 베타·이항 CDF의 기초. */
export function regIncBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(
    betaln(a, b) * -1 + a * Math.log(x) + b * Math.log(1 - x)
  );
  // betaln은 log B(a,b)이므로 front = x^a (1−x)^b / B(a,b)
  if (x < (a + 1) / (a + b + 2)) {
    return (front * betacf(a, b, x)) / a;
  }
  return 1 - (front * betacf(b, a, 1 - x)) / b;
}

/* ─────────────────────────── 분위수(이분법) ─────────────────────────── */

/**
 * 단조증가 CDF의 p-분위수 — 그래프 도메인 산정용(닫힌형 역함수가 없는 감마 등).
 * [lo, hi]가 브래킷이 아니면 hi를 확장한다.
 */
export function quantileBisection(
  cdf: (x: number) => number,
  p: number,
  lo: number,
  hi: number
): number {
  let a = lo;
  let b = hi;
  let guard = 0;
  while (cdf(b) < p && guard < 80) {
    b = a + (b - a) * 2;
    guard++;
  }
  for (let i = 0; i < 100; i++) {
    const m = (a + b) / 2;
    if (cdf(m) < p) a = m;
    else b = m;
  }
  return (a + b) / 2;
}

/* ─────────────────── 원적률 → 중심적률(왜도·초과첨도) ─────────────────── */

export interface CentralMoments {
  mean: number;
  variance: number;
  skewness: number;
  excessKurtosis: number;
}

/**
 * 원적률 m1..m4 → 평균·분산·왜도·초과첨도. 파레토 등 닫힌형 적률식이
 * 번거로운 분포에서 공통 사용.
 */
export function centralFromRaw(
  m1: number,
  m2: number,
  m3: number,
  m4: number
): CentralMoments {
  const variance = m2 - m1 * m1;
  const mu3 = m3 - 3 * m1 * m2 + 2 * m1 ** 3;
  const mu4 = m4 - 4 * m1 * m3 + 6 * m1 * m1 * m2 - 3 * m1 ** 4;
  return {
    mean: m1,
    variance,
    skewness: mu3 / Math.pow(variance, 1.5),
    excessKurtosis: mu4 / (variance * variance) - 3,
  };
}
