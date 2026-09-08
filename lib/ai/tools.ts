// 부록 L.1 — 워크북 에이전트 도구(tool use): Anthropic 도구 스키마 + 로컬 실행기.
// 원칙 (L.0·L.3):
// · 셀 값은 read_range 호출 시점에만, 상한(200행·5,000셀·셀당 200자) 안에서만 전송한다.
// · propose_* 는 절대 즉시 반영하지 않는다 — 제안 객체를 만들고 { proposed, id }만 돌려준다.
//   (모델은 적용 여부를 알 수 없다. 사용자가 [적용]을 누른 뒤 다음 턴에서 read로 확인)
// · 실행기는 throw하지 않는다 — 실패도 결과(JSON)로 돌려 모델이 다시 판단하게 한다.

import { cellKey, type Cell, type CellRange, type Sheet } from "@/types/workbook";
import { formatA1, parseA1 } from "@/lib/grid/a1";
import { classifyCell } from "@/lib/grid/clipboard/infer";
import type { SheetRange } from "@/lib/grid/formula-engine";
import { blocksInOrder, useWorkbookStore } from "@/lib/grid/model";
import { sheetSchemas } from "./schema";

/** 한 번에 읽는 최대 행 수 (L.3) */
export const MAX_ROWS = 200;
/** 한 번에 읽는 최대 셀 수 (L.3) */
export const MAX_CELLS = 5_000;
/** 셀 하나의 최대 문자 수 (L.3) */
export const MAX_CHARS = 200;

export type CellValue = string | number | boolean | null;

export interface CellProposal {
  id: string;
  kind: "cells";
  sheetId: string;
  /** "데이터!H1:H3" — 카드 제목·칩 */
  label: string;
  range: CellRange;
  values: CellValue[][];
  reason: string;
  /** 덮어쓰게 되는 수식 셀 수 (L.3: 경고 후 허용) */
  formulaCells: number;
}

export interface BlockProposal {
  id: string;
  kind: "block";
  code: string;
  title?: string;
  note?: string;
  /** 새 블록 앵커 희망 위치(A1) — 참고용 */
  anchor?: string;
  /** 이 블록을 고치는 제안이면 대상 블록 id */
  targetBlockId?: string;
  /** 대상 블록 앵커 칩 ("B3 · 손해율 집계") */
  targetLabel?: string;
}

export type Proposal = CellProposal | BlockProposal;

export interface ToolOutcome {
  /** 모델에게 tool_result로 돌려줄 JSON-safe 값 */
  result: unknown;
  /** 채팅 도구 로그 한 줄 (L.2) */
  summary: string;
  /** propose_* 가 만든 제안 */
  proposal?: Proposal;
  /** read_range 근거 하이라이트 대상 */
  ref?: SheetRange & { label: string };
}

// ── 도구 스키마 (Anthropic tool use 형식) ──────────────────────────────

export const TOOL_DEFS = [
  {
    name: "list_sheets",
    description:
      "워크북의 시트 목록을 반환한다 — 시트명·사용 범위(A1)·헤더 행·행 수. 셀 값은 포함되지 않는다.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "read_range",
    description:
      `범위의 실제 셀 값을 읽는다. 데이터 값이 필요할 때만 호출하세요(평소에는 헤더·구조만 봅니다). ` +
      `상한 ${MAX_ROWS}행·${MAX_CELLS}셀·셀당 ${MAX_CHARS}자 — 초과하면 잘라서 반환하고 truncated=true와 ` +
      `실제로 반환한 범위(returnedRef)를 함께 알려준다. 값은 JSON 원시 타입이며 날짜는 "yyyy-mm-dd" 문자열이다.`,
    input_schema: {
      type: "object",
      properties: {
        ref: {
          type: "string",
          description: 'A1 범위. 예: "A1:F21", "데이터!A1:F21", "\'시트 이름\'!A1:B5"',
        },
        maxRows: {
          type: "integer",
          description: `최대 행 수(기본·상한 ${MAX_ROWS})`,
        },
      },
      required: ["ref"],
    },
  },
  {
    name: "list_blocks",
    description:
      "워크북의 Python·마크다운 블록을 계산 순서대로 반환한다 — 제목·앵커·코드·설명(note)·마지막 실행 상태(오류면 요약과 트레이스백 앞부분).",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "propose_cells",
    description:
      "시트 셀 쓰기를 **제안**한다(즉시 반영 아님). 사용자에게 미리보기 카드로 표시되고, [적용]을 눌러야 반영된다. " +
      "spill(src) 셀이 포함되면 거부된다 — 그 경우 빈 범위를 골라 다시 제안하세요.",
    input_schema: {
      type: "object",
      properties: {
        ref: {
          type: "string",
          description: '쓰기를 시작할 좌상단 셀 또는 범위(A1). 예: "H1", "데이터!H1:I5"',
        },
        values: {
          type: "array",
          description: "행 배열의 배열. 예: [[\"합계\", 100], [\"평균\", 25]]",
          items: { type: "array", items: {} },
        },
        reason: { type: "string", description: "이 변경을 제안하는 이유(한국어 한두 문장)" },
      },
      required: ["ref", "values", "reason"],
    },
  },
  {
    name: "propose_block",
    description:
      "Python 블록 코드를 **제안**한다(생성·실행 아님). 사용자가 [현재 블록에 적용]·[새 블록]을 눌러야 반영되며 실행은 사용자가 한다.",
    input_schema: {
      type: "object",
      properties: {
        code: { type: "string", description: "블록 전체 코드(완결형)" },
        title: { type: "string", description: "블록 제목" },
        anchor: { type: "string", description: "새 블록 희망 앵커(A1) — 선택" },
        note: { type: "string", description: "블록 설명(마크다운) — 선택" },
        targetBlockId: {
          type: "string",
          description: "기존 블록을 고치는 제안이면 그 블록 id (list_blocks의 id)",
        },
      },
      required: ["code"],
    },
  },
] as const;

