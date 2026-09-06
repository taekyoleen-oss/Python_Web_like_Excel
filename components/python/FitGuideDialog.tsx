"use client";

// 모델적합 가이드 마법사 (부록 H.3) — 3단계: ① 데이터(샘플/현재 선택 범위)
// ② 모형(심도·빈도·합성) ③ 후보 분포 체크 → runFitGuide가 단계 블록을 생성한다.
// 참조 뷰(모델적합 탭)·코드 삽입 팝업 어디서든 window 이벤트로 연다 (ApiKeyDialog 패턴).

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatA1 } from "@/lib/grid/a1";
import {
  FIT_GUIDE_FREQ_DISTS,
  FIT_GUIDE_SAMPLES,
  FIT_GUIDE_SEV_DISTS,
  FIT_MODEL_LABEL,
  runFitGuide,
  type FitModel,
} from "@/lib/grid/fit-guide";
import { useWorkbookStore } from "@/lib/grid/model";

const OPEN_EVENT = "pygrid:open-fit-guide";

/** 어디서든 모델적합 가이드 마법사 열기 */
export function openFitGuideDialog(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

const DEFAULT_DISTS = [
  ...FIT_GUIDE_SEV_DISTS.filter((d) => d.def).map((d) => d.id),
  ...FIT_GUIDE_FREQ_DISTS.filter((d) => d.def).map((d) => d.id),
];

/** 현재 그리드 선택 → A1 문자열(시트 접두어 포함). 선택 없으면 "" */
function selectionRef(): string {
  const st = useWorkbookStore.getState();
  const sheet = st.workbook.sheets.find((s) => s.id === st.activeSheetId);
  if (!st.selection || !sheet) return "";
  return formatA1(st.selection, sheet.name);
}

export default function FitGuideDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<"sample" | "selection">("sample");
  const [sample, setSample] = useState(FIT_GUIDE_SAMPLES[0].file);
  const [sevRef, setSevRef] = useState("");
  const [freqRef, setFreqRef] = useState("");
  const [model, setModel] = useState<FitModel>("severity");
  const [dists, setDists] = useState<Set<string>>(() => new Set(DEFAULT_DISTS));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onOpen = () => {
      setStep(1);
      setModel("severity");
      setDists(new Set(DEFAULT_DISTS));
      setBusy(false);
      const ref = selectionRef();
      setSevRef(ref);
      setFreqRef("");
      setMode(ref ? "selection" : "sample");
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  const sampleMeta = FIT_GUIDE_SAMPLES.find((s) => s.file === sample);
  /** 샘플에 건수 열이 없으면 빈도·합성 비활성 */
  const freqDisabled = mode === "sample" && sampleMeta?.freqCol === undefined;
  const needSev = model !== "frequency";
  const needFreq = model !== "severity";

  const finishDisabled = useMemo(() => {
    if (busy) return true;
    const hasSev = FIT_GUIDE_SEV_DISTS.some((d) => dists.has(d.id));
    const hasFreq = FIT_GUIDE_FREQ_DISTS.some((d) => dists.has(d.id));
    return (needSev && !hasSev) || (needFreq && !hasFreq);
  }, [busy, dists, needSev, needFreq]);

  const finish = async () => {
    setBusy(true);
    try {
      const res = await runFitGuide({
        model,
        dists: [...dists],
        data:
          mode === "sample"
            ? { mode: "sample", sample }
            : {
                mode: "selection",
                sevRef,
                // 빈도 단독 모형은 1단계 범위가 곧 빈도 범위, 합성만 별도 입력
                freqRef: model === "compound" ? freqRef : sevRef,
              },
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const toggleDist = (id: string, on: boolean) =>
    setDists((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const distGroup = (
    title: string,
    catalog: readonly { id: string; name: string }[],
  ) => (
    <div className="rounded border px-3 py-2.5">
      <p className="mb-1.5 text-xs font-semibold text-foreground">{title}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {catalog.map((d) => (
          <label key={d.id} className="inline-flex cursor-pointer items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={dists.has(d.id)}
              onChange={(e) => toggleDist(d.id, e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--primary)]"
            />
            {d.name}
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[560px]" data-testid="fit-guide-dialog">
        <DialogHeader>
          <DialogTitle className="text-sm">
            모델적합 가이드 — {step}/3 단계
          </DialogTitle>
          <DialogDescription className="text-xs">
            데이터·모형·후보 분포를 고르면 워크북에 단계별 [설명+코드] 블록을 만듭니다.
            블록은 자동 실행되지 않습니다 — 목차에서 순서대로 실행하세요.
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3 text-sm">
            <label className="flex items-center gap-2 text-xs font-medium">
              <input
                type="radio"
                name="fg-mode"
                checked={mode === "sample"}
                onChange={() => setMode("sample")}
              />
              샘플 데이터셋을 그리드로 가져오기
            </label>
            {mode === "sample" && (
              <div className="ml-5 space-y-1">
                {FIT_GUIDE_SAMPLES.map((s) => (
                  <label key={s.file} className="flex items-center gap-2 text-xs">
                    <input
                      type="radio"
                      name="fg-sample"
                      checked={sample === s.file}
                      onChange={() => setSample(s.file)}
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 text-xs font-medium">
              <input
                type="radio"
                name="fg-mode"
                checked={mode === "selection"}
                onChange={() => {
                  setMode("selection");
                  if (!sevRef) setSevRef(selectionRef());
                }}
              />
              현재 시트의 범위 사용 (1~2열 · 첫 행은 헤더)
            </label>
            {mode === "selection" && (
              <div className="ml-5 space-y-1">
                <Input
                  value={sevRef}
                  onChange={(e) => setSevRef(e.target.value)}
                  placeholder="예: A1:A301 또는 시트!A1:B41"
                  aria-label="데이터 범위"
                  className="h-7 font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  마지막 열이 값(손해액·건수) 열입니다. 헤더 행을 포함해 지정하세요.
                </p>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2 text-sm">
            {(Object.keys(FIT_MODEL_LABEL) as FitModel[]).map((m) => {
              const disabled = m !== "severity" && freqDisabled;
              return (
                <label
                  key={m}
                  className={`flex items-center gap-2 text-xs ${disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"}`}
                  title={disabled ? "이 샘플에는 건수 열이 없습니다" : undefined}
                >
                  <input
                    type="radio"
                    name="fg-model"
                    checked={model === m}
                    disabled={disabled}
                    onChange={() => setModel(m)}
                  />
                  {FIT_MODEL_LABEL[m]}
                </label>
              );
            })}
            {model === "compound" && mode === "selection" && (
              <div className="ml-5 space-y-1 pt-1">
                <p className="text-[11px] text-muted-foreground">
                  합성은 심도·빈도 범위를 각각 지정합니다 — 위 1단계 범위가 심도, 아래가 빈도입니다.
                </p>
                <Input
                  value={freqRef}
                  onChange={(e) => setFreqRef(e.target.value)}
                  placeholder="빈도(건수) 범위 — 예: C1:C11"
                  aria-label="빈도 범위"
                  className="h-7 font-mono text-xs"
                />
              </div>
            )}
            {model === "frequency" && mode === "selection" && (
              <p className="ml-5 text-[11px] text-muted-foreground">
                1단계에서 지정한 범위를 건수(빈도) 데이터로 사용합니다.
              </p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2">
            {needSev && distGroup("심도(연속형) 후보 분포", FIT_GUIDE_SEV_DISTS)}
            {needFreq && distGroup("빈도(이산형) 후보 분포", FIT_GUIDE_FREQ_DISTS)}
          </div>
        )}

        <DialogFooter>
          {step > 1 && (
            <Button variant="outline" size="sm" onClick={() => setStep(step - 1)} disabled={busy}>
              이전
            </Button>
          )}
          {step < 3 ? (
            <Button
              size="sm"
              onClick={() => {
                // 빈도·합성이 불가한 데이터로 넘어온 경우 모형을 심도로 되돌린다
                if (step === 1 && freqDisabled && model !== "severity") setModel("severity");
                setStep(step + 1);
              }}
            >
              다음
            </Button>
          ) : (
            <Button size="sm" onClick={() => void finish()} disabled={finishDisabled}>
              {busy ? "생성 중…" : "완료 — 블록 만들기"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
