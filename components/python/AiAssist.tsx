"use client";

// ✦ AI 코드 지원 (부록 E R6) — 패널 상단 생성 바 + 블록별 ✦ 메뉴(제안/변수 반영/에러분석).
// 제안은 절대 자동 적용·자동 실행하지 않는다. AI 상태는 컴포넌트 로컬(undo 히스토리 미오염).

import { useState } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { toast } from "sonner";
import { askAiChat } from "@/components/ai-chat/AiChatPanel";
import { openApiKeyDialog, getApiKey } from "@/components/shell/ApiKeyDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { assist, type AssistResult } from "@/lib/ai/anthropic";
import { collectContext } from "@/lib/ai/schema";
import { createReferenceBlocks } from "@/lib/grid/import-blocks";
import { notifyWorkbookEdit } from "@/lib/grid/calc-host";
import { useWorkbookStore } from "@/lib/grid/model";
import type { PyBlock } from "@/types/workbook";

/** 새 블록으로 반영 + 포커스 + toast (생성·제안 공용, 1 undo 단계) */
function addSuggestionBlock(title: string, code: string): void {
  const ids = createReferenceBlocks(null, [{ title, code }]);
  if (ids.length === 0) {
    toast.error("블록을 만들 수 없습니다 (활성 시트 없음)");
    return;
  }
  const st = useWorkbookStore.getState();
  st.setFocusBlock(ids[0]);
  st.setSelectedBlock(ids[0]);
  toast("블록을 만들었습니다 — 확인 후 실행하세요");
}

/** 키 확인 → 컨텍스트 수집 → 호출. 키 없으면 설정 다이얼로그 유도 후 null */
async function callAssist(
  input: { mode: "generate" | "edit" | "vars" | "fix"; code?: string; error?: string; request?: string },
  blockId?: string,
): Promise<AssistResult | null> {
  const key = await getApiKey();
  if (!key) {
    openApiKeyDialog();
    return null;
  }
  const ctx = await collectContext(blockId);
  return assist(key, { ...input, schema: ctx.schema, priorCode: ctx.priorCode });
}

// ── 패널 상단: ✦ AI에게 코드 요청 (generate) ──────────────────────────

