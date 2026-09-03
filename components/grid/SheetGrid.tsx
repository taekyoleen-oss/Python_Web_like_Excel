"use client";

// Glide Data Grid 래퍼 — 프로젝트에서 glide-data-grid를 import하는 유일한 파일

import "@glideapps/glide-data-grid/dist/index.css";
import {
  CompactSelection,
  DataEditor,
  GridCellKind,
  type DrawCellCallback,
  type EditableGridCell,
  type GridCell,
  type GridColumn,
  type GridMouseEventArgs,
  type GridSelection,
  type Item,
  type Theme,
} from "@glideapps/glide-data-grid";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { colToLetter, formatA1 } from "@/lib/grid/a1";
import { formatCellDisplay } from "@/lib/grid/format";
import { useWorkbookStore } from "@/lib/grid/model";
import { cellKey, type Cell, type CellRange, type PyBlock } from "@/types/workbook";

const EMPTY_SELECTION: GridSelection = {
  columns: CompactSelection.empty(),
  rows: CompactSelection.empty(),
  current: undefined,
};

const DEFAULT_COL_WIDTH = 88;
const PRIMARY = "#4A90C2";
const WARNING = "#D9A441";
const DESTRUCTIVE = "#C2504A";

/** 단일 셀 편집 시 단순 유형 추론: 숫자 → n, TRUE/FALSE → b, 나머지 문자열 */
function inferCell(text: string): Cell | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (/^(true|false)$/i.test(trimmed)) {
    return { v: trimmed.toLowerCase() === "true", t: "b" };
  }
  const n = Number(trimmed);
  if (!Number.isNaN(n)) return { v: n, t: "n" };
  return { v: text, t: "s" };
}

const inRange = (rg: CellRange, r: number, c: number): boolean =>
  r >= rg.r0 && r <= rg.r1 && c >= rg.c0 && c <= rg.c1;

