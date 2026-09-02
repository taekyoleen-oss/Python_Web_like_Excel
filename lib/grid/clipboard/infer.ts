// 유형 추론 — 픽스처(output/paste-fixtures)가 스펙이다. 설계서 §4.5.2
// 열 단위: 비어 있지 않은 셀의 90% 이상이 한 유형이면 그 유형, 불일치 셀은 문자열 유지.

import type { Cell } from "@/types/workbook";

export type DateOrder = "ymd" | "mdy";

export interface InferOptions {
  dateOrder?: DateOrder;
  /** 다이얼로그의 헤더 체크박스로 강제. 미지정이면 자동 감지 */
  forceHeader?: boolean;
}

export interface InferResult {
  headerRow: boolean;
  cells: (Cell | null)[][];
}

type CellClass = "n" | "d" | "b" | "s" | "empty";

export interface ClassifiedCell {
  cls: CellClass;
  cell: Cell | null;
}

/** "12.5" ÷ 100 → 0.125 — 문자열 소수점 이동으로 부동소수점 오차 없이 */
function divideBy100(numStr: string): number {
  const neg = numStr.startsWith("-");
  const body = neg ? numStr.slice(1) : numStr;
  const [int, frac = ""] = body.split(".");
  const paddedInt = int.padStart(3, "0");
  const digits = paddedInt + frac;
  const cut = paddedInt.length - 2;
  return Number((neg ? "-" : "") + digits.slice(0, cut) + "." + digits.slice(cut));
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function parseDate(raw: string, dateOrder: DateOrder): string | null {
  let y = 0;
  let mo = 0;
  let day = 0;
  let m: RegExpExecArray | null;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw))) {
    [y, mo, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else if ((m = /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?$/.exec(raw))) {
    // 한국식 "2026. 9. 2"
    [y, mo, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else if ((m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(raw))) {
    [y, mo, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else if (dateOrder === "mdy" && (m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw))) {
    [mo, day, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else {
    return null;
  }
  if (mo < 1 || mo > 12 || day < 1 || day > 31) return null;
  return `${y}-${pad2(mo)}-${pad2(day)}`;
}

/** 단일 raw 셀 분류 (trim 후 판정, 문자열 값도 trim 저장) */
export function classifyCell(rawIn: string, dateOrder: DateOrder): ClassifiedCell {
  const raw = rawIn.trim();
  if (raw === "") return { cls: "empty", cell: null };
  if (/^(true|false)$/i.test(raw)) {
    return { cls: "b", cell: { v: raw.toLowerCase() === "true", t: "b" } };
  }
  let m: RegExpExecArray | null;
  // 퍼센트: 12.5% → 0.125 + '0.0%'
  if ((m = /^(-?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?%$/.exec(raw))) {
    const numStr = m[1] + m[2].replace(/,/g, "") + (m[3] ?? "");
    return { cls: "n", cell: { v: divideBy100(numStr), t: "n", f: "0.0%" } };
  }
  // 천단위 콤마: 1,234 → 1234 + '#,##0'
  if (/^-?\d{1,3}(?:,\d{3})+(\.\d+)?$/.test(raw)) {
    return { cls: "n", cell: { v: Number(raw.replace(/,/g, "")), t: "n", f: "#,##0" } };
  }
  // 일반 숫자·지수
  if (/^-?(\d+(\.\d+)?|\.\d+)(e[+-]?\d+)?$/i.test(raw)) {
    return { cls: "n", cell: { v: Number(raw), t: "n" } };
  }
  const iso = parseDate(raw, dateOrder);
  if (iso) return { cls: "d", cell: { v: iso, t: "d", f: "yyyy-mm-dd" } };
  return { cls: "s", cell: { v: raw, t: "s" } };
}

export function inferCells(raw: string[][], opts: InferOptions = {}): InferResult {
  const dateOrder = opts.dateOrder ?? "ymd";
  if (raw.length === 0) return { headerRow: false, cells: [] };
  const width = Math.max(...raw.map((r) => r.length));
  const classified = raw.map((row) =>
    Array.from({ length: width }, (_, c) => classifyCell(row[c] ?? "", dateOrder)),
  );

  // 열 추론: bodyStart 이후 행에서 클래스 비율 ≥ 90%면 그 유형, 아니면 전부 문자열
  const inferColumns = (bodyStart: number): (Cell | null)[][] => {
    const out: (Cell | null)[][] = raw.map(() => new Array<Cell | null>(width).fill(null));
    for (let c = 0; c < width; c++) {
      const counts = { n: 0, d: 0, b: 0, s: 0 };
      let nonEmpty = 0;
      for (let r = bodyStart; r < classified.length; r++) {
        const cl = classified[r][c];
        if (cl.cls === "empty") continue;
        nonEmpty++;
        counts[cl.cls]++;
      }
      let colType: Exclude<CellClass, "empty"> = "s";
      for (const t of ["n", "d", "b"] as const) {
        if (nonEmpty > 0 && counts[t] / nonEmpty >= 0.9) {
          colType = t;
          break;
        }
      }
      for (let r = bodyStart; r < classified.length; r++) {
        const cl = classified[r][c];
        if (cl.cls === "empty") continue;
        out[r][c] =
          cl.cls === colType ? cl.cell : { v: (raw[r][c] ?? "").trim(), t: "s" };
      }
    }
    return out;
  };

  // 헤더 후보: 행 2개 이상 + 첫 행의 비어 있지 않은 셀이 전부 평문 문자열 + 1개 이상 존재
  const first = classified[0];
  const headerCandidate =
    classified.length >= 2 &&
    first.some((c) => c.cls !== "empty") &&
    first.every((c) => c.cls === "s" || c.cls === "empty");

  let headerRow: boolean;
  if (opts.forceHeader !== undefined) {
    headerRow = opts.forceHeader;
  } else if (headerCandidate) {
    // 본문에 문자열 아닌 유형이 하나라도 나오면 헤더로 제안
    const bodyTry = inferColumns(1);
    headerRow = bodyTry
      .slice(1)
      .some((row) => row.some((cell) => cell !== null && cell.t !== "s"));
  } else {
    headerRow = false;
  }

  const cells = inferColumns(headerRow ? 1 : 0);
  if (headerRow) {
    for (let c = 0; c < width; c++) {
      const rawVal = (raw[0][c] ?? "").trim();
      cells[0][c] = rawVal === "" ? null : { v: rawVal, t: "s" };
    }
  }
  return { headerRow, cells };
}
