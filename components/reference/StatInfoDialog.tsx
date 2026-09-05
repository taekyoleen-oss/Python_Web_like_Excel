"use client";

/**
 * 모델 적합 — 적합 통계량 설명 팝업. 결과 표 열 이름 옆 ⓘ를 누르면
 * 그 통계량의 의미·수식(KaTeX)·판단기준을 보여 준다.
 * 소스: Actuarial_Platform StatInfoDialog.tsx (데이터는 lib/reference/statInfos.ts로 분리).
 */
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tex } from "@/components/reference/Tex";
import type { StatInfo } from "@/lib/reference/statInfos";

export function StatInfoDialog({ info, onClose }: { info: StatInfo; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="flex max-h-[88vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
        data-testid="stat-info-dialog"
      >
        <header className="border-b px-5 py-4 pr-12">
          <DialogTitle className="font-sans text-[17px] font-semibold text-foreground">
            {info.name}
          </DialogTitle>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">{info.full}</p>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <p className="text-[13.5px] leading-relaxed text-foreground">{info.desc}</p>

          {info.tex ? (
            <div className="rounded border bg-muted/50 px-4 py-3.5">
              <div className="overflow-x-auto">
                <Tex expr={info.tex} block />
              </div>
              {info.texNote ? (
                <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                  {info.texNote}
                </p>
              ) : null}
            </div>
          ) : null}

          <div>
            <h3 className="mb-1.5 text-[13px] font-semibold text-foreground">판단기준</h3>
            <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-foreground">
              {info.criteria.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>

          {info.caution ? (
            <p className="rounded border border-[var(--chip-amber-fg)]/25 bg-[var(--chip-amber-bg)] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[var(--chip-amber-fg)]">
              ⚠ {info.caution}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
