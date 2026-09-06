// 미니 수식 파서·평가기 — 부록 I.1 (순수 함수, 스토어 무관)
// 4칙연산·괄호·단항 마이너스·숫자·셀 참조(parseA1 재사용)·SUM/AVERAGE/MIN/MAX/COUNT

import type { Cell, CellRange } from "@/types/workbook";
import { A1Error, parseA1 } from "./a1";

export type FormulaErrorCode = "#NAME?" | "#REF!" | "#VALUE!" | "#DIV/0!" | "#CIRC!";

/** 오류 셀 hover 툴팁용 한국어 설명 (부록 I.3) */
export const FORMULA_ERROR_KO: Record<FormulaErrorCode, string> = {
  "#NAME?": "지원하지 않는 함수 또는 문법입니다 — 4칙연산과 SUM·AVERAGE·MIN·MAX·COUNT만 지원합니다",
  "#REF!": "잘못된 셀 참조이거나 시트를 찾을 수 없습니다",
  "#VALUE!": "숫자가 아닌 셀이 계산에 사용되었습니다",
  "#DIV/0!": "0으로 나눌 수 없습니다",
  "#CIRC!": "순환 참조 — 수식들이 서로를 참조합니다",
};

export const isFormulaError = (v: unknown): v is FormulaErrorCode =>
  typeof v === "string" && v in FORMULA_ERROR_KO;

/** 셀 입력이 수식인지 — `=` 시작(`=` 단독 제외) */
export const isFormula = (input: string): boolean => {
  const t = input.trim();
  return t.startsWith("=") && t.length > 1;
};

export interface FormulaRef {
  /** 시트 접두어 (없으면 수식이 있는 시트) */
  sheetName?: string;
  range: CellRange;
}

/**
 * 평가 시 셀 공급자 — 시트 이름을 해석할 수 없으면 "#REF!"를 반환한다.
 * sheetName === undefined는 수식이 놓인 시트.
 */
export type GetCell = (
  sheetName: string | undefined,
  r: number,
  c: number,
) => Cell | undefined | "#REF!";

export interface ParsedFormula {
  refs: FormulaRef[];
  eval(getCell: GetCell): number | FormulaErrorCode;
}

// ── 토크나이저 ──────────────────────────────────────────

interface Tok {
  t: "num" | "id" | "q" | "p";
  s: string;
}

class ParseErr extends Error {
  constructor(readonly code: FormulaErrorCode) {
    super(code);
  }
}

const TOKEN_RE =
  /(\d+(?:\.\d+)?|\.\d+)|([A-Za-z가-힣_][A-Za-z0-9가-힣_.]*)|('(?:[^']|'')*')|([!:(),+\-*/])|(\S)/g;

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(src))) {
    if (m[1] !== undefined) toks.push({ t: "num", s: m[1] });
    else if (m[2] !== undefined) toks.push({ t: "id", s: m[2] });
    else if (m[3] !== undefined) toks.push({ t: "q", s: m[3] });
    else if (m[4] !== undefined) toks.push({ t: "p", s: m[4] });
    else throw new ParseErr("#NAME?"); // 알 수 없는 문자 (%, &, 문자열 리터럴 등)
  }
  return toks;
}

// ── AST ─────────────────────────────────────────────────

type Node =
  | { k: "num"; n: number }
  | { k: "ref"; ref: FormulaRef; scalar: boolean }
  | { k: "neg"; a: Node }
  | { k: "bin"; op: "+" | "-" | "*" | "/"; a: Node; b: Node }
  | { k: "fn"; name: FnName; args: Node[] };

const FUNCS = ["SUM", "AVERAGE", "MIN", "MAX", "COUNT"] as const;
type FnName = (typeof FUNCS)[number];

// ── 파서 (재귀 하강) ────────────────────────────────────

