// 데이터 핸들링(pandas) 세분화 스니펫 — /datalab 파이썬 실행기의 셀별 콤보박스용.
// '분석 방법 사전'처럼 통짜로 불러오지 않고, 작업 중 필요할 때 셀에 조각을 삽입한다.
// 대부분 샘플(df=policy)·소형 인라인 프레임으로 바로 실행되며, 실제 데이터면 열
// 이름만 바꾸면 된다. 그룹은 콤보박스 optgroup, 각 항목은 한 조각(삽입 단위).
// 삽입 시 snippetInsertCode()가 상단에 '무슨 코드인지' 설명 헤더(#)를 붙인다.
//
// 결과 출력 규칙(중요): 각 조각은 '함수 실행(대입)'과 '결과 보기'를 분리한다.
//  · 마지막 줄은 print()가 아니라 결과 '값(식)'을 그대로 둔다.
//    → 브라우저 실행기는 마지막 식의 repr을 보여주고, 엑셀의 Python(=PY())은
//      그 값을 셀에 바로 반환한다(엑셀에서 print는 셀이 아닌 진단창으로 감).
//  · 콘솔에 더 보고 싶으면 필요할 때 print(...)를 별도로 추가한다.

export interface WrangleSnippet {
  id: string;
  /** 콤보박스에 보이는 이름 */
  label: string;
  /** 삽입 코드 상단에 붙는 한 줄 설명(무슨 내용인지) */
  desc: string;
  /** 셀에 삽입되는 코드 조각(중간 설명 주석 포함) */
  code: string;
}

export interface WrangleSnippetGroup {
  id: string;
  /** optgroup 라벨 */
  label: string;
  snippets: WrangleSnippet[];
}

/** 삽입 텍스트 — 상단에 '무슨 코드인지' 설명 헤더(#)를 붙여 반환 */
export function snippetInsertCode(s: WrangleSnippet): string {
  return `# ▸ ${s.label}\n# ${s.desc}\n${s.code}`;
}

