// 부록 G.2·G.3 — 채팅 프롬프트 조립·N턴 캡·지침 펜스·코드 분리·이력 캡
import { describe, expect, it } from "vitest";
import {
  buildChatSystem,
  capHistory,
  CHAT_HISTORY_CAP,
  CHAT_TURNS,
  chatMessages,
  DEFAULT_CHAT_INSTRUCTIONS,
  parseInstructionFence,
  splitCodeBlocks,
  withAttachment,
  type ChatMessage,
} from "@/lib/ai/chat";
import { SYSTEM } from "@/lib/ai/prompt";

describe("buildChatSystem", () => {
  it("앱 규칙(SYSTEM) + 사용자 지침 + 앱 규칙 우선 문구 + 지침 펜스 계약 포함", () => {
    const sys = buildChatSystem("내 지침 한 줄");
    expect(sys).toContain(SYSTEM);
    expect(sys).toContain("내 지침 한 줄");
    expect(sys).toContain("앱 규칙이 우선");
    expect(sys).toContain("```지침");
    // 채팅에서는 단일 코드 블록 규칙을 해제한다
    expect(sys).toContain("적용하지 않습니다");
  });

  it("빈 지침은 (없음) 표기, 기본 시드는 4개 항목", () => {
    expect(buildChatSystem("  ")).toContain("(없음)");
    expect(DEFAULT_CHAT_INSTRUCTIONS.split("\n")).toHaveLength(4);
    expect(DEFAULT_CHAT_INSTRUCTIONS).toContain("보험·계리");
  });
});

describe("chatMessages / capHistory", () => {
  const many = (n: number): ChatMessage[] =>
    Array.from({ length: n }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as ChatMessage["role"],
      content: `m${i}`,
    }));

  it(`전송은 최근 ${CHAT_TURNS}개만`, () => {
    const sent = chatMessages(many(30));
    expect(sent).toHaveLength(CHAT_TURNS);
    expect(sent[sent.length - 1].content).toBe("m29");
    expect(chatMessages(many(3))).toHaveLength(3);
  });

  it("API 계약 보정: 앞의 assistant 제거 + 연속 같은 역할 병합", () => {
    // 절단 후 assistant가 앞에 오는 경우
    const cut: ChatMessage[] = [{ role: "assistant", content: "a" }, { role: "user", content: "u" }];
    expect(chatMessages(cut)).toEqual([{ role: "user", content: "u" }]);
    // 전송 실패로 user가 연속된 경우 → 병합
    const dup: ChatMessage[] = [
      { role: "user", content: "u1" },
      { role: "user", content: "u2" },
    ];
    expect(chatMessages(dup)).toEqual([{ role: "user", content: "u1\n\nu2" }]);
  });

  it(`저장은 최대 ${CHAT_HISTORY_CAP}개 (오래된 것부터 버림)`, () => {
    const capped = capHistory(many(250));
    expect(capped).toHaveLength(CHAT_HISTORY_CAP);
    expect(capped[capped.length - 1].content).toBe("m249");
    expect(capHistory(many(10))).toHaveLength(10);
  });
});

describe("withAttachment", () => {
  it("첨부를 펜스로 감싸 질문 앞에 붙인다 (없으면 질문 그대로)", () => {
    expect(withAttachment("왜 오류?", null)).toBe("왜 오류?");
    const s = withAttachment("왜 오류?", { label: "선택 코드", text: "x = 1" });
    expect(s).toContain("[첨부 — 선택 코드]");
    expect(s).toContain("x = 1");
    expect(s.endsWith("왜 오류?")).toBe(true);
  });
});

describe("parseInstructionFence (G.3)", () => {
  it("지침 펜스를 추출하고 본문에서 제거한다", () => {
    const text = "반영하겠습니다.\n```지침\n예제는 짧게 작성한다.\n```\n끝.";
    const { body, instruction } = parseInstructionFence(text);
    expect(instruction).toBe("예제는 짧게 작성한다.");
    expect(body).not.toContain("```지침");
    expect(body).toContain("반영하겠습니다.");
    expect(body).toContain("끝.");
  });

  it("펜스가 없거나 내용이 비면 instruction 없음", () => {
    expect(parseInstructionFence("일반 답변").instruction).toBeUndefined();
    expect(parseInstructionFence("```지침\n\n```").instruction).toBeUndefined();
  });

  it("python 코드 펜스는 지침으로 오인하지 않는다", () => {
    const { body, instruction } = parseInstructionFence("```python\nx=1\n```");
    expect(instruction).toBeUndefined();
    expect(body).toContain("x=1");
  });
});

describe("splitCodeBlocks", () => {
  it("텍스트/코드 세그먼트로 나눈다 (코드 카드 렌더용)", () => {
    const segs = splitCodeBlocks(
      "설명입니다.\n```python\ndf.sum()\n```\n추가 설명\n```python\ndf.mean()\n```",
    );
    expect(segs.map((s) => s.type)).toEqual(["text", "code", "text", "code"]);
    expect(segs[1].content).toBe("df.sum()");
    expect(segs[3].content).toBe("df.mean()");
  });

  it("코드 없는 답변은 텍스트 하나", () => {
    expect(splitCodeBlocks("그냥 설명")).toEqual([{ type: "text", content: "그냥 설명" }]);
  });
});
