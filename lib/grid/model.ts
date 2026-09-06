// 워크북 Zustand 스토어 — immer(불변 편집) + zundo(undo/redo, workbook만 이력에 포함)

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { temporal } from "zundo";
import { setAutoFreeze } from "immer";
import throttle from "lodash/throttle";
import {
  cellKey,
  parseCellKey,
  type BlockKind,
  type CalcMode,
  type Cell,
  type CellRange,
  type IncludeIndex,
  type OutputMode,
  type OutputSelection,
  type PyBlock,
  type RunResult,
  type Sheet,
  type Workbook,
} from "@/types/workbook";
import { colToLetter } from "./a1";
import { markdownTitle } from "./markdown";
import {
  newId,
  normalizeBlock,
  normalizeWorkbook,
  outputsOf,
  srcBlockId,
  srcTag,
  syncLegacy,
} from "./outputs";
import { checkSpillConflict } from "./spill";

// 10k×50 셀 워크북을 deep-freeze하면 로드가 수 초 걸린다. 모든 변경은 스토어 액션 경유.
setAutoFreeze(false);

export const createSheet = (name: string): Sheet => ({
  id: newId(),
  name,
  rowCount: 200,
  colCount: 26,
  cells: {},
});

export const createWorkbook = (): Workbook => {
  const now = new Date().toISOString();
  return {
    id: newId(),
    version: 1,
    title: "새 워크북",
    sheets: [createSheet("Sheet1")],
    pyBlocks: [],
    initScript: "",
    calcMode: "auto",
    settings: { timeoutSec: 60, inferTypesOnPaste: true },
    createdAt: now,
    updatedAt: now,
  };
};

/** 기본 계산 순서: 시트 순 → 앵커 행 → 열 (패널 나열·↑↓ 자리 교환 공용) */
export function blocksInOrder(workbook: Workbook): PyBlock[] {
  const sheetIndex = new Map(workbook.sheets.map((s, i) => [s.id, i]));
  return [...workbook.pyBlocks].sort(
    (a, b) =>
      (sheetIndex.get(a.sheetId) ?? 0) - (sheetIndex.get(b.sheetId) ?? 0) ||
      a.anchor.r - b.anchor.r ||
      a.anchor.c - b.anchor.c,
  );
}

export interface CellEdit {
  r: number;
  c: number;
  cell: Cell | null;
}

/** 한 출력의 실행 반영 단위 (applyOutputResults) */
export interface OutputApply {
  outputId: string;
  /** 출력 앵커부터 기록할 셀. 실패·충돌은 1×1 오류 셀 */
  cells: Cell[][];
  /** 이전 spill 제거 (성공 시에만 교체 — 설계서 §4) */
  clearPrevious?: boolean;
  last?: RunResult;
}

/** 출력 위치 지정 중인 대상 (다음 그리드 클릭이 이 출력의 앵커가 된다) */
export interface AnchorPickTarget {
  blockId: string;
  outputId: string;
}

/** 지정 출력(outputId 생략 시 블록 전체)의 spill 셀 제거 — 다른 시트 출력까지 훑는다 */
function clearSpillCells(wb: Workbook, blockId: string, outputId?: string): void {
  const tag = outputId === undefined ? undefined : srcTag(blockId, outputId);
  for (const sheet of wb.sheets) {
    for (const key of Object.keys(sheet.cells)) {
      const src = sheet.cells[key].src;
      if (!src) continue;
      if (tag ? src === tag : srcBlockId(src) === blockId) delete sheet.cells[key];
    }
  }
}

/** 새 출력·블록 자리 찾기용: 값·spill·블록 앵커·다른 출력 앵커가 있으면 쓸 수 없다 */
export function cellTaken(sheet: Sheet, blocks: PyBlock[], r: number, c: number): boolean {
  const cell = sheet.cells[cellKey(r, c)];
  if (cell && (cell.src || (cell.v !== null && cell.v !== ""))) return true;
  return blocks.some(
    (b) =>
      (b.sheetId === sheet.id && b.anchor.r === r && b.anchor.c === c) ||
      outputsOf(b).some(
        (o) => (o.sheetId ?? b.sheetId) === sheet.id && o.anchor.r === r && o.anchor.c === c,
      ),
  );
}

