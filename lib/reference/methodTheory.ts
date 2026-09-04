/**
 * 분석 방법 사전 팝업 [정의 및 방법] 탭 이론 레지스트리.
 *
 * 키는 lib/statMethods.ts `STAT_METHODS`(= lib/actuarialMethods.ts `ACTUARIAL_METHODS` 포함)의
 * 메서드 id와 1:1로 대응한다. 이론이 없는 id는 팝업이 기존 intro+tips로 폴백하므로,
 * 확대는 이 파일에 id 키를 추가하는 것만으로 끝난다(statMethods.ts 수정 불필요).
 *
 * tex는 KaTeX 문자열 — TS 문자열이므로 백슬래시는 이중 이스케이프(\\frac 등).
 */

export type MethodTheory = {
  /** 통계적 정의·개념·가정 (문단은 "\n\n" 구분, 초보자 친화) */
  definition: string;
  /** 핵심 산출식 — tex는 KaTeX 문자열 */
  formulas: { label: string; tex: string; note?: string }[];
  /** 언제·어떻게 활용하나 (보험 실무 예 포함) */
  usage: string;
  /** 결과 해석·의미·흔한 오해·주의점 */
  interpretation: string;
};

export const METHOD_THEORY: Record<string, MethodTheory> = {
  /* ─────────────────────────── 기초 통계 (basic) ─────────────────────────── */
  "desc-stats": {
    definition: "기술통계량은 데이터 전체를 중심(평균·중앙값)·산포(표준편차·분위수)·모양(왜도·첨도)의 대표 숫자 몇 개로 압축하는 방법입니다.\n\n- 확률 모형·가설 같은 별도 가정 불필요(표본의 대표성은 전제)\n- 평균·표준편차는 이상치에 민감, 중앙값·분위수는 순서만 써서 강건",
    formulas: [
      {
        label: "표본평균",
        tex: "\\bar{x} = \\frac{1}{n}\\sum_{i=1}^{n} x_i",
        note: "n은 관측 개수, x_i는 i번째 관측값 — 분포의 무게중심.",
      },
      {
        label: "표본분산·표준편차",
        tex: "s^2 = \\frac{1}{n-1}\\sum_{i=1}^{n}(x_i - \\bar{x})^2, \\quad s = \\sqrt{s^2}",
        note: "n−1로 나누는 것은 표본 편향 보정(자유도) — pandas std()의 기본값.",
      },
      {
        label: "p-분위수(중앙값 포함)",
        tex: "Q(p) = F^{-1}(p)",
        note: "전체를 작은 순으로 세웠을 때 아래에서 비율 p 지점의 값(F는 누적분포함수). 중앙값 = Q(0.5).",
      },
      {
        label: "왜도(비대칭도)",
        tex: "g_1 = \\frac{\\tfrac{1}{n}\\sum_{i=1}^{n}(x_i-\\bar{x})^3}{s^3}",
        note: "0이면 좌우 대칭, 양수면 오른쪽 꼬리(대형 손해 방향)가 긴 분포.",
      },
      {
        label: "초과첨도",
        tex: "g_2 = \\frac{\\tfrac{1}{n}\\sum_{i=1}^{n}(x_i-\\bar{x})^4}{s^4} - 3",
        note: "정규분포(=0) 대비 꼬리의 두꺼움. 양수면 극단값이 정규보다 자주 나타남.",
      },
    ],
    usage: "- 새 데이터 수령 직후 가장 먼저 실행 — 전체 그림·결측·이상치 파악\n- 손해액(claim_amt)을 평균·중앙값·99% 분위수로 요약해 대형 사고 꼬리 위험 가늠\n- 상품군별 groupby 요약표로 손해액 프로파일 비교",
    interpretation: "- 평균과 중앙값의 차이가 크면 비대칭 신호 — 긴 꼬리에서는 평균이 대형 사고에 끌려 과대평가되므로 중앙값·분위수 병행\n- 왜도가 크면 표준편차보다 사분위범위(IQR)가 안정적\n- describe()의 count가 열마다 다르면 결측 존재\n- 같은 평균·표준편차라도 분포 모양은 다를 수 있음 — 히스토그램 병행",
  },

  correlation: {
    definition: "상관분석은 두 연속형 변수가 함께 움직이는 정도를 −1(완전 음)~+1(완전 양)의 계수 하나로 요약합니다(0이면 선형 관계 없음).\n\n- 피어슨: 직선 관계의 강도 — 곡선 관계는 놓치고 이상치에 민감\n- 스피어만: 순위(rank) 기반 — 단조 관계면 곡선도 포착, 이상치에 강건\n- 유의성 검정은 관측쌍의 독립 가정 위에서 성립",
    formulas: [
      {
        label: "피어슨 상관계수",
        tex: "r = \\frac{\\sum_{i=1}^{n}(x_i-\\bar{x})(y_i-\\bar{y})}{\\sqrt{\\sum_{i=1}^{n}(x_i-\\bar{x})^2}\\,\\sqrt{\\sum_{i=1}^{n}(y_i-\\bar{y})^2}}",
        note: "분자는 공분산, 분모는 두 표준편차의 곱 — 단위와 무관하게 −1~+1로 표준화.",
      },
      {
        label: "스피어만 상관계수",
        tex: "\\rho_s = 1 - \\frac{6\\sum_{i=1}^{n} d_i^2}{n(n^2-1)}",
        note: "d_i는 두 변수에서 i번째 관측의 순위 차. 동순위가 없을 때의 간편식.",
      },
      {
        label: "유의성 검정 통계량",
        tex: "t = r\\sqrt{\\frac{n-2}{1-r^2}} \\;\\sim\\; t_{n-2}",
        note: "'모상관 = 0' 귀무가설 하에서 자유도 n−2의 t분포를 따름 — p-value의 근거.",
      },
      {
        label: "결정계수",
        tex: "r^2",
        note: "한 변수의 변동 중 다른 변수로 설명되는 비율. r=0.3이면 설명력은 9%에 불과.",
      },
    ],
    usage: "- 모델링 전 변수 간 관계 탐색\n- 회귀 설명변수 간 상관 과다(다중공선성) 점검\n- 실무 예: 가입연령(age)–보험료(premium) 관계 확인, 상관행렬 히트맵으로 요율 변수 후보의 중복 정보 거르기",
    interpretation: "- 상관 ≠ 인과 — 제3의 변수 개입 가능, 실제 영향의 크기는 회귀로 확인\n- 작은 p는 '상관이 0이 아니다'일 뿐 — 대표본에서는 r=0.05도 유의해짐\n- r≈0이어도 U자형 같은 비선형 관계는 존재 가능\n- 피어슨은 이상치에 민감 — 산점도 병행, 의심되면 스피어만 교차 확인",
  },

  "t-test": {
    definition: "t-검정은 평균 차이를 표준오차로 나눈 t 통계량이 t분포에서 얼마나 극단적인지(p-value)로, 그 차이가 우연인지 실제인지 판단하는 가설검정입니다.\n\n- 구도 3종: 일표본(기준값 비교)·독립표본(두 집단)·대응표본(전후 비교)\n- 가정: 독립성·평균의 근사 정규성(대표본은 중심극한정리로 완화)\n- 독립표본은 등분산 가정이 필요 없는 Welch t가 기본",
    formulas: [
      {
        label: "일표본 t",
        tex: "t = \\frac{\\bar{x} - \\mu_0}{s/\\sqrt{n}}",
        note: "μ₀는 비교 기준값(예: 가정 평균 100만 원), s/√n은 표본평균의 표준오차.",
      },
      {
        label: "독립 이표본(Welch) t",
        tex: "t = \\frac{\\bar{x}_1 - \\bar{x}_2}{\\sqrt{\\dfrac{s_1^2}{n_1} + \\dfrac{s_2^2}{n_2}}}",
        note: "집단별 분산 s²을 각자 반영 — 등분산 가정 불필요(자유도는 Welch–Satterthwaite 근사).",
      },
      {
        label: "대응표본 t",
        tex: "t = \\frac{\\bar{d}}{s_d/\\sqrt{n}}",
        note: "d̄는 짝지은 차이(전−후)의 평균, s_d는 그 차이의 표준편차.",
      },
      {
        label: "효과 크기 (Cohen's d)",
        tex: "d = \\frac{\\bar{x}_1 - \\bar{x}_2}{s_p}, \\quad s_p = \\sqrt{\\frac{(n_1-1)s_1^2 + (n_2-1)s_2^2}{n_1+n_2-2}}",
        note: "합동표준편차 단위로 잰 차이의 크기 — 관례상 0.2 작음·0.5 중간·0.8 큼.",
      },
    ],
    usage: "- '두 평균이 다른가' 질문에 적용\n- 실무 예: 남녀(sex M/F) 평균 청구액(claim_amt) 차이(Welch), 요율 개정 전후 보험료(대응표본)\n- 사전 점검: 정규성(Shapiro)·등분산(Levene) — 정규성이 크게 깨지면 Mann-Whitney 등 비모수 고려",
    interpretation: "- p < 0.05는 '우연으로 설명되기 어렵다'는 뜻 — 차이가 크다는 뜻 아님, Cohen's d(0.2 작음·0.5 중간·0.8 큼)·실제 금액 차이 병기\n- p > 0.05는 '차이 없음의 증명'이 아니라 증거 부족\n- 왜도 큰 손해액은 평균 자체가 대표값으로 부적절할 수 있음\n- 3집단 이상 쌍별 반복 비교는 1종 오류 누적 — ANOVA 사용",
  },

  "chi-square": {
    definition: "카이제곱 독립성 검정은 교차표의 관측빈도와 '독립일 때의 기대빈도' 차이를 전 칸에 걸쳐 합산해 두 범주형 변수의 연관 여부를 판단합니다.\n\n- 자유도 (r−1)(c−1)의 카이제곱 분포 근사 — 각 칸 기대빈도 5 이상일 때 성립\n- 관측이 서로 독립적으로 수집됐다는 가정 필요",
    formulas: [
      {
        label: "카이제곱 통계량",
        tex: "\\chi^2 = \\sum_{i=1}^{r}\\sum_{j=1}^{c} \\frac{(O_{ij} - E_{ij})^2}{E_{ij}}",
        note: "O는 관측빈도, E는 기대빈도, r·c는 행·열 범주 수 — 차이가 클수록 통계량 증가.",
      },
      {
        label: "기대빈도",
        tex: "E_{ij} = \\frac{n_{i\\cdot}\\, n_{\\cdot j}}{n}",
        note: "행 i 합계 × 열 j 합계 ÷ 전체 n — '독립이라면' 각 칸에 기대되는 건수.",
      },
      {
        label: "자유도",
        tex: "\\text{df} = (r-1)(c-1)",
        note: "p-value를 구할 기준 카이제곱 분포를 결정.",
      },
      {
        label: "Cramér's V (효과 크기)",
        tex: "V = \\sqrt{\\frac{\\chi^2}{n\\,\\min(r-1,\\,c-1)}}",
        note: "0(무관)~1(완전연관). 관례상 0.1 약함·0.3 중간·0.5 강함.",
      },
      {
        label: "Pearson 잔차",
        tex: "r_{ij} = \\frac{O_{ij} - E_{ij}}{\\sqrt{E_{ij}}}",
        note: "각 칸이 χ²에 얼마나 기여했는지 보는 진단용 지표(Σrᵢⱼ² = χ²). SPSS의 'standardized residual'이 이것 — 귀무가설에서 분산이 1보다 작아(아래) ±2 기준을 그대로 쓰면 안 됩니다.",
      },
      {
        label: "조정된 잔차(adjusted residual)",
        tex: "a_{ij} = \\frac{O_{ij} - E_{ij}}{\\sqrt{E_{ij}\\,(1 - p_{i\\cdot})(1 - p_{\\cdot j})}}",
        note: "pᵢ.=행 i 비율, p.ⱼ=열 j 비율. 귀무가설에서 근사적으로 N(0,1)이므로 |값| > 2 판정은 이 잔차에 적용합니다. Pearson 잔차 rᵢⱼ의 분산은 (1−pᵢ.)(1−p.ⱼ) < 1이라 ±2로 보면 지나치게 보수적 — 실제로 연관을 주도하는 칸을 놓칩니다.",
      },
    ],
    usage: "- '범주 A의 분포가 범주 B에 따라 달라지는가' 질문에 사용\n- 실무 예: 연령대(age_band)×해지 여부(lapsed) 연관 검정으로 유지율 관리 대상 좁히기, 성별×상품 선택 분석\n- 행 기준 비율표(normalize=\"index\")와 함께 보면 해석 용이",
    interpretation: "- 검정은 연관의 존재만 알려줌 — 주도 칸은 조정된 잔차 |값| > 2, 세기는 Cramér's V로 확인\n- Pearson 잔차 (O−E)/√E에 ±2를 적용하는 실수 주의 — 귀무가설에서 분산이 (1−pᵢ.)(1−p.ⱼ)로 1보다 작아 주도 칸을 놓침\n- 대표본에서는 미미한 연관도 유의 — p만으로 '강한 관계' 판단 금지(연관은 인과 아님)\n- 기대빈도 5 미만 칸이 20% 초과면 범주 병합 또는 2×2는 Fisher 정확검정, 대응 자료는 McNemar",
  },

  anova: {
    definition: "분산분석(ANOVA)은 세 개 이상 집단의 평균이 모두 같은지를, 집단 간 변동과 집단 내 변동의 비율(F)로 한 번에 검정합니다.\n\n- 귀무가설: 모든 집단 평균 동일(μ₁=μ₂=⋯=μk)\n- 가정: 독립성·잔차 정규성·등분산 — 등분산 깨지면 Welch ANOVA, 정규성까지 깨지면 Kruskal-Wallis",
    formulas: [
      {
        label: "변동 분해(총제곱합)",
        tex: "\\underbrace{\\sum_{j=1}^{k}\\sum_{i=1}^{n_j}(x_{ij}-\\bar{x})^2}_{SST}=\\underbrace{\\sum_{j=1}^{k} n_j(\\bar{x}_j-\\bar{x})^2}_{SSB}+\\underbrace{\\sum_{j=1}^{k}\\sum_{i=1}^{n_j}(x_{ij}-\\bar{x}_j)^2}_{SSW}",
        note: "x̄=전체 평균, x̄ⱼ=집단 j 평균, nⱼ=집단 j 크기, k=집단 수 — 총 변동(SST)을 집단 간(SSB)·집단 내(SSW)로 분해",
      },
      {
        label: "F 통계량",
        tex: "F=\\frac{SSB/(k-1)}{SSW/(N-k)}=\\frac{MSB}{MSW}",
        note: "N=전체 표본 수. 귀무가설에서 자유도 (k−1, N−k)의 F 분포를 따르며, 클수록 집단 간 차이가 뚜렷",
      },
      {
        label: "효과 크기 η²",
        tex: "\\eta^2=\\frac{SSB}{SST}",
        note: "전체 분산 중 집단 구분이 설명하는 비율 — 관례상 0.01 작음 · 0.06 중간 · 0.14 큼",
      },
    ],
    usage: "- 3집단 이상 평균 비교를 한 번에 — 쌍별 t-검정 반복의 1종 오류 누적 방지\n- 실무 예: 상품군 A·B·C·D 평균 손해액(claim_amt), 판매 채널별 평균 유지 기간 비교\n- 유의하면 Tukey HSD 사후검정으로 어느 쌍이 다른지 확인",
    interpretation: "- p < 0.05는 '적어도 한 집단'이 다르다는 뜻 — 어느 쌍인지는 사후검정(Tukey HSD)으로\n- p는 효과 크기가 아님 — 대표본은 미미한 차이도 유의, η²(0.01 작음·0.06 중간·0.14 큼) 병기\n- 집단별 분산이 크게 다르면 F 검정 자체가 왜곡 — Levene 검정으로 등분산 선점검",
  },

  normality: {
    definition: "정규성 검정은 데이터(또는 잔차)가 정규분포를 따르는지 확인해, 정규 가정을 전제로 하는 t-검정·ANOVA·회귀 진단의 관문 역할을 합니다.\n\n- Shapiro-Wilk: 정렬값과 정규 기대 배열의 일치도(소표본 적합)\n- Kolmogorov-Smirnov: 경험·이론 누적분포의 최대 간격\n- Q-Q 플롯: 점들이 직선 위에 놓이면 정규에 가까움",
    formulas: [
      {
        label: "Shapiro-Wilk W",
        tex: "W=\\frac{\\left(\\sum_{i=1}^{n} a_i\\, x_{(i)}\\right)^2}{\\sum_{i=1}^{n}(x_i-\\bar{x})^2}",
        note: "x₍ᵢ₎=크기순 i번째 값, aᵢ=정규 순서통계량에서 유도된 가중치 — W가 1에 가까울수록 정규에 가까움",
      },
      {
        label: "Kolmogorov-Smirnov D",
        tex: "D_n=\\sup_x\\,\\lvert F_n(x)-F_0(x)\\rvert",
        note: "Fₙ=경험 누적분포, F₀=비교(정규) 누적분포 — 두 곡선의 최대 세로 간격이 클수록 정규에서 멀어짐",
      },
      {
        label: "Q-Q 플롯의 점",
        tex: "\\left(\\Phi^{-1}\\!\\left(\\frac{i-0.5}{n}\\right),\\; x_{(i)}\\right)",
        note: "Φ⁻¹=표준정규 분위수 함수 — 이론 분위수(가로) 대 표본 분위수(세로), 점들이 직선이면 정규",
      },
    ],
    usage: "- 모수 검정·회귀 진단 전 '정규 가정을 적용해도 되는가' 판단\n- 실무 예: t-검정·ANOVA 전 손해액(claim_amt) 정규성 확인\n- 손해액은 오른쪽 꼬리가 길어 대개 비정규 — 로그 변환 후 재검정 또는 비모수 우회 판단의 근거",
    interpretation: "- p < 0.05면 '정규 아님' — 역은 불성립(p가 커도 정규 증명이 아니라 기각 근거 없음)\n- 대표본 함정: 수천 건 이상이면 무시할 편차도 유의 — Q-Q 플롯·히스토그램 시각 판단 우선\n- KS에 데이터로 추정한 평균·표준편차를 넣으면 p가 관대해짐(모수 추정 효과)\n- Q-Q 오른쪽 끝이 위로 휘면 긴 꼬리 신호 — 로그 변환이 잘 듣는 형태",
  },

  nonparametric: {
    definition: "비모수 검정은 특정 분포(주로 정규) 가정 없이 원자료 대신 순위(rank)로 집단 차이를 검정하는 방법군으로, 이상치에 강건합니다.\n\n- 독립 두 집단: Mann-Whitney U(t-검정 대체) / 전후 비교: Wilcoxon 부호순위 / 3집단 이상: Kruskal-Wallis(ANOVA 대체)\n- 독립성과 '집단 간 분포 모양 유사' 가정은 여전히 필요",
    formulas: [
      {
        label: "Mann-Whitney U",
        tex: "U = n_1 n_2 + \\frac{n_1(n_1+1)}{2} - R_1",
        note: "n₁·n₂=각 집단 크기, R₁=집단 1의 순위 합 — 두 집단을 합쳐 순위를 매긴 뒤 한쪽으로 치우쳤는지 확인",
      },
      {
        label: "Wilcoxon 부호순위 W",
        tex: "W=\\min(W^{+},\\,W^{-}),\\qquad W^{+}=\\sum_{d_i>0}\\operatorname{rank}\\lvert d_i\\rvert",
        note: "dᵢ=전후 차이 — 차이의 절댓값 순위를 부호별로 합산, 어느 한쪽 합이 지나치게 작으면 유의",
      },
      {
        label: "Kruskal-Wallis H",
        tex: "H=\\frac{12}{N(N+1)}\\sum_{j=1}^{k}\\frac{R_j^2}{n_j}-3(N+1)",
        note: "N=전체 표본 수, Rⱼ=집단 j의 순위 합 — 귀무가설에서 근사적으로 χ²(k−1) 분포를 따름",
      },
    ],
    usage: "- 정규성이 크게 깨졌거나 표본이 작을 때, 이상치 영향을 줄이고 싶을 때 모수 검정 대체\n- 실무 예: 성별 손해액(Mann-Whitney)·요율 개정 전후 보험료(Wilcoxon)·상품군별 손해액(Kruskal-Wallis)\n- 오른쪽 꼬리 긴 손해액의 집단 비교에 특히 적합",
    interpretation: "- 유의하면 '분포의 위치(대략 중앙값)가 다르다' — 평균 대신 집단별 중앙값으로 보고\n- '비모수 = 가정 없음'은 오해 — 분포 모양이 크게 다르면 '분포가 다르다'로만 해석\n- 정규성이 성립하는 데이터라면 모수 검정보다 검정력 다소 낮음",
  },

  distributions: {
    definition: "분포 적합은 데이터에 가장 잘 맞는 이론 분포와 모수를 최대우도법(MLE)으로 찾는 작업이고, 난수 생성은 그 분포에서 가상 표본을 뽑아 미래를 실험하는 작업입니다.\n\n- 후보 간 비교는 AIC, 적합도 확인은 KS 검정·Q-Q 플롯\n- 표준 후보: 손해심도=로그정규·감마·와이블, 사고 건수=포아송·음이항",
    formulas: [
      {
        label: "최대우도 추정(MLE)",
        tex: "\\hat{\\theta}=\\arg\\max_{\\theta}\\;\\ell(\\theta),\\qquad \\ell(\\theta)=\\sum_{i=1}^{n}\\ln f(x_i;\\theta)",
        note: "f=확률밀도, ℓ=로그우도 — 관측 데이터가 나올 가능성을 최대로 만드는 모수 θ̂를 선택",
      },
      {
        label: "AIC",
        tex: "\\mathrm{AIC}=2k-2\\,\\ell(\\hat{\\theta})",
        note: "k=모수 개수 — 우도가 높을수록·모수가 적을수록 작아짐(작을수록 우수), 후보 간 상대 비교용",
      },
      {
        label: "KS 적합도 통계량",
        tex: "D_n=\\sup_x\\,\\lvert F_n(x)-F(x;\\hat{\\theta})\\rvert",
        note: "경험 누적분포와 적합 분포의 최대 간격 — 작을수록(p가 클수록) 적합이 양호",
      },
      {
        label: "집합손해(빈도×심도) 모형",
        tex: "S=\\sum_{i=1}^{N}X_i,\\qquad N\\sim\\mathrm{Poisson}(\\lambda),\\;\\; X_i\\sim\\mathrm{LogNormal}(\\mu,\\sigma)",
        note: "N=연간 사고건수, Xᵢ=개별 손해심도 — 몬테카를로로 S의 분포와 VaR(99.5% 분위수)을 추정",
      },
    ],
    usage: "- 손해액·건수를 분포로 요약해 요율 산출·준비금·재보험 설계의 입력으로 사용\n- 적합된 빈도×심도에서 몬테카를로로 집합손해 S=ΣX 분포 생성 — 꼬리 위험(VaR) 측정\n- 실무 예: claim_amt에 로그정규·감마 적합 → AIC·KS로 선택 → 포아송 건수와 결합해 연간 총손해 시뮬레이션",
    interpretation: "- AIC는 작을수록 좋지만 후보 간 상대 비교용 — 차이가 2 미만이면 사실상 동급\n- KS p가 커도 '맞다'는 증명 아님 — 대표본은 사소한 차이도 기각, Q-Q 플롯 병행\n- 요율·재보험은 몸통보다 꼬리 적합이 핵심 — 꼬리가 얇게 적합되면 VaR 과소평가\n- 난수는 default_rng(seed)로 시드 고정해야 재현 가능",
  },

  /* ─────────────────────────── 회귀·통계모형 (model) ─────────────────────────── */
  "linear-regression": {
    definition: "선형회귀는 연속형 목표변수(보험료·손해액 등)를 설명변수들의 직선적 결합으로 설명하고, 잔차제곱합을 최소화하는 계수를 찾습니다(최소제곱법, OLS).\n\n- 계수 = 설명변수 1단위 변화 시 목표변수의 평균 변화\n- 가정 4가지: 선형성·오차 독립성·등분산성·오차 정규성 — 깨지면 표준오차·p-value부터 왜곡",
    formulas: [
      {
        label: "모형식",
        tex: "y_i = \\beta_0 + \\beta_1 x_{i1} + \\cdots + \\beta_p x_{ip} + \\varepsilon_i",
        note: "β_j: 회귀계수(다른 변수 고정 시 x_j 1단위 증가의 효과), ε: 평균 0인 오차항",
      },
      {
        label: "최소제곱 추정량 (OLS)",
        tex: "\\hat{\\boldsymbol{\\beta}} = \\underset{\\beta}{\\arg\\min}\\; \\sum_{i}\\bigl(y_i - \\mathbf{x}_i^{\\top}\\beta\\bigr)^2 = (X^{\\top}X)^{-1}X^{\\top}y",
        note: "X: 설명변수 행렬, y: 목표변수 벡터 — 잔차제곱합을 최소로 하는 닫힌 형태의 해",
      },
      {
        label: "결정계수",
        tex: "R^2 = 1 - \\frac{\\sum_i (y_i - \\hat{y}_i)^2}{\\sum_i (y_i - \\bar{y})^2}",
        note: "모형이 설명하는 분산의 비율(0~1). ŷ: 예측값, ȳ: 전체 평균",
      },
      {
        label: "계수 유의성 검정",
        tex: "t_j = \\frac{\\hat{\\beta}_j}{SE(\\hat{\\beta}_j)}",
        note: "SE: 계수의 표준오차 — |t|가 대략 2 이상이면 '계수가 0'이라는 가설을 기각",
      },
    ],
    usage: "- '무엇이 얼마나 영향을 주는가'를 숫자로 설명할 때 첫 번째 도구\n- 실무 예: 보험료(premium)를 나이·성별·BMI로 회귀 — 'BMI 1 증가 시 평균 몇 원 증가'로 요인별 효과 분리\n- 언더라이팅 요율 요인 검토·손해액 추세 설명·복잡한 예측 모형의 성능 기준선",
    interpretation: "- 계수는 '다른 변수 고정 시'의 조건부 효과\n- R²가 높아도 인과 입증 아님 · p가 작아도 효과가 큰 것 아님(대표본) · 척도 다른 계수 직접 비교 금지(표준화 필요)\n- 해석 전 잔차 플롯(등분산·선형성)·VIF(다중공선성, 10 초과 주의) 점검 필수",
  },

  "logistic-regression": {
    definition: "로지스틱 회귀는 해지/유지 같은 0/1 결과의 발생 확률을 로짓(로그 오즈)=설명변수 선형결합으로 모형화하고, 계수는 최대우도법으로 추정합니다.\n\n- 가정: 로짓–설명변수의 선형 관계·관측 간 독립\n- 선형회귀와 달리 오차의 정규성·등분산은 불필요",
    formulas: [
      {
        label: "로짓 모형",
        tex: "\\operatorname{logit}(p_i) = \\log\\frac{p_i}{1-p_i} = \\beta_0 + \\beta_1 x_{i1} + \\cdots + \\beta_p x_{ip}",
        note: "p: 사건(해지) 발생 확률, p/(1−p): 오즈(odds)",
      },
      {
        label: "확률 복원 (시그모이드)",
        tex: "p_i = \\frac{1}{1 + e^{-\\mathbf{x}_i^{\\top}\\boldsymbol{\\beta}}}",
        note: "선형결합을 0~1 사이 확률로 되돌리는 S자 곡선",
      },
      {
        label: "오즈비",
        tex: "\\mathrm{OR}_j = e^{\\beta_j}",
        note: "x_j가 1단위 커질 때 오즈가 몇 배가 되는가 — 1보다 크면 위험 증가 요인",
      },
      {
        label: "로그우도",
        tex: "\\ell(\\boldsymbol{\\beta}) = \\sum_i \\bigl[\\, y_i \\log p_i + (1-y_i)\\log(1-p_i) \\,\\bigr]",
        note: "이 값을 최대로 하는 β를 찾는 것이 최대우도추정(MLE)",
      },
    ],
    usage: "- '이 계약이 해지될 확률은?' 같은 이진 분류 질문\n- 실무 예: 해지 예측(lapsed)·언더라이팅 자동심사(승인/거절)·사기 청구 스크리닝\n- 출력이 확률 — 임계값(기본 0.5)을 업무 비용에 맞춰 조정 가능",
    interpretation: "- exp(계수)=오즈비 — '확률 몇 배'가 아니라 '오즈 몇 배'(사건이 드물 때만 근사 일치), 오즈비 1.5 = 오즈 50% 상승\n- 클래스 불균형(해지 5% 등)에서는 정확도 무의미 — ROC-AUC·재현율·PR-AUC로 평가\n- McFadden 유사 R²는 0.2~0.4면 양호 — 선형회귀 R² 눈높이 적용 금지",
  },

  glm: {
    definition: "GLM은 선형회귀를 확장해 목표변수 분포를 지수족(포아송·감마·이항 등)에서 고르고 링크함수로 평균과 선형결합을 잇습니다 — 빈도=포아송·심도=감마(로그 링크)가 보험요율 산출의 표준입니다.\n\n- 로그 링크에서 exp(계수)=상대도(relativity) — 요율표와 같은 언어\n- 노출(경과 계약년수) 차이는 log(노출) offset으로 보정",
    formulas: [
      {
        label: "GLM 일반형",
        tex: "g(\\mu_i) = \\mathbf{x}_i^{\\top}\\boldsymbol{\\beta}, \\qquad \\mu_i = E[Y_i]",
        note: "g: 링크함수(포아송·감마 빈도/심도 모형은 보통 log) — 평균을 변환해 선형결합과 연결",
      },
      {
        label: "포아송 빈도 모형 (노출 offset)",
        tex: "\\log \\mu_i = \\log e_i + \\mathbf{x}_i^{\\top}\\boldsymbol{\\beta}",
        note: "e_i: 노출(경과 계약년수) — 계수를 1로 고정한 offset, 모형이 '건수'가 아닌 '율'을 보게 함",
      },
      {
        label: "요율 상대도",
        tex: "\\text{relativity}_j = e^{\\beta_j}",
        note: "기준 수준 대비 곱셈 배수 — 1.42면 그 요인의 빈도가 42% 높음",
      },
      {
        label: "과산포와 음이항(NB2) 분산",
        tex: "\\mathrm{Var}(Y) = \\mu + \\alpha\\,\\mu^2",
        note: "포아송은 Var=μ. 실제 분산이 그보다 크면(과산포) α>0인 음이항으로 초과분산을 흡수",
      },
      {
        label: "순보험료 분해",
        tex: "E[S] = E[N] \\times E[X]",
        note: "S: 총손해액, N: 사고 빈도, X: 사고 심도 — 빈도 GLM × 심도 GLM으로 순보험료 산출",
      },
    ],
    usage: "- 자동차·장기보험 요율 산출 표준 파이프라인 — 빈도(포아송, offset=log 노출)×심도(감마, 사고 건만) 적합 후 곱해 셀별 순보험료·상대도 산출\n- 손해율·갱신율 같은 비율은 이항\n- 0이 뭉치고 꼬리 긴 순보험료 직접 모형화는 Tweedie",
    interpretation: "- 로그 링크 계수는 곱셈 효과 — 계수 0.35 ⇒ exp(0.35)≈1.42배\n- offset 누락 시 노출 긴 계약이 고위험처럼 왜곡\n- 과산포(Pearson χ²/자유도 1.2 이상) 무시하면 표준오차 과소평가 — 음이항 교체나 quasi-Poisson 보정\n- 모형 비교는 AIC — 단 quasi-Poisson은 우도 기반이 아니라 AIC 비교 불가",
  },

  regularized: {
    definition: "규제 회귀는 잔차제곱합에 계수 크기 벌점을 더해 계수를 0 쪽으로 수축시킵니다 — 약간의 편향을 감수하고 분산을 크게 줄이는 편향–분산 절충입니다.\n\n- Ridge(L2): 제곱합 벌점 — 모든 계수를 고르게 수축\n- Lasso(L1): 절대값 벌점 — 일부 계수를 정확히 0으로(변수 선택)\n- 벌점이 계수 '크기'에 작동 — 학습 전 표준화(StandardScaler)가 사실상 전제",
    formulas: [
      {
        label: "Ridge (L2 벌점)",
        tex: "\\hat{\\boldsymbol{\\beta}}^{\\mathrm{ridge}} = \\underset{\\beta}{\\arg\\min}\\; \\sum_i \\bigl(y_i - \\mathbf{x}_i^{\\top}\\beta\\bigr)^2 + \\alpha \\sum_j \\beta_j^2",
        note: "α: 벌점 강도 — 클수록 계수가 0 쪽으로 고르게 수축(정확히 0이 되지는 않음)",
      },
      {
        label: "Lasso (L1 벌점)",
        tex: "\\hat{\\boldsymbol{\\beta}}^{\\mathrm{lasso}} = \\underset{\\beta}{\\arg\\min}\\; \\sum_i \\bigl(y_i - \\mathbf{x}_i^{\\top}\\beta\\bigr)^2 + \\alpha \\sum_j |\\beta_j|",
        note: "절대값 벌점의 뾰족한 모서리 덕에 일부 계수가 정확히 0 — 변수 선택 효과",
      },
      {
        label: "ElasticNet 벌점 (L1+L2 혼합)",
        tex: "\\alpha\\Bigl[\\rho \\sum_j |\\beta_j| + \\tfrac{1-\\rho}{2}\\sum_j \\beta_j^2\\Bigr]",
        note: "ρ(l1_ratio): L1 비중 — 0이면 Ridge, 1이면 Lasso. 상관 그룹을 함께 남기려면 0.2~0.5",
      },
    ],
    usage: "- 설명변수가 많거나 상관이 높아 일반 회귀 계수가 요동칠 때\n- 실무 예: 상관 높은 건강·소득 지표를 Ridge로 안정화, 해지 모형 파생변수를 Lasso로 핵심만 선별\n- 벌점 강도 alpha는 교차검증(RidgeCV·LassoCV)으로 선택",
    interpretation: "- Lasso의 0 계수 = '중요하지 않음'이 아님 — 상관 그룹에서 하나만 남겼을 수 있음(그룹 유지는 ElasticNet)\n- 규제 계수는 의도적 편향 추정치 — p-value·신뢰구간 해석 금지가 원칙\n- 성능 비교는 반드시 검증 데이터로 — alpha 과대 시 과소적합(사실상 평균 예측)",
  },

  "time-series": {
    definition: "시계열 분석은 시간 순서가 있는 데이터를 분해(추세·계절성·불규칙)로 확인한 뒤, 과거의 자기 자신(AR)과 과거 예측 오차(MA)로 현재를 설명하는 ARIMA로 예측합니다.\n\n- 추세는 차분(d)으로 제거해 정상(stationary) 상태로 만든 뒤 적합\n- 계절성이 있으면 주기 s(월별 12)의 계절 차수를 더한 SARIMA",
    formulas: [
      {
        label: "가법 분해",
        tex: "y_t = T_t + S_t + R_t",
        note: "T: 추세, S: 계절성, R: 잔차 — 변동 폭이 수준에 비례해 커지면 곱셈형(y=T×S×R)",
      },
      {
        label: "차분",
        tex: "y'_t = y_t - y_{t-1}",
        note: "추세를 제거해 정상성 확보 — 이를 d번 반복한 것이 ARIMA의 차수 d",
      },
      {
        label: "ARMA(p, q) 모형",
        tex: "y_t = c + \\sum_{i=1}^{p}\\phi_i\\, y_{t-i} + \\varepsilon_t + \\sum_{j=1}^{q}\\theta_j\\, \\varepsilon_{t-j}",
        note: "φ: 자기회귀 계수(과거 값의 영향), θ: 이동평균 계수(과거 충격의 여운), ε: 백색잡음",
      },
      {
        label: "계절 ARIMA 표기",
        tex: "\\mathrm{ARIMA}(p,d,q)\\times(P,D,Q)_s",
        note: "s: 계절 주기(월별 12, 분기 4) — 계절 성분에도 AR·차분·MA를 적용",
      },
    ],
    usage: "- '다음 12개월 청구 건수는?' 같은 미래 예측\n- 실무 예: 월별 청구 건수(monthly_claims) 예측으로 지급 예산·심사 인력 계획, 보험료 수입의 계절 효과 분리해 실질 성장률 파악\n- 차수 (p, d, q)는 ACF/PACF 그림 또는 auto_arima로 결정",
    interpretation: "- 먼 미래일수록 예측구간이 넓어지는 것은 정직한 불확실성 표현\n- 반드시 '과거로 학습, 미래로 검증' — 무작위 분할은 미래 정보 유출로 성능 부풀림\n- 모형은 과거 패턴의 연장 — 제도 변경·신상품 같은 구조 변화는 포착 불가\n- 적합 후 잔차가 백색잡음인지 확인, 큰 이벤트 전후는 구간을 나눠 점검",
  },

  survival: {
    definition: "생존분석은 사건(해지·사망)이 '언제' 일어나는지를 분석하며, 중도절단(관찰 종료까지 무사건) 계약을 '그 시점까지 생존' 정보로 살려 씁니다 — 절단을 무시하면 결과가 크게 왜곡됩니다.\n\n- Kaplan-Meier: 분포 가정 없이 시점별 생존율 곡선 추정(비모수)\n- Cox 비례위험: 기저위험 형태 없이 요인별 위험비만 추정(준모수) — 위험비가 시간에 일정하다는 가정",
    formulas: [
      {
        label: "생존함수",
        tex: "S(t) = P(T > t)",
        note: "T: 사건까지의 시간 — t 시점까지 사건이 일어나지 않을 확률(유지율)",
      },
      {
        label: "Kaplan-Meier 추정량",
        tex: "\\hat{S}(t) = \\prod_{t_i \\le t}\\Bigl(1 - \\frac{d_i}{n_i}\\Bigr)",
        note: "t_i: 사건 발생 시점, d_i: 그 시점의 사건 수, n_i: 직전까지 위험에 노출된 수(절단 반영)",
      },
      {
        label: "위험함수 (hazard)",
        tex: "h(t) = \\lim_{\\Delta t \\to 0}\\frac{P(t \\le T < t+\\Delta t \\mid T \\ge t)}{\\Delta t}",
        note: "t까지 생존했다는 조건에서 '지금 막' 사건이 일어날 순간 위험률",
      },
      {
        label: "Cox 비례위험 모형",
        tex: "h(t \\mid \\mathbf{x}) = h_0(t)\\, e^{\\mathbf{x}^{\\top}\\boldsymbol{\\beta}}",
        note: "h₀: 형태를 정하지 않는 기저위험, exp(β_j): 위험비(hazard ratio)",
      },
    ],
    usage: "- 교과서적 사례는 계약 해지 분석 — 채널별 Kaplan-Meier 곡선으로 시점별 유지율 비교(유지율 50% 도달 시점 등)\n- Cox 모형으로 나이·보험료부담률·특약 유무가 해지 위험을 몇 배 높이는지 추정\n- 사망률 연구·재가입까지의 시간·설계사 정착 기간 분석에도 동일 틀",
    interpretation: "- Cox의 exp(계수)=위험비(HR) — 1.3이면 해지 '위험' 30% 상승(해지 확률 30%가 아님)\n- 치명적 실수: 중도절단(관찰 종료)을 사건=1로 코딩 — 결과 전체 왜곡\n- 비례위험 가정은 check_assumptions로 점검, 위반 변수는 층화(strata) 처리\n- 평균 생존시간은 절단 탓에 불안정 — 중위 생존시간(유지율 50% 도달 시점)으로 보고",
  },
  "loss-functions": {
    definition:
      "손실함수는 예측 오차를 하나의 숫자로 요약하는 규칙이며, 어떤 손실로 학습하느냐가 모델이 무엇을 겨냥하는지를 정합니다 — MSE=조건부 평균, MAE=조건부 중앙값, 분위수(pinball)=원하는 백분위수.\n\n- 벌점 방식이 성질을 가름: 제곱(MSE)은 이상치 민감, 절댓값(MAE)은 강건, deviance(포아송·감마·Tweedie)는 분포 맞춤 우도 벌점\n- 미탐·오탐 비용이 다르면 판정 임계값을 옮기는 비용민감(cost-sensitive) 관점 추가\n- 보험 데이터는 두꺼운 꼬리·0 뭉침·비용 비대칭이 흔해 손실 선택의 효과가 특히 큼",
    formulas: [
      {
        label: "제곱오차(MSE)와 RMSE",
        tex: "\\mathrm{MSE}=\\frac{1}{n}\\sum_{i=1}^{n}(y_i-\\hat{y}_i)^2,\\qquad \\mathrm{RMSE}=\\sqrt{\\mathrm{MSE}}",
        note: "오차를 제곱해 평균 — 큰 오차에 제곱 벌점이라 이상치에 민감. 최소화 대상은 조건부 평균 E[y|x]. RMSE는 √를 씌워 원단위(만원)로 복원.",
      },
      {
        label: "절대오차(MAE)",
        tex: "\\mathrm{MAE}=\\frac{1}{n}\\sum_{i=1}^{n}\\lvert y_i-\\hat{y}_i\\rvert",
        note: "절댓값 벌점이라 이상치 1건의 영향이 1/n로 희석돼 강건 — 최소화 대상은 조건부 중앙값.",
      },
      {
        label: "Huber 손실 (제곱↔절대 절충)",
        tex: "L_\\delta(r)=\\begin{cases}\\tfrac{1}{2}r^2 & \\lvert r\\rvert\\le\\delta\\\\[2pt]\\delta\\bigl(\\lvert r\\rvert-\\tfrac{1}{2}\\delta\\bigr) & \\lvert r\\rvert>\\delta\\end{cases}",
        note: "잔차 r=y−ŷ. 작은 오차는 MSE처럼(미분 가능·효율), 큰 오차는 MAE처럼(선형 벌점) — δ(sklearn epsilon) 안쪽만 제곱해 이상치 영향을 잘라냄.",
      },
      {
        label: "분위수(pinball) 손실",
        tex: "L_q(y,\\hat{y})=\\max\\bigl(q\\,(y-\\hat{y}),\\;(q-1)(y-\\hat{y})\\bigr)",
        note: "과소예측(y>ŷ)과 과대예측에 서로 다른 벌점(q : 1−q) — 최소화하면 q-분위수 예측. q=0.9면 손해액 VaR(90%). q=0.5면 MAE의 절반과 동치.",
      },
      {
        label: "포아송 · Tweedie deviance",
        tex: "D_{\\mathrm{Poi}}=2\\sum_i\\Bigl[y_i\\ln\\tfrac{y_i}{\\hat{y}_i}-(y_i-\\hat{y}_i)\\Bigr],\\qquad \\operatorname{Var}(Y)=\\phi\\,\\mu^{p}\\;(1<p<2)",
        note: "deviance = 목표분포의 최대우도에 대응하는 손실. 건수는 포아송(p=1), 순보험료는 Tweedie(1<p<2, 0 뭉침+양의 꼬리). 항상 양의 예측·치우침에 강건.",
      },
      {
        label: "로그손실 vs hinge (분류)",
        tex: "L_{\\log}=-\\bigl[y\\ln p+(1-y)\\ln(1-p)\\bigr],\\qquad L_{\\mathrm{hinge}}=\\max\\bigl(0,\\;1-\\tilde{y}\\,f(x)\\bigr)",
        note: "로그손실은 확률 p를 벌해 확신 있는 오류에 무한대 벌점(로지스틱이 최소화). hinge는 마진 손실 — 부호 라벨 ỹ∈{−1,+1}, 경계에서 충분히 떨어져 맞으면 0(SVM).",
      },
      {
        label: "비용최소 판정 임계값",
        tex: "\\text{예측}=1 \\iff \\hat{p}(x)\\ge t^{*},\\qquad t^{*}=\\frac{c_{FP}}{c_{FP}+c_{FN}}",
        note: "미탐(FN)·오탐(FP) 비용이 다르면 기대비용 (1−p)c_FP vs p·c_FN 비교에서 유도되는 임계값. c_FN이 크면 t*가 낮아져 더 적극적으로 탐지 — 단 이는 확률이 잘 보정된 경우이고, 실무에선 총비용 격자 탐색을 병행.",
      },
    ],
    usage:
      "- 대형 사고 과소예측이 치명적이면 MSE/RMSE, 이상치가 흔해 '전형적 규모'가 중요하면 MAE·Huber\n- 안전할증·재보험 한도 등 꼬리가 필요하면 분위수 회귀로 손해액 VaR(90·99%) 직접 예측\n- 건수·순보험료 부스팅은 Poisson·Tweedie deviance 손실(HistGradientBoostingRegressor(loss=\"poisson\"), TweedieRegressor)\n- 사기 심사·해지 방어 등 비용 비대칭 결정은 총비용 기준 임계값 조정 + class_weight 병행",
    interpretation:
      "- 학습손실과 평가지표를 목적에 맞춰 정렬 — MSE 학습·MAE 평가 같은 혼용은 이상치에서 손해\n- MSE는 이상치 1건에 끌려감(예제에서 MSE 2,600여 배 폭증, MAE는 20배 미만) — '모델이 나쁘다'가 아니라 '손실이 그 점에 끌려간다'로 해석\n- 분위수 q=0.9 선은 '관측의 약 90%가 아래'라는 뜻(고정 배수 아님, 이분산이면 부챗살로 벌어짐) — deviance는 상대 비교용, D²는 1에 가까울수록 좋고 음수면 평균예측만 못함\n- 이론 임계값 t*=c_FP/(c_FP+c_FN)은 확률 보정(calibration) 전제 — 실무는 검증셋 총비용 격자 탐색으로 결정, 임계값 이동 시 오탐 증가(심사 부하)도 함께 보고",
  },

  /* ─────────────────────────── 머신러닝 (ml) ─────────────────────────── */
  "decision-tree": {
    definition: "의사결정나무는 데이터를 예/아니오 질문으로 반복 분할해 최대한 한쪽 답만 남는 순수한 그룹을 만들어 가는 비모수 방법입니다.\n\n- 분할 기준: 지니·엔트로피 불순도의 감소량(ΔI)이 최대인 (변수, 기준값) 선택\n- 스케일링·더미변수 불필요, 단조 변환(로그 등)에 결과 불변\n- 회귀는 잎의 평균으로 예측(오차제곱합 최소 분할)",
    formulas: [
      {
        label: "지니 불순도",
        tex: "G(t) = 1 - \\sum_{k} p_{k}^{2}",
        note: "p_k = 노드 t에서 클래스 k의 비율. 한 클래스만 남으면 0(완전 순수), 반반 섞이면 최대.",
      },
      {
        label: "엔트로피",
        tex: "H(t) = -\\sum_{k} p_{k} \\log_{2} p_{k}",
        note: "지니의 대안 기준(criterion='entropy'). 실무 성능 차이는 크지 않습니다.",
      },
      {
        label: "분할 이득(불순도 감소)",
        tex: "\\Delta I = I(t) - \\frac{n_{L}}{n} I(t_{L}) - \\frac{n_{R}}{n} I(t_{R})",
        note: "I = 지니 또는 엔트로피, n_L·n_R = 좌/우 자식 노드의 표본 수. ΔI가 최대인 (변수, 기준값)을 선택.",
      },
      {
        label: "비용-복잡도 가지치기",
        tex: "R_{\\alpha}(T) = R(T) + \\alpha \\, |\\tilde{T}|",
        note: "R(T) = 나무의 오분류(오차) 비용, |T̃| = 잎 노드 수, α = ccp_alpha. α가 클수록 작은 나무를 선호.",
      },
    ],
    usage: "- '어떤 조건의 고객이 해지하는가'처럼 규칙 자체가 궁금할 때 사용\n- 보험 실무: 깊이 3~4 나무로 '가입 12개월 미만+보험료 인상 그룹 해지율 40%' 같은 세그먼트 규칙 추출\n- 언더라이팅 심사 기준 초안·청구 심사 우선순위 규칙 작성\n- 예측 정확도가 목적이면 랜덤포레스트·부스팅으로 이행",
    interpretation: "- 뿌리→잎 경로 하나 = if-then 규칙 하나, 잎의 클래스 비율 = 예측 확률\n- train·test 정확도 차이가 크면 과적합 — max_depth·min_samples_leaf 조정\n- 위쪽 분할 변수 ≠ 원인(상관된 대체 변수 가능), 구조가 불안정하니 규칙은 교차검증·다른 표본으로 재확인\n- 경계가 축 평행 계단형이라 매끄러운 관계는 비효율적으로 근사",
  },

  "random-forest": {
    definition: "랜덤포레스트는 부트스트랩 표본(배깅)과 무작위 변수 선택(max_features)으로 서로 다른 나무 수백 그루를 만들어 예측을 평균(분류는 투표)하는 앙상블입니다.\n\n- 나무 수 B↑ → 분산의 (1−ρ)σ²/B 항 소멸, max_features↓ → 나무 간 상관 ρ 감소\n- 부트스트랩에서 빠진 약 37% 표본으로 OOB '무료 검증' 가능",
    formulas: [
      {
        label: "앙상블 예측(회귀는 평균, 분류는 투표)",
        tex: "\\hat{f}(x) = \\frac{1}{B} \\sum_{b=1}^{B} T_{b}(x)",
        note: "B = 나무 수(n_estimators), T_b = b번째 부트스트랩 표본으로 학습한 나무.",
      },
      {
        label: "평균의 분산 감소",
        tex: "\\mathrm{Var}\\big(\\hat{f}(x)\\big) = \\rho \\sigma^{2} + \\frac{1-\\rho}{B} \\sigma^{2}",
        note: "σ² = 개별 나무의 분산, ρ = 나무 간 상관. B를 늘리면 둘째 항이 0으로, max_features를 줄이면 ρ가 작아져 첫째 항도 감소.",
      },
      {
        label: "OOB(out-of-bag) 확률",
        tex: "P(\\text{표본 } i \\notin \\text{부트스트랩}) = \\left(1 - \\tfrac{1}{n}\\right)^{n} \\approx e^{-1} \\approx 0.368",
        note: "각 나무는 표본의 약 37%를 안 씁니다. 이들로 계산한 oob_score가 별도 검증셋 없는 '무료 검증' 점수.",
      },
      {
        label: "불순도 기반 변수 중요도",
        tex: "\\mathrm{Imp}(x_{j}) = \\frac{1}{B} \\sum_{b} \\sum_{t \\in T_{b} : v(t)=j} \\Delta I(t)",
        note: "변수 j로 분할한 모든 노드의 불순도 감소량 합의 평균. 범주 수가 많은 변수에 과대평가되는 편향이 있음.",
      },
    ],
    usage: "- 튜닝 전에 믿을 만한 예측 성능부터 필요할 때의 범용 베이스라인\n- 보험 실무: 해지 예측에 n_estimators=500으로 ROC-AUC 기준선을 잡고 feature_importances_로 GLM·요율 변수 후보 선별\n- 청구 사기 탐지처럼 비선형·상호작용 많은 문제의 1차 스크리닝",
    interpretation: "- OOB 점수·test AUC로 성능 확인 — 나무 수를 늘려 나빠지지 않음(과적합은 개별 나무 복잡도에서)\n- 불순도 중요도는 범주 수 많은·연속형 변수에 과대평가 — permutation_importance로 교차 확인\n- 중요도 높음 ≠ 인과관계('예측에 쓸모 있다'는 뜻)\n- predict_proba 값은 치우칠 수 있어 요율·충당 판단에는 보정(calibration) 점검 필요",
  },

  "gradient-boosting": {
    definition: "그래디언트 부스팅은 나무를 순차로 추가하며 매번 '지금까지 틀린 부분'(의사잔차)을 다음 나무가 학습하게 하는, 함수 공간의 경사하강법입니다.\n\n- 랜덤포레스트=독립 나무 평균(분산↓), 부스팅=오차 겨냥 순차 보정(편향↓)\n- 손실함수를 바꿔 이진 분류(로그 손실)·건수(포아송) 등으로 확장, XGBoost·LightGBM이 대표 구현체",
    formulas: [
      {
        label: "가법 모델",
        tex: "F_{M}(x) = F_{0}(x) + \\sum_{m=1}^{M} \\nu \\, h_{m}(x)",
        note: "F_0 = 초기값(평균 등), h_m = m번째 나무, ν = 학습률(learning_rate), M = 나무 수.",
      },
      {
        label: "의사잔차(음의 기울기)",
        tex: "r_{im} = -\\left[ \\frac{\\partial L\\big(y_{i}, F(x_{i})\\big)}{\\partial F(x_{i})} \\right]_{F = F_{m-1}}",
        note: "m번째 나무의 학습 목표. 제곱 손실이면 r = y − F(x), 즉 보통의 잔차.",
      },
      {
        label: "축소(shrinkage) 갱신",
        tex: "F_{m}(x) = F_{m-1}(x) + \\nu \\, h_{m}(x), \\quad 0 < \\nu \\le 1",
        note: "ν를 낮출수록 한 걸음이 작아져 안정되지만 나무 수 M을 늘려야 함 — ν 0.03~0.1 + 조기 종료가 정석.",
      },
      {
        label: "정규화 목적함수(XGBoost)",
        tex: "\\mathrm{Obj} = \\sum_{i} L(y_{i}, \\hat{y}_{i}) + \\sum_{m} \\Omega(h_{m}), \\quad \\Omega(h) = \\gamma T + \\tfrac{1}{2} \\lambda \\lVert w \\rVert^{2}",
        note: "T = 잎 수, w = 잎 값. 나무 복잡도에 벌점을 줘 과적합을 구조적으로 억제.",
      },
    ],
    usage: "- 정형(표 형태) 데이터에서 예측력이 최우선일 때의 사실상 표준\n- 보험 실무: 해지 예측 GLM·랜덤포레스트 대비 AUC 상한 확인, 포아송 손실로 사고빈도 모델을 만들어 요율 GLM 벤치마크\n- 조기 종료(early stopping)와 함께 쓰는 것이 사실상 필수",
    interpretation: "- train 손실은 계속 내려가므로 무시 — 검증 곡선이 꺾이는 best_iteration 이후는 과적합 구간\n- learning_rate와 나무 수는 한 쌍: ν를 반으로 줄이면 나무는 약 두 배 필요(ν 0.03~0.1 + 조기 종료가 정석)\n- AUC 좋아도 확률이 정확한 건 아님(보정 확인), 변수 중요도는 인과가 아니라 기여도\n- 랜덤포레스트보다 하이퍼파라미터에 민감 — 조기 종료 켠 채 learning_rate·복잡도(num_leaves 등) 함께 조정",
  },

  svm: {
    definition: "SVM(서포트 벡터 머신)은 두 클래스 사이 여유 공간(마진)이 가장 넓은 경계면을 찾는 분류기로, 경계에 걸친 소수의 점(서포트 벡터)만이 경계를 결정합니다.\n\n- 소프트 마진: 오분류를 벌점으로 허용, 강도는 C가 조절\n- 커널 트릭(RBF 기본): 내적을 K(x, x′)로 대체해 비선형 경계 구현\n- 거리 기반이므로 변수 스케일링이 전제 조건",
    formulas: [
      {
        label: "결정함수와 예측",
        tex: "f(x) = w^{\\top} x + b, \\qquad \\hat{y} = \\mathrm{sign}\\big(f(x)\\big)",
        note: "w = 경계면의 법선 벡터, b = 절편. |f(x)|가 클수록 경계에서 멀다(확신이 크다).",
      },
      {
        label: "소프트 마진 최적화",
        tex: "\\min_{w, b, \\xi} \\; \\tfrac{1}{2} \\lVert w \\rVert^{2} + C \\sum_{i} \\xi_{i} \\quad \\text{s.t.} \\; y_{i}(w^{\\top} x_{i} + b) \\ge 1 - \\xi_{i}",
        note: "ξ_i = 마진 위반량, C = 위반 벌점 강도. C가 크면 훈련 데이터에 밀착(과적합 위험), 작으면 넓은 마진 우선.",
      },
      {
        label: "힌지 손실 관점",
        tex: "L = \\max\\big(0, \\; 1 - y \\, f(x)\\big)",
        note: "마진 안쪽·오분류만 벌점. 위 최적화는 '힌지 손실 + L2 정규화'와 동치 — 로지스틱(로그 손실)과의 차이점.",
      },
      {
        label: "RBF 커널",
        tex: "K(x, x') = \\exp\\big(-\\gamma \\lVert x - x' \\rVert^{2}\\big)",
        note: "γ가 클수록 가까운 점만 닮았다고 봐 경계가 국소적·복잡해짐(과적합 방향). 'scale' 기본값 권장.",
      },
      {
        label: "쌍대형 결정함수",
        tex: "f(x) = \\sum_{i \\in SV} \\alpha_{i} y_{i} K(x_{i}, x) + b",
        note: "α_i > 0인 점(서포트 벡터)만 합에 남음 — 경계가 소수의 점으로 결정된다는 사실이 식에 그대로 드러남.",
      },
    ],
    usage: "- 표본이 적고 변수가 많은 문제에 경쟁력 — 수만 건 이상 대용량은 트리 계열이 실용적\n- 보험 실무: 수천 건 수준 신규 상품의 언더라이팅 판정, 벡터화한 민원 텍스트 분류(linear 커널·LinearSVC로 충분한 경우 많음)\n- 튜닝은 C·gamma를 로그 스케일 그리드로 함께 탐색",
    interpretation: "- decision_function은 경계로부터의 부호 있는 거리이지 확률 아님 — 확률 필요 시 probability=True나 Platt 보정, AUC에는 그대로 충분\n- 스케일링 누락 시 단위 큰 변수(보험료 등)가 거리를 지배해 성능 붕괴 — 파이프라인으로 항상 묶기\n- 서포트 벡터 수가 표본의 대부분이면 과적합 신호(C·gamma 과대)",
  },

  knn: {
    definition: "KNN(k-최근접 이웃)은 새 데이터와 거리가 가장 가까운 학습 데이터 k개를 찾아 분류는 다수결, 회귀는 평균으로 답하는 '게으른(lazy) 학습'입니다.\n\n- 유일한 가정은 국소 매끄러움('가까우면 비슷하다') — 결과는 거리 척도와 k가 좌우\n- 거리 계산이 전부라 변수 스케일링 필수, 고차원에서는 차원의 저주에 취약",
    formulas: [
      {
        label: "민코프스키 거리",
        tex: "d(x, x') = \\left( \\sum_{j=1}^{p} \\lvert x_{j} - x'_{j} \\rvert^{q} \\right)^{1/q}",
        note: "q=2면 유클리드, q=1이면 맨해튼(sklearn의 p 파라미터). 스케일이 다른 변수가 섞이면 큰 변수가 거리를 지배.",
      },
      {
        label: "분류 — 국소 확률 추정",
        tex: "\\hat{p}(y = c \\mid x) = \\frac{1}{k} \\sum_{i \\in N_{k}(x)} \\mathbf{1}(y_{i} = c)",
        note: "N_k(x) = x의 최근접 이웃 k개. 이웃 중 클래스 c의 비율이 곧 예측 확률, 다수결이 곧 예측 클래스.",
      },
      {
        label: "거리 가중 예측(weights='distance')",
        tex: "\\hat{y}(x) = \\frac{\\sum_{i \\in N_{k}(x)} w_{i} \\, y_{i}}{\\sum_{i \\in N_{k}(x)} w_{i}}, \\qquad w_{i} = \\frac{1}{d(x, x_{i})}",
        note: "가까운 이웃일수록 큰 표. 데이터 밀도가 고르지 않을 때 uniform보다 유리한 경우가 많음.",
      },
    ],
    usage: "- 복잡한 모델 도입 전 성능 하한(베이스라인) 설정\n- 보험 실무: 프로파일(나이·보험료 등)이 비슷한 기존 계약 k건의 해지·청구 이력으로 신규 계약 위험 가늠(유사 사례 조회)\n- KNNImputer로 결측값 대치\n- k는 홀수로 동점 회피, 교차검증 곡선으로 선택",
    interpretation: "- k 작으면 과적합(k=1의 훈련 정확도 100%는 자기 자신이 이웃이기 때문), 크면 과소적합 — 교차검증 곡선 정점 부근에서 선택\n- 스케일링 없으면 단위 큰 변수만 보는 모델 — 파이프라인 필수\n- 예측 때마다 전체 거리 계산이라 느림(대량 실시간 스코어링 부적합)\n- 변수 수십 개 이상이면 차원의 저주로 성능 급락 — 변수 선택·차원 축소 먼저 고려",
  },

  "naive-bayes": {
    definition: "나이브 베이즈는 베이즈 정리로 클래스별 확률을 계산하되, '클래스가 정해지면 변수들은 서로 독립'이라는 조건부 독립 가정으로 결합확률을 변수별 확률의 곱으로 단순화한 분류기입니다.\n\n- 학습·예측이 매우 빠르고 적은 데이터로도 작동\n- 카운트(단어 빈도)=MultinomialNB, 연속형=GaussianNB",
    formulas: [
      {
        label: "베이즈 정리",
        tex: "P(C_k \\mid \\mathbf{x}) = \\frac{P(C_k)\\, P(\\mathbf{x} \\mid C_k)}{P(\\mathbf{x})}",
        note: "C_k = 클래스, x = 입력 변수 벡터, P(C_k) = 사전확률(학습 데이터의 클래스 비율)",
      },
      {
        label: "조건부 독립 가정",
        tex: "P(\\mathbf{x} \\mid C_k) = \\prod_{j=1}^{p} P(x_j \\mid C_k)",
        note: "p = 변수 개수 — 결합확률을 변수별 확률의 곱으로 단순화('나이브'라는 이름의 근원)",
      },
      {
        label: "분류 규칙",
        tex: "\\hat{y} = \\arg\\max_{k}\\; P(C_k) \\prod_{j=1}^{p} P(x_j \\mid C_k)",
        note: "사전확률 × 우도의 곱이 가장 큰 클래스를 선택 (실제 계산은 로그 합으로)",
      },
      {
        label: "라플라스 평활 (MultinomialNB)",
        tex: "\\hat{P}(x_j \\mid C_k) = \\frac{N_{jk} + \\alpha}{N_k + \\alpha\\, p}",
        note: "N_jk = 클래스 k에서 단어 j의 빈도, α = 평활 계수 — 학습에 없던 단어의 확률이 0이 되는 것을 방지",
      },
    ],
    usage: "- 라벨 있는 텍스트를 빠르게 분류할 때의 첫 베이스라인\n- 보험 실무: 민원 텍스트 유형 분류(지급 지연·불완전판매 등)·접수 문서 부서 라우팅·스팸 필터\n- TfidfVectorizer와 파이프라인으로 몇 줄에 완성",
    interpretation: "- classification_report의 클래스별 정밀도·재현율로 유형별 성능 확인\n- 독립 가정 탓에 확률 값은 0·1 근처로 과장 — 순위는 믿을 만하나 값은 보정(calibration) 후 사용\n- '확률 98%'를 그대로 업무 판단에 쓰지 말 것",
  },

  kmeans: {
    definition: "K-평균은 라벨 없는 데이터를 서로 가까운 점끼리 k개의 군집으로 나누는 비지도 학습입니다.\n\n- 반복: ① 각 점을 가장 가까운 중심에 배정 ② 배정된 점들의 평균으로 중심 갱신 — 군집 내 거리 제곱합(관성) 최소화 방향으로 수렴\n- 유클리드 거리 기반 — 변수 스케일링이 사실상 전제 조건\n- 군집이 공 모양·비슷한 크기라는 암묵적 가정",
    formulas: [
      {
        label: "목적함수(관성, inertia)",
        tex: "J = \\sum_{i=1}^{k} \\sum_{x \\in S_i} \\lVert x - \\mu_i \\rVert^2",
        note: "S_i = i번째 군집, μ_i = 군집 중심 — 군집 내 거리 제곱합을 최소화",
      },
      {
        label: "중심 갱신",
        tex: "\\mu_i = \\frac{1}{|S_i|} \\sum_{x \\in S_i} x",
        note: "배정된 점들의 평균이 새 중심 — '평균(means)'이라는 이름의 근원",
      },
      {
        label: "실루엣 계수",
        tex: "s(i) = \\frac{b(i) - a(i)}{\\max\\{a(i),\\, b(i)\\}}",
        note: "a = 같은 군집 내 평균거리, b = 가장 가까운 다른 군집까지의 평균거리 — 1에 가까울수록 잘 뭉침, k 선택의 근거",
      },
    ],
    usage: "- '고객이 몇 가지 유형으로 나뉘는가' 같은 탐색 질문에 사용\n- 보험 실무: 연령·보험료·보유계약수·유지기간으로 고객 세분화, 포트폴리오를 위험 특성별로 묶기\n- k는 알고리즘이 정해주지 않음 — 엘보(관성 감소 둔화 지점)·실루엣 점수를 함께 보고 선택",
    interpretation: "- 군집 번호 자체는 무의미 — 군집별 평균 프로파일로 '고연령·고보험료 장기고객'처럼 업무 언어로 명명해야 쓸모\n- 군집은 자연 집단의 '발견'이 아니라 편의적 '요약'\n- 초기값에 따라 결과가 달라짐 — random_state 고정·n_init 반복으로 안정성 확인",
  },

  hierarchical: {
    definition: "계층적 군집(응집형)은 각 점을 군집 하나로 시작해 가장 가까운 군집 쌍을 차례로 병합하고, 그 이력을 덴드로그램으로 남기는 방법입니다.\n\n- 덴드로그램을 적절한 높이에서 잘라 군집 수를 사후 결정 — k를 미리 정하는 K-평균과 보완 관계\n- 연결법(linkage) = 군집 간 거리 정의: ward(분산 증가 최소)·average(평균)·complete(최대)·single(최소, 사슬 현상 주의)",
    formulas: [
      {
        label: "Ward 병합 비용",
        tex: "\\Delta(A, B) = \\frac{|A|\\,|B|}{|A| + |B|}\\, \\lVert \\mu_A - \\mu_B \\rVert^2",
        note: "두 군집 A·B를 합칠 때 군집 내 제곱합이 늘어나는 양 — 증가량이 가장 작은 쌍부터 병합",
      },
      {
        label: "단일·완전 연결",
        tex: "d_{\\min}(A,B) = \\min_{a \\in A,\\, b \\in B} d(a,b), \\qquad d_{\\max}(A,B) = \\max_{a \\in A,\\, b \\in B} d(a,b)",
        note: "single = 가장 가까운 쌍 기준(사슬처럼 늘어질 수 있음), complete = 가장 먼 쌍 기준(촘촘한 군집)",
      },
      {
        label: "평균 연결",
        tex: "d_{\\mathrm{avg}}(A,B) = \\frac{1}{|A|\\,|B|} \\sum_{a \\in A} \\sum_{b \\in B} d(a,b)",
        note: "모든 쌍 거리의 평균 — single과 complete의 절충",
      },
    ],
    usage: "- 군집 수를 미리 정하기 어렵거나 데이터의 '묶임 구조' 자체를 보고 싶을 때\n- 보험 실무: K-평균 전에 덴드로그램으로 군집 수 가늠, 상품·판매채널 수십 개를 유사 특성끼리 묶어 분류 체계 작성\n- 모든 쌍의 거리를 계산 — 수천 건 이상은 표본으로 구조 확인 후 K-평균으로 확정하는 절충이 실용적",
    interpretation: "- 세로로 '긴 가지' = 먼 군집이 늦게 합쳐진 것 — 긴 가지 아래에서 자르면 자연스러운 군집 수\n- 연결법에 따라 결과가 크게 달라짐(ward는 유클리드 거리 전용)\n- 잘라낸 군집도 프로파일링으로 업무 의미를 부여해야 실무 활용 가능",
  },

  pca: {
    definition: "주성분분석(PCA)은 상관된 여러 변수를 분산(정보량)이 큰 방향부터 잡은 직교 축(주성분)으로 바꿔, 앞의 몇 축만 남겨 차원을 줄이는 방법입니다.\n\n- 수학적으로는 공분산(상관)행렬의 고유분해 — 고유벡터=축 방향, 고유값=그 축이 담은 분산\n- 분산 기반이라 스케일링 전제, 원 변수의 선형결합만 표현(비선형 구조는 못 잡음)",
    formulas: [
      {
        label: "공분산행렬 고유분해",
        tex: "\\Sigma\\, v_j = \\lambda_j\\, v_j",
        note: "Σ = 공분산행렬, v_j = j번째 주성분 방향(고유벡터), λ_j = 그 축이 담은 분산(고유값)",
      },
      {
        label: "제1주성분의 정의",
        tex: "v_1 = \\arg\\max_{\\lVert v \\rVert = 1} \\operatorname{Var}(v^{\\top} x)",
        note: "데이터의 분산을 가장 크게 하는 단위 방향 — 이후 성분은 앞 성분과 직교 조건 하에 같은 기준",
      },
      {
        label: "주성분 점수",
        tex: "z_{ij} = v_j^{\\top} (x_i - \\bar{x})",
        note: "관측 i를 j번째 축에 투영한 좌표 — 새로 만들어진 변수 값",
      },
      {
        label: "설명분산 비율",
        tex: "\\frac{\\lambda_j}{\\sum_{l=1}^{p} \\lambda_l}",
        note: "j번째 성분이 전체 분산에서 차지하는 비율 — 누적 80~90%를 성분 수 선택의 관례로",
      },
    ],
    usage: "- 변수 수십 개를 2~3축으로 압축해 시각화, 회귀 전 다중공선성 해소 전처리\n- 보험 실무: 계약자 특성 변수를 '종합 규모 축'·'위험 성향 축'으로 요약해 세분화·이상 계약 탐지\n- 학습 데이터에만 fit, 신규 데이터는 transform만(정보 누수 방지)",
    interpretation: "- 로딩(원 변수 계수)으로 축 해석 — 같은 부호로 고르게 실리면 '종합 크기 축', 부호가 갈리면 '대비 축'\n- 성분 수는 누적 설명분산 80~90%가 관례\n- 설명분산 큰 축이 예측에도 유용하다는 보장 없음(목표변수를 안 보는 비지도)\n- 주성분 부호는 임의(환경 따라 뒤집힘) — 부호의 상대적 패턴으로 해석",
  },

  "cross-validation": {
    definition: "교차검증은 데이터를 k조각(폴드)으로 나눠 매번 한 조각을 검증용으로 빼고 학습하기를 k번 반복해, 성능을 평균 ± 표준편차로 보고하는 절차입니다.\n\n- 한 번의 train/test 분할이 갖는 '운' 문제 해소 — 모든 데이터가 한 번씩 검증에 사용\n- 전제는 폴드 간 독립: 같은 고객 계약이 여러 행이면 GroupKFold, 시계열이면 TimeSeriesSplit(과거 학습→미래 검증)",
    formulas: [
      {
        label: "k-겹 교차검증 추정치",
        tex: "\\widehat{\\mathrm{CV}} = \\frac{1}{k} \\sum_{i=1}^{k} L\\big(\\hat{f}^{(-i)},\\, D_i\\big)",
        note: "f̂^(−i) = i번째 폴드를 빼고 학습한 모델, D_i = i번째 폴드, L = 평가지표(AUC·RMSE 등)",
      },
      {
        label: "보고 형식",
        tex: "\\bar{s} \\pm \\mathrm{sd}(s_1, \\dots, s_k)",
        note: "폴드별 점수의 평균과 표준편차를 함께 — 변동 폭이 곧 추정의 불확실성",
      },
      {
        label: "하이퍼파라미터 탐색",
        tex: "\\hat{\\theta} = \\arg\\max_{\\theta \\in \\Theta} \\widehat{\\mathrm{CV}}(\\theta)",
        note: "후보 격자 Θ의 각 조합을 교차검증 점수로 평가해 최적을 고름 — GridSearchCV의 원리",
      },
    ],
    usage: "- '이 성능 수치를 믿어도 되는가'가 걸린 모든 곳 — 해지 예측 AUC 보고, 후보 모델 비교, GridSearchCV 튜닝\n- 최종 평가용 test는 처음에 떼어 봉인, 교차검증은 남은 학습 데이터 안에서만\n- 스케일링·인코딩은 Pipeline에 넣어 폴드마다 재학습(누수 방지)",
    interpretation: "- 평균과 표준편차를 함께 읽기 — 폴드 간 편차가 크면 데이터 부족·모델 불안정 신호\n- 튜닝에 쓴 CV 점수는 후보 중 최댓값이라 낙관 편향 — 최종 성능은 봉인한 test나 중첩 교차검증으로 확인\n- 전처리를 폴드 밖에서 미리 하면(전체 데이터 스케일링 등) 성능이 부풀려짐",
  },

  "model-eval": {
    definition: "모델 평가 지표는 문제에 맞는 '자'를 고르는 일입니다.\n\n- 분류: 혼동행렬(TP·FP·FN·TN) → 정밀도·재현율·F1, 임계값 무관 종합 지표는 ROC-AUC\n- 회귀: 오차 크기 RMSE·MAE + 설명력 R²\n- 전제: 평가 데이터가 학습에 미사용(누수 없음)·적용 대상을 대표 — 이 전제가 무너질 때 숫자가 가장 크게 왜곡",
    formulas: [
      {
        label: "정밀도",
        tex: "\\mathrm{Precision} = \\frac{TP}{TP + FP}",
        note: "'해지라고 예측한 것 중 실제 해지 비율' — 오탐(FP) 비용이 클 때 중시",
      },
      {
        label: "재현율",
        tex: "\\mathrm{Recall} = \\frac{TP}{TP + FN}",
        note: "'실제 해지 중 잡아낸 비율' — 놓침(FN) 비용이 클 때 중시",
      },
      {
        label: "F1 점수",
        tex: "F_1 = \\frac{2\\, P R}{P + R}",
        note: "정밀도(P)와 재현율(R)의 조화평균 — 둘 다 좋아야 높아짐",
      },
      {
        label: "ROC-AUC",
        tex: "\\mathrm{AUC} = P\\big(\\hat{s}_{+} > \\hat{s}_{-}\\big)",
        note: "무작위 양성의 예측 점수가 무작위 음성보다 높을 확률 — 0.5 = 무작위, 1 = 완벽한 순위",
      },
      {
        label: "RMSE",
        tex: "\\mathrm{RMSE} = \\sqrt{\\frac{1}{n} \\sum_{i=1}^{n} (y_i - \\hat{y}_i)^2}",
        note: "제곱 때문에 큰 오차에 민감 — 목표변수와 같은 단위(원)로 읽힘",
      },
      {
        label: "결정계수 R²",
        tex: "R^2 = 1 - \\frac{\\sum_i (y_i - \\hat{y}_i)^2}{\\sum_i (y_i - \\bar{y})^2}",
        note: "'평균으로 찍기' 대비 오차를 얼마나 줄였나 — 1에 가까울수록 설명력 높음",
      },
    ],
    usage: "- 놓침(FN) 비용 큰 문제(해지 예측)는 재현율 중심, 오탐(FP) 비용 큰 문제(마케팅 발송)는 정밀도 중심\n- 회귀(보험금 예측)는 원 단위로 읽히는 RMSE·MAE 병행 보고\n- 불균형(해지율 5% 등)에서는 accuracy 대신 ROC-AUC·PR-AUC·F1 필수",
    interpretation: "- 착시 주의: 해지율 5%면 '전부 유지'만 답해도 accuracy 95% — 정확도 높다고 좋은 모델 아님\n- 정밀도↔재현율은 임계값에 따라 반대로 움직임 — 업무 비용에 맞는 임계값을 따로 결정\n- ROC-AUC는 순위 능력만 측정(확률 보정은 별개), 심한 불균형에서는 PR-AUC가 더 민감",
  },
  imbalanced: {
    definition:
      "불균형 데이터는 양성 클래스(사기·희귀사고·조기해지)가 전체의 극히 일부(예: 5%)인 분류 문제로, 전부 음성 예측만으로 정확도가 1−양성비율(95%)에 이르러 표준 학습이 소수 클래스를 무시하게 됩니다.\n\n- 알고리즘 층위: class_weight·sample_weight로 양성 오분류에 큰 벌점(비용민감 학습)\n- 결정 층위: 임계값 t를 0.5가 아닌 값으로 옮겨 재현율·정밀도 작동점 선택\n- 데이터 층위: 소수 오버샘플·다수 언더샘플로 훈련 분포 재조정\n- 평가는 accuracy 대신 재현율·정밀도·PR-AUC로",
    formulas: [
      {
        label: "재현율·정밀도(혼동행렬)",
        tex: "\\mathrm{Recall} = \\frac{TP}{TP + FN}, \\qquad \\mathrm{Precision} = \\frac{TP}{TP + FP}",
        note: "재현율=실제 양성 중 잡아낸 비율, 정밀도=양성이라 예측한 것 중 맞춘 비율. 불균형에서 accuracy 대신 보는 핵심 쌍.",
      },
      {
        label: "PR-AUC(평균정밀도)",
        tex: "\\mathrm{AP} = \\sum_{k} \\big(R_k - R_{k-1}\\big)\\, P_k",
        note: "재현율 증가분을 정밀도로 가중한 합 — 찍기 기준선은 양성 비율 π. 심한 불균형에서 ROC-AUC보다 민감.",
      },
      {
        label: "균형 클래스 가중",
        tex: "w_c = \\frac{n}{K \\, n_c}",
        note: "class_weight='balanced': n=총 표본, K=클래스 수, n_c=클래스 c 표본 수. 드문 클래스일수록 가중이 커짐.",
      },
      {
        label: "비용 최소 임계값",
        tex: "t^{\\star} = \\arg\\min_{t}\\; \\big[\\, C_{FN}\\, \\mathrm{FN}(t) + C_{FP}\\, \\mathrm{FP}(t) \\,\\big]",
        note: "미탐 비용 C_FN, 오탐 비용 C_FP. 이론상 최적 컷오프는 t*=C_FP/(C_FP+C_FN)로, C_FN이 크면 0.5보다 낮아짐.",
      },
    ],
    usage:
      "- 사기 청구 적발(FDS)·조기 해지 예측·고액 희귀 사고 스크리닝에 표준 적용\n- 조사 인력이 한정되면 예산 내 조사 건수에 맞춰 임계값 설정(상위 위험군 우선)\n- 해지 방어 마케팅은 놓친 해지(FN) 손실·불필요 발송(FP) 비용으로 총비용 최소 컷오프 계산\n- sklearn의 class_weight·resample·predict_proba 임계값 조정만으로 구성 가능(별도 패키지 불요)",
    interpretation:
      "- 양성 5%면 전부 음성 예측이 accuracy 95% — 정확도는 사실상 무의미, 재현율·PR-AUC로 대체\n- 가중·리샘플링은 순위(PR-AUC·ROC-AUC)보다 0.5 임계값의 작동점을 옮기는 효과 — 임계값·비용 조정과 같은 목적\n- 리샘플·가중은 훈련셋에만, 평가셋은 원래 불균형 그대로(폴드 분할 전에 리샘플하면 누수). 훈련 분포를 바꾸면 확률 보정이 깨져 요율·준비금엔 사후 보정 필요\n- 권장 순서: 평가지표 교체 → 임계값·비용 최적화 → (부족하면) 리샘플링(언더샘플=분산↑, 단순 오버샘플=과적합·과신)",
  },
  calibration: {
    definition:
      "확률 캘리브레이션(보정)은 모델이 예측한 확률 p인 사건들이 실제로 약 p 비율로 일어나는지를 다룹니다 — 순위만 보는 판별력(AUC)과 별개 성질로, 순위가 완벽해도 확률은 과신(0·1로 과장)·과소평가될 수 있습니다.\n\n- 진단 ①: 캘리브레이션 곡선 — 구간별 평균 예측확률(가로) vs 실제 비율(세로), 완벽하면 45° 대각선\n- 진단 ②: Brier 점수 — 예측확률과 0/1 실제값의 평균제곱오차(낮을수록 좋음)\n- 교정: isotonic(비모수 단조)·sigmoid(Platt 로지스틱) 사후 재조정",
    formulas: [
      {
        label: "완벽한 보정(정의)",
        tex: "P\\left(Y=1 \\mid \\hat{p}(X)=p\\right) = p \\quad \\forall\\, p \\in [0,1]",
        note: "확률 p라고 예측한 대상들의 실제 사건 비율이 정확히 p — 캘리브레이션 곡선이 45°선과 일치하는 조건.",
      },
      {
        label: "Brier 점수",
        tex: "\\mathrm{BS} = \\frac{1}{n}\\sum_{i=1}^{n}\\left(\\hat{p}_i - y_i\\right)^2",
        note: "예측확률과 실제 0/1의 평균제곱오차. 0에 가까울수록 좋고, 항상 맞히면 0.",
      },
      {
        label: "캘리브레이션 곡선(구간별)",
        tex: "\\bar{p}_b = \\frac{1}{|B_b|}\\sum_{i \\in B_b}\\hat{p}_i, \\qquad \\bar{y}_b = \\frac{1}{|B_b|}\\sum_{i \\in B_b} y_i",
        note: "구간 B_b의 평균 예측확률(가로)과 실제 빈도(세로). 점(p̄_b, ȳ_b)이 45°선 아래면 과신.",
      },
      {
        label: "기대손해(요율 연결)",
        tex: "\\mathbb{E}[L] = \\hat{p}\\cdot s, \\qquad L_{\\text{port}} = \\sum_{i=1}^{n}\\hat{p}_i\\, s_i",
        note: "순수보험료 = 사고확률 × 심도 s. 확률이 과신이면 포트폴리오 합계 L_port가 실제 총손해와 어긋남.",
      },
      {
        label: "Platt(sigmoid) 재보정",
        tex: "\\hat{p}_{\\text{cal}} = \\dfrac{1}{1 + \\exp\\!\\left(a\\, f(x) + b\\right)}",
        note: "원 점수 f(x)를 로지스틱으로 다시 눌러 확률을 교정 — a, b는 보정용 데이터에서 학습.",
      },
    ],
    usage:
      "- 확률 값 자체가 의사결정에 들어가는 모든 곳 — 요율(기대손해=사고확률×심도)·언더라이팅·준비금\n- 절차: 확률 모델 학습 → calibration_curve·Brier로 진단 → 과신이면 CalibratedClassifierCV(isotonic/sigmoid)로 재보정\n- 트리 기반·나이브 베이즈처럼 확률이 극단으로 치우치는 모델일수록 중요",
    interpretation:
      "- 곡선이 45°선 아래면 과신(실제 빈도 < 예측 확률) → 요율 과다 책정, 위면 과소평가 → 요율 부족. AUC 높아도 별개로 존재\n- 재보정은 순위(AUC)를 거의 안 바꿈 — 판별력 부족을 보정으로 못 고침\n- 교정 함수는 학습에 안 쓴 데이터(교차검증·별도 보정셋)로 적합해야 낙관 편향 회피\n- isotonic은 유연하나 소표본 과적합 위험, sigmoid는 안정적이나 잔여 편향 가능. Brier는 보정+판별력 혼합 지표 — 곡선과 함께 해석",
  },
  anomaly: {
    definition:
      "이상치 탐지는 라벨 없이 다수와 이질적인 관측을 골라내는 비지도 학습으로, '먼저 들여다볼 건'의 우선순위를 매기는 스크리닝 도구입니다.\n\n- IsolationForest: 무작위 분할에서 빨리 고립되는 점(짧은 평균 경로)=이상 — 전역 이상\n- LOF: 국소 밀도를 이웃과 비교해 주변보다 유독 성긴 점을 탐지 — 국소 이상\n- EllipticEnvelope: 다변량 정규(타원) 가정, 마할라노비스 거리가 먼 점 판정 — 모수적",
    formulas: [
      {
        label: "IsolationForest 이상 점수",
        tex: "s(x) = 2^{-\\,\\mathbb{E}[h(x)] / c(n)}",
        note: "h(x)=트리에서 x의 경로 길이, c(n)=평균 경로 길이 정규화 상수. 경로가 짧을수록 s→1(이상), 길수록 s→0(정상).",
      },
      {
        label: "LOF(국소 이상 계수)",
        tex: "\\mathrm{LOF}_k(p) = \\frac{1}{|N_k(p)|} \\sum_{o \\in N_k(p)} \\frac{\\mathrm{lrd}_k(o)}{\\mathrm{lrd}_k(p)}",
        note: "N_k(p)=p의 k-최근접 이웃, lrd=국소 도달가능 밀도. 1에 가까우면 정상, 1보다 크게 클수록(이웃보다 성김) 이상.",
      },
      {
        label: "마할라노비스 거리(EllipticEnvelope)",
        tex: "D^2(x) = (x - \\hat{\\mu})^{\\top} \\hat{\\Sigma}^{-1} (x - \\hat{\\mu})",
        note: "μ̂·Σ̂는 이상치에 강건한 추정(MCD). D²가 크면 타원 중심에서 멀어 이상. contamination 비율만큼 상위 D²를 이상으로 컷.",
      },
      {
        label: "라벨이 있을 때 순위 검증 — 상위 k 정밀도",
        tex: "\\mathrm{precision@}k = \\frac{1}{k} \\sum_{i \\in \\text{Top-}k} \\mathbf{1}(y_i = 1)",
        note: "이상 점수 상위 k건 중 실제 양성 비율. 심사 예산이 유한할 때 ROC-AUC·PR-AUC와 함께 실무 성능을 재는 지표.",
      },
    ],
    usage:
      "- 비정상 청구·사기 심사의 1차 스크리닝 — 예: 손해액·처리일수 변수로 IsolationForest contamination=0.05, 상위 이상 점수 건을 우선 검토 목록화\n- 실시간 감시는 정상 데이터로 학습한 LOF(novelty=True)·IsolationForest 재사용\n- 방법별 강약이 달라(전역/국소/타원 가정) 여러 결과를 비교해 합의되는 건을 신뢰",
    interpretation:
      "- 통계적 '이상' ≠ '사기' — 최종 판단은 도메인 검토 필수, 자동 지급 거절에 단독 사용 금지\n- 라벨 일부 있으면 ROC-AUC·PR-AUC(양성 비율 기준선과 비교)·precision@k로 순위 성능 검증\n- 라벨 없으면 상위 건의 도메인 납득성 검토 + contamination 변화에 대한 안정성 확인이 유일한 검증\n- contamination 과대 시 정상 대량 오탐, 스케일 다르면 거리 기반 LOF·EllipticEnvelope가 큰 값 변수에 휘둘림(표준화 권장)",
  },

  /* ─────────────────────────── 보험·계리 (actuarial) ─────────────────────────── */
  "exposure-rates": {
    definition: "관찰 경험을 사망수 D와 노출 E로 요약해 조발생률 D/E를 구하는 위험률 산출의 첫 단계입니다.\n\n- 중앙노출 E^c → 중앙사망률 mx / 초기노출 E^i(사망자 1년 인정) → qx 직접 추정\n- 신뢰구간은 포아송 정확(exact) 구간이 표준 — 소수 사망 셀의 정규근사는 부정확",
    formulas: [
      {
        label: "중앙사망률(조발생률)",
        tex: "\\hat{m}_x = \\frac{D_x}{E^{c}_x}",
        note: "E^c = 중앙노출(실제 관찰연수의 합) — 사력 μ에 대응하는 추정치",
      },
      {
        label: "조사망률",
        tex: "\\hat{q}_x = \\frac{D_x}{E^{i}_x}",
        note: "E^i = 초기노출(사망자는 보험연도 말까지 1년 인정하는 전통 규칙)",
      },
      {
        label: "qx–mx 환산",
        tex: "q_x \\approx \\frac{m_x}{1+\\tfrac{1}{2}m_x}, \\qquad q_x = 1 - e^{-m_x}",
        note: "앞은 연내 균등사망(UDD) 가정, 뒤는 상수사력 가정",
      },
      {
        label: "포아송 정확 신뢰구간(사망률)",
        tex: "\\left[\\, \\frac{\\chi^2_{\\alpha/2}(2D)}{2E},\\; \\frac{\\chi^2_{1-\\alpha/2}(2D+2)}{2E} \\,\\right]",
        note: "χ²(k)는 자유도 k인 카이제곱 분위수. D=0이면 하한은 0",
      },
      {
        label: "A/E 비율과 기대사망",
        tex: "\\mathrm{A/E} = \\frac{D}{\\sum_i E_i \\, q^{\\mathrm{ref}}_{x_i}}",
        note: "기대사망 = 셀별 노출×참조율의 합 — qx 기준이면 초기노출과 짝을 맞춘다",
      },
    ],
    usage: "- 계약 원장을 보험연도로 분할해 노출 집계 → 연령대별 조발생률 산출\n- 참조순보험요율·경험생명표와 A/E 비교 — 요율 적정성·IFRS17 가정 검증의 표준 절차\n- A/E 신뢰구간이 1을 벗어나는지가 참조율 대신 경험률을 반영할 통계적 근거",
    interpretation: "- A/E 구간이 1을 포함하지 않으면 경험률≠참조율 — 유의하게 높으면 보험료·준비금 과소평가 위험\n- 짝 맞추기: 초기노출↔qx, 중앙노출↔mx — 어긋나면 A/E가 체계적으로 틀어짐\n- 전체 A/E만 보지 말 것 — 믹스 효과 탓에 연령·성별·경과별 분해 필수\n- IBNR 미반영 시 최근 연도 A/E 과소, 소수 사망 셀 요철은 대부분 노이즈 — 보정·신뢰도 단계로 연결",
  },

  graduation: {
    definition: "위험률 보정(graduation)은 연령별 조(粗)발생률의 확률 노이즈를 걷어내 매끈한 위험률 곡선을 얻는 기법입니다.\n\n- Whittaker-Henderson: 적합도(노출 가중 제곱합)+평활도(z차 차분 제곱합, 관례 z=2·3)를 상수 h로 절충\n- 목적함수가 2차식이라 선형계 한 번의 닫힌 해 — 반복·초기값 불요",
    formulas: [
      {
        label: "조발생률",
        tex: "\\hat{m}_x = \\frac{D_x}{E^{c}_x}",
        note: "Dₓ = 연령 x의 사망(사건) 수, E^cₓ = 중앙 노출(경과 계약년수) — 중앙노출로 나눈 값은 사력에 대응하는 중앙사망률 m̂ₓ이지 사망확률 q̂ₓ가 아닙니다. 보정의 입력 vₓ가 되는 값. q̂ₓ를 보정하려면 초기노출 E^iₓ로 나누거나, [위험률 산출]의 qₓ–mₓ 환산식을 먼저 적용해 기준을 맞추세요.",
      },
      {
        label: "WH 목적함수",
        tex: "M(u) = \\sum_x w_x\\,(v_x - u_x)^2 \\; + \\; h \\sum_x \\big(\\Delta^z u_x\\big)^2",
        note: "첫 항 = 적합도(원자료 밀착), 둘째 항 = 평활도. h가 클수록 매끈함 우선. 관례 z = 2, 3.",
      },
      {
        label: "3차 차분(z=3)",
        tex: "\\Delta^3 u_x = u_{x+3} - 3u_{x+2} + 3u_{x+1} - u_x",
        note: "차분행렬 D의 각 행 [-1, 3, -3, 1] — numpy로는 항등행렬에 np.diff를 3번 적용해 만든다.",
      },
      {
        label: "닫힌 해(선형계)",
        tex: "(W + h\\,D^{\\top} D)\\,\\mathbf{u} = W\\,\\mathbf{v}",
        note: "W = diag(wₓ). ∂M/∂u = 0에서 유도 — np.linalg.solve 한 번이면 끝.",
      },
      {
        label: "Gompertz 사망법칙",
        tex: "q_x \\approx a\\,e^{b x}",
        note: "중·고연령 사망률의 표준 근사 — 로그축에서 직선. 보정 결과 검토용 기준 곡선.",
      },
    ],
    usage: "- 경험생명표·질병발생률·해지율 등 연령별 율 산출의 마지막 손질 — 조발생률→보정→검수가 표준 흐름\n- h는 자료 스케일 의존 — 여러 값(예: 1·100·10000)의 적합도·평활도·잔차를 비교해 선택\n- 이동평균은 끝단 결손·상향 편향, WH는 끝단까지 곡률 보존(평활 스플라인이 대안)",
    interpretation: "- h 작으면 과소평활(노이즈 잔존), 크면 과잉평활 — 고연령 지수 증가를 깎아 보험료 부족 직결\n- h 선택은 잔차 부호 런·연령대별 A/E·로그축 육안 검토 병행 — h 값 자체는 무의미\n- 단조 증가 비보장 — 보정 후 np.diff(u)>0 확인, 위반 시 h↑ 또는 단조 회귀(PAVA)\n- 노이즈 제거 도구일 뿐 — 계통 편향(진단 트렌드·언더라이팅 변화)은 못 없앰",
  },

  "kaplan-meier": {
    definition: "Kaplan-Meier는 중도절단(해지·만기 등)이 있는 자료에서 생존함수 S(t)=P(T>t)를 조건부 생존확률의 곱 Π(1−dᵢ/nᵢ)로 추정합니다.\n\n- 절단 계약도 절단 시점까지 위험집합 nᵢ에 포함 — 버리면 사망률 왜곡\n- Nelson-Aalen(누적위험 H=Σdᵢ/nᵢ, S=exp(−H))·log-rank(집단 차이 검정)가 짝 도구",
    formulas: [
      {
        label: "Kaplan-Meier 생존함수 추정량",
        tex: "\\hat{S}(t) = \\prod_{t_i \\le t} \\left( 1 - \\frac{d_i}{n_i} \\right)",
        note: "tᵢ = 사건(사망)이 발생한 고유 시점, dᵢ = 그 시점 사망 수, nᵢ = 직전까지의 위험집합 크기. 절단만 있는 시점에서는 곱해지는 항이 없어 곡선이 내려가지 않습니다.",
      },
      {
        label: "Greenwood 분산 (95% CI = Ŝ ± 1.96·SE)",
        tex: "\\widehat{\\operatorname{Var}}\\big[\\hat{S}(t)\\big] = \\hat{S}(t)^{2} \\sum_{t_i \\le t} \\frac{d_i}{n_i\\,(n_i - d_i)}",
        note: "위험집합 nᵢ가 얇아지는 관찰 후반일수록 항이 커져 구간이 급격히 넓어집니다. 구간이 [0,1]을 벗어나면 클리핑하거나 log(−log) 변환 구간을 사용합니다.",
      },
      {
        label: "Nelson-Aalen 누적위험과 생존함수 근사",
        tex: "\\hat{H}(t) = \\sum_{t_i \\le t} \\frac{d_i}{n_i}, \\qquad \\tilde{S}(t) = e^{-\\hat{H}(t)} \\ge \\hat{S}_{KM}(t)",
        note: "1−x ≤ e⁻ˣ이므로 exp(−H)는 KM보다 항상 크거나 같고, 표본이 충분하면 거의 일치합니다. 상수위험(지수분포)이면 H(t)가 직선이 됩니다.",
      },
      {
        label: "log-rank 기대사건수와 분산 (시점 j 합산)",
        tex: "E_1 = \\sum_j d_j \\frac{n_{1j}}{n_j}, \\qquad V = \\sum_j \\frac{d_j\\,(n_j - d_j)\\,n_{1j}\\,n_{0j}}{n_j^{2}\\,(n_j - 1)}",
        note: "각 사건시점에서 'H0(두 그룹 위험 동일)라면 그룹1에서 몇 건 죽었어야 하나'를 초기하분포로 계산해 전 시점을 합산합니다.",
      },
      {
        label: "log-rank 검정통계량",
        tex: "\\chi^{2} = \\frac{(O_1 - E_1)^{2}}{V} \\;\\overset{H_0}{\\sim}\\; \\chi^{2}_{(1)}",
        note: "O₁ = 그룹1의 실제 관측 사건수. p값은 χ²(1)의 오른쪽 꼬리 확률(scipy.stats.chi2.sf)로 계산합니다.",
      },
    ],
    usage: "- 조사망률 패턴 확인·월 단위 해지율(유지율) 곡선 — 수익성·IFRS17 해지 가정의 근거\n- log-rank로 성별·연령대·채널별 위험률 분리 산출의 통계적 근거 판정\n- numpy만으로 완전 분석 가능(웹 실행기 포함) — 투명한 알고리즘이라 감독당국 제시에 유리",
    interpretation: "- 곡선은 사건 시점에서만 내려가는 계단 — 50% 통과 시점=중위 생존시간\n- event 코딩 반전(절단을 1로)이 최우선 검증 대상 — 뒤집히면 전 결과 무의미\n- 관찰 후반 꼬리는 위험집합이 얇아 불안정 — 마지막 급락을 위험 급증으로 읽지 말 것\n- log-rank p<0.05는 차이의 존재일 뿐 — 크기는 O/E 비·Cox 위험비로, 역선택 시 무정보 절단 가정 훼손 주의",
  },

  credibility: {
    definition: "신뢰도 이론은 개별 경험 X̄와 집단 요율 M을 계수 Z(0~1)로 가중평균해 P = Z·X̄ + (1−Z)·M을 만드는 절충 기법입니다(베이즈 수축과 같은 원리).\n\n- 제한변동: 완전신뢰도 n_full=(z/k)² — 관례(p=90%, k=5%)로 1,082건, 미달 시 Z=√(n/n_full)\n- Bühlmann: Z=n/(n+k), k=EPV(계약 내 잡음)/VHM(계약 간 이질성) — 노출이 다르면 Bühlmann-Straub",
    formulas: [
      {
        label: "완전신뢰도 기준 건수 (포아송 빈도)",
        tex: "n_{\\text{full}} = \\left(\\frac{z_{(1+p)/2}}{k}\\right)^{2}",
        note: "p=90%·k=5%면 (1.645/0.05)² ≈ 1,082건. 심도 변동까지 포함하면 (1+CV²)배로 커진다.",
      },
      {
        label: "부분신뢰도 (제곱근 법칙)",
        tex: "Z = \\min\\!\\left(\\sqrt{\\frac{n}{n_{\\text{full}}}},\\; 1\\right)",
        note: "관측 건수 n이 기준에 모자라면 그 비율의 제곱근만큼만 신뢰.",
      },
      {
        label: "신뢰도 보험료",
        tex: "P = Z\\,\\bar{X} + (1-Z)\\,M",
        note: "X̄=자기(계약자) 경험, M=매뉴얼(집단·참조) 요율.",
      },
      {
        label: "분산 분해 (Bühlmann)",
        tex: "\\mathrm{EPV} = E\\big[\\operatorname{Var}(X\\mid\\Theta)\\big], \\qquad \\mathrm{VHM} = \\operatorname{Var}\\big(E[X\\mid\\Theta]\\big)",
        note: "전체 분산 = EPV + VHM — 계약 내 잡음과 계약 간 이질성의 합.",
      },
      {
        label: "Bühlmann 신뢰도 계수",
        tex: "k = \\frac{\\mathrm{EPV}}{\\mathrm{VHM}}, \\qquad Z = \\frac{n}{n+k}",
        note: "n=관측 연수. 잡음(EPV)↑ → Z↓, 이질성(VHM)↑ → Z↑.",
      },
      {
        label: "Bühlmann-Straub (노출 가중)",
        tex: "Z_i = \\frac{m_i}{m_i + k}, \\qquad P_i = Z_i\\,\\bar{X}_i + (1-Z_i)\\,\\hat{\\mu}, \\quad \\hat{\\mu} = \\frac{\\sum_i Z_i \\bar{X}_i}{\\sum_i Z_i}",
        note: "mᵢ=계약 i의 총노출(피보험자 수 등). 집단 평균 μ̂는 신뢰도 가중으로 추정.",
      },
    ],
    usage: "- 단체보험 갱신 경험요율 — 최근 3~5년 경험과 매뉴얼 요율을 Z로 가중\n- 재보험 burning cost 가중, 참조순보험요율+자사 경험률 반영 구조\n- 셀 데이터가 얇을 때 GLM 상대도를 집단 평균 쪽으로 수축\n- 제한변동=빠른 실무 규칙, Bühlmann(-Straub)=패널 데이터가 있을 때",
    interpretation: "- Z=0.7이면 70%는 자기 경험, 30%는 집단 — 잡음(EPV)↑이면 집단 쪽, 이질성(VHM)↑이면 경험 쪽\n- VHM 추정치가 음수면 계약 간 차이 근거 없음 — Z=0(집단 요율)\n- 1,082건은 포아송 빈도 기준 관례 — 심도 변동 포함 시 (1+CV²)배\n- 경험은 추세·인플레 보정(on-level) 후 투입 — 추세가 남으면 VHM 과대→Z 과대평가",
  },

  "chain-ladder": {
    definition: "Chain-Ladder는 런오프 삼각형(사고연도×개발연차 누적보험금)에서 개발계수 f_j로 미래를 채워 지급준비금(IBNR+RBNS)을 구하는 표준 기법입니다.\n\n- 핵심 가정: 지급 진전 비율이 사고연도와 무관하게 안정 — Mack(1993)은 준비금 표준오차까지 닫힌 식 제공\n- Bornhuetter-Ferguson: 미보고 비율을 사전 기대에 맡겨 관측이 얇은 최근 연도의 노이즈 증폭 보완",
    formulas: [
      {
        label: "볼륨가중 개발계수",
        tex: "\\hat{f}_j = \\frac{\\sum_{i=1}^{I-j} C_{i,j+1}}{\\sum_{i=1}^{I-j} C_{i,j}}",
        note: "분자·분모 모두 두 칸이 다 관측된 행만 합산 — 규모가 큰 사고연도에 자동으로 큰 가중.",
      },
      {
        label: "Chain-Ladder 최종예상·준비금",
        tex: "\\hat{C}_{i,J} = C_{i,J-i+1} \\prod_{j=J-i+1}^{J-1} \\hat{f}_j, \\qquad \\hat{R}_i = \\hat{C}_{i,J} - C_{i,J-i+1}",
        note: "최신 대각선 값에 남은 개발계수를 차례로 곱해 최종까지 진전시킨다.",
      },
      {
        label: "Bornhuetter-Ferguson 준비금",
        tex: "\\hat{R}_i^{BF} = P_i \\cdot ELR \\cdot \\Bigl(1 - \\tfrac{1}{CDF_i}\\Bigr), \\qquad CDF_i = \\prod_{j} \\hat{f}_j",
        note: "P=경과보험료, ELR=사전 손해율. (1−1/CDF)는 아직 나타나지 않은 비율. 사전기대를 CL 최종예상으로 두면 BF≡CL.",
      },
      {
        label: "Mack 분산모수",
        tex: "\\hat{\\sigma}_j^2 = \\frac{1}{I-j-1} \\sum_{i=1}^{I-j} C_{i,j} \\Bigl( \\frac{C_{i,j+1}}{C_{i,j}} - \\hat{f}_j \\Bigr)^2",
        note: "개발계수의 가중잔차 분산. 마지막 연차는 잔차 1개뿐 → σ²_{J−1} = min(σ⁴_{J−2}/σ²_{J−3}, min(σ²_{J−3}, σ²_{J−2}))로 외삽.",
      },
      {
        label: "사고연도별 준비금 mse (Mack)",
        tex: "\\widehat{mse}(\\hat{R}_i) = \\hat{C}_{i,J}^2 \\sum_{j=J-i+1}^{J-1} \\frac{\\hat{\\sigma}_j^2}{\\hat{f}_j^2} \\Bigl( \\frac{1}{\\hat{C}_{i,j}} + \\frac{1}{S_j} \\Bigr), \\qquad S_j = \\sum_{k=1}^{I-j} C_{k,j}",
        note: "괄호 첫 항=과정 오차(미래 자체의 흔들림), 둘째 항=모수 오차(f̂ 추정 오차). 총준비금 mse에는 연도 간 공분산 항이 더해진다.",
      },
    ],
    usage: "- 손보 결산 IBNR 산출·준비금 적정성 검증 — 점추정+Mack 표준오차 제시가 관례\n- IFRS17 최선추정부채(BEL) 현금흐름 추정·백테스트의 밑단 기법\n- 과거 연도는 CL, 관측이 얇은 최근 연도는 BF(또는 Benktander) 병행 비교",
    interpretation: "- f_j가 매끄럽게 1로 수렴하는지 먼저 확인 — 마지막 연차도 1보다 뚜렷이 크면 tail factor 외삽\n- 최근 사고연도일수록 준비금·표준오차(CV)가 큰 것이 정상 패턴\n- Mack ±se는 신뢰구간이 아님 — 구간은 로그정규 근사 분위수로(모형 오차 미포함)\n- 지급 속도·포트폴리오 변화·고인플레는 핵심 가정 훼손 — 달력연도 잔차 점검·인플레 조정 검토",
  },

  "pure-premium": {
    definition: "순보험료는 노출 1단위의 기대손해액으로, E[S]=E[N]×E[X] — 빈도×심도 분해가 요율산정의 출발점입니다.\n\n- 빈도=포아송(과산포 시 음이항)·심도=감마, 로그 링크 GLM — exp(계수)=요율 상대도\n- Tweedie(1<p<2)=복합 포아송–감마와 동치 — 분리 없이 순보험료 직접 적합\n- 면책 d·한도 u의 사고당 기대 지급은 제한기대값(LEV) E[(X∧u)−(X∧d)]",
    formulas: [
      {
        label: "순보험료 분해",
        tex: "\\mathrm{PP} \\;=\\; E[S] \\;=\\; E[N] \\times E[X]",
        note: "집합위험모형 S=ΣXᵢ에서 건수 N ⟂ 심도 X 가정",
      },
      {
        label: "빈도 GLM (포아송·로그 링크)",
        tex: "\\ln E[N_i] \\;=\\; \\ln e_i + \\mathbf{x}_i^{\\top}\\boldsymbol{\\beta}",
        note: "e_i = 노출(경과 계약년수) — 오프셋. sklearn에선 y=N/e, sample_weight=e로 동치 구현",
      },
      {
        label: "심도 GLM (감마·로그 링크)",
        tex: "\\ln E[X_i] \\;=\\; \\mathbf{x}_i^{\\top}\\boldsymbol{\\gamma}",
        note: "사고가 난 계약만, y=평균심도(총액/건수), 건수를 가중치로",
      },
      {
        label: "Tweedie 분산함수",
        tex: "\\operatorname{Var}(Y) \\;=\\; \\phi\\,\\mu^{p}, \\qquad 1 < p < 2",
        note: "1<p<2 구간이 복합 포아송–감마 = 순보험료 직접 모형(관례적 출발점 p=1.5)",
      },
      {
        label: "요율 상대도와 오프밸런스",
        tex: "\\text{rel}_j = e^{\\hat\\beta_j}, \\qquad F_{\\text{off}} = \\frac{\\sum_i P_i^{\\text{현행}}}{\\sum_i P_i^{\\text{조정}}}",
        note: "상대도를 경영 판단으로 조정하면 기저요율에 F_off를 곱해 총보험료 수준을 보존",
      },
      {
        label: "레이어 기대 지급액 (LEV)",
        tex: "E\\big[(X\\wedge u)-(X\\wedge d)\\big] \\;=\\; \\int_{d}^{u} S(x)\\,dx",
        note: "X∧u=min(X,u), S(x)=1−F(x). 면책 d·한도 u 담보의 사고당 기대 지급액",
      },
    ],
    usage: "- 손보 요율산정 표준 파이프라인 — 연령·차종·지역별 상대도 산출과 검증\n- 빈도×심도 분리는 원인 진단에, Tweedie 직접 적합은 운영 단순·ML 확장에 유리\n- LEV로 자기부담금·보상한도·재보험 XL 레이어 가격까지 같은 적분으로 답변\n- 상대도 조정 후 오프밸런스 팩터로 총보험료 수준 보존",
    interpretation: "- exp(계수)=기준 대비 배수(예: 1.45=45% 높음) — 인과가 아니라 상대도, 빈도×심도 상대도의 곱=순보험료 상대도\n- sklearn GLM 기본 alpha=1.0(릿지)은 상대도를 1로 수축 — 요율 산출은 alpha=0이 원칙\n- 소표본 세그먼트 상대도는 표본 오차로 흔들림 — 신뢰도 가중·캡+오프밸런스로 보완\n- 순보험료는 기대손해액일 뿐(영업보험료와 다름), 면책·한도 절감률은 꼬리 가정에 민감",
  },

  "life-premium": {
    definition: "생명보험료는 수지상등 원칙 — '보험료 수입의 기대현가 = 보험금·사업비 지출의 기대현가' — 으로 결정합니다.\n\n- 재료: 생명표(qx)+예정이율 v=1/(1+i) — 종국연령 q_ω=1로 표를 닫아야 완결\n- 계산기수 4종(Dx·Nx·Cx·Mx)만 만들면 정기·종신·연금이 기수의 차·나눗셈으로 산출\n- 기본형: 연말 지급·기시 연납·단생명·확정이율의 결정론적 모형",
    formulas: [
      {
        label: "Gompertz-Makeham 사력 → 사망률",
        tex: "\\mu_x = A + B\\,c^{x}, \\qquad q_x = 1 - \\exp\\!\\Big(-A - B\\,c^{x}\\,\\tfrac{c-1}{\\ln c}\\Big)",
        note: "사력을 [x, x+1)에서 정확 적분한 변환 — c≈1.08~1.12면 사망률이 10세마다 2~3배로 커지는 실무 감각과 부합.",
      },
      {
        label: "계산기수 4종 (v = 1/(1+i))",
        tex: "D_x = v^{x} l_x,\\quad C_x = v^{x+1} d_x,\\quad N_x = \\sum_{y \\ge x} D_y,\\quad M_x = \\sum_{y \\ge x} C_y",
        note: "D·N은 생존계(연금·납입), C·M은 사망계(사망보장). 누적합은 x부터 종국연령 ω까지.",
      },
      {
        label: "일시납 순보험료 — 정기·종신",
        tex: "A^{1}_{x:\\overline{n}|} = \\frac{M_x - M_{x+n}}{D_x}, \\qquad A_x = \\frac{M_x}{D_x}",
        note: "정기보험은 사망계 기수의 차(M40−M60) — n년 안 사망만 보장. 보험금 1원당 값이므로 가입금액 S를 곱해 금액화.",
      },
      {
        label: "기시급 생존연금과 연납 순보험료",
        tex: "\\ddot{a}_{x:\\overline{n}|} = \\frac{N_x - N_{x+n}}{D_x}, \\qquad P = \\frac{S \\cdot A}{\\ddot{a}_{x:\\overline{n}|}}",
        note: "연납보험료 1원의 수입 기대현가가 ä — 수지상등 P·ä = S·A를 P로 푼 것.",
      },
      {
        label: "영업보험료 — 예정사업비 3이원(α·β·γ)",
        tex: "G = \\frac{S\\,A + S\\,\\alpha + S\\,\\beta\\,\\ddot{a}}{\\ddot{a}\\,(1-\\gamma)}",
        note: "α 신계약비(가입금액 대비 1회)·β 유지비(가입금액 대비 매년)·γ 수금비(영업보험료 대비). G·ä = S·A + S·α + S·β·ä + γ·G·ä를 G로 정리.",
      },
      {
        label: "검증 항등식",
        tex: "A_x + d\\,\\ddot{a}_x = 1, \\qquad d = \\frac{i}{1+i}",
        note: "종신보험(연말 지급)과 종신 기시급연금의 이론 관계 — 표가 닫혀 있으면 기계 정밀도로 성립. 산출 시스템 검증의 표준 체크.",
      },
    ],
    usage: "- CFP(현금흐름방식) 결과의 검증 대조군 — 같은 기초율이면 순보험료 일치해야 함\n- 표준해약환급금·순보험료식 보험료적립금 산출은 여전히 이 체계\n- 새 경험생명표(제10회 등) 적용 시 보험료 변화의 빠른 프로토타이핑\n- 예제(40세·1억·20년납 20년만기 정기, i=3%): 연납 순보험료 약 40만 원, 로딩 후 영업보험료 약 61만 원",
    interpretation: "- 기수 값 자체는 무의미(l0 임의) — 비율만 해석: A(40:20)=0.0604는 보험금 1원당 일시납 6.04전\n- 예정이율에 민감 — 보장이 길수록 큼(i −0.5%p에 정기 +0.9%, 종신 +13.6%)\n- 월납·즉시지급은 UDD 근사(ä⁽¹²⁾≈ä−11/24) 보정, 다중탈퇴·금리 시나리오 미반영 — 최종 가격 아님\n- 검증 항등식 A+d·ä=1 잔차가 0이 아니면 표 닫힘(q_ω=1)부터 의심",
  },

  reinsurance: {
    definition: "재보험은 원손해 X를 출재분 C와 보유분 R=X−C로 나누는 '보험회사의 보험'입니다.\n\n- 비례(QS): C=qX — 규모만 줄고 분포 모양(상대 변동성)은 그대로\n- 비비례(XL) 'u xs d': C=min(max(X−d,0),u) — 오른쪽 꼬리를 잘라 보유분포 자체를 변경\n- 레이어 기대출재=LEV 차, 연간 효과는 집합손해 몬테카를로로 전후 VaR·TVaR 비교",
    formulas: [
      {
        label: "XL 클레임별 분출 ('u xs d')",
        tex: "C \\;=\\; \\min\\bigl(\\max(X-d,\\,0),\\;u\\bigr), \\qquad R = X - C",
        note: "d=부담점(attachment), u=레이어 폭(한도). d+u 초과분은 다시 원수사 몫.",
      },
      {
        label: "비례(Quota Share) 분출",
        tex: "C = q\\,X, \\qquad R = (1-q)\\,X",
        note: "모든 클레임을 같은 비율로 — 보유분포의 CV(상대 변동성)는 원수와 동일.",
      },
      {
        label: "레이어 기대출재손해 (LEV 차)",
        tex: "E[C] \\;=\\; E[X\\wedge(d+u)] \\;-\\; E[X\\wedge d]",
        note: "E[X∧m] = E[min(X,m)] = 제한기대값(LEV). 면책·한도 분석의 공용 도구.",
      },
      {
        label: "로그정규 LEV 닫힌형",
        tex: "E[X\\wedge m] = e^{\\mu+\\sigma^{2}/2}\\,\\Phi\\!\\left(\\frac{\\ln m-\\mu}{\\sigma}-\\sigma\\right) + m\\left[1-\\Phi\\!\\left(\\frac{\\ln m-\\mu}{\\sigma}\\right)\\right]",
        note: "몬테카를로 기대출재를 검증하는 이론값 — 시뮬과 근접해야 구현이 정상.",
      },
      {
        label: "집합손해모형",
        tex: "S = \\sum_{i=1}^{N} X_i, \\qquad E[S] = E[N]\\,E[X]",
        note: "N=연간 건수(포아송 등)·X=개별 심도 — 빈도·심도 독립, 클레임 iid 가정.",
      },
      {
        label: "VaR·TVaR (재보험 전후 비교 척도)",
        tex: "\\mathrm{VaR}_{q}(S) = F_S^{-1}(q), \\qquad \\mathrm{TVaR}_{q}(S) = E\\bigl[S \\,\\big|\\, S \\ge \\mathrm{VaR}_{q}(S)\\bigr]",
        note: "K-ICS 요구자본은 99.5% VaR 기준 — XL로 꼬리를 이전하면 요구자본이 완화된다.",
      },
    ],
    usage: "- 발동확률·기대출재·출재율로 부담점 d·한도 u·레이어 분할 설계, 견적을 burning cost와 대조\n- 몬테카를로로 재보험 전후 VaR 99.5%·TVaR 비교 — 자본 절감 대비 순비용을 자본비용률(예: 6~10%)과 견줌\n- K-ICS 요구자본은 99.5% VaR 기준 — XL 출재→요구자본 완화, CAT XL·재산·배상 특약이 전형 적용처",
    interpretation: "- 상위 레이어일수록 발동확률↓·변동성 로딩 비중↑ — 기대출재만으로 가격 매기면 과소평가\n- QS 보유는 CV 불변(꼬리 이전 없음), XL 보유는 99.5% 분위수가 부담점 근처로 하락 — 요구자본 완화\n- 한도(d+u) 소진 후 초과분은 다시 원수사 몫 — 복원(reinstatement) 조건 확인\n- 꼬리 분위수는 파라미터·시드에 민감 — 클레임 독립 가정은 태풍·지진(CAT)에서 훼손",
  },

  /* ─────────────────────────── 데이터 핸들링 (wrangle) ─────────────────────────── */
  "select-rows-cols": {
    definition: "표에서 필요한 행(관측치)과 열(변수)만 잘라내는 가장 기본적인 조작입니다(관계형 이론의 선택·사영).\n\n- loc=라벨(인덱스·열 이름) 기준 / iloc=위치(0부터 세는 정수) 기준\n- 인덱스가 정수 라벨이면 둘의 결과가 다를 수 있음 — 지금 어느 기준인지 의식",
    formulas: [
      {
        label: "행 선택 (선택 연산)",
        tex: "R' = \\sigma_{P}(R) = \\{\\, r \\in R : P(r) \\,\\}",
        note: "R = 원본 표, P = 행이 만족할 조건, R′ = 조건을 만족하는 행들의 부분집합",
      },
      {
        label: "열 선택 (사영 연산)",
        tex: "R'' = \\pi_{A_1,\\dots,A_k}(R)",
        note: "A₁…A_k = 남길 열(변수) 이름 — 행 수는 그대로, 열만 줄어듭니다",
      },
    ],
    usage: "- 모든 분석 파이프라인의 첫 단추 — 조건부 부분집합: df.loc[df[\"age\"] >= 60, \"premium\"]\n- 앞 몇 건 훑기: df.iloc[:5]\n- 수치형 열만 모아 상관분석에: select_dtypes(\"number\")",
    interpretation: "- 잘라낸 결과의 평균·비율은 '선택된 집단'의 통계량 — 전체 값처럼 보고하면 오해\n- 슬라이스 규칙: loc의 a:c는 끝 포함, iloc의 0:3은 끝 제외 — 결과 건수 확인\n- 조각 수정 시 경고가 나면 .copy()로 원본과 분리",
  },

  "filter-condition": {
    definition: "행마다 조건을 평가한 True/False 벡터(불리언 마스크)로 참인 행만 남기는 연산입니다 — 이후의 평균·비율은 모두 조건부 통계량.\n\n- 여러 조건은 &(그리고)·|(또는)로 결합 — 각 조건은 반드시 괄호로(연산자 우선순위)",
    formulas: [
      {
        label: "불리언 마스크",
        tex: "m_i = \\mathbf{1}[\\, P(x_i) \\,]",
        note: "𝟏[·] = 지시함수 — 행 i가 조건 P를 만족하면 1(True), 아니면 0(False)",
      },
      {
        label: "필터 후 평균 (조건부 평균)",
        tex: "\\bar{x}_{P} = \\frac{\\sum_i m_i\\, x_i}{\\sum_i m_i}",
        note: "분자 = 조건을 만족하는 값의 합, 분모 = 만족 건수 — 필터 결과의 평균은 이 값입니다",
      },
    ],
    usage: "- \"40~50대 종신보험 평균 보험료\", \"손해율 100% 초과 지점\" 같은 조건부 질문의 출발점\n- 특정 담보·기간만 추린 심도 분석, 해지 제외 유지 계약의 유지율 통계에 필수",
    interpretation: "- 결과 통계량은 그 조건 집단의 값 — 분모(몇 건 중 몇 건)를 함께 보고\n- 괄호 누락은 에러 또는 조용히 다른 조건이 됨 — 필터 직후 len()으로 건수 확인 습관\n- 문자열 조건(str.contains)은 결측에서 오류 — na=False 지정",
  },

  isin: {
    definition: "각 값이 목록(집합) S에 속하는지(x ∈ S)를 행마다 검사하는 집합 소속 연산입니다.\n\n- (x == a) | (x == b) | … 와 동일하지만 해시 집합이라 목록이 수천 개여도 빠름\n- 목록 자리에 다른 데이터프레임의 열도 가능 — '명단 대조'가 한 줄",
    formulas: [
      {
        label: "소속 지시함수",
        tex: "m_i = \\mathbf{1}[\\, x_i \\in S \\,]",
        note: "S = 허용 값의 집합(리스트·다른 표의 열), m_i = 행 i를 남길지 여부",
      },
    ],
    usage: "- \"종신·정기·암보험 3종만\", \"VIP 명단 고객의 계약만\" 같은 목록 대조\n- 제재·재심사 대상, 판매 중지 상품 코드 등 외부 명단 대조 — 검사·언더라이팅 기본기",
    interpretation: "- '정확히 같은' 값만 매칭 — 공백·대소문자·자료형(문자 \"1\" vs 숫자 1) 차이면 실패, 0건이면 표기 차이부터 의심\n- NaN은 어떤 집합에도 속하지 않는 것으로 처리\n- 두 열 조합 대조를 열별 isin으로 하면 틀림 — merge가 정확",
  },

  conditional: {
    definition: "조건에 따라 다른 값을 부여하는 조각별(piecewise) 함수를 행 전체에 한 번에 계산합니다 — 엑셀 IF·SQL CASE WHEN의 벡터판.\n\n- 이항 분기 np.where, 다중 분기 np.select\n- 구간화는 pd.cut(경계 직접)·pd.qcut(분위수 균등)",
    formulas: [
      {
        label: "조각별 정의 (다중 분기)",
        tex: "y_i = \\begin{cases} v_1 & C_1(x_i) \\\\ v_2 & C_2(x_i) \\\\ v_0 & \\text{otherwise} \\end{cases}",
        note: "위에서부터 첫 번째로 참인 조건 C가 적용 — 조건의 나열 순서가 결과를 좌우합니다",
      },
      {
        label: "구간화 (cut)",
        tex: "B(x) = j \\iff x \\in [\\, b_{j-1},\\ b_j )",
        note: "b_j = 구간 경계 — right=False면 왼쪽 끝 포함·오른쪽 끝 제외",
      },
    ],
    usage: "- 손해율 등급(적자/주의/양호/우수), 연령대 밴드, 보험료 4분위(Q1~Q4) 등 세그먼트 정의\n- 요율 상대도 산출·리포트용 구간화에 상시 등장\n- 행마다 if문을 도는 apply보다 수십 배 빠름",
    interpretation: "- 구간화는 정보를 잃고 해석을 얻는 교환 — 경계 바로 옆 값(59세 vs 60세)이 등급이 갈리는 '경계 효과' 의식\n- np.select는 앞선 조건이 우선 — 넓은 조건을 앞에 두면 뒤 조건이 영영 미적용\n- pd.cut은 경계 밖 값을 조용히 NaN 처리 — 양끝을 넉넉히 잡고 결과 NaN 유무 확인",
  },

  "join-merge": {
    definition: "두 표를 공통 키로 옆으로 잇는 관계형 결합(SQL JOIN)입니다 — 흩어진 계약·고객·청구 정보를 한 표로 모읍니다.\n\n- how: inner=양쪽에 있는 키만, left=왼쪽 전부 유지, outer=양쪽 전부\n- 같은 구조를 위아래로 쌓는 건 concat의 몫",
    formulas: [
      {
        label: "내부 결합의 행 수 (키 중복 시)",
        tex: "\\lvert A \\bowtie B \\rvert = \\sum_{k} n_A(k)\\, n_B(k)",
        note: "n_A(k)·n_B(k) = 키 k가 각 표에 등장하는 횟수 — 양쪽 모두 중복이면 곱으로 불어납니다(행 폭증)",
      },
    ],
    usage: "- 계약에 고객 속성 붙이기(left join — 계약 전부 유지), 청구+계약 결합으로 상품별 손해율 계산\n- 월별 청구 파일 쌓기는 concat\n- validate=\"many_to_one\"·indicator=True로 결합 품질 동시 점검",
    interpretation: "- 행 수가 예상과 다르면 키 관계(1:1·1:N·N:M) 의심 — N:M은 금액 중복 합산으로 보험료·준비금 부풀림의 전형 사고\n- left join 매칭 실패 행은 오른쪽 열이 NaN — '값 없음'이 아니라 '매칭 실패', indicator의 left_only 비율로 규모 확인\n- validate는 잘못된 관계를 에러로 미리 잡는 보험",
  },

  groupby: {
    definition: "키(상품·채널 등)로 나누고(split) 그룹마다 집계를 적용해(apply) 합치는(combine) 패턴 — 그룹별 조건부 통계량 E[X | G = g]로 집단 간 이질성을 드러냅니다(통계학의 층화).\n\n- agg: 그룹당 1행으로 요약\n- transform: 집계값을 원본 행 수 그대로 되돌려 파생변수 생성",
    formulas: [
      {
        label: "그룹 평균 (조건부 평균)",
        tex: "\\bar{x}_g = \\frac{1}{n_g} \\sum_{i \\in g} x_i",
        note: "g = 그룹, n_g = 그룹의 행 수 — agg(\"mean\")이 계산하는 값",
      },
      {
        label: "transform의 반환",
        tex: "\\tilde{x}_i = \\bar{x}_{g(i)}",
        note: "행 i가 속한 그룹의 집계값을 행마다 되돌림 — 원본 길이 유지, 파생변수용",
      },
    ],
    usage: "상품×채널별 평균 보험료·건수 요약, 지점별 손해율, \"자기 상품군 평균 대비 보험료 비율\"(transform) 같은 파생변수 — 분석의 중심 동작입니다. 경험통계 산출이나 요율 검증에서 세그먼트별 실제/기대(A/E) 비율을 만드는 뼈대이기도 합니다.",
    interpretation: "그룹별 수치는 반드시 그룹 크기(건수)와 함께 읽으세요 — 10건짜리 그룹의 평균은 우연 변동이 커서 신뢰하기 어렵습니다(이 문제를 정식으로 다루는 것이 신뢰도 이론입니다). 또 \"그룹 평균들의 평균\"은 전체 평균과 다릅니다 — 그룹 크기가 서로 다르면 가중치가 달라지기 때문이며, 심슨의 역설도 이 지점에서 생깁니다. 여러 키로 묶은 결과는 멀티인덱스가 되므로 reset_index()로 평평하게 만들어 다루세요.",
  },

  apply: {
    definition: "임의의 사용자 정의 함수 f를 데이터에 적용하는 범용 변환입니다. 내장 벡터 연산으로 표현하기 어려운 복잡한 업무 규칙을 파이썬 코드 그대로 옮기는 \"탈출구\"입니다.\n\n- map: 값 하나씩 y = f(x)로 변환(사전 매핑 포함)\n- apply(axis=1): 행 전체를 함수에 넘겨 여러 열 조합 계산\n- 행마다 파이썬 함수를 호출하는 루프 — 벡터 연산이 가능하면 그쪽 우선",
    formulas: [
      {
        label: "원소별 변환",
        tex: "y_i = f(x_i)",
        note: "map = 값 x_i 하나씩 / apply(axis=1) = 행 벡터 전체를 f에 전달",
      },
    ],
    usage: "- 상품 코드→이름 사전 매핑(map)\n- 여러 열 조합 심사 규칙(예: 65세 이상 & 청구 3건 이상이면 정밀심사)은 apply(axis=1)\n- 프로토타입에서 규칙을 빠르게 옮겨 검증한 뒤, 대용량 처리 전 np.select 등 벡터 버전으로 다듬기",
    interpretation: "- 성능 순서는 벡터 연산 > map(사전) > apply — 대용량 apply(axis=1) 전에 np.where·np.select·groupby.transform으로 대체 가능한지 확인\n- map은 사전에 없는 값을 NaN 처리 — 결과 NaN을 누락 코드 발견 기회로 점검\n- 일부만 바꾸고 나머지 유지하려면 map이 아니라 replace",
  },

  pivot: {
    definition: "표의 모양을 바꾸는 양방향 변환입니다. pivot_table은 행 키 × 열 키 교차 칸마다 집계 함수를 적용해 2차원 요약표를, melt는 반대로 열로 늘어선 변수(1월, 2월, …)를 (변수명, 값) 쌍의 세로(long) 형태로 되돌립니다.\n\n- pivot_table: 값이 건수면 통계학의 분할표(contingency table)·엑셀 피벗테이블과 동일\n- long은 코드·분석·시각화에, wide는 사람 눈에 적합",
    formulas: [
      {
        label: "교차 칸의 집계",
        tex: "c_{rs} = f\\left( \\{\\, x_i : R_i = r,\\ C_i = s \\,\\} \\right)",
        note: "r = 행 키 값, s = 열 키 값, f = aggfunc(mean·sum·count 등) — 칸마다 해당 부분집합에 f를 적용",
      },
    ],
    usage: "- 상품(행) × 연령대(열) 평균 보험료, 담보 × 사고연도 청구 건수 등 보고·검토용 요약표\n- melt: 지점별 월 실적이 옆으로 늘어선 보고서형 엑셀을 groupby·시각화·시계열이 가능한 long으로 환원",
    interpretation: "- 빈 칸(NaN)은 \"그 조합의 데이터 없음\" — fill_value=0은 \"거래 없음\"과 \"0원\"의 구분을 없애므로 의미 확인 후 사용\n- aggfunc 기본값은 sum이 아니라 mean — 합계표로 착각 주의\n- 중복 조합이 있으면 pivot(집계 없는 재배열, 중복 시 에러)이 아니라 pivot_table",
  },

  missing: {
    definition: "결측 처리의 출발점은 채우는 기술이 아니라 \"왜 비었는가\"라는 질문입니다. 결측 메커니즘이 무엇이냐에 따라 같은 삭제·대체라도 만들어지는 편향이 달라집니다.\n\n- MCAR: 완전 무작위(결측이 데이터와 무관) — 단순 삭제가 안전한 유일한 경우\n- MAR: 관측된 다른 변수에 따라 결측 확률이 달라짐\n- MNAR: 결측값 자신이 클수록/작을수록 비는 경우 — 어떤 단순 대체도 편향을 남김",
    formulas: [
      {
        label: "MCAR (완전 무작위 결측)",
        tex: "P(M \\mid X^{\\mathrm{obs}}, X^{\\mathrm{mis}}) = P(M)",
        note: "M = 결측 여부 지시변수 — 결측이 관측값·미관측값 모두와 무관할 때만 단순 삭제가 편향 없음",
      },
      {
        label: "열별 결측률",
        tex: "r_j = \\frac{1}{n} \\sum_{i=1}^{n} \\mathbf{1}[\\, x_{ij} = \\mathrm{NA} \\,]",
        note: "isna().mean()이 계산하는 값 — 처리 방침(삭제 vs 대체)을 정하는 첫 지표",
      },
    ],
    usage: "- 모든 분석 전의 관문 — 먼저 열별 결측 규모 파악\n- 소수면 dropna 삭제, 다수면 중앙값(수치형·이상치에 강건)·'미상'(범주형) 대체\n- 고연령·특정 채널에 몰리는 결측(예: 소득)은 결측 여부를 0/1 변수로 남겨 해지 예측 입력으로 활용",
    interpretation: "- 평균·중앙값 대체는 분산을 인위적으로 줄이고 상관을 약화 — 대체 후 표준편차·상관계수는 실제보다 작게 나옴\n- MNAR(예: 소득 높을수록 미기재)이면 결측 자체가 정보 — 지우지 말고 변수로 보존\n- 공백·'-'·'N/A' 같은 숨은 결측은 진짜 NaN으로 바꾸기 전엔 결측률이 과소집계 — 세기 전에 replace 먼저",
  },

  "sort-dedup": {
    definition: "결과 표를 다듬는 마무리 3종 세트입니다. 정렬(sort_values)은 키에 따라 행의 순서를 다시 매기는 것, 중복 제거(drop_duplicates)는 지정한 열 조합이 같은 행들 중 대표 1건만 남기는 것, 순위(rank)는 값의 크기 순서(순서통계량)에 번호를 붙이는 것입니다.\n\n셋의 공통 역할은 \"이 표의 한 행은 무엇인가\"(고객당 1행? 계약당 1행?)라는 관측 단위를 데이터에 강제하는 것입니다 — 관측 단위가 흔들리면 이후의 모든 건수·합계가 흔들립니다.",
    formulas: [
      {
        label: "순위 (내림차순 · 동점 min 방식)",
        tex: "r_i = 1 + \\#\\{\\, j : x_j > x_i \\,\\}",
        note: "자기보다 큰 값의 개수 + 1 — 동점이면 같은 순위, method 옵션에 따라 동점 처리 방식이 달라짐",
      },
    ],
    usage: "\"고객별 최신 계약 1건만\"(발행일 내림차순 정렬 후 keep=\"first\"), 지점별 실적 순위, 상위 10대 고액 청구 추출(nlargest)이 단골 패턴입니다. 중복 계약·중복 청구의 검출은 지급 오류·이중 계상 점검의 기본 절차이기도 합니다.",
    interpretation: "drop_duplicates의 keep=\"first\"가 무엇을 남길지는 그 시점의 행 순서가 결정합니다 — 반드시 정렬을 먼저 하세요. 지우기 전에 duplicated()로 어떤 행이 걸리는지 눈으로 확인하고, \"제거 전 n건 → 제거 후 m건\"을 기록해 두면 분모가 달라진 원인을 나중에 추적할 수 있습니다. rank는 동점 처리 방식(average·min·dense)에 따라 같은 데이터에서도 순위가 달라지므로, 보고서에 쓸 때는 어떤 방식인지 명시하는 것이 좋습니다.",
  },
};
