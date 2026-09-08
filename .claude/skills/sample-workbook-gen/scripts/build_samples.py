# -*- coding: utf-8 -*-
"""샘플 워크북(.pygrid.json)·스니펫(data/snippets.json) 생성기.

스키마: types/workbook.ts (설계서 §3.1). 블록 코드의 xl() 참조는 실제 시트 범위와
일치해야 하며, 로드 직후 전체 실행이 성공해야 한다.

부록 K 계리 예제 5종은 public/samples/*.xlsx 원본을 시트로 내장한다 —
openpyxl이 있으면 쓰고, 없으면 zipfile+xml.etree로 파싱해 자립 실행된다.
"""
import datetime
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


def _si_text(node):
    """sharedStrings <si> / 인라인 <is> → 텍스트. 후리가나(<rPh>)는 빼야 한다."""
    parts = [t.text or "" for t in node.findall(NS + "t")]
    for r in node.findall(NS + "r"):
        parts += [t.text or "" for t in r.findall(NS + "t")]
    return "".join(parts)


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
                shared.append(_si_text(si))
        root = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
        grid = []
        for row in root.iter(NS + "row"):
            vals = {}
            for c in row.iter(NS + "c"):
                t = c.get("t", "n")
                v = c.find(NS + "v")
                inline = c.find(NS + "is")
                if t == "inlineStr":
                    val = _si_text(inline) if inline is not None else None
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


# ── 부록 M — 보험료 산출 예제 (경영인정기보험 산출과정표) ─────

PREMIUM_SRC = Path(
    r"C:\Users\tklee\OneDrive - 코리안리재보험\0. 보험료 산출 방법서"
    r"\경영인정기보험\경영인정기보험 무배당 1504_산출과정표_수정.xlsx"
)

#: 워크북 `위험률` 시트 열 = (헤더, 원본 위험률 시트 열). B·C는 수식 참조라 제외(부록 M.2)
RISK_COLS = [
    ("나이", "A"),
    ("경험사망률_남", "K"), ("경험사망률_여", "L"),      # 7회 경험생명표 사망률
    ("표준사망률_남", "M"), ("표준사망률_여", "N"),      # 7회 표준율(표준책임준비금 기초)
    ("우량체사망률_남", "D"), ("우량체사망률_여", "E"),  # 건강인 할인 기초
    ("발생률_남", "F"), ("발생률_여", "G"),              # 질병·재해 50%이상 발생률(납입면제)
    ("표준발생률_남", "H"), ("표준발생률_여", "I"),
]

DEF_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"


def _sheet_targets(z):
    """xlsx zip → {시트명: 워크시트 xml 경로}"""
    import xml.etree.ElementTree as ET

    rels = {
        r.get("Id"): r.get("Target")
        for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    }
    out = {}
    for sh in ET.fromstring(z.read("xl/workbook.xml")).iter(NS + "sheet"):
        t = rels[sh.get(DEF_NS + "id")].lstrip("/")
        out[sh.get("name")] = t if t.startswith("xl/") else "xl/" + t
    return out


def _read_cells_stdlib(path, names):
    """표준 라이브러리만으로 지정 시트를 {A1주소: 값}으로 읽는다(수식은 캐시된 값)."""
    import xml.etree.ElementTree as ET
    import zipfile

    with zipfile.ZipFile(path) as z:
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            for si in ET.fromstring(z.read("xl/sharedStrings.xml")):
                shared.append(_si_text(si))
        targets = _sheet_targets(z)
        out = {}
        for nm in names:
            cells = {}
            for c in ET.fromstring(z.read(targets[nm])).iter(NS + "c"):
                t = c.get("t", "n")
                v = c.find(NS + "v")
                inline = c.find(NS + "is")
                if t == "inlineStr":
                    val = _si_text(inline) if inline is not None else None
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
                if val is not None:
                    cells[c.get("r")] = val
            out[nm] = cells
    return out


def read_src_cells(path, names):
    """원본 xlsx 시트들 → {시트명: {A1주소: 값}}. openpyxl이 없으면 표준 라이브러리 파서."""
    try:
        import openpyxl
    except ImportError:
        return _read_cells_stdlib(path, names)
    wb = openpyxl.load_workbook(path, data_only=True)
    return {
        nm: {c.coordinate: c.value for row in wb[nm].iter_rows() for c in row if c.value is not None}
        for nm in names
    }


# 모든 코드 블록이 단독 실행되도록 가정·위험률 로드와 함수 정의를 앞에 붙인다.
PT_LOAD = '''# ── 가정 시트의 파라미터 — 값을 바꾸고 [전체 실행]하면 이후 모든 단계가 다시 계산된다
_p = xl("가정!A1:C20", headers=True)
P = dict(zip(_p["항목"], _p["값"]))
sex  = int(P["성별"])                       # 1 = 남자, 2 = 여자
x0   = int(P["가입나이"])                    # 가입나이(세)
mat  = int(P["만기나이"])                    # 만기나이(세)
n    = int(P["보험기간"])                    # 보험기간 = 만기나이 − 가입나이
m    = int(P["납입기간"])                    # 납입기간(년)
mode = int(P["납입주기"])                    # 12 = 월납
face = float(P["가입금액"])                  # 가입금액(만원) — 10000 = 1억원
sa   = float(P["보장금액"])                  # 산출 기준 사망보험금(만원)
a1, a2 = float(P["α1"]), float(P["α2"])      # 신계약비 α1 = 5%×min(n,20), α2 = 10/1000
b1, b2 = float(P["β1"]), float(P["β2"])      # 유지비율 β1, 유지비 정액 β2
bp, gm = float(P["β'"]), float(P["γ"])      # 납입후유지비 β′, 수금비율 γ
i_app = float(P["예정이율"])                 # 적용(예정)이율
i_std = float(P["표준이율"])                 # 표준책임준비금 이율
sc_yr = int(P["해지공제상각기간"])            # 신계약비 상각기간(년)

# ── 위험률 시트(나이 0~112) — 성별에 맞는 열만 골라 나이 인덱스 Series로
R  = xl("위험률!A1:K114", headers=True).fillna(0.0).astype({"나이": "int64"}).set_index("나이")
sx = "남" if sex == 1 else "여"
q_app, f_app = R["경험사망률_" + sx], R["발생률_" + sx]      # 적용 기초 — 7회 경험사망률 + 납입면제 발생률
q_std, f_std = R["표준사망률_" + sx], R["표준발생률_" + sx]  # 표준 기초 — 7회 표준율
LAST = int(R.index.max())
'''

PT_COMM = '''

def commutation(q, f, i):
    """계산기수표 — 원본 `기수표` 시트 C4:L4 수식을 그대로 옮긴 것."""
    v = 1.0 / (1.0 + i)
    t = np.arange(LAST - x0 + 1)                  # t = 0(가입시점) … 위험률 마지막 나이
    age = x0 + t
    qq = q.loc[age].to_numpy(float)
    ff = f.loc[age].to_numpy(float)
    lx = np.empty(len(t)); llx = np.empty(len(t))
    lx[0] = llx[0] = 100000.0                     # radix 10만
    for j in range(len(t) - 1):
        lx[j + 1]  = lx[j] * (1 - qq[j])                                  # C5: =C4*(1-OFFSET(위험률!$B$5,B4,0))
        llx[j + 1] = llx[j] * (1 - qq[j] - ff[j] + qq[j] * ff[j] / 2)     # D5: 납입면제까지 감안한 납입자 수
    dx  = lx * qq                                 # E4: =C4*qx
    Cx  = dx * v ** (t + 0.5)                     # F4: =E4*v^(A4+0.5)  ← 연중앙 사망 가정
    Dx  = lx * v ** t                             # I4: =C4*v^A4
    DLx = llx * v ** t                            # J4: =D4*v^A4
    rev = lambda a: np.cumsum(a[::-1])[::-1]      # G4: =F4+G5 처럼 아래에서 위로 누적
    Mx = rev(Cx)
    return pd.DataFrame({"t": t, "x": age, "lx": lx, "llx": llx, "dx": dx, "Cx": Cx,
                         "Mx": Mx, "Rx": rev(Mx), "Dx": Dx, "DLx": DLx,
                         "Nx": rev(Dx), "NLx": rev(DLx)})
'''

PT_PRICE = '''

def premium(k):
    """M*·N*[m′] → 순보험료 → α·β·γ 반영 영업보험료 — 원본 `P` 시트."""
    Mx, Nx, NLx, DLx, Dx = (k[c].to_numpy() for c in ("Mx", "Nx", "NLx", "DLx", "Dx"))
    M = sa / 1000 * (Mx[0] - Mx[n])                                   # P!A7  M* = (Mx−Mx+n)·보장금액/1000
    # P!B7  N*[m′] — 월납 보정: m·(NLx−NLx+m) − (m−1)/2·(DLx−DLx+m)
    N = mode * (NLx[0] - NLx[m] - (mode - 1) / (2 * mode) * (DLx[0] - DLx[m]))
    base  = M / (NLx[0] - NLx[min(n, 20)])                            # P!C10 기준연납순보험료
    net   = M / N                                                     # P!C19 순보험료
    alpha = a1 * round(base, 5) + a2                                  # P!C13 총신계약비(반올림한 기준연납 사용)
    A = (a1 * base + a2) * Dx[0] / N + b2 / mode                      # P!A13 α·DLx/N*(m′) + β2/m′
    B = bp * (Nx[m] - Nx[n]) / N                                      # P!B13 β′·(Nx+m−Nx+n)/N*(m′)
    gross = (net + A + B) / (1 - b1 - gm)                             # P!C22 영업보험료
    beta_net = (M + bp * (Nx[m] - Nx[n])) / (NLx[0] - NLx[m])         # P!E19 β′ 포함 연납순보험료
    return dict(M=M, N=N, base=base, net=net, alpha=alpha, A=A, B=B,
                gross=gross, beta_net=beta_net)
'''

PT_RESERVE = '''

def reserve(k, beta_net):
    """연말 책임준비금(10만당) — 원본 `V` 시트 C~I열. (장래 급부 + 납입후유지비 − 장래 수입)/Dx+t"""
    t = k["t"].to_numpy()
    Mx, Nx, NLx, Dx = (k[c].to_numpy() for c in ("Mx", "Nx", "NLx", "Dx"))
    alive = x0 + t <= mat
    C = np.where(alive, sa / 1000 * (Mx - Mx[n]), 0.0)                # V!C3 장래 사망보험금
    D = np.where(alive, bp * (Nx[np.maximum(t, m)] - Nx[n]), 0.0)     # V!D3 납입후유지비
    E = np.where(t <= m, NLx - NLx[m], 0.0)                           # V!E3 장래 보험료의 기수
    den = np.where(Dx > 0, Dx, 1.0)
    return np.round(np.where(alive & (Dx > 0), (C + D - beta_net * E) / den, 0.0) * 1e5)


def surrender(V10, gross10, alpha10):
    """해약환급금·환급률 — 원본 `W` 시트 E·F·G·H열."""
    NC = alpha10 * face / 10                                          # 신계약비(가입금액당)
    Pf = gross10 * face / 10                                          # 영업보험료 1회 납입액(가입금액당)
    k7 = min(m, sc_yr)
    t  = np.arange(len(V10))
    Vf = V10 * face / 10                                              # W!I6 책임준비금(가입금액당)
    sc = NC * np.maximum(k7 - t, 0) / k7                              # W!F6 해지공제 = 신계약비 미상각분
    Wv = np.round(np.maximum(Vf - sc, 0))                             # W!G6 해약환급금
    SP = np.minimum(t, m) * mode * Pf                                 # W!E6 납입보험료 누계
    return Vf, sc, Wv, SP, np.divide(Wv, SP, out=np.zeros_like(Wv), where=SP > 0)


DUR = sorted({*range(1, 21), 25, 30, 40, 50, n})   # 표에 실을 경과년
'''


def build_premium_term():
    """부록 M — 계산기수 → 보험료 → 준비금·환급금 → 표준/적용 비교."""
    if not PREMIUM_SRC.exists():
        print(f"!! 원본 산출과정표 없음 — 보험료 산출 예제 건너뜀: {PREMIUM_SRC}")
        return None
    src = read_src_cells(PREMIUM_SRC, ["위험률", "조회", "P", "V", "W", "(표준)P", "(표준)V"])
    rk, q, p, sp, Vs, SVs, Ws = (src["위험률"], src["조회"], src["P"], src["(표준)P"],
                                 src["V"], src["(표준)V"], src["W"])

    # ── 시트 1: 위험률 (나이 0~112 = 원본 A5:W117 중 값이 든 열)
    rows = [[cell(h, "s") for h, _ in RISK_COLS]]
    for age in range(113):
        r = 5 + age
        rows.append([cell(age, "n")] + [
            cell(round(float(rk.get(f"{cl}{r}") or 0.0), 10), "n") for _, cl in RISK_COLS[1:]
        ])
    risk_sheet = sheet_from_rows("sh-pt-risk", "위험률", rows, row_count=400, col_count=30)

    # ── 시트 2: 가정 (원본 `조회` 시트 파라미터)
    assume = [
        ("성별", int(q["C4"]), "1 = 남자, 2 = 여자 — 2로 바꾸면 여성 기초율로 전 단계가 다시 계산된다 (조회!C4)"),
        ("가입나이", int(q["C5"]), "세 (조회!C5)"),
        ("만기나이", int(q["C6"]), "세 (조회!C6)"),
        ("보험기간", int(q["C7"]), "만기나이 − 가입나이 (조회!C7)"),
        ("납입기간", int(q["C8"]), "년 (조회!C8)"),
        ("납입주기", int(q["C10"]), "연 납입 횟수. 12 = 월납 (조회!C10)"),
        ("가입금액", int(q["C9"]), "만원 단위 — 10000 = 1억원 (조회!C9)"),
        ("보장금액", int(p["B4"]), "산출 기준 사망보험금(만원) (P!B4)"),
        ("예정이율", float(q["B12"]), "적용이율. v = 1/(1+i) (조회!B12)"),
        ("표준이율", float(q["D12"]), "표준책임준비금 이율 (조회!D12)"),
        ("α1", float(q["B14"]), "신계약비율 = 5% × min(보험기간, 20) (조회!B14)"),
        ("α2", float(q["C14"]), "신계약비 정액 = 10/1000 (조회!C14)"),
        ("β1", float(q["D14"]), "유지비율 (조회!D14)"),
        ("β2", float(q["E14"]), "유지비 정액 = 1.5/1000 (조회!E14)"),
        ("β'", float(q["F14"]), "납입후유지비 = 1/1000 (조회!F14)"),
        ("γ", float(q["G14"]), "수금비율 (조회!G14)"),
        ("β*", float(q["H14"]), "플러스보험기간용 — 이 예제에서는 쓰지 않는다 (조회!H14)"),
        ("β**", float(q["I14"]), "플러스보험기간용 — 이 예제에서는 쓰지 않는다 (조회!I14)"),
        ("해지공제상각기간", 7, "신계약비 상각기간(년). 실제로는 min(납입기간, 7) (W!F6)"),
    ]
    arows = [[cell("항목", "s"), cell("값", "s"), cell("비고", "s")]]
    arows += [[cell(k, "s"), cell(v, "n"), cell(note, "s")] for k, v, note in assume]
    assume_sheet = sheet_from_rows("sh-pt-assume", "가정", arows, row_count=60, col_count=10)

    # ── 원본 산출값 (검산 기준값) — 빌드 시점에 원본에서 읽어 코드/마크다운에 박아 둔다
    r6 = lambda x: round(float(x), 6)
    REF = [
        ("M* = (Mx − Mx+n)·보장금액/1000", r6(p["A7"])),
        ("N*[m′] (월납 보정 납입기수)", r6(p["B7"])),
        ("기준연납순보험료 10만당", float(p["D10"])),
        ("순보험료 10만당", float(p["D19"])),
        ("총신계약비 α 10만당", float(p["D13"])),
        ("베타순보험료 10만당", float(p["H19"])),
        ("영업보험료 10만당", float(p["D22"])),
        ("총납입보험료 10만당", float(p["E22"])),
        ("영업보험료 가입금액당(1회)", float(q["F8"])),
    ]
    ref_lit = "REF = [\n" + "".join(f"    ({a!r}, {b!r}),\n" for a, b in REF) + "]\n"
    design = (f"{int(q['C5'])}세 {'남자' if int(q['C4']) == 1 else '여자'}"
              f"·{int(q['C6'])}세 만기·{int(q['C8'])}년납"
              f"{' 월납' if int(q['C10']) == 12 else ''}")
    net10, gross10, tot10 = int(p["D19"]), int(p["D22"]), int(p["E22"])
    snet10, sgross10 = int(sp["D19"]), int(sp["D22"])
    nc10, snc10 = int(p["D13"]), int(sp["E13"])
    pay_yr, freq = int(q["C8"]), int(q["C10"])
    # 원본 V·(표준)V·W 값 (경과년 t → 행 3+t / 5+t)
    v_ref = {t: int(Vs[f"I{3 + t}"]) for t in (1, 3, 5, 10, 20, 40)}
    sv_ref = {t: int(SVs[f"I{3 + t}"]) for t in (1, 3, 5, 10, 20, 40)}
    w_ref = {t: (int(Ws[f"G{5 + t}"]), float(Ws[f"H{5 + t}"])) for t in (1, 2, 3, 5, 10, 20)}
    wtab = "\n".join(
        f"| {t} | {w_ref[t][0]:,} | {w_ref[t][1] * 100:.1f}% |" for t in (1, 2, 3, 5, 10, 20))
    vtab = "\n".join(
        f"| {t} | {v_ref[t]:,} | {sv_ref[t]:,} | {sv_ref[t] - v_ref[t]:+,} |"
        for t in (1, 3, 5, 10, 20, 40))

    sid = "sh-pt-risk"
    core = PT_LOAD + PT_COMM
    full = core + PT_PRICE + PT_RESERVE

    steps_items = [
        (2,
         "1단계 — 계산기수표 (lx·dx·Cx·Mx·Rx·Dx·Nx)",
         "## 1단계 — 계산기수표 (lx·dx·Cx·Mx·Rx·Dx·Nx)\n\n"
         "사망률 `qx`에서 **계산기수**를 만듭니다. 원본 `기수표` 시트의 수식을 그대로 옮긴 것입니다.\n\n"
         "| 기수 | 뜻 | 원본 엑셀 수식 |\n|---|---|---|\n"
         "| `lx` | 생존자 수(radix 100,000) | `C5: =C4*(1-OFFSET(위험률!$B$5,B4,0))` |\n"
         "| `llx` | **납입자 수** — 사망 + 납입면제(질병·재해 50%이상) 탈퇴 | `D5: =D4*(1-qx-fx+qx*fx/2)` |\n"
         "| `dx` | 사망자 수 | `E4: =C4*OFFSET(위험률!$B$5,B4,0)` |\n"
         "| `Cx` | 사망보험금 현가 | `F4: =E4*v^(A4+0.5)` — **연중앙 사망** 가정 |\n"
         "| `Mx` | ΣCx (아래에서 위로 누적) | `G4: =F4+G5` |\n"
         "| `Rx` | ΣMx | `H4: =G4+H5` |\n"
         "| `Dx`·`DLx` | 생존/납입자 현가 | `I4: =C4*v^A4`, `J4: =D4*v^A4` |\n"
         "| `Nx`·`NLx` | ΣDx, ΣDLx | `K4: =I4+K5`, `L4: =J4+L5` |\n\n"
         "원본은 `OFFSET(기수표!$G$4, 보험기간, 0)`으로 `Mx+n`을 집었지만, 여기서는 `Mx[n]`처럼 **위치 인덱싱**으로 옮겼습니다.\n"
         "`t = 0`이 가입시점(나이 = 가입나이)입니다.",
         "계산기수표",
         core + '''
k = commutation(q_app, f_app, i_app)          # 적용 기초(7회 경험사망률 + 예정이율)
out = k.copy()
for c in ("lx", "llx", "dx", "Cx", "Mx", "Rx", "Dx", "DLx", "Nx", "NLx"):
    out[c] = out[c].round(4)
print(f"v = 1/(1+{i_app}) = {1 / (1 + i_app):.10f} · {x0}세 가입 · 기수표 {len(out)}행 (t = 0 … {len(out) - 1})")
out''',
         "values"),
        (90,
         "2단계 — 보험료 (순보험료 → 영업보험료) · 원본 검산",
         "## 2단계 — 보험료 (순보험료 → 영업보험료) · 원본 검산\n\n"
         "1단계 기수로 보험료를 만듭니다.\n\n"
         "- **M\\*** = `(Mx − Mx+n) × 보장금액/1000` — 원본 `P!A7`\n"
         "- **N\\*[m′]** = `m·(NLx − NLx+m) − (m−1)/2·(DLx − DLx+m)` — 원본 `P!B7`. "
         "월납이라 연납 기수를 **납입주기 보정**합니다(연 12회, 평균 반년 앞당겨 받는 효과).\n"
         "- **순보험료** = `M* / N*[m′]` — 원본 `P!C19`\n"
         "- **영업보험료** = `(순보험료 + α항 + β′항) / (1 − β1 − γ)` — 원본 `P!C22`\n"
         "  - α항 `P!A13` = `(α1·기준연납순보험료 + α2)·Dx/N*[m′] + β2/m′`\n"
         "  - β′항 `P!B13` = `β′·(Nx+m − Nx+n)/N*[m′]`\n\n"
         "> 신계약비 α는 **반올림한(소수 5자리) 기준연납순보험료**로 계산합니다(원본 `P!C13`의 `ROUND`). "
         "반올림 위치가 다르면 10만당 값이 1원씩 어긋납니다.\n\n"
         "원본 산출과정표의 최종값 — 순보험료 10만당 **" + f"{net10}" + "원**, 영업보험료 10만당 **" + f"{gross10}"
         + "원**, 총납입보험료 10만당 **" + f"{tot10:,}" + "원**(= " + f"{gross10} × {pay_yr}년 × {freq}회"
         + ").\n아래 코드가 같은 값을 다시 계산해 **차이** 열로 대조합니다(차이 0이면 원본과 완전히 일치).\n\n"
         "> `원본(엑셀)` 열은 **기본 설계**(" + design + ") 기준으로 박아 둔 값입니다. "
         "`가정` 시트를 고치면 차이가 벌어지는 것이 정상입니다 — 검산은 기본 설계로 되돌린 뒤 보세요.",
         "보험료 산출 · 원본 대조표",
         full + "\n" + ref_lit + '''
k  = commutation(q_app, f_app, i_app)
pr = premium(k)
g10 = round(pr["gross"] * 1e5)                 # 영업보험료 10만당(원 단위 반올림)
calc = [pr["M"], pr["N"], round(pr["base"] * 1e5), round(pr["net"] * 1e5),
        round(pr["alpha"] * 1e5), round(pr["beta_net"] * 1e5), g10,
        g10 * m * mode, g10 * face / 10]
chk = pd.DataFrame({"항목": [a for a, _ in REF],
                    "원본(엑셀)": [b for _, b in REF],
                    "계산값": [round(float(x), 6) for x in calc]})
chk["차이"] = (chk["계산값"] - chk["원본(엑셀)"]).round(6)
print("최대 차이:", chk["차이"].abs().max())
chk''',
         "values"),
        (105,
         "3단계 — 책임준비금·해약환급금",
         "## 3단계 — 책임준비금·해약환급금\n\n"
         "**연말 책임준비금** `tV`는 장래법으로, 원본 `V` 시트와 같은 분해를 씁니다.\n\n"
         "```\n"
         "tV = ( (Mx+t − Mx+n)·보장금액/1000        ← 장래 사망보험금 (V!C3)\n"
         "     + β′·(Nx+max(t,m) − Nx+n)            ← 납입후유지비     (V!D3)\n"
         "     − 베타순보험료·(NLx+t − NLx+m) )      ← 장래 보험료 수입 (V!E3·F3)\n"
         "     / Dx+t\n"
         "```\n\n"
         "**해약환급금**은 준비금에서 미상각 신계약비(해지공제)를 뺀 값입니다 — 원본 `W` 시트.\n\n"
         "- 해지공제 `W!F6` = `신계약비 × max(min(납입기간,7) − 경과년, 0) / min(납입기간,7)` → 7년에 걸쳐 0으로 상각\n"
         "- 해약환급금 `W!G6` = `max(책임준비금 − 해지공제, 0)`\n"
         "- 환급률 `W!H6` = `해약환급금 / 납입보험료 누계`\n\n"
         "신계약비는 `조회!H5 = MIN(P!D13, '(표준)P'!E13)` — 적용·표준 중 **작은 쪽**(" + f"{min(nc10, snc10):,}"
         + "원/10만당)을 씁니다.\n\n"
         "원본 값(가입금액 1억원 기준):\n\n"
         "| 경과년 | 해약환급금(원) | 환급률 |\n|---|---|---|\n" + wtab + "\n\n"
         "> 초기 환급률이 낮은 것은 해지공제 때문입니다 — 7년이 지나면 해지공제가 0이 되어 준비금이 그대로 환급금이 됩니다.",
         "경과년별 준비금 · 환급금 표",
         full + '''
k  = commutation(q_app, f_app, i_app)
pr = premium(k)
V10 = reserve(k, pr["beta_net"])                                    # 10만당 책임준비금
g10 = round(pr["gross"] * 1e5)
# 신계약비는 적용·표준 중 작은 쪽 (조회!H5 = MIN(P!D13, '(표준)P'!E13))
a10 = min(round(pr["alpha"] * 1e5),
          round(premium(commutation(q_std, f_std, i_std))["alpha"] * 1e5))
Vf, sc, Wv, SP, rate = surrender(V10, g10, a10)
pd.DataFrame({"경과년": DUR,
              "준비금(10만당)": V10[DUR],
              "책임준비금": Vf[DUR],
              "해지공제": np.round(sc[DUR]),
              "해약환급금": Wv[DUR],
              "납입보험료누계": SP[DUR],
              "환급률": np.round(rate[DUR], 4)})''',
         "values"),
        (136,
         "4단계 — 환급률 곡선",
         "## 4단계 — 환급률 곡선\n\n"
         "경과년에 따라 환급률이 어떻게 올라오는지 봅니다. 왼쪽은 **환급률**(100% 기준선 표시), "
         "오른쪽은 **납입보험료 누계 · 책임준비금 · 해약환급금**을 금액으로 겹쳐 그린 것입니다.\n\n"
         "- 초기 몇 해는 해지공제(미상각 신계약비)가 준비금을 넘어 환급금이 **0**입니다.\n"
         "- 해지공제가 사라지는 " + f"{min(pay_yr, 7)}" + "년차부터 환급금 = 책임준비금이 됩니다.\n"
         "- 납입이 끝나는 " + f"{pay_yr}" + "년차 이후에는 납입누계가 고정되므로 환급률이 100%를 넘어갑니다.",
         "환급률 · 금액 곡선",
         full + '''
import matplotlib.pyplot as plt
k  = commutation(q_app, f_app, i_app)
pr = premium(k)
V10 = reserve(k, pr["beta_net"])
g10 = round(pr["gross"] * 1e5)
a10 = min(round(pr["alpha"] * 1e5),
          round(premium(commutation(q_std, f_std, i_std))["alpha"] * 1e5))
Vf, sc, Wv, SP, rate = surrender(V10, g10, a10)
t = np.arange(1, n + 1)
fig, ax = plt.subplots(1, 2, figsize=(10.5, 3.8))
ax[0].plot(t, rate[t] * 100, color="#4A90C2", lw=1.6)
ax[0].axhline(100, color="#999", lw=1, ls="--")
ax[0].axvline(min(m, sc_yr), color="#C2704A", lw=1, ls=":")
ax[0].set_title("경과년별 환급률 (%)"); ax[0].set_xlabel("경과년"); ax[0].grid(alpha=0.3)
ax[1].plot(t, SP[t] / 1e4, label="납입보험료 누계", color="#8A8A8A")
ax[1].plot(t, Vf[t] / 1e4, label="책임준비금", color="#4A90C2")
ax[1].plot(t, Wv[t] / 1e4, label="해약환급금", color="#C2704A")
ax[1].set_title("금액 비교 (만원)"); ax[1].set_xlabel("경과년")
ax[1].grid(alpha=0.3); ax[1].legend(fontsize=8)
fig.tight_layout()
fig''',
         "object"),
        (144,
         "5단계 — 표준 vs 적용 비교",
         "## 5단계 — 표준 vs 적용 비교\n\n"
         "**표준책임준비금**은 회사가 실제로 쓰는 가정(적용 기초)과 무관하게 **감독당국이 정한 기초**"
         "(표준이율 + 표준위험률)로 다시 계산한 준비금입니다. 회사가 낙관적인 가정으로 준비금을 적게 쌓는 것을 막는 "
         "**하한선**이며, 재무제표에는 적용·표준 중 큰 쪽을 적립합니다.\n\n"
         "이 예제에서는 적용이율 **" + f"{float(q['B12']) * 100:.2f}%" + "** · 7회 경험사망률과 "
         "표준이율 **" + f"{float(q['D12']) * 100:.2f}%" + "** · 7회 표준율을 나란히 계산합니다. "
         "표준 쪽은 이율이 낮고(할인이 약해 현가가 커짐) 위험률이 보수적이라 준비금이 더 큽니다.\n\n"
         "원본 값(10만당):\n\n"
         "| 경과년 | 적용 준비금 | 표준 준비금 | 차이 |\n|---|---|---|---|\n" + vtab + "\n\n"
         "보험료도 같이 대조합니다 — 순보험료 10만당 적용 **" + f"{net10}" + "** vs 표준 **" + f"{snet10}" + "**, "
         "영업보험료 적용 **" + f"{gross10}" + "** vs 표준 **" + f"{sgross10}" + "**.\n\n"
         "> 원본은 `(표준)기수표`·`(표준)P`·`(표준)V` 시트를 따로 두었지만, 여기서는 같은 함수에 "
         "**기초율과 이율만 바꿔** 넣습니다.",
         "표준·적용 준비금 비교표",
         full + '''
kA, kS = commutation(q_app, f_app, i_app), commutation(q_std, f_std, i_std)   # 적용 / 표준 기초
pA, pS = premium(kA), premium(kS)
VA, VS = reserve(kA, pA["beta_net"]), reserve(kS, pS["beta_net"])
for nm, key in (("순보험료", "net"), ("영업보험료", "gross"), ("기준연납순보험료", "base"),
                ("총신계약비 α", "alpha"), ("베타순보험료", "beta_net")):
    print(f"{nm:16s} 10만당  적용 {round(pA[key] * 1e5):>6,}   표준 {round(pS[key] * 1e5):>6,}")
diff = VS[DUR] - VA[DUR]
pd.DataFrame({"경과년": DUR, "적용준비금": VA[DUR], "표준준비금": VS[DUR],
              "차이(표준−적용)": diff,
              "차이율(%)": np.round(np.divide(diff, VA[DUR], out=np.zeros_like(diff),
                                              where=VA[DUR] > 0) * 100, 2)})''',
         "values"),
        (176,
         "6단계 — 표준·적용 차이 그래프",
         "## 6단계 — 표준·적용 차이 그래프\n\n"
         "왼쪽은 두 기초의 준비금 곡선, 오른쪽은 **표준 − 적용** 차이를 경과년별 막대로 그린 것입니다.\n"
         "차이는 납입기간 부근에서 가장 크고 만기에 가까워지면 다시 좁아집니다 — "
         "만기에는 두 기초 모두 준비금이 0으로 수렴하기 때문입니다.",
         "준비금 곡선 · 차이 막대",
         full + '''
import matplotlib.pyplot as plt
kA, kS = commutation(q_app, f_app, i_app), commutation(q_std, f_std, i_std)
VA = reserve(kA, premium(kA)["beta_net"])
VS = reserve(kS, premium(kS)["beta_net"])
t = np.arange(0, n + 1)
fig, ax = plt.subplots(1, 2, figsize=(10.5, 3.8))
ax[0].plot(t, VA[t], label=f"적용 {i_app * 100:.2f}%", color="#4A90C2")
ax[0].plot(t, VS[t], label=f"표준 {i_std * 100:.2f}%", color="#C2704A")
ax[0].set_title("책임준비금 (10만당)"); ax[0].set_xlabel("경과년")
ax[0].grid(alpha=0.3); ax[0].legend(fontsize=8)
ax[1].bar(t, VS[t] - VA[t], color="#4A90C2")
ax[1].set_title("표준 − 적용 (10만당)"); ax[1].set_xlabel("경과년"); ax[1].grid(alpha=0.3)
fig.tight_layout()
fig''',
         "object"),
    ]

    blocks = steps(sid, 12, "pt",
                   ("보험료 산출 — 정기보험",
                    "# 보험료 산출 — 정기보험\n\n"
                    "실제 보험료 산출과정표(경영인정기보험 무배당 1504)의 위험률과 파라미터를 그대로 담았습니다. "
                    "**계산기수 → 보험료 → 준비금·해약환급금 → 표준/적용 비교**가 이 한 파일에서 닫힙니다.\n\n"
                    "**구성**\n\n"
                    "- `위험률` 시트 — 나이 0~112세의 7회 경험사망률·표준사망률·우량체사망률과 "
                    "납입면제(질병·재해 50%이상) 발생률 (원본 `위험률` 시트 A5:W117 중 값이 든 열)\n"
                    "- `가정` 시트 — 성별·가입나이·보험기간·납입기간·가입금액·예정이율·표준이율과 사업비율 "
                    "α1·α2·β1·β2·β′·γ (원본 `조회` 시트)\n"
                    "- 오른쪽 M열부터 6단계의 [설명 + 코드] 블록\n\n"
                    "**읽는 법** — 설명을 읽고 코드 블록을 순서대로 실행하거나, 그냥 **[전체 실행]**을 누르세요. "
                    "각 블록은 `xl()`로 시트를 다시 읽어 단독 실행됩니다. 설명에는 원본 엑셀 수식을 그대로 인용해 두었으니 "
                    "코드와 나란히 대조해 보세요.\n\n"
                    "> 현재 설계: **" + f"{int(q['C5'])}세 남자 · {int(q['C6'])}세 만기 · {pay_yr}년납 월납 · "
                    f"가입금액 {int(q['C9']) // 10000}억원" + "**"),
                   steps_items)
    blocks.append(md_block(
        "blk-pt-wrap", sid, 184, 12,
        "## 정리 — 무엇을 바꾸면 무엇이 바뀌나\n\n"
        "모든 단계는 `가정` 시트만 보고 계산합니다. 값을 고치고 **[전체 실행]**을 누르면 "
        "1단계 기수표부터 6단계 그래프까지 한 번에 다시 만들어집니다.\n\n"
        "| 바꾸는 값 | 일어나는 일 |\n|---|---|\n"
        "| `성별` 1 → 2 | 여성 기초율로 전 단계가 재계산 — 사망률이 낮아 보험료·준비금이 내려갑니다 |\n"
        "| `가입나이` | 기수표의 시작 나이가 바뀌어 보험료가 크게 움직입니다(고연령일수록 급증) |\n"
        "| `만기나이` | `보험기간`도 같이 고쳐야 합니다 (보험기간 = 만기나이 − 가입나이) |\n"
        "| `납입기간` | N\\*[m′]와 해지공제 상각기간 min(납입기간, 7)이 함께 바뀝니다 |\n"
        "| `예정이율` | 올리면 할인이 커져 보험료·준비금이 내려갑니다 |\n"
        "| `표준이율` | 5·6단계의 표준 쪽만 움직입니다(적용 결과는 그대로) |\n"
        "| `α1`·`α2`·`β1`·`β2`·`β′`·`γ` | 순보험료는 그대로, 영업보험료와 해지공제(신계약비)가 바뀝니다 |\n\n"
        "**주의** — 원본 `조회` 시트에서 수식으로 이어져 있던 두 값은 여기서 **고정값**입니다 — 같이 고쳐야 합니다.\n\n"
        "- `보험기간` = 만기나이 − 가입나이 (원본 `조회!C7`)\n"
        "- `α1` = 5% × min(보험기간, 20) (원본 `조회!B14`)\n\n"
        "2단계의 **차이** 열이 모두 0이면 원본 산출과정표와 완전히 일치한다는 뜻입니다.",
        "정리 — 무엇을 바꾸면 무엇이 바뀌나"))

    return workbook(
        "wb-sample-premium-term",
        "보험료 산출 — 정기보험(계산기수·준비금)",
        [risk_sheet, assume_sheet],
        blocks,
    )


# ── 부록 M.4 #6 — 암보험 다중탈퇴 (더블암진단특약.xlsx) ───

CANCER_SRC = Path(
    r"C:\Users\tklee\OneDrive - 코리안리재보험\0. 보험료 산출 방법서"
    r"\저해지상품\MG 더블종신공제Ⅱ 엑셀\더블암진단특약.xlsx"
)

#: 원본 `위험률` 시트의 4열 블록 11종 — (워크북 열 이름, 시작 열, 원본 명명범위, 성격)
#: **비율**로 표시된 5종은 발생률이 아니라 `암발생률`에 곱하는 비율이다(부록 M.4).
CANCER_BLOCKS = [
    ("생존사망률", "A", "재해사망률", "발생률"),
    ("재해장해율", "E", "재해장해율", "발생률"),
    ("질병장해율", "I", "질병장해율", "발생률"),
    ("암발생률", "M", "암발생율", "발생률"),
    ("고액암비율", "Q", "고액암발생율", "비율"),
    ("특정암비율", "U", "특정암발생율", "비율"),
    ("유방생식기암비율", "Y", "유방생식기암발생율", "비율"),
    ("갑상선암비율", "AC", "갑상선암발생율", "비율"),
    ("기타피부암비율", "AG", "기타피부암발생율", "비율"),
    ("제자리암발생률", "AK", "상피내암발생율", "발생률"),
    ("경계성종양발생률", "AO", "경계성종양발생율", "발생률"),
]

