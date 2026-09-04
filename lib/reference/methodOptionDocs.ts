/**
 * 분석 방법 팝업 [파라미터·옵션] 탭 — 함수·옵션 심화 해설 레지스트리(2026-07-19).
 * 키는 lib/statMethods.ts 방법 id와 1:1. 없는 id는 기존 params 요약만 표시(점진 확대).
 * 파이썬/엑셀(=PY()) 어느 쪽으로 코드를 쓰든 공통으로 적용되는 내용을 담는다.
 * 값 후보·기본값·선택 기준 중심 — 코드·수식은 각 코드 탭이 담당.
 */

export interface OptionDoc {
  /** 옵션(인자) 이름 — 예: fit_intercept */
  name: string;
  /** 받을 수 있는 값 요약 — 예: "True(기본) / False" */
  values?: string;
  desc: string;
}

export interface OptionDocGroup {
  /** 함수·클래스 이름 — 예: "LinearRegression (scikit-learn)" */
  func: string;
  /** 그룹 개요(선택) — 언제 이 함수를 쓰는지 한두 문장 */
  intro?: string;
  options: OptionDoc[];
}

export const METHOD_OPTION_DOCS: Record<string, OptionDocGroup[]> = {
  "linear-regression": [
    {
      func: "적합 기준(거리·손실) 고르기",
      intro:
        "회귀선은 '점과 선의 거리'를 무엇으로 재고 어떻게 합치는지에 따라 달라집니다. 같은 데이터라도 기준이 다르면 다른 직선이 나옵니다.",
      options: [
        {
          name: "최소제곱(OLS)",
          values: "LinearRegression · smf.ols",
          desc: "수직 거리(잔차)의 '제곱합' 최소화 — 표준 방법. 큰 이상치 하나가 제곱으로 커져 선을 끌어당기는 점에 유의.",
        },
        {
          name: "절대값(LAD)",
          values: "QuantileRegressor(quantile=0.5)",
          desc: "잔차의 '절대값 합' 최소화 = 중앙값 회귀. 이상치에 강건하지만 계산이 무겁고 해가 유일하지 않을 수 있음.",
        },
        {
          name: "Huber",
          values: "HuberRegressor(epsilon=1.35)",
          desc: "작은 잔차는 제곱, 큰 잔차는 절대값으로 — OLS와 LAD의 절충. epsilon(기본 1.35)이 경계를 정함.",
        },
        {
          name: "분위수(quantile)",
          values: "QuantileRegressor(quantile=q)",
          desc: "q 분위수를 직접 적합 — q=0.9면 상위 90% 경계선(손해액 VaR 성격의 예측)에 해당.",
        },
      ],
    },
    {
      func: "LinearRegression (scikit-learn)",
      options: [
        {
          name: "fit_intercept",
          values: "True(기본) / False",
          desc: "절편(b0) 포함 여부. True면 데이터 평균 수준을 절편이 흡수. False는 '원점 통과가 이론적으로 맞을 때만'(예: 노출 0이면 손해 0) — 무심코 끄면 계수가 왜곡됩니다.",
        },
        {
          name: "positive",
          values: "False(기본) / True",
          desc: "모든 계수를 0 이상으로 제약 — 요율 인자처럼 음수가 비논리적인 경우. 제약이 걸린 변수는 계수 0으로 나올 수 있음.",
        },
        {
          name: "copy_X / n_jobs",
          desc: "copy_X=False면 입력을 복사하지 않아 메모리 절약(원본 변형 위험). n_jobs는 다중 타깃일 때만 병렬 효과.",
        },
      ],
    },
    {
      func: "smf.ols (statsmodels)",
      options: [
        {
          name: "formula 문법",
          values: '"y ~ x1 + C(cat) + np.log(x2) + x1:x2"',
          desc: "C()=범주형 선언, np.log() 등 변환 허용, x1:x2=상호작용만, x1*x2=주효과+상호작용, - 1=절편 제거.",
        },
        {
          name: "fit(cov_type=...)",
          values: '"nonrobust"(기본) / "HC0"~"HC3"',
          desc: "이분산(잔차 깔때기)이면 HC3 강건 표준오차로 p-value 보정 — 계수는 그대로, 유의성 판단만 달라짐.",
        },
      ],
    },
  ],
  regularized: [
    {
      func: "Ridge (scikit-learn)",
      options: [
        {
          name: "alpha",
          values: "0보다 큰 실수 (기본 1.0)",
          desc: "L2 벌점 강도 — 클수록 계수를 고르게 축소. 적정값은 y 스케일에 좌우되므로 np.logspace(-3, 3)를 훑거나 RidgeCV로 고릅니다.",
        },
        {
          name: "solver",
          values:
            '"auto"(기본) / "svd" / "cholesky" / "lsqr" / "sparse_cg" / "sag"·"saga" / "lbfgs"',
          desc: "연립방정식 풀이 방법. auto=데이터에 맞게 자동(대부분 이대로), svd=특이행렬에도 안정, cholesky=닫힌형(중소형에 빠름), lsqr·sparse_cg=희소·대형, sag/saga=표본 수가 매우 클 때(표준화 필수), lbfgs=positive=True일 때 유일 지원.",
        },
        {
          name: "positive",
          values: "False(기본) / True",
          desc: "계수 비음수 제약 — True면 solver='lbfgs'가 강제됩니다.",
        },
      ],
    },
    {
      func: "Lasso · ElasticNet (scikit-learn)",
      options: [
        {
          name: "alpha",
          values: "0보다 큰 실수 (기본 1.0)",
          desc: "L1 벌점 강도 — 클수록 더 많은 계수가 정확히 0(변수 선택). 0에 가까우면 OLS와 비슷해집니다.",
        },
        {
          name: "l1_ratio (ElasticNet)",
          values: "0~1 (기본 0.5)",
          desc: "L1 비중 — 0이면 Ridge, 1이면 Lasso. 상관 높은 변수 '그룹'을 함께 남기고 싶으면 0.2~0.5.",
        },
        {
          name: "max_iter / tol",
          values: "기본 1000 / 1e-4",
          desc: "좌표하강 반복 상한·수렴 판정. 수렴 경고가 나면 max_iter=10000 이상으로 — alpha가 작을수록 수렴이 느립니다.",
        },
        {
          name: "selection",
          values: '"cyclic"(기본) / "random"',
          desc: "좌표 갱신 순서 — random이 큰 문제에서 더 빨리 수렴하는 경우가 있습니다.",
        },
      ],
    },
    {
      func: "RidgeCV · LassoCV (교차검증 선택)",
      options: [
        {
          name: "alphas",
          values: "np.logspace(-3, 3, 50) 등 후보 배열",
          desc: "탐색할 alpha 후보 — 로그 간격으로 넓게 잡는 것이 관례.",
        },
        {
          name: "cv",
          values: "정수(폴드 수) / 분할기 객체 (기본 5)",
          desc: "교차검증 방법 — 시계열이면 TimeSeriesSplit 객체를 전달해 미래 누수를 막습니다.",
        },
      ],
    },
  ],
  "logistic-regression": [
    {
      func: "LogisticRegression (scikit-learn)",
      options: [
        {
          name: "C",
          values: "0보다 큰 실수 (기본 1.0)",
          desc: "규제 강도의 '역수' — 작을수록 규제가 강해 계수가 줄어듭니다(과적합 억제). alpha와 방향이 반대인 점에 주의.",
        },
        {
          name: "penalty × solver 짝",
          values: '"l2"+lbfgs(기본) / "l1"+liblinear·saga / "elasticnet"+saga / None',
          desc: "규제 종류와 최적화 알고리즘은 짝이 맞아야 합니다. l1(변수 선택)은 liblinear(소형)·saga(대형)만, elasticnet은 saga만 지원.",
        },
        {
          name: "class_weight",
          values: 'None(기본) / "balanced" / dict',
          desc: "'balanced'면 클래스 빈도의 역수로 가중 — 해지 5%처럼 불균형할 때 소수 클래스를 놓치지 않게 합니다.",
        },
        {
          name: "max_iter",
          values: "기본 100",
          desc: "수렴 경고(ConvergenceWarning)가 나면 1000 이상으로 올리고, 입력 표준화도 함께 고려하세요.",
        },
        {
          name: "fit_intercept",
          values: "True(기본) / False",
          desc: "절편 포함 여부 — 기저 발생률(전체 평균 오즈)을 절편이 담습니다. 특별한 이론적 이유가 없으면 True 유지.",
        },
      ],
    },
    {
      func: "smf.logit (statsmodels)",
      options: [
        {
          name: "fit(disp=0)",
          desc: "최적화 로그 출력 숨김. 결과 해석은 params(로그오즈)→np.exp(params)(오즈비) 순.",
        },
        {
          name: "목표변수 형식",
          desc: "0/1 정수여야 합니다 — 불리언이면 astype(int)로 변환(원본은 사본에서).",
        },
      ],
    },
  ],
  glm: [
    {
      func: "smf.glm — family(분포)와 link(연결함수)",
      intro:
        "GLM은 '반응의 분포(family)'와 '평균을 선형식에 잇는 연결(link)'을 고르는 모형입니다. 보험 실무 표준 조합을 기억해 두세요.",
      options: [
        {
          name: "Poisson(link=Log)",
          values: "사고 '건수' 표준",
          desc: "log 링크라 exp(계수)=상대도(배수)로 읽힘. 노출 차이는 offset=np.log(exposure)로 반영.",
        },
        {
          name: "Gamma(link=Log)",
          values: "사고 '심도(평균 금액)' 표준",
          desc: "양수·오른쪽 꼬리 데이터에 적합. 기본 링크(inverse power) 대신 log 링크를 명시하는 것이 해석에 유리.",
        },
        {
          name: "NegativeBinomial(alpha=...)",
          values: "과산포 건수",
          desc: "Pearson chi2/df가 1.2를 넘으면 포아송 대신 고려 — alpha는 smf.negativebinomial로 먼저 추정.",
        },
        {
          name: "Tweedie(var_power=1~2)",
          values: "0이 많은 순보험료 직접 모형",
          desc: "var_power 1.5 근처가 관례 — 빈도×심도를 한 모형으로 합칠 때 사용.",
        },
        {
          name: "offset vs 설명변수",
          desc: "노출은 '계수를 추정하지 않고 1로 고정'하는 offset이 원칙 — 설명변수로 넣으면 노출 효과를 데이터로 추정하게 되어 다른 모형이 됩니다.",
        },
      ],
    },
    {
      func: "fit_regularized (규제 GLM)",
      options: [
        {
          name: "alpha",
          values: "0보다 큰 실수",
          desc: "벌점 강도 — 클수록 상대도가 1(중립) 쪽으로 수축. 요인이 많고 상관이 높을 때 안정화.",
        },
        {
          name: "L1_wt",
          values: "0~1 (1=Lasso식)",
          desc: "L1 비중 — 1이면 일부 계수가 정확히 0(요인 선택), 0이면 Ridge식 수축.",
        },
      ],
    },
  ],
  knn: [
    {
      func: "KNeighborsClassifier — 거리(metric) 고르기",
      intro:
        "KNN은 '가깝다'를 어떻게 재는지가 곧 모형입니다. 스케일이 다른 변수를 그대로 두면 큰 단위 변수가 거리를 지배하므로 표준화가 사실상 필수입니다.",
      options: [
        {
          name: "metric",
          values: '"minkowski"(기본) / "euclidean" / "manhattan" / "cosine" 등',
          desc: "minkowski+p=2=유클리드(직선 거리), p=1=맨해튼(축 방향 합 — 이상치 영향 완화), cosine=방향 유사도(크기 무시 — 패턴 비교).",
        },
        {
          name: "n_neighbors (k)",
          values: "기본 5",
          desc: "작으면 민감(과적합), 크면 매끈(과소적합) — 교차검증 곡선으로 선택. 홀수로 두면 이진 분류 동점 회피.",
        },
        {
          name: "weights",
          values: '"uniform"(기본) / "distance"',
          desc: "distance면 가까운 이웃에 더 큰 표 — 경계가 부드러워지지만 학습셋 재예측 정확도는 항상 1.0이 되는 점에 유의(평가는 CV로).",
        },
        {
          name: "algorithm",
          values: '"auto"(기본) / "ball_tree" / "kd_tree" / "brute"',
          desc: "이웃 탐색 자료구조 — auto면 데이터에 맞게 선택. 고차원에서는 brute가 오히려 빠를 수 있음.",
        },
      ],
    },
  ],
  svm: [
    {
      func: "SVC (scikit-learn)",
      options: [
        {
          name: "kernel",
          values: '"rbf"(기본) / "linear" / "poly" / "sigmoid"',
          desc: "경계의 모양 — linear=직선(변수 많고 표본 클 때), rbf=부드러운 곡선(범용 기본), poly=다항 곡선(차수 degree 지정).",
        },
        {
          name: "C",
          values: "기본 1.0",
          desc: "오분류 허용의 벌점 — 클수록 훈련 데이터를 더 맞추려 해 과적합 위험, 작으면 여유 있는 경계.",
        },
        {
          name: "gamma",
          values: '"scale"(기본) / "auto" / 실수',
          desc: "rbf 곡선의 좁고 넓음 — 클수록 각 점 주변만 보는 뾰족한 경계(과적합), 작으면 완만. C와 함께 그리드로 탐색.",
        },
        {
          name: "probability",
          values: "False(기본) / True",
          desc: "predict_proba가 필요하면 True — 내부 교차검증으로 보정하느라 학습이 느려집니다.",
        },
        {
          name: "class_weight",
          values: 'None / "balanced"',
          desc: "불균형 클래스 가중 — 소수 클래스(해지 등)를 놓치지 않게.",
        },
      ],
    },
  ],
  kmeans: [
    {
      func: "KMeans (scikit-learn)",
      options: [
        {
          name: "n_clusters (K)",
          values: "기본 8 — 반드시 직접 지정",
          desc: "군집 수 — 업무 해석 가능한 K를 먼저 지정하고, 엘보(관성)·실루엣으로 검증하는 순서를 권장.",
        },
        {
          name: "init",
          values: '"k-means++"(기본) / "random"',
          desc: "초기 중심 선정 — k-means++가 나쁜 초기값 문제를 크게 줄입니다(기본 유지).",
        },
        {
          name: "n_init",
          values: '"auto"(기본) / 정수',
          desc: "서로 다른 초기값으로 반복한 뒤 최선을 채택 — 결과가 흔들리면 10 이상으로.",
        },
        {
          name: "random_state",
          desc: "재현성 고정 — 보고서·검증용 결과는 반드시 고정하세요.",
        },
      ],
    },
  ],
  "decision-tree": [
    {
      func: "DecisionTreeClassifier (scikit-learn)",
      options: [
        {
          name: "max_depth",
          values: "None(기본 — 끝까지 성장) / 정수",
          desc: "깊이 제한 — None이면 과적합하기 쉬움. 해석용이면 3~5로 얕게.",
        },
        {
          name: "min_samples_leaf",
          values: "기본 1",
          desc: "잎의 최소 표본 수 — 20~50처럼 키우면 소수 표본에 좌우되는 가지를 막습니다(보험 데이터 권장).",
        },
        {
          name: "ccp_alpha",
          values: "기본 0.0",
          desc: "비용-복잡도 가지치기 강도 — cost_complexity_pruning_path로 후보를 뽑아 교차검증으로 선택.",
        },
        {
          name: "criterion",
          values: '"gini"(기본) / "entropy" / "log_loss"',
          desc: "분할 품질 기준 — 실무 성능 차이는 대체로 작아 기본 유지가 무난.",
        },
        {
          name: "class_weight",
          values: 'None / "balanced"',
          desc: "불균형 클래스 가중 — 소수 클래스 잎이 만들어지도록.",
        },
      ],
    },
  ],
  "random-forest": [
    {
      func: "RandomForestClassifier (scikit-learn)",
      options: [
        {
          name: "n_estimators",
          values: "기본 100",
          desc: "나무 수 — 많을수록 안정(수확 체감). 300~500이면 대부분 충분, 시간과의 절충.",
        },
        {
          name: "max_features",
          values: '"sqrt"(기본) / 비율·정수',
          desc: "분할마다 후보로 뽑는 변수 수 — 작을수록 나무들이 서로 달라져(상관↓) 앙상블 효과↑.",
        },
        {
          name: "max_depth / min_samples_leaf",
          desc: "개별 나무 복잡도 제한 — 잎 최소 표본(예: 20)을 키우는 쪽이 깊이 제한보다 다루기 쉽습니다.",
        },
        {
          name: "n_jobs",
          values: "-1 권장",
          desc: "나무 학습 병렬화 — -1이면 모든 코어 사용.",
        },
        {
          name: "class_weight",
          values: 'None / "balanced" / "balanced_subsample"',
          desc: "불균형 보정 — balanced_subsample은 부트스트랩 표본 기준으로 가중.",
        },
      ],
    },
  ],
  "gradient-boosting": [
    {
      func: "HistGradientBoostingClassifier (scikit-learn)",
      options: [
        {
          name: "learning_rate",
          values: "기본 0.1",
          desc: "한 나무가 반영되는 크기 — 작을수록(0.05 등) 천천히·정교하게 배우지만 max_iter를 늘려야 합니다.",
        },
        {
          name: "max_iter",
          values: "기본 100",
          desc: "부스팅 라운드(나무 수) — early_stopping과 함께 크게 잡는 것이 관례.",
        },
        {
          name: "early_stopping",
          values: '"auto" / True / False',
          desc: "검증 성능이 개선되지 않으면 중단 — validation_fraction(기본 0.1)으로 내부 검증셋 크기 지정.",
        },
        {
          name: "l2_regularization / max_leaf_nodes",
          desc: "복잡도 제어 — 과적합이면 l2를 키우거나 잎 수(기본 31)를 줄입니다.",
        },
      ],
    },
    {
      func: "LGBMClassifier (LightGBM — 웹 실행기 미지원)",
      options: [
        {
          name: "num_leaves",
          values: "기본 31",
          desc: "잎 수로 복잡도를 직접 제어 — depth 대신 잎 수를 조절하는 것이 LightGBM 방식.",
        },
        {
          name: "callbacks=[lgb.early_stopping(n)]",
          desc: "n라운드 개선 없으면 중단 — eval_set과 함께 사용.",
        },
      ],
    },
  ],
  "cross-validation": [
    {
      func: "분할 전략(cv) 고르기",
      intro:
        "무엇을 검증하려는지에 따라 데이터를 나누는 방법이 달라집니다 — 잘못 고르면 성능이 낙관적으로 부풀어요.",
      options: [
        {
          name: "KFold",
          values: "k겹 무작위 분할 (기본 5)",
          desc: "기본값 — shuffle=True, random_state 고정을 습관화.",
        },
        {
          name: "StratifiedKFold",
          values: "클래스 비율 유지",
          desc: "분류 기본 — 불균형(해지 5%)에서 각 폴드의 클래스 비율을 보존.",
        },
        {
          name: "TimeSeriesSplit",
          values: "과거→미래 순서 유지",
          desc: "시계열 필수 — 무작위 분할은 미래 정보 누수로 성능이 부풀어요.",
        },
        {
          name: "GroupKFold",
          values: "같은 그룹은 같은 폴드",
          desc: "한 고객의 계약 여러 건처럼 묶음 단위 누수를 막을 때.",
        },
        {
          name: "scoring",
          values: '"roc_auc" / "neg_root_mean_squared_error" 등',
          desc: "평가 지표 문자열 — 회귀 오차 지표는 '클수록 좋음' 관례에 맞춰 음수(neg_)로 제공됩니다.",
        },
      ],
    },
  ],
  "time-series": [
    {
      func: "ARIMA (statsmodels)",
      options: [
        {
          name: "order=(p, d, q)",
          desc: "자기회귀 p·차분 d·이동평균 q — ACF/PACF 그림이나 AIC 격자 탐색으로 선택. 월별 데이터 출발점은 (1, 1, 1).",
        },
        {
          name: "seasonal_order=(P, D, Q, s)",
          desc: "계절 성분 — 월별이면 s=12, 분기는 s=4.",
        },
        {
          name: "trend",
          values: '"n" / "c" / "t" / "ct"',
          desc: "상수·선형 추세 포함 여부 — 차분(d>0) 후 드리프트를 둘지 결정.",
        },
        {
          name: "get_forecast(steps).summary_frame(alpha=...)",
          values: "기본 alpha=0.05 (95% 구간)",
          desc: "예측 평균과 예측구간 — 먼 미래일수록 구간이 넓어지는 것이 정상.",
        },
      ],
    },
  ],
};
