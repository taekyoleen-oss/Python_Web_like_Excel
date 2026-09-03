// CalcHost 구현 + RunCoordinator 배선 — 계약: /output/calc-engine-api.md
// 스토어 반영(트랜잭션·undo 단계)은 전부 여기서. calc-engine.ts는 읽기 전용 계약.

import { toast } from "sonner";
import {
  buildGraph,
  dirtyPropagation,
  resolveRefs,
  RunCoordinator,
  type CalcHost,
  type SheetRange,
  type WorkbookView,
} from "@/lib/runtime/calc-engine";
import { getRuntimeClient } from "@/lib/runtime/client";
import { summarizeErrorKo } from "@/lib/runtime/errors-ko";
import { putBlob } from "@/lib/storage/db";
import { cellKey, type CalcMode, type RunResult } from "@/types/workbook";
import { useWorkbookStore } from "./model";
import { checkSpillConflict } from "./spill";

const getState = () => useWorkbookStore.getState();

/** 스토어 현재 상태의 평면 사본 (엔진 계약) */
export function makeView(): WorkbookView {
  const wb = getState().workbook;
  return {
    blocks: wb.pyBlocks.map(({ id, sheetId, anchor, code, outputMode, includeIndex }) => ({
      id,
      sheetId,
      anchor,
      code,
      outputMode,
      includeIndex,
    })),
    sheetOrder: wb.sheets.map((s) => s.id),
    spills: new Map(
      wb.pyBlocks.map((b) => [
        b.id,
        b.last?.status === "ok" ? b.last.spillRange : undefined,
      ]),
    ),
  };
}

const resolveSheetName = (name: string): string | undefined =>
  getState().workbook.sheets.find((s) => s.name === name)?.id;

/** 합성 errorType(엔진 발신)은 message가 이미 한국어 — errors-ko 매핑을 거치지 않는다 */
const ENGINE_ERRORS = new Set(["PyGridCycleError", "PyGridAnalyzeError", "PyGridRefError", "WorkerError"]);

export const calcHost: CalcHost = {
  getCell(sheetId, r, c) {
    const cell = getState()
      .workbook.sheets.find((s) => s.id === sheetId)
      ?.cells[cellKey(r, c)];
    return cell ? { v: cell.v, t: cell.t } : undefined;
  },

  resolveSheet: resolveSheetName,

  onBusy(blockId) {
    getState().setBlockRunning(blockId, true);
  },

  onResult(blockId, payload, cells, spill) {
    const st = getState();
    st.setBlockRunning(blockId, false);
    st.clearDirty(blockId);
    const block = st.workbook.pyBlocks.find((b) => b.id === blockId);
    if (!block) return;
    const ranAt = new Date().toISOString();

    if (!payload.ok) {
      const summaryKo =
        payload.errorType === "PyGridCycleError"
          ? "순환 참조"
          : ENGINE_ERRORS.has(payload.errorType)
            ? payload.message
            : summarizeErrorKo(payload.errorType, payload.message);
      const last: RunResult = {
        status: "error",
        stdout: payload.stdout,
        stderr: payload.stderr,
        traceback: payload.traceback || undefined,
        summaryKo,
        durationMs: payload.durationMs,
        ranAt,
      };
      st.applyBlockResult(blockId, [[{ v: "#PYTHON!", t: "e" }]], { last });
      return;
    }

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

    // 값 모드 성공 — payload가 셀을 돌려줬는지로 판정 (실행 중 모드 토글에 안전)
    if (cells && spill) {
      const sheet = st.workbook.sheets.find((s) => s.id === block.sheetId);
      if (!sheet || cells.length === 0) return;
      const conflict = checkSpillConflict(sheet, st.workbook.pyBlocks, blockId, block.anchor, [
        cells.length,
        cells[0].length,
      ]);
      if (conflict) {
        st.applyBlockResult(blockId, [[{ v: "#SPILL!", t: "e" }]], {
          last: { ...base, status: "spill", summaryKo: conflict },
        });
        return;
      }
      st.applyBlockResult(blockId, cells, {
        last: { ...base, spillRange: spill },
        clearPrevious: true,
      });
      st.setFlash({ sheetId: block.sheetId, range: spill });
      setTimeout(() => getState().setFlash(null), 400);
      return;
    }

    // 객체 모드 성공 — 이미지 blob 저장 후 카드 반영 (저장 실패 시 imageBlobId 생략)
    void (async () => {
      let imageBlobId: string | undefined;
      if (payload.imagePng) {
        try {
          imageBlobId = crypto.randomUUID();
          await putBlob(imageBlobId, new Blob([payload.imagePng], { type: "image/png" }));
        } catch {
          imageBlobId = undefined;
        }
      }
      const label = `[${payload.typeName ?? payload.kind}${
        payload.shape ? ` ${payload.shape[0]}×${payload.shape[1]}` : ""
      }]`;
      const stNow = getState();
      if (!stNow.workbook.pyBlocks.some((b) => b.id === blockId)) return;
      stNow.applyBlockResult(blockId, [[{ v: label, t: "s" }]], {
        last: { ...base, imageBlobId },
        clearPrevious: true,
      });
      const range = {
        r0: block.anchor.r,
        c0: block.anchor.c,
        r1: block.anchor.r,
        c1: block.anchor.c,
      };
      stNow.setFlash({ sheetId: block.sheetId, range });
      setTimeout(() => getState().setFlash(null), 400);
    })();
  },
};

