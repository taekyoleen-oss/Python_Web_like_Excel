"use client";

/**
 * QQ-plot — 45° 기준선 산점도 차트와 두 팝업.
 * 소스: Actuarial_Platform QqDialog.tsx + DistQqDialog.tsx (shadcn Dialog로 교체).
 *  - QqChart   : 모델 적합(데이터 vs 적합)과 확률분포 탭(분포 vs 분포) 공용 차트
 *  - QqDialog  : 모델 적합 결과 행의 QQ 팝업(이론 vs 경험 분위수)
 *  - DistQqDialog : 분포 탭의 이론 QQ 팝업(정규 기준 또는 A vs B)
 */
import { useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { fmtNum } from "@/lib/reference/fitData";
import type { FitParamOut } from "@/lib/reference/pyFit";
import { fmtTick } from "@/components/reference/DistChart";

const S = 340; // 정사각 viewBox
const PAD = 40;

/** 45° 기준선 QQ 산점도 */
export function QqChart({
  theo,
  samp,
  xLabel = "이론 분위수 (fitted)",
  yLabel = "경험 분위수 (data)",
}: {
  theo: number[];
  samp: number[];
  xLabel?: string;
  yLabel?: string;
}) {
  const g = useMemo(() => {
    const all = [...theo, ...samp].filter((v) => Number.isFinite(v));
    if (all.length === 0) return null;
    let lo = Math.min(...all);
    let hi = Math.max(...all);
    const pad = (hi - lo || 1) * 0.05;
    lo -= pad;
    hi += pad;
    const span = hi - lo || 1;
    const sc = (v: number) => PAD + ((v - lo) / span) * (S - PAD - 14);
    return { lo, hi, sc };
  }, [theo, samp]);

  if (!g) return null;
  const { lo, hi, sc } = g;
  // y는 위가 큰 값 — 화면 좌표 반전
  const sy = (v: number) => S - 26 - (sc(v) - PAD);

  const ticks = [lo, (lo + hi) / 2, hi];

  return (
    <svg
      viewBox={`0 0 ${S} ${S}`}
      width="100%"
      role="img"
      aria-label="QQ-plot"
      className="mx-auto block max-w-[420px]"
    >
      {/* 축 */}
      <line x1={PAD} y1={S - 26} x2={S - 14} y2={S - 26} stroke="var(--border)" strokeWidth={0.8} />
      <line x1={PAD} y1={14} x2={PAD} y2={S - 26} stroke="var(--border)" strokeWidth={0.8} />
      {/* 45° 기준선 */}
      <line
        x1={sc(lo)}
        y1={sy(lo)}
        x2={sc(hi)}
        y2={sy(hi)}
        stroke="var(--chip-slate-fg)"
        strokeWidth={1}
        strokeDasharray="5 4"
      />
      {/* 점 */}
      {theo.map((t, i) => (
        <circle key={i} cx={sc(t)} cy={sy(samp[i])} r={2.6} fill="var(--primary)" fillOpacity={0.75} />
      ))}
      {/* 눈금 */}
      {ticks.map((t, i) => (
        <g key={i}>
          <text
            x={sc(t)}
            y={S - 10}
            textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
            fill="var(--muted-foreground)"
            style={{ fontSize: 9.5 }}
          >
            {fmtTick(t)}
          </text>
          <text
            x={PAD - 5}
            y={sy(t) + 3}
            textAnchor="end"
            fill="var(--muted-foreground)"
            style={{ fontSize: 9.5 }}
          >
            {fmtTick(t)}
          </text>
        </g>
      ))}
      {/* 축 라벨 */}
      <text
        x={(PAD + S - 14) / 2}
        y={S - 0.5}
        textAnchor="middle"
        fill="var(--muted-foreground)"
        style={{ fontSize: 10 }}
      >
        {xLabel}
      </text>
      <text
        x={10}
        y={(14 + S - 26) / 2}
        textAnchor="middle"
        transform={`rotate(-90 10 ${(14 + S - 26) / 2})`}
        fill="var(--muted-foreground)"
        style={{ fontSize: 10 }}
      >
        {yLabel}
      </text>
    </svg>
  );
}

/** 모델 적합 결과 행의 QQ 팝업 */
export function QqDialog({
  name,
  params,
  qq,
  note,
  onClose,
}: {
  name: string;
  params: FitParamOut[];
  qq: { theo: number[]; samp: number[] };
  /** 추가 캡션 — 예: 면책·한도 반영 조건부 분위수·검열 n건 제외 */
  note?: string;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        data-testid="qq-dialog"
      >
        <header className="border-b px-5 py-4 pr-12">
          <DialogTitle className="font-sans text-[16px] font-semibold text-foreground">
            QQ-plot — {name}
          </DialogTitle>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {params.map((q) => `${q.name}=${fmtNum(q.value)}`).join(" · ")}
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <QqChart theo={qq.theo} samp={qq.samp} />
          {note ? (
            <p className="mt-2 text-[12px] font-medium leading-relaxed text-[var(--chip-amber-fg)]">
              {note}
            </p>
          ) : null}
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
            점이 점선(45°)에 가까울수록 적합이 좋습니다. 오른쪽 위(큰 손해 구간)에서 점이 선
            위로 벗어나면 실제 꼬리가 모형보다 두껍다는 신호입니다.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** 분포 탭 — 이론 QQ 팝업(단일: 모멘트 정합 정규 기준, 비교: A vs B 분위수) */
export function DistQqDialog({
  title,
  subtitle,
  theo,
  samp,
  xLabel,
  yLabel,
  notes,
  onClose,
}: {
  title: string;
  subtitle: string;
  theo: number[];
  samp: number[];
  xLabel: string;
  yLabel: string;
  /** 해석 안내(불릿) */
  notes: string[];
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        data-testid="dist-qq-dialog"
      >
        <header className="border-b px-5 py-4 pr-12">
          <DialogTitle className="font-sans text-[16px] font-semibold text-foreground">
            {title}
          </DialogTitle>
          <p className="mt-1 text-[12.5px] text-muted-foreground">{subtitle}</p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {theo.length > 1 ? (
            <QqChart theo={theo} samp={samp} xLabel={xLabel} yLabel={yLabel} />
          ) : (
            <p className="py-10 text-center text-[12.5px] text-muted-foreground">
              분위수를 계산할 수 없습니다.
            </p>
          )}
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] leading-relaxed text-muted-foreground">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