export const WRANGLE_SNIPPET_GROUPS: WrangleSnippetGroup[] = [
  {
    id: "load",
    label: "데이터 입력 (읽기·생성)",
    snippets: [
      {
        id: "load-csv",
        label: "CSV 읽기 — 구분자·인코딩·헤더",
        desc: "CSV의 흔한 변형(탭 구분·한글 인코딩·헤더 없음·일부 열만)을 옵션으로 처리합니다.",
        code: `import pandas as pd

# 기본 — 첫 행이 헤더, 쉼표 구분
df = pd.read_csv("data.csv")

# 자주 쓰는 옵션 — 필요한 것만 남기고 지우세요
df = pd.read_csv(
    "data.csv",
    sep=",",              # 탭이면 "\\t", 세미콜론이면 ";"
    encoding="utf-8",     # 한글 깨지면 "cp949" (엑셀 저장 CSV)
    header=0,             # 헤더 없으면 header=None, names=["a", "b"]
    usecols=["policy_id", "premium"],   # 일부 열만 (메모리 절약)
    skiprows=2,           # 위 설명 줄 건너뛰기
    na_values=["-", "없음"],            # 결측으로 취급할 표기
    dtype={"policy_id": str},           # 앞자리 0 보존 등 형 고정
)

# 결과 보기 (콘솔은 필요하면 print(df.head()))
df.head()`,
      },
      {
        id: "load-excel",
        label: "엑셀 읽기 — 시트·범위 지정",
        desc: "시트 이름·시작 행·열 범위를 지정해 원하는 표만 읽습니다.",
        code: `import pandas as pd

# 기본 — 첫 시트
df = pd.read_excel("policy.xlsx")

# 시트·범위 지정 — 필요한 것만 남기세요
df = pd.read_excel(
    "policy.xlsx",
    sheet_name=0,         # 시트 이름("계약") 또는 순번(0부터)
    skiprows=0,           # 제목 줄이 있으면 그 수만큼
    usecols="A:F",        # 엑셀 열 문자 범위(또는 열 이름 리스트)
    header=0,             # 표 머리글 행 위치
)

df.head()`,
      },
      {
        id: "load-sheets",
        label: "여러 시트·여러 파일 합치기",
        desc: "sheet_name=None으로 전 시트를 읽어 세로로 합치거나, 여러 파일을 반복문으로 쌓습니다.",
        code: `import pandas as pd

# ① 한 파일의 모든 시트 → {시트명: DataFrame} 딕셔너리
sheets = pd.read_excel("policy.xlsx", sheet_name=None)
all_df = pd.concat(sheets, names=["sheet"]).reset_index(level=0)

# ② 여러 파일 쌓기 — 파일명을 열로 남겨 출처 추적
files = ["claims.xlsx", "policy.xlsx"]     # 실제 파일 목록으로
parts = [pd.read_excel(f).assign(source=f) for f in files]
stacked = pd.concat(parts, ignore_index=True)

all_df.head()`,
      },
      {
        id: "load-json",
        label: "JSON·중첩 구조 읽기",
        desc: "JSON 파일·API 응답을 읽고, 중첩(리스트 속 딕셔너리)은 json_normalize로 평탄화합니다.",
        code: `import pandas as pd

# ① 단순 JSON(레코드 배열) 파일
# df = pd.read_json("data.json")

# ② 중첩 구조 — json_normalize로 평탄화
raw = [
    {"policy_id": "P1", "insured": {"age": 45, "sex": "M"},
     "riders": [{"code": "R1"}, {"code": "R2"}]},
    {"policy_id": "P2", "insured": {"age": 38, "sex": "F"}, "riders": []},
]
flat = pd.json_normalize(raw, sep="_")            # insured.age → insured_age
riders = pd.json_normalize(raw, record_path="riders", meta="policy_id")

flat`,
      },
      {
        id: "load-dates",
        label: "날짜 파싱·자료형 정리",
        desc: "문자로 읽힌 날짜·숫자를 to_datetime·to_numeric으로 정리합니다(불량 값은 NaT/NaN).",
        code: `import pandas as pd

# 문자로 읽힌 날짜·숫자 예시(실제로는 read_csv 결과의 열을 그대로 쓰세요)
raw = pd.DataFrame({
    "issue_date": ["2025-01-03", "2025/02/10", "잘못됨", "2025-03-22"],
    "premium":    ["120,000", "98,500", "150000", "-"],
})

# ① 날짜 — 형식이 섞여 있으면 errors="coerce"로 불량은 NaT
raw["issue_date"] = pd.to_datetime(raw["issue_date"], errors="coerce")

# ② 숫자 — 쉼표 제거 후 변환, 불량은 NaN
raw["premium"] = pd.to_numeric(
    raw["premium"].str.replace(",", ""), errors="coerce")

# ③ 날짜에서 연·월 파생
raw["year"] = raw["issue_date"].dt.year
raw["month"] = raw["issue_date"].dt.to_period("M").astype(str)

# 읽을 때 바로 인식시키려면: pd.read_csv("f.csv", parse_dates=["issue_date"])
raw`,
      },
      {
        id: "load-manual",
        label: "직접 입력 — 소형 표 만들기",
        desc: "코드에 값을 직접 적어 소형 DataFrame을 만듭니다(요율표·매핑표·검증용 예제).",
        code: `import pandas as pd

# ① 열 단위(dict) — 가장 흔한 방법
rate_table = pd.DataFrame({
    "age_band": ["20-29", "30-39", "40-49", "50-59"],
    "rate":     [0.0012, 0.0018, 0.0031, 0.0056],
})

# ② 행 단위(리스트 of 리스트) + 열 이름
mapping = pd.DataFrame(
    [["A", "종신"], ["B", "정기"], ["C", "연금"]],
    columns=["code", "product_name"],
)

rate_table`,
      },
      {
        id: "load-url",
        label: "URL에서 바로 읽기",
        desc: "웹 주소의 CSV·엑셀을 바로 읽습니다. 브라우저 실행기에서는 상단 '데이터 소스 > URL'을 쓰세요(CORS 제약).",
        code: `import pandas as pd

# 로컬 파이썬 기준 — 공개 URL의 CSV/엑셀을 경로처럼 그대로
url = "https://example.com/data.csv"   # 실제 주소로 바꾸세요
try:
    df = pd.read_csv(url)              # 엑셀이면 pd.read_excel(url)
    print(df.shape)
except Exception as e:
    print("읽기 실패:", e)
    print("브라우저 실행기(Pyodide)는 CORS로 막힐 수 있음 →")
    print("실행기 상단 '데이터 소스 > URL'로 올리면 가상 파일로 저장됩니다")`,
      },
    ],
  },
  {
    id: "select",
    label: "선택 (loc·iloc·열)",
    snippets: [
      {
        id: "select-cols",
        label: "열 선택 (한 열·여러 열)",
        desc: "한 열은 Series, 여러 열은 대괄호 두 겹으로 DataFrame을 선택합니다.",
        code: `# 한 열은 Series, 여러 열은 대괄호 두 겹(DataFrame)
s = df["premium"]                      # Series
sub = df[["policy_id", "premium"]]     # DataFrame

# 결과 보기 — 마지막 값이 반환됨(콘솔은 필요하면 print(sub.head()))
sub.head()`,
      },
      {
        id: "select-loc",
        label: "loc — 라벨·조건으로 [행, 열]",
        desc: "loc — 인덱스·열 '라벨' 기준으로 행/열을 선택합니다(슬라이스 끝 포함).",
        code: `# loc: 라벨 기준 [행, 열] (슬라이스 끝 포함) — 결과를 sub에 저장
sub = df.loc[df["age"] >= 60, ["policy_id", "premium"]]

# 결과 보기 (콘솔은 필요하면 print(sub.head()))
sub.head()`,
      },
      {
        id: "select-iloc",
        label: "iloc — 위치(정수)로 [행, 열]",
        desc: "iloc — '정수 위치' 기준으로 행/열을 선택합니다(슬라이스 끝 제외).",
        code: `# iloc: 위치 기준 [행, 열] (슬라이스 끝 제외)
front = df.iloc[:5, :3]      # 앞 5행 × 앞 3열
back = df.iloc[-10:]         # 마지막 10행

# 결과 보기 — 마지막 값이 반환됨(다른 값은 필요하면 print(front))
back`,
      },
      {
        id: "select-dtypes",
        label: "자료형·이름 패턴으로 선택",
        desc: "자료형(select_dtypes)이나 이름 패턴(filter)으로 열 묶음을 고릅니다.",
        code: `num = df.select_dtypes("number")     # 수치형 열만
amt = df.filter(like="_amt")         # 이름에 _amt 든 열

# 결과 보기 (콘솔은 필요하면 print(num.columns.tolist()))
num.columns.tolist()`,
      },
    ],
  },
  {
    id: "filter",
    label: "조건 필터",
    snippets: [
      {
        id: "filter-multi",
        label: "복수 조건 (& | 와 괄호)",
        desc: "여러 조건을 & (그리고)·| (또는)로 잇고 각 조건을 괄호로 감쌉니다.",
        code: `# 각 조건을 괄호로 감싸고 & (그리고) · | (또는)
target = df[(df["age"] >= 40) & (df["age"] < 60) & (df["product"] == "종신")]

# 결과 보기 — 건수·열수(콘솔은 필요하면 print(target.shape))
target.shape`,
      },
      {
        id: "filter-query",
        label: "query — SQL처럼 읽히는 조건",
        desc: "query로 SQL의 WHERE처럼 조건을 읽기 좋게 씁니다(@변수로 외부값 참조).",
        code: `# 열 이름을 따옴표 없이, 외부 변수는 @변수
min_prem = 100_000
high = df.query("age >= 60 and premium >= @min_prem")

# 결과 보기 — 추출 건수·열수(콘솔은 print(len(high), "/", len(df)))
high.shape`,
      },
      {
        id: "filter-isin",
        label: "isin — 값 목록 포함",
        desc: "값 목록에 해당하는 행만 추출합니다.",
        code: `picked = df[df["product"].isin(["종신", "정기", "암보험"])]

# 결과 보기 (콘솔은 필요하면 print(picked["product"].value_counts()))
picked["product"].value_counts()`,
      },
      {
        id: "filter-not-isin",
        label: "isin 제외 (~)",
        desc: "~ isin으로 목록에 없는 행만 남깁니다(제외 필터).",
        code: `# ~ 로 목록에 없는 행만 남김(제외 필터)
others = df[~df["product"].isin(["종신", "정기"])]

others.shape   # 결과 보기 (콘솔은 print(others.shape))`,
      },
      {
        id: "filter-between",
        label: "between — 구간 조건",
        desc: "between으로 구간 조건(기본 양끝 포함)을 겁니다.",
        code: `mid = df[df["premium"].between(50_000, 150_000)]   # 양끝 포함

mid.shape   # 결과 보기 (콘솔은 print(mid.shape))`,
      },
    ],
  },
  {
    id: "branch",
    label: "조건 분기 (where·select·cut)",
    snippets: [
      {
        id: "branch-where",
        label: "np.where — 이항 분기(IF)",
        desc: "np.where로 조건 참/거짓에 따라 두 값 중 하나를 부여합니다(IF).",
        code: `import numpy as np
# 조건이 참이면 앞 값, 거짓이면 뒤 값
df["risk"] = np.where(df["age"] >= 60, "고위험", "일반")

# 결과 보기 (콘솔은 필요하면 print(df["risk"].value_counts()))
df["risk"].value_counts()`,
      },
      {
        id: "branch-select",
        label: "np.select — 다중 분기(CASE)",
        desc: "np.select로 여러 조건을 순서대로 평가해 값을 부여합니다(CASE WHEN).",
        code: `import numpy as np
# 위에서부터 첫 번째 참인 조건이 이긴다(순서 중요)
conds = [df["age"] >= 60, df["age"] >= 40]
labels = ["60+", "40-59"]
df["age_grp"] = np.select(conds, labels, default="~39")

# 결과 보기 (콘솔은 필요하면 print(df["age_grp"].value_counts()))
df["age_grp"].value_counts()`,
      },
      {
        id: "branch-cut",
        label: "pd.cut — 경계로 구간화",
        desc: "pd.cut으로 경계를 직접 지정해 연속값을 구간(범주)으로 나눕니다.",
        code: `import pandas as pd
# 경계(bins)를 직접 지정 — right=False면 [a, b) 왼쪽 포함
df["age_band"] = pd.cut(df["age"], bins=[0, 30, 40, 50, 60, 120],
                        labels=["~29", "30대", "40대", "50대", "60+"], right=False)

# 결과 보기 (콘솔은 print(df["age_band"].value_counts().sort_index()))
df["age_band"].value_counts().sort_index()`,
      },
      {
        id: "branch-qcut",
        label: "pd.qcut — 분위수 균등 분할",
        desc: "pd.qcut으로 분위수 기준 균등 구간으로 나눕니다(각 구간 건수 비슷).",
        code: `import pandas as pd
# 분위수로 균등 분할(각 구간 건수가 비슷)
df["prem_q"] = pd.qcut(df["premium"], q=4, labels=["Q1", "Q2", "Q3", "Q4"])

df["prem_q"].value_counts()   # 결과 보기 (콘솔은 print(...))`,
      },
    ],
  },
  {
    id: "join",
    label: "Join (merge) — 키로 옆 결합",
    snippets: [
      {
        id: "join-inner",
        label: "Join-inner — 양쪽 다 있는 키만",
        desc: "INNER JOIN — 양쪽 표에 모두 있는 키만 남겨 결합합니다.",
        code: `import pandas as pd
# 데모 두 표(실제로는 각자의 df로 대체)
left = pd.DataFrame({"id": [1, 2, 3], "amt": [100, 200, 300]})
right = pd.DataFrame({"id": [2, 3, 4], "grade": ["A", "B", "C"]})

# 양쪽에 모두 있는 키(2,3)만 남음
merged = left.merge(right, on="id", how="inner")
merged   # 결과 보기 (콘솔은 필요하면 print(merged))`,
      },
      {
        id: "join-left",
        label: "Join-left — 왼쪽 전부 유지",
        desc: "LEFT JOIN — 왼쪽 표는 전부 유지하고 오른쪽 정보를 붙입니다(매칭 없으면 NaN).",
        code: `import pandas as pd
left = pd.DataFrame({"id": [1, 2, 3], "amt": [100, 200, 300]})
right = pd.DataFrame({"id": [2, 3, 4], "grade": ["A", "B", "C"]})

# 왼쪽 전부 유지 — 매칭 안 되는 id 1은 grade=NaN
merged = left.merge(right, on="id", how="left")
merged   # 결과 보기 (콘솔은 print(merged))`,
      },
      {
        id: "join-right",
        label: "Join-right — 오른쪽 전부 유지",
        desc: "RIGHT JOIN — 오른쪽 표를 전부 유지합니다(왼쪽 매칭 없으면 NaN).",
        code: `import pandas as pd
left = pd.DataFrame({"id": [1, 2, 3], "amt": [100, 200, 300]})
right = pd.DataFrame({"id": [2, 3, 4], "grade": ["A", "B", "C"]})

# 오른쪽 전부 유지 — 매칭 안 되는 id 4는 amt=NaN
merged = left.merge(right, on="id", how="right")
merged   # 결과 보기 (콘솔은 print(merged))`,
      },
      {
        id: "join-outer",
        label: "Join-outer — 둘 다 전부",
        desc: "OUTER JOIN — 양쪽 키를 모두 살려 결합합니다(어느 쪽이든 없으면 NaN).",
        code: `import pandas as pd
left = pd.DataFrame({"id": [1, 2, 3], "amt": [100, 200, 300]})
right = pd.DataFrame({"id": [2, 3, 4], "grade": ["A", "B", "C"]})

# 양쪽 키 전부(1,2,3,4) — 없는 값은 NaN
merged = left.merge(right, on="id", how="outer")
merged   # 결과 보기 (콘솔은 print(merged))`,
      },
      {
        id: "join-cross",
        label: "Join-cross — 모든 조합(곱)",
        desc: "CROSS JOIN — 두 표의 모든 행 조합(데카르트 곱)을 만듭니다.",
        code: `import pandas as pd
a = pd.DataFrame({"plan": ["기본", "고급"]})
b = pd.DataFrame({"rider": ["암", "실손"]})

# 모든 조합 2×2 = 4행 (요금표·시나리오 전개 등)
combos = a.merge(b, how="cross")
combos   # 결과 보기 (콘솔은 print(combos))`,
      },
      {
        id: "join-keys",
        label: "키 이름이 다를 때 (left_on·right_on)",
        desc: "결합 키의 이름이 서로 다를 때 left_on·right_on으로 지정합니다.",
        code: `import pandas as pd
contracts = pd.DataFrame({"cust_id": [1, 2], "amt": [100, 200]})
customers = pd.DataFrame({"customer_id": [1, 2], "name": ["김", "이"]})

# 키 이름이 다르면 left_on·right_on으로 각각 지정
merged = contracts.merge(customers, left_on="cust_id",
                         right_on="customer_id", how="left")
merged   # 결과 보기 (콘솔은 print(merged))`,
      },
      {
        id: "join-validate",
        label: "결합 검증 (validate·indicator)",
        desc: "validate·indicator로 결합의 정합성(키 중복·매칭 실패)을 검증합니다.",
        code: `import pandas as pd
left = pd.DataFrame({"id": [1, 2, 3], "amt": [100, 200, 300]})
right = pd.DataFrame({"id": [2, 3, 4], "grade": ["A", "B", "C"]})

# validate=관계 선언(위반 시 에러), indicator=행 출처 표시
m = left.merge(right, on="id", how="left",
               validate="one_to_one",   # 키 중복이면 에러로 알림
               indicator=True)          # _merge: both / left_only

# left_only가 많으면 매칭 실패 다수(콘솔은 print(m["_merge"].value_counts()))
m["_merge"].value_counts()`,
      },
    ],
  },
  {
    id: "concat",
    label: "합치기 (concat)",
    snippets: [
      {
        id: "concat-row",
        label: "Concat-행 — 위아래로 쌓기(세로)",
        desc: "같은 열 구조의 표를 위아래(행)로 이어붙입니다(월별 파일 합치기 등).",
        code: `import pandas as pd
jan = pd.DataFrame({"amt": [10, 20]})
feb = pd.DataFrame({"amt": [30, 40]})

# 같은 열 구조를 세로로 이어붙임 — ignore_index로 인덱스 재부여
stacked = pd.concat([jan, feb], ignore_index=True)
stacked   # 결과 보기 (콘솔은 print(stacked))`,
      },
      {
        id: "concat-col",
        label: "Concat-열 — 나란히 붙이기(가로)",
        desc: "행 순서(인덱스)가 같은 표를 좌우(열)로 나란히 붙입니다.",
        code: `import pandas as pd
a = pd.DataFrame({"amt": [10, 20]})
b = pd.DataFrame({"grade": ["A", "B"]})

# 행 순서(인덱스)가 같은 표를 가로로 붙임(axis=1)
joined = pd.concat([a, b], axis=1)
joined   # 결과 보기 (콘솔은 print(joined))`,
      },
    ],
  },
  {
    id: "split",
    label: "Split (분할)",
    snippets: [
      {
        id: "split-str-cols",
        label: "Split-열분리 — 한 열을 여러 열로",
        desc: "한 문자열 열을 구분자로 나눠 여러 열로 분리합니다(str.split expand).",
        code: `import pandas as pd
s = pd.DataFrame({"full": ["서울-강남", "부산-해운대", "경기-성남"]})

# 구분자('-')로 나눠 여러 열에 배치(expand=True)
s[["시도", "시군구"]] = s["full"].str.split("-", expand=True)
s   # 결과 보기 (콘솔은 print(s))`,
      },
      {
        id: "split-explode",
        label: "Split-explode — 리스트 열을 여러 행으로",
        desc: "한 행에 든 리스트를 여러 행으로 펼칩니다(문자열이면 str.split 후 explode).",
        code: `import pandas as pd
s = pd.DataFrame({"id": [1, 2], "riders": [["암", "실손"], ["종신"]]})

# 리스트 한 칸 → 여러 행으로 펼치기
exploded = s.explode("riders").reset_index(drop=True)
exploded   # 결과 보기 (콘솔은 print(exploded))`,
      },
      {
        id: "split-chunks",
        label: "Split-청크 — 행을 n등분",
        desc: "행을 기준으로 데이터를 n등분합니다(배치 처리·표본 분할).",
        code: `import numpy as np
# df를 행 기준 3등분(각 조각은 DataFrame)
parts = np.array_split(df, 3)

# 결과 보기 — 각 조각 행수(콘솔은 print(len(parts), [len(p) for p in parts]))
[len(p) for p in parts]`,
      },
      {
        id: "split-mask",
        label: "Split-조건분할 — 두 그룹으로 나누기",
        desc: "조건(마스크)으로 데이터를 두 그룹으로 나눕니다.",
        code: `# 조건이 참인 그룹과 거짓인 그룹으로 분리
mask = df["age"] >= 60
seniors = df[mask]
others = df[~mask]

# 결과 보기 — 두 그룹 크기(콘솔은 print(len(seniors), len(others)))
seniors.shape, others.shape`,
      },
      {
        id: "split-groups",
        label: "Split-그룹별 — dict로 그룹 분리",
        desc: "키 값별로 각각의 DataFrame(딕셔너리)으로 분리합니다.",
        code: `# 키 값별로 각각의 DataFrame으로 분리(딕셔너리)
groups = {k: g for k, g in df.groupby("product")}

# 결과 보기 — 그룹별 행수(콘솔은 for k, g in groups.items(): print(k, len(g)))
{k: len(g) for k, g in groups.items()}`,
      },
    ],
  },
  {
    id: "groupby",
    label: "Groupby (집계)",
    snippets: [
      {
        id: "groupby-sum",
        label: "Groupby-sum — 그룹별 합계",
        desc: "그룹별 합계를 구합니다.",
        code: `# 상품군별 보험료 합계
by_sum = df.groupby("product")["premium"].sum()
by_sum   # 결과 보기 (콘솔은 print(by_sum))`,
      },
      {
        id: "groupby-mean",
        label: "Groupby-mean — 그룹별 평균",
        desc: "그룹별 평균을 구합니다.",
        code: `# 상품군별 보험료 평균
by_mean = df.groupby("product")["premium"].mean().round(0)
by_mean   # 결과 보기 (콘솔은 print(by_mean))`,
      },
      {
        id: "groupby-count",
        label: "Groupby-count — 그룹별 건수",
        desc: "그룹별 행 수(건수)를 셉니다.",
        code: `sizes = df.groupby("product").size()                  # 그룹별 행 수
counts = df.groupby("product")["policy_id"].count()   # 결측 제외 건수

# 결과 보기 — 마지막 값 반환(행 수는 필요하면 print(sizes))
counts`,
      },
      {
        id: "groupby-agg",
        label: "Groupby-agg — 이름 있는 다중 집계",
        desc: "이름 있는 다중 집계(agg)로 요약표를 만듭니다.",
        code: `# 결과 열 이름까지 한 번에 지정하는 이름 있는 집계
summary = (
    df.groupby("product")
    .agg(건수=("policy_id", "count"),
         평균보험료=("premium", "mean"),
         보험료합계=("premium", "sum"))
    .reset_index()
)
summary.round(1)   # 결과 보기 (콘솔은 print(summary.round(1)))`,
      },
      {
        id: "groupby-transform",
        label: "Groupby-transform — 행 수 유지 파생",
        desc: "집계값을 원본 행 수 그대로 되돌려 파생변수를 만듭니다.",
        code: `# 자기 그룹 평균 대비 비율(행 수를 그대로 유지)
df["prem_vs_grp"] = df["premium"] / df.groupby("product")["premium"].transform("mean")

# 결과 보기 (콘솔은 print(df[["product", "premium", "prem_vs_grp"]].head()))
df[["product", "premium", "prem_vs_grp"]].head()`,
      },
      {
        id: "groupby-filter",
        label: "Groupby-filter — 그룹째 거르기",
        desc: "그룹 조건으로 그룹 전체를 채택/제외합니다.",
        code: `# 계약 100건 이상인 상품군만 남기기(그룹째 필터)
big = df.groupby("product").filter(lambda g: len(g) >= 100)

big["product"].value_counts()   # 결과 보기 (콘솔은 print(...))`,
      },
    ],
  },
  {
    id: "pivot",
    label: "피벗 (pivot_table·melt)",
    snippets: [
      {
        id: "pivot-table",
        label: "pivot_table — 교차 요약표",
        desc: "행×열 교차 요약표(엑셀 피벗테이블)를 만듭니다.",
        code: `import pandas as pd
# 상품(행) × 채널(열) 평균 보험료 + 합계
pt = pd.pivot_table(df, index="product", columns="channel",
                    values="premium", aggfunc="mean",
                    margins=True, margins_name="전체", fill_value=0)
pt.round(0)   # 결과 보기 (콘솔은 print(pt.round(0)))`,
      },
      {
        id: "pivot-melt",
        label: "melt — wide를 long으로",
        desc: "옆으로 늘어선 wide 표를 세로(long) 형태로 되돌립니다.",
        code: `import pandas as pd
wide = pd.DataFrame({"지점": ["A", "B"], "1월": [10, 20], "2월": [30, 40]})
# 유지할 식별 열(id_vars) 외 나머지를 세로로 녹임
long = wide.melt(id_vars="지점", var_name="월", value_name="실적")
long   # 결과 보기 (콘솔은 print(long))`,
      },
    ],
  },
  {
    id: "missing",
    label: "결측치 (isna·fillna·dropna)",
    snippets: [
      {
        id: "missing-check",
        label: "결측 파악 — 열별 개수·비율",
        desc: "열별 결측 개수·비율을 파악합니다(처리 방향 결정의 출발점).",
        code: `import pandas as pd
na = df.isna().sum()
# 결측이 있는 열만 개수·비율로 정리
na_summary = (pd.DataFrame({"결측수": na, "비율": (na / len(df)).round(3)})
              .query("결측수 > 0").sort_values("결측수", ascending=False))
na_summary   # 결과 보기 (콘솔은 print(na_summary))`,
      },
      {
        id: "missing-drop",
        label: "dropna — 핵심 열 결측 행 삭제",
        desc: "핵심 열이 비어 있는 행을 삭제합니다.",
        code: `before = len(df)
# subset 열이 비면 그 행 삭제
clean = df.dropna(subset=["premium"])

# 결과 보기 — 남은 행수·열수(콘솔은 print(f"{before} -> {len(clean)}"))
clean.shape`,
      },
      {
        id: "missing-fill",
        label: "fillna — 중앙값·범주 대체",
        desc: "결측을 중앙값(수치형)·범주값으로 대체합니다.",
        code: `# 수치형은 중앙값(이상치에 강건)
df["income"] = df["income"].fillna(df["income"].median())

# 결과 보기 — 남은 결측 수(콘솔은 print(df["income"].isna().sum()))
df["income"].isna().sum()`,
      },
      {
        id: "missing-group-fill",
        label: "그룹별 중앙값으로 대체",
        desc: "같은 그룹(예: 연령대)의 중앙값으로 더 정교하게 대체합니다.",
        code: `# 그룹(age_band)별 중앙값으로 대체 — 전체 평균보다 정교
df["income"] = df["income"].fillna(
    df.groupby("age_band")["income"].transform("median")
)

# 결과 보기 — 남은 결측 수(콘솔은 print(df["income"].isna().sum()))
df["income"].isna().sum()`,
      },
    ],
  },
  {
    id: "sort-dedup",
    label: "정렬·중복·순위",
    snippets: [
      {
        id: "sort-values",
        label: "sort_values — 복수 키 정렬",
        desc: "여러 키·방향(오름/내림 혼합)으로 정렬합니다.",
        code: `# 상품 오름차순, 보험료 내림차순
out = df.sort_values(["product", "premium"], ascending=[True, False])

# 결과 보기 (콘솔은 print(out[["product", "premium"]].head()))
out[["product", "premium"]].head()`,
      },
      {
        id: "drop-duplicates",
        label: "drop_duplicates — 중복 제거",
        desc: "기준 열로 중복을 확인하고 제거합니다(정렬이 무엇을 남길지 결정).",
        code: `# 지우기 전 중복 건수 확인
dup_count = df.duplicated(subset=["customer_id", "product"]).sum()
dedup = df.drop_duplicates(subset=["customer_id", "product"], keep="first")

# 결과 보기 — 마지막 값 반환(중복 건수는 필요하면 print(dup_count))
dedup.shape`,
      },
      {
        id: "latest-one",
        label: "그룹별 최신 1건 (정렬+dedup)",
        desc: "정렬 후 중복 제거로 그룹별 최신 1건만 남깁니다.",
        code: `# 최신순 정렬 후 고객별 첫 행만 유지 = 고객별 최신 계약 1건
latest = (
    df.sort_values("tenure_months", ascending=False)
    .drop_duplicates(subset="customer_id", keep="first")
)
latest.shape   # 결과 보기 (콘솔은 print(latest.shape))`,
      },
      {
        id: "rank-topn",
        label: "순위·상위 N (rank·nlargest)",
        desc: "순위(rank)와 상위 N(nlargest)을 뽑습니다.",
        code: `# 순위 부여(동점은 최소 순위) + 상위 10건
df["rank"] = df["premium"].rank(ascending=False, method="min")
top10 = df.nlargest(10, "premium")

# 결과 보기 (콘솔은 print(top10[["policy_id", "premium", "rank"]]))
top10[["policy_id", "premium", "rank"]]`,
      },
    ],
  },
  {
    id: "apply-map",
    label: "apply·map (값 변환)",
    snippets: [
      {
        id: "map-dict",
        label: "map — 사전으로 코드→이름",
        desc: "사전(dict)으로 값 하나씩을 다른 값으로 매핑합니다.",
        code: `# 사전 매핑 — 없는 값은 NaN이 되므로 확인 습관
code_map = {"설계사": "FC", "방카": "BA", "다이렉트": "DM"}
df["channel_cd"] = df["channel"].map(code_map)

df["channel_cd"].value_counts()   # 결과 보기 (콘솔은 print(...))`,
      },
      {
        id: "apply-row",
        label: "apply(axis=1) — 여러 열 조합",
        desc: "행 전체를 받아 여러 열을 조합해 계산합니다(느리므로 필요할 때만).",
        code: `# 행 전체를 받아 조건 조합 — axis=1 (벡터화가 어려울 때만)
def grade(row):
    if row["age"] >= 65 and row["n_contracts"] >= 3:
        return "정밀심사"
    if row["age"] >= 65 or row["n_contracts"] >= 3:
        return "주의"
    return "일반"

df["grade"] = df.apply(grade, axis=1)

df["grade"].value_counts()   # 결과 보기 (콘솔은 print(...))`,
      },
    ],
  },
];
