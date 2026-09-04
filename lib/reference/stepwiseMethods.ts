/**
 * 전통적 회귀 적합(변수선택) 2종 — '전통 선형회귀 적합'·'전통 로지스틱 적합'.
 * 사용자 요청(2026-07-30): 전진선택법·후진소거법·단계적 선택(stepwise)을 단계별로 다룬다.
 *
 * 파이썬 탭·엑셀(=PY()) 탭의 코드가 데이터 로드 줄만 다르므로 한 소스(env 분기)에서 둘 다 만든다.
 * 구현은 statsmodels + numpy만 사용 — 브라우저(Pyodide)·엑셀 공통 실행.
 * 항(term) 단위 유의성은 wald_test_terms()로 검정하고, 없으면 더미 p값 최대치로 폴백한다.
 */

import type { MethodCodeSection, StatMethod } from "./statMethods";
import type { MethodExcelCode } from "./methodExcelCode";
import { guard } from "./modelResultSections";

type Env = "py" | "xl";
type Family = "linear" | "logistic";

const FILE: Record<Family, string> = { linear: "policy.xlsx", logistic: "policy.xlsx" };
const TARGET: Record<Family, string> = { linear: "premium", logistic: "lapsed" };

const load = (fam: Family, env: Env) =>
  env === "py"
    ? `df = pd.read_excel("${FILE[fam]}")   # 실행기: '샘플 데이터' 또는 내 파일 업로드`
    : `df = xl("policy[#All]", headers=True)   # 시트의 표/범위를 참조`;


/** 최소 준비 예시(6줄) — 셀마다 반복되던 준비 블록을 대체하는 `#>` 주석용 */
function prepHint(fam: Family, env: Env): string {
  const load =
    env === "py"
      ? `df = pd.read_excel("${FILE[fam]}").dropna()   # 엑셀: xl("policy[#All]", headers=True)`
      : `df = xl("policy[#All]", headers=True).dropna()   # 실행기: pd.read_excel("${FILE[fam]}")`;
  const fitLine =
    fam === "linear"
      ? `def fit(f, data=None): return smf.ols(f, data=df if data is None else data).fit()`
      : `def fit(f, data=None): return smf.logit(f, data=df if data is None else data).fit(disp=0)`;
  const yLine =
    fam === "logistic"
      ? `df = df.assign(**{TARGET: df[TARGET].astype(int)})   # 0/1 로 변환
`
      : "";
  return `import pandas as pd, numpy as np, statsmodels.formula.api as smf
${load}
TARGET = "${TARGET[fam]}"
${yLine}TERMS = ["age", "bmi", "dependents", "C(sex)", "C(product)"]   # 후보 항(범주형은 C())
${fitLine}
def term_pvalues(r): return {t: max([q for n, q in r.pvalues.items() if (t[2:-1] if t.startswith("C(") else t) in n] or [1.0]) for t in TERMS}
CRIT = "aic"
def score(r): return r.aic if CRIT == "aic" else r.bic`;
}



/** 공통 준비 — 데이터 로드·열 자동 선택·적합 함수(fit)·항 목록(TERMS) */
function prepCell(fam: Family, env: Env): string {
  const fitBody =
    fam === "linear"
      ? `    return smf.ols(formula, data=data).fit()`
      : `    return smf.logit(formula, data=data).fit(disp=0)`;
  const yPrep =
    fam === "logistic"
      ? `# 목표변수를 0/1로 (불리언·문자 라벨 모두 대응)
yraw = df[TARGET]
df = df.assign(**{TARGET: (yraw.astype(int) if yraw.dtype != object
                           else (yraw == sorted(yraw.dropna().unique())[-1]).astype(int))})
`
      : "";
  return `# %%
# 데이터 로드 — 파일(실행기)이나 시트 범위(엑셀)에서 표를 읽습니다
import pandas as pd
import numpy as np
import statsmodels.formula.api as smf

${load(fam, env)}
df.head()   # 열 이름·값 확인(다음 셀에서 목표변수·후보 항을 정합니다)

# %%
# 변수 설정 — 목표변수만 정하면 후보 항(TERMS)과 적합 함수(fit)를 만들어 둡니다
# (뒤의 모든 선택 셀이 여기서 만든 TARGET·TERMS·fit()·term_pvalues() 를 씁니다)
TARGET = "${TARGET[fam]}"                  # ← 목표변수(y). 실제 열 이름으로 바꾸세요
# 식별자, 그리고 목표변수에서 파생된 열(누출)은 후보에서 빼야 합니다
DROP = ${fam === "linear"
    ? `["policy_id", "customer_id", "premium_ratio"]   # premium_ratio = premium / income (누출)`
    : `["policy_id", "customer_id"]`}
