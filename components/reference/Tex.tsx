"use client";

/**
 * KaTeX 수식 렌더러 — 참조 뷰 이론(산출식)·분포 탭용.
 * katex.renderToString 결과를 그대로 삽입한다(throwOnError:false로 안전).
 * CSS/폰트는 이 모듈에서 1회 import(사용처마다 자동 번들).
 */
import katex from "katex";
import "katex/dist/katex.min.css";
import { useMemo } from "react";

export function Tex({
  expr,
  block = false,
  className = "",
}: {
  expr: string;
  block?: boolean;
  className?: string;
}) {
  const html = useMemo(
    () =>
      katex.renderToString(expr, {
        throwOnError: false,
        displayMode: block,
        output: "html",
      }),
    [expr, block],
  );
  return (
    <span
      className={className}
      // KaTeX가 생성한 신뢰된 마크업 — 사용자 입력 아님(정적 수식 문자열)
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
