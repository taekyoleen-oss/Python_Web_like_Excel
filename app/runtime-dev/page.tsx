"use client";

// 런타임 개발 하네스 — 메인 셸(app/page.tsx, grid-ui 소유) 없이 M3 런타임을 검증하는 페이지.
// 워커 생성은 useEffect(브라우저 전용)에서만 일어나므로 SSR에서 안전하다.

import { useEffect, useState } from "react";

import { ConsoleTab } from "@/components/panels/ConsoleTab";
import { RuntimeStatus } from "@/components/shell/RuntimeStatus";
import { getRuntimeClient, type RuntimeClient } from "@/lib/runtime/client";

export default function RuntimeDevPage() {
  const [client, setClient] = useState<RuntimeClient | null>(null);

  useEffect(() => {
    const c = getRuntimeClient();
    void c.boot(); // 멱등 — StrictMode 이중 호출 안전
    setClient(c);
  }, []);

  return (
    <main className="mx-auto flex h-screen max-w-3xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl">런타임 개발 하네스</h1>
        {client && <RuntimeStatus client={client} />}
      </div>
      {client && <ConsoleTab client={client} className="min-h-0 flex-1" />}
    </main>
  );
}
