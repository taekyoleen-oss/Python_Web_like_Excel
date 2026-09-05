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
 */
export function createReferenceBlocks(title: string, sections: SendSection[]): string[] {
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
  const rows = [0, ...sections.map((_, i) => 2 + i * 2)];
  let col = maxCol < 0 ? 0 : maxCol + 2;
  // ponytail: 열 단위 우측 스캔 — 실사용 밀도에서 수 회면 끝난다
  while (rows.some((r) => taken(r, col))) col++;

  const md = `# ${title}`;
  const blocks: PyBlock[] = [
    {
      id: newId(),
      sheetId: sheet.id,
      anchor: { r: 0, c: col },
      code: "",
      outputMode: "values",
      includeIndex: "auto",
      kind: "markdown",
      markdown: md,
      title: markdownTitle(md) || title,
    },
  ];
  sections.forEach((s, i) => {
    const block: PyBlock = {
      id: newId(),
      sheetId: sheet.id,
      anchor: { r: 2 + i * 2, c: col },
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
