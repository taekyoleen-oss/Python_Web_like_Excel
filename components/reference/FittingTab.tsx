"use client";

/**
 * 모델적합 탭 (부록 E R4) — 소스: Actuarial_Platform FitLab.tsx.
 * 적합 엔진은 이 앱의 워커 런타임(runDistributionFit — lib/reference/fit-runner.ts).
 * 흐름: 데이터 입력(스프레드 팝업, 형식 자동 감지+확인) → 좌 요약/우 empirical
 * PDF·CDF → (연도+값이면 빈도 블록) → 분포 선택(전체 선택/해제·적합불가 사유)
 * → 적합 실행(Pyodide scipy — 최초 1회 다운로드) → 결과 표(열 클릭 정렬·행
 * 선택=오버레이·QQ 팝업·파이썬 코드 팝업) → 몬테카를로 코드.
 */
import { useMemo, useState } from "react";
import {
  ArrowCounterClockwise,
  ChartLine,
  Code,
  Info,
  Play,
  Pulse,
  Table,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  empiricalFromGroups,
  empiricalFromValues,
  frequencyFromYears,
  fmtNum,
  severityEligibility,
  truncationActive,
  FIT_KIND_LABEL,
  type EmpiricalCont,
  type FitData,
  type FreqEmpirical,
} from "@/lib/reference/fitData";
import {
  runDistributionFit,
  type FitResultRow,
  type FitRunResult,
  type RunPhase,
} from "@/lib/reference/pyFit";
import {
  frequencyFitCode,
  frequencySimCode,
  monteCarloCode,
  severityFitCode,
  severitySimCode,
} from "@/lib/reference/fitPython";
import { DistChart, type Series } from "@/components/reference/DistChart";
import { DataSheetDialog } from "@/components/reference/DataSheetDialog";
import { QqDialog } from "@/components/reference/QqDialog";
import { TailDiagnosticsDialog } from "@/components/reference/TailDiagnosticsDialog";
import { CodeDialog, type CodeTab } from "@/components/reference/CodeDialog";
import { StatInfoDialog } from "@/components/reference/StatInfoDialog";
import { STAT_INFOS } from "@/lib/reference/statInfos";
import { selectionToCells } from "@/lib/grid/import-blocks";
import { openFitGuideDialog } from "@/components/python/FitGuideDialog";

/* ─────────────────────── 분포 카탈로그(표시용) ─────────────────────── */

const SEV_DISTS: { id: string; name: string }[] = [
  { id: "normal", name: "정규" },
  { id: "lognormal", name: "로그정규" },
  { id: "exponential", name: "지수" },
  { id: "weibull", name: "와이블" },
  { id: "gamma", name: "감마" },
  { id: "beta", name: "베타" },
  { id: "pareto2", name: "파레토(2모수)" },
  { id: "pareto1", name: "파레토(1모수)" },
  { id: "genpareto", name: "일반화 파레토(GPD)" },
];

const FREQ_DISTS: { id: string; name: string }[] = [
  { id: "poisson", name: "포아송" },
  { id: "negbinom", name: "음이항" },
  { id: "binomial", name: "이항" },
  { id: "zip", name: "제로팽창 포아송(ZIP)" },
  { id: "zinb", name: "제로팽창 음이항(ZINB)" },
];

const nameOf = (list: { id: string; name: string }[], id: string) =>
  list.find((d) => d.id === id)?.name ?? id;

const COLOR_EMP = "var(--primary)";
const COLOR_FIT = "var(--chip-rose-fg)";

/* ─────────────────────────── 정렬 ─────────────────────────── */

type SortKey = "aic" | "bic" | "logL" | "ksD" | "a2" | "chi2";

/** 열별 '좋음' 방향 — logL만 클수록 좋음(내림차순), 나머지 오름차순. */
const SORT_ASC: Record<SortKey, boolean> = {
  aic: true,
  bic: true,
  ksD: true,
  a2: true,
  chi2: true,
  logL: false,
};

const SORT_LABELS: Record<SortKey, string> = {
  aic: "AIC",
  bic: "BIC",
  logL: "logL",
  ksD: "KS D",
  a2: "A²",
  chi2: "χ²",
};

const MEDALS = ["🥇", "🥈", "🥉"];

function sortRows(rows: FitResultRow[], key: SortKey): FitResultRow[] {
  const asc = SORT_ASC[key];
  return [...rows].sort((a, b) => {
    const va = a.ok ? (a[key] as number | null) : null;
    const vb = b.ok ? (b[key] as number | null) : null;
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    return asc ? va - vb : vb - va;
  });
}

/* ─────────────────────────── 샘플 데이터 ─────────────────────────── */