MAX_LEVELS = 10                         # 범주형은 고유값이 이 수 이하일 때만 후보로

num_all = [c for c in df.select_dtypes("number").columns if c not in DROP]
cat_all = [c for c in df.select_dtypes(["object", "category", "bool"]).columns if c not in DROP]
if TARGET not in df.columns:
    TARGET = num_all[-1]
NUMX = [c for c in num_all if c != TARGET]
CATX = [c for c in cat_all if c != TARGET and 2 <= df[c].nunique() <= MAX_LEVELS]
${yPrep}
# 결측이 있으면 모형마다 표본이 달라져 AIC 비교가 무의미해집니다 → 후보 열 기준으로 미리 제거
df = df[[TARGET] + NUMX + CATX].dropna().reset_index(drop=True)

# 후보 항(term) — 범주형은 C()로 감싸 한 덩어리(더미 묶음)로 다룹니다
TERMS = NUMX + [f"C({c})" for c in CATX]

def fit(formula, data=None):
    """가족(선형/로지스틱)에 맞는 적합 — 아래 모든 선택법이 이 함수만 씁니다"""
    data = df if data is None else data
${fitBody}

def term_pvalues(res):
    """항 단위 p값 — 범주형은 더미 전체를 한 번에 검정(Wald). 실패 시 더미 p값 최대치"""
    try:
        t = res.wald_test_terms(skip_single=False).table
        col = [c for c in t.columns if str(c).lower().startswith("p>")][0]
        return {str(i): float(v) for i, v in t[col].items() if str(i) != "Intercept"}
    except Exception:
        out = {}
        for term in TERMS:
            key = term[2:-1] if term.startswith("C(") else term
            ps = [p for n, p in res.pvalues.items() if n != "Intercept" and key in n]
            if ps:
                out[term] = max(ps)
        return out

# 후보 항을 직접 정하려면 아래처럼 열 이름을 지정하세요(주석을 풀고 수정):
# TERMS = ["age", "bmi", "C(sex)", "C(product)"]      # 범주형은 C()로 감싼다
pd.DataFrame({"항목": ["목표변수", "후보 항 수", "수치형", "범주형", "분석 표본"],
              "값": [TARGET, len(TERMS), len(NUMX), len(CATX), len(df)]})`;
}

const forwardCell = (g: string) => `# %%
# 전진선택법(Forward Selection) — 아무 변수도 없는 모형에서 시작해 하나씩 넣습니다
# 기준: AIC가 가장 많이 줄어드는 항을 투입, 더 줄지 않으면 정지
${g}
CRIT = "aic"     # ← "aic"(예측 지향) 또는 "bic"(더 엄격·간결한 모형)

def score(res):
    return res.aic if CRIT == "aic" else res.bic

selected, remaining = [], list(TERMS)
best = score(fit(f"{TARGET} ~ 1"))
log = [{"단계": 0, "동작": "시작(절편만)", "항": "1", "항 수": 0, CRIT.upper(): best, "개선": np.nan}]

