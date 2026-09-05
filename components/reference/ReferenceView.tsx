"use client";

/**
 * 참조 뷰 — 데이터 예제/분석 (부록 E R2).
 * 4탭 [엑셀함수 | 파이썬코드 | 분포 | 모델적합]. 모든 패널은 마운트 유지 + hidden 토글
 * (탭 전환에도 검색·스크롤·다이얼로그 상태 보존). 마지막 탭은 설정에 저장.
 */
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DistributionsTab from "@/components/reference/DistributionsTab";
import ExcelTab from "@/components/reference/ExcelTab";
import FittingTab from "@/components/reference/FittingTab";
import MethodsTab from "@/components/reference/MethodsTab";
import { loadSettings, saveSettings } from "@/lib/storage/db";

const TAB_IDS = ["excel", "methods", "dist", "fit"] as const;
type TabId = (typeof TAB_IDS)[number];
const TABS: [TabId, string][] = [
  ["excel", "엑셀함수"],
  ["methods", "파이썬코드"],
  ["dist", "분포"],
  ["fit", "모델적합"],
];

export default function ReferenceView() {
  const [tab, setTab] = useState<TabId>("excel");

  // 마지막 탭 복원 (1회) — 이후에는 사용자의 선택이 우선
  useEffect(() => {
    void loadSettings().then((s) => {
      const saved = s?.referenceTab as TabId | undefined;
      if (saved && TAB_IDS.includes(saved)) setTab(saved);
    });
  }, []);

  const panelCls =
    "min-h-0 flex-1 overflow-y-auto bg-muted/30 data-[state=inactive]:hidden";

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => {
        setTab(v as TabId);
        void saveSettings({ referenceTab: v });
      }}
      className="flex h-full flex-col gap-0"
    >
      <div className="shrink-0 border-b bg-background px-4">
        <TabsList variant="line" className="h-9">
          {TABS.map(([id, label]) => (
            <TabsTrigger key={id} value={id} data-testid={`ref-tab-${id}`} className="px-3">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {/* forceMount + hidden — 패널 상태(검색어·펼침·다이얼로그)를 탭 전환에도 유지 */}
      <TabsContent forceMount value="excel" className={panelCls}>
        <div className="mx-auto max-w-6xl px-4 py-5">
          <ExcelTab />
        </div>
      </TabsContent>
      <TabsContent forceMount value="methods" className={panelCls}>
        <div className="mx-auto max-w-6xl px-4 py-5">
          <MethodsTab />
        </div>
      </TabsContent>
      <TabsContent forceMount value="dist" className={panelCls}>
        <div className="mx-auto max-w-6xl px-4 py-5">
          <DistributionsTab />
        </div>
      </TabsContent>
      <TabsContent forceMount value="fit" className={panelCls}>
        <div className="mx-auto max-w-6xl px-4 py-5">
          <FittingTab />
        </div>
      </TabsContent>
    </Tabs>
  );
}