// ── 공용 헬퍼 ─────────────────────────────────────────────────────────

const store = () => useWorkbookStore.getState();

let seq = 0;
const newProposalId = (): string => `prop-${Date.now().toString(36)}-${seq++}`;

function resolveSheet(name?: string): Sheet | null {
  const st = store();
  if (name === undefined) {
    return st.workbook.sheets.find((s) => s.id === st.activeSheetId) ?? st.workbook.sheets[0] ?? null;
  }
  return st.workbook.sheets.find((s) => s.name === name) ?? null;
}

const fail = (reason: string, summary?: string): ToolOutcome => ({
  result: { ok: false, reason },
  summary: summary ?? reason,
});

const asRecord = (input: unknown): Record<string, unknown> =>
  input && typeof input === "object" ? (input as Record<string, unknown>) : {};

/** 셀 → JSON 값 (문자열은 셀당 상한으로 자른다) */
function cellValue(cell: Cell | undefined, clipped: { hit: boolean }): CellValue {
  if (!cell || cell.v === null || cell.v === undefined) return null;
  if (typeof cell.v === "string" && cell.v.length > MAX_CHARS) {
    clipped.hit = true;
    return `${cell.v.slice(0, MAX_CHARS)}…`;
  }
  return cell.v;
}

/** JSON 값 → 셀 (문자열은 붙여넣기와 같은 유형 추론) */
export function toCell(v: unknown): Cell | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? { v, t: "n" } : { v: String(v), t: "s" };
  if (typeof v === "boolean") return { v, t: "b" };
  return classifyCell(String(v), "ymd").cell;
}

/** values를 행 배열의 배열로 정규화 (모델이 1차원으로 주면 1열로 본다) */
function normalizeValues(raw: unknown): CellValue[][] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const rows = Array.isArray(raw[0])
    ? (raw as unknown[][])
    : (raw as unknown[]).map((v) => [v]);
  const width = Math.max(...rows.map((r) => (Array.isArray(r) ? r.length : 1)));
  return rows.map((r) => {
    const row = Array.isArray(r) ? r : [r];
    return Array.from({ length: width }, (_, i) => {
      const v = row[i];
      if (v === undefined || v === null) return null;
      if (typeof v === "number" || typeof v === "boolean" || typeof v === "string") return v;
      return String(v);
    });
  });
}

// ── 실행기 ────────────────────────────────────────────────────────────

function listSheets(): ToolOutcome {
  const sheets = sheetSchemas(store().workbook); // 값 미포함 — 이름·범위·헤더·행 수만
  return { result: { sheets }, summary: `시트 목록 읽음 · ${sheets.length}개` };
}

