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

/** 블록 종류 — 마크다운 블록은 실행되지 않고 문서·목차 용도로만 쓰인다 */
export type BlockKind = "code" | "markdown";

/** 실행 결과 중 무엇을 셀에 표시할지 (설계서 확장 §7.1) */
export interface OutputSelection {
  /** 출력할 전역 변수명. 없으면 마지막 표현식 값 */
  variable?: string;
  /** DataFrame 결과에서 표시할 열. 없으면 전체 열 */
  columns?: string[];
  /** 표시할 상위 행 수. 없으면 전체 행 */
  rowLimit?: number;
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
  /** 기본 'code'. 'markdown'이면 code/outputMode는 무시된다 */
  kind?: BlockKind;
  /** 목차에 표시되는 제목 (마크다운 블록은 본문 첫 헤딩에서 자동 추출 가능) */
  title?: string;
  /** kind==='markdown'일 때의 본문 */
  markdown?: string;
  /** 카드 접기 상태 (마크다운·코드·결과 전부 숨김) */
  collapsed?: boolean;
  /** 출력 선택 (변수·열·행) */
  output?: OutputSelection;
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
