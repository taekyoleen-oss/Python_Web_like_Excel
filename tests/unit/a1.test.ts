import { describe, expect, it } from "vitest";
import { A1Error, colToLetter, formatA1, letterToCol, parseA1 } from "@/lib/grid/a1";

describe("colToLetter / letterToCol", () => {
  it("왕복 변환", () => {
    expect(colToLetter(0)).toBe("A");
    expect(colToLetter(25)).toBe("Z");
    expect(colToLetter(26)).toBe("AA");
    expect(colToLetter(51)).toBe("AZ");
    expect(colToLetter(52)).toBe("BA");
    expect(colToLetter(701)).toBe("ZZ");
    expect(colToLetter(702)).toBe("AAA");
    expect(letterToCol("A")).toBe(0);
    expect(letterToCol("z")).toBe(25);
    expect(letterToCol("AA")).toBe(26);
    for (const c of [0, 1, 25, 26, 27, 700, 701, 702, 16383]) {
      expect(letterToCol(colToLetter(c))).toBe(c);
    }
  });

  it("잘못된 입력은 A1Error", () => {
    expect(() => colToLetter(-1)).toThrow(A1Error);
    expect(() => letterToCol("A1")).toThrow(A1Error);
    expect(() => letterToCol("")).toThrow(A1Error);
  });
});

describe("parseA1", () => {
  it("단일 셀", () => {
    expect(parseA1("A1")).toEqual({
      sheetName: undefined,
      range: { r0: 0, c0: 0, r1: 0, c1: 0 },
      scalar: true,
    });
    expect(parseA1("b10").range).toEqual({ r0: 9, c0: 1, r1: 9, c1: 1 });
  });

  it("범위 + 역순 정규화", () => {
    expect(parseA1("A1:C10")).toEqual({
      sheetName: undefined,
      range: { r0: 0, c0: 0, r1: 9, c1: 2 },
      scalar: false,
    });
    expect(parseA1("C10:A1").range).toEqual({ r0: 0, c0: 0, r1: 9, c1: 2 });
  });

  it("시트 이름", () => {
    expect(parseA1("Sheet2!A1")).toEqual({
      sheetName: "Sheet2",
      range: { r0: 0, c0: 0, r1: 0, c1: 0 },
      scalar: true,
    });
    expect(parseA1("데이터!B2:C3").sheetName).toBe("데이터");
  });

  it("따옴표 시트 이름 (공백·한글·따옴표 이스케이프)", () => {
    expect(parseA1("'시트 이름'!A1:B2")).toEqual({
      sheetName: "시트 이름",
      range: { r0: 0, c0: 0, r1: 1, c1: 1 },
      scalar: false,
    });
    expect(parseA1("'It''s'!A1").sheetName).toBe("It's");
  });

  it("잘못된 참조는 한국어 메시지의 A1Error", () => {
    for (const bad of ["", "1A", "A0", "A1:B", "A1:B2:C3", "!A1", "'시트!A1", "AB", "A1B"]) {
      expect(() => parseA1(bad), bad).toThrow(A1Error);
    }
    expect(() => parseA1("1A")).toThrow(/잘못된 셀 참조입니다/);
  });
});

describe("formatA1", () => {
  it("단일 셀 / 범위", () => {
    expect(formatA1({ r0: 0, c0: 0, r1: 0, c1: 0 })).toBe("A1");
    expect(formatA1({ r0: 0, c0: 0, r1: 9, c1: 2 })).toBe("A1:C10");
    // 역순도 정규화
    expect(formatA1({ r0: 9, c0: 2, r1: 0, c1: 0 })).toBe("A1:C10");
  });

  it("시트 이름 접두어 — 공백 있으면 따옴표", () => {
    expect(formatA1({ r0: 0, c0: 0, r1: 0, c1: 0 }, "Sheet2")).toBe("Sheet2!A1");
    expect(formatA1({ r0: 0, c0: 0, r1: 1, c1: 1 }, "시트 이름")).toBe("'시트 이름'!A1:B2");
    expect(formatA1({ r0: 0, c0: 0, r1: 0, c1: 0 }, "데이터")).toBe("데이터!A1");
  });

  it("파싱 왕복", () => {
    for (const ref of ["A1", "A1:C10", "Sheet2!B2", "'시트 이름'!A1:B2"]) {
      const parsed = parseA1(ref);
      expect(formatA1(parsed.range, parsed.sheetName)).toBe(ref);
    }
  });

  it("음수 범위는 A1Error", () => {
    expect(() => formatA1({ r0: -1, c0: 0, r1: 0, c1: 0 })).toThrow(A1Error);
  });
});
