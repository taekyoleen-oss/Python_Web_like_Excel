// R6: AI 코드 지원 — parseResponse, 모드별 프롬프트 구성·캡, 시트 스키마(값 미전송), 키 저장/삭제
import { beforeEach, describe, expect, it } from "vitest";
import { parseResponse } from "@/lib/ai/anthropic";
import { buildUserMessage, cap } from "@/lib/ai/prompt";
import { priorCode, sheetSchemas } from "@/lib/ai/schema";
import { useWorkbookStore } from "@/lib/grid/model";
import { loadSettings, saveSettings } from "@/lib/storage/db";
import { cellKey } from "@/types/workbook";

const st = () => useWorkbookStore.getState();

beforeEach(() => {
  st().newWorkbook();
});

describe("parseResponse", () => {
  it("설명 + python 블록 1개", () => {
    const r = parseResponse('월별 합계입니다.\n```python\ndf.groupby("m").sum()\n```');
    expect(r.explanation).toBe("월별 합계입니다.");
    expect(r.code).toBe('df.groupby("m").sum()');
  });

  it("언어 태그 없는 블록·py 태그도 인식", () => {
    expect(parseResponse("```\nx=1\n```").code).toBe("x=1");
    expect(parseResponse("```py\nx=2\n```").code).toBe("x=2");
  });

  it("코드 블록 없으면 전체가 설명, code는 빈 문자열", () => {
    const r = parseResponse("코드가 필요 없는 질문입니다.");
    expect(r.code).toBe("");
    expect(r.explanation).toBe("코드가 필요 없는 질문입니다.");
  });
});

describe("buildUserMessage", () => {
  it("generate — 요청·스키마·이전 코드 포함, 요청 1500자 캡", () => {
    const msg = buildUserMessage({
      mode: "generate",
      request: "월별 합계".padEnd(2000, "x"),
      schema: '{"sheets":[]}',
      priorCode: "a=1",
    });
    expect(msg).toContain("[컨텍스트(JSON)]");
    expect(msg).toContain('{"sheets":[]}');
    expect(msg).toContain("a=1");
    expect(msg.length).toBeLessThan(2200); // 요청이 1500자로 잘림
  });

  it("edit — 현재 코드·요청 포함", () => {
    const msg = buildUserMessage({ mode: "edit", code: "df.head()", request: "결측 제거" });
    expect(msg).toContain("[현재 블록 코드]");
    expect(msg).toContain("df.head()");
    expect(msg).toContain("결측 제거");
  });

  it("vars — 대상 변수 지정 문구", () => {
    const msg = buildUserMessage({ mode: "vars", code: "df.head()", request: "claims" });
    expect(msg).toContain("'claims'");
    expect(msg).toContain("변수 이름");
  });

  it("fix — 트레이스백 4000자 캡, 오류 없으면 검토 문구", () => {
    const long = "T".repeat(9000);
    const withErr = buildUserMessage({ mode: "fix", code: "x", error: long });
    expect(withErr).toContain("[오류 트레이스백]");
    expect(withErr.length).toBeLessThan(5000);
    expect(buildUserMessage({ mode: "fix", code: "x" })).toContain("[오류 없음]");
  });

  it("cap — undefined 안전", () => {
    expect(cap(undefined, 5)).toBe("");
    expect(cap("abcdefg", 3)).toBe("abc");
  });
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

describe("priorCode", () => {
  it("대상 블록 이전(계산 순서) 코드만, 마크다운 제외", () => {
    const sid = st().workbook.sheets[0].id;
    const a = st().addPyBlock(sid, { r: 0, c: 0 })!;
    st().setBlockCode(a, "a=1");
    const b = st().addPyBlock(sid, { r: 2, c: 0 })!;
    st().setBlockCode(b, "b=a+1");
    expect(priorCode(st().workbook, b)).toBe("a=1");
    expect(priorCode(st().workbook)).toContain("b=a+1"); // 전체
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
