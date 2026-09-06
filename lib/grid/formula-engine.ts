// 수식 셀 레지스트리·의존성 그래프·재계산 — 부록 I.2
// 순수: 전달된 Workbook(immer draft)만 수정하고 바뀐 셀 범위를 돌려준다. 스토어 무관.

import {
  cellKey,
  parseCellKey,
  type CellRange,
  type Workbook,
} from "@/types/workbook";
import { parseFormula, type FormulaErrorCode, type ParsedFormula } from "./formula";

export interface SheetRange extends CellRange {
  sheetId: string;
}

// ponytail: fx 문자열 키 파스 캐시(무한 보관) — calc-host refsCache와 동일 패턴, 수식 수 규모라 무해
const parseCache = new Map<string, ParsedFormula>();
const parsed = (fx: string): ParsedFormula => {
  let p = parseCache.get(fx);
  if (!p) {
    p = parseFormula(fx);
    parseCache.set(fx, p);
  }
  return p;
};

interface Entry {
  sheetId: string;
  r: number;
  c: number;
  key: string;
  pf: ParsedFormula;
  /** 시트 이름을 id로 해석한 참조 (모르는 시트는 null — 평가 시 #REF!) */
  refs: { sheetId: string | null; range: CellRange }[];
}

const intersects = (a: CellRange, b: CellRange): boolean =>
  a.r0 <= b.r1 && b.r0 <= a.r1 && a.c0 <= b.c1 && b.c0 <= a.c1;

const cellOf = (e: Entry): CellRange => ({ r0: e.r, c0: e.c, r1: e.r, c1: e.c });

/** e가 d의 셀을 참조하면 true (d를 먼저 계산해야 한다). e === d 자기 참조도 잡는다 */
const depends = (e: Entry, d: Entry): boolean =>
  e.refs.some((rf) => rf.sheetId === d.sheetId && intersects(rf.range, cellOf(d)));

/**
 * 셀 변경 후 수식 재계산. edited === null이면 전체 재계산(시트 추가/삭제/이름 변경).
 * 영향받는 수식만 의존 순서로 계산하고, 순환 구성원은 전부 #CIRC!.
 * v가 실제로 바뀐 셀 범위를 반환한다 (호출부가 notifyWorkbookEdit로 전달).
 */
export function recalcAfter(wb: Workbook, edited: SheetRange[] | null): SheetRange[] {
  // 1) 수식 셀 수집 — ponytail: 전 셀 스캔 O(cells)/쓰기 (clearRange와 동일 규모), 수식 인덱스가 필요해지면 교체
  const byName = new Map(wb.sheets.map((s) => [s.name, s.id]));
  const byId = new Map(wb.sheets.map((s) => [s.id, s]));
  const entries: Entry[] = [];
  for (const sheet of wb.sheets) {
    for (const key of Object.keys(sheet.cells)) {
      const fx = sheet.cells[key].fx;
      if (!fx) continue;
      const { r, c } = parseCellKey(key);
      const pf = parsed(fx);
      entries.push({
        sheetId: sheet.id,
        r,
        c,
        key,
        pf,
        refs: pf.refs.map((rf) => ({
          sheetId: rf.sheetName === undefined ? sheet.id : (byName.get(rf.sheetName) ?? null),
          range: rf.range,
        })),
      });
    }
  }
  if (entries.length === 0) return [];

  // 2) 시드: 편집 범위 안의 수식 자신 + 편집 범위와 겹치는 참조를 가진 수식
  const isSeed = (e: Entry): boolean =>
    edited === null ||
    edited.some(
      (ed) =>
        (ed.sheetId === e.sheetId && intersects(ed, cellOf(e))) ||
        e.refs.some((rf) => rf.sheetId === ed.sheetId && intersects(rf.range, ed)),
    );

  // 3) 영향 집합: 시드에서 의존자 방향 폐포 — ponytail: O(F²) 쌍 검사, 수식 수백 개까지 무해
  const affected = new Set<Entry>();
  let frontier = entries.filter(isSeed);
  while (frontier.length > 0) {
    for (const e of frontier) affected.add(e);
    frontier = entries.filter(
      (e) => !affected.has(e) && [...affected].some((d) => depends(e, d)),
    );
  }
  if (affected.size === 0) return [];

  // 4) 평가 준비
  const changed: SheetRange[] = [];
  const write = (e: Entry, v: number | FormulaErrorCode): void => {
    const sheet = byId.get(e.sheetId);
    if (!sheet) return;
    const old = sheet.cells[e.key];
    const t = typeof v === "number" ? ("n" as const) : ("e" as const);
    if (old && old.v === v && old.t === t) return;
    sheet.cells[e.key] = { ...old, fx: old?.fx ?? "", v, t };
    changed.push({ sheetId: e.sheetId, ...cellOf(e) });
  };
  const getCellFor =
    (e: Entry) => (sheetName: string | undefined, r: number, c: number) => {
      const sid = sheetName === undefined ? e.sheetId : byName.get(sheetName);
      const sheet = sid === undefined ? undefined : byId.get(sid);
      if (!sheet) return "#REF!" as const;
      return sheet.cells[cellKey(r, c)];
    };

  // 5) 의존이 모두 끝난 것부터 평가. 진행이 없으면 남은 것 중
  //    의존 사슬로 자기 자신에 되돌아오는 수식 = 순환 구성원 → 전부 #CIRC!
  //    (순환의 하류 수식은 구성원이 끝난 뒤 정상 평가된다 — #CIRC! 셀 참조는 #VALUE!)
  const pending = new Set(affected);
  const cyclic = (start: Entry): boolean => {
    // ponytail: 남은 노드 대상 O(P²) DFS — 순환 진단 경로라 규모 무해
    const seen = new Set<Entry>();
    const stack = [...pending].filter((d) => depends(start, d));
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (cur === start) return true;
      if (seen.has(cur)) continue;
      seen.add(cur);
      for (const d of pending) if (depends(cur, d)) stack.push(d);
    }
    return false;
  };
  while (pending.size > 0) {
    // d === e 포함 — 자기 참조(=A1이 A1에)도 순환으로 흘러가게 한다
    const ready = [...pending].filter((e) => ![...pending].some((d) => depends(e, d)));
    if (ready.length > 0) {
      for (const e of ready) {
        pending.delete(e);
        write(e, e.pf.eval(getCellFor(e)));
      }
      continue;
    }
    const members = [...pending].filter(cyclic);
    for (const e of members) {
      pending.delete(e);
      write(e, "#CIRC!");
    }
    if (members.length === 0) break; // 방어 — 이론상 도달 불가
  }
  return changed;
}
