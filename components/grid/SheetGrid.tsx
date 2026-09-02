"use client";

// Glide Data Grid 래퍼 — 프로젝트에서 glide-data-grid를 import하는 유일한 파일

import "@glideapps/glide-data-grid/dist/index.css";
import {
  CompactSelection,
  DataEditor,
  GridCellKind,
  type EditableGridCell,
  type GridCell,
  type GridColumn,
  type GridSelection,
  type Item,
  type Theme,
} from "@glideapps/glide-data-grid";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkbookStore } from "@/lib/grid/model";
import { colToLetter } from "@/lib/grid/a1";
import { cellKey, type Cell } from "@/types/workbook";
import { formatCellDisplay } from "@/lib/grid/format";

const EMPTY_SELECTION: GridSelection = {
  columns: CompactSelection.empty(),
  rows: CompactSelection.empty(),
  current: undefined,
};

const DEFAULT_COL_WIDTH = 88;

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

export default function SheetGrid() {
  const sheet = useWorkbookStore(
    (s) => s.workbook.sheets.find((sh) => sh.id === s.activeSheetId) ?? s.workbook.sheets[0],
  );
  const [gridSelection, setGridSelection] = useState<GridSelection>(EMPTY_SELECTION);

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

  const theme = useMemo<Partial<Theme>>(
    () => ({
      accentColor: "#4A90C2",
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
      const cell = sheet.cells[cellKey(row, col)];
      if (!cell) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: true };
      }
      const locked = !!cell.src;
      const contentAlign =
        cell.t === "n" ? "right" : cell.t === "b" || cell.t === "d" ? "center" : "left";
      const themeOverride: Partial<Theme> | undefined =
        cell.t === "e"
          ? { textDark: "#C2504A" }
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
    [sheet],
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

  return (
    <div className="min-h-0 min-w-0 flex-1">
      <DataEditor
        columns={columns}
        rows={sheet.rowCount}
        getCellContent={getCellContent}
        onCellEdited={onCellEdited}
        gridSelection={gridSelection}
        onGridSelectionChange={onGridSelectionChange}
        onDelete={onDelete}
        onColumnResize={onColumnResize}
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
    </div>
  );
}
