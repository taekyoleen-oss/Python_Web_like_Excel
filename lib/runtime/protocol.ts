// 워커 메시지 계약 — 이 파일이 유일한 계약이다 (CLAUDE.md §3).
// 변경 시 /output/runtime-protocol.md를 함께 갱신한다.
// 원칙: PyProxy·비직렬화 객체 금지. 이미지 ArrayBuffer는 transferable로 넘긴다.

import type {
  CellType,
  IncludeIndex,
  OutputMode,
  OutputSelection,
} from "@/types/workbook";

/** xl() 참조 범위의 2D 스냅샷. 단일 셀 참조도 1×1 2D로 전달하고, 스칼라 변환은 xl.py가 참조 형태를 보고 결정한다 */
export interface RangeSnapshot {
  values: (string | number | boolean | null)[][];
  types: CellType[][];
  /** 참조가 단일 셀(`A1`)이면 true → xl()이 스칼라 반환 */
  scalar: boolean;
}

/** 워커가 값 모드 결과로 돌려주는 셀. converters.ts가 그대로 Cell로 감싼다 */
export interface OutCell {
  v: string | number | boolean | null;
  t: CellType;
  f?: string;
}

export type PreviewPayload =
  | {
      kind: "table";
      columns: string[];
      dtypes: string[];
      /** 상위 100행 */
      rows: (string | number | boolean | null)[][];
      shape: [number, number];
    }
  | { kind: "repr"; repr: string }
  | { kind: "image" };

/** 다중 출력 요청 — 코드는 1회만 실행하고 출력마다 변환한다 */
export interface OutputRequest {
  /** PyBlock.outputs[].id */
  id: string;
  mode: OutputMode;
  includeIndex: IncludeIndex;
  selection?: OutputSelection;
}

export interface OutputItemSuccess {
  id: string;
  ok: true;
  kind: "scalar" | "table" | "image" | "object";
  /** 값 모드 결과 */
  cells?: OutCell[][];
  typeName?: string;
  shape?: [number, number];
  preview?: PreviewPayload;
  imagePng?: ArrayBuffer;
}

/** 출력 단위 실패(예: 지정 변수 없음) — 코드 자체는 성공한 경우 */
export interface OutputItemFailure {
  id: string;
  ok: false;
  errorType: string;
  message: string;
  traceback?: string;
}

export type OutputItem = OutputItemSuccess | OutputItemFailure;

export interface RunSuccess {
  ok: true;
  /** 다중 출력 결과. run에 outputs를 보낸 경우 채워진다 */
  outputs?: OutputItem[];
  kind: "scalar" | "table" | "image" | "object";
  /** 값(spill) 모드 결과. 객체 모드에서는 없음 */
  cells?: OutCell[][];
  /** 객체 카드 요약용 타입명 (예: "DataFrame") */
  typeName?: string;
  shape?: [number, number];
  preview?: PreviewPayload;
  /** PNG bytes (transferable) */
  imagePng?: ArrayBuffer;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface RunFailure {
  ok: false;
  /** Python 예외 클래스명 (NameError 등). 한국어 요약 매핑 키 */
  errorType: string;
  message: string;
  traceback: string;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export type RunPayload = RunSuccess | RunFailure;

export interface VariableInfo {
  name: string;
  type: string;
  shape?: [number, number];
  /** repr 첫 줄 등 짧은 요약 */
  summary?: string;
}

// ── 메인 → 워커 ──────────────────────────────────────────

export type MainToWorker =
  | {
      t: "boot";
      indexURL: string;
      /** 부트 시 선로드 패키지 (numpy, pandas) */
      packages: string[];
      initScript: string;
      /** matplotlib 한글 폰트 URL (Pyodide FS에 기록) */
      fontUrl: string;
    }
  | { t: "setInterruptBuffer"; buffer: SharedArrayBuffer }
  | { t: "analyze"; id: number; code: string }
  | {
      t: "run";
      id: number;
      blockId: string;
      code: string;
      snapshots: Record<string, RangeSnapshot>;
      outputMode: OutputMode;
      includeIndex: IncludeIndex;
      /** 출력 선택: 마지막 표현식 대신 특정 변수 / DataFrame 열·행 제한 (레거시 단일 출력) */
      output?: OutputSelection;
      /** 다중 출력 요청. 있으면 outputMode/includeIndex/output 대신 이쪽을 쓴다 */
      outputs?: OutputRequest[];
    }
  | { t: "repl"; id: number; code: string }
  | { t: "inspect"; id: number }
  | { t: "resetRuntime"; id: number; initScript: string };

// ── 워커 → 메인 ──────────────────────────────────────────

export type WorkerToMain =
  | { t: "progress"; pct: number; label: string }
  | { t: "ready"; pyVersion: string; pyodideVersion: string }
  | { t: "bootError"; message: string }
  | { t: "analyzed"; id: number; refs: string[] }
  | { t: "analyzeError"; id: number; message: string }
  | { t: "stdout"; id: number; chunk: string }
  | { t: "stderr"; id: number; chunk: string }
  | ({ t: "result"; id: number; blockId: string } & RunPayload)
  | {
      t: "replResult";
      id: number;
      repr: string | null;
      stdout: string;
      stderr: string;
      traceback?: string;
    }
  | { t: "variables"; id: number; vars: VariableInfo[] }
  | { t: "resetDone"; id: number };

export const DEFAULT_PYODIDE_INDEX_URL =
  "https://cdn.jsdelivr.net/pyodide/v314.0.6/full/";

export const BOOT_PACKAGES = ["numpy", "pandas"];

/** 인터럽트: 버퍼[0]=2 (SIGINT) */
export const INTERRUPT_SIGINT = 2;
