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

/** AI 코드 제안 1회 호출. 실패 시 한국어 메시지로 throw */
export async function assist(apiKey: string, input: AssistInput): Promise<AssistResult> {
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
        max_tokens: 1600,
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: buildUserMessage(input) }],
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
  return parseResponse(text);
}
