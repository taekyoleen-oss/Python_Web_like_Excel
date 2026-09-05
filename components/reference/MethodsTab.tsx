"use client";

/**
 * 통계·ML·계리 파이썬 사전 — 참조 뷰 "파이썬코드" 탭 (부록 E R3).
 * 소스: Actuarial_Platform MethodCloud.tsx.
 * PC(md+): 사분면 2차원 그래프(4개 카테고리, 가로축=빈도, 세로축=난이도).
 * 데이터 핸들링(wrangle)·그래프는 아래 접이식 패널. 모바일: 5개 카테고리 클러스터.
 * 클릭 시 다이얼로그 5탭: 정의 및 방법(KaTeX) / 파이썬 코드 적용(수준·트랙) /
 * 엑셀 코드 적용 / 파라미터·옵션 / 데이터 레이아웃.
 * 이 앱에서 바뀐 것: '실행기로 보내기' → '블록으로 보내기'(마크다운 제목 + 섹션별 코드 블록),
 * Supabase override 레이어·pin/PiP 다이얼로그 제거.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { CaretDown } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  STAT_CATEGORIES,
  STAT_METHODS,
  splitCodeCells,
  cellsToScript,
  type MethodCategory,
  type MethodChipColor,
  type MethodCodeSection,
  type StatMethod,
} from "@/lib/reference/statMethods";
import { TRACK_META, showTracks, withTracks, type MethodTrack } from "@/lib/reference/methodTracks";
import { METHOD_THEORY } from "@/lib/reference/methodTheory";
import { METHOD_OPTION_DOCS } from "@/lib/reference/methodOptionDocs";
import {
  DATA_LAYOUTS,
  genericLayout,
  ROLE_META,
  type DataLayout,
} from "@/lib/reference/dataLayouts";
import {
  METHOD_EXCEL_CODE,
  PIE_GENERAL_NOTE,
  PACKAGE_STATUS_META,
  noteToBullets,
  toExcelPython,
} from "@/lib/reference/methodExcelCode";
import {
  WRANGLE_SNIPPET_GROUPS,
  snippetInsertCode,
  type WrangleSnippet,
} from "@/lib/reference/wrangleSnippets";
import { PLOT_SNIPPET_GROUPS, plotInsertCode, type PlotSnippet } from "@/lib/reference/plotSnippets";
import {
  CodeBlock,
  CopyButton,
  FontScaleControl,
  Prose,
} from "@/components/reference/code-popup";
import { FunctionSearch, type SearchItem } from "@/components/reference/FunctionSearch";
import { PlotSnippetPreview } from "@/components/reference/PlotSampleSvg";
import { Tex } from "@/components/reference/Tex";
import { CodeDialog } from "@/components/reference/CodeDialog";
import { sendToWorkbook, type SendSection } from "@/lib/grid/import-blocks";

/** 사분면에 배치되는 카테고리 — wrangle은 아래 접이식 패널로 분리 */
const QUAD_CATEGORIES: MethodCategory[] = STAT_CATEGORIES.filter((c) => c.id !== "wrangle");
const WRANGLE_CATEGORY = STAT_CATEGORIES.find((c) => c.id === "wrangle")!;

/* 빈도(1~5) → 글자 크기·굵기 — 클수록 실무에서 자주 쓰는 방법 */
const SIZE: Record<number, { fs: number; fw: number }> = {
  1: { fs: 13, fw: 500 },
  2: { fs: 14.5, fw: 500 },
  3: { fs: 17, fw: 500 },
  4: { fs: 20.5, fw: 600 },
  5: { fs: 25, fw: 600 },
};

/* 웹 런타임 미지원 표시 — 실행 불가(none)는 회색, 일부만(partial)은 점선 밑줄 */
const WEB_NONE_COLOR = "#9a9ca1";
function webTermStyle(
  m: StatMethod,
  catColor: MethodChipColor,
): { color: string; borderBottom?: string } {
  const support = m.webSupport ?? "full";
  return {
    color: support === "none" ? WEB_NONE_COLOR : `var(--chip-${catColor}-fg)`,
    borderBottom: support === "partial" ? "1.5px dashed currentColor" : undefined,
  };
}
const WEB_LIMITED = STAT_METHODS.filter((m) => (m.webSupport ?? "full") !== "full");

/* SSR 안전 결정적 해시 — 모바일 클러스터에서 크기가 섞여 보이게 */
function hashOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/* ───────────────── 다이얼로그 (5탭) ───────────────── */

type DialogTab = "theory" | "code" | "excel" | "options" | "layout";
type LevelFilter = "all" | "basic" | "advanced";
type SectionLevel = "basic" | "advanced";

/** 섹션 수준 — 미지정은 기본으로 취급 */
const levelOf = (s: MethodCodeSection): SectionLevel => s.level ?? "basic";

/** 수준 칩 색 — 카테고리 고정색과 겹치지 않는 저채도 2색 */
const LEVEL_META: Record<SectionLevel, { label: string; chip: "slate" | "cyan" }> = {
  basic: { label: "기본", chip: "slate" },
  advanced: { label: "고급", chip: "cyan" },
};

const LEVEL_FILTERS: { key: LevelFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "basic", label: "기본" },
  { key: "advanced", label: "고급" },
];

function LevelChip({ level, fontSize }: { level: SectionLevel; fontSize: number }) {
  const { label, chip } = LEVEL_META[level];
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 font-medium"
      style={{
        fontSize,
        background: `var(--chip-${chip}-bg)`,
        color: `var(--chip-${chip}-fg)`,
      }}
      title={
        level === "basic"
          ? "기본 — 하이퍼파라미터·변수를 지정해 바로 결과를 산출하는 첫 실행 경로"
          : "고급 — 최적화·튜닝·교차검증·진단·시뮬레이션"
      }
    >
      {label}
    </span>
  );
}

/**
 * [데이터 레이아웃] 탭 — 실제 적용에 필요한 열 구성을 표로 안내.
 * 개별 레이아웃이 없으면 카테고리 일반 안내로 폴백.
 */
