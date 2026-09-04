// 그래프(matplotlib) 스니펫 — /datalab 파이썬 실행기의 셀별 '그래프 ▾' 콤보박스용.
// 데이터 핸들링(wrangleSnippets)과 동형: 필요할 때 셀에 조각을 삽입한다.
// - 탐색(EDA) 조각은 df(샘플 policy·claims) 가정 — 열 이름만 바꾸면 실제 데이터에도 쓴다.
// - 모델 진단·해석 조각은 '자체 완결' — 인라인으로 빠른 모델을 적합한다. 이미 적합된
//   model·X_te·proba(또는 pred)가 있으면 각 조각 첫 줄 안내대로 준비 블록만 지우면 된다.
// 허용 임포트만(numpy·scipy·pandas·sklearn·matplotlib). SHAP·seaborn 등은 쓰지 않는다.
// 삽입 시 plotInsertCode()가 상단에 '무슨 그래프인지' 설명 헤더(#)를 붙인다.

export interface PlotSnippet {
  id: string;
  /** 콤보박스에 보이는 이름 */
  label: string;
  /** 삽입 코드 상단에 붙는 한 줄 설명(무슨 그래프인지) */
  desc: string;
  /** 셀에 삽입되는 코드 조각(중간 설명 주석 포함) */
  code: string;
}

export interface PlotSnippetGroup {
  id: string;
  /** optgroup 라벨 */
  label: string;
  snippets: PlotSnippet[];
}

/** 삽입 텍스트 — 상단에 '무슨 그래프인지' 설명 헤더(#)를 붙여 반환 */
export function plotInsertCode(s: PlotSnippet): string {
  return `# ▸ ${s.label}\n# ${s.desc}\n${s.code}`;
}

