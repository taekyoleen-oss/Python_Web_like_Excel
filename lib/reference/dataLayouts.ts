// 분석 방법별 '데이터 레이아웃' — 실제 적용 시 어떤 열이 필요한지 표로 안내.
// (사용자 요청 2026-07-23) 회귀·로지스틱은 다수 독립변수(feature)+명목형 처리+종속변수(label)
// 형태, 생존분석은 관찰기간·사건 지표가 핵심. MethodDialog의 '데이터 레이아웃' 탭에서 렌더.

export type ColRole =
  | "feature"
  | "label"
  | "weight"
  | "offset"
  | "duration"
  | "event"
  | "group"
  | "value"
  | "id"
  | "time";

export interface LayoutCol {
  /** 열 이름(예: age, lapsed) */
  name: string;
  role: ColRole;
  /** 자료형 힌트(예: 숫자, 정수, 범주, 0/1, 날짜) */
  type: string;
  /** 예시 값 */
  example: string;
  /** 이 열의 역할·주의 */
  desc: string;
}

export interface DataLayout {
  /** 상단 요약 — 독립변수(feature)·명목형 처리·종속변수(label) 형태 */
  intro: string;
  columns: LayoutCol[];
  /** 추가 주의(선택) */
  notes?: string;
}

/** 역할 → 표시 라벨·칩 색(--chip-*) */
export const ROLE_META: Record<ColRole, { label: string; color: string }> = {
  feature: { label: "독립변수(feature)", color: "blue" },
  label: { label: "종속변수(label)", color: "rose" },
  weight: { label: "가중치", color: "amber" },
  offset: { label: "노출(offset)", color: "amber" },
  duration: { label: "관찰기간", color: "teal" },
  event: { label: "사건 지표", color: "rose" },
  group: { label: "그룹", color: "violet" },
  value: { label: "값", color: "blue" },
  id: { label: "식별자", color: "slate" },
  time: { label: "시점", color: "teal" },
};

// 지도학습 분류(트리·RF·GBM·SVM·KNN·나이브베이즈) 공통 레이아웃
const SUPERVISED_CLF: DataLayout = {
  intro:
    "여러 독립변수(feature)로 범주(분류) 또는 숫자(회귀) 종속변수를 예측합니다.\n- 명목형(범주) 변수는 원-핫/더미로 변환(pandas get_dummies) 후 투입\n- 트리 계열은 스케일 불필요 · SVM·KNN은 표준화(StandardScaler) 권장\n- 라벨은 분류면 0/1(또는 범주), 회귀면 연속 숫자",
  columns: [
    { name: "age", role: "feature", type: "숫자(정수)", example: "42", desc: "연속형 독립변수" },
    { name: "premium_ratio", role: "feature", type: "숫자", example: "1.3", desc: "연속형 독립변수" },
    { name: "channel", role: "feature", type: "범주(문자)", example: "대면", desc: "명목형 → 원-핫/더미로 변환" },
    { name: "lapsed", role: "label", type: "0/1(또는 범주)", example: "1", desc: "예측 대상 — 분류 라벨(해지=1)" },
  ],
  notes:
    "명목형 변수를 숫자 코드(0,1,2…)로만 바꾸면 '순서'가 있는 것으로 오해될 수 있어 원-핫이 안전합니다(트리 계열은 코드화도 가능).",
};

const UNSUPERVISED: DataLayout = {
  intro:
    "정답 라벨 없이 독립변수(feature)만으로 구조를 찾습니다(군집·차원축소).\n- 스케일 차이가 크면 표준화(StandardScaler) 필수 — 거리 기반이라 큰 값이 지배\n- 명목형은 원-핫 후 투입하거나 제외",
  columns: [
    { name: "age", role: "feature", type: "숫자", example: "42", desc: "연속형" },
    { name: "premium", role: "feature", type: "숫자", example: "1240", desc: "연속형(스케일 큼 → 표준화)" },
    { name: "bmi", role: "feature", type: "숫자", example: "24.1", desc: "연속형" },
    { name: "income", role: "feature", type: "숫자", example: "5200", desc: "연속형" },
  ],
  notes: "종속변수(label) 열은 필요 없습니다 — 있으면 군집 결과 해석에만 참고로 씁니다.",
};