/** 결정적 PRG — 샘플 버튼용(로그정규 심도 + 포아송 빈도 흉내). */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleCells(): string[][] {
  const rnd = mulberry32(20260716);
  const normal = () => {
    const u = Math.max(rnd(), 1e-12);
    const v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const rows: string[][] = [["연도", "보험금"]];
  for (let year = 2016; year <= 2025; year++) {
    // 연간 건수 ~ 대략 포아송(18)
    let n = 0;
    let acc = Math.exp(-18);
    let cum = acc;
    const u = rnd();
    while (cum < u && n < 60) {
      n++;
      acc *= 18 / n;
      cum += acc;
    }
    for (let i = 0; i < n; i++) {
      const x = Math.exp(7.2 + 0.85 * normal()); // 로그정규 심도
      rows.push([String(year), String(Math.round(x))]);
    }
  }
  return rows;
}

/* ─────────────────────────── 하위 UI 조각 ─────────────────────────── */

function SummaryCard({
  emp,
  data,
}: {
  emp: EmpiricalCont;
  data: FitData;
}) {
  const s = emp.summary;
  const rows: [string, string][] = [
    ["표본 수 n", s.n.toLocaleString()],
    ["평균", fmtNum(s.mean)],
    ["표준편차", fmtNum(s.sd)],
    ["변동계수 CV", fmtNum(s.cv)],
    ["왜도", fmtNum(s.skew)],
    ["최소 / 최대", `${fmtNum(s.min)} / ${fmtNum(s.max)}`],
    ["사분위 Q1·중위·Q3", `${fmtNum(s.q1)} · ${fmtNum(s.median)} · ${fmtNum(s.q3)}`],
  ];
  // 면책·한도 적용 시 — 적용값과 검열 건수 표시
  if (truncationActive(data)) {
    const u = data.limit;
    const censored =
      u !== undefined ? data.values.filter((v) => v >= u).length : 0;
    rows.push([
      "면책 d / 한도 u",
      `${(data.deductible ?? 0) > 0 ? fmtNum(data.deductible) : "—"} / ${u !== undefined ? fmtNum(u) : "∞"}`,
    ]);
    if (u !== undefined)
      rows.push([
        "검열(≥u) 관측",
        `${censored.toLocaleString()}건 (비검열 ${(s.n - censored).toLocaleString()}건)`,
      ]);
  }
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h4 className="mb-2 text-[13px] font-semibold text-foreground">
        데이터 요약{s.approx ? " (구간 중간값 근사)" : ""}
      </h4>
      <dl className="space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3">
            <dt className="text-[12.5px] text-muted-foreground">{k}</dt>
            <dd className="text-[12.5px] font-medium tabular-nums text-foreground">
              {v}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 border-t border-border pt-2 text-[11.5px] leading-relaxed text-muted-foreground">
        형식: {FIT_KIND_LABEL[data.kind]}
        {data.valueLabel ? ` · 값 열 "${data.valueLabel}"` : ""}
      </p>
    </div>
  );
}

/** GoF 값 셀 */
function Cell({ v, digits = 2 }: { v: number | null | undefined; digits?: number }) {
  if (v === null || v === undefined || !Number.isFinite(v))
    return <span className="text-muted-foreground">—</span>;
  const a = Math.abs(v);
  return (
    <>{a >= 1e6 || (a > 0 && a < 1e-4) ? v.toExponential(2) : v.toFixed(digits)}</>
  );
}

function PhaseNote({ phase }: { phase: RunPhase | null }) {
  if (!phase) return null;
  const msg =
    phase === "boot"
      ? "파이썬 런타임(Pyodide) 로드 중 — 최초 1회만 다운로드합니다…"
      : phase === "pkg"
        ? "scipy·numpy 패키지 로드 중…"
        : "scipy로 적합 계산 중…";
  return (
    <span className="inline-flex items-center gap-2 text-[12.5px] text-muted-foreground">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-border border-t-[var(--primary)]" />
      {msg}
    </span>
  );
}

/* ─────────────────────────── 결과 표 ─────────────────────────── */