function parse(toks: Tok[], refs: FormulaRef[]): Node {
  let i = 0;
  const peek = () => toks[i];
  const isP = (s: string) => toks[i]?.t === "p" && toks[i].s === s;
  const expectP = (s: string) => {
    if (!isP(s)) throw new ParseErr("#NAME?");
    i++;
  };

  /** 시트 접두어 뒤 또는 단독의 "A1" / "A1:B2" 참조 텍스트 조립 → parseA1 재사용 */
  const refFrom = (text: string): Node => {
    try {
      const p = parseA1(text);
      const ref: FormulaRef = { sheetName: p.sheetName, range: p.range };
      refs.push(ref);
      return { k: "ref", ref, scalar: p.scalar };
    } catch (e) {
      if (e instanceof A1Error) throw new ParseErr("#REF!");
      throw e;
    }
  };

  const cellText = (): string => {
    const t = peek();
    if (t?.t !== "id") throw new ParseErr("#REF!");
    i++;
    if (isP(":")) {
      i++;
      const b = peek();
      if (b?.t !== "id") throw new ParseErr("#REF!");
      i++;
      return `${t.s}:${b.s}`;
    }
    return t.s;
  };

  const primary = (): Node => {
    const t = peek();
    if (!t) throw new ParseErr("#NAME?");
    if (t.t === "num") {
      i++;
      return { k: "num", n: Number(t.s) };
    }
    if (isP("(")) {
      i++;
      const e = expr();
      expectP(")");
      return e;
    }
    if (isP("-")) {
      i++;
      return { k: "neg", a: primary() };
    }
    if (t.t === "q") {
      // '시트 이름'!A1[:B2]
      i++;
      if (!isP("!")) throw new ParseErr("#REF!");
      i++;
      return refFrom(`${t.s}!${cellText()}`);
    }
    if (t.t === "id") {
      i++;
      if (isP("(")) {
        // 함수 호출
        const name = t.s.toUpperCase() as FnName;
        if (!(FUNCS as readonly string[]).includes(name)) throw new ParseErr("#NAME?");
        i++;
        const args: Node[] = [];
        if (!isP(")")) {
          args.push(expr());
          while (isP(",")) {
            i++;
            args.push(expr());
          }
        }
        expectP(")");
        return { k: "fn", name, args };
      }
      if (isP("!")) {
        // Sheet2!A1[:B2]
        i++;
        return refFrom(`${t.s}!${cellText()}`);
      }
      // 단독 셀 참조 (A1 또는 A1:B2)
      i--; // cellText가 id부터 다시 읽는다
      return refFrom(cellText());
    }
    throw new ParseErr("#NAME?");
  };

  const term = (): Node => {
    let a = primary();
    while (isP("*") || isP("/")) {
      const op = toks[i].s as "*" | "/";
      i++;
      a = { k: "bin", op, a, b: primary() };
    }
    return a;
  };

  const expr = (): Node => {
    let a = term();
    while (isP("+") || isP("-")) {
      const op = toks[i].s as "+" | "-";
      i++;
      a = { k: "bin", op, a, b: term() };
    }
    return a;
  };

  const root = expr();
  if (i !== toks.length) throw new ParseErr("#NAME?");
  return root;
}

// ── 평가 ────────────────────────────────────────────────

// ponytail: 집계 범위를 좌표 순회 O(area) — 초대형 범위는 #VALUE!로 거부, 필요해지면 존재 셀 순회로 교체
const MAX_AGG_CELLS = 1_000_000;

/** 스칼라 문맥의 셀 값: 빈 셀 = 0, 숫자만 허용 (부록 I.1) */
function cellNum(cell: Cell | undefined | "#REF!"): number | FormulaErrorCode {
  if (cell === "#REF!") return "#REF!";
  if (cell === undefined || cell.v === null) return 0;
  if (cell.t === "n" && typeof cell.v === "number") return cell.v;
  return "#VALUE!";
}

function evalNode(node: Node, getCell: GetCell): number | FormulaErrorCode {
  switch (node.k) {
    case "num":
      return node.n;
    case "neg": {
      const a = evalNode(node.a, getCell);
      return typeof a === "number" ? -a : a;
    }
    case "bin": {
      const a = evalNode(node.a, getCell);
      if (typeof a !== "number") return a;
      const b = evalNode(node.b, getCell);
      if (typeof b !== "number") return b;
      if (node.op === "+") return a + b;
      if (node.op === "-") return a - b;
      if (node.op === "*") return a * b;
      return b === 0 ? "#DIV/0!" : a / b;
    }
    case "ref": {
      if (!node.scalar) return "#VALUE!"; // 범위는 집계 인수로만
      const { range, sheetName } = node.ref;
      return cellNum(getCell(sheetName, range.r0, range.c0));
    }
    case "fn": {
      // 인수의 숫자 수집: 셀/범위 참조는 숫자 셀만(빈 셀·문자 제외 — 엑셀 동일), 그 외 식은 값 그대로
      const nums: number[] = [];
      for (const arg of node.args) {
        if (arg.k === "ref") {
          const { range, sheetName } = arg.ref;
          const area = (range.r1 - range.r0 + 1) * (range.c1 - range.c0 + 1);
          if (area > MAX_AGG_CELLS) return "#VALUE!";
          for (let r = range.r0; r <= range.r1; r++)
            for (let c = range.c0; c <= range.c1; c++) {
              const cell = getCell(sheetName, r, c);
              if (cell === "#REF!") return "#REF!";
              if (cell && cell.t === "n" && typeof cell.v === "number") nums.push(cell.v);
            }
        } else {
          const v = evalNode(arg, getCell);
          if (typeof v !== "number") return v;
          nums.push(v);
        }
      }
      switch (node.name) {
        case "SUM":
          return nums.reduce((a, b) => a + b, 0);
        case "COUNT":
          return nums.length;
        case "AVERAGE":
          return nums.length === 0
            ? "#DIV/0!"
            : nums.reduce((a, b) => a + b, 0) / nums.length;
        case "MIN":
          return nums.length === 0 ? 0 : Math.min(...nums);
        case "MAX":
          return nums.length === 0 ? 0 : Math.max(...nums);
      }
    }
  }
}

/**
 * 수식 파싱. 실패해도 throw하지 않는다 — eval이 해당 오류 코드를 돌려주는
 * 상수 수식(refs 없음)이 된다. 함수명은 대소문자 무관.
 */
export function parseFormula(src: string): ParsedFormula {
  const body = src.trim().replace(/^=/, "");
  const refs: FormulaRef[] = [];
  try {
    const ast = parse(tokenize(body), refs);
    return { refs, eval: (getCell) => evalNode(ast, getCell) };
  } catch (e) {
    const code = e instanceof ParseErr ? e.code : "#NAME?";
    return { refs: [], eval: () => code };
  }
}
