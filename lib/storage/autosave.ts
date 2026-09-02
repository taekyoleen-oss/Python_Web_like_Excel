"use client";

// 자동 저장 — 마지막 편집 2초 후 워크북 저장 + lastWorkbookId 갱신

import { useEffect, useState } from "react";
import { useWorkbookStore } from "@/lib/grid/model";
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