function ResultsTable({
  title,
  testId,
  rows,
  dists,
  isGrouped,
  selectedId,
  onSelect,
  onQq,
  onCode,
}: {
  title: string;
  testId?: string;
  rows: FitResultRow[];
  dists: { id: string; name: string }[];
  /** χ² 표시(그룹·빈도) 여부 — 아니면 KS·A² */
  isGrouped: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onQq: (row: FitResultRow) => void;
  onCode: (row: FitResultRow) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("aic");
  const [statInfo, setStatInfo] = useState<string | null>(null);
  const sorted = useMemo(() => sortRows(rows, sortKey), [rows, sortKey]);

  /** ⓘ — 통계량 설명 팝업 열기(정렬 클릭과 분리) */
  const infoBtn = (infoKey: string) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setStatInfo(infoKey);
      }}
      aria-label={`${STAT_INFOS[infoKey].name} 설명 보기`}
      title={`${STAT_INFOS[infoKey].name} 설명·판단기준`}
      className="ml-1 inline-flex translate-y-[1.5px] text-muted-foreground/70 hover:text-[var(--primary)]"
    >
      <Info size={12} />
    </button>
  );

  const th = (key: SortKey, label: string) => (
    <th
      className={`cursor-pointer whitespace-nowrap px-2.5 py-1.5 text-right font-medium hover:text-foreground ${
        sortKey === key ? "text-foreground" : ""
      }`}
      onClick={() => setSortKey(key)}
      title={`${label} 기준 정렬`}
    >
      {label}
      {sortKey === key ? (SORT_ASC[key] ? " ↑" : " ↓") : ""}
      {infoBtn(key)}
    </th>
  );

  const thPlain = (label: string, infoKey: string) => (
    <th className="whitespace-nowrap px-2.5 py-1.5 text-right font-medium">
      {label}
      {infoBtn(infoKey)}
    </th>
  );

  const top3 = sorted.filter((r) => r.ok).slice(0, 3);

  return (
    <div className="mb-6" data-testid={testId}>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h4 className="text-[13.5px] font-semibold text-foreground">{title}</h4>
        <span className="text-[12px] text-muted-foreground">
          열 이름을 누르면 그 기준으로 순위 정렬 · ⓘ=통계량 설명 · 행을 누르면
          위 그래프에 겹쳐 표시
        </span>
      </div>

      {/* 최적 적합 Top 3 — 현재 정렬 기준 순위 */}
      {top3.length > 0 ? (
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-medium text-muted-foreground">
            최적 적합 Top 3 ({SORT_LABELS[sortKey]} 기준)
          </span>
          {top3.map((r, i) => {
            const active = r.id === selectedId;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onSelect(r.id)}
                title="클릭하면 위 그래프에 이 분포를 겹쳐 표시"
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] transition-colors ${
                  active
                    ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--chip-blue-bg)_55%,white)] text-foreground"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                }`}
              >
                <span aria-hidden>{MEDALS[i]}</span>
                <span className="font-medium">
                  {i + 1}위 {nameOf(dists, r.id)}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  <Cell v={r[sortKey] as number | null} />
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="bg-muted text-muted-foreground">
              <th className="w-10 px-2.5 py-1.5 text-center font-medium">순위</th>
              <th className="px-2.5 py-1.5 text-left font-medium">분포</th>
              <th className="px-2.5 py-1.5 text-left font-medium">파라미터</th>
              {th("logL", "logL")}
              {th("aic", "AIC")}
              {th("bic", "BIC")}
              {isGrouped ? (
                <>
                  {th("chi2", "χ²")}
                  {thPlain("χ² p", "chi2P")}
                </>
              ) : (
                <>
                  {th("ksD", "KS D")}
                  {thPlain("KS p", "ksP")}
                  {th("a2", "A²")}
                </>
              )}
              <th className="px-2.5 py-1.5 text-center font-medium">QQ</th>
              <th className="px-2.5 py-1.5 text-center font-medium">코드</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const active = r.ok && r.id === selectedId;
              return (
                <tr
                  key={r.id}
                  onClick={() => (r.ok ? onSelect(r.id) : undefined)}
                  className={`border-t border-border transition-colors ${
                    r.ok ? "cursor-pointer" : "opacity-55"
                  } ${active ? "bg-[color-mix(in_srgb,var(--chip-blue-bg)_55%,white)]" : "hover:bg-muted/60"}`}
                  aria-selected={active}
                >
                  <td className="px-2.5 py-1.5 text-center tabular-nums text-muted-foreground">
                    {r.ok ? i + 1 : "—"}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 font-medium text-foreground">
                    {nameOf(dists, r.id)}
                    {active ? (
                      <span className="ml-1.5 text-[10.5px] font-semibold text-[var(--primary)]">
                        표시 중
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2.5 py-1.5 text-muted-foreground">
                    {r.ok
                      ? r.params
                          ?.map((q) => `${q.name}=${fmtNum(q.value)}`)
                          .join(", ")
                      : `적합 실패: ${r.error ?? "알 수 없음"}`}
                  </td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums">
                    <Cell v={r.logL} />
                  </td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums">
                    <Cell v={r.aic} />
                  </td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums">
                    <Cell v={r.bic} />
                  </td>
                  {isGrouped ? (
                    <>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">
                        <Cell v={r.chi2} />
                      </td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">
                        <Cell v={r.chi2P} digits={4} />
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">
                        <Cell v={r.ksD} digits={4} />
                      </td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">
                        <Cell v={r.ksP} digits={4} />
                      </td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">
                        <Cell v={r.a2} />
                      </td>
                    </>
                  )}
                  <td className="px-2 py-1.5 text-center">
                    {r.ok && r.qq ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onQq(r);
                        }}
                        className="rounded border border-border px-2 py-0.5 text-[11.5px] text-muted-foreground hover:text-foreground"
                      >
                        QQ
                      </button>
                    ) : null}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {r.ok ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCode(r);
                        }}
                        className="rounded border border-border px-2 py-0.5 text-[11.5px] text-muted-foreground hover:text-foreground"
                      >
                        <Code size={12} className="inline" />
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {statInfo && STAT_INFOS[statInfo] ? (
        <StatInfoDialog
          info={STAT_INFOS[statInfo]}
          onClose={() => setStatInfo(null)}
        />
      ) : null}
    </div>
  );
}

/* ─────────────────────────── 루트 ─────────────────────────── */

