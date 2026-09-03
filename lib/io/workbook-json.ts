// .pygrid.json 저장/열기 — 설계서 §1.5·§3.4. 스키마는 types/workbook.ts §3.1.

import type { PyBlock, Workbook } from "@/types/workbook";

export const WARN_BYTES = 50 * 1024 * 1024;
export const MAX_BYTES = 100 * 1024 * 1024;

export type SizeVerdict = "ok" | "warn" | "block";

/** §1.6: 50MB 초과 경고, 100MB 초과 저장 거부 */
export const checkSizeGuard = (bytes: number): SizeVerdict =>
  bytes > MAX_BYTES ? "block" : bytes > WARN_BYTES ? "warn" : "ok";

/**
 * 직렬화. imageBlobId만 제거하고 last는 유지한다 — 이미지 blob은 IndexedDB에만 있어
 * 파일로 가져갈 수 없고, 열기 후 블록 재실행으로 복원된다.
 */
export function serializeWorkbook(wb: Workbook): string {
  const clean: Workbook = {
    ...wb,
    pyBlocks: wb.pyBlocks.map((b): PyBlock => {
      if (!b.last?.imageBlobId) return b;
      const { imageBlobId: _drop, ...last } = b.last;
      return { ...b, last };
    }),
  };
  return JSON.stringify(clean);
}

export const workbookJsonBytes = (wb: Workbook): number =>
  new TextEncoder().encode(serializeWorkbook(wb)).length;

/** 손상·비호환 파일은 한국어 메시지로 throw */
export function parseWorkbookJson(text: string): Workbook {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("워크북 파일이 손상되었습니다 (JSON 구문 오류)");
  }
  const wb = raw as Partial<Workbook>;
  if (typeof wb !== "object" || wb === null) {
    throw new Error("워크북 파일 형식이 아닙니다");
  }
  if (typeof wb.version !== "number" || wb.version > 1) {
    throw new Error(
      "새 버전의 PyGrid에서 저장된 파일입니다. 앱을 새로고침한 뒤 다시 시도하세요.",
    );
  }
  if (
    typeof wb.id !== "string" ||
    typeof wb.title !== "string" ||
    !Array.isArray(wb.sheets) ||
    wb.sheets.length === 0 ||
    wb.sheets.some(
      (s) =>
        typeof s?.id !== "string" ||
        typeof s?.name !== "string" ||
        typeof s?.rowCount !== "number" ||
        typeof s?.colCount !== "number" ||
        typeof s?.cells !== "object" ||
        s.cells === null,
    )
  ) {
    throw new Error("워크북 파일이 손상되었습니다 (필수 필드 누락)");
  }
  // 선택 필드 기본값 보정
  return {
    ...wb,
    version: 1,
    pyBlocks: Array.isArray(wb.pyBlocks) ? wb.pyBlocks : [],
    initScript: typeof wb.initScript === "string" ? wb.initScript : "",
    calcMode: wb.calcMode === "manual" ? "manual" : "auto",
    settings: {
      timeoutSec: wb.settings?.timeoutSec ?? 60,
      inferTypesOnPaste: wb.settings?.inferTypesOnPaste ?? true,
    },
    createdAt: wb.createdAt ?? new Date().toISOString(),
    updatedAt: wb.updatedAt ?? new Date().toISOString(),
  } as Workbook;
}

/** Blob + anchor 다운로드 (브라우저 전용) */
export function downloadBlob(blob: Blob, filename: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

const safeFilename = (title: string): string =>
  (title.trim() || "워크북").replace(/[\\/:*?"<>|]/g, "_");

/** 저장 다운로드. 반환: 크기 판정 (warn이면 호출부가 toast) */
export function downloadWorkbookJson(wb: Workbook): SizeVerdict {
  const json = serializeWorkbook(wb);
  const verdict = checkSizeGuard(new TextEncoder().encode(json).length);
  downloadBlob(
    new Blob([json], { type: "application/json" }),
    `${safeFilename(wb.title)}.pygrid.json`,
  );
  return verdict;
}
