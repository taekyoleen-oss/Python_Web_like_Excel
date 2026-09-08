// 부록 G.2·G.3 + L — 채팅 순수 헬퍼: 시스템 프롬프트 조립(앱 규칙 + 도구 지침 + 사용자 지침),
// N턴 캡, 지침 펜스 파싱, 코드 블록 분리, 이력 캡, 블록 ✦ 4프리셋(L.5).
// 호출(에이전트 루프)·저장은 컴포넌트가 한다.

import type { ApiMessage } from "./anthropic";
import type { ToolLog, RefChip } from "./agent";
import type { Proposal } from "./tools";
import { cap, SYSTEM } from "./prompt";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** 이 응답이 부른 도구 로그 (L.2 접이식 한 줄) */
  tools?: ToolLog[];
  /** 이 응답이 만든 제안 카드 */
  proposals?: Proposal[];
  /** read_range로 읽은 근거 범위 칩 */
  refs?: RefChip[];
  /** 사용자가 처리한 제안 id → 결과 (카드 재표시 방지) */
  resolved?: Record<string, "applied" | "ignored">;
}

/** 한 요청에 보내는 최근 턴 수 (G.2·L.3) */
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

/** 채팅 시스템 프롬프트 = 앱 규칙(SYSTEM) + 도구 지침(L.1) + 지침 계약 + 사용자 지침 레이어 */
export function buildChatSystem(instructions: string): string {
  return [
    SYSTEM,
    "",
    "[도구]",
    "이 대화에서는 워크북을 직접 볼 수 있는 도구를 쓸 수 있습니다.",
    "- 값이 필요하면 추측하지 말고 read_range를 호출해 실제 값을 확인하세요(범위 상한 안에서 필요한 만큼만).",
    "- 시트 구조는 list_sheets, 블록 코드·오류는 list_blocks로 확인하세요.",
    "- 셀 변경은 propose_cells, 블록 코드는 propose_block으로 **제안만** 합니다. 직접 쓰거나 실행할 수 없습니다.",
    "- 제안은 사용자가 [적용]을 눌러야 반영됩니다. 적용 여부는 알 수 없으니 적용됐다고 단정하지 말고, 필요하면 다음 턴에 read_range로 확인하세요.",
    "- 자동 실행은 없습니다. 코드를 제안한 뒤에는 사용자가 직접 실행해야 함을 알려주세요.",
    "",
    "[답변 형식]",
    "필요한 만큼 한국어로 설명하고, 코드가 필요하면 propose_block으로 제안하세요. 대화 중 참고용 코드는 ```python 블록으로 써도 됩니다(여러 개 가능, 각 블록은 워크북 블록에 그대로 넣을 수 있게 완결형으로).",
    '사용자가 지침 추가·반영을 요청하면(예: "지침에 반영해줘") 응답 끝에 정확히 다음 형식의 펜스 블록을 포함하세요:',
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
 * 도구 로그·제안 등 UI 전용 필드는 떼고 role/content만 보낸다.
 * API 계약 보정: 첫 메시지는 user여야 하고 역할은 교대여야 한다 —
 * 캡 절단으로 assistant가 앞에 오면 버리고, (전송 실패 등으로) 연속된
 * 같은 역할 메시지는 하나로 합친다.
 */
export function chatMessages(history: ChatMessage[]): ApiMessage[] {
  const recent = history.slice(-CHAT_TURNS);
  while (recent.length > 0 && recent[0].role === "assistant") recent.shift();
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of recent) {
    const prev = out[out.length - 1];
    if (prev && prev.role === m.role) prev.content = `${prev.content}\n\n${m.content}`;
    else out.push({ role: m.role, content: m.content });
  }
  return out;
}

/** 저장 캡 적용 — 오래된 메시지부터 버린다 */
export function capHistory(history: ChatMessage[]): ChatMessage[] {
  return history.length > CHAT_HISTORY_CAP ? history.slice(-CHAT_HISTORY_CAP) : history;
}

export interface ChatAttachment {
  label: string;
  text: string;
}

/** 채팅으로 보내는 요청 — 첨부(선택)와 질문(있으면 자동 전송) */
export interface ChatAsk {
  attachment?: ChatAttachment;
  question?: string;
}

/** 첨부를 사용자 메시지 본문으로 합성 */
export function withAttachment(
  question: string,
  attachment: ChatAttachment | null,
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

// ── 블록 ✦ 4프리셋 (L.5) — 단발 모드를 채팅 요청으로 흡수 ─────────────

export type BlockPreset = "edit" | "vars" | "fix" | "free";

export interface BlockContext {
  id: string;
  title?: string;
  /** 앵커 A1 ("데이터!B3") */
  anchor: string;
  code: string;
  note?: string;
  traceback?: string;
  errorSummary?: string;
}

const PRESET_QUESTION: Record<BlockPreset, string> = {
  edit: "이 블록을 고쳐줘. 무엇을 왜 바꾸는지 먼저 설명하고, 수정한 블록 전체 코드를 propose_block(targetBlockId=위 블록 id)으로 제안해줘.",
  vars: "이 블록의 변수명을 실제로 존재하는 변수에 맞춰줘. list_blocks로 앞 블록들이 만든 변수를 확인하고, 로직·열 이름·문자열은 그대로 둔 채 변수 이름만 바꾼 코드를 propose_block(targetBlockId=위 블록 id)으로 제안해줘.",
  fix: "이 블록이 낸 오류의 원인을 초급 눈높이로 설명하고(원인 → 고치는 법 순서), 고친 블록 전체 코드를 propose_block(targetBlockId=위 블록 id)으로 제안해줘.",
  free: "",
};

/** 블록 컨텍스트(제목·앵커·코드·note·traceback) 첨부 + 프리셋 질문 */
export function buildBlockAsk(preset: BlockPreset, ctx: BlockContext): ChatAsk {
  const lines = [
    `블록: ${ctx.title || "(제목 없음)"} · 앵커 ${ctx.anchor} · id: ${ctx.id}`,
    "[코드]",
    ctx.code.trim() || "(비어 있음)",
  ];
  if (ctx.note?.trim()) lines.push("[설명(note)]", ctx.note.trim());
  if (ctx.traceback?.trim() || ctx.errorSummary?.trim()) {
    lines.push(
      `[오류] ${ctx.errorSummary ?? ""}`.trim(),
      cap(ctx.traceback ?? "", 2000),
    );
  }
  const hasError = Boolean(ctx.traceback?.trim() || ctx.errorSummary?.trim());
  return {
    attachment: {
      label: hasError ? "블록 + 오류" : "블록",
      text: lines.join("\n"),
    },
    question: PRESET_QUESTION[preset],
  };
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