#: 급부 8종 — (담보, Cx/Mx 번호, 기본배율, 전환후 추가배율, 90일 면책) = 원본 `총괄` 1행
CANCER_COVERS = [
    ("일반암", 1, 0.4, 0.4, 1),
    ("고액암", 2, 0.0, 0.0, 1),
    ("특정암", 3, 0.0, 0.0, 1),
    ("유방·생식기 제외 암", 4, 0.6, 0.6, 1),
    ("갑상선암", 5, 0.1, 0.1, 0),
    ("기타피부암", 6, 0.1, 0.1, 0),
    ("제자리암", 7, 0.1, 0.1, 0),
    ("경계성종양", 8, 0.1, 0.1, 0),
]


def _colnum(letters):
    """엑셀 열 문자 → 1-기반 열 번호."""
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n

def _collet(n):
    """1-기반 열 번호 → 엑셀 열 문자."""
    s = ""
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


# 모든 코드 블록이 단독 실행되도록 가정·위험률 로드를 앞에 붙인다.
CM_LOAD = '''# ── 가정 시트 — 값을 바꾸고 [전체 실행]하면 이후 모든 단계가 다시 계산된다
_p = xl("가정!A1:C15", headers=True)
P = dict(zip(_p["항목"], _p["값"]))
sex   = int(P["성별"])          # 1 = 남자, 2 = 여자                (총괄!B2)
x     = int(P["가입나이"])       # 가입연령                          (총괄!B3)
n     = int(P["보험기간"])       # = 80 − 가입나이                   (총괄!B4)
m     = int(P["납입기간"])       # 년                                (총괄!B5)
mm    = int(P["납입주기"])       # 연 납입 횟수. 12 = 월납            (총괄!F6)
i     = float(P["예정이율"])     # 3.25%                             (총괄!B8)
s_cnv = int(P["전환시점"])       # 이 나이부터 급부가 두 배(뒤에두배)  (총괄!D9)
M_std = int(P["표준납입기간"])    # MIN(보험기간, 20)                 (총괄!E10)
wait  = float(P["면책계수"])     # 90일 면책 → 첫해 급부의 3/4        (기수표!X4)
a1, a2 = float(P["α1"]), float(P["α2"])   # 신계약비 5/1000, 0.05×MIN(n,20)
b1, b2 = float(P["β1"]), float(P["β2"])   # 0.1/1000, 유지비율 0.07
gm     = float(P["γ"])                    # 수금비율 0.04

# ── 급부배율 (원본 `총괄` 1행) — 담보별 배율과 90일 면책 적용 여부
CV = xl("가정!E1:I9", headers=True)

# ── 위험률 시트(나이 0~110 = 원본 명명범위와 같은 범위) — 성별 열만 골라 나이 인덱스로
R  = xl("위험률!A1:W112", headers=True).fillna(0.0).astype({"나이": "int64"}).set_index("나이")
sx = "_남" if sex == 1 else "_여"
'''

CM_TABLE = '''

def xlround(v, d=0):
    """엑셀 ROUND = 사사오입. 파이썬 round()는 은행가 반올림이라 1원씩 어긋난다."""
    f = 10.0 ** d
    return float(np.sign(v) * np.floor(np.abs(v) * f + 0.5) / f)


def commutation():
    """다중탈퇴 기수표 — 원본 `기수표` 시트 A4:AG144 수식을 그대로 옮긴 것."""
    NR = 141                                     # 원본 기수표 행 4~144
    age = np.empty(NR, dtype=int)
    age[0] = x
    for j in range(NR - 1):                      # A5: =IF(A4+1<110, A4+1, 110)
        age[j + 1] = age[j] + 1 if age[j] + 1 < 110 else 110
    r   = lambda nm: R[nm + sx].loc[age].to_numpy(float)
    q   = r("생존사망률")                          # 원본 명명범위 이름은 `재해사망률`
    dis = r("재해장해율") + r("질병장해율")          # 납입면제 사유(50%이상 장해)
    ca  = r("암발생률")
    hi, spc, br = r("고액암비율"), r("특정암비율"), r("유방생식기암비율")
    th, sk = r("갑상선암비율"), r("기타피부암비율")
    # ── 담보별 탈퇴율. 비율 계열은 발생률이 아니라 **암발생률에 곱하는 비율**이다.
    dec = np.vstack([
        ca * (1 - th - sk),           # (1) 일반암    기수표!P4 (갑상선·기타피부 제외)
        ca * hi,                      # (2) 고액암    기수표!Q4
        ca * spc,                     # (3) 특정암    기수표!R4
        ca * (1 - th - sk - br),      # (4) 유방·생식기 제외 암  기수표!S4
        ca * th,                      # (5) 갑상선암  기수표!T4
        ca * sk,                      # (6) 기타피부암 기수표!U4
        r("제자리암발생률"),            # (7) 제자리암   기수표!V4 — 비율이 아니라 발생률
        r("경계성종양발생률"),          # (8) 경계성종양 기수표!W4 — 비율이 아니라 발생률
    ])
    lx = np.zeros(NR); lp = np.zeros(NR); L = np.zeros((8, NR))
    lx[0] = lp[0] = 100000.0; L[:, 0] = 100000.0          # radix 10만
    for j in range(NR - 1):
        if age[j + 1] > x + n:                            # B5: =IF(A5<=x+n, …, 0)
            break
        lx[j + 1] = lx[j] * (1 - q[j])                                     # 기수표!B5
        lp[j + 1] = (lp[j] * (1 - q[j] - dis[j] + q[j] * dis[j] / 2)       # 기수표!C5
                     * (1 - dec[0][j] * (1 - q[j] / 2) / (1 - q[j])))      #   납입자 l'x
        L[:, j + 1] = L[:, j] * (1 - q[j] - dec[:, j] + q[j] * dec[:, j] / 2)  # 기수표!D5:K5
    t = (age - x).astype(float)
    v, vh = (1 + i) ** -t, (1 + i) ** -(t + 0.5)          # 기수표!L4, M4
    C = L * dec * vh                                       # 기수표!P4:W4 — 연중앙 발생 가정
    rev = lambda a: np.cumsum(a[..., ::-1], axis=-1)[..., ::-1]
    Mx = rev(C)                                            # 기수표!X6 이후 = 단순 누계 ΣCx
    # 가입연령 행만 첫해 반년 가중 + 90일 면책 3/4 — 기수표!X4(면책) vs AB4(면책 없음)
    w = np.where(CV["면책적용"].to_numpy() == 1, wait, 1.0)
    Mx[:, 0] = 0.5 * w * C[:, 0] + 0.5 * C[:, 1] + Mx[:, 2]
    Mx[:, 1] = 0.5 * C[:, 1] + Mx[:, 2]                    # 기수표!X5 / AB5
    Dx, Dpx = lx * v, lp * v                               # 기수표!N4, O4
    return dict(age=age, lx=lx, lpx=lp, L=L, C=C, Mx=Mx, MxRaw=rev(C), Dx=Dx, Dpx=Dpx,
                Nx=rev(Dx), Npx=rev(Dpx), row={a: j for j, a in enumerate(age[:110 - x + 1])})
'''

CM_PRICE = '''

def price(k):
    """급부배율 SUMX → 순공제료 → 영업공제료 — 원본 `총괄` 시트."""
    row, Mx, Npx, Dpx = k["row"], k["Mx"], k["Npx"], k["Dpx"]
    j = CV["Mx"].to_numpy(int) - 1
    base = Mx[j, row[x]] - Mx[j, row[x + n]]              # 총괄!F3:M3  Mx(k)x − Mx(k)x+n
    plus = Mx[j, row[s_cnv]] - Mx[j, row[x + n]]          # 총괄!X3:AC3 전환시점 이후 두 배
    part = CV["기본배율"].to_numpy() * base + CV["전환후배율"].to_numpy() * plus
    SUMX = float(part.sum())                              # 총괄!E3 =SUMPRODUCT(F1:AC1,F3:AC3)
    # 총괄!E6  N* = mm·((N'x − N'x+m) − (mm−1)/(2·mm)·(D'x − D'x+m))
    Nstar = mm * ((Npx[row[x]] - Npx[row[x + m]])
                  - (mm - 1) / (2 * mm) * (Dpx[row[x]] - Dpx[row[x + m]]))
    Nden   = Npx[row[x]] - Npx[row[x + M_std]]            # 총괄!J15 N'x − N'x+M
    P      = SUMX / Nstar                                 # 총괄!E13 순공제료
    MaxANP = SUMX / Nden                                  # 총괄!E15 기준연납 순공제료
    nc     = a1 + a2 * MaxANP                             # 총괄!I17 신계약비
    alpha  = nc * Dpx[row[x]] / Nstar                     # 총괄!F17 α항
    num    = P + alpha + b1 / mm                          # 총괄!F17 분자
    PP     = xlround(num / (1 - b2 - gm), 5)              # 총괄!E17 영업공제료
    lim    = xlround((min(n, 20) * MaxANP * 0.05 + 0.5 * 10 / 1000) * 100000)  # 총괄!I19
    return dict(base=base, plus=plus, part=part, SUMX=SUMX, Nstar=Nstar, Nden=Nden,
                P=P, MaxANP=MaxANP, nc=nc, alpha=alpha, num=num, den=1 - b2 - gm, PP=PP,
                per100k=xlround(PP * 100000), lim=lim, nc100k=xlround(nc * 100000))
'''


def build_cancer_multi():
    """부록 M.4 #6 — 다중탈퇴 생존자표 → 급부별 Cx·Mx(90일 면책) → 급부배율 → 공제료."""
    if not CANCER_SRC.exists():
        print(f"!! 원본 없음 — 암보험 다중탈퇴 예제 건너뜀: {CANCER_SRC}")
        return None
    src = read_src_cells(CANCER_SRC, ["위험률", "총괄"])
    rk, tg = src["위험률"], src["총괄"]

    # ── 시트 1: 위험률 (나이 0~110 = 원본 A5:AQ115, 원본 명명범위와 같은 범위)
    head = [cell("나이", "s")]
    for name, _, _, _ in CANCER_BLOCKS:
        head += [cell(f"{name}_남", "s"), cell(f"{name}_여", "s")]
    rows = [head]
    for age in range(111):
        r = 5 + age
        line = [cell(age, "n")]
        for _, c0, _, _ in CANCER_BLOCKS:
            c = _colnum(c0)
            line += [cell(round(float(rk.get(f"{_collet(c + k)}{r}") or 0.0), 10), "n")
                     for k in (1, 2)]
        rows.append(line)
    risk_sheet = sheet_from_rows("sh-cm-risk", "위험률", rows, row_count=300, col_count=40)

    # ── 시트 2: 가정 — A:C 파라미터, E:I 급부배율(원본 `총괄` 1행)
    x0, n_ins, m_pay = int(tg["B3"]), int(tg["B4"]), int(tg["B5"])
    assume = [
        ("성별", int(tg["B2"]), "1 = 남자, 2 = 여자 — 2로 바꾸면 여성 기초율로 전 단계 재계산 (총괄!B2)"),
        ("가입나이", x0, "세 (총괄!B3)"),
        ("보험기간", n_ins, "= 80 − 가입나이 (총괄!B4)"),
        ("납입기간", m_pay, "년 (총괄!B5)"),
        ("납입주기", int(tg["F6"]), "연 납입 횟수. 12 = 월납 (총괄!F6)"),
        ("예정이율", float(tg["B8"]), "v = 1/(1+i) (총괄!B8)"),
        ("전환시점", int(tg["D9"]), "이 나이부터 급부가 두 배 — 「뒤에두배」 (총괄!D9)"),
        ("표준납입기간", int(tg["E10"]), "= MIN(보험기간, 20). 기준연납 순공제료의 분모 기간 (총괄!E10)"),
        ("면책계수", 0.75, "90일 면책 → 첫해 급부의 3/4만 인정 (기수표!X4의 3/4)"),
        ("α1", float(tg["B11"]), "신계약비 정액 = 5/1000 (총괄!B11)"),
        ("α2", float(tg["B12"]), "신계약비율 = 0.05 × MIN(보험기간, 20) (총괄!B12)"),
        ("β1", float(tg["B13"]), "유지비 정액 = 0.1/1000 (총괄!B13)"),
        ("β2", float(tg["B14"]), "유지비율 (총괄!B14)"),
        ("γ", float(tg["B16"]), "수금비율 (총괄!B16)"),
    ]
    cov_head = ["담보", "Mx", "기본배율", "전환후배율", "면책적용"]
    arows = [[cell("항목", "s"), cell("값", "s"), cell("비고", "s"), None]
             + [cell(h, "s") for h in cov_head]]
    for idx, (key, val, note) in enumerate(assume):
        line = [cell(key, "s"), cell(val, "n"), cell(note, "s"), None]
        if idx < len(CANCER_COVERS):
            nm, mi, b, p, wt = CANCER_COVERS[idx]
            line += [cell(nm, "s"), cell(mi, "n"), cell(b, "n"), cell(p, "n"), cell(wt, "n")]
        arows.append(line)
    assume_sheet = sheet_from_rows("sh-cm-assume", "가정", arows, row_count=60, col_count=12)

    # ── 원본 `총괄` 산출값 (검산 기준값) — 빌드 시점에 읽어 코드/마크다운에 박아 둔다
    r8 = lambda v: round(float(v), 8)
    REF = [
        ("SUMX — 급부 현가 합 (총괄!E3)", r8(tg["E3"])),
        ("N* — 월납 보정 납입기수 (총괄!E6)", r8(tg["E6"])),
        ("N'x − N'x+M — 기준연납 분모 (총괄!J15)", r8(tg["J15"])),
        ("순공제료 P (총괄!E13)", r8(tg["E13"])),
        ("순공제료 1,000만원당 (총괄!D13)", r8(tg["D13"])),
        ("기준연납 순공제료 MaxANP (총괄!E15)", r8(tg["E15"])),
        ("신계약비 α1+α2·MaxANP (총괄!I17)", r8(tg["I17"])),
        ("신계약비 10만원당 (총괄!J19)", r8(tg["J19"])),
        ("신계약비 한도 10만원당 (총괄!I19)", r8(tg["I19"])),
        ("영업공제료 분자 (총괄!F17)", r8(tg["F17"])),
        ("영업공제료 PP — ROUND 5자리 (총괄!E17)", r8(tg["E17"])),
        ("10만원당 영업공제료 (총괄!E19)", r8(tg["E19"])),
    ]
    ref_lit = "REF = [\n" + "".join(f"    ({a!r}, {b!r}),\n" for a, b in REF) + "]\n"
    kind_lit = ",\n        ".join(
        f'("{nm}", "{kind}", "{c0}:{_collet(_colnum(c0) + 2)}", "{orig}")'
        for nm, c0, orig, kind in CANCER_BLOCKS)

    i_rate, s_cnv = float(tg["B8"]), int(tg["D9"])
    net10 = round(float(tg["E13"]) * 1e5, 1)
    gross10, nc10, lim10 = int(tg["E19"]), int(tg["J19"]), int(tg["I19"])
    design = (f"{x0}세 {'남자' if int(tg['B2']) == 1 else '여자'} · {x0 + n_ins}세 만기"
              f"({n_ins}년) · {m_pay}년납 월납 · 예정이율 {i_rate * 100:.2f}%")
    cov_tab = "\n".join(
        f"| Cx({mi}) · Mx({mi}) | {nm} | {b} | {p} | {'**적용**' if wt else '없음'} |"
        for nm, mi, b, p, wt in CANCER_COVERS)

    core = CM_LOAD + CM_TABLE
    full = core + CM_PRICE
    sid = "sh-cm-risk"

    steps_items = [
        (2,
         "1단계 — 위험률 11종 확인 (발생률인가, 비율인가)",
         "## 1단계 — 위험률 11종 확인 (발생률인가, 비율인가)\n\n"
         "원본 `위험률` 시트는 `[나이 | 남자 | 여자 | 빈칸]` 4열 블록이 **11번 반복**됩니다"
         "(A4:AQ117, 출처 써미트 2014-59호). 이 예제는 그중 나이 0~110세 구간을 그대로 담았습니다.\n\n"
         "**가장 중요한 구분** — 11종이 전부 발생률인 것은 아닙니다.\n\n"
         "| 성격 | 위험률 | 쓰는 법 |\n|---|---|---|\n"
         "| **발생률** | 생존사망률 · 재해50%이상 장해율 · 질병장해50%이상 · **암발생률** · 제자리암 · 경계성종양 |"
         " 그 자체가 1년 안에 그 사건이 일어날 확률 |\n"
         "| **비율** | 고액암 · 특정암 · 유방/남녀생식기암 · 갑상선암 · 기타피부암 |"
         " **암발생률에 곱한다.** 발생한 암 중 그 유형이 차지하는 비중 |\n\n"
         "원본 수식이 그것을 그대로 보여 줍니다 — 비율 계열은 언제나 `암발생율`과 **곱해져서** 나타납니다.\n\n"
         "```\n"
         "기수표!Q4  (고액암)   = E4 * VLOOKUP(A4,암발생율,sex+1,FALSE)\n"
         "                          * VLOOKUP(A4,고액암발생율,sex+1,FALSE) * M4\n"
         "기수표!V4  (제자리암) = J4 * VLOOKUP(A4,상피내암발생율,sex+1,FALSE) * M4   ← 곱하지 않는다\n"
         "```\n\n"
         "> 원본 시트 제목은 「무배당 예정 고액암**발생률**」이지만 값이 0.33·0.45처럼 크고 언제나 암발생률과 "
         "곱해집니다 — **이름은 발생률, 실체는 비율**입니다. 이 예제는 열 이름을 `고액암비율`처럼 고쳐 두었습니다.\n"
         "> 또 하나 — 원본 명명범위 `재해사망률`이 가리키는 블록은 실제로는 「무배당 예정 **생존사망률**」(A:C)입니다. "
         "이름만 남은 것이라 이 예제에서는 `생존사망률`로 부릅니다.",
         "위험률 11종 — 성격·원본 대응",
         core + '''
KIND = [''' + kind_lit + ''']
out = pd.DataFrame({
    "위험률": [a for a, _, _, _ in KIND],
    "성격": [b for _, b, _, _ in KIND],
    "원본 열": [c for _, _, c, _ in KIND],
    "원본 명명범위": [d for _, _, _, d in KIND],
    "곱하는 대상": ["암발생률" if b == "비율" else "—" for _, b, _, _ in KIND],
    f"{x}세 남": [round(float(R[a + "_남"].loc[x]), 6) for a, _, _, _ in KIND],
    f"{x}세 여": [round(float(R[a + "_여"].loc[x]), 6) for a, _, _, _ in KIND],
})
chk = R["갑상선암비율" + sx] + R["기타피부암비율" + sx] + R["유방생식기암비율" + sx]
print(f"나이 {R.index.min()}~{R.index.max()} · {len(R.columns)}열 (11종 × 남/여)")
print(f"비율 3종 합(갑상선+기타피부+유방생식기) 최대 {chk.max():.4f} — 1을 넘지 않아야 한다")
out''',
         "values"),
        (18,
         "2단계 — 다중탈퇴 생존자표 lx · l'x · lx(2)~lx(9)",
         "## 2단계 — 다중탈퇴 생존자표 lx · l'x · lx(2)~lx(9)\n\n"
         "담보가 8개라 **생존자표도 8개**입니다. 담보 k의 생존자 `lx(k+1)`은 사망과 **그 담보의 지급사유**(진단) "
         "두 가지로 함께 줄어듭니다 — 이것이 다중탈퇴표입니다.\n\n"
         "```\n"
         "기수표!D5 (lx(2), 일반암) = IF(A5<=x+n,\n"
         "     D4*(1 − 사망률 − 일반암발생 + 사망률*일반암발생/2), 0)\n"
         "     여기서 일반암발생 = 암발생율 − 암발생율*갑상선암발생율 − 암발생율*기타피부암발생율\n"
         "```\n\n"
         "`+ 사망률×발생률/2`는 **한 해에 두 탈퇴가 겹칠 확률의 보정**입니다(둘 다 연중 균등 발생 가정).\n\n"
         "| 열 | 뜻 | 줄어드는 사유 |\n|---|---|---|\n"
         "| `lx` | 생존자 | 사망만 (기수표!B5) |\n"
         "| `l'x` | **납입자** | 사망 + 50%이상 장해(재해·질병 → 납입면제) + 일반암 진단 (기수표!C5) |\n"
         "| `lx(2)`~`lx(9)` | 담보별 생존자 | 사망 + 해당 담보의 진단 (기수표!D5:K5) |\n\n"
         "`l'x`만 식이 두 겹인 것에 주의하세요 — 장해에 의한 납입면제와 암 진단에 의한 납입면제가 곱으로 이어집니다. "
         "`l'x`는 **보험료를 받는 쪽**(N'x·D'x)에만 쓰이고 급부 쪽에는 쓰이지 않습니다.\n\n"
         "> 모든 표가 `IF(A5<=x+n, …, 0)`이라 만기(" + f"{x0 + n_ins}" + "세) 다음 나이부터 0이 됩니다. radix는 10만.",
         "다중탈퇴 생존자표 (가입~만기)",
         core + '''
k = commutation()
last = k["row"][x + n]
out = pd.DataFrame({"나이": k["age"][:last + 1], "lx": k["lx"][:last + 1],
                    "l'x": k["lpx"][:last + 1]})
for row in CV.itertuples(index=False):
    out[f"lx({int(row.Mx) + 1}) {row.담보}"] = k["L"][int(row.Mx) - 1][:last + 1]
print(f"{x}세 가입 · {n}년 보장 → 생존자표 {len(out)}행 ({x}~{x + n}세)")
print(f"만기 {x + n}세   lx {k['lx'][last]:,.1f} · 납입자 l'x {k['lpx'][last]:,.1f}  "
      f"(차이 {k['lx'][last] - k['lpx'][last]:,.1f} = 장해·암 진단에 의한 납입면제)")
out.round(4)''',
         "values"),
        (64,
         "3단계 — 급부별 Cx(1)~Cx(8) · Mx(1)~Mx(8) (90일 면책)",
         "## 3단계 — 급부별 Cx(1)~Cx(8) · Mx(1)~Mx(8) (90일 면책)\n\n"
         "`Cx(k) = lx(k+1) × 담보 발생률 × v^(t+1/2)` — 연중앙 발생 가정입니다.\n\n"
         "```\n"
         "기수표!P4 (일반암)   = D4*(암발생율 − 암발생율*갑상선암발생율 − 암발생율*기타피부암발생율)*M4\n"
         "기수표!T4 (갑상선암) = H4*암발생율*갑상선암발생율*M4\n"
         "기수표!M4            = (1+i)^-(A4−x+0.5)      ← v^(t+1/2)\n"
         "```\n\n"
         "### 90일 면책이 들어가는 곳 — Mx의 첫 줄\n\n"
         "`Mx(k)`는 아래에서 위로 누적한 ΣCx이지만 **가입연령 행만 다릅니다.**\n\n"
         "```\n"
         "기수표!X4  (Mx(1) 일반암, 면책 있음)   = P4*1/2*3/4 + 0.5*P5 + SUM(P6:P144)\n"
         "기수표!AB4 (Mx(5) 갑상선암, 면책 없음) = 0.5*T4     + 0.5*T5 + SUM(T6:$T$144)\n"
         "기수표!X6  (그 아래 전부)              = SUM(P6:$P$144)      ← 단순 누계\n"
         "```\n\n"
         "두 식의 차이는 **첫해 항의 `3/4` 하나**뿐입니다.\n\n"
         "- `1/2` — 가입 시점이 정수 연령 한가운데 놓이는 것을 감안한 반년 가중 (모든 담보 공통)\n"
         "- `3/4` — **암 담보의 90일 면책**. 첫 보험연도 365일 중 뒤의 약 3/4만 보장 → 첫해 Cx의 3/4만 인정\n"
         "- 면책이 없는 담보(갑상선암 · 기타피부암 · 제자리암 · 경계성종양)에는 `3/4`이 붙지 않습니다\n\n"
         "| 기수 | 담보 | 기본배율 | 전환후 추가배율 | 90일 면책 |\n|---|---|---|---|---|\n" + cov_tab + "\n\n"
         "> 원본은 가입연령 행과 그 다음 행만 특별 처리하고 셋째 행부터는 단순 누계로 돌아갑니다. "
         "공제료 산출에는 `Mx(k)x` · `Mx(k)x+n` · `Mx(k)s`만 쓰이므로 결과에는 영향이 없지만, "
         "**표 전체를 다른 용도로 그대로 쓰면 안 되는 이유**이기도 합니다.",
         "급부별 Cx (가입~만기) · 면책 효과 대조",
         core + '''
k = commutation()
last = k["row"][x + n]
out = pd.DataFrame({"나이": k["age"][:last + 1]})
for row in CV.itertuples(index=False):
    out[f"Cx({int(row.Mx)}) {row.담보}"] = k["C"][int(row.Mx) - 1][:last + 1]

# ── 면책 대조 — 가입연령 행의 Mx를 원본식(반년 가중 + 면책) / 단순 ΣCx로 나란히
print("담보별 Mx(x) — 원본식(반년 가중 + 90일 면책) vs 단순 누계 ΣCx")
for row in CV.itertuples(index=False):
    j = int(row.Mx) - 1
    a, b = k["Mx"][j, 0], k["MxRaw"][j, 0]
    w = wait if row.면책적용 == 1 else 1.0
    tag = f"첫해 가중 {0.5 * w:.3f}" + ("  ← 90일 면책 3/4" if row.면책적용 == 1 else "")
    print(f"  Mx({int(row.Mx)}) {row.담보:<16s} 원본식 {a:12,.4f}   단순ΣCx {b:12,.4f}   "
          f"차이 {a - b:+11,.4f}   {tag}")
out.round(6)''',
         "values"),
        (110,
         "4단계 — 급부배율 SUMX → 순공제료",
         "## 4단계 — 급부배율 SUMX → 순공제료\n\n"
         "담보 8종의 기수를 **급부배율**로 묶어 하나의 급부 현가 `SUMX`를 만듭니다 — 원본 `총괄` 1~4행.\n\n"
         "```\n"
         "총괄!H3 (일반암, 기본)   = VLOOKUP(x,   기수표!$A$4:$AE$144, 24, FALSE)\n"
         "                         − VLOOKUP(x+n, 기수표!$A$4:$AE$144, 24, FALSE)   ← Mx(1)x − Mx(1)x+n\n"
         "총괄!X3 (일반암, 전환후) = VLOOKUP(s, …, 24) − VLOOKUP(x+n, …, 24)       ← Mx(1)s − Mx(1)x+n\n"
         "총괄!E3 (SUMX)           = SUMPRODUCT(F1:AC1, F3:AC3)\n"
         "```\n\n"
         "이 상품은 **「뒤에두배」** 구조입니다 — " + f"{s_cnv}" + "세(`전환시점`)부터 만기까지 급부가 두 배가 되므로 "
         "`Mx(k)s − Mx(k)x+n` 구간을 배율만큼 **한 번 더** 더합니다.\n\n"
         "배율을 보면 상품 구조가 그대로 읽힙니다 — 일반암 **0.4** + 유방·생식기 제외 암 **0.6**. "
         "두 담보는 포함관계(유방·생식기 제외 암 ⊂ 일반암)라 **유방암·생식기암이면 0.4, 그 밖의 암이면 1.0**이 됩니다. "
         "갑상선암·기타피부암·제자리암·경계성종양은 각 0.1이고, 이 상품에서 고액암·특정암 배율은 0입니다.\n\n"
         "**순공제료** — 원본 `총괄` 5~13행\n\n"
         "```\n"
         "총괄!E6  N* = mm*((N'x − N'x+m) − (mm−1)/(2*mm)*(D'x − D'x+m))   ← 월납 보정 납입기수\n"
         "총괄!E13 P  = F13/G13 = SUMX / N*\n"
         "```\n\n"
         "분모가 `Nx`가 아니라 **`N'x`(납입자 기수)** 인 점이 핵심입니다 — 장해·암 진단으로 납입이 면제된 계약은 "
         "더 이상 보험료를 내지 않기 때문입니다.",
         "담보별 급부배율 · SUMX 기여도",
         full + '''
k = commutation()
r = price(k)
out = pd.DataFrame({
    "담보": CV["담보"],
    "Mx": CV["Mx"].astype(int),
    "기본배율": CV["기본배율"],
    "전환후배율": CV["전환후배율"],
    f"Mx(k){x}−Mx(k){x + n}": r["base"].round(4),
    f"Mx(k){s_cnv}−Mx(k){x + n}": r["plus"].round(4),
    "기여도": r["part"].round(4),
    "비중(%)": (r["part"] / r["SUMX"] * 100).round(2),
})
print(f"SUMX  {r['SUMX']:,.6f}    (총괄!E3)")
print(f"N*    {r['Nstar']:,.6f}    (총괄!E6 — 연 {mm}회 납입 보정)")
print(f"순공제료 P = SUMX / N* = {r['P']:.10f}  →  1,000만원당 "
      f"{xlround(r['P'], 5) * 1e7:,.0f}원    (총괄!E13·D13)")
out''',
         "values"),
        (123,
         "5단계 — 영업공제료 (α1·α2·β1·β2·γ, 신계약비 한도)",
         "## 5단계 — 영업공제료 (α1·α2·β1·β2·γ, 신계약비 한도)\n\n"
         "순공제료에 사업비를 얹어 실제로 내는 **영업공제료**를 만듭니다.\n\n"
         "```\n"
         "총괄!E15 MaxANP = F15/G15 = SUMX / (N'x − N'x+M)     ← 기준연납 순공제료, M = MIN(n,20)\n"
         "총괄!I17 신계약비 = α1 + α2*MaxANP\n"
         "총괄!F17 분자     = P + (α1 + α2*MaxANP)*I6/E6 + β1/mm     ← I6 = D'x, E6 = N*\n"
         "총괄!G17 분모     = 1 − β2 − γ\n"
         "총괄!E17 PP      = ROUND(F17/G17, 5)\n"
         "총괄!E19         = PP*100000                              ← 10만원당 영업공제료\n"
         "```\n\n"
         "| 사업비 | 값 | 뜻 |\n|---|---|---|\n"
         "| α1 | 5/1000 | 신계약비 정액 |\n"
         "| α2 | 0.05 × MIN(n,20) | 신계약비율 — 기준연납 순공제료에 비례 |\n"
         "| β1 | 0.1/1000 | 유지비 정액 (납입 1회당 → `β1/mm`) |\n"
         "| β2 | 0.07 | 유지비율 — 영업공제료에 비례 |\n"
         "| γ | 0.04 | 수금비율 — 영업공제료에 비례 |\n\n"
         "β2·γ가 **분모**에 들어가는 것은 이 둘이 순공제료가 아니라 **영업공제료 자체에 비례**하기 때문입니다.\n\n"
         "### 신계약비 한도\n\n"
         "```\n"
         "총괄!I19 한도 = ROUND((MIN(n,20)*MaxANP*5% + 0.5*10/1000)*100000, 0)\n"
         "총괄!H19      = IF(I17 <= I19, \"적정\", \"부적정\")\n"
         "```\n\n"
         "원본 산출값 — 신계약비 **" + f"{nc10:,}" + "원**/10만원당, 한도 **" + f"{lim10:,}" + "원**/10만원당 → **"
         + ("적정" if nc10 <= lim10 else "부적정") + "**. 10만원당 영업공제료는 **" + f"{gross10}"
         + "원**입니다(순공제료 " + f"{net10}" + "원).\n\n"
         "> `ROUND`는 엑셀식 사사오입입니다. 파이썬 `round()`는 은행가 반올림이라 5자리에서 1원씩 어긋날 수 있어 "
         "`xlround()`를 따로 두었습니다.",
         "영업공제료 산출 단계",
         full + '''
k = commutation()
r = price(k)
out = pd.DataFrame({
    "항목": ["기준연납 순공제료 MaxANP", "신계약비 α1+α2·MaxANP", "신계약비 10만원당",
             "신계약비 한도 10만원당", "순공제료 P", "α항 = 신계약비·D'x/N*", "β1/mm",
             "분자 (P + α항 + β1/mm)", "분모 (1 − β2 − γ)", "영업공제료 PP",
             "10만원당 영업공제료"],
    "값": [r["MaxANP"], r["nc"], r["nc100k"], r["lim"], r["P"], r["alpha"], b1 / mm,
           r["num"], r["den"], r["PP"], r["per100k"]],
    "원본": ["총괄!E15", "총괄!I17", "총괄!J19", "총괄!I19", "총괄!E13", "총괄!F17",
             "총괄!F17", "총괄!F17", "총괄!G17", "총괄!E17", "총괄!E19"],
})
print(f"신계약비 {r['nc100k']:,.0f}원 ≤ 한도 {r['lim']:,.0f}원 → "
      f"{'적정' if r['nc100k'] <= r['lim'] else '부적정'}    (총괄!H19)")
print(f"10만원당 영업공제료 {r['per100k']:,.0f}원 · 1,000만원당 {r['per100k'] * 100:,.0f}원")
out''',
         "values"),
        (138,
         "6단계 — 원본 `총괄` 대조 검산",
         "## 6단계 — 원본 `총괄` 대조 검산\n\n"
         "여기까지의 계산이 원본 엑셀과 **같은 값**인지 확인합니다. `원본(엑셀)` 열은 "
         "`더블암진단특약.xlsx`의 `총괄` 시트에서 그대로 가져온 값입니다.\n\n"
         "**차이** 열이 모두 0이면 위험률 → 다중탈퇴표 → Cx·Mx → 급부배율 → 공제료의 전 과정이 원본과 일치합니다.\n\n"
         "> `원본(엑셀)` 열은 **기본 설계**(" + design + ") 기준으로 박아 둔 값입니다. "
         "`가정` 시트를 고치면 차이가 벌어지는 것이 정상입니다 — 검산은 기본 설계로 되돌린 뒤 보세요.",
         "원본 총괄 vs 계산값 대조표",
         full + "\n" + ref_lit + '''
k = commutation()
r = price(k)
calc = [r["SUMX"], r["Nstar"], r["Nden"], r["P"], xlround(r["P"], 5) * 1e7, r["MaxANP"],
        r["nc"], r["nc100k"], r["lim"], r["num"], r["PP"], r["per100k"]]
chk = pd.DataFrame({"항목": [a for a, _ in REF],
                    "원본(엑셀)": [b for _, b in REF],
                    "계산값": [round(float(v), 8) for v in calc]})
chk["차이"] = (chk["계산값"] - chk["원본(엑셀)"]).round(10)
print("최대 차이:", chk["차이"].abs().max())
chk''',
         "values"),
        (154,
         "7단계 — 담보별 기여도 그래프",
         "## 7단계 — 담보별 기여도 그래프\n\n"
         "왼쪽은 담보별 **SUMX 기여도**(급부배율 × Mx 차분), 오른쪽은 **연령별 급부 현가**"
         "(급부배율을 곱한 Cx)를 담보별로 쌓아 그린 것입니다.\n\n"
         "- 일반암(0.4)과 유방·생식기 제외 암(0.6)이 급부의 대부분을 차지합니다.\n"
         "- 오른쪽 곡선이 " + f"{s_cnv}" + "세에서 **계단처럼 뛰는 것**이 「뒤에두배」입니다 — 그 나이부터 배율이 두 배가 됩니다.\n"
         "- 60대 후반에 정점을 찍고 내려오는 것은, 암발생률은 계속 오르지만 "
         "**할인 v^t와 다중탈퇴로 줄어든 생존자 lx(k)** 가 그보다 빨리 줄기 때문입니다.",
         "담보별 기여도 · 연령별 급부 현가",
         full + '''
import matplotlib.pyplot as plt
k = commutation()
r = price(k)
lab = CV["담보"].tolist()
j = CV["Mx"].to_numpy(int) - 1
COLORS = ["#4A90C2", "#C2704A", "#7BA05B", "#B08CC2", "#C2A24A", "#5BA0A0", "#999999", "#C25B8A"]
fig, ax = plt.subplots(1, 2, figsize=(11, 4))
o = np.argsort(r["part"])
ax[0].barh(np.array(lab, dtype=object)[o], r["part"][o], color="#4A90C2")
for y, val in enumerate(r["part"][o]):
    ax[0].text(val, y, f" {val / r['SUMX'] * 100:.1f}%", va="center", fontsize=8)
ax[0].set_xlim(0, float(r["part"].max()) * 1.25)
ax[0].set_title(f"담보별 SUMX 기여도 (합 {r['SUMX']:,.0f})")
ax[0].grid(alpha=0.3, axis="x")

w = (CV["기본배율"].to_numpy()[:, None]
     + (k["age"] >= s_cnv)[None, :] * CV["전환후배율"].to_numpy()[:, None])
WC = k["C"][j] * w                                   # 담보별 급부배율 × Cx
keep = [q for q in range(len(lab)) if WC[q].sum() > 0]
ax[1].stackplot(k["age"][:n], WC[keep][:, :n], labels=[lab[q] for q in keep],
                colors=[COLORS[q % len(COLORS)] for q in keep])
ax[1].axvline(s_cnv, color="#333", lw=1, ls=":")
ax[1].annotate(f"{s_cnv}세 전환 — 급부 2배", (s_cnv, 0), xytext=(4, 8),
               textcoords="offset points", fontsize=8)
ax[1].set_title("연령별 급부 현가 (급부배율 × Cx)")
ax[1].set_xlabel("나이"); ax[1].grid(alpha=0.3); ax[1].legend(fontsize=7, loc="upper left")
fig.tight_layout()
fig''',
         "object"),
    ]

    blocks = steps(sid, 24, "cm",
                   ("암보험 — 다중탈퇴 기수·급부배율 보험료",
                    "# 암보험 — 다중탈퇴 기수·급부배율 보험료\n\n"
                    "실제 암진단특약 산출과정표(MG 더블종신공제Ⅱ · 더블암진단특약)의 위험률과 파라미터를 그대로 담았습니다. "
                    "**위험률 11종 → 담보별 다중탈퇴 생존자표 → Cx·Mx(90일 면책) → 급부배율 SUMX → 순·영업공제료 → "
                    "원본 대조 검산**이 이 한 파일에서 닫힙니다.\n\n"
                    "**구성**\n\n"
                    "- `위험률` 시트 — 나이 0~110세의 위험률 11종 × 남/여 22열 "
                    "(원본 `위험률` A5:AQ115, 출처 써미트 2014-59호)\n"
                    "- `가정` 시트 — A:C에 성별·가입나이·보험기간·납입기간·예정이율·전환시점과 사업비율 α1·α2·β1·β2·γ "
                    "(원본 `총괄`), E:I에 담보 8종의 **급부배율**(원본 `총괄` 1행)\n"
                    "- 오른쪽 Y열부터 7단계의 [설명 + 코드] 블록\n\n"
                    "**읽는 법** — 설명을 읽고 코드 블록을 순서대로 실행하거나, 그냥 **[전체 실행]**을 누르세요. "
                    "각 블록은 `xl()`로 시트를 다시 읽어 단독 실행됩니다. 설명에는 원본 엑셀 수식을 그대로 인용해 두었으니 "
                    "코드와 나란히 대조해 보세요.\n\n"
                    "> 현재 설계: **" + design + " · 뒤에두배(" + f"{s_cnv}" + "세 전환)**"),
                   steps_items)
    blocks.append(md_block(
        "blk-cm-wrap", sid, 159, 24,
        "## 정리 — 다중탈퇴에서 쉽게 틀리는 곳\n\n"
        "| 함정 | 무슨 일이 생기나 |\n|---|---|\n"
        "| 비율을 발생률로 오해 | 40세 고액암비율 0.0937을 그대로 발생률로 쓰면 그 담보 급부가 **435배** 커집니다 — 반드시 `암발생률 ×`를 붙이세요 |\n"
        "| 담보마다 생존자표가 다르다 | `lx` 하나로 8담보를 다 계산하면 안 됩니다. 담보 k는 담보 k의 진단으로만 탈퇴합니다 |\n"
        "| 겹침 보정 `+q·r/2` 누락 | 한 해에 사망과 진단이 겹칠 확률을 되돌리지 않으면 생존자가 과소평가됩니다 |\n"
        "| 90일 면책을 전 기간에 적용 | 면책 3/4은 **첫 보험연도에만** — `Mx`의 가입연령 행에만 붙습니다 |\n"
        "| 면책 없는 담보에도 3/4 적용 | 갑상선암·기타피부암·제자리암·경계성종양은 면책이 없습니다 (기수표!AB4) |\n"
        "| 공제료 분모에 `Nx` 사용 | 납입면제가 있는 상품은 **`N'x`(납입자 기수)** 를 써야 합니다 |\n"
        "| 파이썬 `round()` | 은행가 반올림입니다. 엑셀 `ROUND`(사사오입)와 달라 10만원당 1원씩 어긋날 수 있습니다 |\n\n"
        "**바꿔 보기** — `가정` 시트만 고치면 전 단계가 다시 계산됩니다.\n\n"
        "| 바꾸는 값 | 일어나는 일 |\n|---|---|\n"
        "| `성별` 1 → 2 | 여성 기초율 — 갑상선암·유방생식기암 비율이 크게 달라집니다 |\n"
        "| `면책계수` 0.75 → 1 | 90일 면책을 없앤 경우. 급부가 늘어 공제료가 올라갑니다 |\n"
        "| `전환시점` | 「뒤에두배」가 시작되는 나이. 늦출수록 급부가 줄어 공제료가 내려갑니다 |\n"
        "| `가정!G2:H9` 급부배율 | 담보 구성 자체를 바꿉니다 — 이 상품에서 0인 고액암·특정암을 켜 볼 수 있습니다 |\n"
        "| `예정이율` | 올리면 할인이 커져 급부 현가와 공제료가 함께 내려갑니다 |\n\n"
        "> `보험기간`은 원본에서 `=80−가입나이` 수식이었습니다 — 여기서는 고정값이라 `가입나이`를 바꾸면 같이 고쳐야 합니다. "
        "`α2`(`=0.05×MIN(보험기간,20)`)와 `표준납입기간`(`=MIN(보험기간,20)`)도 마찬가지입니다.\n\n"
        "6단계의 **차이** 열이 모두 0이면 원본 산출과정표와 완전히 일치한다는 뜻입니다.",
        "정리 — 다중탈퇴에서 쉽게 틀리는 곳"))

    return workbook(
        "wb-sample-cancer-multi",
        "암보험 — 다중탈퇴 기수·급부배율 보험료",
        [risk_sheet, assume_sheet],
        blocks,
    )


