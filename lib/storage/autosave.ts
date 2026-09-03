"use client";

// 자동 저장 — 마지막 편집 2초 후 워크북 저장 + lastWorkbookId 갱신

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useWorkbookStore } from "@/lib/grid/model";
import { checkSizeGuard, workbookJsonBytes } from "@/lib/io/workbook-json";
import { isStorageDegraded, putWorkbook, saveSettings } from "@/lib/storage/db";

export type SaveStatus = "saved" | "saving" | "error";

export function useAutosave(): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>("saved");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const unsubscribe = useWorkbookStore.subscribe((state, prev) => {
      if (state.workbook === prev.workbook) return; // selection 등은 저장 대상 아님
      setStatus("saving");
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          // updatedAt은 저장 시점에만 갱신(스토어를 건드리면 다시 구독이 돌아 무한 저장)
          const wb = {
            ...useWorkbookStore.getState().workbook,
            updatedAt: new Date().toISOString(),
          };
          // §1.6 크기 가드 — ponytail: 매 저장마다 전체 직렬화 O(n). 대형 워크북에서 병목이면 셀 수 근사치로
          const verdict = checkSizeGuard(workbookJsonBytes(wb));
          if (verdict === "block") {
            toast.error(
              "워크북이 100MB를 초과해 자동 저장이 중단되었습니다. 파일 메뉴 → 저장으로 백업하세요.",
              { id: "autosave-size", duration: Infinity },
            );
            if (!disposed) setStatus("error");
            return;
          }
          if (verdict === "warn") {
            toast.warning("워크북이 50MB를 넘었습니다. 100MB부터는 자동 저장이 중단됩니다.", {
              id: "autosave-size",
            });
          }
          await putWorkbook(wb);
          await saveSettings({ lastWorkbookId: wb.id });
          if (!disposed) setStatus(isStorageDegraded() ? "error" : "saved");
        } catch {
          if (!disposed) setStatus("error");
        }
      }, 2000);
    });

    return () => {
      disposed = true;
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  return status;
}
