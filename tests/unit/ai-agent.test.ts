// 부록 L.1·L.3 — 에이전트 루프: tool_use → tool_result → 최종 텍스트, 호출 상한 8회에서 중단.
// fetch를 모킹한다 (실 API 호출 없음).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_TOOL_CALLS, runAgent } from "@/lib/ai/agent";
import { useWorkbookStore } from "@/lib/grid/model";

const st = () => useWorkbookStore.getState();

interface Body {
  content: { type: string; text?: string; id?: string; name?: string; input?: unknown }[];
  stop_reason?: string;
}

/** 응답 큐를 순서대로 돌려주는 fetch 모킹 (마지막 응답은 반복된다) */
function mockFetch(bodies: Body[]) {
  const sent: unknown[] = [];
  const fn = vi.fn(async (_url: string, init: { body: string }) => {
    sent.push(JSON.parse(init.body));
    const body = bodies[Math.min(sent.length - 1, bodies.length - 1)];
    return {
      ok: true,
      status: 200,
      json: async () => body,
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", fn);
  return { fn, sent };
}

const toolUse = (name: string, input: unknown): Body => ({
  content: [
    { type: "text", text: "확인해 볼게요." },
    { type: "tool_use", id: `tu-${name}`, name, input },
  ],
  stop_reason: "tool_use",
});

const finalText = (text: string): Body => ({
  content: [{ type: "text", text }],
  stop_reason: "end_turn",
});

beforeEach(() => {
  st().newWorkbook();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runAgent", () => {
  it("tool_use → 도구 실행 → tool_result 이어붙여 재호출 → 최종 텍스트", async () => {
    const sid = st().workbook.sheets[0].id;
    st().setCells(sid, [
      { r: 0, c: 0, cell: { v: "손해액", t: "s" } },
      { r: 1, c: 0, cell: { v: 100, t: "n" } },
    ]);
    const { fn, sent } = mockFetch([
      toolUse("read_range", { ref: "A1:A2" }),
      finalText("A1:A2 합계는 100입니다."),
    ]);

    const logs: string[] = [];
    const res = await runAgent({
      apiKey: "sk-test",
      system: "시스템",
      messages: [{ role: "user", content: "A1:A2 요약해줘" }],
      onToolCall: (l) => logs.push(l.summary),
    });

    expect(fn).toHaveBeenCalledTimes(2);
    // 도구 호출 턴의 설명도 답변에 함께 남는다
    expect(res.text).toContain("확인해 볼게요.");
    expect(res.text).toContain("A1:A2 합계는 100입니다.");
    expect(res.tools).toHaveLength(1);
    expect(res.limited).toBe(false);
    expect(logs).toEqual(["Sheet1!A1:A2 읽음 · 2행×1열"]);
    // 근거 하이라이트 범위가 함께 나온다
    expect(res.refs[0]).toMatchObject({ sheetId: sid, label: "Sheet1!A1:A2" });

    // 2번째 요청 메시지 = [user, assistant(tool_use), user(tool_result)]
    const second = sent[1] as { messages: { role: string; content: unknown }[]; tools: unknown[] };
    expect(second.messages).toHaveLength(3);
    const results = second.messages[2].content as { type: string; content: string }[];
    expect(results[0].type).toBe("tool_result");
    expect(results[0].content).toContain("손해액");
    expect(second.tools).toHaveLength(5); // 도구 스키마가 매 요청에 실린다
  });

  it("propose_cells는 제안으로 모이고 셀은 바뀌지 않는다", async () => {
    mockFetch([
      toolUse("propose_cells", { ref: "C1", values: [[1]], reason: "합계" }),
      finalText("제안했습니다."),
    ]);
    const res = await runAgent({
      apiKey: "sk-test",
      system: "시스템",
      messages: [{ role: "user", content: "C1에 1 써줘" }],
    });
    expect(res.proposals).toHaveLength(1);
    expect(res.proposals[0].kind).toBe("cells");
    expect(st().workbook.sheets[0].cells["0:2"]).toBeUndefined();
  });

  it(`도구 호출 상한 ${MAX_TOOL_CALLS}회를 넘기면 중단한다`, async () => {
    const { fn } = mockFetch([toolUse("list_sheets", {})]); // 계속 도구만 요청
    const res = await runAgent({
      apiKey: "sk-test",
      system: "시스템",
      messages: [{ role: "user", content: "계속 읽어줘" }],
    });
    expect(res.tools).toHaveLength(MAX_TOOL_CALLS);
    expect(fn).toHaveBeenCalledTimes(MAX_TOOL_CALLS + 1); // 마지막 호출에서 중단 판단
    expect(res.limited).toBe(true);
    expect(res.text).toBeTruthy();
  });

  it("도구 실행 실패도 tool_result로 전달해 모델이 다시 판단하게 한다", async () => {
    const { sent } = mockFetch([
      toolUse("read_range", { ref: "없는시트!A1" }),
      finalText("범위를 찾지 못했습니다."),
    ]);
    const res = await runAgent({
      apiKey: "sk-test",
      system: "시스템",
      messages: [{ role: "user", content: "읽어줘" }],
    });
    const second = sent[1] as { messages: { content: unknown }[] };
    const results = (second.messages[2].content as { content: string }[])[0];
    expect(results.content).toContain("시트를 찾을 수 없습니다");
    expect(res.text).toContain("범위를 찾지 못했습니다.");
  });

  it("API 오류는 한국어 메시지로 throw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }) as unknown as Response),
    );
    await expect(
      runAgent({ apiKey: "bad", system: "s", messages: [{ role: "user", content: "x" }] }),
    ).rejects.toThrow("API 키가 유효하지 않습니다");
  });
});
