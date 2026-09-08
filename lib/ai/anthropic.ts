// Anthropic Messages API 브라우저 직접 호출 (부록 E R6, E.0 확정: 서버 라우트 없음).
// 키는 호출 시점에만 메모리로 전달된다 — 로그·워크북·전송 외 저장 금지.
// 부록 L: 도구(tool use)를 포함한 단일 요청. 루프는 lib/ai/agent.ts가 돈다.

const MODEL = "claude-sonnet-4-6"; // 소스(pyAssist.ts) 유지

export interface ApiContentBlock {
  type: string;
  text?: string;
  /** tool_use */
  id?: string;
  name?: string;
  input?: unknown;
  /** tool_result */
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
}

export interface ApiMessage {
  role: "user" | "assistant";
  content: string | ApiContentBlock[];
}

export interface ApiResponse {
  content: ApiContentBlock[];
  stop_reason?: string;
}

export interface CallOptions {
  maxTokens?: number;
  /** 도구 스키마 (있으면 tool use 활성) */
  tools?: readonly unknown[];
}

/** Messages API 1회 호출 — 실패 시 한국어 throw */
export async function callMessages(
  apiKey: string,
  system: string,
  messages: ApiMessage[],
  opts: CallOptions = {},
): Promise<ApiResponse> {
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
        max_tokens: opts.maxTokens ?? 2400,
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages,
        ...(opts.tools && opts.tools.length > 0 ? { tools: opts.tools } : {}),
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

  const body = (await res.json()) as Partial<ApiResponse>;
  return { content: body.content ?? [], stop_reason: body.stop_reason };
}

/** 응답 content 블록 → 텍스트 */
export function textOf(content: ApiContentBlock[]): string {
  return content
    .map((b) => (b.type === "text" ? (b.text ?? "") : ""))
    .join("\n")
    .trim();
}
