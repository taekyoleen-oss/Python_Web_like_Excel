/**
 * 분석 방법 팝업 [엑셀 적용 코드] 탭 — Python in Excel(=PY()) 적용 코드 레지스트리.
 *
 * 키는 lib/statMethods.ts `STAT_METHODS`(계리 8종 포함)의 방법 id와 1:1 대응.
 * 없는 id는 팝업이 공통 차이점 안내 + '코드 적용' 탭 참고 폴백을 보인다.
 * 데이터는 lib/methodExcelCodeData.ts(워크플로우 pie-code 산출). 확대는 그 파일에 id 키 추가.
 */

/** 필요한 패키지의 Python in Excel(Anaconda) 사용 가능 여부 */
export type ExcelPackageStatus = "available" | "partial" | "unavailable";

export interface ExcelCodeSection {
  title: string;
  level: "basic" | "advanced";
  /** 분석 트랙 — 미지정 시 코드로 자동 판정(lib/methodTracks) */
  track?: MethodTrack;
  /** 데이터 로드 줄 정도만 바뀌고 로직이 원본과 사실상 동일하면 true */
  sameAsOriginal: boolean;
  code: string;
}

export interface MethodExcelCode {
  packageStatus: ExcelPackageStatus;
  /** 코드 위에 표시할 이 방법의 Python in Excel 적용 차이점 */
  note: string;
  sections: ExcelCodeSection[];
}

/** 모든 방법 공통 — Python in Excel과 브라우저 실행기의 차이(탭 상단 고정 안내·글머리) */
export const PIE_GENERAL_NOTE: string[] = [
  "데이터는 파일 읽기 대신 xl(\"범위 또는 표\", headers=True)로 시트를 참조합니다.",
  "print는 셀이 아닌 진단(Diagnostics) 창으로 가서 불필요 — 아래 코드는 print를 벗겨 식만 남겼습니다(셀에는 마지막 식의 값이 반환).",
  "np·pd·plt·sns·statsmodels(sm)·warnings는 기본 로드되어 다시 import할 필요가 없습니다(아래 코드에서 해당 줄은 주석 처리). scipy·scikit-learn 등은 import가 필요합니다.",
  "Anaconda 큐레이션 패키지만 됩니다(pip 불가) — scipy·scikit-learn 등은 되지만 lifelines·xgboost·lightgbm 등은 안 됩니다.",
  "표는 to_string() 없이 DataFrame 그대로 반환하도록 바꿨습니다 — 문자열 한 덩어리가 아니라 셀 범위에 표로 펼쳐집니다(계수·통계량을 셀에서 바로 참조 가능).",
];

/**
 * 방법별 note(문장 문자열)를 글머리 목록으로 변환.
 * 문장(마침표+공백) 단위로 자르고, 위 공통 안내·패키지 배지에 이미 있는 '패키지 사용
 * 가능' 재진술 문장만 걸러 낸다(중복 축소). 그 밖의 방법별 정보(표 이름·셀 순서 등)는 유지.
 */
const _AVAIL_RE = /(기본 제공|기본 공급|사용 가능|그대로 실행)/;
const _PKG_RE = /(scipy|numpy|pandas|matplotlib|statsmodels|scikit-learn|sklearn|patsy|Anaconda|필요한|패키지)/;
export function noteToBullets(note: string): string[] {
  return note
    .split(/\.\s+/)
    .map((s) => s.trim().replace(/\.$/, "").trim())
    .filter(Boolean)
    .filter((s) => !(_AVAIL_RE.test(s) && _PKG_RE.test(s)));
}

/** Python in Excel이 실행 전에 기본 로드하는 패키지 — 재import가 중복이라 주석 처리 대상 */
const EXCEL_PRELOADED_IMPORTS = new Set([
  "import numpy as np",
  "import pandas as pd",
  "import matplotlib.pyplot as plt",
  "import seaborn as sns",
  "import statsmodels as sm",
  "import warnings",
  "import excel",
]);

