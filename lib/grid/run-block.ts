// 단일 블록 실행 미니 러너 — M5에서 calc-engine으로 교체 (의존성 그래프·dirty 전파 없음)

import { toast } from "sonner";
import { getRuntimeClient } from "@/lib/runtime/client";
import { spillRange, toCells } from "@/lib/runtime/converters";
import { summarizeErrorKo } from "@/lib/runtime/errors-ko";
import type { RangeSnapshot } from "@/lib/runtime/protocol";
import { putBlob } from "@/lib/storage/db";
import {
  cellKey,
  type PyBlock,
  type RunResult,
  type Sheet,
  type Workbook,
} from "@/types/workbook";
import { A1Error, parseA1 } from "./a1";
import { useWorkbookStore } from "./model";
import { checkSpillConflict } from "./spill";

/** xl() 참조 → RangeSnapshot. 시트 이름 없으면 블록의 시트 기준 */
function snapshotRef(
  workbook: Workbook,
  defaultSheet: Sheet,
  ref: string,
): RangeSnapshot {
  const { sheetName, range, scalar } = parseA1(ref);
  const sheet = sheetName
    ? workbook.sheets.find((s) => s.name === sheetName)
    : defaultSheet;
  if (!sheet) throw new A1Error(ref, `시트 "${sheetName}"이(가) 없습니다`);
  const values: RangeSnapshot["values"] = [];
  const types: RangeSnapshot["types"] = [];
  for (let r = range.r0; r <= range.r1; r++) {
    const vRow: RangeSnapshot["values"][number] = [];
    const tRow: RangeSnapshot["types"][number] = [];
    for (let c = range.c0; c <= range.c1; c++) {
      const cell = sheet.cells[cellKey(r, c)];
      vRow.push(cell?.v ?? null);
      tRow.push(cell?.t ?? "s");
    }
    values.push(vRow);
    types.push(tRow);
  }
  return { values, types, scalar };
}

const blockOf = (id: string): PyBlock | undefined =>
  useWorkbookStore.getState().workbook.pyBlocks.find((b) => b.id === id);

function applyFailure(blockId: string, summaryKo: string, partial: Partial<RunResult>): void {
  const last: RunResult = {
    status: "error",
    stdout: "",
    stderr: "",
    durationMs: 0,
    ranAt: new Date().toISOString(),
    summaryKo,
    ...partial,
  };
  useWorkbookStore
    .getState()
    .applyBlockResult(blockId, [[{ v: "#PYTHON!", t: "e" }]], { last });
}

