"use client";

import dynamic from "next/dynamic";
import { useWorkbookStore } from "@/lib/grid/model";

const WorkbookShell = dynamic(() => import("@/components/shell/WorkbookShell"), {
  ssr: false,
});

// e2e·개발 도구에서 스토어 접근용
if (typeof window !== "undefined") {
  (window as unknown as { __pygridStore: typeof useWorkbookStore }).__pygridStore =
    useWorkbookStore;
}

export default function Home() {
  return <WorkbookShell />;
}