export const PLOT_SNIPPET_GROUPS: PlotSnippetGroup[] = [
  {
    id: "eda",
    label: "탐색 (EDA)",
    snippets: [
      {
        id: "hist-kde",
        label: "히스토그램 + KDE",
        desc: "한 변수의 분포를 히스토그램(막대)과 KDE(부드러운 밀도선)로 겹쳐 봅니다.",
        code: `import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import gaussian_kde

col = "premium"                       # 볼 변수(실제 열로 바꾸세요)
x = df[col].dropna().values

fig, ax = plt.subplots(figsize=(7, 4))
# density=True로 히스토그램을 확률밀도 스케일에 맞춰 KDE와 겹칠 수 있게
ax.hist(x, bins=30, density=True, alpha=0.45, color="#3E6AE1", label="히스토그램")
kde = gaussian_kde(x)                 # 커널 밀도 추정 — 매끄러운 분포선
xs = np.linspace(x.min(), x.max(), 200)
ax.plot(xs, kde(xs), color="#B4531F", lw=2, label="KDE")
ax.set_xlabel(col); ax.set_ylabel("밀도"); ax.legend()
ax.set_title(f"{col} 분포")
plt.tight_layout(); plt.show()`,
      },
      {
        id: "box-violin",
        label: "박스·바이올린 (집단 비교)",
        desc: "그룹별로 한 변수의 분포를 박스플롯·바이올린으로 나란히 비교합니다.",
        code: `import matplotlib.pyplot as plt

by, val = "product", "premium"        # 그룹 열, 값 열(실제 열로 바꾸세요)
grouped = df.dropna(subset=[val]).groupby(by)[val]
labels = [str(k) for k, _ in grouped]
data = [v.values for _, v in grouped]

fig, ax = plt.subplots(1, 2, figsize=(11, 4))
# 버전에 무관하게 눈금 라벨은 직접 지정(boxplot의 labels 인자는 버전마다 달라짐)
ax[0].boxplot(data)
ax[0].set_xticks(range(1, len(labels) + 1))
ax[0].set_xticklabels(labels, rotation=45, ha="right")
ax[0].set_title("박스플롯"); ax[0].set_ylabel(val)

ax[1].violinplot(data, showmeans=True)   # 폭=밀도, 가로선=평균
ax[1].set_xticks(range(1, len(labels) + 1))
ax[1].set_xticklabels(labels, rotation=45, ha="right")
ax[1].set_title("바이올린")
plt.tight_layout(); plt.show()`,
      },
      {
        id: "scatter-reg",
        label: "산점도 + 회귀선",
        desc: "두 변수의 산점도에 최소제곱 회귀선(np.polyfit 1차)을 얹어 관계를 봅니다.",
        code: `import numpy as np
import matplotlib.pyplot as plt

xcol, ycol = "age", "premium"         # x, y 변수(실제 열로 바꾸세요)
d = df[[xcol, ycol]].dropna()
x, y = d[xcol].values, d[ycol].values

b1, b0 = np.polyfit(x, y, 1)          # 1차 적합 → 기울기 b1, 절편 b0
r = np.corrcoef(x, y)[0, 1]           # 상관계수(선형 관계 강도)

fig, ax = plt.subplots(figsize=(7, 4))
ax.scatter(x, y, s=12, alpha=0.4, color="#3E6AE1")
xs = np.linspace(x.min(), x.max(), 100)
ax.plot(xs, b1 * xs + b0, color="#B4531F", lw=2,
        label=f"y = {b1:.1f}x + {b0:.0f}  (r={r:.2f})")
ax.set_xlabel(xcol); ax.set_ylabel(ycol); ax.legend()
plt.tight_layout(); plt.show()`,
      },
      {
        id: "corr-heatmap",
        label: "상관 히트맵",
        desc: "수치형 열들의 상관계수 행렬을 색과 숫자로 히트맵에 표시합니다.",
        code: `import matplotlib.pyplot as plt

num = df.select_dtypes("number")      # 수치형 열만
corr = num.corr()                     # 피어슨 상관 행렬

fig, ax = plt.subplots(figsize=(7, 6))
im = ax.imshow(corr.values, cmap="coolwarm", vmin=-1, vmax=1)
ax.set_xticks(range(len(corr))); ax.set_xticklabels(corr.columns, rotation=90)
ax.set_yticks(range(len(corr))); ax.set_yticklabels(corr.columns)
# 각 칸에 상관계수 숫자 주석
for i in range(len(corr)):
    for j in range(len(corr)):
        ax.text(j, i, f"{corr.values[i, j]:.2f}", ha="center", va="center",
                fontsize=7, color="black")
fig.colorbar(im, ax=ax, shrink=0.8)
ax.set_title("상관 히트맵")
plt.tight_layout(); plt.show()`,
      },
      {
        id: "scatter-matrix",
        label: "산점도 행렬",
        desc: "여러 변수의 쌍별 산점도와 대각선 분포를 격자로 한눈에 봅니다.",
        code: `import matplotlib.pyplot as plt
import pandas as pd

cols = ["age", "premium", "bmi", "income"]   # 볼 변수들(실제 열로 바꾸세요)
d = df[cols].dropna()

axes = pd.plotting.scatter_matrix(
    d, figsize=(8, 8), diagonal="hist",   # 대각선은 각 변수 히스토그램
    alpha=0.4, color="#3E6AE1", hist_kwds={"bins": 20})
for ax in axes.ravel():
    ax.xaxis.label.set_size(8); ax.yaxis.label.set_size(8)
plt.tight_layout(); plt.show()`,
      },
      {
        id: "select-columns",
        label: "특정 열 선택·읽기",
        desc: "데이터셋에서 분석·플롯에 쓸 특정 열만 이름(또는 위치)으로 골라 읽고, 자료형·미리보기·결측을 확인합니다.",
        code: `import pandas as pd

# 하나의 데이터셋(df)에서 분석·그래프에 쓸 특정 열만 골라 읽어옵니다.
cols = ["age", "premium", "product"]      # 쓸 열 이름(실제 열로 바꾸세요)
sub = df[cols].copy()                      # 이름으로 선택(원본 보존 위해 copy)
# sub = df.iloc[:, [0, 1, 4]].copy()       # ← 열 위치(정수)로 고르는 대안

print("선택한 열:", list(sub.columns))
print(sub.dtypes)                          # 열별 자료형
print(sub.head())                          # 상위 5행 미리보기
print("결측 수:", sub.isna().sum().to_dict())`,
      },
      {
        id: "scatter-groups",
        label: "scatter 2D — x·y·구분 색상",
        desc: "x·y 두 축에 '구분'(군집·클래스 등 범주) 열로 색을 나눠 그리는 산점도 — K-평균 군집·분류 결과 확인에 씁니다.",
        code: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# x·y 두 축 + '구분'(군집·클래스 등 범주) 한 열로 색을 나눠 그리는 산점도.
# 실제 열 이름으로 바꾸세요. 열 위치로 잡으려면 아래 iloc 주석을 쓰세요.
xcol, ycol, gcol = "age", "premium", "cluster"
d = df[[xcol, ycol, gcol]].dropna()
# x, y, g = df.iloc[:, 0], df.iloc[:, 1], df.iloc[:, 2]   # ← 열 위치로 잡기(대안)
x = d[xcol].to_numpy(); y = d[ycol].to_numpy()

# 구분 값이 문자/범주여도 색이 나오도록 코드(0,1,2…)로 변환
cat = pd.Categorical(d[gcol])
codes = cat.codes

fig, ax = plt.subplots(figsize=(7, 5))
# 그룹마다 따로 그려 '어떤 색=어떤 그룹'을 범례로 표시(범주형엔 colorbar보다 명확)
cmap = plt.get_cmap("viridis", max(1, len(cat.categories)))
for i, name in enumerate(cat.categories):
    mask = codes == i
    ax.scatter(x[mask], y[mask], s=40, alpha=0.75, color=cmap(i), label=str(name))
ax.set_xlabel(xcol); ax.set_ylabel(ycol); ax.legend(title=gcol)
ax.set_title(f"{xcol} vs {ycol} — colored by {gcol}")
ax.grid(True, alpha=0.3)
plt.tight_layout(); plt.show()`,
      },
      {
        id: "scatter-3d",
        label: "scatter 3D — x·y·z·구분",
        desc: "x·y·z 세 축을 3차원 산점도로 — 구분(범주)은 색으로. 2D로 겹쳐 안 보이는 3변수 관계·군집을 봅니다.",
        code: `import pandas as pd
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D  # noqa: F401 (3D 투영 등록)

# x·y·z 세 축 + '구분'(범주) 색상 — 3변수 관계를 입체로 확인
xcol, ycol, zcol, gcol = "age", "premium", "bmi", "product"
d = df[[xcol, ycol, zcol, gcol]].dropna()
codes = pd.Categorical(d[gcol]).codes      # 범주 → 색 코드(0,1,2…)

fig = plt.figure(figsize=(7, 6))
ax = fig.add_subplot(projection="3d")      # 3D 축
p = ax.scatter(d[xcol], d[ycol], d[zcol], c=codes, cmap="viridis", s=30, alpha=0.8)
ax.set_xlabel(xcol); ax.set_ylabel(ycol); ax.set_zlabel(zcol)
ax.set_title(f"3D scatter — {xcol}·{ycol}·{zcol}")
fig.colorbar(p, ax=ax, label=gcol, shrink=0.6)
# ax.view_init(elev=20, azim=45)           # 보는 각도 조정(선택)
plt.tight_layout(); plt.show()`,
      },
      {
        id: "scatter-shape-color",
        label: "산점도 — 그룹 모양+색 구분",
        desc: "여러 그룹을 '색 + 마커 모양' 두 가지로 동시에 구분 — 그룹이 많거나 흑백 인쇄 시 색만으론 헷갈릴 때.",
        code: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# 여러 그룹을 색과 마커 모양 두 가지로 구분(색만으론 헷갈리거나 흑백 출력 대비)
xcol, ycol, gcol = "age", "premium", "product"
d = df[[xcol, ycol, gcol]].dropna()
cats = pd.Categorical(d[gcol]); codes = cats.codes
x = d[xcol].to_numpy(); y = d[ycol].to_numpy()

markers = ["o", "s", "^", "D", "v", "P", "X", "*"]   # 그룹별 마커 모양
cmap = plt.get_cmap("tab10")
fig, ax = plt.subplots(figsize=(7, 5))
for i, name in enumerate(cats.categories):
    m = codes == i
    ax.scatter(x[m], y[m], label=str(name),
               marker=markers[i % len(markers)], color=cmap(i % 10),
               s=45, alpha=0.8, edgecolor="white", linewidth=0.4)
ax.set_xlabel(xcol); ax.set_ylabel(ycol); ax.legend(title=gcol)
ax.set_title(f"{xcol} vs {ycol} — 그룹: 모양+색")
plt.tight_layout(); plt.show()`,
      },
    ],
  },
  {
    id: "diag",
    label: "모델 진단",
    snippets: [
      {
        id: "residual-plot",
        label: "잔차 플롯 (예측 vs 잔차)",
        desc: "회귀 예측값 대비 잔차(실제-예측) 산점도 — 무작위 흩어짐이면 좋은 적합입니다.",
        code: `# 이미 model·X_te·y_te·pred(회귀)가 있으면 아래 준비 블록(--- 준비 끝 ---까지)을 지우세요
import numpy as np, matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
num = ["age", "bmi", "income", "tenure_months", "n_contracts"]
d = df.dropna(subset=num + ["premium"]).copy()
X, y = d[num], d["premium"]
X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.3, random_state=42)
model = RandomForestRegressor(n_estimators=200, random_state=42).fit(X_tr, y_tr)
pred = model.predict(X_te)
# --- 준비 끝 ---

resid = y_te.values - pred            # 잔차 = 실제 - 예측
fig, ax = plt.subplots(figsize=(7, 4))
ax.scatter(pred, resid, s=12, alpha=0.4, color="#3E6AE1")
ax.axhline(0, color="#B4531F", lw=1.5)   # 0 기준선 주위로 고르게 흩어지면 이상적
ax.set_xlabel("예측값"); ax.set_ylabel("잔차 (실제 - 예측)")
ax.set_title("잔차 플롯 — 패턴이 보이면 모형 미비 신호")
plt.tight_layout(); plt.show()`,
      },
      {
        id: "learning-curve",
        label: "학습곡선 (learning_curve)",
        desc: "표본 수를 늘리며 학습/검증 점수 변화를 그려 과소·과대적합을 진단합니다.",
        code: `# 이미 estimator·X·y가 있으면 아래 준비 블록(--- 준비 끝 ---까지)을 지우세요
import numpy as np, matplotlib.pyplot as plt
from sklearn.model_selection import learning_curve
from sklearn.ensemble import RandomForestClassifier
num = ["age", "premium", "bmi", "income", "tenure_months", "n_contracts"]
d = df.dropna(subset=num).copy()
X, y = d[num], d["lapsed"].astype(int)
estimator = RandomForestClassifier(n_estimators=120, random_state=42)
# --- 준비 끝 ---

sizes, train_sc, val_sc = learning_curve(
    estimator, X, y, cv=5, scoring="roc_auc",
    train_sizes=np.linspace(0.1, 1.0, 6), random_state=42)
fig, ax = plt.subplots(figsize=(7, 4))
ax.plot(sizes, train_sc.mean(axis=1), "o-", color="#3E6AE1", label="학습 점수")
ax.plot(sizes, val_sc.mean(axis=1), "o-", color="#B4531F", label="검증 점수")
ax.set_xlabel("학습 표본 수"); ax.set_ylabel("ROC-AUC"); ax.legend()
ax.set_title("학습곡선 — 두 선 간격이 크면 과대적합")
plt.tight_layout(); plt.show()`,
      },
      {
        id: "validation-curve",
        label: "검증곡선 (validation_curve)",
        desc: "한 하이퍼파라미터를 바꿔가며 학습/검증 점수를 그려 최적값을 찾습니다.",
        code: `# 이미 estimator·X·y가 있으면 아래 준비 블록(--- 준비 끝 ---까지)을 지우세요
import numpy as np, matplotlib.pyplot as plt
from sklearn.model_selection import validation_curve
from sklearn.ensemble import RandomForestClassifier
num = ["age", "premium", "bmi", "income", "tenure_months", "n_contracts"]
d = df.dropna(subset=num).copy()
X, y = d[num], d["lapsed"].astype(int)
estimator = RandomForestClassifier(n_estimators=120, random_state=42)
# --- 준비 끝 ---

param, rng = "max_depth", [2, 3, 4, 6, 8, 12]   # 바꿔 볼 파라미터·후보값
train_sc, val_sc = validation_curve(
    estimator, X, y, param_name=param, param_range=rng,
    cv=5, scoring="roc_auc")
fig, ax = plt.subplots(figsize=(7, 4))
ax.plot(rng, train_sc.mean(axis=1), "o-", color="#3E6AE1", label="학습 점수")
ax.plot(rng, val_sc.mean(axis=1), "o-", color="#B4531F", label="검증 점수")
ax.set_xlabel(param); ax.set_ylabel("ROC-AUC"); ax.legend()
ax.set_title(f"검증곡선 — 검증 점수 최고점이 {param} 최적값")
plt.tight_layout(); plt.show()`,
      },
      {
        id: "roc-curve",
        label: "ROC 곡선 (RocCurveDisplay)",
        desc: "분류기의 참양성률-거짓양성률 곡선과 AUC로 판별력을 봅니다.",
        code: `# 이미 model·X_te·y_te가 있으면 아래 준비 블록(--- 준비 끝 ---까지)을 지우세요
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import RocCurveDisplay
num = ["age", "premium", "bmi", "income", "tenure_months", "n_contracts"]
d = df.dropna(subset=num).copy()
X, y = d[num], d["lapsed"].astype(int)
X_tr, X_te, y_tr, y_te = train_test_split(
    X, y, test_size=0.3, random_state=42, stratify=y)
model = RandomForestClassifier(n_estimators=200, random_state=42).fit(X_tr, y_tr)
# --- 준비 끝 ---

fig, ax = plt.subplots(figsize=(6, 6))
RocCurveDisplay.from_estimator(model, X_te, y_te, ax=ax, color="#3E6AE1")
ax.plot([0, 1], [0, 1], "--", color="#94A3B8")   # 무작위 기준선(AUC 0.5)
ax.set_title("ROC 곡선 — 좌상단에 붙을수록·AUC 클수록 좋음")
plt.tight_layout(); plt.show()`,
      },
      {
        id: "pr-curve",
        label: "PR 곡선 (PrecisionRecallDisplay)",
        desc: "정밀도-재현율 곡선 — 양성이 드문 불균형 데이터에서 ROC보다 유용합니다.",
        code: `# 이미 model·X_te·y_te가 있으면 아래 준비 블록(--- 준비 끝 ---까지)을 지우세요
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import PrecisionRecallDisplay
num = ["age", "premium", "bmi", "income", "tenure_months", "n_contracts"]
d = df.dropna(subset=num).copy()
X, y = d[num], d["lapsed"].astype(int)
X_tr, X_te, y_tr, y_te = train_test_split(
    X, y, test_size=0.3, random_state=42, stratify=y)
model = RandomForestClassifier(n_estimators=200, random_state=42).fit(X_tr, y_tr)
# --- 준비 끝 ---

fig, ax = plt.subplots(figsize=(6, 5))
PrecisionRecallDisplay.from_estimator(model, X_te, y_te, ax=ax, color="#3E6AE1")
base = y_te.mean()                    # 양성 비율 = 무작위 기준(수평선)
ax.axhline(base, ls="--", color="#94A3B8", label=f"기준(양성비율 {base:.2f})")
ax.legend(); ax.set_title("정밀도-재현율 곡선")
plt.tight_layout(); plt.show()`,
      },
      {
        id: "calibration-curve",
        label: "캘리브레이션 곡선 (+Brier)",
        desc: "예측확률이 실제 발생비율과 얼마나 일치하는지(보정)와 Brier 점수를 봅니다.",
        code: `# 이미 y_te·proba가 있으면 아래 준비 블록(--- 준비 끝 ---까지)을 지우세요
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.calibration import calibration_curve
from sklearn.metrics import brier_score_loss
num = ["age", "premium", "bmi", "income", "tenure_months", "n_contracts"]
d = df.dropna(subset=num).copy()
X, y = d[num], d["lapsed"].astype(int)
X_tr, X_te, y_tr, y_te = train_test_split(
    X, y, test_size=0.3, random_state=42, stratify=y)
model = RandomForestClassifier(n_estimators=200, random_state=42).fit(X_tr, y_tr)
proba = model.predict_proba(X_te)[:, 1]
# --- 준비 끝 ---

frac_pos, mean_pred = calibration_curve(y_te, proba, n_bins=10, strategy="quantile")
brier = brier_score_loss(y_te, proba)    # 낮을수록 보정·정확도 좋음(0~1)
fig, ax = plt.subplots(figsize=(6, 6))
ax.plot([0, 1], [0, 1], "--", color="#94A3B8", label="완벽 보정")
ax.plot(mean_pred, frac_pos, "o-", color="#3E6AE1", label=f"모델 (Brier={brier:.3f})")
ax.set_xlabel("평균 예측확률"); ax.set_ylabel("실제 양성비율"); ax.legend()
ax.set_title("캘리브레이션 곡선 — 대각선에 가까울수록 확률이 믿을 만함")
plt.tight_layout(); plt.show()`,
      },
      {
        id: "lift-gain",
        label: "리프트·게인 차트",
        desc: "예측확률 상위 십분위 누적으로 상위 고객 타깃팅의 효율(리프트·게인)을 봅니다.",
        code: `# 이미 y_te·proba가 있으면 아래 준비 블록(--- 준비 끝 ---까지)을 지우세요
import numpy as np, pandas as pd, matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
num = ["age", "premium", "bmi", "income", "tenure_months", "n_contracts"]
d = df.dropna(subset=num).copy()
X, y = d[num], d["lapsed"].astype(int)
X_tr, X_te, y_tr, y_te = train_test_split(
    X, y, test_size=0.3, random_state=42, stratify=y)
model = RandomForestClassifier(n_estimators=200, random_state=42).fit(X_tr, y_tr)
proba = model.predict_proba(X_te)[:, 1]
# --- 준비 끝 ---

t = pd.DataFrame({"y": np.asarray(y_te), "p": proba}).sort_values("p", ascending=False)
t["cum_pos"] = t["y"].cumsum()
total_pos = t["y"].sum()
frac_cust = np.arange(1, len(t) + 1) / len(t)        # 상위 누적 고객 비율
gain = t["cum_pos"].values / total_pos               # 누적 포착 양성 비율(게인)
lift = gain / frac_cust                               # 리프트 = 게인 / 무작위

fig, ax = plt.subplots(1, 2, figsize=(11, 4))
ax[0].plot(frac_cust, gain, color="#3E6AE1", label="모델")
ax[0].plot([0, 1], [0, 1], "--", color="#94A3B8", label="무작위")
ax[0].set_xlabel("상위 고객 비율"); ax[0].set_ylabel("누적 양성 포착률"); ax[0].legend()
ax[0].set_title("게인 차트")
ax[1].plot(frac_cust, lift, color="#B4531F")
ax[1].axhline(1, ls="--", color="#94A3B8")           # 리프트 1 = 무작위 수준
ax[1].set_xlabel("상위 고객 비율"); ax[1].set_ylabel("리프트(배)")
ax[1].set_title("리프트 차트 — 상위에서 1보다 높을수록 효율적")
plt.tight_layout(); plt.show()`,
      },
    ],
  },
  {
    id: "interpret",
    label: "해석",
    snippets: [
      {
        id: "feature-importance",
        label: "변수 중요도 (막대)",
        desc: "트리 기반 모델의 내장 변수 중요도를 막대그래프로 정렬해 봅니다.",
        code: `# 이미 model(feature_importances_ 보유)·특성명 리스트가 있으면 준비 블록을 지우세요
import numpy as np, matplotlib.pyplot as plt
from sklearn.ensemble import RandomForestClassifier
num = ["age", "premium", "bmi", "income", "tenure_months", "n_contracts"]
d = df.dropna(subset=num).copy()
X, y = d[num], d["lapsed"].astype(int)
model = RandomForestClassifier(n_estimators=200, random_state=42).fit(X, y)
# --- 준비 끝 ---

imp = model.feature_importances_      # 불순도 감소 기반 중요도(합=1)
order = np.argsort(imp)               # 오름차순 → 큰 값이 위로 오게
fig, ax = plt.subplots(figsize=(7, 4))
ax.barh(np.array(num)[order], imp[order], color="#3E6AE1")
ax.set_xlabel("중요도(불순도 감소)")
ax.set_title("변수 중요도 — 주의: 상관·고카디널리티에 편향될 수 있음")
plt.tight_layout(); plt.show()`,
      },
      {
        id: "permutation-importance",
        label: "순열 중요도 (permutation_importance)",
        desc: "각 변수를 뒤섞어 성능 하락폭으로 중요도를 재는 모델 비의존 방법입니다.",
        code: `# 이미 model·X_te·y_te가 있으면 아래 준비 블록(--- 준비 끝 ---까지)을 지우세요
import numpy as np, matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import permutation_importance
num = ["age", "premium", "bmi", "income", "tenure_months", "n_contracts"]
d = df.dropna(subset=num).copy()
X, y = d[num], d["lapsed"].astype(int)
X_tr, X_te, y_tr, y_te = train_test_split(
    X, y, test_size=0.3, random_state=42, stratify=y)
model = RandomForestClassifier(n_estimators=200, random_state=42).fit(X_tr, y_tr)
# --- 준비 끝 ---

# 검증셋에서 각 변수를 섞어 ROC-AUC가 얼마나 떨어지는지 측정(모델 비의존)
r = permutation_importance(model, X_te, y_te, scoring="roc_auc",
                           n_repeats=10, random_state=42)
order = np.argsort(r.importances_mean)
fig, ax = plt.subplots(figsize=(7, 4))
ax.barh(np.array(num)[order], r.importances_mean[order],
        xerr=r.importances_std[order], color="#3E6AE1")
ax.set_xlabel("성능 하락폭(ROC-AUC)")
ax.set_title("순열 중요도 — 값이 클수록 예측에 실제로 기여")
plt.tight_layout(); plt.show()`,
      },
      {
        id: "pdp",
        label: "부분의존도 PDP (PartialDependenceDisplay)",
        desc: "한 변수가 변할 때 예측이 평균적으로 어떻게 변하는지(부분의존)를 봅니다.",
        code: `# 이미 model·X_te가 있으면 아래 준비 블록(--- 준비 끝 ---까지)을 지우세요
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import PartialDependenceDisplay
num = ["age", "premium", "bmi", "income", "tenure_months", "n_contracts"]
d = df.dropna(subset=num).copy()
# PDP/ICE는 정수 열을 그대로 넣으면 경고(sklearn 1.9+ 오류)라 특성을 float으로
X, y = d[num].astype(float), d["lapsed"].astype(int)
X_tr, X_te, y_tr, y_te = train_test_split(
    X, y, test_size=0.3, random_state=42, stratify=y)
model = RandomForestClassifier(n_estimators=200, random_state=42).fit(X_tr, y_tr)
# --- 준비 끝 ---

feats = ["age", "premium"]            # 볼 변수(1~2개, 실제 열로 바꾸세요)
fig, ax = plt.subplots(1, len(feats), figsize=(5 * len(feats), 4))
PartialDependenceDisplay.from_estimator(model, X_te, feats, ax=ax)
fig.suptitle("부분의존도(PDP) — 변수→예측 평균 관계")
plt.tight_layout(); plt.show()`,
      },
      {
        id: "ice",
        label: "ICE (개별 조건부 기대)",
        desc: "PDP를 표본별 선으로 펼쳐(ICE) 개체마다 반응이 다른지(상호작용)를 봅니다.",
        code: `# 이미 model·X_te가 있으면 아래 준비 블록(--- 준비 끝 ---까지)을 지우세요
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import PartialDependenceDisplay
num = ["age", "premium", "bmi", "income", "tenure_months", "n_contracts"]
d = df.dropna(subset=num).copy()
# PDP/ICE는 정수 열을 그대로 넣으면 경고(sklearn 1.9+ 오류)라 특성을 float으로
X, y = d[num].astype(float), d["lapsed"].astype(int)
X_tr, X_te, y_tr, y_te = train_test_split(
    X, y, test_size=0.3, random_state=42, stratify=y)
model = RandomForestClassifier(n_estimators=200, random_state=42).fit(X_tr, y_tr)
# --- 준비 끝 ---

feat = ["age"]                        # 볼 변수 1개(실제 열로 바꾸세요)
fig, ax = plt.subplots(figsize=(7, 5))
# kind="both" = 개별 표본선(ICE, 얇은 선) + 평균선(PDP, 굵은 선)
PartialDependenceDisplay.from_estimator(
    model, X_te, feat, kind="both", subsample=50, random_state=42, ax=ax)
ax.set_title("ICE — 개체별 반응선(얇음) + 평균 PDP(굵음)")
plt.tight_layout(); plt.show()`,
      },
    ],
  },
];
