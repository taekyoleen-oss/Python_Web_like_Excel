# -*- coding: utf-8 -*-
"""샘플 워크북(.pygrid.json)·스니펫(data/snippets.json) 생성기.

스키마: types/workbook.ts (설계서 §3.1). 블록 코드의 xl() 참조는 실제 시트 범위와
일치해야 하며, 로드 직후 전체 실행이 성공해야 한다.

부록 K 계리 예제 5종은 public/samples/*.xlsx 원본을 시트로 내장한다 —
openpyxl이 있으면 쓰고, 없으면 zipfile+xml.etree로 파싱해 자립 실행된다.
"""
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
SAMPLES = ROOT / "data" / "sample-workbooks"
SNIPPETS = ROOT / "data" / "snippets.json"

NOW = "2026-09-02T00:00:00.000Z"


def cell(v, t, f=None):
    c = {"v": v, "t": t}
    if f:
        c["f"] = f
    return c


def sheet_from_rows(sheet_id, name, rows, row_count=200, col_count=26):
    """rows: (Cell|None)[][] → cells 레코드."""
    cells = {}
    for r, row in enumerate(rows):
        for c, cl in enumerate(row):
            if cl is not None:
                cells[f"{r}:{c}"] = cl
    return {
        "id": sheet_id,
        "name": name,
        "rowCount": max(row_count, len(rows) + 20),
        "colCount": col_count,
        "cells": cells,
    }


def workbook(wb_id, title, sheets, blocks):
    return {
        "id": wb_id,
        "version": 1,
        "title": title,
        "sheets": sheets,
        "pyBlocks": blocks,
        "initScript": "",  # 앱 기본 초기화 스크립트 사용
        "calcMode": "auto",
        "settings": {"timeoutSec": 60, "inferTypesOnPaste": True},
        "createdAt": NOW,
        "updatedAt": NOW,
    }


# ── 손해율 워크북 ────────────────────────────────────────


def build_loss_ratio():
    random.seed(42)
    products = ["자동차", "화재", "상해", "배상책임"]
    regions = ["서울", "부산", "대구", "광주"]
    rows = [[cell(h, "s") for h in ("상품", "지역", "보험료", "손해액")]]
    for _ in range(40):
        prem = random.randint(50, 500) * 100000
        loss = int(prem * random.uniform(0.3, 1.1))
        rows.append([
            cell(random.choice(products), "s"),
            cell(random.choice(regions), "s"),
            cell(prem, "n", "#,##0"),
            cell(loss, "n", "#,##0"),
        ])

    agg_block = {
        "id": "blk-loss-agg",
        "sheetId": "sh-loss-data",
        "anchor": {"r": 1, "c": 5},  # F2
        "outputMode": "values",
        "includeIndex": "auto",
        "title": "상품별 손해율",
        "code": (
            'df = xl("A1:D41", headers=True)\n'
            'g = df.groupby("상품").agg(\n'
            '    보험료=("보험료", "sum"), 손해액=("손해액", "sum"))\n'
            'g["손해율"] = (g["손해액"] / g["보험료"]).round(3)\n'
            "g"
        ),
    }
    return workbook(
        "wb-sample-loss-ratio",
        "손해율 집계 예제",
        [sheet_from_rows("sh-loss-data", "데이터", rows)],
        [agg_block],
    )


# ── 청구 심도 적합 워크북 (부록 H.2) ─────────────────────
# H.3 모델적합 가이드(심도)가 생성하는 형태의 완성본 — 로그정규·감마·와이블 비교.
# 블록 코드는 lib/grid/fit-guide.ts 템플릿과 같은 내용(xl 참조·자체 완결 실행).

SEV_REF = '청구액!A1:A301'
SEV_LOAD = (
    'df = xl("청구액!A1:A301", headers=True)\n'
    'x = df["청구액"].dropna().astype(float).to_numpy()'
)
SEV_STANZAS = """fits = []
s, _, sc = stats.lognorm.fit(x, floc=0)      # 로그정규: floc=0, s=sigma, scale=e^mu
fits.append(("로그정규", stats.lognorm(s, 0, sc), 2, f"mu={np.log(sc):.4g}, sigma={s:.4g}"))
a, _, sc = stats.gamma.fit(x, floc=0)        # 감마: alpha=형상, theta=척도 (평균=alpha*theta)
fits.append(("감마", stats.gamma(a, 0, sc), 2, f"alpha={a:.4g}, theta={sc:.4g}"))
c, _, sc = stats.weibull_min.fit(x, floc=0)  # 와이블: k=형상(고장률 증감), lambda=척도
fits.append(("와이블", stats.weibull_min(c, 0, sc), 2, f"k={c:.4g}, lambda={sc:.4g}"))"""


def md_block(bid, sheet_id, r, c, markdown, title):
    return {
        "id": bid,
        "sheetId": sheet_id,
        "anchor": {"r": r, "c": c},
        "code": "",
        "outputMode": "values",
        "includeIndex": "auto",
        "kind": "markdown",
        "title": title,
        "markdown": markdown,
    }


def code_block(bid, sheet_id, r, c, title, code, mode="values"):
    return {
        "id": bid,
        "sheetId": sheet_id,
        "anchor": {"r": r, "c": c},
        "outputMode": mode,
        "includeIndex": "auto",
        "title": title,
        "code": code,
    }


