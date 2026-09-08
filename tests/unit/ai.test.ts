// R6 → L.5: AI 컨텍스트(값 미전송 시트 스키마·개요) + 키 로컬 저장
import { beforeEach, describe, expect, it } from "vitest";
import { sheetOverview, sheetSchemas } from "@/lib/ai/schema";
import { cap } from "@/lib/ai/prompt";
import { useWorkbookStore } from "@/lib/grid/model";
import { loadSettings, saveSettings } from "@/lib/storage/db";
import { cellKey } from "@/types/workbook";

const st = () => useWorkbookStore.getState();

beforeEach(() => {
  st().newWorkbook();
});

describe("sheetSchemas — 값 미전송", () => {
  it("이름·사용 범위·헤더 행·행 수만 포함, 데이터 값은 미포함", () => {
    const sid = st().workbook.sheets[0].id;
    st().setCells(sid, [
      { r: 0, c: 0, cell: { v: "보험금", t: "s" } },
      { r: 0, c: 1, cell: { v: "연도", t: "s" } },
      { r: 1, c: 0, cell: { v: 987654, t: "n" } },
      { r: 1, c: 1, cell: { v: 2026, t: "n" } },
      { r: 2, c: 0, cell: { v: 123456, t: "n" } },
    ]);
    const schemas = sheetSchemas(st().workbook);
    expect(schemas).toHaveLength(1);
    expect(schemas[0]).toEqual({
      name: "Sheet1",
      range: "A1:B3",
      headers: ["보험금", "연도"],
      rows: 3,
    });
    // 데이터 값(987654 등)은 직렬화 결과 어디에도 없다
    const json = JSON.stringify(schemas);
    expect(json).not.toContain("987654");
    expect(json).not.toContain("123456");
  });
});

describe("sheetOverview — 전송 메시지에 붙는 한 줄", () => {
  it("시트명·범위·블록 수만, 셀 값은 없다", () => {
    const sid = st().workbook.sheets[0].id;
    st().setCells(sid, [
      { r: 0, c: 0, cell: { v: "보험금", t: "s" } },
      { r: 1, c: 0, cell: { v: 987654, t: "n" } },
    ]);
    st().addPyBlock(sid, { r: 5, c: 5 });
    const line = sheetOverview(st().workbook);
    expect(line).toContain("Sheet1!A1:A2");
    expect(line).toContain("블록 1개");
    expect(line).not.toContain("987654");
    expect(line.split("\n")).toHaveLength(1);
  });
});

describe("cap", () => {
  it("undefined 안전", () => {
    expect(cap(undefined, 5)).toBe("");
    expect(cap("abcdefg", 3)).toBe("abc");
  });
});

describe("API 키 저장 — 로컬 전용", () => {
  it("저장/삭제 라운드트립 (메모리 폴백)", async () => {
    await saveSettings({ anthropicApiKey: "sk-ant-test-123" });
    expect((await loadSettings())?.anthropicApiKey).toBe("sk-ant-test-123");
    await saveSettings({ anthropicApiKey: undefined });
    expect((await loadSettings())?.anthropicApiKey).toBeUndefined();
  });

  it("키는 워크북 직렬화(저장 파일)에 포함되지 않는다", async () => {
    await saveSettings({ anthropicApiKey: "sk-ant-secret-xyz" });
    const sid = st().workbook.sheets[0].id;
    st().setCellValue(sid, 0, 0, { v: "데이터", t: "s" });
    const json = JSON.stringify(st().workbook); // 워크북 JSON = 저장·내보내기 원본
    expect(json).not.toContain("sk-ant-secret-xyz");
    expect(json).not.toContain("anthropicApiKey");
    expect(st().workbook.sheets[0].cells[cellKey(0, 0)]?.v).toBe("데이터");
  });
});
