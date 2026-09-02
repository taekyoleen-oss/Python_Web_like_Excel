import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseClipboard } from "@/lib/grid/clipboard/parse";
import { inferCells, type DateOrder } from "@/lib/grid/clipboard/infer";
import { serializeRange } from "@/lib/grid/clipboard/serialize";
import { cellKey, type Cell, type Sheet } from "@/types/workbook";

interface Fixture {
  name: string;
  description: string;
  clipboard: { "text/plain"?: string; "text/html"?: string };
  options?: { dateOrder?: DateOrder };
  expected: { headerRow: boolean; cells: (Cell | null)[][] };
}

const DIR = join(process.cwd(), "output", "paste-fixtures");
const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
const fixtures: Fixture[] = files.map((f) =>
  JSON.parse(readFileSync(join(DIR, f), "utf8")),
);

const runFixture = (fx: Fixture) => {
  const raw = parseClipboard({
    html: fx.clipboard["text/html"],
    text: fx.clipboard["text/plain"],
  });
  return inferCells(raw, { dateOrder: fx.options?.dateOrder ?? "ymd" });
};

describe("클립보드 픽스처 (스펙)", () => {
  it("픽스처 30종이 모두 존재한다", () => {
    expect(fixtures.length).toBe(30);
  });

  for (const fx of fixtures) {
    it(`${fx.name} — ${fx.description}`, () => {
      const result = runFixture(fx);
      expect(result.headerRow).toBe(fx.expected.headerRow);
      expect(result.cells).toEqual(fx.expected.cells);
    });
  }
});

describe("왕복 직렬화 (G1 근사)", () => {
  it("excel-full-g1: 붙여넣기 → 직렬화 → 재파싱 시 동일", () => {
    const fx = fixtures.find((f) => f.name === "excel-full-g1")!;
    const first = runFixture(fx);

    // 시트에 반영
    const rows = first.cells.length;
    const cols = first.cells[0].length;
    const sheet: Sheet = { id: "s", name: "S", rowCount: rows, colCount: cols, cells: {} };
    first.cells.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (cell) sheet.cells[cellKey(r, c)] = cell;
      }),
    );

    const { text, html } = serializeRange(sheet, {
      r0: 0,
      c0: 0,
      r1: rows - 1,
      c1: cols - 1,
    });
    const second = inferCells(parseClipboard({ html, text }), { dateOrder: "ymd" });
    expect(second.headerRow).toBe(true);
    expect(second.cells).toEqual(fx.expected.cells);

    // TSV 원값 확인: 숫자 서식 없는 원값·날짜 ISO·빈 셀
    expect(text.split("\r\n")[1]).toBe("20\t1234\t150000.5\t0.125\t2026-09-02\t신규");
  });
});