# ── 부록 M.4 #5 — 위험률 산출 (영양조사 원시통계 → 적용률) ────────

RISK_SRC = Path(
    r"C:\Users\tklee\OneDrive - 코리안리재보험\0. 보험료 산출 방법서\영양조사.xlsx"
)

#: `1_3.기초통계_추계인구` 행 번호 → 연령군. "계"·"80세이상" 집계행은 뺀다(이중계상 방지).
POP_ROWS = [
    (list(range(3, 19)) + [20, 21, 22, 23, 24], 1),    # 남자
    (list(range(26, 42)) + [43, 44, 45, 46, 47], 2),   # 여자
]
#: 90~94·95~99·100세 이상은 한 군단(90+)으로 합친다 — 원본 `K46 = SUM(D22:F24)`
POP_GRP = list(range(0, 80, 5)) + [80, 85, 90, 90, 90]

RR_LOAD = '''# ── 가정 시트 — 값을 바꾸고 [전체 실행]하면 이후 모든 단계가 다시 계산된다
_p = xl("가정!A1:C11", headers=True)
P = dict(zip(_p["항목"], _p["값"]))
LOAD = float(P["안전할증"])                # 안전할증 — 원본 `2 산출과정` M6 = 0.5
TOP  = int(P["최고연령"])                  # 산출 결과의 마지막 나이 — 원본 110세
BMI = {  # 발생자 중 BMI 30 이상 비율(국민건강영양조사) — 원본 `2 산출과정` J·K열
    "~39":   (float(P["BMI30비율_남_39이하"]), float(P["BMI30비율_여_39이하"])),
    "40~49": (float(P["BMI30비율_남_40대"]),   float(P["BMI30비율_여_40대"])),
    "50~59": (float(P["BMI30비율_남_50대"]),   float(P["BMI30비율_여_50대"])),
    "60~":   (float(P["BMI30비율_남_60이상"]), float(P["BMI30비율_여_60이상"])),
}
_w = xl("가정!A14:C23", headers=True)      # 원본 `2 산출과정` K51:M60
GW = _w["보정치"].to_numpy(float)          # 그레빌 9항 보정계수 (r = 4 … −4)
EW = _w["외삽치"].to_numpy(float)[:4]      # 양끝 외삽계수 4개 (원본 M52:M55)

# ── 원시통계 두 시트 (외부 파일 없이 이 워크북 안에서 닫힌다)
INC = xl("발생자수!A1:D115", headers=True).astype("int64")   # 연도·성별·연령군·발생자수
POP = xl("추계인구!A1:F43", headers=True).astype({"성별": "int64", "연령군": "int64"})
MID = [2, 7, 12, 17, 22, 27, 32, 37, 42, 47, 52, 57, 62, 67, 72, 77, 82, 87, 90]  # 군단연령 — 원본 C9:C27
SX = ("남", "여")
'''

RR_GROUP = '''

def band(mid):
    """군단연령 → BMI 30 이상 비율을 붙일 구간. 원본 `2 산출과정` S9:U29 대응표를 옮긴 것."""
    return "~39" if mid <= 39 else "40~49" if mid <= 49 else "50~59" if mid <= 59 else "60~"


def group_table():
    """군단연령별 발생자수·추계인구·조율·적용률 — 원본 `2 산출과정` B9:M27."""
    inc = INC.pivot_table(index="연령군", columns="성별", values="발생자수", aggfunc="sum")
    pop = (POP.groupby(["연령군", "성별"])[["2020", "2021", "2022"]].sum()
              .sum(axis=1).unstack().round().astype("int64"))
    g = pd.DataFrame({"연령군": inc.index.to_numpy(), "군단연령": MID})
    for j, sx in enumerate(SX, start=1):
        g["발생자수_" + sx] = inc[j].to_numpy()                      # 3개년(2020~2022) 합
        g["추계인구_" + sx] = pop[j].to_numpy()
        g["조율_" + sx] = g["발생자수_" + sx] / g["추계인구_" + sx]   # H9: =D9/F9
        g["BMI30_" + sx] = [BMI[band(m)][j - 1] for m in MID]
        # L9: =H9*J9*(1+$M$6) — 비만 동반 비율을 곱하고 안전할증을 얹는다
        g["적용률_" + sx] = g["조율_" + sx] * g["BMI30_" + sx] * (1 + LOAD)
    return g
'''

RR_SMOOTH = '''

def greville(y):
    """직선보간값 → 그레빌 9항 평활. 양끝은 4개씩 외삽해 창을 채운다 — 원본 `2 산출과정` §2.2."""
    head = np.array([])
    for _ in range(4):                                   # D40: =SUMPRODUCT(D41:D44,$M$57:$M$60)
        head = np.r_[np.dot(np.r_[head, y][:4], EW[::-1]), head]
    tail = np.array([])
    for _ in range(4):                                   # D152: =SUMPRODUCT(D148:D151,$M$52:$M$55)
        tail = np.r_[tail, np.dot(np.r_[y, tail][-4:], EW)]
    ext = np.r_[head, y, tail]
    sm = np.array([np.dot(ext[j:j + 9], GW) for j in range(len(y))])
    return np.maximum(sm, 0.0)                           # F41: =IF(SUMPRODUCT(…)<0,0,SUMPRODUCT(…))


def by_age(g):
    """군단연령 적용률 → 연령별(0…TOP) 직선보간 + 그레빌 평활 — 원본 `2 산출과정` C41:G151."""
    ages = np.arange(TOP + 1)
    out = {"연령": ages}
    for sx in SX:
        # 군단연령 사이는 직선보간, 양끝(2세 미만·90세 초과)은 수평 — 원본 D41=D42, D132=D131
        lin = np.interp(ages, MID, g["적용률_" + sx].to_numpy(float))
        out["직선보간_" + sx] = lin
        out["최종_" + sx] = greville(lin)
    return pd.DataFrame(out)
'''

#: 5단계 검산 표에 실을 연령 (전체 111개는 4단계에서 이미 펼쳐진다)
RR_CHECK_AGES = [0, 5, 10, 20, 30, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 110]


def build_risk_rate():
    """부록 M.4 #5 — 원시통계(발생자수·추계인구) → 조율 → 비만동반·안전할증 → 보간·평활 → 원본 대조."""
    if not RISK_SRC.exists():
        print(f"!! 원본 영양조사 없음 — 위험률 산출 예제 건너뜀: {RISK_SRC}")
        return None
    src = read_src_cells(RISK_SRC, ["1_1.기초통계_발생자수", "1_3.기초통계_추계인구",
                                    "2 산출과정", "3. 산출결과"])
    s1, s3, s2, sr = (src["1_1.기초통계_발생자수"], src["1_3.기초통계_추계인구"],
                      src["2 산출과정"], src["3. 산출결과"])
    f = lambda a: float(s2[a])

    # ── 시트 1: 발생자수 (원본 B7:E120 — 3년 × 성별 2 × 연령군 19 = 114행)
    rows = [[cell(h, "s") for h in ("연도", "성별", "연령군", "발생자수")]]
    for r in range(7, 200):
        if s1.get(f"B{r}") is None:
            break
        rows.append([cell(int(s1[f"{c}{r}"]), "n") for c in "BCDE"])
    inc_sheet = sheet_from_rows("sh-rr-inc", "발생자수", rows, row_count=300, col_count=26)

    # ── 시트 2: 추계인구 (원본 1_3 D:F열 = 2020·2021·2022 중위추계)
    prows = [[cell(h, "s") for h in ("성별", "연령대", "연령군", "2020", "2021", "2022")]]
    for xl_rows, sex in POP_ROWS:
        for r, grp in zip(xl_rows, POP_GRP):
            prows.append([cell(sex, "n"), cell(str(s3[f"C{r}"]).strip(), "s"), cell(grp, "n")]
                         + [cell(int(s3[f"{c}{r}"]), "n") for c in "DEF"])
    pop_sheet = sheet_from_rows("sh-rr-pop", "추계인구", prows, row_count=80, col_count=12)

    # ── 시트 3: 가정 (안전할증·BMI 비율 + 그레빌 계수표)
    safety, bmi39, bmi60 = f("M6"), f("P10"), f("P13")
    assume = [
        ("안전할증", safety, "산출한 조율에 얹는 마진. 0.5 = 50% (2 산출과정!M6)"),
        ("최고연령", 110, "산출 결과의 마지막 나이 (3. 산출결과!C116)"),
        ("BMI30비율_남_39이하", bmi39, "주요대사질환 발생자 중 BMI 30 이상 비율 — 39세 이하 남 (1_2!S13)"),
        ("BMI30비율_여_39이하", f("Q10"), "39세 이하 여 (1_2!T13)"),
        ("BMI30비율_남_40대", f("P11"), "40~49세 남 (1_2!S14)"),
        ("BMI30비율_여_40대", f("Q11"), "40~49세 여 (1_2!T14)"),
        ("BMI30비율_남_50대", f("P12"), "50~59세 남 (1_2!S15)"),
        ("BMI30비율_여_50대", f("Q12"), "50~59세 여 (1_2!T15)"),
        ("BMI30비율_남_60이상", bmi60, "60세 이상 남 (1_2!S16)"),
        ("BMI30비율_여_60이상", f("Q13"), "60세 이상 여 (1_2!T16)"),
    ]
    arows = [[cell("항목", "s"), cell("값", "s"), cell("비고", "s")]]
    arows += [[cell(k, "s"), cell(v, "n"), cell(note, "s")] for k, v, note in assume]
    arows += [[None, None, None], [None, None, None]]
    arows.append([cell("r", "s"), cell("보정치", "s"), cell("외삽치", "s")])
    for r in range(52, 61):                                   # 원본 K51:M60
        arows.append([cell(int(s2[f"K{r}"]), "n"), cell(f(f"L{r}"), "n"), cell(f(f"M{r}"), "n")])
    assume_sheet = sheet_from_rows("sh-rr-assume", "가정", arows, row_count=60, col_count=10)

    # ── 원본 산출결과(검산 기준) — 빌드 시점에 읽어 코드에 박아 둔다
    ref_m = [float(sr[f"D{6 + a}"]) for a in range(111)]
    ref_f = [float(sr[f"E{6 + a}"]) for a in range(111)]
    ref_lit = f"REF_M = {ref_m!r}\nREF_F = {ref_f!r}\nSHOW = {RR_CHECK_AGES!r}\n"
    tot_m, tot_f = int(f("D28")), int(f("E28"))
    pop_m, pop_f = int(f("F28")), int(f("G28"))
    rtab = "\n".join(
        f"| {a} | {ref_m[a]:.6f} | {ref_f[a]:.6f} |" for a in (0, 10, 30, 50, 60, 70, 80, 90, 110))

    sid = "sh-rr-inc"
    core = RR_LOAD + RR_GROUP
    full = core + RR_SMOOTH

    steps_items = [
        (2,
         "1단계 — 원시통계 확인 (발생자수 · 추계인구)",
         "## 1단계 — 원시통계 확인 (발생자수 · 추계인구)\n\n"
         "위험률은 **분자(발생자수)** 와 **분모(모집단)** 를 맞춰 놓는 데서 시작합니다.\n\n"
         "| 시트 | 원본 | 내용 |\n|---|---|---|\n"
         "| `발생자수` | `1_1.기초통계_발생자수` B6:E120 | 청구 데이터에서 뽑은 **주요대사질환 최초발생자 수**. "
         "`STD_YYYY`(연도) × `SEX_TYPE`(1 = 남, 2 = 여) × `AGE_G`(5세 군단) × `CNT` — 3 × 2 × 19 = 114행 |\n"
         "| `추계인구` | `1_3.기초통계_추계인구` (통계청 장래인구추계, 중위) | 같은 3개년의 **5세별 추계인구** |\n\n"
         "원본은 피벗테이블로 3개년을 합쳤습니다 — `1_1!M9 = H9`, `1_3!K28 = D3+E3+F3`. "
         "여기서는 `pivot_table`·`groupby`로 같은 합을 냅니다.\n\n"
         "> 인구는 **`계`·`80세이상` 같은 집계행을 빼고** 5세 구간만 더해야 이중계상이 나지 않습니다. "
         "원본도 `80세이상`(1_3!C19)을 건너뛰고 `80~84`부터 다시 세었습니다. "
         "`90+`는 90~94·95~99·100세 이상을 한 군단으로 합칩니다(원본 `K46 = SUM(D22:F24)`).\n\n"
         "원본 합계 — 발생자수 남 **" + f"{tot_m:,}" + "** · 여 **" + f"{tot_f:,}" + "**, "
         "추계인구 남 **" + f"{pop_m:,}" + "** · 여 **" + f"{pop_f:,}" + "** "
         "(원본 `2 산출과정` D28:G28, 아래 코드가 같은 값을 다시 냅니다).",
         "원시통계 — 3개년 합계",
         core + '''
inc = INC.pivot_table(index="연령군", columns="성별", values="발생자수", aggfunc="sum")
pop = (POP.groupby(["연령군", "성별"])[["2020", "2021", "2022"]].sum()
          .sum(axis=1).unstack().round().astype("int64"))
tab = pd.DataFrame({"연령군": inc.index.to_numpy(), "군단연령": MID,
                    "발생자수_남": inc[1].to_numpy(), "발생자수_여": inc[2].to_numpy(),
                    "추계인구_남": pop[1].to_numpy(), "추계인구_여": pop[2].to_numpy()})
print(f"원시 {len(INC)}행 ({INC['연도'].min()}~{INC['연도'].max()}년) -> 군단 {len(tab)}개")
print(f"발생자수 합계  남 {tab['발생자수_남'].sum():>10,}   여 {tab['발생자수_여'].sum():>10,}")
print(f"추계인구 합계  남 {tab['추계인구_남'].sum():>10,}   여 {tab['추계인구_여'].sum():>10,}")
tab''',
         "values"),
        (27,
         "2단계 — 조율 = 발생자수 ÷ 추계인구",
         "## 2단계 — 조율 = 발생자수 ÷ 추계인구\n\n"
         "군단별로 나누기만 하면 **조율(crude rate)** 이 나옵니다 — 원본 `2 산출과정` H9 `=D9/F9`, I9 `=E9/G9`.\n\n"
         "```\n조율(성, 군단) = 3개년 발생자수 합 / 3개년 추계인구 합\n```\n\n"
         "분자·분모 모두 **3년치를 합쳐서** 나눕니다. 연도별로 나눈 뒤 평균 내는 것과 값이 다릅니다 "
         "(인구가 큰 해에 가중이 더 실립니다 — 원본이 택한 쪽은 합쳐서 나누기입니다).\n\n"
         "> 이 단계의 조율은 **모든 주요대사질환** 발생률입니다. 담보는 *비만을 동반한* 경우만 보장하므로 "
         "3단계에서 비만 동반 비율을 곱해 좁힙니다.",
         "군단연령별 조율",
         core + '''
g = group_table()
top = g.loc[g["조율_남"].idxmax()]
print(f"남 조율 최고 {top['조율_남']:.6f} (군단연령 {int(top['군단연령'])}세) · "
      f"여 최고 {g['조율_여'].max():.6f} (군단연령 {int(g.loc[g['조율_여'].idxmax(), '군단연령'])}세)")
g[["연령군", "군단연령", "발생자수_남", "추계인구_남", "조율_남",
   "발생자수_여", "추계인구_여", "조율_여"]]''',
         "values"),
        (52,
         "3단계 — 비만 동반 비율 × 안전할증",
         "## 3단계 — 비만 동반 비율 × 안전할증\n\n"
         "조율에 두 가지를 곱해 **적용률**을 만듭니다 — 원본 `2 산출과정` L9 `=H9*J9*(1+$M$6)`.\n\n"
         "| 곱하는 값 | 뜻 | 출처 |\n|---|---|---|\n"
         "| `BMI30 비율` | 주요대사질환 발생자 중 **BMI 30 이상** 비율 | 국민건강영양조사 — 원본 `1_2` S13:T16 |\n"
         "| `1 + 안전할증` | 통계 변동·자료 한계에 대한 마진 (" + f"{safety:.0%}" + ") | 원본 `2 산출과정` M6 |\n\n"
         "BMI 비율은 연령군마다 따로 있는 게 아니라 **`~39` · `40~49` · `50~59` · `60~` 네 구간**으로 묶여 있습니다 "
         "(원본 S9:U29 대응표). 표본이 얇은 구간을 그대로 쓰면 위험률이 톱니처럼 튀기 때문입니다.\n\n"
         "> `가정` 시트의 `안전할증`을 0으로 바꾸고 [전체 실행]하면 마진 없는 순수 통계율이 나옵니다 — "
         "5단계 검산의 차이가 그만큼 벌어지는 것으로 마진의 크기를 눈으로 볼 수 있습니다.",
         "군단연령별 적용률",
         core + '''
g = group_table()
print(f"안전할증 {LOAD:.0%} · BMI30 비율 구간 "
      + " · ".join(f"{k} 남 {v[0]:.1%}/여 {v[1]:.1%}" for k, v in BMI.items()))
g[["군단연령", "조율_남", "BMI30_남", "적용률_남", "조율_여", "BMI30_여", "적용률_여"]]''',
         "values"),
        (77,
         "4단계 — 연령별 직선보간 + 그레빌 9항 평활",
         "## 4단계 — 연령별 직선보간 + 그레빌 9항 평활\n\n"
         "적용률은 아직 **군단연령 19개**뿐입니다. 보험료는 한 살 단위로 매기므로 0~110세를 채워야 합니다.\n\n"
         "**① 직선보간** — 원본 `2 산출과정` D43:\n\n"
         "```\n=VLOOKUP($A43,$C$9:$M$27,L$30,0)\n"
         " + (VLOOKUP($B43,…) - VLOOKUP($A43,…)) * (($C43-$A43)/($B43-$A43))\n```\n\n"
         "아래·위 군단연령(`$A43`·`$B43`)을 찾아 그 사이를 직선으로 잇는 것이라 `np.interp`가 그대로 같은 일을 합니다. "
         "양끝(2세 미만·90세 초과)은 원본이 `D41 = D42`, `D132 = D131`처럼 **수평**으로 두었고 `np.interp`의 기본 동작도 같습니다.\n\n"
         "**② 그레빌 9항 평활** — 원본 `2 산출과정` F41:\n\n"
         "```\n=IF(SUMPRODUCT(D37:D45,$L$52:$L$60)<0, 0, SUMPRODUCT(D37:D45,$L$52:$L$60))\n```\n\n"
         "자기 자리 ±4세, 모두 9개 값에 대칭 가중치(`가정` 시트 `보정치`)를 곱해 더합니다. 직선보간이 남긴 "
         "**군단 경계의 꺾임**을 부드럽게 펴 주는 이동가중평균이고, 음수가 나오면 0으로 자릅니다.\n\n"
         "**③ 양끝 외삽** — 0세·110세 근처에서는 9칸 창이 표 밖으로 나갑니다. 원본은 위아래로 4칸씩 "
         "가짜 값을 만들어 채웠습니다 — `D40 = SUMPRODUCT(D41:D44,$M$57:$M$60)`(앞쪽), "
         "`D152 = SUMPRODUCT(D148:D151,$M$52:$M$55)`(뒤쪽). `가정` 시트의 `외삽치` 열이 그 계수입니다.",
         "연령별 적용률 (0~110세)",
         full + '''
a = by_age(group_table())
print(f"연령 0~{TOP} · {len(a)}행 — 직선보간 -> 그레빌 9항 평활 (가중치 합 {GW.sum():.6f})")
print(f"2계차분 최대 |d2| : 직선보간 {np.abs(np.diff(a['직선보간_남'], 2)).max():.3e}"
      f" -> 평활 후 {np.abs(np.diff(a['최종_남'], 2)).max():.3e}")
a.round(8)''',
         "values"),
        (195,
         "5단계 — 원본 `3. 산출결과`와 대조 검산",
         "## 5단계 — 원본 `3. 산출결과`와 대조 검산\n\n"
         "원본 산출과정표의 마지막 시트 `3. 산출결과`는 4단계 결과를 **소수 6자리로 반올림**한 표입니다 — "
         "`D6: =ROUND('2 산출과정'!F41,6)`.\n\n"
         "그 111개 값을 이 코드에 그대로 박아 두고, 위 단계에서 계산한 값과 **차이** 열로 맞춰 봅니다.\n\n"
         "원본 값 일부:\n\n"
         "| 연령 | 남자 | 여자 |\n|---|---|---|\n" + rtab + "\n\n"
         "> `가정` 시트를 고치면 차이가 벌어지는 것이 정상입니다 — 검산은 기본값(안전할증 "
         + f"{safety}" + ")으로 되돌린 뒤 보세요.",
         "원본 대조 검산 (차이 열)",
         full + "\n" + ref_lit + '''
a = by_age(group_table())
chk = pd.DataFrame({"연령": a["연령"], "원본_남": REF_M, "계산_남": a["최종_남"].round(6),
                    "원본_여": REF_F, "계산_여": a["최종_여"].round(6)})
chk["차이_남"] = (chk["계산_남"] - chk["원본_남"]).round(9)
chk["차이_여"] = (chk["계산_여"] - chk["원본_여"]).round(9)
print(f"111개 연령 최대 차이 — 남 {chk['차이_남'].abs().max():.1e} · 여 {chk['차이_여'].abs().max():.1e}")
print(f"완전 일치 {int(((chk['차이_남'] == 0) & (chk['차이_여'] == 0)).sum())} / {len(chk)}행")
chk[chk["연령"].isin(SHOW)][["연령", "원본_남", "계산_남", "차이_남",
                             "원본_여", "계산_여", "차이_여"]].reset_index(drop=True)''',
         "values"),
        (221,
         "6단계 — 연령별 곡선 (원시 조율 vs 최종 적용률)",
         "## 6단계 — 연령별 곡선 (원시 조율 vs 최종 적용률)\n\n"
         "왼쪽은 **군단연령별 조율**(원시 통계 그대로), 오른쪽은 **연령별 최종 적용률**입니다. "
         "점선이 직선보간, 실선이 그레빌 평활 뒤 값입니다.\n\n"
         "- 조율은 40~60대에서 정점을 찍고 고령에서 내려옵니다 — 고령일수록 **이미 진단받은 사람**이 많아 "
         "*최초* 발생자가 줄기 때문입니다(발생률이지 유병률이 아닙니다).\n"
         "- 최종 적용률의 모양이 조율과 다른 것은 **BMI 30 이상 비율**이 60세 이상에서 뚝 떨어지기 때문입니다 "
         "(남 " + f"{bmi60:.1%}" + " vs 39세 이하 " + f"{bmi39:.1%}" + ").\n"
         "- 직선보간의 꺾인 자리가 실선에서 어떻게 펴지는지 보세요 — 그게 그레빌 평활이 하는 일 전부입니다.",
         "조율 · 적용률 곡선",
         full + '''
import matplotlib.pyplot as plt
g = group_table()
a = by_age(g)
fig, ax = plt.subplots(1, 2, figsize=(10.5, 3.8))
for sx, c in zip(SX, ("#4A90C2", "#C2704A")):
    ax[0].plot(g["군단연령"], g["조율_" + sx] * 100, "o-", ms=3.5, color=c, label=sx)
    ax[1].plot(a["연령"], a["직선보간_" + sx] * 100, ls=":", lw=1, color=c)
    ax[1].plot(a["연령"], a["최종_" + sx] * 100, color=c, lw=1.6, label=sx)
ax[0].set_title("① 조율 — 주요대사질환 발생률 (%)")
ax[1].set_title(f"② 최종 적용률 (%) — 비만동반 × 안전할증 {LOAD:.0%}")
for x in ax:
    x.set_xlabel("연령"); x.grid(alpha=0.3); x.legend(fontsize=8)
fig.tight_layout()
fig''',
         "object"),
    ]

    blocks = steps(sid, 8, "rr",
                   ("위험률 산출 — 원시통계에서 적용률까지",
                    "# 위험률 산출 — 원시통계에서 적용률까지\n\n"
                    "실제 위험률 산출 방법서(비만 동반 주요대사질환)의 **원시통계를 그대로** 담았습니다. "
                    "**발생자수 ÷ 추계인구 → 조율 → 비만 동반·안전할증 → 연령별 보간·평활 → 원본 대조**가 "
                    "이 한 파일에서 닫힙니다.\n\n"
                    "**구성**\n\n"
                    "- `발생자수` 시트 — 2020~2022년 성·5세 군단별 주요대사질환 최초발생자 수 114행 "
                    "(원본 `1_1.기초통계_발생자수`)\n"
                    "- `추계인구` 시트 — 같은 3개년의 성·5세별 장래인구추계(중위) (원본 `1_3.기초통계_추계인구`)\n"
                    "- `가정` 시트 — 안전할증·BMI 30 이상 비율·그레빌 보정계수 "
                    "(원본 `2 산출과정` M6 · J:K열 · K51:M60)\n"
                    "- 오른쪽 I열부터 6단계의 [설명 + 코드] 블록\n\n"
                    "**읽는 법** — 설명을 읽고 코드 블록을 순서대로 실행하거나, 그냥 **[전체 실행]**을 누르세요. "
                    "각 블록은 `xl()`로 시트를 다시 읽어 단독 실행됩니다. 설명에는 원본 엑셀 수식을 그대로 인용해 두었으니 "
                    "코드와 나란히 대조해 보세요.\n\n"
                    "> 5단계의 **차이** 열이 모두 0이면 원본 산출과정표와 완전히 일치한다는 뜻입니다."),
                   steps_items)
    blocks.append(md_block(
        "blk-rr-wrap", sid, 227, 8,
        "## 정리 — 위험률 산출의 다섯 고비\n\n"
        "| 고비 | 실수하면 | 이 예제에서 |\n|---|---|---|\n"
        "| 분모 맞추기 | 집계행(`계`·`80세이상`)까지 더해 인구가 부풀고 위험률이 반토막 | `추계인구` 시트에 5세 구간만 실었습니다 |\n"
        "| 3개년 합산 | 연도별 비율의 단순평균과 값이 다름 | 분자·분모를 각각 합쳐서 나눕니다 |\n"
        "| 담보 좁히기 | 전체 발생률을 그대로 쓰면 담보보다 훨씬 넓음 | BMI 30 이상 비율을 곱합니다 |\n"
        "| 보간·평활 | 군단 경계에서 위험률이 꺾여 보험료가 나이 한 살에 튐 | 직선보간 + 그레빌 9항 |\n"
        "| 안전할증 | 통계 변동을 흡수할 마진이 없음 | `1 + 안전할증` |\n\n"
        "**바꿔 볼 값** (`가정` 시트)\n\n"
        "| 값 | 일어나는 일 |\n|---|---|\n"
        "| `안전할증` 0.5 → 0 | 마진 없는 순수 통계율. 적용률이 1/1.5로 줄고 5단계 차이가 그만큼 벌어집니다 |\n"
        "| `BMI30비율_*` | 담보 범위를 넓히거나 좁히는 효과. 구간별로 따로 움직일 수 있습니다 |\n"
        "| `최고연령` | 산출 결과 표의 길이. 90세 이상은 어차피 수평이라 값 자체는 그대로입니다 |\n"
        "| `보정치`(그레빌) | 평활 강도. 합이 1이 아니면 위험률 수준 자체가 어긋나니 주의하세요 |\n\n"
        "> **평활은 사실을 바꾸지 않습니다.** 그레빌 가중치의 합이 1(원본 계수 반올림으로 1.000001)이라 "
        "전체 수준은 그대로 두고 "
        "이웃 연령끼리 값을 나눠 가질 뿐입니다. 4단계 출력의 2계차분이 얼마나 줄었는지 보세요.",
        "정리 — 위험률 산출의 다섯 고비"))

    return workbook(
        "wb-sample-risk-rate",
        "위험률 산출 — 원시통계에서 적용률까지",
        [inc_sheet, pop_sheet, assume_sheet],
        blocks,
    )


# ── 부록 M.4 #8 — 무해지환급형 (치매보험 PV 산출) ─────────────────

NS_SRC = Path(
    r"C:\Users\tklee\OneDrive - 코리안리재보험\0. 보험료 산출 방법서"
    r"\00.(무)간병비주는치매보험(무해지환급형) PV산출.xlsm"
)

#: 워크북 `위험률` 시트 열 = (헤더, 원본 위험률 시트 남자 열). 여자는 바로 오른쪽 열.
NS_RISK_COLS = [
    ("경도치매(CDR1)", "C"), ("중등도치매(CDR2)", "E"), ("중증치매(CDR3)", "G"),
    ("CDR1이상", "I"), ("CDR2이상", "K"), ("CDR3이상", "M"),
    ("말기치매", "O"), ("중증치매사망", "Q"), ("사망률", "S"),
]

#: 6단계 원본 대조에 쓸 조합 (종형, 성별, 나이, 보기, 납기) — 모두 원본 `P테이블`에 있는 것
NS_CHECK = [
    (1, 1, 45, 45, 15), (2, 1, 45, 45, 15), (1, 2, 45, 45, 15), (2, 2, 45, 45, 15),
    (1, 1, 45, 45, 20), (2, 1, 45, 45, 20), (1, 1, 60, 30, 15), (2, 1, 60, 30, 15),
    (1, 2, 70, 20, 15), (2, 2, 70, 20, 15),
]

NS_LOAD = '''# ── 가정 시트 — 값을 바꾸고 [전체 실행]하면 이후 모든 단계가 다시 계산된다
_p = xl("가정!A1:C23", headers=True)
P = dict(zip(_p["항목"], _p["값"]))
jong = int(P["종형"])              # 1 = 무해지환급형(해지율 반영), 2 = 표준형(해지율 0)
sex  = int(P["성별"])              # 1 = 남자, 2 = 여자
x0   = int(P["가입나이"])
n    = int(P["보험기간"])          # 원본 `보기` = 만기나이 − 가입나이
m    = int(P["납입기간"])
freq = int(P["납입주기"])          # 12 = 월납 (원본 `납방`)
face = float(P["가입금액"])
i_a  = float(P["예정이율"])        # 급부 현가 할인율
i_p  = float(P["평균공시이율"])    # 연금 5년확정분 할인율
lapse   = float(P["해지율"])       # 무해지형 가정 해지율 — 원본 E31 =IF(종형=1,4%,0)
wait_yr = int(P["면책기간"])       # 첫 N년은 급부 없음 — 원본 E18·E19
sc_yr   = int(P["공제기간"])       # 해약공제 상각기간 = MIN(납기,7) — 원본 BT35
a1, a2 = float(P["α1"]), float(P["α2"])   # 계약체결비용 (α1 = 80/1000, α2 = 15%×MIN(보기,20))
b1, b2 = float(P["β1"]), float(P["β2"])   # 계약관리비용 (β1 = 6.8/1000, β2 = 9%)
b3, b5 = float(P["β3"]), float(P["β5"])   # 납입후유지비 β3, 기타비용 β5
PAY = [float(P["지급률_경도치매"]), float(P["지급률_중등도치매"]),
       float(P["지급률_중증치매"]), float(P["지급률_중증치매연금"])]   # 원본 O12:R12
ANN = xl("가정!A26:B36", headers=True)["지급률"].to_numpy(float)       # 연금 10년 지급률 — 원본 AK35:AT35

# ── 위험률 시트 (나이 0~100) — 나이를 인덱스로 (원본 `위험률` B7:T107)
R = xl("위험률!A1:S102", headers=True).fillna(0.0).astype({"나이": "int64"}).set_index("나이")
TOPAGE = int(R.index.max())
'''