function readRange(input: unknown): ToolOutcome {
  const { ref, maxRows } = asRecord(input);
  if (typeof ref !== "string") return fail("ref는 A1 문자열이어야 합니다");
  let parsed;
  try {
    parsed = parseA1(ref);
  } catch (e) {
    return fail((e as Error).message);
  }
  const sheet = resolveSheet(parsed.sheetName);
  if (!sheet) return fail(`시트를 찾을 수 없습니다: ${parsed.sheetName}`);

  const rg = parsed.range;
  const askedRows = rg.r1 - rg.r0 + 1;
  const askedCols = rg.c1 - rg.c0 + 1;
  const cols = Math.min(askedCols, MAX_CELLS);
  const rowBudget = Math.max(1, Math.floor(MAX_CELLS / cols));
  const asked = typeof maxRows === "number" && maxRows > 0 ? Math.floor(maxRows) : MAX_ROWS;
  const rows = Math.min(askedRows, MAX_ROWS, rowBudget, asked);

  const clipped = { hit: rows < askedRows || cols < askedCols };
  const values: CellValue[][] = [];
  for (let r = rg.r0; r < rg.r0 + rows; r++) {
    const row: CellValue[] = [];
    for (let c = rg.c0; c < rg.c0 + cols; c++) {
      row.push(cellValue(sheet.cells[cellKey(r, c)], clipped));
    }
    values.push(row);
  }

  // 열별 대표 유형 (비어 있지 않은 셀 기준 최빈값)
  const colTypes: string[] = [];
  for (let c = rg.c0; c < rg.c0 + cols; c++) {
    const counts: Record<string, number> = {};
    for (let r = rg.r0; r < rg.r0 + rows; r++) {
      const cell = sheet.cells[cellKey(r, c)];
      if (!cell || cell.v === null || cell.v === "") continue;
      counts[cell.t] = (counts[cell.t] ?? 0) + 1;
    }
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    colTypes.push(best ? best[0] : "empty");
  }

  const returned: CellRange = {
    r0: rg.r0,
    c0: rg.c0,
    r1: rg.r0 + rows - 1,
    c1: rg.c0 + cols - 1,
  };
  const label = formatA1(returned, sheet.name);
  return {
    result: {
      ok: true,
      sheet: sheet.name,
      requestedRef: formatA1(rg, sheet.name),
      returnedRef: label,
      rows,
      cols,
      colTypes,
      values,
      truncated: clipped.hit,
      ...(clipped.hit
        ? { note: `상한(${MAX_ROWS}행·${MAX_CELLS}셀·셀당 ${MAX_CHARS}자)으로 잘렸습니다 — 반환 범위는 ${label}입니다` }
        : {}),
    },
    summary: `${label} 읽음 · ${rows}행×${cols}열${clipped.hit ? " · 잘림" : ""}`,
    ref: { sheetId: sheet.id, ...returned, label },
  };
}

function listBlocks(): ToolOutcome {
  const wb = store().workbook;
  const names = new Map(wb.sheets.map((s) => [s.id, s.name]));
  const blocks = blocksInOrder(wb).map((b) => {
    const last = b.last;
    return {
      id: b.id,
      title: b.title ?? "",
      kind: b.kind ?? "code",
      anchor: formatA1(
        { r0: b.anchor.r, c0: b.anchor.c, r1: b.anchor.r, c1: b.anchor.c },
        names.get(b.sheetId),
      ),
      code: b.kind === "markdown" ? (b.markdown ?? "").slice(0, 2000) : b.code.slice(0, 4000),
      ...(b.note ? { note: b.note.slice(0, 1000) } : {}),
      status: last?.status ?? "미실행",
      ...(last?.status === "error"
        ? {
            summaryKo: last.summaryKo ?? "",
            traceback: (last.traceback ?? "").slice(0, 800),
          }
        : {}),
    };
  });
  return { result: { blocks }, summary: `블록 목록 읽음 · ${blocks.length}개` };
}

function proposeCells(input: unknown): ToolOutcome {
  const { ref, values: rawValues, reason } = asRecord(input);
  if (typeof ref !== "string") return fail("ref는 A1 문자열이어야 합니다");
  const values = normalizeValues(rawValues);
  if (!values) return fail("values는 비어 있지 않은 행 배열의 배열이어야 합니다");

  let parsed;
  try {
    parsed = parseA1(ref);
  } catch (e) {
    return fail((e as Error).message);
  }
  const sheet = resolveSheet(parsed.sheetName);
  if (!sheet) return fail(`시트를 찾을 수 없습니다: ${parsed.sheetName}`);

  const rows = values.length;
  const cols = values[0].length;
  if (rows * cols > MAX_CELLS) {
    return fail(`제안 셀 수가 상한(${MAX_CELLS})을 넘습니다 — 범위를 나눠 제안하세요`);
  }
  const range: CellRange = {
    r0: parsed.range.r0,
    c0: parsed.range.c0,
    r1: parsed.range.r0 + rows - 1,
    c1: parsed.range.c0 + cols - 1,
  };

  // L.3: spill(src) 셀은 거부, 수식 셀은 경고 후 허용
  const locked: string[] = [];
  let formulaCells = 0;
  for (let r = range.r0; r <= range.r1; r++) {
    for (let c = range.c0; c <= range.c1; c++) {
      const cell = sheet.cells[cellKey(r, c)];
      if (!cell) continue;
      if (cell.src) locked.push(formatA1({ r0: r, c0: c, r1: r, c1: c }));
      else if (cell.fx) formulaCells++;
    }
  }
  if (locked.length > 0) {
    const shown = locked.slice(0, 5).join(", ");
    return fail(
      `Python 블록 출력(spill) 셀은 덮어쓸 수 없습니다: ${shown}${locked.length > 5 ? ` 외 ${locked.length - 5}개` : ""} — 비어 있는 다른 범위로 다시 제안하세요`,
      `셀 제안 거부 · spill 셀 포함(${locked.length}개)`,
    );
  }

  const label = formatA1(range, sheet.name);
  const proposal: CellProposal = {
    id: newProposalId(),
    kind: "cells",
    sheetId: sheet.id,
    label,
    range,
    values,
    reason: typeof reason === "string" ? reason : "",
    formulaCells,
  };
  return {
    result: {
      proposed: true,
      id: proposal.id,
      ...(formulaCells > 0 ? { warning: `수식 셀 ${formulaCells}개를 덮어씁니다` } : {}),
    },
    summary: `셀 제안 · ${label} (${rows * cols}셀)${formulaCells > 0 ? " · 수식 덮어씀 경고" : ""}`,
    proposal,
  };
}

