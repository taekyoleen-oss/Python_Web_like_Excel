"use client";

// 변수 탭 — 런타임 전역 변수 목록(이름·타입·shape·요약) + 미리보기·새 시트 내보내기 (§2.3.5)

import { useCallback, useEffect, useState } from "react";
import { ArrowsClockwise } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWorkbookStore, type CellEdit } from "@/lib/grid/model";
import type { RuntimeClient } from "@/lib/runtime/client";
import { toCells } from "@/lib/runtime/converters";
import type { VariableInfo } from "@/lib/runtime/protocol";

export default function VariablesTab({ client }: { client: RuntimeClient }) {
  const [vars, setVars] = useState<VariableInfo[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (client.getStatus() !== "ready") return;
    setLoading(true);
    try {
      setVars(await client.inspect());
    } catch {
      /* 재부트 중 등 — 다음 갱신에서 회복 */
    } finally {
      setLoading(false);
    }
  }, [client]);

  // 실행 완료(running → ready) 시 자동 갱신
  useEffect(() => {
    void refresh();
    return client.on("status", (s) => {
      if (s === "ready") void refresh();
    });
  }, [client, refresh]);

  const togglePreview = async (name: string) => {
    if (previews[name] !== undefined) {
      setPreviews((p) => {
        const next = { ...p };
        delete next[name];
        return next;
      });
      return;
    }
    try {
      const { repr } = await client.repl(`repr(${name})`);
      setPreviews((p) => ({ ...p, [name]: repr ?? "(없음)" }));
    } catch {
      /* 무시 */
    }
  };

  const exportDataFrame = async (name: string) => {
    try {
      const payload = await client.run(`__var_export_${name}`, name, {}, "values", "auto");
      if (!payload.ok || !payload.cells) {
        toast.error("내보내기 실패: 값으로 변환할 수 없습니다");
        return;
      }
      const cells = toCells(payload.cells);
      const edits: CellEdit[] = [];
      cells.forEach((row, r) => row.forEach((cell, c) => edits.push({ r, c, cell })));
      useWorkbookStore.getState().addSheetWithCells(edits);
      toast(`${name}을(를) 새 시트로 내보냈습니다`);
    } catch (e) {
      toast.error(`내보내기 실패: ${(e as Error).message}`);
    }
  };

  return (
    <div className="text-xs">
      <div className="flex items-center px-3 py-1.5">
        <span className="text-muted-foreground">전역 변수 {vars.length}개</span>
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-auto"
          onClick={() => void refresh()}
          disabled={loading}
          aria-label="변수 목록 새로고침"
          title="새로고침"
        >
          <ArrowsClockwise />
        </Button>
      </div>
      {vars.length === 0 ? (
        <p className="px-3 py-4 text-center text-muted-foreground">
          {client.getStatus() === "ready"
            ? "정의된 변수가 없습니다"
            : "런타임 준비 후 표시됩니다"}
        </p>
      ) : (
        <table className="w-full border-collapse">
          <tbody>
            {vars.map((v) => (
              <VarRow
                key={v.name}
                info={v}
                preview={previews[v.name]}
                onToggle={() => void togglePreview(v.name)}
                onExport={() => void exportDataFrame(v.name)}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function VarRow({
  info,
  preview,
  onToggle,
  onExport,
}: {
  info: VariableInfo;
  preview?: string;
  onToggle: () => void;
  onExport: () => void;
}) {
  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer border-b hover:bg-accent/40">
        <td className="px-3 py-1 font-mono font-medium">{info.name}</td>
        <td className="px-2 py-1 font-mono text-muted-foreground">{info.type}</td>
        <td className="px-2 py-1 font-mono text-muted-foreground">
          {info.shape ? `${info.shape[0]}×${info.shape[1]}` : ""}
        </td>
        <td className="max-w-48 truncate px-2 py-1 text-muted-foreground">{info.summary}</td>
        <td className="px-2 py-1 text-right">
          {info.type === "DataFrame" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExport();
              }}
              className="text-primary hover:underline"
            >
              새 시트로 내보내기
            </button>
          )}
        </td>
      </tr>
      {preview !== undefined && (
        <tr className="border-b bg-code-bg">
          <td colSpan={5} className="px-3 py-1">
            <pre className="max-h-40 overflow-auto font-mono text-[11px] leading-4">{preview}</pre>
          </td>
        </tr>
      )}
    </>
  );
}