def build_claim_severity():
    random.seed(20260906)
    rows = [[cell("청구액", "s")]]
    for _ in range(300):
        rows.append([cell(round(random.lognormvariate(7.3, 0.85)), "n")])

    sid = "sh-claim-sev"
    blocks = [
        md_block(
            "blk-cs-title", sid, 0, 2,
            "# 모델적합 — 심도(개별 손해액)\n\n"
            "`청구액!A1:A301` 범위의 개별 손해액을 후보 분포(로그정규·감마·와이블)에 적합하고\n"
            "AIC 기준으로 최적 분포를 고르는 단계별 예제입니다. 각 단계의 설명을 읽고 코드 블록을\n"
            "순서대로 실행하세요(목차 = 진행 가이드).",
            "모델적합 — 심도(개별 손해액)",
        ),
        md_block(
            "blk-cs-md1", sid, 2, 2,
            "## 1단계 — 데이터 확인\n\n"
            "xl() 참조로 그리드의 `청구액!A1:A301` 범위를 불러옵니다 — 데이터의 원본은 항상 시트입니다.\n"
            '행·열 크기와 값 열("청구액")이 의도한 범위와 일치하는지, 결측이나 이상값이 섞여 있지 않은지 확인하세요.',
            "1단계 — 데이터 확인",
        ),
        code_block(
            "blk-cs-load", sid, 4, 2, "데이터 확인",
            SEV_LOAD + '\nprint("행·열:", df.shape)\n'
            'print("값 열:", "청구액", "· 결측 제외 n =", len(x))\ndf.head()',
        ),
        md_block(
            "blk-cs-md2", sid, 14, 2,
            "## 2단계 — 경험적 분석\n\n"
            "분포를 가정하기 전에 데이터 자체의 생김새를 봅니다. 손해액(심도) 분포는 보통 오른쪽 꼬리가\n"
            "길어(왜도>0) 로그정규·감마 같은 양수 분포가 후보가 됩니다. 히스토그램의 꼬리 두께와\n"
            "90/95/99% 분위수를 확인하세요.",
            "2단계 — 경험적 분석",
        ),
        code_block(
            "blk-cs-emp", sid, 16, 2, "경험적 분석 — 요약·히스토그램",
            "import matplotlib.pyplot as plt\n" + SEV_LOAD + "\n"
            "print(pd.Series(x).describe().round(2))\n"
            'print("분위수 90/95/99%:", [round(float(np.quantile(x, q)), 2) for q in (0.90, 0.95, 0.99)])\n'
            'print("왜도:", round(float(pd.Series(x).skew()), 3), "— 양수면 오른쪽 꼬리(대형 손해)")\n'
            "fig, ax = plt.subplots(figsize=(7, 3.4))\n"
            'ax.hist(x, bins=40, color="#4A90C2", alpha=0.75)\n'
            'ax.set_title("청구액 분포 — 경험적 히스토그램")\n'
            'ax.set_xlabel("청구액")\nfig',
            mode="object",
        ),
        md_block(
            "blk-cs-md3", sid, 18, 2,
            "## 3단계 — 후보 분포 적합\n\n"
            "후보 분포(로그정규·감마·와이블)를 scipy 최대우도추정(MLE)으로 적합하고 logL·AIC·BIC·KS로\n"
            "비교합니다. AIC·BIC는 작을수록 좋고, 비교표는 AIC 오름차순으로 정렬되어 셀에 깔립니다(값 모드 spill).",
            "3단계 — 후보 분포 적합",
        ),
        code_block(
            "blk-cs-fit", sid, 20, 2, "후보 분포 적합 · 비교표",
            "from scipy import stats\n" + SEV_LOAD + "\n\n" + SEV_STANZAS + """

rows = []
for name, dist, k, par in fits:
    logL = float(np.sum(dist.logpdf(x)))          # 로그우도 — 클수록 좋음
    ks = stats.kstest(x, dist.cdf)                # KS: 경험 CDF와의 최대 거리
    rows.append({"분포": name, "파라미터": par, "logL": round(logL, 2),
                 "AIC": round(2 * k - 2 * logL, 2),
                 "BIC": round(k * np.log(len(x)) - 2 * logL, 2),
                 "KS D": round(float(ks.statistic), 4), "KS p": round(float(ks.pvalue), 4)})
pd.DataFrame(rows).sort_values("AIC").reset_index(drop=True)""",
        ),
        md_block(
            "blk-cs-md4", sid, 30, 2,
            "## 4단계 — 최적 분포 검증\n\n"
            "AIC 최소 분포를 경험 분포 위에 겹쳐 그려 순위표만으로 놓치는 것을 확인합니다.\n"
            "PDF·CDF가 잘 얹히는지, Q-Q 점이 45° 선에 가까운지 보세요 — 오른쪽 끝이 위로 휘면\n"
            "실제 꼬리가 모형보다 두껍다는(대형 손해 과소평가) 신호입니다.",
            "4단계 — 최적 분포 검증",
        ),
        code_block(
            "blk-cs-verify", sid, 32, 2, "최적 분포 검증",
            "from scipy import stats\nimport matplotlib.pyplot as plt\n" + SEV_LOAD
            + "\n\n" + SEV_STANZAS + """

def _aic(t):
    return 2 * t[2] - 2 * float(np.sum(t[1].logpdf(x)))
name, dist, k, par = min(fits, key=_aic)
print(f"AIC 최소: {name} ({par})")

xs = np.sort(x); n = len(xs)
xg = np.linspace(float(xs[0]), float(xs[-1]), 300)
fig, ax = plt.subplots(1, 3, figsize=(10.5, 3.4))
ax[0].hist(x, bins=40, density=True, alpha=0.35, color="#4A90C2", label="empirical")
ax[0].plot(xg, dist.pdf(xg), "r-", label=name); ax[0].set_title("PDF"); ax[0].legend()
ax[1].plot(xs, np.arange(1, n + 1) / n, drawstyle="steps-post", color="#4A90C2", label="ECDF")
ax[1].plot(xg, dist.cdf(xg), "r-", label=name); ax[1].set_title("CDF"); ax[1].legend()
pp = (np.arange(1, n + 1) - 0.5) / n
ax[2].scatter(dist.ppf(pp), xs, s=8, color="#4A90C2")
lim = [float(xs[0]), float(xs[-1])]
ax[2].plot(lim, lim, "k--", lw=1)
ax[2].set_title("Q-Q"); ax[2].set_xlabel("이론 분위수"); ax[2].set_ylabel("관측값")
fig.tight_layout()
fig""",
            mode="object",
        ),
    ]
    return workbook(
        "wb-sample-claim-severity",
        "청구 심도 적합 예제",
        [sheet_from_rows(sid, "청구액", rows, row_count=320)],
        blocks,
    )


# ── 계리 예제 데이터 내장 워크북 (부록 K) ────────────────
# public/samples/*.xlsx 원본을 시트로 내장하고, 단계별 [마크다운 + 코드] 쌍이
# 그 데이터를 xl()로 읽어 모델을 산출한다(외부 파일 의존 없음).

XLSX_DIR = ROOT / "public" / "samples"
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def _ref_col(ref):
    """셀 참조 'AB12' → 0-based 열 번호."""
    n = 0
    for ch in ref:
        if not ch.isalpha():
            break
        n = n * 26 + (ord(ch.upper()) - 64)
    return n - 1


def _read_xlsx_stdlib(path):
    """표준 라이브러리만으로 xlsx 첫 시트를 읽는다(단순 표 전제 — 병합·수식·날짜 없음).

    ponytail: sharedStrings + sheet1.xml만 본다. 서식·날짜 시리얼이 필요해지면 openpyxl 경로를 쓸 것.
    """
    import xml.etree.ElementTree as ET
    import zipfile

    with zipfile.ZipFile(path) as z:
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            for si in ET.fromstring(z.read("xl/sharedStrings.xml")):
                shared.append("".join(t.text or "" for t in si.iter(NS + "t")))
        root = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
        grid = []
        for row in root.iter(NS + "row"):
            vals = {}
            for c in row.iter(NS + "c"):
                t = c.get("t", "n")
                v = c.find(NS + "v")
                inline = c.find(NS + "is")
                if t == "inlineStr":
                    val = "".join(x.text or "" for x in inline.iter(NS + "t")) if inline is not None else None
                elif v is None or v.text is None:
                    val = None
                elif t == "s":
                    val = shared[int(v.text)]
                elif t == "b":
                    val = v.text == "1"
                elif t in ("str", "e"):
                    val = v.text
                else:
                    val = float(v.text)
                    if val.is_integer():
                        val = int(val)
                vals[_ref_col(c.get("r", "A1"))] = val
            grid.append([vals.get(i) for i in range(max(vals) + 1 if vals else 0)])
    w = max((len(r) for r in grid), default=0)
    return [r + [None] * (w - len(r)) for r in grid]


def read_xlsx(name):
    """public/samples/<name>.xlsx 첫 시트 → 2차원 값 배열(헤더 포함)."""
    path = XLSX_DIR / f"{name}.xlsx"
    try:
        import openpyxl
    except ImportError:
        return _read_xlsx_stdlib(path)
    ws = openpyxl.load_workbook(path, data_only=True, read_only=True).worksheets[0]
    return [list(r) for r in ws.iter_rows(values_only=True)]


def data_cell(v, ndigits=6):
    """원본 값 → Cell. 서식(f)은 붙이지 않는다(파일 크기 최소화 — 부록 K.3)."""
    if v is None:
        return None
    if isinstance(v, bool):
        return cell(v, "b")
    if isinstance(v, (int, float)):
        return cell(v if isinstance(v, int) else round(v, ndigits), "n")
    return cell(str(v), "s")


def data_sheet(sheet_id, name, table, row_count=None, col_count=26):
    """xlsx 표(헤더 포함) → 시트. 열 이름은 원본 유지(영문)."""
    rows = [[cell(str(h), "s") for h in table[0]]]
    rows += [[data_cell(v) for v in r] for r in table[1:]]
    return sheet_from_rows(sheet_id, name, rows,
                           row_count=row_count or len(rows) + 20, col_count=col_count)


def steps(sheet_id, col, prefix, intro, items):
    """[제목 md] + 단계별 [md + code] 쌍 → 블록 목록.

    items: (앵커 행, 단계 제목, 설명 md, 코드 제목, 코드, 모드) — 앵커 행은 앞 단계 spill 높이를 감안해 둔다.
    """
    blocks = [md_block(f"blk-{prefix}-title", sheet_id, 0, col, intro[1], intro[0])]
    for i, (r, step_title, md, code_title, code, mode) in enumerate(items, 1):
        blocks.append(md_block(f"blk-{prefix}-md{i}", sheet_id, r, col, md, step_title))
        blocks.append(code_block(f"blk-{prefix}-c{i}", sheet_id, r + 2, col, code_title, code, mode))
    return blocks


# ── K.1 위험률·생명표 (mortality_table.xlsx) ─────────────

MORT_REF = 'df = xl("mortality_table!A1:C102", headers=True)'