step = 0
while remaining:
    trials = []
    for c in remaining:
        f = f"{TARGET} ~ " + " + ".join(selected + [c])
        trials.append((score(fit(f)), c))
    trials.sort(key=lambda x: x[0])
    cand_score, cand = trials[0]
    if cand_score >= best - 1e-9:          # 더 이상 개선 없음 → 정지
        log.append({"단계": step + 1, "동작": "정지(개선 없음)", "항": cand, "항 수": len(selected),
                    CRIT.upper(): best, "개선": 0.0})
        break
    step += 1
    log.append({"단계": step, "동작": "투입(+)", "항": cand, "항 수": len(selected) + 1,
                CRIT.upper(): cand_score, "개선": best - cand_score})
    selected.append(cand); remaining.remove(cand); best = cand_score

fwd_terms = list(selected)
fwd = fit(f"{TARGET} ~ " + (" + ".join(fwd_terms) if fwd_terms else "1"))
pd.DataFrame(log).round(4)   # 단계별로 어떤 항이 왜 들어갔는지 기록(셀에 표로 반환)`;

const backwardCell = (g: string) => `# %%
# 후진소거법(Backward Elimination) — 전체 모형에서 시작해 유의하지 않은 항을 하나씩 뺍니다
# 기준: 항 단위 p값이 가장 큰 항을 제거(SLS=0.05), 모두 유의해지면 정지
${g}
SLS = 0.05       # ← 제거 유의수준(느슨하게 0.10을 쓰기도 합니다)

keep = list(TERMS)
res = fit(f"{TARGET} ~ " + " + ".join(keep))
log = [{"단계": 0, "동작": "시작(전체 모형)", "항": f"{len(keep)}개", "최대 p값": np.nan,
        "항 수": len(keep), "AIC": res.aic}]

step = 0
while keep:
    pv = term_pvalues(res)
    pv = {k: v for k, v in pv.items() if k in keep}
    if not pv:
        break
    worst = max(pv, key=pv.get)
    if pv[worst] <= SLS:                   # 모두 유의 → 정지
        log.append({"단계": step + 1, "동작": "정지(모두 유의)", "항": worst,
                    "최대 p값": pv[worst], "항 수": len(keep), "AIC": res.aic})
        break
    step += 1
    keep.remove(worst)
    res = fit(f"{TARGET} ~ " + (" + ".join(keep) if keep else "1"))
    log.append({"단계": step, "동작": "제거(-)", "항": worst, "최대 p값": pv[worst],
                "항 수": len(keep), "AIC": res.aic})

bwd_terms = list(keep)
bwd = res
pd.DataFrame(log).round(4)   # 제거 순서와 그때의 p값·AIC(셀에 표로 반환)`;

const stepwiseCell = (g: string) => `# %%
# 단계적 선택(Stepwise) — 전진 투입과 후진 제거를 번갈아 반복합니다
# 한 번 넣은 항도 뒤에 들어온 변수 때문에 불필요해지면 다시 뺍니다(전진·후진의 약점 보완)
${g}
selected = []
best = score(fit(f"{TARGET} ~ 1"))
log = [{"단계": 0, "동작": "시작(절편만)", "항": "1", "항 수": 0, CRIT.upper(): best}]
step, changed = 0, True

while changed:
    changed = False
    # (a) 전진 — 넣어서 기준이 개선되는 항 중 최선
    trials = [(score(fit(f"{TARGET} ~ " + " + ".join(selected + [c]))), c)
              for c in TERMS if c not in selected]
    if trials:
        s, c = min(trials, key=lambda x: x[0])
        if s < best - 1e-9:
            step += 1; selected.append(c); best = s; changed = True
            log.append({"단계": step, "동작": "투입(+)", "항": c, "항 수": len(selected),
                        CRIT.upper(): best})
    # (b) 후진 — 빼서 기준이 개선되는 항이 있으면 제거
    if len(selected) > 1:
        trials = [(score(fit(f"{TARGET} ~ " + " + ".join([x for x in selected if x != c]))), c)
                  for c in selected]
        s, c = min(trials, key=lambda x: x[0])
        if s < best - 1e-9:
            step += 1; selected.remove(c); best = s; changed = True
            log.append({"단계": step, "동작": "제거(-)", "항": c, "항 수": len(selected),
                        CRIT.upper(): best})

step_terms = list(selected)
stepm = fit(f"{TARGET} ~ " + (" + ".join(step_terms) if step_terms else "1"))
pd.DataFrame(log).round(4)   # 투입·제거가 번갈아 나타나는 기록(셀에 표로 반환)`;