export function AiGenerateBar() {
  const [request, setRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const req = request.trim();
    if (!req || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await callAssist({ mode: "generate", request: req });
      if (!res) return; // 키 미설정 → 다이얼로그 유도됨
      if (!res.code) {
        setError(res.explanation || "코드가 포함되지 않은 응답입니다 — 요청을 구체화해 보세요");
        return;
      }
      addSuggestionBlock(`AI 생성: ${req.slice(0, 30)}${req.length > 30 ? "…" : ""}`, res.code);
      setRequest("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // 테두리·자리는 PythonPanel의 상단 행(코드 삽입 버튼과 한 줄)이 관리한다 (부록 F.1)
  return (
    <div className="min-w-0 flex-1 px-2 py-1.5">
      <div className="flex items-center gap-1">
        <Input
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          placeholder="✦ AI에게 코드 요청 (예: 시트의 손해액 월별 합계)"
          aria-label="AI 코드 요청"
          className="h-7 flex-1 text-xs"
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-primary"
          onClick={() => void submit()}
          disabled={busy || !request.trim()}
        >
          {busy ? "생성 중…" : "생성"}
        </Button>
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── 블록별 ✦ 메뉴 + 제안 패널 + 에러분석 다이얼로그 ────────────────────

interface Suggestion extends AssistResult {
  mode: "edit" | "vars" | "fix";
}

export function AiAssist({ block }: { block: PyBlock }) {
  const [input, setInput] = useState<null | "edit" | "vars">(null); // 인라인 입력 표시
  const [request, setRequest] = useState("");
  const [varNames, setVarNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [fixOpen, setFixOpen] = useState(false);

  const hasError = block.last?.status === "error";

  const run = async (mode: "edit" | "vars" | "fix", req?: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await callAssist(
        {
          mode,
          code: block.code,
          request: req,
          ...(mode === "fix"
            ? { error: block.last?.traceback ?? block.last?.summaryKo ?? "" }
            : {}),
        },
        block.id,
      );
      if (!res) return;
      if (!res.code && mode !== "fix") {
        setError(res.explanation || "코드가 포함되지 않은 응답입니다");
        return;
      }
      setSuggestion({ ...res, mode });
      setInput(null);
      if (mode === "fix") setFixOpen(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openVars = async () => {
    const key = await getApiKey();
    if (!key) {
      openApiKeyDialog();
      return;
    }
    setError(null);
    try {
      const { getRuntimeClient } = await import("@/lib/runtime/client");
      const client = getRuntimeClient();
      const vars =
        client.getStatus() === "ready" ? (await client.inspect()).map((v) => v.name) : [];
      if (vars.length === 0) {
        setError("런타임 변수가 없습니다 — 블록을 먼저 실행하세요");
        return;
      }
      setVarNames(vars);
      setRequest(vars[0]);
      setInput("vars");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const applyToBlock = () => {
    if (!suggestion) return;
    useWorkbookStore.getState().setBlockCode(block.id, suggestion.code); // 1 undo
    notifyWorkbookEdit([], [block.id]);
    setSuggestion(null);
    toast("제안을 이 블록에 적용했습니다 — 확인 후 실행하세요");
  };

  const asNewBlock = () => {
    if (!suggestion) return;
    addSuggestionBlock(
      suggestion.mode === "fix" ? `수정안: ${block.title || "블록"}` : "AI 제안",
      suggestion.code,
    );
    setSuggestion(null);
    setFixOpen(false);
  };

  return (
    <div className="border-t">
      <div className="flex items-center gap-1 px-1 py-0.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 gap-1 px-1.5 text-[11px] text-primary"
              disabled={busy}
              aria-label="AI 메뉴"
            >
              <Sparkle className="size-3" /> {busy ? "요청 중…" : "AI"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-52">
            <DropdownMenuItem
              onClick={() => {
                setRequest("");
                setInput("edit");
              }}
            >
              AI 제안 — 요청 입력
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void openVars()}>
              변수 반영 — 런타임 변수에 맞추기
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!hasError}
              onClick={() => void run("fix")}
              title={hasError ? undefined : "오류 상태의 블록에서만 사용할 수 있습니다"}
            >
              에러분석 — 수정안 보기
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                askAiChat({
                  label: hasError ? "블록 코드 + 오류" : "블록 코드",
                  text: hasError
                    ? `${block.code}\n\n[Traceback]\n${block.last?.traceback ?? block.last?.summaryKo ?? ""}`
                    : block.code,
                })
              }
            >
              채팅으로 질문 — 코드{hasError ? "·오류" : ""} 첨부
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {input === "edit" && (
          <>
            <Input
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              placeholder="이 블록에 대한 요청 (예: 결측치 제거 추가)"
              aria-label="AI 블록 요청"
              className="h-6 flex-1 text-xs"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && request.trim()) void run("edit", request.trim());
                if (e.key === "Escape") setInput(null);
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              disabled={busy || !request.trim()}
              onClick={() => void run("edit", request.trim())}
            >
              요청
            </Button>
          </>
        )}
        {input === "vars" && (
          <>
            <select
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              aria-label="대상 변수 선택"
              className="h-6 flex-1 rounded border bg-background px-1 text-xs"
            >
              {varNames.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              disabled={busy}
              onClick={() => void run("vars", request)}
            >
              반영안 보기
            </Button>
          </>
        )}
      </div>
      {error && <p className="px-2 pb-1 text-xs text-destructive">{error}</p>}

      {/* 제안 패널 (edit·vars) — 읽기 전용 코드 + 적용 버튼. fix는 다이얼로그로 */}
      {suggestion && suggestion.mode !== "fix" && (
        <div className="mx-1 mb-1 rounded border bg-accent/40">
          {suggestion.explanation && (
            <p className="px-2 pt-1.5 text-xs">{suggestion.explanation}</p>
          )}
          <pre className="max-h-48 overflow-auto p-2 font-mono text-xs">
            {suggestion.code}
          </pre>
          <div className="flex justify-end gap-1 border-t px-1 py-1">
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={applyToBlock}>
              이 블록에 적용
            </Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={asNewBlock}>
              아래 새 블록으로
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => setSuggestion(null)}
            >
              닫기
            </Button>
          </div>
        </div>
      )}

      {/* 에러분석 다이얼로그 — 원본 블록 유지, 새 블록으로만 반영 (소스 UX) */}
      <Dialog open={fixOpen} onOpenChange={setFixOpen}>
        <DialogContent className="max-w-[640px]">
          <DialogHeader>
            <DialogTitle>에러분석 — AI 수정안</DialogTitle>
            <DialogDescription className="text-destructive">
              {block.last?.summaryKo ?? "오류"}
            </DialogDescription>
          </DialogHeader>
          {suggestion?.explanation && <p className="text-sm">{suggestion.explanation}</p>}
          <pre className="max-h-64 overflow-auto rounded border bg-code-bg p-2 font-mono text-xs">
            {suggestion?.code || "(수정 코드 없음 — 설명을 참고하세요)"}
          </pre>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFixOpen(false)}>
              닫기
            </Button>
            <Button onClick={asNewBlock} disabled={!suggestion?.code}>
              아래 새 블록으로 반영
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