MORT_FIT_FN = '''
def fit_mortality(age, q):
    """사력 μx = −ln(1−qx)를 로그 축에서 적합 — Gompertz(B·c^x)·Makeham(A+B·c^x)."""
    mu = -np.log(1 - np.clip(q, 0, 0.999999))
    m = (age >= 30) & (mu > 0)                    # 30세 미만은 유아·사고 사망으로 지수법칙에서 벗어난다
    x, ly = age[m], np.log(mu[m])
    b1, b0 = np.polyfit(x, ly, 1)                 # Gompertz는 log μ가 x의 1차식이라 최소제곱 해가 닫힌형
    B0, c0 = float(np.exp(b0)), float(np.exp(b1))
    lg = lambda t, B, c: np.log(B) + t * np.log(c)
    lm = lambda t, A, B, c: np.log(A + B * c ** t)
    (Bg, cg), _ = curve_fit(lg, x, ly, p0=[B0, c0],
                            bounds=([1e-12, 1.0], [1.0, 2.0]), maxfev=20000)
    (Am, Bm, cm), _ = curve_fit(lm, x, ly, p0=[1e-4, B0, c0],
                                bounds=([0.0, 1e-12, 1.0], [1.0, 1.0, 2.0]), maxfev=20000)
    return {
        "Gompertz": (2, dict(B=Bg, c=cg), lambda t: np.exp(lg(t, Bg, cg))),
        "Makeham": (3, dict(A=Am, B=Bm, c=cm), lambda t: np.exp(lm(t, Am, Bm, cm))),
    }, x, ly
'''

MORT_STEPS = [
    (2,
     "1단계 — 데이터 확인·사망률 곡선",
     "## 1단계 — 데이터 확인·사망률 곡선\n\n"
     "`mortality_table` 시트의 `age`(0~100세)·`qx_male`·`qx_female`을 `xl()`로 읽습니다 — 데이터의 원본은 항상 시트입니다.\n"
     "사망률은 연령에 따라 **지수적으로** 커지므로 세로축을 로그로 그립니다. 유아기(0~5세)의 높은 사망률과\n"
     "20대 초반의 완만한 혹(사고 사망)이 보이면 정상입니다.",
     "사망률 곡선 (로그 축)",
     "import matplotlib.pyplot as plt\n" + MORT_REF + """
print(df.describe().round(6))
fig, ax = plt.subplots(figsize=(7, 3.8))
ax.semilogy(df["age"], df["qx_male"], color="#4A90C2", label="남")
ax.semilogy(df["age"], df["qx_female"], color="#C2704A", label="여")
ax.set_title("연령별 사망률 qx (로그 축)")
ax.set_xlabel("연령"); ax.set_ylabel("qx"); ax.grid(alpha=0.3); ax.legend()
fig""",
     "object"),
    (6,
     "2단계 — 성별 생명표 (lx·dx·ex)",
     "## 2단계 — 성별 생명표 (lx·dx·ex)\n\n"
     "기수 100,000명으로 시작해 `l(x+1) = l(x)·(1−q(x))`를 누적하면 생존자 수 `lx`,\n"
     "`dx = lx·qx`가 사망자 수입니다. 평균여명은 `ex ≈ (x 이후 lx 합)/lx − 0.5`로 근사합니다(반년 보정).\n"
     "결과 101행은 **값 모드**로 시트에 깔립니다 — 여성의 `ex`가 같은 연령의 남성보다 크면 정상입니다.",
     "생명표 계산",
     MORT_REF + """

def life_table(q):
    q = np.clip(q.to_numpy(dtype=float), 0, 1)
    lx = np.empty(len(q)); lx[0] = 100000.0
    for i in range(1, len(q)):
        lx[i] = lx[i - 1] * (1 - q[i - 1])
    return lx, lx * q, np.cumsum(lx[::-1])[::-1] / lx - 0.5

out = pd.DataFrame({"age": df["age"]})
for sex, col in (("male", "qx_male"), ("female", "qx_female")):
    lx, dx, ex = life_table(df[col])
    out["lx_" + sex] = lx.round(1)
    out["dx_" + sex] = dx.round(2)
    out["ex_" + sex] = ex.round(2)
out""",
     "values"),
    (112,
     "3단계 — Gompertz·Makeham 적합",
     "## 3단계 — Gompertz·Makeham 적합\n\n"
     "사력 `μx = −ln(1−qx)`를 두 고전 모형에 적합합니다.\n\n"
     "- **Gompertz** `μ = B·c^x` — 로그 축에서 직선. `c`가 연령별 사망률 증가율(보통 1.08~1.11)\n"
     "- **Makeham** `μ = A + B·c^x` — 연령과 무관한 사고 사망 `A`를 더한 모형\n\n"
     "적합 구간은 30세 이상(유아·사고 구간 제외)이고, 잔차는 로그 사력 기준입니다. AIC가 작은 쪽이 낫습니다.",
     "모형 적합 · 계수표",
     "from scipy.optimize import curve_fit\n" + MORT_REF + MORT_FIT_FN + """
age = df["age"].to_numpy(dtype=float)
rows = []
for sex, col in (("남", "qx_male"), ("여", "qx_female")):
    fits, x, ly = fit_mortality(age, df[col].to_numpy(dtype=float))
    for name, (k, par, pred) in fits.items():
        resid = ly - np.log(pred(x))
        mse = float(np.mean(resid ** 2))
        rows.append({"성별": sex, "모형": name,
                     "파라미터": ", ".join(f"{n}={v:.5g}" for n, v in par.items()),
                     "RMSE(log μ)": round(float(np.sqrt(mse)), 4),
                     "AIC": round(len(x) * np.log(mse) + 2 * k, 1)})
pd.DataFrame(rows)""",
     "values"),
    (121,
     "4단계 — 적합 곡선·성별 비교",
     "## 4단계 — 적합 곡선·성별 비교\n\n"
     "관측 사력 위에 적합 곡선을 겹쳐 30세 이상 구간이 잘 맞는지 보고, 오른쪽 그림에서\n"
     "성별 사망률 비 `qx(남)/qx(여)`를 확인합니다. 20~30대에서 비가 가장 커지면(남성 초과사망)\n"
     "일반적인 경험과 일치합니다.",
     "적합 곡선 · 성별 사망률 비",
     "from scipy.optimize import curve_fit\nimport matplotlib.pyplot as plt\n" + MORT_REF + MORT_FIT_FN + """
age = df["age"].to_numpy(dtype=float)
fig, ax = plt.subplots(1, 2, figsize=(10.5, 3.6))
for sex, col, c in (("남", "qx_male", "#4A90C2"), ("여", "qx_female", "#C2704A")):
    q = df[col].to_numpy(dtype=float)
    mu = -np.log(1 - np.clip(q, 0, 0.999999))
    fits, x, _ = fit_mortality(age, q)
    ax[0].semilogy(age, mu, ".", ms=3, color=c, label=f"{sex} 관측")
    ax[0].semilogy(x, fits["Makeham"][2](x), "-", lw=1.2, color=c, label=f"{sex} Makeham")
ax[0].set_title("사력 μx — 관측 vs Makeham"); ax[0].set_xlabel("연령")
ax[0].grid(alpha=0.3); ax[0].legend(fontsize=8)
ax[1].plot(age, df["qx_male"] / df["qx_female"], color="#4A90C2")
ax[1].axhline(1.0, color="#999", lw=1, ls="--")
ax[1].set_title("성별 사망률 비 (남/여)"); ax[1].set_xlabel("연령"); ax[1].grid(alpha=0.3)
fig.tight_layout()
fig""",
     "object"),
]


def build_mortality():
    sid = "sh-mort"
    blocks = steps(sid, 4, "mort",
                   ("위험률·생명표",
                    "# 위험률·생명표\n\n"
                    "성별 경험사망률 `qx`(0~100세, 101행)가 `mortality_table` 시트에 들어 있습니다.\n"
                    "이 데이터로 **생명표(lx·dx·ex)**를 만들고 **Gompertz·Makeham** 모형을 적합한 뒤\n"
                    "성별 사망률을 비교합니다. 데이터와 코드가 한 파일에 있으므로 열자마자 **전체 실행**만 하면 됩니다.\n\n"
                    "> 각 코드 블록은 단독으로 실행할 수 있도록 `xl(\"mortality_table!A1:C102\")`로 데이터를 다시 읽습니다."),
                   MORT_STEPS)
    return workbook(
        "wb-sample-mortality",
        "위험률·생명표 예제",
        [data_sheet(sid, "mortality_table", read_xlsx("mortality_table"), row_count=200)],
        blocks,
    )


