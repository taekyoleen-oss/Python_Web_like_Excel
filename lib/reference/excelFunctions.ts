// 엑셀 분석함수 사전 — /datalab "엑셀 분석함수" 탭 데이터.
// weight(1~5)=실무 사용 빈도 → 사분면 가로축·글자 크기, difficulty(1~5)=난이도 → 세로축.
// 사분면 4개(stat/lookup/shape/logic)는 2×2 그래프, lambda(LET·LAMBDA)는 그래프 아래 별도 섹션.
// 콘텐츠는 확립된 엑셀 문서 지식 + '엑셀 함수 대백과' 교차검증으로 저작(초보자→고급 예제).

export type ExcelVersion = "all" | "2019" | "2021" | "365";

export type ExcelCategoryId =
  | "stat"
  | "lookup"
  | "shape"
  | "logic"
  | "lambda"
  | "dataref";

/** 칩 뮤트 팔레트(--chip-*) 한정 스코프 — 카테고리 고정색 */
export type ExcelChipColor =
  | "blue"
  | "violet"
  | "teal"
  | "amber"
  | "rose"
  | "cyan"
  | "slate";

export interface ExcelCategory {
  id: ExcelCategoryId;
  label: string;
  color: ExcelChipColor;
  hint: string;
}

/** 인수(argument) 한 줄 해설 — 팝업 '인수' 섹션 */
export interface ExcelParam {
  name: string;
  /** 필수 인수 여부 — false면 '선택' 배지 */
  required: boolean;
  desc: string;
}

/** 예제 — 초보자 기초(basic) → 실무/고급(advanced) 진행 */
export interface ExcelExample {
  level: "basic" | "advanced";
  title: string;
  /** =로 시작하는 실제 동작 수식 */
  formula: string;
  /** 반환 결과 또는 스필 배열 설명 */
  result: string;
  /** 무엇을·왜 — 쉬운 말 */
  explain: string;
}

export interface ExcelFunction {
  id: string;
  /** 표시 이름(대문자 함수명, 결합은 가운뎃점 ·) */
  name: string;
  category: ExcelCategoryId;
  /** 도입 버전 — 위첨자·팝업 배지 */
  version: ExcelVersion;
  /** 실무 사용 빈도 1~5 — 클수록 글자가 크고 사분면 중심에 가깝다(가로축) */
  weight: number;
  /** 체감 난이도 1~5 — 사분면 세로축: 중심선에서 멀수록 어렵다 */
  difficulty: number;
  /** 구문 한 줄(한글 인수명) */
  syntax: string;
  /** 한 줄 요약 (툴팁·팝업 서브타이틀) */
  summary: string;
  /** 개념·용도 — 초보자 눈높이, "\n\n"으로 문단 구분 */
  intro: string;
  params: ExcelParam[];
  examples: ExcelExample[];
  /** 주의·흔한 오해(선택) */
  tips?: string;
  /** 연관 함수명(선택) */
  related?: string[];
}

/** 2×2 사분면 카테고리(순서 = 그래프 배치: 좌상·우상·좌하·우하) */
export const EXCEL_QUADRANTS: ExcelCategory[] = [
  { id: "stat", label: "기초통계·수학", color: "blue", hint: "평균·분위수·집계 — 요약의 출발점" },
  { id: "lookup", label: "검색·참조", color: "violet", hint: "찾고 끌어오기 — 표 결합의 핵심" },
  { id: "shape", label: "데이터가공·동적배열", color: "teal", hint: "거르고·정렬·합치기 — 스필의 시대" },
  { id: "logic", label: "조건·논리·집계", color: "amber", hint: "조건별 계산 — 전처리의 뼈대" },
];

/** LET·LAMBDA — 사분면 아래 별도 섹션 */
export const EXCEL_LAMBDA_CATEGORY: ExcelCategory = {
  id: "lambda",
  label: "LET · LAMBDA — 사용자 정의 함수",
  color: "rose",
  hint: "이름 붙이기 · 나만의 함수 · 재귀 해찾기",
};

/** 데이터 참조·연산자 — 사분면 아래 별도 섹션(트림 . · 스필 # · 구조적 참조) */
export const EXCEL_DATAREF_CATEGORY: ExcelCategory = {
  id: "dataref",
  label: "데이터 참조·연산자",
  color: "cyan",
  hint: "범위 자동 확장(.) · 배열 참조(#) · 표(구조적 참조)",
};

export const EXCEL_CATEGORIES: ExcelCategory[] = [
  ...EXCEL_QUADRANTS,
  EXCEL_LAMBDA_CATEGORY,
  EXCEL_DATAREF_CATEGORY,
];

export function excelCategory(id: ExcelCategoryId): ExcelCategory {
  return EXCEL_CATEGORIES.find((c) => c.id === id) ?? EXCEL_QUADRANTS[0];
}

/** 함수명 옆 위첨자 — all(전 버전)은 표시 안 함 */
export const VERSION_SUP: Record<ExcelVersion, string> = {
  all: "",
  "2019": "19",
  "2021": "21",
  "365": "365",
};

/** 팝업 배지·안내 문구 */
export const VERSION_FULL: Record<ExcelVersion, string> = {
  all: "전 버전 (Excel 2016 이하 포함)",
  "2019": "Excel 2019 및 Microsoft 365",
  "2021": "Excel 2021 및 Microsoft 365",
  "365": "Microsoft 365 전용 (2021 미지원)",
};

// 콘텐츠는 별도 파일에서 주입(파일 비대화 방지) — 워크플로우 산출을 excelFunctionsData.ts에 담는다.
export { EXCEL_FUNCTIONS } from "./excelFunctionsData";
