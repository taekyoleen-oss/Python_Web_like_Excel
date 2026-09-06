// AI 코드 지원 프롬프트 (부록 E R6) — 소스(Actuarial_Platform lib/pyAssist.ts)의
// 시스템 프롬프트·4모드 user message를 이 앱(워크북·xl()·spill) 규칙으로 개작.

export const SYSTEM = `당신은 브라우저(Pyodide 314 · WebAssembly Python 3.14)에서 실행되는 "시트기반 파이썬(Sheet Python, 내부명 PyGrid Studio)" 워크북의 Python 블록 코드를 돕는 어시스턴트입니다.

사용 가능한 라이브러리: numpy, pandas, scipy, statsmodels, scikit-learn, matplotlib, openpyxl.
설치되어 있지 않아 사용 불가: lifelines, xgboost, lightgbm, seaborn, plotly, requests 등(네트워크/미포함 패키지).

규칙:
- 시트 데이터는 xl() 함수로 읽습니다: xl("A1:C10", headers=True), xl("'시트 이름'!A1:B5"). xl() 인수는 반드시 문자열 리터럴이어야 합니다(변수·f-string 금지).
- 블록의 마지막 표현식(또는 사용자가 지정한 변수)이 시트 셀로 펼쳐집니다(spill). DataFrame·Series·스칼라는 값으로, matplotlib Figure는 이미지 카드로 놓입니다. 블록 하나에 출력 여러 개를 둘 수도 있습니다.
- 그래프는 matplotlib로 그리되 plt.show()를 쓰지 말고 fig(또는 plt.gcf())를 마지막 표현식으로 두세요.
- 아래 '컨텍스트'에 실제로 존재하는 시트·열·변수 이름만 사용하세요. 없는 열 이름을 지어내지 마세요.
- 이미 로드된 변수(앞 블록에서 만든 것)는 다시 만들지 말고 그대로 사용하세요. 워커 파일시스템의 파일은 pd.read_csv("파일명")으로 읽을 수 있습니다.
- 파일 다운로드, 네트워크 요청, 시스템 접근은 하지 마세요.
- 코드에는 핵심을 설명하는 한국어 주석을 간결히 답니다.

출력 형식(반드시 지킬 것): 먼저 한두 문장의 짧은 설명(한국어)을 쓰고, 그 다음 파이썬 코드 블록 하나만 출력합니다.
\`\`\`python
<코드>
\`\`\`
코드 블록은 정확히 하나만, 그 밖의 마크다운/표/여러 블록은 쓰지 마세요.`;

export interface AssistInput {
  /**
   * fix: 블록 오류 진단·수정 / generate: 요청→새 블록 코드 /
   * edit: 이 블록을 요청대로 수정·보완 / vars: 실제 런타임 변수에 맞게 변수명만 조정
   */
  mode: "fix" | "generate" | "edit" | "vars";
  code?: string;
  error?: string;
  request?: string;
  /** 컨텍스트 JSON(시트 스키마 + 런타임 변수 + 파일) — lib/ai/schema.ts */
  schema?: string;
  priorCode?: string;
}

export const cap = (s: string | undefined, n: number): string => (s ?? "").slice(0, n);

/** 모드별 user message (소스 buildUserMessage 이식 — '셀'→'블록', 스키마→컨텍스트) */
export function buildUserMessage(input: AssistInput): string {
  const schema = cap(input.schema, 6000) || "(아직 데이터·변수가 없습니다)";

  if (input.mode === "edit") {
    return [
      "다음 블록의 파이썬 코드를 아래 '요청'에 맞게 수정하거나 내용을 추가한 '블록 전체 코드'를 제시하세요. 컨텍스트의 실제 열 이름·변수를 사용하고, 요청과 무관한 부분은 최대한 유지하세요.",
      "",
      "[컨텍스트(JSON)]",
      schema,
      "",
      "[이전 블록 코드(참고용, 이미 실행됨)]",
      cap(input.priorCode, 6000) || "(없음)",
      "",
      "[현재 블록 코드]",
      cap(input.code, 8000) || "(비어 있음)",
      "",
      "[요청]",
      cap(input.request, 1500) || "(요청 없음)",
    ].join("\n");
  }

  if (input.mode === "vars") {
    const target = (input.request ?? "").trim();
    return [
      "다음 블록 코드에서 사용하는 '변수 이름'만 조정하세요. 아래 '컨텍스트'의 vars(=현재 런타임에 실제로 존재하는 변수)에 있는 변수로, 이 블록의 데이터프레임 등 변수 이름을 바꿉니다.",
      target
        ? `사용자가 대상 변수를 지정했습니다: 이 블록의 데이터프레임 변수를 반드시 '${target}'(으)로 바꾸세요.`
        : "여러 후보가 있으면, 이 블록이 참조하는 열 이름과 가장 잘 맞는 변수를 고르세요.",
      "규칙: 코드의 로직·구조·함수·열 이름·문자열은 그대로 두고, 오직 변수 이름만 실제 존재하는 변수로 교체합니다. 이미 올바르면 그대로 두세요. vars에 없는 이름으로는 절대 바꾸지 마세요.",
      "",
      "[컨텍스트(JSON) — vars가 실제 존재하는 변수]",
      schema,
      "",
      "[이전 블록 코드(참고용)]",
      cap(input.priorCode, 6000) || "(없음)",
      "",
      "[현재 블록 코드]",
      cap(input.code, 8000) || "(비어 있음)",
    ].join("\n");
  }

  if (input.mode === "fix") {
    const hasError = (input.error ?? "").trim().length > 0;
    return [
      hasError
        ? "다음 블록의 파이썬 코드가 오류를 냈습니다. 컨텍스트를 참고해 원인을 진단하고, 오류를 고친 '블록 전체 코드'를 제시하세요."
        : "다음 블록의 파이썬 코드를 컨텍스트에 비추어 검토하고, 문제가 있거나 개선할 점이 있으면 고친 '블록 전체 코드'를 제시하세요(문제가 없으면 그대로 두되 이유를 설명).",
      "",
      "[컨텍스트(JSON)]",
      schema,
      "",
      "[블록 코드]",
      cap(input.code, 8000) || "(비어 있음)",
      "",
      hasError ? "[오류 트레이스백]" : "[오류 없음]",
      hasError ? cap(input.error, 4000) : "",
    ].join("\n");
  }
  // generate
  return [
    "아래 '요청'에 맞는 파이썬 코드를 작성하세요. 컨텍스트의 시트는 xl()로, 이미 로드된 변수는 그대로 활용하고 실제 열 이름을 사용하세요. 확인할 값은 마지막 표현식으로 두어 셀에 펼쳐지게 하세요.",
    "",
    "[컨텍스트(JSON)]",
    schema,
    "",
    "[이전 블록 코드(참고용, 이미 실행됨)]",
    cap(input.priorCode, 8000) || "(없음)",
    "",
    "[요청]",
    cap(input.request, 1500) || "(요청 없음)",
  ].join("\n");
}