export default function SheetGrid() {
  const sheet = useWorkbookStore(
    (s) => s.workbook.sheets.find((sh) => sh.id === s.activeSheetId) ?? s.workbook.sheets[0],
  );
  const pyBlocks = useWorkbookStore((s) => s.workbook.pyBlocks);
  const runningBlocks = useWorkbookStore((s) => s.runningBlocks);
  const flash = useWorkbookStore((s) => s.flash);
  const [gridSelection, setGridSelection] = useState<GridSelection>(EMPTY_SELECTION);
  const [menuCell, setMenuCell] = useState<{ r: number; c: number } | null>(null);
  const [hoverTip, setHoverTip] = useState<{ x: number; y: number; text: string } | null>(null);

  // 시트 전환 시 선택 초기화
  useEffect(() => {
    setGridSelection(EMPTY_SELECTION);
  }, [sheet.id]);

  // canvas는 CSS 변수를 못 쓰므로 body에서 실제 폰트 패밀리를 읽는다
  const [fontFamily, setFontFamily] = useState("Pretendard, sans-serif");
  useEffect(() => {
    const f = getComputedStyle(document.body).fontFamily;
    if (f) setFontFamily(f);
  }, []);

  /** 활성 시트의 앵커 → 블록 */
  const anchorMap = useMemo(() => {
    const map = new Map<string, PyBlock>();
    for (const b of pyBlocks) {
      if (b.sheetId === sheet.id) map.set(cellKey(b.anchor.r, b.anchor.c), b);
    }
    return map;
  }, [pyBlocks, sheet.id]);

  const blockById = useMemo(
    () => new Map(pyBlocks.map((b) => [b.id, b])),
    [pyBlocks],
  );

  /** 활성 시트의 spill 테두리 범위 */
  const spillRanges = useMemo(
    () =>
      pyBlocks
        .filter(
          (b) => b.sheetId === sheet.id && b.last?.status === "ok" && b.last.spillRange,
        )
        .map((b) => b.last!.spillRange!),
    [pyBlocks, sheet.id],
  );

  const flashRange = flash && flash.sheetId === sheet.id ? flash.range : null;

  const theme = useMemo<Partial<Theme>>(
    () => ({
      accentColor: PRIMARY,
      accentLight: "#EAF3FA",
      borderColor: "#E2E5E9",
      horizontalBorderColor: "#E2E5E9",
      bgCell: "#FFFFFF",
      bgHeader: "#F1F3F5",
      bgHeaderHovered: "#E9ECEF",
      bgHeaderHasFocus: "#EAF3FA",
      textDark: "#23272E",
      textHeader: "#5A6472",
      textLight: "#6B7280",
      fontFamily,
      baseFontStyle: "13px",
      headerFontStyle: "600 12px",
      cellHorizontalPadding: 8,
      cellVerticalPadding: 3,
    }),
    [fontFamily],
  );

  const columns = useMemo<GridColumn[]>(
    () =>
      Array.from({ length: sheet.colCount }, (_, i) => ({
        id: String(i),
        title: colToLetter(i),
        width: sheet.colWidths?.[i] ?? DEFAULT_COL_WIDTH,
      })),
    [sheet.colCount, sheet.colWidths],
  );

  const getCellContent = useCallback(
    (item: Item): GridCell => {
      const [col, row] = item;
      const key = cellKey(row, col);
      const cell = sheet.cells[key];
      const anchorBlock = anchorMap.get(key);

      // 실행 중 앵커: #BUSY! (렌더 전용 — 스토어 셀은 건드리지 않는다)
      if (anchorBlock && runningBlocks[anchorBlock.id]) {
        return {
          kind: GridCellKind.Text,
          data: "#BUSY!",
          displayData: "#BUSY!",
          allowOverlay: false,
          readonly: true,
          contentAlign: "center",
          themeOverride: { textDark: WARNING },
        };
      }
      if (!cell) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: true };
      }
      const locked = !!cell.src;
      // 객체 카드 앵커: drawCell이 카드를 그린다 (기본 텍스트는 비움)
      if (
        anchorBlock &&
        anchorBlock.outputMode === "object" &&
        anchorBlock.last?.status === "ok" &&
        cell.src === anchorBlock.id
      ) {
        return {
          kind: GridCellKind.Text,
          data: String(cell.v ?? ""),
          displayData: "",
          allowOverlay: false,
          readonly: true,
        };
      }
      const contentAlign =
        cell.t === "n" ? "right" : cell.t === "b" || cell.t === "d" ? "center" : "left";
      const themeOverride: Partial<Theme> | undefined =
        cell.t === "e"
          ? { textDark: DESTRUCTIVE }
          : locked
            ? { bgCell: "#EAF3FA" }
            : undefined;
      return {
        kind: GridCellKind.Text,
        data:
          typeof cell.v === "boolean" ? (cell.v ? "TRUE" : "FALSE") : String(cell.v ?? ""),
        displayData: formatCellDisplay(cell),
        allowOverlay: !locked,
        readonly: locked,
        contentAlign,
        themeOverride,
      };
    },
    [sheet, anchorMap, runningBlocks],
  );

  /** 오버레이: [PY] 배지, spill 테두리, 성공 플래시, 객체 카드 */
  const drawCell = useCallback<DrawCellCallback>(
    (args, drawContent) => {
      const { ctx, rect, col, row } = args;
      const key = cellKey(row, col);
      const anchorBlock = anchorMap.get(key);
      const storeCell = sheet.cells[key];
      const isCard =
        anchorBlock &&
        anchorBlock.outputMode === "object" &&
        anchorBlock.last?.status === "ok" &&
        storeCell?.src === anchorBlock.id &&
        !runningBlocks[anchorBlock.id];

      drawContent();

      if (isCard && storeCell) {
        // 객체 카드: 연한 배경 + 아이콘 + 모노 라벨
        ctx.save();
        ctx.fillStyle = "#EAF3FA";
        ctx.fillRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
        ctx.strokeStyle = PRIMARY;
        ctx.lineWidth = 1;
        ctx.strokeRect(rect.x + 2.5, rect.y + 2.5, rect.width - 5, rect.height - 5);
        ctx.fillStyle = "#23272E";
        ctx.font = `11px "JetBrains Mono", monospace`;
        ctx.textBaseline = "middle";
        ctx.fillText(
          `▤ ${String(storeCell.v ?? "")}`,
          rect.x + 6,
          rect.y + rect.height / 2,
          rect.width - 12,
        );
        ctx.restore();
      }

      // spill 파란 테두리 (범위 경계 변만)
      for (const rg of spillRanges) {
        if (!inRange(rg, row, col)) continue;
        ctx.save();
        ctx.strokeStyle = PRIMARY;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (row === rg.r0) {
          ctx.moveTo(rect.x, rect.y + 1);
          ctx.lineTo(rect.x + rect.width, rect.y + 1);
        }
        if (row === rg.r1) {
          ctx.moveTo(rect.x, rect.y + rect.height - 1);
          ctx.lineTo(rect.x + rect.width, rect.y + rect.height - 1);
        }
        if (col === rg.c0) {
          ctx.moveTo(rect.x + 1, rect.y);
          ctx.lineTo(rect.x + 1, rect.y + rect.height);
        }
        if (col === rg.c1) {
          ctx.moveTo(rect.x + rect.width - 1, rect.y);
          ctx.lineTo(rect.x + rect.width - 1, rect.y + rect.height);
        }
        ctx.stroke();
        ctx.restore();
      }

      // 성공 플래시 (400ms)
      if (flashRange && inRange(flashRange, row, col)) {
        ctx.save();
        ctx.fillStyle = "rgba(74, 144, 194, 0.18)";
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        ctx.restore();
      }

      // [PY] 앵커 배지 (우상단 칩)
      if (anchorBlock) {
        ctx.save();
        const w = 22;
        const h = 11;
        const x = rect.x + rect.width - w - 2;
        const y = rect.y + 2;
        ctx.fillStyle = PRIMARY;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 2);
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.font = `700 7px "JetBrains Mono", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("PY", x + w / 2, y + h / 2 + 0.5);
        ctx.restore();
      }
    },
    [anchorMap, sheet.cells, spillRanges, flashRange, runningBlocks],
  );

  const onCellEdited = useCallback(
    (item: Item, newValue: EditableGridCell) => {
      if (newValue.kind !== GridCellKind.Text) return;
      const [col, row] = item;
      useWorkbookStore.getState().setCellValue(sheet.id, row, col, inferCell(newValue.data));
    },
    [sheet.id],
  );

  const onGridSelectionChange = useCallback(
    (sel: GridSelection) => {
      setGridSelection(sel);
      const store = useWorkbookStore.getState();
      if (sel.current) {
        const r = sel.current.range;
        store.setSelection({ r0: r.y, c0: r.x, r1: r.y + r.height - 1, c1: r.x + r.width - 1 });
      } else if (sel.columns.length > 0) {
        const first = sel.columns.first();
        const last = sel.columns.last();
        if (first !== undefined && last !== undefined) {
          store.setSelection({ r0: 0, c0: first, r1: sheet.rowCount - 1, c1: last });
        }
      } else if (sel.rows.length > 0) {
        const first = sel.rows.first();
        const last = sel.rows.last();
        if (first !== undefined && last !== undefined) {
          store.setSelection({ r0: first, c0: 0, r1: last, c1: sheet.colCount - 1 });
        }
      } else {
        store.setSelection(null);
      }
    },
    [sheet.rowCount, sheet.colCount],
  );

  const onDelete = useCallback(
    (sel: GridSelection): boolean => {
      const store = useWorkbookStore.getState();
      if (sel.current) {
        for (const r of [sel.current.range, ...sel.current.rangeStack]) {
          store.clearRange(sheet.id, {
            r0: r.y,
            c0: r.x,
            r1: r.y + r.height - 1,
            c1: r.x + r.width - 1,
          });
        }
      }
      // ponytail: 행/열 헤더 선택은 행·열마다 clearRange 한 번 — 대량 선택이 느려지면 단일 패스로
      for (const r of sel.rows) {
        store.clearRange(sheet.id, { r0: r, c0: 0, r1: r, c1: sheet.colCount - 1 });
      }
      for (const c of sel.columns) {
        store.clearRange(sheet.id, { r0: 0, c0: c, r1: sheet.rowCount - 1, c1: c });
      }
      return false; // 삭제는 스토어에서 처리했으므로 glide 기본 동작 차단
    },
    [sheet.id, sheet.rowCount, sheet.colCount],
  );

  const onColumnResize = useCallback(
    (_column: GridColumn, newSize: number, colIndex: number) => {
      useWorkbookStore.getState().setColWidth(sheet.id, colIndex, newSize);
    },
    [sheet.id],
  );

  /** 우클릭: 셀 기록(+선택 이동). radix ContextMenu가 메뉴를 연다 */
  const onCellContextMenu = useCallback(
    (item: Item) => {
      const [col, row] = item;
      setMenuCell({ r: row, c: col });
      const store = useWorkbookStore.getState();
      if (!store.selection || !inRange(store.selection, row, col)) {
        store.setSelection({ r0: row, c0: col, r1: row, c1: col });
        setGridSelection({
          columns: CompactSelection.empty(),
          rows: CompactSelection.empty(),
          current: {
            cell: [col, row],
            range: { x: col, y: row, width: 1, height: 1 },
            rangeStack: [],
          },
        });
      }
    },
    [],
  );

  /** 오류 셀 hover → 한국어 요약 툴팁 */
  const onItemHovered = useCallback(
    (args: GridMouseEventArgs) => {
      if (args.kind !== "cell") {
        setHoverTip(null);
        return;
      }
      const [col, row] = args.location;
      const cell = sheet.cells[cellKey(row, col)];
      if (!cell || cell.t !== "e" || !cell.src) {
        setHoverTip(null);
        return;
      }
      const summary = blockById.get(cell.src)?.last?.summaryKo;
      if (!summary) {
        setHoverTip(null);
        return;
      }
      setHoverTip({
        x: args.bounds.x,
        y: args.bounds.y + args.bounds.height + 4,
        text: summary,
      });
    },
    [sheet.cells, blockById],
  );

  // 컨텍스트 메뉴 항목용 정보
  const menuBlock = menuCell
    ? (anchorMap.get(cellKey(menuCell.r, menuCell.c)) ??
      (sheet.cells[cellKey(menuCell.r, menuCell.c)]?.src
        ? blockById.get(sheet.cells[cellKey(menuCell.r, menuCell.c)]!.src!)
        : undefined))
    : undefined;

  const copyRef = () => {
    const sel = useWorkbookStore.getState().selection;
    const range = sel ?? (menuCell ? { r0: menuCell.r, c0: menuCell.c, r1: menuCell.r, c1: menuCell.c } : null);
    if (range) void navigator.clipboard.writeText(formatA1(range));
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="relative min-h-0 min-w-0 flex-1">
          <DataEditor
            columns={columns}
            rows={sheet.rowCount}
            getCellContent={getCellContent}
            onCellEdited={onCellEdited}
            gridSelection={gridSelection}
            onGridSelectionChange={onGridSelectionChange}
            onDelete={onDelete}
            onColumnResize={onColumnResize}
            onCellContextMenu={onCellContextMenu}
            onItemHovered={onItemHovered}
            drawCell={drawCell}
            freezeColumns={sheet.frozenCols ?? 0}
            rowMarkers="number"
            getCellsForSelection={true}
            keybindings={{ copy: false, cut: false, paste: false }} // 복사·붙여넣기는 WorkbookShell이 소유
            smoothScrollX
            smoothScrollY
            width="100%"
            height="100%"
            theme={theme}
          />
          {hoverTip && (
            <div
              className="pointer-events-none absolute z-20 max-w-72 rounded border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
              style={{ left: hoverTip.x, top: hoverTip.y }}
            >
              {hoverTip.text}
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {menuBlock && (
          <>
            <ContextMenuItem
              onClick={() =>
                useWorkbookStore
                  .getState()
                  .setBlockOutputMode(
                    menuBlock.id,
                    menuBlock.outputMode === "values" ? "object" : "values",
                  )
              }
            >
              Python 출력 →{" "}
              {menuBlock.outputMode === "values" ? "Python 객체" : "Excel 값"}
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => useWorkbookStore.getState().setFocusBlock(menuBlock.id)}
            >
              블록으로 이동
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem onClick={copyRef}>참조 복사</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