NS_MODEL = '''

def cashflow(jong, sex, x0, n, m):
    """이중탈퇴(사망·해지) 현금흐름표 — 원본 `PV산출` 41~104행. 한 행이 경과 t년."""
    v, vp = 1 / (1 + i_a), 1 / (1 + i_p)
    w0 = lapse if jong == 1 else 0.0                    # E31: =IF(종형=1,4%,0)
    t = np.arange(n + 1)
    age = np.minimum(x0 + t, TOPAGE)
    g = lambda nm: R[nm + ("_남" if sex == 1 else "_여")].to_numpy(float)
    q, dA, dB, dC = (g(c)[age] for c in ("사망률", "CDR1이상", "CDR2이상", "CDR3이상"))
    qd = g("중증치매사망")
    w  = np.where(t < m, w0, 0.0)                       # Q41: =IF(D41<납기,해지율,0)
    ex = np.where(t < wait_yr, 0.0, 1.0)                # E19 면책제외기간 — 면책기간에는 급부가 없다

    def alive(dec):                                     # H42: =H41*(1-면책제외기간*N41)*(1-$Q41)
        s = np.ones(n + 1)
        for j in range(n):
            s[j + 1] = s[j] * (1 - ex[j] * dec[j]) * (1 - w[j])
        return s

    A = np.ones(n + 1)                                  # A42: =A41*(1-L41)*(1-Q41)  ← 사망 + 해지
    for j in range(n):
        A[j + 1] = A[j] * (1 - q[j]) * (1 - w[j])
    lA, lB, lC = alive(dA), alive(dB), alive(dC)        # 급부별 대상자(각 1회한) — 자기 발생률 + 해지로만 준다

    Bd = A * v ** t                                     # B41: =A41*현가^D41    (전탈퇴 D기수)
    Nd = np.cumsum(Bd[::-1])[::-1]                      # C41: =SUM(B41:$B$104) (전탈퇴 N기수)
    Dx = lC * v ** t                                    # R41: =F41*현가^$D41   (유지자 현가 = Dx 대체)
    Cq = A * q * (1 - w / 2) * v ** (t + 0.5)           # T41: =$A41*L41*(1-Q41/2)*현가^($D41+0.5)
    Ca = ex * lA * dA * (1 - w / 2) * v ** (t + 0.5)    # V41 경도치매↑
    Cb = ex * lB * dB * (1 - w / 2) * v ** (t + 0.5)    # W41 중등도치매↑
    Cc = ex * lC * dC * (1 - w / 2) * v ** (t + 0.5)    # X41 중증치매

    # 중증치매 연금 — 5년확정(공시이율) + 이후 5년 생존조건(예정이율). 원본 Y41·AK36:AT36·Z41:AT41
    ann = np.empty(n + 1)
    for j, a in enumerate(age):
        z = [1.0]
        for k in range(10):                             # AA41: =Z41*(1-VLOOKUP(나이+k,위험률,중증치매사망))
            z.append(z[-1] * (1 - (ex[j] if k == 0 else 1.0) * qd[min(a + k, TOPAGE)]))
        mid = [(z[k] + z[k + 1]) / 2 for k in range(10)]            # AK41: =Z41+(AA41-Z41)/2 (연중앙생존자)
        ann[j] = (sum(ANN[k] * vp ** k for k in range(5))           # 앞 5년은 확정 — 생존과 무관
                  + sum(ANN[k] * v ** k * mid[k] for k in range(5, 10)) / mid[0])
    Cd = Cc * ann        # Y41: =X41*(SUM(AK$36:AO$36)+SUMPRODUCT(AP$36:AT$36,AP41:AT41)/AK41)

    rc = lambda a: np.cumsum(a[::-1])[::-1]             # M·N기수는 아래에서 위로 누적
    return dict(t=t, age=x0 + t, q=q, w=w, dA=dA, dB=dB, dC=dC, ann=ann,
                A=A, lA=lA, lB=lB, lC=lC, Bd=Bd, Nd=Nd, Dx=Dx, Nx=rc(Dx),
                Cq=Cq, Mq=rc(Cq), Ca=Ca, Cb=Cb, Cc=Cc, Cd=Cd,
                Ma=rc(Ca), Mb=rc(Cb), Mc=rc(Cc), Md=rc(Cd))
'''

NS_PRICE = '''

def premium(k, n, m):
    """급부현가 → 순보험료 → 영업보험료 — 원본 `PV산출` I5:L17 · N5:S14."""
    Ms = [k[c] for c in ("Ma", "Mb", "Mc", "Md")]
    ben = sum(p * (M[0] - M[n]) for p, M in zip(PAY, Ms))     # S13 =SUM(O13:R13), O13 =지급률*(Mx−Mx+n)
    Dx, Nx = k["Dx"], k["Nx"]
    J8, J9, J10, J11 = Dx[0], Dx[m], Nx[0], Nx[m]             # D'x, D'x+m, N'x, N'x+m
    L7 = Nx[min(n, 20)]                                       # N'kx+min(보기,20)
    N = freq * ((J10 - J11) - (freq - 1) / (2 * freq) * (J8 - J9))         # L8  N* (월납 보정)
    net12 = ben / N                                                        # L9  순(12)p
    net1  = ben / (J10 - J11)                                              # L10 연납순p
    base  = ben / (J10 - L7)                                               # L11 기준연납순p
    beta1 = net1 + b3 * (Nx[m] - Nx[n]) / (J10 - J11)                      # L13 연납순βp
    gross = (net12 + (a1 + base * a2) * J8 / N + b1 / freq
             + b3 * (Nx[m] - Nx[n]) / N) / (1 - b2 - b5)                   # L14 영업(12)p
    alpha_a = round(1e5 * (a1 + round(base, 5) * a2) * J8, 2)              # L15 적용알파
    alpha_s = round(1e5 * (10 / 1000 + round(base, 5) * 0.05 * min(n, 20)) * J8, 2)   # L16 표준알파
    # J30 정기보험순p — 표준해약공제 한도(J31) 판정용. 여기만 전탈퇴 기수(사망 + 해지)를 쓴다
    Bd, Nd, Mq = k["Bd"], k["Nd"], k["Mq"]
    term = round((Mq[0] - Mq[n]) / (freq * (Nd[0] - Nd[m]
                 - (freq - 1) / (2 * freq) * (Bd[0] - Bd[m]))), 5) * 1e5
    S = min(np.floor(round(net12, 5) * 1e5 / term * 100) / 100, 1.0)       # J31 =MIN(ROUNDDOWN(J24/J30,2),1)
    return dict(ben=ben, N=N, net12=net12, net1=net1, base=base, beta1=beta1, gross=gross,
                alpha_a=alpha_a, alpha_s=alpha_s, term=term, S=S)
'''

NS_RESERVE = '''

def reserve(k, pr, n, m, jong):
    """연말 책임준비금 tV(10만당) · 해약환급금 tW · 환급률 — 원본 `PV산출` BD41:BT104."""
    Ms = [k[c] for c in ("Ma", "Mb", "Mc", "Md")]
    BI = sum(p * (M - M[n]) for p, M in zip(PAY, Ms))       # BE41: =지급률*(Mx+t − Mx+n)
    Nx, Dx, t = k["Nx"], k["Dx"], k["t"]
    BK = np.minimum(Nx, Nx[m]) - Nx[n]                      # BK41: =MIN(AU41, Nx+m) − Nx+n
    BL = np.maximum(Nx - Nx[m], 0.0)                        # BL41: =MAX(AV41 − N'x+m, 0)
    tV = np.round((BI + b3 * BK - pr["beta1"] * BL) / Dx, 5) * 1e5        # BM41 → BN41 (10만당)
    ded = np.maximum(0.0, min(pr["alpha_a"], pr["alpha_s"]) * (sc_yr - t) / sc_yr)   # BS41 해약공제
    # BT41: 무해지형은 납입기간 중 환급금 0, 표준형은 준비금 − 해약공제
    tW = np.where(t <= m, 0.0, tV) if jong == 1 else np.maximum(tV - ded, 0.0)
    paid = np.minimum(t, m) * freq * round(pr["gross"], 5) * 1e5          # 납입보험료 누계(10만당)
    return tV, ded, tW, paid, np.divide(tW, paid, out=np.zeros_like(tW), where=paid > 0)
'''


def build_nonsurrender():
    """부록 M.4 #8 — CDR 발생률 → 이중탈퇴 생존자 → 현금흐름 PV → 보험료 → 환급률 → 원본 대조."""
    if not NS_SRC.exists():
        print(f"!! 원본 PV산출 파일 없음 — 무해지환급형 예제 건너뜀: {NS_SRC}")
        return None
    src = read_src_cells(NS_SRC, ["위험률", "PV산출", "P테이블"])
    rk, pv, pt = src["위험률"], src["PV산출"], src["P테이블"]

    # ── 시트 1: 위험률 (원본 B7:T107 — 나이 0~100)
    heads = ["나이"] + [f"{h}_{s}" for h, _ in NS_RISK_COLS for s in ("남", "여")]
    rows = [[cell(h, "s") for h in heads]]
    for age in range(101):
        r = 7 + age
        row = [cell(age, "n")]
        for _, cl in NS_RISK_COLS:
            for off in (0, 1):
                addr = f"{chr(ord(cl) + off)}{r}"
                row.append(cell(round(float(rk.get(addr) or 0.0), 10), "n"))
        rows.append(row)
    risk_sheet = sheet_from_rows("sh-ns-risk", "위험률", rows, row_count=300, col_count=40)

    # ── 시트 2: 가정 (원본 `PV산출` 1·2번 블록 + 급부 지급률)
    fv = lambda a: float(pv[a])
    assume = [
        ("종형", 1, "1 = 무해지환급형(해지율 4% 반영), 2 = 표준형(해지율 0) (PV산출!E7)"),
        ("성별", 1, "1 = 남자, 2 = 여자 (PV산출!E9)"),
        ("가입나이", 45, "세 (PV산출!E10)"),
        ("보험기간", 45, "원본 `보기` = 만기나이 90 − 가입나이 (PV산출!C11)"),
        ("납입기간", 15, "년 (PV산출!E12)"),
        ("납입주기", 12, "연 납입 횟수. 12 = 월납 (PV산출!C13)"),
        ("가입금액", 100000, "원 — 10만원 기준이라 '10만당'과 같은 값이 된다 (PV산출!E8)"),
        ("예정이율", fv("E14"), "급부 현가 할인율 (PV산출!E14)"),
        ("평균공시이율", fv("E15"), "연금 5년확정분 할인율 (PV산출!E15)"),
        ("해지율", fv("E31"), "무해지형 가정 해지율. 납입기간 중에만 적용 (PV산출!E31)"),
        ("면책기간", int(fv("E18")), "년. 이 기간에는 급부가 없다 (PV산출!E18)"),
        ("지급률_경도치매", fv("O12"), "경도치매(CDR1↑) 진단 시 가입금액 대비 지급 배수 (PV산출!O12)"),
        ("지급률_중등도치매", fv("P12"), "중등도치매(CDR2↑) (PV산출!P12)"),
        ("지급률_중증치매", fv("Q12"), "중증치매(CDR3↑) 일시금 (PV산출!Q12)"),
        ("지급률_중증치매연금", fv("R12"), "중증치매 간병연금 — 배수는 아래 연차별 지급률표 (PV산출!R12)"),
        ("α1", fv("F24"), "계약체결비용 정률 = 80/1000 (PV산출!F24)"),
        ("α2", fv("F25"), "계약체결비용 배수 = 15% × MIN(보기, 20) (PV산출!F25)"),
        ("β1", fv("F26"), "계약관리비용 정액 = 6.8/1000 (PV산출!F26)"),
        ("β2", fv("F27"), "계약관리비용 정률 (PV산출!F27)"),
        ("β3", fv("F28"), "납입후유지비 (PV산출!F28)"),
        ("β5", fv("F29"), "기타비용 (PV산출!F29)"),
        ("공제기간", int(fv("BT35")), "해약공제 상각기간 = MIN(납입기간, 7) (PV산출!BT35)"),
    ]
    arows = [[cell("항목", "s"), cell("값", "s"), cell("비고", "s")]]
    arows += [[cell(k, "s"), cell(v, "n"), cell(note, "s")] for k, v, note in assume]
    arows += [[None, None, None], [None, None, None]]
    arows.append([cell("연차", "s"), cell("지급률", "s"), cell("비고", "s")])
    for j in range(10):                                   # 원본 AK35:AT35
        col = ["AK", "AL", "AM", "AN", "AO", "AP", "AQ", "AR", "AS", "AT"][j]
        note = "5년확정 (평균공시이율로 할인)" if j < 5 else "생존 시 지급 (예정이율로 할인)"
        arows.append([cell(j, "n"), cell(fv(f"{col}35"), "n"), cell(note, "s")])
    assume_sheet = sheet_from_rows("sh-ns-assume", "가정", arows, row_count=60, col_count=10)

    # ── 원본 P테이블 (검산 기준) — (종형, 성별, 나이, 보기, 납기) → (순p, 영업p, 정기순p, 적용α, 표준α)
    idx = {}
    for r in range(4, 212):
        if pt.get(f"B{r}") is None:
            continue
        idx[tuple(int(pt[f"{c}{r}"]) for c in "BFGDE")] = (
            round(float(pt[f"I{r}"])), round(float(pt[f"J{r}"])), round(float(pt[f"K{r}"])),
            float(pt[f"L{r}"]), float(pt[f"M{r}"]))
    ref_rows = [k + idx[k] for k in NS_CHECK]
    ref_lit = "REF = [\n" + "".join(f"    {row!r},\n" for row in ref_rows) + "]\n"
    d1, d2 = idx[(1, 1, 45, 45, 15)], idx[(2, 1, 45, 45, 15)]
    ptab = "\n".join(
        f"| {'무해지' if j == 1 else '표준'} | {'남' if s == 1 else '여'} | {x} | {nn} | {mm} "
        f"| {v[0]:,} | {v[1]:,} | {v[3]:,.0f} |"
        for (j, s, x, nn, mm), v in ((k, idx[k]) for k in NS_CHECK))

    sid = "sh-ns-risk"
    core = NS_LOAD + NS_MODEL
    full = core + NS_PRICE + NS_RESERVE

    steps_items = [
        (2,
         "1단계 — 치매 CDR 발생률 확인",
         "## 1단계 — 치매 CDR 발생률 확인\n\n"
         "치매는 **CDR(Clinical Dementia Rating)** 로 중증도를 나눕니다. 이 상품은 단계마다 다른 급부를 줍니다.\n\n"
         "| 단계 | 위험률 열 | 급부 | 지급률 |\n|---|---|---|---|\n"
         "| 경도치매 CDR 1 이상 | `CDR1이상` (원본 `위험률` I·J) | 진단 일시금 | " + f"{fv('O12')}" + " |\n"
         "| 중등도치매 CDR 2 이상 | `CDR2이상` (원본 K·L) | 진단 일시금 | " + f"{fv('P12')}" + " |\n"
         "| 중증치매 CDR 3 이상 | `CDR3이상` (원본 M·N) | 진단 일시금 | " + f"{fv('Q12')}" + " |\n"
         "| 〃 | 〃 | **간병연금 10년** | " + f"{fv('R12')}" + " × 연차별 배수 |\n\n"
         "원본은 `VLOOKUP($E41, 위험률, CHOOSE(성별, N$37, N$37+1), FALSE)`로 성별 열을 골랐습니다 "
         "(`N37 = 위험률!$I$3 = 8`번째 열 = `CDR1~` 남자, 성별이 2면 +1 = 여자). "
         "여기서는 `R[\"CDR1이상_남\"]`처럼 **열 이름**으로 직접 집습니다.\n\n"
         "> `CDR1이상`은 **누적 발생률**입니다 — CDR 1 이상(경도·중등도·중증 전부)에 처음 해당하게 될 확률. "
         "단계별 발생률(`경도치매(CDR1)` 등)과 헷갈리지 마세요. 보험료 계산에 쓰는 쪽은 누적입니다.\n\n"
         "중증치매 진단 뒤 연금을 받는 동안의 생존은 `중증치매사망` 열(원본 Q·R)로 따로 봅니다 — "
         "일반 `사망률`보다 훨씬 높습니다.",
         "가입나이~만기 구간 발생률",
         core + '''
sx = "남" if sex == 1 else "여"
cols = ["경도치매(CDR1)", "중등도치매(CDR2)", "중증치매(CDR3)",
        "CDR1이상", "CDR2이상", "CDR3이상", "중증치매사망", "사망률"]
tab = pd.DataFrame({"나이": R.index.to_numpy()})
for c in cols:
    tab[c] = R[c + "_" + sx].to_numpy()
tab = tab[tab["나이"].between(x0, min(x0 + n, TOPAGE))].reset_index(drop=True)
print(f"{sx}자 {x0}세 가입 · {n}년(만기 {x0 + n}세) · {len(tab)}개 나이")
print(f"CDR3이상 발생률 — {x0}세 {tab['CDR3이상'].iloc[0]:.6f} → "
      f"{x0 + n}세 {tab['CDR3이상'].iloc[-1]:.6f} ({tab['CDR3이상'].iloc[-1] / max(tab['CDR3이상'].iloc[0], 1e-12):.0f}배)")
tab''',
         "values"),
        (54,
         "2단계 — 해지율 4% 이중탈퇴 생존자표",
         "## 2단계 — 해지율 4% 이중탈퇴 생존자표\n\n"
         "무해지환급형의 핵심은 **해지율을 보험료에 미리 반영**한다는 점입니다. 생존자표가 사망 하나가 아니라 "
         "**사망 + 해지 두 갈래**로 줄어듭니다 — 원본 `PV산출` A·F~J열.\n\n"
         "```\n"
         "A42 = A41*(1-L41)*(1-Q41)              ← 전탈퇴 생존자 (사망 + 해지)\n"
         "H42 = H41*(1-면책제외기간*N41)*(1-Q41)  ← 경도치매 급부대상자 (자기 발생률 + 해지)\n"
         "Q41 = IF(D41<납기, 해지율, 0)           ← 해지는 납입기간 중에만\n"
         "```\n\n"
         "**급부별로 생존자표가 따로**인 것에 주의하세요. 각 급부가 *1회한*이라 한 번 받으면 그 담보에서 빠지고, "
         "다른 담보에는 남아 있습니다. 그래서 `H`(경도) · `I`(중등도) · `J`(중증) 세 줄이 각각 자기 발생률로만 줄어듭니다.\n\n"
         "**해지율은 납입기간(기본 설계 15년) 안에서만** 잡힙니다 — 다 낸 뒤에는 해지할 이유가 별로 없다는 가정입니다. "
         "`가정` 시트의 `종형`을 2(표준형)로 바꾸면 해지율이 0이 되어 이 표가 통째로 달라집니다.\n\n"
         "> 면책기간 " + f"{int(fv('E18'))}" + "년 동안은 급부가 없으므로 급부대상자도 줄지 않습니다 "
         "(원본은 `면책제외기간 = 1 − 면책기간`을 0/1 스위치로 씁니다).",
         "이중탈퇴 생존자표",
         core + '''
k = cashflow(jong, sex, x0, n, m)
tab = pd.DataFrame({"경과년": k["t"], "나이": k["age"],
                    "사망률": k["q"].round(6), "해지율": k["w"].round(4),
                    "전탈퇴생존자": k["A"].round(6),
                    "경도치매 대상자": k["lA"].round(6),
                    "중등도 대상자": k["lB"].round(6),
                    "중증치매 대상자": k["lC"].round(6)})
print(f"종형 {jong} ({'무해지 — 해지율 ' + format(lapse, '.0%') if jong == 1 else '표준 — 해지율 0'})"
      f" · 납입 {m}년 · 보험기간 {n}년")
print(f"납입 종료({m}년) 시점 전탈퇴생존자 {k['A'][m]:.4f} · 만기({n}년) {k['A'][n]:.4f}")
tab''',
         "values"),
        (106,
         "3단계 — 현금흐름 PV (Dx·Cx·Nx·Mx 대체)",
         "## 3단계 — 현금흐름 PV (Dx·Cx·Nx·Mx 대체)\n\n"
         "생존자표에 할인율을 곱하면 **계산기수와 같은 역할**을 하는 현가 열이 나옵니다. "
         "전통적 기수표(`Dx = lx·v^x`)와 이름만 다를 뿐 하는 일은 같습니다.\n\n"
         "| 이 예제 | 전통 기수 | 원본 수식 |\n|---|---|---|\n"
         "| `Dx` 유지자 현가 | Dx | `R41: =F41*현가^$D41` |\n"
         "| `Nx` 누적 | Nx | `AU41: =SUM(R41:$R$104)` |\n"
         "| `Cx_*` 급부 현가 | Cx | `V41: =면책제외기간*H41*N41*(1-$Q41/2)*현가^($D41+1/2)` |\n"
         "| `Mx_*` 누적 | Mx | `AY41: =SUM(V41:$V$104)` |\n\n"
         "두 가지가 전통 기수와 다릅니다.\n\n"
         "1. **`(1 − 해지율/2)`** — 발생이 연중 고르게 일어난다고 보면 그 해에 해지한 사람은 평균 절반만 노출됩니다.\n"
         "2. **`현가^(t + 1/2)`** — 급부는 연중앙에 지급된다고 봅니다(사망 `T41`도 같은 `+0.5`).\n\n"
         "**중증치매 간병연금**(`Cx_연금`)만 한 겹 더 있습니다 — 진단 시점에 연금 10년치의 현가를 한꺼번에 세웁니다:\n\n"
         "```\nY41 = X41 * ( SUM(AK$36:AO$36)                        ← 앞 5년: 확정, 생존 무관\n"
         "            + SUMPRODUCT(AP$36:AT$36, AP41:AT41)/AK41 )   ← 뒤 5년: 진단 후 생존 확률로 가중\n```\n\n"
         "뒤 5년의 생존은 `중증치매사망` 위험률로 만든 **진단 후 연중앙생존자**(원본 Z41:AT41)로 나눕니다. "
         "치매 진단 후 사망률이 높아 연금의 뒤쪽 5년은 실제로는 절반 남짓만 지급됩니다.",
         "현금흐름 현가표",
         core + '''
k = cashflow(jong, sex, x0, n, m)
tab = pd.DataFrame({"경과년": k["t"], "나이": k["age"],
                    "Dx(유지자현가)": k["Dx"].round(6), "Nx(누적)": k["Nx"].round(6),
                    "Cx_경도": k["Ca"].round(8), "Cx_중등도": k["Cb"].round(8),
                    "Cx_중증": k["Cc"].round(8), "Cx_연금": k["Cd"].round(8),
                    "Mx_경도": k["Ma"].round(6), "Mx_중등도": k["Mb"].round(6),
                    "Mx_중증": k["Mc"].round(6), "Mx_연금": k["Md"].round(6),
                    "연금현가배수": k["ann"].round(4)})
print(f"Nx = {k['Nx'][0]:.6f} · Nx+m = {k['Nx'][m]:.6f} · Nx+n = {k['Nx'][n]:.6f}")
print("Mx (급부현가 누계) — 경도 {:.6f} · 중등도 {:.6f} · 중증 {:.6f} · 연금 {:.6f}".format(
      k["Ma"][0], k["Mb"][0], k["Mc"][0], k["Md"][0]))
tab''',
         "values"),
        (158,
         "4단계 — 순보험료 · 영업보험료(12)",
         "## 4단계 — 순보험료 · 영업보험료(12)\n\n"
         "급부 현가를 납입 기수로 나누면 순보험료, 사업비를 얹으면 영업보험료입니다 — 원본 `PV산출` I5:L17.\n\n"
         "```\n"
         "S13  급부현가 = Σ 지급률 × (Mx − Mx+n)                                    ← O13:R13\n"
         "L8   N*       = 납방·((N'x − N'x+m) − (납방−1)/(2·납방)·(D'x − D'x+m))     ← 월납 보정\n"
         "L9   순(12)p  = S13 / N*\n"
         "L11  기준연납순p = S13 / (N'x − N'kx+min(보기,20))                          ← 신계약비 산출 기준\n"
         "L14  영업(12)p = ( 순(12)p + (α1 + 기준연납순p·α2)·D'x/N* + β1/납방 ) / (1 − β2 − β5)\n"
         "L15  적용알파  = ROUND(100000·(α1 + ROUND(기준연납순p,5)·α2)·D'x, 2)\n"
         "```\n\n"
         "**반올림 위치가 결과를 바꿉니다.** 원본은 `기준연납순p`를 소수 5자리로 반올림한 뒤 α를 계산합니다 "
         "(`ROUND(L11,5)`). 이 자리를 빼먹으면 10만당 값이 몇 원씩 어긋납니다.\n\n"
         "**사업비 구조** (원본 `PV산출` D21:F31)\n\n"
         "| 구분 | 기호 | 값 | 뜻 |\n|---|---|---|---|\n"
         "| 계약체결 | α1 | " + f"{fv('F24')}" + " | 80/1000 |\n"
         "| 〃 | α2 | " + f"{fv('F25')}" + " | 15% × MIN(보기, 20) — 기준연납순p에 곱한다 |\n"
         "| 계약관리 | β1 | " + f"{fv('F26')}" + " | 6.8/1000, 납입 1회당 `β1/납방` |\n"
         "| 〃 | β2 | " + f"{fv('F27')}" + " | 영업보험료 정률 — 분모로 들어간다 |\n"
         "| 기타 | β5 | " + f"{fv('F29')}" + " | 〃 |\n\n"
         "> **`정기보험순p`(J30)** 는 보험료가 아니라 **표준해약공제 한도 판정용**입니다. 여기만 급부별 유지자가 아닌 "
         "**전탈퇴 기수**(사망 + 해지)를 씁니다 — 원본 B·C열. `표준해약(S) = MIN(ROUNDDOWN(순p/정기순p, 2), 1)`.",
         "보험료 구성 (10만당)",
         full + '''
k = cashflow(jong, sex, x0, n, m)
pr = premium(k, n, m)
r5 = lambda x: float(round(round(x, 5) * 1e5))
tab = pd.DataFrame([
    ("급부현가 SUM", round(pr["ben"], 6), "S13 =SUM(O13:R13)"),
    ("N* (월납 납입기수)", round(pr["N"], 6), "L8 =납방*((J10-J11)-(납방-1)/(2*납방)*(J8-J9))"),
    ("순(12)p", r5(pr["net12"]), "L9 =J7/L8"),
    ("연납순p", r5(pr["net1"]), "L10 =J7/(J10-J11)"),
    ("기준연납순p", r5(pr["base"]), "L11 =J7/(J10-L7)"),
    ("영업(12)p", r5(pr["gross"]), "L14 =(L9+(α1+L11*α2)*J8/L8+β1/납방)/(1-β2-β5)"),
    ("적용알파", pr["alpha_a"], "L15 =ROUND(100000*(α1+ROUND(L11,5)*α2)*J8,2)"),
    ("표준알파", pr["alpha_s"], "L16 =ROUND(100000*(10/1000+ROUND(L11,5)*5%*MIN(보기,20))*J8,2)"),
    ("정기보험순p", float(round(pr["term"])), "J30 (표준해약 한도 판정용)"),
    ("표준해약(S)", pr["S"], "J31 =MIN(ROUNDDOWN(J24/J30,2),1)"),
    ("사업비율", round((pr["gross"] - pr["net12"]) / pr["gross"], 6), "O30/O31"),
    ("총납입보험료", r5(pr["gross"]) * freq * m, "L17 =납방*납기*ROUND(L14,5)"),
], columns=["항목", "값", "원본 엑셀 수식"])
print(f"{'무해지형' if jong == 1 else '표준형'} · {'남' if sex == 1 else '여'}{x0}세 · "
      f"{x0 + n}세만기 · {m}년납 월납 — 영업(12)p {r5(pr['gross']):,.0f}원 / 10만당")
tab''',
         "values"),
        (176,
         "5단계 — 무해지 vs 표준형 (환급률 곡선)",
         "## 5단계 — 무해지 vs 표준형 (환급률 곡선)\n\n"
         "같은 급부·같은 사업비로 **해지율만 바꿔** 두 번 계산합니다 — `종형` 1(해지율 " + f"{fv('E31'):.0%}" + ") vs 2(0).\n\n"
         "두 가지가 동시에 움직입니다.\n\n"
         "1. **보험료가 내려갑니다.** 해지자가 급부를 받지 않고 빠져나가므로 급부 현가(`Mx`)가 줄고, "
         "그만큼 순보험료가 싸집니다. 이것이 무해지환급형이 싼 이유의 전부입니다.\n"
         "2. **납입기간 중 환급금이 0입니다** — 원본 `BT41`:\n\n"
         "```\n=IF(종형=1, IF(BD41<=납기, 0, BO41), IFERROR(MAX(0, BO41 - BS41), \"\"))\n```\n\n"
         "표준형은 준비금에서 **해약공제**(미상각 신계약비)를 뺀 값을 돌려줍니다 — "
         "`BS41 = MAX(0, MIN(적용α, 표준α)·(공제기간 − t)/공제기간)`, 공제기간 " + f"{int(fv('BT35'))}" + "년.\n\n"
         "> 왼쪽 그래프의 세로 점선이 **납입 종료 시점**입니다. 무해지형은 그 전까지 환급률이 바닥에 붙어 있다가 "
         "납입이 끝나는 순간 준비금 전액으로 튀어오릅니다 — 이 절벽이 무해지환급형의 위험이자 설계 그 자체입니다.\n"
         "> 오른쪽은 책임준비금 자체의 비교입니다. 준비금은 두 종형 모두 쌓이지만, 무해지형은 그중 일부를 "
         "**해지자가 남기고 간 몫**으로 보아 잔존 계약자의 보험료를 깎는 데 씁니다.",
         "환급률 · 준비금 비교",
         full + '''
import matplotlib.pyplot as plt
res = {}
for jg in (1, 2):
    k = cashflow(jg, sex, x0, n, m)
    pr = premium(k, n, m)
    res[jg] = (pr,) + reserve(k, pr, n, m, jg)
t = np.arange(n + 1)
fig, ax = plt.subplots(1, 2, figsize=(10.5, 3.8))
for jg, c, nm in ((1, "#4A90C2", "무해지형"), (2, "#C2704A", "표준형")):
    pr, tV, ded, tW, paid, rt = res[jg]
    g10 = round(round(pr["gross"], 5) * 1e5)
    ax[0].plot(t, rt * 100, color=c, lw=1.6, label=f"{nm} · 영업p {g10:,}원")
    ax[1].plot(t, tV, color=c, lw=1.6, label=nm)
ax[0].axhline(100, color="#999", lw=1, ls="--")
ax[0].axvline(m, color="#666", lw=1, ls=":")
ax[0].set_title("경과년별 해약환급률 (%)")
ax[1].set_title("책임준비금 tV (10만당)")
for x in ax:
    x.set_xlabel("경과년"); x.grid(alpha=0.3); x.legend(fontsize=8)
cut = res[1][0], res[2][0]
print("영업(12)p 10만당 — 무해지 {:,}원 vs 표준 {:,}원 ({:+.1%})".format(
      round(round(cut[0]["gross"], 5) * 1e5), round(round(cut[1]["gross"], 5) * 1e5),
      cut[0]["gross"] / cut[1]["gross"] - 1))
fig.tight_layout()
fig''',
         "object"),
        (182,
         "6단계 — 원본 `P테이블`과 대조 검산",
         "## 6단계 — 원본 `P테이블`과 대조 검산\n\n"
         "원본 파일의 `P테이블` 시트는 종형·성별·나이·보기·납기 조합 208개의 확정 요율표입니다. "
         "그중 10개 조합을 골라 이 코드가 **처음부터 다시 계산**해 맞춰 봅니다.\n\n"
         "| 종형 | 성별 | 나이 | 보기 | 납기 | 순p(12) | 영업p(12) | 적용알파 |\n|---|---|---|---|---|---|---|---|\n"
         + ptab + "\n\n"
         "무해지형(1종)과 표준형(2종)의 차이를 보세요 — 같은 나이·같은 급부인데 순보험료가 "
         + f"{d1[0] / d2[0] - 1:+.1%}" + " 다릅니다. 해지율 " + f"{fv('E31'):.0%}" + " 하나가 만든 차이입니다.\n\n"
         "> 이 표의 값은 `가정` 시트와 무관하게 **조합마다 따로** 계산합니다. `가정` 시트를 고쳐도 "
         "6단계 검산 결과는 달라지지 않습니다(1~5단계만 움직입니다).",
         "P테이블 대조 (차이 열)",
         full + "\n" + ref_lit + '''
rows = []
for jg, sx_, x, nn, mm, e_net, e_gross, e_term, e_aa, e_as in REF:
    k = cashflow(jg, sx_, x, nn, mm)
    p = premium(k, nn, mm)
    rows.append({"종형": "무해지" if jg == 1 else "표준", "성별": "남" if sx_ == 1 else "여",
                 "나이": x, "보기": nn, "납기": mm,
                 "원본_순p": e_net, "계산_순p": round(round(p["net12"], 5) * 1e5),
                 "원본_영업p": e_gross, "계산_영업p": round(round(p["gross"], 5) * 1e5),
                 "원본_정기순p": e_term, "계산_정기순p": round(p["term"]),
                 "원본_알파": e_aa, "계산_알파": p["alpha_a"]})
chk = pd.DataFrame(rows)
for c in ("순p", "영업p", "정기순p", "알파"):
    chk["차이_" + c] = (chk["계산_" + c] - chk["원본_" + c]).round(2)
print("10개 조합 최대 차이 — " + " · ".join(
    f"{c} {chk['차이_' + c].abs().max():g}" for c in ("순p", "영업p", "정기순p", "알파")))
chk[["종형", "성별", "나이", "보기", "납기",
     "원본_순p", "계산_순p", "차이_순p",
     "원본_영업p", "계산_영업p", "차이_영업p",
     "원본_정기순p", "계산_정기순p", "차이_정기순p",
     "원본_알파", "계산_알파", "차이_알파"]]''',
         "values"),
    ]

    blocks = steps(sid, 21, "ns",
                   ("무해지환급형 — 해지율 반영 PV 산출",
                    "# 무해지환급형 — 해지율 반영 PV 산출\n\n"
                    "실제 PV 산출표((무)간병비 주는 치매보험)의 위험률과 사업비를 그대로 담았습니다. "
                    "**CDR 발생률 → 이중탈퇴 생존자 → 현금흐름 현가 → 보험료 → 환급률 → 원본 대조**가 "
                    "이 한 파일에서 닫힙니다.\n\n"
                    "**구성**\n\n"
                    "- `위험률` 시트 — 나이 0~100세의 치매 CDR 단계별·누적 발생률, 말기치매, "
                    "중증치매 사망률, 예정 경험사망률 (원본 `위험률` B7:T107)\n"
                    "- `가정` 시트 — 종형·성별·가입나이·보험기간·납입기간, 예정이율·평균공시이율, 해지율, "
                    "급부 지급률, 사업비 α1·α2·β1·β2·β3·β5 (원본 `PV산출` 1·2번 블록)\n"
                    "- 오른쪽 V열부터 6단계의 [설명 + 코드] 블록\n\n"
                    "**읽는 법** — 설명을 읽고 코드 블록을 순서대로 실행하거나, 그냥 **[전체 실행]**을 누르세요. "
                    "각 블록은 `xl()`로 시트를 다시 읽어 단독 실행됩니다. 설명에는 원본 엑셀 수식을 그대로 인용해 두었으니 "
                    "코드와 나란히 대조해 보세요.\n\n"
                    "> **무해지환급형**은 납입기간 중 해약환급금을 주지 않는 대신 보험료를 깎은 상품입니다. "
                    "그 깎는 폭이 어디서 나오는지 — 해지율 가정이 급부 현가를 어떻게 줄이는지 — 를 "
                    "숫자로 따라가는 것이 이 예제의 목적입니다.\n\n"
                    "> 현재 설계: **남자 45세 · 90세만기 · 15년납 월납 · 가입금액 10만원(= 10만당)** · 무해지형"),
                   steps_items)
    blocks.append(md_block(
        "blk-ns-wrap", sid, 198, 21,
        "## 정리 — 무해지환급형에서 무엇이 어디에 걸리나\n\n"
        "| 바꾸는 값 | 일어나는 일 |\n|---|---|\n"
        "| `종형` 1 → 2 | 해지율이 0이 되어 **모든 단계**가 다시 계산됩니다. 보험료가 오르고 납입 중 환급금이 생깁니다 |\n"
        "| `해지율` | 무해지형의 할인 폭 그 자체. 올릴수록 보험료가 싸지지만 **가정이 빗나가면 손실**입니다 |\n"
        "| `가입나이`·`보험기간` | 원본 `P테이블`은 `나이 + 보기 = 90`(90세 만기) 조합만 담고 있습니다 |\n"
        "| `납입기간` | N\\*와 해약공제 상각기간 `MIN(납기, 7)`이 함께 움직입니다 |\n"
        "| `예정이율` | 올리면 급부 현가가 줄어 보험료가 내려갑니다 |\n"
        "| `면책기간` | 첫 해 급부를 없애는 스위치. 0으로 두면 1년차부터 급부가 잡혀 보험료가 오릅니다 |\n"
        "| `지급률_*` | 급부 배수. 중증치매 연금(" + f"{fv('R12')}" + ")이 급부 현가의 가장 큰 몫입니다 |\n\n"
        "**해지율 가정의 두 얼굴** — 해지율은 무해지형 보험료를 깎아 주는 동시에 회사의 위험이 됩니다.\n\n"
        "- 실제 해지가 가정보다 **적으면**: 급부를 받아 갈 사람이 예상보다 많아 손실\n"
        "- 실제 해지가 가정보다 **많으면**: 납입 중 해지자는 환급금 0이라 이익이지만, 민원·판매 규제 위험\n\n"
        "그래서 감독당국은 무해지형에 해지율 가정의 **합리성 검증**과 표준형 대비 환급률 안내를 요구합니다. "
        "5단계 왼쪽 그래프의 절벽이 그 규제가 겨냥하는 지점입니다.\n\n"
        "**6단계의 차이 열이 모두 0이면** 원본 `P테이블` 208행을 만든 계산과 완전히 같은 모델이라는 뜻입니다.",
        "정리 — 무해지환급형에서 무엇이 어디에 걸리나"))

    return workbook(
        "wb-sample-nonsurrender",
        "무해지환급형 — 해지율 반영 PV 산출",
        [risk_sheet, assume_sheet],
        blocks,
    )