function DataLayoutPanel({
  method,
  fz,
}: {
  method: StatMethod;
  fz: (px: number) => { fontSize: number };
}) {
  const layout: DataLayout = DATA_LAYOUTS[method.id] ?? genericLayout(method.category);
  return (
    <div>
      <div
        className="rounded px-4 py-3 text-foreground/80"
        style={{
          ...fz(13.5),
          background: "color-mix(in srgb, var(--chip-blue-bg) 45%, white)",
        }}
      >
        <p className="mb-1 font-semibold text-foreground" style={fz(13.5)}>
          실제 적용에 필요한 데이터 형태
        </p>
        <Prose text={layout.intro} fz={fz(13.5).fontSize} className="text-foreground/80" />
      </div>

      {layout.columns.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b text-muted-foreground" style={fz(12)}>
                <th className="py-2 pr-3 font-medium">열 이름</th>
                <th className="py-2 pr-3 font-medium">역할</th>
                <th className="py-2 pr-3 font-medium">자료형</th>
                <th className="py-2 pr-3 font-medium">예시</th>
                <th className="py-2 font-medium">설명</th>
              </tr>
            </thead>
            <tbody>
              {layout.columns.map((c) => {
                const rm = ROLE_META[c.role];
                return (
                  <tr key={c.name} className="border-b align-top">
                    <td className="py-2 pr-3">
                      <code className="font-mono font-medium text-foreground" style={fz(12.5)}>
                        {c.name}
                      </code>
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className="inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          background: `var(--chip-${rm.color}-bg)`,
                          color: `var(--chip-${rm.color}-fg)`,
                        }}
                      >
                        {rm.label}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-foreground/80" style={fz(12.5)}>
                      {c.type}
                    </td>
                    <td className="py-2 pr-3" style={fz(12.5)}>
                      <code className="font-mono text-muted-foreground">{c.example}</code>
                    </td>
                    <td className="py-2 leading-relaxed text-foreground/80" style={fz(12.5)}>
                      {c.desc}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {layout.notes ? (
        <div className="mt-4 rounded bg-muted px-4 py-3">
          <Prose text={layout.notes} fz={fz(13).fontSize} className="text-foreground/80" />
        </div>
      ) : null}

      <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
        열 이름은 예시입니다 — 실제 데이터의 열 이름에 맞춰 &lsquo;파이썬 코드 적용&rsquo; 탭
        코드의 열 이름을 바꿔 쓰세요.
      </p>
    </div>
  );
}

/** 스티키 머리 높이(px) — 트랙 머리 아래에 섹션 머리가 붙도록 top 값을 맞춘다 */
const TRACK_H = 34;

/** 트랙 머리 — '공통 적용 / 전통적 분석 / 머신러닝'. 스크롤해도 상단에 고정된다. */
function TrackHeader({ track, fontScale }: { track: MethodTrack; fontScale: number }) {
  const meta = TRACK_META[track];
  return (
    <div
      className="sticky top-0 z-30 -mx-5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b bg-popover px-5 py-1.5 sm:-mx-6 sm:px-6"
      style={{ minHeight: TRACK_H }}
    >
      <span
        className="rounded-full px-2 py-0.5 font-semibold"
        style={{
          fontSize: Math.round(12 * fontScale * 10) / 10,
          background: `var(--chip-${meta.color}-bg)`,
          color: `var(--chip-${meta.color}-fg)`,
        }}
      >
        {meta.label}
      </span>
      <span
        className="text-muted-foreground"
        style={{ fontSize: Math.round(11.5 * fontScale * 10) / 10 }}
      >
        {meta.hint}
      </span>
    </div>
  );
}

/** 트랙별 묶음 — 각 묶음을 자체 컨테이너로 감싸야 스티키 머리가 서로 겹치지 않는다 */
function trackGroups<T extends { code: string; track?: MethodTrack }>(
  sections: T[],
): { track: MethodTrack; items: { section: T; index: number }[] }[] {
  const out: { track: MethodTrack; items: { section: T; index: number }[] }[] = [];
  withTracks(sections).forEach(({ section, track }, index) => {
    const last = out[out.length - 1];
    if (last && last.track === track) last.items.push({ section, index });
    else out.push({ track, items: [{ section, index }] });
  });
  return out;
}

/** 섹션 제목 줄 — 트랙 머리 바로 아래에 고정 */
function StickyTitle({ children, hasTrack }: { children: ReactNode; hasTrack: boolean }) {
  return (
    <div
      className="sticky z-20 -mx-5 flex flex-wrap items-center gap-2 border-b bg-popover px-5 py-1.5 sm:-mx-6 sm:px-6"
      style={{ top: hasTrack ? TRACK_H : 0 }}
    >
      {children}
    </div>
  );
}

/**
 * 코드를 단계별 셀 블록으로 — 데이터 로드·적합·평가 등을 나눠 각각 복사하기 좋게 한다.
 * 단일 블록이면 한 덩어리 그대로. 파이썬 탭·엑셀 탭 공용.
 */
function StepBlocks({
  code,
  fontScale,
  cellWord,
  note,
}: {
  code: string;
  fontScale: number;
  /** 셀 라벨 단어 — 파이썬="셀", 엑셀="엑셀 셀" */
  cellWord: string;
  note?: ReactNode;
}) {
  const steps = splitCodeCells(code);
  if (steps.length <= 1) {
    return <CodeBlock code={code.trim()} codeFz={13.5 * fontScale} />;
  }
  return (
    <div className="mt-2 space-y-2.5">
      {note ? <p className="text-[11.5px] leading-relaxed text-muted-foreground">{note}</p> : null}
      {steps.map((st, k) => (
        <div key={k}>
          <div className="mb-1 flex items-center gap-2 text-[11.5px] font-medium text-muted-foreground">
            <span className="rounded-full bg-muted px-2 py-0.5">{k + 1}단계</span>
            <span>
              {cellWord} {k + 1}
            </span>
          </div>
          <CodeBlock code={st} codeFz={13.5 * fontScale} />
        </div>
      ))}
    </div>
  );
}

const PY_STEP_NOTE = (
  <>
    단계(셀)마다 나눠 워크북의 <strong>Python 블록</strong>으로 실행·수정·건너뛰기 할 수
    있습니다(변수는 블록 간 유지 — 앞 블록 결과를 다음 블록에서 이어 씀). 오른쪽 위{" "}
    <strong>블록으로 보내기</strong>가 섹션별 블록을 만들어 줍니다.
  </>
);

const EXCEL_STEP_NOTE = (
  <>
    단계마다 엑셀의 <strong>다른 셀</strong>에 <code className="font-mono">=PY(</code>로 나눠
    넣으세요. Python in Excel은 셀을 <strong>행 우선 순서</strong>로 실행하며{" "}
    <strong>변수가 유지</strong>되어, 앞 단계 변수를 다음 셀에서 그대로 이어 쓸 수 있습니다(시트
    값은 <code className="font-mono">xl()</code>로 참조).
  </>
);

function ExcelCodePanel({
  method,
  fz,
  fontScale,
}: {
  method: StatMethod;
  fz: (px: number) => { fontSize: number };
  fontScale: number;
}) {
  const data = METHOD_EXCEL_CODE[method.id];
  const tracked = !!data && showTracks(data.sections);
  return (
    <div>
      {/* 공통 차이점 안내 — 코드 위(글머리) */}
      <div
        className="rounded px-4 py-3 text-foreground/80"
        style={{
          ...fz(13),
          background: "color-mix(in srgb, var(--chip-cyan-bg) 55%, white)",
        }}
      >
        <span className="font-semibold text-foreground">엑셀의 Python(=PY())에서 쓰는 법</span>
        <ul className="mt-1.5 list-disc space-y-1 pl-4 leading-[1.7] marker:text-muted-foreground">
          {PIE_GENERAL_NOTE.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </div>

      {data ? (
        <>
          {/* 이 방법의 패키지 상태 + 차이점 */}
          <div className="mt-4 flex flex-wrap items-start gap-2">
            <span
              className="mt-0.5 inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{
                background: `var(--chip-${PACKAGE_STATUS_META[data.packageStatus].color}-bg)`,
                color: `var(--chip-${PACKAGE_STATUS_META[data.packageStatus].color}-fg)`,
              }}
            >
              {PACKAGE_STATUS_META[data.packageStatus].label}
            </span>
            <ul
              className="min-w-[12rem] flex-1 list-disc space-y-1 pl-4 leading-[1.7] text-foreground/80 marker:text-muted-foreground"
              style={fz(13.5)}
            >
              {noteToBullets(data.note).map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>

          {/* 적응 코드 섹션 — 트랙(공통/전통/ML)별로 묶고 머리는 상단 고정 */}
          {trackGroups(data.sections).map((g) => (
            <div key={g.track} className="mt-7 first:mt-0">
              {tracked ? <TrackHeader track={g.track} fontScale={fontScale} /> : null}
              {g.items.map(({ section: s, index: i }) => (
                <div key={`${s.title}-${i}`} className="mt-4">
                  <StickyTitle hasTrack={tracked}>
                    <h3 className="font-semibold text-foreground" style={fz(15)}>
                      {data.sections.length > 1 ? `${i + 1}. ` : ""}
                      {s.title}
                    </h3>
                    <LevelChip level={s.level} fontSize={Math.round(11 * fontScale * 10) / 10} />
                    <span
                      className="inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground"
                      title={
                        s.sameAsOriginal
                          ? "데이터 로드 줄 정도만 다르고 로직은 '파이썬 코드 적용' 탭과 사실상 동일"
                          : "Python in Excel 환경에 맞게 로직·API가 바뀜"
                      }
                    >
                      {s.sameAsOriginal ? "원본과 거의 동일" : "변경됨"}
                    </span>
                  </StickyTitle>
                  <StepBlocks
                    code={toExcelPython(s.code).trim()}
                    fontScale={fontScale}
                    cellWord="엑셀 셀"
                    note={i === 0 ? EXCEL_STEP_NOTE : undefined}
                  />
                </div>
              ))}
            </div>
          ))}
        </>
      ) : (
        <p
          className="mt-4 rounded bg-muted px-4 py-3 leading-relaxed text-muted-foreground"
          style={fz(12.5)}
        >
          이 방법의 <strong>Python in Excel</strong> 적용 코드는 준비 중입니다. 위 공통
          차이점(데이터는 <code>xl()</code> · print는 진단창 · Anaconda 패키지)을{" "}
          <strong>파이썬 코드 적용</strong> 탭의 코드에 적용해 사용하세요.
        </p>
      )}
    </div>
  );
}

/** [파라미터·옵션] 탭 — 파이썬·엑셀(=PY()) 공통의 함수 인자 심화 해설 */
function OptionsPanel({
  method,
  color,
  fz,
}: {
  method: StatMethod;
  color: MethodChipColor;
  fz: (px: number) => { fontSize: number };
}) {
  const groups = METHOD_OPTION_DOCS[method.id] ?? [];
  return (
    <div>
      <p
        className="rounded px-4 py-2.5 text-foreground/80"
        style={{
          ...fz(13),
          background: "color-mix(in srgb, var(--chip-cyan-bg) 55%, white)",
        }}
      >
        여기 설명은 <strong>파이썬 코드 적용</strong>과 <strong>엑셀 코드 적용</strong>(=PY())
        어느 쪽에든 공통으로 적용됩니다.
      </p>

      {method.params.length > 0 ? (
        <div className="mt-5">
          <h3 className="font-semibold text-foreground" style={fz(15)}>
            주요 파라미터 요약
          </h3>
          <dl className="mt-2 divide-y divide-border rounded border">
            {method.params.map((p) => (
              <div key={p.name} className="px-3.5 py-2.5">
                <dt>
                  <code
                    className="font-mono font-medium"
                    style={{ ...fz(13), color: `var(--chip-${color}-fg)` }}
                  >
                    {p.name}
                  </code>
                </dt>
                <dd className="mt-0.5 leading-[1.75] text-foreground/80" style={fz(13.5)}>
                  {p.desc}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {groups.map((g) => (
        <div key={g.func} className="mt-6">
          <h3 className="font-semibold text-foreground" style={fz(15)}>
            {g.func}
          </h3>
          {g.intro ? (
            <p className="mt-1 leading-[1.8] text-muted-foreground" style={fz(13.5)}>
              {g.intro}
            </p>
          ) : null}
          <dl className="mt-2 divide-y divide-border rounded border">
            {g.options.map((o) => (
              <div key={o.name} className="px-3.5 py-2.5">
                <dt className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <code
                    className="font-mono font-semibold"
                    style={{ ...fz(13), color: `var(--chip-${color}-fg)` }}
                  >
                    {o.name}
                  </code>
                  {o.values ? (
                    <span className="text-muted-foreground" style={fz(12.5)}>
                      {o.values}
                    </span>
                  ) : null}
                </dt>
                <dd className="mt-0.5 leading-[1.75] text-foreground/80" style={fz(13.5)}>
                  {o.desc}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}

      {groups.length === 0 ? (
        <p
          className="mt-5 rounded bg-muted px-4 py-3 leading-relaxed text-muted-foreground"
          style={fz(13)}
        >
          이 방법의 심화 옵션 해설은 준비 중입니다. 위 <strong>주요 파라미터 요약</strong>과 코드
          탭의 주석을 참고하세요.
        </p>
      ) : null}
    </div>
  );
}

/** [정의 및 방법] 탭 — 이론 레지스트리(METHOD_THEORY)가 있으면 구조화, 없으면 intro+tips 폴백 */
function TheoryPanel({
  method,
  fz,
  fontScale,
}: {
  method: StatMethod;
  fz: (px: number) => { fontSize: number };
  fontScale: number;
}) {
  const theory = METHOD_THEORY[method.id];

  const Block = ({ title, children }: { title: string; children: ReactNode }) => (
    <div className="mt-6 first:mt-0">
      <h3 className="font-semibold text-foreground" style={fz(15)}>
        {title}
      </h3>
      {children}
    </div>
  );

  if (!theory) {
    // 폴백 — 이론 미수록 항목은 기존 개념 설명·해석 포인트를 같은 레이아웃으로
    return (
      <div>
        <Block title="정의 및 개념">
          <Prose text={method.intro} fz={fz(14.5).fontSize} className="mt-2 text-foreground/80" />
        </Block>
        {method.tips ? (
          <Block title="해석·의미">
            <Prose text={method.tips} fz={fz(14).fontSize} className="mt-2 text-foreground/80" />
          </Block>
        ) : null}
        <p
          className="mt-6 rounded bg-muted px-4 py-2.5 leading-relaxed text-muted-foreground"
          style={fz(12.5)}
        >
          이 방법의 산출식·활용 해설은 준비 중입니다. 실행 가능한 코드는{" "}
          <strong>파이썬 코드 적용</strong> 탭에서 확인하세요.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Block title="정의 및 개념">
        <Prose text={theory.definition} fz={fz(14.5).fontSize} className="mt-2 text-foreground/80" />
      </Block>

      {theory.formulas.length > 0 ? (
        <Block title="산출식">
          <div className="mt-2 divide-y divide-border rounded border">
            {theory.formulas.map((f) => (
              <div key={f.label} className="px-3.5 py-3">
                <p className="font-medium text-foreground" style={fz(13)}>
                  {f.label}
                </p>
                <div
                  className="mt-1.5 overflow-x-auto py-0.5"
                  style={{ fontSize: Math.round(15 * fontScale * 10) / 10 }}
                >
                  <Tex expr={f.tex} block />
                </div>
                {f.note ? (
                  <p className="mt-1 leading-[1.75] text-muted-foreground" style={fz(13)}>
                    {f.note}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </Block>
      ) : null}

      <Block title="활용 방법">
        <Prose text={theory.usage} fz={fz(14).fontSize} className="mt-2 text-foreground/80" />
      </Block>

      <Block title="해석·의미">
        <Prose
          text={theory.interpretation}
          fz={fz(14).fontSize}
          className="mt-2 text-foreground/80"
        />
      </Block>
    </div>
  );
}

function MethodDialog({
  method,
  color,
  categoryLabel,
  fontScale,
  onFontScale,
  onSendToWorkbook,
  onClose,
}: {
  method: StatMethod;
  color: MethodChipColor;
  categoryLabel: string;
  fontScale: number;
  onFontScale: Dispatch<SetStateAction<number>>;
  /** 현재 수준 필터에 보이는 섹션들을 블록으로 — 화면과 범위가 어긋나지 않게 */
  onSendToWorkbook: (m: StatMethod, sections: SendSection[], level: LevelFilter) => void;
  onClose: () => void;
}) {
  // 기본 탭 = 정의 및 방법(개념을 먼저 이해하고 코드로)
  const [tab, setTab] = useState<DialogTab>("theory");
  const [level, setLevel] = useState<LevelFilter>("all");

  // 글자 확대/축소 — 본문·코드·파라미터에 적용
  const fz = (px: number) => ({ fontSize: Math.round(px * fontScale * 10) / 10 });

  // 수준 필터에 보이는 섹션만 — 전체 복사·블록 보내기도 이 기준
  const visibleSections = useMemo(
    () => method.sections.filter((s) => level === "all" || levelOf(s) === level),
    [method, level],
  );
  // 트랙(공통/전통적 분석/머신러닝) 머리 표시 여부
  const tracked = useMemo(() => showTracks(method.sections), [method]);
  // 전체 복사 — 섹션 제목 주석 + 셀(# %%) 구분(소스 methodFullCode 규칙과 동일)
  const allCode = useMemo(
    () =>
      visibleSections
        .map((s) => `# ── ${s.title} ──\n${cellsToScript(splitCodeCells(s.code.trim()))}`)
        .join("\n\n# %%\n"),
    [visibleSections],
  );
  const hasAdvanced = method.sections.some((s) => levelOf(s) === "advanced");
  const scopeSuffix = level === "all" ? "" : ` (${LEVEL_META[level].label})`;
  // [엑셀 코드 적용] 탭 복사 — 데이터 없으면 파이썬 코드를 엑셀용으로 변환해 대체
  const allExcelCode = useMemo(() => {
    const data = METHOD_EXCEL_CODE[method.id];
    if (!data) return toExcelPython(allCode);
    return data.sections
      .map(
        (s) =>
          `# ── ${s.title} ──\n${cellsToScript(splitCodeCells(toExcelPython(s.code).trim()))}`,
      )
      .join("\n\n# %%\n");
  }, [method.id, allCode]);

  const sendVisible = () =>
    onSendToWorkbook(
      method,
      visibleSections.map((s) => ({ title: s.title, code: s.code.trim() })),
      level,
    );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="flex max-h-[84vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[880px]"
        data-testid="method-dialog"
      >
        <header className="border-b px-5 py-4 pr-12 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-medium"
                  style={{
                    background: `var(--chip-${color}-bg)`,
                    color: `var(--chip-${color}-fg)`,
                  }}
                >
                  {categoryLabel}
                </span>
                <DialogTitle className="font-sans text-[19px] font-semibold text-foreground">
                  {method.name}
                </DialogTitle>
                <span className="text-[13.5px] text-muted-foreground">{method.en}</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              <FontScaleControl fontScale={fontScale} onFontScale={onFontScale} />
              {/* 코드 복사는 [파이썬]·[엑셀] 탭 공용, 블록 보내기는 파이썬 탭 전용 */}
              {tab === "code" || tab === "excel" ? (
                <CopyButton
                  text={tab === "excel" ? allExcelCode : allCode}
                  label={tab === "excel" ? "전체 코드 복사" : `전체 코드 복사${scopeSuffix}`}
                />
              ) : null}
              {tab === "code" && method.category !== "wrangle" ? (
                <button
                  type="button"
                  onClick={sendVisible}
                  data-testid="send-to-workbook"
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded border bg-card px-2 py-1 text-[11.5px] font-medium text-primary hover:bg-accent"
                  title={
                    level === "all"
                      ? "마크다운 제목 + 섹션별 코드 블록을 워크북에 만들고 워크북 뷰로 이동합니다 (자동 실행 없음)"
                      : `${LEVEL_META[level].label} 수준 섹션만 블록으로 만들고 워크북 뷰로 이동합니다 (자동 실행 없음)`
                  }
                >
                  ▶ 블록으로 보내기{scopeSuffix}
                </button>
              ) : null}
            </div>
          </div>
          {/* 요약은 제목/버튼 행 아래 전체 폭으로 */}
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
            {method.summary}
          </p>
        </header>

        {/* 탭 — [정의 및 방법 | 파이썬 코드 적용 | 엑셀 코드 적용 | 파라미터·옵션 | 데이터 레이아웃] */}
        <div
          role="tablist"
          aria-label="방법 설명 종류"
          className="flex items-center gap-1 overflow-x-auto border-b px-5 pt-2 sm:px-6"
        >
          {(
            [
              { key: "theory", label: "정의 및 방법" },
              { key: "code", label: "파이썬 코드 적용" },
              { key: "excel", label: "엑셀 코드 적용" },
              { key: "options", label: "파라미터·옵션" },
              { key: "layout", label: "데이터 레이아웃" },
            ] as { key: DialogTab; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap rounded-t border-b-2 px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                tab === t.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 세로 여백은 안쪽 래퍼에 — 스크롤 컨테이너에 py를 주면 sticky top-0이
            콘텐츠 상자 위(패딩 아래)에 붙어 그 폭만큼 스크롤 내용이 머리 위로 비친다 */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 text-sm sm:px-6">
          <div className="py-5">
            {tab === "theory" ? (
              <TheoryPanel method={method} fz={fz} fontScale={fontScale} />
            ) : tab === "excel" ? (
              <ExcelCodePanel method={method} fz={fz} fontScale={fontScale} />
            ) : tab === "options" ? (
              <OptionsPanel method={method} color={color} fz={fz} />
            ) : tab === "layout" ? (
              <DataLayoutPanel method={method} fz={fz} />
            ) : (
              <>
                <Prose text={method.intro} fz={fz(14.5).fontSize} className="text-foreground/80" />

                {method.category === "wrangle" ? (
                  <div
                    className="mt-4 rounded px-4 py-2.5 text-[12.5px] leading-relaxed text-foreground/80"
                    style={{
                      background: "color-mix(in srgb, var(--chip-amber-bg) 55%, white)",
                    }}
                  >
                    이 데이터 핸들링 코드는 사분면 아래 <strong>데이터 핸들링</strong> 패널의 세부
                    조각 팝업에서 골라 <strong>복사</strong>하거나{" "}
                    <strong>블록으로 보내기</strong>로 워크북에 바로 담을 수 있습니다.
                  </div>
                ) : null}

                {/* 수준 필터 — 기본(바로 산출) / 고급(최적화·진단·시뮬레이션) */}
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <span className="text-[12px] text-muted-foreground">코드 수준</span>
                  <div className="flex items-center rounded border">
                    {LEVEL_FILTERS.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        aria-pressed={level === f.key}
                        onClick={() => setLevel(f.key)}
                        className={`px-2.5 py-1 text-[12px] font-medium transition-colors first:rounded-l last:rounded-r ${
                          level === f.key
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <span className="text-[11.5px] text-muted-foreground">
                    기본 = 값을 지정해 바로 산출 · 고급 = 최적화·진단·시뮬레이션
                    {hasAdvanced ? "" : " (이 방법은 기본 코드만 제공)"}
                  </span>
                </div>

                {visibleSections.length === 0 ? (
                  <p className="mt-4 rounded bg-muted px-4 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
                    이 방법에는 <strong>{level === "basic" ? "기본" : "고급"}</strong> 수준 코드가
                    없습니다. 위에서 <strong>전체</strong>를 선택해 모든 코드를 확인하세요.
                  </p>
                ) : null}

                {trackGroups(visibleSections).map((g) => (
                  <div key={g.track} className="mt-7 first:mt-0">
                    {tracked ? <TrackHeader track={g.track} fontScale={fontScale} /> : null}
                    {g.items.map(({ section: s, index: i }) => (
                      <div key={s.title} className="mt-4">
                        <StickyTitle hasTrack={tracked}>
                          <h3 className="font-semibold text-foreground" style={fz(15)}>
                            {visibleSections.length > 1 ? `${i + 1}. ` : ""}
                            {s.title}
                          </h3>
                          <LevelChip
                            level={levelOf(s)}
                            fontSize={Math.round(11 * fontScale * 10) / 10}
                          />
                          {method.category !== "wrangle" ? (
                            <button
                              type="button"
                              onClick={() =>
                                onSendToWorkbook(
                                  method,
                                  [{ title: s.title, code: s.code.trim() }],
                                  level,
                                )
                              }
                              title="이 섹션만 코드 블록으로 워크북에 담습니다 (자동 실행 없음)"
                              className="ml-auto rounded border px-1.5 py-0.5 text-[10.5px] font-medium text-muted-foreground hover:text-primary"
                            >
                              ＋ 블록
                            </button>
                          ) : null}
                        </StickyTitle>
                        {s.desc ? (
                          <p className="mt-2 leading-[1.8] text-muted-foreground" style={fz(13.5)}>
                            {s.desc}
                          </p>
                        ) : null}
                        <StepBlocks
                          code={s.code.trim()}
                          fontScale={fontScale}
                          cellWord="셀"
                          note={i === 0 ? PY_STEP_NOTE : undefined}
                        />
                      </div>
                    ))}
                  </div>
                ))}

                {method.params.length > 0 ? (
                  <p
                    className="mt-6 rounded bg-muted px-4 py-2.5 leading-relaxed text-muted-foreground"
                    style={fz(12.5)}
                  >
                    파라미터·옵션 해설(fit_intercept·solver·거리 metric 등)은{" "}
                    <button
                      type="button"
                      onClick={() => setTab("options")}
                      className="font-medium text-primary hover:underline"
                    >
                      파라미터·옵션
                    </button>{" "}
                    탭으로 옮겼습니다 — 파이썬·엑셀 공통.
                  </p>
                ) : null}

                {method.tips ? (
                  <div className="mt-6 rounded bg-muted px-4 py-3">
                    <p className="font-semibold text-foreground" style={fz(13)}>
                      해석·주의 포인트
                    </p>
                    <Prose
                      text={method.tips}
                      fz={fz(13.5).fontSize}
                      className="mt-1 text-foreground/80"
                    />
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>

        <footer className="border-t px-5 py-2.5 text-[12px] text-muted-foreground sm:px-6">
          {tab === "theory"
            ? "정의·산출식·활용을 먼저 확인한 뒤 '파이썬 코드 적용' 탭에서 코드를 복사하거나 블록으로 보내세요."
            : tab === "excel"
              ? "엑셀 셀에 =PY( 를 입력해 파이썬 편집 모드로 들어간 뒤, 블록의 '복사'로 코드를 붙여 넣으세요. 데이터는 xl()로 시트·표를 참조합니다."
              : tab === "layout"
                ? "실제 적용에 필요한 열 구성(독립변수·명목형 처리·종속변수 형태)입니다 — 데이터 준비의 출발점."
                : tab === "options"
                  ? "값 후보·기본값·선택 기준 중심의 해설입니다 — 파이썬·엑셀(=PY()) 어느 코드에든 그대로 적용됩니다."
                  : "블록의 '복사'는 해당 코드만, '전체 코드 복사'는 현재 수준 필터에 보이는 블록을 이어붙여 복사합니다. '블록으로 보내기'는 자동 실행하지 않습니다."}
        </footer>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── 사분면 2차원 그래프 (md+) ───────────────────────── */

/** 표시 폭 추정 — CJK는 fontSize, 라틴·기호는 0.58배 + 좌우 패딩 */
function estWidth(name: string, fs: number): number {
  let w = 0;
  for (const ch of name) w += ch.charCodeAt(0) > 0x2e80 ? fs : fs * 0.58;
  return w + 10;
}

interface PlacedItem {
  m: StatMethod;
  color: MethodChipColor;
  x: number;
  y: number;
  fs: number;
  fw: number;
}

interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/* 겹침 회피 이동 후보 — 총 변위(가로 가중 1.6배) 오름차순. 세로 이동 우선. */
const NUDGES: [number, number][] = (() => {
  const out: [number, number][] = [[0, 0]];
  for (let dy = 0; dy <= 200; dy += 10) {
    for (let dx = 0; dx <= 140; dx += 20) {
      if (dx === 0 && dy === 0) continue;
      if (dx === 0) out.push([0, dy], [0, -dy]);
      else if (dy === 0) out.push([dx, 0], [-dx, 0]);
      else out.push([dx, dy], [dx, -dy], [-dx, dy], [-dx, -dy]);
    }
  }
  out.sort(
    (a, b) => Math.abs(a[0]) * 1.6 + Math.abs(a[1]) - (Math.abs(b[0]) * 1.6 + Math.abs(b[1])),
  );
  return out;
})();

/**
 * 사분면 배치 — 결정적(같은 크기면 같은 결과).
 * 가로: 중심 세로선에서의 거리 ∝ (5-빈도), 세로: 중심 가로선에서의 거리 ∝ 난이도.
 * 겹침은 NUDGES 후보 이동으로 회피, 축 라벨 자리는 장애물로 선점.
 */
function layoutQuadrants(w: number, h: number): PlacedItem[] {
  const cx = w / 2;
  const cy = h / 2;
  const boxes: Box[] = [];
  const overlaps = (r: Box) =>
    boxes.some((b) => !(r.x2 < b.x1 || r.x1 > b.x2 || r.y2 < b.y1 || r.y1 > b.y2));
  // 겹침 넓이 합 — 완전 회피가 불가능할 때 '가장 덜 겹치는' 자리를 고르는 폴백용.
  const overlapArea = (r: Box) =>
    boxes.reduce((sum, b) => {
      const ox = Math.max(0, Math.min(r.x2, b.x2) - Math.max(r.x1, b.x1));
      const oy = Math.max(0, Math.min(r.y2, b.y2) - Math.max(r.y1, b.y1));
      return sum + ox * oy;
    }, 0);
  const boxAt = (x: number, y: number, bw: number, bh: number): Box => ({
    x1: x - bw / 2 - 4,
    y1: y - bh / 2 - 4,
    x2: x + bw / 2 + 4,
    y2: y + bh / 2 + 4,
  });

  // 축 라벨 자리 선점(어려움 ↑/↓, 자주 사용, 빈도 낮음 ×2)
  boxes.push(boxAt(cx, 13, 66, 18));
  boxes.push(boxAt(cx, h - 13, 66, 18));
  boxes.push(boxAt(cx, cy, 78, 22));
  boxes.push(boxAt(44, cy, 68, 18));
  boxes.push(boxAt(w - 44, cy, 68, 18));

  const items = QUAD_CATEGORIES.flatMap((cat, qi) =>
    STAT_METHODS.filter((m) => m.category === cat.id).map((m) => ({
      m,
      color: cat.color,
      qi,
    })),
  );
  // 중심(고빈도)부터 배치해 밀려나는 쪽이 항상 저빈도가 되게
  items.sort(
    (a, b) =>
      b.m.weight - a.m.weight || a.m.difficulty - b.m.difficulty || a.m.id.localeCompare(b.m.id),
  );

  const out: PlacedItem[] = [];
  for (const { m, color, qi } of items) {
    const sX = qi % 2 === 0 ? -1 : 1;
    const sY = qi < 2 ? -1 : 1;
    const { fs, fw } = SIZE[m.weight];
    const tw = estWidth(m.name, fs);
    const th = fs * 1.35;

    // 사분면 내부 허용 범위(중심 십자·바깥 여백 회피)
    const xLo = sX < 0 ? 10 + tw / 2 : cx + 10 + tw / 2;
    const xHi = sX < 0 ? cx - 10 - tw / 2 : w - 10 - tw / 2;
    const yLo = sY < 0 ? 8 + th / 2 : cy + 8 + th / 2;
    const yHi = sY < 0 ? cy - 8 - th / 2 : h - 8 - th / 2;

    // 기준 위치 — 빈도(가로)·난이도(세로)
    const tFreq = (5 - m.weight) / 4;
    const tDiff = (m.difficulty - 1) / 4;
    const minOX = 40 + tw / 2;
    const maxOX = Math.max(minOX, cx - 14 - tw / 2);
    const minOY = 20 + th / 2;
    const maxOY = Math.max(minOY, cy - 12 - th / 2);
    const baseX = cx + sX * (minOX + tFreq * (maxOX - minOX));
    const baseY = cy + sY * (minOY + tDiff * (maxOY - minOY));

    const clamp = (v: number, lo: number, hi: number) =>
      lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v));

    let px = clamp(baseX, xLo, xHi);
    let py = clamp(baseY, yLo, yHi);
    // 완전 회피 자리를 찾되, 없으면 '최소 겹침' 자리로 폴백
    let bestX = px;
    let bestY = py;
    let bestOv = Infinity;
    let found = false;
    for (const [dx, dy] of NUDGES) {
      const x = clamp(baseX + dx, xLo, xHi);
      const y = clamp(baseY + dy, yLo, yHi);
      const box = boxAt(x, y, tw, th);
      if (!overlaps(box)) {
        px = x;
        py = y;
        found = true;
        break;
      }
      const ov = overlapArea(box);
      if (ov < bestOv) {
        bestOv = ov;
        bestX = x;
        bestY = y;
      }
    }
    if (!found) {
      px = bestX;
      py = bestY;
    }
    boxes.push(boxAt(px, py, tw, th));
    out.push({ m, color, x: px, y: py, fs, fw });
  }
  return out;
}

function CategoryTag({ cat, align }: { cat: MethodCategory; align: "l" | "r" }) {
  return (
    <div
      className={`flex items-baseline gap-2 ${align === "r" ? "flex-row-reverse text-right" : ""}`}
    >
      <span
        className="h-2.5 w-2.5 shrink-0 self-center rounded-full"
        style={{ background: `var(--chip-${cat.color}-fg)` }}
        aria-hidden
      />
      <span className="text-[16px] font-semibold text-foreground">{cat.label}</span>
      <span className="hidden text-[13.5px] text-muted-foreground lg:inline">{cat.hint}</span>
    </div>
  );
}

function QuadrantChart({ onOpen }: { onOpen: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize((prev) => {
        const w = Math.round(r.width);
        const h = Math.round(r.height);
        return prev.w === w && prev.h === h ? prev : { w, h };
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const placed = useMemo(
    () => (size.w > 0 && size.h > 0 ? layoutQuadrants(size.w, size.h) : []),
    [size],
  );

  const axisLabel =
    "pointer-events-none absolute z-10 whitespace-nowrap rounded-full bg-white/75 px-1.5 py-px text-[10.5px] text-muted-foreground";

  return (
    <div className="hidden md:block" data-testid="method-quadrant">
      {/* 카테고리 이름 — 사각형 바깥(위) */}
      <div className="mb-2 flex items-center justify-between px-1">
        <CategoryTag cat={QUAD_CATEGORIES[0]} align="l" />
        <CategoryTag cat={QUAD_CATEGORIES[1]} align="r" />
      </div>

      <div ref={ref} className="relative h-[500px] lg:h-[540px]">
        {/* 사분면 배경 — 카테고리 색, 십자 여백이 축 역할 */}
        {QUAD_CATEGORIES.map((cat, qi) => (
          <div
            key={cat.id}
            className="absolute rounded-[10px]"
            style={{
              width: "calc(50% - 3px)",
              height: "calc(50% - 3px)",
              left: qi % 2 === 0 ? 0 : undefined,
              right: qi % 2 === 1 ? 0 : undefined,
              top: qi < 2 ? 0 : undefined,
              bottom: qi >= 2 ? 0 : undefined,
              background: `color-mix(in srgb, var(--chip-${cat.color}-bg) 55%, white)`,
            }}
            aria-hidden
          />
        ))}

        {/* 축 안내 라벨 */}
        <span className={`${axisLabel} left-1/2 top-1 -translate-x-1/2`}>어려움 ↑</span>
        <span className={`${axisLabel} bottom-1 left-1/2 -translate-x-1/2`}>어려움 ↓</span>
        <span
          className={`${axisLabel} left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border font-medium text-foreground`}
        >
          자주 사용
        </span>
        <span className={`${axisLabel} left-2 top-1/2 -translate-y-1/2`}>← 빈도 낮음</span>
        <span className={`${axisLabel} right-2 top-1/2 -translate-y-1/2`}>빈도 낮음 →</span>

        {/* 항목 — 빈도(가로)·난이도(세로) 좌표 배치 */}
        {placed.map((p) => (
          <div
            key={p.m.id}
            className="absolute z-20"
            style={{ left: p.x, top: p.y, transform: "translate(-50%, -50%)" }}
          >
            <button
              type="button"
              onClick={() => onOpen(p.m.id)}
              title={p.m.summary}
              className="method-term whitespace-nowrap rounded px-1 leading-none"
              style={{ fontSize: p.fs, fontWeight: p.fw, ...webTermStyle(p.m, p.color) }}
            >
              {p.m.name}
            </button>
          </div>
        ))}
      </div>

      {/* 카테고리 이름 — 사각형 바깥(아래) */}
      <div className="mt-2 flex items-center justify-between px-1">
        <CategoryTag cat={QUAD_CATEGORIES[2]} align="l" />
        <CategoryTag cat={QUAD_CATEGORIES[3]} align="r" />
      </div>

      <p className="mt-3 text-center text-[12px] text-muted-foreground">
        가로축 — 중심 세로선에 가까울수록 자주 사용 · 세로축 — 중심 가로선에서 위·아래로 멀수록
        난이도 높음 (글자가 클수록 자주 쓰는 방법)
      </p>
    </div>
  );
}

/* ──────────── 데이터 핸들링 접이식 패널 (md+, 사분면 아래) ──────────── */

/** 데이터 핸들링 3면 구분(작업 흐름순) — 클릭 → 사분면과 동일한 팝업 */
const WRANGLE_PANES: { label: string; color: string; ids: string[] }[] = [
  {
    label: "입력·선택·필터",
    color: "amber",
    ids: ["data-loading", "select-rows-cols", "filter-condition", "isin", "conditional"],
  },
  { label: "결합·집계", color: "cyan", ids: ["join-merge", "groupby", "pivot"] },
  { label: "정제·변형", color: "slate", ids: ["missing", "sort-dedup", "apply"] },
];

/* wrangle 방법 id → 세부 스니펫(코드 조각) — 각 방법 아래 리스트, 클릭 시 간단 코드 팝업 */
const ALL_WRANGLE_SNIPPETS: WrangleSnippet[] = WRANGLE_SNIPPET_GROUPS.flatMap((g) => g.snippets);
const snippetById = (id: string) => ALL_WRANGLE_SNIPPETS.find((s) => s.id === id);
const groupSnippetIds = (gid: string) =>
  (WRANGLE_SNIPPET_GROUPS.find((g) => g.id === gid)?.snippets ?? []).map((s) => s.id);
const METHOD_SNIPPET_IDS: Record<string, string[]> = {
  "data-loading": groupSnippetIds("load"),
  "select-rows-cols": groupSnippetIds("select"),
  "filter-condition": groupSnippetIds("filter").filter((id) => !id.includes("isin")),
  isin: ["filter-isin", "filter-not-isin"],
  conditional: groupSnippetIds("branch"),
  "join-merge": [...groupSnippetIds("join"), ...groupSnippetIds("concat")],
  groupby: groupSnippetIds("groupby"),
  pivot: groupSnippetIds("pivot"),
  missing: groupSnippetIds("missing"),
  "sort-dedup": groupSnippetIds("sort-dedup"),
  apply: groupSnippetIds("apply-map"),
};
function snippetsForMethod(id: string): WrangleSnippet[] {
  return (METHOD_SNIPPET_IDS[id] ?? [])
    .map(snippetById)
    .filter((s): s is WrangleSnippet => Boolean(s));
}

/**
 * 데이터 핸들링(wrangle)은 사분면 바로 아래 '보이기/숨기기' 접이식 패널(기본 접힘).
 * 펼치면 작업 흐름순 3면으로 나눠 열람하고, 클릭하면 사분면과 동일한 팝업이 열린다.
 */
function WranglePanel({
  onOpen,
  onOpenSnippet,
}: {
  onOpen: (id: string) => void;
  onOpenSnippet: (s: WrangleSnippet) => void;
}) {
  const [open, setOpen] = useState(false);
  const total = useMemo(() => STAT_METHODS.filter((m) => m.category === "wrangle").length, []);
  if (total === 0) return null;
  const byId = (id: string) => STAT_METHODS.find((m) => m.id === id);

  return (
    <div className="mt-4 hidden md:block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg border bg-muted/60 px-4 py-2.5 text-left transition-colors hover:bg-muted"
      >
        <CaretDown
          size={16}
          className={`shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
          aria-hidden
        />
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: `var(--chip-${WRANGLE_CATEGORY.color}-fg)` }}
          aria-hidden
        />
        <span className="text-[13.5px] font-semibold text-foreground">데이터 핸들링</span>
        <span className="rounded-full bg-card px-1.5 py-px text-[11px] font-medium text-muted-foreground">
          {total}
        </span>
        <span className="hidden text-[11.5px] text-muted-foreground sm:inline">
          입력 · 선택·필터 · 결합·집계 · 정제·변형
        </span>
        <span className="ml-auto text-[12px] font-medium text-muted-foreground">
          {open ? "접기" : "펼치기"}
        </span>
      </button>

      {open ? (
        <>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            {WRANGLE_PANES.map((pane) => (
              <div
                key={pane.label}
                className="rounded-lg px-4 py-3.5"
                style={{
                  background: `color-mix(in srgb, var(--chip-${pane.color}-bg) 55%, white)`,
                }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: `var(--chip-${pane.color}-fg)` }}
                    aria-hidden
                  />
                  <span className="text-[13px] font-semibold text-foreground">{pane.label}</span>
                </div>
                <div className="space-y-2.5">
                  {pane.ids.map((id) => {
                    const m = byId(id);
                    if (!m) return null;
                    const snips = snippetsForMethod(id);
                    return (
                      <div key={id}>
                        <button
                          type="button"
                          onClick={() => onOpen(id)}
                          title={`${m.summary} — 클릭하면 정의·코드 전체 팝업`}
                          className="method-term rounded px-1 text-[13px] font-semibold leading-snug"
                          style={{ color: `var(--chip-${pane.color}-fg)` }}
                        >
                          {m.name}
                        </button>
                        {snips.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1 pl-2">
                            {snips.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => onOpenSnippet(s)}
                                title={`${s.desc} — 클릭하면 간단 코드(파이썬·엑셀) 팝업`}
                                className="rounded border bg-white/70 px-1.5 py-0.5 text-[11px] leading-tight text-muted-foreground transition-colors hover:bg-white hover:text-foreground"
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 px-1 text-[11.5px] leading-relaxed text-muted-foreground">
            클릭하면 정의·코드 팝업이 열립니다. 세부 조각 팝업의 &lsquo;복사&rsquo; 또는
            &lsquo;블록으로 보내기&rsquo;로 워크북에 바로 담을 수 있습니다.
          </p>
        </>
      ) : null}
    </div>
  );
}

/* ──────────── 그래프·시각화 접이식 패널 (사분면 아래, 데이터 핸들링과 동형) ──────────── */

/** 그래프 그룹 → 패널 색 — 칩 뮤트 팔레트 한정 스코프 */
const PLOT_PANE_COLOR: Record<string, string> = {
  eda: "blue",
  diag: "violet",
  interpret: "teal",
};

/** 전처리(탐색)·후처리(진단·해석) 그래프 모음 — 클릭 → 간단 코드 팝업 */
function PlotPanel({ onOpenSnippet }: { onOpenSnippet: (s: PlotSnippet) => void }) {
  const [open, setOpen] = useState(false);
  const total = useMemo(() => PLOT_SNIPPET_GROUPS.reduce((n, g) => n + g.snippets.length, 0), []);

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg border bg-muted/60 px-4 py-2.5 text-left transition-colors hover:bg-muted"
      >
        <CaretDown
          size={16}
          className={`shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
          aria-hidden
        />
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--primary)" }} aria-hidden />
        <span className="text-[13.5px] font-semibold text-foreground">그래프·시각화</span>
        <span className="rounded-full bg-card px-1.5 py-px text-[11px] font-medium text-muted-foreground">
          {total}
        </span>
        <span className="hidden text-[11.5px] text-muted-foreground sm:inline">
          탐색(EDA) · 모델 진단 · 해석 — 데이터를 그림으로 이해
        </span>
        <span className="ml-auto text-[12px] font-medium text-muted-foreground">
          {open ? "접기" : "펼치기"}
        </span>
      </button>

      {open ? (
        <>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            {PLOT_SNIPPET_GROUPS.map((g) => {
              const color = PLOT_PANE_COLOR[g.id] ?? "blue";
              return (
                <div
                  key={g.id}
                  className="rounded-lg px-4 py-3.5"
                  style={{
                    background: `color-mix(in srgb, var(--chip-${color}-bg) 55%, white)`,
                  }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: `var(--chip-${color}-fg)` }}
                      aria-hidden
                    />
                    <span className="text-[13px] font-semibold text-foreground">{g.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {g.snippets.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => onOpenSnippet(s)}
                        title={`${s.desc} — 클릭하면 간단 코드(파이썬·엑셀) 팝업`}
                        className="rounded border bg-white/70 px-2 py-1 text-[12px] leading-tight text-foreground/80 transition-colors hover:bg-white hover:text-foreground"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 px-1 text-[11.5px] leading-relaxed text-muted-foreground">
            탐색은 df(로드한 데이터) 기준, 진단·해석은 자체 완결(인라인 빠른 적합 포함)
            조각입니다. 클릭하면 코드 팝업이 열리고, &lsquo;블록으로 보내기&rsquo;로 워크북에 바로
            담을 수 있습니다.
          </p>
        </>
      ) : null}
    </div>
  );
}

/* ─────────────────── 모바일 폴백 — 카테고리 클러스터 클라우드 ─────────────────── */

function ClusterCloud({ onOpen }: { onOpen: (id: string) => void }) {
  const clusters = useMemo(
    () =>
      STAT_CATEGORIES.map((cat) => ({
        cat,
        methods: STAT_METHODS.filter((m) => m.category === cat.id).sort(
          (a, b) => hashOf(a.id) - hashOf(b.id),
        ),
      })),
    [],
  );

  return (
    <div className="grid gap-5 md:hidden">
      {clusters.map(({ cat, methods }) => (
        <div
          key={cat.id}
          className="rounded-lg px-4 py-4"
          style={{ background: `color-mix(in srgb, var(--chip-${cat.color}-bg) 55%, white)` }}
        >
          <div className="mb-2.5 flex items-baseline gap-2">
            <span
              className="h-2 w-2 shrink-0 self-center rounded-full"
              style={{ background: `var(--chip-${cat.color}-fg)` }}
              aria-hidden
            />
            <span className="text-[14.5px] font-semibold tracking-wide text-foreground">
              {cat.label}
            </span>
          </div>
          <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 px-1 py-1.5">
            {methods.map((m) => {
              const { fs, fw } = SIZE[m.weight];
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onOpen(m.id)}
                  title={m.summary}
                  className="method-term rounded px-1 leading-snug"
                  style={{ fontSize: fs, fontWeight: fw, ...webTermStyle(m, cat.color) }}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────────── 섹션 루트 ───────────────────────────── */

export default function MethodsTab() {
  const [openId, setOpenId] = useState<string | null>(null);
  // 팝업 글자 배율 — 팝업을 닫았다 열어도 유지
  const [fontScale, setFontScale] = useState(1);
  // 데이터 핸들링 세부 스니펫 — 간단 코드(파이썬·엑셀) 팝업
  const [snippet, setSnippet] = useState<WrangleSnippet | null>(null);
  // 그래프·시각화 스니펫 — 간단 코드 팝업(그래프 패널)
  const [plotSnip, setPlotSnip] = useState<PlotSnippet | null>(null);

  // 다이얼로그가 현재 필터로 보여주는 섹션을 그대로 블록으로 — 화면과 범위가 어긋나지 않게
  const handleSend = (m: StatMethod, sections: SendSection[], level: LevelFilter) => {
    const scope = level === "all" ? "" : ` — ${LEVEL_META[level].label}`;
    sendToWorkbook(`${m.name} (${m.en})${scope}`, sections);
    setOpenId(null);
  };

  const open = openId ? STAT_METHODS.find((m) => m.id === openId) : undefined;
  const openCat = open ? STAT_CATEGORIES.find((c) => c.id === open.category) : undefined;

  const searchItems: SearchItem[] = useMemo(
    () =>
      STAT_METHODS.map((m) => {
        const cat = STAT_CATEGORIES.find((c) => c.id === m.category);
        return { id: m.id, name: m.name, summary: m.summary, meta: m.en, color: cat?.color };
      }),
    [],
  );

  return (
    <section
      aria-label="통계·머신러닝 파이썬 사전"
      className="rounded-lg bg-card p-6 shadow-sm sm:p-8"
    >
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[17px] font-semibold text-foreground">분석 방법 사전 — 파이썬 코드</h2>
        <p className="text-[12.5px] text-muted-foreground">
          클릭하면 [정의 및 방법 · 파이썬 코드 적용 · 엑셀 코드 적용] 팝업이 열립니다
        </p>
      </div>

      <FunctionSearch
        items={searchItems}
        onOpen={setOpenId}
        placeholder="분석 방법 검색 — 이름·설명 (예: 회귀, 분포, groupby)"
      />

      <QuadrantChart onOpen={setOpenId} />
      <WranglePanel onOpen={setOpenId} onOpenSnippet={setSnippet} />
      {/* 모바일은 데이터 핸들링을 포함한 5개 카테고리를 클러스터로 */}
      <ClusterCloud onOpen={setOpenId} />
      {/* 그래프·시각화 — 전처리(탐색)·후처리(진단·해석) 그래프 별도 카테고리 */}
      <PlotPanel onOpenSnippet={setPlotSnip} />

      {/* 웹 런타임 제한 안내 — 회색(실행 불가)·점선(일부만) 표시 설명 */}
      {WEB_LIMITED.length > 0 ? (
        <div className="mt-4 rounded border bg-muted/60 px-4 py-3">
          <p className="text-[12.5px] font-semibold text-foreground">
            브라우저 Python 런타임(Pyodide)에서 제한되는 방법
          </p>
          <ul className="mt-1.5 space-y-1 text-[12px] leading-relaxed text-muted-foreground">
            {WEB_LIMITED.map((m) => (
              <li key={m.id}>
                <span
                  className="font-medium text-foreground/80"
                  style={{
                    color: m.webSupport === "none" ? WEB_NONE_COLOR : undefined,
                    borderBottom:
                      m.webSupport === "partial" ? "1.5px dashed currentColor" : undefined,
                  }}
                >
                  {m.name}
                </span>
                {" — "}
                {m.webNote}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11.5px] text-muted-foreground">
            <span style={{ color: WEB_NONE_COLOR }}>회색 이름</span>은 브라우저 런타임에서 실행할
            수 없고(로컬 파이썬에서 이용),{" "}
            <span style={{ borderBottom: "1.5px dashed currentColor" }}>점선 밑줄</span>은 일부
            블록만 실행됩니다. 그 밖의 방법은 워크북의 Python 블록에서 바로 돌려볼 수 있습니다.
          </p>
        </div>
      ) : null}

      {open && openCat ? (
        <MethodDialog
          // 다른 방법을 열면 탭·수준 필터를 초기 상태로(정의 및 방법 / 전체)
          key={open.id}
          method={open}
          color={openCat.color}
          categoryLabel={openCat.label}
          fontScale={fontScale}
          onFontScale={setFontScale}
          onSendToWorkbook={handleSend}
          onClose={() => setOpenId(null)}
        />
      ) : null}

      {snippet ? (
        <CodeDialog
          name={snippet.label}
          en="데이터 핸들링"
          subtitle="선택한 데이터 핸들링 조각의 코드입니다. '엑셀 코드 적용' 탭에서 Python in Excel용도 함께 볼 수 있습니다."
          code={snippetInsertCode(snippet)}
          onSent={() => setSnippet(null)}
          onClose={() => setSnippet(null)}
        />
      ) : null}

      {plotSnip ? (
        <CodeDialog
          name={plotSnip.label}
          en="그래프·시각화"
          intro={<PlotSnippetPreview snippet={plotSnip} />}
          code={plotInsertCode(plotSnip)}
          onSent={() => setPlotSnip(null)}
          onClose={() => setPlotSnip(null)}
        />
      ) : null}
    </section>
  );
}
