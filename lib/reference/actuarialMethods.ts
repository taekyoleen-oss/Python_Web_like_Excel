// 보험·계리 파이썬 사전 — /datalab 분석 방법 사전의 다섯 번째 카테고리(actuarial) 방법 8종.
// statMethods.ts 비대화를 막기 위해 별도 파일로 분리하고, STAT_METHODS에 스프레드로 합류한다.
// 모든 코드는 웹 실행기(Pyodide)에서 그대로 돌아가야 하므로 numpy·scipy·pandas·sklearn만 사용한다
// (lifelines·chainladder 등 미제공 패키지 대신 KM·Nelson-Aalen·Whittaker-Henderson·Bühlmann·
//  chain-ladder·Mack·계산기수를 numpy로 직접 구현). 각 섹션은 고정 시드 인라인 합성 데이터로
// 자체 완결 실행되며, 로컬 python(numpy 2.3·scipy 1.16·pandas 2.3·sklearn 1.7)으로 전 섹션 실행 검증했다.

import type { StatMethod } from "./statMethods";

export const ACTUARIAL_METHODS: StatMethod[] = [
  {
    id: "exposure-rates",
    name: "위험률 산출",
    en: "Exposure & Crude Rates",
    category: "actuarial",
    weight: 4,
    difficulty: 2,
    params: [
      {
        name: "중앙노출 vs 초기노출",
        desc: "중앙노출(실제 관찰연수)은 mx=D/Ec, 초기노출(사망자는 연말까지 1년 인정)은 qx=D/Ei — 산출할 율이 노출 정의를 정합니다.",
      },
      {
        name: "연령 기준(도달연령·밴딩)",
        desc: "노출은 도달연령(보험연령)에 배분합니다. 5세 밴딩은 표본 확보와 추세 표현의 절충 — 잘게 쪼갤수록 사망 0건 셀 속출.",
      },
      {
        name: "alpha(신뢰수준)",
        desc: "정확 신뢰구간의 유의수준 — 0.05면 95% 구간. 상·하한은 카이제곱 분위수(chi2.ppf) 닫힌형입니다.",
      },
      {
        name: "참조율(기대사망의 기준)",
        desc: "A/E 분모의 기준율 — 국내는 보험개발원 참조순보험요율·경험생명표. 노출과 율의 기준(초기↔qx, 중앙↔mx)을 일치시킵니다.",
      },
      {
        name: "D=0(무사망 셀) 처리",
        desc: "하한 0, 상한 chi2.ppf(1−α/2, 2)/(2E) — 무사망도 정보라 상한이 한계를 담습니다(정규근사는 0±0).",
      },
      {
        name: "UDD(연내 균등사망 가정)",
        desc: "부분연도 처리와 qx↔mx 환산(qx ≈ mx/(1+mx/2))의 근거 가정. 상수사력 가정이면 qx = 1−exp(−mx)를 씁니다.",
      },
    ],
    summary:
      "관찰기간→노출(중앙·초기)→조발생률→포아송 정확 신뢰구간→A/E — 경험위험률 산출의 출발점",
    intro:
      "위험률 산출의 첫 단계 — '누가 얼마나 오래 위험에 노출되었는가'를 세어 조발생률을 구합니다.\n\n- 노출 = 계약별 관찰기간 합, 조발생률 = 사망수 D ÷ 노출\n- D는 포아송 취급 — 사망 적은 셀은 정규근사(D±1.96√D) 대신 카이제곱 정확 신뢰구간\n- A/E(실제/기대)로 참조율(보험개발원 참조순보험요율·경험생명표)과 비교 — IFRS17 가정 검증의 표준\n- A/E 구간이 1을 벗어나면 경험률 반영 검토, 아니면 신뢰도(credibility) 가중 결합",
    tips: "- 노출과 율의 기준을 섞으면(예: 중앙노출×qx) A/E가 체계적으로 틀어짐 — 초기↔qx·중앙↔mx 일치 확인\n- 사망 적은 셀의 조발생률은 크게 출렁임 — 정확 CI·신뢰도와 함께 해석, 다음 단계는 보정(graduation)",
    sections: [
      {
        title: "노출 계산과 조발생률 — 중앙 vs 초기",
        desc: "보험연도 분할로 중앙·초기 노출과 5세 구간 조발생률을 집계합니다 — 참값(참조율×1.35)을 아는 합성 데이터로 검증.",
        level: "basic",
        code: `import numpy as np
import pandas as pd

# ── 경험데이터 합성(약 800계약, 가입연령 30~70세) ─────────────────
# 실무라면 계약 원장에서 [가입일 · 해지/만기일 · 사망일]을 받아 계산합니다.
rng = np.random.default_rng(42)
n = 800

# 참조위험률(연간 qx) — 곰페르츠 근사. 예시라 사망 표본 확보를 위해
# 실제 참조순보험요율보다 높은 수준으로 잡았습니다(방법 시연 목적).
def q_ref(age):
    return 8e-4 * np.exp(0.065 * age)

TRUE_RATIO = 1.35            # 실제 경험단체 사망률 = 참조율 × 1.35 (예: 간편심사 단체)

entry_age  = rng.integers(30, 71, n)      # 가입연령
plan_years = rng.uniform(1.0, 5.0, n)     # 관찰 예정 기간(연)

# ① 계약을 '보험연도(policy year)' 단위로 분할해 관찰 — 경험분석의 기본 단위
#    각 연도: 사망여부 ~ Bernoulli(연간 q × 관찰비율, 연내 균등가정) → 사망 시 중단
rows = []
for a0, plan in zip(entry_age, plan_years):
    age, remain = int(a0), float(plan)
    while remain > 0:
        frac = min(1.0, remain)                            # 이 보험연도의 관찰 예정 비율
        if rng.random() < TRUE_RATIO * q_ref(age) * frac:  # 사망 발생
            t = rng.uniform(0.0, frac)                     # 연내 사망 시점(균등가정)
            #            (도달연령, 중앙노출, 초기노출, 사망)
            rows.append((age, t, 1.0, 1))                  # ← 두 노출이 갈리는 지점
            break
        rows.append((age, frac, frac, 0))
        age += 1; remain -= 1.0

py = pd.DataFrame(rows, columns=["age", "exp_central", "exp_initial", "death"])
print(f"보험연도 셀 {len(py):,}개 · 계약 {n}건 · 총 사망 {py['death'].sum()}건")

# ② 두 가지 노출 — '무엇을 추정하는가'가 다릅니다
#    중앙노출(central): 실제 관찰 연수의 합(사망자는 사망 시점까지)
#                       → 중앙사망률 mx = D/Ec … 사력(force of mortality)에 대응
#    초기노출(initial): 사망자는 그 보험연도 말까지 1년 전부 인정(전통 계리 규칙)
#                       → 조사망률 qx = D/Ei … 연초 생존자의 연내 사망확률
band = (py["age"] // 5) * 5                     # 도달연령 5세 구간
g = py.groupby(band).agg(
    Ec=("exp_central", "sum"), Ei=("exp_initial", "sum"), D=("death", "sum"))

# ③ 조발생률(crude rate) = 사망수 / 노출 — 참조율 대비 비율로 참값(1.35) 회복 확인
#    사망이 몇 건 안 되는 구간(저연령)은 비율이 크게 출렁입니다 → 다음 섹션의
#    '정확 신뢰구간'이 바로 이 불확실성을 정량화합니다.
g["crude_mx"] = g["D"] / g["Ec"]
g["crude_qx"] = g["D"] / g["Ei"]
g["ref_qx"]  = q_ref(g.index.to_numpy() + 2)    # 구간 중앙(시작+2세) 참조율
g["actual/ref"] = g["crude_qx"] / g["ref_qx"]
g.index = [f"{b}-{b+4}" for b in g.index]
print(g.round(4).to_string())

# ④ 검증 — 전체 수준에서 이론 관계 확인
#    연내 균등사망 가정에서 qx ≈ mx/(1 + mx/2), 전체 실제/참조 ≈ 1.35(설정값)
mx_tot = py["death"].sum() / py["exp_central"].sum()
qx_tot = py["death"].sum() / py["exp_initial"].sum()
ratio_hat = py["death"].sum() / (py["exp_initial"] * q_ref(py["age"])).sum()
print(f"\\n전체 crude mx = {mx_tot:.4f} → 환산 qx = {mx_tot/(1+mx_tot/2):.4f} vs 직접 qx = {qx_tot:.4f}")
print(f"전체 실제/참조(가중 A/E) = {ratio_hat:.3f} — 설정 참값 1.35와 표본오차 범위 내 일치")`,
      },
      {
        title: "포아송 정확(exact) 95% 신뢰구간",
        desc: "정규근사가 무너지는 소수 셀에 카이제곱 닫힌형 정확 구간을 적용하고 참값 커버리지를 확인합니다.",
        level: "advanced",
        code: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy import stats

# ── 동일 경험데이터 재생성(시드 42 — [노출·조발생률] 섹션과 같은 데이터) ─────────────────
rng = np.random.default_rng(42)
n = 800
def q_ref(age):
    return 8e-4 * np.exp(0.065 * age)
TRUE_RATIO = 1.35
entry_age  = rng.integers(30, 71, n)
plan_years = rng.uniform(1.0, 5.0, n)
rows = []
for a0, plan in zip(entry_age, plan_years):
    age, remain = int(a0), float(plan)
    while remain > 0:
        frac = min(1.0, remain)
        if rng.random() < TRUE_RATIO * q_ref(age) * frac:
            rows.append((age, rng.uniform(0.0, frac), 1.0, 1)); break
        rows.append((age, frac, frac, 0))
        age += 1; remain -= 1.0
py = pd.DataFrame(rows, columns=["age", "exp_central", "exp_initial", "death"])

band = (py["age"] // 5) * 5
g = py.groupby(band).agg(Ec=("exp_central", "sum"), D=("death", "sum"))

# ① 포아송 정확(exact) 신뢰구간 — 카이제곱 분위수의 닫힌형 공식
#    사망수 D는 희귀사건이라 포아송으로 봅니다. 정규근사 D ± 1.96√D 는
#    D가 작을 때 무너집니다(하한이 음수, 실제 포함확률 < 95%).
#    정확 구간: 하한 = chi2.ppf(α/2, 2D)/(2E) · 상한 = chi2.ppf(1−α/2, 2(D+1))/(2E)
def poisson_exact_ci(D, E, alpha=0.05):
    lo = stats.chi2.ppf(alpha / 2, 2 * D) / (2 * E) if D > 0 else 0.0  # D=0이면 하한 0
    hi = stats.chi2.ppf(1 - alpha / 2, 2 * (D + 1)) / (2 * E)
    return lo, hi

g["mx"] = g["D"] / g["Ec"]
g[["ci_lo", "ci_hi"]] = [poisson_exact_ci(d, e) for d, e in zip(g["D"], g["Ec"])]

# ② 참값 포함 여부 — 시뮬레이션이라 참값을 아니까 커버리지를 직접 확인 가능
#    실제 사력(중앙사망률) m_true ≈ q_true / (1 − q_true/2)  (연내 균등사망 가정)
mid = g.index.to_numpy() + 2
q_true = TRUE_RATIO * q_ref(mid)
g["m_true"] = q_true / (1 - q_true / 2)
g["cover"] = (g["ci_lo"] <= g["m_true"]) & (g["m_true"] <= g["ci_hi"])
g.index = [f"{b}-{b+4}" for b in g.index]
print(g.round(4).to_string())
print(f"\\n95% 구간이 참값을 포함: {int(g['cover'].sum())}/{len(g)}개 구간"
      " (이론상 평균 95% — 20개 중 1개꼴 빗나가는 게 정상)")

# ③ 시각화 — 사망 수가 적은 구간일수록 구간이 넓다(로그축)
fig, ax = plt.subplots(figsize=(7, 4.2))
ax.errorbar(mid, g["mx"], yerr=[g["mx"] - g["ci_lo"], g["ci_hi"] - g["mx"]],
            fmt="o", capsize=4, label="crude mx + 95% exact CI")
ages = np.linspace(30, 74, 200)
qt = TRUE_RATIO * q_ref(ages)
ax.plot(ages, qt / (1 - qt / 2), "--", label="true rate (x1.35)")
ax.plot(ages, q_ref(ages), ":", label="reference qx")
ax.set_yscale("log")
ax.set_xlabel("age"); ax.set_ylabel("central death rate (log scale)")
ax.set_title("Crude rates with exact Poisson CI")
ax.legend(); plt.tight_layout(); plt.show()`,
      },
      {
        title: "A/E 분석 — 경험률 vs 참조율",
        desc: "기대사망 Σ(노출×참조qx) 대비 A/E와 정확 신뢰구간으로 참조율과의 유의차를 판정합니다.",
        level: "advanced",
        code: `import numpy as np
import pandas as pd
from scipy import stats

# ── 동일 경험데이터 재생성(시드 42 — [노출·조발생률] 섹션과 같은 데이터) ─────────────────
rng = np.random.default_rng(42)
n = 800
def q_ref(age):
    return 8e-4 * np.exp(0.065 * age)
TRUE_RATIO = 1.35
entry_age  = rng.integers(30, 71, n)
plan_years = rng.uniform(1.0, 5.0, n)
rows = []
for a0, plan in zip(entry_age, plan_years):
    age, remain = int(a0), float(plan)
    while remain > 0:
        frac = min(1.0, remain)
        if rng.random() < TRUE_RATIO * q_ref(age) * frac:
            rows.append((age, rng.uniform(0.0, frac), 1.0, 1)); break
        rows.append((age, frac, frac, 0))
        age += 1; remain -= 1.0
py = pd.DataFrame(rows, columns=["age", "exp_central", "exp_initial", "death"])

# ① 기대사망수 E[D] = Σ(노출 × 참조 qx) — 셀(보험연도)별로 곱해 합산
#    qx 기준 A/E이므로 노출도 qx와 짝이 맞는 '초기노출'을 씁니다.
#    (중앙노출을 쓰려면 참조율도 mx 기준으로 환산 — 노출·율의 기준 일치가 핵심)
py["expected"] = py["exp_initial"] * q_ref(py["age"])

D = int(py["death"].sum())
E_exp = py["expected"].sum()
ae = D / E_exp
print(f"실제사망 A = {D}건 · 기대사망 E = {E_exp:.1f}건 · A/E = {ae:.3f} (설정 참값 1.35)")

# ② A/E의 포아송 정확 신뢰구간 — D ~ Poisson(A/E × E)로 보고 구간을 E로 나눔
lo = stats.chi2.ppf(0.025, 2 * D) / (2 * E_exp)
hi = stats.chi2.ppf(0.975, 2 * (D + 1)) / (2 * E_exp)
print(f"A/E 95% CI = [{lo:.3f}, {hi:.3f}]")

# ③ 해석 — 구간이 1(=참조율과 동일)을 포함하는가
if lo > 1:
    print("→ 경험사망률이 참조율보다 유의하게 높음: 참조율 그대로 쓰면 위험률 과소평가")
elif hi < 1:
    print("→ 경험사망률이 참조율보다 유의하게 낮음: 경험률 반영(요율 인하) 여지")
else:
    print("→ 참조율과 유의한 차이 없음: 경험을 더 쌓거나 신뢰도(credibility) 가중 고려")

# ④ 연령대별 A/E — 전체 A/E가 1에 가까워도 구간별로 뒤틀릴 수 있음(믹스 효과)
band = (py["age"] // 5) * 5
g = py.groupby(band).agg(D=("death", "sum"), E=("expected", "sum"))
g["A/E"] = g["D"] / g["E"]
d_safe = g["D"].where(g["D"] > 0, 1)             # D=0 셀은 하한 0 처리용 자리 채움
g["ci_lo"] = np.where(g["D"] > 0,
                      stats.chi2.ppf(0.025, 2 * d_safe) / (2 * g["E"]), 0.0)
g["ci_hi"] = stats.chi2.ppf(0.975, 2 * (g["D"] + 1)) / (2 * g["E"])
g["sig"] = np.where(g["ci_lo"] > 1, "높음↑", np.where(g["ci_hi"] < 1, "낮음↓", "—"))
g.index = [f"{b}-{b+4}" for b in g.index]
print("\\n" + g.round(3).to_string())
print("\\n※ 전체 A/E가 유의해도 구간별 CI는 대부분 1을 포함 — 셀 단위 판단에는"
      "\\n   경험이 부족하므로 부분 신뢰도(credibility)로 참조율과 가중결합하는 것이 실무 순서입니다.")`,
      },
    ],
  },
  {
    id: "graduation",
    name: "위험률 보정",
    en: "Graduation (Whittaker-Henderson)",
    category: "actuarial",
    weight: 2,
    difficulty: 4,
    params: [
      { name: "h (평활 상수)", desc: "벌점 강도 — 작으면 원자료 밀착(과소평활), 크면 매끈(과잉평활로 고연령 지수 증가 훼손). 스케일 의존이라 여러 값을 비교해 선택." },
      { name: "z (차분 차수)", desc: "벌점을 거는 차분의 차수 — 관례는 2 또는 3. z=3이면 2차 곡선(포물선) 성분까지는 벌점 없이 통과시켜 완만한 곡률을 보존합니다." },
      { name: "w (가중치)", desc: "연령별 신뢰도 — 관례는 노출 비례. w를 상수배 하면 h만 조정된 같은 해(평균 1 정규화 권장)." },
      { name: "window (이동평균 창)", desc: "중심 이동평균의 창 크기(홀수) — 클수록 매끈하지만 양끝 (window//2)개 연령이 소실되고, 볼록(지수 증가) 구간에서 위쪽 편향이 커집니다." },
      { name: "UnivariateSpline(w=, s=)", desc: "scipy 평활 스플라인 — w=1/표준편차(로그 스케일이면 √사망수)면 s≈n이 관례적 출발점. s를 줄이면 원자료 밀착." },
      { name: "IsotonicRegression(increasing=True)", desc: "보정 후 단조성 위반 시 후처리 — sklearn의 단조 회귀(PAVA)로 연령 증가에 단조 증가하도록 최소 수정합니다." },
    ],
    summary: "들쭉날쭉한 연령별 조발생률을 매끈한 위험률 곡선으로 — 경험생명표 작성의 고전 Whittaker-Henderson",
    intro:
      "보정(graduation)은 들쭉날쭉한 조발생률에서 '참 위험률은 연령에 매끈하다'는 믿음을 벌점으로 수식화해 노이즈만 걷어내는 작업입니다.\n\n- WH = 적합도 Σw(v−u)² + h·평활도 Σ(Δ³u)² 최소화 — 선형계 (W+h·DᵀD)u=Wv 한 번으로 닫힌 해\n- 한국 경험생명표(보험개발원) 작성에 오래 쓰인 고전 기법\n- 보정률은 보험료·책임준비금에 직결 — 매끈함+중·고연령 단조 증가 품질 조건 필요",
    tips: "- h 최적값은 자료 단위·스케일에 의존 — 여러 h의 적합도·평활도·잔차 비교로 선택\n- 검수 필수: 로그축 그래프(직선≈Gompertz) + 단조성 점검(np.diff(u)>0) 후 요율 사용",
    sections: [
      {
        title: "합성 조발생률 + 이동평균 평활의 한계",
        desc: "Gompertz 참값+포아송 노이즈 합성 조발생률로 이동평균의 구조적 한계(끝단 소실·볼록 편향)를 수치로 확인합니다.",
        level: "basic",
        code: `import numpy as np
import pandas as pd

# ① 합성 경험데이터 — 참(true) 위험률은 매끈한 Gompertz 곡선: q_x = a·exp(b·x)
#    30세 0.5‰ → 80세 60‰ 수준(경험생명표의 중·고연령 모양과 유사)
rng = np.random.default_rng(42)
ages = np.arange(30, 81)                       # 30~80세, 51개 연령
a, b = 2.83e-5, 0.0957
q_true = a * np.exp(b * ages)

# ② 연령별 노출(경과 계약년수) — 중년에 두껍고 고연령에서 얇아지는 실무 포트폴리오
exposure = np.round(30000 * np.exp(-(((ages - 47) / 22.0) ** 2)) + 1500)
deaths = rng.poisson(exposure * q_true)        # 사망수 ~ Poisson(E_x · q_x)
q_crude = deaths / exposure                    # 조(粗)발생률 v_x — 확률 변동 포함

# ③ 조발생률이 얼마나 들쭉날쭉한가 — 참값 대비 상대오차
rel_err = q_crude / q_true - 1
print(f"조발생률 상대오차: 평균 {np.mean(np.abs(rel_err))*100:.1f}%  최대 {np.max(np.abs(rel_err))*100:.1f}%")

# ④ 중심 이동평균 — 가장 소박한 평활. 창(window) 안의 값을 그냥 평균
def moving_average(v, window):
    k = window // 2
    out = np.full(len(v), np.nan)
    for i in range(k, len(v) - k):
        out[i] = v[i - k : i + k + 1].mean()
    return out

# ⑤ 한계 1 — 끝단 소실: 창이 잘리는 양끝 (window//2)개 연령은 평활값이 없다
#    (경험생명표에서 가장 아쉬운 고연령 끝단이 정확히 비는 구조적 약점)
print("창 15 → 양끝 7개 연령(30~36세·74~80세)의 평활값이 NaN")

# ⑥ 한계 2 — 곡률 편향(과평활): 위험률은 지수(볼록) 증가라 창 평균이 참값보다 위로 치우침
#    창을 키울수록 노이즈는 줄지만 편향이 커진다 — RMSE와 고연령 편향으로 확인
#    ※ 공정 비교의 핵심: 이동평균은 양끝이 NaN이라 '내부 구간'에만 값이 있다.
#      전 구간(30~80세) 조발생률 RMSE와 나란히 놓으면 개선폭이 부풀려지므로,
#      각 창의 유효 구간에서 조발생률 RMSE를 다시 계산해 같은 잣대로 비교한다.
def rmse_pm(est, mask=None):                   # ‰ 단위 RMSE (NaN 제외, mask로 구간 한정)
    m = ~np.isnan(est)
    if mask is not None:
        m = m & mask
    return float(np.sqrt(np.mean((est[m] - q_true[m]) ** 2)) * 1000)

def bias_pm(est, lo=70, hi=75):                # 70~75세 평균 편향(‰) — 볼록이 큰 구간
    m = (ages >= lo) & (ages <= hi)
    return float(np.nanmean(est[m] - q_true[m]) * 1000)

rows = [{"추정": "조발생률(원자료)", "산출 구간": f"{ages[0]}~{ages[-1]}세",
         "RMSE(‰)": rmse_pm(q_crude), "같은 구간 조발생률(‰)": rmse_pm(q_crude),
         "70~75세 편향(‰)": bias_pm(q_crude)}]
for win in [5, 9, 15]:
    est = moving_average(q_crude, win)
    m = ~np.isnan(est)                         # 이 창이 실제로 값을 낸 연령만
    rows.append({"추정": f"이동평균(창 {win})",
                 "산출 구간": f"{ages[m][0]}~{ages[m][-1]}세",
                 "RMSE(‰)": rmse_pm(est),
                 "같은 구간 조발생률(‰)": rmse_pm(q_crude, m),   # ← 공정 비교 기준
                 "70~75세 편향(‰)": bias_pm(est)})
print(pd.DataFrame(rows).set_index("추정").round(3).to_string())
# 해석: 같은 구간끼리 비교해야 한다 — 창 5는 1.03→0.52‰, 창 9는 0.77→0.29‰로 개선되지만,
#       창 15는 0.69→0.82‰로 원자료보다 오히려 나빠진다(끝단이 잘려 남은 37~73세는
#       원자료 RMSE 자체가 이미 낮은 구간인데도 그렇다).
#       70~75세 편향이 +1.6‰로 커진 것이 원인 — 볼록 구간을 깎아 올리는 과평활.
#       '창 크기 하나'로 노이즈 제거와 모양 보존을 동시에 잡을 수 없다 → WH의 벌점 접근이 답`,
      },
      {
        title: "Whittaker-Henderson 보정 — h·z를 지정해 바로 산출",
        desc: "h=100·z=3·노출 가중을 상수로 지정해 선형계 한 번으로 보정 — 요철 감소·RMSE 개선·단조성 확인(h 선택 근거는 고급 섹션).",
        level: "basic",
        code: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# ── 합성 경험데이터(앞 블록과 동일) — 참값은 Gompertz, 관측은 포아송 노이즈 ─────────────────
rng = np.random.default_rng(42)
ages = np.arange(30, 81); n = len(ages)
a, b = 2.83e-5, 0.0957
q_true = a * np.exp(b * ages)
exposure = np.round(30000 * np.exp(-(((ages - 47) / 22.0) ** 2)) + 1500)
deaths = rng.poisson(exposure * q_true)
v = deaths / exposure * 1000                   # 조발생률(‰) — 보정 대상

# ① 보정 모수를 '지정'한다 — 탐색 없이 관례값으로 바로 결과를 낸다
H = 100.0      # 평활 상수 h: ‰ 스케일에서의 관례적 출발점. 10(원자료 밀착)~1,000(매끈)을 바꿔보세요
Z = 3          # 차분 차수 z: 관례는 2 또는 3. 3이면 2차 곡선(완만한 곡률)은 벌점 없이 통과시킨다
W = exposure / exposure.mean()   # 가중치 w: 노출 비례(데이터가 많은 연령을 더 믿는다), 평균 1로 정규화


# ② Whittaker-Henderson — min Σw(v−u)² + h·Σ(Δ^z u)²
#    미분하면 선형계 (W + h·DᵀD)u = W v 하나 → 반복 없이 한 번에 풀린다
def whittaker_henderson(v, w, h, z=3):
    D = np.eye(len(v))
    for _ in range(z):
        D = np.diff(D, axis=0)                 # z번 차분 → z=3이면 각 행이 [-1, 3, -3, 1]
    return np.linalg.solve(np.diag(w) + h * (D.T @ D), w * v)


u = whittaker_henderson(v, W, H, Z)

# ③ 결과 — 원자료(조발생률)와 보정값을 나란히
tbl = pd.DataFrame({"노출": exposure.astype(int), "사망수": deaths,
                    "조발생률(‰)": v.round(3), "보정(‰)": u.round(3)}, index=ages)
print(f"[Whittaker-Henderson 보정 — h={H:.0f}, z={Z}, 가중치=노출 비례]")
print(tbl.loc[[30, 40, 50, 60, 70, 80]].to_string())

# ④ 해석 — 얼마나 매끈해졌고(요철), 참값에 얼마나 가까워졌나(RMSE)
rough_v = np.abs(np.diff(v, 2)).sum()          # 2차 차분 절대합 = 들쭉날쭉한 정도
rough_u = np.abs(np.diff(u, 2)).sum()
rmse_v = np.sqrt(np.mean((v - q_true * 1000) ** 2))
rmse_u = np.sqrt(np.mean((u - q_true * 1000) ** 2))
print(f"\\n요철(2차 차분 절대합): 조발생률 {rough_v:.2f} → 보정 {rough_u:.2f}  ({1 - rough_u/rough_v:.0%} 감소)")
print(f"참값 RMSE(‰):         조발생률 {rmse_v:.3f} → 보정 {rmse_u:.3f}  ({1 - rmse_u/rmse_v:.0%} 개선)")

# ⑤ 품질 점검 — 중·고연령 단조 증가는 요율에 쓰기 위한 전제
if np.all(np.diff(u) > 0):
    print(f"단조 증가: 전 연령 OK (min Δu = {np.diff(u).min():.4f}‰)")
else:
    print(f"단조 증가 위반 {int((np.diff(u) <= 0).sum())}곳 — h를 키우거나 단조회귀(PAVA)로 후처리")

# ⑥ 전후 플롯 — 로그축이 표준(Gompertz면 직선)
plt.figure(figsize=(7.5, 4.5))
plt.scatter(ages, v, s=16, color="0.6", label="crude rate (obs)")
plt.plot(ages, u, lw=2, label=f"Whittaker-Henderson (h={H:.0f}, z={Z})")
plt.yscale("log")
plt.xlabel("age"); plt.ylabel("mortality rate (permille, log)")
plt.title("Graduation with fixed h")
plt.legend(); plt.tight_layout(); plt.show()`,
      },
      {
        title: "Whittaker-Henderson — 차분행렬·선형계·h 트레이드오프",
        desc: "min Σw(v−u)²+h·Σ(Δ³u)²를 행렬로 구현 — (W+h·DᵀD)u=Wv 한 번 풀고 h=1·100·10000 트레이드오프를 표로 비교합니다.",
        level: "advanced",
        code: `import numpy as np
import pandas as pd

# 합성 경험데이터(앞 블록과 동일) — 참값은 Gompertz, 관측은 포아송 노이즈
rng = np.random.default_rng(42)
ages = np.arange(30, 81); n = len(ages)
a, b = 2.83e-5, 0.0957
q_true = a * np.exp(b * ages)
exposure = np.round(30000 * np.exp(-(((ages - 47) / 22.0) ** 2)) + 1500)
deaths = rng.poisson(exposure * q_true)
v = deaths / exposure * 1000                # 조발생률(‰) — h의 크기는 자료 스케일에 따라 달라짐

# ① 3차 차분행렬 D 만들기 — 항등행렬에 np.diff를 3번 적용
#    Δ³u = u[x+3] − 3u[x+2] + 3u[x+1] − u[x] → 각 행이 [-1, 3, -3, 1]
def diff_matrix(n, z=3):
    D = np.eye(n)
    for _ in range(z):
        D = np.diff(D, axis=0)              # 한 번마다 차분 차수 +1, 행 −1
    return D                                # (n−z) × n

D = diff_matrix(n, 3)
print("D 크기:", D.shape, "| 첫 행 앞 5개:", D[0, :5])   # [-1. 3. -3. 1. 0.]

# ② 가중치 w — 노출 비례(데이터가 많은 연령을 더 믿는다), 평균 1로 정규화
w = exposure / exposure.mean()

# ③ Whittaker-Henderson 보정
#    min Σ w(v−u)² + h Σ(Δ³u)²  ← 적합도(원자료 밀착) + h × 평활도(3차 차분 억제)
#    미분해서 0으로 두면 선형계 (W + h·DᵀD) u = W v 하나로 풀린다 — 반복 없는 닫힌 해
def whittaker_henderson(v, w, h, z=3):
    D = diff_matrix(len(v), z)
    return np.linalg.solve(np.diag(w) + h * (D.T @ D), w * v)

# ④ 구현 검증 — h→0이면 벌점이 없어 보정값 ≈ 원자료 그대로
u0 = whittaker_henderson(v, w, 1e-8)
print(f"h≈0 검증: max|u−v| = {np.max(np.abs(u0 - v)):.2e} (0에 가까우면 구현 정상)")

# ⑤ h에 따른 적합도 vs 평활도 트레이드오프 — 참값 RMSE가 U자를 그린다
rows = []
for h in [1, 100, 10000]:
    u = whittaker_henderson(v, w, h)
    rows.append({
        "h": h,
        "적합도 Σw(v−u)²": np.sum(w * (v - u) ** 2),       # 클수록 원자료에서 멀어짐
        "평활도 Σ(Δ³u)²": np.sum(np.diff(u, 3) ** 2),      # 작을수록 매끈
        "참값 RMSE(‰)": np.sqrt(np.mean((u - q_true * 1000) ** 2)),
    })
print(pd.DataFrame(rows).round(4).to_string(index=False))
print(f"(비교) 조발생률 RMSE = {np.sqrt(np.mean((v - q_true*1000)**2)):.4f}‰")
# 해석: h=1은 과소평활(원자료를 따라 출렁), h=10000은 과잉평활(고연령 지수 증가를 깎음).
#       h=100이 중간 최적 — 조발생률 1.54‰ → 1.04‰로 개선

# ⑥ 이동평균과 공정 비교 — 같은 연령대(34~76세, 이동평균 창 9의 유효 구간)에서
ma9 = np.convolve(v, np.ones(9) / 9, mode="valid")     # 34~76세만 산출됨
mid = slice(4, n - 4)
rmse_ma = np.sqrt(np.mean((ma9 - q_true[mid] * 1000) ** 2))
u100 = whittaker_henderson(v, w, 100)
rmse_wh = np.sqrt(np.mean((u100[mid] - q_true[mid] * 1000) ** 2))
print(f"34~76세 RMSE: 이동평균(창9) {rmse_ma:.4f}‰  vs  WH(h=100) {rmse_wh:.4f}‰")
print("→ 정확도는 대등 이상 + WH는 이동평균이 못 주는 양끝 연령 보정값까지 제공")`,
      },
      {
        title: "스플라인 비교·전후 플롯·단조성 확인",
        desc: "스플라인(로그 적합)과 정확도 비교, 로그축 겹쳐 그리기, 단조성 확인까지 요율 사용 전 검수를 수행합니다.",
        level: "advanced",
        code: `import numpy as np
import matplotlib.pyplot as plt
from scipy.interpolate import UnivariateSpline

# 합성 경험데이터(앞 블록과 동일)
rng = np.random.default_rng(42)
ages = np.arange(30, 81); n = len(ages)
a, b = 2.83e-5, 0.0957
q_true = a * np.exp(b * ages)
exposure = np.round(30000 * np.exp(-(((ages - 47) / 22.0) ** 2)) + 1500)
deaths = rng.poisson(exposure * q_true)
v = deaths / exposure * 1000                       # 조발생률(‰)

# Whittaker-Henderson(앞 블록의 함수) — h=100
def whittaker_henderson(v, w, h, z=3):
    D = np.eye(len(v))
    for _ in range(z):
        D = np.diff(D, axis=0)
    return np.linalg.solve(np.diag(w) + h * (D.T @ D), w * v)

u_wh = whittaker_henderson(v, exposure / exposure.mean(), 100)

# ① scipy 평활 스플라인 — 사망률은 로그 스케일에서 적합(Gompertz가 로그축에서 직선이라 유리)
#    Var(log v) ≈ 1/사망수(포아송 델타법) → 가중치 w = 1/표준편차 = √사망수, s≈자료 개수 n이 관례
#    (같은 호출에서 log만 빼고 원 스케일로 적합하면 RMSE 1.53‰ — 조발생률 1.54‰와 사실상
#     같아져 평활 효과가 사라진다. w=√D는 '로그 스케일의' 분산 구조에 맞춘 가중이라
#     원 스케일에 그대로 쓰면 사망률이 높은 고연령을 과대 가중해 스플라인이 노이즈를
#     따라간다 — 매듭 수 2개(로그) vs 30개(원 스케일)로 확인된다.
#     아래 ①을 np.log 없이 돌려 직접 비교해 보세요.)
spl = UnivariateSpline(ages, np.log(v), w=np.sqrt(deaths), k=3, s=n)
u_spl = np.exp(spl(ages))
print(f"스플라인 매듭(knot) 수: {len(spl.get_knots())}개 — s를 줄이면 매듭이 늘어 원자료 밀착")

# ② 정확도 비교 — 참값 RMSE(‰)
for name, u in [("조발생률", v), ("WH(h=100)", u_wh), ("로그 스플라인", u_spl)]:
    print(f"{name:>8}: RMSE {np.sqrt(np.mean((u - q_true*1000)**2)):.4f}‰")
# 스플라인이 근소하게 앞서는 건 참값이 마침 로그-직선(Gompertz)이기 때문 —
# 실제 경험률처럼 굴곡(사고 hump 등)이 있으면 형태 가정 없는 WH가 안전하다

# ③ 전후 비교 플롯 — 로그축이 표준(직선 = Gompertz), 관측 점 + 보정 곡선 겹쳐 보기
plt.figure(figsize=(8, 5))
plt.scatter(ages, v, s=18, color="0.6", label="crude rate (obs)")
plt.plot(ages, q_true * 1000, "k--", lw=1, label="true Gompertz")
plt.plot(ages, u_wh, lw=2, label="Whittaker-Henderson (h=100)")
plt.plot(ages, u_spl, lw=2, ls=":", label="log-spline (s=n)")
plt.yscale("log")
plt.xlabel("age"); plt.ylabel("mortality rate (permille, log)")
plt.title("Graduation: before vs after")
plt.legend(); plt.tight_layout(); plt.show()

# ④ 보정 후 단조성 확인 — 중·고연령 사망률은 연령 증가에 단조 증가해야 요율에 쓸 수 있다
for name, u in [("WH", u_wh), ("스플라인", u_spl)]:
    d = np.diff(u)
    if np.all(d > 0):
        print(f"{name}: 전 연령 단조 증가 OK (min Δu = {d.min():.4f}‰)")
    else:
        bad = ages[:-1][d <= 0]
        print(f"{name}: 단조성 위반 {len(bad)}곳 — 연령 {bad.tolist()}")
# 위반이 나오면: h를 키우거나 단조 회귀(PAVA)로 후처리
#   from sklearn.isotonic import IsotonicRegression
#   u_fix = IsotonicRegression(increasing=True).fit_transform(ages, u_wh)`,
      },
    ],
  },
  {
    id: "kaplan-meier",
    name: "생존분석(웹 실행)",
    en: "Kaplan-Meier · Nelson-Aalen",
    category: "actuarial",
    weight: 3,
    difficulty: 3,
    params: [
      { name: "time, event 배열", desc: "가입 후 경과월과 사건 지표(1=사망, 0=중도절단). 절단을 1로 잘못 코딩하면 사망률이 크게 부풀려짐 — 가장 흔한 치명적 실수." },
      { name: "고유 사건시점 t_i (np.unique)", desc: "S(t)는 사망 시점에서만 계단식 하락 — 절단만 있는 시점은 위험집합 n_i만 줄입니다(절단 정보를 버리지 않는 핵심 장치)." },
      { name: "위험집합 n_i = Σ(time ≥ t_i)", desc: "시점 t_i 직전까지 살아 있고 절단되지 않은 계약 수. 관찰 후반에는 n_i가 얇아져 추정이 급격히 불안정해지므로 꼬리 구간 해석에 주의." },
      { name: "Greenwood 분산", desc: "Var[Ŝ]=Ŝ²·Σdᵢ/(nᵢ(nᵢ−dᵢ)) — KM 표준오차. ±1.96·SE 구간은 [0,1] 이탈 가능 → 클리핑 또는 log(−log) 변환." },
      { name: "exp(−H) vs KM", desc: "H(t)=Σdᵢ/nᵢ에서 S≈exp(−H) — KM보다 항상 크거나 같고(1−x ≤ e⁻ˣ) 표본이 충분하면 거의 일치. 괴리는 위험집합이 얇다는 경고." },
      { name: "log-rank 가중", desc: "표준은 동일 가중(비례위험에 최강력) — 조기 차이에 민감하려면 nᵢ 가중 Wilcoxon(Gehan), 가중치만 바꾸면 같은 코드." },
    ],
    summary: "KM 생존곡선·Nelson-Aalen 누적위험·log-rank를 numpy로 직접 구현 — 웹 실행기에서 바로 돌아가는 생존분석",
    intro:
      "lifelines 없이 numpy만으로 KM·Nelson-Aalen·log-rank를 직접 구현한 생존분석 웹 실행판입니다(기존 '생존분석' 항목은 브라우저 미지원).\n\n- KM: 사건시점마다 (1−dᵢ/nᵢ)를 곱해 생존곡선 S(t) / Nelson-Aalen: 위험을 더해 누적위험 H(t)\n- log-rank: 두 그룹 곡선이 통계적으로 다른지 검정\n- 보험은 중도절단(해지·만기·관찰종료)이 기본값 — 제외하면 사망률 왜곡, KM은 절단을 버리지 않음\n- 용도: 조사망률 검토·해지율(유지율) 곡선·성별/채널 분리 산출 근거 확인",
    tips: "- event 코딩(1=사망, 0=절단) 검증이 최우선 — 뒤집히면 모든 결과 무의미\n- 위험집합이 수십 건 이하인 꼬리 구간은 단독 인용 금지 — 필요하면 모수 모형(지수·와이블) 병행",
    sections: [
      {
        title: "① Kaplan-Meier — S(t)=Π(1−dᵢ/nᵢ) 직접 구현 + Greenwood 95% CI",
        desc: "지수분포 사망+절단 합성 데이터로 KM을 구현하고 이론 생존함수 exp(−t/80) 커버리지를 검증합니다.",
        level: "basic",
        code: `import numpy as np
import matplotlib.pyplot as plt

# ── 합성 경험데이터: 가입 후 경과월 · event(1=사망, 0=중도절단) ─────────────────
# ① 잠재 사망시점을 지수분포(평균 80개월)로 생성 → 이론 생존함수 S(t)=exp(-t/80)과
#    KM 추정치를 직접 비교해 구현이 맞는지 검증할 수 있다(합성 데이터의 장점).
#    중도절단(censoring) = 해지(평균 60개월 지수분포) 또는 관찰종료(120개월 시점).
rng = np.random.default_rng(42)
n = 400
death = rng.exponential(scale=80.0, size=n)          # 잠재 사망시점(월)
lapse = rng.exponential(scale=60.0, size=n)          # 잠재 해지시점(월) — 절단 원인 1
admin = 120.0                                        # 관찰종료(월)     — 절단 원인 2
time = np.minimum(np.minimum(death, lapse), admin)   # 실제 관측된 경과월
event = (death <= np.minimum(lapse, admin)).astype(int)  # 1=사망 관측, 0=중도절단
print(f"관측 {n}건 — 사망 {event.sum()}건, 중도절단 {n - event.sum()}건 "
      f"(절단율 {1 - event.mean():.0%})")

# ② Kaplan-Meier: 사망이 실제 발생한 고유 시점 t_i마다 S(t) ← S(t)·(1 − d_i/n_i)
#    d_i = 시점 t_i의 사망 수, n_i = 직전까지 남아 있던 위험집합(at risk) 크기.
#    절단만 있는 시점에서는 S가 내려가지 않고 위험집합 n_i만 줄어든다 — 이것이
#    '절단 계약을 버리지 않고 정보를 쓰는' KM의 핵심이다.
uniq_t = np.unique(time[event == 1])                 # 고유 사건(사망) 시점 정렬
S = 1.0
greenwood = 0.0
surv, gw_sum = [], []
for t in uniq_t:
    n_i = np.sum(time >= t)                          # 위험집합: t 직전 생존·미절단
    d_i = np.sum((time == t) & (event == 1))         # 시점 t 사망 수
    S *= 1.0 - d_i / n_i
    greenwood += d_i / (n_i * (n_i - d_i))           # Greenwood 분산 누적항
    surv.append(S)
    gw_sum.append(greenwood)
surv, gw_sum = np.array(surv), np.array(gw_sum)

# ③ Greenwood 95% 신뢰구간: Var[S(t)] = S(t)² · Σ d_i/(n_i(n_i−d_i))
se = surv * np.sqrt(gw_sum)
lo = np.clip(surv - 1.96 * se, 0.0, 1.0)             # 확률이므로 [0,1]로 클리핑
hi = np.clip(surv + 1.96 * se, 0.0, 1.0)

# ④ 검증 — 이론값 exp(-t/80)이 신뢰구간 안에 들어오는지 확인
print("\\n시점(월)   KM 추정   95% CI(Greenwood)     이론값")
for t_chk in (24, 60, 96):
    i = np.searchsorted(uniq_t, t_chk, side="right") - 1
    theo = np.exp(-t_chk / 80.0)
    print(f"S({t_chk:>3})   {surv[i]:.4f}   [{lo[i]:.4f}, {hi[i]:.4f}]   {theo:.4f}")

# ⑤ 계단 플롯 — KM 곡선은 사건 시점에서만 계단식으로 내려간다(plt.step)
plt.figure(figsize=(7, 4.5))
plt.step(np.r_[0, uniq_t], np.r_[1, surv], where="post", label="Kaplan-Meier")
plt.step(np.r_[0, uniq_t], np.r_[1, lo], where="post", lw=0.8, alpha=0.6,
         color="tab:orange", label="95% CI (Greenwood)")
plt.step(np.r_[0, uniq_t], np.r_[1, hi], where="post", lw=0.8, alpha=0.6,
         color="tab:orange")
ts = np.linspace(0, 120, 200)
plt.plot(ts, np.exp(-ts / 80.0), "--", color="gray", label="theory exp(-t/80)")
plt.xlabel("months since issue"); plt.ylabel("S(t)")
plt.title("Kaplan-Meier survival curve")
plt.legend(); plt.tight_layout(); plt.show()`,
      },
      {
        title: "② Nelson-Aalen 누적위험 H(t) — S≈exp(−H)와 KM 비교",
        desc: "같은 데이터로 H(t)=Σdᵢ/nᵢ 추정 — 지수분포면 직선 t/80이므로 구현과 가정을 한 번에 점검합니다.",
        level: "advanced",
        code: `import numpy as np
import matplotlib.pyplot as plt

# ── 데이터: ①과 동일한 합성 경험데이터(시드 고정 → 완전히 같은 표본) ─────────────────
rng = np.random.default_rng(42)
n = 400
death = rng.exponential(scale=80.0, size=n)
lapse = rng.exponential(scale=60.0, size=n)
admin = 120.0
time = np.minimum(np.minimum(death, lapse), admin)
event = (death <= np.minimum(lapse, admin)).astype(int)

# ① Nelson-Aalen 누적위험(cumulative hazard): H(t) = Σ_{t_i≤t} d_i/n_i
#    '지금까지 겪은 위험의 총량'. 지수분포(상수위험 λ=1/80)라면 H(t)=t/80 직선이
#    되어야 하므로, 추정된 H가 직선에 붙는지로 구현·가정을 동시에 점검할 수 있다.
uniq_t = np.unique(time[event == 1])
d = np.array([np.sum((time == t) & (event == 1)) for t in uniq_t])
n_at_risk = np.array([np.sum(time >= t) for t in uniq_t])
H = np.cumsum(d / n_at_risk)                     # Nelson-Aalen H(t)

# ② KM도 같은 d_i, n_i로 계산 — S_KM = Π(1−d_i/n_i), S_NA = exp(−H)
S_km = np.cumprod(1.0 - d / n_at_risk)
S_na = np.exp(-H)

# ③ 비교: exp(−H)는 KM보다 항상 크거나 같고(1−x ≤ e^{-x}), 표본이 크면 거의 일치.
#    둘의 차이가 크면 위험집합이 얇아진 구간(꼬리)이므로 해석에 주의.
print("시점(월)   H(t)추정  이론 t/80   S_KM     exp(-H)   차이")
for t_chk in (24, 60, 96):
    i = np.searchsorted(uniq_t, t_chk, side="right") - 1
    print(f"{t_chk:>5}     {H[i]:.4f}   {t_chk/80:.4f}    "
          f"{S_km[i]:.4f}   {S_na[i]:.4f}   {S_na[i]-S_km[i]:+.4f}")
print(f"\\n최대 |exp(-H) - S_KM| = {np.max(np.abs(S_na - S_km)):.4f}  (표본 충분 → 근소)")

# ④ 플롯 — 왼쪽: H(t) 계단 vs 이론 직선 t/80, 오른쪽: S_KM vs exp(−H)
fig, axes = plt.subplots(1, 2, figsize=(10, 4))
axes[0].step(np.r_[0, uniq_t], np.r_[0, H], where="post", label="Nelson-Aalen H(t)")
ts = np.linspace(0, 120, 100)
axes[0].plot(ts, ts / 80.0, "--", color="gray", label="theory t/80")
axes[0].set_xlabel("months"); axes[0].set_ylabel("H(t)"); axes[0].legend()
axes[0].set_title("cumulative hazard")
axes[1].step(np.r_[0, uniq_t], np.r_[1, S_km], where="post", label="KM")
axes[1].step(np.r_[0, uniq_t], np.r_[1, S_na], where="post", ls="--", label="exp(-H)")
axes[1].set_xlabel("months"); axes[1].set_ylabel("S(t)"); axes[1].legend()
axes[1].set_title("KM vs exp(-H)")
plt.tight_layout(); plt.show()`,
      },
      {
        title: "③ log-rank 검정 — 남/녀 생존곡선 차이(χ²(1)) 직접 구현",
        desc: "남성 위험 1.5배 설계 데이터로 검정력을, 동일 위험(음성 대조)으로 거짓 신호 여부를 검증합니다.",
        level: "advanced",
        code: `import numpy as np
from scipy import stats

# ── 두 그룹(남/녀) 합성 경험데이터 — 남성 사망위험을 여성의 1.5배로 설계 ─────────────────
# ① 남성 평균 사망시점 70개월, 여성 105개월(위험비 HR = 105/70 = 1.5).
#    log-rank 검정이 이 '설계된 차이'를 잡아내는지 검증한다.
rng = np.random.default_rng(42)
n = 500
male = rng.random(n) < 0.5                        # True=남, False=여
scale = np.where(male, 70.0, 105.0)               # 지수분포 평균(월)
death = rng.exponential(scale=scale)
lapse = rng.exponential(scale=60.0, size=n)       # 중도절단: 해지
admin = 120.0                                     #           관찰종료
time = np.minimum(np.minimum(death, lapse), admin)
event = (death <= np.minimum(lapse, admin)).astype(int)
g = male.astype(int)                              # 그룹 1=남, 0=여
print(f"남 {male.sum()}건(사망 {event[male].sum()}) / "
      f"여 {(~male).sum()}건(사망 {event[~male].sum()})")


# ② log-rank 검정 직접 구현 — 각 사건시점에서 '차이가 없다면(H0) 그룹1에서
#    몇 건 죽었어야 하나'(기대사건수 E)를 계산해 관측(O)과의 괴리를 합산한다.
def logrank(time, event, g):
    uniq_t = np.unique(time[event == 1])          # 두 그룹 합동(pooled) 사건시점
    O1 = E1 = V = 0.0
    for t in uniq_t:
        at = time >= t                            # 시점 t 위험집합
        n_all, n1 = at.sum(), (at & (g == 1)).sum()
        d_all = ((time == t) & (event == 1)).sum()          # 전체 사망 수
        d1 = ((time == t) & (event == 1) & (g == 1)).sum()  # 그룹1 사망 수
        if n_all < 2:
            continue                              # 위험집합 1건 이하 → 정보 없음
        O1 += d1
        E1 += d_all * n1 / n_all                  # H0 하 그룹1 기대사건수(초기하)
        V += (d_all * (n1 / n_all) * (1 - n1 / n_all)
              * (n_all - d_all) / (n_all - 1))    # 초기하 분산
    chi2 = (O1 - E1) ** 2 / V                     # ~ χ²(자유도 1)
    p = stats.chi2.sf(chi2, df=1)
    return O1, E1, chi2, p


O1, E1, chi2, p = logrank(time, event, g)
print(f"\\n[log-rank] 남성 관측사망 O={O1:.0f}, 기대사망 E={E1:.1f} (O>E → 남성 위험 높음)")
print(f"chi2(1) = {chi2:.2f},  p = {p:.2e}")
print("=> p < 0.05: 남녀 생존곡선이 다르다 — 성별 구분 위험률(요율)이 정당화된다"
      if p < 0.05 else "=> 유의한 차이 없음")

# ③ 음성 대조(negative control): 두 그룹을 '같은 분포'로 다시 생성하면
#    p가 커야(보통 >0.05) 검정이 거짓 신호를 내지 않는 것 — 구현 자체의 검증.
death0 = rng.exponential(scale=80.0, size=n)      # 남녀 동일 위험
lapse0 = rng.exponential(scale=60.0, size=n)
time0 = np.minimum(np.minimum(death0, lapse0), admin)
event0 = (death0 <= np.minimum(lapse0, admin)).astype(int)
_, _, chi2_0, p0 = logrank(time0, event0, g)
print(f"\\n[음성 대조 — 동일 위험] chi2(1) = {chi2_0:.2f},  p = {p0:.3f} (유의하지 않아야 정상)")`,
      },
    ],
  },
  {
    id: "credibility",
    name: "신뢰도 이론",
    en: "Credibility Theory",
    category: "actuarial",
    weight: 3,
    difficulty: 4,
    params: [
      { name: "p · k (완전신뢰도 기준)", desc: "신뢰수준 p·허용오차 k — 관례 p=90%·k=5%면 포아송 빈도 기준 n_full=(z/k)²=1,082건, 조일수록(k↓·p↑) 필요 건수 급증." },
      { name: "n_full · Z=√(n/n_full)", desc: "완전신뢰도 기준 건수와 부분신뢰도(제곱근 법칙, 상한 1). 건수만으로 결정되는 단순 규칙이라 실무 소통이 쉽지만 p·k 선택이 임의적." },
      { name: "EPV (기대과정분산)", desc: "같은 계약 안에서 연도별 관측이 흔들리는 정도(관측 잡음)의 기대값. 클수록 자기 경험을 덜 믿게 됨(Z↓)." },
      { name: "VHM (가설평균분산)", desc: "계약 간 참 위험도 θ의 이질성. 클수록 '계약마다 정말 다르다'는 뜻이라 자기 경험을 더 믿음(Z↑). 추정치가 음수면 이질성 근거 없음 → Z=0." },
      { name: "k = EPV/VHM · Z = n/(n+k)", desc: "Bühlmann 신뢰도 상수와 신뢰도 계수. n은 관측 연수(관측 개수). 관측이 쌓일수록 Z→1." },
      { name: "m_it (노출)", desc: "Bühlmann-Straub의 가중치 — 계약·연도별 노출(피보험자 수·경과계약 등)이 다르면 연수 대신 노출 총량이 기준: Z_i=m_i/(m_i+k)." },
    ],
    summary: "경험요율의 핵심 — 자기 경험 X̄와 집단(매뉴얼) 요율 M을 신뢰도 Z로 가중평균 P = Z·X̄ + (1−Z)·M",
    intro:
      "신뢰도(credibility) 이론은 '관측 경험을 얼마나 믿을 것인가'를 Z(0~1)로 정해 P = Z·X̄ + (1−Z)·M으로 요율을 섞는 계리학의 고전입니다.\n\n- 데이터 충분 → Z→1(자기 경험 위주), 부족 → Z→0(매뉴얼 요율 위주)\n- 제한변동: 건수 기반 규칙 — 완전신뢰도 1,082건, 모자라면 제곱근 법칙\n- Bühlmann: 계약 내 잡음(EPV) vs 계약 간 이질성(VHM) 분해 → 최적 선형 Z = n/(n+k)\n- 용도: 단체보험·재보험 특약 경험요율 — 경험이 얇으면 참조순보험요율을 M으로 결합",
    tips: "- Z는 품질 점수가 아니라 상대적 정보량 — EPV 대비 VHM 비율이 결정\n- 완전신뢰도 1,082건은 포아송 '빈도' 기준 — 심도 변동 반영 시 (1+CV²)배로 증가\n- 경험 데이터는 추세·인플레이션 보정(on-level) 후 적용",
    sections: [
      {
        title: "제한변동 신뢰도 — 완전신뢰도 1,082건과 신뢰도 보험료",
        desc: "'빈도가 참값 ±5% 이내일 확률 90%' 기준 1,082건으로 완전신뢰도, 모자라면 제곱근 법칙 — 몬테카를로로 기준을 검증합니다.",
        level: "basic",
        code: `import numpy as np
from scipy import stats

# ① 완전신뢰도(full credibility) 기준 — "관측 건수가 몇 건이면 내 경험을 100% 믿나?"
#    기준: 관측 빈도가 참값의 ±k(허용오차) 이내일 확률이 p(신뢰수준) 이상
#    사고건수 N ~ Poisson(λ)이면 N/λ가 근사 정규 → n_full = (z/k)^2
p, k = 0.90, 0.05                       # 관례: 90% 확률로 ±5% 이내
z = stats.norm.ppf((1 + p) / 2)         # 양측이므로 (1+p)/2 분위수 = 1.6449
n_full = (z / k) ** 2
print(f"z = {z:.4f} → 완전신뢰도 기준 n_full = {n_full:.1f}건 (올림 {int(np.ceil(n_full)):,}건)")
# 고전 수치: p=90%, k=5% → 1,082건 (계리 교과서 단골 결과)

# ② 몬테카를로 검증 — 정말 1,082건이면 ±5% 이내일 확률이 90%인가?
rng = np.random.default_rng(42)
lam = int(np.ceil(n_full))              # 연간 기대 건수 = 1,082
sims = rng.poisson(lam, size=200_000)
within = np.mean(np.abs(sims / lam - 1) <= k)
print(f"시뮬레이션 P(|N/λ−1| ≤ {k:.0%}) = {within:.4f}  (이론 목표 {p:.2f})")

# ③ 부분신뢰도 Z = √(n/n_full) — 건수가 모자라면 그 비율의 제곱근만큼만 믿는다
for n in [100, 250, 500, 1082]:
    Z = min(1.0, np.sqrt(n / n_full))
    print(f"  관측 {n:>5,}건 → Z = {Z:.3f}")

# ④ 신뢰도 보험료 P = Z·X̄ + (1−Z)·M — 단체보험 갱신 요율 예시
#    X̄: 자사(그 단체) 경험 요율, M: 매뉴얼 요율(참조요율 등 사전 기대치)
n_obs = 400                              # 최근 3년 관측 사고건수
xbar = 182_000                           # 경험 1인당 순보험료(원)
M = 150_000                              # 매뉴얼 요율(원)
Z = min(1.0, np.sqrt(n_obs / n_full))
P = Z * xbar + (1 - Z) * M
print(f"\\nZ = {Z:.3f} → 신뢰도 보험료 = {Z:.3f}×{xbar:,} + {1-Z:.3f}×{M:,} = {P:,.0f}원")
print("→ 경험이 쌓일수록(n↑) 요율이 매뉴얼에서 자사 경험 쪽으로 이동")`,
      },
      {
        title: "Bühlmann 신뢰도 — EPV·VHM 분해와 수축(shrinkage)",
        desc: "7개×6년 패널에서 분포 가정 없이 EPV·VHM을 불편추정해 Z=n/(n+k) — 신뢰도 보험료의 MSE 우위를 확인합니다.",
        level: "advanced",
        code: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# ① 합성 패널 데이터 — 단체계약 7개 × 관측 6년, X_it = 계약 i의 t년 사고건수
#    참 위험도 θ_i ~ Gamma(3, 2.5): 평균 7.5건, 계약 간 이질성(VHM) 18.75
#    X_it | θ_i ~ Poisson(θ_i): 과정분산(EPV) = E[θ] = 7.5 (포아송은 분산=평균)
rng = np.random.default_rng(42)
I, T = 7, 6
alpha_g, beta_g = 3.0, 2.5
theta = rng.gamma(alpha_g, beta_g, size=I)          # 각 계약의 '참' 연간 기대 건수
X = rng.poisson(theta[:, None], size=(I, T)).astype(float)
EPV_true, VHM_true = alpha_g * beta_g, alpha_g * beta_g**2

# ② Bühlmann 비모수 추정 — 분포 가정 없이 데이터에서 EPV·VHM을 불편추정
xbar_i = X.mean(axis=1)                              # 계약별 평균
xbar = xbar_i.mean()                                 # 전체(집단) 평균
EPV = X.var(axis=1, ddof=1).mean()                   # 계약 내 분산의 평균
VHM = xbar_i.var(ddof=1) - EPV / T                   # 계약 간 분산 − 표본평균 잡음 보정
VHM = max(VHM, 0.0)                                  # 음수면 이질성 없음 → Z=0
print(f"EPV(계약 내 변동) 추정 {EPV:.2f}  (이론 {EPV_true:.2f})")
# 계약이 7개뿐이라 VHM 추정은 '이번에 뽑힌 7개 θ'의 이질성을 반영 → 뽑힌 θ의 분산과 비교
print(f"VHM(계약 간 이질성) 추정 {VHM:.2f}  "
      f"(뽑힌 θ의 분산 {theta.var(ddof=1):.2f} · 모집단 이론 {VHM_true:.2f})")

# ③ 신뢰도 계수 Z = n/(n+k), k = EPV/VHM
#    잡음(EPV)이 크면 k↑ → Z↓(집단 평균 쪽), 이질성(VHM)이 크면 k↓ → Z↑(자기 경험 쪽)
k = EPV / VHM
Z = T / (T + k)
print(f"k = EPV/VHM = {k:.3f} → Z = {T}/({T}+{k:.2f}) = {Z:.3f}")

# ④ 계약별 신뢰도 보험료 P_i = Z·X̄_i + (1−Z)·X̄ — 자기 경험과 집단 평균의 가중평균
P = Z * xbar_i + (1 - Z) * xbar
tbl = pd.DataFrame({
    "참 θ_i": theta.round(2),
    "경험평균 X̄_i": xbar_i.round(2),
    "신뢰도보험료 P_i": P.round(2),
}, index=[f"계약{i+1}" for i in range(I)])
print("\\n", tbl, sep="")

# ⑤ 검증 — 신뢰도 보험료가 원시 경험평균보다 참값 θ에 가까운가? (MSE 비교)
mse_raw = np.mean((xbar_i - theta) ** 2)
mse_cred = np.mean((P - theta) ** 2)
print(f"\\nMSE: 경험평균 {mse_raw:.3f}  vs  신뢰도보험료 {mse_cred:.3f}"
      f"  → {'신뢰도 쪽이 참값에 더 가깝다' if mse_cred < mse_raw else '이번 표본은 예외'}")

# ⑥ 수축(shrinkage) 시각화 — 경험평균이 집단 평균 쪽으로 (1−Z)만큼 끌려간다
#    (웹 실행기 기본 폰트에 한글이 없어 그래프 라벨은 영문 표기)
fig, ax = plt.subplots(figsize=(7, 4))
idx = np.arange(I)
ax.scatter(idx, xbar_i, marker="o", label="raw mean (X̄_i)")
ax.scatter(idx, P, marker="s", label="credibility premium (P_i)")
ax.scatter(idx, theta, marker="x", label="true θ_i")
for i in idx:
    ax.annotate("", xy=(i, P[i]), xytext=(i, xbar_i[i]),
                arrowprops=dict(arrowstyle="->", lw=0.8))
ax.axhline(xbar, ls="--", lw=1, label="collective mean")
ax.set_xticks(idx, [f"C{i+1}" for i in idx])
ax.set_ylabel("annual claim count")
ax.set_title(f"Buhlmann shrinkage: Z={Z:.2f}")
ax.legend()
plt.tight_layout()
plt.show()`,
      },
      {
        title: "Bühlmann-Straub — 노출 가중 신뢰도(계약·연도별 노출 상이)",
        desc: "노출이 다르면 노출 총량 m_i가 기준 — 계약별 Z_i와 갱신 요율표를 만들고 포트폴리오 500개 반복으로 MSE 우위를 검증합니다.",
        level: "advanced",
        code: `import numpy as np
import pandas as pd

# ① 합성 데이터 — 단체계약 8개 × 6년, 계약·연도마다 노출(피보험자 수) m_it가 다르다
#    Bühlmann과 달리 관측 단위가 '연도'가 아니라 '노출' — 노출이 큰 해의 경험을 더 믿는다
#    참 1인당 사고율 θ_i ~ Gamma(8, 0.01): 평균 0.08, 모집단 VHM = 8×0.01² = 0.0008
#    N_it | θ_i ~ Poisson(m_it·θ_i) → 빈도 X_it = N_it/m_it 의 과정분산은 θ_i/m_it (EPV = E[θ])
rng = np.random.default_rng(42)
I, T = 8, 6
m = rng.integers(10, 80, size=(I, T)).astype(float)    # 노출: 10~80명 중소 단체, 연도별 상이
theta = rng.gamma(8.0, 0.01, size=I)                    # 계약별 참 사고율
N = rng.poisson(m * theta[:, None])                     # 연도별 사고건수
Xf = N / m                                              # 관측 빈도(1인당)
EPV_true, VHM_true = 8.0 * 0.01, 8.0 * 0.01**2

# ② 노출 가중 통계량 — 노출이 큰 관측일수록 정보가 많으므로 m_it로 가중
m_i = m.sum(axis=1)                                     # 계약별 총노출
m_tot = m_i.sum()
xbar_i = N.sum(axis=1) / m_i                            # 계약별 가중평균 빈도
xbar = (m_i * xbar_i).sum() / m_tot                     # 전체 가중평균

# ③ Bühlmann-Straub 불편추정량
#    EPV: 계약 내 노출가중 제곱편차의 평균 (자유도 Σ(T−1))
EPV = (m * (Xf - xbar_i[:, None]) ** 2).sum() / (I * (T - 1))
#    VHM: 계약 간 가중 제곱편차에서 EPV 기여분을 빼고 노출 보정항 c로 나눔
c = m_tot - (m_i**2).sum() / m_tot
VHM = ((m_i * (xbar_i - xbar) ** 2).sum() - (I - 1) * EPV) / c
VHM = max(VHM, 0.0)                                     # 음수면 이질성 없음 → Z=0
print(f"EPV 추정 {EPV:.4f}  (이론 {EPV_true:.4f})")
# 계약 8개뿐이라 VHM은 '이번에 뽑힌 θ들'의 이질성을 반영 → 뽑힌 θ의 분산과 비교
print(f"VHM 추정 {VHM:.6f}  (뽑힌 θ의 분산 {theta.var(ddof=1):.6f} · 모집단 이론 {VHM_true:.6f})")

# ④ 계약별 신뢰도 — 관측 연수 n이 아니라 '노출 총량 m_i'가 클수록 Z_i↑
k = EPV / VHM
Z_i = m_i / (m_i + k)

# ⑤ 집단 평균은 신뢰도 가중 μ̂ = ΣZ_iX̄_i / ΣZ_i (Bühlmann-Straub 표준 관례)
mu_hat = (Z_i * xbar_i).sum() / Z_i.sum()
P_i = Z_i * xbar_i + (1 - Z_i) * mu_hat                 # 계약별 신뢰도 빈도(1인당)
print(f"k = EPV/VHM = {k:.1f} → Z는 노출 m_i에 따라 {Z_i.min():.3f}~{Z_i.max():.3f}")
print(f"신뢰도 가중 집단 평균 μ̂ = {mu_hat:.4f}  (참 평균 E[θ] = {EPV_true:.4f})")

# ⑥ 갱신 요율표 — 차년도 노출 계획을 곱해 계약별 기대 사고건수 산출
m_next = m[:, -1] * 1.05                                # 차년도 노출: 최근 연도의 105% 가정
tbl = pd.DataFrame({
    "총노출 m_i": m_i.astype(int),
    "경험빈도 X̄_i": xbar_i.round(4),
    "참 θ_i": theta.round(4),
    "Z_i": Z_i.round(3),
    "신뢰도빈도 P_i": P_i.round(4),
    "차년도 기대건수": (P_i * m_next).round(1),
}, index=[f"계약{i+1}" for i in range(I)])
print("\\n", tbl, sep="")
print("→ 노출 총량 m_i가 큰 계약일수록 Z_i가 커져 자기 경험 비중이 커진다(대형 단체 = 경험 위주)")

# ⑦ 검증 — 포트폴리오 500개 반복 생성: 신뢰도 빈도가 '평균적으로' 참 θ에 더 가까운가?
#    (한 표본의 MSE는 운에 좌우 — 신뢰도 이론의 최적성은 기대 MSE 기준)
R, se_raw, se_cred = 500, 0.0, 0.0
for _ in range(R):
    m2 = rng.integers(10, 80, size=(I, T)).astype(float)
    th2 = rng.gamma(8.0, 0.01, size=I)
    N2 = rng.poisson(m2 * th2[:, None])
    X2 = N2 / m2
    mi2 = m2.sum(axis=1); mt2 = mi2.sum()
    xb_i2 = N2.sum(axis=1) / mi2
    xb2 = (mi2 * xb_i2).sum() / mt2
    epv2 = (m2 * (X2 - xb_i2[:, None]) ** 2).sum() / (I * (T - 1))
    c2 = mt2 - (mi2**2).sum() / mt2
    vhm2 = max(((mi2 * (xb_i2 - xb2) ** 2).sum() - (I - 1) * epv2) / c2, 1e-12)
    Z2 = mi2 / (mi2 + epv2 / vhm2)
    mu2 = (Z2 * xb_i2).sum() / Z2.sum()
    P2 = Z2 * xb_i2 + (1 - Z2) * mu2
    se_raw += np.mean((xb_i2 - th2) ** 2)
    se_cred += np.mean((P2 - th2) ** 2)
print(f"\\n[{R}회 반복] 평균 MSE: 경험빈도 {se_raw/R:.3e}  vs  신뢰도빈도 {se_cred/R:.3e}"
      f"  → {'신뢰도 쪽이 평균적으로 우수' if se_cred < se_raw else '점검 필요'}")`,
      },
    ],
  },
  {
    id: "chain-ladder",
    name: "지급준비금",
    en: "Chain-Ladder · BF · Mack",
    category: "actuarial",
    weight: 4,
    difficulty: 4,
    params: [
      { name: "개발계수 추정 방식", desc: "볼륨가중(실무 표준)·단순평균·최근 n개년 평균 — 포트폴리오·지급 속도가 바뀌었으면 최근 연도 가중 검토." },
      { name: "tail factor(꼬리계수)", desc: "마지막 관측 연차 이후 남은 진전 — 배상책임·장기 종목은 로그선형 외삽 tail 없이는 준비금 과소평가(예제는 8년차 완전 진전 가정)." },
      { name: "사전 손해율(ELR) — BF", desc: "기대최종 = 경과보험료×사전 손해율 — 최근 사고연도일수록 BF를 지배(1−1/CDF↑)하므로 출처·갱신 주기 문서화 필요." },
      { name: "σ²_j — Mack 분산모수", desc: "개발계수의 가중잔차 분산 — 마지막 연차는 잔차 1개라 추정 불가 → 외삽 관례식 min(σ⁴/σ², min(σ², σ²))으로 채웁니다." },
      { name: "누적 vs 증분 삼각형", desc: "CL은 '누적' 삼각형 기준 — 증분이면 np.cumsum(axis=1) 변환, 음의 증분(환입·구상)이 잦으면 별도 검토." },
      { name: "np.nan 마스킹", desc: "하삼각(미래)은 np.nan — 개발계수 분자·분모는 두 칸 모두 관측된 행만 합산(~np.isnan), 빼먹으면 계수 왜곡." },
    ],
    summary:
      "런오프 삼각형의 개발 패턴으로 미지급 보험금을 추정 — Chain-Ladder 개발계수·Bornhuetter-Ferguson·Mack 표준오차",
    intro:
      "지급이 끝나지 않은 보험금(보고 지연 IBNR 포함)을 런오프 삼각형의 개발 패턴으로 추정하는 지급준비금 고전 3종 세트입니다.\n\n- Chain-Ladder: 개발계수(누적 지급의 증가 배수)로 하삼각(미래)을 채움\n- BF: 미보고분을 사전 손해율×보험료에 맡겨 최근 연도의 불안정 완화\n- Mack: 준비금 추정치의 표준오차(변동성) 산출\n- IFRS17 이후에도 BEL 산출·검증·백테스트에 사용 — 국내 IBNR 실무의 사실상 표준",
    tips: "- 최근 사고연도 CL은 초기 관측 하나가 누적개발계수(이 예제는 3.8배)로 증폭 — 매우 불안정\n- 사전 손해율이 있으면 BF 병행, 점추정만 말고 Mack 표준오차로 불확실성 함께 제시",
    sections: [
      {
        title: "런오프 삼각형 → 개발계수·삼각형 완성 (Chain-Ladder)",
        desc: "볼륨가중 개발계수로 하삼각을 채워 최종예상·준비금 산출 — NaN 마스킹(관측 행만 합산)이 구현의 핵심.",
        level: "basic",
        code: `import numpy as np
import pandas as pd

# ① 런오프 삼각형 — 행=사고연도(2016~2023), 열=개발연차(1~8년차)
#    값은 '누적' 지급보험금(백만원). 아직 오지 않은 미래(하삼각)는 np.nan.
#    이 예제 삼각형은 참 개발계수 [1.90,1.35,1.18,1.10,1.06,1.03,1.015]로 생성 → 추정치와 대조 검증
tri = np.array([
    [  2335,   4433,   6055,   7090,   7756,   8265,   8534,   8658],   # 2016
    [  2314,   4195,   5503,   6453,   7038,   7489,   7716, np.nan],   # 2017
    [  2683,   5367,   7454,   8884,   9840,  10386, np.nan, np.nan],   # 2018
    [  2871,   5708,   7694,   9141,  10188, np.nan, np.nan, np.nan],   # 2019
    [  2634,   5023,   6743,   8018, np.nan, np.nan, np.nan, np.nan],   # 2020
    [  2884,   5855,   7744, np.nan, np.nan, np.nan, np.nan, np.nan],   # 2021
    [  3284,   6409, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],   # 2022
    [  3404, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],   # 2023
])
n = tri.shape[0]
years = np.arange(2016, 2016 + n)
print("[런오프 삼각형 — 누적 지급보험금(백만원)]")
print(pd.DataFrame(tri, index=years, columns=[f"{j+1}년차" for j in range(n)])
        .to_string(float_format=lambda v: f"{v:,.0f}"))

# ② 볼륨가중 개발계수 f_j = Σc_{i,j+1} / Σc_{i,j}
#    — 분자·분모 모두 '두 칸이 다 관측된 행'만 합산(NaN 마스킹이 핵심)
f = np.ones(n - 1)
for j in range(n - 1):
    m = ~np.isnan(tri[:, j]) & ~np.isnan(tri[:, j + 1])   # 관측된 행만 True
    f[j] = tri[m, j + 1].sum() / tri[m, j].sum()

true_f = [1.90, 1.35, 1.18, 1.10, 1.06, 1.03, 1.015]      # 생성에 쓴 참값
print("\\n[개발계수 — 추정 vs 참값(생성 기준)]")
print(pd.DataFrame({"f_hat": f.round(4), "f_true": true_f},
                   index=[f"{j+1}→{j+2}" for j in range(n - 1)]).to_string())

# ③ 누적개발계수 CDF_j = f_j × f_{j+1} × … (해당 연차 → 최종까지 남은 진전 배수)
#    지급진행률 = 1/CDF — 지금까지 최종의 몇 %가 지급됐는지
cdf = np.append(np.cumprod(f[::-1])[::-1], 1.0)           # 마지막 연차는 1
print("\\n[누적개발계수·지급진행률]")
print(pd.DataFrame({"CDF": cdf.round(4), "지급진행률": (1 / cdf).round(4)},
                   index=[f"{j+1}년차" for j in range(n)]).to_string())

# ④ 삼각형 완성 — 각 사고연도의 최신 관측값에 개발계수를 차례로 곱해 하삼각을 채움
full = tri.copy()
for i in range(n):
    for j in range(n - i, n):                             # i번째 행의 미관측 구간
        full[i, j] = full[i, j - 1] * f[j - 1]

# ⑤ 사고연도별 최종예상(Ultimate)·지급준비금(Reserve = 최종예상 − 현재까지 지급)
latest = np.array([tri[i, n - 1 - i] for i in range(n)])  # 최신 대각선
ultimate = full[:, -1]
reserve = ultimate - latest
res = pd.DataFrame({"현재누적": latest, "최종예상": ultimate.round(0),
                    "준비금": reserve.round(0)}, index=years)
print("\\n[Chain-Ladder 결과(백만원)]")
print(res.to_string(float_format=lambda v: f"{v:,.0f}"))
print(f"\\n총 지급준비금 = {reserve.sum():,.0f} 백만원")

# 검증: 2016년은 8년차까지 전부 관측(완전 진전) → 준비금 0이어야 정상
print(f"검증) 2016년 준비금 = {reserve[0]:.0f} (완전 진전 → 0)")
# 검증: 참 최종값(생성 시 하삼각 포함 값) 대비 오차 — 최근 연도일수록 커지는 게 정상
true_ult = np.array([8658, 7854, 10853, 11355, 9698, 11129, 13485, 11926])
err = (ultimate - true_ult) / true_ult * 100
print("검증) 참 최종값 대비 오차(%):", err.round(1))`,
      },
      {
        title: "Bornhuetter-Ferguson — 사전 손해율과의 결합",
        desc: "미보고분을 경과보험료×사전 손해율에 맡겨 최근 연도를 안정화 — CL과 나란히 비교합니다.",
        level: "advanced",
        code: `import numpy as np
import pandas as pd

# ① 같은 런오프 삼각형(누적 지급보험금, 백만원) — 자체 완결 실행을 위해 다시 정의
tri = np.array([
    [  2335,   4433,   6055,   7090,   7756,   8265,   8534,   8658],   # 2016
    [  2314,   4195,   5503,   6453,   7038,   7489,   7716, np.nan],   # 2017
    [  2683,   5367,   7454,   8884,   9840,  10386, np.nan, np.nan],   # 2018
    [  2871,   5708,   7694,   9141,  10188, np.nan, np.nan, np.nan],   # 2019
    [  2634,   5023,   6743,   8018, np.nan, np.nan, np.nan, np.nan],   # 2020
    [  2884,   5855,   7744, np.nan, np.nan, np.nan, np.nan, np.nan],   # 2021
    [  3284,   6409, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],   # 2022
    [  3404, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],   # 2023
])
n = tri.shape[0]
years = np.arange(2016, 2016 + n)

# 볼륨가중 개발계수 → 누적개발계수(CDF)
f = np.ones(n - 1)
for j in range(n - 1):
    m = ~np.isnan(tri[:, j]) & ~np.isnan(tri[:, j + 1])
    f[j] = tri[m, j + 1].sum() / tri[m, j].sum()
cdf = np.append(np.cumprod(f[::-1])[::-1], 1.0)
cdf_i = cdf[::-1]                  # 사고연도 i의 최신 관측 시점 CDF (2016→1.0, 2023→3.80)

latest = np.array([tri[i, n - 1 - i] for i in range(n)])
ult_cl = latest * cdf_i            # Chain-Ladder 최종예상
res_cl = ult_cl - latest

# ② Bornhuetter-Ferguson — "미보고분은 사전 기대에 맡긴다"
#    기대최종 = 경과보험료 × 사전 손해율(요율산정·사업계획에서 가져온 외부 정보)
#    BF 준비금 = 기대최종 × (1 − 1/CDF)   ← (1−1/CDF) = 아직 안 나타난 비율
premium = np.array([13300, 14100, 14900, 15800, 16700, 17700, 18800, 19900])
prior_lr = 0.62                    # 사전 손해율 62% (요율산정 가정 — 전 연도 공통)
expect_ult = premium * prior_lr
res_bf = expect_ult * (1 - 1 / cdf_i)
ult_bf = latest + res_bf           # BF 최종예상 = 실제 지급 + 기대 기반 미지급

# ③ CL vs BF 나란히 비교 — 최근 연도일수록 두 방법의 차이가 커진다
cmp = pd.DataFrame({
    "현재누적": latest, "기대최종(P×LR)": expect_ult.round(0),
    "CL준비금": res_cl.round(0), "BF준비금": res_bf.round(0),
    "CL최종": ult_cl.round(0), "BF최종": ult_bf.round(0),
}, index=years)
print("[Chain-Ladder vs Bornhuetter-Ferguson (백만원)]")
print(cmp.to_string(float_format=lambda v: f"{v:,.0f}"))
print(f"\\n총준비금  CL = {res_cl.sum():,.0f}   BF = {res_bf.sum():,.0f}")

# ④ 왜 BF인가 — 최근 사고연도는 관측이 적어 CL이 불안정(작은 초기값이 CDF 3.8배로 증폭).
#    BF는 미보고분을 사전 기대에 고정해 초기 관측 노이즈에 둔감하다.
w = 1 / cdf_i                      # 지급진행률 = CL에 주는 신뢰(BF는 1−w)
print("\\n[사고연도별 CL 신뢰비중 w=1/CDF]  (BF는 미보고분 1−w를 사전 기대로 대체)")
print(pd.DataFrame({"w(CL비중)": w.round(3), "1−w(사전기대)": (1 - w).round(3)},
                   index=years).to_string())

# 검증: 사전 기대최종을 'CL 최종예상' 그 자체로 두면 BF ≡ CL (이론 항등식)
res_bf_clprior = ult_cl * (1 - 1 / cdf_i)
print(f"\\n검증) 사전기대=CL최종일 때 BF−CL 최대오차 = "
      f"{np.abs(res_bf_clprior - res_cl).max():.2e}  (0이면 구현 정상)")`,
      },
      {
        title: "Mack 표준오차 — 준비금의 불확실성",
        desc: "분포 가정 없이 재귀식으로 준비금 ±se 산출 — Mack(1993) RAA 공표값(총준비금 52,135·se 26,909)을 재현합니다.",
        level: "advanced",
        code: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# ① 같은 런오프 삼각형(누적 지급보험금, 백만원) — 자체 완결 실행을 위해 다시 정의
tri = np.array([
    [  2335,   4433,   6055,   7090,   7756,   8265,   8534,   8658],   # 2016
    [  2314,   4195,   5503,   6453,   7038,   7489,   7716, np.nan],   # 2017
    [  2683,   5367,   7454,   8884,   9840,  10386, np.nan, np.nan],   # 2018
    [  2871,   5708,   7694,   9141,  10188, np.nan, np.nan, np.nan],   # 2019
    [  2634,   5023,   6743,   8018, np.nan, np.nan, np.nan, np.nan],   # 2020
    [  2884,   5855,   7744, np.nan, np.nan, np.nan, np.nan, np.nan],   # 2021
    [  3284,   6409, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],   # 2022
    [  3404, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan],   # 2023
])
n = tri.shape[0]
years = np.arange(2016, 2016 + n)

# 볼륨가중 개발계수 + 삼각형 완성 (Chain-Ladder)
f = np.ones(n - 1)
for j in range(n - 1):
    m = ~np.isnan(tri[:, j]) & ~np.isnan(tri[:, j + 1])
    f[j] = tri[m, j + 1].sum() / tri[m, j].sum()
full = tri.copy()
for i in range(n):
    for j in range(n - i, n):
        full[i, j] = full[i, j - 1] * f[j - 1]
latest = np.array([tri[i, n - 1 - i] for i in range(n)])
ultimate = full[:, -1]
reserve = ultimate - latest

# ② 분산모수 sigma²_j — 개발계수의 가중잔차 분산 (Mack 1993)
#    sigma²_j = 1/(n_j−1) · Σ_i c_ij·(c_{i,j+1}/c_ij − f_j)²   (관측된 행만)
sigma2 = np.zeros(n - 1)
for j in range(n - 2):                                   # 마지막 열은 잔차 1개뿐 → 별도 처리
    m = ~np.isnan(tri[:, j]) & ~np.isnan(tri[:, j + 1])
    ratio = tri[m, j + 1] / tri[m, j]                    # 행별 개별 개발계수
    sigma2[j] = np.sum(tri[m, j] * (ratio - f[j]) ** 2) / (m.sum() - 1)
# 마지막 sigma²는 로그선형 외삽(Mack의 관례식): 급감 패턴을 이어가되 직전 값을 넘지 않게
sigma2[n - 2] = min(sigma2[n - 3] ** 2 / sigma2[n - 4],
                    min(sigma2[n - 4], sigma2[n - 3]))
print("[분산모수 sigma²_j]")
print(pd.Series(sigma2.round(4), index=[f"{j+1}→{j+2}" for j in range(n - 1)]).to_string())

# ③ 사고연도별 준비금 mse — Mack 재귀 공식
#    mse_i = Û_i² · Σ_j (sigma²_j/f_j²)·(1/Ĉ_ij + 1/S_j),  S_j = f_j 추정에 쓴 열 합
S = np.array([np.nansum(tri[: n - 1 - j, j]) for j in range(n - 1)])
mse = np.zeros(n)
for i in range(1, n):                                    # 2016(i=0)은 완전 진전 → mse 0
    js = np.arange(n - 1 - i, n - 1)                     # 최신 관측 연차부터 최종 직전까지
    mse[i] = ultimate[i] ** 2 * np.sum(
        sigma2[js] / f[js] ** 2 * (1 / full[i, js] + 1 / S[js]))
se = np.sqrt(mse)

# ④ 총준비금 se — 개별 mse 합 + 사고연도 간 공분산(같은 f를 공유해 생기는 양의 상관)
cov_sum = 0.0
for i in range(1, n):
    js = np.arange(n - 1 - i, n - 1)
    cov_sum += ultimate[i] * ultimate[i + 1:].sum() * np.sum(
        2 * sigma2[js] / f[js] ** 2 / S[js])
se_total = np.sqrt(mse.sum() + cov_sum)

cv = [f"{s/r:.1%}" if r > 0 else "—" for r, s in zip(reserve, se)]
out = pd.DataFrame({"준비금": reserve.round(0), "표준오차 se": se.round(0),
                    "CV(se/준비금)": cv}, index=years)
print("\\n[사고연도별 준비금 ± 표준오차 (백만원)]")
print(out.to_string(float_format=lambda v: f"{v:,.0f}"))
print(f"\\n총준비금 = {reserve.sum():,.0f} ± {se_total:,.0f}  (CV {se_total/reserve.sum():.1%})")
print(f"참고) 정규 근사 95% 상한 ≈ {reserve.sum() + 1.96 * se_total:,.0f} 백만원")

# 검증: 총 se는 √(개별 mse 합)보다 커야 정상 — 모든 연도가 같은 f̂를 쓰는 양의 상관 탓
print(f"검증) 총 se {se_total:,.0f} > √Σmse {np.sqrt(mse.sum()):,.0f} → 공분산 반영 확인")

# ⑤ 그림 — 준비금 막대 + ±1se 오차막대 (최근 사고연도일수록 불확실성 커짐)
fig, ax = plt.subplots(figsize=(8, 4))
ax.bar(years, reserve, color="#8fb3e8", label="reserve")
ax.errorbar(years, reserve, yerr=se, fmt="none", ecolor="#333", capsize=4, label="±1 se")
ax.set_title("Chain-Ladder reserve with Mack standard error")
ax.set_xlabel("accident year"); ax.set_ylabel("reserve (million KRW)")
ax.legend(); plt.tight_layout(); plt.show()`,
      },
    ],
  },
  {
    id: "pure-premium",
    name: "순보험료·요율산정",
    en: "Pure Premium & Rating",
    category: "actuarial",
    weight: 4,
    difficulty: 3,
    params: [
      { name: "alpha", desc: "sklearn GLM의 L2 규제 강도 — 기본값 1.0(규제 걸림)! 요율 상대도가 목적이면 alpha=0으로 꺼야 순수 MLE와 일치합니다." },
      { name: "power (TweedieRegressor)", desc: "분산함수 Var(Y)=φ·μ^p의 지수 — 1=포아송, 2=감마, 1<p<2가 복합 포아송–감마(순보험료 형태). 관례적 출발점은 1.5." },
      { name: "sample_weight", desc: "sklearn은 offset 인자가 없어 y를 비율(건수/노출 등)로 두고 분모를 sample_weight로 — 로그 링크에서 offset=log(노출)과 동치." },
      { name: "link", desc: "'auto'도 log지만 명시 권장 — 로그 링크라야 exp(계수)=요율 상대도. Poisson·GammaRegressor는 항상 로그 링크." },
      { name: "fit_intercept / drop_first", desc: "절편 = 기준셀(예: 40대·기본형)의 로그 요율 → exp(절편)=기저 요율. 원핫 시 drop_first=True로 기준 범주를 명확히." },
      { name: "d·u (면책·한도)", desc: "LEV의 계약 조건 — E[(X∧u)−(X∧d)]=∫ᵈᵘ S(x)dx. 면책 d를 올리면 소액 다발 사고가 걸러져 절감률 급증." },
    ],
    summary:
      "빈도(포아송)×심도(감마) 분리와 Tweedie 직접 적합으로 순보험료 산출 — 요율 상대도·오프밸런스·LEV(면책·한도)까지 요율산정 전 과정",
    intro:
      "순보험료(pure premium)는 계약 1단위(노출 1년)의 기대손해액 — 빈도×심도 GLM 또는 Tweedie로 적합해 요율표까지 만듭니다.\n\n- 분리 적합: 빈도 포아송 × 심도 감마(로그 링크) → 순보험료 = E[N]×E[X]\n- Tweedie(1<power<2): 한 모형으로 직접 적합 — 분리 적합과 대조\n- exp(계수) = 요율 상대도 — 상대도 표·오프밸런스·LEV(면책·한도)까지 실무 흐름\n- 웹 실행기용 sklearn 구현(이론·진단은 'GLM' 항목) — 참조순보험료 검증·자동차 상대도·실손 자기부담금 산정이 같은 틀",
    tips: "- sklearn GLM 기본 alpha=1.0(릿지)은 상대도를 1로 수축 — 요율 산출은 alpha=0이 원칙\n- 계약 적은 세그먼트(60대+ 등)는 상대도가 출렁임 — 신뢰도(credibility) 보정이나 캡+오프밸런스로 조정",
    sections: [
      {
        title: "빈도×심도 분리 적합 — PoissonRegressor·GammaRegressor(노출 처리)",
        desc: "합성 600건에 빈도·심도를 따로 적합해 참값 상대도 복원을 검증 — y=비율(건수/노출), 분모=sample_weight 규약.",
        level: "basic",
        code: `import numpy as np
import pandas as pd
from sklearn.linear_model import PoissonRegressor, GammaRegressor

# ① 합성 포트폴리오 600건 — 연령대·상품·노출(경과연수)·건수·총손해액(만원)
rng = np.random.default_rng(42)
n = 600
age = rng.choice(["20대", "30대", "40대", "50대", "60대+"], n,
                 p=[0.15, 0.25, 0.25, 0.20, 0.15])
product = rng.choice(["기본형", "고급형"], n, p=[0.6, 0.4])
exposure = rng.uniform(0.5, 2.0, n).round(2)      # 경과 계약년수(노출)

# 참값 상대도 — 추정치를 검증할 기준(실무에선 모름, 여기선 데이터를 만든 규칙)
f_age = {"20대": 1.6, "30대": 1.2, "40대": 1.0, "50대": 0.9, "60대+": 1.1}
s_age = {"20대": 0.9, "30대": 1.0, "40대": 1.0, "50대": 1.1, "60대+": 1.3}
f_prod = {"기본형": 1.0, "고급형": 1.25}
s_prod = {"기본형": 1.0, "고급형": 1.4}
lam0, mu0 = 0.35, 150.0                            # 기저 빈도(건/년)·기저 평균심도(만원)

lam = lam0 * np.array([f_age[a] for a in age]) * np.array([f_prod[p] for p in product])
mu = mu0 * np.array([s_age[a] for a in age]) * np.array([s_prod[p] for p in product])
n_claims = rng.poisson(lam * exposure)             # 건수 ~ Poisson(빈도×노출)
claim_amt = np.zeros(n)                            # 총손해액 = 건별 감마(shape=2) 심도의 합
pos = n_claims > 0                                 #   (감마 가법성: k건 합 ~ Gamma(2k, mu/2))
claim_amt[pos] = rng.gamma(2.0 * n_claims[pos], (mu / 2.0)[pos]).round(1)

df = pd.DataFrame({"age_band": age, "product": product, "exposure": exposure,
                   "n_claims": n_claims, "claim_amt": claim_amt})
print(df.head(3))
print(f"계약 {len(df)}건, 총 사고 {df['n_claims'].sum()}건, 총손해액 {df['claim_amt'].sum():,.0f}만원")

# ② 원핫 인코딩 — 첫 범주가 기준(reference)이 되도록 순서 지정: 40대·기본형
df["age_band"] = pd.Categorical(df["age_band"], ["40대", "20대", "30대", "50대", "60대+"])
df["product"] = pd.Categorical(df["product"], ["기본형", "고급형"])
X = pd.get_dummies(df[["age_band", "product"]], drop_first=True, dtype=float)

# ③ 빈도 모형 — y=건수/노출(연율화), sample_weight=노출: sklearn의 표준 노출 처리
#    주의! sklearn GLM은 기본이 릿지 규제(alpha=1) → 요율 산출은 반드시 alpha=0
freq = PoissonRegressor(alpha=0, max_iter=300)
freq.fit(X, df["n_claims"] / df["exposure"], sample_weight=df["exposure"])

# ④ 심도 모형 — 사고 난 계약만, y=평균심도(총액/건수), sample_weight=건수
#    GammaRegressor는 로그 링크 → exp(계수)=승수(상대도)로 해석
mask = df["n_claims"] > 0
sev = GammaRegressor(alpha=0, max_iter=300)
sev.fit(X[mask], df.loc[mask, "claim_amt"] / df.loc[mask, "n_claims"],
        sample_weight=df.loc[mask, "n_claims"])

# ⑤ 참값 대비 검증 — exp(계수)=상대도가 데이터 생성 규칙을 복원하는지
#    (600건·사고 348건 소표본이라 ±10~25% 표본 오차 - 실무 요율산정은 수만 건 이상)
true_f = {"age_band_20대": 1.6, "age_band_30대": 1.2, "age_band_50대": 0.9,
          "age_band_60대+": 1.1, "product_고급형": 1.25}
true_s = {"age_band_20대": 0.9, "age_band_30대": 1.0, "age_band_50대": 1.1,
          "age_band_60대+": 1.3, "product_고급형": 1.4}
tbl = pd.DataFrame({
    "빈도 추정": np.exp(freq.coef_).round(3), "빈도 참값": [true_f[c] for c in X.columns],
    "심도 추정": np.exp(sev.coef_).round(3), "심도 참값": [true_s[c] for c in X.columns],
}, index=X.columns)
print("\\n[상대도 복원 - 기준: 40대·기본형 = 1.0]")
print(tbl)
print(f"기저 빈도 exp(절편) = {np.exp(freq.intercept_):.3f} (참값 {lam0})")
print(f"기저 심도 exp(절편) = {np.exp(sev.intercept_):.1f}만원 (참값 {mu0})")

# ⑥ 순보험료 = 연율화 빈도 예측 × 평균심도 예측 (노출 1년 기준, 만원)
df["pure_premium"] = freq.predict(X) * sev.predict(X)
pred_total = (df["pure_premium"] * df["exposure"]).sum()
print(f"\\n순보험료 예: 20대·고급형 {df.loc[(df.age_band=='20대') & (df['product']=='고급형'), 'pure_premium'].iloc[0]:.1f}만원/년")
print(f"포트폴리오 검증: 예측 손해액 합 {pred_total:,.0f} vs 실제 {df['claim_amt'].sum():,.0f}만원"
      f" (비율 {pred_total / df['claim_amt'].sum():.3f}, 1에 가까우면 총량 균형)")`,
      },
      {
        title: "Tweedie(power=1.5) 직접 적합 — 빈도×심도와 비교",
        desc: "Tweedie 1모형으로 직접 적합해 분리 적합과 산점도 대조 — 45도 선 위면 같은 요율 구조라는 뜻.",
        level: "advanced",
        code: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.linear_model import PoissonRegressor, GammaRegressor, TweedieRegressor

# ① 합성 포트폴리오 600건 (빈도×심도 섹션과 동일한 생성 규칙·시드)
rng = np.random.default_rng(42)
n = 600
age = rng.choice(["20대", "30대", "40대", "50대", "60대+"], n,
                 p=[0.15, 0.25, 0.25, 0.20, 0.15])
product = rng.choice(["기본형", "고급형"], n, p=[0.6, 0.4])
exposure = rng.uniform(0.5, 2.0, n).round(2)
f_age = {"20대": 1.6, "30대": 1.2, "40대": 1.0, "50대": 0.9, "60대+": 1.1}
s_age = {"20대": 0.9, "30대": 1.0, "40대": 1.0, "50대": 1.1, "60대+": 1.3}
f_prod = {"기본형": 1.0, "고급형": 1.25}
s_prod = {"기본형": 1.0, "고급형": 1.4}
lam0, mu0 = 0.35, 150.0
lam = lam0 * np.array([f_age[a] for a in age]) * np.array([f_prod[p] for p in product])
mu = mu0 * np.array([s_age[a] for a in age]) * np.array([s_prod[p] for p in product])
n_claims = rng.poisson(lam * exposure)
claim_amt = np.zeros(n)
pos = n_claims > 0
claim_amt[pos] = rng.gamma(2.0 * n_claims[pos], (mu / 2.0)[pos]).round(1)
df = pd.DataFrame({"age_band": age, "product": product, "exposure": exposure,
                   "n_claims": n_claims, "claim_amt": claim_amt})
df["age_band"] = pd.Categorical(df["age_band"], ["40대", "20대", "30대", "50대", "60대+"])
df["product"] = pd.Categorical(df["product"], ["기본형", "고급형"])
X = pd.get_dummies(df[["age_band", "product"]], drop_first=True, dtype=float)

# ② 방법 A: 빈도×심도 분리 적합(2모형)
freq = PoissonRegressor(alpha=0, max_iter=300)
freq.fit(X, df["n_claims"] / df["exposure"], sample_weight=df["exposure"])
mask = df["n_claims"] > 0
sev = GammaRegressor(alpha=0, max_iter=300)
sev.fit(X[mask], df.loc[mask, "claim_amt"] / df.loc[mask, "n_claims"],
        sample_weight=df.loc[mask, "n_claims"])
pp_fs = freq.predict(X) * sev.predict(X)

# ③ 방법 B: Tweedie(power=1.5)로 순보험료 직접 적합(1모형)
#    y=총손해액/노출: 0(무사고)이 뭉치고 양의 연속 꼬리 → 복합 포아송-감마(1<p<2)
tw = TweedieRegressor(power=1.5, alpha=0, link="log", max_iter=1000)
tw.fit(X, df["claim_amt"] / df["exposure"], sample_weight=df["exposure"])
pp_tw = tw.predict(X)

# ④ 세그먼트별 비교 — 참값 순보험료 = 기저(0.35×150)×빈도상대도×심도상대도
#    (참값과의 차이는 600건 소표본의 표본 오차 - 두 방법이 서로 일치하는지가 핵심)
seg = df.assign(pp_fs=pp_fs, pp_tw=pp_tw).groupby(
    ["age_band", "product"], observed=True).agg(
    계약수=("exposure", "size"),
    freq_x_sev=("pp_fs", "first"), tweedie=("pp_tw", "first")).reset_index()
seg["참값"] = (lam0 * mu0
              * seg["age_band"].map(f_age).astype(float) * seg["age_band"].map(s_age).astype(float)
              * seg["product"].map(f_prod).astype(float) * seg["product"].map(s_prod).astype(float))
print("[세그먼트별 순보험료(만원/년): 빈도×심도 vs Tweedie vs 참값]")
print(seg.round(1).to_string(index=False))

corr = np.corrcoef(pp_fs, pp_tw)[0, 1]
print(f"\\n두 방법 예측 상관 = {corr:.4f} (1에 가까움 → 사실상 같은 요율 구조)")
print(f"총량: 빈도×심도 {np.sum(pp_fs * df['exposure']):,.0f} / Tweedie {np.sum(pp_tw * df['exposure']):,.0f}"
      f" / 실제 {df['claim_amt'].sum():,.0f}만원")

# ⑤ 산점도 — 45도 선 위에 모이면 두 접근이 일치
plt.figure(figsize=(5.5, 5))
plt.scatter(pp_fs, pp_tw, s=18, alpha=0.5, edgecolor="none")
lims = [min(pp_fs.min(), pp_tw.min()) * 0.9, max(pp_fs.max(), pp_tw.max()) * 1.05]
plt.plot(lims, lims, "k--", lw=1, label="y = x")
plt.xlabel("Freq x Sev (10k KRW/yr)")
plt.ylabel("Tweedie p=1.5 (10k KRW/yr)")
plt.title("Pure premium: two approaches")
plt.legend()
plt.tight_layout()
plt.show()`,
      },
      {
        title: "요율 상대도 표와 오프밸런스(기저 보정)",
        desc: "빈도×심도 상대도 곱으로 순보험료 표 작성 — 캡 조정 시 총보험료를 보존하는 오프밸런스 팩터 계산.",
        level: "advanced",
        code: `import numpy as np
import pandas as pd
from sklearn.linear_model import PoissonRegressor, GammaRegressor

# ① 합성 포트폴리오 600건 (앞 섹션과 동일 규칙·시드)
rng = np.random.default_rng(42)
n = 600
age = rng.choice(["20대", "30대", "40대", "50대", "60대+"], n,
                 p=[0.15, 0.25, 0.25, 0.20, 0.15])
product = rng.choice(["기본형", "고급형"], n, p=[0.6, 0.4])
exposure = rng.uniform(0.5, 2.0, n).round(2)
f_age = {"20대": 1.6, "30대": 1.2, "40대": 1.0, "50대": 0.9, "60대+": 1.1}
s_age = {"20대": 0.9, "30대": 1.0, "40대": 1.0, "50대": 1.1, "60대+": 1.3}
f_prod = {"기본형": 1.0, "고급형": 1.25}
s_prod = {"기본형": 1.0, "고급형": 1.4}
lam = 0.35 * np.array([f_age[a] for a in age]) * np.array([f_prod[p] for p in product])
mu = 150.0 * np.array([s_age[a] for a in age]) * np.array([s_prod[p] for p in product])
n_claims = rng.poisson(lam * exposure)
claim_amt = np.zeros(n)
pos = n_claims > 0
claim_amt[pos] = rng.gamma(2.0 * n_claims[pos], (mu / 2.0)[pos]).round(1)
df = pd.DataFrame({"age_band": age, "product": product, "exposure": exposure,
                   "n_claims": n_claims, "claim_amt": claim_amt})
df["age_band"] = pd.Categorical(df["age_band"], ["40대", "20대", "30대", "50대", "60대+"])
df["product"] = pd.Categorical(df["product"], ["기본형", "고급형"])
X = pd.get_dummies(df[["age_band", "product"]], drop_first=True, dtype=float)

# ② 빈도·심도 적합 → 순보험료 상대도 = 빈도 상대도 × 심도 상대도 (로그 링크의 곱 구조)
freq = PoissonRegressor(alpha=0, max_iter=300)
freq.fit(X, df["n_claims"] / df["exposure"], sample_weight=df["exposure"])
mask = df["n_claims"] > 0
sev = GammaRegressor(alpha=0, max_iter=300)
sev.fit(X[mask], df.loc[mask, "claim_amt"] / df.loc[mask, "n_claims"],
        sample_weight=df.loc[mask, "n_claims"])

rel = pd.DataFrame({"빈도": np.exp(freq.coef_), "심도": np.exp(sev.coef_)}, index=X.columns)
rel["순보험료 상대도"] = rel["빈도"] * rel["심도"]
base_pp = np.exp(freq.intercept_) * np.exp(sev.intercept_)   # 기준셀(40대·기본형) 순보험료
print("[요율 상대도 표 - 기준: 40대·기본형 = 1.000]")
print(rel.round(3))
print(f"기저 순보험료(기준셀) = {base_pp:.1f}만원/년")

# ③ 요율표 형태로 정리 — 계약별 요율 = 기저 × 연령 상대도 × 상품 상대도
age_rel = {"40대": 1.0}
for c in [c for c in X.columns if c.startswith("age_band_")]:
    age_rel[c.replace("age_band_", "")] = rel.loc[c, "순보험료 상대도"]
prod_rel = {"기본형": 1.0, "고급형": rel.loc["product_고급형", "순보험료 상대도"]}
print("\\n연령 상대도:", {k: round(float(v), 3) for k, v in age_rel.items()})
print("상품 상대도:", {k: round(float(v), 3) for k, v in prod_rel.items()})

cur_rate = base_pp * df["age_band"].map(age_rel).astype(float) \\
                   * df["product"].map(prod_rel).astype(float)
cur_total = (cur_rate * df["exposure"]).sum()

# ④ 오프밸런스(off-balance) — 상대도를 경영 판단으로 조정하면 총보험료가 어긋난다.
#    예: 60대+ 상대도가 너무 높아 시장 대응상 1.20으로 캡(cap) → 총량이 줄어듦
#    → 기저요율에 보정계수(오프밸런스 팩터)를 곱해 전체 수입 수준을 유지
adj_rel = dict(age_rel)
print(f"\\n조정: 60대+ 상대도 {adj_rel['60대+']:.3f} → 1.200 캡")
adj_rel["60대+"] = 1.20
adj_rate = base_pp * df["age_band"].map(adj_rel).astype(float) \\
                   * df["product"].map(prod_rel).astype(float)
adj_total = (adj_rate * df["exposure"]).sum()
off_balance = cur_total / adj_total                     # 오프밸런스 팩터
base_new = base_pp * off_balance                        # 보정된 기저요율
final_total = (base_new * df["age_band"].map(adj_rel).astype(float)
               * df["product"].map(prod_rel).astype(float) * df["exposure"]).sum()
print(f"조정 전 총보험료 {cur_total:,.0f} / 조정 후 {adj_total:,.0f}만원 (부족 {cur_total - adj_total:,.0f})")
print(f"오프밸런스 팩터 = {off_balance:.4f} → 새 기저요율 {base_new:.1f}만원/년")
print(f"보정 후 총보험료 {final_total:,.0f}만원 (조정 전과 차이 {abs(final_total - cur_total):.6f}, 총량 보존 확인)")
print("해석: 캡으로 깎인 60대+ 몫을 전 계약이 얇게 나눠 부담 - 세그먼트 간 내부보조가 생김")`,
      },
      {
        title: "LEV — 면책·한도 반영 순보험료(수치적분·몬테카를로 대조)",
        desc: "레이어 기대 지급액 E[(X∧u)−(X∧d)]를 닫힌형·quad·몬테카를로 3방법으로 대조하고 면책금액별 절감률을 냅니다.",
        level: "advanced",
        code: `import numpy as np
from scipy import stats
from scipy.integrate import quad

# ① LEV(Limited Expected Value) = E[X∧u] = E[min(X, u)]
#    면책 d·한도 u가 있는 담보의 사고당 기대 지급액은 "레이어 기댓값":
#      E[(X∧u) - (X∧d)] = ∫_d^u S(x) dx   (S(x)=1-F(x), 생존함수 적분 공식)
#    심도를 로그정규로 가정 - 실무에서 손해액 꼬리가 두꺼울 때 표준 선택
mu_ln, sigma = 5.0, 1.0                       # ln X ~ N(5, 1) → 단위: 만원
X = stats.lognorm(s=sigma, scale=np.exp(mu_ln))
EX = X.mean()                                 # 전손 기대심도 E[X] = exp(mu+sigma^2/2)
d, u = 50.0, 2000.0                           # 면책 50만원 · 한도 2,000만원
print(f"전손 기대심도 E[X] = {EX:.2f}만원 (이론 exp(5+0.5) = {np.exp(5.5):.2f})")
print(f"면책 이하 사고 비율 F({d:.0f}) = {X.cdf(d):.1%} (지급 0원 처리)")

# ② 방법 1: 로그정규 LEV 닫힌형(이론값) — 검증의 기준
#    E[X∧u] = e^{mu+s^2/2}·Φ((ln u - mu - s^2)/s) + u·(1 - Φ((ln u - mu)/s))
def lev_closed(t):
    z1 = (np.log(t) - mu_ln - sigma**2) / sigma
    z2 = (np.log(t) - mu_ln) / sigma
    return np.exp(mu_ln + sigma**2 / 2) * stats.norm.cdf(z1) + t * (1 - stats.norm.cdf(z2))

layer_closed = lev_closed(u) - lev_closed(d)

# ③ 방법 2: 수치적분 — ∫_d^u S(x) dx 를 quad로 (닫힌형이 없는 분포에도 통함)
layer_quad, err = quad(lambda x: X.sf(x), d, u)

# ④ 방법 3: 몬테카를로 — 원손해 시뮬레이션 후 min/max로 지급액 계산
rng = np.random.default_rng(42)
sim = rng.lognormal(mu_ln, sigma, 500_000)
pay = np.minimum(sim, u) - np.minimum(sim, d)      # (X∧u) - (X∧d) 그대로 코드화
layer_mc = pay.mean()
se_mc = pay.std(ddof=1) / np.sqrt(len(pay))

print(f"\\n[사고당 기대 지급액: 면책 {d:.0f}·한도 {u:,.0f}만원 레이어]")
print(f"닫힌형(이론)   = {layer_closed:.3f}만원")
print(f"수치적분 quad  = {layer_quad:.3f}만원 (이론 대비 오차 {abs(layer_quad - layer_closed):.2e})")
print(f"몬테카를로 50만 = {layer_mc:.3f}만원 (표준오차 {se_mc:.3f}, 이론과 {abs(layer_mc - layer_closed) / se_mc:.2f} SE 차이)")

# ⑤ 면책·한도의 순보험료 절감률 — 요율서에 반영되는 계수
#    순보험료 = 빈도 × 사고당 기대 지급액 (원손해 기준 빈도 0.35건/년 가정)
lam = 0.35
pp_full = lam * EX                             # 전부보장(면책·한도 없음)
pp_layer = lam * layer_closed
print(f"\\n전부보장 순보험료   = {pp_full:.2f}만원/년")
print(f"면책·한도 순보험료 = {pp_layer:.2f}만원/년 → 절감률 {1 - pp_layer / pp_full:.1%}")
for dd in [0, 30, 50, 100]:                    # 면책금액별 절감 효과(한도 2,000 고정)
    r = 1 - (lev_closed(u) - lev_closed(dd) if dd > 0 else lev_closed(u)) / EX
    print(f"  면책 {dd:>3}만원: 절감률 {r:.1%}")
print("해석: 면책은 소액 다발 사고를 걸러 절감 효과가 크고, 한도는 꼬리 위험을 자른다")`,
      },
    ],
  },
  {
    id: "life-premium",
    name: "보험료 산출 기초",
    en: "Commutation & Net Premium",
    category: "actuarial",
    weight: 3,
    difficulty: 3,
    params: [
      { name: "A, B, c (Gompertz-Makeham)", desc: "사력 μx = A + B·cˣ — A는 배경위험, B·cˣ는 노화 성분(보통 c≈1.08~1.12). qx = 1−exp(−A−B·cˣ·(c−1)/ln c) 변환으로 전 연령 단조 증가 보장." },
      { name: "기수(radix) l0 · 종국연령 ω", desc: "l0=100,000은 관례(산식이 비율이라 임의). ω(100세)에서 q_ω=1로 표를 닫아야 Σdx=l0 — 안 닫으면 종신 일시납 과소평가." },
      { name: "i (예정이율) · v=1/(1+i)", desc: "v는 1년 할인계수. 예정이율(부담금리)이 낮을수록 미래 보험금 현가가 커져 보험료 상승 — 보장기간이 길수록 민감(④ 참고)." },
      { name: "Dx·Nx (생존계) / Cx·Mx (사망계)", desc: "Dx=vˣ·lx(생존 현가)·Cx=v^(x+1)·dx(사망 현가), Nx·Mx는 x 이후 누적합 — 연금은 N의 차, 사망보장은 M의 차." },
      { name: "α·β·γ (예정사업비 3이원)", desc: "α 신계약비(계약 시 1회)·β 유지비(매년)·γ 수금비(납입 시마다) — 영업보험료 G=(S·A+S·α+S·β·ä)/(ä·(1−γ))." },
      { name: "연말 지급·연납 가정", desc: "기본형은 연말 지급·기시 연납 근사 — 월납 ä⁽¹²⁾≈ä−11/24, 즉시지급 A̅≈(1+i)^½·A(UDD 근사)로 보정합니다." },
    ],
    summary: "생명표→계산기수(Dx·Nx·Cx·Mx)→수지상등으로 정기·종신·연금 순보험료와 3이원 영업보험료까지 — 보험료 산출의 고전 정석",
    intro:
      "생명표→계산기수→수지상등으로 정기·종신·연금 보험료까지 가는 고전 경로를 처음부터 끝까지 구현합니다.\n\n- 계산기수 Dx·Nx·Cx·Mx 한 번이면 어떤 급부의 기대현가도 기수의 차·나눗셈으로 산출\n- 원칙은 수지상등 하나 — 보험료 수입 현가 = 보험금·사업비 지출 현가\n- 2013년 현금흐름방식 전환 후에도 표준해약환급금·산출 시스템 검증·계리사 시험 기본기\n- 복잡한 모델 결과가 이상할 때 계산기수로 손 재현한 수치가 가장 믿을 만한 대조군",
    tips: "- 기본형은 '사망보험금 연말 지급·기시 연납' 근사 — 월납·즉시지급 상품은 UDD 근사로 보정\n- 예정이율은 부담금리 — 저금리기 장기 보장일수록 보험료 급등(④ 민감도: 정기 +0.9% vs 종신 +13.6%)",
    sections: [
      {
        title: "종신보험 순보험료 — 가상 위험률(qx)·확정이율(i)로 직접 산출",
        desc: "계산기수 없이 사망확률 qx와 확정이율만으로 A_x·ä_x를 직접 구해 종신보험 보험료를 산출합니다 — 수지상등의 기본 원리를 단계별로. (뒤 ①~④는 계산기수로 일반화한 정석 경로)",
        level: "basic",
        code: `import numpy as np

# ── 종신보험 순보험료: 가상 위험률(qx) + 확정이율(i)로 바로 산출 ──────────
# 종신보험 = 피보험자가 '언제 죽든' 사망보험금을 지급하는 보장.
# 필요한 것은 딱 두 가지: ① 나이별 사망확률 qx(위험률)  ② 확정이율 i(예정이율).

# ① 가상 위험률 qx — 실제로는 경험생명표를 쓰지만, 여기선 이해를 위해 합성.
#    Gompertz: qx = 1 − exp(−B·c^x). 나이 들수록 사망확률이 지수적으로 커진다.
x0 = 40                       # 가입 연령(40세)
omega = 110                   # 종국연령: 이 나이엔 전원 사망 → 표를 '닫는다'
ages = np.arange(x0, omega + 1)
B, c = 0.0004, 1.09
qx = 1 - np.exp(-B * c**ages)
qx[-1] = 1.0                  # q(ω)=1: 마지막엔 반드시 사망(안 닫으면 보험료 과소)

# ② 확정이율 i — 예정이율(부담금리). v = 1/(1+i) = 1년 뒤 1원의 현재가치.
i = 0.03
v = 1 / (1 + i)

# ③ 생존확률 tpx — 가입시점부터 t년 생존할 확률 = (1−q_x0)(1−q_{x0+1})…
#    tpx[0]=1,  tpx[t+1] = tpx[t]·(1 − qx[t])
tpx = np.ones(len(ages))
for t in range(len(ages) - 1):
    tpx[t + 1] = tpx[t] * (1 - qx[t])

# ④ 사망보장 현가 A_x (종신보험 1원당) — '사망한 해 말에 지급' 가정
#    A_x = Σ_t  v^(t+1) · (t년 생존) · (그 해 사망) = Σ v^(t+1)·tpx·qx
dcf_death = v ** (np.arange(len(ages)) + 1) * tpx * qx
A_x = dcf_death.sum()

# ⑤ 기시급 종신연금 현가 ä_x — 보험료를 매년 초 1원씩 낼 때의 현가
#    ä_x = Σ_t  v^t · tpx
ax_due = (v ** np.arange(len(ages)) * tpx).sum()

# ⑥ 수지상등(원칙): 보험료 수입 현가 = 사망보험금 지출 현가
#    P·ä_x = S·A_x   →   연납 순보험료 P = S·A_x / ä_x
S = 100_000_000               # 사망보험금 1억원
NSP = S * A_x                 # 일시납 순보험료(net single premium)
P = S * A_x / ax_due          # 연납 순보험료(net level annual premium)

print(f"가입 {x0}세 · 확정이율 {i:.1%} · 사망보험금 {S:,}원")
print(f"q{x0}={qx[0]:.5f}   q60={qx[60 - x0]:.5f}   q80={qx[80 - x0]:.5f}")
print(f"A_x (종신 1원당 현가) = {A_x:.5f}")
print(f"ä_x (연금 현가)       = {ax_due:.4f}")
print(f"일시납 순보험료 = {NSP:,.0f}원")
print(f"연납  순보험료 = {P:,.0f}원/년  (종신납)")

# ⑦ 검증 — 항등식 A_x = 1 − d·ä_x  (d = i·v: 선지급 이자율). 일치하면 계산 정합.
d = i * v
print(f"\\n검증  A_x = 1 − d·ä_x ?  {A_x:.6f}  vs  {1 - d * ax_due:.6f}")`,
      },
      {
        title: "① 생명표 합성 — Gompertz-Makeham qx → lx·dx (기수 100,000)",
        desc: "μx = A + B·cˣ로 0~100세 qx를 합성하고 기수 100,000으로 lx·dx 작성 — Σdx = 100,000으로 닫힘을 검증합니다.",
        level: "basic",
        code: `import numpy as np
import matplotlib.pyplot as plt

# ── 생명표 합성: Gompertz-Makeham 사력 μx = A + B·c^x ─────────────────
# ① 사력(force of mortality) μx: A = 연령과 무관한 배경위험(사고·재해),
#    B·c^x = 나이 들수록 지수적으로 커지는 노화위험 — 인간 사망률의 고전 법칙.
#    실무 생명표(제10회 경험생명표 등)도 고연령부에서 이 형태에 가깝다.
A, B, c = 0.0005, 0.00003, 1.10
ages = np.arange(0, 101)                          # 0~100세

# ② 사력 → 연간 사망률 qx: qx = 1 − exp(−∫x^{x+1} μt dt)
#    지수부 적분 ∫ = A + B·c^x·(c−1)/ln c  (근사가 아닌 정확 적분)
integ = A + B * c**ages * (c - 1) / np.log(c)
qx = 1.0 - np.exp(-integ)
qx[-1] = 1.0          # ③ 종국연령 ω=100: q100=1로 표를 '닫는다'(전원 사망)
                      #    — 뒤 단계 계산기수 합(Nx·Mx)이 완결되기 위한 필수 조치

# ④ 단조 증가 확인 — 보정(graduation)된 생명표의 기본 요건
assert np.all(np.diff(qx) > 0), "qx가 단조 증가가 아님"
print(f"qx 단조 증가: {bool(np.all(np.diff(qx) > 0))}  (0~100세 전 구간)")
print(f"q30={qx[30]:.5f}  q40={qx[40]:.5f}  q65={qx[65]:.5f}  q99={qx[99]:.5f}")

# ⑤ lx(생존자 수)·dx(사망자 수): 기수(radix) l0=100,000 — 생명표 작성 관례
lx = np.empty(101)
lx[0] = 100_000.0
for x in range(100):
    lx[x + 1] = lx[x] * (1 - qx[x])               # 생존 체인: l_{x+1} = lx·(1−qx)
dx = lx * qx                                      # 연령별 사망자 수 (d100 = l100)

print(f"\\nl40={lx[40]:,.0f}  l65={lx[65]:,.0f}  l90={lx[90]:,.0f}  l100={lx[100]:,.1f}")
# ⑥ 검증 — 전원이 언젠가 사망하므로 Σdx = 기수 100,000 (표가 닫혔다는 증거)
print(f"검증: Σdx = {dx.sum():,.2f}  (기수 100,000과 일치해야 정상)")

# ⑦ 플롯 — 왼쪽: qx(로그축, 지수적 상승 = 직선), 오른쪽: lx 감소와 dx 봉우리
fig, axes = plt.subplots(1, 2, figsize=(10, 4))
axes[0].semilogy(ages, qx)
axes[0].set_xlabel("age x"); axes[0].set_ylabel("qx (log)")
axes[0].set_title("mortality rate qx (Gompertz-Makeham)")
axes[1].plot(ages, lx, label="lx (survivors)")
ax2 = axes[1].twinx()
ax2.plot(ages, dx, color="tab:orange", label="dx (deaths)")
axes[1].set_xlabel("age x"); axes[1].set_ylabel("lx"); ax2.set_ylabel("dx")
axes[1].set_title("life table lx / dx (radix 100,000)")
axes[1].legend(loc="lower left"); ax2.legend(loc="upper left")
plt.tight_layout(); plt.show()`,
      },
      {
        title: "② 계산기수 Dx·Nx·Cx·Mx — 예정이율 3% + 항등식 3중 검증",
        desc: "할인을 결합해 계산기수 4종 작성 — 재귀 항등식·A40 직접합산 대조·A+d·ä=1 세 겹으로 검증합니다.",
        level: "basic",
        code: `import numpy as np

# ── 생명표(① 섹션과 동일한 Gompertz-Makeham 합성표) ─────────────────
A, B, c = 0.0005, 0.00003, 1.10
ages = np.arange(0, 101)
qx = 1.0 - np.exp(-(A + B * c**ages * (c - 1) / np.log(c)))
qx[-1] = 1.0                                      # 종국연령 ω=100 (표 닫기)
lx = np.empty(101)
lx[0] = 100_000.0
for x in range(100):
    lx[x + 1] = lx[x] * (1 - qx[x])
dx = lx * qx

# ① 계산기수(commutation functions) — 예정이율 i=3%
#    '생존자·사망자 수에 할인을 미리 곱해 둔 표'. 이걸 한 번 만들어 두면
#    어떤 보험의 보험료도 나눗셈 몇 번으로 나온다 — 전산 이전 시대의 지혜.
i = 0.03
v = 1.0 / (1.0 + i)                               # 1년 할인계수 v = 1/(1+i)
Dx = v**ages * lx                                 # 생존계 기수: x세 생존 1인의 현가
Cx = v ** (ages + 1) * dx                         # 사망계 기수: x세 사망보험금(연말 지급) 현가
Nx = np.cumsum(Dx[::-1])[::-1]                    # Nx = Σ_{y≥x} Dy — 뒤에서부터 누적합
Mx = np.cumsum(Cx[::-1])[::-1]                    # Mx = Σ_{y≥x} Cy

# ② 중간값 출력 — 교과서·다른 도구와 대조 검증용 앵커
print("  x          Dx            Nx           Cx          Mx")
for x in (0, 20, 40, 60, 80, 100):
    print(f"{x:>3}  {Dx[x]:>12,.1f}  {Nx[x]:>12,.1f}  {Cx[x]:>9,.2f}  {Mx[x]:>10,.1f}")
print(f"\\nD40={Dx[40]:,.1f}   N40={Nx[40]:,.1f}   M40={Mx[40]:,.1f}")

# ③ 검증 1 — 재귀 항등식: Nx = Dx + N_{x+1},  Mx = Cx + M_{x+1}
ok_N = np.allclose(Nx[:-1], Dx[:-1] + Nx[1:])
ok_M = np.allclose(Mx[:-1], Cx[:-1] + Mx[1:])
print(f"재귀 항등식  N: {ok_N},  M: {ok_M}")

# ④ 검증 2 — 종신보험 A40을 '정의대로 직접 합산'한 값과 기수식 M40/D40 비교
#    A40 = Σ_k v^{k+1}·(d_{40+k}/l40)  ↔  M40/D40 은 대수적으로 동일해야 한다
k = np.arange(0, 61)                              # 40세→100세 사망까지
A40_direct = np.sum(v ** (k + 1) * dx[40 + k] / lx[40])
A40_comm = Mx[40] / Dx[40]
print(f"A40 직접합산 = {A40_direct:.10f}")
print(f"A40 = M40/D40 = {A40_comm:.10f}   (차이 {abs(A40_direct - A40_comm):.2e})")

# ⑤ 검증 3 — 보험수리 항등식 A_x + d·ä_x = 1 (d = i/(1+i) = 선이자율)
#    종신보험(연말 지급)과 종신 기시급연금 ä_x=Nx/Dx 사이의 이론 관계.
#    표가 제대로 닫혀 있으면(q100=1) 기계 정밀도 수준으로 성립한다.
d_disc = i / (1.0 + i)
ident = Mx[40] / Dx[40] + d_disc * Nx[40] / Dx[40]
print(f"A40 + d*a40(기시급 종신연금) = {ident:.12f}  (이론값 1 — 잔차 {abs(ident - 1):.2e})")`,
      },
      {
        title: "③ 순보험료 — 정기·종신 일시납, 생존연금 ä, 연납 P (보험금 1억)",
        desc: "40세·보험금 1억 예시로 정기·종신 일시납, ä(40:20), 연납 순보험료 계산 — 항등식 A=1−d·ä로 검증합니다.",
        level: "basic",
        code: `import numpy as np

# ── 생명표 + 계산기수(①·② 섹션과 동일 — i=3%) ─────────────────
A, B, c = 0.0005, 0.00003, 1.10
ages = np.arange(0, 101)
qx = 1.0 - np.exp(-(A + B * c**ages * (c - 1) / np.log(c)))
qx[-1] = 1.0
lx = np.empty(101)
lx[0] = 100_000.0
for x in range(100):
    lx[x + 1] = lx[x] * (1 - qx[x])
dx = lx * qx
i = 0.03
v = 1.0 / (1.0 + i)
Dx = v**ages * lx
Cx = v ** (ages + 1) * dx
Nx = np.cumsum(Dx[::-1])[::-1]
Mx = np.cumsum(Cx[::-1])[::-1]

# ① 상품 설정 — 40세 가입 · 보험금 1억 원 · 20년 만기/납입
S = 100_000_000                                   # 보험금(사망 시 연말 지급 가정)
x, n = 40, 20                                     # 가입연령 40, 보험기간·납입기간 20년

# ② 일시납 순보험료(NSP) — '보험금 1원'의 기대현가에 보험금을 곱한다
#    정기보험: 40~59세 사망만 보장 → 사망계 기수의 차 (M40 − M60)
A_term = (Mx[x] - Mx[x + n]) / Dx[x]              # 20년 정기보험 (1원당)
A_whole = Mx[x] / Dx[x]                           # 종신보험 (1원당)
print(f"20년 정기보험  일시납 1원당 A = {A_term:.5f} → 보험금 1억: {S * A_term:>13,.0f}원")
print(f"종신보험      일시납 1원당 A = {A_whole:.5f} → 보험금 1억: {S * A_whole:>13,.0f}원")
print("→ 같은 1억이라도 '언젠가 반드시 지급'되는 종신이 정기보다 5배 이상 비싸다")

# ③ 기시급 생존연금 현가 ä — 보험료를 '살아 있는 동안 매년 초 1원' 받는 연금으로 환산
#    ä(40:20) = (N40 − N60)/D40 : 연납보험료 1원의 수입 기대현가 = 납입 환산계수
a_due = (Nx[x] - Nx[x + n]) / Dx[x]
print(f"\\n기시급 생존연금 a(40:20) = {a_due:.4f}  (20년 확정연금 {(1 - v**n) / (1 - v):.4f}보다 작다 — 사망 탈퇴 반영)")

# ④ 연납 순보험료 — 수지상등: P·ä = S·A  →  P = S·A/ä
P_term = S * A_term / a_due                       # 20년납 20년만기 정기
P_whole20 = S * A_whole / a_due                   # 20년납 종신
P_whole_life = S * Mx[x] / Nx[x]                  # 종신납 종신 (ä = N40/D40)
print(f"\\n연납 순보험료(보험금 1억, 40세 가입)")
print(f"  20년 정기(20년납): {P_term:>12,.0f}원/년")
print(f"  종신보험(20년납):  {P_whole20:>12,.0f}원/년")
print(f"  종신보험(종신납):  {P_whole_life:>12,.0f}원/년  (납입기간이 길수록 연납액은 준다)")

# ⑤ 검증 — 양로보험(생사혼합) 항등식 A(40:20) = 1 − d·ä(40:20), d = i/(1+i)
#    양로 = 정기(사망) + 생존보험(만기금): (M40−M60+D60)/D40. 이론상 정확히 성립.
A_endow = (Mx[x] - Mx[x + n] + Dx[x + n]) / Dx[x]
ident = 1.0 - (i / (1.0 + i)) * a_due
print(f"\\n[검증] 양로 A(40:20) 기수식 = {A_endow:.10f}")
print(f"       1 − d·a(40:20)     = {ident:.10f}   (잔차 {abs(A_endow - ident):.2e})")`,
      },
      {
        title: "④ 영업보험료 — 예정사업비 3이원(α·β·γ) 로딩 + 금리 민감도",
        desc: "3이원을 수지상등에 넣어 영업보험료 G와 로딩 분해 — 예정이율 0.5%p 인하 시 정기 +0.9% vs 종신 +13.6%를 확인합니다.",
        level: "advanced",
        code: `import numpy as np

# ── 생명표 + 계산기수(①·② 섹션과 동일 — i=3%) ─────────────────
A, B, c = 0.0005, 0.00003, 1.10
ages = np.arange(0, 101)
qx = 1.0 - np.exp(-(A + B * c**ages * (c - 1) / np.log(c)))
qx[-1] = 1.0
lx = np.empty(101)
lx[0] = 100_000.0
for x in range(100):
    lx[x + 1] = lx[x] * (1 - qx[x])
dx = lx * qx
i = 0.03
v = 1.0 / (1.0 + i)
Dx = v**ages * lx
Cx = v ** (ages + 1) * dx
Nx = np.cumsum(Dx[::-1])[::-1]
Mx = np.cumsum(Cx[::-1])[::-1]

# 상품: 40세 · 보험금 1억 · 20년납 20년만기 정기보험 (③ 섹션과 동일)
S, x, n = 100_000_000, 40, 20
A_term = (Mx[x] - Mx[x + n]) / Dx[x]
a_due = (Nx[x] - Nx[x + n]) / Dx[x]
P_net = S * A_term / a_due                        # 연납 순보험료(③에서 계산한 값)

# ① 예정사업비 3이원 — 3이원방식(예정위험률·예정이율·예정사업비)의 사업비 축
#    α(신계약비): 모집수수료·심사·증권발행 — 가입금액 대비, 계약 시 1회
#    β(유지비):   계약관리·전산 — 가입금액 대비, 매년(보험기간 전체)
#    γ(수금비):   보험료 수금 — '영업보험료' 대비 비율, 납입할 때마다
alpha = 0.007                                     # 가입금액의 0.7% (1회)
beta = 0.0015                                     # 가입금액의 0.15% (연간)
gamma = 0.02                                      # 영업보험료의 2%

# ② 영업보험료 G — 수지상등 원칙을 사업비까지 확장:
#    [수입현가] G·ä = [지출현가] S·A + S·α + S·β·ä + γ·G·ä
#    G가 양변에 있으므로 정리하면  G = (S·A + S·α + S·β·ä) / (ä·(1−γ))
G = (S * A_term + S * alpha + S * beta * a_due) / (a_due * (1.0 - gamma))
print(f"연납 순보험료 P  = {P_net:>11,.0f}원")
print(f"연납 영업보험료 G = {G:>11,.0f}원   (부가보험료 {G - P_net:,.0f}원, G의 {(G - P_net) / G:.1%})")

# ③ 연간 로딩 분해 — G·(1−γ) = P + S·α/ä + S·β 가 되도록 항목별로 확인
load_alpha = S * alpha / a_due                    # 신계약비를 납입기간에 걸쳐 상각
load_beta = S * beta                              # 유지비(매년)
load_gamma = gamma * G                            # 수금비(영업보험료 비례)
print(f"\\n연간 로딩 분해: 신계약비 상각 {load_alpha:,.0f}원 + 유지비 {load_beta:,.0f}원"
      f" + 수금비 {load_gamma:,.0f}원")
print(f"P + 로딩 합계  = {P_net + load_alpha + load_beta + load_gamma:,.0f}원  (= G 재구성)")

# ④ 검증 — 수지상등: 수입현가 − 지출현가 = 0 (금액이 수십억 스케일이므로 상대잔차로)
lhs = G * a_due                                   # 보험료 수입의 기대현가
rhs = S * A_term + S * alpha + S * beta * a_due + gamma * G * a_due
print(f"\\n[검증] 수지상등 상대잔차 = {abs(lhs - rhs) / lhs:.2e}  (부동소수점 0 — 등식 성립)")

# ⑤ 민감도 — 예정이율 3.0% → 2.5% (저금리 → 할인 덜 됨 → 보험료 상승)
#    보장기간이 길수록 금리 민감도가 커진다: 정기 20년 vs 종신을 비교
i2 = 0.025
v2 = 1.0 / (1.0 + i2)
Dx2 = v2**ages * lx
Cx2 = v2 ** (ages + 1) * dx
Nx2 = np.cumsum(Dx2[::-1])[::-1]
Mx2 = np.cumsum(Cx2[::-1])[::-1]
A2 = (Mx2[x] - Mx2[x + n]) / Dx2[x]
a2 = (Nx2[x] - Nx2[x + n]) / Dx2[x]
G2 = (S * A2 + S * alpha + S * beta * a2) / (a2 * (1.0 - gamma))
P_wl_30 = S * (Mx[x] / Dx[x]) / a_due             # 종신보험 20년납 순보험료 @3.0%
P_wl_25 = S * (Mx2[x] / Dx2[x]) / a2              # 종신보험 20년납 순보험료 @2.5%
print(f"\\n예정이율 3.0% → 2.5%")
print(f"  정기 20년 영업보험료: {G:,.0f} → {G2:,.0f}원 ({G2 / G - 1:+.2%})")
print(f"  종신 20년납 순보험료: {P_wl_30:,.0f} → {P_wl_25:,.0f}원 ({P_wl_25 / P_wl_30 - 1:+.2%})")
print("→ 같은 0.5%p 인하라도 보장이 긴 종신이 훨씬 민감 — 저금리기 종신보험료 인상의 산식적 이유")`,
      },
    ],
  },
  {
    id: "reinsurance",
    name: "재보험 분석",
    en: "Reinsurance Analysis",
    category: "actuarial",
    weight: 2,
    difficulty: 4,
    params: [
      { name: "d (부담점, attachment)", desc: "XL에서 원수사가 클레임당 보유하는 하한 — 이 금액을 넘는 부분부터 재보험자가 부담합니다. 낮출수록 보호가 넓어지고 재보험료는 비싸집니다." },
      { name: "u (한도) · 'u xs d' 표기", desc: "레이어 폭(클레임당 최대 지급액) — '300 xs 200'=200 초과분을 300까지(200~500 구간) 인수, 소진 후 초과분은 원수사 몫." },
      { name: "ceded = min(max(X−d,0), u)", desc: "클레임별 XL 분출(cession) 공식 — 시뮬레이션·재보험료 산정·보유 분석의 기본 연산. 보유 = X − ceded." },
      { name: "q (출재 비율, quota share)", desc: "비례 재보험에서 모든 클레임·보험료를 나누는 고정 비율. 보유 분포의 '모양'(CV)이 그대로라 꼬리 위험 이전에는 비효율 — 자본·성장 지원용." },
      { name: "λ (빈도) · μ, σ (심도)", desc: "집합손해모형 S=ΣX의 입력 — 연간 건수 포아송(λ), 개별 심도 로그정규(μ,σ). 모델 적합 탭에서 추정한 파라미터를 그대로 넣으면 됩니다." },
      { name: "loading (재보험료 로딩)", desc: "재보험료 = 기대출재손해 × (1+로딩). 상위 레이어일수록 발동확률이 낮아 변동성 마진(로딩) 비중이 커집니다." },
    ],
    summary: "XL(초과손해액)·비례(QS) 분출 구조와 몬테카를로 순보유 분포 — 재보험 전후 VaR·TVaR로 자본 완화 효과를 계량",
    intro:
      "재보험은 원수보험사가 인수한 위험의 일부를 재보험자에게 넘기는 '보험회사의 보험'입니다.\n\n- QS(비례): 모든 클레임·보험료를 고정 비율 q로 분할 — '규모' 축소(분포 모양 유지)\n- XL(비비례): ceded = min(max(X−d, 0), u) — '꼬리'(대형 손해) 절단\n- 계량은 집합손해 S=ΣX 몬테카를로 — 재보험 전후 평균·VaR 99.5%·TVaR 비교\n- K-ICS 요구자본이 99.5% VaR 기준 — 꼬리 이전은 지급여력비율 개선(자본관리 수단, 공동재보험까지 확장)",
    tips: "- XL은 한도(d+u) 소진 후 초과분이 다시 원수사 몫 — 보유 최대값 확인, 상위 레이어·복원(reinstatement) 검토\n- 출재 의사결정 = 재보험 순비용(로딩) vs 자본 절감 효과(자본비용 환산) 비교",
    sections: [
      {
        title: "XL 레이어 분출 — 'u xs d' 기대출재손해와 LEV 검증",
        desc: "로그정규 1만 건에 3개 레이어(100 xs 100 / 300 xs 200 / 500 xs 500)를 적용해 발동확률·기대출재·출재율 표 작성 — 닫힌형 LEV 이론값으로 검증합니다.",
        level: "basic",
        code: `import numpy as np
import pandas as pd
from scipy import stats

# ① 원수 손해액(ground-up loss) 1만 건 합성 — 로그정규(중앙값 50백만원, σ=1.2)
#    개별 클레임 심도는 오른쪽 꼬리가 두꺼운 로그정규·파레토가 표준 가정입니다
rng = np.random.default_rng(42)
mu, sigma = np.log(50), 1.2                     # 단위: 백만원
X = rng.lognormal(mu, sigma, 10_000)
print(f"클레임 {len(X):,}건: 평균={X.mean():.1f}  중앙값={np.median(X):.1f}  최대={X.max():,.0f} (백만원)")
print(f"이론 평균 exp(μ+σ²/2) = {np.exp(mu + sigma**2 / 2):.1f}  ← 시뮬 평균과 근접해야 정상")

# ② XL(초과손해액) 레이어 — 'u xs d' = 부담점(attachment) d 초과분을 폭 u까지 인수
#    클레임별 출재액 ceded = min(max(X − d, 0), u)
#    예: '300 xs 200'은 한 클레임에서 200을 넘는 부분을 300까지(즉 200~500 구간) 재보험자가 부담
layers = [(100, 100), (300, 200), (500, 500)]   # (u, d): 100 xs 100 / 300 xs 200 / 500 xs 500

def lev(m):
    """제한기대값 E[X ∧ m] — 로그정규 닫힌형. 시뮬레이션을 검증할 이론값"""
    z = (np.log(m) - mu) / sigma
    return (np.exp(mu + sigma**2 / 2) * stats.norm.cdf(z - sigma)
            + m * (1 - stats.norm.cdf(z)))

rows = []
for u, d in layers:
    ceded = np.minimum(np.maximum(X - d, 0), u)  # 클레임별 분출 — 레이어에 걸리는 부분만
    theo = lev(d + u) - lev(d)                   # 이론 레이어 기대손해 = E[X∧(d+u)] − E[X∧d]
    rows.append({
        "레이어": f"{u} xs {d}",
        "발동확률 P(X>d)": (X > d).mean(),
        "기대출재/건(시뮬)": ceded.mean(),
        "기대출재/건(이론)": theo,
        "출재율(%)": ceded.sum() / X.sum() * 100,
    })
tbl = pd.DataFrame(rows).round(3)
print("\\n[XL 레이어별 기대출재손해 — 시뮬 vs 이론(로그정규 LEV) 검증]")
print(tbl.to_string(index=False))

# ③ 레이어 분할 검증 — 연속된 3개 레이어의 출재 합 = 프로그램 전체 '900 xs 100'
ced_all = np.minimum(np.maximum(X - 100, 0), 900)
ced_sum = sum(np.minimum(np.maximum(X - d, 0), u).sum() for u, d in layers)
print(f"\\n검증: 레이어 3개 출재 합 {ced_sum:,.0f} = 900 xs 100 출재 {ced_all.sum():,.0f}")
print(f"프로그램 전체 출재율 = {ced_all.sum() / X.sum():.1%} (보유: 100 이하 전액 + 1,000 초과분)")
# 읽는 법: 위 레이어일수록 발동확률은 낮지만 걸리면 손해가 큼 —
#          가격(재보험료)은 '기대출재 + 변동성 로딩'으로, 상위 레이어일수록 로딩 비중이 커집니다`,
      },
      {
        title: "비례(QS 30%) vs XL — 분출 구조 비교",
        desc: "QS 30% vs XL '900 xs 100'의 보유 프로파일(기대값·CV·99.5% 분위수) 비교 — 모양 유지 vs 꼬리 절단이 핵심.",
        level: "advanced",
        code: `import numpy as np
import pandas as pd

# ① 동일 포트폴리오 재생성 — 원수 클레임 1만 건 (같은 시드 → XL 섹션과 같은 데이터)
rng = np.random.default_rng(42)
mu, sigma = np.log(50), 1.2                      # 단위: 백만원
X = rng.lognormal(mu, sigma, 10_000)

# ② 두 방식의 클레임별 분출(cession) — 같은 '재보험'이라도 옮기는 위험이 다릅니다
q = 0.30                                         # 비례(Quota Share) 출재 비율 30%
d, u = 100, 900                                  # XL 프로그램 '900 xs 100' (100~1,000 구간)
ced_qs = q * X                                   # QS: 모든 클레임을 30%씩 일괄 출재
ced_xl = np.minimum(np.maximum(X - d, 0), u)     # XL: 100 초과분만, 최대 900까지 출재
ret_qs, ret_xl = X - ced_qs, X - ced_xl          # 보유(retention) = 원수 − 출재

# ③ 보유 심도 프로파일 비교표
def profile(v):
    return {"기대값/건": v.mean(), "표준편차": v.std(),
            "CV(변동계수)": v.std() / v.mean(),
            "99.5% 분위수": np.quantile(v, 0.995), "최대": v.max()}

cmp = pd.DataFrame({
    "원수(출재 전)": profile(X),
    "QS 30% 보유": profile(ret_qs),
    "XL 보유": profile(ret_xl),
}).round(2)
print("[클레임 심도 프로파일 — 보유분 비교]")
print(cmp.to_string())
print(f"\\n출재율: QS = {ced_qs.sum() / X.sum():.1%} (정의상 정확히 30%)"
      f" / XL = {ced_xl.sum() / X.sum():.1%}")

# ④ 핵심 확인 — QS는 CV(상대 변동성)가 원수와 동일, XL은 꼬리가 잘려 CV가 감소
#    QS: 모든 손해를 같은 비율로 나누므로 분포의 '모양'은 그대로(자본 효율은 낮음)
#    XL: 대형 손해만 이전 → 보유 99.5% 분위수가 부담점 근처로 뚝 떨어짐.
#    단, '최대' 열을 보면 한도(1,000) 소진 후 초과분은 다시 원수사 몫 —
#    상위 레이어를 더 쌓거나 무제한 특약이 필요한 이유입니다
small, big = X < 50, X > 500
print(f"\\n소액(<50) 클레임 출재율: QS 30.0% vs XL {ced_xl[small].sum() / X[small].sum():.1%}")
print(f"대형(>500) 클레임 출재율: QS 30.0% vs XL {ced_xl[big].sum() / X[big].sum():.1%}")
print(f"CV 검증: 원수 {X.std()/X.mean():.3f} = QS 보유 {ret_qs.std()/ret_qs.mean():.3f}"
      f"  >  XL 보유 {ret_xl.std()/ret_xl.mean():.3f}")
# → QS는 규모와 무관하게 30%, XL은 소액 0%·대형에 집중: '꼬리 위험 이전'은 XL의 몫.
#   실무에선 QS(출재수수료로 사업비 회수·신계약 성장기 자본 지원)와
#   XL(대형사고·누적 위험 방어)을 목적에 따라 조합합니다`,
      },
      {
        title: "몬테카를로 연간 총손해 — 재보험 전후 VaR·TVaR",
        desc: "집합손해 S=ΣX 1만 년 시뮬레이션에 클레임별 XL 적용 — 전후 평균·VaR·TVaR 99.5% 비교, 보유 히스토그램, 자본 절감 대비 순비용까지 계산합니다.",
        level: "advanced",
        code: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# ══════════════════════════════════════════════════════
# 몬테카를로 집합손해모형 — 연간 총손해 S = X1 + … + XN에 XL 재보험 적용
# ══════════════════════════════════════════════════════
# '1년'을 이렇게 시뮬레이션합니다:
#   ① 빈도분포(포아송)에서 그 해의 사고건수 N을 뽑고
#   ② 심도분포(로그정규)에서 손해액 X를 N개 뽑아
#   ③ 클레임마다 XL 분출을 적용해 보유/출재로 나눈 뒤 각각 더하면
#      그 해의 원수 S_gross / 보유 S_ret / 출재 S_ced
# 이것을 1만 년 반복하면 재보험 전후의 분포(평균·VaR·TVaR)를 비교할 수 있습니다.
rng = np.random.default_rng(42)
lam = 12                                    # 연간 기대 사고건수 (포아송)
mu, sigma = np.log(50), 1.2                 # 심도 로그정규 (단위: 백만원)
d, u = 100, 900                             # 클레임당 XL '900 xs 100'

# 1) 연도별 사고건수 N을 한꺼번에 생성
n_years = 10_000
N = rng.poisson(lam, n_years)

# 2) 필요한 심도를 '한 번에' 뽑아 연도별로 잘라 담기(루프보다 훨씬 빠름)
total = int(N.sum())
all_x = rng.lognormal(mu, sigma, total)
ced_x = np.clip(all_x - d, 0, u)            # 클레임별 XL 출재액
ret_x = all_x - ced_x                       # 클레임별 보유액
idx = np.r_[0, np.cumsum(N)]                # 연도별 시작 위치
S_gross = np.zeros(n_years)
S_ret = np.zeros(n_years)
for i in range(n_years):
    S_gross[i] = all_x[idx[i]:idx[i + 1]].sum()   # 그 해의 원수 총손해
    S_ret[i] = ret_x[idx[i]:idx[i + 1]].sum()     # 그 해의 보유 총손해
S_ced = S_gross - S_ret

# 3) 결과 — 재보험 전후 비교: VaR(분위수)·TVaR(그 분위수를 넘는 해들의 평균)
def risk(v):
    var = np.quantile(v, 0.995)             # VaR 99.5%: '200년에 1번' 수준의 나쁜 해
    return {"평균": v.mean(), "표준편차": v.std(),
            "VaR 99.5%": var,
            "TVaR 99.5%": v[v >= var].mean(),      # TVaR: 최악 0.5% 해들의 평균
            "요구자본(VaR−평균)": var - v.mean()}   # 예상초과손해를 흡수할 자본

tbl = pd.DataFrame({"재보험 전(원수)": risk(S_gross),
                    "재보험 후(보유)": risk(S_ret)}).round(1)
print("[연간 총손해 — 재보험 전후 비교 (백만원)]")
print(tbl.to_string())
print(f"\\n검증: E[S] 시뮬 {S_gross.mean():,.0f} vs 이론 λ·E[X] = {lam * np.exp(mu + sigma**2 / 2):,.0f}")

# 4) 재보험의 경제성 — 자본 절감 vs 순비용 (K-ICS 요구자본이 99.5% VaR 기반이므로
#    XL로 꼬리를 이전하면 보험리스크 요구자본이 완화되어 지급여력비율이 개선됩니다)
loading = 0.25                              # 재보험사 로딩(사업비·이윤·변동성 마진)
ri_premium = S_ced.mean() * (1 + loading)   # 재보험료 = 기대출재 × (1+로딩)
net_cost = ri_premium - S_ced.mean()        # 순비용 = 로딩만큼 (기대손해는 그대로 이전)
cap_before = np.quantile(S_gross, 0.995) - S_gross.mean()
cap_after = np.quantile(S_ret, 0.995) - S_ret.mean()
print(f"\\n기대출재 {S_ced.mean():,.0f} → 재보험료 {ri_premium:,.0f} (순비용 {net_cost:,.0f}/년)")
print(f"요구자본 {cap_before:,.0f} → {cap_after:,.0f} (절감 {cap_before - cap_after:,.0f})")
print(f"자본 1 절감당 순비용 = {net_cost / (cap_before - cap_after):.3f} ← 자본비용률(예: 6~10%)보다 낮으면 효율적")
# → 이 예시는 0.11로 경계선 — 실무에선 로딩 협상, 부담점(d)·한도(u) 조정으로
#   이 비율을 자본비용률 아래로 낮추는 것이 재보험 프로그램 최적화의 핵심입니다

# 5) 보유 분포 히스토그램 — 재보험 전후 겹침: 오른쪽 꼬리가 잘려 들어오는 것이 핵심
plt.figure(figsize=(6.5, 3.4))
plt.hist(S_gross, bins=80, density=True, alpha=0.45, label="Gross S")
plt.hist(S_ret, bins=80, density=True, alpha=0.55, label="Retained S")
plt.axvline(np.quantile(S_gross, 0.995), color="r", ls="--", lw=1, label="VaR 99.5% (gross)")
plt.axvline(np.quantile(S_ret, 0.995), color="b", ls=":", lw=1, label="VaR 99.5% (retained)")
plt.title("Annual aggregate loss: gross vs retained")
plt.legend(); plt.tight_layout(); plt.show()`,
      },
    ],
  },
];
