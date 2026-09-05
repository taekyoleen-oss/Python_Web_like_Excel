"use client";

// AI 설정 — Anthropic API 키 입력/삭제 (부록 E R6). 키는 IndexedDB에만 저장된다.
// 파일 메뉴 항목 + ✦ AI 기능(키 미설정 시)에서 window 이벤트로 열린다.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { loadSettings, saveSettings } from "@/lib/storage/db";

const OPEN_EVENT = "pygrid:open-ai-settings";

/** 어디서든 AI 설정 다이얼로그 열기 (키 미설정 시 유도용) */
export function openApiKeyDialog(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/** 저장된 키 반환(없으면 null) — AI 호출부 공용 */
export async function getApiKey(): Promise<string | null> {
  const s = await loadSettings();
  return s?.anthropicApiKey?.trim() ? s.anthropicApiKey : null;
}

export default function ApiKeyDialog() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  // 열릴 때 저장 여부만 반영 (키 값 자체는 입력란에 되돌리지 않는다)
  useEffect(() => {
    if (!open) return;
    setDraft("");
    void getApiKey().then((k) => setHasKey(!!k));
  }, [open]);

  const save = async () => {
    const key = draft.trim();
    if (!key) return;
    await saveSettings({ anthropicApiKey: key });
    setDraft("");
    setOpen(false);
    toast("API 키를 저장했습니다 — ✦ AI 기능이 활성화됩니다");
  };

  const remove = async () => {
    await saveSettings({ anthropicApiKey: undefined });
    setHasKey(false);
    toast("API 키를 삭제했습니다");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <DialogTitle>AI 설정 — Anthropic API 키</DialogTitle>
          <DialogDescription>
            키는 이 브라우저(IndexedDB)에만 저장되며 Anthropic API 호출에만 사용됩니다.
            워크북 파일이나 내보내기에는 절대 포함되지 않습니다. 키 발급:{" "}
            <a
              href="https://console.anthropic.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              console.anthropic.com
            </a>
          </DialogDescription>
        </DialogHeader>
        {hasKey && (
          <p className="text-xs text-muted-foreground">
            저장된 키가 있습니다. 새 키를 입력하면 교체됩니다.
          </p>
        )}
        <Input
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="sk-ant-…"
          aria-label="Anthropic API 키"
          autoComplete="off"
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
          }}
        />
        <DialogFooter>
          {hasKey && (
            <Button variant="ghost" className="mr-auto text-destructive" onClick={() => void remove()}>
              키 삭제
            </Button>
          )}
          <Button variant="ghost" onClick={() => setOpen(false)}>
            닫기
          </Button>
          <Button onClick={() => void save()} disabled={!draft.trim()}>
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
