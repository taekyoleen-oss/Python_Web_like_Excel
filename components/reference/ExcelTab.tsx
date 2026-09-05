"use client";

/**
 * 엑셀 분석함수 사전 — 참조 뷰 "엑셀함수" 탭 (부록 E R3).
 * 소스: Actuarial_Platform ExcelFunctionCloud.tsx.
 * PC(md+): 2×2 사분면 그래프(가로축=빈도, 세로축=난이도), 함수명에 버전 위첨자.
 * 모바일(md 미만): 카테고리 클러스터. 사분면 아래 LET·LAMBDA / 데이터 참조 별도 섹션.
 * 함수 클릭 → 다이얼로그: 개념 → 구문 → 인수 → 예제(전체·기초·고급 필터) → 주의 → 연관.
 * 이 앱에서 잘라낸 것: Supabase 관리자 override 레이어, pin/PiP 다이얼로그, 데이터 흐름 도식.
 */
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  EXCEL_QUADRANTS,
  EXCEL_LAMBDA_CATEGORY,
  EXCEL_DATAREF_CATEGORY,
  EXCEL_CATEGORIES,
  EXCEL_FUNCTIONS,
  VERSION_SUP,
  VERSION_FULL,
  excelCategory,
  type ExcelCategory,
  type ExcelChipColor,
  type ExcelFunction,
} from "@/lib/reference/excelFunctions";
import {
  CodeBlock,
  CopyButton,
  FontScaleControl,
  Prose,
  highlightExcel,
} from "@/components/reference/code-popup";
import { FunctionSearch, type SearchItem } from "@/components/reference/FunctionSearch";

/* 빈도(1~5) → 글자 크기·굵기 — 클수록 실무에서 자주 쓰는 함수 */
const SIZE: Record<number, { fs: number; fw: number }> = {
  1: { fs: 11.5, fw: 500 },
  2: { fs: 12.5, fw: 500 },
  3: { fs: 14, fw: 600 },
  4: { fs: 15.5, fw: 600 },
  5: { fs: 17.5, fw: 700 },
};
const sizeOf = (w: number) => SIZE[Math.min(5, Math.max(1, Math.round(w)))] ?? SIZE[3];

/* SSR 안전 결정적 해시 — 모바일 클러스터 크기 섞임 */
function hashOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const byId = (id: string) => EXCEL_FUNCTIONS.find((f) => f.id === id);

/* ───────────────────────── 함수명 + 버전 위첨자 ───────────────────────── */

function FuncTerm({
  f,
  color,
  onOpen,
}: {
  f: ExcelFunction;
  color: ExcelChipColor;
  onOpen: (id: string) => void;
}) {
  const { fs, fw } = sizeOf(f.weight);
  const sup = VERSION_SUP[f.version];
  return (
    <button
      type="button"
      onClick={() => onOpen(f.id)}
      title={`${f.summary} · ${VERSION_FULL[f.version]}`}
      className="method-term whitespace-nowrap rounded px-1 leading-none"
      style={{ fontSize: fs, fontWeight: fw, color: `var(--chip-${color}-fg)` }}
    >
      {f.name}
      {sup ? (
        <sup className="ml-[1px] align-super text-[0.58em] font-semibold opacity-80">{sup}</sup>
      ) : null}
    </button>
  );
}

/* ───────────────────────── 다이얼로그 (개념·구문·인수·예제) ───────────────────────── */

type LevelFilter = "all" | "basic" | "advanced";

