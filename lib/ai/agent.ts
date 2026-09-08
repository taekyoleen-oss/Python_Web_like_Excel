// 부록 L.1·L.3 — 에이전트 루프: 응답이 tool_use면 도구를 실행하고 tool_result로 이어붙여 재호출.
// 호출 상한 8회(초과하면 중단하고 지금까지의 답변을 돌려준다). 자동 적용·자동 실행은 없다.

import {
  callMessages,
  textOf,
  type ApiContentBlock,
  type ApiMessage,
} from "./anthropic";
import { runTool, TOOL_DEFS, type Proposal } from "./tools";
import type { SheetRange } from "@/lib/grid/formula-engine";

/** 한 요청에서 허용하는 최대 도구 호출 수 (L.3) */
export const MAX_TOOL_CALLS = 8;

export interface ToolLog {
  name: string;
  input: unknown;
  summary: string;
}

export type RefChip = SheetRange & { label: string };

export interface AgentResult {
  text: string;
  tools: ToolLog[];
  proposals: Proposal[];
  refs: RefChip[];
  /** 도구 호출 상한에 걸려 중단됨 */
  limited: boolean;
}

const LIMIT_NOTE = `도구 호출 상한(${MAX_TOOL_CALLS}회)에 도달했습니다 — 지금까지 확인한 내용으로 답하세요.`;

/**
 * messages + tools 로 모델을 호출하고, tool_use가 나오면 실행 → tool_result → 재호출을 반복한다.
 * onToolCall은 UI가 진행 중 도구 로그를 표시할 수 있게 매 호출마다 흘려준다.
 */
export async function runAgent(opts: {
  apiKey: string;
  system: string;
  messages: ApiMessage[];
  onToolCall?: (log: ToolLog) => void;
  maxTokens?: number;
}): Promise<AgentResult> {
  const convo: ApiMessage[] = [...opts.messages];
  const tools: ToolLog[] = [];
  const proposals: Proposal[] = [];
  const refs: RefChip[] = [];
  const parts: string[] = []; // 도구 호출 턴의 설명도 답변의 일부다 — 누적해 함께 보여준다
  let calls = 0;

  for (;;) {
    const body = await callMessages(opts.apiKey, opts.system, convo, {
      maxTokens: opts.maxTokens ?? 2400,
      tools: TOOL_DEFS,
    });
    const text = textOf(body.content);
    if (text) parts.push(text);
    const uses = body.content.filter((b) => b.type === "tool_use");

    if (uses.length === 0) {
      return { text: parts.join("\n\n"), tools, proposals, refs, limited: false };
    }
    if (calls >= MAX_TOOL_CALLS) {
      parts.push(`${LIMIT_NOTE} 요청 범위를 좁혀 다시 물어보시면 이어서 확인하겠습니다.`);
      return { text: parts.join("\n\n"), tools, proposals, refs, limited: true };
    }

    convo.push({ role: "assistant", content: body.content });
    const results: ApiContentBlock[] = [];
    for (const use of uses) {
      if (calls >= MAX_TOOL_CALLS) {
        results.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: JSON.stringify({ ok: false, reason: LIMIT_NOTE }),
          is_error: true,
        });
        continue;
      }
      calls++;
      const outcome = runTool(use.name ?? "", use.input);
      const log: ToolLog = {
        name: use.name ?? "",
        input: use.input,
        summary: outcome.summary,
      };
      tools.push(log);
      opts.onToolCall?.(log);
      if (outcome.proposal) proposals.push(outcome.proposal);
      if (outcome.ref) refs.push(outcome.ref);
      results.push({
        type: "tool_result",
        tool_use_id: use.id,
        content: JSON.stringify(outcome.result),
      });
    }
    convo.push({ role: "user", content: results });
  }
}
