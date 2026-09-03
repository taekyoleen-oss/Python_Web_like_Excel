"use client";

// 초기화 스크립트 편집 — 저장 후 "런타임 재설정 후 적용" (§4.4 InitScriptDialog)

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import CodeEditor from "@/components/python/CodeEditor";
import { useWorkbookStore } from "@/lib/grid/model";
import { DEFAULT_INIT_SCRIPT, getRuntimeClient } from "@/lib/runtime/client";

export default function InitScriptDialog() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [applying, setApplying] = useState(false);

  const onOpenChange = (next: boolean) => {
    if (next) {
      setDraft(useWorkbookStore.getState().workbook.initScript || DEFAULT_INIT_SCRIPT);
    }
    setOpen(next);
  };

  const apply = async () => {
    setApplying(true);
    try {
      useWorkbookStore.getState().setInitScript(draft);
      const client = getRuntimeClient();
      // 계약 갭: client.reset()은 부트 시점 initScript를 재실행한다(새 스크립트 전달 인자 없음).
      // 리셋으로 사용자 전역을 지운 뒤 새 스크립트를 이어서 실행해 같은 효과를 낸다.
      await client.reset();
      await client.repl(draft);
      toast("런타임을 재설정하고 초기화 스크립트를 적용했습니다");
      setOpen(false);
    } catch (e) {
      toast.error(`초기화 스크립트 적용 실패: ${(e as Error).message}`);
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 text-xs">
          초기화 스크립트
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <DialogTitle>초기화 스크립트</DialogTitle>
          <DialogDescription>
            런타임 시작 시 실행되는 기본 import를 편집합니다. 적용 시 런타임이
            재설정되어 변수가 초기화됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded border">
          <CodeEditor value={draft} onChange={setDraft} className="max-h-80" />
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setDraft(DEFAULT_INIT_SCRIPT)}
            disabled={applying}
          >
            기본값 복원
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={applying}>
            취소
          </Button>
          <Button onClick={apply} disabled={applying}>
            {applying ? "적용 중…" : "런타임 재설정 후 적용"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