# ── K.2 보험료 요인 분석 GLM (policy.xlsx) ───────────────

GLM_FIT = '''df = xl("policy!A1:P601", headers=True)
d = df.copy()
d["income"] = d["income"].fillna(d["income"].median())     # 소득 결측 75건은 중앙값 대치
NUM = ["age", "bmi", "dependents", "tenure_months"]
CAT = ["product", "channel", "region", "sex"]
X = sm.add_constant(pd.get_dummies(d[NUM + CAT], columns=CAT, drop_first=True, dtype=float))
res = sm.GLM(d["premium"].astype(float), X,
             family=sm.families.Gamma(link=sm.families.links.Log())).fit()
'''

GLM_STEPS = [
    (2,
     "1단계 — 기술통계·교차표",
     "## 1단계 — 기술통계·교차표\n\n"
     "`policy` 시트의 계약 600건(16열)을 `xl()`로 읽어 숫자 열의 분포와 결측을 먼저 확인합니다.\n"
     "그다음 **상품 × 채널** 평균 보험료 교차표를 만들어 요인이 실제로 보험료를 가르는지 눈으로 봅니다 —\n"
     "여기서 보이는 차이는 다른 요인(연령·지역)이 섞인 **조 평균**이라, 다음 단계의 GLM으로 분리해야 합니다.",
     "기술통계 · 상품×채널 평균 보험료",
     '''df = xl("policy!A1:P601", headers=True)
print(df[["age", "premium", "bmi", "dependents", "income", "tenure_months"]].describe().round(1))
print("결측 열:", {k: int(v) for k, v in df.isna().sum().items() if v})
pv = df.pivot_table(index="product", columns="channel", values="premium", aggfunc="mean").round(0)
pv["전체"] = df.groupby("product")["premium"].mean().round(0)
pv''',
     "values"),
    (11,
     "2단계 — GLM(감마·로그링크) 적합",
     "## 2단계 — GLM(감마·로그링크) 적합\n\n"
     "보험료는 양수이고 오른쪽 꼬리가 길어 **감마 분포 + 로그 링크**가 표준 선택입니다.\n"
     "로그 링크에서는 계수의 지수 `exp(계수)`가 곧 **상대도(relativity)** — 기준 수준 대비 몇 배인지를 뜻합니다.\n"
     "범주형은 `pd.get_dummies(drop_first=True)`로 기준 수준(암보험·다이렉트·경기·F)을 잡았습니다.\n\n"
     "> `statsmodels`는 이 블록에서 처음 불러오므로 최초 실행에 몇 초가 더 걸립니다(패키지 자동 다운로드).",
     "GLM 계수표 · 상대도",
     "import statsmodels.api as sm\n" + GLM_FIT + '''
print(f"관측 {int(res.nobs)}건 · 이탈도 {res.deviance:.1f} · AIC {res.aic:.1f}")
pd.DataFrame({"요인": res.params.index.to_numpy(),
              "계수": res.params.to_numpy().round(4),
              "상대도 exp(계수)": np.exp(res.params).to_numpy().round(3),
              "표준오차": res.bse.to_numpy().round(4),
              "p값": res.pvalues.to_numpy().round(4)})''',
     "values"),
    (30,
     "3단계 — 요인별 상대도",
     "## 3단계 — 요인별 상대도\n\n"
     "범주형 요인의 상대도를 막대로 봅니다. 1.0 기준선보다 위면 기준 수준보다 보험료가 비싸다는 뜻이고,\n"
     "막대에 붙은 `*`는 5% 유의수준에서 유의한 요인입니다. 연속형(연령·BMI)은 1년/1단위당 배수라\n"
     "여기서는 빼고 계수표(2단계)로 읽으세요.",
     "범주형 요인 상대도 그림",
     "import statsmodels.api as sm\nimport matplotlib.pyplot as plt\n" + GLM_FIT + '''
sel = [n for n in res.params.index if any(n.startswith(c + "_") for c in CAT)]
rel = np.exp(res.params[sel]).to_numpy()
lab = [n + ("*" if res.pvalues[n] < 0.05 else "") for n in sel]
fig, ax = plt.subplots(figsize=(8, 3.8))
ax.bar(lab, rel, color="#4A90C2")
ax.axhline(1.0, color="#999", lw=1, ls="--")
ax.set_title("범주형 요인 상대도 exp(계수) — * 는 p<0.05")
ax.set_ylabel("기준 수준 대비 배수")
ax.tick_params(axis="x", rotation=45, labelsize=8)
fig.tight_layout()
fig''',
     "object"),
    (34,
     "4단계 — 예측 검증",
     "## 4단계 — 예측 검증\n\n"
     "적합값을 상품 × 채널 셀별로 모아 관측 평균과 비교합니다. 차이가 대체로 ±5% 안이면 모형이\n"
     "주요 요인 조합을 재현하고 있다는 뜻이고, 특정 셀만 크게 벗어나면 **교호작용**(상품×채널)을\n"
     "추가로 넣어볼 신호입니다.",
     "상품×채널 관측 vs 예측",
     "import statsmodels.api as sm\n" + GLM_FIT + '''
d["예측"] = res.fittedvalues
g = d.groupby(["product", "channel"]).agg(
    계약수=("premium", "size"), 관측평균=("premium", "mean"), 예측평균=("예측", "mean"))
g["차이%"] = ((g["예측평균"] / g["관측평균"] - 1) * 100).round(1)
g[["관측평균", "예측평균"]] = g[["관측평균", "예측평균"]].round(0)
g.reset_index()''',
     "values"),
]


def build_premium_glm():
    sid = "sh-policy"
    blocks = steps(sid, 17, "glm",
                   ("보험료 요인 분석 (GLM)",
                    "# 보험료 요인 분석 (GLM)\n\n"
                    "`policy` 시트에 계약·고객 600건(연령·BMI·부양가족·상품·채널·지역·성별·보험료 등 16열)이 들어 있습니다.\n"
                    "기술통계와 교차표로 감을 잡은 뒤 **감마 GLM(로그 링크)**로 보험료 요인을 추정하고,\n"
                    "계수의 지수를 **상대도**로 읽습니다.\n\n"
                    "> 모든 블록은 `xl(\"policy!A1:P601\")`로 시트를 다시 읽어 단독 실행됩니다."),
                   GLM_STEPS)
    return workbook(
        "wb-sample-premium-glm",
        "보험료 요인 분석 예제",
        [data_sheet(sid, "policy", read_xlsx("policy"), row_count=620)],
        blocks,
    )


# ── K.3 빈도·심도 모형 (claims.xlsx) ─────────────────────

FS_LOAD = '''df = xl("claims!A1:K601", headers=True)
x = df["claim_amt"].dropna().astype(float).to_numpy()       # 심도(손해액)
counts = df["claim_cnt"].dropna().astype(int).to_numpy()    # 빈도(건수)
'''

FS_SEVFIT = '''
def fit_severity(x):
    """후보 분포 MLE — (이름, 동결분포, 모수개수, 파라미터 표기)"""
    out = []
    s, _, sc = stats.lognorm.fit(x, floc=0)
    out.append(("로그정규", stats.lognorm(s, 0, sc), 2, f"mu={np.log(sc):.4g}, sigma={s:.4g}"))
    a, _, sc = stats.gamma.fit(x, floc=0)
    out.append(("감마", stats.gamma(a, 0, sc), 2, f"alpha={a:.4g}, theta={sc:.4g}"))
    c, _, sc = stats.weibull_min.fit(x, floc=0)
    out.append(("와이블", stats.weibull_min(c, 0, sc), 2, f"k={c:.4g}, lambda={sc:.4g}"))
    return out

def best_severity(x):
    return min(fit_severity(x), key=lambda t: 2 * t[2] - 2 * float(np.sum(t[1].logpdf(x))))
'''

