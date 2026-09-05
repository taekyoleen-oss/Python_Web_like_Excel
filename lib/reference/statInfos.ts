// 모델 적합 — 적합 통계량 설명 데이터 (소스 StatInfoDialog.tsx에서 추출, 부록 E R4).
// 결과 표 열 이름 옆 ⓘ가 여는 팝업의 의미·수식(KaTeX)·판단기준.

export interface StatInfo {
  key: string;
  name: string; // 짧은 열 이름
  full: string; // 풀네임
  desc: string; // 설명
  tex?: string; // KaTeX 수식
  texNote?: string; // 수식 기호 설명
  criteria: string[]; // 판단기준(목록)
  caution?: string; // 주의
}

export const STAT_INFOS: Record<string, StatInfo> = {
  logL: {
    key: "logL",
    name: "logL",
    full: "로그우도 (Log-likelihood)",
    desc: "적합된 파라미터에서 관측 데이터가 나올 가능성(우도)의 로그값입니다. 적합이 잘 될수록 데이터에 높은 확률(밀도)을 부여하므로 값이 커집니다.",
    tex: "\\ell(\\hat\\theta)=\\sum_{i=1}^{n}\\ln f(x_i;\\hat\\theta)",
    texNote: "f = 밀도(질량)함수, θ̂ = MLE 추정 파라미터. 그룹데이터는 구간확률 로그우도 Σ nᵢ ln[F(bᵢ)−F(aᵢ)].",
    criteria: [
      "클수록(0에 가까울수록) 적합이 좋습니다.",
      "파라미터 수가 다른 분포끼리 logL만으로 비교하면 복잡한 분포가 유리해집니다 — 반드시 AIC·BIC와 함께 보세요.",
      "값 자체보다 후보 분포 간 차이가 의미를 가집니다.",
    ],
  },
  aic: {
    key: "aic",
    name: "AIC",
    full: "아카이케 정보량 기준 (Akaike Information Criterion)",
    desc: "적합도(logL)와 모형 복잡도(파라미터 수 k)의 균형을 재는 대표적인 모형 선택 기준입니다. 파라미터가 많을수록 벌점을 주어 과적합을 억제합니다.",
    tex: "\\mathrm{AIC}=2k-2\\,\\ell(\\hat\\theta)",
    texNote: "k = 추정한 파라미터 수(예: 로그정규 2, 지수 1).",
    criteria: [
      "작을수록 좋습니다 — 절대값은 의미가 없고 후보 간 차이(ΔAIC)로 비교합니다.",
      "ΔAIC ≤ 2 : 사실상 대등한 모형 · 4~7 : 뚜렷한 차이 · ≥ 10 : 결정적 차이 (Burnham–Anderson 관례)",
      "표본이 작으면(n/k < 40) 소표본 보정 AICc도 참고하세요.",
    ],
  },
  bic: {
    key: "bic",
    name: "BIC",
    full: "베이지안 정보량 기준 (Bayesian Information Criterion)",
    desc: "AIC와 같은 구조지만 복잡도 벌점이 표본 수에 따라 커지는(k·ln n) 기준입니다. 데이터가 많을수록 단순한 분포를 더 강하게 선호합니다.",
    tex: "\\mathrm{BIC}=k\\ln n-2\\,\\ell(\\hat\\theta)",
    texNote: "n = 표본 수. n ≥ 8이면 ln n > 2라 AIC보다 벌점이 큽니다.",
    criteria: [
      "작을수록 좋습니다 — 후보 간 차이(ΔBIC)로 비교합니다.",
      "ΔBIC 2~6 : 양의 증거 · 6~10 : 강한 증거 · > 10 : 매우 강한 증거 (Kass–Raftery 관례)",
      "AIC와 순위가 다르면: 예측 목적이면 AIC, 참 모형 식별·간결성 중시면 BIC 쪽을 참고하세요.",
    ],
  },
  ksD: {
    key: "ksD",
    name: "KS D",
    full: "콜모고로프–스미르노프 통계량 (Kolmogorov–Smirnov D)",
    desc: "경험 누적분포(ECDF)와 적합 누적분포의 최대 수직 거리입니다. 분포의 중앙부 차이에 민감하고 꼬리 차이에는 둔감합니다.",
    tex: "D=\\sup_x\\left|F_n(x)-\\hat F(x)\\right|",
    texNote: "Fₙ = 경험 CDF, F̂ = 적합 CDF.",
    criteria: [
      "작을수록 좋습니다 (0 = 완전 일치).",
      "대략적 가늠: D가 1.36/√n보다 크면 5% 수준에서 의심 (n=100이면 0.136).",
      "꼬리 적합이 중요한 손해액 분석에서는 꼬리에 민감한 A²를 함께 보세요.",
    ],
    caution: "파라미터를 같은 데이터로 추정했으므로 p값이 실제보다 관대합니다(근사).",
  },
  ksP: {
    key: "ksP",
    name: "KS p",
    full: "KS 검정 유의확률 (p-value)",
    desc: "'데이터가 이 분포에서 나왔다'는 귀무가설 아래에서 지금 관측된 D 이상이 나올 확률입니다.",
    criteria: [
      "p < 0.05 : 이 분포를 기각(적합하지 않음)할 근거가 있습니다.",
      "p ≥ 0.05 : 기각하지 못함 — '적합하다고 볼 수 있음'이지 증명은 아닙니다.",
      "여러 후보가 모두 p ≥ 0.05면 AIC·BIC 순위로 선택하세요.",
    ],
    caution: "파라미터를 같은 데이터에서 추정하면 p가 실제보다 크게(관대하게) 나옵니다. 엄밀한 검정은 Lilliefors 보정·부트스트랩이 필요하며, 여기서는 참고용입니다.",
  },
  a2: {
    key: "a2",
    name: "A²",
    full: "앤더슨–달링 통계량 (Anderson–Darling A²)",
    desc: "ECDF와 적합 CDF의 차이를 분포의 꼬리에 더 큰 가중치로 적분한 통계량입니다. 대형 손해(극단값) 적합 판단에 특히 유용합니다.",
    tex: "A^2=-n-\\frac{1}{n}\\sum_{i=1}^{n}(2i-1)\\left[\\ln \\hat F(x_{(i)})+\\ln\\!\\left(1-\\hat F(x_{(n+1-i)})\\right)\\right]",
    texNote: "x₍ᵢ₎ = 오름차순 정렬한 i번째 관측값.",
    criteria: [
      "작을수록 좋습니다.",
      "임계값이 분포 종류·파라미터 추정 여부에 따라 달라 절대 판정 대신 후보 간 상대 비교로 쓰세요.",
      "꼬리(재보험·대형 손해)가 중요하면 AIC와 함께 A² 순위를 우선 참고하세요.",
    ],
  },
  chi2: {
    key: "chi2",
    name: "χ²",
    full: "카이제곱 적합도 통계량 (Chi-square)",
    desc: "구간(또는 건수)별 관측도수와 적합 분포가 예측한 기대도수의 차이를 잰 통계량입니다. 그룹데이터·빈도 적합의 표준 검정입니다.",
    tex: "\\chi^2=\\sum_j\\frac{(O_j-E_j)^2}{E_j},\\qquad df=\\text{구간 수}-1-k",
    texNote: "O = 관측도수, E = 기대도수, k = 추정 파라미터 수.",
    criteria: [
      "작을수록 좋습니다 — df가 같은 후보끼리는 직접 비교 가능합니다.",
      "χ² p ≥ 0.05면 적합을 기각하지 못합니다.",
      "기대도수 E < 5인 구간이 많으면 근사가 나빠집니다 — 구간 통합을 고려하세요.",
    ],
  },
  chi2P: {
    key: "chi2P",
    name: "χ² p",
    full: "카이제곱 검정 유의확률 (p-value)",
    desc: "'이 분포가 맞다'는 귀무가설 아래 지금의 χ² 이상이 나올 확률입니다. 자유도 df = 구간 수 − 1 − k 기준입니다.",
    criteria: [
      "p < 0.05 : 이 분포를 기각할 근거가 있습니다.",
      "p ≥ 0.05 : 기각하지 못함(적합 가능).",
      "df ≤ 0(구간·건수 종류가 파라미터 수보다 부족)이면 계산되지 않습니다 — 표에 '—'로 표시.",
    ],
    caution: "파라미터를 같은 데이터에서 추정했으므로 근사 p값입니다.",
  },
};
