"use client";

// 파일 메뉴 — 새 워크북·열기·저장·내보내기·샘플·최근 워크북 (§1.5, §4.4 FileMenu)

import { useRef, useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { toast } from "sonner";
import lifeTableSample from "@/data/sample-workbooks/life-table.pygrid.json";
import lossRatioSample from "@/data/sample-workbooks/loss-ratio.pygrid.json";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkbookStore } from "@/lib/grid/model";
import {
  downloadBlob,
  downloadWorkbookJson,
  parseWorkbookJson,
} from "@/lib/io/workbook-json";
// SheetJS(~140kB gz)는 첫 페인트를 막지 않도록 사용 시점에 동적 로드한다
import { listWorkbooks, getWorkbook } from "@/lib/storage/db";
import { createWorkbook } from "@/lib/grid/model";
import type { Workbook } from "@/types/workbook";

/** 샘플/파일 워크북 로드 — 파일의 id 유지(최근 목록 중복 시 덮어씀, 단순 규칙) */
export function loadWorkbookData(wb: Workbook): void {
  useWorkbookStore.getState().loadWorkbook(structuredClone(wb));
}

export const SAMPLE_LIFE_TABLE = lifeTableSample as unknown as Workbook;
export const SAMPLE_LOSS_RATIO = lossRatioSample as unknown as Workbook;

/** 확장자별 열기 — FileMenu 선택·드래그 앤 드롭 공용 */
export async function openWorkbookFile(file: File): Promise<void> {
  const name = file.name.toLowerCase();
  try {
    if (name.endsWith(".pygrid.json") || name.endsWith(".json")) {
      loadWorkbookData(parseWorkbookJson(await file.text()));
    } else if (name.endsWith(".csv")) {
      const { csvToSheet } = await import("@/lib/io/csv");
      const sheet = csvToSheet(await file.text(), file.name.replace(/\.csv$/i, ""));
      const wb = createWorkbook();
      wb.title = file.name.replace(/\.csv$/i, "");
      wb.sheets = [sheet];
      useWorkbookStore.getState().loadWorkbook(wb);
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const { sheetsFromFileData } = await import("@/lib/io/xlsx");
      const sheets = sheetsFromFileData(await file.arrayBuffer());
      if (sheets.length === 0) throw new Error("시트가 없습니다");
      const wb = createWorkbook();
      wb.title = file.name.replace(/\.(xlsx|xls)$/i, "");
      wb.sheets = sheets;
      useWorkbookStore.getState().loadWorkbook(wb);
    } else {
      toast.error("지원하지 않는 파일 형식입니다 (.pygrid.json / .csv / .xlsx)");
      return;
    }
    toast(`"${file.name}"을(를) 열었습니다`);
  } catch (e) {
    toast.error(`파일 열기 실패: ${(e as Error).message}`);
  }
}

export default function FileMenu() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [recent, setRecent] = useState<Workbook[]>([]);

  const save = () => {
    const verdict = downloadWorkbookJson(useWorkbookStore.getState().workbook);
    if (verdict === "warn") {
      toast.warning("워크북이 50MB를 넘습니다. 데이터 시트를 나누는 것을 권장합니다.");
    }
  };

  const exportXlsx = async () => {
    const { sheetsToXlsxBlob } = await import("@/lib/io/xlsx");
    const wb = useWorkbookStore.getState().workbook;
    downloadBlob(sheetsToXlsxBlob(wb.sheets), `${wb.title || "워크북"}.xlsx`);
  };

  const exportCsv = async () => {
    const { sheetToCsv } = await import("@/lib/io/csv");
    const st = useWorkbookStore.getState();
    const sheet = st.workbook.sheets.find((s) => s.id === st.activeSheetId);
    if (!sheet) return;
    downloadBlob(
      new Blob(["﻿" + sheetToCsv(sheet)], { type: "text/csv;charset=utf-8" }), // BOM: Excel 한글 인식
      `${sheet.name}.csv`,
    );
  };

  const refreshRecent = () => {
    void listWorkbooks().then((list) => setRecent(list.slice(0, 10)));
  };

  const openRecent = async (id: string) => {
    const wb = await getWorkbook(id);
    if (wb) useWorkbookStore.getState().loadWorkbook(wb);
    else toast.error("워크북을 찾을 수 없습니다 (저장소에서 정리됨)");
  };

  const currentId = useWorkbookStore((s) => s.workbook.id);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".json,.csv,.xlsx,.xls"
        className="hidden"
        aria-label="워크북 파일 열기"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void openWorkbookFile(file);
          e.target.value = ""; // 같은 파일 재선택 허용
        }}
      />
      <DropdownMenu onOpenChange={(open) => open && refreshRecent()}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1">
            파일 <CaretDown className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onClick={() => useWorkbookStore.getState().newWorkbook()}>
            새 워크북
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => inputRef.current?.click()}>
            열기… (.pygrid.json / .csv / .xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={save}>저장 (.pygrid.json)</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void exportXlsx()}>
            XLSX로 내보내기 (전 시트)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void exportCsv()}>
            CSV로 내보내기 (활성 시트)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => loadWorkbookData(SAMPLE_LIFE_TABLE)}>
            샘플: 생명표
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => loadWorkbookData(SAMPLE_LOSS_RATIO)}>
            샘플: 손해율 집계
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>최근 워크북</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 w-64 overflow-y-auto">
              {recent.length === 0 ? (
                <DropdownMenuItem disabled>저장된 워크북 없음</DropdownMenuItem>
              ) : (
                recent.map((wb) => (
                  <DropdownMenuItem key={wb.id} onClick={() => void openRecent(wb.id)}>
                    <div className="min-w-0">
                      <div className="truncate text-xs">
                        {wb.id === currentId ? "● " : ""}
                        {wb.title}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {wb.updatedAt.slice(0, 16).replace("T", " ")}
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