FS_STEPS = [
    (2,
     "1단계 — 심도 분포 적합",
     "## 1단계 — 심도 분포 적합\n\n"
     "`claims` 시트의 `claim_amt`(계약별 손해액 600건)를 후보 분포에 최대우도로 적합하고 AIC로 비교합니다.\n"
     "손해액은 양수·우측 꼬리 분포라 **로그정규·감마·와이블**이 표준 후보입니다.\n"
     "AIC·BIC는 작을수록 좋고, KS p가 크면 경험분포와의 거리가 유의하지 않다는 뜻입니다.",
     "심도 후보 분포 비교표",
     "from scipy import stats\n" + FS_LOAD + FS_SEVFIT + '''
rows = []
for name, dist, k, par in fit_severity(x):
    logL = float(np.sum(dist.logpdf(x)))
    ks = stats.kstest(x, dist.cdf)
    rows.append({"분포": name, "파라미터": par, "logL": round(logL, 2),
                 "AIC": round(2 * k - 2 * logL, 2),
                 "BIC": round(k * np.log(len(x)) - 2 * logL, 2),
                 "KS D": round(float(ks.statistic), 4),
                 "KS p": round(float(ks.pvalue), 4)})
pd.DataFrame(rows).sort_values("AIC").reset_index(drop=True)''',
     "values"),
    (10,
     "2단계 — 빈도 모형·과산포 검정",
     "## 2단계 — 빈도 모형·과산포 검정\n\n"
     "`claim_cnt`(계약별 건수)를 **포아송**과 **음이항**에 적합합니다. 포아송은 분산=평균을 가정하므로\n"
     "먼저 **분산/평균 비**를 봅니다 — 1보다 크게 크면 과산포라 음이항이 필요하고, 1 근처면 포아송으로 충분합니다.\n"
     "음이항은 `p = r/(r+평균)`으로 두고 `r`만 수치최적화(프로파일 우도)합니다 —\n"
     "과산포가 없으면 `r`이 상한(10,000)까지 밀리며 포아송에 수렴하고, 모수가 하나 더 많은 만큼 AIC만 커집니다.",
     "빈도 비교표 · 과산포",
     "from scipy import stats\nfrom scipy.optimize import minimize_scalar\n" + FS_LOAD + '''
m, v = counts.mean(), counts.var(ddof=1)
print(f"평균 {m:.4f} · 분산 {v:.4f} · 분산/평균 {v / m:.3f}")
print("분산/평균이 1 근처면 과산포 없음 → 포아송으로 충분")

fits = [("포아송", stats.poisson(m), 1, f"lambda={m:.4g}")]
nll = lambda lr: -float(np.sum(stats.nbinom.logpmf(counts, np.exp(lr), np.exp(lr) / (np.exp(lr) + m))))
r = float(np.exp(minimize_scalar(nll, bounds=(np.log(1e-2), np.log(1e4)), method="bounded").x))
fits.append(("음이항", stats.nbinom(r, r / (r + m)), 2, f"r={r:.4g}, p={r / (r + m):.4g}"))

K = int(counts.max())
obs = np.bincount(counts, minlength=K + 1).astype(float)
rows = []
for name, dist, k, par in fits:
    logL = float(np.sum(dist.logpmf(counts)))
    E = len(counts) * np.array([float(dist.pmf(j)) for j in range(K + 1)])
    E[-1] += len(counts) * float(dist.sf(K))
    ok = E > 0
    chi2 = float(np.sum((obs[ok] - E[ok]) ** 2 / E[ok]))
    dof = int(ok.sum()) - 1 - k
    rows.append({"분포": name, "파라미터": par, "logL": round(logL, 2),
                 "AIC": round(2 * k - 2 * logL, 2),
                 "BIC": round(k * np.log(len(counts)) - 2 * logL, 2),
                 "chi2": round(chi2, 2),
                 "chi2 p": round(float(stats.chi2.sf(chi2, dof)), 4) if dof > 0 else None})
pd.DataFrame(rows).sort_values("AIC").reset_index(drop=True)''',
     "values"),
    (17,
     "3단계 — 순보험료 (E[N]·E[X])",
     "## 3단계 — 순보험료 (E[N]·E[X])\n\n"
     "빈도와 심도가 독립이면 계약 한 건의 기대손해(순보험료)는 `E[N] × E[X]`입니다.\n"
     "사업비·이익 마진을 붙이기 전의 위험보험료이므로 상품 간 **상대 비교**로 읽습니다.\n\n"
     "> 이 샘플의 `claim_amt`는 계약별 손해액 규모라 현행 보험료(`prem_before`)와 스케일이 맞춰져 있지 않습니다 —\n"
     "> 손해율의 절대값 대신 상품별 순보험료의 크기·비중을 보세요.",
     "상품별 순보험료",
     FS_LOAD + '''
g = df.groupby("product").agg(
    계약수=("claim_cnt", "size"),
    빈도=("claim_cnt", "mean"),
    심도=("claim_amt", "mean"),
    현행보험료=("prem_before", "mean"))
g["순보험료"] = g["빈도"] * g["심도"]
g["기대손해"] = (g["순보험료"] * g["계약수"]).round(0)
g["비중%"] = (100 * g["기대손해"] / g["기대손해"].sum()).round(1)
g["빈도"] = g["빈도"].round(3)
g[["심도", "순보험료"]] = g[["심도", "순보험료"]].round(0)
g.drop(columns=["현행보험료"]).reset_index()''',
     "values"),
    (26,
     "4단계 — 몬테카를로 합산분포 VaR·TVaR",
     "## 4단계 — 몬테카를로 합산분포 VaR·TVaR\n\n"
     "계약 600건 포트폴리오의 **연간 총손해 S**를 시뮬레이션합니다 — 건수 `N ~ 포아송(600·λ)`을 뽑고\n"
     "그만큼 심도를 뽑아 더합니다(복합 포아송). `VaR(q)`는 q 분위수, `TVaR(q)`는 그 이상 구간의 평균이라\n"
     "항상 `TVaR ≥ VaR`입니다. 시뮬레이션 난수는 `seed=20260907`로 고정해 실행할 때마다 같은 값이 나옵니다.",
     "VaR · TVaR 표",
     "from scipy import stats\n" + FS_LOAD + FS_SEVFIT + '''
name, dist, _, par = best_severity(x)
print(f"심도 분포: {name} ({par})")
rng = np.random.default_rng(20260907)
n_pol, nsim = len(counts), 10000
N = rng.poisson(counts.mean() * n_pol, size=nsim)
draws = dist.rvs(size=int(N.sum()), random_state=rng)
ends = np.cumsum(N)                                     # 시뮬레이션별 손해 구간
csum = np.concatenate(([0.0], np.cumsum(draws)))
S = csum[ends] - csum[ends - N]
print(f"E[S] = {S.mean():,.0f} · 표준편차 {S.std():,.0f}")
rows = []
for q in (0.90, 0.95, 0.99, 0.995):
    var = float(np.quantile(S, q))
    rows.append({"신뢰수준": f"{q:.1%}", "VaR": round(var, 0),
                 "TVaR": round(float(S[S >= var].mean()), 0)})
pd.DataFrame(rows)''',
     "values"),
    (35,
     "5단계 — 합산분포 그림",
     "## 5단계 — 합산분포 그림\n\n"
     "합산손해 S의 히스토그램에 평균·VaR(99%)·TVaR(99%)를 표시합니다.\n"
     "평균과 VaR의 간격이 곧 **위험자본**의 크기이고, 오른쪽 꼬리가 두꺼울수록 TVaR이 VaR에서 멀어집니다.",
     "합산손해 분포",
     "from scipy import stats\nimport matplotlib.pyplot as plt\n" + FS_LOAD + FS_SEVFIT + '''
name, dist, _, _ = best_severity(x)
rng = np.random.default_rng(20260907)
n_pol, nsim = len(counts), 10000
N = rng.poisson(counts.mean() * n_pol, size=nsim)
draws = dist.rvs(size=int(N.sum()), random_state=rng)
ends = np.cumsum(N)
csum = np.concatenate(([0.0], np.cumsum(draws)))
S = csum[ends] - csum[ends - N]
v99 = float(np.quantile(S, 0.99)); t99 = float(S[S >= v99].mean())
fig, ax = plt.subplots(figsize=(7.5, 3.8))
ax.hist(S / 1e8, bins=60, color="#4A90C2", alpha=0.8)
for val, lab, c in ((S.mean(), "평균", "#333"), (v99, "VaR 99%", "#C2704A"), (t99, "TVaR 99%", "#8A4AC2")):
    ax.axvline(val / 1e8, color=c, ls="--", lw=1.2, label=f"{lab} {val / 1e8:,.1f}억")
ax.set_title(f"합산손해 분포 (심도 {name}, 10,000회 시뮬레이션)")
ax.set_xlabel("연간 총손해 (억원)"); ax.legend(fontsize=8)
fig.tight_layout()
fig''',
     "object"),
]


