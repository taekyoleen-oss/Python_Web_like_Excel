/**
 * 모델 적합 탭(/datalab) — 데이터 파싱·형식 자동 감지·empirical 계산 (JS 측).
 * 적합(MLE)·검정은 Pyodide scipy가 담당(lib/pyFit.ts)하고, 여기는 붙여넣기
 * 해석과 화면 즉시 표시용(히스토그램·ECDF·요약·연도별 건수) 계산만 다룬다.
 * React 의존 없음(순수 함수).
 */

export type FitKind = "individual" | "yearValue" | "grouped";

export const FIT_KIND_LABEL: Record<FitKind, string> = {
  individual: "개별 데이터 (1열 값)",
  yearValue: "연도 + 데이터값 (빈도·심도)",
  grouped: "그룹 데이터 (최소·최대·건수)",
};

export interface GroupRow {
  lo: number;
  hi: number;
  count: number;
}

/** 확정된 입력 데이터 — FitLab 상태의 핵심. */
export interface FitData {
  kind: FitKind;
  /** 심도(개별·연도+값) 값 배열 — grouped는 빈 배열 */
  values: number[];
  /** yearValue: 행별 연도(값과 같은 길이) */
  years?: number[];
  /** grouped: 구간 행 */
  groups?: GroupRow[];
  /** 헤더에서 추출한 값 열 이름(차트 축 라벨) */
  valueLabel?: string;
  /**
   * 면책(deductible) d — 좌측 절단. 값은 원손해액이며 d 미만 사고는 관측되지
   * 않았다는 규약. 미입력(undefined)=0(미적용). individual·yearValue 전용.
   */
  deductible?: number;
  /**
   * 보상한도(limit) u — 우측 검열. u 이상 사고는 u로 기록(x≥u 관측을 검열
   * 처리)이라는 규약. 미입력(undefined)=∞(미적용). individual·yearValue 전용.
   */
  limit?: number;
}

export interface DetectResult {
  kind: FitKind;
  /** 감지 근거 — 확인 다이얼로그에 표시 */
  reasons: string[];
  /** 형식과 무관한 주의(예: 열 초과 절단) */
  warnings: string[];
  headers: string[] | null;
  /** 숫자 행렬(헤더 제외) */
  rows: number[][];
}

/* ───────────────────────────── 파싱 ───────────────────────────── */