/** ⑤ 네 모형 비교 표 + ⑥ 최종 계수 표·수식 */
function compareCells(fam: Family, g: string): string {
  const rowStats =
    fam === "linear"
      ? `        "수정 R²": r.rsquared_adj,
        "RMSE": float(np.sqrt(np.mean(r.resid ** 2))),`
      : `        "pseudo R²": r.prsquared,
        "ROC-AUC": roc_auc_score(np.asarray(r.model.endog), np.asarray(r.predict())),`;
  const extraImport =
    fam === "logistic" ? `from sklearn.metrics import roc_auc_score\n` : "";
  // f-string 안에서 같은 인용부호 중첩은 파이썬 3.12+만 허용 → 리터럴을 직접 만든다
  const eqHead = fam === "linear" ? `f"{TARGET} = {b0:,.4f}"` : `f"z = {b0:,.4f}"`;
  const eqTail =
    fam === "linear"
      ? `EQ`
      : `EQ = EQ + "   →   p = 1 / (1 + exp(-z))"
EQ`;
  const guardFinal = guard("final('최종 계수 표' 셀에서 고른 모형)", "final = stepm");
  const coefTbl =
    fam === "linear"
      ? `tbl = pd.DataFrame({
    "변수": final.params.index, "계수": final.params.values, "표준오차": final.bse.values,
    "t값": final.tvalues.values, "p값": final.pvalues.values,
    "하한95%": ci[0].values, "상한95%": ci[1].values,
})`
      : `tbl = pd.DataFrame({
    "변수": final.params.index, "계수(log-odds)": final.params.values,
    "표준오차": final.bse.values, "z값": final.tvalues.values, "p값": final.pvalues.values,
    "오즈비 exp(b)": np.exp(final.params.values),
    "OR 하한95%": np.exp(ci[0].values), "OR 상한95%": np.exp(ci[1].values),
})`;
  return `# %%
# 선택법 비교 표 — 전체·전진·후진·단계적 네 모형을 한 표로(셀에 표로 반환)
${g}
${extraImport}rows = []
for name, r, terms in [("전체 모형", fit(f"{TARGET} ~ " + " + ".join(TERMS)), TERMS),
                       ("전진선택", fwd, fwd_terms),
                       ("후진소거", bwd, bwd_terms),
                       ("단계적 선택", stepm, step_terms)]:
    rows.append({
        "방법": name, "선택된 항 수": len(terms),
        "AIC": r.aic, "BIC": r.bic, "로그우도": r.llf,
${rowStats}
        "선택된 항": ", ".join(terms) if terms else "(절편만)",
    })
compare = pd.DataFrame(rows)
compare.round(4)   # AIC·BIC가 가장 작은 모형이 정보기준상 최선(단, 업무 해석 가능성도 함께 보세요)

# %%
# 최종 모형 계수 표 · 추정 수식 — 비교 표에서 고른 모형으로(셀에 표로 반환)
${g}
PICK = "단계적 선택"   # ← "전체 모형" · "전진선택" · "후진소거" · "단계적 선택" 중 선택
final = {"전체 모형": fit(f"{TARGET} ~ " + " + ".join(TERMS)), "전진선택": fwd,
         "후진소거": bwd, "단계적 선택": stepm}[PICK]

ci = final.conf_int()
${coefTbl}
tbl["유의성"] = np.where(tbl["p값"] < 0.001, "***",
                np.where(tbl["p값"] < 0.01, "**",
                np.where(tbl["p값"] < 0.05, "*", "")))
tbl.round(4)   # 선택된 모형의 계수 표(셀에 표로 반환)

# %%
# 최종 모형의 추정 수식 — 보고서·셀에 그대로 사용
${g}${guardFinal}
p = final.params
b0 = float(p.get("Intercept", 0.0))
names = [n for n in p.index if n != "Intercept"]
EQ = ${eqHead}
for n in names:
    EQ += f" {'+' if p[n] >= 0 else '-'} {abs(p[n]):,.4f}·{n}"
${eqTail}`;
}

