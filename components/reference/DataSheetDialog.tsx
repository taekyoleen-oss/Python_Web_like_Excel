"use client";

/**
 * 모델 적합 — 데이터 입력 스프레드 팝업.
 * ① 시트 단계: 붙여넣기 가능한 그리드(엑셀 TSV 자동 분해·행 자동 확장·셀 편집·
 *    행 추가·모두 지우기). ② 확인 단계: 형식 자동 감지 결과(근거 포함)를
 *    보여 주고 사용자가 확인/변경 후 확정한다(사용자 결정: 자동 감지+확인).
 * 소스: Actuarial_Platform DataSheetDialog.tsx (shadcn Dialog로 교체).
 */
import { useMemo, useRef, useState } from "react";
import { ClipboardText, Plus, Trash } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  buildFitData,
  checkTruncation,
  detectFormat,
  splitClipboard,
  FIT_KIND_LABEL,
  type DetectResult,
  type FitData,
  type FitKind,
} from "@/lib/reference/fitData";

const COLS = 3;
const INITIAL_ROWS = 12;

const emptyRows = (n: number): string[][] =>
  Array.from({ length: n }, () => Array<string>(COLS).fill(""));

export function DataSheetDialog({
  initialCells,
  initialTrunc,
  onConfirm,
  onClose,
}: {
  /** 다시 열 때 기존 입력 복원 */
  initialCells?: string[][] | null;
  /** 다시 열 때 기존 면책·한도 입력 복원 */
  initialTrunc?: { deductible?: number; limit?: number } | null;
  onConfirm: (data: FitData, cells: string[][]) => void;
  onClose: () => void;
}) {
  const [cells, setCells] = useState<string[][]>(() =>
    initialCells && initialCells.length > 0
      ? initialCells.map((r) => Array.from({ length: COLS }, (_, i) => r[i] ?? ""))
      : emptyRows(INITIAL_ROWS)
  );
  const [error, setError] = useState<string | null>(null);
  // 확인 단계 상태 — null이면 시트 단계
  const [det, setDet] = useState<DetectResult | null>(null);
  const [kind, setKind] = useState<FitKind>("individual");
  // 면책 d·한도 u — 선택 입력(빈칸=미적용). 개별·연도+값 심도 전용.
  const [dedStr, setDedStr] = useState<string>(() =>
    initialTrunc?.deductible !== undefined ? String(initialTrunc.deductible) : ""
  );
  const [limStr, setLimStr] = useState<string>(() =>
    initialTrunc?.limit !== undefined ? String(initialTrunc.limit) : ""
  );
  const gridRef = useRef<HTMLDivElement>(null);

  const setCell = (r: number, c: number, v: string) =>
    setCells((prev) => {
      const next = prev.map((row) => [...row]);
      next[r][c] = v;
      return next;
    });

  /** 붙여넣기 — 포커스된 셀(없으면 첫 셀)을 앵커로 TSV를 펼친다. */
  const handlePaste = (e: React.ClipboardEvent, r0 = 0, c0 = 0) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text || (!text.includes("\n") && !text.includes("\t"))) return; // 단일 값은 기본 동작
    e.preventDefault();
    const parsed = splitClipboard(text);
    setCells((prev) => {
      const needRows = r0 + parsed.length;
      const next = prev.map((row) => [...row]);
      while (next.length < needRows) next.push(Array<string>(COLS).fill(""));
      parsed.forEach((row, i) => {
        row.slice(0, COLS - c0).forEach((v, j) => {
          next[r0 + i][c0 + j] = v.trim();
        });
      });
      return next;
    });
    setError(null);
  };

  const usedRows = useMemo(
    () => cells.filter((r) => r.some((c) => c.trim() !== "")).length,
    [cells]
  );

  const runDetect = () => {
    try {
      const d = detectFormat(cells);
      setDet(d);
      setKind(d.kind);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  /** "1,234" 같은 콤마 입력 허용 — 빈칸은 undefined(미적용). */
  const parseOptNum = (s: string): number | undefined => {
    const t = s.trim().replace(/,/g, "");
    if (t === "") return undefined;
    return Number(t);
  };

  const confirm = () => {
    if (!det) return;
    let data: FitData;
    try {
      data = buildFitData(det, kind);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDet(null); // 형식 오류 → 시트로 복귀해 수정
      return;
    }
    if (kind !== "grouped") {
      const d = parseOptNum(dedStr);
      const u = parseOptNum(limStr);
      const chk = checkTruncation(data.values, d, u);
      if (!chk.ok) {
        setError(chk.error ?? "면책·한도 입력을 확인하세요.");
        return; // 확인 단계 유지 — d·u만 고치면 됨
      }
      if (d !== undefined && d > 0) data.deductible = d;
      if (u !== undefined) data.limit = u;
    }
    onConfirm(data, cells);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="flex max-h-[86vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        data-testid="data-sheet-dialog"
      >
        <header className="border-b px-5 py-4 pr-12">
          <DialogTitle className="font-sans text-[17px] font-semibold text-foreground">
            데이터 입력
          </DialogTitle>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            엑셀·시트에서 복사한 데이터를 그리드에 붙여넣으세요(첫 행 이름 허용).
            1열=개별 값 · 2열=연도+값(빈도·심도) · 3열=최소·최대·건수(그룹).
          </p>
        </header>

        {det === null ? (
          <>
            {/* ── 시트 단계 ── */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div
                ref={gridRef}
                className="overflow-x-auto rounded border border-border"
                onPaste={(e) => {
                  // 포커스 셀 좌표를 data 속성에서 읽어 앵커로 사용
                  const t = e.target as HTMLElement;
                  const r = Number(t.dataset?.row ?? 0);
                  const c = Number(t.dataset?.col ?? 0);
                  handlePaste(e, Number.isFinite(r) ? r : 0, Number.isFinite(c) ? c : 0);
                }}
              >
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-muted text-muted-foreground">
                      <th className="w-10 border-b border-r border-border px-2 py-1.5 text-center font-medium">
                        #
                      </th>
                      {["1열", "2열", "3열"].map((h) => (
                        <th
                          key={h}
                          className="border-b border-r border-border px-2 py-1.5 text-left font-medium last:border-r-0"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cells.map((row, r) => (
                      <tr key={r}>
                        <td className="border-b border-r border-border bg-muted/60 px-2 py-0 text-center tabular-nums text-[11.5px] text-muted-foreground">
                          {r + 1}
                        </td>
                        {row.map((v, c) => (
                          <td
                            key={c}
                            className="border-b border-r border-border p-0 last:border-r-0"
                          >
                            <input
                              type="text"
                              value={v}
                              data-row={r}
                              data-col={c}
                              onChange={(e) => setCell(r, c, e.target.value)}
                              className="w-full min-w-[90px] bg-transparent px-2 py-1.5 text-foreground focus-visible:bg-[color-mix(in_srgb,var(--chip-blue-bg)_45%,white)] focus-visible:outline-none"
                              aria-label={`${r + 1}행 ${c + 1}열`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCells((prev) => [...prev, ...emptyRows(10)])}
                  className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 text-[12.5px] text-muted-foreground hover:text-foreground"
                >
                  <Plus size={13} /> 행 10개 추가
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCells(emptyRows(INITIAL_ROWS));
                    setError(null);
                  }}
                  className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 text-[12.5px] text-muted-foreground hover:text-foreground"
                >
                  <Trash size={13} /> 모두 지우기
                </button>
                <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <ClipboardText size={13} /> 입력 {usedRows}행
                </span>
              </div>

              {error ? (
                <p className="mt-3 rounded border border-[var(--chip-rose-fg)]/30 bg-[var(--chip-rose-bg)] px-3 py-2 text-[12.5px] text-[var(--chip-rose-fg)]">
                  {error}
                </p>
              ) : null}
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-border px-4 py-1.5 text-[13px] text-muted-foreground hover:text-foreground"
              >
                취소
              </button>
              <button
                type="button"
                onClick={runDetect}
                disabled={usedRows < 2}
                className="rounded bg-foreground px-4 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
              >
                확인
              </button>
            </footer>
          </>
        ) : (
          <>
            {/* ── 확인 단계: 감지 결과 확인/변경 ── */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="rounded border border-border bg-muted/50 px-4 py-3.5">
                <p className="text-[13px] text-foreground">
                  감지된 형식:{" "}
                  <strong className="font-semibold">{FIT_KIND_LABEL[det.kind]}</strong>
                </p>
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[12.5px] text-muted-foreground">
                  {det.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                  <li>
                    데이터 {det.rows.length}행
                    {det.headers ? " (헤더 1행 제외)" : ""}
                  </li>
                </ul>
                {det.warnings.length > 0 ? (
                  <ul className="mt-2 space-y-0.5 text-[12.5px] text-[var(--chip-amber-fg)]">
                    {det.warnings.map((w) => (
                      <li key={w}>⚠ {w}</li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <label className="mt-4 block text-[12.5px] font-medium text-foreground">
                이 형식으로 처리합니다 — 다르면 변경하세요
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as FitKind)}
                  className="mt-1.5 block w-full rounded border border-border bg-card px-3 py-2 text-[13px] text-foreground focus-visible:border-foreground focus-visible:outline-none"
                >
                  {(Object.keys(FIT_KIND_LABEL) as FitKind[]).map((k) => (
                    <option key={k} value={k}>
                      {FIT_KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                연도+데이터값은 빈도(연도별 건수)와 심도(값)를 함께 적합하고,
                개별·그룹 데이터는 연속형(심도) 분포만 적합합니다.
              </p>

              {/* 면책·한도(선택) — 좌측 절단·우측 검열 반영 적합 */}
              <div className="mt-4 rounded border border-border bg-[color-mix(in_srgb,var(--chip-blue-bg)_35%,white)] px-4 py-3.5">
                <p className="text-[12.5px] font-medium text-foreground">
                  면책·보상한도 반영 적합 (선택)
                </p>
                {kind !== "grouped" ? (
                  <>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                      값이 원손해액이고 실제 보험 클레임처럼 면책(d) 미만은
                      관측되지 않았으며(좌측 절단), 한도(u) 이상은 u로
                      기록되었다면(우측 검열) 입력하세요 — 이 규약에 맞는 우도로
                      적합합니다. 빈칸=미적용.
                    </p>
                    <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <label className="block text-[12px] font-medium text-foreground">
                        면책 d (deductible)
                        <input
                          type="text"
                          inputMode="decimal"
                          value={dedStr}
                          onChange={(e) => setDedStr(e.target.value)}
                          placeholder="예: 500 (빈칸=0, 미적용)"
                          className="mt-1 block w-full rounded border border-border bg-card px-3 py-1.5 text-[13px] text-foreground focus-visible:border-foreground focus-visible:outline-none"
                        />
                      </label>
                      <label className="block text-[12px] font-medium text-foreground">
                        보상한도 u (limit)
                        <input
                          type="text"
                          inputMode="decimal"
                          value={limStr}
                          onChange={(e) => setLimStr(e.target.value)}
                          placeholder="예: 10000 (빈칸=∞, 미적용)"
                          className="mt-1 block w-full rounded border border-border bg-card px-3 py-1.5 text-[13px] text-foreground focus-visible:border-foreground focus-visible:outline-none"
                        />
                      </label>
                    </div>
                    <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
                      u는 d보다 커야 하며, u 이상으로 기록된 관측은 검열로
                      처리됩니다(정확한 값 대신 &quot;u 이상&quot;이라는 정보만
                      사용). KS는 조건부 CDF·비검열 관측 기준, A²·χ²는 제공되지
                      않습니다.
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                    그룹(최소·최대·건수) 데이터는 면책·한도 적합을 지원하지
                    않습니다 — 구간 우도와 절단·검열 규약이 겹쳐 식별이
                    어렵습니다. 개별 값(1열) 또는 연도+값(2열) 형식을 사용하세요.
                  </p>
                )}
              </div>

              {error ? (
                <p className="mt-3 rounded border border-[var(--chip-rose-fg)]/30 bg-[var(--chip-rose-bg)] px-3 py-2 text-[12.5px] text-[var(--chip-rose-fg)]">
                  {error}
                </p>
              ) : null}
            </div>

            <footer className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
              <button
                type="button"
                onClick={() => setDet(null)}
                className="rounded border border-border px-4 py-1.5 text-[13px] text-muted-foreground hover:text-foreground"
              >
                ← 데이터 수정
              </button>
              <button
                type="button"
                onClick={confirm}
                className="rounded bg-foreground px-4 py-1.5 text-[13px] font-medium text-white"
              >
                이 형식으로 확정
              </button>
            </footer>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