/** 셀 문자열 → 숫자. 콤마(1,234)·공백 허용, 실패 시 null. */
export function parseCell(s: string): number | null {
  const t = s.trim().replace(/,/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** 클립보드 텍스트 → 셀 행렬(TSV 우선, 아니면 CSV·연속 공백). */
export function splitClipboard(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
  return lines.map((ln) => {
    if (ln.includes("\t")) return ln.split("\t");
    if (ln.includes(",") && parseCell(ln) === null) return ln.split(",");
    return ln.split(/\s{2,}| /).filter((c, i, arr) => c !== "" || arr.length === 1);
  });
}

const YEAR_HINT = /연도|년도|^년$|year/i;
const MIN_HINT = /최소|하한|min|lower|from/i;
const MAX_HINT = /최대|상한|max|upper|to/i;
const COUNT_HINT = /건수|빈도|개수|count|freq|n\b/i;

/**
 * 셀 행렬 → 형식 자동 감지. 첫 행이 이름(비숫자)이면 헤더로 분리하고
 * 감지 힌트·축 라벨로 쓴다. 실패는 Error(사용자에게 그대로 표시할 한국어 메시지).
 */
export function detectFormat(cells: string[][]): DetectResult {
  // 완전 빈 행 제거, 사용 열 수 산정
  const raw = cells
    .map((r) => r.map((c) => (c ?? "").trim()))
    .filter((r) => r.some((c) => c !== ""));
  if (raw.length === 0) throw new Error("입력된 데이터가 없습니다.");

  const nCols = Math.max(...raw.map((r) => {
    let last = -1;
    r.forEach((c, i) => {
      if (c !== "") last = i;
    });
    return last + 1;
  }));
  const warnings: string[] = [];
  let cols = nCols;
  if (cols > 3) {
    warnings.push(`열이 ${cols}개 입력되어 앞의 3열만 사용합니다.`);
    cols = 3;
  }
  if (cols === 0) throw new Error("입력된 데이터가 없습니다.");

  const grid = raw.map((r) => Array.from({ length: cols }, (_, i) => r[i] ?? ""));

  // 헤더: 첫 행에 숫자가 아닌 셀이 하나라도 있고, 그 아래에 숫자 행이 존재
  let headers: string[] | null = null;
  let body = grid;
  const firstRowNonNumeric = grid[0].some((c) => c !== "" && parseCell(c) === null);
  if (firstRowNonNumeric && grid.length > 1) {
    headers = grid[0].map((c) => c.trim());
    body = grid.slice(1);
  }

  // 숫자 행렬 변환 — 어떤 셀이든 숫자가 아니면 행 번호와 함께 오류
  const rows: number[][] = [];
  for (let ri = 0; ri < body.length; ri++) {
    const row: number[] = [];
    for (let ci = 0; ci < cols; ci++) {
      const v = parseCell(body[ri][ci]);
      if (v === null) {
        const disp = ri + 1 + (headers ? 1 : 0);
        throw new Error(
          `${disp}행 ${ci + 1}열의 "${body[ri][ci] || "(빈 칸)"}"을 숫자로 읽을 수 없습니다.`
        );
      }
      row.push(v);
    }
    rows.push(row);
  }
  if (rows.length < 2) throw new Error("데이터 행이 2개 이상 필요합니다.");

  const reasons: string[] = [];
  if (headers) reasons.push(`첫 행 "${headers.filter(Boolean).join(" · ")}"을 이름(헤더)으로 인식`);

  let kind: FitKind;
  if (cols === 1) {
    kind = "individual";
    reasons.push("1열 숫자 → 개별 데이터");
  } else if (cols === 2) {
    const col0 = rows.map((r) => r[0]);
    const yearLike =
      col0.every((v) => Number.isInteger(v) && v >= 1900 && v <= 2100) &&
      Math.max(...col0) - Math.min(...col0) <= 150;
    const headerYear = headers ? YEAR_HINT.test(headers[0] ?? "") : false;
    if (yearLike || headerYear) {
      kind = "yearValue";
      reasons.push(
        headerYear
          ? `헤더 "${headers?.[0]}"가 연도 열을 가리킴`
          : "1열이 연도 형태(1900~2100 정수) → 연도+데이터값"
      );
    } else {
      kind = "individual";
      reasons.push("1열이 연도 형태가 아님 → 개별 데이터(2열 값 사용)로 추정");
      warnings.push("2열 형식인데 첫 열이 연도가 아닙니다 — 값은 2번째 열을 사용합니다. 형식이 다르면 아래에서 바꿔 주세요.");
    }
  } else {
    kind = "grouped";
    const hinted =
      headers &&
      MIN_HINT.test(headers[0] ?? "") &&
      MAX_HINT.test(headers[1] ?? "") &&
      COUNT_HINT.test(headers[2] ?? "");
    reasons.push(
      hinted
        ? "헤더가 최소·최대·건수 구성 → 그룹 데이터"
        : "3열 숫자 → 그룹 데이터(최소·최대·건수)"
    );
  }

  return { kind, reasons, warnings, headers, rows };
}

/** 감지(또는 사용자가 바꾼) 형식으로 실제 데이터 구성 — 형식별 검증 포함. */
export function buildFitData(det: DetectResult, kind: FitKind): FitData {
  const { rows, headers } = det;
  const label = (i: number) => headers?.[i]?.trim() || undefined;

  if (kind === "individual") {
    // 1열이면 그 열, 여러 열이면 마지막 열을 값으로
    const ci = rows[0].length - 1;
    const values = rows.map((r) => r[ci]);
    return { kind, values, valueLabel: label(ci) };
  }

  if (kind === "yearValue") {
    if (rows[0].length < 2)
      throw new Error("연도+데이터값 형식은 2열(연도, 값)이 필요합니다.");
    const years = rows.map((r) => r[0]);
    const values = rows.map((r) => r[1]);
    const bad = years.findIndex((y) => !Number.isInteger(y) || y < 1900 || y > 2100);
    if (bad >= 0)
      throw new Error(`${bad + 1}번째 데이터 행의 연도 "${years[bad]}"가 1900~2100 정수가 아닙니다.`);
    return { kind, values, years, valueLabel: label(1) };
  }

  // grouped
  if (rows[0].length < 3)
    throw new Error("그룹 데이터 형식은 3열(최소, 최대, 건수)이 필요합니다.");
  const groups: GroupRow[] = rows.map((r, i) => {
    const [lo, hi, count] = r;
    if (!(lo < hi))
      throw new Error(`${i + 1}번째 데이터 행: 최소(${lo})가 최대(${hi})보다 작아야 합니다.`);
    if (!(count > 0) || Math.abs(count - Math.round(count)) > 1e-9)
      throw new Error(`${i + 1}번째 데이터 행: 건수(${count})는 양의 정수여야 합니다.`);
    return { lo, hi, count: Math.round(count) };
  });
  // 그룹의 헤더 1열("최소" 등)은 값 이름이 아니므로 축 라벨로 쓰지 않는다
  const sorted = [...groups].sort((a, b) => a.lo - b.lo);
  return { kind, values: [], groups: sorted };
}

/* ─────────────────────── empirical (화면 즉시 표시) ─────────────────────── */

export interface SummaryStats {
  n: number;
  mean: number;
  sd: number;
  cv: number | null;
  skew: number | null;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  /** 그룹데이터 중간값 근사 여부 */
  approx?: boolean;
}

export interface BarBin {
  x0: number;
  x1: number;
  /** 밀도(적합 PDF와 같은 스케일) */
  y: number;
}

export interface XY {
  x: number;
  y: number;
}

export interface EmpiricalCont {
  summary: SummaryStats;
  bars: BarBin[];
  /** ECDF 계단 점(최대 ~400점 서브샘플) */
  ecdf: XY[];
  /** 오버레이 곡선을 계산할 x범위 */
  range: [number, number];
}

function quantileSorted(xs: number[], p: number): number {
  const h = (xs.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return xs[lo] + (xs[hi] - xs[lo]) * (h - lo);
}

function summarize(xs: number[], approx?: boolean): SummaryStats {
  const n = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  let m2 = 0;
  let m3 = 0;
  for (const x of xs) {
    const d = x - mean;
    m2 += d * d;
    m3 += d * d * d;
  }
  const sd = Math.sqrt(m2 / n);
  const skew = sd > 0 ? m3 / n / sd ** 3 : null;
  return {
    n,
    mean,
    sd,
    cv: mean !== 0 ? sd / Math.abs(mean) : null,
    skew,
    min: xs[0],
    q1: quantileSorted(xs, 0.25),
    median: quantileSorted(xs, 0.5),
    q3: quantileSorted(xs, 0.75),
    max: xs[xs.length - 1],
    approx,
  };
}

/** 개별 값 → 히스토그램(밀도)·ECDF·요약. */
export function empiricalFromValues(values: number[]): EmpiricalCont {
  const xs = [...values].sort((a, b) => a - b);
  const n = xs.length;
  const summary = summarize(xs);

  // Freedman–Diaconis, 폴백 Sturges, 5~60개 클램프
  const iqr = summary.q3 - summary.q1;
  const span = summary.max - summary.min || Math.abs(summary.max) || 1;
  let bins: number;
  if (iqr > 0) bins = Math.ceil(span / ((2 * iqr) / Math.cbrt(n)));
  else bins = Math.ceil(Math.log2(n) + 1);
  bins = Math.max(5, Math.min(60, bins || 5));

  const w = span / bins;
  const counts = new Array<number>(bins).fill(0);
  for (const x of xs) {
    let bi = Math.floor((x - summary.min) / w);
    if (bi >= bins) bi = bins - 1;
    if (bi < 0) bi = 0;
    counts[bi]++;
  }
  const bars: BarBin[] = counts.map((c, i) => ({
    x0: summary.min + i * w,
    x1: summary.min + (i + 1) * w,
    y: c / (n * w),
  }));

  // ECDF — n이 크면 균등 서브샘플(계단 표시용)
  const cap = 400;
  const step = Math.max(1, Math.ceil(n / cap));
  const ecdf: XY[] = [{ x: xs[0], y: 0 }];
  for (let i = 0; i < n; i += step) ecdf.push({ x: xs[i], y: (i + 1) / n });
  if ((n - 1) % step !== 0) ecdf.push({ x: xs[n - 1], y: 1 });

  const pad = span * 0.04;
  return { summary, bars, ecdf, range: [summary.min - pad, summary.max + pad] };
}

/** 그룹 데이터 → 구간 밀도 막대·ogive(누적) ·근사 요약(중간값 가중). */
export function empiricalFromGroups(groups: GroupRow[]): EmpiricalCont {
  const total = groups.reduce((a, g) => a + g.count, 0);
  const bars: BarBin[] = groups.map((g) => ({
    x0: g.lo,
    x1: g.hi,
    y: g.count / (total * (g.hi - g.lo)),
  }));

  // ogive: 구간 경계 누적확률(선형 보간 대신 경계점만 — step으로 표시)
  const ecdf: XY[] = [{ x: groups[0].lo, y: 0 }];
  let acc = 0;
  for (const g of groups) {
    acc += g.count;
    ecdf.push({ x: g.hi, y: acc / total });
  }

  // 근사 요약: 중간값을 건수만큼 반복한 것과 동일한 가중 계산
  const mids: number[] = [];
  for (const g of groups) {
    const m = (g.lo + g.hi) / 2;
    for (let i = 0; i < g.count; i++) mids.push(m);
  }
  mids.sort((a, b) => a - b);
  const summary = summarize(mids, true);
  summary.min = groups[0].lo;
  summary.max = groups[groups.length - 1].hi;

  const span = summary.max - summary.min || 1;
  return {
    summary,
    bars,
    ecdf,
    range: [Math.max(0, summary.min - span * 0.02), summary.max + span * 0.04],
  };
}

/* ─────────────────────────── 빈도(연도별 건수) ─────────────────────────── */

export interface FreqEmpirical {
  /** 관측 연도 범위(빈 해 0건 채움) */
  years: { year: number; count: number }[];
  /** 적합 입력이 되는 연도별 건수 */
  counts: number[];
  /** 건수 k의 경험 확률 P(N=k) */
  pmf: XY[];
  /** 경험 CDF 계단 점 */
  cdf: XY[];
  kMax: number;
  mean: number;
  variance: number;
  /** 채워 넣은 0건 연도 수 */
  zeroFilled: number;
}

/** 연도 배열(청구 1건=1행) → 연도별 건수·경험 PMF. 빈 해는 0건으로 채운다. */
export function frequencyFromYears(yearRows: number[]): FreqEmpirical {
  const byYear = new Map<number, number>();
  for (const y of yearRows) byYear.set(y, (byYear.get(y) ?? 0) + 1);
  const y0 = Math.min(...yearRows);
  const y1 = Math.max(...yearRows);
  const years: { year: number; count: number }[] = [];
  let zeroFilled = 0;
  for (let y = y0; y <= y1; y++) {
    const c = byYear.get(y) ?? 0;
    if (c === 0) zeroFilled++;
    years.push({ year: y, count: c });
  }
  const counts = years.map((r) => r.count);
  const n = counts.length;
  const mean = counts.reduce((a, b) => a + b, 0) / n;
  const variance = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const kMax = Math.max(...counts);

  const freqOfK = new Array<number>(kMax + 1).fill(0);
  for (const c of counts) freqOfK[c]++;
  const pmf: XY[] = freqOfK.map((f, k) => ({ x: k, y: f / n }));
  const cdf: XY[] = [];
  let acc = 0;
  for (let k = 0; k <= kMax; k++) {
    acc += freqOfK[k] / n;
    cdf.push({ x: k, y: Math.min(1, acc) });
  }
  return { years, counts, pmf, cdf, kMax, mean, variance, zeroFilled };
}

/* ─────────────────────────── 꼬리 진단(JS 계산) ─────────────────────────── */

export interface TailDiagnostics {
  /** 유효(양수 아닐 수 있음) 표본 수 */
  n: number;
  /** 평균초과 e(u)=E[X−u | X>u] — x=임계값 u, y=e(u). 우상향 직선=파레토성 */
  meanExcess: XY[];
  /** log-log 생존함수 — x=log(값), y=−log S(=log 1/S). 직선=멱법칙(두꺼운 꼬리) */
  logLogSurvival: XY[];
  /** Hill plot — x=상위 순서통계 개수 k, y=꼬리지수 α̂=1/H_k. 안정 구간이 α 추정 */
  hill: XY[];
  /** log 기반 그림(log-log·Hill)을 위해 필요한 양수 조건 충족 여부 */
  positiveOnly: boolean;
}

/** 배열을 최대 cap개로 균등 서브샘플(양 끝 보존). */
function subsample<T>(arr: T[], cap: number): T[] {
  if (arr.length <= cap) return arr;
  const step = (arr.length - 1) / (cap - 1);
  const out: T[] = [];
  for (let i = 0; i < cap; i++) out.push(arr[Math.round(i * step)]);
  return out;
}

/**
 * 심도(개별·연도+값) 데이터의 꼬리 두께 진단 3종을 JS로 계산(Pyodide 불필요).
 * 정렬된 표본만으로 평균초과·log-log 생존함수·Hill plot을 산출한다.
 * n<8이면 진단이 불안정하므로 null.
 */
export function tailDiagnostics(values: number[]): TailDiagnostics | null {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const n = xs.length;
  if (n < 8) return null;
  const positiveOnly = xs[0] > 0;

  // ── 평균초과 e(u) — u=xs[i](i=0..n−2), 뒤 누적합으로 O(n) ──
  // e(xs[i]) = mean(xs[i+1..n−1]) − xs[i]. 표본이 5개 미만 남는 극단 우측은
  // 분산이 커 노이즈가 심하므로(cnt<5) 제외한다.
  const meAll: XY[] = [];
  let tailSum = 0;
  for (let i = n - 2; i >= 0; i--) {
    tailSum += xs[i + 1];
    const cnt = n - 1 - i; // xs[i] 초과(뒤쪽) 개수
    if (cnt >= 5) meAll[i] = { x: xs[i], y: tailSum / cnt - xs[i] };
  }
  const meanExcess = subsample(
    meAll.filter((p): p is XY => p !== undefined),
    60
  );

  // ── log-log 생존함수 & Hill (양수 데이터에서만 정의) ──
  let logLogSurvival: XY[] = [];
  let hill: XY[] = [];
  if (positiveOnly) {
    // 생존함수: i번째 오름차순 순서통계(1-index)의 S_i = 1 − i/(n+1)
    const llAll: XY[] = [];
    for (let i = 1; i <= n; i++) {
      const s = 1 - i / (n + 1);
      if (s > 0) llAll.push({ x: Math.log(xs[i - 1]), y: -Math.log(s) });
    }
    logLogSurvival = subsample(llAll, 60);

    // Hill: 내림차순 순서통계 lnDesc[0]=max. H_k=(1/k)Σ_{i<k}(lnDesc[i]−lnDesc[k])
    const lnDesc = new Array<number>(n);
    for (let i = 0; i < n; i++) lnDesc[i] = Math.log(xs[n - 1 - i]);
    let acc = 0; // Σ_{i=0..k−1} lnDesc[i]
    const hAll: XY[] = [];
    for (let k = 1; k <= n - 1; k++) {
      acc += lnDesc[k - 1];
      const H = acc / k - lnDesc[k];
      if (H > 0) hAll.push({ x: k, y: 1 / H });
    }
    hill = subsample(hAll, 60);
  }

  return { n, meanExcess, logLogSurvival, hill, positiveOnly };
}

/* ───────────────── 면책·한도(좌측 절단·우측 검열) 검증 ───────────────── */

export interface TruncationCheck {
  ok: boolean;
  /** 사용자에게 그대로 보여줄 한국어 오류 */
  error?: string;
  /** u 이상(검열) 관측 수 */
  censored: number;
  /** u 미만(비검열) 관측 수 */
  uncensored: number;
}

/**
 * 면책 d·한도 u 입력 검증 — 개별·연도+값 심도 데이터 전용.
 * 규약: 값은 원손해액, d 미만 미관측(좌측 절단), u 이상은 u로 기록(우측 검열).
 * undefined = 미적용(d=0 / u=∞).
 */
export function checkTruncation(
  values: number[],
  d?: number,
  u?: number
): TruncationCheck {
  const fail = (error: string): TruncationCheck => ({
    ok: false,
    error,
    censored: 0,
    uncensored: values.length,
  });

  if (d !== undefined && (!Number.isFinite(d) || d < 0))
    return fail("면책 d는 0 이상의 숫자여야 합니다.");
  if (u !== undefined && (!Number.isFinite(u) || u <= 0))
    return fail("보상한도 u는 0보다 큰 숫자여야 합니다.");
  const dd = d ?? 0;
  if (u !== undefined && u <= dd)
    return fail(`보상한도 u(${u})는 면책 d(${dd})보다 커야 합니다.`);

  if (dd > 0) {
    const below = values.filter((v) => v < dd).length;
    if (below === values.length)
      return fail(
        `모든 관측이 면책 d=${dd} 미만입니다 — 관측 규약(d 미만 미관측)과 모순됩니다. d를 확인하세요.`
      );
    if (below > 0)
      return fail(
        `면책 d=${dd}보다 작은 값이 ${below}건 있습니다. 규약상 d 미만 사고는 데이터에 없어야 합니다(원손해액 기준) — d를 낮추거나 비워 주세요.`
      );
  }

  const uu = u ?? Infinity;
  const censored = values.filter((v) => v >= uu).length;
  const uncensored = values.length - censored;
  if (u !== undefined && uncensored < 2)
    return fail(
      `한도 u=${u} 미만(비검열) 관측이 ${uncensored}건뿐입니다 — 전부(또는 대부분) 검열이라 적합할 수 없습니다. u를 확인하세요.`
    );
  return { ok: true, censored, uncensored };
}

/** 데이터에 면책·한도 적합이 실제로 적용되는지(그룹 제외, d>0 또는 u 유한). */
export function truncationActive(data: FitData): boolean {
  return (
    data.kind !== "grouped" &&
    ((data.deductible ?? 0) > 0 || data.limit !== undefined)
  );
}

/* ────────────────────── 적합 가능성(분포별 데이터 조건) ────────────────────── */

export interface EligibilityCheck {
  ok: boolean;
  reason?: string;
}

/**
 * 심도 분포별 데이터 조건 — 미충족이면 체크박스를 비활성하고 사유를 보여 준다.
 * 그룹데이터는 구간이 지지집합과 겹치면 되므로 조건이 느슨하다:
 * 예) [0, b] 구간은 로그정규에도 유효(F(0)=0) — 개별 x=0은 불가.
 */
export function severityEligibility(
  distId: string,
  data: FitData
): EligibilityCheck {
  if (data.kind === "grouped") {
    const gs = data.groups ?? [];
    const loMin = Math.min(...gs.map((g) => g.lo));
    const hiMax = Math.max(...gs.map((g) => g.hi));
    switch (distId) {
      case "lognormal":
      case "gamma":
      case "exponential":
      case "weibull":
      case "pareto2":
      case "genpareto":
        return loMin >= 0
          ? { ok: true }
          : { ok: false, reason: "음수 구간 포함 — 0 이상 데이터 필요" };
      case "beta":
        return loMin >= 0 && hiMax <= 1
          ? { ok: true }
          : { ok: false, reason: "[0,1] 범위 밖 구간 포함" };
      case "pareto1":
        return loMin > 0
          ? { ok: true }
          : { ok: false, reason: "하한 θ=최소 구간하한>0 필요" };
      default:
        return { ok: true }; // normal
    }
  }
  const min = Math.min(...data.values);
  const max = Math.max(...data.values);
  switch (distId) {
    case "lognormal":
    case "gamma":
      return min > 0
        ? { ok: true }
        : { ok: false, reason: "0 이하 값 포함 — 양수 데이터 필요" };
    case "exponential":
    case "weibull":
    case "pareto2":
    case "genpareto":
      return min >= 0
        ? { ok: true }
        : { ok: false, reason: "음수 값 포함 — 0 이상 데이터 필요" };
    case "beta":
      return min > 0 && max < 1
        ? { ok: true }
        : { ok: false, reason: "(0,1) 범위 밖 값 포함" };
    case "pareto1":
      return min > 0
        ? { ok: true }
        : { ok: false, reason: "하한 θ=min(x)>0 필요" };
    default:
      return { ok: true }; // normal
  }
}

/* ─────────────────────────── 표시 포맷 헬퍼 ─────────────────────────── */

/** 요약통계·파라미터 값 표시 — 큰 수 콤마, 소수 유효 4자리. */
export function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e7 || a < 1e-4)) return v.toExponential(3);
  const digits = a >= 100 ? 1 : a >= 1 ? 3 : 4;
  return v.toLocaleString("en-US", { maximumFractionDigits: digits });
}