def build_freq_severity():
    sid = "sh-claims"
    blocks = steps(sid, 12, "fs",
                   ("빈도·심도 모형",
                    "# 빈도·심도 모형\n\n"
                    "`claims` 시트에 계약별 청구 실적 600건(손해액 `claim_amt`·건수 `claim_cnt`·현행 보험료 등 11열)이 있습니다.\n"
                    "**심도**(얼마나 크게)와 **빈도**(얼마나 자주)를 따로 적합한 뒤 곱해 순보험료를 구하고,\n"
                    "복합 포아송 시뮬레이션으로 포트폴리오 **VaR·TVaR**까지 갑니다.\n\n"
                    "> 모든 블록은 `xl(\"claims!A1:K601\")`로 시트를 다시 읽어 단독 실행됩니다."),
                   FS_STEPS)
    return workbook(
        "wb-sample-freq-severity",
        "빈도·심도 모형 예제",
        [data_sheet(sid, "claims", read_xlsx("claims"), row_count=620)],
        blocks,
    )


# ── K.4 생존분석·유지율 (experience.xlsx) ────────────────

SV_LOAD = '''df = xl("experience!A1:F801", headers=True)
d = df.dropna(subset=["duration_years", "event"]).copy()
d["event"] = d["event"].astype(int)     # 1=해지(사건), 0=중도절단(관측 종료까지 유지)
'''

SV_KM = '''
def km(t, e):
    """Kaplan-Meier 추정 — lifelines 없이 pandas groupby로 위험집합·사건수를 만든다."""
    g = (pd.DataFrame({"t": np.asarray(t, dtype=float), "e": np.asarray(e, dtype=int)})
         .groupby("t").agg(events=("e", "sum"), exits=("e", "size")).sort_index())
    at_risk = len(t) - g["exits"].cumsum().shift(1, fill_value=0)   # 시점 직전 위험집합
    surv = (1 - g["events"] / at_risk).cumprod()
    # Greenwood 분산 → 표준오차
    inc = g["events"] / (at_risk * (at_risk - g["events"])).replace(0, np.nan)
    se = surv * np.sqrt(inc.fillna(0).cumsum())
    return pd.DataFrame({"경과기간": g.index.to_numpy(), "위험집합": at_risk.to_numpy(),
                         "해지건수": g["events"].to_numpy(), "생존확률": surv.to_numpy(),
                         "표준오차": se.to_numpy()})
'''

SV_STEPS = [
    (2,
     "1단계 — Kaplan-Meier 생존표",
     "## 1단계 — Kaplan-Meier 생존표\n\n"
     "`experience` 시트의 계약 800건은 `duration_years`(관측 경과기간)와 `event`(1=해지, 0=중도절단)로 이루어진\n"
     "**생존자료**입니다. 중도절단이 있어 단순 비율로는 유지율을 못 구하므로 Kaplan-Meier 추정을 씁니다.\n\n"
     "`S(t) = Π (1 − 해지건수/위험집합)` — 각 해지 시점에서 그 직전까지 남아 있던 계약(위험집합) 대비\n"
     "해지 비율을 곱해 나갑니다. Pyodide에는 `lifelines`가 없어 pandas `groupby`로 직접 구현했고,\n"
     "표준오차는 Greenwood 공식입니다. 결과는 해지가 발생한 시점만 값 모드로 깔립니다.",
     "생존표 (해지 시점)",
     SV_LOAD + SV_KM + '''
print(f"관측 {len(d)}건 · 해지 {int(d['event'].sum())}건 · 중도절단 {int((d['event'] == 0).sum())}건")
tab = km(d["duration_years"], d["event"])
tab = tab[tab["해지건수"] > 0].reset_index(drop=True)
print(f"해지 시점 {len(tab)}개 · 최종 생존확률 {tab['생존확률'].iloc[-1]:.4f}")
tab.round(4)''',
     "values"),
    (71,
     "2단계 — 생존곡선",
     "## 2단계 — 생존곡선\n\n"
     "전체 생존곡선(Greenwood 95% 구간)과 상품별 곡선을 계단식으로 그립니다.\n"
     "곡선이 가파른 초기 구간이 곧 **초기 해지**가 몰린 기간이고, 상품별 곡선이 벌어질수록\n"
     "유지율 차이가 크다는 뜻입니다 — 그 차이가 우연인지는 4단계 로그순위 검정으로 확인합니다.",
     "생존곡선 (전체 · 상품별)",
     "import matplotlib.pyplot as plt\n" + SV_LOAD + SV_KM + '''
fig, ax = plt.subplots(1, 2, figsize=(10.5, 3.8))
a = km(d["duration_years"], d["event"])
ax[0].step(a["경과기간"], a["생존확률"], where="post", color="#4A90C2")
ax[0].fill_between(a["경과기간"], (a["생존확률"] - 1.96 * a["표준오차"]).clip(0, 1),
                   (a["생존확률"] + 1.96 * a["표준오차"]).clip(0, 1),
                   step="post", color="#4A90C2", alpha=0.18)
ax[0].set_title("전체 생존곡선 (95% 구간)")
for prod, sub in d.groupby("product"):
    b = km(sub["duration_years"], sub["event"])
    ax[1].step(b["경과기간"], b["생존확률"], where="post", label=f"{prod} (n={len(sub)})")
ax[1].set_title("상품별 생존곡선"); ax[1].legend(fontsize=8)
for a_ in ax:
    a_.set_xlabel("경과기간 (년)"); a_.set_ylabel("유지 확률"); a_.grid(alpha=0.3)
fig.tight_layout()
fig''',
     "object"),
    (75,
     "3단계 — 경과기간별 해지율",
     "## 3단계 — 경과기간별 해지율\n\n"
     "실무에서 쓰는 형태는 곡선보다 **구간별 연간 해지율**입니다.\n"
     "각 구간의 **노출(exposure)** = 계약이 그 구간에 머문 연수의 합, 해지율 = 해지건수 / 노출.\n"
     "중도절단 계약도 머문 만큼 노출에 들어가므로 분모가 과소평가되지 않습니다.\n"
     "초기 구간의 해지율이 가장 높고 이후 낮아지는 패턴이면 전형적입니다.",
     "구간별 노출·해지율",
     SV_LOAD + '''
t = d["duration_years"].to_numpy(dtype=float)
e = d["event"].to_numpy(dtype=int)
rows = []
for lo, hi in [(0, 1), (1, 3), (3, 5), (5, 10), (10, 99)]:
    exposure = float(np.clip(t - lo, 0, hi - lo).sum())          # 구간에 머문 연수의 합
    events = int(((t > lo) & (t <= hi) & (e == 1)).sum())
    rows.append({"구간": f"{lo}~{hi}년" if hi < 99 else f"{lo}년+",
                 "노출(계약·년)": round(exposure, 1), "해지건수": events,
                 "연간해지율": round(events / exposure, 4) if exposure else None})
pd.DataFrame(rows)''',
     "values"),
    (85,
     "4단계 — 로그순위 검정",
     "## 4단계 — 로그순위 검정\n\n"
     "두 집단의 생존곡선이 같은지 검정합니다. 각 해지 시점에서 집단1의 **관측 해지수 O**와\n"
     "귀무가설(두 집단 동일) 아래 **기대 해지수 E**를 모아 `χ² = (O−E)²/V`(자유도 1)를 만듭니다.\n"
     "p가 0.05보다 작으면 두 집단의 유지율이 통계적으로 다르다고 봅니다.",
     "집단별 로그순위 검정",
     "from scipy import stats\n" + SV_LOAD + '''

def logrank(sub, mask):
    """2집단 로그순위 — (O1, E1, chi2, p)"""
    t = sub["duration_years"].to_numpy(dtype=float)
    e = sub["event"].to_numpy(dtype=int)
    g1 = np.asarray(mask, dtype=bool)
    O1 = E1 = V = 0.0
    for tt in np.unique(t[e == 1]):
        at = t >= tt
        n1, n = int((at & g1).sum()), int(at.sum())
        dd = int(((t == tt) & (e == 1)).sum())
        if n < 2 or dd == 0:
            continue
        O1 += int(((t == tt) & (e == 1) & g1).sum())
        E1 += dd * n1 / n
        V += dd * (n1 / n) * (1 - n1 / n) * (n - dd) / (n - 1)
    chi2 = (O1 - E1) ** 2 / V if V > 0 else 0.0
    return O1, E1, chi2, float(stats.chi2.sf(chi2, 1))

rows = []
pairs = [("성별 M vs F", d, d["sex"] == "M")]
prods = sorted(d["product"].unique())
for i in range(len(prods)):
    for j in range(i + 1, len(prods)):
        sub = d[d["product"].isin([prods[i], prods[j]])]
        pairs.append((f"{prods[i]} vs {prods[j]}", sub, sub["product"] == prods[i]))
for label, sub, mask in pairs:
    O1, E1, chi2, p = logrank(sub, mask)
    rows.append({"비교": label, "관측 O": round(O1, 1), "기대 E": round(E1, 2),
                 "chi2": round(chi2, 3), "p값": round(p, 4),
                 "판정": "차이 있음" if p < 0.05 else "차이 없음"})
pd.DataFrame(rows)''',
     "values"),
]


