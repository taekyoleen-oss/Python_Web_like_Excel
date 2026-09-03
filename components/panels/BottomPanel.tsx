"use client";

// 하단 패널 — [진단][출력 미리보기][변수][콘솔] 탭 컨테이너 (§4.3)

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConsoleTab } from "@/components/panels/ConsoleTab";
import DiagnosticsTab from "@/components/panels/DiagnosticsTab";
import OutputPreviewTab from "@/components/panels/OutputPreviewTab";
import VariablesTab from "@/components/panels/VariablesTab";
import { useWorkbookStore, type WorkbookState } from "@/lib/grid/model";
import type { RuntimeClient } from "@/lib/runtime/client";

export default function BottomPanel({ client }: { client: RuntimeClient }) {
  const tab = useWorkbookStore((s) => s.bottomTab);
  const errorCount = useWorkbookStore(
    (s) =>
      s.workbook.pyBlocks.filter(
        (b) => b.last?.status === "error" || b.last?.status === "spill",
      ).length,
  );

  return (
    <Tabs
      value={tab}
      onValueChange={(v) =>
        useWorkbookStore.getState().setBottomTab(v as WorkbookState["bottomTab"])
      }
      className="flex h-full flex-col gap-0"
    >
      <TabsList
        id="bottom-panel-tabs"
        className="h-7 shrink-0 justify-start rounded-none border-b bg-muted/40 px-2"
      >
        <TabsTrigger value="diagnostics" className="h-6 gap-1 text-xs">
          진단
          {errorCount > 0 && (
            <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px]">
              {errorCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="preview" className="h-6 text-xs">
          출력 미리보기
        </TabsTrigger>
        <TabsTrigger value="variables" className="h-6 text-xs">
          변수
        </TabsTrigger>
        <TabsTrigger value="console" className="h-6 text-xs">
          콘솔
        </TabsTrigger>
      </TabsList>
      <TabsContent value="diagnostics" className="min-h-0 flex-1 overflow-y-auto">
        <DiagnosticsTab />
      </TabsContent>
      <TabsContent value="preview" className="min-h-0 flex-1 overflow-y-auto">
        <OutputPreviewTab />
      </TabsContent>
      <TabsContent value="variables" className="min-h-0 flex-1 overflow-y-auto">
        <VariablesTab client={client} />
      </TabsContent>
      {/* 콘솔은 히스토리 보존을 위해 항상 마운트 */}
      <TabsContent
        value="console"
        forceMount
        className="min-h-0 flex-1 data-[state=inactive]:hidden"
      >
        <ConsoleTab client={client} className="h-full" />
      </TabsContent>
    </Tabs>
  );
}