const GROUP_VALUE: DataLayout = {
  intro:
    "집단(그룹) 열 1개 + 값(수치) 열 1개가 기본입니다.\n- t검정: 2집단 비교 · ANOVA: 3집단 이상 · 각 행 = 한 관측",
  columns: [
    { name: "group", role: "group", type: "범주", example: "A / B", desc: "비교할 집단" },
    { name: "value", role: "value", type: "숫자", example: "3.2", desc: "집단별로 비교할 측정값" },
  ],
};

export const DATA_LAYOUTS: Record<string, DataLayout> = {
  "linear-regression": {
    intro:
      "여러 독립변수(feature)로 연속 숫자 종속변수(label)를 예측합니다.\n- 명목형(범주)은 원-핫/더미(get_dummies·statsmodels C())로 변환\n- 종속변수(label)는 연속 숫자 · (선택) 관측 가중치 열 사용 가능",
    columns: [
      { name: "age", role: "feature", type: "숫자(정수)", example: "42", desc: "연속형 독립변수" },
      { name: "bmi", role: "feature", type: "숫자", example: "24.1", desc: "연속형 독립변수" },
      { name: "region", role: "feature", type: "범주(문자)", example: "수도권", desc: "명목형 → C(region)/원-핫" },
      { name: "premium", role: "label", type: "숫자(연속)", example: "1240", desc: "예측 대상 — 연속 숫자" },
      { name: "w", role: "weight", type: "숫자", example: "1.0", desc: "(선택) 관측 가중치 — 신뢰도·건수 등" },
    ],
    notes: "다중공선성(feature끼리 상관 높음)이면 계수 해석이 불안정 — VIF로 점검.",
  },
  "logistic-regression": {
    intro:
      "여러 독립변수로 0/1 이진 결과의 확률을 예측합니다.\n- 종속변수(label)는 0/1 (True/False면 .astype(int))\n- 명목형은 원-핫/더미 · 불균형(해지 5% 등)이면 class_weight='balanced'",
    columns: [
      { name: "age", role: "feature", type: "숫자", example: "42", desc: "연속형 독립변수" },
      { name: "premium_ratio", role: "feature", type: "숫자", example: "1.3", desc: "연속형 독립변수" },
      { name: "channel", role: "feature", type: "범주", example: "대면", desc: "명목형 → 원-핫/C()" },
      { name: "lapsed", role: "label", type: "0 / 1", example: "1", desc: "해지=1, 유지=0 (이진 목표)" },
    ],
    notes: "라벨이 여러 범주(3개+)면 다항 로지스틱(multinomial) — 이 표는 이진 기준.",
  },
  glm: {
    intro:
      "요율 산출의 표준 — 빈도(사고 건수)=포아송, 심도(사고 금액)=감마로 모형화합니다.\n- 노출(경과 계약년수)이 다르면 offset=log(exposure) 필수\n- 명목형 등급요인(연령대·지역·차종)은 C()로 더미화",
    columns: [
      { name: "age_band", role: "feature", type: "범주", example: "30대", desc: "등급요인(명목형)" },
      { name: "car_type", role: "feature", type: "범주", example: "대형", desc: "등급요인(명목형)" },
      { name: "exposure", role: "offset", type: "숫자(0~1)", example: "0.75", desc: "경과 계약년수 → offset=log(exposure)" },
      { name: "n_claims", role: "label", type: "정수(0,1,2…)", example: "1", desc: "빈도 모형의 목표 — 사고 건수(포아송)" },
      { name: "claim_amt", role: "label", type: "숫자", example: "3,200,000", desc: "심도 모형의 목표 — 사고 금액(감마, 사고건만)" },
    ],
    notes: "빈도·심도를 각각 적합해 곱하면 순보험료. 과산포(분산>평균)면 음이항 GLM.",
  },
  survival: {
    intro:
      "'언제 사건이 일어나는가'를 분석합니다. 관찰기간(duration)+사건 지표(event) 두 열이 핵심입니다.\n- event: 1=사건 발생(해지·사망), 0=중도절단(관찰 종료까지 사건 없음)\n- 절단을 1로 잘못 코딩하면 결과가 완전히 왜곡 — 특히 주의\n- 독립변수(feature)로 위험비(hazard ratio) 추정(Cox)",
    columns: [
      { name: "duration", role: "duration", type: "숫자(기간)", example: "18", desc: "가입~사건/관찰종료까지 기간(월 등)" },
      { name: "event", role: "event", type: "0 / 1", example: "1", desc: "1=사건 발생, 0=중도절단(관찰 종료)" },
      { name: "age", role: "feature", type: "숫자", example: "45", desc: "위험요인(연속형)" },
      { name: "has_rider", role: "feature", type: "0/1", example: "1", desc: "특약 여부(위험요인)" },
    ],
    notes:
      "중도절단(censoring)이 생존분석의 핵심 — event=0인 계약도 버리지 않고 '관찰기간까지 사건이 없었다'는 정보를 활용합니다.",
  },
  "decision-tree": SUPERVISED_CLF,
  "random-forest": SUPERVISED_CLF,
  "gradient-boosting": SUPERVISED_CLF,
  svm: SUPERVISED_CLF,
  knn: SUPERVISED_CLF,
  "naive-bayes": SUPERVISED_CLF,
  kmeans: UNSUPERVISED,
  hierarchical: UNSUPERVISED,
  pca: UNSUPERVISED,
  "t-test": GROUP_VALUE,
  anova: GROUP_VALUE,
  "chi-square": {
    intro:
      "두 범주형 변수의 연관성(독립성)을 교차표로 검정합니다.\n- 각 행 = 한 관측 · 두 범주 열이 필요(값은 자동 집계)",
    columns: [
      { name: "gender", role: "feature", type: "범주", example: "남 / 여", desc: "범주형 변수 1" },
      { name: "product", role: "feature", type: "범주", example: "종신 / 정기", desc: "범주형 변수 2" },
    ],
    notes: "기대빈도가 5 미만 칸이 많으면 Fisher 정확검정을 고려.",
  },
  correlation: {
    intro: "수치형 여러 열의 상관관계를 봅니다 — 각 행=한 관측, 열=수치 변수.",
    columns: [
      { name: "age", role: "value", type: "숫자", example: "42", desc: "수치 변수" },
      { name: "premium", role: "value", type: "숫자", example: "1240", desc: "수치 변수" },
      { name: "bmi", role: "value", type: "숫자", example: "24.1", desc: "수치 변수" },
    ],
  },
  "desc-stats": {
    intro: "요약통계 대상 — 수치형 열(+ 선택적으로 그룹 열)로 평균·분위수 등을 냅니다.",
    columns: [
      { name: "product", role: "group", type: "범주", example: "종신", desc: "(선택) 그룹별 요약용" },
      { name: "premium", role: "value", type: "숫자", example: "1240", desc: "요약할 수치" },
      { name: "age", role: "value", type: "숫자", example: "42", desc: "요약할 수치" },
    ],
  },
  "time-series": {
    intro:
      "시점(날짜) 열 + 값 열의 시계열입니다.\n- 시점은 균일 간격(월·일) 권장 · 결측 구간은 채우거나 표시",
    columns: [
      { name: "date", role: "time", type: "날짜", example: "2024-01", desc: "시점(월·일) — 정렬·인덱스" },
      { name: "amount", role: "value", type: "숫자", example: "132000000", desc: "관측값(청구액·건수 등)" },
    ],
  },
  // ── 보험·계리 ──
  "exposure-rates": {
    intro:
      "경험위험률 산출 — 연령(또는 등급)별 노출과 사망(사건) 수가 필요합니다.\n- 조발생률 = 사망수 / 노출 · 노출은 중앙/초기 노출로 계산",
    columns: [
      { name: "age", role: "group", type: "정수", example: "45", desc: "연령(또는 위험등급)" },
      { name: "exposure", role: "offset", type: "숫자", example: "1523.5", desc: "노출(계약·연수) — 분모" },
      { name: "deaths", role: "value", type: "정수", example: "12", desc: "사망(사건) 수 — 분자" },
    ],
    notes: "A/E(실제/기대) 비교를 하려면 참조위험률(기대) 열도 함께 둡니다.",
  },
  "chain-ladder": {
    intro:
      "지급준비금 — 사고연도 × 발전연도 '지급 삼각형'(누적)이 입력입니다.\n- 행=사고연도(발생), 열=발전연도(경과), 값=누적 지급액",
    columns: [
      { name: "(행) 사고연도", role: "id", type: "연도", example: "2020", desc: "손해 발생 연도" },
      { name: "(열) 발전연도", role: "time", type: "정수", example: "0,1,2…", desc: "발생 후 경과 연차" },
      { name: "누적지급액", role: "value", type: "숫자", example: "5,357", desc: "해당 칸까지 누적 지급" },
    ],
    notes: "삼각형(위쪽 삼각만 관측)에서 발전계수로 우하단(미래)을 채워 최종 손해액을 추정합니다.",
  },
  "pure-premium": {
    intro:
      "순보험료 = 빈도 × 심도. 등급요인 + 노출 + 사고건수/금액이 필요합니다.\n- 명목형 등급요인은 C()/원-핫 · 노출로 건수를 정규화",
    columns: [
      { name: "age_band", role: "feature", type: "범주", example: "30대", desc: "등급요인" },
      { name: "product", role: "feature", type: "범주", example: "고급형", desc: "등급요인" },
      { name: "exposure", role: "offset", type: "숫자", example: "0.8", desc: "경과 계약년수" },
      { name: "n_claims", role: "label", type: "정수", example: "1", desc: "사고 건수(빈도)" },
      { name: "claim_amt", role: "label", type: "숫자", example: "2,900,000", desc: "사고 금액(심도)" },
    ],
  },
  credibility: {
    intro:
      "신뢰도 — 부문(집단)별 경험 데이터에 전체 평균을 얼마나 섞을지 정합니다.\n- 집단 열 + 경험값(손해율·건수) + 노출(가중)",
    columns: [
      { name: "segment", role: "group", type: "범주", example: "지점A", desc: "신뢰도를 줄 부문(집단)" },
      { name: "claims", role: "value", type: "숫자", example: "48", desc: "부문 경험값(건수·손해액)" },
      { name: "exposure", role: "offset", type: "숫자", example: "1082", desc: "노출(가중) — 클수록 자기 경험 신뢰↑" },
    ],
  },
  "life-premium": {
    intro:
      "보험료 산출 — 생명표(연령별 사망률 qx)가 핵심 입력이고, 예정이율 i는 파라미터입니다.\n- qx는 0~ω세까지 단조 증가 · ω에서 q=1로 표를 닫음",
    columns: [
      { name: "age(x)", role: "id", type: "정수", example: "0~110", desc: "연령 — 생명표 행" },
      { name: "qx", role: "value", type: "숫자(0~1)", example: "0.0125", desc: "x세의 1년 사망확률(위험률)" },
      { name: "i (파라미터)", role: "value", type: "숫자", example: "0.03", desc: "예정이율 — 데이터 아닌 가정값" },
    ],
    notes: "가상 위험률·확정이율만 있으면 tpx→A_x·ä_x→수지상등으로 보험료가 나옵니다(코드 탭 참고).",
  },
  "kaplan-meier": {
    intro:
      "생존분석(웹 실행) — 관찰기간(duration)+사건 지표(event) 두 열이 핵심입니다.\n- event: 1=사건 발생(해지·사망), 0=중도절단(관찰 종료) · 절단을 1로 잘못 코딩하면 왜곡\n- 그룹(group) 열이 있으면 KM 곡선 비교·log-rank 검정(lifelines 없이 numpy로 계산)",
    columns: [
      { name: "duration", role: "duration", type: "숫자(기간)", example: "18", desc: "가입~사건/관찰종료 기간(월 등)" },
      { name: "event", role: "event", type: "0 / 1", example: "1", desc: "1=사건 발생, 0=중도절단" },
      { name: "group", role: "group", type: "범주", example: "대면 / 비대면", desc: "(선택) KM 곡선 비교·log-rank 검정용" },
    ],
    notes: "중도절단(event=0)도 '관찰기간까지 사건이 없었다'는 정보로 활용 — 버리지 않습니다.",
  },
  graduation: {
    intro:
      "위험률 보정 — 연령별 조(粗)위험률(들쭉날쭉)을 매끈한 곡선으로 다듬습니다.\n- 연령 + 관측 위험률(또는 노출·사건수)이 필요 · Whittaker-Henderson·스플라인",
    columns: [
      { name: "age", role: "id", type: "정수", example: "40", desc: "연령(행)" },
      { name: "raw_qx", role: "value", type: "숫자(0~1)", example: "0.0021", desc: "조위험률(사건수/노출) — 다듬을 대상" },
      { name: "exposure", role: "weight", type: "숫자", example: "1523", desc: "(선택) 노출 — 신뢰 가중(많을수록 원자료 존중)" },
    ],
  },
  reinsurance: {
    intro:
      "재보험 분석 — 개별 손해액(claim) 목록이 기본입니다.\n- 손해액으로 XL 레이어(초과분)·비례(QS) 출재액 계산 · 집합손해 시뮬레이션",
    columns: [
      { name: "claim", role: "value", type: "숫자", example: "85,000,000", desc: "개별 손해액 — 출재/보유 분리 대상" },
      { name: "line", role: "group", type: "범주", example: "화재", desc: "(선택) 종목·계약 구분" },
    ],
  },
  regularized: {
    intro:
      "Ridge·Lasso — 수치형 독립변수 여러 열 + 연속 숫자 종속변수입니다.\n- 규제는 스케일에 민감 → 표준화(StandardScaler) 권장 · 명목형은 원-핫",
    columns: [
      { name: "x1 … xp", role: "feature", type: "숫자(여러 열)", example: "…", desc: "독립변수들(표준화 권장)" },
      { name: "y", role: "label", type: "숫자(연속)", example: "1240", desc: "예측 대상 — 연속 숫자" },
    ],
    notes: "변수(feature)가 많고 상관 높을 때 규제로 과적합·불안정 계수를 억제합니다.",
  },
  "loss-functions": SUPERVISED_CLF,
  "cross-validation": SUPERVISED_CLF,
  "model-eval": SUPERVISED_CLF,
  imbalanced: {
    intro:
      "불균형 분류 — 독립변수 + 이진 라벨(양성이 드묾, 예: 사기·해지 5%).\n- 라벨 0/1 · 명목형 원-핫 · class_weight·임계값 이동·PR-AUC로 평가",
    columns: SUPERVISED_CLF.columns,
    notes: "양성 비율이 매우 낮으면 accuracy는 무의미 — 재현율·PR-AUC를 봅니다.",
  },
  calibration: SUPERVISED_CLF,
  anomaly: {
    intro:
      "이상치 탐지 — 정답 라벨 없이 독립변수(feature)만으로 비정상을 찾습니다.\n- 스케일 차이 크면 표준화 · 명목형 원-핫 (IsolationForest·LOF 등)",
    columns: UNSUPERVISED.columns,
  },
  normality: {
    intro: "정규성 검정 — 검정할 수치형 열 1개(또는 모형 잔차)입니다.",
    columns: [
      { name: "value", role: "value", type: "숫자", example: "3.2", desc: "정규성을 볼 연속 수치(또는 잔차)" },
    ],
  },
  nonparametric: GROUP_VALUE,
  distributions: {
    intro:
      "분포 적합 — 적합할 수치형 열 1개(손해액·대기시간 등).\n- 연속형은 그 열, 빈도(건수)는 정수 열",
    columns: [
      { name: "claim_amt", role: "value", type: "숫자", example: "2,900,000", desc: "분포를 적합할 연속 수치(또는 건수 정수)" },
    ],
  },
};