# ── 부록 M.5 #9 — 종신공제 다급부 (이중탈퇴 lx·lx′) ──────────────

WL_SRC = Path(
    r"C:\Users\tklee\OneDrive - 코리안리재보험\0. 보험료 산출 방법서"
    r"\새마을 W종신공제\더블종신공제_주계약_엑셀.xlsx"
)

#: 워크북 `위험률` 시트 열 = (헤더, 원본 나이 열, 남자 열, 여자 열)
#: 원본 명명범위 — `사망` = 위험률!M5:O118, `장해50` = 위험률!A5:C118(= 재해 + 질병)
WL_RISK_COLS = [
    ("사망률", "M", "N", "O"),
    ("장해50", "A", "B", "C"),
    ("재해장해50", "E", "F", "G"),
    ("질병장해50", "I", "J", "K"),
]

#: 급부 5종 — (이름, 총괄 배율 셀, 기수 계열, 구간) = 원본 `총괄` 1행·3행
WL_BENEFITS = [
    ("A 종신사망", "F1", "Mx", "가입 x → 만기 x+n"),
    ("B 정기사망 앞부분", "G1", "Mx", "가입 x → 전환 s"),
    ("C 건강축하금", "H1", "Dx", "전환 s 시점 1회"),
    ("D 축하금 분할지급", "I1", "Nx", "전환 s → s+분할지급기간"),
    ("B 정기사망 뒷부분", "J1", "Mx", "전환 s → 만기(종신)"),
]

# 모든 코드 블록이 단독 실행되도록 가정·위험률 로드와 함수 정의를 앞에 붙인다.
WL_LOAD = '''# ── 가정 시트 — 값을 바꾸고 [전체 실행]하면 이후 모든 단계가 다시 계산된다
_p = xl("가정!A1:C20", headers=True)
P = dict(zip(_p["항목"], _p["값"]))
sex   = int(P["성별"])           # 1 = 남자, 2 = 여자                      (총괄!B2)
x     = int(P["가입나이"])        # 가입연령                                (총괄!B3)
n     = int(P["보험기간"])        # =IF(sex=1, 110−x, 112−x) → 사실상 종신   (총괄!B4)
m     = int(P["납입기간"])        # 년                                      (총괄!B5)
mm    = int(P["납입주기"])        # 연 납입 횟수. 12 = 월납                  (총괄!F6)
i     = float(P["예정이율"])      # 3.5%                                    (총괄!B8)
s     = int(P["전환시점"])        # 건강축하금 지급 · 정기사망 앞/뒤 경계     (총괄!D9)
split = int(P["분할지급기간"])    # 축하금 분할지급 연수 — 원본 F8의 s+10     (총괄!F8)
M_std = int(P["표준납입기간"])    # =MIN(보험기간, 20). 기준연납의 분모 기간  (총괄!E8)
jjh   = float(P["가입금액계수"])  # 분할지급 급부에만 곱해진다               (총괄!B7)
a1, a2 = float(P["α1"]), float(P["α2"])      # 신계약비 정액 · 신계약비율
b1, b2 = float(P["β1"]), float(P["β2"])      # 유지비 정액 · 유지비율
bp, gm = float(P["β'"]), float(P["γ"])       # 집금비 정액 · 수금비율
aa2, bbbb, gg = float(P["αα2"]), float(P["ββββ"]), float(P["γγ"])   # 일시납 전용 사업비

# ── 급부 5종 배율 (원본 `총괄` 1행 F1:J1)
BEN = xl("가정!E1:I6", headers=True)

# ── 위험률 시트 (나이 0~113 = 원본 명명범위 `사망`·`장해50`과 같은 범위)
R  = xl("위험률!A1:I115", headers=True).fillna(0.0).astype({"나이": "int64"}).set_index("나이")
sx = "_남" if sex == 1 else "_여"
'''

WL_TABLE = '''

def xlround(v, d=0):
    """엑셀 ROUND = 사사오입. 파이썬 round()는 은행가 반올림이라 1원씩 어긋난다."""
    f = 10.0 ** d
    return float(np.sign(v) * np.floor(np.abs(v) * f + 0.5) / f)


def commutation():
    """이중탈퇴 계산기수표 — 원본 `기수표` A4:AC100 수식을 그대로 옮긴 것."""
    NR = 97                                    # 원본 기수표 행 4~100
    age = np.arange(x, x + NR)                 # 기수표!A5 = A4+1
    def pick(nm):                              # 기수표!B4·C4 =IF(A4>x+n, 0, VLOOKUP(…))
        y = R[nm + sx].reindex(age).fillna(0.0).to_numpy(float)
        return np.where(age <= x + n, y, 0.0)
    q, f = pick("사망률"), pick("장해50")        # q = 사망률, f = 50%이상 장해율
    lx = np.zeros(NR); lp = np.zeros(NR)
    lx[0] = lp[0] = 100000.0                   # radix 10만 — 기수표!L4·M4
    for j in range(NR - 1):
        if age[j + 1] > x + n:                 # 기수표!L5 =IF(A5>x+n, 0, …)
            break
        lx[j + 1] = lx[j] * (1 - q[j])                            # 기수표!L5  사망만
        lp[j + 1] = lp[j] * (1 - q[j] - f[j] + q[j] * f[j] / 2)    # 기수표!M5  사망 + 장해
    t  = (age - x).astype(float)
    v  = (1 + i) ** -t                         # 기수표!V4  v^t
    vh = (1 + i) ** -(t + 0.5)                 # 기수표!W4  v^(t+1/2)
    Dx, Dpx = lx * v, lp * v                   # 기수표!X4 Dx · Y4 D'x
    Cx = lx * q * vh                           # 기수표!Z4 C1x — 연중앙 사망 가정
    rev = lambda a: np.cumsum(a[::-1])[::-1]   # =SUM(Z4:$Z$99) 꼴의 아래→위 누계
    return dict(age=age, q=q, f=f, lx=lx, lpx=lp, Dx=Dx, Dpx=Dpx, Cx=Cx,
                Mx=rev(Cx), Nx=rev(Dx), Npx=rev(Dpx),   # 기수표!AA4 · AB4 · AC4
                row={int(a): j for j, a in enumerate(age)})
'''

WL_PRICE = '''

def benefits(k):
    """급부 5종의 기수 차분 → SUMX — 원본 `총괄` F3:J3 · E3."""
    r, Mx, Nx, Dx = k["row"], k["Mx"], k["Nx"], k["Dx"]
    unit = np.array([
        Mx[r[x]] - Mx[r[x + n]],                       # A 종신사망      총괄!F3
        Mx[r[x]] - Mx[r[s]],                           # B 정기사망 앞   총괄!G3
        Dx[r[s]],                                      # C 건강축하금    총괄!H3
        jjh * (Nx[r[s]] - Nx[r[s + split]]),           # D 축하금 분할   총괄!I3
        Mx[r[s]],                                      # B 정기사망 뒤   총괄!J3
    ])
    w = BEN["배율"].to_numpy(float)                     # 급부배율        총괄!F1:J1
    return unit, w * unit, float((w * unit).sum())     # SUMX            총괄!E3


def price(k):
    """순공제료 → 영업공제료 — 원본 `총괄` 5~18행. 단기납·일시납 사업비 세트가 다르다."""
    r, Nx, Npx, Dpx = k["row"], k["Nx"], k["Npx"], k["Dpx"]
    unit, part, SUMX = benefits(k)
    # 총괄!E6  N* = mm*((N'x − N'x+m) − (mm−1)/(2·mm)·(D'x − D'x+m))
    Nstar  = mm * ((Npx[r[x]] - Npx[r[x + m]])
                   - (mm - 1) / (2 * mm) * (Dpx[r[x]] - Dpx[r[x + m]]))
    Nden   = Npx[r[x]] - Npx[r[x + M_std]]              # 총괄!J16 N'x − N'x+M
    Pnet   = SUMX / Nstar                               # 총괄!E14 단기납 순공제료
    MaxANP = SUMX / Nden                                # 총괄!E16 기준연납 순공제료
    nc     = a1 + a2 * MaxANP                           # 신계약비           총괄!F18
    alpha  = nc * Dpx[r[x]] / Nstar                     # α항                총괄!I14
    beta   = bp * Nx[r[x + m]] / Nstar                  # β'항(집금비)       총괄!I14
    num    = Pnet + alpha + b1 / 12 + beta              # 분자               총괄!I14
    den    = 1 - b2 - gm                                # 분모               총괄!J14
    PP     = num / den                                  # 단기납 영업공제료  총괄!H14
    P1     = SUMX / Dpx[r[x]]                           # 일시납 순공제료    총괄!E10
    PP1    = (P1 + bbbb * Nx[r[x]] / Dpx[r[x]]) / (1 - aa2 - gg)   # 총괄!H10
    gross  = xlround(PP * 100000)                       # 총괄!E18
    risk   = xlround(0.5 * (part[0] + part[1]) / Nstar * 100000)   # 총괄!K14 위험공제료
    return dict(unit=unit, part=part, SUMX=SUMX, Nstar=Nstar, Nden=Nden, Pnet=Pnet,
                MaxANP=MaxANP, nc=nc, alpha=alpha, beta=beta, num=num, den=den, PP=PP,
                P1=P1, PP1=PP1, gross=gross, net=xlround(Pnet * 100000),
                nc100k=xlround(nc * 100000), risk=risk, save=gross - risk,
                lim=xlround((M_std * MaxANP * 0.05 + 2 * 10 / 1000) * 100000),  # 총괄!I18
                gross1=xlround(PP1 * 100000), net1=xlround(P1 * 100000))        # 총괄!E12·G12
'''


def build_whole_life_multi():
    """부록 M.5 #9 — 이중탈퇴 lx·lx′ → 급부 5종 Mx 차분 → 급부배율 SUMX → 순·영업공제료."""
    if not WL_SRC.exists():
        print(f"!! 원본 없음 — 종신공제 다급부 예제 건너뜀: {WL_SRC}")
        return None
    src = read_src_cells(WL_SRC, ["위험률", "총괄"])
    rk, tg = src["위험률"], src["총괄"]

    # ── 시트 1: 위험률 — 나이 0~113 (원본 명명범위 `사망` M5:O118, `장해50` A5:C118과 같은 범위)
    head = [cell("나이", "s")]
    for name, _, _, _ in WL_RISK_COLS:
        head += [cell(f"{name}_남", "s"), cell(f"{name}_여", "s")]
    rows = [head]
    for age in range(114):
        line = [cell(age, "n")]
        for _, _, cm, cf in WL_RISK_COLS:
            line += [cell(round(float(rk.get(f"{c}{5 + age}") or 0.0), 10), "n") for c in (cm, cf)]
        rows.append(line)
    risk_sheet = sheet_from_rows("sh-wl-risk", "위험률", rows, row_count=200, col_count=40)

    # ── 시트 2: 가정 — A:C 파라미터, E:I 급부 5종 배율(원본 `총괄` 1행)
    x0, n_ins, m_pay, s_cnv = int(tg["B3"]), int(tg["B4"]), int(tg["B5"]), int(tg["D9"])
    mm_pay, i_rate, M_std = int(tg["F6"]), float(tg["B8"]), int(tg["E8"])
    assume = [
        ("성별", int(tg["B2"]), "1 = 남자, 2 = 여자 — 바꾸면 여성 기초율로 전 단계 재계산 (총괄!B2)"),
        ("가입나이", x0, "세 (총괄!B3)"),
        ("보험기간", n_ins, "원본은 =IF(성별=1, 110−가입나이, 112−가입나이) — 사실상 종신 (총괄!B4)"),
        ("납입기간", m_pay, "년 — 단기납 (총괄!B5)"),
        ("납입주기", mm_pay, "연 납입 횟수. 12 = 월납 (총괄!F6)"),
        ("예정이율", i_rate, "v = 1/(1+i) (총괄!B8)"),
        ("전환시점", s_cnv, "건강축하금을 받는 나이 · 정기사망 급부의 앞/뒤 경계 (총괄!D9)"),
        ("분할지급기간", 10, "축하금 분할지급 연수 — 원본 F8의 s+10 (총괄!F8)"),
        ("표준납입기간", M_std, "= MIN(보험기간, 20). 기준연납 순공제료의 분모 기간 (총괄!E8)"),
        ("가입금액계수", float(tg["B7"]), "원본 명명범위 jjh — 분할지급 급부에만 곱해진다 (총괄!B7)"),
        ("α1", float(tg["B11"]), "신계약비 정액 = 10/1000 (총괄!B11)"),
        ("α2", float(tg["B12"]), "신계약비율 = 0.05 × MIN(보험기간, 20) (총괄!B12)"),
        ("β1", float(tg["B13"]), "유지비 정액 = 0.4/1000 (총괄!B13)"),
        ("β2", float(tg["B14"]), "유지비율 (총괄!B14)"),
        ("β'", float(tg["B15"]), "집금비 정액 = 0.4/1000 — 원본 명명범위 βββ (총괄!B15)"),
        ("γ", float(tg["B16"]), "수금비율 (총괄!B16)"),
        ("αα2", float(tg["B20"]), "일시납 신계약비율 (총괄!B20)"),
        ("ββββ", float(tg["B23"]), "일시납 유지비 정액 = 0.2/1000 (총괄!B23)"),
        ("γγ", float(tg["B24"]), "일시납 수금비율 (총괄!B24)"),
    ]
    ben_head = ["급부", "원본셀", "배율", "기수", "구간"]
    arows = [[cell("항목", "s"), cell("값", "s"), cell("비고", "s"), None]
             + [cell(h, "s") for h in ben_head]]
    for idx, (key, val, note) in enumerate(assume):
        line = [cell(key, "s"), cell(val, "n"), cell(note, "s"), None]
        if idx < len(WL_BENEFITS):
            nm, ref, base, span = WL_BENEFITS[idx]
            line += [cell(nm, "s"), cell(ref, "s"), cell(float(tg[ref]), "n"),
                     cell(base, "s"), cell(span, "s")]
        arows.append(line)
    assume_sheet = sheet_from_rows("sh-wl-assume", "가정", arows, row_count=60, col_count=12)

    # ── 원본 `총괄` 산출값 (검산 기준값) — 빌드 시점에 읽어 코드에 박아 둔다
    r8 = lambda v: round(float(v), 8)
    REF = [
        ("Mx — 사망 기수 (총괄!D3)", r8(tg["D3"])),
        ("Mx+n (총괄!D4)", r8(tg["D4"])),
        ("A 종신사망 (총괄!F3)", r8(tg["F3"])),
        ("B 정기사망 앞부분 (총괄!G3)", r8(tg["G3"])),
        ("C 건강축하금 (총괄!H3)", r8(tg["H3"])),
        ("D 축하금 분할지급 (총괄!I3)", r8(tg["I3"])),
        ("B 정기사망 뒷부분 (총괄!J3)", r8(tg["J3"])),
        ("SUMX — 급부 현가 합 (총괄!E3)", r8(tg["E3"])),
        ("N'x — 납입자 기수 (총괄!G6)", r8(tg["G6"])),
        ("D'x — 납입자 기수 (총괄!I6)", r8(tg["I6"])),
        ("N* — 월납 보정 납입기수 (총괄!E6)", r8(tg["E6"])),
        ("N'x − N'x+M — 기준연납 분모 (총괄!J16)", r8(tg["J16"])),
        ("기준연납 순공제료 MaxANP (총괄!E16)", r8(tg["E16"])),
        ("단기납 순공제료 P (총괄!E14)", r8(tg["E14"])),
        ("단기납 영업공제료 분자 (총괄!I14)", r8(tg["I14"])),
        ("단기납 영업공제료 PP (총괄!H14)", r8(tg["H14"])),
        ("10만원당 순공제료 (총괄!G18)", r8(tg["G18"])),
        ("10만원당 영업공제료 (총괄!E18)", r8(tg["E18"])),
        ("10만원당 신계약비 (총괄!F18)", r8(tg["F18"])),
        ("10만원당 신계약비 한도 (총괄!I18)", r8(tg["I18"])),
        ("10만원당 위험공제료 (총괄!K14)", r8(tg["K14"])),
        ("10만원당 저축공제료 (총괄!L14)", r8(tg["L14"])),
        ("일시납 순공제료 (총괄!E10)", r8(tg["E10"])),
        ("일시납 영업공제료 (총괄!H10)", r8(tg["H10"])),
        ("일시납 10만원당 영업 (총괄!E12)", r8(tg["E12"])),
        ("A 종신사망 월 순공제료 2천만 (총괄!E251)", r8(tg["E251"])),
        ("B 정기사망 앞 월 순공제료 2천만 (총괄!F251)", r8(tg["F251"])),
        ("C 건강축하금 월 순공제료 2천만 (총괄!G251)", r8(tg["G251"])),
    ]
    ref_lit = "REF = [\n" + "".join(f"    ({a!r}, {b!r}),\n" for a, b in REF) + "]\n"

    design = (f"{x0}세 {'남자' if int(tg['B2']) == 1 else '여자'} · {m_pay}년납 "
              f"{'월납' if mm_pay == 12 else f'연 {mm_pay}회납'} · 보험기간 {n_ins}년"
              f"({x0 + n_ins}세) · 예정이율 {i_rate * 100:.1f}%")
    gross10, net10 = int(tg["E18"]), int(tg["G18"])
    nc10, lim10 = int(tg["F18"]), int(tg["I18"])
    risk10, save10 = int(tg["K14"]), int(tg["L14"])
    ben_tab = "\n".join(
        f"| {nm} | `총괄!{ref}` = {float(tg[ref]):g} | `{base}` | {span} |"
        for nm, ref, base, span in WL_BENEFITS)

    core = WL_LOAD + WL_TABLE
    full = core + WL_PRICE
    sid = "sh-wl-risk"

    steps_items = [
        (2,
         "1단계 — 위험률 두 계열: 사망률과 50%이상 장해율",
         "## 1단계 — 위험률 두 계열: 사망률과 50%이상 장해율\n\n"
         "이 상품이 쓰는 기초율은 **두 가지**뿐입니다 — 그런데 그 둘이 서로 다른 표를 만듭니다.\n\n"
         "| 기초율 | 원본 명명범위 | 쓰이는 곳 |\n|---|---|---|\n"
         "| **사망률 q** | `사망` = `위험률!M5:O118` | **급부** 쪽 — `lx` · `Cx` · `Dx` · `Nx` |\n"
         "| **50%이상 장해율 f** | `장해50` = `위험률!A5:C118` | **납입** 쪽 — `lx′` · `D'x` · `N'x` |\n\n"
         "장해율은 그 자체가 급부가 아니라 **납입면제 사유**입니다. 50% 이상 장해가 발생하면 그 뒤로는 "
         "공제료를 내지 않으므로 **납입자 집단에서 빠집니다.**\n\n"
         "원본 `장해50` 열은 재해장해와 질병장해의 **합**입니다 — 이 예제는 합계와 구성요소를 함께 담았습니다.\n\n"
         "```\n"
         "위험률!B5 (장해50 남자) = F5 + J5        ← 재해장해 + 질병장해\n"
         "기수표!B4 (q)  = IF(A4>x+n, 0, VLOOKUP(A4, 사망,   sex+1, 0))\n"
         "기수표!C4 (f)  = IF(A4>x+n, 0, VLOOKUP(A4, 장해50, sex+1, 0))\n"
         "```\n\n"
         "> `IF(A4>x+n, 0, …)`  — 만기 다음 나이부터는 기초율을 0으로 눌러 표를 끊습니다. "
         "이 상품의 보험기간은 `=IF(성별=1, 110−가입나이, 112−가입나이)`라 사실상 **종신**입니다.",
         "위험률 계열 — 원본 대응·표본값",
         core + '''
KIND = [("사망률", "사망", "M5:O118", "급부 (lx·Cx·Dx·Nx)"),
        ("장해50", "장해50", "A5:C118", "납입 (lx′·D'x·N'x)"),
        ("재해장해50", "—(장해50의 구성)", "E5:G118", "장해50 = 재해 + 질병"),
        ("질병장해50", "—(장해50의 구성)", "I5:K118", "장해50 = 재해 + 질병")]
SAMPLE = [a for a in (x, s, x + 10, x + 20, x + 30) if a in R.index]
out = pd.DataFrame({
    "기초율": [a for a, _, _, _ in KIND],
    "원본 명명범위": [b for _, b, _, _ in KIND],
    "원본 범위": [c for _, _, c, _ in KIND],
    "쓰이는 곳": [d for _, _, _, d in KIND],
})
for a in SAMPLE:
    out[f"{a}세{sx}"] = [round(float(R[k + sx].loc[a]), 6) for k, _, _, _ in KIND]
gap = (R["장해50" + sx] - R["재해장해50" + sx] - R["질병장해50" + sx]).abs().max()
print(f"나이 {R.index.min()}~{R.index.max()} · {len(R.columns)}열 (4계열 × 남/여)")
print(f"장해50 = 재해장해 + 질병장해 검증 — 최대 오차 {gap:.2e}")
print(f"{x}세 {'남자' if sex == 1 else '여자'}  사망률 {float(R['사망률' + sx].loc[x]):.6f} · "
      f"장해50 {float(R['장해50' + sx].loc[x]):.6f}")
out''',
         "values"),
        (12,
         "2단계 — 이중탈퇴 생존자표 lx · lx′",
         "## 2단계 — 이중탈퇴 생존자표 lx · lx′\n\n"
         "생존자표가 **두 개**입니다. 급부를 세는 표와 공제료를 받는 표가 다르기 때문입니다.\n\n"
         "```\n"
         "기수표!L5 (lx)  = IF(A5>x+n, 0, L4*(1 − B4))                     ← 사망만\n"
         "기수표!M5 (lx′) = IF(A5>x+n, 0, M4*(1 − B4 − C4 + B4*C4/2))      ← 사망 + 장해50%\n"
         "```\n\n"
         "### `− q − f + q·f/2`가 무슨 뜻인가\n\n"
         "한 해에 **사망**과 **50%이상 장해** 두 가지 탈퇴가 동시에 노려봅니다. 두 탈퇴가 서로 독립이라고 "
         "보면 남는 사람은 `(1−q)(1−f) = 1 − q − f + q·f`입니다 — 겹치는 `q·f`를 한 번 되돌려 주는 것이죠 "
         "(두 번 빼면 안 되니까).\n\n"
         "그런데 **원본은 겹침을 절반만 되돌립니다** — `q·f/2`. 풀어 보면 이렇습니다.\n\n"
         "```\n"
         "1 − q − f + q·f/2  =  1 − q − f·(1 − q/2)\n"
         "```\n\n"
         "즉 **사망은 연중 언제 일어나든 그대로 q**, **장해는 그 해에 아직 죽지 않은 사람에게만** "
         "`f·(1 − q/2)`만큼 일어난다고 본 것입니다(사망이 연중 균등하게 일어난다는 가정에서 평균 노출이 `1 − q/2`). "
         "완전 독립가정보다 탈퇴가 조금 더 크게(= 납입자가 조금 더 적게) 잡히니, 공제료 쪽에서는 **보수적인** 쪽입니다.\n\n"
         "| 표 | radix | 줄어드는 사유 | 파생 기수 |\n|---|---|---|---|\n"
         "| `lx` | 100,000 | 사망만 | `Dx` · `Cx` · `Mx` · `Nx` → **급부** |\n"
         "| `lx′` | 100,000 | 사망 + 50%이상 장해(납입면제) | `D'x` · `N'x` → **납입** |\n\n"
         "> 급부 쪽에 `lx′`를 쓰면 안 됩니다. 납입이 면제된 계약도 **보장은 그대로 살아 있기** 때문입니다. "
         "반대로 납입 쪽에 `lx`를 쓰면 받지도 못할 공제료를 세게 되어 공제료가 과소 산출됩니다.",
         "이중탈퇴 생존자표 (가입~만기)",
         core + '''
k = commutation()
last = k["row"][x + n]
out = pd.DataFrame({
    "나이": k["age"][:last + 1],
    "q 사망률": k["q"][:last + 1],
    "f 장해50": k["f"][:last + 1],
    "lx": k["lx"][:last + 1],
    "lx'(납입자)": k["lpx"][:last + 1],
    "차이(납입면제 누적)": (k["lx"] - k["lpx"])[:last + 1],
    "Dx": k["Dx"][:last + 1],
    "D'x": k["Dpx"][:last + 1],
})
print(f"{x}세 가입 · {n}년 보장({x + n}세 만기) → 생존자표 {len(out)}행")
print(f"만기 {x + n}세   lx {k['lx'][last]:,.4f} · lx' {k['lpx'][last]:,.4f}")
j5 = k["row"][x + m]
print(f"납입 종료 {x + m}세   lx {k['lx'][j5]:,.1f} · lx' {k['lpx'][j5]:,.1f}  "
      f"(차이 {k['lx'][j5] - k['lpx'][j5]:,.1f} = 장해 납입면제 누적)")
out.round(6)''',
         "values"),
        (70,
         "3단계 — 급부 5종은 어느 기수를 어느 구간에서 쓰는가",
         "## 3단계 — 급부 5종은 어느 기수를 어느 구간에서 쓰는가\n\n"
         "이 상품의 급부는 5종이고, **셋은 사망급부(`Mx` 차분), 하나는 생존급부(`Dx`), 하나는 연금(`Nx` 차분)**입니다.\n\n"
         "```\n"
         "총괄!F3 (A 종신사망)      = F1*(VLOOKUP(x,   기수표,27,0) − VLOOKUP(x+n, 기수표,27,0))\n"
         "총괄!G3 (B 정기사망 앞)   = G1*(VLOOKUP(x,   기수표,27,0) − VLOOKUP(s,   기수표,27,0))\n"
         "총괄!H3 (C 건강축하금)    = H1* VLOOKUP(s,   기수표,24,0)\n"
         "총괄!I3 (D 축하금 분할)   = jjh*I1*(VLOOKUP(s,기수표,28,0) − VLOOKUP(s+10, 기수표,28,0))\n"
         "총괄!J3 (B 정기사망 뒤)   = J1* VLOOKUP(s,   기수표,27,0)\n"
         "```\n\n"
         "`VLOOKUP(…, 기수표, 열번호, 0)`의 **열번호가 곧 기수 계열**입니다.\n\n"
         "| 열번호 | 기수표 열 | 기수 | 바탕 생존자표 |\n|---|---|---|---|\n"
         "| 24 | X | `Dx` 생존급부 | `lx` |\n"
         "| 25 | Y | `D'x` | `lx′` |\n"
         "| 27 | AA | `Mx` = ΣCx 사망급부 | `lx` |\n"
         "| 28 | AB | `Nx` = ΣDx 연금 | `lx` |\n"
         "| 29 | AC | `N'x` = ΣD'x 납입 | `lx′` |\n\n"
         "**급부 5종**\n\n"
         "| 급부 | 배율 | 기수 | 구간 |\n|---|---|---|---|\n" + ben_tab + "\n\n"
         "`B 정기사망`이 **앞부분(`Mx − Ms`)과 뒷부분(`Ms`)으로 쪼개진 것**이 이 상품의 설계입니다 — "
         "전환시점 " + f"{s_cnv}" + "세를 경계로 정기사망 보장의 크기를 따로 정할 수 있게 열어 둔 구조입니다.\n\n"
         "> 5종 전부가 **`lx`(사망만) 계열**이라는 점을 확인하세요. 장해로 납입이 면제된 계약도 급부는 살아 있습니다. "
         "`lx′`는 4단계의 `N*` 분모에서만 나옵니다.",
         "급부 5종 — 기수 구성·단위 현가",
         full + '''
k = commutation()
r_, Mx, Nx, Dx = k["row"], k["Mx"], k["Nx"], k["Dx"]
unit, part, SUMX = benefits(k)
out = pd.DataFrame({
    "급부": BEN["급부"],
    "원본셀": BEN["원본셀"],
    "기수": BEN["기수"],
    "구간": BEN["구간"],
    "단위 현가(배율 1)": unit.round(6),
    "배율": BEN["배율"],
    "기여도": part.round(6),
})
print(f"기수 (10만 radix, {x}세 기준)")
print(f"  Mx({x}) {Mx[r_[x]]:>15,.6f}   Mx({x + n}) {Mx[r_[x + n]]:>12,.6f}   "
      f"Mx({s}) {Mx[r_[s]]:>15,.6f}")
print(f"  Dx({s}) {Dx[r_[s]]:>15,.6f}   Nx({s}) {Nx[r_[s]]:>15,.6f}   "
      f"Nx({s + split}) {Nx[r_[s + split]]:>12,.6f}")
print(f"배율이 0인 급부({', '.join(BEN.loc[BEN['배율'] == 0, '급부'])})는 이 설계에서 꺼져 있습니다 "
      f"— `가정` 시트 G열에서 켜 보세요.")
out''',
         "values"),
        (81,
         "4단계 — 급부배율 합산 SUMX → 순공제료 (N* 납입주기 보정)",
         "## 4단계 — 급부배율 합산 SUMX → 순공제료 (N* 납입주기 보정)\n\n"
         "급부 5종에 **급부배율**을 곱해 하나로 합칩니다 — 원본 `총괄` 1행이 배율, 3행이 기수 차분입니다.\n\n"
         "```\n"
         "총괄!E3  SUMX = SUM(F3:L3)                     ← 급부배율 × 기수 차분의 합\n"
         "총괄!E14 P    = F14/G14 = E3/E6 = SUMX / N*    ← 단기납 순공제료(1회 납입액)\n"
         "```\n\n"
         "### N* — 연 1회가 아니라 연 " + f"{mm_pay}" + "회 내는 것에 대한 보정\n\n"
         "```\n"
         "총괄!E6  N* = mm*((N'x − N'x+m) − (mm−1)/(2*mm)*(D'x − D'x+m))\n"
         "         G6 = N'x     H6 = N'x+m     I6 = D'x     J6 = D'x+m     F6 = mm\n"
         "```\n\n"
         "연납 기수 `N'x − N'x+m`에 `mm`을 곱하면 **연 " + f"{mm_pay}" + "회 납입 횟수**가 되지만, 그러면 "
         "보험연도 중간에 죽거나 장해로 면제된 사람의 남은 회차까지 세는 셈이 됩니다. "
         "`(mm−1)/(2·mm)`은 그 **평균 미납 회차 보정**입니다 — 연 " + f"{mm_pay}" + "회 납입에서는 "
         f"{(mm_pay - 1) / (2 * mm_pay):.5f}" + "년치를 되돌립니다.\n\n"
         "**분모가 `N'x`(납입자 기수)인 것이 핵심입니다.** 급부는 `lx`로 세고 공제료는 `lx′`로 셉니다 — "
         "장해로 납입이 면제된 계약은 보장은 유지되지만 더 이상 돈을 내지 않기 때문입니다.\n\n"
         "> `lx`로 분모를 잡으면 받지도 못할 공제료를 세는 것이라 순공제료가 **과소** 산출됩니다.",
         "SUMX · N* → 순공제료",
         full + '''
k = commutation()
r = price(k)
out = pd.DataFrame({
    "급부": BEN["급부"],
    "배율": BEN["배율"],
    "단위 현가": r["unit"].round(4),
    "기여도": r["part"].round(4),
    "비중(%)": np.where(r["SUMX"] > 0, r["part"] / r["SUMX"] * 100, 0.0).round(2),
})
print(f"SUMX  {r['SUMX']:>18,.6f}    (총괄!E3 = SUM(F3:L3))")
print(f"N*    {r['Nstar']:>18,.6f}    (총괄!E6 — 연 {mm}회 납입 보정)")
print(f"순공제료 P = SUMX / N* = {r['Pnet']:.10f}  →  10만원당 {r['net']:,.0f}원   (총괄!E14·G18)")
print(f"일시납 순공제료 = SUMX / D'x = {r['P1']:.10f}  →  10만원당 {r['net1']:,.0f}원   (총괄!E10·G12)")
out''',
         "values"),
        (92,
         "5단계 — 영업공제료 (사업비 α1·α2·β1·β2·β′·γ)",
         "## 5단계 — 영업공제료 (사업비 α1·α2·β1·β2·β′·γ)\n\n"
         "순공제료에 사업비를 얹어 실제로 내는 **영업공제료**를 만듭니다. "
         "이 상품은 **단기납과 일시납의 사업비 세트가 다릅니다** — 원본도 `총괄` 11~16행(단기납)과 "
         "19~24행(일시납)을 따로 두었습니다.\n\n"
         "```\n"
         "총괄!E16 MaxANP = F16/G16 = SUMX / (N'x − N'x+M)     ← 기준연납 순공제료, M = MIN(n,20)\n"
         "총괄!I14 분자   = P + (α1 + α2*MaxANP)*I6/E6 + β1/12 + β'*L6/E6\n"
         "                                   I6 = D'x   E6 = N*   L6 = Nx+m\n"
         "총괄!J14 분모   = 1 − β2 − γ\n"
         "총괄!H14 PP     = I14/J14\n"
         "총괄!E18        = ROUND(PP*100000, 0)               ← 10만원당 영업공제료\n"
         "총괄!H10 일시납 = (E10 + ββββ*K6/I6) / (1 − αα2 − γγ)    K6 = Nx\n"
         "```\n\n"
         "| 사업비 | 값 | 뜻 |\n|---|---|---|\n"
         "| α1 | " + f"{float(tg['B11']):g}" + " | 신계약비 정액 (10/1000) |\n"
         "| α2 | " + f"{float(tg['B12']):g}" + " | 신계약비율 = 0.05 × MIN(n, 20) — 기준연납 순공제료에 비례 |\n"
         "| β1 | " + f"{float(tg['B13']):g}" + " | 유지비 정액 (0.4/1000, 납입 1회당 → `β1/12`) |\n"
         "| β2 | " + f"{float(tg['B14']):g}" + " | 유지비율 — 영업공제료에 비례 |\n"
         "| β′ | " + f"{float(tg['B15']):g}" + " | 집금비 정액 — 납입 종료 후 유지기간(`Nx+m`)에 비례 |\n"
         "| γ | " + f"{float(tg['B16']):g}" + " | 수금비율 — 영업공제료에 비례 |\n\n"
         "β2·γ가 **분모**로 가는 것은 이 둘이 순공제료가 아니라 **영업공제료 자체에 비례**하기 때문입니다.\n\n"
         "### 신계약비 한도와 위험/저축 분해\n\n"
         "```\n"
         "총괄!I18 한도 = ROUND((MIN(n,20)*MaxANP*5% + 2*10/1000)*100000, 0)\n"
         "총괄!K18      = IF(J18 > I18, \"초과\", \"부합\")\n"
         "총괄!K14 위험 = ROUND(0.5*(F3+G3)/E6*100000, 0)     ← 사망급부 절반을 위험공제료로\n"
         "총괄!L14 저축 = E18 − K14\n"
         "```\n\n"
         "원본 산출값 — 10만원당 **순 " + f"{net10:,}" + "원 · 영업 " + f"{gross10:,}" + "원**, "
         "신계약비 **" + f"{nc10:,}" + "원** ≤ 한도 **" + f"{lim10:,}" + "원** → **"
         + ("부합" if nc10 <= lim10 else "초과") + "**. "
         "그 안에서 위험공제료 **" + f"{risk10:,}" + "원** · 저축공제료 **" + f"{save10:,}" + "원"
         "**(" + f"{save10 / gross10 * 100:.1f}" + "%)** — 건강축하금이 급부의 대부분을 차지하는 **저축성 구조**입니다.\n\n"
         "> `ROUND`는 엑셀식 사사오입입니다. 파이썬 `round()`는 은행가 반올림이라 10만원당 1원씩 어긋날 수 있어 "
         "`xlround()`를 따로 두었습니다.",
         "영업공제료 산출 단계",
         full + '''
k = commutation()
r = price(k)
out = pd.DataFrame({
    "항목": ["기준연납 순공제료 MaxANP", "신계약비 α1+α2·MaxANP", "10만원당 신계약비",
             "10만원당 신계약비 한도", "단기납 순공제료 P", "α항 = 신계약비·D'x/N*",
             "β1/12", "β′항 = β′·Nx+m/N*", "분자", "분모 (1 − β2 − γ)",
             "단기납 영업공제료 PP", "10만원당 영업공제료", "10만원당 위험공제료",
             "10만원당 저축공제료", "일시납 순공제료", "일시납 영업공제료",
             "일시납 10만원당 영업"],
    "값": [r["MaxANP"], r["nc"], r["nc100k"], r["lim"], r["Pnet"], r["alpha"], b1 / 12,
           r["beta"], r["num"], r["den"], r["PP"], r["gross"], r["risk"], r["save"],
           r["P1"], r["PP1"], r["gross1"]],
    "원본": ["총괄!E16", "총괄!F18", "총괄!F18", "총괄!I18", "총괄!E14", "총괄!I14",
             "총괄!I14", "총괄!I14", "총괄!I14", "총괄!J14", "총괄!H14", "총괄!E18",
             "총괄!K14", "총괄!L14", "총괄!E10", "총괄!H10", "총괄!E12"],
})
print(f"신계약비 {r['nc100k']:,.0f}원 ≤ 한도 {r['lim']:,.0f}원 → "
      f"{'부합' if r['nc100k'] <= r['lim'] else '초과'}    (총괄!K18)")
print(f"10만원당 영업공제료 {r['gross']:,.0f}원 = 위험 {r['risk']:,.0f}원 + 저축 {r['save']:,.0f}원 "
      f"(저축 비중 {r['save'] / r['gross'] * 100:.1f}%)")
out''',
         "values"),
        (115,
         "6단계 — 원본 `총괄` 대조 검산",
         "## 6단계 — 원본 `총괄` 대조 검산\n\n"
         "여기까지의 계산이 원본 엑셀과 **같은 값**인지 확인합니다. `원본(엑셀)` 열은 "
         "`더블종신공제_주계약_엑셀.xlsx`의 `총괄` 시트에서 그대로 가져온 값입니다.\n\n"
         "**차이** 열이 모두 0이면 위험률 → 이중탈퇴표 → 급부 5종 기수 → 급부배율 → 순·영업공제료의 "
         "전 과정이 원본과 일치합니다. 마지막 세 줄(`총괄` 251행)은 **급부별 월 순공제료 배분**"
         "(가입금액 2천만원 기준)으로, 7단계 기여도 그래프의 검산이기도 합니다.\n\n"
         "```\n"
         "총괄!E251 = F3/$E$6*20000000     ← (급부 A 기여도 / N*) × 가입금액\n"
         "```\n\n"
         "> `원본(엑셀)` 열은 **기본 설계**(" + design + ") 기준으로 박아 둔 값입니다. "
         "`가정` 시트를 고치면 차이가 벌어지는 것이 정상입니다 — 검산은 기본 설계로 되돌린 뒤 보세요.",
         "원본 총괄 vs 계산값 대조표",
         full + "\n" + ref_lit + '''
k = commutation()
r = price(k)
r_ = k["row"]
FACE = 20000000                                        # 총괄 251행의 가입금액 기준
calc = [k["Mx"][r_[x]], k["Mx"][r_[x + n]],
        r["part"][0], r["part"][1], r["part"][2], r["part"][3], r["part"][4],
        r["SUMX"], k["Npx"][r_[x]], k["Dpx"][r_[x]], r["Nstar"], r["Nden"],
        r["MaxANP"], r["Pnet"], r["num"], r["PP"], r["net"], r["gross"],
        r["nc100k"], r["lim"], r["risk"], r["save"], r["P1"], r["PP1"], r["gross1"],
        r["part"][0] / r["Nstar"] * FACE,
        r["part"][1] / r["Nstar"] * FACE,
        r["part"][2] / r["Nstar"] * FACE]
chk = pd.DataFrame({"항목": [a for a, _ in REF],
                    "원본(엑셀)": [b for _, b in REF],
                    "계산값": [round(float(v), 8) for v in calc]})
chk["차이"] = (chk["계산값"] - chk["원본(엑셀)"]).round(10)
print("최대 차이:", chk["차이"].abs().max())
chk''',
         "values"),
        (148,
         "7단계 — 급부별 기여도 · 이중탈퇴가 벌리는 격차",
         "## 7단계 — 급부별 기여도 · 이중탈퇴가 벌리는 격차\n\n"
         "왼쪽은 급부 5종의 **SUMX 기여도**(급부배율 × 기수 차분), 오른쪽은 **`lx`와 `lx′`가 벌어지는 모습**입니다.\n\n"
         "- 급부의 대부분은 **C 건강축하금**입니다 — " + f"{s_cnv}" + "세 생존 시 지급하는 목돈이라 "
         "할인만 받을 뿐 사망률로 거의 깎이지 않습니다. 이 상품이 **저축성**인 이유입니다.\n"
         "- **A 종신사망**은 종신 보장이지만 먼 미래의 급부라 현가가 크게 눌립니다.\n"
         "- **B 정기사망 앞부분**은 가입~" + f"{s_cnv}" + "세의 짧은 구간이라 기여도가 작습니다.\n"
         "- 오른쪽 두 곡선의 간격이 **장해 납입면제로 빠져나간 계약**입니다. "
         "이 간격이 `N'x`를 줄이고, 그만큼 공제료를 올립니다.\n"
         "- 세로 점선은 납입 종료 " + f"{x0 + m_pay}" + "세 — **여기까지의 간격만 `N*`에 영향**을 줍니다.",
         "급부별 기여도 · lx vs lx′",
         full + '''
import matplotlib.pyplot as plt
k = commutation()
r = price(k)
last = k["row"][x + n]
lab = BEN["급부"].tolist()
fig, ax = plt.subplots(1, 2, figsize=(11, 4))

o = np.argsort(r["part"])
ax[0].barh(np.array(lab, dtype=object)[o], r["part"][o], color="#4A90C2")
for y, val in enumerate(r["part"][o]):
    ax[0].text(max(val, 0), y, f"  {val / r['SUMX'] * 100:.1f}%", va="center", fontsize=8)
ax[0].set_xlim(0, float(r["part"].max()) * 1.3)
ax[0].set_title(f"급부별 SUMX 기여도 (합 {r['SUMX']:,.0f})")
ax[0].grid(alpha=0.3, axis="x")

a_, lx, lp = k["age"][:last + 1], k["lx"][:last + 1], k["lpx"][:last + 1]
ax[1].plot(a_, lx, color="#4A90C2", lw=1.8, label="lx — 사망만")
ax[1].plot(a_, lp, color="#C2704A", lw=1.8, label="lx′ — 사망 + 장해50%(납입자)")
ax[1].fill_between(a_, lp, lx, color="#C2704A", alpha=0.15, label="장해 납입면제 누적")
ax[1].axvline(x + m, color="#333", lw=1, ls=":")
ax[1].annotate(f"{x + m}세 납입 종료", (x + m, lx.max() * 0.9), xytext=(5, 0),
               textcoords="offset points", fontsize=8)
ax[1].set_title("이중탈퇴 생존자표 — lx vs lx′")
ax[1].set_xlabel("나이"); ax[1].grid(alpha=0.3); ax[1].legend(fontsize=8)
fig.tight_layout()
fig''',
         "object"),
    ]

    blocks = steps(sid, 24, "wl",
                   ("종신공제 — 다급부 합산(이중탈퇴)",
                    "# 종신공제 — 다급부 합산(이중탈퇴)\n\n"
                    "실제 종신공제 산출과정표(새마을 W종신공제 · 더블종신공제 주계약)의 위험률과 파라미터를 "
                    "그대로 담았습니다. **사망률·장해율 → 이중탈퇴 생존자표 `lx`·`lx′` → 급부 5종의 기수 차분 → "
                    "급부배율 SUMX → 순·영업공제료 → 원본 `총괄` 대조 검산**이 이 한 파일에서 닫힙니다.\n\n"
                    "**이 예제의 한 줄** — 급부는 `lx`(사망만)로 세고, 공제료는 `lx′`(사망 + 장해 납입면제)로 셉니다.\n\n"
                    "**구성**\n\n"
                    "- `위험률` 시트 — 나이 0~113세의 사망률·50%이상 장해율(재해·질병 구성 포함) × 남/여 8열 "
                    "(원본 명명범위 `사망` M5:O118 · `장해50` A5:C118, 출처 써미트 2014-59호)\n"
                    "- `가정` 시트 — A:C에 성별·가입나이·보험기간·납입기간·예정이율·전환시점과 사업비율 "
                    "α1·α2·β1·β2·β′·γ(+일시납 세트), E:I에 **급부 5종의 배율**(원본 `총괄` 1행)\n"
                    "- 오른쪽 Y열부터 7단계의 [설명 + 코드] 블록\n\n"
                    "**읽는 법** — 설명을 읽고 코드 블록을 순서대로 실행하거나, 그냥 **[전체 실행]**을 누르세요. "
                    "각 블록은 `xl()`로 시트를 다시 읽어 단독 실행됩니다. 설명에는 원본 엑셀 수식을 그대로 인용해 "
                    "두었으니 코드와 나란히 대조해 보세요.\n\n"
                    "> 현재 설계: **" + design + " · 전환시점 " + f"{s_cnv}" + "세**"),
                   steps_items)
    blocks.append(md_block(
        "blk-wl-wrap", sid, 154, 24,
        "## 정리 — 이중탈퇴·다급부에서 쉽게 틀리는 곳\n\n"
        "| 함정 | 무슨 일이 생기나 |\n|---|---|\n"
        "| 생존자표를 하나로 통일 | 급부는 `lx`, 납입은 `lx′`입니다. 하나로 쓰면 급부가 과소(→ 공제료 과소)되거나 "
        "납입기수가 과대(→ 공제료 과소)됩니다 |\n"
        "| 겹침 보정 `+q·f/2` 누락 | 사망과 장해를 그냥 두 번 빼면 납입자가 과소평가됩니다 |\n"
        "| `q·f` vs `q·f/2` | 완전 독립가정은 `q·f`, 원본은 `q·f/2`(= `1 − q − f·(1−q/2)`)입니다. "
        "어느 쪽인지 **원본 수식을 보고** 맞추세요 |\n"
        "| 급부별 기수 계열 혼동 | 사망급부는 `Mx`, 생존급부는 `Dx`, 분할지급은 `Nx` 차분입니다. "
        "`VLOOKUP`의 **열번호가 곧 계열**입니다(24=Dx · 27=Mx · 28=Nx · 29=N'x) |\n"
        "| 정기사망을 한 덩어리로 | 전환시점 앞(`Mx − Ms`)과 뒤(`Ms`)는 배율이 따로입니다. 합쳐 버리면 설계가 사라집니다 |\n"
        "| `N*`에 `Nx` 사용 | 납입면제가 있는 상품은 **`N'x`(납입자 기수)** 를 써야 합니다 |\n"
        "| `N*` 보정 누락 | `mm`만 곱하고 `(mm−1)/(2·mm)`을 빼지 않으면 납입기수가 과대 → 공제료 과소 |\n"
        "| 단기납 사업비를 일시납에 적용 | α2·β1·β′ 대신 αα2·ββββ·γγ를 씁니다(총괄 19~24행) |\n"
        "| 파이썬 `round()` | 은행가 반올림입니다. 엑셀 `ROUND`(사사오입)와 달라 10만원당 1원씩 어긋날 수 있습니다 |\n\n"
        "**바꿔 보기** — `가정` 시트만 고치면 전 단계가 다시 계산됩니다.\n\n"
        "| 바꾸는 값 | 일어나는 일 |\n|---|---|\n"
        "| `가정!G2:G6` 급부배율 | 급부 구성 자체를 바꿉니다 — 이 설계에서 0인 **D 축하금 분할지급**·"
        "**B 정기사망 뒷부분**을 켜 보세요 |\n"
        "| `전환시점` | 건강축하금을 받는 나이. 늦출수록 할인이 커져 급부 현가와 공제료가 내려갑니다 |\n"
        "| `납입기간` | 짧을수록 `N*`가 작아져 1회 납입액이 커집니다 |\n"
        "| `납입주기` 12 → 1 | 연납. `N*` 보정항이 사라집니다 |\n"
        "| `성별` 1 → 2 | 여성 기초율 — 사망률이 낮아 사망급부는 싸지고 생존급부는 비싸집니다 |\n"
        "| `예정이율` | 올리면 할인이 커져 급부 현가와 공제료가 함께 내려갑니다 |\n\n"
        "> `보험기간`은 원본에서 `=IF(성별=1, 110−가입나이, 112−가입나이)` 수식이었습니다 — 여기서는 고정값이라 "
        "`가입나이`나 `성별`을 바꾸면 같이 고쳐야 합니다. `α2`(`=0.05×MIN(보험기간,20)`)와 "
        "`표준납입기간`(`=MIN(보험기간,20)`)도 마찬가지입니다.\n\n"
        "6단계의 **차이** 열이 모두 0이면 원본 산출과정표와 완전히 일치한다는 뜻입니다.",
        "정리 — 이중탈퇴·다급부에서 쉽게 틀리는 곳"))

    return workbook(
        "wb-sample-whole-life-multi",
        "종신공제 — 다급부 합산(이중탈퇴)",
        [risk_sheet, assume_sheet],
        blocks,
    )