/** 선택 절차의 주의점 — 두 방법 공통(다중검정·과적합) */
const caveatCell = (g: string) => `# %%
# 선택 절차의 검증 — 변수선택은 '같은 데이터로 여러 번 검정'이라 낙관적으로 치우칩니다
${g}
# (a) 표본을 나눠 선택은 학습에서, 성능은 검증에서 — 선택 자체의 과적합을 확인
from sklearn.model_selection import KFold

tr = df.sample(frac=0.7, random_state=42)
te = df.drop(tr.index)
sel_tr = []
best_tr = score(fit(f"{TARGET} ~ 1", tr))
while True:
    trials = [(score(fit(f"{TARGET} ~ " + " + ".join(sel_tr + [c]), tr)), c)
              for c in TERMS if c not in sel_tr]
    if not trials:
        break
    s, c = min(trials, key=lambda x: x[0])
    if s >= best_tr - 1e-9:
        break
    sel_tr.append(c); best_tr = s

m_tr = fit(f"{TARGET} ~ " + (" + ".join(sel_tr) if sel_tr else "1"), tr)
pred_te = m_tr.predict(te)
rows = [{"항목": "학습(70%) 선택 항", "값": ", ".join(sel_tr) if sel_tr else "(절편만)"},
        {"항목": "전체 데이터 선택 항", "값": ", ".join(step_terms) if step_terms else "(절편만)"},
        {"항목": "선택 결과 일치", "값": "예" if set(sel_tr) == set(step_terms) else "아니오(선택은 표본에 민감)"}]

# (b) 폴드마다 선택을 다시 해 '변수 선택 안정성'을 봅니다 — 자주 뽑히는 항이 신뢰할 만합니다
cnt = {t: 0 for t in TERMS}
kf = KFold(n_splits=5, shuffle=True, random_state=0)
for tr_idx, _ in kf.split(df):
    sub = df.iloc[tr_idx]
    sel, b = [], score(fit(f"{TARGET} ~ 1", sub))
    while True:
        trials = [(score(fit(f"{TARGET} ~ " + " + ".join(sel + [c]), sub)), c)
                  for c in TERMS if c not in sel]
        if not trials:
            break
        s, c = min(trials, key=lambda x: x[0])
        if s >= b - 1e-9:
            break
        sel.append(c); b = s
    for t in sel:
        cnt[t] += 1

stability = pd.DataFrame({"항": list(cnt), "5겹 중 선택 횟수": list(cnt.values())})
stability["선택률(%)"] = stability["5겹 중 선택 횟수"] / 5 * 100
print(pd.DataFrame(rows).to_string(index=False))
stability.sort_values("선택률(%)", ascending=False).reset_index(drop=True)`;

