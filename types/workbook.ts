// 워크북 데이터 모델 — 설계서 §3.1. 저장(.pygrid.json)·IndexedDB·스토어가 공유하는 단일 스키마.

export type CellType = "n" | "s" | "b" | "d" | "e";

export interface Cell {
  v: string | number | boolean | null;
  t: CellType;
  /** 표시 서식 힌트 ('0.0%', '#,##0', 'yyyy-mm-dd') */
  f?: string;
  /** spill 출처 블록 id. 있으면 직접 편집 잠김 */
  src?: string;
}

export interface Sheet {
  id: string;
  name: string;
  rowCount: number;
  colCount: number;
  /** key "r:c" (0-based). 빈 셀은 저장하지 않음 */
  cells: Record<string, Cell>;
  colWidths?: Record<number, number>;
  frozenCols?: number;
}

export type OutputMode = "values" | "object";
export type IncludeIndex = "auto" | "always" | "never";

export interface CellRange {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

export type RunStatus = "ok" | "error" | "busy" | "spill";
export type ResultKind = "scalar" | "table" | "image" | "object";

export interface RunResult {
  status: RunStatus;
  kind?: ResultKind;
  shape?: [number, number];
  /** 상위 100행 미리보기 또는 repr */
  preview?: unknown;
  /** blobs 스토어 참조 (이미지 결과) */
  imageBlobId?: string;
  stdout: string;
  stderr: string;
  traceback?: string;
  /** 초보자용 한국어 오류 요약 */
  summaryKo?: string;
  spillRange?: CellRange;
  durationMs: number;
  ranAt: string;
}

export interface PyBlock {
  id: string;
  sheetId: string;
  anchor: { r: number; c: number };
  code: string;
  outputMode: OutputMode;
  /** DataFrame spill 시 index 포함 규칙 */
  includeIndex: IncludeIndex;
  last?: RunResult;
}

export type CalcMode = "auto" | "manual";

export interface WorkbookSettings {
  timeoutSec: number;
  inferTypesOnPaste: boolean;
}

export interface Workbook {
  id: string;
  /** 스키마 버전 (마이그레이션용) */
  version: 1;
  title: string;
  sheets: Sheet[];
  pyBlocks: PyBlock[];
  initScript: string;
  calcMode: CalcMode;
  settings: WorkbookSettings;
  createdAt: string;
  updatedAt: string;
}

/** cells 레코드 키 */
export const cellKey = (r: number, c: number): string => `${r}:${c}`;

export const parseCellKey = (key: string): { r: number; c: number } => {
  const i = key.indexOf(":");
  return { r: Number(key.slice(0, i)), c: Number(key.slice(i + 1)) };
};