export interface WorkbookState {
  workbook: Workbook;
  activeSheetId: string;
  selection: CellRange | null;
  /** 실행 중 블록 표시(#BUSY! 렌더) — workbook 밖이라 undo 이력에 안 남는다 */
  runningBlocks: Record<string, true>;
  /** 실행 성공 400ms 플래시 범위 (렌더 전용) */
  flash: { sheetId: string; range: CellRange } | null;
  /** Python 패널에서 포커스할 블록 (블록 추가 직후) */
  focusBlockId: string | null;
  /** 재실행 필요 블록(수동 모드 배지) — workbook 밖 transient */
  dirtyBlocks: Record<string, true>;
  /** 편집기 xl() 커서 → 그리드 점선 하이라이트 (§4.8) */
  hoverRange: { sheetId: string; range: CellRange } | null;
  /** 그리드 spill hover → 블록 카드 강조 (§4.8 역방향) */
  hoverBlockId: string | null;
  /** 출력 미리보기 탭 대상 블록 */
  selectedBlockId: string | null;
  /** 하단 패널 활성 탭 */
  bottomTab: "diagnostics" | "preview" | "variables" | "console";
  /** 마지막으로 포커스된 블록 편집기 (참조 삽입·스니펫 대상) */
  lastEditorBlockId: string | null;
  /** 출력 위치 지정 중인 출력 — 다음 그리드 클릭이 앵커가 된다 (transient) */
  anchorPicking: AnchorPickTarget | null;
  /** 목차 패널 열림 (설정에 저장, undo 대상 아님) */
  tocOpen: boolean;
  /** 상단 뷰 전환 — 워크북 | 데이터 예제/분석 (부록 E, 설정에 저장, undo 대상 아님) */
  view: "workbook" | "reference";
  /** spill 잠김(src) 셀이면 false를 반환하고 아무것도 바꾸지 않는다 */
  setCellValue: (sheetId: string, r: number, c: number, cell: Cell | null) => boolean;
  /** 일괄 편집 = 한 트랜잭션 = 한 undo 단계 */
  setCells: (sheetId: string, edits: CellEdit[]) => void;
  clearRange: (sheetId: string, range: CellRange) => void;
  insertRows: (sheetId: string, index: number, count: number) => void;
  insertCols: (sheetId: string, index: number, count: number) => void;
  deleteRows: (sheetId: string, index: number, count: number) => void;
  deleteCols: (sheetId: string, index: number, count: number) => void;
  addSheet: () => void;
  /** 새 시트 생성 + 셀 채우기를 한 트랜잭션(= 한 undo 단계)으로 */
  addSheetWithCells: (edits: CellEdit[]) => void;
  renameSheet: (sheetId: string, name: string) => void;
  removeSheet: (sheetId: string) => void;
  moveSheet: (sheetId: string, offset: number) => void;
  setColWidth: (sheetId: string, col: number, width: number) => void;
  setFrozenCols: (sheetId: string, n: number) => void;
  setTitle: (title: string) => void;
  setSelection: (range: CellRange | null) => void;
  setActiveSheet: (id: string) => void;
  newWorkbook: () => void;
  loadWorkbook: (wb: Workbook) => void;
  /** 블록 생성. 앵커에 이미 블록·spill 셀이 있으면 null */
  addPyBlock: (
    sheetId: string,
    anchor: { r: number; c: number },
    kind?: BlockKind,
  ) => string | null;
  /**
   * 앵커 재지정 — 한 트랜잭션(= 한 undo 단계).
   * 이전 spill(src===id) 제거 + 앵커(·시트) 이동 + dirty 표시.
   * 충돌하면 아무것도 바꾸지 않고 한국어 사유를 반환한다.
   */
  setBlockAnchor: (
    id: string,
    anchor: { r: number; c: number },
    sheetId?: string,
  ) => string | null;
  /**
   * ↑↓ 자리 교환 — 계산 순서상 이웃 블록과 {sheetId, anchor}를 맞바꾼다(= 실행 순서 변경).
   * 한 트랜잭션: 두 블록의 spill 제거 + 자리 교환 + 양쪽 dirty.
   * 반환값은 교환한 상대 블록 id (경계에서 교환하지 않으면 null).
   */
  swapBlockOrder: (id: string, direction: "up" | "down") => string | null;
  /** 블록 + 그 spill 셀 제거 (한 트랜잭션) */
  removePyBlock: (id: string) => void;
  setBlockCode: (id: string, code: string) => void;
  /** outputs[0]의 출력 모드 (레거시 뷰) */
  setBlockOutputMode: (id: string, mode: OutputMode) => void;
  /** outputs[0]의 출력 선택 병합. 값이 undefined인 키는 제거된다 (레거시 뷰) */
  setBlockOutput: (id: string, patch: OutputSelection) => void;
  /** 출력 추가 — 블록 근처 빈 셀에 기본 바인딩(마지막 표현식·값 모드). 반환: 새 출력 id */
  addOutput: (blockId: string) => string | null;
  /** 출력 삭제 — 그 출력의 spill 셀을 같은 트랜잭션에서 지운다. 마지막 하나는 거부 */
  removeOutput: (blockId: string, outputId: string) => void;
  /**
   * 출력 앵커 재지정 — 한 트랜잭션(= 한 undo 단계).
   * 이 출력의 이전 spill 제거 + 앵커(·시트) 이동 + dirty 표시. 충돌하면 한국어 사유 반환.
   */
  setOutputAnchor: (
    blockId: string,
    outputId: string,
    target: { sheetId?: string; r: number; c: number },
  ) => string | null;
  setOutputSelection: (blockId: string, outputId: string, patch: OutputSelection) => void;
  setOutputMode: (blockId: string, outputId: string, mode: OutputMode) => void;
  setOutputIncludeIndex: (blockId: string, outputId: string, value: IncludeIndex) => void;
  setOutputLabel: (blockId: string, outputId: string, label: string) => void;
  /** 한 실행의 모든 출력 반영 — 한 트랜잭션(= 한 undo 단계) */
  applyOutputResults: (blockId: string, results: OutputApply[]) => void;
  /** 이미지 blob 사후 패치 — 비동기 저장 완료 후 last.imageBlobId만 갱신 (히스토리 무관) */
  patchOutputImage: (blockId: string, outputId: string, imageBlobId: string) => void;
  setBlockMarkdown: (id: string, markdown: string) => void;
  setBlockTitle: (id: string, title: string) => void;
  setBlockCollapsed: (id: string, collapsed: boolean) => void;
  /** 패널 헤더 '모두 접기/펼치기' */
  setAllCollapsed: (collapsed: boolean) => void;
  /**
   * outputs[0] 결과 반영 (레거시 단일 출력 경로) — applyOutputResults의 얇은 래퍼.
   * 실패(#PYTHON!)·충돌(#SPILL!)은 앵커 1셀만 쓰고 이전 spill은 유지한다(설계서 §4: 성공 시에만 교체).
   */
  applyBlockResult: (
    blockId: string,
    cells: Cell[][],
    opts?: { last?: RunResult; clearPrevious?: boolean },
  ) => void;
  setBlockRunning: (id: string, running: boolean) => void;
  setFlash: (flash: { sheetId: string; range: CellRange } | null) => void;
  setFocusBlock: (id: string | null) => void;
  markDirty: (ids: string[]) => void;
  clearDirty: (id: string) => void;
  setCalcMode: (mode: CalcMode) => void;
  setInitScript: (script: string) => void;
  setHoverRange: (hover: { sheetId: string; range: CellRange } | null) => void;
  setHoverBlock: (id: string | null) => void;
  setSelectedBlock: (id: string | null) => void;
  setBottomTab: (tab: WorkbookState["bottomTab"]) => void;
  setLastEditorBlock: (id: string | null) => void;
  setAnchorPicking: (target: AnchorPickTarget | null) => void;
  setTocOpen: (open: boolean) => void;
  setView: (view: "workbook" | "reference") => void;
}

