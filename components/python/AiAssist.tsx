"use client";

// ✦ AI (부록 L.5) — 단일 진입점은 채팅 하나다. 여기 있는 것은 "요청을 만들어 채팅으로 보내는" 액션뿐:
// 패널 상단 생성 바 + 블록 카드 ✦ 4액션(이 블록 고쳐줘 / 변수명 맞춰줘 / 오류 원인 / 자유 요청).
// 인라인 제안 패널·에러분석 모달은 채팅 제안 카드로 일원화되어 사라졌다.

import { useState } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { askAiChat } from "@/components/ai-chat/AiChatPanel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { buildBlockAsk, type BlockPreset } from "@/lib/ai/chat";
import { formatA1 } from "@/lib/grid/a1";
import { useWorkbookStore } from "@/lib/grid/model";
import type { PyBlock } from "@/types/workbook";

// ── 패널 상단: ✦ AI에게 코드 요청 → 채팅으로 전송 ─────────────────────

export function AiGenerateBar() {
  const [request, setRequest] = useState("");

  const submit = () => {
    const req = request.trim();
    if (!req) return;
    setRequest("");
    askAiChat({ question: req }); // 채팅 패널 열기 + 즉시 전송 (키 확인·응답은 채팅이 담당)
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
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-primary"
          onClick={submit}
          disabled={!request.trim()}
        >
          채팅으로 요청
        </Button>
      </div>
    </div>
  );
}

// ── 블록 카드 ✦ 메뉴 — 4액션 모두 채팅으로 보낸다 ──────────────────────

export function AiAssist({ block }: { block: PyBlock }) {
  const hasError = block.last?.status === "error";

  const ask = (preset: BlockPreset) => {
    const sheetName = useWorkbookStore
      .getState()
      .workbook.sheets.find((s) => s.id === block.sheetId)?.name;
    askAiChat(
      buildBlockAsk(preset, {
        id: block.id,
        title: block.title,
        anchor: formatA1(
          { r0: block.anchor.r, c0: block.anchor.c, r1: block.anchor.r, c1: block.anchor.c },
          sheetName,
        ),
        code: block.code,
        note: block.note,
        ...(hasError
          ? {
              traceback: block.last?.traceback ?? "",
              errorSummary: block.last?.summaryKo ?? "",
            }
          : {}),
      }),
    );
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
              aria-label="AI 메뉴"
            >
              <Sparkle className="size-3" /> AI
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-52">
            <DropdownMenuItem onClick={() => ask("edit")}>이 블록 고쳐줘</DropdownMenuItem>
            <DropdownMenuItem onClick={() => ask("vars")}>변수명 맞춰줘</DropdownMenuItem>
            <DropdownMenuItem
              disabled={!hasError}
              onClick={() => ask("fix")}
              title={hasError ? undefined : "오류 상태의 블록에서만 사용할 수 있습니다"}
            >
              오류 원인 알려줘
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => ask("free")}>
              자유 요청 — 블록 첨부해 채팅 열기
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