# ── 부록 M.5 #7 — 체증형·미달체 정기보험 (경영인정기보험 산출과정표) ───

#: `위험률` 시트에 미달체 열을 덧붙인다 — 원본 O·P(사망율×3), Q·R(표준사망율×3)
TV_RISK_COLS = RISK_COLS + [
    ("미달사망률_남", "O"), ("미달사망률_여", "P"),
    ("미달표준사망률_남", "Q"), ("미달표준사망률_여", "R"),
]

#: 예제 기본 체증률 — 원본 `조회!C3`(체증)의 저장값은 0%(평준형)이라 체증형이 보이지 않는다.
TV_INC = 0.10

TV_LOAD = '''# ── 가정 시트의 파라미터 — 값을 바꾸고 [전체 실행]하면 이후 모든 단계가 다시 계산된다
_p = xl("가정!A1:C24", headers=True)
P = dict(zip(_p["항목"], _p["값"]))
sex  = int(P["성별"])                       # 1 = 남자, 2 = 여자
x0   = int(P["가입나이"])                    # 가입나이(세)
mat  = int(P["만기나이"])                    # 만기나이(세)
n    = int(P["보험기간"])                    # 보험기간 = 만기나이 − 가입나이
m    = int(P["납입기간"])                    # 납입기간(년)
mode = int(P["납입주기"])                    # 12 = 월납
face = float(P["가입금액"])                  # 가입금액(만원) — 10000 = 1억원
sa   = float(P["보장금액"])                  # 산출 기준 사망보험금(만원)
a1, a2 = float(P["α1"]), float(P["α2"])      # 신계약비 α1 = 5%×min(n,20), α2 = 10/1000
b1, b2 = float(P["β1"]), float(P["β2"])      # 유지비율 β1, 유지비 정액 β2
bp, gm = float(P["β'"]), float(P["γ"])      # 납입후유지비 β′, 수금비율 γ
i_app = float(P["예정이율"])                 # 적용(예정)이율
i_std = float(P["표준이율"])                 # 표준책임준비금 이율
sc_yr = int(P["해지공제상각기간"])            # 신계약비 상각기간(년)
inc   = float(P["체증률"])                   # 체증형 연 체증률 — 원본 `조회!C3`(정의된 이름 `체증`)
defer = int(P["체증거치기간"])                # 체증 시작 전 거치기간 — 원본 P!A7 수식의 상수 10
mult3 = float(P["미달할증배수"])              # 미달체 사망률 할증 배수 — 원본 `위험률!O5 = MIN(K5*3,1)`
ridx  = float(P["위험지수"])                  # 미달체 위험지수 — 원본 `조회!E9`

# ── 위험률 시트(나이 0~112) — 성별에 맞는 열만 골라 나이 인덱스 Series로
R  = xl("위험률!A1:O114", headers=True).fillna(0.0).astype({"나이": "int64"}).set_index("나이")
sx = "남" if sex == 1 else "여"
q_app, f_app = R["경험사망률_" + sx], R["발생률_" + sx]        # 적용 기초 — 7회 경험사망률
q_std, f_std = R["표준사망률_" + sx], R["표준발생률_" + sx]    # 표준 기초 — 7회 표준율
q_sub = R["미달사망률_" + sx]                                   # 미달체      — 경험사망률 ×3 (1 상한)
q_sst = R["미달표준사망률_" + sx]                               # 미달체 표준 — 표준사망률 ×3
LAST = int(R.index.max())
'''

TV_COMM = '''

def xlround(v, d=0):
    """엑셀 ROUND = 사사오입. 파이썬 round()는 은행가 반올림이라 1원씩 어긋난다."""
    f = 10.0 ** d
    return float(np.sign(v) * np.floor(np.abs(v) * f + 0.5) / f)


def commutation(q, f, i):
    """계산기수표 — 원본 `기수표`·`미달기수표` C4:L4 수식을 그대로 옮긴 것."""
    v = 1.0 / (1.0 + i)
    t = np.arange(LAST - x0 + 1)                  # t = 0(가입시점) … 위험률 마지막 나이
    age = x0 + t
    qq = q.loc[age].to_numpy(float)
    ff = f.loc[age].to_numpy(float)
    lx = np.empty(len(t)); llx = np.empty(len(t))
    lx[0] = llx[0] = 100000.0                     # radix 10만
    for j in range(len(t) - 1):
        lx[j + 1] = lx[j] * (1 - qq[j])                                    # C5
        # D5: 납입면제까지 감안한 납입자 수. 미달기수표!D5는 MAX(…,0) — 고령에서 qx+fx>1을 막는다
        llx[j + 1] = max(llx[j] * (1 - qq[j] - ff[j] + qq[j] * ff[j] / 2), 0.0)
    dx  = lx * qq                                 # E4: =C4*qx
    Cx  = dx * v ** (t + 0.5)                     # F4: =E4*v^(A4+0.5)  ← 연중앙 사망 가정
    Dx  = lx * v ** t                             # I4: =C4*v^A4
    DLx = llx * v ** t                            # J4: =D4*v^A4
    rev = lambda a: np.cumsum(a[::-1])[::-1]      # G4: =F4+G5 처럼 아래에서 위로 누적
    Mx = rev(Cx)
    return pd.DataFrame({"t": t, "x": age, "lx": lx, "llx": llx, "dx": dx, "Cx": Cx,
                         "Mx": Mx, "Rx": rev(Mx), "Dx": Dx, "DLx": DLx,
                         "Nx": rev(Dx), "NLx": rev(DLx)})
'''

TV_PRICE = '''

def bmult(t):
    """경과 t년(보험연도 t+1)에 사망했을 때의 보험금 배율 — 거치기간 뒤 매년 체증."""
    return 1.0 + inc * np.maximum(t - (min(defer, n) - 1), 0)


def mstar(k, ch):
    """M* — 원본 `P!A7`·`미달P!A7`의 Rx 항을 그대로 옮긴 것. ch=0이면 평준형."""
    d = min(defer, n)
    Mx, Rx = k["Mx"].to_numpy(), k["Rx"].to_numpy()
    return sa / 1000 * (Mx[0] - Mx[n] + ch * (Rx[d] - Rx[n] - (n - d) * Mx[n]))


def premium(k, ch=0.0, sub=False):
    """순·영업보험료. sub=True는 원본 `미달P` — β′ 항이 없고 α는 반올림값을 쓴다."""
    Mx, Nx, NLx, DLx, Dx = (k[c].to_numpy() for c in ("Mx", "Nx", "NLx", "DLx", "Dx"))
    M = mstar(k, ch)                                                  # P!A7
    N = mode * (NLx[0] - NLx[m] - (mode - 1) / (2 * mode) * (DLx[0] - DLx[m]))   # P!B7
    B16   = NLx[0] - NLx[m]                                           # P!B16  N*[1]
    base  = M / (NLx[0] - NLx[min(n, 20)])                            # P!C10 기준연납순보험료
    net   = M / N                                                     # P!C19 순보험료
    alpha = a1 * xlround(base, 5) + a2                                # P!C13 총신계약비
    # α항: P!A13은 반올림 전 기준연납을, 미달P!A13은 C13(반올림 후)을 쓴다 — 원본 그대로
    A = (alpha if sub else a1 * base + a2) * Dx[0] / N + b2 / mode    # P!A13
    B = 0.0 if sub else bp * (Nx[m] - Nx[n]) / N                      # P!B13 (미달P!B13 = 0)
    gross = (net + A + B) / (1 - b1 - gm)                             # P!C22 영업보험료
    beta_net = (M + (0.0 if sub else bp * (Nx[m] - Nx[n]))) / B16     # P!E19 / 미달P!E19
    return dict(M=M, N=N, base=base, net=net, alpha=alpha, A=A, B=B,
                gross=gross, beta_net=beta_net)
'''

TV_RESERVE = '''

def reserve(k, beta_net, ch=0.0, sub=False):
    """연말 책임준비금(10만당) — 원본 `V!C3·H3` / `미달V!C3·G3`."""
    d = min(defer, n)
    t = k["t"].to_numpy()
    Mx, Rx, Nx, NLx, Dx = (k[c].to_numpy() for c in ("Mx", "Rx", "Nx", "NLx", "Dx"))
    alive = x0 + t <= mat
    # V!C3의 체증 IF — t≤10이면 P!A7과 같은 항, t>10이면 이미 오른 급부를 얹는다
    incr = np.where(t <= d, Rx[d] - Rx[n] - (n - d) * Mx[n],
                    (t - d) * Mx + Rx - Rx[n] - (n - d) * Mx[n])
    C = np.where(alive, sa / 1000 * (Mx - Mx[n] + ch * incr), 0.0)    # V!C3 장래 사망보험금
    D = 0.0 if sub else np.where(alive, bp * (Nx[np.maximum(t, m)] - Nx[n]), 0.0)  # V!D3
    E = np.where(t <= m, NLx - NLx[m], 0.0)                           # V!E3 장래 보험료의 기수
    den = np.where(Dx > 0, Dx, 1.0)
    return np.round(np.where(alive & (Dx > 0), (C + D - beta_net * E) / den, 0.0) * 1e5)


def surrender(V10, gross10, alpha10):
    """해약환급금·환급률 — 원본 `W` 시트 E·F·G·H열."""
    NC = alpha10 * face / 10                                          # 신계약비(가입금액당)
    Pf = gross10 * face / 10                                          # 영업보험료 1회 납입액
    k7 = min(m, sc_yr)
    t  = np.arange(len(V10))
    Vf = V10 * face / 10                                              # W!I6 책임준비금
    sc = NC * np.maximum(k7 - t, 0) / k7                              # W!F6 해지공제
    Wv = np.round(np.maximum(Vf - sc, 0))                             # W!G6 해약환급금
    SP = np.minimum(t, m) * mode * Pf                                 # W!E6 납입보험료 누계
    return Vf, sc, Wv, SP, np.divide(Wv, SP, out=np.zeros_like(Wv), where=SP > 0)


def solve(kind):
    """3종 한 세트 — (기수표, 보험료, 준비금 10만당, 환급 묶음)."""
    if kind == "미달체":
        ch, sub = 0.0, True
        k, kx = commutation(q_sub, f_app, i_app), commutation(q_sst, f_std, i_std)
    else:
        ch, sub = (inc if kind == "체증형" else 0.0), False
        k, kx = commutation(q_app, f_app, i_app), commutation(q_std, f_std, i_std)
    pr  = premium(k, ch, sub)
    V10 = reserve(k, pr["beta_net"], ch, sub)
    # 신계약비는 적용·표준 중 작은 쪽 — 원본 `조회!H5 = MIN(P!D13, '(표준)P'!E13)`
    a10 = min(xlround(pr["alpha"] * 1e5), xlround(premium(kx, ch, sub)["alpha"] * 1e5))
    return k, pr, V10, surrender(V10, xlround(pr["gross"] * 1e5), a10)


KIND = ["평준형", "체증형", "미달체"]
'''


