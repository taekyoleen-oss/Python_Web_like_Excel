"use client";

/**
 * 분포 탭 — 참조 뷰 "분포" (부록 E R4). 소스: Actuarial_Platform DistributionLab.tsx.
 * 연속형/이산형 두 그룹(접기) 아래에 분포를 상단 버튼 행으로 선택한다.
 * 버튼을 누르면 그 분포 하나만 표시(DistCard). 그룹 자체는 접기/펼치기 가능(초기 펼침).
 */
import { useState } from "react";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import {
  CONTINUOUS_DISTS,
  DISCRETE_DISTS,
  type Distribution,
} from "@/lib/reference/distributions";
import { DistCard } from "@/components/reference/DistCard";

/** 버튼 라벨 — '분포' 접미사를 떼어 짧게(정규분포→정규, 파레토분포 (2모수)→파레토 (2모수)). */
function btnLabel(name: string): string {
  return name.replace("분포", "").trim();
}

function DistGroup({
  title,
  subtitle,
  color,
  dists,
  defaultOpen = true,
}: {
  title: string;
  subtitle: string;
  color: string;
  dists: Distribution[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [selectedId, setSelectedId] = useState(dists[0].id);
  const selected = dists.find((d) => d.id === selectedId) ?? dists[0];

  return (
    <section className="mb-6">
      {/* 그룹 헤더 — 접기/펼치기 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-lg px-4 py-3 text-left"
        style={{
          background: `color-mix(in srgb, var(--chip-${color}-bg) 55%, white)`,
        }}
      >
        <span className="text-muted-foreground" aria-hidden>
          {open ? <CaretDown size={20} /> : <CaretRight size={20} />}
        </span>
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: `var(--chip-${color}-fg)` }}
          aria-hidden
        />
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[16px] font-semibold text-foreground">{title}</span>
          <span className="text-[12.5px] text-muted-foreground">{subtitle}</span>
        </span>
        <span className="ml-auto text-[12px] tabular-nums text-muted-foreground">
          {dists.length}종
        </span>
      </button>

      {open ? (
        <div className="mt-3">
          {/* 분포 선택 버튼 행 */}
          <div role="tablist" aria-label={`${title} 선택`} className="mb-4 flex flex-wrap gap-2">
            {dists.map((d) => {
              const active = d.id === selectedId;
              return (
                <button
                  key={d.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedId(d.id)}
                  className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                    active
                      ? ""
                      : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                  }`}
                  style={
                    active
                      ? {
                          background: `var(--chip-${color}-fg)`,
                          color: "white",
                          borderColor: `var(--chip-${color}-fg)`,
                        }
                      : undefined
                  }
                >
                  {btnLabel(d.name)}
                </button>
              );
            })}
          </div>

          {/* 선택된 분포 — id 변경 시 remount로 파라미터 초기화 */}
          <DistCard key={selected.id} dist={selected} />
        </div>
      ) : null}
    </section>
  );
}

export default function DistributionsTab() {
  return (
    <section aria-label="확률분포" data-testid="dist-lab">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[17px] font-semibold text-foreground">
          확률분포 — PDF·CDF 그래프와 통계량
        </h2>
        <p className="text-[12.5px] text-muted-foreground">
          상단 버튼으로 분포를 고르면 그래프·수식·통계량이 바뀝니다 · 파라미터를 바꾸면 모양이
          실시간으로 변하고, 그래프에는 평균·중위수가 표시됩니다 · 통계량 아래{" "}
          <b>위험 측도(VaR·TVaR)</b>로 꼬리 위험을 읽고 · 각 분포의 보험 용례(심도·빈도·손해율)를
          배지로 확인하세요 · &lsquo;비교&rsquo;를 켜면 두 분포를 겹쳐 볼 수 있습니다 · 그래프를
          드래그하면 그 구간만 확대됩니다
        </p>
      </div>

      <DistGroup
        title="연속형 분포"
        subtitle="정규 · 로그정규 · 지수 · 와이블 · 감마 · 베타 · 파레토"
        color="blue"
        dists={CONTINUOUS_DISTS}
      />
      <DistGroup
        title="이산형 분포"
        subtitle="이항 · 포아송 · 음이항"
        color="violet"
        dists={DISCRETE_DISTS}
      />
    </section>
  );
}