export default function FittingTab() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cells, setCells] = useState<string[][] | null>(null);
  const [data, setData] = useState<FitData | null>(null);

  const [selSev, setSelSev] = useState<Set<string>>(
    () => new Set(SEV_DISTS.map((d) => d.id))
  );
  const [selFreq, setSelFreq] = useState<Set<string>>(
    () => new Set(FREQ_DISTS.map((d) => d.id))
  );

  const [phase, setPhase] = useState<RunPhase | null>(null);
  const [fitError, setFitError] = useState<string | null>(null);
  const [results, setResults] = useState<FitRunResult | null>(null);
  const [overlaySev, setOverlaySev] = useState<string | null>(null);
  const [overlayFreq, setOverlayFreq] = useState<string | null>(null);

  const [tailOpen, setTailOpen] = useState(false);
  const [qqTarget, setQqTarget] = useState<{
    row: FitResultRow;
    group: "sev" | "freq";
  } | null>(null);
  const [codeDialog, setCodeDialog] = useState<{
    name: string;
    en: string;
    code?: string;
    tabs?: CodeTab[];
  } | null>(null);

  /* 시트에서 가져오기 — 현재 그리드 선택 범위(1~3열)를 데이터 시트로 (R4 통합) */
  const importFromSheet = () => {
    const r = selectionToCells();
    if ("error" in r) {
      toast.error(r.error);
      return;
    }
    setCells(r.cells);
    setSheetOpen(true);
  };

  /* 리셋 — 입력 데이터·적합 결과를 지우고 처음 상태(분포 전체 선택)로 되돌린다 */
  const resetFit = () => {
    setCells(null);
    setData(null);
    setResults(null);
    setFitError(null);
    setPhase(null);
    setOverlaySev(null);
    setOverlayFreq(null);
    setSelSev(new Set(SEV_DISTS.map((d) => d.id)));
    setSelFreq(new Set(FREQ_DISTS.map((d) => d.id)));
    setTailOpen(false);
    setQqTarget(null);
    setCodeDialog(null);
    setSheetOpen(false);
  };

  /* empirical — 데이터 확정 시 JS로 즉시 계산 */
  const emp = useMemo<EmpiricalCont | null>(() => {
    if (!data) return null;
    return data.kind === "grouped"
      ? empiricalFromGroups(data.groups ?? [])
      : empiricalFromValues(data.values);
  }, [data]);

  const freqEmp = useMemo<FreqEmpirical | null>(() => {
    if (!data || data.kind !== "yearValue" || !data.years) return null;
    return frequencyFromYears(data.years);
  }, [data]);

  /* 오버레이 x그리드(적합 호출과 공유) */
  const grid = useMemo<number[]>(() => {
    if (!emp) return [];
    const [lo, hi] = emp.range;
    const n = 160;
    return Array.from({ length: n }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / n);
  }, [emp]);

  const kGrid = useMemo<number[]>(() => {
    if (!freqEmp) return [];
    return Array.from({ length: freqEmp.kMax + 3 }, (_, k) => k);
  }, [freqEmp]);

  const eligibility = useMemo(() => {
    if (!data) return new Map<string, { ok: boolean; reason?: string }>();
    return new Map(
      SEV_DISTS.map((d) => [d.id, severityEligibility(d.id, data)])
    );
  }, [data]);

  /* 면책·한도(좌측 절단·우측 검열) 적용 여부·검열 건수 */
  const trunc = useMemo(() => {
    if (!data || !truncationActive(data)) return null;
    const u = data.limit;
    return {
      d: data.deductible ?? 0,
      u,
      censored:
        u !== undefined ? data.values.filter((v) => v >= u).length : 0,
    };
  }, [data]);

  const confirmData = (d: FitData, c: string[][]) => {
    setData(d);
    setCells(c);
    setSheetOpen(false);
    setResults(null);
    setOverlaySev(null);
    setOverlayFreq(null);
    setFitError(null);
  };

  const runFit = async () => {
    if (!data || !emp || phase) return;
    const sevIds = SEV_DISTS.filter(
      (d) => selSev.has(d.id) && eligibility.get(d.id)?.ok
    ).map((d) => d.id);
    const freqIds = freqEmp
      ? FREQ_DISTS.filter((d) => selFreq.has(d.id)).map((d) => d.id)
      : [];
    if (sevIds.length === 0 && freqIds.length === 0) {
      setFitError("적합할 분포를 하나 이상 선택하세요.");
      return;
    }
    setFitError(null);
    setResults(null);
    try {
      const res = await runDistributionFit(
        {
          mode: data.kind === "grouped" ? "grouped" : "individual",
          values: data.kind === "grouped" ? undefined : data.values,
          groups:
            data.kind === "grouped"
              ? {
                  lo: (data.groups ?? []).map((g) => g.lo),
                  hi: (data.groups ?? []).map((g) => g.hi),
                  n: (data.groups ?? []).map((g) => g.count),
                }
              : undefined,
          grid,
          sevDists: sevIds,
          freq: freqEmp
            ? { counts: freqEmp.counts, dists: freqIds, kGrid }
            : null,
          // 면책·한도 — 미적용이면 null(기존 .fit 경로 그대로)
          deductible: trunc && trunc.d > 0 ? trunc.d : null,
          limit: trunc?.u ?? null,
        },
        setPhase
      );
      setResults(res);
      // 기본 오버레이 = AIC 1위
      const bestSev = sortRows(res.severity.filter((r) => r.ok), "aic")[0];
      setOverlaySev(bestSev?.id ?? null);
      const bestFreq = sortRows(res.frequency.filter((r) => r.ok), "aic")[0];
      setOverlayFreq(bestFreq?.id ?? null);
    } catch (e) {
      setFitError(
        `적합 실행 오류: ${e instanceof Error ? e.message : String(e)}`
      );
    } finally {
      setPhase(null);
    }
  };

  /* 차트 시리즈 — empirical + 선택 오버레이 */
  const sevRow = results?.severity.find((r) => r.id === overlaySev && r.ok);
  const freqRow = results?.frequency.find((r) => r.id === overlayFreq && r.ok);

  const pdfSeries = useMemo<Series[]>(() => {
    if (!emp) return [];
    const s: Series[] = [
      {
        variant: "bar",
        color: COLOR_EMP,
        points: emp.bars.map((b) => ({
          x: (b.x0 + b.x1) / 2,
          x0: b.x0,
          x1: b.x1,
          y: b.y,
        })),
      },
    ];
    if (sevRow?.pdfY) {
      s.push({
        variant: "line",
        color: COLOR_FIT,
        points: grid
          .map((x, i) => ({ x, y: sevRow.pdfY![i] }))
          .filter((p): p is { x: number; y: number } => Number.isFinite(p.y as number))
          .map((p) => ({ x: p.x, y: p.y as number })),
      });
    }
    return s;
  }, [emp, sevRow, grid]);

  const cdfSeries = useMemo<Series[]>(() => {
    if (!emp) return [];
    const s: Series[] = [
      { variant: "step", color: COLOR_EMP, points: emp.ecdf },
    ];
    if (sevRow?.cdfY) {
      s.push({
        variant: "line",
        color: COLOR_FIT,
        points: grid
          .map((x, i) => ({ x, y: sevRow.cdfY![i] }))
          .filter((p): p is { x: number; y: number } => Number.isFinite(p.y as number))
          .map((p) => ({ x: p.x, y: p.y as number })),
      });
    }
    return s;
  }, [emp, sevRow, grid]);

  /* 빈도 PMF — 관측은 반투명 막대, 적합은 선+점(생성 파이썬 그림과 같은 표현).
     stem 두 벌이 겹치면 읽기 어렵다는 사용자 피드백으로 변경(2026-07-16). */
  const pmfSeries = useMemo<Series[]>(() => {
    if (!freqEmp) return [];
    const s: Series[] = [
      {
        variant: "bar",
        color: COLOR_EMP,
        points: freqEmp.pmf.map((p) => ({
          x: p.x,
          y: p.y,
          x0: Math.max(0, p.x - 0.38), // 건수는 0 이상 — x축이 음수로 시작하지 않게
          x1: p.x + 0.38,
        })),
      },
    ];
    if (freqRow?.pmfY) {
      s.push({
        variant: "line",
        dots: true,
        color: COLOR_FIT,
        points: kGrid
          .map((k, i) => ({ x: k, y: freqRow.pmfY![i] }))
          .filter((p): p is { x: number; y: number } => Number.isFinite(p.y as number))
          .map((p) => ({ x: p.x, y: p.y as number })),
      });
    }
    return s;
  }, [freqEmp, freqRow, kGrid]);

  /* 코드 팝업 헬퍼 — [모델 적합 | 시뮬레이션] 2탭(분포별 몬테카를로 방법·설명) */
  const openSevCode = (row: FitResultRow) => {
    if (!data || !row.params) return;
    const nm = nameOf(SEV_DISTS, row.id);
    setCodeDialog({
      name: nm,
      en: row.id,
      tabs: [
        { key: "fit", label: "모델 적합", code: severityFitCode(row.id, nm, data) },
        {
          key: "sim",
          label: "시뮬레이션",
          code: severitySimCode(row.id, nm, row.params),
        },
      ],
    });
  };
  const openFreqCode = (row: FitResultRow) => {
    if (!freqEmp || !row.params) return;
    const nm = nameOf(FREQ_DISTS, row.id);
    setCodeDialog({
      name: `${nm} (빈도)`,
      en: row.id,
      tabs: [
        {
          key: "fit",
          label: "모델 적합",
          code: frequencyFitCode(row.id, nm, freqEmp.counts),
        },
        {
          key: "sim",
          label: "시뮬레이션",
          code: frequencySimCode(row.id, nm, row.params),
        },
      ],
    });
  };
  const openMcCode = () => {
    const sev = sevRow ?? sortRows(results?.severity.filter((r) => r.ok) ?? [], "aic")[0];
    if (!sev?.params) return;
    const freq = freqRow?.params ? freqRow : null;
    setCodeDialog({
      name: "몬테카를로 시뮬레이션",
      en: freq ? "compound model" : "severity sampling",
      code: monteCarloCode(
        { id: sev.id, name: nameOf(SEV_DISTS, sev.id), params: sev.params },
        freq?.params
          ? { id: freq.id, name: nameOf(FREQ_DISTS, freq.id), params: freq.params }
          : null,
        // 면책·한도가 있으면 지급액 분포 섹션 추가(기본 표본은 원손해 기준 유지)
        trunc ? { d: trunc.d > 0 ? trunc.d : undefined, u: trunc.u } : null
      ),
    });
  };

  /* 체크박스 그룹 */
  const distPicker = (
    title: string,
    dists: { id: string; name: string }[],
    sel: Set<string>,
    setSel: (s: Set<string>) => void,
    elig?: Map<string, { ok: boolean; reason?: string }>
  ) => (
    <div className="rounded border border-border bg-card px-3.5 py-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] font-semibold text-foreground">
          {title}
        </span>
        <button
          type="button"
          onClick={() =>
            setSel(new Set(dists.filter((d) => elig?.get(d.id)?.ok !== false).map((d) => d.id)))
          }
          className="rounded border border-border px-2 py-0.5 text-[11.5px] text-muted-foreground hover:text-foreground"
        >
          전체 선택
        </button>
        <button
          type="button"
          onClick={() => setSel(new Set())}
          className="rounded border border-border px-2 py-0.5 text-[11.5px] text-muted-foreground hover:text-foreground"
        >
          전체 해제
        </button>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {dists.map((d) => {
          const e = elig?.get(d.id);
          const disabled = e ? !e.ok : false;
          return (
            <label
              key={d.id}
              className={`inline-flex items-center gap-1.5 text-[12.5px] ${
                disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"
              }`}
              title={disabled ? e?.reason : undefined}
            >
              <input
                type="checkbox"
                checked={sel.has(d.id) && !disabled}
                disabled={disabled}
                onChange={(ev) => {
                  const next = new Set(sel);
                  if (ev.target.checked) next.add(d.id);
                  else next.delete(d.id);
                  setSel(next);
                }}
                className="h-3.5 w-3.5 accent-[var(--primary)]"
              />
              <span className="text-foreground">{d.name}</span>
              {disabled ? (
                <span className="text-[11px] text-muted-foreground">({e?.reason})</span>
              ) : null}
            </label>
          );
        })}
      </div>
    </div>
  );

  return (
    <section aria-label="모델 적합" data-testid="fit-lab">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[17px] font-semibold text-foreground">
          모델 적합 — 데이터로 분포 찾기
        </h2>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-[12.5px] text-muted-foreground">
            데이터를 붙여넣으면 empirical 분포를 그리고, scipy(브라우저 파이썬)로
            후보 분포를 적합해 AIC·BIC 등으로 비교합니다
          </p>
          <button
            type="button"
            onClick={() => openFitGuideDialog()}
            data-testid="fit-guide-open"
            title="워크북에 단계별 [설명+코드] 블록을 만들어 노트북 스타일로 진행합니다 (부록 H.3)"
            className="rounded border border-[var(--primary)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--chip-blue-bg)_55%,white)]"
          >
            워크북에서 단계별로 진행
          </button>
        </div>
      </div>

      {/* 데이터 입력 헤더 */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          data-testid="fit-open-sheet"
          className="inline-flex items-center gap-1.5 rounded bg-foreground px-4 py-2 text-[13px] font-medium text-white"
        >
          <Table size={15} /> 데이터 입력
        </button>
        <button
          type="button"
          onClick={importFromSheet}
          title="워크북 그리드에서 선택한 범위(1~3열)를 적합 데이터로 가져옵니다"
          className="rounded border border-border px-3 py-2 text-[12.5px] text-muted-foreground hover:text-foreground"
        >
          시트에서 가져오기
        </button>
        {!data ? (
          <button
            type="button"
            onClick={() => {
              setCells(sampleCells());
              setSheetOpen(true);
            }}
            data-testid="fit-sample"
            className="rounded border border-border px-3 py-2 text-[12.5px] text-muted-foreground hover:text-foreground"
          >
            샘플 데이터로 체험
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--chip-blue-bg)_55%,white)] px-3 py-1 text-[12px] font-medium text-[var(--primary)]">
            {FIT_KIND_LABEL[data.kind]} ·{" "}
            {data.kind === "grouped"
              ? `${data.groups?.length}구간 ${data.groups?.reduce((a, g) => a + g.count, 0).toLocaleString()}건`
              : `${data.values.length.toLocaleString()}건`}
            {trunc
              ? `${trunc.d > 0 ? ` · 면책 ${fmtNum(trunc.d)}` : ""}${
                  trunc.u !== undefined
                    ? ` · 한도 ${fmtNum(trunc.u)}(검열 ${trunc.censored}건)`
                    : ""
                }`
              : ""}
          </span>
        )}
        {data && data.kind !== "grouped" && data.values.length >= 8 ? (
          <button
            type="button"
            onClick={() => setTailOpen(true)}
            title="적합 전에 데이터의 꼬리 두께(대형 손해 위험)를 그림으로 진단"
            className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-2 text-[12.5px] text-muted-foreground hover:text-foreground"
          >
            <Pulse size={14} /> 꼬리 진단
          </button>
        ) : null}
        {data ? (
          <button
            type="button"
            onClick={resetFit}
            title="입력한 데이터·적합 결과를 지우고 처음 상태로 되돌립니다"
            className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-2 text-[12.5px] text-muted-foreground hover:text-foreground"
          >
            <ArrowCounterClockwise size={14} /> 리셋
          </button>
        ) : null}
      </div>

      {!data || !emp ? (
        <div className="rounded-lg border border-dashed border-border bg-card/60 px-6 py-12 text-center">
          <ChartLine size={28} className="mx-auto mb-3 text-muted-foreground" aria-hidden />
          <p className="text-[13.5px] text-foreground">
            아직 데이터가 없습니다 — 위 버튼으로 데이터를 입력하세요.
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
            개별 값 1열, 연도+값 2열(빈도·심도 동시 분석), 최소·최대·건수
            3열(그룹)을 지원합니다. 형식은 자동으로 감지해 확인을 받습니다.
          </p>

          {/* 데이터 없이도 '무엇을 적합할 수 있는지' 먼저 보여준다 */}
          <div className="mx-auto mt-6 max-w-xl space-y-3 text-left">
            <div className="rounded border border-border bg-card px-4 py-3">
              <p className="mb-2 text-[12px] font-semibold text-foreground">
                적합 가능한 연속형(심도) 분포 · {SEV_DISTS.length}종
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SEV_DISTS.map((d) => (
                  <span
                    key={d.id}
                    className="inline-flex items-center rounded-full bg-[color-mix(in_srgb,var(--chip-blue-bg)_55%,white)] px-2.5 py-0.5 text-[11.5px] text-[var(--primary)]"
                  >
                    {d.name}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded border border-border bg-card px-4 py-3">
              <p className="mb-2 text-[12px] font-semibold text-foreground">
                적합 가능한 이산형(빈도) 분포 · {FREQ_DISTS.length}종
              </p>
              <div className="flex flex-wrap gap-1.5">
                {FREQ_DISTS.map((d) => (
                  <span
                    key={d.id}
                    className="inline-flex items-center rounded-full bg-[color-mix(in_srgb,var(--chip-rose-bg)_55%,white)] px-2.5 py-0.5 text-[11.5px] text-[var(--chip-rose-fg)]"
                  >
                    {d.name}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              연속형(심도)은 개별 값(1열)·그룹(3열)·연도+값(2열)에서 적합하고,
              이산형(빈도)은 연도+값(2열) 데이터의 연간 건수 분포로 적합합니다.
              데이터 형식·꼬리 두께에 따라 일부 분포는 자동으로 비활성화됩니다.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* 좌 요약 / 우 empirical */}
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
            <SummaryCard emp={emp} data={data} />
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
                <span className="font-semibold text-foreground">
                  Empirical 분포{data.valueLabel ? ` — ${data.valueLabel}` : ""}
                </span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-[var(--primary)] opacity-40" />
                  empirical
                </span>
                {sevRow ? (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <span className="inline-block h-0.5 w-4 bg-[var(--chip-rose-fg)]" />
                    적합: {nameOf(SEV_DISTS, sevRow.id)}
                    {trunc ? " — 관측 조건부 f(x)/S(d)" : ""}
                  </span>
                ) : null}
                {trunc ? (
                  <span className="text-muted-foreground/80">
                    면책·한도 반영 데이터
                    {trunc.u !== undefined
                      ? " — 한도 위치의 마지막 막대는 검열 뭉치입니다"
                      : ""}
                  </span>
                ) : null}
                <span className="text-muted-foreground/80">
                  그래프를 드래그하면 그 구간만 확대해 볼 수 있습니다
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DistChart
                  series={pdfSeries}
                  title="확률분포 (밀도)"
                  xLabel={data.valueLabel}
                />
                <DistChart
                  series={cdfSeries}
                  title="누적확률분포"
                  yDomain={[0, 1]}
                  xLabel={data.valueLabel}
                />
              </div>
            </div>
          </div>

          {/* 빈도 블록(연도+값) */}
          {freqEmp ? (
            <div className="mb-6 rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
                <span className="font-semibold text-foreground">
                  빈도 — 연도별 사고건수
                </span>
                <span className="text-muted-foreground">
                  {freqEmp.years.length}개 연도 · 연평균 {fmtNum(freqEmp.mean)}건
                  · 분산 {fmtNum(freqEmp.variance)}
                  {freqEmp.variance > freqEmp.mean
                    ? " (분산>평균 — 과산포, 음이항 후보)"
                    : ""}
                  {freqEmp.zeroFilled > 0
                    ? ` · 무사고 연도 ${freqEmp.zeroFilled}개는 0건으로 처리`
                    : ""}
                </span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-[var(--primary)] opacity-40" />
                  관측(연도 비율)
                </span>
                {freqRow ? (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <span className="inline-block h-0.5 w-4 bg-[var(--chip-rose-fg)]" />
                    적합 PMF: {nameOf(FREQ_DISTS, freqRow.id)}
                  </span>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1.4fr]">
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-muted text-muted-foreground">
                        <th className="px-2 py-1 text-left font-medium">연도</th>
                        <th className="px-2 py-1 text-right font-medium">건수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {freqEmp.years.map((r) => (
                        <tr key={r.year} className="border-t border-border">
                          <td className="px-2 py-1 tabular-nums text-foreground">
                            {r.year}
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums text-foreground">
                            {r.count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <DistChart
                  series={pmfSeries}
                  title="연간 건수 분포 P(N=k)"
                  xLabel="연간 건수 k"
                />
              </div>
            </div>
          ) : null}

          {/* 분포 선택 + 적합 실행 */}
          <div className="mb-6 space-y-3">
            {distPicker(
              "적합할 심도(연속형) 분포",
              SEV_DISTS,
              selSev,
              setSelSev,
              eligibility
            )}
            {freqEmp
              ? distPicker("적합할 빈도(이산형) 분포", FREQ_DISTS, selFreq, setSelFreq)
              : null}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={runFit}
                disabled={phase !== null}
                data-testid="fit-run"
                className="inline-flex items-center gap-1.5 rounded bg-[var(--primary)] px-5 py-2 text-[13.5px] font-medium text-white disabled:opacity-50"
              >
                <Play size={15} /> 적합 실행
              </button>
              <PhaseNote phase={phase} />
              {fitError ? (
                <span className="text-[12.5px] text-[var(--chip-rose-fg)]">
                  {fitError}
                </span>
              ) : null}
            </div>
          </div>

          {/* 결과 */}
          {results ? (
            <>
              <ResultsTable
                title="심도 적합 결과"
                testId="fit-results-sev"
                rows={results.severity}
                dists={SEV_DISTS}
                isGrouped={data.kind === "grouped"}
                selectedId={overlaySev}
                onSelect={(id) =>
                  setOverlaySev((cur) => (cur === id ? null : id))
                }
                onQq={(row) => setQqTarget({ row, group: "sev" })}
                onCode={openSevCode}
              />
              {/* 절단·검열 규약은 심도 적합에만 해당 — 빈도 표 위(심도 표 직하)에 둔다 */}
              {trunc ? (
                <p className="-mt-4 mb-6 text-[11.5px] leading-relaxed text-muted-foreground">
                  ※ 위 심도 적합은 면책·한도를 반영해 절단·검열 우도[비검열 log
                  f(x)−log S(d), 검열 log S(u)−log S(d)]로 추정합니다. KS는 조건부
                  CDF F*(x)=
                  {trunc.u !== undefined
                    ? "(F(x)−F(d))/(F(u)−F(d))"
                    : "(F(x)−F(d))/(1−F(d))"}{" "}
                  기준·비검열 관측({data.values.length - trunc.censored}건)만
                  사용하며, 절단·검열 분포에 맞는 A²는 제공되지 않습니다(&lsquo;—&rsquo;).
                </p>
              ) : null}
              {results.frequency.length > 0 ? (
                <ResultsTable
                  title="빈도 적합 결과"
                  testId="fit-results-freq"
                  rows={results.frequency}
                  dists={FREQ_DISTS}
                  isGrouped
                  selectedId={overlayFreq}
                  onSelect={(id) =>
                    setOverlayFreq((cur) => (cur === id ? null : id))
                  }
                  onQq={(row) => setQqTarget({ row, group: "freq" })}
                  onCode={openFreqCode}
                />
              ) : null}

              <p className="mb-5 text-[11.5px] leading-relaxed text-muted-foreground">
                ※ KS·χ² p값은 파라미터를 같은 데이터에서 추정했으므로 근사값입니다
                (실제보다 관대). AIC·BIC는 작을수록, logL은 클수록 좋습니다. A²는
                꼬리 적합에 민감한 Anderson-Darling 통계량입니다.
                {trunc && results.frequency.length > 0
                  ? " 빈도 적합은 연도별 건수를 세는 것이라 면책·한도의 절단·검열 규약과 무관하며, χ²는 그대로 제공됩니다."
                  : ""}
              </p>

              {/* 몬테카를로 */}
              <div className="rounded-lg border border-border bg-[color-mix(in_srgb,var(--chip-blue-bg)_35%,white)] px-4 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-[13.5px] font-semibold text-foreground">
                      몬테카를로 시뮬레이션으로 이어가기
                    </h4>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                      {freqEmp
                        ? "적합된 빈도·심도로 연간 총손해 S=X₁+…+X_N을 시뮬레이션하는 코드(VaR·TVaR 포함) — 선택된 분포가 반영됩니다."
                        : "적합된 심도분포에서 표본을 추출해 분위수를 계산하는 코드 — 선택된 분포가 반영됩니다."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openMcCode}
                    className="inline-flex items-center gap-1.5 rounded border border-border bg-card px-3.5 py-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    <Code size={14} /> 코드 보기
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </>
      )}

      {/* 팝업들 */}
      {sheetOpen ? (
        <DataSheetDialog
          initialCells={cells}
          initialTrunc={
            data ? { deductible: data.deductible, limit: data.limit } : null
          }
          onConfirm={confirmData}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}
      {tailOpen && data && data.kind !== "grouped" ? (
        <TailDiagnosticsDialog
          values={data.values}
          valueLabel={data.valueLabel}
          onClose={() => setTailOpen(false)}
        />
      ) : null}
      {qqTarget?.row.qq ? (
        <QqDialog
          name={nameOf(
            qqTarget.group === "sev" ? SEV_DISTS : FREQ_DISTS,
            qqTarget.row.id
          )}
          params={qqTarget.row.params ?? []}
          qq={qqTarget.row.qq}
          note={
            qqTarget.group === "sev" && trunc
              ? `면책 d=${trunc.d > 0 ? fmtNum(trunc.d) : 0} · 한도 u=${
                  trunc.u !== undefined ? fmtNum(trunc.u) : "∞"
                } 반영 — (d,u) 절단 조건부 분위수, 검열 ${trunc.censored}건 제외`
              : undefined
          }
          onClose={() => setQqTarget(null)}
        />
      ) : null}
      {codeDialog ? (
        <CodeDialog
          name={codeDialog.name}
          en={codeDialog.en}
          code={codeDialog.code}
          tabs={codeDialog.tabs}
          onSent={() => setCodeDialog(null)}
          onClose={() => setCodeDialog(null)}
        />
      ) : null}
    </section>
  );
}