def build_term_variants():
    """부록 M.5 #7 — 평준형 복습 → 체증형(Rx 기수) → 미달체(사망률 ×3) → 3종 비교·검산."""
    if not PREMIUM_SRC.exists():
        print(f"!! 원본 산출과정표 없음 — 정기보험 변형 예제 건너뜀: {PREMIUM_SRC}")
        return None
    src = read_src_cells(PREMIUM_SRC, ["위험률", "조회", "P", "(표준)P", "V",
                                       "미달P", "미달V", "미달표준P", "미달표준V"])
    rk, q, p = src["위험률"], src["조회"], src["P"]
    sp, mp, msp = src["(표준)P"], src["미달P"], src["미달표준P"]
    Vs, mV, mSV = src["V"], src["미달V"], src["미달표준V"]

    # ── 시트 1: 위험률 (원본 A5:W117 중 값이 든 열 + 미달체 O·P·Q·R)
    rows = [[cell(h, "s") for h, _ in TV_RISK_COLS]]
    for age in range(113):
        r = 5 + age
        rows.append([cell(age, "n")] + [
            cell(round(float(rk.get(f"{cl}{r}") or 0.0), 10), "n") for _, cl in TV_RISK_COLS[1:]
        ])
    risk_sheet = sheet_from_rows("sh-tv-risk", "위험률", rows, row_count=400, col_count=40)

    # ── 시트 2: 가정 (원본 `조회` 시트 파라미터 + 체증·미달체 파라미터)
    assume = [
        ("성별", int(q["C4"]), "1 = 남자, 2 = 여자 (조회!C4)"),
        ("가입나이", int(q["C5"]), "세 (조회!C5)"),
        ("만기나이", int(q["C6"]), "세 (조회!C6)"),
        ("보험기간", int(q["C7"]), "만기나이 − 가입나이 (조회!C7)"),
        ("납입기간", int(q["C8"]), "년 (조회!C8)"),
        ("납입주기", int(q["C10"]), "연 납입 횟수. 12 = 월납 (조회!C10)"),
        ("가입금액", int(q["C9"]), "만원 단위 — 10000 = 1억원 (조회!C9)"),
        ("보장금액", int(p["B4"]), "산출 기준 사망보험금(만원) (P!B4)"),
        ("예정이율", float(q["B12"]), "적용이율. v = 1/(1+i) (조회!B12)"),
        ("표준이율", float(q["D12"]), "표준책임준비금 이율 (조회!D12)"),
        ("α1", float(q["B14"]), "신계약비율 = 5% × min(보험기간, 20) (조회!B14)"),
        ("α2", float(q["C14"]), "신계약비 정액 = 10/1000 (조회!C14)"),
        ("β1", float(q["D14"]), "유지비율 (조회!D14)"),
        ("β2", float(q["E14"]), "유지비 정액 = 1.5/1000 (조회!E14)"),
        ("β'", float(q["F14"]), "납입후유지비 = 1/1000 (조회!F14)"),
        ("γ", float(q["G14"]), "수금비율 (조회!G14)"),
        ("β*", float(q["H14"]), "플러스보험기간용 — 이 예제에서는 쓰지 않는다 (조회!H14)"),
        ("β**", float(q["I14"]), "플러스보험기간용 — 이 예제에서는 쓰지 않는다 (조회!I14)"),
        ("해지공제상각기간", 7, "신계약비 상각기간(년). 실제로는 min(납입기간, 7) (W!F6)"),
        ("체증률", TV_INC,
         f"연 체증률. 원본 조회!C3(체증) 저장값은 {float(q['C3']):.0%}"
         " — 체증형을 보이려고 예제 기본값만 올려 두었다"),
        ("체증거치기간", 10, "체증이 시작되기 전 거치기간(년) — 원본 P!A7 수식의 상수 10"),
        ("미달할증배수", 3, "미달체 사망률 할증 배수 — 원본 위험률!O5 = MIN(K5*3,1)"),
        ("위험지수", float(q["E9"]), "미달체 위험지수(100 = 표준체, 300 = 미달체 요율 전부) (조회!E9)"),
    ]
    arows = [[cell("항목", "s"), cell("값", "s"), cell("비고", "s")]]
    arows += [[cell(k, "s"), cell(v, "n"), cell(note, "s")] for k, v, note in assume]
    assume_sheet = sheet_from_rows("sh-tv-assume", "가정", arows, row_count=60, col_count=10)

    # ── 원본 산출값(체증률 0% 상태로 저장된 파일) — 빌드 시점에 읽어 코드에 박아 둔다
    r6 = lambda x: round(float(x), 6)
    REF = [
        ("P!A7  평준 M*", r6(p["A7"])),
        ("P!B7  N*[m′]", r6(p["B7"])),
        ("P!D10 기준연납순보험료 10만당", float(p["D10"])),
        ("P!D19 순보험료 10만당", float(p["D19"])),
        ("P!D13 총신계약비 α 10만당", float(p["D13"])),
        ("P!D22 영업보험료 10만당", float(p["D22"])),
        ("(표준)P!D19 표준 순보험료 10만당", float(sp["D19"])),
        ("(표준)P!D22 표준 영업보험료 10만당", float(sp["D22"])),
        ("미달P!A7  미달체 M*", r6(mp["A7"])),
        ("미달P!B7  미달체 N*[m′]", r6(mp["B7"])),
        ("미달P!D10 미달 기준연납순보험료 10만당", float(mp["D10"])),
        ("미달P!D19 미달 순보험료 10만당", float(mp["D19"])),
        ("미달P!D13 미달 총신계약비 α 10만당", float(mp["D13"])),
        ("미달P!D22 미달 영업보험료 10만당", float(mp["D22"])),
        ("미달P!E22 미달 총납입보험료 10만당", float(mp["E22"])),
        ("미달P!B29 미달체 table값(순P 차)", float(mp["B29"])),
        ("미달P!B28 단위할증지수", r6(mp["B28"])),
        ("미달P!B31 보험료할증분(가입금액당)", float(mp["B31"])),
        ("조회!F10 미달체 영업보험료(가입금액당)", float(q["F10"])),
        ("미달표준P!A7  미달표준 M*", r6(msp["A7"])),
        ("미달표준P!D19 미달표준 순보험료 10만당", float(msp["D19"])),
        ("미달표준P!D22 미달표준 영업보험료 10만당", float(msp["D22"])),
        ("V!I4   평준 준비금 t=1 (10만당)", float(Vs["I4"])),
        ("V!I13  평준 준비금 t=10 (10만당)", float(Vs["I13"])),
        ("미달V!H4  미달 준비금 t=1 (10만당)", float(mV["H4"])),
        ("미달V!H13 미달 준비금 t=10 (10만당)", float(mV["H13"])),
        ("미달표준V!H13 미달표준 준비금 t=10 (10만당)", float(mSV["H13"])),
        ("[자기검증] 체증 Rx 항등식 = M*(Rx식) − Σ배율·Cx", 0.0),
    ]
    ref_lit = "REF = [\n" + "".join(f"    ({a!r}, {b!r}),\n" for a, b in REF) + "]\n"

    x0, mat, m = int(q["C5"]), int(q["C6"]), int(q["C8"])
    freq = int(q["C10"])
    design = (f"{x0}세 {'남자' if int(q['C4']) == 1 else '여자'}·{mat}세 만기·{m}년납"
              f"{' 월납' if freq == 12 else ''}")
    net10, gross10 = int(p["D19"]), int(p["D22"])
    mnet10, mgross10 = int(mp["D19"]), int(mp["D22"])
    msnet10, msgross10 = int(msp["D19"]), int(msp["D22"])

    sid = "sh-tv-risk"
    core = TV_LOAD + TV_COMM + TV_PRICE
    full = core + TV_RESERVE

    steps_items = [
        (2,
         "1단계 — 기준이 되는 평준형 (요약 복습)",
         "## 1단계 — 기준이 되는 평준형 (요약 복습)\n\n"
         "비교의 기준선부터 세웁니다. 사망률 `qx` → 계산기수(`lx·dx·Cx·Mx·Rx·Dx·Nx`) → "
         "`M*`·`N*[m′]` → 순보험료 → 영업보험료까지, **보험료 산출 예제(정기보험)** 와 똑같은 계산입니다.\n\n"
         "```\n"
         "M*        = (Mx − Mx+n) × 보장금액/1000                                 (P!A7, 체증 0)\n"
         "N*[m′]    = m·(NLx − NLx+m) − (m−1)/2·(DLx − DLx+m)                     (P!B7)\n"
         "순보험료   = M* / N*[m′]                                                 (P!C19)\n"
         "영업보험료 = (순보험료 + αㆍDLx/N*[m′] + β2/m′ + β′항) / (1 − β1 − γ)      (P!C22)\n"
         "```\n\n"
         "자세한 유도는 **보험료 산출 예제(정기보험)** 를 참고하세요 — 여기서는 결과만 확인하고 "
         "2단계(체증형)·3단계(미달체)로 넘어갑니다.\n\n"
         "> 현재 설계: **" + design + f" · 가입금액 {int(q['C9']) // 10000}억원**. "
         "원본 산출과정표의 순보험료 10만당 **" + f"{net10}" + "원**, 영업보험료 10만당 **"
         + f"{gross10}" + "원**과 같아야 합니다.",
         "평준형 기준 보험료",
         core + '''
k  = commutation(q_app, f_app, i_app)          # 적용 기초 — 7회 경험사망률 + 예정이율
pr = premium(k)                                # 체증 0 · 미달 아님 = 평준형
r5 = lambda v: round(float(v), 5)
print(f"기수표 {len(k)}행 (t = 0 … {len(k) - 1}) · v = 1/(1+{i_app}) = {1 / (1 + i_app):.10f}")
pd.DataFrame({
    "기준항목": ["M* (사망보험금 기수)", "N*[m′] (월납 납입기수)", "기준연납순보험료 10만당",
             "순보험료 10만당", "총신계약비 α 10만당", "베타순보험료 10만당",
             "영업보험료 10만당", "총납입보험료 10만당"],
    "산출값": [r5(pr["M"]), r5(pr["N"]), xlround(pr["base"] * 1e5), xlround(pr["net"] * 1e5),
            xlround(pr["alpha"] * 1e5), xlround(pr["beta_net"] * 1e5),
            xlround(pr["gross"] * 1e5), xlround(pr["gross"] * 1e5) * m * mode],
    "원본셀": ["P!A7", "P!B7", "P!D10", "P!D19", "P!D13", "P!H19", "P!D22", "P!E22"],
})''',
         "values"),
        (16,
         "2단계 — 체증형: Rx 기수로 늘어나는 급부를 담는다",
         "## 2단계 — 체증형: Rx 기수로 늘어나는 급부를 담는다\n\n"
         "**체증형**은 가입 후 **거치기간(10년)** 동안은 보험금이 그대로이고, 그 뒤부터 매년 "
         "가입금액의 `체증률`만큼 사망보험금이 올라가는 상품입니다. "
         "급부가 해마다 달라지므로 `Mx` 하나로는 표현되지 않고 **`Rx = ΣMx`** 가 필요합니다.\n\n"
         "원본 `P!A7` 수식 그대로:\n\n"
         "```excel\n"
         "=B4/1000*( 기수표!G4 - OFFSET(기수표!$G$4,보험기간,0)\n"
         "         + 체증*( OFFSET(기수표!$H$4,10,0) - OFFSET(기수표!$H$4,보험기간,0)\n"
         "                - (보험기간-10)*OFFSET(기수표!$G$4,보험기간,0) ) )\n"
         "```\n\n"
         "`G` = `Mx`, `H` = `Rx`이므로 괄호 안은 **`Rx+10 − Rx+n − (n−10)·Mx+n`** 입니다. "
         "`Rx = ΣMx`를 풀어 쓰면\n\n"
         "```\n"
         "Rx+10 − Rx+n − (n−10)·Mx+n = Σ(k=10..n−1) (Mx+k − Mx+n) = Σ(s=10..n−1) (s−9)·Cx+s\n"
         "```\n\n"
         "즉 **보험연도 s+1에 사망하면 보험금 배율이 `1 + 체증×max(s−9, 0)`** 이라는 뜻입니다 — "
         "11년차에 1+체증배, 12년차에 1+2×체증배 … 만기해에 1+(n−10)×체증배.\n\n"
         "아래 표의 `Rx 항등식 차이` 행은 **원본의 Rx 관용구**와 **배율×Cx 직접 합**이 같은지를 "
         "확인합니다 — 0이어야 정상입니다.\n\n"
         "> 원본 파일은 `조회!C3`(체증)이 **0%** 로 저장되어 있어 체증형 산출값 자체는 캐시가 없습니다. "
         "그래서 6단계 검산은 항상 체증 0%로 원본과 맞추고, 체증형은 이 **항등식**으로 검증합니다.",
         "체증 M* 구성 · 항등식 검증",
         core + '''
k = commutation(q_app, f_app, i_app)
Mx, Rx, Cx, t = (k[c].to_numpy() for c in ("Mx", "Rx", "Cx", "t"))
d = min(defer, n)
term = Rx[d] - Rx[n] - (n - d) * Mx[n]                # P!A7 괄호 안 = 체증항
lev, ris = premium(k, 0.0), premium(k, inc)           # 평준 / 체증
direct = sa / 1000 * (bmult(t[:n]) * Cx[:n]).sum()    # 배율 × Cx 직접 합
r5 = lambda v: round(float(v), 5)
print(f"사망보험금 배율 — 1~{d}년차 1.000배, {d + 1}년차 {bmult(d):.3f}배 … "
      f"{n}년차 {bmult(n - 1):.3f}배 (체증 {inc:.1%})")
pd.DataFrame({
    "구성요소": ["Rx (t=0, ΣMx)", f"Rx+{d}", f"Rx+n  (n={n})", f"(n−{d})·Mx+n",
             f"체증항 = Rx+{d} − Rx+n − (n−{d})·Mx+n", "M* 평준형",
             f"M* 체증형 {inc:.0%}", "M* 체증형 — 배율×Cx 직접 합", "Rx 항등식 차이",
             "체증형 순보험료 10만당", "체증형 영업보험료 10만당", "평준 대비 영업P 배수"],
    "기수값": [r5(Rx[0]), r5(Rx[d]), r5(Rx[n]), r5((n - d) * Mx[n]), r5(term),
            r5(lev["M"]), r5(ris["M"]), r5(direct), r5(ris["M"] - direct),
            xlround(ris["net"] * 1e5), xlround(ris["gross"] * 1e5),
            round(ris["gross"] / lev["gross"], 4)],
    "원본_수식위치": ["기수표!H4", "OFFSET(기수표!$H$4,10,0)", "OFFSET(기수표!$H$4,보험기간,0)",
              "(보험기간-10)*OFFSET(기수표!$G$4,보험기간,0)", "P!A7 괄호 안", "P!A7 (체증=0)",
              "P!A7", "— 검증용", "— 0이어야 정상", "P!D19", "P!D22", "—"],
})''',
         "values"),
        (34,
         "3단계 — 미달체: 사망률 ×3 할증",
         "## 3단계 — 미달체: 사망률 ×3 할증\n\n"
         "**미달체(표준미달체)** 는 건강상 이유로 표준체 요율을 그대로 쓸 수 없는 계약자입니다. "
         "원본은 위험률 시트에 **할증 사망률 열을 따로 두고** 그 열로 기수표를 다시 만듭니다.\n\n"
         "| 열 | 내용 | 원본 수식 |\n|---|---|---|\n"
         "| `O`·`P` | 사망율(qx) **×3** — 남/여 | `O5: =MIN(K5*3,1)` |\n"
         "| `Q`·`R` | 표준사망율(qx) **×3** — 남/여 | 표준율 `M`·`N`의 3배(1 상한) |\n\n"
         "기수표 쪽은 딱 두 군데만 바뀝니다 — `미달기수표!E4`가 `OFFSET(위험률!$O$5,…)`를 보고, "
         "`미달기수표!D5`에 `MAX(…, 0)`이 붙습니다(고령에서 `qx+fx`가 1을 넘는 것을 막음). "
         "납입면제 발생률 `F`·`G`는 그대로입니다.\n\n"
         "보험료 쪽 차이는 원본 `미달P` 시트에 그대로 드러납니다.\n\n"
         "- `미달P!B13 = 0` — **β′(납입후유지비) 항이 없습니다**\n"
         "- `미달P!A13 = C13*미달Dx/미달Nx_m + β2/납입주기` — α를 **반올림한 뒤**(`C13`) 곱합니다. "
         "평준형 `P!A13`은 반올림 전 기준연납순보험료를 씁니다\n"
         "- `미달P!E19 = 미달TOT/B16` — 베타순보험료에도 β′가 없습니다\n\n"
         "실제 상품은 미달체 요율을 통째로 쓰지 않고 **위험지수**로 보간합니다 — "
         "`미달P!B29 = 미달순P − 평준순P`(table값), `미달P!B28 = (위험지수−100)/(300−100)`, "
         "`미달P!B30 = table값 × 단위할증지수 × 가입금액/10`. 위험지수 300이 미달체 요율 100% 반영입니다.\n\n"
         "원본 값(10만당): 미달 순보험료 **" + f"{mnet10}" + "** · 영업보험료 **" + f"{mgross10}" + "**, "
         "미달표준 순보험료 **" + f"{msnet10}" + "** · 영업보험료 **" + f"{msgross10}" + "**.",
         "미달체 기수 · 보험료 (경험×3 · 표준×3)",
         core + '''
kA  = commutation(q_app, f_app, i_app)     # 평준·적용 기초
kM  = commutation(q_sub, f_app, i_app)     # 미달체      — 원본 `미달기수표`
kMS = commutation(q_sst, f_std, i_std)     # 미달체 표준 — 원본 `미달표준기수표`(표준이율)
pA, pM, pMS = premium(kA), premium(kM, 0.0, True), premium(kMS, 0.0, True)
col = lambda pr: [round(float(pr["M"]), 5), round(float(pr["N"]), 5),
                  xlround(pr["base"] * 1e5), xlround(pr["net"] * 1e5),
                  xlround(pr["alpha"] * 1e5), xlround(pr["gross"] * 1e5),
                  xlround(pr["beta_net"] * 1e5)]
tbl = xlround(pM["net"] * 1e5) - xlround(pA["net"] * 1e5)   # 미달P!B29 table값
u   = (ridx - 100) / (300 - 100)                            # 미달P!B28 단위할증지수
add = tbl * u * face / 10                                   # 미달P!B30 보험료할증분
add = np.floor(add / 10) * 10 if add % 1 < 0.6 else np.ceil(add / 10) * 10   # 미달P!B31
base_p = xlround(pA["gross"] * 1e5) * face / 10
print(f"미달체 사망률 = 경험사망률 × {mult3:.0f} (1 상한) — 원본 위험률!O5 = MIN(K5*3,1)")
print(f"table값 {tbl:,.0f}원 × 단위할증지수 {u:.3f} × 가입금액 {face:,.0f}/10 → 할증분 {add:,.0f}원")
print(f"위험지수 {ridx:.0f} 계약 영업보험료 = {base_p:,.0f} + {add:,.0f} = "
      f"{base_p + add:,.0f}원 (원본 조회!F10)")
pd.DataFrame({
    "항목구분": ["M*", "N*[m′]", "기준연납순보험료 10만당", "순보험료 10만당",
             "총신계약비 α 10만당", "영업보험료 10만당", "베타순보험료 10만당"],
    "평준_적용": col(pA), "미달_경험x3": col(pM), "미달_표준x3": col(pMS),
})''',
         "values"),
        (48,
         "4단계 — 평준·체증·미달 3종 비교",
         "## 4단계 — 평준·체증·미달 3종 비교\n\n"
         "세 가지를 한 표에 놓습니다. 배수는 **평준형 대비** 값입니다.\n\n"
         "| 보종 | 무엇이 달라졌나 | 기수표 | 급부 |\n|---|---|---|---|\n"
         "| 평준형 | 기준 | `기수표` | 보험금 일정 |\n"
         "| 체증형 | 급부가 늘어난다 | 같은 `기수표` | 10년 거치 후 매년 체증 (`Rx` 항 추가) |\n"
         "| 미달체 | 기초율이 나빠진다 | `미달기수표` (qx ×3) | 보험금 일정 |\n\n"
         "**체증형은 기수표를 그대로 두고 급부만 바꾸고, 미달체는 급부를 그대로 두고 기수표를 다시 만듭니다.** "
         "체증형 배수는 체증률·거치기간·보험기간에 따라 달라지고, 미달체 배수는 사망률 할증에 붙지만 "
         "사업비(α·β·γ)가 섞여 **정확히 3배가 되지는 않습니다**.",
         "3종 보험료 비교표",
         full + '''
rows, base = [], None
for kind in KIND:
    k, pr, V10, wrap = solve(kind)
    if base is None:
        base = pr
    g10 = xlround(pr["gross"] * 1e5)
    rows.append({
        "보종": kind if kind != "체증형" else f"체증형 {inc:.0%}",
        "순보험료_10만당": xlround(pr["net"] * 1e5),
        "영업보험료_10만당": g10,
        "가입금액당_영업P": g10 * face / 10,
        "총납입_10만당": g10 * m * mode,
        "순P배수": round(pr["net"] / base["net"], 4),
        "영업P배수": round(pr["gross"] / base["gross"], 4),
    })
pd.DataFrame(rows)''',
         "values"),
        (58,
         "5단계 — 준비금·환급률 3종 곡선",
         "## 5단계 — 준비금·환급률 3종 곡선\n\n"
         "왼쪽은 **연말 책임준비금**(10만당), 오른쪽은 **해약환급률**입니다.\n\n"
         "- **체증형** 준비금은 장래 급부가 뒤로 갈수록 커지므로 평준형보다 훨씬 높고 정점도 늦습니다. "
         "원본 `V!C3`의 체증 `IF`가 `t ≤ 10`이면 가입시점과 같은 항을, `t > 10`이면 "
         "`(t−10)·Mx+t + Rx+t − Rx+n − (n−10)·Mx+n`을 쓰는 이유입니다(이미 오른 급부를 얹는다).\n"
         "- **미달체** 준비금은 사망률이 높아 장래 사망보험금 현가가 크지만 β′ 항이 없습니다(`미달V!D3 = 0`).\n"
         "- 환급률은 세 보종 모두 해지공제(미상각 신계약비)가 사라지는 " + f"{min(m, 7)}"
         + "년차 전에는 낮습니다. 신계약비가 큰 보종일수록 초기 환급률이 더 눌립니다.\n\n"
         "> 원본에는 체증형·미달체용 `W`(해약환급금) 시트가 없습니다. 여기서는 평준형과 같은 "
         "해지공제 규칙(`W!F6`)에 각 보종의 신계약비·영업보험료를 넣은 **참고값**입니다.",
         "3종 준비금 · 환급률 곡선",
         full + '''
import matplotlib.pyplot as plt
COLOR = {"평준형": "#4A90C2", "체증형": "#C2704A", "미달체": "#7BA05B"}
t = np.arange(1, n + 1)
fig, ax = plt.subplots(1, 2, figsize=(10.5, 3.8))
for kind in KIND:
    k, pr, V10, (Vf, sc, Wv, SP, rate) = solve(kind)
    lab = kind if kind != "체증형" else f"체증형 {inc:.0%}"
    ax[0].plot(t, V10[t], color=COLOR[kind], lw=1.6, label=lab)
    ax[1].plot(t, rate[t] * 100, color=COLOR[kind], lw=1.6, label=lab)
ax[0].set_title("연말 책임준비금 (10만당)"); ax[0].set_xlabel("경과년")
ax[1].axhline(100, color="#999999", lw=1, ls="--")
ax[1].axvline(min(m, sc_yr), color="#999999", lw=1, ls=":")
ax[1].set_title("해약환급률 (%)"); ax[1].set_xlabel("경과년")
for a in ax:
    a.grid(alpha=0.3); a.legend(fontsize=8)
fig.tight_layout()
fig''',
         "object"),
        (66,
         "6단계 — 원본 `P`·`미달P` 대조 검산",
         "## 6단계 — 원본 `P`·`미달P` 대조 검산\n\n"
         "원본 산출과정표(" + design + ")의 산출값과 위 코드의 계산값을 한 표에서 맞춰 봅니다. "
         "`검산차이`가 모두 0이면 원본과 완전히 일치한다는 뜻입니다.\n\n"
         "대조 대상은 보험료 네 시트(적용 `P` · 표준 `(표준)P` · 미달 `미달P` · 미달표준 `미달표준P`)와 "
         "준비금 세 시트(`V` · `미달V` · `미달표준V`)입니다.\n\n"
         "> **원본 파일은 `조회!C3`(체증)이 0% 상태로 저장**되어 있으므로 이 표는 항상 **체증 0%** 로 "
         "계산합니다 — `가정!체증률`을 바꿔도 이 표는 흔들리지 않습니다. "
         "마지막 행만은 원본 대조가 아니라 **체증 `Rx` 항등식 자기검증**(기댓값 0)입니다.\n\n"
         "> 나머지 `가정` 항목(가입나이·보험기간·이율·사업비율 등)을 고치면 원본과 차이가 벌어지는 것이 "
         "정상입니다 — 검산은 기본 설계로 되돌린 뒤 보세요.",
         "원본 대조 검산표",
         full + "\n" + ref_lit + '''
kA  = commutation(q_app, f_app, i_app)
kS  = commutation(q_std, f_std, i_std)
kM  = commutation(q_sub, f_app, i_app)
kMS = commutation(q_sst, f_std, i_std)
pA, pS = premium(kA), premium(kS)
pM, pMS = premium(kM, 0.0, True), premium(kMS, 0.0, True)
VA  = reserve(kA, pA["beta_net"])
VM  = reserve(kM, pM["beta_net"], 0.0, True)
VMS = reserve(kMS, pMS["beta_net"], 0.0, True)
gA10 = xlround(pA["gross"] * 1e5)
tbl = xlround(pM["net"] * 1e5) - xlround(pA["net"] * 1e5)     # 미달P!B29
u   = (ridx - 100) / (300 - 100)                              # 미달P!B28
b30 = tbl * u * face / 10                                     # 미달P!B30
b31 = np.floor(b30 / 10) * 10 if b30 % 1 < 0.6 else np.ceil(b30 / 10) * 10   # 미달P!B31
Cx, t = kA["Cx"].to_numpy(), kA["t"].to_numpy()
ident = mstar(kA, inc) - sa / 1000 * (bmult(t[:n]) * Cx[:n]).sum()   # 체증 항등식(0이어야 함)
calc = [pA["M"], pA["N"], xlround(pA["base"] * 1e5), xlround(pA["net"] * 1e5),
        xlround(pA["alpha"] * 1e5), gA10,
        xlround(pS["net"] * 1e5), xlround(pS["gross"] * 1e5),
        pM["M"], pM["N"], xlround(pM["base"] * 1e5), xlround(pM["net"] * 1e5),
        xlround(pM["alpha"] * 1e5), xlround(pM["gross"] * 1e5),
        xlround(pM["gross"] * 1e5) * m * mode,
        tbl, u, b31, gA10 * face / 10 + b31,
        pMS["M"], xlround(pMS["net"] * 1e5), xlround(pMS["gross"] * 1e5),
        VA[1], VA[10], VM[1], VM[10], VMS[10], ident]
chk = pd.DataFrame({"원본항목": [a for a, _ in REF],
                    "원본값": [b for _, b in REF],
                    "계산값": [round(float(x), 6) for x in calc]})
chk["검산차이"] = (chk["계산값"] - chk["원본값"]).round(6)
print("최대 검산차이:", chk["검산차이"].abs().max())
chk''',
         "values"),
    ]

    blocks = steps(sid, 17, "tv",
                   ("정기보험 변형 — 체증형·미달체 비교",
                    "# 정기보험 변형 — 체증형·미달체 비교\n\n"
                    "같은 정기보험을 **평준형 · 체증형 · 미달체** 세 가지로 산출해 나란히 비교합니다. "
                    "실제 보험료 산출과정표(경영인정기보험 무배당 1504)의 위험률과 파라미터를 그대로 담았습니다.\n\n"
                    "- **체증형** — 기수표는 그대로 두고 **급부가 10년 거치 후 매년 체증**합니다. "
                    "`Rx = ΣMx` 기수가 여기서 처음 쓰입니다 (원본 `P!A7`).\n"
                    "- **미달체** — 급부는 그대로 두고 **사망률을 ×3으로 할증**한 기수표를 새로 만듭니다 "
                    "(원본 `위험률!O·P` 열, `미달기수표`·`미달P`). 표준사망률 ×3(`Q`·`R` 열)도 함께 봅니다.\n\n"
                    "**구성**\n\n"
                    "- `위험률` 시트 — 나이 0~112세의 7회 경험·표준·우량체 사망률, 납입면제 발생률, "
                    "그리고 **미달체 사망률(×3)·미달표준 사망률(×3)** (원본 `위험률` 시트 A5:W117 중 값이 든 열)\n"
                    "- `가정` 시트 — 설계·이율·사업비율에 **체증률·체증거치기간·미달할증배수·위험지수**를 더한 것\n"
                    "- 오른쪽 R열부터 6단계의 [설명 + 코드] 블록\n\n"
                    "**읽는 법** — 그냥 **[전체 실행]** 을 누르세요. 각 블록은 `xl()`로 시트를 다시 읽어 단독 실행됩니다. "
                    "설명에는 원본 엑셀 수식을 그대로 인용해 두었으니 코드와 나란히 대조해 보세요.\n\n"
                    "> 현재 설계: **" + design + f" · 가입금액 {int(q['C9']) // 10000}억원 · "
                    f"체증률 {TV_INC:.0%} · 위험지수 {float(q['E9']):.0f}**"),
                   steps_items)
    blocks.append(md_block(
        "blk-tv-wrap", sid, 102, 17,
        "## 정리 — 가정 시트를 바꾸면 무엇이 달라지나\n\n"
        "모든 단계는 `가정` 시트만 보고 계산합니다. 값을 고치고 **[전체 실행]** 을 누르면 "
        "1단계부터 6단계까지 한 번에 다시 만들어집니다.\n\n"
        "| 바꾸는 값 | 일어나는 일 |\n|---|---|\n"
        "| `체증률` 0 → 0.2 | 2·4·5단계의 체증형만 움직입니다. 0으로 두면 체증형 = 평준형이 됩니다 |\n"
        "| `체증거치기간` 10 → 5 | 체증이 더 일찍 시작 → 체증형 보험료·준비금이 올라갑니다 |\n"
        "| `미달할증배수` | **표시용 값입니다** — 실제 할증률은 `위험률` 시트의 `미달사망률` 열에 이미 반영돼 있습니다. "
        "배수를 바꾸려면 위험률 열을 다시 만들어야 합니다 |\n"
        "| `위험지수` 175 → 300 | 3단계 단위할증지수 `(위험지수−100)/200`이 1이 되어 미달체 요율이 100% 반영됩니다 |\n"
        "| `성별` 1 → 2 | 여성 기초율(경험·표준·미달 모두)로 전 단계가 재계산됩니다 |\n"
        "| `가입나이`·`만기나이` | `보험기간`(= 만기나이 − 가입나이)도 같이 고쳐야 합니다 |\n"
        "| `납입기간` | N\\*[m′]와 해지공제 상각기간 min(납입기간, 7)이 함께 바뀝니다 |\n"
        "| `예정이율`·`표준이율` | 올리면 할인이 커져 보험료·준비금이 내려갑니다 |\n"
        "| `α1`·`α2`·`β1`·`β2`·`β′`·`γ` | 순보험료는 그대로, 영업보험료·해지공제가 바뀝니다 |\n\n"
        "**세 보종이 갈리는 지점만 다시 짚으면**\n\n"
        "| | 기수표 | 급부 | β′ 항 | α 반올림 |\n|---|---|---|---|---|\n"
        "| 평준형 | `기수표` | 일정 | 있음 | 반올림 전 값 (`P!A13`) |\n"
        "| 체증형 | `기수표` (같음) | `Rx` 항 추가 | 있음 | 반올림 전 값 |\n"
        "| 미달체 | `미달기수표` (qx ×3) | 일정 | **없음** (`미달P!B13 = 0`) | **반올림 후** (`미달P!C13`) |\n\n"
        "**원본과 다른 점 · 남는 차이**\n\n"
        "- 원본 `조회!C3`(체증)은 **0%** 로 저장되어 있어 체증형 산출값의 원본 캐시가 없습니다. "
        "그래서 6단계 검산은 체증 0%로 원본과 맞추고, 체증형은 `Rx` 항등식(2단계)으로 검증합니다.\n"
        "- 원본 `P!F36:H39`에 5~20% 체증형 순보험료 참고표가 있지만 **다른 설계**"
        "(가입나이 범위 평균·85세납, α2 최고한도 산출용)라 이 예제와 직접 대조되지 않습니다.\n"
        "- 원본에는 체증형·미달체용 `W`(해약환급금) 시트가 없어 5단계 환급률은 평준형 규칙을 적용한 참고값입니다.\n"
        "- `위험률!R`(여자 표준사망율 ×3)은 105~109세에서 `MIN(N×3, 1)`이 아닌 별도 조정값이 들어 있습니다 — "
        "원본 값을 그대로 내장했습니다.\n\n"
        "6단계의 `검산차이` 열이 모두 0이면 원본 산출과정표와 완전히 일치한다는 뜻입니다.",
        "정리 — 가정 시트를 바꾸면 무엇이 달라지나"))

    return workbook(
        "wb-sample-term-variants",
        "정기보험 변형 — 체증형·미달체 비교",
        [risk_sheet, assume_sheet],
        blocks,
    )


# ── 부록 M.5 #10 — 상해공제(직종축) ──────────────────────

ACC_SRC = Path(
    r"C:\Users\tklee\OneDrive - 코리안리재보험\0. 보험료 산출 방법서"
    r"\07_Sh어업인상해공제1601\무)Sh어업인상해공제1601_가입설계.xlsm"
)

#: 주계약 위험률 6종 — (워크북 열 이름, 원본 `위험율` 블록 머리 셀, 원본 제목)
#: 원본은 `OFFSET(위험율!$B$13, 주계약!$C$4, sex)`로 (직종, 성별)을 찍는다 — **나이 인수가 없다**.
ACC_RATES = [
    ("교통재해사망", "B13", "어업인 교통재해사망률(수협2회)"),
    ("일반재해사망", "B19", "어업인 일반재해사망률(수협2회)"),
    ("교통재해장해80", "B25", "어업인 80%교통재해장해(수협2회)"),
    ("일반재해장해80", "B31", "어업인 80%일반재해장해(수협2회)"),
    ("교통재해장해3_79", "B37", "어업인 3~79%교통재해장해(수협2회)"),
    ("일반재해장해3_79", "B43", "어업인 3~79%일반재해장해(수협2회)"),
]

#: 급부 4종 — (급부, 기수 키, 배율, 연금 연수, 원본 셀) = 원본 `주계약` H14:K16
ACC_BENEFITS = [
    ("교통재해사망", "TJSA", 5.0, 0, "주계약!H16"),
    ("일반재해사망", "YJSA", 3.0, 0, "주계약!I16"),
    ("재해소득보장(80%이상 장해)", "J80", 0.3, 10, "주계약!J16"),
    ("재해장해급여(3~79% 장해)", "J379", 2.0, 0, "주계약!K16"),
]

#: 상품 형태 2종 — 원본은 `가입설계!C4`(1:순수보장형 / 2:만기환급형)로 고르고,
#: `주계약`의 M5·C15·C17이 `IF(n=1,…,IF(n=5,…))`로 갈린다. n=5 가지는 파일의 캐시값과 대조한다.
ACC_FORMS = [
    # (형태, 상품코드, 보험기간 n, 납입기간 m, 만기환급률 RA, α2, β2)
    ("순수보장형", "A8611", 1, 1, 0.0, 0.17, 0.085),
    ("만기환급형(50%)", "A8612", 5, 5, 0.5, 0.50, 0.055),
]

AC_LOAD = '''# ── 가정 시트 — 값을 바꾸고 [전체 실행]하면 이후 모든 단계가 다시 계산된다
_p = xl("가정!A1:C11", headers=True)
P = dict(zip(_p["항목"], _p["값"]))
jong = int(P["직종"])          # 1 = A, 2 = B                          (가입설계!C5)
sex  = int(P["성별"])          # 1 = 남자, 2 = 여자                     (가입설계!C6)
x0   = int(P["가입나이"])       # 세 — 주계약 위험률은 연령과 무관하다     (가입설계!C7)
i    = float(P["예정이율"])     # 3.25%                                 (주계약!C11)
mm   = int(P["납입주기"])       # 연 납입 횟수. 12 = 월납                (주계약!C9)
S0   = float(P["기준금액"])     # 10만원 — 공제료 표시 단위               (주계약!C10)
a1   = float(P["α1"])          # 연납 신계약비율                        (주계약!C14)
b1   = float(P["β1"])          # 유지비                                (주계약!C16)
b3   = float(P["β3"])          # 유지비                                (주계약!C18)
gm   = float(P["γ"])           # 수금비 1.5%                           (주계약!C19)
v    = 1 / (1 + i)             # 주계약!AJ6 = (1+i)^-N

BEN = xl("가정!E1:I5", headers=True)     # 급부 4종·급부배율        (주계약!H14:K16)
FRM = xl("가정!K1:Q3", headers=True)     # 형태 2종·형태별 파라미터   (주계약!M5·C15·C17)
R   = xl("위험률!A1:I5", headers=True)   # 직종 × 성별 위험률 6종    (위험율!B13·B19·B25·B31·B37·B43)
JN  = ("A", "B")[jong - 1]


def xlround(val, d=0):
    """엑셀 ROUND = 사사오입. 파이썬 round()는 은행가 반올림이라 1원씩 어긋난다."""
    f = 10.0 ** d
    return float(np.sign(val) * np.floor(np.abs(val) * f + 0.5) / f)


def rate(jn, sx):
    """(직종, 성별) 위험률 한 줄 — 원본 OFFSET(위험율!$B$13, 주계약!$C$4, sex)."""
    return R[(R["직종"] == jn) & (R["성별"].astype(int) == sx)].iloc[0]
'''

AC_TABLE = '''

def commutation(jn, sx, top=5):
    """경과 0~top 기수표 — 원본 `주계약` Q6:AG11(명명범위 `기수`) 수식 그대로.

    이 상품의 위험률은 (직종, 성별)로만 정해지고 **연령과 무관**하다. 그래서 lx는
    등비수열이 되고, 기수표의 첫 열은 나이가 아니라 **경과년 0~5**다.
    """
    r  = rate(jn, sx)
    qT, qY = float(r["교통재해사망"]), float(r["일반재해사망"])
    q80 = float(r["교통재해장해80"]) + float(r["일반재해장해80"])
    q79 = float(r["교통재해장해3_79"]) + float(r["일반재해장해3_79"])
    t   = np.arange(top + 1)
    lx  = 100000.0 * (1 - qT - qY) ** t              # 주계약!R7  = R6*(1-R16-S16)
    l80 = 100000.0 * (1 - qT - qY - q80) ** t        # 주계약!U7  = U6*(1-R16-S16-V16-W16)
    D   = lx * v ** t                                # 주계약!S6  = R6*$AJ6
    N   = D[::-1].cumsum()[::-1]                     # 주계약!T6  = T7+S6
    d   = {"TJSA": lx * qT,                          # 주계약!V6  = $R6*R16
           "YJSA": lx * qY,                          # 주계약!W6  = $R6*S16
           "J80":  l80 * q80,                        # 주계약!X6  = $U6*(V16+W16)
           "J379": lx * q79}                         # 주계약!Y6  = $R6*(T16+U16)
    C   = {k: d[k] * v ** (t + 0.5) for k in d}      # 주계약!Z6  = V6*$AK6
    M   = {k: C[k][::-1].cumsum()[::-1] for k in C}  # 주계약!AD6 = Z6+AD7
    return dict(t=t, lx=lx, l80=l80, D=D, N=N, d=d, C=C, M=M)


def multiples():
    """급부배율 — 원본 `주계약` H16:K16. 재해소득보장만 10년 확정연금 현가다."""
    w  = BEN["배율"].to_numpy(float).copy()
    yr = BEN["연수"].to_numpy(float)
    a  = yr > 0
    w[a] = w[a] * (1 - v ** yr[a]) / (1 - v)         # 주계약!J16 = 0.3*(1-AJ7^10)/(1-AJ7)
    return w
'''

AC_PRICE = '''

def price(jn, sx, form):
    """원본 `주계약` H5·I5·J5·L5 — 형태별 파라미터(RA·α2·β2)로만 갈린다.

    원본 `주계약!I3`에 적힌 산식 그대로:
        분모 = TNX2 − (RA·M·MP·DX(N)) / (1 − MP·ALPHA2·DX(0)/TNX2 − BETA2 − GAMMA)
    """
    f = FRM[FRM["형태"] == form].iloc[0]
    n, m = int(f["보험기간"]), int(f["납입기간"])
    RA, a2, b2 = float(f["만기환급률"]), float(f["α2"]), float(f["β2"])
    k, w = commutation(jn, sx), multiples()
    num  = float(sum(w[j] * (k["M"][key][0] - k["M"][key][n])
                     for j, key in enumerate(BEN["기수"])))            # 주계약!J10 SUMPRODUCT
    TNX2 = mm * ((k["N"][0] - k["N"][m])
                 - (mm - 1) / (2 * mm) * (k["D"][0] - k["D"][m]))      # 주계약!H10 월납 납입기수
    TNXy = k["N"][0] - k["N"][m]                                       # 주계약!H11 연납 납입기수
    La   = a2 * mm * k["D"][0] / TNX2                                  # 주계약!L10 α항
    MT   = RA * m * mm * k["D"][n]                                     # 주계약!M10 만기환급 현가항
    Nm   = 1 - La - b2 - gm                                            # 주계약!N10 분모계수
    Pm   = num / (TNX2 - MT / Nm)                                      # 주계약!J5  순공제료(월납)
    Gm   = Pm / Nm                                                     # 주계약!L5  영업공제료(월납)
    Ly   = a1 * k["D"][0] / TNXy                                       # 주계약!L11 (연납은 α1을 쓴다)
    Ny   = 1 - Ly - b2 - gm                                            # 주계약!N11
    Py   = num / (TNXy - RA * m * 1 * k["D"][n] / Ny)                  # 주계약!J6  순공제료(연납)
    Gy   = Py / Ny                                                     # 주계약!L6  영업공제료(연납)
    gross = xlround(Gm * S0)                                           # 주계약!D21 ROUND(L5*10만,0)
    return dict(form=form, n=n, m=m, RA=RA, a2=a2, b2=b2, k=k, w=w, num=num,
                TNX2=TNX2, TNXy=TNXy, La=La, MT=MT, Nm=Nm, Ny=Ny,
                Pm=Pm, Gm=Gm, Py=Py, Gy=Gy, gross=gross,
                net_m=xlround(Pm * S0),                                # 주계약!D22
                net_y=xlround(xlround(Py, 5) * S0),                    # 보험료!AC9 = ROUND(K6,5)*10만
                mat=xlround(RA * m * mm * gross))                      # 만기환급금 = RA × 납입총액

def breakdown(r):
    """산출 단계 표 — 원본 `주계약` 시트의 셀 하나하나에 대응한다."""
    item = [
        ("공제기간 n", r["n"], "주계약!C7"),
        ("납입기간 m", r["m"], "주계약!C8"),
        ("만기환급률 RA", r["RA"], "주계약!M5"),
        ("신계약비율 α2", r["a2"], "주계약!C15"),
        ("유지비율 β2", r["b2"], "주계약!C17"),
        ("수금비율 γ", gm, "주계약!C19"),
        ("급부 현가 SUM = Σ 배율×(Mx0−Mxn)", r["num"], "주계약!J10"),
        (f"납입기수 TNX2 (연 {mm}회)", r["TNX2"], "주계약!H10"),
        ("α항 = α2·mm·Dx(0)/TNX2", r["La"], "주계약!L10"),
        ("만기환급 현가항 = RA·m·mm·Dx(n)", r["MT"], "주계약!M10"),
        ("분모계수 N* = 1−α항−β2−γ", r["Nm"], "주계약!N10"),
        ("분모 = TNX2 − 만기환급항/N*", r["TNX2"] - r["MT"] / r["Nm"], "주계약!I5"),
        ("순공제료 P (월납)", r["Pm"], "주계약!J5"),
        ("영업공제료 G = P/N* (월납)", r["Gm"], "주계약!L5"),
        ("10만원당 영업공제료", r["gross"], "주계약!D21"),
        ("10만원당 순공제료 (월납)", r["net_m"], "주계약!D22"),
        ("10만원당 순공제료 (연납)", r["net_y"], "보험료!AC9"),
        ("만기환급금 = RA·m·mm·영업공제료", r["mat"], "PV테이블 연시준비금"),
    ]
    return pd.DataFrame({"항목": [a for a, _, _ in item],
                         "값": [float(b) for _, b, _ in item],
                         "원본": [c for _, _, c in item]})
'''