def build_survival():
    sid = "sh-exp"
    blocks = steps(sid, 7, "sv",
                   ("생존분석·유지율",
                    "# 생존분석·유지율\n\n"
                    "`experience` 시트의 계약 800건에는 경과기간과 해지 여부(중도절단 포함)가 들어 있습니다.\n"
                    "**Kaplan-Meier**로 유지율 곡선을 직접 구현하고(Pyodide에 `lifelines`가 없습니다),\n"
                    "구간별 연간 해지율을 뽑은 뒤 **로그순위 검정**으로 집단 간 차이를 확인합니다.\n\n"
                    "> 모든 블록은 `xl(\"experience!A1:F801\")`로 시트를 다시 읽어 단독 실행됩니다."),
                   SV_STEPS)
    return workbook(
        "wb-sample-survival",
        "생존분석·유지율 예제",
        [data_sheet(sid, "experience", read_xlsx("experience"), row_count=820)],
        blocks,
    )


# ── K.5 지급준비금 체인래더 (triangle.xlsx) ──────────────

CL_LOAD = '''df = xl("triangle!A1:I9", headers=True)
years = df["accident_year"].astype(int).to_numpy()
tri = df.iloc[:, 1:].apply(pd.to_numeric, errors="coerce").to_numpy(dtype=float)
n = tri.shape[0]
# 볼륨가중 개발계수 f_j = Σc(i,j+1) / Σc(i,j) — 두 칸 모두 관측된 행만 합산(NaN 마스킹)
f = np.ones(n - 1)
S = np.zeros(n - 1)                      # Σc(i,j) — Mack 표준오차에서 재사용
for j in range(n - 1):
    m = ~np.isnan(tri[:, j]) & ~np.isnan(tri[:, j + 1])
    S[j] = tri[m, j].sum()
    f[j] = tri[m, j + 1].sum() / S[j]
'''

CL_FULL = '''
full = tri.copy()
for i in range(n):
    for j in range(n - i, n):             # i번째 행의 미관측 구간을 개발계수로 채운다
        full[i, j] = full[i, j - 1] * f[j - 1]
latest = np.array([tri[i, n - 1 - i] for i in range(n)])     # 최신 대각선(현재까지 누적 지급)
ultimate = full[:, -1]
reserve = ultimate - latest
'''

CL_STEPS = [
    (2,
     "1단계 — 개발계수",
     "## 1단계 — 개발계수\n\n"
     "`triangle` 시트는 행=사고연도, 열=개발연차(`dev_1`~`dev_8`), 값=누적 지급보험금인 런오프 삼각형입니다.\n"
     "하삼각(미래)은 빈 셀이라 `xl()`로 읽으면 `NaN`이 됩니다.\n\n"
     "볼륨가중 개발계수 `f_j = Σc(i,j+1)/Σc(i,j)` — 분자·분모 **두 칸이 모두 관측된 행만** 합산하는\n"
     "NaN 마스킹이 구현의 핵심입니다. 누적계수 CDF와 지급진행률(1/CDF)로 각 연차까지\n"
     "최종 지급의 몇 %가 진행됐는지 확인하세요.",
     "개발계수 · 누적계수",
     CL_LOAD + '''
cdf = np.append(np.cumprod(f[::-1])[::-1], 1.0)     # 누적개발계수(마지막 연차 = 1)
pd.DataFrame({"구간": [f"dev_{j + 1}→dev_{j + 2}" for j in range(n - 1)] + ["최종"],
              "개발계수 f": np.append(f, 1.0).round(4),
              "누적계수 CDF": cdf.round(4),
              "지급진행률": (1 / cdf).round(4)})''',
     "values"),
    (15,
     "2단계 — 삼각형 완성",
     "## 2단계 — 삼각형 완성\n\n"
     "각 사고연도의 최신 관측값에 개발계수를 차례로 곱해 하삼각(미래 지급)을 채웁니다.\n"
     "완성 삼각형의 마지막 열이 사고연도별 **최종예상(Ultimate)**입니다.\n"
     "상삼각(관측)은 원본 값 그대로여야 하니 1~2행을 시트와 대조해 보세요.",
     "완성 삼각형",
     CL_LOAD + CL_FULL + '''
out = pd.DataFrame(full.round(0), columns=[f"dev_{j + 1}" for j in range(n)])
out.insert(0, "accident_year", years)
out''',
     "values"),
    (28,
     "3단계 — 사고연도별 지급준비금",
     "## 3단계 — 사고연도별 지급준비금\n\n"
     "준비금 = 최종예상 − 현재까지 누적 지급(최신 대각선).\n"
     "가장 오래된 사고연도는 8년차까지 관측되어 완전 진전이므로 **준비금 0**이어야 정상이고,\n"
     "최근 사고연도일수록 준비금이 커집니다 — 초기 관측 하나가 누적개발계수로 증폭되므로\n"
     "최근 연도는 Bornhuetter-Ferguson 병행 검토가 실무 관례입니다.",
     "지급준비금",
     CL_LOAD + CL_FULL + '''
print(f"총 지급준비금 = {reserve.sum():,.0f}")
pd.DataFrame({"accident_year": years, "현재누적": latest.round(0),
              "최종예상": ultimate.round(0), "준비금": reserve.round(0)})''',
     "values"),
    (41,
     "4단계 — Mack 표준오차",
     "## 4단계 — Mack 표준오차\n\n"
     "체인래더는 점추정만 주므로 **추정오차**를 Mack(1993) 공식으로 붙입니다.\n\n"
     "- `σ²_j = 1/(n−j−1) · Σ c(i,j)·(개별계수 − f_j)²` — 연차별 변동성\n"
     "- 마지막 연차는 관측이 부족해 `min(σ⁴_{n-2}/σ²_{n-3}, σ²_{n-3}, σ²_{n-2})`로 외삽합니다\n"
     "- 총계의 오차는 사고연도 간 **공통 개발계수**를 통한 상관항까지 더해야 합니다\n\n"
     "변동계수(CV = 표준오차/준비금)가 최근 연도일수록 커지면 정상입니다 — 관측이 적기 때문입니다.",
     "Mack 표준오차 · 변동계수",
     CL_LOAD + CL_FULL + '''
sig2 = np.zeros(n - 1)
for j in range(n - 1):
    m = ~np.isnan(tri[:, j]) & ~np.isnan(tri[:, j + 1])
    k = int(m.sum())
    if k >= 2:
        sig2[j] = np.sum(tri[m, j] * (tri[m, j + 1] / tri[m, j] - f[j]) ** 2) / (k - 1)
if n >= 4 and sig2[n - 2] == 0:          # 마지막 연차 외삽 (Mack 1993)
    sig2[n - 2] = min(sig2[n - 3] ** 2 / sig2[n - 4], sig2[n - 3], sig2[n - 4])

mse = np.zeros(n)
for i in range(1, n):                    # i=0은 완전 진전이라 오차 0
    acc = 0.0
    for j in range(n - i, n):            # 미관측 구간의 전이 (0-based: 마지막 관측 열 = n-1-i)
        acc += (sig2[j - 1] / f[j - 1] ** 2) * (1 / full[i, j - 1] + 1 / S[j - 1])
    mse[i] = ultimate[i] ** 2 * acc

cross = 0.0
for i in range(1, n):
    for k in range(i + 1, n):
        cross += 2 * ultimate[i] * ultimate[k] * sum(
            (sig2[j - 1] / f[j - 1] ** 2) / S[j - 1] for j in range(n - i, n))
se = np.sqrt(mse)
se_total = float(np.sqrt(mse.sum() + cross))
out = pd.DataFrame({"accident_year": years, "준비금": reserve.round(0),
                    "표준오차": se.round(0),
                    "CV": np.where(reserve > 0, se / np.where(reserve > 0, reserve, 1), 0).round(3)})
tot = pd.DataFrame([{"accident_year": "합계", "준비금": round(reserve.sum(), 0),
                     "표준오차": round(se_total, 0),
                     "CV": round(se_total / reserve.sum(), 3)}])
pd.concat([out, tot], ignore_index=True)''',
     "values"),
    (55,
     "5단계 — 준비금·오차 그림",
     "## 5단계 — 준비금·오차 그림\n\n"
     "사고연도별 준비금을 막대로, Mack 표준오차를 오차막대로 겹쳐 그립니다.\n"
     "오른쪽 그림의 개발 패턴(누적 지급진행률)이 매끄럽게 1에 수렴하지 않으면\n"
     "삼각형에 이상치가 섞였다는 신호입니다.",
     "준비금 막대 · 개발 패턴",
     "import matplotlib.pyplot as plt\n" + CL_LOAD + CL_FULL + '''
sig2 = np.zeros(n - 1)
for j in range(n - 1):
    m = ~np.isnan(tri[:, j]) & ~np.isnan(tri[:, j + 1])
    k = int(m.sum())
    if k >= 2:
        sig2[j] = np.sum(tri[m, j] * (tri[m, j + 1] / tri[m, j] - f[j]) ** 2) / (k - 1)
if n >= 4 and sig2[n - 2] == 0:
    sig2[n - 2] = min(sig2[n - 3] ** 2 / sig2[n - 4], sig2[n - 3], sig2[n - 4])
mse = np.zeros(n)
for i in range(1, n):
    mse[i] = ultimate[i] ** 2 * sum(
        (sig2[j - 1] / f[j - 1] ** 2) * (1 / full[i, j - 1] + 1 / S[j - 1]) for j in range(n - i, n))

fig, ax = plt.subplots(1, 2, figsize=(10.5, 3.8))
ax[0].bar([str(y) for y in years], reserve, yerr=np.sqrt(mse), capsize=3, color="#4A90C2")
ax[0].set_title("사고연도별 준비금 ± Mack 표준오차"); ax[0].tick_params(axis="x", rotation=45)
cdf = np.append(np.cumprod(f[::-1])[::-1], 1.0)
ax[1].plot(range(1, n + 1), 1 / cdf, "o-", color="#4A90C2")
ax[1].set_title("개발 패턴 (누적 지급진행률)"); ax[1].set_xlabel("개발연차")
ax[1].set_ylim(0, 1.05); ax[1].grid(alpha=0.3)
fig.tight_layout()
fig''',
     "object"),
]