const norm = (rg: CellRange): CellRange => ({
  r0: Math.min(rg.r0, rg.r1),
  c0: Math.min(rg.c0, rg.c1),
  r1: Math.max(rg.r0, rg.r1),
  c1: Math.max(rg.c0, rg.c1),
});

/** cells 레코드 키 재배치. map이 null을 반환하면 그 셀은 삭제된다 */
function remapCells(
  cells: Record<string, Cell>,
  map: (r: number, c: number) => [number, number] | null,
): Record<string, Cell> {
  const next: Record<string, Cell> = {};
  for (const key of Object.keys(cells)) {
    const { r, c } = parseCellKey(key);
    const to = map(r, c);
    if (to) next[cellKey(to[0], to[1])] = cells[key];
  }
  return next;
}

function remapWidths(
  widths: Record<number, number> | undefined,
  map: (c: number) => number | null,
): Record<number, number> | undefined {
  if (!widths) return widths;
  const next: Record<number, number> = {};
  for (const k of Object.keys(widths)) {
    const c = Number(k);
    const to = map(c);
    if (to !== null) next[to] = widths[c];
  }
  return next;
}

export const createWorkbookStore = () => {
  // partialize 메모화: workbook 참조가 같으면 같은 스냅샷 객체를 반환해
  // equality(===)로 selection/activeSheet 변경을 이력에서 제외한다.
  // 이력에서 빼는 블록 필드: last(실행 결과)·collapsed(카드 접기) — 문서 내용이 아니다.
  // 출력별 last도 같은 이유로 제외한다(실행 결과가 undo 단계를 만들지 않게).
  const stripBlocks = (blocks: PyBlock[]) =>
    blocks.map(({ last: _last, collapsed: _collapsed, outputs, ...b }) =>
      outputs ? { ...b, outputs: outputs.map(({ last: _l, ...o }) => o) } : b,
    );

  /** 이력에 남길 변경이 없으면 true — 접기 토글만으로 undo 단계가 생기지 않게 한다 */
  const sameHistory = (a: Workbook, b: Workbook): boolean => {
    for (const k of Object.keys(a) as (keyof Workbook)[]) {
      if (k !== "pyBlocks" && a[k] !== b[k]) return false;
    }
    return JSON.stringify(a.pyBlocks) === JSON.stringify(b.pyBlocks);
  };

  let cacheWb: Workbook | undefined;
  let cacheSnap: { workbook: Workbook } | undefined;
  const partialize = (s: WorkbookState): { workbook: Workbook } => {
    if (cacheWb === s.workbook && cacheSnap) return cacheSnap;
    cacheWb = s.workbook;
    const next = {
      workbook: { ...s.workbook, pyBlocks: stripBlocks(s.workbook.pyBlocks) },
    };
    if (!cacheSnap || !sameHistory(cacheSnap.workbook, next.workbook)) cacheSnap = next;
    return cacheSnap;
  };

  let cancelPending: () => void = () => {};
  let resetHistory: () => void = () => {};

  const store = create<WorkbookState>()(
    temporal(
      immer((set, get) => {
        const wb = createWorkbook();

        const mutateSheet = (sheetId: string, fn: (sheet: Sheet) => void) =>
          set((state) => {
            const sheet = state.workbook.sheets.find((s) => s.id === sheetId);
            if (sheet) fn(sheet);
          });

        return {
          workbook: wb,
          activeSheetId: wb.sheets[0].id,
          selection: null,
          runningBlocks: {},
          flash: null,
          focusBlockId: null,
          dirtyBlocks: {},
          hoverRange: null,
          hoverBlockId: null,
          selectedBlockId: null,
          bottomTab: "diagnostics" as const,
          lastEditorBlockId: null,
          anchorPicking: null,
          tocOpen: false,
          view: "workbook" as const,

          setCellValue: (sheetId, r, c, cell) => {
            const sheet = get().workbook.sheets.find((s) => s.id === sheetId);
            if (!sheet) return false;
            const key = cellKey(r, c);
            if (sheet.cells[key]?.src) return false; // spill 셀은 직접 편집 금지
            mutateSheet(sheetId, (sh) => {
              if (cell === null) delete sh.cells[key];
              else sh.cells[key] = cell;
              if (r >= sh.rowCount) sh.rowCount = r + 1;
              if (c >= sh.colCount) sh.colCount = c + 1;
            });
            return true;
          },

          setCells: (sheetId, edits) =>
            mutateSheet(sheetId, (sh) => {
              for (const { r, c, cell } of edits) {
                const key = cellKey(r, c);
                if (cell === null) delete sh.cells[key];
                else sh.cells[key] = cell;
                if (r >= sh.rowCount) sh.rowCount = r + 1;
                if (c >= sh.colCount) sh.colCount = c + 1;
              }
            }),

          clearRange: (sheetId, range) =>
            mutateSheet(sheetId, (sh) => {
              const { r0, c0, r1, c1 } = norm(range);
              // ponytail: 저장된 셀 전체 스캔 O(cells) — 범위 인덱스가 필요해지면 교체
              for (const key of Object.keys(sh.cells)) {
                const { r, c } = parseCellKey(key);
                if (r >= r0 && r <= r1 && c >= c0 && c <= c1 && !sh.cells[key].src) {
                  delete sh.cells[key];
                }
              }
            }),

          insertRows: (sheetId, index, count) =>
            mutateSheet(sheetId, (sh) => {
              if (count <= 0) return;
              sh.rowCount += count;
              sh.cells = remapCells(sh.cells, (r, c) =>
                r >= index ? [r + count, c] : [r, c],
              );
            }),

          deleteRows: (sheetId, index, count) =>
            mutateSheet(sheetId, (sh) => {
              if (count <= 0) return;
              sh.rowCount = Math.max(1, sh.rowCount - count);
              sh.cells = remapCells(sh.cells, (r, c) => {
                if (r < index) return [r, c];
                if (r < index + count) return null;
                return [r - count, c];
              });
            }),

          insertCols: (sheetId, index, count) =>
            mutateSheet(sheetId, (sh) => {
              if (count <= 0) return;
              sh.colCount += count;
              sh.cells = remapCells(sh.cells, (r, c) =>
                c >= index ? [r, c + count] : [r, c],
              );
              sh.colWidths = remapWidths(sh.colWidths, (c) =>
                c >= index ? c + count : c,
              );
            }),

          deleteCols: (sheetId, index, count) =>
            mutateSheet(sheetId, (sh) => {
              if (count <= 0) return;
              sh.colCount = Math.max(1, sh.colCount - count);
              sh.cells = remapCells(sh.cells, (r, c) => {
                if (c < index) return [r, c];
                if (c < index + count) return null;
                return [r, c - count];
              });
              sh.colWidths = remapWidths(sh.colWidths, (c) => {
                if (c < index) return c;
                if (c < index + count) return null;
                return c - count;
              });
              if (sh.frozenCols) {
                // setFrozenCols와 같은 불변식: 최대 colCount - 1
                sh.frozenCols = Math.min(sh.frozenCols, sh.colCount - 1);
              }
            }),

          addSheet: () =>
            set((state) => {
              const names = new Set(state.workbook.sheets.map((s) => s.name));
              let i = state.workbook.sheets.length + 1;
              while (names.has(`Sheet${i}`)) i++;
              const sheet = createSheet(`Sheet${i}`);
              state.workbook.sheets.push(sheet);
              state.activeSheetId = sheet.id;
            }),

          addSheetWithCells: (edits) =>
            set((state) => {
              const names = new Set(state.workbook.sheets.map((s) => s.name));
              let i = state.workbook.sheets.length + 1;
              while (names.has(`Sheet${i}`)) i++;
              const sheet = createSheet(`Sheet${i}`);
              for (const { r, c, cell } of edits) {
                if (cell === null) continue;
                sheet.cells[cellKey(r, c)] = cell;
                if (r >= sheet.rowCount) sheet.rowCount = r + 1;
                if (c >= sheet.colCount) sheet.colCount = c + 1;
              }
              state.workbook.sheets.push(sheet);
              state.activeSheetId = sheet.id;
              state.selection = null;
            }),

          renameSheet: (sheetId, name) => {
            const trimmed = name.trim();
            if (trimmed === "") return;
            mutateSheet(sheetId, (sh) => {
              sh.name = trimmed;
            });
          },

          removeSheet: (sheetId) =>
            set((state) => {
              const sheets = state.workbook.sheets;
              if (sheets.length <= 1) return;
              const idx = sheets.findIndex((s) => s.id === sheetId);
              if (idx < 0) return;
              sheets.splice(idx, 1);
              if (state.activeSheetId === sheetId) {
                state.activeSheetId = sheets[Math.max(0, idx - 1)].id;
                state.selection = null;
              }
            }),

          moveSheet: (sheetId, offset) =>
            set((state) => {
              const sheets = state.workbook.sheets;
              const idx = sheets.findIndex((s) => s.id === sheetId);
              if (idx < 0) return;
              const to = Math.max(0, Math.min(sheets.length - 1, idx + offset));
              if (to === idx) return;
              const [sheet] = sheets.splice(idx, 1);
              sheets.splice(to, 0, sheet);
            }),

          setColWidth: (sheetId, col, width) =>
            mutateSheet(sheetId, (sh) => {
              (sh.colWidths ??= {})[col] = Math.max(30, Math.round(width));
            }),

          setFrozenCols: (sheetId, n) =>
            mutateSheet(sheetId, (sh) => {
              sh.frozenCols = Math.max(0, Math.min(n, sh.colCount - 1));
            }),

          setTitle: (title) => {
            const trimmed = title.trim();
            if (trimmed === "") return;
            set((state) => {
              state.workbook.title = trimmed;
            });
          },

          setSelection: (range) =>
            set((state) => {
              state.selection = range;
            }),

          setActiveSheet: (id) =>
            set((state) => {
              if (state.workbook.sheets.some((s) => s.id === id)) {
                state.activeSheetId = id;
                state.selection = null;
              }
            }),

          newWorkbook: () => {
            const fresh = createWorkbook();
            set((state) => {
              state.workbook = fresh;
              state.activeSheetId = fresh.sheets[0].id;
              state.selection = null;
              state.runningBlocks = {};
              state.dirtyBlocks = {};
              state.selectedBlockId = null;
              state.lastEditorBlockId = null;
              state.hoverBlockId = null;
              state.flash = null;
              state.anchorPicking = null;
            });
            resetHistory();
          },

          loadWorkbook: (loaded) => {
            set((state) => {
              // 구 워크북 정규화: 코드 블록마다 outputs ≥ 1, spill src 태그 이관 (부록 D.1)
              state.workbook = normalizeWorkbook(loaded);
              state.activeSheetId = loaded.sheets[0]?.id ?? "";
              state.selection = null;
              // 이전 워크북의 transient 상태(실행 중·dirty 등) 정리 (§M7.5)
              state.runningBlocks = {};
              state.dirtyBlocks = {};
              state.selectedBlockId = null;
              state.lastEditorBlockId = null;
              state.hoverBlockId = null;
              state.flash = null;
              state.anchorPicking = null;
            });
            resetHistory();
          },

          addPyBlock: (sheetId, anchor, kind) => {
            const st = get();
            const sheet = st.workbook.sheets.find((s) => s.id === sheetId);
            if (!sheet) return null;
            if (sheet.cells[cellKey(anchor.r, anchor.c)]?.src) return null;
            if (
              st.workbook.pyBlocks.some(
                (b) =>
                  b.sheetId === sheetId &&
                  b.anchor.r === anchor.r &&
                  b.anchor.c === anchor.c,
              )
            ) {
              return null;
            }
            const id = newId();
            set((state) => {
              const block: PyBlock = {
                id,
                sheetId,
                anchor,
                code: "",
                outputMode: "values",
                includeIndex: "auto",
                // 마크다운 블록은 실행되지 않고 셀에 아무것도 쓰지 않는다 (앵커 = 위치·목차 대상)
                ...(kind === "markdown" ? { kind, markdown: "" } : {}),
              };
              normalizeBlock(block); // 코드 블록은 출력 1개로 시작한다
              state.workbook.pyBlocks.push(block);
            });
            return id;
          },

          setBlockAnchor: (id, anchor, sheetId) => {
            // 레거시 경로: outputs[0]이 곧 블록 앵커다 (부록 D.1)
            const block = get().workbook.pyBlocks.find((b) => b.id === id);
            if (!block) return "블록을 찾을 수 없습니다";
            const outputId = block.outputs?.[0]?.id;
            if (!outputId) return "출력을 찾을 수 없습니다";
            return get().setOutputAnchor(id, outputId, { sheetId, r: anchor.r, c: anchor.c });
          },

          setOutputAnchor: (blockId, outputId, target) => {
            const st = get();
            const block = st.workbook.pyBlocks.find((b) => b.id === blockId);
            if (!block) return "블록을 찾을 수 없습니다";
            const binding = block.outputs?.find((o) => o.id === outputId);
            if (!binding) return "출력을 찾을 수 없습니다";
            const targetSheetId = target.sheetId ?? binding.sheetId ?? block.sheetId;
            const sheet = st.workbook.sheets.find((s) => s.id === targetSheetId);
            if (!sheet) return "시트를 찾을 수 없습니다";
            const currentSheetId = binding.sheetId ?? block.sheetId;
            if (
              targetSheetId === currentSheetId &&
              binding.anchor.r === target.r &&
              binding.anchor.c === target.c
            ) {
              return null; // 제자리
            }
            const tag = srcTag(blockId, outputId);
            const conflict = checkSpillConflict(sheet, st.workbook.pyBlocks, tag, target, [1, 1]);
            if (conflict) return conflict;
            const cell = sheet.cells[cellKey(target.r, target.c)];
            // 앵커 셀은 출력 소유라 checkSpillConflict가 봐주지만, 재지정은 빈 셀에만 허용한다
            if (cell && !cell.src && cell.v !== null && cell.v !== "") {
              return `비어 있지 않은 셀(${colToLetter(target.c)}${target.r + 1})과 겹칩니다`;
            }
            set((state) => {
              const b = state.workbook.pyBlocks.find((x) => x.id === blockId);
              const o = b?.outputs?.find((x) => x.id === outputId);
              if (!b || !o) return;
              clearSpillCells(state.workbook, blockId, outputId);
              if (o.last?.spillRange) delete o.last.spillRange; // 옛 위치의 spill 테두리 제거
              o.anchor = { r: target.r, c: target.c };
              if (b.outputs![0].id === outputId) {
                // 블록 시트가 따라 움직인다 — 다른 출력은 원래 시트에 남긴다
                if (targetSheetId !== b.sheetId) {
                  for (const other of b.outputs!) {
                    if (other.id !== outputId) other.sheetId ??= b.sheetId;
                  }
                  b.sheetId = targetSheetId;
                }
                delete o.sheetId;
              } else if (targetSheetId === b.sheetId) {
                delete o.sheetId;
              } else {
                o.sheetId = targetSheetId;
              }
              syncLegacy(b);
              state.dirtyBlocks[blockId] = true;
              state.anchorPicking = null;
            });
            return null;
          },

          swapBlockOrder: (id, direction) => {
            const ordered = blocksInOrder(get().workbook);
            const i = ordered.findIndex((b) => b.id === id);
            const j = direction === "up" ? i - 1 : i + 1;
            if (i < 0 || j < 0 || j >= ordered.length) return null; // 경계
            const otherId = ordered[j].id;
            set((state) => {
              const a = state.workbook.pyBlocks.find((b) => b.id === id);
              const b = state.workbook.pyBlocks.find((x) => x.id === otherId);
              if (!a || !b) return;
              for (const blk of [a, b]) {
                clearSpillCells(state.workbook, blk.id);
                for (const o of blk.outputs ?? []) {
                  if (o.last?.spillRange) delete o.last.spillRange;
                }
                if (blk.last?.spillRange) delete blk.last.spillRange;
                state.dirtyBlocks[blk.id] = true;
              }
              // draft 별칭을 피하려고 평범한 값으로 먼저 복사한다
              const posA = { sheetId: a.sheetId, anchor: { ...a.anchor } };
              const posB = { sheetId: b.sheetId, anchor: { ...b.anchor } };
              // 다른 시트로 옮기는 블록의 나머지 출력은 원래 시트에 남는다
              for (const blk of [a, b]) {
                for (const o of (blk.outputs ?? []).slice(1)) o.sheetId ??= blk.sheetId;
              }
              a.sheetId = posB.sheetId;
              a.anchor = { ...posB.anchor };
              b.sheetId = posA.sheetId;
              b.anchor = { ...posA.anchor };
              for (const blk of [a, b]) {
                const first = blk.outputs?.[0];
                if (first) {
                  first.anchor = { ...blk.anchor };
                  delete first.sheetId;
                }
              }
            });
            return otherId;
          },

          removePyBlock: (id) =>
            set((state) => {
              const idx = state.workbook.pyBlocks.findIndex((b) => b.id === id);
              if (idx < 0) return;
              clearSpillCells(state.workbook, id); // 다른 시트에 놓인 출력까지
              state.workbook.pyBlocks.splice(idx, 1);
              delete state.runningBlocks[id];
              delete state.dirtyBlocks[id];
              if (state.focusBlockId === id) state.focusBlockId = null;
              if (state.selectedBlockId === id) state.selectedBlockId = null;
              if (state.lastEditorBlockId === id) state.lastEditorBlockId = null;
              if (state.hoverBlockId === id) state.hoverBlockId = null;
              if (state.anchorPicking?.blockId === id) state.anchorPicking = null;
            }),

          setBlockCode: (id, code) =>
            set((state) => {
              const block = state.workbook.pyBlocks.find((b) => b.id === id);
              if (block && block.code !== code) block.code = code;
            }),

          setBlockOutputMode: (id, mode) => {
            const outputId = get().workbook.pyBlocks.find((b) => b.id === id)?.outputs?.[0]?.id;
            if (outputId) get().setOutputMode(id, outputId, mode);
          },

          setBlockOutput: (id, patch) => {
            const outputId = get().workbook.pyBlocks.find((b) => b.id === id)?.outputs?.[0]?.id;
            if (outputId) get().setOutputSelection(id, outputId, patch);
          },

          addOutput: (blockId) => {
            const st = get();
            const block = st.workbook.pyBlocks.find((b) => b.id === blockId);
            if (!block || block.kind === "markdown") return null;
            const sheet = st.workbook.sheets.find((s) => s.id === block.sheetId);
            if (!sheet) return null;
            // 기존 출력 영역 오른쪽 두 칸부터 빈 셀을 찾는다
            let c = block.anchor.c;
            for (const o of block.outputs ?? []) {
              if ((o.sheetId ?? block.sheetId) !== sheet.id) continue;
              c = Math.max(c, Math.max(o.anchor.c, o.last?.spillRange?.c1 ?? o.anchor.c) + 2);
            }
            const r = block.anchor.r;
            const limit = c + 200;
            while (c < limit && cellTaken(sheet, st.workbook.pyBlocks, r, c)) c++;
            const id = newId();
            set((state) => {
              const b = state.workbook.pyBlocks.find((x) => x.id === blockId);
              if (!b) return;
              (b.outputs ??= []).push({
                id,
                anchor: { r, c },
                mode: "values",
                includeIndex: "auto",
              });
              state.dirtyBlocks[blockId] = true;
            });
            return id;
          },

          removeOutput: (blockId, outputId) =>
            set((state) => {
              const b = state.workbook.pyBlocks.find((x) => x.id === blockId);
              if (!b?.outputs || b.outputs.length <= 1) return; // 마지막 출력은 남긴다
              const i = b.outputs.findIndex((o) => o.id === outputId);
              if (i < 0) return;
              clearSpillCells(state.workbook, blockId, outputId);
              b.outputs.splice(i, 1);
              syncLegacy(b);
              state.dirtyBlocks[blockId] = true;
            }),

          setOutputSelection: (blockId, outputId, patch) =>
            set((state) => {
              const b = state.workbook.pyBlocks.find((x) => x.id === blockId);
              const o = b?.outputs?.find((x) => x.id === outputId);
              if (!b || !o) return;
              const next: OutputSelection = { ...o.selection, ...patch };
              for (const k of Object.keys(next) as (keyof OutputSelection)[]) {
                if (next[k] === undefined) delete next[k];
              }
              o.selection = Object.keys(next).length > 0 ? next : undefined;
              syncLegacy(b);
            }),

          setOutputMode: (blockId, outputId, mode) =>
            set((state) => {
              const b = state.workbook.pyBlocks.find((x) => x.id === blockId);
              const o = b?.outputs?.find((x) => x.id === outputId);
              // 객체→값 전환의 spill 충돌은 다음 실행에서 검사한다 (§2.3.6, M5)
              if (!b || !o) return;
              o.mode = mode;
              syncLegacy(b);
            }),

          setOutputIncludeIndex: (blockId, outputId, value) =>
            set((state) => {
              const b = state.workbook.pyBlocks.find((x) => x.id === blockId);
              const o = b?.outputs?.find((x) => x.id === outputId);
              if (!b || !o) return;
              o.includeIndex = value;
              syncLegacy(b);
            }),

          setOutputLabel: (blockId, outputId, label) =>
            set((state) => {
              const o = state.workbook.pyBlocks
                .find((x) => x.id === blockId)
                ?.outputs?.find((x) => x.id === outputId);
              if (o) o.label = label.trim() === "" ? undefined : label;
            }),

          setBlockMarkdown: (id, markdown) =>
            set((state) => {
              const block = state.workbook.pyBlocks.find((b) => b.id === id);
              if (!block || block.markdown === markdown) return;
              block.markdown = markdown;
              block.title = markdownTitle(markdown) || undefined; // 첫 헤딩 = 목차 제목
            }),

          setBlockTitle: (id, title) =>
            set((state) => {
              const block = state.workbook.pyBlocks.find((b) => b.id === id);
              if (block) block.title = title.trim() === "" ? undefined : title;
            }),

          setBlockCollapsed: (id, collapsed) =>
            set((state) => {
              const block = state.workbook.pyBlocks.find((b) => b.id === id);
              if (block) block.collapsed = collapsed || undefined;
            }),

          setAllCollapsed: (collapsed) =>
            set((state) => {
              for (const b of state.workbook.pyBlocks) b.collapsed = collapsed || undefined;
            }),

          patchOutputImage: (blockId, outputId, imageBlobId) =>
            set((state) => {
              const block = state.workbook.pyBlocks.find((b) => b.id === blockId);
              const binding = block?.outputs?.find((o) => o.id === outputId);
              if (!binding?.last) return;
              binding.last.imageBlobId = imageBlobId;
              if (block && block.outputs?.[0]?.id === outputId && block.last) {
                block.last.imageBlobId = imageBlobId; // 레거시 뷰 동기화
              }
            }),
          applyOutputResults: (blockId, results) =>
            set((state) => {
              const block = state.workbook.pyBlocks.find((b) => b.id === blockId);
              if (!block) return;
              for (const res of results) {
                const binding = block.outputs?.find((o) => o.id === res.outputId);
                if (!binding) continue;
                const sheet = state.workbook.sheets.find(
                  (s) => s.id === (binding.sheetId ?? block.sheetId),
                );
                if (!sheet) continue;
                const tag = srcTag(blockId, binding.id);
                if (res.clearPrevious) {
                  for (const key of Object.keys(sheet.cells)) {
                    if (sheet.cells[key].src === tag) delete sheet.cells[key];
                  }
                }
                res.cells.forEach((row, i) =>
                  row.forEach((cell, j) => {
                    const r = binding.anchor.r + i;
                    const c = binding.anchor.c + j;
                    sheet.cells[cellKey(r, c)] = { ...cell, src: tag };
                    if (r >= sheet.rowCount) sheet.rowCount = r + 1;
                    if (c >= sheet.colCount) sheet.colCount = c + 1;
                  }),
                );
                if (res.last) binding.last = res.last;
              }
              syncLegacy(block);
            }),

          applyBlockResult: (blockId, cells, opts) => {
            const outputId = get().workbook.pyBlocks.find((b) => b.id === blockId)?.outputs?.[0]
              ?.id;
            if (!outputId) return;
            get().applyOutputResults(blockId, [
              { outputId, cells, clearPrevious: opts?.clearPrevious, last: opts?.last },
            ]);
          },

          setBlockRunning: (id, running) =>
            set((state) => {
              if (running) state.runningBlocks[id] = true;
              else delete state.runningBlocks[id];
            }),

          setFlash: (flash) =>
            set((state) => {
              state.flash = flash;
            }),

          setFocusBlock: (id) =>
            set((state) => {
              state.focusBlockId = id;
            }),

          markDirty: (ids) =>
            set((state) => {
              for (const id of ids) state.dirtyBlocks[id] = true;
            }),

          clearDirty: (id) =>
            set((state) => {
              delete state.dirtyBlocks[id];
            }),

          setCalcMode: (mode) =>
            set((state) => {
              state.workbook.calcMode = mode;
            }),

          setInitScript: (script) =>
            set((state) => {
              state.workbook.initScript = script;
            }),

          setHoverRange: (hover) =>
            set((state) => {
              state.hoverRange = hover;
            }),

          setHoverBlock: (id) =>
            set((state) => {
              state.hoverBlockId = id;
            }),

          setSelectedBlock: (id) =>
            set((state) => {
              state.selectedBlockId = id;
            }),

          setBottomTab: (tab) =>
            set((state) => {
              state.bottomTab = tab;
            }),

          setLastEditorBlock: (id) =>
            set((state) => {
              state.lastEditorBlockId = id;
            }),

          setAnchorPicking: (target) =>
            set((state) => {
              state.anchorPicking = target;
            }),

          setTocOpen: (open) =>
            set((state) => {
              state.tocOpen = open;
            }),

          setView: (view) =>
            set((state) => {
              state.view = view;
            }),
        };
      }),
      {
        limit: 100,
        partialize,
        equality: (a, b) => a === b,
        handleSet: (handle) => {
          const throttled = throttle(handle as (...args: unknown[]) => void, 300, {
            leading: true,
            trailing: true,
          });
          cancelPending = () => throttled.cancel();
          return throttled;
        },
      },
    ),
  );

  resetHistory = () => {
    cancelPending(); // 대기 중인 trailing push가 초기화 후 이력을 오염시키지 않도록
    store.temporal.getState().clear();
  };

  return store;
};

export const useWorkbookStore = createWorkbookStore();