function FunctionDialog({
  fn,
  color,
  categoryLabel,
  fontScale,
  onFontScale,
  onOpen,
  onClose,
}: {
  fn: ExcelFunction;
  color: ExcelChipColor;
  categoryLabel: string;
  fontScale: number;
  onFontScale: Dispatch<SetStateAction<number>>;
  onOpen: (id: string) => void;
  onClose: () => void;
}) {
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");

  const fz = (px: number) => ({ fontSize: Math.round(px * fontScale * 10) / 10 });

  // 예제 — 기초 먼저 정렬 후 필터
  const examples = useMemo(() => {
    const order = { basic: 0, advanced: 1 } as const;
    const sorted = [...fn.examples].sort((a, b) => order[a.level] - order[b.level]);
    return levelFilter === "all" ? sorted : sorted.filter((e) => e.level === levelFilter);
  }, [fn, levelFilter]);

  const hasBasic = fn.examples.some((e) => e.level === "basic");
  const hasAdv = fn.examples.some((e) => e.level === "advanced");

  const levelChip = (lv: "basic" | "advanced") => (
    <span
      className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium"
      style={
        lv === "basic"
          ? { background: "var(--chip-teal-bg)", color: "var(--chip-teal-fg)" }
          : { background: "var(--chip-violet-bg)", color: "var(--chip-violet-fg)" }
      }
    >
      {lv === "basic" ? "기초" : "고급"}
    </span>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="flex max-h-[84vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[880px]"
        data-testid="excel-fn-dialog"
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
                <DialogTitle className="font-mono text-[18px] font-semibold text-foreground">
                  {fn.name}
                </DialogTitle>
                <span
                  className="inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                  title={VERSION_FULL[fn.version]}
                >
                  {fn.version === "all" ? "전 버전" : `Excel ${fn.version}`}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                {fn.summary}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <FontScaleControl fontScale={fontScale} onFontScale={onFontScale} />
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 text-sm sm:px-6">
          {/* 사용 가능 버전 */}
          <p className="mb-3 rounded bg-muted px-3 py-1.5 text-muted-foreground" style={fz(12)}>
            사용 가능:{" "}
            <span className="font-medium text-foreground/80">{VERSION_FULL[fn.version]}</span>
          </p>

          {/* 개념 */}
          <Prose text={fn.intro} fz={fz(14.5).fontSize} className="text-foreground/80" />

          {/* 구문 */}
          <div className="mt-6">
            <h3 className="font-semibold text-foreground" style={fz(15)}>
              구문
            </h3>
            <CodeBlock code={fn.syntax.trim()} codeFz={13.5 * fontScale} lang="excel" />
          </div>

          {/* 인수 */}
          {fn.params.length > 0 ? (
            <div className="mt-6">
              <h3 className="font-semibold text-foreground" style={fz(15)}>
                인수
              </h3>
              <dl className="mt-2 divide-y divide-border rounded border">
                {fn.params.map((p) => (
                  <div key={p.name} className="px-3.5 py-2.5">
                    <dt className="flex items-center gap-2">
                      <code
                        className="font-mono font-medium"
                        style={{ ...fz(13), color: `var(--chip-${color}-fg)` }}
                      >
                        {p.name}
                      </code>
                      <span
                        className={`rounded-full px-1.5 py-px text-[10px] font-medium ${
                          p.required
                            ? "bg-muted text-foreground/80"
                            : "border text-muted-foreground"
                        }`}
                      >
                        {p.required ? "필수" : "선택"}
                      </span>
                    </dt>
                    <dd className="mt-0.5 leading-[1.75] text-foreground/80" style={fz(13.5)}>
                      {p.desc}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          {/* 예제 — 전체 / 기초 / 고급 */}
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-foreground" style={fz(14.5)}>
                예제
              </h3>
              {hasBasic && hasAdv ? (
                <div className="flex items-center gap-0.5 rounded-full border p-0.5">
                  {(
                    [
                      ["all", "전체"],
                      ["basic", "기초"],
                      ["advanced", "고급"],
                    ] as [LevelFilter, string][]
                  ).map(([lv, lab]) => (
                    <button
                      key={lv}
                      type="button"
                      onClick={() => setLevelFilter(lv)}
                      className={`rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors ${
                        levelFilter === lv
                          ? "bg-foreground text-white"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {lab}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-3 space-y-5">
              {examples.map((ex, i) => (
                <div key={i}>
                  <div className="flex items-center" style={fz(14)}>
                    <span className="font-semibold text-foreground">{ex.title}</span>
                    {levelChip(ex.level)}
                  </div>
                  {/* 입력(수식) — 블루 틴트, 출력(결과) — 틸 틴트로 시각 구분 */}
                  <div className="relative mt-2 overflow-hidden rounded border">
                    <CopyButton text={ex.formula.trim()} className="absolute right-2 top-2 z-10" />
                    <div
                      className="flex items-start gap-2 px-3.5 py-3"
                      style={{
                        background: "color-mix(in srgb, var(--chip-blue-bg) 45%, white)",
                      }}
                    >
                      <span
                        className="mt-0.5 inline-flex shrink-0 items-center rounded-full px-1.5 py-px text-[10.5px] font-semibold"
                        style={{
                          background: "var(--chip-blue-bg)",
                          color: "var(--chip-blue-fg)",
                        }}
                      >
                        입력
                      </span>
                      <pre
                        className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all pr-14 font-mono leading-[1.7] text-foreground"
                        style={{ fontSize: 13.5 * fontScale }}
                      >
                        <code>{highlightExcel(ex.formula.trim())}</code>
                      </pre>
                    </div>
                    <div
                      className="flex items-start gap-2 border-t px-3.5 py-2.5"
                      style={{
                        background: "color-mix(in srgb, var(--chip-teal-bg) 40%, white)",
                      }}
                    >
                      <span
                        className="mt-0.5 inline-flex shrink-0 items-center rounded-full px-1.5 py-px text-[10.5px] font-semibold"
                        style={{
                          background: "var(--chip-teal-bg)",
                          color: "var(--chip-teal-fg)",
                        }}
                      >
                        출력
                      </span>
                      <p className="min-w-0 flex-1 leading-[1.7] text-foreground/80" style={fz(13.5)}>
                        {ex.result}
                      </p>
                    </div>
                  </div>
                  <p className="mt-1.5 leading-[1.75] text-foreground/80" style={fz(13.5)}>
                    {ex.explain}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 주의 */}
          {fn.tips ? (
            <div className="mt-6 rounded bg-muted px-4 py-3">
              <p className="font-semibold text-foreground" style={fz(13)}>
                주의·흔한 오해
              </p>
              <Prose text={fn.tips} fz={fz(13.5).fontSize} className="mt-1 text-foreground/80" />
            </div>
          ) : null}

          {/* 연관 함수 */}
          {fn.related && fn.related.length > 0 ? (
            <div className="mt-6">
              <h3 className="font-semibold text-foreground" style={fz(13)}>
                연관 함수
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {fn.related.map((r) => {
                  const target = EXCEL_FUNCTIONS.find(
                    (g) => g.name === r || g.name.split(" · ").includes(r),
                  );
                  return target ? (
                    <button
                      key={r}
                      type="button"
                      onClick={() => onOpen(target.id)}
                      className="rounded-full border px-2.5 py-0.5 font-mono text-[12px] text-muted-foreground hover:text-foreground"
                    >
                      {r}
                    </button>
                  ) : (
                    <span
                      key={r}
                      className="rounded-full border px-2.5 py-0.5 font-mono text-[12px] text-muted-foreground"
                    >
                      {r}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <footer className="border-t px-5 py-2.5 text-[12px] text-muted-foreground sm:px-6">
          위첨자는 함수가 처음 도입된 엑셀 버전입니다(¹⁹=2019, ²¹=2021, ³⁶⁵=365 전용). 예제
          수식은 코드 블록의 &lsquo;복사&rsquo;로 셀에 붙여 쓸 수 있습니다.
        </footer>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── 사분면 배치(md+) ───────────────────────── */

function estWidth(name: string, fs: number, sup: string): number {
  let w = 0;
  for (const ch of name) w += ch.charCodeAt(0) > 0x2e80 ? fs : fs * 0.58;
  return w + sup.length * fs * 0.36 + 12;
}

interface PlacedItem {
  f: ExcelFunction;
  color: ExcelChipColor;
  x: number;
  y: number;
}

interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const NUDGES: [number, number][] = (() => {
  const out: [number, number][] = [[0, 0]];
  for (let dy = 0; dy <= 250; dy += 9) {
    for (let dx = 0; dx <= 180; dx += 16) {
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

function layoutQuadrants(w: number, h: number): PlacedItem[] {
  const cx = w / 2;
  const cy = h / 2;
  const boxes: Box[] = [];
  const overlaps = (r: Box) =>
    boxes.some((b) => !(r.x2 < b.x1 || r.x1 > b.x2 || r.y2 < b.y1 || r.y1 > b.y2));
  const boxAt = (x: number, y: number, bw: number, bh: number): Box => ({
    x1: x - bw / 2 - 4,
    y1: y - bh / 2 - 4,
    x2: x + bw / 2 + 4,
    y2: y + bh / 2 + 4,
  });

  // 축 라벨 자리 선점
  boxes.push(boxAt(cx, 13, 66, 18));
  boxes.push(boxAt(cx, h - 13, 66, 18));
  boxes.push(boxAt(cx, cy, 78, 22));
  boxes.push(boxAt(44, cy, 68, 18));
  boxes.push(boxAt(w - 44, cy, 68, 18));

  const items = EXCEL_QUADRANTS.flatMap((cat, qi) =>
    EXCEL_FUNCTIONS.filter((f) => f.category === cat.id).map((f) => ({
      f,
      color: cat.color,
      qi,
    })),
  );
  items.sort(
    (a, b) =>
      b.f.weight - a.f.weight || a.f.difficulty - b.f.difficulty || a.f.id.localeCompare(b.f.id),
  );

  const out: PlacedItem[] = [];
  for (const { f, color, qi } of items) {
    const sX = qi % 2 === 0 ? -1 : 1;
    const sY = qi < 2 ? -1 : 1;
    const { fs } = sizeOf(f.weight);
    const tw = estWidth(f.name, fs, VERSION_SUP[f.version]);
    const th = fs * 1.35;

    const xLo = sX < 0 ? 10 + tw / 2 : cx + 10 + tw / 2;
    const xHi = sX < 0 ? cx - 10 - tw / 2 : w - 10 - tw / 2;
    const yLo = sY < 0 ? 8 + th / 2 : cy + 8 + th / 2;
    const yHi = sY < 0 ? cy - 8 - th / 2 : h - 8 - th / 2;

    const tFreq = (5 - f.weight) / 4;
    const tDiff = (f.difficulty - 1) / 4;
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
    for (const [dx, dy] of NUDGES) {
      const x = clamp(baseX + dx, xLo, xHi);
      const y = clamp(baseY + dy, yLo, yHi);
      if (!overlaps(boxAt(x, y, tw, th))) {
        px = x;
        py = y;
        break;
      }
    }
    boxes.push(boxAt(px, py, tw, th));
    out.push({ f, color, x: px, y: py });
  }
  return out;
}

function CategoryTag({ cat, align }: { cat: ExcelCategory; align: "l" | "r" }) {
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
    <div className="hidden md:block" data-testid="excel-quadrant">
      <div className="mb-2 flex items-center justify-between px-1">
        <CategoryTag cat={EXCEL_QUADRANTS[0]} align="l" />
        <CategoryTag cat={EXCEL_QUADRANTS[1]} align="r" />
      </div>

      <div ref={ref} className="relative h-[720px] lg:h-[800px]">
        {EXCEL_QUADRANTS.map((cat, qi) => (
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

        <span className={`${axisLabel} left-1/2 top-1 -translate-x-1/2`}>어려움 ↑</span>
        <span className={`${axisLabel} bottom-1 left-1/2 -translate-x-1/2`}>어려움 ↓</span>
        <span
          className={`${axisLabel} left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border font-medium text-foreground`}
        >
          자주 사용
        </span>
        <span className={`${axisLabel} left-2 top-1/2 -translate-y-1/2`}>← 빈도 낮음</span>
        <span className={`${axisLabel} right-2 top-1/2 -translate-y-1/2`}>빈도 낮음 →</span>

        {placed.map((p) => (
          <div
            key={p.f.id}
            className="absolute z-20"
            style={{ left: p.x, top: p.y, transform: "translate(-50%, -50%)" }}
          >
            <FuncTerm f={p.f} color={p.color} onOpen={onOpen} />
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between px-1">
        <CategoryTag cat={EXCEL_QUADRANTS[2]} align="l" />
        <CategoryTag cat={EXCEL_QUADRANTS[3]} align="r" />
      </div>

      <p className="mt-3 text-center text-[12px] text-muted-foreground">
        가로축 — 중심 세로선에 가까울수록 자주 사용 · 세로축 — 중심 가로선에서 멀수록 난이도 높음
        (글자가 클수록 자주 쓰는 함수, 위첨자는 도입 버전)
      </p>
    </div>
  );
}

/* ─────────────────── 모바일 폴백 — 카테고리 클러스터 ─────────────────── */

function ClusterCloud({ onOpen }: { onOpen: (id: string) => void }) {
  const clusters = useMemo(
    () =>
      EXCEL_QUADRANTS.map((cat) => ({
        cat,
        fns: EXCEL_FUNCTIONS.filter((f) => f.category === cat.id).sort(
          (a, b) => hashOf(a.id) - hashOf(b.id),
        ),
      })),
    [],
  );

  return (
    <div className="grid gap-5 md:hidden">
      {clusters.map(({ cat, fns }) => (
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
            {fns.map((f) => (
              <FuncTerm key={f.id} f={f} color={cat.color} onOpen={onOpen} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── 사분면 아래 별도 섹션 (LET·LAMBDA / 데이터 참조·연산자) — 카드 그리드 ─── */

function ExtraSection({ cat, onOpen }: { cat: ExcelCategory; onOpen: (id: string) => void }) {
  const fns = useMemo(
    () =>
      EXCEL_FUNCTIONS.filter((f) => f.category === cat.id).sort(
        (a, b) =>
          b.weight - a.weight || a.difficulty - b.difficulty || a.id.localeCompare(b.id),
      ),
    [cat.id],
  );
  if (fns.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="mb-3 flex items-baseline gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 self-center rounded-full"
          style={{ background: `var(--chip-${cat.color}-fg)` }}
          aria-hidden
        />
        <h3 className="text-[16px] font-semibold text-foreground">{cat.label}</h3>
        <span className="hidden text-[13px] text-muted-foreground sm:inline">{cat.hint}</span>
      </div>
      <div
        className="rounded-lg px-4 py-4"
        style={{ background: `color-mix(in srgb, var(--chip-${cat.color}-bg) 55%, white)` }}
      >
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {fns.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onOpen(f.id)}
              className="method-term flex flex-col items-start gap-1 rounded-lg border bg-white/70 px-3.5 py-3 text-left hover:bg-white"
            >
              <span className="flex items-baseline gap-1">
                <span
                  className="font-mono text-[15px] font-semibold"
                  style={{ color: `var(--chip-${cat.color}-fg)` }}
                >
                  {f.name}
                </span>
                {VERSION_SUP[f.version] ? (
                  <sup className="align-super text-[9px] font-semibold text-muted-foreground">
                    {VERSION_SUP[f.version]}
                  </sup>
                ) : null}
              </span>
              <span className="text-[12px] leading-snug text-muted-foreground">{f.summary}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── 섹션 루트 ───────────────────────────── */

export default function ExcelTab() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [fontScale, setFontScale] = useState(1);

  const open = openId ? byId(openId) : undefined;
  const openCat = open ? EXCEL_CATEGORIES.find((c) => c.id === open.category) : undefined;

  const searchItems: SearchItem[] = useMemo(
    () =>
      EXCEL_FUNCTIONS.map((f) => {
        const cat = excelCategory(f.category);
        return {
          id: f.id,
          name: f.name,
          summary: f.summary,
          meta: cat.label,
          color: cat.color,
        };
      }),
    [],
  );

  return (
    <section aria-label="엑셀 분석함수 사전" className="rounded-lg bg-card p-6 shadow-sm sm:p-8">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[17px] font-semibold text-foreground">
          엑셀 함수 사전 — 통계분석 실무
        </h2>
        <p className="text-[12.5px] text-muted-foreground">
          함수를 클릭하면 개념·구문·인수·예제(기초→고급) 팝업이 열립니다
        </p>
      </div>

      <FunctionSearch
        items={searchItems}
        onOpen={setOpenId}
        placeholder="엑셀 함수 검색 — 이름·설명 (예: 합계, XLOOKUP, 분위수)"
      />

      <QuadrantChart onOpen={setOpenId} />
      <ClusterCloud onOpen={setOpenId} />
      <ExtraSection cat={EXCEL_LAMBDA_CATEGORY} onOpen={setOpenId} />
      <ExtraSection cat={EXCEL_DATAREF_CATEGORY} onOpen={setOpenId} />

      {open && openCat ? (
        <FunctionDialog
          key={open.id}
          fn={open}
          color={openCat.color}
          categoryLabel={openCat.label}
          fontScale={fontScale}
          onFontScale={setFontScale}
          onOpen={setOpenId}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </section>
  );
}