def build_chain_ladder():
    sid = "sh-triangle"
    blocks = steps(sid, 10, "cl",
                   ("지급준비금 — 체인래더",
                    "# 지급준비금 — 체인래더\n\n"
                    "`triangle` 시트의 런오프 삼각형(사고연도 8 × 개발연차 8, 누적 지급보험금)으로\n"
                    "개발계수를 뽑아 미지급 보험금(IBNR 포함)을 추정하고, **Mack 표준오차**로 추정의 불확실성까지 붙입니다.\n\n"
                    "> 모든 블록은 `xl(\"triangle!A1:I9\")`로 시트를 다시 읽어 단독 실행됩니다."),
                   CL_STEPS)
    return workbook(
        "wb-sample-chain-ladder",
        "지급준비금 체인래더 예제",
        [data_sheet(sid, "triangle", read_xlsx("triangle"), row_count=80)],
        blocks,
    )


# ── 스니펫 ───────────────────────────────────────────────

SNIPPET_LIST = [
    {
        "name": "기술통계",
        "description": "선택 범위의 개수·평균·표준편차·사분위수",
        "code": "df = {{range}}\ndf.describe()",
    },
    {
        "name": "그룹 집계",
        "description": "열 기준 그룹 합계 (열 이름을 바꿔 쓰세요)",
        "code": 'df = {{range}}\ndf.groupby("그룹열").sum(numeric_only=True)',
    },
    {
        "name": "피벗 테이블",
        "description": "행×열 교차 집계",
        "code": (
            "df = {{range}}\n"
            'df.pivot_table(index="행열", columns="열열", values="값열",'
            ' aggfunc="sum")'
        ),
    },
    {
        "name": "히스토그램",
        "description": "숫자 열 분포 그래프 (객체 모드로 실행)",
        "code": (
            "import matplotlib.pyplot as plt\n"
            "df = {{range}}\n"
            "fig, ax = plt.subplots(figsize=(7, 4))\n"
            "ax.hist(df.iloc[:, 0], bins=20, color=\"#4A90C2\")\n"
            "fig"
        ),
    },
    {
        "name": "선형회귀",
        "description": "첫 두 숫자 열로 기울기·절편 추정",
        "code": (
            "df = {{range}}\n"
            "x, y = df.iloc[:, 0], df.iloc[:, 1]\n"
            "slope, intercept = np.polyfit(x, y, 1)\n"
            'pd.DataFrame({"기울기": [slope], "절편": [intercept]})'
        ),
    },
    {
        "name": "생명표 lx 계산",
        "description": "x·qx 두 열에서 생존자 수 lx 계산 (기수 100,000)",
        "code": (
            "df = {{range}}\n"
            "lx = [100000.0]\n"
            'for q in df["qx"][:-1]:\n'
            "    lx.append(lx[-1] * (1 - q))\n"
            'df["lx"] = lx\n'
            "df"
        ),
    },
]


def selfcheck_xlsx():
    """openpyxl 경로와 표준 라이브러리 경로가 같은 값을 내는지 확인(openpyxl이 있을 때만)."""
    try:
        import openpyxl  # noqa: F401
    except ImportError:
        print("openpyxl 없음 — 표준 라이브러리 파서로만 읽습니다")
        return
    for name in ("mortality_table", "triangle"):
        assert read_xlsx(name) == _read_xlsx_stdlib(XLSX_DIR / f"{name}.xlsx"), name
    print("xlsx 파서 자립성 확인 (openpyxl == 표준 라이브러리)")


def main():
    SAMPLES.mkdir(parents=True, exist_ok=True)
    selfcheck_xlsx()
    for wb, fname in [
        (build_loss_ratio(), "loss-ratio.pygrid.json"),
        (build_claim_severity(), "claim-severity.pygrid.json"),
        # 부록 K — 계리 예제 데이터 내장 워크북 5종
        (build_mortality(), "life-table.pygrid.json"),
        (build_premium_glm(), "premium-glm.pygrid.json"),
        (build_freq_severity(), "freq-severity.pygrid.json"),
        (build_survival(), "survival-retention.pygrid.json"),
        (build_chain_ladder(), "chain-ladder.pygrid.json"),
    ]:
        (SAMPLES / fname).write_text(
            json.dumps(wb, ensure_ascii=False, indent=1), encoding="utf-8"
        )
        print(f"-> {SAMPLES / fname}  ({(SAMPLES / fname).stat().st_size / 1024:,.0f} KB)")
    SNIPPETS.write_text(
        json.dumps(SNIPPET_LIST, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    print(f"-> {SNIPPETS}")


if __name__ == "__main__":
    main()