/**
 * 엑셀 기본 로드 패키지의 import 줄을 주석 처리(중복 로드 방지·엑셀의 장점 유지).
 * 정확히 일치하는 줄만 대상 — statsmodels.api 등 하위 모듈 import는 기본 로드(bare
 * statsmodels)와 달라 그대로 두고, scipy처럼 로드 안 된 패키지도 유지한다.
 */
function commentPreloadedImports(code: string): string {
  return code
    .split("\n")
    .map((line) => {
      // 인라인 주석·후행 공백을 떼고 '정확히' 일치하는 기본 로드 import만 주석 처리
      const core = line.replace(/\s+#.*$/, "").trim();
      if (EXCEL_PRELOADED_IMPORTS.has(core)) {
        return `# ${core}  ← Excel 기본 로드(생략 가능)`;
      }
      return line;
    })
    .join("\n");
}

/**
 * print(...) 래퍼를 벗겨 '식'만 남긴다 — Python in Excel은 print가 진단창으로 가고
 * 셀에는 마지막 식 값이 반환되므로 print가 불필요(사용자 요청 2026-07-19).
 *  · 단일/다중 인자 모두 내용만 남긴다(다중 인자는 튜플 식으로 유효).
 *  · 여러 줄에 걸친 print(...)도 괄호 균형(문자열 내부 무시)으로 처리.
 *  · sep=/end= 키워드가 있으면 튜플로 바꿀 수 없어 원문 유지. 빈 print()도 유지.
 */
export function stripPrintWrappers(code: string): string {
  const lines = code.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^(\s*)print\(/);
    if (!m) {
      out.push(line);
      continue;
    }
    const indent = m[1];
    // 'print(' 다음부터 닫는 괄호까지 스캔 — 문자열 리터럴 안의 괄호는 무시
    let depth = 1;
    let inStr: string | null = null;
    let esc = false;
    let inner = "";
    let tail = "";
    let closed = false;
    let j = i;
    let pos = m[0].length;
    for (; j < lines.length && !closed; j++) {
      const s = j === i ? line : lines[j];
      for (; pos < s.length; pos++) {
        const ch = s[pos];
        if (inStr) {
          if (esc) esc = false;
          else if (ch === "\\") esc = true;
          else if (ch === inStr) inStr = null;
          inner += ch;
          continue;
        }
        if (ch === '"' || ch === "'") {
          inStr = ch;
          inner += ch;
        } else if (ch === "(") {
          depth++;
          inner += ch;
        } else if (ch === ")") {
          depth--;
          if (depth === 0) {
            closed = true;
            tail = s.slice(pos + 1); // 닫는 괄호 뒤(주석 등)
            break;
          }
          inner += ch;
        } else {
          inner += ch;
        }
      }
      if (!closed) {
        inner += "\n";
        pos = 0;
      }
    }
    const innerTrim = inner.trim();
    // 변환 불가/무의미 — 원문 유지: 빈 print(), sep=/end= 키워드, 미닫힘
    if (
      !closed ||
      innerTrim.length === 0 ||
      /(^|,)\s*(sep|end|file|flush)\s*=/.test(inner.replace(/"[^"]*"|'[^']*'/g, ""))
    ) {
      for (let k = i; k < j; k++) out.push(lines[k]);
      i = j - 1;
      continue;
    }
    // print(x) → x  (여러 줄이면 원래 줄바꿈·들여쓰기 유지)
    const bare = inner
      .split("\n")
      .map((s, idx) => (idx === 0 ? indent + s.trimStart() : s))
      .join("\n");
    out.push(bare + tail);
    i = j - 1;
  }
  return out.join("\n");
}

/**
 * 표를 셀에 '스필'시키기 — 최상위 식으로 끝나는 `표.to_string(...)`에서 to_string을 벗긴다.
 * to_string()은 문자열 한 덩어리라 =PY() 셀에 텍스트로만 들어가고, DataFrame을 그대로
 * 반환하면 셀 범위에 표로 펼쳐진다(사용자 요청 2026-07-30).
 *  · 들여쓴 줄(반복문 안 진단 출력)·대입문·f-string은 대상이 아니다.
 */
export function unwrapToString(code: string): string {
  return code
    .split("\n")
    .map((line) => {
      const m = line.match(/^([A-Za-z_][\w.[\]"'()]*?)\.to_string\([^()]*\)[ \t]*(#.*)?$/);
      if (!m) return line;
      return m[1] + (m[2] ? `   ${m[2]}` : "");
    })
    .join("\n");
}

/**
 * 파이썬 코드를 Python in Excel용으로 변환.
 *  · plt.show()는 불필요(셀이 마지막 그림을 반환) → 제거
 *  · print(...) 래퍼 제거 — 내용(식)만 남긴다(마지막 식이 셀에 반환, 사용자 요청)
 *  · 엑셀 기본 로드 패키지(np·pd·plt·sns·sm·warnings)의 import 줄 → 주석 처리
 *  · 모델 적합의 임베드 데이터 옆에 xl() 대안 주석을 덧붙인다(있을 때만)
 * 나머지 차이(셀당 그림 1개 등)는 코드 위 안내(PIE_CODE_NOTE)로 설명한다.
 */
export function toExcelPython(code: string): string {
  let out = code.replace(/;?[ \t]*plt\.show\(\)/g, "");
  out = stripPrintWrappers(out);
  out = unwrapToString(out);
  out = commentPreloadedImports(out);
  out = out.replace(
    /(#\s*1\)\s*데이터 입력[^\n]*\n)/,
    `$1# ▶ Python in Excel: 임베드된 데이터 대신 시트를 참조하려면 예) x = np.asarray(xl("범위 또는 표"), float).ravel()\n`
  );
  return out;
}

/** 확률분포·모델 적합 코드 팝업의 '엑셀 적용 코드' 탭 안내(코드 위·글머리) */
export const PIE_CODE_NOTE: string[] = [
  "scipy·numpy·matplotlib만 써서 =PY()에서 대부분 그대로 실행됩니다.",
  "데이터가 코드에 임베드돼 있습니다 — 시트를 쓰려면 xl(\"범위/표\")로 바꾸세요(주석에 예시).",
  "print는 셀이 아닌 진단 창으로 가서 불필요 — 코드에서 print를 벗겨 식만 남겼습니다(셀에는 마지막 식 값이 반환).",
  "np·pd·plt 등 기본 로드 패키지의 import 줄은 주석 처리했습니다(scipy 등은 import 필요).",
  "그림은 셀당 1개만 반환 — 여러 그래프는 셀을 나눠 마지막 줄에 plt.gcf()를 두세요(불필요한 plt.show()는 제거).",
];

export const PACKAGE_STATUS_META: Record<
  ExcelPackageStatus,
  { label: string; color: string }
> = {
  available: { label: "패키지 사용 가능", color: "teal" },
  partial: { label: "일부 패키지 제한", color: "amber" },
  unavailable: { label: "일부 패키지 미지원", color: "rose" },
};

import { METHOD_EXCEL_CODE as AUTHORED } from "./methodExcelCodeData";
import { excelResultSections } from "./modelResultSections";
import { STEPWISE_EXCEL } from "./stepwiseMethods";
import { orderSections } from "./methodTracks";
import type { MethodTrack } from "./methodTracks";

/**
 * 저작된 적응 코드 + '결과를 표로' 자동 생성 섹션 병합.
 * 엑셀에서 summary()·print가 셀에 안 보이는 문제를 표(DataFrame) 셀로 해결한 섹션을 붙이고,
 * 파이썬 탭과 똑같이 트랙(공통 → 전통적 분석 → 머신러닝)·수준 순으로 재배열한다.
 */
function mergeResultSections(
  base: Record<string, MethodExcelCode>
): Record<string, MethodExcelCode> {
  const out: Record<string, MethodExcelCode> = { ...base, ...STEPWISE_EXCEL };
  for (const id of Object.keys(out)) {
    const sections = orderSections([...out[id].sections, ...excelResultSections(id)]);
    out[id] = { ...out[id], sections };
  }
  return out;
}

export const METHOD_EXCEL_CODE: Record<string, MethodExcelCode> =
  mergeResultSections(AUTHORED);
