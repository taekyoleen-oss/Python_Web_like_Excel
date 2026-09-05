// 참조 뷰 → 워크북 "블록으로 보내기" (부록 E R3).
// 마크다운 제목 블록(# 제목) + 섹션별 코드 블록을 한 스토어 트랜잭션(= 한 undo 단계)으로
// 생성한다. 앵커는 활성 시트의 빈 열 영역(사용 범위 + 2열 여백)에 세로로 쌓는다.
// 블록은 자동 실행되지 않는다 — 사용자가 코드를 확인하고 직접 실행한다.

import { toast } from "sonner";
import { cellKey, type PyBlock } from "@/types/workbook";
import { markdownTitle } from "./markdown";
import { useWorkbookStore } from "./model";
import { newId, normalizeBlock } from "./outputs";
import { saveSettings } from "@/lib/storage/db";

export interface SendSection {
  title?: string;
  code: string;
}

/**
 * 블록 생성만 수행(뷰 전환·toast 없음) — 단위 테스트와 sendToWorkbook 공용.
 * 반환: 생성한 블록 id 목록(첫 번째가 마크다운 제목 블록). 섹션이 없으면 [].
 * title이 null이면 마크다운 제목 블록 없이 코드 블록만 만든다(데이터 로드 블록 R5).
 */
export function createReferenceBlocks(title: string | null, sections: SendSection[]): string[] {
  const st = useWorkbookStore.getState();
  const sheet = st.workbook.sheets.find((s) => s.id === st.activeSheetId);
  if (!sheet || sections.length === 0) return [];

  // 사용 열 범위 — 셀(값·spill) + 이 시트에 놓인 블록·출력 앵커
  let maxCol = -1;
  for (const key of Object.keys(sheet.cells)) {
    const c = Number(key.slice(key.indexOf(":") + 1));
    if (c > maxCol) maxCol = c;
  }
  for (const b of st.workbook.pyBlocks) {
    if (b.sheetId === sheet.id) maxCol = Math.max(maxCol, b.anchor.c);
    for (const o of b.outputs ?? []) {
      if ((o.sheetId ?? b.sheetId) === sheet.id) maxCol = Math.max(maxCol, o.anchor.c);
    }
  }

  const taken = (r: number, c: number): boolean => {
    const cell = sheet.cells[cellKey(r, c)];
    if (cell && (cell.src || (cell.v !== null && cell.v !== ""))) return true;
    return st.workbook.pyBlocks.some(
      (b) =>
        (b.sheetId === sheet.id && b.anchor.r === r && b.anchor.c === c) ||
        (b.outputs ?? []).some(
          (o) => (o.sheetId ?? b.sheetId) === sheet.id && o.anchor.r === r && o.anchor.c === c,
        ),
    );
  };

  // 마크다운 r0, 코드 블록은 2행 간격 — 앵커가 사용 셀과 겹치면 한 열씩 오른쪽으로
  const codeRow = (i: number) => (title === null ? i * 2 : 2 + i * 2);
  const rows = sections.map((_, i) => codeRow(i));
  if (title !== null) rows.unshift(0);
  let col = maxCol < 0 ? 0 : maxCol + 2;
  // ponytail: 열 단위 우측 스캔 — 실사용 밀도에서 수 회면 끝난다
  while (rows.some((r) => taken(r, col))) col++;

  const blocks: PyBlock[] = [];
  if (title !== null) {
    const md = `# ${title}`;
    blocks.push({
      id: newId(),
      sheetId: sheet.id,
      anchor: { r: 0, c: col },
      code: "",
      outputMode: "values",
      includeIndex: "auto",
      kind: "markdown",
      markdown: md,
      title: markdownTitle(md) || title,
    });
  }
  sections.forEach((s, i) => {
    const block: PyBlock = {
      id: newId(),
      sheetId: sheet.id,
      anchor: { r: codeRow(i), c: col },
      code: s.code,
      outputMode: "values",
      includeIndex: "auto",
      ...(s.title ? { title: s.title } : {}),
    };
    normalizeBlock(block); // 코드 블록은 출력 1개 보장
    blocks.push(block);
  });

  // 한 setState = 한 트랜잭션 = 한 undo 단계
  useWorkbookStore.setState((state) => {
    state.workbook.pyBlocks.push(...blocks);
  });
  return blocks.map((b) => b.id);
}

/**
 * 모델적합 "시트에서 가져오기" (R4) — 현재 그리드 선택 범위(1~3열)를
 * fitData 파서용 string[][]로 변환한다. 선택이 없거나 4열 이상이면 null + 사유.
 */
export function selectionToCells(): { cells: string[][] } | { error: string } {
  const st = useWorkbookStore.getState();
  const sel = st.selection;
  if (!sel) return { error: "워크북에서 데이터 범위를 먼저 선택하세요." };
  const sheet = st.workbook.sheets.find((s) => s.id === st.activeSheetId);
  if (!sheet) return { error: "활성 시트를 찾을 수 없습니다." };
  const r0 = Math.min(sel.r0, sel.r1);
  const r1 = Math.max(sel.r0, sel.r1);
  const c0 = Math.min(sel.c0, sel.c1);
  const c1 = Math.max(sel.c0, sel.c1);
  if (c1 - c0 + 1 > 3)
    return { error: "1~3열 범위만 지원합니다 (개별 값 1열 · 연도+값 2열 · 최소·최대·건수 3열)." };
  const cells: string[][] = [];
  for (let r = r0; r <= r1; r++) {
    const row: string[] = [];
    for (let c = c0; c <= c1; c++) {
      const v = sheet.cells[cellKey(r, c)]?.v;
      row.push(v === null || v === undefined ? "" : String(v));
    }
    cells.push(row);
  }
  if (!cells.some((row) => row.some((v) => v.trim() !== "")))
    return { error: "선택한 범위가 비어 있습니다." };
  return { cells };
}

/** 참조 뷰의 "블록으로 보내기" — 생성 후 워크북 뷰 전환 + 첫 블록 포커스 + toast */
export function sendToWorkbook(title: string, sections: SendSection[]): string[] {
  const ids = createReferenceBlocks(title, sections);
  if (ids.length === 0) return ids;
  const st = useWorkbookStore.getState();
  st.setView("workbook");
  void saveSettings({ view: "workbook" });
  st.setFocusBlock(ids[0]);
  st.setSelectedBlock(ids[0]);
  toast(`블록 ${ids.length}개를 만들었습니다 — 실행 전 코드를 확인하세요`);
  return ids;
}