def build_accident_class():
    """부록 M.5 #10 — 직종축 위험률 → 경과 기수표 → 순수보장형·만기환급형 → 원본 대조."""
    if not ACC_SRC.exists():
        print(f"!! 원본 없음 — 상해공제(직종축) 예제 건너뜀: {ACC_SRC}")
        return None
    src = read_src_cells(ACC_SRC, ["위험율", "주계약", "가입설계", "PV테이블"])
    rk, jg, gs, pv = src["위험율"], src["주계약"], src["가입설계"], src["PV테이블"]
    f10 = lambda a: round(float(rk[a]), 10)

    # ── 시트 1: 위험률 (직종 A/B × 남/여 × 6종) — 원본 6블록을 한 표로 눕힌 것
    head = ["직종", "성별", "재해사망_계"] + [nm for nm, _, _ in ACC_RATES]
    rows = [[cell(h, "s") for h in head]]
    for jn, jrow in (("A", 0), ("B", 1)):
        for sx in (1, 2):
            col = "CD"[sx - 1]
            line = [cell(jn, "s"), cell(sx, "n"),
                    cell(f10(f"{col}{8 + jrow}"), "n")]     # 위험율!B5 블록 = 교통 + 일반
            for _, base, _ in ACC_RATES:
                r0 = int(base[1:]) + 1 + jrow               # OFFSET(base, 직종, 성별)
                line.append(cell(f10(f"{col}{r0}"), "n"))
            rows.append(line)
    risk_sheet = sheet_from_rows("sh-ac-risk", "위험률", rows, row_count=220, col_count=48)

    # ── 시트 2: 특약위험률 (연령축) — 재해수술·재해골절. 주계약과 축이 다르다는 것을 보이려고 담는다
    ages = [a for a in range(200) if isinstance(rk.get(f"G{9 + a}"), int)]
    rrows = [[cell(h, "s") for h in
              ("나이", "재해수술_남", "재해수술_여", "재해골절_남", "재해골절_여")]]
    for a in ages:
        r0 = 9 + a
        rrows.append([cell(a, "n")] + [cell(f10(f"{c}{r0}"), "n") for c in ("H", "I", "L", "M")])
    rider_sheet = sheet_from_rows("sh-ac-rider", "특약위험률", rrows,
                                  row_count=len(rrows) + 20, col_count=8)

    # ── 시트 3: 가정 — A:C 파라미터, E:I 급부배율, K:Q 형태별 파라미터
    i_rate = float(jg["C11"])
    mm_pay = int(jg["C9"])
    S_base = float(jg["C10"])
    jong0, sex0, age0 = int(gs["C5"]), int(gs["C6"]), int(gs["C7"])
    # 파일의 캐시값은 만기환급형(n=5) 가지다 — 하드코딩한 상수가 원본과 같은지 확인한다
    assert abs(ACC_FORMS[1][4] - float(jg["M5"])) < 1e-12, "RA"
    assert abs(ACC_FORMS[1][5] - float(jg["C15"])) < 1e-12, "α2"
    assert abs(ACC_FORMS[1][6] - float(jg["C17"])) < 1e-12, "β2"
    assert abs(ACC_BENEFITS[0][2] - float(jg["H16"])) < 1e-12, "급부배율"
    params = [
        ("직종", jong0, "1 = A, 2 = B — 2로 바꾸면 B직종 기초율로 전 단계 재계산 (가입설계!C5)"),
        ("성별", sex0, "1 = 남자, 2 = 여자 (가입설계!C6)"),
        ("가입나이", age0, "세 — 주계약 위험률에 연령 축이 없어 공제료는 바뀌지 않는다 (가입설계!C7)"),
        ("예정이율", i_rate, "v = 1/(1+i) (주계약!C11)"),
        ("납입주기", mm_pay, "연 납입 횟수. 12 = 월납 (주계약!C9)"),
        ("기준금액", S_base, "공제료 표시 단위 10만원 (주계약!C10)"),
        ("α1", float(jg["C14"]), "연납 신계약비율 — 이 상품은 0 (주계약!C14)"),
        ("β1", float(jg["C16"]), "유지비 — 이 상품은 0 (주계약!C16)"),
        ("β3", float(jg["C18"]), "유지비 — 이 상품은 0 (주계약!C18)"),
        ("γ", float(jg["C19"]), "수금비율 (주계약!C19)"),
    ]
    ben_head = ["급부", "기수", "배율", "연수", "원본"]
    frm_head = ["형태", "상품코드", "보험기간", "납입기간", "만기환급률", "α2", "β2"]
    arows = [[cell("항목", "s"), cell("값", "s"), cell("비고", "s"), None]
             + [cell(h, "s") for h in ben_head] + [None]
             + [cell(h, "s") for h in frm_head]]
    for idx, (key, val, note) in enumerate(params):
        line = [cell(key, "s"), cell(val, "n"), cell(note, "s"), None]
        if idx < len(ACC_BENEFITS):
            nm, ky, mul, yr, org = ACC_BENEFITS[idx]
            line += [cell(nm, "s"), cell(ky, "s"), cell(mul, "n"), cell(yr, "n"), cell(org, "s")]
        else:
            line += [None] * 5
        line.append(None)
        if idx < len(ACC_FORMS):
            line += [cell(v, "s" if isinstance(v, str) else "n") for v in ACC_FORMS[idx]]
        arows.append(line)
    assume_sheet = sheet_from_rows("sh-ac-assume", "가정", arows, row_count=40, col_count=20)

    # ── 시트 4: 검산 — 원본 `PV테이블` 공제료 블록(AD3:AX742) 중 주계약 8행만
    #    `보험료` 시트(A1:AC2569)는 이 상품이 아니라 **템플릿 원본(암 상품) 잔재**라 쓰지 않는다.
    pvrow = lambda r: {c: pv.get(f"{c}{r}") for c in
                       ("AE", "AH", "AJ", "AN", "AO", "AP", "AR", "AV", "AW")}
    codes = {c: (nm, n) for nm, c, n, _, _, _, _ in ACC_FORMS}
    # 적용책임준비금 블록(B:AA)의 연시준비금 — 경과 n = 만기환급금
    mat_at = {}
    for r in range(3, 300):
        if pv.get(f"C{r}") in codes and pv.get(f"J{r}") == 0:
            mat_at[(pv[f"C{r}"], int(pv[f"F{r}"]), int(pv[f"H{r}"]), int(pv[f"R{r}"]))] = \
                float(pv.get(f"U{r}") or 0.0)
    chk_head = ["상품코드", "형태", "직종", "성별", "보기", "납기", "납방",
                "영업공제료", "순공제료", "순공제료기준", "만기환급금", "기준금액"]
    crows = [[cell(h, "s") for h in chk_head]]
    check_ref = []
    for r in range(3, 11):
        d = pvrow(r)
        code = d["AE"]
        assert code in codes, code
        form, n = codes[code]
        jn, sx = ("A" if int(d["AH"]) == 101 else "B"), int(d["AJ"])
        basis = "연납" if n == 1 else "월납"
        mat = mat_at.get((code, int(d["AH"]), sx, n), 0.0)
        crows.append([cell(code, "s"), cell(form, "s"), cell(jn, "s"), cell(sx, "n"),
                      cell(int(d["AN"]), "n"), cell(int(d["AO"]), "n"), cell(int(d["AP"]), "n"),
                      cell(float(d["AV"]), "n"), cell(float(d["AW"]), "n"), cell(basis, "s"),
                      cell(mat, "n"), cell(float(pv[f"AX{r}"]), "n")])
        check_ref.append((code, form, jn, sx, float(d["AV"]), float(d["AW"]), basis, mat))
    check_sheet = sheet_from_rows("sh-ac-check", "검산", crows, row_count=30, col_count=16)

    # ── 원본 산출값(기본 설계) — 마크다운에 박아 두는 기준값
    sxn = "남자" if sex0 == 1 else "여자"
    jn0 = "A" if jong0 == 1 else "B"
    design = (f"직종 {jn0} · {sxn} · {age0}세 · 월납 · 예정이율 {i_rate * 100:.2f}%"
              f" · 기준금액 {S_base:,.0f}원")
    pick = lambda code, idx: next(r[idx] for r in check_ref
                                  if r[0] == code and r[2] == jn0 and r[3] == sex0)
    g_pure, g_matu, m_matu = pick("A8611", 4), pick("A8612", 4), pick("A8612", 7)

    names_lit = "[" + ", ".join(
        f'("{nm}", "위험율!{b}", "{t}")' for nm, b, t in ACC_RATES) + "]"
    rider_ref = f"특약위험률!A1:E{len(rrows)}"
    core = AC_LOAD + AC_TABLE
    full = core + AC_PRICE
    sid = "sh-ac-risk"

    steps_items = [
        (2,
         "1단계 — 위험률: 직종 A/B라는 두 번째 축",
         "## 1단계 — 위험률: 직종 A/B라는 두 번째 축\n\n"
         "보통의 위험률표는 **나이 × 성별**입니다. 이 상품은 다릅니다 — 주계약 위험률에 "
         "**나이 축이 아예 없고**, 대신 **직종 A/B**가 들어옵니다.\n\n"
         "```\n"
         "주계약!R16 (교통재해사망)      = OFFSET(위험율!$B$13, 주계약!$C$4, sex)\n"
         "주계약!S16 (일반재해사망)      = OFFSET(위험율!$B$19, 주계약!$C$4, sex)\n"
         "주계약!V16 (80% 교통재해장해)   = OFFSET(위험율!$B$25, 주계약!$C$4, sex)\n"
         "주계약!W16 (80% 일반재해장해)   = OFFSET(위험율!$B$31, 주계약!$C$4, sex)\n"
         "주계약!T16 (3~79% 교통재해장해) = OFFSET(위험율!$B$37, 주계약!$C$4, sex)\n"
         "주계약!U16 (3~79% 일반재해장해) = OFFSET(위험율!$B$43, 주계약!$C$4, sex)\n"
         "```\n\n"
         "`OFFSET(기준셀, 행, 열)`의 **행 인수가 `주계약!$C$4`(직종)** 이고 **열 인수가 `sex`** 입니다. "
         "나이를 찍는 자리가 없습니다 — 즉 **50세든 20세든 주계약 공제료는 같습니다.** "
         "원본 `PV테이블`의 주계약 행이 `나이 = 0` 한 줄뿐인 것이 그 증거입니다.\n\n"
         "### 왜 직종인가\n\n"
         "어업인 상해공제의 위험은 나이보다 **무슨 일을 하는가**에 크게 좌우됩니다. "
         "생명보험이 나이로 위험을 가르는 자리를, 이 상품은 직종으로 가릅니다. "
         "A직종의 재해사망률이 B직종보다 4~5할 높습니다.\n\n"
         "### 재해사망률 = 교통 + 일반\n\n"
         "원본 `위험율!B5` 블록의 「어업인 재해사망률(수협2회)」은 그 아래 두 블록 "
         "(교통재해사망 `B11` + 일반재해사망 `B17`)의 **합**입니다. 코드가 그것을 확인합니다.\n\n"
         "### 특약은 축이 반대다\n\n"
         "같은 파일의 특약(재해수술·재해골절·재해입원)은 **연령별**이고 **직종 구분이 없습니다** "
         "(원본 `위험율!G8:Q111`, 수협3회). 이 예제는 `특약위험률` 시트에 재해수술률·재해골절발생률을 담아 "
         "두 축의 차이를 눈으로 볼 수 있게 했습니다.\n\n"
         "> 특약 공제료 산출(`특약!H5 = H10/$K10`, `특약!K5 = H5/(1−$C17−$C19)`)은 "
         "이 예제의 범위 밖입니다 — 여기서는 주계약만 끝까지 따라갑니다.",
         "직종 × 성별 위험률 6종 · 특약 연령축 대조",
         core + """
NAMES = """ + names_lit + """
tab = pd.DataFrame({"위험률": [a for a, _, _ in NAMES],
                    "원본 블록": [b for _, b, _ in NAMES],
                    "원본 제목": [c for _, _, c in NAMES]})
for jn in ("A", "B"):
    for sx in (1, 2):
        tab[f"{jn}_{'남' if sx == 1 else '여'}"] = [float(rate(jn, sx)[a]) for a, _, _ in NAMES]
tab["B/A_남"] = (tab["B_남"] / tab["A_남"]).round(3)
tab["B/A_여"] = (tab["B_여"] / tab["A_여"]).round(3)

gap = (R["교통재해사망"] + R["일반재해사망"] - R["재해사망_계"]).abs().max()
print(f"재해사망률(수협2회) = 교통재해사망 + 일반재해사망 — 최대 차이 {gap:.2e}")
for sx in (1, 2):
    a, b = float(rate("A", sx)["재해사망_계"]), float(rate("B", sx)["재해사망_계"])
    print(f"  재해사망률 {'남' if sx == 1 else '여'}  A {a:.6f} · B {b:.6f}  → B/A {b / a:.3f}")
print(f"\\n선택 조합: 직종 {JN} · {'남자' if sex == 1 else '여자'} · {x0}세"
      f" — 나이 {x0}은 주계약 공제료에 영향을 주지 않는다 (OFFSET에 나이 인수가 없다)")

RD = xl(\"""" + rider_ref + """\", headers=True)
print(f"\\n특약 위험률은 축이 반대다 — 연령별({int(RD['나이'].min())}~{int(RD['나이'].max())}세)이고"
      f" 직종 구분이 없다 (위험율!G8:M111, 수협3회)")
print(RD[RD["나이"].isin([0, 20, 40, 50, 60, 80, 100])].to_string(index=False))
tab""",
         "values"),
        (14,
         "2단계 — 직종별 기수표 (x축이 나이가 아니라 경과년)",
         "## 2단계 — 직종별 기수표 (x축이 나이가 아니라 경과년)\n\n"
         "위험률에 나이 축이 없으니 기수표의 첫 열도 나이가 아닙니다. 원본 `주계약!Q6:AG11`"
         "(명명범위 `기수`)의 첫 열은 **경과년 0~5**이고, radix는 경과 0에서 10만입니다.\n\n"
         "```\n"
         "주계약!R7  lx       = R6*(1−R16−S16)              ← 재해사망 2종으로만 줄어든다\n"
         "주계약!U7  lx(80)   = U6*(1−R16−S16−V16−W16)      ← 사망 2종 + 80%장해 2종\n"
         "주계약!S6  Dx       = R6*$AJ6                     ← AJ6 = (1+i)^-N\n"
         "주계약!T6  Nx       = T7+S6                       ← 아래에서 위로 누계\n"
         "주계약!V6  dx(TJSA) = $R6*R16\n"
         "주계약!X6  dx(J80)  = $U6*(V16+W16)               ← lx가 아니라 lx(80)에서 뽑는다\n"
         "주계약!Z6  Cx       = V6*$AK6                     ← AK6 = (1/(1+i))^(N+0.5)\n"
         "주계약!AD6 Mx       = Z6+AD7\n"
         "```\n\n"
         "### 생존자표가 둘인 이유\n\n"
         "| 표 | 줄어드는 사유 | 쓰이는 곳 |\n|---|---|---|\n"
         "| `lx` | 교통재해사망 + 일반재해사망 | 사망 급부 · 3~79% 장해 급부 · Dx·Nx(납입기수) |\n"
         "| `lx(80)` | 위 두 가지 + **80%이상 장해 2종** | 80%이상 장해(재해소득보장) 급부 |\n\n"
         "**80%이상 장해는 계약을 끝냅니다** — 소득보장 연금이 개시되고 더는 지급 사유가 남지 않습니다. "
         "그래서 그 급부만 탈퇴가 하나 더 붙은 `lx(80)`에서 뽑습니다. 반면 3~79% 장해는 계약이 "
         "이어지므로 `lx`에서 뽑습니다 — 같은 「장해」인데 생존자표가 다른 것이 이 상품의 함정입니다.\n\n"
         "> 위험률이 경과에 관계없이 일정하니 `lx`는 **등비수열**이 됩니다. 코드도 원본 재귀식 대신 "
         "`(1−q)^t` 한 줄로 적었습니다 — 값은 같습니다.",
         "경과 기수표 (원본 주계약!Q6:AG11)",
         core + """
k = commutation(JN, sex)
out = pd.DataFrame({"경과": k["t"], "lx": k["lx"], "lx(80)": k["l80"],
                    "Dx": k["D"], "Nx": k["N"]})
for key in BEN["기수"]:
    out[f"dx({key})"] = k["d"][key]
for key in BEN["기수"]:
    out[f"Cx({key})"] = k["C"][key]
for key in BEN["기수"]:
    out[f"Mx({key})"] = k["M"][key]
print(f"직종 {JN} · {'남자' if sex == 1 else '여자'} — 경과 0~{int(k['t'][-1])}년 기수표"
      f" ({len(out)}행 × {len(out.columns)}열, 원본 주계약!Q6:AG11과 같은 모양)")
print(f"  lx     10만 → {k['lx'][-1]:,.1f}   (재해사망만으로 줄어든 5년 뒤 생존자)")
print(f"  lx(80) 10만 → {k['l80'][-1]:,.1f}   (80%이상 장해까지 빠진 생존자)")
print(f"  D0 {k['D'][0]:,.2f} · D5 {k['D'][5]:,.2f} · N0 {k['N'][0]:,.2f}")
out.round(6)""",
         "values"),
        (26,
         "3단계 — 순수보장형(1년) 순·영업공제료",
         "## 3단계 — 순수보장형(1년) 순·영업공제료\n\n"
         "이 상품은 형태가 둘입니다 — 원본 `가입설계!C4`가 `1: 순수보장형 / 2: 만기환급형(50%)`이고, "
         "`가입설계!C8 = CHOOSE(C4, 1, 5)`가 공제기간을 **1년 또는 5년**으로 정합니다. "
         "형태가 바뀌면 기간뿐 아니라 사업비율까지 통째로 갈립니다.\n\n"
         "```\n"
         "주계약!M5  RA = IF(n=1, 0,    IF(n=5, 50%))     ← 만기환급률\n"
         "주계약!C15 α2 = IF(n=1, 17%,  IF(n=5, 50%))     ← 신계약비율\n"
         "주계약!C17 β2 = IF(n=5, 5.5%, IF(n=1, 8.5%))    ← 유지비율\n"
         "```\n\n"
         "순수보장형은 **RA = 0** — 만기에 돌려주는 것이 없습니다. 그러면 산식이 크게 간단해집니다.\n\n"
         "```\n"
         "주계약!J10 SUM   = SUMPRODUCT(H16:K16, H17:K17)   ← Σ 급부배율 × (Mx(0) − Mx(n))\n"
         "주계약!H10 TNX2  = mm*((N0 − Nm) − (mm−1)/(2*mm)*(D0 − Dm))\n"
         "주계약!L10 α항   = α2*mm*100000/H10               ← 100000 = Dx(0) = radix\n"
         "주계약!N10       = 1 − L10 − β2 − γ\n"
         "주계약!I5  분모  = H10 − M10/N10                  ← RA = 0이면 M10 = 0 → 분모 = TNX2\n"
         "주계약!J5  순P   = H5/I5\n"
         "주계약!L5  영업P = J5/N10\n"
         "주계약!D21       = ROUND(L5*100000, 0)            ← 10만원당 영업공제료\n"
         "```\n\n"
         "### 급부 4종과 배율\n\n"
         "| 급부 | 기수 | 배율 | 원본 |\n|---|---|---|---|\n"
         "| 교통재해사망 | Mx(TJSA) | 5배 | 주계약!H16 |\n"
         "| 일반재해사망 | Mx(YJSA) | 3배 | 주계약!I16 |\n"
         "| 재해소득보장(80%이상 장해) | Mx(J80) | 연 0.3배 × 10년 확정연금 | 주계약!J16 |\n"
         "| 재해장해급여(3~79% 장해) | Mx(J3~79) | 2배 | 주계약!K16 |\n\n"
         "재해소득보장만 배율이 상수가 아닙니다 — `= 0.3*(1−v^10)/(1−v)`, 즉 **연 0.3배를 10년간 주는 "
         "확정연금의 현가**(기시급)입니다. 예정이율을 바꾸면 이 배율도 같이 움직입니다.\n\n"
         "### β2·γ가 분모에 있는 이유\n\n"
         "유지비 β2와 수금비 γ는 순공제료가 아니라 **영업공제료 자체에 비례**합니다. "
         "`영업P = 순P + α항·영업P + β2·영업P + γ·영업P`를 영업P에 대해 풀면 분모로 내려옵니다.\n\n"
         "> 원본 산출값 — " + design + "의 순수보장형 10만원당 영업공제료는 **"
         + f"{g_pure:,.0f}" + "원**입니다.",
         "순수보장형 산출 단계 (RA = 0)",
         full + """
r = price(JN, sex, "순수보장형")
print(f"직종 {JN} · {'남자' if sex == 1 else '여자'} · 순수보장형 "
      f"({r['n']}년만기 {r['m']}년납 · 연 {mm}회 납입)")
print(f"  RA = {r['RA']:.0%} → 만기환급 현가항 M10 = {r['MT']:.1f} — 분모가 TNX2 그대로다")
print(f"  10만원당  영업 {r['gross']:,.0f}원 · 순(월납) {r['net_m']:,.0f}원"
      f" · 순(연납) {r['net_y']:,.0f}원")
breakdown(r)""",
         "values"),
        (48,
         "4단계 — 만기환급형(50%): 급부가 보험료에 비례할 때",
         "## 4단계 — 만기환급형(50%): 급부가 보험료에 비례할 때\n\n"
         "만기환급형은 5년 만기이고, 만기까지 유지하면 **낸 공제료의 50%를 돌려줍니다**. "
         "여기서 재미있는 문제가 생깁니다 — **만기 급부가 보험료의 함수**입니다.\n\n"
         "```\n"
         "주계약!M10 = RA * m * mm * VLOOKUP(n, 기수, 3, 0)   ← RA·m·mm·Dx(n)\n"
         "주계약!I5  = H10 − M10/N10                          ← 분모에서 빼는 항\n"
         "```\n\n"
         "만기환급금 = `RA × (m년 × mm회 × 영업공제료)` = **납입한 영업공제료 총액의 50%**입니다. "
         "그 현가는 `RA·m·mm·G·Dx(n)`이고 `G = P/N*`이므로:\n\n"
         "```\n"
         "P · TNX2 = SUM + RA·m·mm·G·Dx(n)\n"
         "         = SUM + RA·m·mm·Dx(n) · P/N*\n"
         "→  P · (TNX2 − RA·m·mm·Dx(n)/N*) = SUM\n"
         "→  P = SUM / (TNX2 − RA·m·mm·Dx(n)/N*)\n"
         "```\n\n"
         "**만기 생존급부 항이 분자에서 분모로 옮겨 간 것**입니다 — 원본 `주계약!I3`에 적힌 산식 "
         "`TNX2 - (RA * M * MP * DX(N)) / (1 - (MP * ALPHA2 * DX(0)) / TNX2 - BETA2 - GAMMA)` "
         "그대로입니다. 보통의 양로보험은 만기 생존급부를 분자(`Dx+n`)에 더하지만, 그것은 "
         "급부가 **가입금액**에 비례할 때 이야기입니다. 여기서는 급부가 **자기 자신(보험료)** 에 "
         "비례하므로 이항해서 분모로 보내야 합니다.\n\n"
         "> 시트의 `I2`·`I3` 두 줄 중 `I2`는 분모가 한 겹 더 중첩된 초안이고 실제 계산에 쓰인 것은 "
         "`I3`입니다(`주계약!I5` 수식이 `I3`과 일치). 이 예제는 `I3`을 옮겼습니다.\n\n"
         "### 형태가 바꾸는 것\n\n"
         "| | 순수보장형 | 만기환급형(50%) |\n|---|---|---|\n"
         "| 상품코드 | A8611 | A8612 |\n"
         "| 공제기간·납입기간 | 1년 | 5년 |\n"
         "| 만기환급률 RA | 0 | 50% |\n"
         "| 신계약비율 α2 | 17% | 50% |\n"
         "| 유지비율 β2 | 8.5% | 5.5% |\n\n"
         "α2가 17% → 50%로 뛰는 것은 **상각 기간이 1년에서 5년으로 늘기 때문**이고, β2가 8.5% → 5.5%로 "
         "내려가는 것은 1년짜리 계약의 유지비 부담이 상대적으로 크기 때문입니다.\n\n"
         "> 원본 산출값 — " + design + "의 만기환급형 10만원당 영업공제료 **"
         + f"{g_matu:,.0f}" + "원**, 만기환급금 **" + f"{m_matu:,.0f}" + "원** "
         "(원본 `PV테이블` 적용책임준비금 블록의 경과 5년 연시준비금과 같은 값).",
         "만기환급형 산출 단계 (RA = 50%)",
         full + """
r = price(JN, sex, "만기환급형(50%)")
p = price(JN, sex, "순수보장형")
print(f"직종 {JN} · {'남자' if sex == 1 else '여자'} · 만기환급형(50%) "
      f"({r['n']}년만기 {r['m']}년납 · 연 {mm}회 납입)")
print(f"  만기환급 현가항 M10 = RA·m·mm·Dx({r['n']}) = "
      f"{r['RA']}·{r['m']}·{mm}·{r['k']['D'][r['n']]:,.2f} = {r['MT']:,.2f}")
print(f"  분모 = TNX2 − M10/N10 = {r['TNX2']:,.2f} − {r['MT'] / r['Nm']:,.2f}"
      f" = {r['TNX2'] - r['MT'] / r['Nm']:,.2f}   (주계약!I5)")
print(f"  만기환급금 = {r['RA']:.0%} × {r['m']}년 × {mm}회 × {r['gross']:,.0f}원"
      f" = {r['mat']:,.0f}원")
CHK = xl("검산!A1:L9", headers=True)
_h = CHK[(CHK["형태"] == "만기환급형(50%)") & (CHK["직종"] == JN)
         & (CHK["성별"].astype(int) == sex)].iloc[0]
print(f"  원본 PV테이블 연시준비금(경과 {r['n']}) = {float(_h['만기환급금']):,.0f}원"
      f"  → 차이 {r['mat'] - float(_h['만기환급금']):+,.0f}원")
print(f"\\n순수보장형 대비 — 10만원당 영업공제료 {p['gross']:,.0f} → {r['gross']:,.0f}원"
      f" ({r['gross'] / p['gross']:.2f}배, 보장기간은 1년 → {r['n']}년)")
breakdown(r)""",
         "values"),
        (72,
         "5단계 — 직종 × 형태 공제료 매트릭스",
         "## 5단계 — 직종 × 형태 공제료 매트릭스\n\n"
         "이 상품의 요율표는 **형태 2 × 직종 2 × 성별 2 = 8칸**이 전부입니다. "
         "나이 축이 없어 요율표가 8줄에서 끝납니다 — 생명보험 요율표가 수천 줄인 것과 대조적입니다.\n\n"
         "표에서 읽을 것 세 가지:\n\n"
         "1. **직종 B가 A보다 싸다** — 재해사망률이 A직종의 70% 수준입니다.\n"
         "2. **여자가 남자보다 훨씬 싸다** — 어업 재해율의 성별 격차가 그대로 요율 격차가 됩니다.\n"
         "3. **만기환급형이 순수보장형보다 두 배쯤 비싸다** — 만기에 낸 돈의 절반을 돌려주기 때문입니다. "
         "다만 보장기간이 1년 → 5년으로 늘어난 것도 함께 반영돼 있어 단순 비교는 아닙니다.\n\n"
         "`순공제료율`(순 ÷ 영업)은 낸 돈 가운데 실제 보장에 쓰이는 몫입니다 — "
         "사업비 구조가 다르므로 형태별로 값이 갈립니다.",
         "형태 × 직종 × 성별 8칸 매트릭스",
         full + """
rec = []
for form in FRM["형태"]:
    for jn in ("A", "B"):
        for sx in (1, 2):
            r = price(jn, sx, form)
            rec.append({"형태": form, "직종": jn, "성별": "남" if sx == 1 else "여",
                        "보기": r["n"], "영업공제료": r["gross"],
                        "순공제료_월": r["net_m"], "순공제료_연": r["net_y"],
                        "만기환급금": r["mat"],
                        "순공제료율": round(r["net_m"] / r["gross"], 4)})
out = pd.DataFrame(rec)
for form in FRM["형태"]:
    s = out[out["형태"] == form]
    lo, hi = s["영업공제료"].min(), s["영업공제료"].max()
    print(f"{form:<16s} 10만원당 영업공제료 {lo:,.0f} ~ {hi:,.0f}원 (최대/최소 {hi / lo:.2f}배)")
for jn in ("A", "B"):
    for sx in (1, 2):
        a = out[(out["직종"] == jn) & (out["성별"] == ("남" if sx == 1 else "여"))]
        print(f"  직종 {jn} {'남' if sx == 1 else '여'}  순수보장형 "
              f"{a.iloc[0]['영업공제료']:>6,.0f}원 → 만기환급형 {a.iloc[1]['영업공제료']:>6,.0f}원")
out""",
         "values"),
        (86,
         "6단계 — 원본 요율 테이블 대조 검산",
         "## 6단계 — 원본 요율 테이블 대조 검산\n\n"
         "`검산` 시트는 원본 `PV테이블`의 **공제료 블록**(`AD3:AX742`)에서 주계약 8행을 그대로 옮긴 것입니다. "
         "원본 `가입설계!F37`이 실제로 이 표를 찾아 씁니다.\n\n"
         "```\n"
         "PV테이블!AD3 키 = AE3&AH3&AJ3&AR3&AN3   ← 상품코드 & 직종 & 성별 & 나이 & 보기\n"
         "가입설계!F37    = VLOOKUP(I37&I38&I39&I40&I41, PV테이블!$AD$3:$AX$742, 19, 0)*C15/100000\n"
         "가입설계!D15    = ROUND(주계약!L5, 5) * C15               ← 같은 값이 나와야 한다\n"
         "```\n\n"
         "### 원본 `보험료` 시트를 쓰지 않은 이유\n\n"
         "원본 파일에는 `보험료`(A1:AC2569) 시트도 있지만 그 안의 값은 **이 상품 것이 아닙니다.** "
         "상품코드가 `A7514`·`A7614`·`E2214`·`E2314`·`E2414`·`E2514`(암 담보 계열)이고 나이는 61~80세, "
         "보기는 80·10·5로 채워져 있습니다 — 이 가입설계 파일이 **암 상품 템플릿을 복사해 만들어진 흔적**입니다"
         "(숨은 시트 `고액암`·`특정암`·`고액암_표책`도 그대로 남아 있습니다). "
         "실제 어업인상해공제 주계약 코드는 `A8611`·`A8612`이고 나이는 0 한 줄뿐입니다. "
         "그래서 검산 기준은 살아 있는 `PV테이블`로 잡았습니다.\n\n"
         "### 순공제료 기준이 형태마다 다르다\n\n"
         "원본 테이블을 그대로 재현하다 발견한 것입니다.\n\n"
         "| 형태 | 영업공제료 | 순공제료 |\n|---|---|---|\n"
         "| 순수보장형 (A8611) | **월납** (`주계약!D21`) | **연납** (`ROUND(주계약!K6,5)×10만`) |\n"
         "| 만기환급형 (A8612) | **월납** (`주계약!D21`) | **월납** (`주계약!D22`) |\n\n"
         "1년만기·1년납인 순수보장형은 「1년치 순공제료 = 위험공제료」가 자연스러운 표기라 연납 기준으로 "
         "실린 것으로 보입니다. `검산` 시트의 `순공제료기준` 열에 그 기준을 적어 두었고, 코드도 행마다 "
         "해당 기준으로 비교합니다.\n\n"
         "**차이 열이 모두 0이면** 위험률 → 기수표 → 급부배율 → 순·영업공제료 → 만기환급금까지 "
         "원본 요율 테이블과 완전히 일치한다는 뜻입니다.\n\n"
         "> 같은 폴더의 `PTABLE.zip`·`VTABLE.zip`(요율·준비금 텍스트 원본)은 Fasoo DRM으로 암호화돼 있어 "
         "읽을 수 없었습니다. 검산은 xlsm 안의 `PV테이블`로 대신했습니다.",
         "원본 PV테이블 8행 대조 (차이 열)",
         full + """
CHK = xl("검산!A1:L9", headers=True)
rec = []
for _, row in CHK.iterrows():
    jn, sx, form = row["직종"], int(row["성별"]), row["형태"]
    r = price(jn, sx, form)
    net = r["net_y"] if row["순공제료기준"] == "연납" else r["net_m"]
    rec.append({"상품코드": row["상품코드"], "형태": form, "직종": jn,
                "성별": "남" if sx == 1 else "여",
                "원본_영업": float(row["영업공제료"]), "계산_영업": r["gross"],
                "차이_영업": r["gross"] - float(row["영업공제료"]),
                "순기준": row["순공제료기준"],
                "원본_순": float(row["순공제료"]), "계산_순": net,
                "차이_순": net - float(row["순공제료"]),
                "원본_만기환급금": float(row["만기환급금"]), "계산_만기환급금": r["mat"],
                "차이_만기": r["mat"] - float(row["만기환급금"])})
out = pd.DataFrame(rec)
for c in ("차이_영업", "차이_순", "차이_만기"):
    print(f"{c}  최대 절대차 {out[c].abs().max():,.10g}")
out""",
         "values"),
        (100,
         "7단계 — 직종·형태별 공제료와 급부 구성",
         "## 7단계 — 직종·형태별 공제료와 급부 구성\n\n"
         "왼쪽은 8칸 매트릭스를 막대로 그린 것입니다 — **직종 A > B, 남 > 여**의 순서가 형태와 무관하게 "
         "그대로 유지됩니다. 형태 안에서는 사업비율이 같으므로 위험률 비가 곧 요율 비가 되기 때문입니다.\n\n"
         "오른쪽은 선택한 조합의 **급부 4종이 급부 현가(SUM)에서 차지하는 몫**입니다.\n\n"
         "- 교통재해사망(5배)과 3~79% 장해급여(2배)가 대부분을 차지합니다 — "
         "배율이 크거나 발생률이 높거나 둘 중 하나입니다.\n"
         "- 80%이상 장해(재해소득보장)는 발생률이 10만분의 몇이라 배율이 커도 몫이 작습니다.\n"
         "- 형태가 바뀌어도 **구성비는 거의 같습니다** — 기간만 1년에서 5년으로 늘어날 뿐 "
         "급부배율과 위험률이 그대로이기 때문입니다.",
         "직종·형태별 공제료 · 급부 구성",
         full + """
import matplotlib.pyplot as plt
fig, ax = plt.subplots(1, 2, figsize=(11, 4))
lab = [f"{jn}·{'남' if sx == 1 else '여'}" for jn in ("A", "B") for sx in (1, 2)]
COL = ["#4A90C2", "#C2704A"]
w = 0.38
for q, form in enumerate(FRM["형태"]):
    val = [price(jn, sx, form)["gross"] for jn in ("A", "B") for sx in (1, 2)]
    pos = np.arange(4) + (q - 0.5) * w
    ax[0].bar(pos, val, w, label=form, color=COL[q])
    for px, vy in zip(pos, val):
        ax[0].text(px, vy, f"{vy:,.0f}", ha="center", va="bottom", fontsize=8)
ax[0].set_xticks(np.arange(4))
ax[0].set_xticklabels(lab)
ax[0].set_title("10만원당 영업공제료 — 직종 × 성별 × 형태")
ax[0].legend(fontsize=8)
ax[0].grid(alpha=0.3, axis="y")

names = list(BEN["급부"])
for q, form in enumerate(FRM["형태"]):
    r = price(JN, sex, form)
    part = np.array([r["w"][j] * (r["k"]["M"][key][0] - r["k"]["M"][key][r["n"]])
                     for j, key in enumerate(BEN["기수"])])
    share = part / part.sum() * 100
    pos = np.arange(len(names)) + (0.5 - q) * w
    ax[1].barh(pos, share, w, label=form, color=COL[q])
    for py, vy in zip(pos, share):
        ax[1].text(vy, py, f" {vy:.1f}%", va="center", fontsize=8)
ax[1].set_yticks(np.arange(len(names)))
ax[1].set_yticklabels([s.split("(")[0] for s in names], fontsize=8)
ax[1].set_xlim(0, 100)
ax[1].invert_yaxis()
ax[1].set_title(f"급부 현가 구성비 — 직종 {JN} · {'남자' if sex == 1 else '여자'}")
ax[1].legend(fontsize=8, loc="lower right")
ax[1].grid(alpha=0.3, axis="x")
fig.tight_layout()
fig""",
         "object"),
    ]

    blocks = steps(sid, 24, "ac",
                   ("상해공제 — 직종별 위험률·만기환급형",
                    "# 상해공제 — 직종별 위험률·만기환급형\n\n"
                    "무배당 Sh어업인상해공제(1601)의 실제 가입설계 파일에서 위험률·파라미터·요율 테이블을 "
                    "그대로 담았습니다. 이 예제의 주제는 **위험률의 축이 나이가 아니라 직종일 때** "
                    "계산기수와 보험료가 어떻게 달라지는가, 그리고 **만기환급금이 보험료에 비례할 때** "
                    "산식이 어떻게 뒤집히는가입니다.\n\n"
                    "**구성**\n\n"
                    "- `위험률` 시트 — 직종 A/B × 남/여 × 재해 위험률 6종 "
                    "(원본 `위험율`의 `B13`·`B19`·`B25`·`B31`·`B37`·`B43` 6블록, 수협2회)\n"
                    "- `특약위험률` 시트 — 연령축 재해수술률·재해골절발생률 (원본 `위험율!G8:M111`, 수협3회) "
                    "— 주계약과 축이 반대라는 것을 보이려고 담았습니다\n"
                    "- `가정` 시트 — A:C 파라미터(직종·성별·예정이율·납입주기·사업비율), E:I 급부배율 4종"
                    "(원본 `주계약!H14:K16`), K:Q 형태별 파라미터 2종(원본 `주계약!M5·C15·C17`)\n"
                    "- `검산` 시트 — 원본 `PV테이블` 공제료 블록의 주계약 8행(형태 2 × 직종 2 × 성별 2)\n"
                    "- 오른쪽 Y열부터 7단계의 [설명 + 코드] 블록\n\n"
                    "**읽는 법** — 설명을 읽고 코드 블록을 순서대로 실행하거나, 그냥 **[전체 실행]**을 누르세요. "
                    "각 블록은 `xl()`로 시트를 다시 읽어 단독 실행됩니다. 설명에는 원본 엑셀 수식을 그대로 "
                    "인용해 두었으니 코드와 나란히 대조해 보세요.\n\n"
                    "> 현재 설계: **" + design + "**"),
                   steps_items)
    blocks.append(md_block(
        "blk-ac-wrap", sid, 106, 24,
        "## 정리 — 축이 다른 상품에서 쉽게 틀리는 곳\n\n"
        "| 함정 | 무슨 일이 생기나 |\n|---|---|\n"
        "| 나이로 위험률을 찾으려 한다 | 이 상품의 주계약 위험률에는 나이 축이 없습니다. "
        "`OFFSET(위험율!$B$13, 직종, 성별)` — 인수 두 개가 전부입니다 |\n"
        "| 기수표의 x를 나이로 읽는다 | `주계약!Q6:AG11`의 첫 열은 **경과년 0~5**입니다. "
        "radix 10만은 가입 시점이지 0세가 아닙니다 |\n"
        "| 장해 급부를 `lx`에서 뽑는다 | 80%이상 장해만 `lx(80)`(탈퇴가 하나 더 붙은 표)에서 뽑습니다. "
        "3~79% 장해는 계약이 이어지므로 `lx`입니다 |\n"
        "| 만기환급금을 분자에 더한다 | 급부가 **가입금액**이 아니라 **납입보험료**에 비례하므로 "
        "이항해서 분모로 보내야 합니다 (`주계약!I5`) |\n"
        "| 형태별 사업비율을 잊는다 | 형태가 바뀌면 기간만이 아니라 α2(17%↔50%)·β2(8.5%↔5.5%)까지 갈립니다 |\n"
        "| 연금형 급부배율을 상수로 둔다 | 재해소득보장 배율 `0.3*(1−v^10)/(1−v)`는 **예정이율의 함수**입니다 |\n"
        "| 파이썬 `round()` | 은행가 반올림입니다. 엑셀 `ROUND`(사사오입)와 달라 10만원당 1원씩 어긋납니다 |\n\n"
        "**바꿔 보기** — `가정` 시트만 고치면 전 단계가 다시 계산됩니다.\n\n"
        "| 바꾸는 값 | 일어나는 일 |\n|---|---|\n"
        "| `직종` 1 → 2 | B직종 기초율. 6종 위험률이 모두 내려가 공제료가 3할 가까이 싸집니다 |\n"
        "| `성별` 2 → 1 | 남자 기초율. 어업 재해율의 성별 격차가 그대로 나타납니다 |\n"
        "| `가입나이` | **아무것도 바뀌지 않습니다.** 이 상품의 요율이 연령과 무관하다는 것을 확인하는 스위치입니다 |\n"
        "| `예정이율` | 올리면 할인이 커져 급부 현가가 줄지만, 만기환급 항의 현가도 함께 줄어 두 방향이 상쇄됩니다 |\n"
        "| `납입주기` 12 → 1 | 연납. `TNX2`의 (mm−1)/(2mm) 보정이 사라지고 α항도 달라집니다 |\n"
        "| `가정!G2:H5` 급부배율 | 교통재해사망 5배·재해장해 2배 같은 상품 구조 자체를 바꿉니다 |\n"
        "| `가정!O2:Q3` 형태 파라미터 | 만기환급률을 50% → 100%로 올리면 분모가 더 작아져 공제료가 뜁니다 |\n\n"
        "**다루지 않은 범위** — 특약 3종(재해수술·재해골절·재해입원)의 공제료, "
        "적용·표준 책임준비금(`적용준비금`·`표준준비금` 시트), 해지환급금과 신계약비 상각은 "
        "이 예제에 담지 않았습니다. 특약 위험률만 `특약위험률` 시트에 참고로 실었습니다.\n\n"
        "6단계의 **차이** 열 세 개가 모두 0이면 원본 요율 테이블과 완전히 같은 모델이라는 뜻입니다.",
        "정리 — 축이 다른 상품에서 쉽게 틀리는 곳"))

    return workbook(
        "wb-sample-accident-class",
        "상해공제 — 직종별 위험률·만기환급형",
        [risk_sheet, rider_sheet, assume_sheet, check_sheet],
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
    # 원본 방법서 파일도 두 경로가 같은 값을 내야 한다(.xlsm도 zip 구조라 같은 파서로 읽힌다)
    for src, names in ((PREMIUM_SRC, ["조회", "P"]),
                       (RISK_SRC, ["2 산출과정", "3. 산출결과"]),
                       (NS_SRC, ["PV산출", "P테이블"])):
        if not src.exists():
            continue
        a = read_src_cells(src, names)
        b = _read_cells_stdlib(src, names)
        for nm in names:
            for addr, v in b[nm].items():
                w = a[nm][addr]
                if isinstance(w, (datetime.date, datetime.time)):
                    continue   # 날짜 서식 셀 — 표준 라이브러리 파서는 시리얼 숫자 그대로 둔다(의도된 차이)
                if isinstance(v, (int, float)) and not isinstance(v, bool):
                    assert abs(w - v) < 1e-9, (src.name, nm, addr, w, v)
                else:
                    assert w == v, (src.name, nm, addr)
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
        # 부록 M — 보험료 산출 예제 (원본 산출과정표가 있을 때만)
        (build_premium_term(), "premium-term.pygrid.json"),
        # 부록 M.4 — 위험률 산출·무해지환급형 (원본 방법서 파일이 있을 때만)
        (build_risk_rate(), "risk-rate.pygrid.json"),
        (build_nonsurrender(), "nonsurrender.pygrid.json"),
        (build_cancer_multi(), "cancer-multi.pygrid.json"),
        # 부록 M.5 — 체증형·미달체 정기보험 (원본 산출과정표가 있을 때만)
        (build_term_variants(), "term-variants.pygrid.json"),
        # 부록 M.5 — 종신공제 다급부(이중탈퇴)
        (build_whole_life_multi(), "whole-life-multi.pygrid.json"),
        # 부록 M.5 — 상해공제(직종축 위험률·만기환급형)
        (build_accident_class(), "accident-class.pygrid.json"),
    ]:
        if wb is None:
            continue
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