/** 카테고리 기반 일반 안내(개별 레이아웃이 없을 때) — 표가 비지 않도록 예시 열 포함 */
export function genericLayout(category: string): DataLayout {
  if (category === "ml" || category === "model")
    return {
      intro:
        "대개 독립변수(feature) 여러 열 + 종속변수(label) 한 열 구조입니다.\n- 명목형은 원-핫/더미 · 거리·스케일 민감 모델은 표준화\n- 자세한 열 구성은 '파이썬 코드 적용' 탭의 예제 열 이름을 참고하세요.",
      columns: SUPERVISED_CLF.columns,
    };
  if (category === "wrangle")
    return {
      intro:
        "데이터 핸들링은 어떤 표(DataFrame)에도 적용됩니다 — 열 구성 제약이 적습니다.\n- 대개 식별자·범주 열 + 수치 열의 일반 표",
      columns: [
        { name: "id", role: "id", type: "정수/문자", example: "1001", desc: "행 식별자(선택)" },
        { name: "category", role: "group", type: "범주", example: "종신", desc: "범주형 열" },
        { name: "value", role: "value", type: "숫자", example: "1240", desc: "수치 열" },
      ],
    };
  // actuarial / 기타 — 일반 안내 + 작은 예시 표(빈 표 방지)
  return {
    intro:
      "방법마다 입력 형태가 다릅니다 — '파이썬 코드 적용' 탭 예제의 열 이름(또는 합성데이터 생성부)을 참고하세요. 대개 아래 형태의 표입니다.",
    columns: [
      { name: "category", role: "group", type: "범주", example: "그룹", desc: "구분·등급 열" },
      { name: "value", role: "value", type: "숫자", example: "123", desc: "측정·집계 대상 수치" },
    ],
  };
}