/** 파이썬·엑셀 공통 섹션 생성 */
export function stepwiseSections(fam: Family, env: Env): MethodCodeSection[] {
  // ①(준비)을 안 돌렸어도 각 셀이 단독 실행되도록 — 필요한 것만 즉석 재구성
  const gPrep = guard("df · TARGET · TERMS · fit() · term_pvalues() · score()", prepHint(fam, env));
  const gScore = gPrep;
  const gSel = guard(
    "앞의 '전진선택'·'후진소거'·'단계적 선택' 셀 결과(fwd · bwd · stepm) — 그 셀들을 먼저 실행하세요",
    prepHint(fam, env)
  );
  return [
    {
      title: "준비 — 데이터 로드 · 열 자동 선택 · 후보 항 구성",
      desc: "선택법 네 가지가 모두 이 셀의 fit()·TERMS를 씁니다. 결측은 미리 제거해 모형 간 AIC 비교가 성립하게 합니다.",
      level: "basic",
      code: prepCell(fam, env),
    },
    {
      title: "전진선택법 — 하나씩 넣으며 AIC/BIC 개선을 확인",
      level: "basic",
      code: forwardCell(gPrep),
    },
    {
      title: "후진소거법 — 전체 모형에서 유의하지 않은 항을 하나씩 제거",
      level: "basic",
      code: backwardCell(gPrep),
    },
    {
      title: "단계적 선택(stepwise) — 투입·제거를 번갈아 반복",
      level: "advanced",
      code: stepwiseCell(gScore),
    },
    {
      title: "선택법 비교 표 · 최종 계수 표 · 추정 수식",
      level: "advanced",
      code: compareCells(fam, gSel),
    },
    {
      title: "선택 절차의 검증 — 표본 분할·선택 안정성",
      desc: "변수선택은 같은 데이터로 여러 번 검정하는 절차라 p값·R²가 낙관적으로 치우칩니다. 선택 결과가 표본에 얼마나 민감한지 확인합니다.",
      level: "advanced",
      code: caveatCell(gSel),
    },
  ];
}

/** 워드클라우드·팝업에 붙는 방법 2종 (회귀·통계모형 카테고리) */
export const STEPWISE_METHODS: StatMethod[] = [
  {
    id: "stepwise-linear",
    name: "전통 선형회귀 적합",
    en: "Classical Linear Regression with Variable Selection",
    category: "model",
    weight: 3,
    difficulty: 3,
    params: [
      { name: "CRIT — aic / bic", desc: "선택 기준. AIC는 예측 지향으로 변수를 더 남기고, BIC는 표본 수에 비례한 벌점이 커서 더 간결한 모형을 고릅니다." },
      { name: "SLS — 제거 유의수준", desc: "후진소거에서 항을 뺄 기준 p값(기본 0.05). 탐색 단계에서는 0.10을 쓰기도 합니다." },
      { name: "TERMS — 후보 항", desc: "수치형은 열 이름, 범주형은 C(열)로 한 덩어리 취급 — 더미 하나만 유의해도 항 전체가 남거나 빠집니다." },
      { name: "wald_test_terms()", desc: "항 단위 유의성 검정. 범주형의 더미 여러 개를 한 번에 검정해 개별 더미 p값으로 판단하는 오류를 막습니다." },
      { name: "dropna() 시점", desc: "선택 전에 후보 열 기준으로 결측을 제거합니다 — 모형마다 표본이 달라지면 AIC 비교가 무의미해집니다." },
    ],
    summary: "전진선택·후진소거·단계적 선택으로 설명변수를 고르는 고전적 회귀 적합 절차",
    intro:
      "후보 변수가 많을 때 어떤 변수를 모형에 남길지 정하는 전통적 절차입니다.\n\n- 전진선택: 절편만 있는 모형에서 시작해 기준(AIC/BIC)이 개선되는 항을 하나씩 투입\n- 후진소거: 전체 모형에서 시작해 항 단위 p값이 가장 큰 항부터 제거\n- 단계적 선택: 투입과 제거를 번갈아 반복 — 뒤에 들어온 변수로 불필요해진 항을 다시 뺌\n- 보험 예: 요율 인자 후보 20개 중 통계적으로 유효한 인자만 남기기",
    tips:
      "- 변수선택은 같은 데이터로 여러 번 검정하는 절차 — 최종 p값·R²는 낙관적으로 치우칩니다(보고 시 명시)\n- AIC는 변수를 더 남기고 BIC는 더 줄입니다. 두 기준이 다른 모형을 고르면 업무 해석 가능성으로 결정\n- 자동 선택 결과를 그대로 쓰지 말고 부호·상대도가 업무 상식과 맞는지 확인\n- 공선성이 심하면 선택 결과가 표본에 크게 흔들립니다 → 규제(Ridge/Lasso)가 더 안정적",
    sections: stepwiseSections("linear", "py"),
  },
  {
    id: "stepwise-logistic",
    name: "전통 로지스틱 적합",
    en: "Classical Logistic Regression with Variable Selection",
    category: "model",
    weight: 3,
    difficulty: 4,
    params: [
      { name: "CRIT — aic / bic", desc: "선택 기준. 로지스틱은 우도 기반이라 AIC=-2logL+2k, BIC=-2logL+k·log(n)으로 계산됩니다." },
      { name: "SLS — 제거 유의수준", desc: "후진소거 기준 p값(기본 0.05). 항 단위 Wald 검정 결과를 씁니다." },
      { name: "fit(disp=0)", desc: "최적화 로그를 숨깁니다. 수렴 경고가 뜨면 변수 척도 차이·완전분리(perfect separation)를 확인하세요." },
      { name: "오즈비 exp(coef)", desc: "1보다 크면 사건 위험을 높이는 요인. 신뢰구간이 1을 걸치면 방향을 단정할 수 없습니다." },
      { name: "선택 안정성(KFold)", desc: "폴드마다 선택을 다시 해 자주 뽑히는 항을 확인 — 선택률이 낮은 항은 신뢰하기 어렵습니다." },
    ],
    summary: "이진 목표변수에 전진선택·후진소거·단계적 선택을 적용하는 고전적 로지스틱 적합",
    intro:
      "해지·사고 발생처럼 0/1 목표변수를 다루면서, 후보 변수 중 무엇을 남길지 고전적 절차로 정합니다.\n\n- 선택 기준은 우도 기반 AIC/BIC 또는 항 단위 Wald 검정 p값\n- 결과는 계수(log-odds)와 오즈비로 해석 — 요인별 위험 배수를 보고서에 그대로 쓸 수 있음\n- 보험 예: 해지 예측 인자 선별, 언더라이팅 질문 항목 축소",
    tips:
      "- 사건이 드물면(5% 미만) 선택이 불안정합니다 — 사건수 기준 변수당 10건(EPV 10) 이상을 권장\n- 완전분리(어떤 범주에서 사건이 0건)면 계수가 발산합니다 → 해당 범주를 병합\n- pseudo R²는 선형회귀 R²보다 훨씬 낮게 나옵니다(0.2~0.4면 양호)\n- 최종 성능(AUC)은 선택에 쓰지 않은 표본에서 재평가해야 낙관적 편향을 피합니다",
    sections: stepwiseSections("logistic", "py"),
  },
];

