// Anthropic API 브라우저 직접 호출 (부록 E R6, E.0 확정: 서버 라우트 없음).
// 키는 호출 시점에만 메모리로 전달된다 — 로그·워크북·전송 외 저장 금지.

import { buildUserMessage, SYSTEM, type AssistInput } from "./prompt";

const MODEL = "claude-sonnet-4-6"; // 소스(pyAssist.ts) 유지

export interface AssistResult {
  code: string;
  explanation: string;
}

/** 응답 텍스트 → 설명 + 파이썬 코드 블록 1개 (소스 parseResponse 이식) */
export function parseResponse(text: string): AssistResult {
  const m = text.match(/```(?:python|py)?\s*\n?([\s\S]*?)```/);
  if (m) {
    return { code: m[1].trim(), explanation: text.slice(0, m.index).trim() };
  }
  // 코드 블록이 없으면 전체를 설명으로(코드 없음)
  return { code: "", explanation: text.trim() };
}

/** 공용 호출 — 시스템+메시지로 1회 요청, 응답 텍스트 반환. 실패 시 한국어 throw */
async function callText(
  apiKey: string,
  system: string,
  messages: { role: "user" | "assistant"; content: string }[],
  maxTokens: number,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages,
      }),
    });
  } catch {
    throw new Error("네트워크 오류 — 인터넷 연결을 확인하세요");
  }

  if (res.status === 401) throw new Error("API 키가 유효하지 않습니다");
  if (res.status === 429) throw new Error("요청 한도 초과 — 잠시 후 다시 시도하세요");
  if (!res.ok) {
    let detail = "";
    try {
      detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? "";
    } catch {
      // 본문 없음 — 상태 코드만 표시
    }
    throw new Error(`API 오류 (${res.status})${detail ? `: ${detail}` : ""}`);
  }

  const body = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (body.content ?? [])
    .map((b) => (b.type === "text" ? (b.text ?? "") : ""))
    .join("\n")
    .trim();
  if (!text) throw new Error("빈 응답을 받았습니다 — 다시 시도하세요");
  return text;
}

/** AI 코드 제안 1회 호출 (4모드 — 부록 E R6, 동작 불변) */
export async function assist(apiKey: string, input: AssistInput): Promise<AssistResult> {
  const text = await callText(
    apiKey,
    SYSTEM,
    [{ role: "user", content: buildUserMessage(input) }],
    1600,
  );
  return parseResponse(text);
}

/** AI 채팅 멀티턴 1회 호출 (부록 G.2) — 시스템은 lib/ai/chat.ts buildChatSystem */
export async function chat(
  apiKey: string,
  system: string,
  messages: { role: "user" | "assistant"; content: string }[],
): Promise<string> {
  return callText(apiKey, system, messages, 2400);
}
