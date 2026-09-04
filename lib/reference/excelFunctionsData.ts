// 엑셀 분석함수 사전 데이터 — 워크플로우 저작·감사 산출(자동 생성).
// 타입은 lib/excelFunctions.ts. 이 파일은 데이터 전용(파일 비대화 분리).
import type { ExcelFunction } from "./excelFunctions";

export const EXCEL_FUNCTIONS: ExcelFunction[] = [
  {
    "id": "average",
    "name": "AVERAGE",
    "category": "stat",
    "version": "all",
    "weight": 5,
    "difficulty": 1,
    "syntax": "=AVERAGE(숫자1, [숫자2], ...)",
    "summary": "숫자들의 산술 평균(합계÷개수)을 구합니다. 가장 기본적인 대표값.",
    "intro": "지정한 숫자들을 모두 더한 뒤 개수로 나눈 산술 평균을 구합니다.\n\n- 범위 안 숫자만 계산 — 글자·빈 칸은 자동 제외\n- 0은 숫자로 포함, 빈 칸은 제외 → 무응답=빈 칸·실제 0=0으로 구분 입력\n- 청구액·보험료 등 실무 데이터의 첫 요약값",
    "params": [
      {
        "name": "숫자1",
        "required": true,
        "desc": "평균을 구할 첫 번째 숫자나 셀 범위. 범위를 지정하면 그 안의 숫자를 모두 사용합니다."
      },
      {
        "name": "숫자2, ...",
        "required": false,
        "desc": "이어서 평균에 넣을 추가 숫자나 범위(선택). 콤마로 최대 255개까지 나열할 수 있습니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "청구액 평균 구하기",
        "formula": "=AVERAGE(B2:B11)",
        "result": "B2:B11에 입력된 청구액의 평균 한 값",
        "explain": "범위 안의 숫자만 골라 평균을 냅니다(글자·빈 칸 자동 제외)."
      },
      {
        "level": "basic",
        "title": "숫자를 직접 넣어 평균",
        "formula": "=AVERAGE(10, 20, 30, 40)",
        "result": "25",
        "explain": "숫자를 직접 나열해도 되며 (10+20+30+40)÷4=25입니다."
      },
      {
        "level": "advanced",
        "title": "특정 상품만 골라 평균 (조건부)",
        "formula": "=AVERAGE(FILTER(claim_amt, product=\"자동차\"))",
        "result": "product가 \"자동차\"인 행들의 청구액 평균 한 값",
        "explain": "FILTER(2021·365)로 자동차 계약만 뽑아 조건부 평균을 냅니다."
      },
      {
        "level": "advanced",
        "title": "계약별 손해율의 평균",
        "formula": "=AVERAGE(claim_amt/premium)",
        "result": "각 계약의 손해율(청구액÷보험료)을 구한 뒤 그 평균 한 값",
        "explain": "계약별 손해율 배열의 평균으로, '전체 청구액÷전체 보험료'와 다를 수 있습니다(옛 버전은 Ctrl+Shift+Enter)."
      },
      {
        "level": "advanced",
        "title": "평균에 오류 방지·반올림 씌우기",
        "formula": "=IFERROR(ROUND(AVERAGE(B2:B11), -2), \"데이터 없음\")",
        "result": "100원 단위로 반올림한 평균. 숫자가 하나도 없으면 \"데이터 없음\"",
        "explain": "숫자가 없을 때의 #DIV/0! 오류를 IFERROR로 문구로 바꾸고 ROUND(-2)로 100원 단위 반올림합니다."
      }
    ],
    "tips": "- 0은 포함·빈 칸은 제외 — 어느 쪽인지에 따라 결과가 달라짐\n- 숫자가 하나도 없으면 #DIV/0! 오류\n- 조건부 평균은 AVERAGEIF·AVERAGEIFS가 더 간단",
    "related": [
      "AVERAGEIF",
      "AVERAGEIFS",
      "MEDIAN",
      "SUM",
      "TRIMMEAN"
    ]
  },
  {
    "id": "count-family",
    "name": "COUNT · COUNTA · COUNTBLANK",
    "category": "stat",
    "version": "all",
    "weight": 5,
    "difficulty": 1,
    "syntax": "=COUNT(값1, [값2], …)  /  =COUNTA(값1, [값2], …)  /  =COUNTBLANK(범위)",
    "summary": "개수를 세는 세 형제 — COUNT(숫자만)·COUNTA(값이 있는 셀)·COUNTBLANK(빈 셀)",
    "intro": "개수를 세는 함수 3형제로, 무엇을 세느냐만 다릅니다.\n\n- COUNT: 숫자 셀만(날짜·시간 포함, 글자·빈 칸 무시)\n- COUNTA: 비어 있지 않은 모든 셀 / COUNTBLANK: 빈 셀\n- 예: 보험료 입력 건수=COUNT, 전체 건수=COUNTA, 미처리 건수=COUNTBLANK",
    "params": [
      {
        "name": "값1 / 범위",
        "required": true,
        "desc": "COUNT·COUNTA는 셀 값이나 범위(값1)를, COUNTBLANK는 빈 셀을 셀 대상 범위 하나를 지정합니다."
      },
      {
        "name": "값2, …",
        "required": false,
        "desc": "COUNT·COUNTA에서 추가로 세고 싶은 값이나 범위(최대 255개). 여러 범위를 한꺼번에 셀 때 씁니다. COUNTBLANK는 범위를 하나만 받습니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "숫자가 입력된 건수 세기 (COUNT)",
        "formula": "=COUNT(C2:C11)",
        "result": "9 (C열 보험료 중 숫자가 든 셀 수)",
        "explain": "글자·빈 칸을 빼고 보험료가 숫자로 입력된 건수만 셉니다."
      },
      {
        "level": "basic",
        "title": "전체 건수 세기 (COUNTA)",
        "formula": "=COUNTA(A2:A11)",
        "result": "10 (A열 계약번호가 채워진 행 수)",
        "explain": "숫자·글자 구분 없이 채워진 셀을 모두 세어 전체 건수를 구합니다."
      },
      {
        "level": "basic",
        "title": "빈 칸(미처리) 세기 (COUNTBLANK)",
        "formula": "=COUNTBLANK(D2:D11)",
        "result": "3 (D열 심사일이 비어 있는 셀 수)",
        "explain": "심사일이 비어 있는 셀을 세어 미처리 건수를 파악합니다."
      },
      {
        "level": "advanced",
        "title": "입력 완료율(진행률) 구하기",
        "formula": "=COUNT(C2:C11)/COUNTA(A2:A11)",
        "result": "0.9 (셀 서식을 백분율로 바꾸면 90%)",
        "explain": "입력 건수÷전체 건수로 데이터 입력 진행률을 구합니다."
      },
      {
        "level": "advanced",
        "title": "글자로 잘못 든 셀만 골라 세기 (COUNTA − COUNT)",
        "formula": "=COUNTA(C2:C11)-COUNT(C2:C11)",
        "result": "2 (보험료 칸에 '미정' 등 텍스트가 든 셀 수)",
        "explain": "채워진 칸에서 숫자 칸을 빼 글자로 잘못 입력된 셀 수를 점검합니다."
      },
      {
        "level": "advanced",
        "title": "판매 상품 종류 수 (UNIQUE 결합, 365·2021)",
        "formula": "=COUNTA(UNIQUE(B2:B100))",
        "result": "7 (B열 상품 product의 서로 다른 종류 수)",
        "explain": "UNIQUE(2021·365)로 중복을 없앤 뒤 세어 상품 종류 수를 구합니다(옛 버전은 SUMPRODUCT(1/COUNTIF) 관용식)."
      }
    ],
    "related": [
      "COUNTIF",
      "COUNTIFS",
      "SUMPRODUCT",
      "UNIQUE"
    ],
    "tips": "- 조건을 걸어 세려면 COUNTIF·COUNTIFS\n- 수식 결과 \"\"(빈 문자열) 셀은 COUNTA='값 있음', COUNTBLANK='빈 셀'로 각각 계산되는 특이 케이스"
  },
  {
    "id": "round-family",
    "name": "ROUND · ROUNDUP · ROUNDDOWN",
    "category": "stat",
    "version": "all",
    "weight": 5,
    "difficulty": 1,
    "syntax": "=ROUND(숫자, 자릿수)  /  =ROUNDUP(숫자, 자릿수)  /  =ROUNDDOWN(숫자, 자릿수)",
    "summary": "숫자를 반올림(ROUND)·올림(ROUNDUP)·내림(ROUNDDOWN)으로 원하는 자릿수까지 정리",
    "intro": "숫자를 원하는 자릿수로 정리하는 3형제 — ROUND(반올림)·ROUNDUP(무조건 올림)·ROUNDDOWN(무조건 내림)입니다.\n\n- 자릿수: 양수=소수 자리(2→123.46), 0=정수, 음수=십·백·천 단위(−3→천 단위)\n- 보험료 원 단위 절사·십 원 단위 반올림에 자주 사용\n- 셀 서식은 보이기만 바꿈 — 실제 값을 바꾸려면 ROUND 계열 필요",
    "params": [
      {
        "name": "숫자",
        "required": true,
        "desc": "정리할 숫자, 또는 그 숫자가 든 셀·수식(예: 보험료 계산식 전체)."
      },
      {
        "name": "자릿수",
        "required": true,
        "desc": "어디까지 남길지. 양수=소수 자리, 0=정수, 음수=10·100·1000 단위. 예: 2→소수 둘째, −3→천 단위."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "소수 둘째 자리로 반올림 (ROUND)",
        "formula": "=ROUND(123.456, 2)",
        "result": "123.46",
        "explain": "소수 셋째 자리를 보고 반올림해 둘째 자리까지 남깁니다."
      },
      {
        "level": "basic",
        "title": "원 미만 버리기 (ROUNDDOWN)",
        "formula": "=ROUNDDOWN(53271.8, 0)",
        "result": "53271",
        "explain": "자릿수 0+무조건 내림으로 소수점 이하를 버리는 원 단위 절사입니다."
      },
      {
        "level": "basic",
        "title": "무조건 올림 (ROUNDUP)",
        "formula": "=ROUNDUP(12.01, 0)",
        "result": "13",
        "explain": "0.01만 넘어도 무조건 올려 13이 됩니다."
      },
      {
        "level": "advanced",
        "title": "보험료를 십 원 단위로 반올림 (계산식 감싸기)",
        "formula": "=ROUND(C2*0.023, -1)",
        "result": "53270 (가입금액×요율을 십 원 단위 반올림)",
        "explain": "자릿수 −1로 계산식 결과를 십 원 단위로 반올림합니다."
      },
      {
        "level": "advanced",
        "title": "절사 단위를 셀로 동적 지정",
        "formula": "=ROUNDDOWN(A2, B2)",
        "result": "A열 값을 B열에 적은 자릿수만큼 내림",
        "explain": "자릿수를 셀로 주면 상품별로 다른 절사 단위를 한 수식으로 처리합니다."
      },
      {
        "level": "advanced",
        "title": "범위 전체를 한 번에 원 단위 절사 (365 스필)",
        "formula": "=ROUNDDOWN(C2:C101*D2:D101, 0)",
        "result": "각 계약의 보험료(가입금액×요율)를 원 미만 버린 스필 배열",
        "explain": "범위끼리 곱해 계약별 보험료를 원 미만 절사하며, 365에서는 결과가 자동 스필됩니다."
      }
    ],
    "related": [
      "INT",
      "TRUNC",
      "MROUND",
      "CEILING.MATH",
      "FLOOR.MATH",
      "FIXED"
    ],
    "tips": "- 자릿수 음수는 10·100·1000 단위 정리(−1=십, −2=백, −3=천)\n- 소수 버림은 INT·TRUNC도 가능하나 음수 처리 방식이 다름\n- 500원 등 특정 배수로 맞추려면 MROUND·CEILING.MATH·FLOOR.MATH"
  },
  {
    "id": "sum",
    "name": "SUM",
    "category": "stat",
    "version": "all",
    "weight": 5,
    "difficulty": 1,
    "syntax": "=SUM(숫자1, [숫자2], ...)",
    "summary": "범위나 여러 숫자를 모두 더해 합계를 구한다.",
    "intro": "숫자를 더하는 가장 기본 함수로, 범위 안의 숫자를 모두 합합니다.\n\n- 글자·빈 칸이 섞여 있어도 숫자만 골라 더함\n- 떨어진 여러 범위·여러 시트의 같은 칸까지 한 번에 합산\n- 보험료 합계 등 거의 모든 표 작업의 출발점",
    "params": [
      {
        "name": "숫자1",
        "required": true,
        "desc": "더할 첫 번째 값 또는 셀 범위. 보통 여기에 합칠 범위를 넣는다."
      },
      {
        "name": "숫자2 ...",
        "required": false,
        "desc": "추가로 더할 값이나 범위. 쉼표로 최대 255개까지 나열할 수 있다(떨어진 영역·개별 숫자 혼합 가능)."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "범위 전체 더하기",
        "formula": "=SUM(B2:B13)",
        "result": "B2:B13에 있는 12개월 보험료를 모두 더한 합계",
        "explain": "범위만 넣으면 빈 칸·글자를 무시하고 숫자만 더합니다."
      },
      {
        "level": "basic",
        "title": "숫자를 직접 더하기",
        "formula": "=SUM(10, 20, 30)",
        "result": "60",
        "explain": "숫자·범위·셀을 쉼표로 섞어 나열해도 됩니다."
      },
      {
        "level": "advanced",
        "title": "떨어진 여러 범위 한 번에",
        "formula": "=SUM(B2:B13, F2:F13)",
        "result": "두 범위(예: 생명·손해 보험료 열)의 숫자를 모두 합한 값",
        "explain": "쉼표로 떨어진 여러 범위를 한 번에 합산합니다."
      },
      {
        "level": "advanced",
        "title": "누적 합계(러닝 토탈)",
        "formula": "=SUM($B$2:B2)",
        "result": "행을 내려갈수록 그 시점까지의 누계(예: 1월, 1~2월, 1~3월 누적)",
        "explain": "시작점만 $로 고정해 아래로 복사하면 범위가 커져 누적 합계가 됩니다."
      },
      {
        "level": "advanced",
        "title": "여러 시트 같은 칸 합치기(3차원 참조)",
        "formula": "=SUM('1월:12월'!B2)",
        "result": "1월부터 12월 시트까지 각 시트의 B2를 모두 더한 연간 합계",
        "explain": "'첫시트:끝시트'!셀 형태로 여러 시트의 같은 칸을 한 번에 합산합니다."
      }
    ],
    "tips": "- 빈 칸·텍스트는 무시하고 숫자만 합산\n- '1,000'처럼 문자로 입력된 숫자는 더해지지 않음 — 셀 서식·데이터 형식 확인",
    "related": [
      "SUMIF",
      "SUMIFS",
      "SUBTOTAL",
      "AGGREGATE",
      "SUMPRODUCT"
    ]
  },
  {
    "id": "correl",
    "name": "CORREL",
    "category": "stat",
    "version": "all",
    "weight": 4,
    "difficulty": 2,
    "syntax": "=CORREL(배열1, 배열2)",
    "summary": "두 데이터가 함께 움직이는 정도를 −1~+1 한 숫자(상관계수)로 보여 준다",
    "intro": "두 데이터가 함께 움직이는 정도(상관계수, −1~+1)를 구합니다.\n\n- +1 가까움=양의 상관, −1 가까움=음의 상관, 0 근처=직선 관계 없음\n- 예: 가입자 나이와 연간 청구액의 관계를 한 숫자로 확인\n- 직선 관계만 측정(U자형은 0 근처 가능)하며 상관≠인과",
    "params": [
      {
        "name": "배열1",
        "required": true,
        "desc": "첫 번째 데이터 범위(예: 나이). 숫자 셀 범위를 지정합니다."
      },
      {
        "name": "배열2",
        "required": true,
        "desc": "두 번째 데이터 범위(예: 청구액). 배열1과 같은 개수·같은 순서로 짝지어야 하며, 글자·빈 칸이 낀 위치는 양쪽 모두 무시됩니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "나이와 청구액의 관계",
        "formula": "=CORREL(B2:B21, C2:C21)",
        "result": "0.72",
        "explain": "0.72면 나이가 많을수록 청구액도 커지는 경향이 꽤 강하다는 뜻입니다."
      },
      {
        "level": "basic",
        "title": "광고비와 매출의 관계",
        "formula": "=CORREL(A2:A13, B2:B13)",
        "result": "0.93",
        "explain": "0.93이면 광고비와 매출이 함께 느는 강한 양의 관계입니다."
      },
      {
        "level": "advanced",
        "title": "보고서용으로 소수 두 자리 정리 (ROUND 결합)",
        "formula": "=ROUND(CORREL(B2:B21, C2:C21), 2)",
        "result": "0.72",
        "explain": "ROUND로 소수 두 자리만 남겨 보고서용으로 정리합니다."
      },
      {
        "level": "advanced",
        "title": "결정계수 R²로 설명력 보기",
        "formula": "=CORREL(B2:B21, C2:C21)^2",
        "result": "0.52 (=RSQ(C2:C21,B2:B21) 와 동일)",
        "explain": "상관계수 제곱=R²로, 0.52면 청구액 변동의 약 52%를 나이로 설명한다는 뜻입니다."
      },
      {
        "level": "advanced",
        "title": "오류 방어 — 편차 0이면 안내 문구",
        "formula": "=IFERROR(CORREL(B2:B21, C2:C21), \"계산 불가\")",
        "result": "정상이면 상관계수, 한쪽 값이 전부 같으면 \"계산 불가\"",
        "explain": "한 열이 전부 같은 값(편차 0)일 때 나는 #DIV/0! 오류를 IFERROR로 감쌉니다."
      }
    ],
    "related": [
      "PEARSON",
      "RSQ",
      "SLOPE",
      "INTERCEPT",
      "COVARIANCE.S"
    ],
    "tips": "- CORREL=PEARSON(결과 동일), CORREL^2=RSQ\n- 직선 관계만 측정하며 인과관계를 뜻하지 않음\n- 이상치 하나에도 크게 흔들림 — 산점도와 함께 확인"
  },
  {
    "id": "large-small",
    "name": "LARGE · SMALL",
    "category": "stat",
    "version": "all",
    "weight": 4,
    "difficulty": 2,
    "syntax": "=LARGE(배열, k)   ·   =SMALL(배열, k)",
    "summary": "데이터에서 k번째로 큰 값(LARGE) 또는 k번째로 작은 값(SMALL)을 뽑는다.",
    "intro": "k번째로 큰 값(LARGE)·작은 값(SMALL)을 뽑는 짝꿍 함수입니다.\n\n- LARGE(범위,1)=MAX, SMALL(범위,1)=MIN — 원하는 순번 k를 직접 지정\n- Top 3 청구액·하위 5개 손해율 등 상위/하위 몇 개 추출에 사용\n- k에 배열을 주면 여러 순번 한 번에(SUM 결합 시 상위 N개 합계)",
    "params": [
      {
        "name": "배열",
        "required": true,
        "desc": "값을 뽑아낼 숫자 데이터 범위. 문자·빈칸은 무시됩니다."
      },
      {
        "name": "k",
        "required": true,
        "desc": "몇 번째 값인지. LARGE는 1이 최댓값, SMALL은 1이 최솟값. 배열의 개수보다 크면 #NUM! 오류."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "세 번째로 큰 청구액 찾기",
        "formula": "=LARGE(C2:C101, 3)",
        "result": "예: 8,200,000",
        "explain": "청구액에서 세 번째로 큰 값을 뽑습니다(k=1이면 최댓값)."
      },
      {
        "level": "basic",
        "title": "두 번째로 작은 보험료 찾기",
        "formula": "=SMALL(D2:D101, 2)",
        "result": "예: 120,000",
        "explain": "두 번째로 작은 값을 뽑아 최솟값이 특이하게 낮을 때 현실적 하한을 봅니다."
      },
      {
        "level": "advanced",
        "title": "상위 3개 청구액 합계",
        "formula": "=SUM(LARGE(C2:C101, {1,2,3}))",
        "result": "1~3위 청구액을 더한 합",
        "explain": "k에 {1,2,3}을 주어 1~3위를 한꺼번에 뽑아 SUM으로 더합니다."
      },
      {
        "level": "advanced",
        "title": "동적 배열로 Top 5 한 번에 뽑기",
        "formula": "=LARGE(C2:C101, SEQUENCE(5))",
        "result": "1~5위 값 5개가 세로로 스필",
        "explain": "SEQUENCE(2021·365)로 1~5위가 세로로 자동 스필되어 랭킹 표가 됩니다."
      },
      {
        "level": "advanced",
        "title": "특정 상품 안에서 최고 청구액 찾기",
        "formula": "=MAX(IF($E$2:$E$101=\"암보험\", $C$2:$C$101))",
        "result": "암보험의 최대 청구액",
        "explain": "조건 옵션이 없어 IF로 해당 상품만 남긴 배열에서 뽑습니다(옛 버전은 Ctrl+Shift+Enter)."
      }
    ],
    "related": [
      "MAX",
      "MIN",
      "RANK.EQ",
      "SORT",
      "SEQUENCE"
    ],
    "tips": "- 배열이 비었거나 k가 0 이하·데이터 개수 초과면 #NUM! 오류\n- 행 전체가 필요하면 SORT/SORTBY(2021·365) 고려"
  },
  {
    "id": "median",
    "name": "MEDIAN",
    "category": "stat",
    "version": "all",
    "weight": 4,
    "difficulty": 2,
    "syntax": "=MEDIAN(숫자1, [숫자2], ...)",
    "summary": "값들을 크기순으로 줄 세웠을 때 정확히 가운데에 오는 값(중앙값)을 구합니다.",
    "intro": "값들을 크기순으로 줄 세웠을 때 가운데 값(중앙값)을 구합니다.\n\n- 평균과 달리 극단값에 잘 흔들리지 않아 '전형적인 크기'를 보여 줌\n- 청구액·소득처럼 한쪽으로 치우친 데이터는 평균과 함께 확인\n- 개수가 짝수면 가운데 두 값의 평균",
    "params": [
      {
        "name": "숫자1",
        "required": true,
        "desc": "중앙값을 구할 첫 번째 숫자나 셀 범위. 범위를 지정하면 그 안의 숫자를 모두 사용합니다."
      },
      {
        "name": "숫자2, ...",
        "required": false,
        "desc": "이어서 계산에 넣을 추가 숫자나 범위(선택). 콤마로 최대 255개까지 나열할 수 있습니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "청구액 중앙값 구하기",
        "formula": "=MEDIAN(B2:B11)",
        "result": "청구액을 크기순으로 정렬했을 때 가운데 값",
        "explain": "극단값에 덜 흔들리는 '보통 청구액' 대표값을 구합니다."
      },
      {
        "level": "basic",
        "title": "극단값이 있어도 흔들리지 않음",
        "formula": "=MEDIAN(1, 2, 3, 4, 100)",
        "result": "3",
        "explain": "평균은 22지만 중앙값은 3 — 큰 값 하나에 영향을 덜 받습니다."
      },
      {
        "level": "advanced",
        "title": "특정 상품만 골라 중앙값",
        "formula": "=MEDIAN(FILTER(claim_amt, product=\"자동차\"))",
        "result": "자동차 계약 청구액의 중앙값 한 값",
        "explain": "MEDIANIF가 없어 FILTER(2021·365)로 자동차 계약만 뽑아 중앙값을 냅니다."
      },
      {
        "level": "advanced",
        "title": "평균−중앙값으로 분포 치우침 진단",
        "formula": "=AVERAGE(claim_amt)-MEDIAN(claim_amt)",
        "result": "양수면 큰 청구 소수가 평균을 끌어올린(오른쪽 꼬리) 분포",
        "explain": "평균−중앙값이 양수면 고액 청구가 평균을 끌어올린 오른쪽 치우침 분포입니다."
      },
      {
        "level": "advanced",
        "title": "값을 특정 범위로 가두기(클램프)",
        "formula": "=MEDIAN(0, A2, 100)",
        "result": "A2가 0보다 작으면 0, 100보다 크면 100, 그 사이면 그대로",
        "explain": "세 값의 중앙값으로 최소·최대 한도를 씌우는 클램프 기법입니다(IF 두 번보다 짧음)."
      }
    ],
    "tips": "- 짝수 개면 가운데 두 값의 평균\n- 글자·빈 칸은 무시\n- 평균과 함께 보면 분포 치우침 방향 파악 가능",
    "related": [
      "AVERAGE",
      "QUARTILE.INC",
      "PERCENTILE.INC",
      "MODE.SNGL"
    ]
  },
  {
    "id": "percentile-inc",
    "name": "PERCENTILE.INC",
    "category": "stat",
    "version": "all",
    "weight": 4,
    "difficulty": 2,
    "syntax": "=PERCENTILE.INC(배열, 비율)",
    "summary": "데이터에서 원하는 백분위(0~1) 위치의 값을 구한다(양 끝 포함 방식).",
    "intro": "데이터를 크기순으로 줄 세워 원하는 백분위(0~1) 지점의 값을 구합니다.\n\n- 0.9=하위 90% 지점(상위 10% 경계), 0.5=중앙값 — 위치에 값이 없으면 보간\n- .INC는 0과 1(0~100%)을 포함하는 전통 방식\n- 청구액 상위 1%(VaR 개념)·응답시간 95퍼센타일 등 경계선 잡기에 사용",
    "params": [
      {
        "name": "배열",
        "required": true,
        "desc": "백분위수를 구할 숫자 셀 범위 또는 배열입니다. 문자열·빈 칸은 무시됩니다."
      },
      {
        "name": "비율",
        "required": true,
        "desc": "0~1 사이의 소수로 위치를 지정합니다. 0.9는 하위 90% 지점(상위 10% 경계), 0.5는 중앙값."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "상위 10% 경계 (90퍼센타일)",
        "formula": "=PERCENTILE.INC(B2:B21, 0.9)",
        "result": "하위 90% 지점 = 상위 10% 경계 청구액",
        "explain": "0.9는 상위 10%가 시작되는 청구액 기준선입니다."
      },
      {
        "level": "basic",
        "title": "중앙값(50퍼센타일)",
        "formula": "=PERCENTILE.INC(B2:B21, 0.5)",
        "result": "한가운데 값 (MEDIAN과 동일)",
        "explain": "0.5는 중앙값으로 =MEDIAN(B2:B21)과 같습니다."
      },
      {
        "level": "advanced",
        "title": "청구액 상위 1% (VaR 개념)",
        "formula": "=PERCENTILE.INC(claim_amt, 0.99)",
        "result": "하위 99% 지점 = 상위 1% 손해 경계",
        "explain": "0.99로 '100건 중 1건'인 대형 손해 경계(VaR 개념)를 봅니다."
      },
      {
        "level": "advanced",
        "title": "여러 백분위수 한 번에 (스필)",
        "formula": "=PERCENTILE.INC(B2:B21, {0.1;0.25;0.5;0.75;0.9})",
        "result": "10·25·50·75·90퍼센타일 5개가 세로로 펼쳐짐(스필)",
        "explain": "배열 상수로 여러 비율을 넣으면 백분위수들이 스필(2021 이상)되어 분포 요약표가 됩니다."
      },
      {
        "level": "advanced",
        "title": "특정 상품 95퍼센타일 (FILTER 결합)",
        "formula": "=PERCENTILE.INC(FILTER(claim_amt, product=\"실손\"), 0.95)",
        "result": "실손 상품 청구액의 95퍼센타일",
        "explain": "FILTER(2021 이상)로 실손 청구액만 골라 상위 5% 경계를 구합니다."
      }
    ],
    "related": [
      "PERCENTILE.EXC",
      "QUARTILE.INC",
      "PERCENTRANK.INC",
      "MEDIAN"
    ],
    "tips": "- 비율은 0~1 소수(90%=0.9), 벗어나면 #NUM! 오류\n- '상위 10%'는 0.9(하위 90% 경계)를 입력\n- 0·1을 제외하는 방식이 필요하면 PERCENTILE.EXC(결과가 다름)"
  },
  {
    "id": "quartile-inc",
    "name": "QUARTILE.INC · QUARTILE.EXC",
    "category": "stat",
    "version": "all",
    "weight": 4,
    "difficulty": 3,
    "syntax": "=QUARTILE.INC(배열, 사분위수)\n=QUARTILE.EXC(배열, 사분위수)",
    "summary": "데이터를 크기순으로 4등분하는 위치의 값(사분위수)을 구한다 — INC는 양 끝(0·100%)을 포함, EXC는 제외해 계산 방식이 다르다.",
    "intro": "데이터를 4등분하는 위치의 값(사분위수)을 구합니다 — INC는 양 끝 포함, EXC는 제외.\n\n- INC: 인수 0~4(0=최솟값, 1=25%, 2=중앙값, 3=75%, 4=최댓값)\n- EXC: 인수 1~3만 가능, (n+1) 기준이라 INC보다 바깥쪽 값이 나오는 경향\n- INC는 상자수염그림·IQR에, EXC는 보수적 추정에 — 한 보고서에서는 한 방식으로 통일",
    "params": [
      {
        "name": "배열",
        "required": true,
        "desc": "사분위수를 구할 숫자 셀 범위 또는 배열입니다. 안에 있는 문자열·빈 칸은 무시됩니다. (INC·EXC 공통)"
      },
      {
        "name": "사분위수",
        "required": true,
        "desc": "INC는 0~4(0=최솟값, 1=25%, 2=중앙값, 3=75%, 4=최댓값), EXC는 1~3만 가능(0·4는 오류)."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "1사분위수(하위 25%) 구하기 — INC",
        "formula": "=QUARTILE.INC(B2:B21, 1)",
        "result": "아래에서 25% 지점의 청구액",
        "explain": "인수 1로 아래에서 25% 지점(1사분위) 값을 구합니다."
      },
      {
        "level": "basic",
        "title": "중앙값(50%) 구하기 — INC",
        "formula": "=QUARTILE.INC(B2:B21, 2)",
        "result": "한가운데 값 (MEDIAN과 동일)",
        "explain": "인수 2는 중앙값으로 =MEDIAN(B2:B21)과 같습니다."
      },
      {
        "level": "basic",
        "title": "1사분위수(25%) — EXC(제외) 방식",
        "formula": "=QUARTILE.EXC(B2:B21, 1)",
        "result": "EXC 방식의 하위 25% 값 (INC보다 조금 바깥쪽으로 나오는 편)",
        "explain": "(n+1) 기준 EXC 방식이라 같은 데이터라도 INC보다 극단적인 값이 나오는 경향입니다."
      },
      {
        "level": "advanced",
        "title": "IQR(사분위 범위)로 흩어짐 재기 — INC",
        "formula": "=QUARTILE.INC(B2:B21, 3) - QUARTILE.INC(B2:B21, 1)",
        "result": "3사분위 − 1사분위 = 가운데 50%가 퍼진 폭",
        "explain": "3사분위−1사분위=IQR로, 극단값에 강한 흩어짐 지표입니다."
      },
      {
        "level": "advanced",
        "title": "이상치(튀는 값) 상한 경계 만들기 — INC",
        "formula": "=QUARTILE.INC(B2:B21, 3) + 1.5*(QUARTILE.INC(B2:B21, 3) - QUARTILE.INC(B2:B21, 1))",
        "result": "이 값보다 큰 청구액은 이상치 후보",
        "explain": "'3사분위+1.5×IQR' 규칙으로 이상치 상한 경계선을 만듭니다."
      },
      {
        "level": "advanced",
        "title": "INC와 EXC 결과 차이 확인",
        "formula": "=QUARTILE.EXC(B2:B21, 1) - QUARTILE.INC(B2:B21, 1)",
        "result": "두 방식의 1사분위 차이 (보통 0이 아님)",
        "explain": "INC·EXC의 계산 차이를 직접 확인해 보고서에 쓸 방식을 판단합니다."
      },
      {
        "level": "advanced",
        "title": "EXC에 0을 넣으면 오류 → 안전하게 처리",
        "formula": "=IFERROR(QUARTILE.EXC(B2:B21, 0), \"EXC는 0·4를 못 씀\")",
        "result": "#NUM! 오류 대신 안내 문구 표시",
        "explain": "EXC가 지원하지 않는 인수 0·4의 #NUM! 오류를 IFERROR로 안내 문구로 바꿉니다."
      },
      {
        "level": "advanced",
        "title": "다섯 사분위수 한 번에 (스필) — INC",
        "formula": "=QUARTILE.INC(B2:B21, SEQUENCE(5, 1, 0, 1))",
        "result": "세로 5칸에 최솟값·25%·50%·75%·최댓값이 자동으로 채워짐(스필)",
        "explain": "SEQUENCE로 0~4를 넣어 다섯 사분위수를 한 수식으로 스필(2021 이상)합니다."
      }
    ],
    "tips": "- '아래에서(작은 값부터) 몇 %' 기준 — 상위 25% 합격선은 인수 3(하위 75% 경계)\n- 범위 밖 인수(INC 0~4 밖, EXC 0·4)나 데이터 부족 시 #NUM! 오류\n- INC와 EXC는 결과가 달라 한 보고서 안에서 섞지 말 것",
    "related": [
      "PERCENTILE.INC",
      "PERCENTILE.EXC",
      "MEDIAN",
      "MIN",
      "MAX"
    ]
  },
  {
    "id": "stdev",
    "name": "STDEV.S · STDEV.P",
    "category": "stat",
    "version": "all",
    "weight": 4,
    "difficulty": 3,
    "syntax": "=STDEV.S(숫자1, [숫자2], ...)  ·  =STDEV.P(숫자1, [숫자2], ...)",
    "summary": "값들이 평균에서 얼마나 흩어져 있는지(표준편차)를 구합니다. .S=표본(n−1), .P=모집단(n).",
    "intro": "값들이 평균에서 얼마나 흩어져 있는지(표준편차)를 구합니다.\n\n- .S=표본용(n−1로 나눔, 베셀 보정), .P=전수 데이터용(n으로 나눔)\n- 실무 데이터는 대부분 표본이라 STDEV.S가 기본 선택\n- 보험에서는 청구액 변동성(위험 크기)의 기본 지표",
    "params": [
      {
        "name": "숫자1",
        "required": true,
        "desc": "표준편차를 구할 첫 번째 숫자나 셀 범위. 범위를 지정하면 그 안의 숫자를 모두 사용합니다."
      },
      {
        "name": "숫자2, ...",
        "required": false,
        "desc": "이어서 계산에 넣을 추가 숫자나 범위(선택). 콤마로 최대 255개까지 나열할 수 있습니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "청구액의 흩어짐(표본)",
        "formula": "=STDEV.S(B2:B11)",
        "result": "청구액의 표본 표준편차 한 값(클수록 들쭉날쭉)",
        "explain": "표본 데이터의 기본형으로, 값이 클수록 청구액이 들쭉날쭉합니다."
      },
      {
        "level": "basic",
        "title": "같은 데이터의 모집단 표준편차",
        "formula": "=STDEV.P(B2:B11)",
        "result": "같은 데이터를 '전체'로 볼 때의 표준편차(STDEV.S보다 조금 작음)",
        "explain": "전수 데이터일 때 쓰며 n으로 나눠 .S보다 약간 작습니다."
      },
      {
        "level": "advanced",
        "title": "변동계수(CV)로 상품 간 변동성 비교",
        "formula": "=STDEV.S(claim_amt)/AVERAGE(claim_amt)",
        "result": "표준편차를 평균으로 나눈 상대 변동성(단위 없는 비율)",
        "explain": "표준편차를 평균으로 나눠 규모가 다른 상품 간 변동성을 공정하게 비교합니다."
      },
      {
        "level": "advanced",
        "title": "특정 상품만 표준편차",
        "formula": "=STDEV.S(FILTER(claim_amt, product=\"자동차\"))",
        "result": "자동차 계약 청구액의 표본 표준편차",
        "explain": "STDEVIF가 없어 FILTER(2021·365)로 자동차 계약만 뽑아 계산합니다."
      },
      {
        "level": "advanced",
        "title": "이상치 상한 경계(평균+2σ)",
        "formula": "=AVERAGE(claim_amt)+2*STDEV.S(claim_amt)",
        "result": "이 값을 넘는 청구는 '이례적으로 큼'으로 볼 수 있는 경계선",
        "explain": "정규분포 가정 시 평균±2σ 안에 약 95%가 들어와, 이를 넘는 청구를 이상치 후보로 봅니다."
      }
    ],
    "tips": "- .S는 n−1(표본), .P는 n(모집단) — 실무 기본은 STDEV.S\n- 범위 안 글자·빈 칸·논리값 무시(직접 넣은 TRUE/FALSE는 1/0)\n- 옛 STDEV=STDEV.S, STDEVP=STDEV.P. 분산은 VAR.S·VAR.P",
    "related": [
      "STDEVA",
      "VAR.S",
      "VAR.P",
      "AVERAGE",
      "STDEV"
    ]
  },
  {
    "id": "sumproduct",
    "name": "SUMPRODUCT",
    "category": "stat",
    "version": "all",
    "weight": 4,
    "difficulty": 4,
    "syntax": "=SUMPRODUCT(배열1, [배열2], ...)",
    "summary": "여러 배열의 같은 위치 값을 곱한 뒤 그 결과를 모두 더한다.",
    "intro": "여러 배열의 같은 위치 값을 곱한 뒤 모두 더합니다.\n\n- 건수×단가 총액을 중간 계산 열 없이 한 줄로 계산\n- 조건식(TRUE/FALSE→1/0)을 곱하면 다중조건 집계 — SUMIFS가 어려운 복잡 조건에 사용\n- 가중평균(값×가중치 합÷가중치 합) 계산의 표준 도구",
    "params": [
      {
        "name": "배열1",
        "required": true,
        "desc": "곱해서 더할 첫 번째 배열(셀 범위 또는 조건식). 곱하기의 기준이 된다."
      },
      {
        "name": "배열2 ...",
        "required": false,
        "desc": "같은 위치끼리 곱할 배열. 모든 배열은 행·열 크기가 같아야 한다. 하나만 넣으면 단순 합계(SUM)와 같다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "건수 × 단가 = 총액",
        "formula": "=SUMPRODUCT(C2:C6, D2:D6)",
        "result": "각 행의 가입 건수 × 보험료를 곱해 모두 더한 총 보험료",
        "explain": "같은 줄끼리 곱해 더하므로 계산 열 없이 총액이 한 번에 나옵니다."
      },
      {
        "level": "basic",
        "title": "배열이 하나면 SUM과 같다",
        "formula": "=SUMPRODUCT(B2:B6)",
        "result": "B2:B6의 단순 합계",
        "explain": "배열이 하나면 곱할 상대가 없어 SUM과 같아집니다."
      },
      {
        "level": "advanced",
        "title": "가중평균(건수로 가중한 평균 보험료)",
        "formula": "=SUMPRODUCT(C2:C6, D2:D6)/SUM(C2:C6)",
        "result": "가입 건수를 가중치로 반영한 평균 보험료",
        "explain": "값×가중치 합을 가중치 합으로 나눠 건수가 많은 상품에 무게를 준 가중평균입니다."
      },
      {
        "level": "advanced",
        "title": "여러 조건 개수 세기",
        "formula": "=SUMPRODUCT((B2:B100=\"암보험\")*(C2:C100=\"서울\"))",
        "result": "상품이 암보험이면서 지역이 서울인 행의 개수",
        "explain": "조건식(TRUE/FALSE)을 곱해 1/0으로 바꾸면 두 조건 모두 참인 행 수가 합계로 나옵니다."
      },
      {
        "level": "advanced",
        "title": "여러 조건 합계(SUMIFS 없이)",
        "formula": "=SUMPRODUCT((B2:B100=\"암보험\")*(C2:C100=\"서울\")*D2:D100)",
        "result": "암보험이면서 서울인 행의 청구액(D열)만 골라 더한 합계",
        "explain": "조건(1/0)에 청구액을 곱해 조건을 만족하는 행만 합산합니다."
      }
    ],
    "tips": "- 모든 배열은 행·열 크기가 같아야 함(다르면 #VALUE! 오류)\n- 텍스트·빈 칸은 곱셈에서 0 취급 — 조건은 * 또는 --로 1/0 숫자화",
    "related": [
      "SUM",
      "SUMIFS",
      "COUNTIFS",
      "SUMIF"
    ]
  },
  {
    "id": "frequency",
    "name": "FREQUENCY",
    "category": "stat",
    "version": "all",
    "weight": 3,
    "difficulty": 3,
    "syntax": "=FREQUENCY(데이터배열, 구간배열)  →  배열(스필)로 반환",
    "summary": "숫자를 구간(계급)별로 몇 개씩인지 세어 도수분포표를 만드는 배열 함수",
    "intro": "숫자를 구간(계급)별로 몇 개씩인지 세어 도수분포표를 만드는 배열 함수입니다.\n\n- 구간 '상한값'(예: 19·29·39·49)을 세로로 적으면 그 이하 기준으로 나눠 셈\n- 결과 칸은 구간 개수+1(마지막=최대 상한 초과분)\n- 365·2021은 자동 스필, 2019 이하는 범위 선택 후 Ctrl+Shift+Enter",
    "params": [
      {
        "name": "데이터배열",
        "required": true,
        "desc": "개수를 세고 싶은 원본 숫자들의 범위(예: 가입자 나이 목록, 청구액 목록). 글자·빈 칸은 무시됩니다."
      },
      {
        "name": "구간배열",
        "required": true,
        "desc": "각 구간의 '상한값'을 담은 범위 또는 배열 상수. 오름차순으로 적으며, 각 구간은 그 상한값을 '포함'(이하)해서 셉니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "나이대별 인원 세기 (365 스필)",
        "formula": "=FREQUENCY(B2:B101, D2:D5)",
        "result": "5칸으로 스필된 배열, 예: {12; 34; 28; 19; 7}",
        "explain": "상한 4개 기준 구간별 인원을 세어 5칸(마지막=49 초과)으로 자동 스필됩니다."
      },
      {
        "level": "basic",
        "title": "옛 버전 배열 수식으로 확정",
        "formula": "{=FREQUENCY(B2:B11, D2:D5)}",
        "result": "미리 선택해 둔 F2:F6에 구간별 개수가 한 번에 입력됨",
        "explain": "2019 이하는 결과 칸을 먼저 선택하고 Ctrl+Shift+Enter로 확정합니다(중괄호는 자동)."
      },
      {
        "level": "advanced",
        "title": "청구액 구간별 건수 (배열 상수로 상한 지정)",
        "formula": "=FREQUENCY(C2:C500, {1000000;5000000;10000000})",
        "result": "4칸 배열: 100만↓ / 100만~500만 / 500만~1000만 / 1000만↑ 건수",
        "explain": "구간 상한을 배열 상수({ })로 직접 적어 청구액 분포를 봅니다."
      },
      {
        "level": "advanced",
        "title": "구간별 개수를 비율(%)로 환산",
        "formula": "=FREQUENCY(B2:B101, D2:D5) / COUNT(B2:B101)",
        "result": "각 구간의 비율 배열, 예: {0.12; 0.34; 0.28; 0.19; 0.07}",
        "explain": "구간별 개수를 전체로 나눠 비율 배열을 한 번에 만듭니다."
      },
      {
        "level": "advanced",
        "title": "고유값 개수 세기 (MATCH 결합 관용식)",
        "formula": "=SUM(IF(FREQUENCY(MATCH(B2:B101,B2:B101,0),ROW(B2:B101)-ROW(B2)+1)>0,1))",
        "result": "B열의 서로 다른 값(고유값) 개수",
        "explain": "각 값의 첫 등장 위치만 세는 고유값 개수 관용식입니다(365는 COUNTA(UNIQUE)가 간단)."
      }
    ],
    "related": [
      "COUNTIF",
      "COUNTIFS",
      "MATCH",
      "UNIQUE",
      "SUMPRODUCT"
    ],
    "tips": "- 결과 칸은 구간 개수+1(마지막=상한 최댓값 초과분)\n- 상한값은 오름차순, 각 구간은 상한값 '포함'(이하)으로 셈\n- 스필 결과는 일부만 수정 불가 — 배열 전체를 함께 다룸"
  },
  {
    "id": "randarray",
    "name": "RANDARRAY",
    "category": "stat",
    "version": "2021",
    "weight": 3,
    "difficulty": 3,
    "syntax": "=RANDARRAY([행수], [열수], [최솟값], [최댓값], [정수여부])",
    "summary": "원하는 크기(행×열)의 난수 배열을 한 번에 스필로 만드는 함수. 범위와 정수/소수까지 지정할 수 있어 시뮬레이션·랜덤 표본 추출에 쓴다.",
    "intro": "원하는 크기(행×열)의 난수 배열을 한 번에 스필로 만듭니다(2021·365).\n\n- 인수 전부 생략 가능 — =RANDARRAY()는 0~1 소수 1개, 크기·범위·정수여부 지정 가능\n- 휘발성 함수: 재계산마다 새 난수 → 고정하려면 복사 후 '값 붙여넣기'\n- 몬테카를로 시뮬레이션·무작위 표본 추출에 활용",
    "params": [
      {
        "name": "행수",
        "required": false,
        "desc": "만들 난수 배열의 행(세로) 개수. 생략하면 1. 예: 1000이면 1000행짜리 시뮬레이션."
      },
      {
        "name": "열수",
        "required": false,
        "desc": "만들 난수 배열의 열(가로) 개수. 생략하면 1."
      },
      {
        "name": "최솟값",
        "required": false,
        "desc": "난수가 가질 수 있는 가장 작은 값. 생략하면 0."
      },
      {
        "name": "최댓값",
        "required": false,
        "desc": "난수가 가질 수 있는 가장 큰 값. 생략하면 1. (최솟값보다 커야 함)"
      },
      {
        "name": "정수여부",
        "required": false,
        "desc": "TRUE면 정수만, FALSE(또는 생략)면 소수까지 포함한 난수를 만든다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "가장 단순하게 난수 1개",
        "formula": "=RANDARRAY()",
        "result": "0 이상 1 미만의 소수 1개 (예: 0.4820913)",
        "explain": "인수 없이 쓰면 RAND()처럼 0~1 소수 하나가 나옵니다(F9마다 갱신)."
      },
      {
        "level": "basic",
        "title": "5행 2열, 1~100 정수 표 만들기",
        "formula": "=RANDARRAY(5, 2, 1, 100, TRUE)",
        "result": "1~100 사이 정수가 채워진 5행×2열 배열이 스필로 펼쳐짐",
        "explain": "한 셀 입력으로 5×2 정수 난수 표가 자동 스필됩니다(FALSE면 소수)."
      },
      {
        "level": "advanced",
        "title": "복원추출로 청구액 부트스트랩 표본 뽑기",
        "formula": "=INDEX(청구액, RANDARRAY(1000, 1, 1, ROWS(청구액), TRUE))",
        "result": "실제 청구액 목록에서 무작위로 1000건을 뽑은 1열 배열 (같은 값 중복 허용)",
        "explain": "무작위 위치 1000개를 INDEX에 넘겨 복원추출(부트스트랩) 표본을 만듭니다."
      },
      {
        "level": "advanced",
        "title": "계약 목록을 무작위로 섞어 표본 감사 대상 뽑기",
        "formula": "=TAKE(SORTBY(policy, RANDARRAY(ROWS(policy))), 30)",
        "result": "전체 계약을 랜덤 순서로 섞은 뒤 위에서 30건만 잘라낸 배열 (비복원 무작위 추출)",
        "explain": "난수로 목록을 섞은 뒤 TAKE(M365)로 30건을 잘라 비복원 무작위 표본을 만듭니다."
      },
      {
        "level": "advanced",
        "title": "몬테카를로 — 균등분포 손해액 1만 건 평균",
        "formula": "=AVERAGE(RANDARRAY(10000, 1, 100, 5000))",
        "result": "100~5000 사이 균등 난수 1만 개의 평균 (약 2550 부근에서 재계산마다 변동)",
        "explain": "균등분포 손해액 1만 건을 흉내 내 평균을 구하며, F9마다 흔들리는 폭이 추정 불확실성입니다."
      }
    ],
    "related": [
      "RAND",
      "RANDBETWEEN",
      "SEQUENCE",
      "SORTBY",
      "INDEX",
      "TAKE"
    ],
    "tips": "- 최댓값<최솟값이면 #VALUE!, 스필 자리에 값이 있으면 #SPILL! 오류\n- 정수여부 TRUE면 최솟값·최댓값도 정수로 취급\n- RANDBETWEEN은 정수 1개, RANDARRAY는 소수/정수 배열을 한 번에"
  },
  {
    "id": "rank-eq",
    "name": "RANK.EQ",
    "category": "stat",
    "version": "all",
    "weight": 3,
    "difficulty": 2,
    "syntax": "=RANK.EQ(순위구할값, 참조범위, [정렬방식])",
    "summary": "숫자 목록에서 특정 값이 몇 등인지 순위를 매긴다(같은 값은 같은 등수).",
    "intro": "숫자가 목록에서 몇 등인지 순위를 매깁니다(.EQ=동점은 같은 등수).\n\n- 기본은 큰 값이 1등(내림차순) — 실적·보험료 순위에 바로 사용\n- 동점은 같은 등수, 다음 등수는 건너뜀(2등 둘이면 다음은 4등)\n- 작은 값이 1등이 필요하면 세 번째 인수에 1(손해율 등)",
    "params": [
      {
        "name": "순위구할값",
        "required": true,
        "desc": "순위를 알고 싶은 하나의 숫자(보통 셀 참조)."
      },
      {
        "name": "참조범위",
        "required": true,
        "desc": "비교 대상이 되는 숫자 목록. 문자·빈칸은 무시됩니다. 채우기 복사 시 $로 고정하세요."
      },
      {
        "name": "정렬방식",
        "required": false,
        "desc": "0 또는 생략=내림차순(큰 값이 1등), 0이 아닌 값(예: 1)=오름차순(작은 값이 1등)."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "보험료 실적 순위 매기기",
        "formula": "=RANK.EQ(B2, $B$2:$B$11)",
        "result": "예: 3 (3등)",
        "explain": "실적 중 B2의 등수를 구하며, 아래로 복사할 수 있게 범위를 $로 고정했습니다."
      },
      {
        "level": "basic",
        "title": "작은 값이 1등인 순위(손해율 낮은 순)",
        "formula": "=RANK.EQ(B2, $B$2:$B$11, 1)",
        "result": "예: 2 (두 번째로 낮음)",
        "explain": "세 번째 인수 1로 오름차순이 되어 손해율처럼 낮을수록 좋은 지표에 씁니다."
      },
      {
        "level": "advanced",
        "title": "동점 없이 유일한 순위 만들기",
        "formula": "=RANK.EQ(B2, $B$2:$B$11) + COUNTIF($B$2:B2, B2) - 1",
        "result": "동점이어도 1,2,3…처럼 서로 다른 순위",
        "explain": "위쪽 동일값 등장 횟수(COUNTIF)를 더해 동점 없이 유일한 순위를 만듭니다."
      },
      {
        "level": "advanced",
        "title": "상품별(그룹 안) 순위 매기기",
        "formula": "=SUMPRODUCT(($D$2:$D$101=D2)*($C$2:$C$101>C2)) + 1",
        "result": "같은 상품군 안에서의 등수",
        "explain": "같은 상품에서 나보다 큰 건수+1로 그룹 내 순위를 직접 만듭니다(RANK.EQ엔 조건 옵션 없음)."
      },
      {
        "level": "advanced",
        "title": "순위로 1등 이름 자동 찾기",
        "formula": "=INDEX($A$2:$A$11, MATCH(1, RANK.EQ($B$2:$B$11, $B$2:$B$11), 0))",
        "result": "실적 1등의 이름",
        "explain": "순위 배열에서 1의 위치를 MATCH로 찾아 INDEX로 1등 이름을 자동 표시합니다."
      }
    ],
    "related": [
      "RANK.AVG",
      "LARGE",
      "COUNTIF",
      "SUMPRODUCT"
    ],
    "tips": "- 동점을 평균 순위로 주려면 RANK.AVG(2등 둘이면 2.5등)\n- 참조범위에 순위구할값이 없으면 #N/A\n- 기본은 큰 값이 1등(내림차순)임을 항상 확인"
  },
  {
    "id": "var-s",
    "name": "VAR.S",
    "category": "stat",
    "version": "all",
    "weight": 3,
    "difficulty": 2,
    "syntax": "=VAR.S(숫자1, [숫자2], ...)",
    "summary": "표본 데이터를 기준으로 모집단의 분산을 추정한다(편차 제곱합을 n−1로 나눔).",
    "intro": "표본 데이터로 모집단의 흩어짐(분산)을 추정합니다 — 편차 제곱합을 n−1로 나눕니다.\n\n- .S=표본용(n−1), 전수 데이터는 VAR.P(n으로 나눔)\n- 제곱근을 씌우면 표준편차(STDEV.S)\n- 예: 전체 계약 중 표본 500건의 청구액 변동성 추정",
    "params": [
      {
        "name": "숫자1",
        "required": true,
        "desc": "표본분산을 구할 첫 번째 숫자·셀 범위·배열입니다. 전체가 아닌 표본 데이터를 넣습니다."
      },
      {
        "name": "숫자2",
        "required": false,
        "desc": "이어서 계산에 넣을 숫자나 셀 범위입니다. 최대 255개까지 추가할 수 있습니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "청구액 표본의 분산 구하기",
        "formula": "=VAR.S(B2:B21)",
        "result": "표본분산 값 하나 (예: 152000)",
        "explain": "전체 계약 중 뽑은 표본이므로 .S로 청구액의 흩어짐(분산)을 구합니다."
      },
      {
        "level": "basic",
        "title": "숫자를 직접 넣어 분산 구하기",
        "formula": "=VAR.S(12, 15, 9, 14, 11)",
        "result": "5개 값의 표본분산 (약 5.3)",
        "explain": "숫자를 직접 나열해도 되며 흩어짐이 클수록 값이 커집니다."
      },
      {
        "level": "advanced",
        "title": "표준편차와의 관계 확인(제곱근)",
        "formula": "=SQRT(VAR.S(B2:B21))",
        "result": "STDEV.S(B2:B21)와 동일한 표준편차 값",
        "explain": "분산에 제곱근(SQRT)을 씌우면 표준편차(STDEV.S)와 같아집니다."
      },
      {
        "level": "advanced",
        "title": "변동계수(CV)로 상품 간 위험 비교",
        "formula": "=SQRT(VAR.S(B2:B21))/AVERAGE(B2:B21)",
        "result": "표준편차 ÷ 평균 (예: 0.34)",
        "explain": "표준편차÷평균=변동계수로 규모가 다른 상품 간 변동성을 공정하게 비교합니다."
      },
      {
        "level": "advanced",
        "title": "특정 상품만 골라 분산 (FILTER 결합)",
        "formula": "=VAR.S(FILTER(claim_amt, product=\"암보험\"))",
        "result": "암보험 청구액만의 표본분산",
        "explain": "FILTER(2021·365)로 암보험 청구액만 뽑아 표본분산을 구합니다."
      }
    ],
    "related": [
      "VAR.P",
      "STDEV.S",
      "STDEV.P",
      "VARA"
    ],
    "tips": "- 전수 데이터면 VAR.P, 표본이면 VAR.S — 혼동 주의\n- 데이터 1개면 n−1=0이라 #DIV/0! 오류\n- 범위 안 문자·빈 칸·논리값 무시(직접 넣은 TRUE/FALSE는 1/0)"
  },
  {
    "id": "kurt",
    "name": "KURT",
    "category": "stat",
    "version": "all",
    "weight": 2,
    "difficulty": 3,
    "syntax": "=KURT(숫자1, [숫자2], ...)",
    "summary": "데이터 분포의 첨도(뾰족한 정도·꼬리 두께)를 구한다.",
    "intro": "분포가 얼마나 뾰족하고 꼬리(극단값)가 두꺼운지(첨도)를 구합니다.\n\n- 정규분포=0 기준: 양수=뾰족·두꺼운 꼬리(극단값 잦음), 음수=완만\n- 가끔 대형 청구가 튀는 손해액의 위험 성격 파악에 유용\n- 값이 최소 4개 필요",
    "params": [
      {
        "name": "숫자1",
        "required": true,
        "desc": "첨도를 구할 첫 번째 값 또는 셀 범위. 보통 여기에 분석할 데이터 범위를 넣는다."
      },
      {
        "name": "숫자2 ...",
        "required": false,
        "desc": "추가 값이나 범위. 전체 유효 숫자가 4개 미만이면 #DIV/0! 오류가 난다. 범위 안 문자·빈 칸은 무시된다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "청구액 분포의 첨도",
        "formula": "=KURT(B2:B101)",
        "result": "청구액 100건의 초과첨도(예: 1.85). 0보다 크면 정규분포보다 뾰족하고 꼬리가 두껍다",
        "explain": "평균 쏠림·극단값 많음 정도를 숫자 하나로 요약합니다(값 4개 이상 필요)."
      },
      {
        "level": "basic",
        "title": "숫자를 직접 넣기",
        "formula": "=KURT(3, 4, 4, 5, 5, 5, 6, 6, 7)",
        "result": "입력한 값들의 첨도",
        "explain": "숫자를 직접 나열해도 되며, 값이 4개 미만이면 #DIV/0! 오류가 납니다."
      },
      {
        "level": "advanced",
        "title": "정규분포와 비교해 해석하기",
        "formula": "=IF(KURT(B2:B101)>0, \"뾰족·두꺼운 꼬리(극단손해 주의)\", \"완만·얇은 꼬리\")",
        "result": "첨도 부호로 분포 모양을 문구로 판정",
        "explain": "정규분포=0 기준으로 양수=한번 터지면 크게 튀는 위험, 음수=고르게 퍼진 분포입니다."
      },
      {
        "level": "advanced",
        "title": "왜도와 함께 분포 진단",
        "formula": "=KURT(B2:B101)&\" / \"&SKEW(B2:B101)",
        "result": "첨도와 왜도를 함께 표시(예: 1.85 / 1.20)",
        "explain": "꼬리 두께(KURT)와 치우침(SKEW)을 함께 보아 손해액 분포가 정규분포에서 벗어난 정도·방향을 진단합니다."
      },
      {
        "level": "advanced",
        "title": "데이터 부족 오류 방지",
        "formula": "=IFERROR(KURT(B2:B5), \"값 4개 이상 필요\")",
        "result": "유효 값이 4개 미만이면 #DIV/0! 대신 안내 문구",
        "explain": "값 4개 미만일 때의 #DIV/0! 오류를 IFERROR로 안내 문구로 바꿉니다."
      }
    ],
    "tips": "- 반환값은 정규분포=0인 '초과첨도'(원래 첨도에서 3을 뺀 값)\n- 유효 값 4개 미만이거나 표준편차 0이면 #DIV/0! 오류",
    "related": [
      "SKEW",
      "STDEV.S",
      "AVERAGE",
      "VAR.S"
    ]
  },
  {
    "id": "modesngl",
    "name": "MODE.SNGL",
    "category": "stat",
    "version": "all",
    "weight": 2,
    "difficulty": 2,
    "syntax": "=MODE.SNGL(숫자1, [숫자2], ...)",
    "summary": "가장 자주 나오는 값(최빈값)을 구합니다. 여러 개면 처음 나온 것 하나만 반환.",
    "intro": "가장 자주 등장하는 값(최빈값)을 찾습니다 — 평균·중앙값과 함께 대표값 3형제.\n\n- 나이·상품코드·청구 건수처럼 같은 값이 반복되는 데이터에 유용\n- 반복되는 값이 없으면 #N/A, 동점 최빈값은 처음 것 하나만(.SNGL=single)\n- 동점을 전부 보려면 MODE.MULT",
    "params": [
      {
        "name": "숫자1",
        "required": true,
        "desc": "최빈값을 구할 첫 번째 숫자나 셀 범위. 범위 안의 숫자를 모두 살펴 가장 자주 나온 값을 찾습니다."
      },
      {
        "name": "숫자2, ...",
        "required": false,
        "desc": "이어서 함께 살펴볼 추가 숫자나 범위(선택). 콤마로 최대 255개까지 나열할 수 있습니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "가장 흔한 나이 찾기",
        "formula": "=MODE.SNGL(B2:B50)",
        "result": "B2:B50에서 가장 자주 나온 숫자 하나",
        "explain": "반복 등장이 가장 많은 값 하나로 계약자 연령대의 대표값을 봅니다."
      },
      {
        "level": "basic",
        "title": "최빈값 직접 확인",
        "formula": "=MODE.SNGL(3, 3, 4, 5, 5, 5, 6)",
        "result": "5",
        "explain": "5가 세 번으로 가장 많이 등장해 5를 돌려줍니다."
      },
      {
        "level": "advanced",
        "title": "가장 많이 팔린 상품명(텍스트) 찾기",
        "formula": "=INDEX(product, MODE.SNGL(MATCH(product, product, 0)))",
        "result": "product 열에서 가장 자주 등장하는 상품명 텍스트",
        "explain": "숫자만 다루므로 MATCH로 상품명을 위치 번호로 바꿔 최빈 위치를 구하고 INDEX로 이름을 꺼냅니다(옛 버전은 Ctrl+Shift+Enter)."
      },
      {
        "level": "advanced",
        "title": "연속값은 반올림 후, 중복 없으면 안내",
        "formula": "=IFERROR(MODE.SNGL(ROUND(premium, -3)), \"중복 없음\")",
        "result": "1,000원 단위로 묶은 보험료의 최빈 구간. 겹치는 값이 없으면 \"중복 없음\"",
        "explain": "제각각인 연속값은 ROUND(-3)로 1,000원 단위로 묶어 최빈값을 의미 있게 만들고 IFERROR로 #N/A에 대비합니다."
      },
      {
        "level": "advanced",
        "title": "최빈값이 여러 개일 때 전부 보기",
        "formula": "=MODE.MULT(B2:B50)",
        "result": "동점 최빈값이 여러 개면 그 값들이 세로로 스필",
        "explain": "동점 최빈값 전부는 MODE.MULT가 배열로 내놓습니다(2021·365 자동 스필)."
      }
    ],
    "tips": "- 숫자만 계산, 텍스트·빈 칸 무시\n- 겹치는 값이 없으면 #N/A — 연속값은 ROUND로 단위를 묶어 사용\n- 옛 MODE 함수=MODE.SNGL 동일",
    "related": [
      "MODE.MULT",
      "AVERAGE",
      "MEDIAN",
      "COUNTIF"
    ]
  },
  {
    "id": "percentrank-inc",
    "name": "PERCENTRANK.INC",
    "category": "stat",
    "version": "all",
    "weight": 2,
    "difficulty": 3,
    "syntax": "=PERCENTRANK.INC(배열, 값, [유효자릿수])",
    "summary": "어떤 값이 데이터 전체에서 하위 몇 % 위치에 있는지 0~1 사이 비율로 알려준다.",
    "intro": "어떤 값이 데이터 전체에서 하위 몇 % 위치인지 0~1 비율로 알려 줍니다.\n\n- 0.7=나보다 낮은 값이 약 70%(×100=백분위), 사이값은 자동 보간\n- .INC는 최솟값 0·최댓값 1로 양 끝 포함(EXC는 제외)\n- 예: 특정 청구 건이 전체 청구액 중 상위 몇 %인지 확인",
    "params": [
      {
        "name": "배열",
        "required": true,
        "desc": "순위를 매길 기준이 되는 숫자 데이터 범위(예: 전체 청구액 목록)."
      },
      {
        "name": "값",
        "required": true,
        "desc": "위치(백분율 순위)를 알고 싶은 하나의 값. 배열 안에 없어도 됩니다(사이값이면 보간)."
      },
      {
        "name": "유효자릿수",
        "required": false,
        "desc": "결과 비율을 몇 자리까지 표시할지. 생략하면 3자리(예: 0.333)."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "내 점수의 위치 알아보기",
        "formula": "=PERCENTRANK.INC(A2:A11, 80)",
        "result": "0.7 (하위 70% 지점)",
        "explain": "80점의 위치가 0.7이면 나보다 낮은 값이 약 70%라는 뜻입니다."
      },
      {
        "level": "basic",
        "title": "특정 청구 건의 백분위",
        "formula": "=PERCENTRANK.INC($C$2:$C$101, C5)",
        "result": "예: 0.812 (상위 약 19%)",
        "explain": "C5 청구 건의 백분위 0.812는 이보다 작은 청구가 약 81%인 큰 건이라는 뜻입니다."
      },
      {
        "level": "advanced",
        "title": "백분위를 소수 넷째 자리까지 + 퍼센트로 표시",
        "formula": "=TEXT(PERCENTRANK.INC($C$2:$C$1001, C2, 4), \"0.00%\")",
        "result": "예: \"81.25%\"",
        "explain": "유효자릿수 4로 촘촘히 계산한 비율을 TEXT로 보고서용 퍼센트 문자열로 바꿉니다."
      },
      {
        "level": "advanced",
        "title": "상위 10% 고액 청구 건 자동 표시",
        "formula": "=IF(PERCENTRANK.INC($C$2:$C$1001, C2) >= 0.9, \"상위10%\", \"\")",
        "result": "상위 10%면 \"상위10%\", 아니면 빈칸",
        "explain": "백분위 0.9 이상에 라벨을 붙여 필터로 고액 청구만 뽑는 도우미 열을 만듭니다."
      },
      {
        "level": "advanced",
        "title": "값이 범위 밖일 때 오류 방지",
        "formula": "=IFERROR(PERCENTRANK.INC($C$2:$C$101, D2), \"범위밖\")",
        "result": "정상 비율 또는 \"범위밖\"",
        "explain": "범위 밖 값의 #N/A 오류를 IFERROR로 문구로 바꿔 표 노출을 막습니다."
      }
    ],
    "related": [
      "PERCENTILE.INC",
      "RANK.EQ",
      "QUARTILE.INC"
    ],
    "tips": "- 찾는 값이 최솟값~최댓값 밖이면 #N/A\n- 양 끝점 제외 PERCENTRANK.EXC는 결과가 1/(n+1)~n/(n+1) 범위\n- 결과 0.7=백분위 70(×100)"
  },
  {
    "id": "skew",
    "name": "SKEW",
    "category": "stat",
    "version": "all",
    "weight": 2,
    "difficulty": 3,
    "syntax": "=SKEW(값1, [값2], …)",
    "summary": "데이터 분포가 한쪽으로 얼마나 치우쳤는지(왜도)를 숫자 하나로 나타낸다.",
    "intro": "분포가 한쪽으로 얼마나 치우쳤는지(왜도)를 숫자 하나로 나타냅니다.\n\n- 0 근처=대칭, 양수=오른쪽 꼬리(청구액처럼 가끔 큰 값), 음수=왼쪽 꼬리\n- 양의 왜도가 크면 소수의 고액 청구가 평균을 끌어올린다는 신호 — 요율·위험 분석 단서\n- 평균·중앙값만으로 놓치는 '분포 모양'을 보완",
    "params": [
      {
        "name": "값1",
        "required": true,
        "desc": "왜도를 계산할 첫 번째 숫자 또는 범위. 보통 데이터 범위 하나를 지정합니다."
      },
      {
        "name": "값2 …",
        "required": false,
        "desc": "추가로 포함할 숫자·범위(최대 255개까지). 떨어진 여러 범위를 함께 넣을 때 사용."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "청구액 분포의 치우침 보기",
        "formula": "=SKEW(C2:C101)",
        "result": "예: 2.34 (오른쪽 꼬리, 강한 치우침)",
        "explain": "양수가 클수록 소수의 고액 청구로 오른쪽 꼬리가 긴 분포입니다(0 근처=대칭)."
      },
      {
        "level": "basic",
        "title": "작은 데이터의 대칭 여부 확인",
        "formula": "=SKEW(B2:B11)",
        "result": "예: -0.12 (거의 대칭)",
        "explain": "0 근처면 좌우 균형 분포이며, 계산에는 데이터가 최소 3개 필요합니다."
      },
      {
        "level": "advanced",
        "title": "왜도를 말로 자동 해석하기",
        "formula": "=IF(SKEW(C2:C101)>0.5, \"오른쪽 꼬리(고액청구 존재)\", IF(SKEW(C2:C101)<-0.5, \"왼쪽 꼬리\", \"거의 대칭\"))",
        "result": "\"오른쪽 꼬리(고액청구 존재)\" 등 설명 문구",
        "explain": "왜도를 ±0.5 기준으로 나눠 대시보드용 해석 문구로 바꿉니다."
      },
      {
        "level": "advanced",
        "title": "평균·중앙값과 함께 분포 진단",
        "formula": "=IF(AND(SKEW(C2:C101)>1, AVERAGE(C2:C101)>MEDIAN(C2:C101)), \"평균이 고액에 끌려 과대\", \"대표값으로 평균 사용 가능\")",
        "result": "평균 신뢰 여부에 대한 판단 문구",
        "explain": "왜도>1이고 평균>중앙값이면 고액 청구가 평균을 부풀린 신호라 중앙값이 더 안전한 대표값입니다."
      },
      {
        "level": "advanced",
        "title": "상품 A와 B의 치우침 비교",
        "formula": "=SKEW(C2:C101) - SKEW(F2:F101)",
        "result": "두 상품 왜도의 차이(양수면 A가 더 오른쪽 치우침)",
        "explain": "두 상품의 왜도 차이로 어느 쪽이 더 극단적 고액 위험을 안는지 비교합니다."
      }
    ],
    "related": [
      "SKEW.P",
      "KURT",
      "AVERAGE",
      "MEDIAN",
      "STDEV.S"
    ],
    "tips": "- SKEW=표본 기준, 모집단 전체는 SKEW.P(엑셀 2013+)\n- 데이터 3개 미만이거나 표준편차 0(모든 값 동일)이면 #DIV/0! 오류\n- 텍스트·빈칸은 무시 — 0으로 칠 값이 빈칸이면 결과가 달라짐"
  },
  {
    "id": "trimmean",
    "name": "TRIMMEAN",
    "category": "stat",
    "version": "all",
    "weight": 2,
    "difficulty": 2,
    "syntax": "=TRIMMEAN(배열, 비율)",
    "summary": "상·하위 극단값을 일정 비율 잘라내고 남은 값의 평균을 구한다.",
    "intro": "양쪽 끝 극단값을 일정 비율 잘라내고 남은 값들로 평균(절사평균)을 냅니다.\n\n- 비율 0.2=위·아래 각 10% 제외 — 극단값에 휘둘리지 않는 평균\n- 심사위원 최고·최저 제외 채점, 대형 청구가 평균 손해액을 부풀릴 때 대표값으로 사용",
    "params": [
      {
        "name": "배열",
        "required": true,
        "desc": "평균을 구할 값들의 셀 범위 또는 배열."
      },
      {
        "name": "비율",
        "required": true,
        "desc": "잘라낼 비율(0 이상 1 미만). 0.2면 위·아래 각각 10%씩, 총 20%를 제외한다. 0이면 전체 평균과 같다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "상·하위 10%씩 잘라낸 평균",
        "formula": "=TRIMMEAN(B2:B21, 0.2)",
        "result": "20개 값 중 위·아래 각 10%(각 2개, 총 4개)를 뺀 나머지 16개의 평균",
        "explain": "비율 0.2로 위·아래 각 10%의 극단값을 빼고 평균을 냅니다."
      },
      {
        "level": "basic",
        "title": "5%씩만 살짝 잘라내기",
        "formula": "=TRIMMEAN(B2:B101, 0.1)",
        "result": "위·아래 각 5%를 제외한 나머지의 평균",
        "explain": "비율이 작을수록 조금만 잘라내며, 0이면 AVERAGE와 같습니다."
      },
      {
        "level": "advanced",
        "title": "일반 평균과 비교해 이상치 영향 보기",
        "formula": "=AVERAGE(B2:B21)-TRIMMEAN(B2:B21, 0.2)",
        "result": "두 평균의 차이. 클수록 극단값이 평균을 끌어올리거나 내린 정도가 크다",
        "explain": "두 평균의 차이가 크면 소수의 큰 청구액이 평균을 왜곡한다는 신호입니다."
      },
      {
        "level": "advanced",
        "title": "최고·최저 딱 1개씩만 제외",
        "formula": "=TRIMMEAN(B2:B21, 2/COUNT(B2:B21))",
        "result": "가장 큰 값과 가장 작은 값 1개씩만 빼고 낸 평균(심사 채점식)",
        "explain": "비율을 2÷개수로 주면 양끝 1개씩만 잘려 심사 채점식 평균이 됩니다."
      },
      {
        "level": "advanced",
        "title": "짝수 내림 규칙 이해하기",
        "formula": "=TRIMMEAN(B2:B22, 0.1)",
        "result": "21개 × 0.1 = 2.1 → 가장 가까운 짝수로 내림해 2개(위·아래 1개씩)만 제외",
        "explain": "제외 개수는 가장 가까운 짝수로 내림되어 비율로 단순 계산한 값과 조금 다를 수 있습니다."
      }
    ],
    "tips": "- 실제 제외 개수='COUNT×비율'을 가장 가까운 짝수로 내림해 위·아래 절반씩\n- 비율은 0 이상 1 미만 — 벗어나면 #NUM! 오류\n- MEDIAN보다 덜 둔감하지만 더 많은 데이터를 반영하는 절충점",
    "related": [
      "AVERAGE",
      "MEDIAN",
      "AVERAGEIF",
      "LARGE"
    ]
  },
  {
    "id": "index",
    "name": "INDEX",
    "category": "lookup",
    "version": "all",
    "weight": 5,
    "difficulty": 3,
    "syntax": "=INDEX(범위, 행번호, [열번호], [영역번호])",
    "summary": "범위에서 몇 번째 행·몇 번째 열에 있는 값을 콕 집어 꺼낸다.",
    "intro": "표에서 '몇 번째 행·몇 번째 열' 위치의 값을 콕 집어 꺼냅니다.\n\n- 좌석표처럼 행·열 번호만 주면 그 자리 값 반환\n- MATCH와 짝지으면 실무 표준 조회 — 찾는 열이 왼쪽이어도 되고 열 추가·삭제에 강함\n- 행/열 번호 0=그 열/행 전체 참조",
    "params": [
      {
        "name": "범위",
        "required": true,
        "desc": "값을 꺼내 올 표(셀 범위). 한 열·한 행·여러 행열 모두 가능하며, 괄호로 묶으면 떨어진 여러 범위도 지정할 수 있습니다."
      },
      {
        "name": "행번호",
        "required": true,
        "desc": "범위의 위에서부터 몇 번째 행인지. 0으로 두면 지정한 '열 전체'를 참조합니다."
      },
      {
        "name": "열번호",
        "required": false,
        "desc": "범위의 왼쪽에서부터 몇 번째 열인지. 범위가 한 열뿐이면 생략할 수 있습니다. 0으로 두면 '행 전체'를 참조합니다."
      },
      {
        "name": "영역번호",
        "required": false,
        "desc": "여러 개의 떨어진 범위를 지정했을 때 몇 번째 영역을 쓸지. 생략하면 1(첫 영역)로 봅니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "한 열에서 N번째 값 꺼내기",
        "formula": "=INDEX(B2:B10, 3)",
        "result": "B2:B10의 세 번째 값(B4 셀 값)",
        "explain": "한 열 범위라 열 번호를 생략하고 위에서 세 번째 값을 꺼냅니다."
      },
      {
        "level": "basic",
        "title": "표에서 행·열 교차 값 꺼내기",
        "formula": "=INDEX(B2:E10, 4, 2)",
        "result": "범위의 4번째 행과 2번째 열이 만나는 칸의 값",
        "explain": "행·열 번호가 교차하는 칸의 값을 돌려줍니다."
      },
      {
        "level": "advanced",
        "title": "INDEX+MATCH로 조회하기 (VLOOKUP 대체)",
        "formula": "=INDEX(D2:D100, MATCH(\"P-1007\", A2:A100, 0))",
        "result": "계약번호 P-1007에 해당하는 청구액(D열 값)",
        "explain": "MATCH가 찾은 위치를 행 번호로 넘기는 실무 표준 조회로, 찾는 열이 결과 열 왼쪽이어도 됩니다."
      },
      {
        "level": "advanced",
        "title": "행·열을 모두 자동으로 찾는 2차원 조회",
        "formula": "=INDEX(B2:E100, MATCH(\"P-1007\", A2:A100, 0), MATCH(\"청구액\", B1:E1, 0))",
        "result": "계약 P-1007 행과 '청구액' 머리글 열이 만나는 값",
        "explain": "MATCH 두 개로 행·열 위치를 동시에 찾아 교차 값을 꺼내는 2차원 조회입니다."
      },
      {
        "level": "advanced",
        "title": "행 번호 0으로 열 전체를 참조해 합계",
        "formula": "=SUM(INDEX(B2:E10, 0, 3))",
        "result": "범위의 3번째 열(premium 열) 전체 합계",
        "explain": "행 번호 0으로 열 전체를 참조해 '몇 번째 열을 합칠지'를 수식으로 고릅니다."
      }
    ],
    "related": [
      "MATCH",
      "XMATCH",
      "VLOOKUP",
      "XLOOKUP",
      "OFFSET"
    ],
    "tips": "- 반환값은 '값'이자 '셀 참조' — A2:INDEX(...)처럼 동적 범위 끝점으로 활용 가능\n- VLOOKUP과 달리 찾을 열 위치 제약이 없고 중간 열 추가·삭제에도 잘 안 깨짐"
  },
  {
    "id": "match",
    "name": "MATCH",
    "category": "lookup",
    "version": "all",
    "weight": 5,
    "difficulty": 2,
    "syntax": "=MATCH(찾을값, 찾을범위, [일치유형])",
    "summary": "어떤 값이 목록에서 몇 번째에 있는지 위치(순번)를 숫자로 알려준다.",
    "intro": "값이 목록에서 몇 번째에 있는지 위치(순번)를 숫자로 돌려줍니다.\n\n- 값이 아니라 '순번' 반환 — INDEX의 행 번호로 넘겨 짝으로 사용\n- 일치유형 0=완전 일치(권장), 1=이하 최댓값(오름차순), −1=이상 최솟값(내림차순)\n- 완전 일치(0)에서는 *·? 와일드카드 사용 가능",
    "params": [
      {
        "name": "찾을값",
        "required": true,
        "desc": "위치를 알고 싶은 값(숫자·문자·셀 참조). 완전 일치(0)일 때는 *(여러 글자)·?(한 글자) 와일드카드도 쓸 수 있습니다."
      },
      {
        "name": "찾을범위",
        "required": true,
        "desc": "찾을값을 검색할 범위. 한 행 또는 한 열이어야 합니다."
      },
      {
        "name": "일치유형",
        "required": false,
        "desc": "0=완전 일치, 1(기본값)=찾을값 이하의 최댓값(오름차순 정렬 필요), -1=찾을값 이상의 최솟값(내림차순 정렬 필요). 정확히 찾으려면 0을 권장합니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "값이 몇 번째인지 찾기(문자)",
        "formula": "=MATCH(\"자동차\", A2:A10, 0)",
        "result": "'자동차'가 목록에서 몇 번째인지(예: 3)",
        "explain": "완전 일치(0)로 '자동차'의 순번을 돌려줍니다(값이 아니라 위치)."
      },
      {
        "level": "basic",
        "title": "숫자 위치 찾기",
        "formula": "=MATCH(128, C2:C6, 0)",
        "result": "128이 있는 위치 순번",
        "explain": "숫자도 마지막 인수 0으로 정확한 위치를 찾습니다."
      },
      {
        "level": "advanced",
        "title": "INDEX와 결합한 조회",
        "formula": "=INDEX(B2:B100, MATCH(\"P-1007\", A2:A100, 0))",
        "result": "계약 P-1007에 해당하는 상품명(B열 값)",
        "explain": "MATCH의 위치를 INDEX에 넘기는 가장 흔한 조회 패턴입니다(찾을 열이 왼쪽이어도 동작)."
      },
      {
        "level": "advanced",
        "title": "구간(등급) 매칭 — 근사 검색",
        "formula": "=MATCH(720, $F$2:$F$5, 1)",
        "result": "720이 속하는 구간의 순번(기준값이 0·600·700·800이면 3)",
        "explain": "일치 유형 1(이하 최댓값)로 구간 등급을 매기며, 기준 범위는 반드시 오름차순이어야 합니다."
      },
      {
        "level": "advanced",
        "title": "와일드카드로 부분 일치 위치 찾기",
        "formula": "=MATCH(\"삼성*\", A2:A100, 0)",
        "result": "'삼성'으로 시작하는 첫 항목의 위치",
        "explain": "완전 일치(0)에서는 *·? 와일드카드로 앞부분만으로도 찾습니다."
      }
    ],
    "related": [
      "INDEX",
      "XMATCH",
      "VLOOKUP",
      "XLOOKUP"
    ],
    "tips": "- 마지막 인수 생략 시 기본 1(근사·오름차순 가정) — 미정렬 목록은 엉뚱한 위치, 정확히 찾을 땐 0 필수\n- 대소문자 구분 없음, 전각·반각은 다르게 봄"
  },
  {
    "id": "vlookup",
    "name": "VLOOKUP · HLOOKUP",
    "category": "lookup",
    "version": "all",
    "weight": 5,
    "difficulty": 2,
    "syntax": "=VLOOKUP(찾을값, 표범위, 열번호, [일치옵션])\n=HLOOKUP(찾을값, 표범위, 행번호, [일치옵션])",
    "summary": "표에서 기준값을 찾아 같은 행(VLOOKUP·세로)이나 같은 열(HLOOKUP·가로)의 값을 가져오는 대표 검색 함수 한 쌍.",
    "intro": "표에서 기준값을 찾아 연결된 값을 가져오는 짝꿍 함수입니다 — V=세로, H=가로.\n\n- VLOOKUP: 맨 왼쪽 열에서 찾아 같은 행의 오른쪽 값(세로 표, 실무 대부분)\n- HLOOKUP: 맨 윗 행에서 찾아 같은 열의 아래 값(월별 가로 요약표)\n- 마지막 인수 FALSE=정확히 일치(초보자는 거의 항상 FALSE), TRUE·생략=근삿값",
    "params": [
      {
        "name": "찾을값",
        "required": true,
        "desc": "찾고 싶은 기준값입니다. VLOOKUP은 표의 맨 왼쪽 열에서, HLOOKUP은 표의 맨 윗 행에서 이 값을 찾습니다. 예: 상품코드 \"A01\", \"3월\"."
      },
      {
        "name": "표범위",
        "required": true,
        "desc": "검색할 표 전체 범위. VLOOKUP은 첫(맨 왼쪽) 열에, HLOOKUP은 첫(맨 위) 행에 찾을값이 있어야 합니다. 예: $E$2:$G$5."
      },
      {
        "name": "열번호 / 행번호",
        "required": true,
        "desc": "가져올 값의 위치. VLOOKUP은 열번호(왼쪽 열=1), HLOOKUP은 행번호(맨 윗 행=1) — 두 함수의 유일한 인수 차이."
      },
      {
        "name": "일치옵션",
        "required": false,
        "desc": "FALSE(0)=정확히 일치, TRUE(1·생략)=근삿값(첫 열/행 오름차순 정렬 필요). 보통 FALSE를 씁니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "[VLOOKUP] 상품코드로 보험료 찾기(정확히 일치)",
        "formula": "=VLOOKUP(\"A01\", $E$2:$G$5, 3, FALSE)",
        "result": "코드 A01이 있는 행의 세 번째 열(보험료) 값",
        "explain": "맨 왼쪽 열에서 \"A01\"을 정확히(FALSE) 찾아 그 행의 3번째 열 값을 가져옵니다($ 고정으로 복사 안전)."
      },
      {
        "level": "basic",
        "title": "[VLOOKUP] 점수 구간으로 등급 매기기(근삿값)",
        "formula": "=VLOOKUP(87, 등급표, 2, TRUE)",
        "result": "87이 속한 구간의 등급(예: \"B\")",
        "explain": "TRUE는 87 이하의 가장 가까운 하한(80)을 찾는 구간 매칭으로, 첫 열이 반드시 오름차순이어야 합니다."
      },
      {
        "level": "basic",
        "title": "[HLOOKUP] 가로 표에서 상품명으로 보험료 찾기",
        "formula": "=HLOOKUP(\"암보험\", B1:F2, 2, FALSE)",
        "result": "1행에서 \"암보험\" 열을 찾아, 그 아래 2행의 보험료 값",
        "explain": "맨 윗 행에서 \"암보험\" 열을 찾아 2번째 '행' 값을 가져옵니다(VLOOKUP과 방향만 다름)."
      },
      {
        "level": "advanced",
        "title": "[VLOOKUP] 없는 코드일 때 오류 감추기",
        "formula": "=IFERROR(VLOOKUP(A2, 상품표, 3, FALSE), \"미등록 상품\")",
        "result": "찾으면 보험료, 못 찾으면 \"미등록 상품\"",
        "explain": "찾는 값이 없을 때의 #N/A 오류를 IFERROR로 원하는 문구로 바꿉니다."
      },
      {
        "level": "advanced",
        "title": "[HLOOKUP] 항목 행 위치를 MATCH로 자동 지정",
        "formula": "=HLOOKUP(\"3월\", A1:M5, MATCH(\"claim_amt\", A1:A5, 0), FALSE)",
        "result": "'claim_amt' 행이 몇 번째든 3월 값을 자동으로 가져옴",
        "explain": "행번호를 MATCH로 자동 지정해 표 구조가 바뀌어도 맞는 행을 가져옵니다(VLOOKUP은 열번호 자리에 같은 요령)."
      },
      {
        "level": "advanced",
        "title": "[VLOOKUP] 두 열을 합친 조합키로 찾기",
        "formula": "=VLOOKUP(A3&B3, D3:G6, 4, FALSE)",
        "result": "지역+상품을 합친 값과 일치하는 행의 4번째 열 값",
        "explain": "A3&B3로 두 조건을 이어붙인 조합키로 찾으며, 표 첫 열에도 같은 조합키 열이 필요합니다."
      }
    ],
    "tips": "- 기준값이 왼쪽 세로 열이면 VLOOKUP, 맨 윗 가로 행이면 HLOOKUP — 실무는 VLOOKUP이 대부분\n- VLOOKUP은 기준 열 왼쪽 값을 못 가져옴 → XLOOKUP·INDEX+MATCH 사용\n- 마지막 인수 생략=근삿값(TRUE) 동작 — 정확히 찾을 땐 꼭 FALSE\n- 숫자 vs 텍스트 숫자로 형식이 다르면 못 찾음",
    "related": [
      "XLOOKUP",
      "INDEX",
      "MATCH",
      "IFERROR",
      "TRANSPOSE"
    ]
  },
  {
    "id": "xlookup",
    "name": "XLOOKUP",
    "category": "lookup",
    "version": "2021",
    "weight": 5,
    "difficulty": 2,
    "syntax": "=XLOOKUP(찾을값, 찾을범위, 반환범위, [없을때], [일치모드], [검색모드])",
    "summary": "찾을 범위와 가져올 범위를 따로 지정해 값을 검색하는 최신 검색 함수(VLOOKUP 대체).",
    "intro": "찾을값을 기준으로 표에서 짝이 되는 값을 찾아오는 최신 검색 함수입니다(엑셀 2021·Microsoft 365).\n\n- 찾을범위·반환범위를 따로 지정 — 열 번호 세기 불필요, 기준 열 왼쪽 조회 가능\n- 없을때·근삿값·역방향 검색을 옵션 하나로 처리\n- 예: 계약번호로 보험료 조회 등 검색 작업 대부분 대체(VLOOKUP 강화판)",
    "params": [
      {
        "name": "찾을값",
        "required": true,
        "desc": "찾고 싶은 기준값입니다. 예: 계약번호 \"P1003\", 나이 37."
      },
      {
        "name": "찾을범위",
        "required": true,
        "desc": "찾을값을 찾아볼 한 줄(한 열 또는 한 행) 범위입니다. 예: 계약번호가 들어 있는 A2:A100."
      },
      {
        "name": "반환범위",
        "required": true,
        "desc": "찾은 자리에서 실제로 가져올 값이 들어 있는 범위입니다. 여러 열을 주면 그만큼 옆으로 펼쳐(스필) 반환합니다."
      },
      {
        "name": "없을때",
        "required": false,
        "desc": "찾는 값이 없을 때 대신 표시할 값입니다. 생략하면 오류(#N/A)가 납니다. IFERROR 없이 오류 처리를 할 수 있습니다."
      },
      {
        "name": "일치모드",
        "required": false,
        "desc": "0=정확히 일치(기본), -1=정확 또는 다음 작은 값, 1=정확 또는 다음 큰 값, 2=와일드카드(*,?) 사용."
      },
      {
        "name": "검색모드",
        "required": false,
        "desc": "1=처음부터(기본), -1=끝에서부터(역방향), 2=오름차순 이진 검색, -2=내림차순 이진 검색."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "계약번호로 보험료 찾기",
        "formula": "=XLOOKUP(\"P1003\", A2:A100, C2:C100)",
        "result": "계약번호가 P1003인 행의 보험료(예: 120000)",
        "explain": "'어디서 찾을지'(A열 계약번호)와 '무엇을 가져올지'(C열 보험료)를 따로 지정하는 기본 사용법입니다."
      },
      {
        "level": "basic",
        "title": "못 찾으면 '없음'으로 표시하기",
        "formula": "=XLOOKUP(\"P9999\", A2:A100, C2:C100, \"미등록\")",
        "result": "P9999가 없으면 오류 대신 \"미등록\"",
        "explain": "네 번째 인수(없을때)에 대체 문구를 넣으면 #N/A 오류 대신 그 문구가 나와 IFERROR가 필요 없습니다."
      },
      {
        "level": "advanced",
        "title": "한 번에 여러 열 가져오기(스필)",
        "formula": "=XLOOKUP(\"P1003\", A2:A100, C2:E100)",
        "result": "보험료·청구액·상품명 3개 값이 옆으로 펼쳐진 배열 {120000, 45000, \"암보험\"}",
        "explain": "반환범위를 여러 열(C:E)로 주면 찾은 행의 여러 값이 한 번에 옆으로 펼쳐져(스필) 계약 한 건의 정보를 한 수식으로 끌어옵니다."
      },
      {
        "level": "advanced",
        "title": "나이 구간별 요율 찾기(근삿값)",
        "formula": "=XLOOKUP(37, F2:F5, G2:G5, , -1)",
        "result": "나이 37이 속한 구간(30세대)의 요율(예: 0.02)",
        "explain": "일치모드 -1(정확 또는 다음 작은 값)로 37을 구간 하한 30에 매칭해, 정확히 일치하는 값이 없어도 해당 구간 요율을 가져옵니다."
      },
      {
        "level": "advanced",
        "title": "가장 최근 청구 내역 찾기(역방향 검색)",
        "formula": "=XLOOKUP(\"P1003\", A2:A100, D2:D100, , , -1)",
        "result": "P1003의 마지막(가장 아래) 행에 있는 청구액",
        "explain": "검색모드 -1(끝에서부터)이 아래에서 위로 찾아, 시간순으로 쌓인 데이터에서 같은 계약번호의 가장 최근 건을 집어옵니다."
      }
    ],
    "related": [
      "VLOOKUP",
      "INDEX",
      "MATCH",
      "XMATCH",
      "FILTER"
    ],
    "tips": "- VLOOKUP과 달리 기준 열 왼쪽 값 조회 가능, 열 번호 세기 불필요\n- 엑셀 2019 이하 미지원 — 구버전에서 열면 #NAME? 또는 값 고정, 호환 필요 시 INDEX+MATCH"
  },
  {
    "id": "find-search",
    "name": "FIND · SEARCH",
    "category": "lookup",
    "version": "all",
    "weight": 4,
    "difficulty": 3,
    "syntax": "=FIND(찾을텍스트, 대상텍스트, [시작위치])  ·  =SEARCH(찾을텍스트, 대상텍스트, [시작위치])",
    "summary": "텍스트 안에서 특정 글자·단어가 몇 번째에 있는지 위치(숫자)를 찾습니다. FIND는 대소문자 구분, SEARCH는 무시+와일드카드.",
    "intro": "특정 글자·단어가 텍스트에서 몇 번째에 있는지 위치 숫자를 돌려줍니다.\n\n- FIND: 대소문자 구분·와일드카드 불가 / SEARCH: 대소문자 무시·와일드카드(?, *) 가능\n- LEFT·MID·RIGHT와 조합해 구분자 앞/뒤 잘라내기(@ 앞 아이디 등)\n- 못 찾으면 둘 다 #VALUE! 오류",
    "params": [
      {
        "name": "찾을텍스트",
        "required": true,
        "desc": "대상 안에서 찾고 싶은 글자나 단어. SEARCH는 여기에 와일드카드(? 글자 1개, * 여러 글자)를 쓸 수 있습니다."
      },
      {
        "name": "대상텍스트",
        "required": true,
        "desc": "검색할 원본 텍스트, 또는 그 값이 든 셀(예: A2)."
      },
      {
        "name": "시작위치",
        "required": false,
        "desc": "몇 번째 글자부터 찾기 시작할지. 생략하면 1(처음부터). 같은 글자의 '두 번째' 위치를 찾을 때 유용합니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "이메일에서 @ 위치 찾기",
        "formula": "=FIND(\"@\",\"hong@abc.com\")",
        "result": "5 (@가 왼쪽에서 5번째 글자)",
        "explain": "왼쪽부터 세어 \"@\"가 처음 나오는 자리 번호(5)를 돌려줍니다."
      },
      {
        "level": "basic",
        "title": "대소문자 구분 없이 찾기 (SEARCH)",
        "formula": "=SEARCH(\"plan\",\"AutoPlan2024\")",
        "result": "5 (\"Plan\"의 P 위치, 대소문자 무시)",
        "explain": "SEARCH는 대소문자를 무시해 소문자 \"plan\"으로도 \"Plan\"을 찾습니다(FIND는 #VALUE! 오류)."
      },
      {
        "level": "advanced",
        "title": "@ 앞의 아이디만 추출 (FIND+LEFT)",
        "formula": "=LEFT(A2, FIND(\"@\",A2)-1)",
        "result": "\"hong\"  (A2가 \"hong@abc.com\"일 때)",
        "explain": "FIND로 구한 @ 위치(5)보다 1 적은 4글자를 LEFT로 잘라 구분자 앞부분만 남깁니다."
      },
      {
        "level": "advanced",
        "title": "상품명에 특정 단어가 들어있는지로 분류",
        "formula": "=IF(ISNUMBER(SEARCH(\"암\",[@상품명])),\"암보험\",\"기타\")",
        "result": "\"암보험\" 또는 \"기타\"",
        "explain": "SEARCH 결과가 숫자인지(ISNUMBER)로 포함 여부를 참·거짓으로 바꿔 IF로 분류합니다."
      },
      {
        "level": "advanced",
        "title": "두 번째 하이픈 위치 찾기 (시작위치 활용)",
        "formula": "=FIND(\"-\", A2, FIND(\"-\",A2)+1)",
        "result": "두 번째 \"-\"의 자리 번호  (A2가 \"2024-05-18\"이면 8)",
        "explain": "안쪽 FIND가 찾은 첫 하이픈(5) 다음 칸부터 다시 찾아 두 번째 하이픈(8)을 짚습니다."
      },
      {
        "level": "advanced",
        "title": "와일드카드로 유연하게 찾기 (SEARCH 전용)",
        "formula": "=SEARCH(\"실손?세대\",A2)",
        "result": "\"실손\"과 \"세대\" 사이에 글자 1개가 낀 위치.  \"실손4세대보장\"이면 1",
        "explain": "SEARCH만 ?·* 와일드카드를 지원하며, 실제 \"?\" 글자는 \"~?\"처럼 물결을 붙여 찾습니다."
      }
    ],
    "tips": "- 못 찾으면 #VALUE! 오류 → ISNUMBER()·IFERROR()로 감싸 처리\n- 바이트 기준(한글 2)이 필요하면 FINDB·SEARCHB\n- 최신 365는 TEXTBEFORE·TEXTAFTER로 위치 계산 없이 자르기 가능",
    "related": [
      "LEFT",
      "RIGHT",
      "MID",
      "LEN",
      "SUBSTITUTE",
      "IFERROR",
      "ISNUMBER",
      "TEXTBEFORE",
      "TEXTAFTER"
    ]
  },
  {
    "id": "left-right",
    "name": "LEFT · RIGHT",
    "category": "lookup",
    "version": "all",
    "weight": 4,
    "difficulty": 2,
    "syntax": "=LEFT(문자열, [개수])  /  =RIGHT(문자열, [개수])",
    "summary": "문자열의 왼쪽(LEFT)·오른쪽(RIGHT) 끝에서 지정한 개수만큼 글자를 잘라 온다.",
    "intro": "문자열의 왼쪽(LEFT)·오른쪽(RIGHT) 끝에서 지정한 개수만큼 글자를 잘라 옵니다.\n\n- 계약번호 앞자리(상품 구분)·뒷자리(일련번호)처럼 자리 규칙 있는 데이터 분리\n- 개수 생략 시 1글자\n- 결과는 텍스트 — 숫자 계산 전 VALUE로 변환",
    "params": [
      {
        "name": "문자열",
        "required": true,
        "desc": "잘라 올 대상 글자(또는 글자가 든 셀). 숫자가 들어와도 글자처럼 다뤄요."
      },
      {
        "name": "개수",
        "required": false,
        "desc": "가져올 글자 수. 생략하면 1. 문자열 길이보다 크면 전체를 그대로 반환하고, 음수면 오류가 나요."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "왼쪽에서 두 글자 가져오기",
        "formula": "=LEFT(\"보험료\", 2)",
        "result": "\"보험\"",
        "explain": "왼쪽 끝에서 2글자를 잘라 앞부분만 떼어 내는 기본 사용법입니다."
      },
      {
        "level": "basic",
        "title": "오른쪽에서 일련번호 뽑기",
        "formula": "=RIGHT(\"2024-001\", 3)",
        "result": "\"001\"",
        "explain": "오른쪽 끝에서 정해진 자릿수(3글자)를 가져와 뒤 일련번호만 남깁니다."
      },
      {
        "level": "advanced",
        "title": "구분 기호 앞의 상품 코드 뽑기",
        "formula": "=LEFT(A2, FIND(\"-\", A2)-1)",
        "result": "\"LIFE-2024\" → \"LIFE\"",
        "explain": "FIND로 찾은 하이픈 위치 바로 앞까지 잘라, 앞자리 길이가 제각각이어도 정확히 뽑습니다."
      },
      {
        "level": "advanced",
        "title": "구분 기호 뒤의 내용 뽑기",
        "formula": "=RIGHT(A2, LEN(A2)-FIND(\"-\", A2))",
        "result": "\"LIFE-2024\" → \"2024\"",
        "explain": "전체 길이(LEN)에서 하이픈 위치를 뺀 '뒤에 남은 글자 수'만큼 RIGHT로 가져옵니다."
      },
      {
        "level": "advanced",
        "title": "잘라 온 연도를 숫자로 바꿔 계산",
        "formula": "=VALUE(LEFT(A2, 4))",
        "result": "\"2024-001\" → 숫자 2024",
        "explain": "LEFT가 돌려준 글자 \"2024\"를 VALUE로 진짜 숫자로 바꿔 계산에 바로 씁니다."
      }
    ],
    "related": [
      "MID",
      "FIND",
      "SEARCH",
      "LEN",
      "VALUE",
      "TEXTBEFORE"
    ],
    "tips": "- 결과는 항상 글자 — 숫자 계산 전 VALUE로 변환\n- 개수에 음수를 넣으면 #VALUE! 오류\n- 구분자 위치가 매번 다르면 FIND·SEARCH와 조합, 최신 365는 TEXTBEFORE·TEXTAFTER가 더 간단"
  },
  {
    "id": "choose",
    "name": "CHOOSE",
    "category": "lookup",
    "version": "all",
    "weight": 3,
    "difficulty": 2,
    "syntax": "=CHOOSE(인덱스번호, 값1, [값2], …)",
    "summary": "번호를 주면 여러 값 중 그 번호에 해당하는 값을 꺼낸다.",
    "intro": "번호를 주면 나열한 값 중 그 번째 값을 꺼냅니다.\n\n- 1·2·3 같은 코드 번호를 이름·등급으로 바꿀 때 직관적\n- 값 자리에 범위도 가능 — 번호에 따라 합계 범위를 바꾸는 고급 기법",
    "params": [
      {
        "name": "인덱스번호",
        "required": true,
        "desc": "몇 번째 값을 꺼낼지 1, 2, 3…의 정수. 소수는 버림 처리됩니다. 1부터 값 개수 사이여야 하며, 벗어나면 #VALUE! 오류가 납니다."
      },
      {
        "name": "값1",
        "required": true,
        "desc": "1번에 해당하는 값. 숫자·문자·셀·범위 모두 가능합니다."
      },
      {
        "name": "값2",
        "required": false,
        "desc": "2번 이후의 값들. 최대 254개까지 나열할 수 있습니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "번호로 이름 꺼내기",
        "formula": "=CHOOSE(2, \"생명\", \"손해\", \"재보험\")",
        "result": "두 번째 값인 \"손해\"",
        "explain": "첫 인수 번호 2에 해당하는 두 번째 값 \"손해\"를 목록에서 고릅니다."
      },
      {
        "level": "basic",
        "title": "코드 번호를 분류명으로 변환",
        "formula": "=CHOOSE(B2, \"영업일\", \"정기휴일\", \"할인판매일\")",
        "result": "B2가 1이면 영업일, 2면 정기휴일, 3이면 할인판매일",
        "explain": "셀에 든 코드 번호(1, 2, 3)를 사람이 읽을 수 있는 이름으로 바꿉니다."
      },
      {
        "level": "advanced",
        "title": "VLOOKUP 왼쪽 조회 트릭",
        "formula": "=VLOOKUP(\"P-1007\", CHOOSE({1,2}, B2:B100, A2:A100), 2, 0)",
        "result": "찾을 열(A)이 결과 열(B) 오른쪽에 있어도 조회 성공",
        "explain": "배열 상수 {1,2}로 A·B 두 열의 순서를 가상으로 뒤집어, 원래 왼쪽만 못 찾던 VLOOKUP이 왼쪽 열도 찾게 만드는 고전 기법입니다(요즘은 XLOOKUP·INDEX+MATCH로 대체)."
      },
      {
        "level": "advanced",
        "title": "월을 분기로 변환",
        "formula": "=CHOOSE(MONTH(A2), 1,1,1,2,2,2,3,3,3,4,4,4)",
        "result": "날짜의 월에 맞는 분기 번호(1~4)",
        "explain": "MONTH가 돌려준 1~12를 값 목록 12개에 하나씩 대응시켜 분기로 접습니다."
      },
      {
        "level": "advanced",
        "title": "조건에 따라 합계 범위 고르기",
        "formula": "=SUM(CHOOSE(분기, D2:D13, E2:E13, F2:F13, G2:G13))",
        "result": "선택한 분기 열의 합계",
        "explain": "값 자리에 범위를 넣어 분기 번호에 따라 다른 열을 골라 SUM에 넘깁니다."
      }
    ],
    "related": [
      "SWITCH",
      "IFS",
      "INDEX",
      "VLOOKUP"
    ],
    "tips": "- 인덱스번호가 0이거나 값 개수를 넘으면 #VALUE! 오류\n- 연속 코드(1,2,3…)에 적합 — 범위 조건·항목 많으면 SWITCH·IFS·VLOOKUP/XLOOKUP이 관리 용이"
  },
  {
    "id": "indirect",
    "name": "INDIRECT",
    "category": "lookup",
    "version": "all",
    "weight": 3,
    "difficulty": 4,
    "syntax": "=INDIRECT(참조_문자열, [A1스타일])",
    "summary": "\"B3\" 같은 문자열을 실제 셀 참조로 바꿔 그 위치의 값을 가져온다.",
    "intro": "\"B3\" 같은 텍스트로 된 주소를 실제 셀 참조로 바꿔 그 위치의 값을 가져오는 함수입니다.\n\n- 참조 위치를 셀 값·수식으로 '조립' → 시트 이름·표를 값으로 골라 참조\n- 휘발성 함수라 남용 시 느려짐, 닫힌 다른 파일은 참조 불가",
    "params": [
      {
        "name": "참조_문자열",
        "required": true,
        "desc": "셀 주소를 담은 텍스트(예: \"B3\", \"'상품A'!B2\", 이름 정의). 이 글자를 실제 참조로 해석해요."
      },
      {
        "name": "A1스타일",
        "required": false,
        "desc": "참조 표기 방식. 생략/TRUE면 일반적인 A1 방식, FALSE면 R1C1(행번호·열번호) 방식으로 해석."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "문자열 주소로 값 가져오기",
        "formula": "=INDIRECT(\"B3\")",
        "result": "B3 셀의 값",
        "explain": "글자 \"B3\"를 실제 셀 참조로 바꿔 값을 반환 — =B3와 결과는 같지만 주소를 글자로 다룰 수 있는 점이 다릅니다."
      },
      {
        "level": "basic",
        "title": "다른 셀에 적힌 주소를 따라가기",
        "formula": "=INDIRECT(A1)",
        "result": "A1에 \"B3\"이 적혀 있으면 B3의 값",
        "explain": "A1에 적힌 주소로 이동해 값을 가져오며, A1만 바꾸면 참조 대상이 바뀝니다."
      },
      {
        "level": "advanced",
        "title": "시트 이름을 골라 값 끌어오기(여러 상품 시트)",
        "formula": "=INDIRECT(\"'\"&A1&\"'!B2\")",
        "result": "A1에 적힌 이름의 시트 B2 값",
        "explain": "A1의 시트 이름으로 \"'상품A'!B2\" 주소를 조립(공백 대비 작은따옴표)해 해당 시트 B2를 가져와, 상품만 바꿔 요약합니다."
      },
      {
        "level": "advanced",
        "title": "이름 정의된 범위를 골라 합계",
        "formula": "=SUM(INDIRECT(E3))",
        "result": "E3에 적힌 이름(예: 상품A) 범위의 합계",
        "explain": "정의된 이름(예: 상품A)을 E3에서 골라 실제 범위로 바꿔 SUM에 넘기면, 드롭다운으로 그룹 premium 합계를 냅니다."
      },
      {
        "level": "advanced",
        "title": "찾을 표(테이블)를 동적으로 바꿔 VLOOKUP",
        "formula": "=VLOOKUP(A3, INDIRECT(B3), 2, FALSE)",
        "result": "B3이 가리키는 표에서 A3을 찾은 2번째 열 값",
        "explain": "B3의 표 이름·범위를 실제 참조로 바꿔 VLOOKUP 검색 표로 써, 같은 식으로 상품·연도별 요율표를 바꿔 조회합니다."
      }
    ],
    "related": [
      "OFFSET",
      "ADDRESS",
      "INDEX",
      "CHOOSE",
      "VLOOKUP"
    ],
    "tips": "- 휘발성 함수 — 남용하면 느려짐\n- 참조를 글자로만 다뤄 열 삽입·삭제를 자동 추적 안 함(위치 어긋날 수 있음)\n- 닫힌 통합 문서 참조 불가, 잘못된 주소는 #REF! 오류"
  },
  {
    "id": "len",
    "name": "LEN",
    "category": "lookup",
    "version": "all",
    "weight": 3,
    "difficulty": 2,
    "syntax": "=LEN(텍스트)",
    "summary": "텍스트의 글자 수(공백 포함)를 셉니다. 자릿수 검증과 다른 함수와의 조합 계산에 핵심.",
    "intro": "텍스트가 몇 글자인지(공백 포함) 세는 함수입니다.\n\n- 단독으로 자릿수 검사, FIND·MID·SUBSTITUTE 조합으로 '남은 글자 수'·문자 개수 계산\n- 한글도 1글자=1, 바이트 기준(한글 2)은 LENB",
    "params": [
      {
        "name": "텍스트",
        "required": true,
        "desc": "글자 수를 셀 텍스트, 또는 그 값이 든 셀 참조. 숫자·날짜를 넣으면 화면에 보이는 자릿수를 셉니다(예: 1000 → 4)."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "글자 수 세기",
        "formula": "=LEN(\"실손의료보험\")",
        "result": "6",
        "explain": "텍스트의 글자 개수를 그대로 돌려줘 여섯 글자면 6입니다."
      },
      {
        "level": "basic",
        "title": "셀 값의 길이 (공백 포함)",
        "formula": "=LEN(A2)",
        "result": "A2가 \"123-45\"이면 6, \"홍 길동\"이면 4",
        "explain": "셀 안 글자 수를 세며, 눈에 안 띄는 공백도 한 글자로 셉니다(\"홍 길동\"=4)."
      },
      {
        "level": "advanced",
        "title": "계약번호 자릿수 검증",
        "formula": "=IF(LEN(TRIM(A2))=10,\"정상\",\"확인필요\")",
        "result": "\"정상\" 또는 \"확인필요\"",
        "explain": "TRIM으로 공백을 없앤 뒤 길이가 10인지 확인하는 데이터 검증 기본기입니다."
      },
      {
        "level": "advanced",
        "title": "구분자(하이픈) 개수 세기 (SUBSTITUTE 조합)",
        "formula": "=LEN(A2)-LEN(SUBSTITUTE(A2,\"-\",\"\"))",
        "result": "A2가 \"2024-05-18\"이면 2",
        "explain": "원래 길이에서 하이픈을 지운 길이를 빼면 하이픈 개수가 나오는 고전 기법입니다(항목 수는 +1)."
      },
      {
        "level": "advanced",
        "title": "@ 뒤 도메인만 남기기 (RIGHT+LEN+FIND)",
        "formula": "=RIGHT(A2, LEN(A2)-FIND(\"@\",A2))",
        "result": "\"hong@abc.com\"이면 \"abc.com\"",
        "explain": "전체 길이에서 @ 위치를 빼 '@ 뒤 글자 수'를 구하고, 그만큼 RIGHT로 잘라 도메인만 남깁니다."
      },
      {
        "level": "advanced",
        "title": "앞자리 0 채워 6자리 코드 만들기 (REPT+LEN)",
        "formula": "=\"P\"&REPT(\"0\",6-LEN(A2))&A2",
        "result": "A2가 \"42\"이면 \"P000042\"",
        "explain": "6에서 현재 길이를 뺀 만큼 \"0\"을 REPT로 앞에 붙여 자릿수를 맞춥니다(TEXT(A2,\"000000\")도 가능)."
      }
    ],
    "tips": "- 공백도 한 글자 — 자릿수 검사가 틀리면 TRIM으로 정리 후 세기\n- 숫자는 '보이는 자릿수'를 셈(1000 → 4)\n- 한글 1글자=1, 바이트가 필요하면 LENB(한글 2)",
    "related": [
      "FIND",
      "SEARCH",
      "MID",
      "RIGHT",
      "LEFT",
      "SUBSTITUTE",
      "TRIM",
      "REPT",
      "TEXT"
    ]
  },
  {
    "id": "mid",
    "name": "MID",
    "category": "lookup",
    "version": "all",
    "weight": 3,
    "difficulty": 2,
    "syntax": "=MID(문자열, 시작위치, 개수)",
    "summary": "문자열의 지정한 시작 위치부터 원하는 개수만큼 글자를 잘라 온다(가운데 추출).",
    "intro": "문자열의 지정한 시작 위치부터 원하는 개수만큼 글자를 잘라 오는 함수입니다.\n\n- 시작 위치를 직접 정해 문자열 중간 어디든 추출(LEFT·RIGHT와 달리)\n- 위치는 1부터 셈 — 계약번호·코드의 특정 구간 추출에 유용",
    "params": [
      {
        "name": "문자열",
        "required": true,
        "desc": "잘라 올 대상 글자(또는 글자가 든 셀)."
      },
      {
        "name": "시작위치",
        "required": true,
        "desc": "가져오기 시작할 글자 위치. 첫 글자가 1. 1보다 작으면 오류가 나요."
      },
      {
        "name": "개수",
        "required": true,
        "desc": "시작 위치부터 가져올 글자 수. 남은 길이보다 커도 오류 없이 끝까지만 가져와요."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "중간 한 글자 뽑기",
        "formula": "=MID(\"2024-A-001\", 6, 1)",
        "result": "\"A\"",
        "explain": "여섯 번째 글자부터 1글자를 가져와 가운데 상품 구분 코드 \"A\"만 뽑는 기본 사용법입니다."
      },
      {
        "level": "basic",
        "title": "앞에서부터 일정 구간 뽑기",
        "formula": "=MID(A2, 1, 4)",
        "result": "\"2024-001\" → \"2024\"",
        "explain": "첫 글자부터 4글자를 가져와 LEFT(A2,4)와 같지만, 시작 위치를 바꾸면 어디서든 잘라오는 게 MID의 장점입니다."
      },
      {
        "level": "advanced",
        "title": "두 구분 기호 사이의 값 뽑기",
        "formula": "=MID(A2, FIND(\"-\",A2)+1, FIND(\"-\",A2,FIND(\"-\",A2)+1)-FIND(\"-\",A2)-1)",
        "result": "\"2024-A-001\" → \"A\"",
        "explain": "첫 하이픈 다음(+1)에서 시작하고 두 하이픈 위치 차로 '사이 글자 수'를 구합니다 — FIND 세 번째 인수로 두 번째 하이픈을 찾는 게 핵심입니다."
      },
      {
        "level": "advanced",
        "title": "정해진 자리의 코드 뽑기(주민번호 성별 자리)",
        "formula": "=MID(A2, 8, 1)",
        "result": "\"901010-1234567\" → \"1\"",
        "explain": "자리 규칙이 고정되면 위치를 상수로 지정 — 8번째 글자(성별 코드)를 뽑고, IF·CHOOSE로 '남/여' 표시로 바꿉니다."
      },
      {
        "level": "advanced",
        "title": "코드 중간의 월(2자리) 뽑아 숫자로",
        "formula": "=VALUE(MID(A2, 5, 2))",
        "result": "\"2024-06-15\" → 숫자 6",
        "explain": "다섯 번째부터 2글자(\"06\")를 잘라 VALUE로 숫자 6으로 변환 — MID 결과는 글자라 집계·비교하려면 숫자로 바꿔야 합니다."
      }
    ],
    "related": [
      "LEFT",
      "RIGHT",
      "FIND",
      "SEARCH",
      "LEN",
      "TEXTSPLIT"
    ],
    "tips": "- 위치는 1부터 — 시작위치 <1이면 #VALUE! 오류\n- 개수가 남은 글자보다 커도 오류 없이 끝까지만 가져옴\n- 구분자 위치가 매번 다르면 FIND/SEARCH·LEN 조합, 365는 TEXTSPLIT/TEXTBEFORE/TEXTAFTER가 더 간단"
  },
  {
    "id": "offset",
    "name": "OFFSET",
    "category": "lookup",
    "version": "all",
    "weight": 3,
    "difficulty": 4,
    "syntax": "=OFFSET(기준셀, 행이동, 열이동, [높이], [너비])",
    "summary": "기준 셀에서 지정한 행·열만큼 떨어진 위치의 셀 또는 범위를 참조한다.",
    "intro": "기준 셀에서 지정한 행·열만큼 떨어진 위치의 셀 또는 범위를 참조하는 함수입니다.\n\n- 값이 아닌 '위치(참조)'를 생성 — 높이·너비를 주면 범위도 반환(동적 범위)\n- 휘발성 함수라 데이터가 많으면 느려짐, INDEX·스필·XLOOKUP으로 대체 가능",
    "params": [
      {
        "name": "기준셀",
        "required": true,
        "desc": "이동을 시작할 기준이 되는 셀 또는 범위. 여기서부터 칸을 세요."
      },
      {
        "name": "행이동",
        "required": true,
        "desc": "기준셀에서 아래로 이동할 칸 수. 양수는 아래, 음수는 위, 0은 그대로."
      },
      {
        "name": "열이동",
        "required": true,
        "desc": "기준셀에서 오른쪽으로 이동할 칸 수. 양수는 오른쪽, 음수는 왼쪽, 0은 그대로."
      },
      {
        "name": "높이",
        "required": false,
        "desc": "반환할 범위의 세로 칸 수(행 개수). 생략하면 기준셀 높이(보통 1)를 따라감."
      },
      {
        "name": "너비",
        "required": false,
        "desc": "반환할 범위의 가로 칸 수(열 개수). 생략하면 기준셀 너비(보통 1)를 따라감."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "몇 칸 아래 값 가져오기",
        "formula": "=OFFSET(A1, 3, 0)",
        "result": "A4 셀의 값",
        "explain": "A1에서 3칸 아래·0칸 오른쪽인 A4를 가리켜 그 셀 하나의 값을 돌려줍니다."
      },
      {
        "level": "basic",
        "title": "오른쪽으로 이동해 값 가져오기",
        "formula": "=OFFSET(A1, 0, 2)",
        "result": "C1 셀의 값",
        "explain": "A1에서 오른쪽 두 칸 간 C1을 참조 — '기준 위치 + 몇 번째 열'로 값을 뽑을 때 유용합니다."
      },
      {
        "level": "advanced",
        "title": "높이·너비로 범위를 만들어 합계",
        "formula": "=SUM(OFFSET(B2, 0, 0, 12, 1))",
        "result": "B2:B13(12개월 보험료)의 합계",
        "explain": "높이 12·너비 1로 B2부터 12칸 범위를 만들어 SUM에 넣어 12개월 premium 합계를 냅니다(범위 반환)."
      },
      {
        "level": "advanced",
        "title": "데이터가 늘어도 자동으로 커지는 합계(동적 범위)",
        "formula": "=SUM(OFFSET($B$2, 0, 0, COUNT($B:$B), 1))",
        "result": "B2부터 숫자가 입력된 만큼의 claim_amt 합계",
        "explain": "COUNT($B:$B)로 센 숫자 개수를 높이로 써, 청구액을 추가하면 범위가 자동으로 늘어나는 동적 범위 패턴입니다."
      },
      {
        "level": "advanced",
        "title": "열의 마지막(최신) 값 가져오기",
        "formula": "=OFFSET(B1, COUNTA(B:B)-1, 0)",
        "result": "B열에 마지막으로 입력된 값",
        "explain": "COUNTA(B:B)로 센 셀 수에서 머리글만큼 -1해 내려가, 계속 쌓이는 데이터의 '최신값'을 가리킵니다."
      }
    ],
    "related": [
      "INDEX",
      "INDIRECT",
      "CHOOSE",
      "COUNTA",
      "SUM"
    ],
    "tips": "- 휘발성 함수 — 시트가 바뀔 때마다 재계산돼 파일이 무거워짐\n- INDEX(비휘발성)·표(구조적 참조)·스필로 대체하면 더 빠름\n- 행/열 이동이 표 밖으로 나가면 #REF! 오류"
  },
  {
    "id": "xmatch",
    "name": "XMATCH",
    "category": "lookup",
    "version": "2021",
    "weight": 3,
    "difficulty": 3,
    "syntax": "=XMATCH(찾을값, 찾을배열, [일치모드], [검색모드])",
    "summary": "MATCH의 강화판 — 기본이 완전 일치이고 뒤에서부터 검색도 된다.",
    "intro": "값이 목록에서 몇 번째인지 위치를 돌려주는 MATCH의 강화판입니다(2021·365 이상).\n\n- 옵션 없이 기본이 완전 일치(MATCH는 끝에 0 필요)\n- 맨 뒤에서부터 검색으로 최신 위치 찾기, 근사 검색도 정렬 없이 동작",
    "params": [
      {
        "name": "찾을값",
        "required": true,
        "desc": "위치를 알고 싶은 값(숫자·문자·셀 참조)."
      },
      {
        "name": "찾을배열",
        "required": true,
        "desc": "찾을값을 검색할 범위. 한 행 또는 한 열이어야 합니다."
      },
      {
        "name": "일치모드",
        "required": false,
        "desc": "0(기본)=완전 일치, -1=완전 일치 또는 다음 작은 값, 1=완전 일치 또는 다음 큰 값, 2=와일드카드(*·?) 일치."
      },
      {
        "name": "검색모드",
        "required": false,
        "desc": "1(기본)=앞→뒤, -1=뒤→앞(최신 항목 찾기), 2=이진 검색(오름차순 정렬 전용), -2=이진 검색(내림차순 정렬 전용)."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "옵션 없이 완전 일치로 위치 찾기",
        "formula": "=XMATCH(\"자동차\", A2:A10)",
        "result": "'자동차'의 위치 순번",
        "explain": "옵션 없이도 기본이 완전 일치라 MATCH처럼 끝에 0을 붙일 필요가 없습니다."
      },
      {
        "level": "basic",
        "title": "숫자 위치 찾기",
        "formula": "=XMATCH(500000, B2:B10)",
        "result": "500000이 있는 위치 순번",
        "explain": "숫자도 동일하게 완전 일치로 위치를 반환합니다."
      },
      {
        "level": "advanced",
        "title": "뒤에서부터 검색해 최신 항목 찾기",
        "formula": "=XMATCH(\"P-1007\", A2:A100, 0, -1)",
        "result": "계약 P-1007이 여러 번 나올 때 마지막(가장 아래) 위치",
        "explain": "검색 모드 -1로 맨 뒤에서 훑어, 갱신 이력이 여러 줄일 때 '가장 최근 기록' 위치를 바로 찾습니다(MATCH로는 어려움)."
      },
      {
        "level": "advanced",
        "title": "INDEX와 결합한 2차원 조회",
        "formula": "=INDEX(B2:E100, XMATCH(\"P-1007\", A2:A100), XMATCH(\"청구액\", B1:E1))",
        "result": "계약 P-1007 행과 '청구액' 열이 만나는 값",
        "explain": "행·열 위치를 XMATCH 두 개로 찾아 교차 값을 꺼내며, 완전 일치가 기본이라 수식이 짧습니다."
      },
      {
        "level": "advanced",
        "title": "정렬 없이 구간(다음 작은 값) 매칭",
        "formula": "=XMATCH(720, F2:F5, -1)",
        "result": "720 이하의 가장 큰 기준값 위치",
        "explain": "일치 모드 -1은 '완전 일치 또는 다음 작은 값'을 찾으며, 정렬 없이도 동작해 점수·보험료 구간 매칭이 안전합니다."
      }
    ],
    "related": [
      "MATCH",
      "INDEX",
      "XLOOKUP",
      "FILTER"
    ],
    "tips": "- 2019 이하엔 없어 구버전에서 열면 #NAME? 오류\n- 근사 검색(-1, 1)이 정렬 없이 동작, 뒤에서부터(-1) 검색으로 최신 값 찾기 — MATCH 대비 이점"
  },
  {
    "id": "lookup",
    "name": "LOOKUP",
    "category": "lookup",
    "version": "all",
    "weight": 2,
    "difficulty": 3,
    "syntax": "벡터형식 =LOOKUP(찾을값, 찾을범위, [반환범위]) · 배열형식 =LOOKUP(찾을값, 표배열)",
    "summary": "항상 근삿값으로 검색하는 고전 함수. 정렬된 데이터 검색과 '마지막 값 찾기' 기법에 쓰임.",
    "intro": "값을 찾을 범위와 가져올 범위를 따로 주는 '벡터 형식'과 표를 자동 검색하는 '배열 형식'을 가진 고전 검색 함수입니다.\n\n- 항상 근삿값으로 찾아 찾을 범위가 오름차순 정렬이어야 함(정확 일치는 XLOOKUP·VLOOKUP(FALSE))\n- '조건에 맞는 마지막 값'·'열의 마지막 숫자' 찾기 기법으로 여전히 애용",
    "params": [
      {
        "name": "찾을값",
        "required": true,
        "desc": "찾고 싶은 기준값입니다. 예: 점수 87, 계약번호."
      },
      {
        "name": "찾을범위",
        "required": true,
        "desc": "값을 찾아볼 한 줄(한 행 또는 한 열) 범위입니다. 반드시 오름차순으로 정렬되어 있어야 합니다. 배열 형식에서는 검색할 표 전체가 됩니다."
      },
      {
        "name": "반환범위",
        "required": false,
        "desc": "찾은 위치에서 실제로 가져올 값이 든 범위입니다. 찾을범위와 크기가 같아야 합니다. 생략하면 '배열 형식'으로 동작해 표의 마지막 행·열 값을 돌려줍니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "점수로 등급 찾기(벡터 형식)",
        "formula": "=LOOKUP(87, B2:B6, C2:C6)",
        "result": "87 이하의 가장 가까운 값에 대응하는 등급(예: \"B\")",
        "explain": "오름차순 정렬된 B열에서 87을 넘지 않는 가장 가까운 값을 찾아 같은 위치의 C열(등급)을 가져옵니다(근삿값 검색)."
      },
      {
        "level": "basic",
        "title": "표 하나로 바로 찾기(배열 형식)",
        "formula": "=LOOKUP(87, B2:C6)",
        "result": "B열에서 87을 찾아 마지막 열(C열)의 값",
        "explain": "반환범위를 생략하고 표만 주면 첫 열에서 찾아 '마지막 열' 값을 반환 — 표 구조에 흔들려 실무에서는 벡터 형식을 권합니다."
      },
      {
        "level": "advanced",
        "title": "조건에 맞는 '마지막' 값 찾기",
        "formula": "=LOOKUP(2, 1/(A2:A100=\"P1003\"), D2:D100)",
        "result": "계약번호 P1003이 나오는 마지막 행의 청구액",
        "explain": "1/(조건)은 맞으면 1·아니면 오류가 되고, 없는 큰 값 2를 찾게 하면 오류를 건너뛰고 '1이 있는 마지막 자리'를 잡습니다 — 정렬 없이 조건에 맞는 최신 값을 뽑는 대표 기법입니다."
      },
      {
        "level": "advanced",
        "title": "열의 마지막 숫자 찾기",
        "formula": "=LOOKUP(9.99E+307, C:C)",
        "result": "C열에 입력된 마지막 숫자 값(예: 누적 보험료의 최신 합계)",
        "explain": "9.99E+307(거의 최댓값)보다 큰 수가 없으니 LOOKUP이 C열의 '마지막 숫자'를 반환 — 계속 쌓이는 열의 최신값 참조에 유용합니다."
      }
    ],
    "related": [
      "XLOOKUP",
      "VLOOKUP",
      "INDEX",
      "MATCH",
      "HLOOKUP"
    ],
    "tips": "- 항상 근삿값 — 오름차순이 아니면 오류 없이 엉뚱한 값을 조용히 반환(더 위험)\n- 정확 일치 검색은 XLOOKUP·VLOOKUP(FALSE)\n- LOOKUP은 '마지막 값 찾기'(1/(조건)·9.99E+307)처럼 다른 함수로 어려운 상황에 골라 쓰기"
  },
  {
    "id": "filter",
    "name": "FILTER",
    "category": "shape",
    "version": "2021",
    "weight": 5,
    "difficulty": 3,
    "syntax": "=FILTER(배열, 포함조건, [비었을때])",
    "summary": "표에서 조건에 맞는 행만 골라 자동으로 펼쳐 주는 함수.",
    "intro": "큰 표에서 조건에 맞는 행만 뽑아 자동으로 펼쳐(스필) 주는 함수입니다.\n\n- 핵심은 '포함조건' — C2:C100>1000000 같은 TRUE/FALSE 배열의 TRUE 행만 남음\n- 결과가 없으면 #CALC! 오류 → 세 번째 인수 '비었을때'로 대비",
    "params": [
      {
        "name": "배열",
        "required": true,
        "desc": "필터링할 원본 데이터. 한 열·여러 열·표 전체 모두 가능합니다."
      },
      {
        "name": "포함조건",
        "required": true,
        "desc": "남길 행을 정하는 TRUE/FALSE 배열. 보통 C2:C100>1000000 같은 비교식을 씁니다. 배열과 행(또는 열) 개수가 같아야 합니다."
      },
      {
        "name": "비었을때",
        "required": false,
        "desc": "조건에 맞는 게 하나도 없을 때 대신 반환할 값. 생략하면 #CALC! 오류가 납니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "조건에 맞는 행만 뽑기",
        "formula": "=FILTER(A2:C100, C2:C100>1000000)",
        "result": "C열(청구액)이 100만원을 초과하는 행만 A:C 3개 열 그대로 아래로 스필",
        "explain": "두 번째 칸에 '어떤 행을 남길지' 조건식을 넣으면 TRUE인 행만 추려져 펼쳐지는 기본 사용입니다."
      },
      {
        "level": "basic",
        "title": "특정 상품의 값만 뽑기",
        "formula": "=FILTER(B2:B100, A2:A100=\"자동차\")",
        "result": "A열 상품이 \"자동차\"인 계약의 B열(보험료)만 세로로 스필",
        "explain": "내보내는 범위(B열)와 조건 검사 범위(A열)를 다르게 둘 수 있어, 자동차 계약의 보험료만 모입니다."
      },
      {
        "level": "advanced",
        "title": "여러 조건 동시 만족(AND)",
        "formula": "=FILTER(A2:D100, (A2:A100=\"자동차\")*(C2:C100>500000))",
        "result": "상품이 자동차이면서 청구액 50만원 초과인 행만 스필",
        "explain": "조건끼리 곱하면(*) '둘 다 참'인 AND — TRUE=1·FALSE=0이라 1×1=1일 때만 남습니다."
      },
      {
        "level": "advanced",
        "title": "둘 중 하나면 통과(OR)",
        "formula": "=FILTER(A2:D100, (B2:B100=\"서울\")+(B2:B100=\"부산\"))",
        "result": "지역이 서울 또는 부산인 행 스필",
        "explain": "조건끼리 더하면(+) '하나라도 참'인 OR — 서울이거나 부산인 계약이 모두 포함됩니다."
      },
      {
        "level": "advanced",
        "title": "결과 없을 때 오류 막고 정렬까지",
        "formula": "=SORT(FILTER(A2:C100, C2:C100>0, \"해당 없음\"), 3, -1)",
        "result": "청구액이 있는 계약만 골라 청구액(3열) 내림차순 정렬, 하나도 없으면 \"해당 없음\" 한 칸",
        "explain": "세 번째 인수로 빈 결과 #CALC! 오류를 막고 SORT로 감싸 곧바로 정렬하는 대표 조합 패턴입니다."
      }
    ],
    "tips": "- AND는 조건끼리 곱하기(*), OR는 더하기(+)\n- 조건 범위와 데이터 범위의 행 수가 다르면 #VALUE! 오류\n- 펼쳐질 아래·옆 칸에 값이 있으면 #SPILL! 오류 — 주변을 비우기",
    "related": [
      "SORT",
      "UNIQUE",
      "XLOOKUP",
      "IFERROR"
    ]
  },
  {
    "id": "sequence",
    "name": "SEQUENCE",
    "category": "shape",
    "version": "2021",
    "weight": 4,
    "difficulty": 2,
    "syntax": "=SEQUENCE(행수, [열수], [시작값], [증가분])",
    "summary": "1, 2, 3처럼 규칙적으로 이어지는 숫자 배열을 한 번에 자동으로 만들어 스필한다.",
    "intro": "1, 2, 3처럼 규칙적으로 이어지는 숫자 배열을 한 번에 만들어 스필하는 함수입니다.\n\n- '몇 행 몇 열로, 몇부터, 몇씩'만 정하면 자동 생성(채우기 핸들 불필요)\n- 단독 순번은 물론 EDATE·거듭제곱과 결합해 납입일·보험료 추이 계산 — 동적 배열의 기본",
    "params": [
      {
        "name": "행수",
        "required": true,
        "desc": "만들 배열의 행(세로) 개수입니다. 예를 들어 5를 넣으면 세로로 5칸이 채워집니다."
      },
      {
        "name": "열수",
        "required": false,
        "desc": "배열의 열(가로) 개수입니다. 생략하면 1(한 열)입니다."
      },
      {
        "name": "시작값",
        "required": false,
        "desc": "첫 번째 숫자입니다. 생략하면 1부터 시작합니다."
      },
      {
        "name": "증가분",
        "required": false,
        "desc": "다음 숫자로 넘어갈 때 더할 값입니다. 생략하면 1씩 커집니다. 음수를 넣으면 줄어듭니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "1부터 5까지 세로로 만들기",
        "formula": "=SEQUENCE(5)",
        "result": "세로 5칸에 1, 2, 3, 4, 5가 자동으로 채워짐",
        "explain": "행수(5)만 정하면 나머지는 기본값(1열·1부터·1씩) — 순번 매기는 가장 간단한 사용법입니다."
      },
      {
        "level": "basic",
        "title": "10부터 5씩 커지는 숫자 만들기",
        "formula": "=SEQUENCE(5, 1, 10, 5)",
        "result": "세로 5칸에 10, 15, 20, 25, 30이 채워짐",
        "explain": "시작값(10)·증가분(5)으로 원하는 간격의 숫자열을 만들어 나이 구간·눈금 값에 유용합니다."
      },
      {
        "level": "advanced",
        "title": "매년 3%씩 오르는 10년 보험료 추이",
        "formula": "=B2*(1+0.03)^SEQUENCE(10, 1, 0, 1)",
        "result": "B2의 보험료가 매년 3%씩 인상된 10년치 금액이 세로로 스필됨",
        "explain": "0~9의 연차 지수를 만들어 (1+인상률)의 거듭제곱에 넣어 10년 추이를 한 번에 계산합니다."
      },
      {
        "level": "advanced",
        "title": "계약일 기준 12개월 납입일 만들기",
        "formula": "=EDATE(C2, SEQUENCE(12, 1, 0, 1))",
        "result": "C2(계약일)로부터 0~11개월 뒤 날짜 12개가 세로로 스필됨",
        "explain": "0~11의 개월 수를 만들고 EDATE가 그만큼 뒤 날짜를 계산해 월납 납입 일정표를 한 수식으로 완성합니다."
      }
    ],
    "related": [
      "RANDARRAY",
      "EDATE",
      "INDEX",
      "FILTER"
    ],
    "tips": "- 스필 — 아래·오른쪽 칸에 값이 있으면 #SPILL! 오류\n- 열수·시작값·증가분은 생략 가능(기본값 각각 1)\n- Excel 2021·Microsoft 365 전용"
  },
  {
    "id": "sort",
    "name": "SORT · SORTBY",
    "category": "shape",
    "version": "2021",
    "weight": 4,
    "difficulty": 3,
    "syntax": "=SORT(배열, [정렬기준], [정렬방향], [열기준])\n=SORTBY(배열, 기준배열1, [정렬방향1], [기준배열2], [정렬방향2], ...)",
    "summary": "원본은 그대로 두고 정렬된 결과만 새 위치에 펼쳐 주는 함수 짝 — 표 안의 열 번호로 정렬하면 SORT, 다른 범위·계산식을 기준으로 정렬하면 SORTBY.",
    "intro": "원본은 그대로 두고 정렬된 결과만 새 위치에 펼쳐(스필) 주는 자동 정렬 함수 짝입니다.\n\n- SORT: 표 안의 '몇 번째 열'을 기준으로 정렬(열기준=TRUE면 가로 방향)\n- SORTBY: 결과에 없는 다른 범위·계산식(손해율 등)을 기준으로, (기준, 방향) 짝으로 다단계 정렬\n- 원본이 바뀌면 정렬 결과도 자동 갱신",
    "params": [
      {
        "name": "배열",
        "required": true,
        "desc": "정렬해서 돌려줄 데이터 범위나 배열. SORT·SORTBY 공통 첫 인수입니다."
      },
      {
        "name": "정렬기준",
        "required": false,
        "desc": "[SORT 전용] 몇 번째 열(열기준=TRUE면 몇 번째 행)을 기준으로 삼을지. 생략하면 1(첫 열)입니다."
      },
      {
        "name": "정렬방향",
        "required": false,
        "desc": "[SORT 전용] 1=오름차순, -1=내림차순. 생략하면 1(오름차순)입니다."
      },
      {
        "name": "열기준",
        "required": false,
        "desc": "[SORT 전용] TRUE면 가로(열 방향)로, FALSE(기본)면 세로(행 방향)로 정렬합니다."
      },
      {
        "name": "기준배열1",
        "required": true,
        "desc": "[SORTBY 전용] 정렬 기준이 되는 범위나 계산식. 정렬할 배열과 개수(크기)가 같아야 하며, 결과에 표시되지 않아도 됩니다. (SORTBY에서는 필수)"
      },
      {
        "name": "정렬방향1",
        "required": false,
        "desc": "[SORTBY 전용] 1차 기준의 정렬 방향. 1=오름차순(기본), -1=내림차순."
      },
      {
        "name": "기준배열2 · 정렬방향2 …",
        "required": false,
        "desc": "[SORTBY 전용] 2차 이후의 정렬 기준과 방향. (기준, 방향) 짝을 순서대로 계속 이어 붙이면 1차·2차·3차 다단계 정렬이 됩니다(먼저 쓴 기준이 1차)."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "SORT — 값 오름차순 정렬",
        "formula": "=SORT(A2:A100)",
        "result": "A열 값이 작은 것부터 큰 것 순으로 스필",
        "explain": "인수 하나면 첫 열 기준 오름차순 — 원본은 그대로 두고 정렬본만 새로 펼쳐집니다."
      },
      {
        "level": "basic",
        "title": "SORT — 특정 열 기준 내림차순",
        "formula": "=SORT(A2:C100, 3, -1)",
        "result": "3번째 열(청구액)이 큰 순서대로 A:C 전체 행이 스필",
        "explain": "정렬기준=3(세 번째 열)·정렬방향=-1(내림차순)으로 청구액 큰 계약이 위로 옵니다."
      },
      {
        "level": "basic",
        "title": "SORTBY — 다른 열 기준으로 정렬",
        "formula": "=SORTBY(A2:A100, C2:C100, -1)",
        "result": "A열(이름)을 C열(청구액) 큰 순서대로 정렬해 이름만 스필",
        "explain": "결과엔 이름만 나오지만 정렬은 청구액 기준 — 기준 열을 결과에 포함하지 않아도 되는 게 SORT와의 차이입니다."
      },
      {
        "level": "advanced",
        "title": "SORT — 거른 뒤 정렬하기",
        "formula": "=SORT(FILTER(A2:C100, A2:A100=\"자동차\"), 3, -1)",
        "result": "자동차 계약만 골라 청구액 내림차순으로 스필",
        "explain": "안쪽 FILTER로 자동차만 추린 뒤 바깥 SORT로 청구액순 정렬하는 자주 쓰는 2단 조합입니다."
      },
      {
        "level": "advanced",
        "title": "SORT — 정렬된 고유 목록",
        "formula": "=SORT(UNIQUE(A2:A100))",
        "result": "A열의 중복 없는 값들을 가나다·오름차순으로 스필",
        "explain": "UNIQUE로 중복을 없앤 뒤 SORT로 정렬하면 드롭다운 원본으로 쓰기 좋은 '분류 목록'이 됩니다."
      },
      {
        "level": "advanced",
        "title": "SORTBY — 다단계 정렬(지역 → 청구액)",
        "formula": "=SORTBY(A2:C100, B2:B100, 1, C2:C100, -1)",
        "result": "지역(B) 오름차순, 같은 지역 안에서는 청구액(C) 내림차순으로 스필",
        "explain": "(기준배열, 정렬방향) 짝을 이어 붙이면 1차·2차·3차 정렬 — SORT의 단일 열 기준보다 다중 기준에 쉽습니다."
      },
      {
        "level": "advanced",
        "title": "SORTBY — 계산식(손해율) 기준 정렬",
        "formula": "=SORTBY(A2:A100, C2:C100/D2:D100, -1)",
        "result": "이름을 손해율(청구액÷보험료)이 높은 순으로 정렬해 스필",
        "explain": "기준 자리에 표에 없는 계산식을 바로 넣어 도우미 열 없이 손해율순 정렬합니다(SORT는 도우미 열 필요)."
      }
    ],
    "tips": "- 단일 열 기준은 SORT, 결과에 없는 범위·계산식이나 다중 기준은 SORTBY\n- SORTBY 기준배열은 정렬할 배열과 '개수'가 같아야 함 — 다르면 #VALUE! 오류\n- 원본은 그대로·별도 위치에 정렬본 생성, 공간이 막히면 #SPILL! 오류",
    "related": [
      "FILTER",
      "UNIQUE",
      "LARGE",
      "RANDARRAY",
      "SEQUENCE"
    ]
  },
  {
    "id": "textjoin",
    "name": "TEXTJOIN",
    "category": "shape",
    "version": "2019",
    "weight": 4,
    "difficulty": 2,
    "syntax": "=TEXTJOIN(구분기호, 빈셀무시, 텍스트1, [텍스트2], ...)",
    "summary": "여러 셀·문자열을 지정한 구분 기호로 이어 붙여 하나의 텍스트로 만든다.",
    "intro": "여러 셀·문자열을 지정한 구분 기호로 이어 붙여 하나의 텍스트로 만드는 함수입니다.\n\n- 구분 기호를 셀 사이마다 자동 삽입, 범위(A1:A10) 전체를 한 번에 처리\n- '빈 셀 무시'로 구분자 겹침 방지 — 명단 잇기·코드 조립·조건부 요약에 유용\n- TEXTSPLIT의 반대(붙이기), Excel 2019부터",
    "params": [
      {
        "name": "구분기호",
        "required": true,
        "desc": "값들 사이에 끼워 넣을 기호. \", \"(쉼표+공백), \"-\", \"/\" 등. 줄바꿈은 CHAR(10)을 씁니다."
      },
      {
        "name": "빈셀무시",
        "required": true,
        "desc": "빈 셀을 건너뛸지 여부. TRUE면 빈 칸을 무시해 구분 기호가 겹치지 않고, FALSE면 빈 칸도 그대로 이어 붙입니다."
      },
      {
        "name": "텍스트1",
        "required": true,
        "desc": "이어 붙일 첫 번째 값. 셀 하나, 범위(A1:A10), 또는 \"문자열\"을 직접 넣을 수 있어요."
      },
      {
        "name": "텍스트2 …",
        "required": false,
        "desc": "추가로 이어 붙일 값들. 여러 범위·문자열을 계속 나열할 수 있습니다(최대 252개)."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "이름 목록을 쉼표로 잇기",
        "formula": "=TEXTJOIN(\", \", TRUE, A2:A6)",
        "result": "A2:A6의 이름들이 \"김철수, 이영희, 박민수, ...\" 한 문장으로 연결됨",
        "explain": "세로 값을 한 줄로 모으는 기본 사용 — TRUE라서 빈 셀이 있어도 쉼표가 겹치지 않습니다."
      },
      {
        "level": "basic",
        "title": "조각을 이어 붙여 계약 코드 만들기",
        "formula": "=TEXTJOIN(\"-\", TRUE, \"P\", 2024, \"00123\")",
        "result": "\"P-2024-00123\"",
        "explain": "고정 문자열과 값을 하이픈으로 연결해 코드를 조립하며, 조각을 셀 참조로 바꾸면 자동 생성됩니다."
      },
      {
        "level": "advanced",
        "title": "조건에 맞는 값만 모아 한 셀에 요약",
        "formula": "=TEXTJOIN(\", \", TRUE, IF(C2:C500=\"생명보험\", B2:B500, \"\"))",
        "result": "product가 '생명보험'인 행의 계약자 이름만 쉼표로 이어진 한 문장",
        "explain": "IF로 조건에 안 맞는 값을 \"\"로 만들고 빈셀무시 TRUE가 건너뛰어 조건부 목록을 완성합니다(2019은 Ctrl+Shift+Enter)."
      },
      {
        "level": "advanced",
        "title": "FILTER와 결합해 고객별 계약 목록 만들기",
        "formula": "=TEXTJOIN(CHAR(10), TRUE, FILTER(D2:D500, A2:A500=F2))",
        "result": "F2 고객이 가진 계약번호들이 셀 안에서 줄바꿈으로 나열됨",
        "explain": "FILTER로 고객의 계약만 뽑아 TEXTJOIN으로 합쳐 한 셀에 보여줍니다 — CHAR(10)은 셀 안 줄바꿈('자동 줄 바꿈' 서식 권장, FILTER는 365·2021)."
      },
      {
        "level": "advanced",
        "title": "중복 없는 상품 목록을 한 줄로",
        "formula": "=TEXTJOIN(\" / \", TRUE, UNIQUE(C2:C500))",
        "result": "판매 상품의 고유 목록이 \"생명보험 / 건강 / 상해 / ...\"로 이어진 한 문장",
        "explain": "UNIQUE로 중복을 없앤 뒤 TEXTJOIN으로 합쳐 태그·범례용 요약 문자열을 만들며, 데이터가 늘면 자동 갱신됩니다(UNIQUE는 365·2021)."
      }
    ],
    "tips": "- 빈셀무시(2번째 인수)는 생략 불가 — 보통 TRUE로 구분자 겹침 방지\n- 숫자는 셀 서식이 무시되니 형식이 필요하면 TEXT로 감싸기(예: TEXT(A2,\"#,##0\"))\n- 결과가 32,767자를 넘으면 #VALUE! 오류, 다시 나누려면 TEXTSPLIT",
    "related": [
      "TEXTSPLIT",
      "CONCAT",
      "FILTER",
      "UNIQUE",
      "TEXT"
    ]
  },
  {
    "id": "unique",
    "name": "UNIQUE",
    "category": "shape",
    "version": "2021",
    "weight": 4,
    "difficulty": 2,
    "syntax": "=UNIQUE(배열, [열기준], [정확히한번])",
    "summary": "목록에서 중복을 없애고 서로 다른 값만 남겨 주는 함수.",
    "intro": "목록에서 중복을 없애고 서로 다른 값만 남겨 스필하는 함수입니다.\n\n- 여러 열을 넣으면 '열 조합'이 같은 것을 하나로 봐 고유 조합 반환\n- 세 번째 인수 TRUE면 '딱 한 번만 등장한 값'만 추출\n- COUNTA(UNIQUE(...))로 고유 개수, 스필 참조(E2#)로 자동 드롭다운",
    "params": [
      {
        "name": "배열",
        "required": true,
        "desc": "중복을 제거할 범위나 배열입니다."
      },
      {
        "name": "열기준",
        "required": false,
        "desc": "FALSE(기본)=행 단위로 비교(각 행이 한 레코드), TRUE=열 단위로 비교합니다."
      },
      {
        "name": "정확히한번",
        "required": false,
        "desc": "FALSE(기본)=중복은 하나로 합쳐 모두 표시, TRUE=정확히 한 번만 나온 값만 표시합니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "중복 제거",
        "formula": "=UNIQUE(A2:A100)",
        "result": "A열의 서로 다른 값만 한 번씩 스필",
        "explain": "상품·지역·담당자 열에서 '어떤 종류가 있는지'를 한 번에 뽑는 기본 사용입니다."
      },
      {
        "level": "basic",
        "title": "여러 열 조합의 고유값",
        "formula": "=UNIQUE(A2:B100)",
        "result": "A·B 두 열 조합이 겹치지 않는 행만 스필",
        "explain": "여러 열을 넣으면 '조합'이 같은 것을 하나로 봐 (상품, 지역) 조합 목록을 만듭니다."
      },
      {
        "level": "advanced",
        "title": "고유 개수 세기",
        "formula": "=COUNTA(UNIQUE(A2:A100))",
        "result": "서로 다른 값이 몇 개인지 숫자 하나 반환",
        "explain": "COUNTA로 감싸면 '몇 종류인지'가 나와 거래 상품 종류 수를 셀 때 유용합니다."
      },
      {
        "level": "advanced",
        "title": "딱 한 번만 나온 값",
        "formula": "=UNIQUE(A2:A100, FALSE, TRUE)",
        "result": "목록에서 정확히 1회만 등장한 값만 스필",
        "explain": "정확히한번=TRUE면 중복은 빼고 한 번만 나온 값만 남겨, 청구 1건뿐인 계약 찾기 등에 씁니다."
      },
      {
        "level": "advanced",
        "title": "조건 충족 항목의 정렬된 고유 목록 → 자동 드롭다운",
        "formula": "=SORT(UNIQUE(FILTER(A2:A100, C2:C100>0)))",
        "result": "청구액이 있는 계약의 상품만 골라 중복 제거·정렬해 스필. 이 셀 주소에 #를 붙여(예: E2#) 데이터 유효성 목록으로 지정하면 자동 확장 드롭다운",
        "explain": "FILTER→UNIQUE→SORT 3단 조합으로 '조건에 맞는 깔끔한 분류 목록'을 만들고, 스필 참조(#)로 늘었다 줄었다 하는 드롭다운을 만듭니다."
      }
    ],
    "tips": "- 고유 개수는 COUNTA(UNIQUE(...)) 또는 ROWS(UNIQUE(...))\n- 빈 셀이 섞이면 0(빈 값)이 하나의 고유값으로 잡힐 수 있음\n- 열기준 없이 여러 열을 넣으면 '행 조합' 기준으로 중복 판단",
    "related": [
      "FILTER",
      "SORT",
      "COUNTIF",
      "COUNTA"
    ]
  },
  {
    "id": "vstack",
    "name": "VSTACK · HSTACK",
    "category": "shape",
    "version": "365",
    "weight": 4,
    "difficulty": 2,
    "syntax": "=VSTACK(배열1, [배열2], ...)\n=HSTACK(배열1, [배열2], ...)",
    "summary": "여러 개의 표·범위를 VSTACK은 위아래(세로)로, HSTACK은 좌우(가로)로 이어 붙여 하나의 배열로 결합한다.",
    "intro": "여러 표·범위를 VSTACK은 위아래(세로)로, HSTACK은 좌우(가로)로 이어 붙여 하나의 배열로 결합하는 짝 함수입니다.\n\n- 행을 늘리면 VSTACK, 열을 늘리면 HSTACK — 결과는 스필, 원본 변경 시 자동 갱신\n- 크기가 안 맞는 칸은 #N/A로 채워짐 → VSTACK은 '열 개수', HSTACK은 '행 개수'를 맞추기\n- 둘을 조합하면 머리글·본문을 붙여 표를 통째로 조립",
    "params": [
      {
        "name": "배열1",
        "required": true,
        "desc": "이어 붙일 첫 번째 범위나 배열. VSTACK에서는 맨 위, HSTACK에서는 맨 왼쪽에 놓입니다."
      },
      {
        "name": "배열2, ...",
        "required": false,
        "desc": "두 번째 이후에 순서대로 이어 붙일 범위·배열(최대 255개). VSTACK은 그 아래로, HSTACK은 그 오른쪽으로 붙습니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "[VSTACK] 두 목록을 세로로 이어 붙이기",
        "formula": "=VSTACK(A2:A5, C2:C5)",
        "result": "A2:A5의 값 아래에 C2:C5의 값이 이어진 한 열(8행) 스필 배열",
        "explain": "떨어진 두 목록을 위아래로 합쳐 한 목록으로 만들며, 한 칸 입력으로 8칸이 자동 스필됩니다."
      },
      {
        "level": "basic",
        "title": "[HSTACK] 떨어진 두 열을 가로로 나란히 붙이기",
        "formula": "=HSTACK(A2:A6, D2:D6)",
        "result": "A열 값과 D열 값이 좌우로 나란히 놓인 2열(5행) 배열",
        "explain": "떨어진 두 열을 옆으로 붙여 한 표로 만들어, 필요한 열만 골라 새 표를 구성할 때 편리합니다."
      },
      {
        "level": "basic",
        "title": "[VSTACK] 여러 시트의 표를 세로로 합치기",
        "formula": "=VSTACK('1월'!A2:C10, '2월'!A2:C10)",
        "result": "1월·2월 시트의 3열짜리 표가 세로로 이어진 배열(최대 18행)",
        "explain": "월별로 나뉜 계약 표를 한 곳에 모으며, 열 구조(3열)가 같으면 그대로 아래로 이어집니다."
      },
      {
        "level": "advanced",
        "title": "[VSTACK] 머리글은 유지하고 조건에 맞는 행만 합치기",
        "formula": "=VSTACK(A1:C1, FILTER(A2:C100, C2:C100>=1000000))",
        "result": "1행 머리글 아래에 청구액(claim_amt) 100만원 이상인 행만 이어진 표",
        "explain": "머리글을 맨 위에 두고 아래에 FILTER로 걸러낸 데이터만 붙여, 보고서용 표를 수식 하나로 완성합니다."
      },
      {
        "level": "advanced",
        "title": "[HSTACK] 원래 표 옆에 계산한 열 덧붙이기",
        "formula": "=HSTACK(A2:B10, B2:B10*0.02)",
        "result": "이름·보험료(premium) 표 오른쪽에 '보험료×2%' 계산 열이 추가된 3열 배열",
        "explain": "기존 표 옆에 계산 결과 열을 나란히 붙여, 원본을 건드리지 않고 파생 열을 즉석에서 추가합니다."
      },
      {
        "level": "advanced",
        "title": "[VSTACK+HSTACK] 세로·가로 쌓기로 표 통째로 조립하기",
        "formula": "=VSTACK({\"상품\",\"보험료\"}, HSTACK(A2:A10, B2:B10))",
        "result": "머리글 행 아래에 상품·보험료 두 열을 붙인 완성형 표",
        "explain": "HSTACK으로 열을 붙이고 VSTACK으로 머리글을 위에 올려, 두 함수 조합으로 원하는 표를 자유롭게 구성합니다."
      },
      {
        "level": "advanced",
        "title": "[VSTACK] 합친 뒤 중복 제거하고 정렬하기",
        "formula": "=SORT(UNIQUE(VSTACK(상품A!B2:B200, 상품B!B2:B200)))",
        "result": "두 시트의 상품(product) 코드를 합친 뒤 중복을 없애고 오름차순 정렬한 목록",
        "explain": "VSTACK으로 코드를 모으고 UNIQUE로 중복 제거·SORT로 정렬하는, 통합 마스터 목록 조합입니다."
      }
    ],
    "tips": "- 행 추가는 VSTACK, 열 추가는 HSTACK\n- 크기가 안 맞으면 부족한 칸이 #N/A — VSTACK은 '열 개수', HSTACK은 '행 개수'를 맞추기(IFERROR로 처리 가능)\n- 최대 255개 배열까지, 조합하면 표를 통째로 조립",
    "related": [
      "TOCOL",
      "TOROW",
      "CHOOSECOLS",
      "FILTER",
      "SORT",
      "UNIQUE"
    ]
  },
  {
    "id": "chooserows",
    "name": "CHOOSEROWS · CHOOSECOLS",
    "category": "shape",
    "version": "365",
    "weight": 3,
    "difficulty": 2,
    "syntax": "=CHOOSEROWS(배열, 행번호1, [행번호2], …)  /  =CHOOSECOLS(배열, 열번호1, [열번호2], …)",
    "summary": "표에서 원하는 행(CHOOSEROWS)이나 열(CHOOSECOLS)만 골라 뽑는다. 떨어져 있어도, 순서를 바꿔도 OK.",
    "intro": "CHOOSEROWS는 원하는 '행'만, CHOOSECOLS는 원하는 '열'만 골라 뽑는 함수입니다.\n\n- 떨어져 있는 행·열도 한 번에 뽑고 순서도 마음대로 재배치\n- 음수 번호는 끝에서부터(-1=마지막) — '최근 3건'·'맨 뒤 열'에 편리\n- 연속 구간은 TAKE·DROP, 떨어진 것·재배치는 CHOOSEROWS·CHOOSECOLS",
    "params": [
      {
        "name": "배열",
        "required": true,
        "desc": "행·열을 골라낼 원본 표나 셀 범위입니다."
      },
      {
        "name": "행번호 / 열번호",
        "required": true,
        "desc": "뽑을 행(CHOOSEROWS) 또는 열(CHOOSECOLS)의 번호입니다. 1부터 시작하며, 음수는 끝에서부터 셉니다(-1=마지막)."
      },
      {
        "name": "행번호2, 행번호3, …",
        "required": false,
        "desc": "추가로 뽑을 행·열 번호입니다. 나열한 순서대로 결과가 배치됩니다. 필요한 만큼 이어서 넣을 수 있습니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "필요한 열만 골라 뽑기",
        "formula": "=CHOOSECOLS(A2:F10, 1, 3)",
        "result": "A~F 표에서 1열과 3열만 뽑아 2열로 스필",
        "explain": "계약번호(1열)·보험료(3열)처럼 필요한 열만 골라 옮기고 중간 2열은 건너뜁니다."
      },
      {
        "level": "basic",
        "title": "떨어져 있는 행만 뽑기",
        "formula": "=CHOOSEROWS(A2:C10, 1, 3, 5)",
        "result": "1·3·5번째 행만 뽑아 3행으로 스필",
        "explain": "떨어진 행도 번호만 나열하면 한 번에 뽑히고, 나열 순서대로 뽑힙니다."
      },
      {
        "level": "advanced",
        "title": "최근 3건(맨 뒤 행) 뽑기",
        "formula": "=CHOOSEROWS(A2:C100, -3, -2, -1)",
        "result": "표의 마지막 3개 행이 원래 순서대로 스필",
        "explain": "음수 번호는 끝에서부터 세, -3·-2·-1은 마지막 3행 — 최신 청구 3건처럼 '맨 아래 몇 건'에 편리합니다."
      },
      {
        "level": "advanced",
        "title": "열 순서를 보고서용으로 재배치",
        "formula": "=CHOOSECOLS(A2:E100, 5, 1, 3)",
        "result": "5열 → 1열 → 3열 순서로 열을 재배열해 스필",
        "explain": "원본 순서와 무관하게 열을 재배치 — 상품명(5열)을 맨 앞으로 옮겨 보고서용 열 순서를 만듭니다."
      },
      {
        "level": "advanced",
        "title": "표를 위아래로 뒤집기",
        "formula": "=CHOOSEROWS(A2:A100, SEQUENCE(99, , 99, -1))",
        "result": "행 순서가 완전히 거꾸로 뒤집혀 스필",
        "explain": "SEQUENCE(99,,99,-1)의 역순 번호대로 행을 뽑아 표를 뒤집어, 오래된순↔최신순 전환에 활용합니다."
      }
    ],
    "related": [
      "TAKE",
      "DROP",
      "INDEX",
      "FILTER",
      "SEQUENCE"
    ],
    "tips": "- 번호는 1부터(0은 오류), 존재하지 않는 번호는 #VALUE! 오류\n- 연속 범위는 TAKE·DROP, 떨어진 것·순서 변경은 CHOOSEROWS·CHOOSECOLS\n- Microsoft 365 전용"
  },
  {
    "id": "groupby",
    "name": "GROUPBY",
    "category": "shape",
    "version": "365",
    "weight": 3,
    "difficulty": 4,
    "syntax": "=GROUPBY(행필드, 값, 집계함수, [머리글], [총합계깊이], [정렬순서], [필터배열], [필드관계])",
    "summary": "수식 한 줄로 기준별 그룹을 묶고 합계·평균·개수 등을 집계해 요약표를 스필한다.",
    "intro": "기준별 그룹을 묶고 합계·평균·개수 등을 집계해 요약표를 스필하는, 피벗 테이블의 수식 버전입니다.\n\n- '기준·값·집계함수'만 필수 — 나머지(머리글·총합계·정렬·필터)는 선택\n- 집계에 SUM·AVERAGE·COUNT·MAX·PERCENTOF·LAMBDA 사용, 원본 변경 시 즉시 갱신\n- Microsoft 365 전용의 비교적 새 함수",
    "params": [
      {
        "name": "행필드",
        "required": true,
        "desc": "그룹으로 묶을 기준 열(예: 상품 product 열). 두 개 이상 열을 함께 주면 계층형으로 묶입니다."
      },
      {
        "name": "값",
        "required": true,
        "desc": "집계할 대상 열(예: 보험료 premium, 청구액 claim_amt). 여러 열을 HSTACK으로 묶어 함께 집계할 수도 있어요."
      },
      {
        "name": "집계함수",
        "required": true,
        "desc": "묶은 값을 계산할 방법. SUM·AVERAGE·COUNT·MAX·MIN·PERCENTOF 등을 괄호 없이 이름만 넣거나 LAMBDA를 넣습니다."
      },
      {
        "name": "머리글",
        "required": false,
        "desc": "데이터에 머리글이 있는지·표시할지 설정. 0=자동, 1=없음, 2=있음(감춤), 3=있음(표시)."
      },
      {
        "name": "총합계깊이",
        "required": false,
        "desc": "총합계·소계 표시. 0=없음, 1=총합계, 2=총합계+소계. 음수(-1,-2)는 아래쪽에 표시."
      },
      {
        "name": "정렬순서",
        "required": false,
        "desc": "정렬할 열 번호. 양수면 오름차순, 음수면 내림차순(예: -2 = 두 번째 열 기준 내림차순)."
      },
      {
        "name": "필터배열",
        "required": false,
        "desc": "포함할 행만 남기는 TRUE/FALSE 배열. 특정 조건(예: 특정 지역)만 집계할 때 씁니다."
      },
      {
        "name": "필드관계",
        "required": false,
        "desc": "행 기준을 여러 개 줬을 때의 관계. 0=계층형, 1=테이블형(조합별 나열)."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "상품별 보험료 합계",
        "formula": "=GROUPBY(C2:C500, D2:D500, SUM)",
        "result": "C열(상품)별로 묶어 D열(보험료) 합계를 낸 2열 요약표가 스필됨",
        "explain": "기준·값·집계함수만 주는 기본 사용 — SUM은 괄호 없이 이름만 넣어 피벗 없이 상품별 합계표가 생깁니다."
      },
      {
        "level": "basic",
        "title": "지역별 계약 건수 세기",
        "formula": "=GROUPBY(A2:A500, A2:A500, COUNT)",
        "result": "지역별로 몇 건인지 세어 지역-건수 표로 펼침",
        "explain": "집계함수에 COUNT를 넣으면 건수를 세며, 값 열에 기준 열을 그대로 넣어도 정확합니다."
      },
      {
        "level": "advanced",
        "title": "상품별 청구액 합계·평균·건수 한 번에",
        "formula": "=GROUPBY(C2:C500, HSTACK(E2:E500, E2:E500, E2:E500), HSTACK(SUM, AVERAGE, COUNT), 3, 1)",
        "result": "상품별로 청구액 합계·평균·건수 3개 열을 나란히, 머리글 표시(3)와 맨 위 총합계(1)까지 포함",
        "explain": "값·집계함수를 HSTACK으로 묶으면 다중 집계표를 만들고, 머리글 3·총합계깊이 1로 제목·합계 줄이 붙습니다."
      },
      {
        "level": "advanced",
        "title": "지역·상품 2단 그룹 + 보험료 큰 순 정렬",
        "formula": "=GROUPBY(HSTACK(A2:A500, C2:C500), D2:D500, SUM, 3, 2, -3)",
        "result": "지역>상품 계층으로 묶어 보험료 합계를 내고, 소계·총합계 포함, 합계 열(3번째) 기준 내림차순 정렬",
        "explain": "행 기준 두 개를 HSTACK으로 주면 지역>상품 계층 요약 — 정렬순서 -3은 합계 열 내림차순, 총합계깊이 2는 소계+총합계입니다."
      },
      {
        "level": "advanced",
        "title": "조건 필터 + 상품별 비중(%) 계산",
        "formula": "=GROUPBY(C2:C500, D2:D500, PERCENTOF, 3, 0, -2, B2:B500=\"영업1팀\")",
        "result": "영업1팀 계약만 걸러(필터배열) 상품별 보험료가 전체에서 차지하는 비중(%)을 큰 순으로 나열",
        "explain": "PERCENTOF로 각 그룹의 전체 대비 비중을 구하고, 필터배열로 영업1팀만·정렬순서 -2로 비중 큰 상품부터 보여 줍니다."
      }
    ],
    "tips": "- 집계함수는 SUM(...)로 실행하지 말고 이름만 넣기(엔진이 그룹마다 적용)\n- 스필 — 아래·오른쪽 셀을 비우지 않으면 #SPILL! 오류\n- 표(테이블) 구조면 데이터가 늘어도 요약표가 자동 확장\n- 교차표가 필요하면 PIVOTBY, 365 채널·버전에 따라 아직 없을 수 있음",
    "related": [
      "PIVOTBY",
      "SUM",
      "AVERAGE",
      "PERCENTOF",
      "LAMBDA",
      "HSTACK",
      "FILTER"
    ]
  },
  {
    "id": "pivotby",
    "name": "PIVOTBY",
    "category": "shape",
    "version": "365",
    "weight": 3,
    "difficulty": 4,
    "syntax": "=PIVOTBY(행_필드, 열_필드, 값, 집계함수, [머리글], [행_총계], [행_정렬], [열_총계], [열_정렬], [필터], [상대피벗])",
    "summary": "표 데이터를 함수 한 줄로 피벗 테이블처럼 교차 요약(Microsoft 365 전용)",
    "intro": "표 데이터를 수식 한 줄로 피벗 테이블처럼 교차 요약(크로스탭)해 스필하는 함수입니다.\n\n- 행 기준·열 기준·값·집계함수를 지정하면 교차표가 자동 확장, 원본 변경 시 재계산\n- 한 방향 요약은 GROUPBY, 두 방향 교차 집계는 PIVOTBY\n- Microsoft 365 전용(2021 이하 없음)",
    "params": [
      {
        "name": "행_필드",
        "required": true,
        "desc": "행(세로)으로 묶을 기준 열. 예: 상품 열 → 상품마다 한 행"
      },
      {
        "name": "열_필드",
        "required": true,
        "desc": "열(가로)로 묶을 기준 열. 예: 지역 열 → 지역마다 한 열. (행·열 중 최소 하나는 있어야 함)"
      },
      {
        "name": "값",
        "required": true,
        "desc": "집계할 값이 든 열. 예: 보험료, 청구액. 개수를 셀 땐 세고 싶은 항목 열"
      },
      {
        "name": "집계함수",
        "required": true,
        "desc": "계산 방식. SUM(합계)·AVERAGE(평균)·COUNTA(개수)·MAX·MIN·PERCENTOF(비중) 등, 또는 LAMBDA로 직접 정의"
      },
      {
        "name": "머리글",
        "required": false,
        "desc": "데이터에 제목행이 있는지·표시할지. 0=없음, 1=있음(숨김), 2=없음(생성), 3=있음(표시)"
      },
      {
        "name": "행_총계",
        "required": false,
        "desc": "행 방향 총계 깊이. 0=없음, 1=총합계, 2=총합계+소계. 음수면 위쪽에 표시"
      },
      {
        "name": "행_정렬",
        "required": false,
        "desc": "행 정렬 기준 열 번호. 양수=오름차순, 음수=내림차순"
      },
      {
        "name": "열_총계",
        "required": false,
        "desc": "열 방향 총계 깊이(행_총계와 동일한 규칙)"
      },
      {
        "name": "열_정렬",
        "required": false,
        "desc": "열 정렬 기준(양수=오름/음수=내림)"
      },
      {
        "name": "필터",
        "required": false,
        "desc": "포함할 행을 TRUE/FALSE로 지정하는 배열. 예: (계약[상태]=\"유효\") → 유효 계약만 집계"
      },
      {
        "name": "상대피벗",
        "required": false,
        "desc": "상대적 피벗 계산 사용 여부(고급 옵션, 보통 생략)"
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "상품 × 지역 보험료 합계",
        "formula": "=PIVOTBY(계약[상품], 계약[지역], 계약[보험료], SUM)",
        "result": "행=상품, 열=지역인 교차표가 자동으로 펼쳐지고 각 칸에 보험료 합계, 가장자리에 총합계가 표시됨",
        "explain": "상품·지역으로 나눈 보험료 합계를 피벗 테이블 없이 함수 하나로 요약합니다."
      },
      {
        "level": "basic",
        "title": "상품 × 가입연도 계약 건수",
        "formula": "=PIVOTBY(계약[상품], 계약[가입연도], 계약[계약번호], COUNTA)",
        "result": "상품(행) × 가입연도(열)별 계약 '건수' 표가 스필로 확장되어 표시",
        "explain": "COUNTA를 쓰면 '몇 건'인지 세며, 값 자리에 세고 싶은 항목(계약번호)을 넣습니다."
      },
      {
        "level": "advanced",
        "title": "비중(%)으로 보기 — PERCENTOF",
        "formula": "=PIVOTBY(계약[상품], 계약[채널], 계약[보험료], PERCENTOF)",
        "result": "각 칸이 전체 보험료 대비 그 상품·채널의 비율(%)로 표시됨",
        "explain": "PERCENTOF를 넣으면 '전체에서 차지하는 비중'을 계산해 상품·채널 구성비를 바로 파악합니다."
      },
      {
        "level": "advanced",
        "title": "유효 계약만 + 총계·머리글 옵션",
        "formula": "=PIVOTBY(계약[상품], 계약[가입연도], 계약[보험료], SUM, 3, 1, , , , (계약[상태]=\"유효\"))",
        "result": "상태가 '유효'인 행만 집계한 상품×연도 보험료 합계표(머리글 표시, 총합계 1단)",
        "explain": "선택 인수로 머리글 표시(3)·총계 1단(1)·필터로 '유효' 계약만 포함하며, 안 쓰는 인수는 콤마로 자리를 비웁니다."
      },
      {
        "level": "advanced",
        "title": "사용자 정의 집계 — LAMBDA로 중앙값",
        "formula": "=PIVOTBY(청구[상품], 청구[가입연도], 청구[청구액], LAMBDA(값들, MEDIAN(값들)))",
        "result": "상품 × 가입연도별 청구액의 '중앙값'이 담긴 교차표",
        "explain": "LAMBDA로 원하는 계산도 넣을 수 있어, 큰 청구 건에 흔들리는 평균 대신 중앙값을 대푯값으로 봅니다."
      }
    ],
    "related": [
      "GROUPBY",
      "SUMIFS",
      "AVERAGEIFS",
      "COUNTIFS",
      "LAMBDA"
    ],
    "tips": "- 행·열 기준 중 최소 하나는 필요, 한 방향만이면 GROUPBY가 간단\n- 선택 인수는 순서가 중요 — 중간을 건너뛸 땐 콤마로 자리 비우기\n- 스필 — 아래·오른쪽 셀이 막혀 있으면 #SPILL! 오류"
  },
  {
    "id": "take",
    "name": "TAKE · DROP",
    "category": "shape",
    "version": "365",
    "weight": 3,
    "difficulty": 3,
    "syntax": "=TAKE(배열, 행수, [열수])\n=DROP(배열, 행수, [열수])",
    "summary": "TAKE는 표의 처음·끝에서 지정한 수만큼 행·열을 잘라 가져오고, DROP은 반대로 그만큼을 떼어내고 나머지를 돌려준다.",
    "intro": "TAKE는 표의 처음·끝에서 지정한 수만큼 행·열을 가져오고, DROP은 반대로 그만큼 떼어내고 나머지를 돌려주는 짝 함수입니다.\n\n- 양수는 처음(위/왼쪽)에서, 음수는 끝(아래/오른쪽)에서 — 두 번째 인수를 쉼표로 비우면 열만 다룸\n- 남길 때 TAKE(상위 10건), 버릴 때 DROP(머리글 제거)\n- 겹쳐 쓰면 =TAKE(DROP(범위,10),10)처럼 중간 구간(11~20행)도 추출",
    "params": [
      {
        "name": "배열",
        "required": true,
        "desc": "잘라 오거나(TAKE) 일부를 제거하고 나머지를 돌려줄(DROP) 원본 범위나 배열."
      },
      {
        "name": "행수",
        "required": true,
        "desc": "다룰 행 수. 양수=처음(위)에서, 음수=끝(아래)에서. TAKE는 그만큼 '가져오고', DROP은 '제거'(제목 행 제거는 1). 열만 지정하려면 쉼표로 자리 비우기."
      },
      {
        "name": "열수",
        "required": false,
        "desc": "다룰 열 수. 양수=왼쪽에서, 음수=오른쪽에서. TAKE는 해당 열만 남기고, DROP은 해당 열을 제거합니다. 생략하면 모든 열을 그대로 유지합니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "[TAKE] 처음 5행만 가져오기",
        "formula": "=TAKE(A2:C100, 5)",
        "result": "A2:C100에서 맨 위 5개 행(3열) 배열",
        "explain": "표에서 위쪽 5줄만 잘라와 미리보기·상위 항목 확인에 씁니다."
      },
      {
        "level": "basic",
        "title": "[DROP] 제목 행 떼어내고 데이터만 남기기",
        "formula": "=DROP(A1:C100, 1)",
        "result": "머리글(1행)을 제외한 A2:C100 데이터 배열",
        "explain": "표의 첫 줄(제목)을 떼어내고 순수 데이터만 얻는, DROP의 가장 흔한 쓰임입니다."
      },
      {
        "level": "advanced",
        "title": "[TAKE] 청구액 상위 10건(Top 10) 뽑기",
        "formula": "=TAKE(SORT(A2:C100, 3, -1), 10)",
        "result": "청구액(3번째 열) 내림차순 정렬 후 상위 10개 행",
        "explain": "SORT로 청구액 내림차순 정렬 후 TAKE로 위에서 10건만 잘라내는 '상위 N개' 대표 조합입니다."
      },
      {
        "level": "advanced",
        "title": "[DROP] 머리글 제거 후 정렬하기",
        "formula": "=SORT(DROP(A1:C100, 1), 3, -1)",
        "result": "제목 행을 뺀 데이터를 청구액(3번째 열) 내림차순으로 정렬한 배열",
        "explain": "DROP으로 머리글을 떼고 데이터만 SORT에 넘겨, 머리글이 섞여 정렬이 어긋나는 문제를 막습니다."
      },
      {
        "level": "advanced",
        "title": "[TAKE+DROP] 중간 구간(11~20행)만 잘라내기",
        "formula": "=TAKE(DROP(A2:C1000, 10), 10)",
        "result": "앞 10행을 버린 뒤 그다음 10행 — 즉 11~20번째 행",
        "explain": "DROP으로 앞 10줄을 버리고 TAKE로 다음 10줄만 가져오는, 표 중간 구간(11~20위) 추출 조합입니다."
      }
    ],
    "tips": "- 남길 때 TAKE, 버릴 때 DROP — 양수=처음에서, 음수=끝에서\n- 두 번째 인수를 쉼표로 비우면 열만 다룸(예: =TAKE(범위,,2))\n- TAKE는 크기보다 크면 있는 만큼, DROP은 전체 이상 제거 시 #CALC! 오류",
    "related": [
      "CHOOSEROWS",
      "CHOOSECOLS",
      "SORT",
      "FILTER"
    ]
  },
  {
    "id": "textsplit",
    "name": "TEXTSPLIT",
    "category": "shape",
    "version": "365",
    "weight": 3,
    "difficulty": 2,
    "syntax": "=TEXTSPLIT(문자열, 열구분기호, [행구분기호], [빈값무시], [대소문자구분], [빈셀채움])",
    "summary": "한 셀의 문자열을 구분 기호로 잘라 여러 셀로 펼친다(가로·세로 동시 가능).",
    "intro": "한 셀의 문자열을 구분 기호로 잘라 여러 셀로 펼치는(스필) 함수입니다.\n\n- 열 구분 기호만 주면 가로로, 행 구분 기호까지 주면 2차원 격자로 분할\n- 원본을 건드리지 않고 계약번호·주소·코드 분리에 편리\n- Microsoft 365 전용",
    "params": [
      {
        "name": "문자열",
        "required": true,
        "desc": "나눌 원본 텍스트(셀 참조 또는 \"...\" 직접 입력)."
      },
      {
        "name": "열구분기호",
        "required": true,
        "desc": "열(좌→우)을 나눌 기호. \",\"처럼 하나만 주거나 {\",\",\";\"}처럼 여러 기호를 배열로 줄 수 있어요."
      },
      {
        "name": "행구분기호",
        "required": false,
        "desc": "행(위→아래)을 나눌 기호. 지정하면 결과가 2차원 격자로 펼쳐집니다."
      },
      {
        "name": "빈값무시",
        "required": false,
        "desc": "구분 기호가 연달아 나올 때 생기는 빈 칸을 무시할지 여부. TRUE면 빈 칸을 건너뜁니다(기본 FALSE=빈 칸 생성)."
      },
      {
        "name": "대소문자구분",
        "required": false,
        "desc": "구분 기호의 대/소문자를 구분할지. 0(기본)=구분함, 1=구분 안 함."
      },
      {
        "name": "빈셀채움",
        "required": false,
        "desc": "행·열 개수가 안 맞아 생기는 빈 셀에 넣을 값. 생략하면 그 자리에 #N/A가 표시됩니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "쉼표로 이름 나누기",
        "formula": "=TEXTSPLIT(\"김철수,이영희,박민수\", \",\")",
        "result": "세 개의 이름이 좌→우 3칸으로 펼쳐짐: 김철수 | 이영희 | 박민수",
        "explain": "쉼표로 붙은 글자를 잘라 옆으로 펼치는 단순 사용 — 열 구분 기호만 있으면 가로로 스필됩니다."
      },
      {
        "level": "basic",
        "title": "계약번호를 조각내기",
        "formula": "=TEXTSPLIT(A2, \"-\")",
        "result": "A2의 \"P-2024-00123\"이 P | 2024 | 00123 세 칸으로 분리",
        "explain": "하이픈으로 이어진 코드를 부분별로 나눠 상품기호·연도·일련번호를 각 열로 떼어냅니다."
      },
      {
        "level": "advanced",
        "title": "여러 구분 기호로 한 번에 자르기 + 빈 칸 무시",
        "formula": "=TEXTSPLIT(A2, {\",\",\";\",\" \"}, , TRUE)",
        "result": "쉼표·세미콜론·공백 어느 것으로 구분되어 있든 모두 잘라 나누고, 연달아 나온 구분자로 생기는 빈 칸은 건너뜀",
        "explain": "구분 기호를 배열 {}로 여러 개 넘겨 형식이 제각각인 데이터를 정리하고, 빈값무시 TRUE로 \"A,,B\"의 빈 칸을 없앱니다."
      },
      {
        "level": "advanced",
        "title": "행·열 동시 분할로 2차원 표 복원",
        "formula": "=TEXTSPLIT(A1, \",\", \";\", , , \"\")",
        "result": "\"생명,100;건강,80;상해,60\"을 쉼표는 열, 세미콜론은 행으로 나눠 3행×2열 표로 펼침(빈 칸은 공백 처리)",
        "explain": "열·행 구분을 함께 주면 한 셀의 문자열을 격자 표로 되살리고, 빈셀채움 \"\"로 #N/A 대신 빈 칸을 표시합니다."
      },
      {
        "level": "advanced",
        "title": "분리한 조각 중 특정 위치만 뽑기",
        "formula": "=INDEX(TEXTSPLIT(A2, \"-\"), 1, 2)",
        "result": "A2의 \"P-2024-00123\"에서 두 번째 조각인 \"2024\"만 반환",
        "explain": "스필 결과를 INDEX로 감싸면 원하는 조각(예: 연도)만 집어내, 보조 열 없이 바로 계산에 씁니다."
      }
    ],
    "tips": "- 구분 기호는 기본이 대소문자 구분 — 알파벳 구분자 주의\n- 조각 개수가 행마다 다르면 짧은 쪽에 #N/A → 빈셀채움 지정\n- 앞뒤 공백이 함께 잘릴 수 있어 필요하면 TRIM, 한쪽만 필요하면 TEXTBEFORE·TEXTAFTER",
    "related": [
      "TEXTJOIN",
      "TEXTBEFORE",
      "TEXTAFTER",
      "TRIM",
      "INDEX"
    ]
  },
  {
    "id": "tocol",
    "name": "TOCOL · TOROW",
    "category": "shape",
    "version": "365",
    "weight": 3,
    "difficulty": 3,
    "syntax": "=TOCOL(배열, [무시할값], [열우선])  /  =TOROW(배열, [무시할값], [열우선])",
    "summary": "2차원 표를 한 열(TOCOL)이나 한 행(TOROW)으로 납작하게 편다. 빈칸·오류를 걸러낼 수 있다.",
    "intro": "TOCOL은 2차원 표를 '한 열'로, TOROW는 '한 행'으로 납작하게 펴 흩어진 값을 하나의 목록으로 모으는 함수입니다.\n\n- 무시할값으로 빈칸·오류를 걸러냄(1=빈칸, 2=오류, 3=둘 다)\n- UNIQUE·SORT와 함께 여러 열의 정렬된 고유 목록 추출, 반대는 WRAPROWS·WRAPCOLS",
    "params": [
      {
        "name": "배열",
        "required": true,
        "desc": "한 열·한 행으로 펼칠 원본 표나 셀 범위입니다."
      },
      {
        "name": "무시할값",
        "required": false,
        "desc": "걸러낼 값을 정합니다. 0(또는 생략)=모두 포함, 1=빈칸 무시, 2=오류 무시, 3=빈칸·오류 모두 무시."
      },
      {
        "name": "열우선",
        "required": false,
        "desc": "TRUE면 열(세로) 방향으로 먼저 훑고, FALSE(기본)면 행(가로) 방향으로 먼저 훑어 담습니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "표 전체를 한 열로 펴기",
        "formula": "=TOCOL(A2:C5)",
        "result": "3열×4행의 값들이 한 열(12칸)로 정렬됨",
        "explain": "흩어진 2차원 표를 하나의 세로 목록으로 만들며, 기본은 행 방향(가로줄 먼저)으로 훑습니다."
      },
      {
        "level": "basic",
        "title": "표를 한 행으로 펴기",
        "formula": "=TOROW(A2:C5)",
        "result": "같은 값들이 한 행(가로 12칸)으로 정렬됨",
        "explain": "TOCOL과 방향만 달라, 여러 칸의 값을 한 줄로 옆으로 늘어놓을 때 씁니다."
      },
      {
        "level": "advanced",
        "title": "여러 열에 흩어진 상품명을 고유 목록으로",
        "formula": "=SORT(UNIQUE(TOCOL(B2:E100, 1)))",
        "result": "B~E 4개 열에 흩어진 상품명이 빈칸 없이 정렬된 고유 목록으로",
        "explain": "TOCOL(…,1)이 빈칸을 무시해 4개 열을 한 목록으로 모으고 UNIQUE·SORT로 정렬해, 흩어진 코드·상품명 정리에 강력합니다."
      },
      {
        "level": "advanced",
        "title": "오류·빈칸을 걸러 평균 내기",
        "formula": "=AVERAGE(TOCOL(G2:J50, 3))",
        "result": "G~J 범위에서 빈칸과 #DIV/0! 등 오류를 뺀 숫자만 평균",
        "explain": "무시할값 3이 빈칸·오류를 모두 건너뛰어, #DIV/0! 등이 섞여도 유효한 값만 안전하게 평균 냅니다."
      },
      {
        "level": "advanced",
        "title": "세로(열) 방향으로 훑어 펴기",
        "formula": "=TOCOL(A2:C5, 0, TRUE)",
        "result": "값을 열 우선(위→아래를 먼저)으로 훑어 한 열로 정렬",
        "explain": "세 번째 인수 TRUE는 열 방향으로 먼저 읽어, 세로로 이어지는 데이터에 자연스럽습니다."
      }
    ],
    "related": [
      "WRAPROWS",
      "WRAPCOLS",
      "UNIQUE",
      "SORT",
      "FILTER"
    ],
    "tips": "- 무시할값: 0/생략=모두 포함, 1=빈칸, 2=오류, 3=둘 다 무시\n- 세 번째 인수 TRUE=열 우선, FALSE(기본)=행 우선 스캔\n- 반대로 되접으려면 WRAPROWS·WRAPCOLS, Microsoft 365 전용"
  },
  {
    "id": "transpose",
    "name": "TRANSPOSE",
    "category": "shape",
    "version": "all",
    "weight": 3,
    "difficulty": 3,
    "syntax": "=TRANSPOSE(배열)",
    "summary": "표의 행과 열을 서로 바꿔 세로↔가로로 눕히거나 세운다.",
    "intro": "표의 행과 열을 서로 바꿔 세로↔가로로 눕히거나 세우는 함수입니다.\n\n- '행과 열의 자리를 맞바꾸기' — 원본과 연결돼 원본을 고치면 결과도 자동 변경\n- 365·2021은 자동 스필, 2019 이하는 범위 선택 후 Ctrl+Shift+Enter",
    "params": [
      {
        "name": "배열",
        "required": true,
        "desc": "행과 열을 바꾸고 싶은 셀 범위나 배열. 세로 5칸이면 가로 5칸으로, 3행×4열이면 4행×3열로 바뀝니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "세로 목록을 가로로 눕히기",
        "formula": "=TRANSPOSE(A2:A6)",
        "result": "A2:A6에 세로로 있던 상품명 5개가 한 행에 좌→우 5칸으로 펼쳐짐(스필)",
        "explain": "위아래 값을 한 줄로 눕히는 기본 사용 — 셀 하나에만 수식을 넣으면 나머지는 자동으로 채워집니다."
      },
      {
        "level": "basic",
        "title": "가로 머리글을 세로로 세우기",
        "formula": "=TRANSPOSE(B1:E1)",
        "result": "B1:E1에 가로로 있던 4개의 열 제목이 세로 4칸으로 세워짐",
        "explain": "표 머리글을 세로 목록으로 바꿔 다른 표의 기준 열로 재활용하며, 행↔열이 뒤집힙니다."
      },
      {
        "level": "advanced",
        "title": "표 전체를 통째로 회전",
        "formula": "=TRANSPOSE(A1:D10)",
        "result": "10행×4열 표가 4행×10열로 회전되어 스필. 상품이 행이던 표가 상품이 열인 표로 바뀜",
        "explain": "2차원 범위를 통째로 돌려 보고서 방향을 뒤집으며, 원본이 바뀌면 회전본도 즉시 갱신됩니다."
      },
      {
        "level": "advanced",
        "title": "고유 상품 목록을 가로 머리글로 자동 생성",
        "formula": "=TRANSPOSE(SORT(UNIQUE(C2:C500)))",
        "result": "C열 product에서 중복 없는 상품명을 정렬한 뒤 가로 한 줄의 머리글로 펼침",
        "explain": "UNIQUE→SORT→TRANSPOSE를 이어 붙이면 상품이 늘어도 자동으로 늘어나는 동적 교차표 머리글을 만들어, 피벗 없이 요약표 뼈대를 짭니다."
      },
      {
        "level": "advanced",
        "title": "행 벡터×열 벡터 곱으로 가중합 계산",
        "formula": "=SUM(D2:D11*TRANSPOSE(F2:F11))",
        "result": "두 세로 범위를 곱해 만든 배열의 총합(예: 담보별 발생빈도×심도의 조합 합계)",
        "explain": "한 범위를 가로로 눕히면 세로×가로가 교차돼 모든 조합의 곱 배열이 생기고, SUM으로 더하면 행렬 곱 형태의 가중합을 구합니다."
      }
    ],
    "tips": "- 결과 셀에 값이 있으면 #SPILL! 오류 — 아래·오른쪽 공간 비우기\n- 원본과 연결돼 원본이 지워지면 오류 — 값만 남기려면 복사→값 붙여넣기\n- 2019 이하는 배열 수식(Ctrl+Shift+Enter)으로 입력({} 자동)",
    "related": [
      "FILTER",
      "SORT",
      "UNIQUE",
      "INDEX"
    ]
  },
  {
    "id": "expand",
    "name": "EXPAND",
    "category": "shape",
    "version": "365",
    "weight": 2,
    "difficulty": 2,
    "syntax": "=EXPAND(배열, [행수], [열수], [채울값])",
    "summary": "작은 표를 원하는 크기로 넓히고, 새로 생긴 빈 칸을 원하는 값으로 채운다.",
    "intro": "작은 표를 원하는 크기로 넓히고, 새로 생긴 빈 칸을 원하는 값으로 채우는 함수입니다.\n\n- 새 빈 칸은 기본 #N/A — 채울값으로 0·\"\"·\"-\" 등 지정 가능\n- VSTACK·HSTACK 결합 전 행·열 크기 맞추기에 유용\n- '넓히기'만 가능, 줄이기는 TAKE·DROP",
    "params": [
      {
        "name": "배열",
        "required": true,
        "desc": "확장할 원본 표나 셀 범위입니다."
      },
      {
        "name": "행수",
        "required": false,
        "desc": "확장한 뒤의 전체 행 개수입니다. 원본 행수보다 크거나 같아야 합니다. 생략하면 행은 그대로 둡니다."
      },
      {
        "name": "열수",
        "required": false,
        "desc": "확장한 뒤의 전체 열 개수입니다. 원본 열수보다 크거나 같아야 합니다. 생략하면 열은 그대로 둡니다."
      },
      {
        "name": "채울값",
        "required": false,
        "desc": "새로 생긴 빈 칸에 넣을 값입니다. 생략하면 #N/A가 들어갑니다. 0, \"\", \"-\" 등을 지정할 수 있습니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "목록을 5행으로 늘리고 0으로 채우기",
        "formula": "=EXPAND(A2:A4, 5, 1, 0)",
        "result": "A2:A4의 값 3개 아래에 0이 2개 더해져 5행이 됨",
        "explain": "원본 3행을 5행으로 확장해 빈 2칸을 0으로 채우며, 채울값을 빼면 그 칸에 #N/A가 나타납니다."
      },
      {
        "level": "basic",
        "title": "행·열을 넓히고 빈칸을 대시(-)로",
        "formula": "=EXPAND(B2:C2, 2, 4, \"-\")",
        "result": "2행 4열로 확장되고, 원본에 없던 칸은 모두 \"-\"로 표시됨",
        "explain": "행·열을 동시에 넓히고 빈 곳을 \"-\"로 채워, 보고서의 '해당 없음' 표현에 좋습니다."
      },
      {
        "level": "advanced",
        "title": "필터 결과를 항상 10행 고정 양식으로",
        "formula": "=EXPAND(FILTER(A2:A100, B2:B100=\"암보험\"), 10, 1, \"\")",
        "result": "조건에 맞는 값을 위에서부터 채우고, 모자라면 빈 문자열로 채워 항상 10행",
        "explain": "FILTER 결과 개수가 달라도 EXPAND로 10행에 고정해 양식 칸 수가 흔들리지 않으며, \"\"로 남는 칸을 비웁니다(10개 초과면 #VALUE!)."
      },
      {
        "level": "advanced",
        "title": "VSTACK 전에 열 개수 맞추기",
        "formula": "=VSTACK(A2:C2, EXPAND(E2:E5, 4, 3, \"\"))",
        "result": "1열짜리 목록을 3열로 넓혀 머리글(3열)과 세로로 이어 붙임",
        "explain": "VSTACK·HSTACK은 열 수가 다르면 #N/A가 생기니, EXPAND로 미리 3열로 맞추고 빈칸을 \"\"로 채워 깔끔히 결합합니다."
      }
    ],
    "related": [
      "VSTACK",
      "HSTACK",
      "TAKE",
      "DROP"
    ],
    "tips": "- 행수·열수는 원본보다 작을 수 없음(작으면 #VALUE! 오류) — 줄이기는 TAKE·DROP\n- 채울값을 생략하면 빈칸에 #N/A\n- Microsoft 365 전용"
  },
  {
    "id": "countif",
    "name": "COUNTIF · COUNTIFS",
    "category": "logic",
    "version": "all",
    "weight": 5,
    "difficulty": 2,
    "syntax": "=COUNTIF(범위, 조건)\n=COUNTIFS(조건범위1, 조건1, [조건범위2, 조건2], …)",
    "summary": "조건에 맞는 셀의 개수를 센다 — COUNTIF는 조건 1개, COUNTIFS는 여러 조건을 모두(AND) 만족하는 개수.",
    "intro": "조건에 맞는 셀의 개수를 세는 함수 — SUMIF/SUMIFS의 '개수 세기' 버전입니다.\n\n- 조건 1개는 COUNTIF, 둘 이상은 COUNTIFS(끝에 S) — COUNTIFS는 모든 조건을 만족(AND)\n- 조건은 값·크기 비교(\">=1000000\")·와일드카드(\"김*\") 가능, 셀 값은 \">=\"&F1로 결합\n- COUNTIF로 존재·중복 점검, COUNTIFS로 다중 필터 건수 집계",
    "params": [
      {
        "name": "범위 / 조건범위1",
        "required": true,
        "desc": "개수를 셀 대상 셀 범위. COUNTIF에서는 '범위', COUNTIFS에서는 첫 번째 조건을 검사할 '조건범위1'. 예: 상품명이 든 B열, 청구액이 든 C열."
      },
      {
        "name": "조건 / 조건1",
        "required": true,
        "desc": "셀 수 기준. 값(\"자동차\")·비교식(\">=60\")·와일드카드(\"김*\", \"*상해*\") 가능. 빈 셀은 \"\", 비어있지 않은 셀은 \"<>\", 대소문자 미구분."
      },
      {
        "name": "조건범위2",
        "required": false,
        "desc": "(COUNTIFS 전용) 두 번째로 검사할 셀 범위. 조건범위1과 크기(행 수)가 같아야 하며, 다르면 #VALUE! 오류가 난다."
      },
      {
        "name": "조건2",
        "required": false,
        "desc": "(COUNTIFS 전용) 조건범위2에 적용할 기준. 이런 (범위, 조건) 짝을 최대 127쌍까지 이어 붙일 수 있다. COUNTIF에는 없는 인수다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "COUNTIF — 값 개수 세기",
        "formula": "=COUNTIF(B2:B100, \"자동차\")",
        "result": "B열에서 \"자동차\"인 셀의 개수(계약 건수)",
        "explain": "조건 하나에 맞는 셀 개수를 세, 자동차 계약이 몇 건인지 바로 알 수 있다."
      },
      {
        "level": "basic",
        "title": "COUNTIFS — 두 조건을 모두 만족하는 건수",
        "formula": "=COUNTIFS(C2:C100, \"자동차\", D2:D100, \">1000000\")",
        "result": "상품이 '자동차'이면서 보험료(D열)가 100만 원 초과인 계약 건수",
        "explain": "(범위, 기준) 짝을 나란히 적으면 둘 다 만족하는 건수만 센다(AND) — 크기 비교는 \">1000000\"처럼 큰따옴표 안에 넣는다."
      },
      {
        "level": "basic",
        "title": "COUNTIF — 크기 조건으로 세기",
        "formula": "=COUNTIF(C2:C100, \">=1000000\")",
        "result": "청구액이 100만 이상인 건수",
        "explain": "비교식을 따옴표 안에 넣어 크기 조건으로 세는, 고액 청구 건수 예이다."
      },
      {
        "level": "advanced",
        "title": "COUNTIF — 중복 확인",
        "formula": "=COUNTIF($A$2:$A$100, A2)>1",
        "result": "같은 증권번호가 2개 이상이면 TRUE(중복), 하나뿐이면 FALSE",
        "explain": "전체 범위에서 A2가 몇 번 나오는지 세어 1보다 크면 중복 — 조건부 서식과 함께 중복 찾기에 쓴다."
      },
      {
        "level": "advanced",
        "title": "COUNTIF — 명단에 있는지(존재 확인)",
        "formula": "=IF(COUNTIF($F$2:$F$50, A2), \"확인대상\", \"정상\")",
        "result": "A2가 F열 명단에 있으면 \"확인대상\", 없으면 \"정상\"",
        "explain": "COUNTIF 결과가 0(없음)이면 IF가 거짓으로 봐, 블랙리스트·명단 포함 여부 점검에 쓰는 관용 표현이다."
      },
      {
        "level": "advanced",
        "title": "COUNTIFS — 날짜 구간 + 분류로 다중 필터",
        "formula": "=COUNTIFS(B2:B100, \">=\"&F1, B2:B100, \"<=\"&F2, C2:C100, \"자동차\")",
        "result": "가입일(B열)이 F1~F2 사이이면서 상품이 자동차인 계약 건수",
        "explain": "같은 열(B)에 '이상'·'이하'를 걸면 기간 필터가 되고, 셀 값은 \">=\"&F1로 결합한다 — F1·F2만 바꾸면 기간이 바뀐다."
      },
      {
        "level": "advanced",
        "title": "COUNTIFS — 스필(#)로 상품별 건수표 자동 생성",
        "formula": "=COUNTIFS($C$2:$C$100, H2#)",
        "result": "H2#(UNIQUE 등으로 뽑은 상품 목록)의 각 상품별 건수가 세로로 자동 채워짐(스필 배열)",
        "explain": "H2#(=UNIQUE 등의 스필 결과)를 조건에 넣으면 상품 종류마다 건수를 한 번에 계산해 표가 스스로 늘고 준다(365 신규) — 부분일치는 \"*생명*\"처럼 별표를 쓴다."
      },
      {
        "level": "advanced",
        "title": "COUNTIF — 비율(합격률·달성률) 계산",
        "formula": "=COUNTIF(C2:C100, \">=60\") / COUNT(C2:C100)",
        "result": "60 이상인 건의 비율(예: 0.72 → 72%)",
        "explain": "만족한 개수를 전체 개수로 나누면 비율이 되며, 합격률·달성률 지표에 쓴다."
      }
    ],
    "tips": "- 조건 1개는 COUNTIF, 둘 이상은 COUNTIFS(끝에 S) — 처음부터 COUNTIFS로 통일하면 편함\n- 대소문자 미구분, 와일드카드 *(문자열)·?(한 글자), 실제 *·? 는 앞에 물결(~*, ~?)\n- 크기 비교는 \">=60\", 셀 참조는 \">=\"&F1로 결합, 빈 셀은 \"\"·비어있지 않은 셀은 \"<>\"\n- COUNTIFS의 모든 조건범위는 행 수가 같아야 함 — 다르면 #VALUE! 오류",
    "related": [
      "SUMIF",
      "SUMIFS",
      "AVERAGEIFS",
      "COUNTA",
      "COUNT",
      "COUNTBLANK"
    ]
  },
  {
    "id": "if",
    "name": "IF",
    "category": "logic",
    "version": "all",
    "weight": 5,
    "difficulty": 2,
    "syntax": "=IF(조건, 참일_때_값, [거짓일_때_값])",
    "summary": "조건이 맞으면 A, 아니면 B를 돌려주는 가장 기본적인 판단 함수.",
    "intro": "IF는 조건이 참이면 A, 거짓이면 B를 돌려주는 가장 기본적인 판단 함수입니다.\n\n- 조건 칸엔 참·거짓으로 판가름 나는 비교식(예: A2>=60)\n- '거짓일 때 값' 생략 시 FALSE 반환 — 보통 두 경우 다 채움\n- 갈래가 여럿이면 IF 중첩보다 IFS·SWITCH가 읽기 편함",
    "params": [
      {
        "name": "조건",
        "required": true,
        "desc": "참·거짓으로 판정되는 비교식이나 논리값. 예: A2>=60, B2=\"완료\""
      },
      {
        "name": "참일_때_값",
        "required": true,
        "desc": "조건이 참(TRUE)일 때 돌려줄 값이나 수식"
      },
      {
        "name": "거짓일_때_값",
        "required": false,
        "desc": "조건이 거짓(FALSE)일 때 돌려줄 값. 생략하면 FALSE가 반환됨"
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "점수로 합격·불합격 판정",
        "formula": "=IF(A2>=60, \"합격\", \"불합격\")",
        "result": "A2가 60 이상이면 \"합격\", 아니면 \"불합격\"",
        "explain": "A2가 60 이상인지 보고 합격·불합격 글자를 표시하는 가장 기본형입니다."
      },
      {
        "level": "basic",
        "title": "고액 청구 한눈에 표시하기",
        "formula": "=IF(C2>=1000000, \"고액\", \"일반\")",
        "result": "청구액 C2가 100만원 이상이면 \"고액\", 아니면 \"일반\"",
        "explain": "청구액 100만원 이상을 '고액'으로 라벨링하는 실무 패턴입니다."
      },
      {
        "level": "advanced",
        "title": "IF 중첩으로 3단계 등급 매기기",
        "formula": "=IF(A2>=90, \"A\", IF(A2>=70, \"B\", \"C\"))",
        "result": "90 이상 \"A\", 70~89 \"B\", 그 미만 \"C\"",
        "explain": "'거짓일 때 값' 자리에 IF를 또 넣어 큰 기준부터 순서대로 걸러 3단계 등급을 매깁니다."
      },
      {
        "level": "advanced",
        "title": "여러 조건을 동시에 만족할 때 (AND 결합)",
        "formula": "=IF(AND(B2=\"자동차\", C2>=3000000), \"정밀심사\", \"일반심사\")",
        "result": "상품이 자동차이면서 청구액이 300만원 이상일 때만 \"정밀심사\"",
        "explain": "두 조건을 다 만족해야 할 땐 AND로 묶고, 하나만이면 OR을 씁니다."
      },
      {
        "level": "advanced",
        "title": "조건에 맞는 값만 골라 합산하기 (배열 IF, 스필)",
        "formula": "=SUM(IF(product=\"자동차\", claim_amt))",
        "result": "product가 \"자동차\"인 행의 claim_amt만 더한 합계",
        "explain": "365/2021에선 IF가 열 전체를 받아 조건 밖 칸을 FALSE로 두고 SUM이 이를 무시해 맞는 값만 더합니다(간단한 조건 합계는 SUMIF가 편함)."
      }
    ],
    "related": [
      "IFS",
      "SWITCH",
      "IFERROR",
      "AND",
      "OR"
    ],
    "tips": "- 3갈래 이상이면 IF 중첩보다 IFS·SWITCH가 읽고 고치기 쉬움\n- '거짓일 때 값'을 비우면 FALSE — 빈 칸을 원하면 \"\"(빈 문자열)"
  },
  {
    "id": "iferror",
    "name": "IFERROR · IFNA",
    "category": "logic",
    "version": "all",
    "weight": 5,
    "difficulty": 2,
    "syntax": "=IFERROR(검사할_값, 오류일_때_값)   ·   =IFNA(검사할_값, N/A일_때_값)",
    "summary": "수식이 오류를 내면 대신 보여줄 값을 지정하는 오류 처리 함수(IFNA는 #N/A만).",
    "intro": "IFERROR는 수식이 오류를 내면 빨간 오류 대신 지정한 값을 보여 주는 오류 처리 함수입니다.\n\n- 원래 수식을 첫 칸에, 오류일 때 보여줄 값을 둘째 칸에\n- IFNA는 #N/A만 잡음 — 조회 '값 없음'만 처리하고 진짜 오류는 드러낼 때\n- IFERROR는 2007·IFNA는 2013부터. IFERROR는 숨은 실수까지 가릴 수 있음",
    "params": [
      {
        "name": "검사할_값",
        "required": true,
        "desc": "원래 계산하려던 수식이나 값. 오류가 없으면 이 결과가 그대로 나옴"
      },
      {
        "name": "오류일_때_값",
        "required": true,
        "desc": "검사할_값이 오류일 때 대신 보여줄 값(IFERROR는 모든 오류, IFNA는 #N/A만 잡음)"
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "0으로 나눌 때 오류 감추기",
        "formula": "=IFERROR(B2/C2, 0)",
        "result": "C2가 0이 아니면 나눗셈 결과, C2가 0이면 0",
        "explain": "C2가 0이면 나는 #DIV/0! 오류를 IFERROR로 감싸 0(또는 \"\"·\"-\")으로 바꿉니다."
      },
      {
        "level": "basic",
        "title": "찾는 값이 없을 때 안내 문구 보이기",
        "formula": "=IFERROR(VLOOKUP(A2, 상품표, 2, 0), \"미등록\")",
        "result": "상품표에서 A2를 찾으면 그 값, 못 찾으면 \"미등록\"",
        "explain": "VLOOKUP이 못 찾을 때 나는 #N/A를 \"미등록\" 문구로 바꾸는 조회 단짝 패턴입니다."
      },
      {
        "level": "advanced",
        "title": "찾기 실패만 처리하고 진짜 오류는 남기기 (IFNA)",
        "formula": "=IFNA(VLOOKUP(A2, 상품표, 2, 0), \"미등록\")",
        "result": "못 찾으면 \"미등록\", 그러나 열 번호 오류(#REF!)나 형식 오류(#VALUE!)는 그대로 표시",
        "explain": "IFNA는 '값 없음(#N/A)'만 바꾸고 수식 실수(#REF!·#VALUE!)는 드러내 진짜 버그를 놓치지 않습니다."
      },
      {
        "level": "advanced",
        "title": "여러 표를 순서대로 찾기 (IFERROR 연쇄)",
        "formula": "=IFERROR(VLOOKUP(A2, 표1, 2, 0), IFERROR(VLOOKUP(A2, 표2, 2, 0), \"없음\"))",
        "result": "표1에서 찾고, 없으면 표2에서 찾고, 그래도 없으면 \"없음\"",
        "explain": "'오류일 때 값' 자리에 다음 조회를 넣어 IFERROR를 겹쳐 여러 표를 차례로 뒤집니다."
      },
      {
        "level": "advanced",
        "title": "배열 계산에서 오류 난 칸만 대체하기 (스필)",
        "formula": "=IFERROR(claim_amt / policy_cnt, 0)",
        "result": "두 열을 나눈 결과 배열이 한 번에 채워지되, 0으로 나뉜 칸만 0",
        "explain": "365/2021에선 두 열을 나눈 스필 배열에서 오류 난 칸만 IFERROR가 0으로 바꿔, 셀마다 감쌀 필요가 없습니다."
      }
    ],
    "related": [
      "IFNA",
      "IF",
      "IFS",
      "VLOOKUP",
      "XLOOKUP",
      "ISERROR"
    ],
    "tips": "- IFERROR는 모든 오류를 덮음 — 조회 '값 없음'만 처리하면 IFNA가 안전\n- XLOOKUP은 [없을때] 인수가 내장돼 IFERROR로 감쌀 필요 없음\n- 오류를 안 보이게만 하려면 둘째 값에 \"\"(빈 문자열)"
  },
  {
    "id": "sumif",
    "name": "SUMIF · SUMIFS",
    "category": "logic",
    "version": "all",
    "weight": 5,
    "difficulty": 3,
    "syntax": "=SUMIF(조건범위, 조건, [합계범위])\n=SUMIFS(합계범위, 조건범위1, 조건1, [조건범위2, 조건2], …)",
    "summary": "조건에 맞는 행의 값만 골라서 더한다 — 조건이 하나면 SUMIF, 여러 조건을 모두(AND) 걸려면 SUMIFS.",
    "intro": "SUMIF·SUMIFS는 조건에 맞는 행의 값만 골라서 더하는 함수입니다.\n\n- 조건 1개면 SUMIF, 2개 이상(AND)이면 SUMIFS\n- 인수 순서 반대 — SUMIF는 조건범위가 맨 앞, SUMIFS는 합계범위가 맨 앞\n- 조건은 값·비교('>=1000000')·와일드카드('*상해*'), SUMIFS는 최대 127쌍",
    "params": [
      {
        "name": "합계범위",
        "required": true,
        "desc": "실제로 더할 값이 든 범위. SUMIF에선 맨 뒤(생략 시 조건범위 자체를 더함), SUMIFS에선 맨 앞 필수. 조건범위와 크기·모양이 같아야 함."
      },
      {
        "name": "조건범위(조건범위1)",
        "required": true,
        "desc": "조건을 검사할 셀 범위. 예: 상품명이 든 B열, 청구액이 든 D열. SUMIFS에서는 조건범위1이 첫 번째 검사 범위가 된다."
      },
      {
        "name": "조건(조건1)",
        "required": true,
        "desc": "더할 대상을 고르는 기준. 값(\"자동차\"), 비교식(\">=1000000\", \"<>해지\"), 와일드카드(\"김*\", \"*상해*\")를 쓸 수 있다. 대소문자는 구분하지 않는다."
      },
      {
        "name": "조건범위2, 조건2, …",
        "required": false,
        "desc": "SUMIFS 전용. 두 번째 이후의 추가 조건 쌍으로, 최대 127쌍까지 이어 붙일 수 있고 모든 조건은 AND(모두 만족)로 결합된다. SUMIF에는 없다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "SUMIF — 한 조건으로 상품별 합계",
        "formula": "=SUMIF(B2:B100, \"자동차\", D2:D100)",
        "result": "상품명(B열)이 \"자동차\"인 행의 보험료(D열) 합계",
        "explain": "B열에서 \"자동차\"인 행의 D열만 더하며, 조건범위(B)가 맨 앞·합계범위(D)가 맨 뒤입니다."
      },
      {
        "level": "basic",
        "title": "SUMIF — 합계범위 생략(자기 자신 합)",
        "formula": "=SUMIF(D2:D100, \">=1000000\")",
        "result": "D열 값 중 100만 이상인 것들의 합",
        "explain": "조건 열과 더할 열이 같으면 세 번째 인수를 생략하며(SUMIF 전용), D열의 100만 이상만 더합니다."
      },
      {
        "level": "basic",
        "title": "SUMIFS — 두 조건 모두 만족",
        "formula": "=SUMIFS(E2:E100, B2:B100, \"자동차\", C2:C100, \"서울\")",
        "result": "상품=자동차 이면서 지역=서울인 행의 보험료(E열) 합",
        "explain": "조건이 둘이라 SUMIFS로, 합계범위(E)를 맨 앞에 두고 두 조건을 AND로 이어 붙입니다."
      },
      {
        "level": "advanced",
        "title": "SUMIF — 셀 참조로 기준을 동적으로",
        "formula": "=SUMIF(C2:C100, \">=\"&F1, D2:D100)",
        "result": "C열 값이 F1 이상인 행의 D열 합계",
        "explain": "\">=\"&F1처럼 연산자와 셀을 &로 이어 기준을 셀로 바꾸면 F1만 고쳐 합계가 다시 계산됩니다."
      },
      {
        "level": "advanced",
        "title": "SUMIF — 와일드카드로 이름의 일부 합산",
        "formula": "=SUMIF(B2:B100, \"*상해*\", D2:D100)",
        "result": "상품명에 \"상해\"가 들어간 모든 행의 D열 합",
        "explain": "*는 임의 문자열을 뜻해, 상품명에 \"상해\"가 포함된 행을 모두 더합니다."
      },
      {
        "level": "advanced",
        "title": "SUMIFS — 날짜 구간(사이) 합계",
        "formula": "=SUMIFS(D2:D100, A2:A100, \">=\"&DATE(2026,1,1), A2:A100, \"<=\"&DATE(2026,3,31))",
        "result": "접수일(A열)이 2026-01-01 ~ 03-31 사이인 청구액 합",
        "explain": "같은 날짜 범위에 >=·<= 두 조건을 걸어 '구간 사이'(1분기) 청구액 합을 구합니다."
      },
      {
        "level": "advanced",
        "title": "SUMIFS — 교차 요약표(행·열 조건)",
        "formula": "=SUMIFS($E$2:$E$100, $B$2:$B$100, $G2, $C$2:$C$100, H$1)",
        "result": "G열 상품 × 1행 지역이 교차하는 칸마다 해당 합계(피벗형 표)",
        "explain": "행($G2)·열(H$1) 참조 고정을 다르게 줘 수식 하나로 상품×지역 교차 합계표를 만듭니다."
      },
      {
        "level": "advanced",
        "title": "SUMIFS — 고유값별 합계를 한 번에 스필(365)",
        "formula": "=SUMIFS(E2:E100, B2:B100, UNIQUE(B2:B100))",
        "result": "상품 종류마다의 합계가 세로로 자동으로 펼쳐짐(스필)",
        "explain": "조건 자리에 UNIQUE 배열을 넣어 상품별 합계를 한 수식으로 스필합니다(365·2021 전용)."
      }
    ],
    "tips": "- 흔한 실수는 인수 순서 — SUMIF는 조건범위 맨 앞, SUMIFS는 합계범위 맨 앞\n- 조건범위(들)와 합계범위는 크기·모양이 같아야 함, 대소문자 미구분\n- 비교연산자+셀은 \">=\"&A1처럼 &로 연결, '구간 사이'는 같은 범위에 >=·<=\n- SUMIFS는 AND만 — OR은 SUMIFS 여러 개를 더하거나 SUMPRODUCT",
    "related": [
      "COUNTIF",
      "AVERAGEIF",
      "COUNTIFS",
      "AVERAGEIFS",
      "MAXIFS",
      "SUMPRODUCT"
    ]
  },
  {
    "id": "and-or-not",
    "name": "AND · OR · NOT",
    "category": "logic",
    "version": "all",
    "weight": 4,
    "difficulty": 2,
    "syntax": "=AND(논리식1, [논리식2], …) · =OR(논리식1, [논리식2], …) · =NOT(논리식)",
    "summary": "여러 조건을 모두 만족(AND)·하나라도 만족(OR)·결과를 반대로(NOT) 판정하는 기본 논리 함수",
    "intro": "AND·OR·NOT은 참·거짓을 조합하거나 뒤집는 세 개의 기본 논리 함수입니다.\n\n- AND는 조건이 모두 맞아야 TRUE, OR는 하나라도 맞으면 TRUE\n- NOT은 조건 하나를 받아 결과를 반대로(TRUE↔FALSE)\n- 주로 IF 안에 넣어 '여러 조건을 동시에/하나라도/반대로' 판정",
    "params": [
      {
        "name": "논리식1",
        "required": true,
        "desc": "참(TRUE)/거짓(FALSE)으로 판정되는 첫 번째 조건. 예: B2=\"남\", C2>=25. AND·OR·NOT에 공통이며, NOT은 이 하나만 받는다."
      },
      {
        "name": "논리식2, …",
        "required": false,
        "desc": "AND·OR에 이어서 넣는 추가 조건. 최대 255개까지 나열할 수 있다(NOT에는 없음). 값 하나만 넣으면 0은 FALSE, 0이 아닌 값은 TRUE로 본다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "AND — 두 조건 모두 만족",
        "formula": "=AND(B2>=18, B2<=65)",
        "result": "두 조건이 다 맞으면 TRUE, 하나라도 틀리면 FALSE",
        "explain": "B2 나이가 18세 이상이면서 65세 이하일 때만 TRUE — 가입 연령대(18~65) 확인입니다."
      },
      {
        "level": "basic",
        "title": "OR — 하나라도 만족",
        "formula": "=OR(C2=\"암\", C2=\"뇌졸중\", C2=\"급성심근경색\")",
        "result": "셋 중 하나라도 해당하면 TRUE, 모두 아니면 FALSE",
        "explain": "진단명 C2가 3대 질병 중 하나만 해당해도 TRUE입니다."
      },
      {
        "level": "basic",
        "title": "NOT — 결과를 반대로",
        "formula": "=NOT(B2=\"해지\")",
        "result": "해지가 아니면 TRUE, 해지면 FALSE",
        "explain": "B2가 \"해지\"면 FALSE로 뒤집으며, NOT(B2=\"해지\")는 B2<>\"해지\"와 같습니다."
      },
      {
        "level": "advanced",
        "title": "IF + AND — 다중 조건 분류",
        "formula": "=IF(AND(D2>=1000000, E2=\"입원\"), \"고액입원심사\", \"일반\")",
        "result": "두 조건을 다 만족한 행만 \"고액입원심사\", 나머지는 \"일반\"",
        "explain": "IF 조건 자리에 AND를 넣어 청구액 100만↑·사유 \"입원\"을 함께 만족한 건만 표시합니다."
      },
      {
        "level": "advanced",
        "title": "IF + OR — 여러 값 중 하나면 그룹으로",
        "formula": "=IF(OR(E2=\"암\", E2=\"뇌혈관\", E2=\"심장\"), \"3대질병\", \"기타\")",
        "result": "세 값 중 하나면 \"3대질병\", 아니면 \"기타\"",
        "explain": "담보 E2가 세 값 중 하나라도 맞으면 3대질병군으로 묶는 나열식 OR 분류입니다."
      },
      {
        "level": "advanced",
        "title": "AND로 범위 전체를 한 번에 검사",
        "formula": "=AND(C2:C13>=0)",
        "result": "C2:C13 값이 모두 0 이상이면 TRUE, 하나라도 음수면 FALSE",
        "explain": "범위를 통째로 넣어 음수(입력 오류)가 하나도 없는지 점검합니다(2019 이하는 Ctrl+Shift+Enter 필요)."
      }
    ],
    "related": [
      "IF",
      "IFS",
      "XOR",
      "IFERROR"
    ],
    "tips": "- 인수는 값이 아니라 '참·거짓으로 판정되는 식'(예: A2>=25)\n- 10<A2<20 문법이 없어 AND(A2>10, A2<20)처럼 셀 참조를 반복\n- NOT은 인수 하나만 — NOT(A2=B2)는 A2<>B2와 같음"
  },
  {
    "id": "averageif",
    "name": "AVERAGEIF · AVERAGEIFS",
    "category": "logic",
    "version": "all",
    "weight": 4,
    "difficulty": 2,
    "syntax": "=AVERAGEIF(조건범위, 조건, [평균범위])  ·  =AVERAGEIFS(평균범위, 조건범위1, 조건1, [조건범위2, 조건2], …)",
    "summary": "조건에 맞는 값들만 골라 평균을 구합니다(단일=AVERAGEIF, 다중=AVERAGEIFS).",
    "intro": "조건에 맞는 것만 골라 평균을 내는 함수입니다(전체 평균이 아니라 '특정 부류'만).\n\n- 조건 1개면 AVERAGEIF, 여러 개면 AVERAGEIFS\n- 인수 순서 반대 — AVERAGEIF는 평균범위가 맨 뒤, AVERAGEIFS는 맨 앞\n- 맞는 값이 없으면 #DIV/0! 오류 → IFERROR로 감싸면 깔끔",
    "params": [
      {
        "name": "평균범위",
        "required": true,
        "desc": "AVERAGEIFS에서 맨 앞에 오는, 실제로 평균 낼 숫자 범위. (AVERAGEIF에서는 이 인수가 맨 뒤의 선택 인수)"
      },
      {
        "name": "조건범위(1)",
        "required": true,
        "desc": "조건을 검사할 셀 범위(예: 상품 열)."
      },
      {
        "name": "조건(1)",
        "required": true,
        "desc": "찾을 기준. \"자동차\", \">0\", \"*생명*\" 등(큰따옴표로 감쌈)."
      },
      {
        "name": "조건범위2 / 조건2 …",
        "required": false,
        "desc": "AVERAGEIFS에서 조건을 더 걸 때 추가하는 (범위, 조건) 짝(최대 127쌍). 모든 조건범위는 평균범위와 크기가 같아야 함."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "조건에 맞는 값의 평균 (AVERAGEIF)",
        "formula": "=AVERAGEIF(C2:C100, \"자동차\", E2:E100)",
        "result": "상품(C열)이 '자동차'인 계약들의 보험료(E열) 평균",
        "explain": "'어디를 보고(C)·무엇을 찾고(자동차)·무엇을 평균 낼지(E)' 순서로, 조건 열과 평균 열이 다르면 평균범위를 꼭 지정합니다."
      },
      {
        "level": "basic",
        "title": "같은 계산을 AVERAGEIFS로",
        "formula": "=AVERAGEIFS(E2:E100, C2:C100, \"자동차\")",
        "result": "위와 동일한 자동차 상품 평균 보험료",
        "explain": "AVERAGEIFS는 평균범위(E)를 맨 앞에 적는 점만 다르고 결과는 같습니다(조건 확장 계획이면 유리)."
      },
      {
        "level": "advanced",
        "title": "여러 조건을 만족하는 평균 청구액",
        "formula": "=AVERAGEIFS(F2:F100, C2:C100, \"자동차\", D2:D100, \"서울\", B2:B100, \">=\"&DATE(2026,1,1))",
        "result": "2026년 이후, 서울 지역, 자동차 상품 계약의 평균 청구액(F열)",
        "explain": "상품·지역·가입일 세 조건을 모두 만족한 행의 평균을 내며, 날짜는 \">=\"&DATE(...)로 '이후'를 표현합니다."
      },
      {
        "level": "advanced",
        "title": "일치 항목이 없을 때 오류 방지",
        "formula": "=IFERROR(AVERAGEIFS(E2:E100, C2:C100, G2, D2:D100, \"서울\"), \"해당 없음\")",
        "result": "조건에 맞는 데이터가 있으면 평균, 없으면 '해당 없음'",
        "explain": "맞는 값이 없으면 나는 #DIV/0!를 IFERROR로 감싸, G2에 어떤 상품을 넣어도 표가 깨지지 않습니다."
      }
    ],
    "tips": "- 인수 순서 반대 — AVERAGEIF는 평균범위 맨 뒤·선택, AVERAGEIFS는 맨 앞·필수(흔한 실수)\n- 맞는 셀이 없거나 모두 빈 셀이면 #DIV/0! → IFERROR로 감싸기\n- 빈 셀·텍스트는 자동 제외, 숫자만 계산",
    "related": [
      "AVERAGE",
      "SUMIFS",
      "COUNTIFS",
      "IFERROR",
      "AVERAGEA"
    ]
  },
  {
    "id": "ifs",
    "name": "IFS",
    "category": "logic",
    "version": "2019",
    "weight": 4,
    "difficulty": 2,
    "syntax": "=IFS(조건1, 값1, [조건2, 값2], …, [TRUE, 기본값])",
    "summary": "여러 조건을 위에서부터 차례로 검사해 처음 맞는 값을 돌려주는 함수(중첩 IF 대체).",
    "intro": "IFS는 여러 조건을 위에서부터 차례로 검사해 처음 맞는 값을 돌려주는 함수입니다(중첩 IF 대체).\n\n- 조건·값을 쌍으로 나열, 위쪽부터 검사해 처음 참에서 멈춤 — 좁은 조건을 위에\n- 어디에도 안 맞으면 #N/A → 마지막에 TRUE 쌍으로 기본값\n- 엑셀 2019부터 사용",
    "params": [
      {
        "name": "조건1",
        "required": true,
        "desc": "가장 먼저 검사할 참·거짓 식. 참이면 값1을 반환"
      },
      {
        "name": "값1",
        "required": true,
        "desc": "조건1이 참일 때 돌려줄 값"
      },
      {
        "name": "조건2, 값2 …",
        "required": false,
        "desc": "필요한 만큼 이어 붙이는 추가 조건·값 쌍(최대 127쌍)"
      },
      {
        "name": "TRUE, 기본값",
        "required": false,
        "desc": "맨 마지막에 두는 '그 외 전부' 쌍. 조건 자리에 TRUE를 넣어 #N/A를 방지"
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "점수로 3단계 등급 매기기",
        "formula": "=IFS(A2>=90, \"A\", A2>=70, \"B\", A2>=50, \"C\")",
        "result": "90 이상 \"A\", 70~89 \"B\", 50~69 \"C\" (49 이하는 #N/A)",
        "explain": "조건·값을 쌍으로 높은 기준부터 나열하며, 어디에도 안 걸리는 49 이하는 #N/A라 기본값 처리가 필요합니다."
      },
      {
        "level": "basic",
        "title": "맨 끝에 '그 외' 기본값 넣기",
        "formula": "=IFS(A2>=90, \"A\", A2>=70, \"B\", TRUE, \"C 이하\")",
        "result": "90 이상 \"A\", 70~89 \"B\", 나머지 전부 \"C 이하\"",
        "explain": "마지막 조건을 TRUE로 두면 나머지가 모두 여기로 와 #N/A를 막는 표준 방법입니다."
      },
      {
        "level": "advanced",
        "title": "청구액 구간별 결재 단계 자동 지정",
        "formula": "=IFS(C2>=10000000, \"임원결재\", C2>=3000000, \"팀장결재\", C2>=1000000, \"담당자검토\", TRUE, \"자동승인\")",
        "result": "1천만↑ 임원결재, 3백만~ 팀장결재, 1백만~ 담당자검토, 그 미만 자동승인",
        "explain": "금액 구간이 여럿일 때 큰 금액 조건부터 위에 둬야 하며, 뒤집으면 모두 첫 조건에 걸려 오분류됩니다."
      },
      {
        "level": "advanced",
        "title": "여러 열을 조합한 분기 (AND 결합)",
        "formula": "=IFS(AND(B2=\"자동차\", C2>=3000000), \"정밀심사\", B2=\"자동차\", \"일반심사\", TRUE, \"기타상품\")",
        "result": "자동차+고액이면 정밀심사, 자동차(그 외)면 일반심사, 나머지 상품은 기타상품",
        "explain": "조건 자리에 AND·OR를 넣어 여러 열을 보되, 좁은 조건(자동차+고액)을 넓은 조건(자동차 전체) 위에 둡니다."
      },
      {
        "level": "advanced",
        "title": "조건 미충족 오류를 IFERROR로 안전하게 처리",
        "formula": "=IFERROR(IFS(A2>=90, \"A\", A2>=70, \"B\"), \"미분류\")",
        "result": "90↑ \"A\", 70~89 \"B\", 어디에도 안 맞으면 \"미분류\"",
        "explain": "TRUE 쌍을 안 넣었다면 IFS 전체를 IFERROR로 감싸 #N/A를 대체하되, 내부 TRUE 기본값이 더 명확합니다."
      }
    ],
    "related": [
      "IF",
      "SWITCH",
      "IFERROR",
      "AND",
      "OR"
    ],
    "tips": "- 위에서부터 검사해 처음 맞는 하나에서 멈춤 — 넓은 조건일수록 아래로\n- 어디에도 안 맞으면 #N/A → 마지막에 TRUE 기본값을 습관처럼"
  },
  {
    "id": "subtotal",
    "name": "SUBTOTAL",
    "category": "logic",
    "version": "all",
    "weight": 4,
    "difficulty": 3,
    "syntax": "=SUBTOTAL(함수번호, 참조1, [참조2], …)",
    "summary": "합계·평균·개수 등을 하나의 함수로 계산하되, 필터로 숨겨진 행은 자동으로 제외합니다.",
    "intro": "SUBTOTAL은 함수번호만 바꿔 합계·평균·개수 등을 한 함수로 처리하되, 필터로 숨겨진 행을 자동 제외합니다.\n\n- 함수번호 예: 9=합계, 1=평균, 3=값개수, 4=최대, 5=최소\n- 1~11은 필터 숨김만, 101~111은 직접 숨긴 행까지 제외\n- 범위 안 다른 SUBTOTAL(소계) 셀은 자동 무시 → 이중 합산 없음",
    "params": [
      {
        "name": "함수번호",
        "required": true,
        "desc": "집계 종류 번호: 1=평균·2=숫자개수·3=값개수(COUNTA)·4=최대·5=최소·6=곱·7=표본표준편차·8=모표준편차·9=합계·10=표본분산·11=모분산. 101~111은 직접 숨긴 행도 제외."
      },
      {
        "name": "참조1",
        "required": true,
        "desc": "집계할 셀 범위(예: 보험료가 든 열)."
      },
      {
        "name": "참조2 …",
        "required": false,
        "desc": "추가로 집계할 범위. 여러 범위를 이어서 지정할 수 있음(최대 254개)."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "필터에 반응하는 합계",
        "formula": "=SUBTOTAL(9, E2:E100)",
        "result": "현재 필터로 보이는 행들의 보험료(E열) 합계",
        "explain": "함수번호 9(합계)는 SUM과 달리 필터로 보이는 행만 더해, '자동차'만 남기면 자동차 합계로 바뀝니다."
      },
      {
        "level": "basic",
        "title": "보이는 데이터 건수 세기",
        "formula": "=SUBTOTAL(3, C2:C100)",
        "result": "필터 후 화면에 보이는(비어 있지 않은) 셀 개수",
        "explain": "함수번호 3(값개수, COUNTA)으로 필터 후 보이는 건수를 세며, 숫자만 세려면 2를 씁니다."
      },
      {
        "level": "advanced",
        "title": "필터별 평균을 실시간으로",
        "formula": "=SUBTOTAL(1, F2:F100)",
        "result": "현재 보이는 행들의 청구액(F열) 평균",
        "explain": "함수번호 1(평균)은 필터를 바꿀 때마다 그 조건의 평균으로 자동 재계산돼 대시보드 요약에 좋습니다."
      },
      {
        "level": "advanced",
        "title": "필터해도 1,2,3… 이어지는 일련번호 매기기",
        "formula": "=SUBTOTAL(103, $B$2:B2)",
        "result": "보이는 행에만 1부터 순서대로 붙는 번호(숨은 행은 건너뜀)",
        "explain": "시작점($B$2) 고정·끝점(B2) 상대참조로 '보이는 값 개수'를 순번 삼아, 103(값개수+숨김 제외)이 필터에도 1,2,3…을 이어 줍니다."
      }
    ],
    "tips": "- 9(필터 숨김만)와 109(직접 숨긴 행까지) 구분 — 자동 필터만 쓰면 결과 동일\n- 같은 열의 다른 SUBTOTAL 셀은 자동 무시 → 소계·총계 공존 안전\n- 오류값 무시 등 더 많은 옵션이 필요하면 AGGREGATE",
    "related": [
      "AGGREGATE",
      "SUM",
      "SUMIFS",
      "COUNTA",
      "AVERAGE"
    ]
  },
  {
    "id": "aggregate",
    "name": "AGGREGATE",
    "category": "logic",
    "version": "all",
    "weight": 3,
    "difficulty": 4,
    "syntax": "=AGGREGATE(집계방법, 옵션, 참조1, [참조2], …)  또는  =AGGREGATE(집계방법, 옵션, 배열, [순위])",
    "summary": "오류·숨겨진 행을 건너뛰고 합계·평균·최대·순위 등 19가지 집계를 한 함수로 처리한다.",
    "intro": "AGGREGATE는 오류·숨겨진 행을 건너뛰고 합계·평균·최대·순위 등 19가지 집계를 한 함수로 처리합니다.\n\n- 첫 칸=집계방법(1~19), 둘째 칸=무시 옵션(0~7), 이어서 범위\n- 옵션으로 오류 셀·필터 숨김 행을 빼고 계산 — SUM은 오류 하나에 통째로 실패\n- 자주 쓰는 조합: 9(합계)·1(평균)·4(최대) + 옵션 6(오류 무시)",
    "params": [
      {
        "name": "집계방법",
        "required": true,
        "desc": "무슨 계산인지 정하는 1~19 번호: 1=평균·2=COUNT·3=COUNTA·4=최대·5=최소·6=곱·7=STDEV.S·8=STDEV.P·9=합계·10=VAR.S·11=VAR.P·12=중위수·13=최빈값·14=LARGE·15=SMALL·16=PERCENTILE.INC·17=QUARTILE.INC·18=PERCENTILE.EXC·19=QUARTILE.EXC."
      },
      {
        "name": "옵션",
        "required": true,
        "desc": "무엇을 무시할지 정하는 0~7 번호: 0=중첩 소계 무시·1=숨김+중첩·2=오류+중첩·3=숨김+오류+중첩·4=안 무시·5=숨김만·6=오류만·7=숨김+오류. 실무는 오류 제거 6·필터 반영 5."
      },
      {
        "name": "참조1 / 배열",
        "required": true,
        "desc": "집계할 셀 범위. 집계방법 1~13이면 여러 범위를 이어 쓰는 '참조1', 14~19면 순위 대상 '배열' 하나."
      },
      {
        "name": "참조2 …",
        "required": false,
        "desc": "집계방법이 1~13일 때만 추가로 이어 붙일 수 있는 두 번째 이후 범위(SUM처럼 여러 구간 합산 가능). 14~19에서는 쓸 수 없습니다."
      },
      {
        "name": "순위 / 분위",
        "required": false,
        "desc": "집계방법 14~19일 때 필수. 14/15=몇 번째(1=1등), 16/18=0~1 백분위(0.9=90%), 17/19=1~3 사분위 번호. 1~13에선 미사용."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "오류가 섞인 청구액 합계 구하기",
        "formula": "=AGGREGATE(9, 6, B2:B11)",
        "result": "B2:B11 안에 #N/A 같은 오류 셀이 있어도 무시하고 정상 숫자만 더한 합계",
        "explain": "집계방법 9(합계)+옵션 6(오류 무시)으로, 오류 섞인 청구액 열도 SUM처럼 터지지 않고 멀쩡한 값만 더합니다."
      },
      {
        "level": "basic",
        "title": "필터로 걸러 보이는 행만 평균 내기",
        "formula": "=AGGREGATE(1, 5, C2:C500)",
        "result": "필터로 숨긴 행을 빼고, 현재 화면에 보이는 행들만의 평균 보험료",
        "explain": "집계방법 1(평균)+옵션 5(숨김 무시)로 필터에 보이는 행만 평균 내며, SUBTOTAL보다 옵션이 풍부합니다."
      },
      {
        "level": "advanced",
        "title": "오류를 무시하고 가장 큰 청구액 Top 3 뽑기",
        "formula": "=AGGREGATE(14, 6, claim_amt, ROW()-1)",
        "result": "1행에 넣으면 1위, 아래로 채우면 2위·3위 최대 청구액이 차례로 표시(오류 셀 무시)",
        "explain": "집계방법 14(LARGE)+옵션 6으로, ROW()-1이 순위를 늘려 오류를 건너뛴 Top 3를 안전하게 뽑습니다."
      },
      {
        "level": "advanced",
        "title": "특정 상품만 골라 최소값 — 배열식을 오류 없이",
        "formula": "=AGGREGATE(15, 6, 1/(product=\"암보험\")*claim_amt, 1)",
        "result": "product가 \"암보험\"인 계약들 중 가장 작은 청구액(다른 상품 행은 자동 제외)",
        "explain": "조건 밖 행을 1/0 오류로 만든 뒤 옵션 6이 무시해 '암보험' 최솟값만 남기며(집계방법 15=SMALL), CSE 없이 조건부 배열 집계가 됩니다."
      },
      {
        "level": "advanced",
        "title": "여러 소계와 섞여도 이중 계산 없이 총계",
        "formula": "=AGGREGATE(9, 3, D2:D200)",
        "result": "D열 중간중간의 소계(SUBTOTAL·AGGREGATE) 셀과 오류·숨겨진 행을 모두 빼고 낸 순수 총계",
        "explain": "집계방법 9(합계)+옵션 3(숨김+오류+소계 무시)으로, SUBTOTAL 소계 셀을 이중 합산하는 실수를 막습니다."
      }
    ],
    "related": [
      "SUBTOTAL",
      "SUM",
      "SUMIFS",
      "LARGE",
      "SMALL",
      "PERCENTILE.INC"
    ],
    "tips": "- 집계방법 14~19(LARGE·SMALL·백분위·사분위)는 마지막 '순위/분위' 필수·범위 하나만\n- 옵션 6=오류만, 5=숨긴 행만, 3=둘 다+소계 무시 — 목적에 맞게 선택\n- 옵션은 세로 열 범위에서 필터·숨김을 인식"
  },
  {
    "id": "maxifs",
    "name": "MAXIFS · MINIFS",
    "category": "logic",
    "version": "2019",
    "weight": 3,
    "difficulty": 2,
    "syntax": "=MAXIFS(최대범위, 조건범위1, 조건1, [조건범위2, 조건2], …)  ·  =MINIFS(최소범위, 조건범위1, 조건1, …)",
    "summary": "조건에 맞는 값들 중에서 최댓값(MAXIFS)·최솟값(MINIFS)을 구합니다.",
    "intro": "MAXIFS·MINIFS는 조건에 맞는 데이터만 놓고 그중 최댓값·최솟값을 찾습니다.\n\n- 인수 순서는 AVERAGEIFS와 동일 — 값 범위가 맨 앞, 뒤에 (조건범위, 조건) 쌍\n- 조건은 여러 개 걸 수 있고 모두 만족(AND)하는 데이터만 대상\n- Excel 2019부터. 맞는 값이 없으면 오류가 아니라 0을 반환(음수 데이터 주의)",
    "params": [
      {
        "name": "최대범위 / 최소범위",
        "required": true,
        "desc": "실제로 최댓값·최솟값을 뽑아낼 숫자 범위(맨 앞에 위치)."
      },
      {
        "name": "조건범위1",
        "required": true,
        "desc": "조건을 검사할 셀 범위. 최대/최소범위와 크기가 같아야 함."
      },
      {
        "name": "조건1",
        "required": true,
        "desc": "찾을 기준. \"자동차\", \">100\", \"*생명*\" 등(큰따옴표로 감쌈)."
      },
      {
        "name": "조건범위2 / 조건2 …",
        "required": false,
        "desc": "조건을 더 걸 때 추가하는 (범위, 조건) 짝(최대 126쌍). 모든 조건범위는 값 범위와 크기가 같아야 함."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "조건에 맞는 값의 최댓값 (MAXIFS)",
        "formula": "=MAXIFS(F2:F100, C2:C100, \"자동차\")",
        "result": "상품(C열)이 '자동차'인 계약 중 가장 큰 청구액(F열)",
        "explain": "값 열(F, 청구액)을 먼저 적고 조건(C=자동차)을 달아, 자동차 계약 중 최고 청구액을 돌려줍니다."
      },
      {
        "level": "basic",
        "title": "같은 조건의 최솟값 (MINIFS)",
        "formula": "=MINIFS(F2:F100, C2:C100, \"자동차\")",
        "result": "자동차 계약 중 가장 작은 청구액",
        "explain": "MAXIFS를 MINIFS로만 바꾸면 최솟값이 되며 사용법은 같습니다."
      },
      {
        "level": "advanced",
        "title": "여러 조건 + 날짜 범위로 최고 보험료 찾기",
        "formula": "=MAXIFS(E2:E100, C2:C100, \"자동차\", D2:D100, \"서울\", B2:B100, \">=\"&DATE(2026,1,1))",
        "result": "2026년 이후 서울 지역 자동차 계약 중 최고 보험료(E열)",
        "explain": "상품·지역·가입일 세 조건을 모두 만족한 계약의 최고 보험료를 뽑으며, 날짜는 \">=\"&DATE로 잇습니다."
      },
      {
        "level": "advanced",
        "title": "스필 목록으로 상품별 최고 청구액 표 자동 생성",
        "formula": "=MAXIFS($F$2:$F$100, $C$2:$C$100, H2#)",
        "result": "H2#(UNIQUE로 뽑은 상품 목록)의 상품마다 최고 청구액이 세로로 자동 채워짐(스필 배열)",
        "explain": "조건 자리에 UNIQUE 목록 H2#를 넣어 상품별 최고 청구액을 한 번에 스필하며, 2016 이하는 MAX(IF(...)) 배열 수식(CSE)으로 대신했습니다."
      }
    ],
    "tips": "- Excel 2019 이상 전용 — 이전 버전에서 열면 #NAME? 오류\n- 맞는 값이 없으면 0 반환 → 음수 데이터면 0(일치 없음)과 실제 최솟값 구분\n- 모든 조건범위는 값 범위와 크기가 같아야 함",
    "related": [
      "MAX",
      "MIN",
      "AVERAGEIFS",
      "SUMIFS",
      "COUNTIFS"
    ]
  },
  {
    "id": "switch",
    "name": "SWITCH",
    "category": "logic",
    "version": "2019",
    "weight": 3,
    "difficulty": 3,
    "syntax": "=SWITCH(대상식, 값1, 결과1, [값2, 결과2], …, [기본값])",
    "summary": "하나의 값을 여러 후보와 차례로 대조해 일치하는 결과를 돌려주는 함수.",
    "intro": "SWITCH는 하나의 대상을 여러 후보 값과 차례로 대조해 일치하는 결과를 돌려줍니다.\n\n- 대상을 한 번 적고 '후보값, 결과'를 쌍으로 나열 — 처음 일치에서 멈춤\n- '정확히 같은가(=)'만 비교 — 크기 비교는 SWITCH(TRUE, …)나 IFS\n- 맨 끝 홀로 둔 값=기본값(없이 미일치면 #N/A). 엑셀 2019부터",
    "params": [
      {
        "name": "대상식",
        "required": true,
        "desc": "여러 후보와 비교할 기준 값이나 식(예: 코드가 든 셀)"
      },
      {
        "name": "값1",
        "required": true,
        "desc": "대상식과 견줄 첫 번째 후보 값"
      },
      {
        "name": "결과1",
        "required": true,
        "desc": "대상식이 값1과 정확히 같을 때 돌려줄 결과"
      },
      {
        "name": "값2, 결과2 …",
        "required": false,
        "desc": "필요한 만큼 이어 붙이는 후보·결과 쌍"
      },
      {
        "name": "기본값",
        "required": false,
        "desc": "맨 끝에 홀로 두면 어느 후보와도 안 맞을 때의 기본 결과(생략 시 미일치는 #N/A)"
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "코드를 이름으로 바꾸기",
        "formula": "=SWITCH(A2, 1, \"월\", 2, \"화\", 3, \"수\")",
        "result": "A2가 1이면 \"월\", 2면 \"화\", 3이면 \"수\" (그 외는 #N/A)",
        "explain": "대상 A2를 후보 1·2·3과 대조해 일치하는 글자를 돌려주는 코드→이름 변환의 전형입니다."
      },
      {
        "level": "basic",
        "title": "맨 끝에 기본값 넣기",
        "formula": "=SWITCH(A2, \"L\", \"생명보험\", \"G\", \"손해보험\", \"기타\")",
        "result": "\"L\"→생명보험, \"G\"→손해보험, 그 외 전부 \"기타\"",
        "explain": "마지막에 값 하나(\"기타\")만 두면 어느 후보에도 안 맞을 때의 기본값이 됩니다."
      },
      {
        "level": "advanced",
        "title": "SWITCH(TRUE, …)로 구간 나누기",
        "formula": "=SWITCH(TRUE, A2>=90, \"A\", A2>=70, \"B\", A2>=50, \"C\", \"F\")",
        "result": "90↑ A, 70~89 B, 50~69 C, 나머지 F",
        "explain": "대상 자리에 TRUE를 넣으면 각 조건식이 참이 되는 첫 번째를 골라, IFS처럼 크기 구간을 처리합니다."
      },
      {
        "level": "advanced",
        "title": "함수 결과를 대상으로 분기하기 (MONTH 결합)",
        "formula": "=SWITCH(MONTH(A2), 1, \"1분기\", 2, \"1분기\", 3, \"1분기\", 4, \"2분기\", \"기타분기\")",
        "result": "A2 날짜의 달이 1~3이면 \"1분기\", 4면 \"2분기\" 식으로 분류",
        "explain": "대상 자리에 MONTH() 함수를 바로 넣을 수 있으나, 같은 결과 반복이 많으면 IFS·SWITCH(TRUE)가 간결합니다."
      },
      {
        "level": "advanced",
        "title": "상품명을 정렬용 순번으로 매핑 (미등록 안전 처리)",
        "formula": "=SWITCH(B2, \"자동차\", 1, \"화재\", 2, \"상해\", 3, 0)",
        "result": "상품명을 정렬·집계용 번호로 변환, 미등록 상품은 0",
        "explain": "상품명을 정렬·피벗용 순번으로 바꾸고 기본값 0으로 예외를 처리하며, 후보가 많으면 XLOOKUP 표가 편합니다."
      }
    ],
    "related": [
      "IFS",
      "IF",
      "XLOOKUP",
      "CHOOSE"
    ],
    "tips": "- '정확히 같음(=)'만 비교 — 크기 판정은 SWITCH(TRUE, 조건, 결과…)나 IFS\n- 후보가 아주 많으면 함수보다 조회표(XLOOKUP·VLOOKUP)가 유지보수에 유리"
  },
  {
    "id": "let",
    "name": "LET",
    "category": "lambda",
    "version": "2021",
    "weight": 3,
    "difficulty": 3,
    "syntax": "=LET(이름1, 값1, [이름2, 값2], …, 계산식)",
    "summary": "수식 안에서 이름(변수)을 정해 두고 재사용해, 반복 계산을 줄이고 수식을 읽기 쉽게 만드는 함수",
    "intro": "LET은 수식 안에서 값에 이름(변수)을 붙여 두고 재사용해, 반복 계산을 줄이고 수식을 읽기 쉽게 합니다.\n\n- 무거운 계산을 이름에 담으면 한 번만 계산하고 여러 번 꺼내 씀 → 더 빠름\n- '이름-값' 쌍을 먼저 나열하고 맨 끝에 계산식을 딱 한 번\n- 마지막 계산식이 최종 결과. 엑셀 2021부터",
    "params": [
      {
        "name": "이름1",
        "required": true,
        "desc": "계산에 사용할 첫 번째 이름(변수). 글자로 시작하고 셀 주소처럼 보이면 안 됩니다(A1 같은 이름 금지)."
      },
      {
        "name": "값1",
        "required": true,
        "desc": "이름1에 담을 값 또는 수식. 숫자, 셀 참조, XLOOKUP 결과 등 무엇이든 가능합니다."
      },
      {
        "name": "이름2, 값2 …",
        "required": false,
        "desc": "필요한 만큼 이름-값 쌍을 계속 추가할 수 있습니다(짝을 이뤄야 함). 뒤 이름은 앞에서 정의한 이름을 참조할 수 있습니다."
      },
      {
        "name": "계산식",
        "required": true,
        "desc": "맨 마지막 인수. 앞에서 정의한 이름들을 사용해 최종 결과를 만드는 식입니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "이름 하나 정하고 바로 쓰기",
        "formula": "=LET(x, 10, x*2)",
        "result": "20",
        "explain": "x에 10을 담고 마지막 계산식 x*2를 실행하는 '이름 정의→사용'의 가장 단순한 형태입니다."
      },
      {
        "level": "basic",
        "title": "가격과 할인율에 이름 붙이기",
        "formula": "=LET(가격, 10000, 할인율, 0.2, 가격*(1-할인율))",
        "result": "8000",
        "explain": "가격·할인율에 이름을 붙여 마지막 식에서 함께 써, 수식의 뜻이 한눈에 읽힙니다."
      },
      {
        "level": "advanced",
        "title": "무거운 조회를 한 번만 하고 재사용",
        "formula": "=LET(찾음, XLOOKUP(A2, 상품표[코드], 상품표[상품명]), IF(찾음=\"\", \"미등록\", 찾음))",
        "result": "조회 성공 시 상품명, 실패(빈값) 시 \"미등록\"",
        "explain": "XLOOKUP 결과에 '찾음' 이름을 붙여 조회를 한 번만 하고 IF에서 두 번 꺼내 써, 더 빠르고 깔끔합니다."
      },
      {
        "level": "advanced",
        "title": "FILTER 결과를 여러 통계에 재활용",
        "formula": "=LET(대상, FILTER(claim_amt, product=\"자동차\"), 평균, AVERAGE(대상), 건수, ROWS(대상), \"평균 \"&TEXT(평균,\"#,##0\")&\"원 · \"&건수&\"건\")",
        "result": "\"평균 1,250,000원 · 37건\" 형태의 문자열",
        "explain": "FILTER 결과를 '대상'에 담아 평균·건수를 뽑아 한 문장으로 합치며, 조건은 FILTER 한 곳만 고치면 됩니다."
      }
    ],
    "related": [
      "LAMBDA",
      "MAP",
      "REDUCE",
      "FILTER"
    ],
    "tips": "- 이름은 글자로 시작 — A1·R1C1처럼 셀 주소로 보이는 이름 금지\n- '이름, 값' 쌍을 나열하고 맨 끝 계산식 필수 — 빠뜨리면 오류"
  },
  {
    "id": "map",
    "name": "MAP",
    "category": "lambda",
    "version": "365",
    "weight": 3,
    "difficulty": 4,
    "syntax": "=MAP(배열1, [배열2], …, LAMBDA(값1, [값2], …, 계산식))",
    "summary": "배열의 각 값에 같은 계산(LAMBDA)을 하나씩 적용해, 같은 크기의 결과 배열로 돌려주는 함수",
    "intro": "MAP은 배열의 각 값에 같은 계산(LAMBDA)을 하나씩 적용해, 같은 크기의 결과 배열로 돌려줍니다.\n\n- 보조 열을 만들어 아래로 복사하던 작업을 수식 하나로 대체\n- LAMBDA 매개변수 개수 = 넣은 배열 개수(둘이면 같은 위치끼리 계산)\n- 결과는 자동 스필. 엑셀 365 전용",
    "params": [
      {
        "name": "배열1",
        "required": true,
        "desc": "계산을 적용할 값들의 범위 또는 배열."
      },
      {
        "name": "배열2 …",
        "required": false,
        "desc": "함께 계산할 추가 배열. 배열1과 크기(행·열)가 같아야 하며, LAMBDA 매개변수 순서대로 짝지어집니다."
      },
      {
        "name": "LAMBDA(값…, 계산식)",
        "required": true,
        "desc": "각 위치의 값에 적용할 계산. 앞에 넣은 배열 수만큼 매개변수를 받아 계산식으로 결과를 만듭니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "각 값에 10 곱하기",
        "formula": "=MAP({1,2,3}, LAMBDA(x, x*10))",
        "result": "{10, 20, 30} (가로 스필)",
        "explain": "{1,2,3}의 값을 x로 받아 x*10을 계산해 자동 스필하는 MAP의 기본 동작입니다."
      },
      {
        "level": "basic",
        "title": "범위 전체를 10% 인상",
        "formula": "=MAP(A2:A6, LAMBDA(값, 값*1.1))",
        "result": "A2:A6 각 값에 1.1을 곱한 5개 결과가 세로로 스필",
        "explain": "보조 열 복사 대신 MAP 한 줄로 범위 전체를 변환하며, 결과는 입력과 같은 세로로 스필됩니다."
      },
      {
        "level": "advanced",
        "title": "두 배열을 짝지어 손해율 계산(0 나눗셈 방어)",
        "formula": "=MAP(claim_amt, premium, LAMBDA(c, p, IF(p=0, \"\", c/p)))",
        "result": "행별 손해율(청구액/보험료)이 세로로 스필, 보험료 0인 행은 빈칸",
        "explain": "배열 둘을 넣으면 LAMBDA도 매개변수 둘로 c·p를 짝지어 손해율을 구하되, p=0 행은 빈칸 처리합니다."
      },
      {
        "level": "advanced",
        "title": "청구액을 금액대별 등급으로 분류",
        "formula": "=MAP(claim_amt, LAMBDA(c, IF(c>=1000000, \"고액\", IF(c>=100000, \"중간\", \"소액\"))))",
        "result": "각 청구 건이 \"고액\"/\"중간\"/\"소액\" 중 하나로 분류되어 세로 스필",
        "explain": "여러 단계 IF 판정을 배열 전체에 한 번에 적용하며, 표 참조 시 데이터가 늘면 결과도 자동 확장됩니다."
      }
    ],
    "related": [
      "LAMBDA",
      "REDUCE",
      "SCAN",
      "BYROW",
      "BYCOL"
    ],
    "tips": "- 여러 배열은 모두 같은 행·열 크기여야 함 — 다르면 오류\n- 값을 독립 변환하면 MAP, 하나로 누적하면 REDUCE, 누적 과정을 남기면 SCAN"
  },
  {
    "id": "byrow-bycol",
    "name": "BYROW · BYCOL",
    "category": "lambda",
    "version": "365",
    "weight": 2,
    "difficulty": 4,
    "syntax": "=BYROW(배열, LAMBDA(행, 계산식))  ·  =BYCOL(배열, LAMBDA(열, 계산식))",
    "summary": "표의 각 행(BYROW)/각 열(BYCOL)을 통째로 넘겨 한 줄당 값 하나로 요약한 배열을 돌려준다.",
    "intro": "BYROW는 각 행을, BYCOL은 각 열을 통째로 LAMBDA에 넘겨 한 줄당 값 하나로 요약합니다.\n\n- BYROW는 세로 배열, BYCOL은 가로 배열로 돌려줌(예: 행별 평균·열별 합계)\n- LAMBDA는 행/열마다 반드시 '값 하나(스칼라)'를 반환 — 평균·합계·판정 등\n- 한 줄을 여러 값으로 바꾸려면 MAP. 엑셀 365 전용",
    "params": [
      {
        "name": "배열",
        "required": true,
        "desc": "행 또는 열 단위로 계산할 표/범위."
      },
      {
        "name": "LAMBDA(행, 계산식) / LAMBDA(열, 계산식)",
        "required": true,
        "desc": "각 행(BYROW) 또는 각 열(BYCOL)을 인수로 받아 값 하나로 요약하는 규칙. 인수에는 그 행/열 전체가 배열로 들어온다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "행마다 평균 구하기(개인별 평균)",
        "formula": "=BYROW(B2:D4, LAMBDA(행, AVERAGE(행)))",
        "result": "각 행의 평균이 세로 배열로 아래로 스필(예: {82; 75; 90})",
        "explain": "각 행(한 사람의 세 값)이 '행'에 들어와 AVERAGE로 평균을 내며, 나머지 행은 자동 스필됩니다."
      },
      {
        "level": "basic",
        "title": "열마다 합계 구하기(과목별/월별 합계)",
        "formula": "=BYCOL(B2:D4, LAMBDA(열, SUM(열)))",
        "result": "각 열의 합계가 가로 배열로 오른쪽으로 스필",
        "explain": "각 열이 '열'에 들어와 SUM으로 더하며, 방향만 다를 뿐 BYROW와 사용법은 같습니다."
      },
      {
        "level": "advanced",
        "title": "행별 조건 판정(계약별 고액청구 표시)",
        "formula": "=BYROW(claim_amt, LAMBDA(행, IF(MAX(행)>1000000, \"주의\", \"정상\")))",
        "result": "계약마다 \"주의\" 또는 \"정상\"이 세로로 표시",
        "explain": "각 행의 청구액 중 하나라도 100만↑이면 '주의'로 표시해, 행을 판정 결과 하나로 압축합니다."
      },
      {
        "level": "advanced",
        "title": "열별 조건 집계(상품별 해지 건수)",
        "formula": "=BYCOL(status, LAMBDA(열, SUM(--(열=\"해지\"))))",
        "result": "각 상품 열의 '해지' 건수가 가로로 스필",
        "explain": "각 열에서 '해지'를 --로 1/0으로 바꿔 SUM으로 세어, COUNTIF를 열마다 반복한 효과를 냅니다."
      },
      {
        "level": "advanced",
        "title": "행별 변동폭(최댓값-최솟값)",
        "formula": "=BYROW(B2:M2, LAMBDA(행, MAX(행)-MIN(행)))",
        "result": "각 상품/계약의 월별 변동폭(최대-최소)이 행마다 표시",
        "explain": "MAX-MIN 차이로 월별 청구액 변동폭을 한 줄당 값 하나로 요약합니다."
      }
    ],
    "tips": "- LAMBDA는 행/열당 값 하나만 — 배열을 반환하면 #CALC! 오류\n- 여러 값 변환은 MAP, 위치 기반 새 표는 MAKEARRAY\n- 결과가 스필되므로 출력 방향(BYROW=아래·BYCOL=오른쪽)에 빈 칸 필요",
    "related": [
      "MAP",
      "REDUCE",
      "LAMBDA",
      "SUM",
      "AVERAGE"
    ]
  },
  {
    "id": "lambda",
    "name": "LAMBDA",
    "category": "lambda",
    "version": "2021",
    "weight": 2,
    "difficulty": 5,
    "syntax": "=LAMBDA(매개변수1, [매개변수2], …, 계산식)(인수1, [인수2], …)",
    "summary": "매개변수와 계산식으로 '나만의 함수'를 직접 만드는 함수 — 이름을 붙여 두면 SUM처럼 재사용 가능",
    "intro": "LAMBDA는 매개변수와 계산식으로 '나만의 함수'를 직접 만드는 함수입니다.\n\n- 이름 없는 함수 — 뒤에 괄호를 붙여 바로 실행(예: LAMBDA(x, x*2)(5))\n- 이름 관리자에 등록하면 =부가세(50000)처럼 내장 함수처럼 재사용\n- MAP·REDUCE·BYROW의 '재료'로 넘겨 계산을 정의. 엑셀 2021부터",
    "params": [
      {
        "name": "매개변수1",
        "required": true,
        "desc": "함수가 받을 첫 번째 입력값의 이름. 계산식 안에서 이 이름으로 입력값을 부릅니다."
      },
      {
        "name": "매개변수2 …",
        "required": false,
        "desc": "필요한 만큼(최대 253개) 입력 이름을 추가할 수 있습니다."
      },
      {
        "name": "계산식",
        "required": true,
        "desc": "맨 마지막 인수. 매개변수들을 사용해 결과를 만드는 식입니다."
      },
      {
        "name": "(인수…)",
        "required": false,
        "desc": "LAMBDA 뒤에 괄호로 붙이는 실제 입력값. 셀에서 바로 테스트할 때 사용하며, 이름 관리자에 등록해 쓸 때는 붙이지 않습니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "만든 자리에서 바로 실행(제곱)",
        "formula": "=LAMBDA(x, x*x)(5)",
        "result": "25",
        "explain": "x를 받아 x*x를 돌려주는 함수를 만들고 뒤 괄호에 5를 넣어 실행하는 가장 단순한 예입니다."
      },
      {
        "level": "basic",
        "title": "매개변수 두 개로 더하기",
        "formula": "=LAMBDA(a, b, a+b)(3, 4)",
        "result": "7",
        "explain": "입력 두 개(a, b)를 받아 뒤 괄호의 3, 4를 순서대로 대입(a=3·b=4)해 7을 돌려줍니다."
      },
      {
        "level": "advanced",
        "title": "이름 관리자에 등록해 재사용(손해율)",
        "formula": "=손해율(claim_amt, premium)",
        "result": "청구액/보험료 = 예: 0.62 (미리 이름 관리자에 손해율 = LAMBDA(청구, 보험료, IF(보험료=0, \"\", 청구/보험료)) 등록)",
        "explain": "이름 관리자에 손해율 LAMBDA를 등록하면 어디서든 =손해율(...)로 부를 수 있고, 0 나눗셈 처리까지 한 번에 관리합니다."
      },
      {
        "level": "advanced",
        "title": "MAP의 재료로 넘겨 배열 전체에 적용",
        "formula": "=MAP(premium, LAMBDA(p, ROUND(p*0.1, 0)))",
        "result": "보험료 범위의 각 값에 10%를 적용한 결과가 세로로 스필",
        "explain": "'p를 받아 10%를 반올림하는 계산'을 MAP에 넘겨 범위 전체에 한꺼번에 적용합니다."
      }
    ],
    "related": [
      "LET",
      "MAP",
      "REDUCE",
      "SCAN",
      "BYROW",
      "BYCOL"
    ],
    "tips": "- 이름 관리자 등록 시 뒤 괄호(인수) 없이 LAMBDA(...) 정의만\n- 재귀도 가능하나 이름 등록이 필요하고 무한 반복을 막을 종료 조건 필수"
  },
  {
    "id": "reduce",
    "name": "REDUCE · SCAN",
    "category": "lambda",
    "version": "365",
    "weight": 2,
    "difficulty": 5,
    "syntax": "=REDUCE([초기값], 배열, LAMBDA(누적값, 현재값, 계산식))\n=SCAN(초깃값, 배열, LAMBDA(누계, 값, 계산식))",
    "summary": "배열을 앞에서부터 하나씩 누적 계산하는 형제 함수 — REDUCE는 최종 결과 하나로 '줄이고', SCAN은 매 단계의 중간 과정을 전부 배열로 돌려준다.",
    "intro": "REDUCE·SCAN은 배열을 앞에서부터 하나씩 훑으며 '누적값'을 계속 갱신하는 형제 함수입니다.\n\n- 세 부분: 초기값(합계 0·곱 1·문자열 \"\"), 배열, LAMBDA(누적값, 현재값, 계산식)\n- REDUCE는 마지막 누적값 하나만, SCAN은 매 단계 누적값을 배열로 전부(러닝 토탈)\n- 조건부 누적 등 일반 함수로 어려운 반복 로직에 강함. 엑셀 365 전용",
    "params": [
      {
        "name": "초기값 / 초깃값",
        "required": false,
        "desc": "누적 시작 첫 값. 합계 0·곱 1·문자열 \"\". REDUCE는 생략 가능(0에서 시작), SCAN은 필수."
      },
      {
        "name": "배열",
        "required": true,
        "desc": "처음부터 끝까지 순서대로 훑어 가며 누적할 값들의 범위 또는 배열. 두 함수 공통."
      },
      {
        "name": "LAMBDA(누적값, 현재값, 계산식)",
        "required": true,
        "desc": "누적 규칙. 첫 매개변수=지금까지의 누적값, 둘째=이번 현재값, 계산식 결과가 다음 누적값. 이름은 자유롭되 순서(누적값 먼저)는 준수."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "REDUCE — 값들을 모두 더해 결과 하나로",
        "formula": "=REDUCE(0, {1,2,3,4}, LAMBDA(누적, 값, 누적+값))",
        "result": "10",
        "explain": "초기값 0에서 0→1→3→6→10으로 더해 마지막 누적값 10 하나만 남기는 것이 REDUCE의 핵심입니다."
      },
      {
        "level": "basic",
        "title": "SCAN — 숫자를 하나씩 더하는 누적 합계",
        "formula": "=SCAN(0, {10;20;30}, LAMBDA(누계, 값, 누계+값))",
        "result": "세로 배열 {10; 30; 60}이 스필로 표시",
        "explain": "10→30→60으로 더하되 각 단계 누적값을 배열로 내, REDUCE(60 하나)와 SCAN(10,30,60)의 차이를 보여 줍니다."
      },
      {
        "level": "advanced",
        "title": "REDUCE — 기준 이상 고액 청구만 골라 합산",
        "formula": "=REDUCE(0, claim_amt, LAMBDA(합, c, 합 + IF(c>=1000000, c, 0)))",
        "result": "100만 원 이상 청구 건들의 합계(그 외는 더하지 않음)",
        "explain": "누적 규칙 안 IF로 조건 값만 더해, '누적하며 판단'하는 로직을 결과 하나로 집계합니다(SUMIF 대체)."
      },
      {
        "level": "advanced",
        "title": "SCAN — 복리 누적 성장배수(곱 누적)",
        "formula": "=SCAN(1, 1+E2:E6, LAMBDA(a, v, a*v))",
        "result": "예: 수익률 3%,5%,2%,4%,3% → 1.03, 1.0815, 1.1031, 1.1472, 1.1816",
        "explain": "연도별 (1+수익률)을 곱해 연도마다 누적 성장배수를 내며, 곱셈이라 초깃값 1·과정이 필요해 SCAN이 제격입니다."
      },
      {
        "level": "advanced",
        "title": "REDUCE vs SCAN — 러닝 토탈 만들기 비교",
        "formula": "=SCAN(0, 금액범위, LAMBDA(a, v, a+v))   ↔   =DROP(REDUCE(0, 금액범위, LAMBDA(누적, v, VSTACK(누적, INDEX(누적, ROWS(누적)) + v))), 1)",
        "result": "둘 다 각 행까지의 누계가 위에서부터 쌓인 세로 배열",
        "explain": "같은 러닝 토탈을 SCAN은 한 줄로, REDUCE는 VSTACK+DROP으로 번거롭게 만들어 '과정=SCAN·마지막=REDUCE' 기준을 보여 줍니다."
      }
    ],
    "tips": "- 결과 하나면 REDUCE, 누적 과정 전체(러닝 토탈)면 SCAN\n- 초기값은 합계 0·곱 1·문자열 \"\" — REDUCE는 생략 가능, SCAN은 필수\n- LAMBDA 인수 순서(누적값 먼저·현재값 나중) 준수, SCAN은 빈 칸 없으면 #SPILL!\n- 값마다 독립 변환만 하면 MAP",
    "related": [
      "MAP",
      "LAMBDA",
      "VSTACK",
      "MAKEARRAY",
      "SEQUENCE"
    ]
  },
  {
    "id": "isomitted",
    "name": "ISOMITTED",
    "category": "lambda",
    "version": "365",
    "weight": 1,
    "difficulty": 5,
    "syntax": "=ISOMITTED(인수)   ← LAMBDA 안에서 사용",
    "summary": "LAMBDA 함수의 인수를 사용자가 생략했는지 검사한다. 생략=TRUE, 값 있음=FALSE.",
    "intro": "ISOMITTED는 LAMBDA 안에서 인수를 사용자가 생략했는지 검사합니다(생략=TRUE, 값 있음=FALSE).\n\n- 쓸모는 '선택 인수(기본값 있는 인수)' 만들기 — 안 적으면 기본값 적용\n- 거의 항상 IF와 짝 — IF(ISOMITTED(인수), 기본값, 넘어온값)\n- LAMBDA를 이름 관리자에 저장해 쓰는 고급 용도. 엑셀 365 전용",
    "params": [
      {
        "name": "인수",
        "required": true,
        "desc": "생략 여부를 검사할 LAMBDA 인수의 이름. 사용자가 그 자리를 비워 두면 TRUE, 값을 넣으면 FALSE를 반환한다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "인수를 넘긴 경우(FALSE)",
        "formula": "=LAMBDA(a,b, IF(ISOMITTED(b), a+10, a+b))(1, 2)",
        "result": "3",
        "explain": "b에 2를 넘겨 ISOMITTED(b)가 FALSE라 a+b=1+2=3이 되며, 뒤 (1, 2)가 LAMBDA를 곧바로 호출합니다."
      },
      {
        "level": "basic",
        "title": "인수를 생략한 경우(TRUE)",
        "formula": "=LAMBDA(a,b, IF(ISOMITTED(b), a+10, a+b))(1, )",
        "result": "11",
        "explain": "b 자리를 비우면 ISOMITTED(b)가 TRUE라 기본 로직 a+10=11이 적용됩니다."
      },
      {
        "level": "advanced",
        "title": "선택 할인율이 있는 보험료 함수(이름 정의)",
        "formula": "보험료 = LAMBDA(기본료, [할인율], 기본료*(1-IF(ISOMITTED(할인율), 0.05, 할인율)))",
        "result": "=보험료(100000) → 95000,  =보험료(100000, 0.1) → 90000",
        "explain": "'보험료'로 저장한 함수로, 할인율을 안 적으면 기본 5%(0.05)·적으면 그 값을 적용합니다(선택 인수는 뒤쪽·대괄호[])."
      },
      {
        "level": "advanced",
        "title": "여러 선택 인수에 각각 기본값 주기(이름 정의)",
        "formula": "이자계산 = LAMBDA(원금, [연이율], [개월], 원금*(IF(ISOMITTED(연이율),0.03,연이율))/12*IF(ISOMITTED(개월),12,개월))",
        "result": "=이자계산(1000000) → 30000(3%·12개월),  =이자계산(1000000, 0.05, 6) → 25000",
        "explain": "선택 인수 둘을 각각 ISOMITTED로 검사해 연이율 생략 시 3%·개월 생략 시 12개월을 적용합니다."
      }
    ],
    "tips": "- LAMBDA 매개변수에만 사용 — 일반 셀 참조엔 불가\n- 선택 인수는 뒤쪽에 두고 이름에 대괄호[] 표기\n- 생략은 마지막이면 값 비우고, 중간이면 콤마로 자리 유지",
    "related": [
      "LAMBDA",
      "LET",
      "IF"
    ]
  },
  {
    "id": "makearray",
    "name": "MAKEARRAY",
    "category": "lambda",
    "version": "365",
    "weight": 1,
    "difficulty": 4,
    "syntax": "=MAKEARRAY(행수, 열수, LAMBDA(행, 열, 계산식))",
    "summary": "행수×열수 크기의 표를 만들고, 각 칸을 그 칸의 행·열 번호로 계산해 채운다.",
    "intro": "MAKEARRAY는 정해진 크기(행수×열수)의 표를 만들고, 각 칸을 그 칸의 행·열 번호로 계산해 채웁니다.\n\n- 칸마다 행 번호·열 번호를 LAMBDA에 넘김(둘 다 1부터) → 위치별로 다른 값\n- 대표 예: 각 칸에 행×열을 넣은 구구단, 단위행렬\n- 기존 데이터 변형은 MAP, 위치 규칙으로 새 표 생성은 MAKEARRAY. 엑셀 365 전용",
    "params": [
      {
        "name": "행수",
        "required": true,
        "desc": "만들 배열의 행 개수(세로 칸 수)."
      },
      {
        "name": "열수",
        "required": true,
        "desc": "만들 배열의 열 개수(가로 칸 수)."
      },
      {
        "name": "LAMBDA(행, 열, 계산식)",
        "required": true,
        "desc": "각 칸에서 실행할 규칙. 행=현재 칸의 행 번호(1부터), 열=현재 칸의 열 번호(1부터)."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "구구단(위치 곱하기)",
        "formula": "=MAKEARRAY(3, 3, LAMBDA(행,열, 행*열))",
        "result": "3×3 배열: 1 2 3 / 2 4 6 / 3 6 9",
        "explain": "각 칸에 '행 번호 × 열 번호'를 넣으며, 행·열이 1부터 세어진다는 점이 기본 원리입니다."
      },
      {
        "level": "basic",
        "title": "0으로 채운 빈 표 만들기",
        "formula": "=MAKEARRAY(2, 3, LAMBDA(행,열, 0))",
        "result": "2행 3열이 전부 0인 배열",
        "explain": "행·열 번호를 안 쓰고 항상 0을 반환해 원하는 크기의 '0 채움 표'를 만듭니다."
      },
      {
        "level": "advanced",
        "title": "단위행렬(대각선만 1)",
        "formula": "=MAKEARRAY(4, 4, LAMBDA(행,열, IF(행=열, 1, 0)))",
        "result": "4×4 단위행렬(대각선 1, 나머지 0)",
        "explain": "행 번호와 열 번호가 같은 대각선 칸에만 1을 넣어, 통계·행렬 계산의 기초 재료를 만듭니다."
      },
      {
        "level": "advanced",
        "title": "보험료 요율표 격자(위치 기반 산출)",
        "formula": "=MAKEARRAY(5, 5, LAMBDA(행,열, 50000*(1+0.03*(행-1))*(1-0.01*(열-1))))",
        "result": "나이대(행)가 올라가면 오르고 납입기간(열)이 길수록 내려가는 5×5 보험료 격자",
        "explain": "기본료 50,000에서 행마다 3% 가산·열마다 1% 할인하며, -1은 첫 칸(1행 1열)을 기준값으로 두기 위함입니다."
      },
      {
        "level": "advanced",
        "title": "기존 표를 위치로 참조해 5% 인상표 만들기",
        "formula": "=MAKEARRAY(ROWS(rng), COLS(rng), LAMBDA(행,열, INDEX(rng, 행, 열)*1.05))",
        "result": "rng와 같은 크기이면서 모든 값이 5% 인상된 표",
        "explain": "행·열 번호를 INDEX에 넘겨 rng의 각 칸을 꺼내 1.05를 곱하며, ROWS·COLS로 원본 크기를 맞춥니다."
      }
    ],
    "tips": "- 행·열 번호는 항상 1부터 시작\n- 크기가 커지면(예: 1000×1000) 칸마다 계산해 무거워짐 — 필요한 크기만\n- 연속 숫자만 필요하면 SEQUENCE, 기존 배열 변형만이면 MAP이 간단",
    "related": [
      "SEQUENCE",
      "MAP",
      "LAMBDA",
      "RANDARRAY",
      "INDEX"
    ]
  },
  {
    "id": "spill-operator",
    "name": "스필 범위 연산자 (#)",
    "category": "dataref",
    "version": "2021",
    "weight": 4,
    "difficulty": 2,
    "syntax": "=첫번째셀#   (예: =D2#, =SUM(A2#))",
    "summary": "동적 배열이 펼쳐진 전체 범위를 '#' 하나로 자동 참조",
    "intro": "스필 범위 연산자(#)는 동적 배열이 펼쳐진 전체 범위를, 개수와 상관없이 '#' 하나로 통째로 가리킵니다.\n\n- FILTER·UNIQUE·SORT·SEQUENCE 결과가 펼쳐진 앵커셀 뒤에 # (예: A2#)\n- 목록이 늘거나 줄면 참조 범위도 자동으로 따라감(=SUM(D2#) 등)\n- 반드시 동적 배열의 첫(왼쪽 위) 셀에만. 엑셀 2021·365",
    "params": [
      {
        "name": "앵커셀",
        "required": true,
        "desc": "동적 배열의 첫 번째(왼쪽 위) 셀 참조. 뒤에 #을 붙여 그 셀에서 펼쳐진 전체 범위를 가리킴 (예: D2#). 중간 셀에는 붙일 수 없음"
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "펼쳐진 목록 전체 참조",
        "formula": "=A2#",
        "result": "A2에서 아래로 스필된 동적 배열 전체(예: A2:A15)를 하나의 범위로 참조",
        "explain": "UNIQUE로 펼쳐진 결과 전체를 'A2#' 하나로 가리키며, 목록 길이가 바뀌어도 자동으로 따라갑니다."
      },
      {
        "level": "basic",
        "title": "스필 결과 합계 내기",
        "formula": "=SUM(D2#)",
        "result": "D2에서 시작해 펼쳐진 금액 배열 전체의 합계(예: 160,000)",
        "explain": "D2에 펼쳐진 금액 배열 전체를 D2#으로 잡아 합계를 내, 행이 늘어도 범위를 다시 지정할 필요가 없습니다."
      },
      {
        "level": "advanced",
        "title": "자동 확장되는 상품별 합계표",
        "formula": "=SUMIF(계약[상품], G2#, 계약[보험료])",
        "result": "G2#(고유 상품 목록)의 상품 수만큼 자동 확장된 상품별 보험료 합계 배열",
        "explain": "UNIQUE 상품 목록(G2#)을 SUMIF 조건으로 써, 새 상품이 생기면 목록·합계가 함께 느는 '살아 있는' 요약표가 됩니다."
      },
      {
        "level": "advanced",
        "title": "개수 세기 · 동적 드롭다운",
        "formula": "=COUNTA(A2#)",
        "result": "A2에서 펼쳐진 항목의 개수(목록이 늘거나 줄면 값도 자동 변경)",
        "explain": "A2#으로 펼쳐진 항목 개수를 세며, 유효성 검사 원본에 '=$A$2#'을 넣으면 드롭다운도 자동 갱신됩니다."
      }
    ],
    "related": [
      "FILTER",
      "UNIQUE",
      "SORT",
      "SEQUENCE",
      "암시적 교차 연산자 (@)"
    ],
    "tips": "- 반드시 첫(왼쪽 위) 셀에 붙임 — D2#은 OK, 중간 셀 D3#은 오류\n- 일반 값·단일 셀엔 불가, 스필 자리에 다른 값이 있으면 #SPILL!(비우면 복구)\n- 스필 범위를 '이름 정의'로 등록하면 차트·유효성 검사에서 편리"
  },
  {
    "id": "structured-ref",
    "name": "구조적 참조 (표 · #·@)",
    "category": "dataref",
    "version": "all",
    "weight": 3,
    "difficulty": 2,
    "syntax": "표이름[열이름]                     (그 열의 데이터 전체)\n표이름[[#All]] / [[#Data]] / [[#Headers]] / [[#Totals]]\n표이름[@열이름]  또는  [@[열 이름]]   (현재 행의 그 열)",
    "summary": "엑셀 '표(Table, Ctrl+T)'의 열·영역을 셀 주소 대신 이름으로 참조합니다. [#…]은 영역, [@…]은 현재 행. 행이 늘면 자동 확장.",
    "intro": "구조적 참조는 셀 주소(D2:D100) 대신 '표 이름과 열 이름'으로 데이터를 가리키는 방법입니다(먼저 Ctrl+T로 표 생성).\n\n- 열 이름(계약[보험료])=그 열 데이터 전체, #로 시작=영역([#All]·[#Data]·[#Headers]·[#Totals])\n- @는 '현재 행' — 표 안 =[@보험료]*0.1은 행마다 자기 행 값\n- 행을 추가하면 참조 범위가 자동 확장 → 수식 수정 불필요",
    "params": [
      {
        "name": "표이름[열이름]",
        "required": true,
        "desc": "그 열의 데이터 전체를 가리킵니다. 예: 계약[보험료]. 행이 추가되면 범위가 자동으로 확장됩니다."
      },
      {
        "name": "[[#All]] · [[#Data]] · [[#Headers]] · [[#Totals]]",
        "required": false,
        "desc": "표의 영역 지정자(#). 순서대로 전체·데이터만·제목 줄·합계 줄. 예: 계약[[#Headers]]는 제목 행만."
      },
      {
        "name": "[@열이름] · [@[열 이름]]",
        "required": false,
        "desc": "@는 '현재 행'. 표 안 수식에서 자기 행의 그 열 값을 가리킵니다. 열 이름에 공백·기호가 있으면 [@[가입 금액]]처럼 안쪽 대괄호로 감쌉니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "표의 한 열 전체 합계",
        "formula": "=SUM(계약[보험료])",
        "result": "'계약' 표의 보험료 열 전체 합(행이 늘면 자동 반영)",
        "explain": "표이름[열이름]으로 열 데이터 전체를 참조하며, 행을 추가해도 범위가 자동으로 늘어 합계가 갱신됩니다."
      },
      {
        "level": "basic",
        "title": "계산 열 — 현재 행 값 사용(@)",
        "formula": "=[@보험료]*0.1",
        "result": "각 행에서 자기 행의 보험료 × 10%",
        "explain": "표 안 @는 '이 행'을 뜻해, 한 셀에 입력하면 열 전체에 채워져 행마다 자기 행 보험료로 계산합니다."
      },
      {
        "level": "advanced",
        "title": "표 열을 조건으로 SUMIFS",
        "formula": "=SUMIFS(계약[보험료], 계약[상품], \"자동차\")",
        "result": "상품이 자동차인 행들의 보험료 합",
        "explain": "SUMIFS 범위 자리에 표 열을 넣으면 읽기 쉽고 데이터가 늘어도 자동 반영돼, 셀 주소 고정($)이 필요 없습니다."
      },
      {
        "level": "advanced",
        "title": "제목을 포함한 전체 영역 참조(#All)",
        "formula": "=XLOOKUP(\"P1003\", 계약[계약번호], 계약[[#All]])",
        "result": "해당 계약의 제목+데이터 전체 행 정보",
        "explain": "[#All]은 제목·데이터·합계 전체, [#Data]는 데이터만, [#Headers]는 제목 줄만 가리키는 영역 지정자입니다."
      }
    ],
    "tips": "- 먼저 Ctrl+T로 표 생성 — 표 이름은 [표 디자인] 탭에서 변경\n- #은 영역(#All·#Data·#Headers·#Totals), @는 현재 행\n- 열 이름에 공백·특수문자가 있으면 [@[열 이름]]처럼 안쪽 대괄호로 감쌈",
    "related": [
      "스필 범위 연산자 (#)",
      "SUMIFS",
      "XLOOKUP",
      "FILTER"
    ]
  },
  {
    "id": "trim-ref",
    "name": "트림 참조 (.) · TRIMRANGE",
    "category": "dataref",
    "version": "365",
    "weight": 3,
    "difficulty": 3,
    "syntax": "범위 :. 범위    (콜론 뒤 점 = 후행 빈칸 제거)\n범위 .: 범위    (콜론 앞 점 = 선행 빈칸 제거)\n범위 .:. 범위   (양쪽 점 = 앞뒤 모두)\n=TRIMRANGE(범위, [행_방식], [열_방식])",
    "summary": "범위 참조의 콜론(:) 옆에 마침표(.)를 붙여 가장자리 빈칸을 잘라 '데이터가 있는 만큼만' 참조합니다. 함수형은 TRIMRANGE.",
    "intro": "트림 참조는 범위 참조의 콜론(:) 옆에 마침표(.)를 붙여 가장자리 빈 셀을 잘라 냅니다(Excel 2024·365).\n\n- 점 위치가 자를 쪽 — :.(A2:.A100)=후행, .:=선행, .:.=양쪽(후행이 가장 흔함)\n- A:.A처럼 전체 열과 결합하면 데이터 끝까지만 자동 참조 → 빈 셀 문제 해결\n- 함수형 TRIMRANGE(범위, [행_방식], [열_방식])도 동일(방식 0안 자름·1앞·2뒤·3양쪽, 기본 3)",
    "params": [
      {
        "name": ":. (콜론 뒤 점)",
        "required": false,
        "desc": "범위 끝(아래·오른쪽)의 빈 셀을 잘라 냅니다. 가장 흔한 형태 — 예: A2:.A100 은 A2부터 값이 있는 마지막 셀까지."
      },
      {
        "name": ".: (콜론 앞 점)",
        "required": false,
        "desc": "범위 앞(위·왼쪽)의 빈 셀을 잘라 냅니다 — 예: A2.:A100."
      },
      {
        "name": ".:. (양쪽 점)",
        "required": false,
        "desc": "범위 앞뒤의 빈 셀을 모두 잘라 냅니다 — 예: A2.:.A100."
      },
      {
        "name": "TRIMRANGE(범위, [행_방식], [열_방식])",
        "required": false,
        "desc": "함수형. 행_방식·열_방식은 0=안 자름·1=앞·2=뒤·3=양쪽(기본 3). 점 연산자와 결과가 같습니다."
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "후행 빈칸을 잘라 합계",
        "formula": "=SUM(D2:.D100)",
        "result": "D2부터 값이 있는 마지막 셀까지만 더함(빈칸 무시)",
        "explain": "콜론 뒤 점(:.)이 아래쪽 빈칸을 잘라, D100까지 넉넉히 잡아도 실제 데이터까지만 더합니다."
      },
      {
        "level": "basic",
        "title": "전체 열을 데이터만큼 자동 참조",
        "formula": "=SUM(D:.D)",
        "result": "D열에서 데이터가 있는 곳까지의 합(빈 셀 100만 개를 끌어오지 않음)",
        "explain": "D:D 대신 D:.D를 쓰면 데이터 끝까지만 보며, 행이 추가돼도 범위가 자동으로 늘어 수식 수정이 불필요합니다."
      },
      {
        "level": "advanced",
        "title": "동적 배열의 입력을 데이터만큼만",
        "formula": "=SORT(A2:.B)",
        "result": "A·B 두 열의 데이터 있는 범위만 정렬(빈칸 제외)",
        "explain": "FILTER·SORT의 입력에 트림 참조를 쓰면 데이터가 바뀌어도 채워진 부분만 처리해 스필과 궁합이 좋습니다."
      },
      {
        "level": "advanced",
        "title": "함수형 TRIMRANGE로 앞뒤 모두 정리",
        "formula": "=TRIMRANGE(A1:A100, 3)",
        "result": "A1:A100에서 앞뒤 빈 행을 모두 제거한 범위",
        "explain": "함수형도 같은 일을 하며, 둘째 인수 3은 '앞뒤 모두'(1=앞·2=뒤)로 다른 함수 인수로 재사용하기 좋습니다."
      }
    ],
    "tips": "- Excel 2024·Microsoft 365 전용(2021 이하 미지원)\n- 점은 '자를 쪽'에 — 콜론 뒤(:.)=후행, 콜론 앞(.:)=선행, 전체 열 결합 A:.A가 가장 유용\n- 완전히 빈 가장자리 행·열만 자르고 중간 빈칸은 남김",
    "related": [
      "스필 범위 연산자 (#)",
      "FILTER",
      "SORT",
      "SUM"
    ]
  },
  {
    "id": "implicit-intersection",
    "name": "암시적 교차 연산자 (@)",
    "category": "dataref",
    "version": "2021",
    "weight": 2,
    "difficulty": 3,
    "syntax": "=@참조   (예: =@A2:A10, =@SEQUENCE(5), =[@보험료])",
    "summary": "수식을 값 하나로 축소(스필 방지·같은 행 값 참조)하는 암시적 교차 연산자",
    "intro": "암시적 교차 연산자 '@'는 수식이 여러 값 대신 '값 하나만' 돌려주도록 만드는 기호입니다(스필 방지).\n\n- 범위 앞(=@A2:A10)에 쓰면 수식과 '같은 행'의 값 하나(암시적 교차)\n- 함수 결과 배열 앞(=@SEQUENCE(5))에 쓰면 맨 왼쪽 위 값 하나\n- 옛 수식(2019 이하)을 새 엑셀에서 열면 호환용 @가 자동으로 붙기도 함. 2021·365",
    "params": [
      {
        "name": "참조",
        "required": true,
        "desc": "앞에 @를 붙일 범위·배열·함수 결과. 여러 값을 단일 값으로 축소함. 범위면 '같은 행/열' 값, 함수 결과 배열이면 '맨 왼쪽 위' 값을 반환 (예: @A2:A10, @SEQUENCE(5))"
      }
    ],
    "examples": [
      {
        "level": "basic",
        "title": "스필 막고 한 값만 — @SEQUENCE",
        "formula": "=@SEQUENCE(5)",
        "result": "1 (여러 값으로 펼쳐지지 않고 배열의 맨 왼쪽 위 값 하나만 반환)",
        "explain": "1~5로 펼쳐질 SEQUENCE(5) 앞에 @를 붙여 첫 값(1)만 남기며, 결과를 한 칸에만 둘 때 씁니다."
      },
      {
        "level": "basic",
        "title": "같은 행의 값 가져오기(암시적 교차)",
        "formula": "=@A2:A10",
        "result": "수식이 5행에 있으면 A5 값을 반환(수식과 같은 행의 셀 값 하나)",
        "explain": "범위 앞 @는 '수식과 같은 행'의 값을 집어 오며, 같은 행이 겹치지 않으면 #VALUE! 오류가 납니다."
      },
      {
        "level": "advanced",
        "title": "표에서 현재 행만 계산 — [@열]",
        "formula": "=[@보험료]*0.03",
        "result": "표 계산 열에서 각 행의 보험료에 3%를 곱한 값(행마다 그 행 값만 사용)",
        "explain": "표 안 구조적 참조에서 @는 '이 행'을 뜻해, [@보험료]는 지금 행 값만 가리켜 스필을 막습니다."
      },
      {
        "level": "advanced",
        "title": "옛 파일 호환 — 자동으로 붙는 @",
        "formula": "=@B:B*0.1",
        "result": "B열 전체가 아니라 수식과 같은 행의 B값 하나에만 0.1을 곱한 값",
        "explain": "2019 이하의 '=B:B*0.1'은 같은 행만 쓰는 암시적 교차라, 새 엑셀이 동작 유지를 위해 =@B:B*0.1로 자동 변환합니다."
      }
    ],
    "related": [
      "스필 범위 연산자 (#)",
      "SEQUENCE",
      "FILTER",
      "INDEX"
    ],
    "tips": "- 진짜 여러 값이 필요하면 붙이지 말 것\n- 함수 결과 배열엔 '맨 왼쪽 위 값', 범위엔 '같은 행/열 값'으로 다르게 동작\n- 새 수식에 일부러 넣는 경우는 드묾(스필 방지·옛 파일 호환), 표의 [@열]도 같은 계열"
  }
];