function proposeBlock(input: unknown): ToolOutcome {
  const { code, title, note, anchor, targetBlockId } = asRecord(input);
  if (typeof code !== "string" || code.trim() === "") return fail("code는 비어 있지 않은 문자열이어야 합니다");

  const wb = store().workbook;
  const target =
    typeof targetBlockId === "string" ? wb.pyBlocks.find((b) => b.id === targetBlockId) : undefined;
  let targetLabel: string | undefined;
  if (target) {
    const name = wb.sheets.find((s) => s.id === target.sheetId)?.name;
    const at = formatA1(
      { r0: target.anchor.r, c0: target.anchor.c, r1: target.anchor.r, c1: target.anchor.c },
      name,
    );
    targetLabel = target.title ? `${at} · ${target.title}` : at;
  }

  let anchorRef: string | undefined;
  if (typeof anchor === "string" && anchor.trim() !== "") {
    try {
      parseA1(anchor);
      anchorRef = anchor;
    } catch {
      // 잘못된 앵커는 무시 — 배치는 앱이 정한다
    }
  }

  const proposal: BlockProposal = {
    id: newProposalId(),
    kind: "block",
    code,
    ...(typeof title === "string" && title.trim() ? { title: title.trim() } : {}),
    ...(typeof note === "string" && note.trim() ? { note: note.trim() } : {}),
    ...(anchorRef ? { anchor: anchorRef } : {}),
    ...(target ? { targetBlockId: target.id, targetLabel } : {}),
  };
  return {
    result: { proposed: true, id: proposal.id },
    summary: `코드 제안 · ${proposal.title ?? (targetLabel ? `${targetLabel} 수정` : "새 블록")}`,
    proposal,
  };
}

/** 도구 1회 실행 — 절대 throw하지 않는다 */
export function runTool(name: string, input: unknown): ToolOutcome {
  try {
    switch (name) {
      case "list_sheets":
        return listSheets();
      case "read_range":
        return readRange(input);
      case "list_blocks":
        return listBlocks();
      case "propose_cells":
        return proposeCells(input);
      case "propose_block":
        return proposeBlock(input);
      default:
        return fail(`알 수 없는 도구: ${name}`);
    }
  } catch (e) {
    return fail(`도구 실행 오류: ${(e as Error).message}`, `${name} 실패`);
  }
}

// ── 제안 적용 (사용자가 [적용]을 눌렀을 때만) ──────────────────────────

/**
 * 셀 제안 적용 — setCells 한 트랜잭션(= 1 undo). 적용 시점에 spill(src) 셀을 다시 확인한다.
 * 재계산 통지(notifyWorkbookEdit)는 호출한 컴포넌트가 한다(단위 테스트에서 워커 미생성).
 */
export function applyCellProposal(p: CellProposal): { range: SheetRange } | { error: string } {
  const st = store();
  const sheet = st.workbook.sheets.find((s) => s.id === p.sheetId);
  if (!sheet) return { error: "대상 시트를 찾을 수 없습니다" };

  const edits: { r: number; c: number; cell: Cell | null }[] = [];
  for (let i = 0; i < p.values.length; i++) {
    for (let j = 0; j < p.values[i].length; j++) {
      const r = p.range.r0 + i;
      const c = p.range.c0 + j;
      if (sheet.cells[cellKey(r, c)]?.src) {
        return { error: `Python 출력(spill) 셀이 생겨 적용할 수 없습니다: ${formatA1({ r0: r, c0: c, r1: r, c1: c })}` };
      }
      edits.push({ r, c, cell: toCell(p.values[i][j]) });
    }
  }
  st.setCells(p.sheetId, edits);
  return { range: { sheetId: p.sheetId, ...p.range } };
}
