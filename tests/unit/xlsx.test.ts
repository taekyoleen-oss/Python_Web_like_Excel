import { describe, expect, it } from "vitest";
import { sheetsFromFileData, sheetsToXlsxBlob } from "@/lib/io/xlsx";
import { csvToSheet, sheetToCsv } from "@/lib/io/csv";
import { createSheet } from "@/lib/grid/model";
import { cellKey, type Sheet } from "@/types/workbook";

function dataSheet(): Sheet {
  const sheet = createSheet("데이터");
  sheet.cells = {
    "0:0": { v: "이름", t: "s" },
    "0:1": { v: "값", t: "s" },
    "1:0": { v: "철수", t: "s" },
    "1:1": { v: 12.5, t: "n" },
    "2:0": { v: "영희", t: "s" },
    "2:1": { v: -3, t: "n" },
    "3:0": { v: true, t: "b" },
    "3:1": { v: "2026-09-03", t: "d", f: "yyyy-mm-dd" },
  };
  return sheet;
}

describe("xlsx 왕복", () => {
  it("숫자/문자/불리언/날짜 값 왕복", async () => {
    const blob = sheetsToXlsxBlob([dataSheet()]);
    const sheets = sheetsFromFileData(await blob.arrayBuffer());
    expect(sheets).toHaveLength(1);
    expect(sheets[0].name).toBe("데이터");
    const cells = sheets[0].cells;
    expect(cells["0:0"]).toEqual({ v: "이름", t: "s" });
    expect(cells["1:1"]).toEqual({ v: 12.5, t: "n" });
    expect(cells["2:1"]).toEqual({ v: -3, t: "n" });
    expect(cells["3:0"]).toEqual({ v: true, t: "b" });
    // 날짜: ISO 문자열은 값만 내보내기에서 문자열로 왕복 (셀 서식 미기록 — §1.5 값만)
    expect(cells["3:1"]?.v).toBe("2026-09-03");
  });

  it("1만 행 XLSX 왕복 성능 (§5.7 3초 목표)", async () => {
    const sheet = createSheet("big");
    for (let r = 0; r < 10_000; r++) {
      sheet.cells[cellKey(r, 0)] = { v: r, t: "n" };
      sheet.cells[cellKey(r, 1)] = { v: `행${r}`, t: "s" };
      sheet.cells[cellKey(r, 2)] = { v: r * 1.5, t: "n" };
    }
    const blob = sheetsToXlsxBlob([sheet]);
    const data = await blob.arrayBuffer();
    const t0 = performance.now();
    const sheets = sheetsFromFileData(data);
    const openMs = performance.now() - t0;
    expect(sheets[0].cells["9999:0"]).toEqual({ v: 9999, t: "n" });
    console.log(`10,000행 XLSX 열기: ${Math.round(openMs)}ms`);
    expect(openMs).toBeLessThan(3_000);
  });
});

describe("csv 왕복", () => {
  it("활성 시트 값 왕복 (불리언 TRUE/FALSE·날짜 ISO)", () => {
    const csv = sheetToCsv(dataSheet());
    expect(csv).toContain("TRUE");
    expect(csv).toContain("2026-09-03");
    const sheet = csvToSheet(csv, "가져옴");
    expect(sheet.cells["1:1"]).toEqual({ v: 12.5, t: "n" });
    expect(sheet.cells["3:0"]).toEqual({ v: true, t: "b" });
    expect(sheet.cells["0:0"]).toEqual({ v: "이름", t: "s" });
  });
});