export async function runBlock(blockId: string): Promise<void> {
  const st = useWorkbookStore.getState();
  const block = st.workbook.pyBlocks.find((b) => b.id === blockId);
  if (!block || st.runningBlocks[blockId]) return;
  const client = getRuntimeClient();
  const ranAt = new Date().toISOString();
  st.setBlockRunning(blockId, true);
  try {
    // 1) xl() 참조 추출 (ast — 비리터럴 인수는 한국어 메시지로 거부됨)
    let refs: string[];
    try {
      refs = await client.analyze(block.code);
    } catch (e) {
      applyFailure(blockId, (e as Error).message, { ranAt });
      return;
    }

    // 2) 참조 → 스냅샷 직렬화
    const snapshots: Record<string, RangeSnapshot> = {};
    const wbNow = useWorkbookStore.getState().workbook;
    const defaultSheet = wbNow.sheets.find((s) => s.id === block.sheetId);
    if (!defaultSheet) return;
    for (const ref of refs) {
      try {
        snapshots[ref] = snapshotRef(wbNow, defaultSheet, ref);
      } catch (e) {
        applyFailure(blockId, (e as Error).message, { ranAt });
        return;
      }
    }

    // 3) 실행
    const payload = await client.run(
      blockId,
      block.code,
      snapshots,
      block.outputMode,
      block.includeIndex,
      wbNow.settings.timeoutSec,
    );

    const cur = blockOf(blockId);
    if (!cur) return; // 실행 중 블록 삭제됨

    if (!payload.ok) {
      applyFailure(blockId, summarizeErrorKo(payload.errorType, payload.message), {
        stdout: payload.stdout,
        stderr: payload.stderr,
        traceback: payload.traceback,
        durationMs: payload.durationMs,
        ranAt,
      });
      return;
    }

    const stCur = useWorkbookStore.getState();
    const base: RunResult = {
      status: "ok",
      kind: payload.kind,
      shape: payload.shape,
      preview: payload.preview,
      stdout: payload.stdout,
      stderr: payload.stderr,
      durationMs: payload.durationMs,
      ranAt,
    };

    if (cur.outputMode === "values" && payload.cells) {
      // 값 모드: spill 충돌 검사 → 반영
      const cells2d = toCells(payload.cells);
      const rows = cells2d.length;
      const cols = cells2d[0]?.length ?? 0;
      const sheetCur = stCur.workbook.sheets.find((s) => s.id === cur.sheetId);
      if (!sheetCur || rows === 0 || cols === 0) return;
      const conflict = checkSpillConflict(
        sheetCur,
        stCur.workbook.pyBlocks,
        blockId,
        cur.anchor,
        [rows, cols],
      );
      if (conflict) {
        stCur.applyBlockResult(blockId, [[{ v: "#SPILL!", t: "e" }]], {
          last: { ...base, status: "spill", summaryKo: conflict },
        });
        return;
      }
      const range = spillRange(cur.anchor, rows, cols);
      stCur.applyBlockResult(blockId, cells2d, {
        last: { ...base, spillRange: range },
        clearPrevious: true,
      });
      stCur.setFlash({ sheetId: cur.sheetId, range });
      setTimeout(() => useWorkbookStore.getState().setFlash(null), 400);
    } else {
      // 객체 모드: 앵커 카드 마커
      let imageBlobId: string | undefined;
      if (payload.imagePng) {
        imageBlobId = crypto.randomUUID();
        void putBlob(imageBlobId, new Blob([payload.imagePng], { type: "image/png" }));
      }
      const label = `[${payload.typeName ?? payload.kind}${
        payload.shape ? ` ${payload.shape[0]}×${payload.shape[1]}` : ""
      }]`;
      stCur.applyBlockResult(blockId, [[{ v: label, t: "s" }]], {
        last: { ...base, imageBlobId },
        clearPrevious: true,
      });
      const range = { r0: cur.anchor.r, c0: cur.anchor.c, r1: cur.anchor.r, c1: cur.anchor.c };
      stCur.setFlash({ sheetId: cur.sheetId, range });
      setTimeout(() => useWorkbookStore.getState().setFlash(null), 400);
    }
  } finally {
    useWorkbookStore.getState().setBlockRunning(blockId, false);
  }
}

/** 기본 계산 순서: 시트 순 → 앵커 행 → 열 (§2.4 기본 순서; 의존성 정렬은 M5) */
export function blocksInOrder(workbook: Workbook): PyBlock[] {
  const sheetIndex = new Map(workbook.sheets.map((s, i) => [s.id, i]));
  return [...workbook.pyBlocks].sort(
    (a, b) =>
      (sheetIndex.get(a.sheetId) ?? 0) - (sheetIndex.get(b.sheetId) ?? 0) ||
      a.anchor.r - b.anchor.r ||
      a.anchor.c - b.anchor.c,
  );
}

export async function runAllBlocks(): Promise<void> {
  for (const block of blocksInOrder(useWorkbookStore.getState().workbook)) {
    await runBlock(block.id);
  }
}

/** 툴바 ＋ Python 블록 / Ctrl+Shift+P */
export function addBlockAtSelection(): void {
  const st = useWorkbookStore.getState();
  const anchor = st.selection
    ? { r: st.selection.r0, c: st.selection.c0 }
    : { r: 0, c: 0 };
  const id = st.addPyBlock(st.activeSheetId, anchor);
  if (id === null) {
    toast.error("이 셀에는 블록을 만들 수 없습니다 (이미 블록 앵커이거나 spill 셀입니다)");
    return;
  }
  st.setFocusBlock(id);
}