const EXCEL_NOTE =
  "데이터는 파일 대신 xl(\"표 또는 범위\", headers=True)로 참조합니다. " +
  "선택 과정의 단계 기록·비교 표·계수 표는 모두 DataFrame이라 =PY() 셀에 표로 스필됩니다 — " +
  "summary()처럼 셀에서 읽기 어려운 출력은 쓰지 않았습니다. " +
  "각 단계를 다른 셀에 나눠 넣으면 앞 셀의 fit()·TERMS·fwd·bwd를 그대로 이어 씁니다(행 우선 실행). " +
  "변수 수가 많으면 선택 루프가 수십~수백 번 적합하므로 =PY() 셀 계산에 시간이 걸릴 수 있습니다.";

/** 엑셀(=PY()) 탭 데이터 — 같은 소스에서 로드 줄만 xl()로 바꿔 생성 */
export const STEPWISE_EXCEL: Record<string, MethodExcelCode> = {
  "stepwise-linear": {
    packageStatus: "available",
    note: EXCEL_NOTE,
    sections: stepwiseSections("linear", "xl").map((s) => ({
      title: s.title,
      level: s.level ?? "basic",
      sameAsOriginal: true,
      code: s.code,
    })),
  },
  "stepwise-logistic": {
    packageStatus: "available",
    note: EXCEL_NOTE,
    sections: stepwiseSections("logistic", "xl").map((s) => ({
      title: s.title,
      level: s.level ?? "basic",
      sameAsOriginal: true,
      code: s.code,
    })),
  },
};