// ── 조율기 싱글턴 ────────────────────────────────────────

let coordinator: RunCoordinator | null = null;

export function getCoordinator(): RunCoordinator {
  coordinator ??= new RunCoordinator(getRuntimeClient(), calcHost);
  // 모드·타임아웃은 호출 시점 스토어에서 항상 갱신 (워크북 복원·설정 변경 대응)
  coordinator.mode = getState().workbook.calcMode;
  coordinator.timeoutSec = getState().workbook.settings.timeoutSec;
  return coordinator;
}

/** 계산 모드 전환 — 스토어 + 조율기 동기화 (툴바·상태 바 공용) */
export function setCalcModeEverywhere(mode: CalcMode): void {
  getState().setCalcMode(mode);
  if (coordinator) coordinator.mode = mode;
}

// ── 편집 통지 (자동: 엔진 디바운스 실행 / 수동: dirty 배지) ──

// ponytail: analyze refs 로컬 캐시(코드 문자열 키, 무한 보관) — 블록 수 규모라 무해
const refsCache = new Map<string, string[]>();

async function analyzedRefs(code: string): Promise<string[]> {
  const hit = refsCache.get(code);
  if (hit) return hit;
  try {
    const refs = await getRuntimeClient().analyze(code);
    refsCache.set(code, refs);
    return refs;
  } catch {
    refsCache.set(code, []);
    return [];
  }
}

async function markDirtyManual(ranges: SheetRange[], editedBlockIds: string[]): Promise<void> {
  const view = makeView();
  const resolved = new Map<string, SheetRange[]>();
  for (const b of view.blocks) {
    resolved.set(b.id, resolveRefs(await analyzedRefs(b.code), b.sheetId, resolveSheetName));
  }
  const graph = buildGraph(view.blocks, resolved, view.spills);
  const dirty = dirtyPropagation(resolved, graph, ranges, editedBlockIds);
  if (dirty.size > 0) getState().markDirty([...dirty]);
}

/** 셀 편집·코드 수정 통지 진입점 (SheetGrid·PyBlockCard·붙여넣기에서 호출) */
export function notifyWorkbookEdit(ranges: SheetRange[], editedBlockIds: string[] = []): void {
  if (getState().workbook.pyBlocks.length === 0) return;
  if (getState().workbook.calcMode === "auto") {
    getCoordinator().notifyEdit(ranges, editedBlockIds, makeView());
  } else {
    void markDirtyManual(ranges, editedBlockIds);
  }
}

/** §4.8: 준비 전 실행 요청은 큐잉된다 — 문구만 안내 */
export function toastIfQueued(): void {
  if (getRuntimeClient().getStatus() !== "ready") {
    toast("런타임 준비 후 실행됩니다", { id: "rt-queue" });
  }
}

// e2e·디버깅용 노출
if (typeof window !== "undefined") {
  (window as unknown as { __pygridCalc: unknown }).__pygridCalc = {
    notifyEdit: notifyWorkbookEdit,
    whenIdle: () => getCoordinator().whenIdle(),
  };
}
