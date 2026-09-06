// 부록 G.2·G.3 — AI 채팅 순수 헬퍼: 시스템 프롬프트 조립(앱 규칙 + 채팅 절 + 사용자 지침),
// N턴 캡, 지침 펜스 파싱, 코드 블록 분리, 이력 캡. 호출·저장은 컴포넌트가 한다.

import { cap, SYSTEM } from "./prompt";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** 한 요청에 보내는 최근 턴 수 (G.2) */
export const CHAT_TURNS = 12;
/** IndexedDB에 남기는 최대 메시지 수 (G.2) */
export const CHAT_HISTORY_CAP = 200;
/** 첨부(선택 코드·traceback) 최대 길이 */
export const ATTACH_CAP = 4000;

/** 기본 지침 시드 (G.3 — 사용자 확정 4개 항목, 전부 수정 가능) */
export const DEFAULT_CHAT_INSTRUCTIONS = [
  "예제는 보험·계리 도메인(보험료·손해액·생명표·손해율 등)을 중심으로 작성한다.",
  "에러 질문에는 원인 → 고치는 법 순서로 초급 눈높이의 쉬운 한국어 설명을 덧붙인다.",
  "답변에서 함수를 사용하면 그 함수의 주요 파라미터를 표(또는 목록)로 표시하고 각각 설명한다.",
  "코드 개선방안(성능·가독성·pandas 관용구)이 있으면 함께 제안한다.",
].join("\n");

/** 채팅 시스템 프롬프트 = 앱 규칙(SYSTEM) + 채팅 절 + 지침 계약 + 사용자 지침 레이어 */
export function buildChatSystem(instructions: string): string {
  return [
    SYSTEM,
    "",
    "[채팅 모드]",
    "여기는 대화형 채팅입니다. 위 '출력 형식' 규칙(설명 후 코드 블록 정확히 하나)은 이 채팅에는 적용하지 않습니다 — 필요한 만큼 설명하고, 코드가 필요할 때만 ```python 블록으로 제시하세요(여러 개 가능, 각 블록은 워크북 블록에 그대로 넣을 수 있게 완결형으로).",
    "사용자가 지침 추가·반영을 요청하면(예: \"지침에 반영해줘\") 응답 끝에 정확히 다음 형식의 펜스 블록을 포함하세요:",
    "```지침",
    "<추가할 지침 한 줄>",
    "```",
    "그 외의 상황에서는 이 펜스를 절대 쓰지 마세요.",
    "",
    "[사용자 지침]",
    instructions.trim() || "(없음)",
    "",
    "사용자 지침이 위 앱 규칙과 충돌하면 앱 규칙이 우선합니다.",
  ].join("\n");
}

/**
 * 전송 메시지 = 최근 CHAT_TURNS개 (마지막이 방금 사용자 메시지).
 * API 계약 보정: 첫 메시지는 user여야 하고 역할은 교대여야 한다 —
 * 캡 절단으로 assistant가 앞에 오면 버리고, (전송 실패 등으로) 연속된
 * 같은 역할 메시지는 하나로 합친다.
 */
export function chatMessages(history: ChatMessage[]): ChatMessage[] {
  const recent = history.slice(-CHAT_TURNS);
  while (recent.length > 0 && recent[0].role === "assistant") recent.shift();
  const out: ChatMessage[] = [];
  for (const m of recent) {
    const prev = out[out.length - 1];
    if (prev && prev.role === m.role) prev.content = `${prev.content}\n\n${m.content}`;
    else out.push({ ...m });
  }
  return out;
}

/** 저장 캡 적용 — 오래된 메시지부터 버린다 */
export function capHistory(history: ChatMessage[]): ChatMessage[] {
  return history.length > CHAT_HISTORY_CAP ? history.slice(-CHAT_HISTORY_CAP) : history;
}

/** 첨부를 사용자 메시지 본문으로 합성 */
export function withAttachment(
  question: string,
  attachment: { label: string; text: string } | null,
): string {
  if (!attachment) return question;
  return [
    `[첨부 — ${attachment.label}]`,
    "```",
    cap(attachment.text, ATTACH_CAP),
    "```",
    "",
    question,
  ].join("\n");
}

const INSTRUCTION_FENCE = /```지침\s*\n([\s\S]*?)```\s*/;

/** 지침 제안 펜스 추출 — body에서는 제거된다(코드 카드로 렌더 금지, G.3) */
export function parseInstructionFence(text: string): {
  body: string;
  instruction?: string;
} {
  const m = INSTRUCTION_FENCE.exec(text);
  if (!m) return { body: text };
  const instruction = m[1].trim();
  const body = text.replace(INSTRUCTION_FENCE, "").trim();
  return instruction ? { body, instruction } : { body };
}

export type ChatSegment = { type: "text" | "code"; content: string };

/** 응답 본문 → 텍스트/```python 코드``` 세그먼트 (코드는 카드로 렌더) */
export function splitCodeBlocks(text: string): ChatSegment[] {
  const out: ChatSegment[] = [];
  const re = /```[A-Za-z]*\s*\n([\s\S]*?)```/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const before = text.slice(last, m.index).trim();
    if (before) out.push({ type: "text", content: before });
    const code = m[1].replace(/\s+$/, "");
    if (code) out.push({ type: "code", content: code });
    last = (m.index ?? 0) + m[0].length;
  }
  const rest = text.slice(last).trim();
  if (rest) out.push({ type: "text", content: rest });
  return out;
}
