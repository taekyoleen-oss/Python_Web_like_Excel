"use client";

// 부록 G.2·G.3 — AI 채팅 패널 (최우측, TocPanel 패턴: 툴바 토글 + 자체 ✕, 상태는 설정 저장).
// 이력·지침은 IndexedDB 앱 설정 로컬 전용(워크북 파일 미포함). 코드는 절대 자동 실행하지 않는다.

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Broom, Gear, PaperclipHorizontal, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { CopyButton } from "@/components/reference/code-popup";
import { getApiKey, openApiKeyDialog } from "@/components/shell/ApiKeyDialog";
import { editorRegistry } from "@/components/python/CodeEditor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { chat } from "@/lib/ai/anthropic";
import {
  buildChatSystem,
  capHistory,
  chatMessages,
  DEFAULT_CHAT_INSTRUCTIONS,
  parseInstructionFence,
  splitCodeBlocks,
  withAttachment,
  type ChatMessage,
} from "@/lib/ai/chat";
import { cap } from "@/lib/ai/prompt";
import { collectContext } from "@/lib/ai/schema";
import { notifyWorkbookEdit } from "@/lib/grid/calc-host";
import { codeTitle } from "@/lib/grid/code-sections";
import { appendSnippetToBlock, insertSnippetAsBlock } from "@/lib/grid/insert-snippet";
import { renderMarkdown } from "@/lib/grid/markdown";
import { useWorkbookStore } from "@/lib/grid/model";
import { loadSettings, saveSettings } from "@/lib/storage/db";
import { cn } from "@/lib/utils";

interface Attachment {
  label: string;
  text: string;
}

// 패널이 아직 마운트되기 전에 온 요청을 들고 있다가 마운트 시 소비한다
const ASK_EVENT = "pygrid:ai-chat-ask";
let pendingAsk: Attachment | null = null;

/** 어디서든 첨부와 함께 채팅 패널 열기 (✦ 메뉴 "채팅으로 질문" 등) */
export function askAiChat(attachment: Attachment): void {
  pendingAsk = attachment;
  useWorkbookStore.getState().setAiChatOpen(true);
  void saveSettings({ aiChatOpen: true });
  window.dispatchEvent(new Event(ASK_EVENT));
}

/** 코드 카드 → 블록 반영 (부록 F.1 삽입 경로 재사용, 자동 실행 없음) */
function insertChatCode(code: string, placement: "append" | "below" | "above"): void {
  const st = useWorkbookStore.getState();
  const refId = st.workbook.pyBlocks.some(
    (b) => b.id === st.lastEditorBlockId && b.kind !== "markdown",
  )
    ? st.lastEditorBlockId
    : null;
  let targetId: string;
  if (placement === "append") {
    if (!refId || !appendSnippetToBlock(refId, code)) {
      toast("블록 편집기를 먼저 클릭하세요");
      return;
    }
    notifyWorkbookEdit([], [refId]);
    targetId = refId;
  } else {
    const res = insertSnippetAsBlock(refId, placement, codeTitle(code) || "AI 채팅", code);
    if (!res) {
      toast.error("블록을 만들 수 없습니다 (활성 시트 없음)");
      return;
    }
    if (refId && !res.ordered) {
      toast("순서를 보장할 빈 위치가 없어 빈 영역에 배치했습니다 — ↑↓로 순서를 조정하세요");
    }
    targetId = res.id;
  }
  st.setFocusBlock(targetId);
  st.setSelectedBlock(targetId);
  toast("블록에 반영했습니다 — 확인 후 실행하세요");
}

function CodeCard({ code }: { code: string }) {
  return (
    <div className="rounded border bg-code-bg" data-testid="chat-code-card">
      <pre className="max-h-56 overflow-auto p-2 font-mono text-xs">{code}</pre>
      <div className="flex flex-wrap items-center gap-1 border-t px-1 py-0.5">
        <CopyButton text={code} />
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => insertChatCode(code, "append")}
        >
          현재 블록에 추가
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-primary"
          onClick={() => insertChatCode(code, "below")}
        >
          아래 새 블록으로
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => insertChatCode(code, "above")}
        >
          위 새 블록으로
        </Button>
      </div>
    </div>
  );
}

