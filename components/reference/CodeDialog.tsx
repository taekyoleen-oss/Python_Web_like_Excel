"use client";

/**
 * 참조 뷰 공용 코드 팝업 — 소스 DistCodeDialog 간소화(부록 E R3·R4, pin/PiP 제거).
 * 단일 code 또는 tabs(모델 적합/시뮬레이션 등) + '엑셀 코드 적용' 탭 자동 추가.
 * '블록으로 보내기'는 현재 파이썬 탭의 코드를 워크북 블록으로 담는다(엑셀 탭에선 숨김).
 * 파이썬코드 탭 스니펫·분포 탭 코드 보기·모델적합 코드 팝업이 공유한다.
 */
import { useMemo, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  CodeBlock,
  CopyButton,
  FontScaleControl,
} from "@/components/reference/code-popup";
import { PIE_CODE_NOTE, toExcelPython } from "@/lib/reference/methodExcelCode";
import { sendToWorkbook } from "@/lib/grid/import-blocks";

export interface CodeTab {
  key: string;
  label: string;
  code: string;
  note?: string | string[];
}

export function CodeDialog({
  name,
  en,
  code,
  tabs,
  subtitle,
  intro,
  sendTitle,
  onSent,
  onClose,
}: {
  name: string;
  en: string;
  /** 단일 코드 — tabs가 있으면 무시 */
  code?: string;
  /** 탭 구성(예: 모델 적합 / 시뮬레이션) */
  tabs?: CodeTab[];
  subtitle?: string;
  /** 코드 위(탭 공통)에 표시할 프리뷰 블록 — 그래프 샘플·대표 모델·입력 형태 등 */
  intro?: ReactNode;
  /** '블록으로 보내기'의 마크다운 제목 (기본 name) */
  sendTitle?: string;
  /** 보내기 후 호출(다이얼로그 닫기 등) */
  onSent?: () => void;
  onClose: () => void;
}) {
  const baseTabs: CodeTab[] = useMemo(
    () =>
      tabs && tabs.length > 0
        ? tabs
        : [{ key: "py", label: "파이썬 코드 적용", code: code ?? "" }],
    [tabs, code],
  );
  // '엑셀 코드 적용' 탭 자동 추가 — 첫 코드를 Python in Excel용으로 변환
  const allTabs: CodeTab[] = useMemo(
    () => [
      ...baseTabs,
      {
        key: "__excel",
        label: "엑셀 코드 적용",
        code: toExcelPython(baseTabs[0].code),
        note: PIE_CODE_NOTE,
      },
    ],
    [baseTabs],
  );
  const [tabKey, setTabKey] = useState<string>(baseTabs[0].key);
  const active = allTabs.find((t) => t.key === tabKey) ?? allTabs[0];
  const [fontScale, setFontScale] = useState(1);

  const send = () => {
    const title = sendTitle ?? name;
    sendToWorkbook(title, [{ title: baseTabs.length > 1 ? `${title} — ${active.label}` : title, code: active.code }]);
    onSent?.();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="flex max-h-[84vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        data-testid="snippet-dialog"
      >
        <header className="flex items-start justify-between gap-3 border-b px-5 py-4 pr-12 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-2xl" aria-hidden>
                🐍
              </span>
              <DialogTitle className="font-sans text-[18px] font-semibold text-foreground">
                {name}
              </DialogTitle>
              <span className="text-[13px] text-muted-foreground">{en}</span>
            </div>
            {subtitle && !intro ? (
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <FontScaleControl fontScale={fontScale} onFontScale={setFontScale} />
            <CopyButton text={active.code} label="전체 복사" />
            {active.key !== "__excel" ? (
              <button
                type="button"
                onClick={send}
                data-testid="snippet-send"
                className="inline-flex items-center gap-1 whitespace-nowrap rounded border bg-card px-2 py-1 text-[11.5px] font-medium text-primary hover:bg-accent"
                title="이 코드를 워크북의 블록으로 담고 워크북 뷰로 이동합니다 (자동 실행 없음)"
              >
                ▶ 블록으로 보내기
              </button>
            ) : null}
          </div>
        </header>

        {intro ? <div className="px-5 pt-2 sm:px-6">{intro}</div> : null}

        <div
          role="tablist"
          aria-label="코드 종류"
          className="flex items-center gap-1 border-b px-5 pt-2 sm:px-6"
        >
          {allTabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active.key === t.key}
              onClick={() => setTabKey(t.key)}
              className={`rounded-t border-b-2 px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                active.key === t.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {active.note ? (
            <div
              className="mb-4 rounded px-4 py-3 text-foreground/80"
              style={{
                fontSize: Math.round(13 * fontScale * 10) / 10,
                background: "color-mix(in srgb, var(--chip-cyan-bg) 55%, white)",
              }}
            >
              <span className="font-semibold text-foreground">엑셀의 Python(=PY())에서 쓰는 법</span>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 leading-[1.7] marker:text-muted-foreground">
                {(Array.isArray(active.note) ? active.note : [active.note]).map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <CodeBlock code={active.code} codeFz={13.5 * fontScale} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
