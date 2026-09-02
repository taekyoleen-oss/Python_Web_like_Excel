"use client";

// 하단 패널 콘솔 탭 — 공유 네임스페이스 REPL (설계서 §4.7 ConsoleTab)
// stdout/stderr는 청크 단위 스트리밍, 결과는 마지막 표현식의 repr.

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import type { RuntimeClient } from "@/lib/runtime/client";

type LineKind = "in" | "out" | "err" | "res";

interface Line {
  kind: LineKind;
  text: string;
}

const LINE_CLS: Record<LineKind, string> = {
  in: "text-muted-foreground",
  out: "text-foreground",
  err: "text-destructive",
  res: "text-foreground",
};

export function ConsoleTab({
  client,
  className,
}: {
  client: RuntimeClient;
  className?: string;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [value, setValue] = useState("");
  const histRef = useRef<string[]>([]);
  const histIdxRef = useRef(0);
  const outRef = useRef<HTMLDivElement>(null);

  const append = (line: Line) => setLines((prev) => [...prev, line]);

  useEffect(() => {
    const offs = [
      client.on("stdout", ({ chunk }) => append({ kind: "out", text: chunk + "\n" })),
      client.on("stderr", ({ chunk }) => append({ kind: "err", text: chunk + "\n" })),
    ];
    return () => offs.forEach((off) => off());
  }, [client]);

  useEffect(() => {
    const el = outRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const submit = async () => {
    const code = value.trim();
    if (!code) return;
    histRef.current.push(code);
    histIdxRef.current = histRef.current.length;
    setValue("");
    append({ kind: "in", text: `>>> ${code}\n` });
    try {
      const res = await client.repl(code);
      if (res.traceback) {
        append({
          kind: "err",
          text: res.traceback.endsWith("\n") ? res.traceback : res.traceback + "\n",
        });
      } else if (res.repr !== null) {
        append({ kind: "res", text: res.repr + "\n" });
      }
    } catch (err) {
      append({
        kind: "err",
        text: `${err instanceof Error ? err.message : String(err)}\n`,
      });
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      void submit();
    } else if (e.key === "ArrowUp") {
      const hist = histRef.current;
      if (hist.length === 0) return;
      e.preventDefault();
      histIdxRef.current = Math.max(0, histIdxRef.current - 1);
      setValue(hist[histIdxRef.current] ?? "");
    } else if (e.key === "ArrowDown") {
      const hist = histRef.current;
      if (hist.length === 0) return;
      e.preventDefault();
      histIdxRef.current = Math.min(hist.length, histIdxRef.current + 1);
      setValue(hist[histIdxRef.current] ?? "");
    }
  };

  return (
    <div className={cn("flex min-h-0 flex-col border border-border bg-code-bg", className)}>
      <div
        ref={outRef}
        data-testid="console-output"
        className="min-h-0 flex-1 overflow-y-auto p-2 font-mono text-xs whitespace-pre-wrap"
      >
        {lines.map((l, i) => (
          <span key={i} className={LINE_CLS[l.kind]}>
            {l.text}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-1.5 border-t border-border px-2 py-1.5">
        <span className="font-mono text-xs text-primary select-none">&gt;&gt;&gt;</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Python 코드를 입력하세요 (Enter 실행)"
          spellCheck={false}
          autoComplete="off"
          className="flex-1 bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}