export default function AiChatPanel({ onClose }: { onClose?: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [instructions, setInstructions] = useState(DEFAULT_CHAT_INSTRUCTIONS);
  const [instrOpen, setInstrOpen] = useState(false);
  const [instrDraft, setInstrDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // 마운트: 저장된 이력·지침 복원 + 대기 중 첨부 요청 소비
  useEffect(() => {
    void loadSettings().then((s) => {
      if (s?.aiChatHistory) setMessages(s.aiChatHistory);
      if (s?.aiChatInstructions !== undefined) setInstructions(s.aiChatInstructions);
    });
    const take = () => {
      if (pendingAsk) {
        setAttachment(pendingAsk);
        pendingAsk = null;
      }
    };
    take();
    window.addEventListener(ASK_EVENT, take);
    return () => window.removeEventListener(ASK_EVENT, take);
  }, []);

  // 새 메시지 → 맨 아래로
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, busy]);

  const persist = useCallback((next: ChatMessage[]) => {
    setMessages(next);
    void saveSettings({ aiChatHistory: capHistory(next) });
  }, []);

  const replaceMessage = (index: number, content: string) => {
    persist(messages.map((m, i) => (i === index ? { ...m, content } : m)));
  };

  const saveInstructions = (value: string) => {
    setInstructions(value);
    void saveSettings({ aiChatInstructions: value });
  };

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    const key = await getApiKey();
    if (!key) {
      openApiKeyDialog();
      return;
    }
    const user: ChatMessage = { role: "user", content: withAttachment(q, attachment) };
    const base = [...messages, user];
    setBusy(true);
    setError(null);
    setInput("");
    setAttachment(null);
    persist(base);
    try {
      // 컨텍스트(시트·변수 스키마)는 전송할 마지막 메시지에만 부착 — 이력에는 남기지 않는다
      const ctx = await collectContext();
      const sent = chatMessages(base).map((m, i, arr) =>
        i === arr.length - 1
          ? { ...m, content: `${m.content}\n\n[컨텍스트(JSON)]\n${cap(ctx.schema, 6000)}` }
          : m,
      );
      const text = await chat(key, buildChatSystem(instructions), sent);
      persist([...base, { role: "assistant", content: text }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /** 편집기 드래그 선택(없으면 커서 줄)을 첨부로 */
  const attachSelection = () => {
    const st = useWorkbookStore.getState();
    const id = st.lastEditorBlockId;
    const handle = id ? editorRegistry.get(id) : undefined;
    if (!handle) {
      toast("블록 편집기를 먼저 클릭한 뒤 선택하세요");
      return;
    }
    const text = handle.getSelection();
    if (!text.trim()) {
      toast("선택된 코드가 없습니다");
      return;
    }
    setAttachment({ label: "선택 코드", text });
  };

  return (
    <div className="flex h-full flex-col border-l bg-card" data-testid="ai-chat-panel">
      <div className="flex h-8 shrink-0 items-center gap-1 border-b px-2">
        <span className="text-xs font-medium">AI 채팅</span>
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-auto"
          onClick={() => {
            setInstrDraft(instructions);
            setInstrOpen(true);
          }}
          aria-label="채팅 지침 편집"
          title="채팅 지침"
        >
          <Gear />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={messages.length === 0}
          onClick={() => persist([])}
          aria-label="대화 지우기"
          title="대화 지우기"
        >
          <Broom />
        </Button>
        {onClose && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            aria-label="AI 채팅 패널 닫기"
            title="닫기"
          >
            <X />
          </Button>
        )}
      </div>

      {/* 메시지 목록 */}
      <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {messages.length === 0 && (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">
            코드·오류·데이터에 대해 무엇이든 물어보세요.
            <br />
            코드 답변은 버튼으로 블록에 넣을 수 있습니다(자동 실행 없음).
          </p>
        )}
        {messages.map((m, i) => {
          if (m.role === "user") {
            return (
              <div
                key={i}
                className="ml-6 whitespace-pre-wrap rounded border bg-accent/40 px-2 py-1.5 text-xs"
                data-role="user"
              >
                {m.content}
              </div>
            );
          }
          const { body, instruction } = parseInstructionFence(m.content);
          return (
            <div key={i} className="mr-2 space-y-1.5 text-xs" data-role="assistant">
              {splitCodeBlocks(body).map((seg, j) =>
                seg.type === "code" ? (
                  <CodeCard key={j} code={seg.content} />
                ) : (
                  <div key={j} className="space-y-1 px-1">
                    {renderMarkdown(seg.content)}
                  </div>
                ),
              )}
              {instruction && (
                <div
                  className="rounded border border-[var(--warning)]/50 bg-[var(--chip-amber-bg)]/50 px-2 py-1.5"
                  data-testid="instruction-proposal"
                >
                  <p className="text-xs">
                    지침에 추가: <span className="font-medium">{instruction}</span>
                  </p>
                  <div className="mt-1 flex justify-end gap-1">
                    <Button
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        saveInstructions(`${instructions.trim()}\n${instruction}`);
                        replaceMessage(i, body); // 펜스 제거 — 카드 재표시 방지
                        toast("지침에 추가했습니다 — 다음 대화부터 적용됩니다");
                      }}
                    >
                      반영
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => replaceMessage(i, body)}
                    >
                      무시
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {busy && <p className="px-2 text-xs text-muted-foreground">응답 생성 중…</p>}
        {error && <p className="px-2 text-xs text-destructive">{error}</p>}
      </div>

      {/* 첨부 카드 + 입력 */}
      <div className="shrink-0 border-t p-2">
        {attachment && (
          <div className="mb-1 flex items-center gap-1 rounded border bg-muted/40 px-2 py-1">
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
              [{attachment.label}] {attachment.text.split("\n")[0]}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setAttachment(null)}
              aria-label="첨부 제거"
            >
              <X />
            </Button>
          </div>
        )}
        <div className="flex items-end gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            className="mb-1"
            onClick={attachSelection}
            aria-label="선택 코드 질문"
            title="편집기에서 선택한 코드(없으면 커서 줄)를 첨부"
          >
            <PaperclipHorizontal />
          </Button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder="질문 입력 (Enter=전송, Shift+Enter=줄바꿈)"
            aria-label="AI 채팅 입력"
            disabled={busy}
            className="min-h-0 flex-1 resize-none rounded border bg-background p-1.5 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
          />
          <Button
            size="icon-sm"
            className={cn("mb-0.5 shrink-0")}
            disabled={busy || !input.trim()}
            onClick={() => void send()}
            aria-label="전송"
          >
            <ArrowUp />
          </Button>
        </div>
      </div>

      {/* 지침 편집 다이얼로그 (G.3) */}
      <Dialog open={instrOpen} onOpenChange={setInstrOpen}>
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle>채팅 지침</DialogTitle>
            <DialogDescription>
              이 브라우저에만 저장되며 워크북 파일에는 포함되지 않습니다. 앱 규칙(xl()·안전
              규칙)과 충돌하면 앱 규칙이 우선합니다.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={instrDraft}
            onChange={(e) => setInstrDraft(e.target.value)}
            rows={8}
            aria-label="채팅 지침"
            className="w-full resize-y rounded border bg-background p-2 text-xs outline-none focus:border-primary"
          />
          <DialogFooter>
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={() => setInstrDraft(DEFAULT_CHAT_INSTRUCTIONS)}
            >
              기본값 복원
            </Button>
            <Button variant="ghost" onClick={() => setInstrOpen(false)}>
              닫기
            </Button>
            <Button
              onClick={() => {
                saveInstructions(instrDraft.trim());
                setInstrOpen(false);
                toast("지침을 저장했습니다 — 다음 대화부터 적용됩니다");
              }}
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
