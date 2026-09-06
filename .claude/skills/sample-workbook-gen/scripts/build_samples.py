# -*- coding: utf-8 -*-
"""샘플 워크북(.pygrid.json)·스니펫(data/snippets.json) 생성기.

스키마: types/workbook.ts (설계서 §3.1). 블록 코드의 xl() 참조는 실제 시트 범위와
일치해야 하며, 로드 직후 전체 실행이 성공해야 한다.
"""
import json
import math
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


# ── 생명표 워크북 ────────────────────────────────────────


def build_life_table():
    rows = [[cell("x", "s"), cell("qx", "s")]]
    for x in range(0, 101):
        qx = min(0.9999, 0.0005 + 0.00008 * math.exp(0.09 * x))
        rows.append([cell(x, "n"), cell(round(qx, 6), "n")])

    # 마크다운 블록: 실행되지 않으며 앵커 셀에 값을 쓰지 않는다 (설계서 부록 C)
    intro_block = {
        "id": "blk-life-intro",
        "sheetId": "sh-life-data",
        "anchor": {"r": 0, "c": 6},  # G1
        "code": "",
        "outputMode": "values",
        "includeIndex": "auto",
        "kind": "markdown",
        "title": "생명표 분석",
        "markdown": """# 생명표 분석

연령별 사망률 `qx`에서 생존자 수 `lx`, 사망자 수 `dx`, 평균여명 `ex`를 계산합니다.

## 구성

- **D열**: `lx`·`dx`·`ex` 계산 결과
- **I2**: `dx` 분포 히스토그램

블록 카드의 **출력** 행에서 표시할 변수·열·행 수를 코드 수정 없이 바꿀 수 있습니다.
""",
    }

    lx_block = {
        "id": "blk-life-lx",
        "sheetId": "sh-life-data",
        "anchor": {"r": 0, "c": 3},  # D1
        "outputMode": "values",
        "includeIndex": "auto",
        "title": "생존자 수 계산",
        "code": (
            'df = xl("A1:B102", headers=True)\n'
            "lx = [100000.0]\n"
            'for q in df["qx"][:-1]:\n'
            "    lx.append(lx[-1] * (1 - q))\n"
            'df["lx"] = lx\n'
            'df["dx"] = df["lx"] * df["qx"]\n'
            '# 평균여명 근사: ex ≈ (x 이후 lx 합) / lx − 0.5\n'
            'rev = df["lx"][::-1].cumsum()[::-1]\n'
            'df["ex"] = rev / df["lx"] - 0.5\n'
            'df[["lx", "dx", "ex"]].round(2)'
        ),
    }
    hist_block = {
        "id": "blk-life-hist",
        "sheetId": "sh-life-data",
        "anchor": {"r": 1, "c": 8},  # I2
        "outputMode": "object",
        "includeIndex": "auto",
        "title": "사망자 수 분포",
        "code": (
            "import matplotlib.pyplot as plt\n"
            'df = xl("A1:B102", headers=True)\n'
            "lx = [100000.0]\n"
            'for q in df["qx"][:-1]:\n'
            "    lx.append(lx[-1] * (1 - q))\n"
            'dx = [l * q for l, q in zip(lx, df["qx"])]\n'
            "fig, ax = plt.subplots(figsize=(7, 4))\n"
            'ax.bar(df["x"], dx, color="#4A90C2")\n'
            'ax.set_title("사망자 수 분포 (dx)")\n'
            'ax.set_xlabel("연령")\n'
            "fig"
        ),
    }
    return workbook(
        "wb-sample-life-table",
        "생명표 예제",
        [sheet_from_rows("sh-life-data", "데이터", rows)],
        [intro_block, lx_block, hist_block],
    )


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


# ── 지급준비금 삼각형(체인래더) 워크북 (부록 H.2) ─────────
# lib/reference/actuarialMethods.ts chain-ladder 예제 삼각형(참 개발계수
# [1.90,1.35,1.18,1.10,1.06,1.03,1.015] 생성)을 시트에 싣고 xl() 참조로 개작.

CL_TRIANGLE = [
    [2016, 2335, 4433, 6055, 7090, 7756, 8265, 8534, 8658],
    [2017, 2314, 4195, 5503, 6453, 7038, 7489, 7716, None],
    [2018, 2683, 5367, 7454, 8884, 9840, 10386, None, None],
    [2019, 2871, 5708, 7694, 9141, 10188, None, None, None],
    [2020, 2634, 5023, 6743, 8018, None, None, None, None],
    [2021, 2884, 5855, 7744, None, None, None, None, None],
    [2022, 3284, 6409, None, None, None, None, None, None],
    [2023, 3404, None, None, None, None, None, None, None],
]

# 각 블록이 단독 실행 가능하도록 삼각형 로드·개발계수 계산을 공유한다
CL_COMMON = """df = xl("삼각형!A1:I9", headers=True)
tri = df.iloc[:, 1:].apply(pd.to_numeric, errors="coerce").to_numpy(dtype=float)
n = tri.shape[0]
# 볼륨가중 개발계수 f_j = Σc_{i,j+1} / Σc_{i,j} — 두 칸 모두 관측된 행만 합산(NaN 마스킹)
f = np.ones(n - 1)
for j in range(n - 1):
    m = ~np.isnan(tri[:, j]) & ~np.isnan(tri[:, j + 1])
    f[j] = tri[m, j + 1].sum() / tri[m, j].sum()"""


def build_chain_ladder():
    rows = [[cell(h, "s") for h in
             ["사고연도"] + [f"{j}년차" for j in range(1, 9)]]]
    for tr in CL_TRIANGLE:
        rows.append([cell(v, "n") if v is not None else None for v in tr])

    sid = "sh-cl-tri"
    blocks = [
        md_block(
            "blk-cl-title", sid, 0, 10,
            "# 지급준비금 — 체인래더\n\n"
            "런오프 삼각형(행=사고연도, 열=개발연차, 값=누적 지급보험금·백만원)의 개발 패턴으로\n"
            "미지급 보험금(IBNR 포함)을 추정하는 Chain-Ladder 예제입니다. 하삼각(미래)은 빈 셀이며,\n"
            "모든 블록은 시트의 `삼각형!A1:I9` 범위를 xl()로 읽습니다.",
            "지급준비금 — 체인래더",
        ),
        md_block(
            "blk-cl-md1", sid, 2, 10,
            "## 1단계 — 개발계수\n\n"
            "볼륨가중 개발계수 f_j = Σc_{i,j+1}/Σc_{i,j}를 구합니다 — 분자·분모 모두 두 칸이 다\n"
            "관측된 행만 합산하는 NaN 마스킹이 구현의 핵심입니다. 누적계수 CDF와 지급진행률(1/CDF)로\n"
            "각 연차까지 최종 지급의 몇 %가 진행됐는지 확인하세요.",
            "1단계 — 개발계수",
        ),
        code_block(
            "blk-cl-f", sid, 4, 10, "개발계수·누적계수",
            CL_COMMON + """
cdf = np.append(np.cumprod(f[::-1])[::-1], 1.0)   # 누적개발계수(마지막 연차 = 1)
pd.DataFrame({"구간": [f"{j+1}→{j+2}년차" for j in range(n - 1)] + ["최종"],
              "개발계수 f": np.append(f, 1.0).round(4),
              "누적계수 CDF": cdf.round(4),
              "지급진행률": (1 / cdf).round(4)})""",
        ),
        md_block(
            "blk-cl-md2", sid, 16, 10,
            "## 2단계 — 삼각형 완성\n\n"
            "각 사고연도의 최신 관측값에 개발계수를 차례로 곱해 하삼각(미래 지급)을 채웁니다.\n"
            "완성 삼각형의 마지막 열이 사고연도별 최종예상(Ultimate)입니다.",
            "2단계 — 삼각형 완성",
        ),
        code_block(
            "blk-cl-full", sid, 18, 10, "완성 삼각형",
            CL_COMMON + """
full = tri.copy()
for i in range(n):
    for j in range(n - i, n):                     # i번째 행의 미관측 구간
        full[i, j] = full[i, j - 1] * f[j - 1]
out = pd.DataFrame(full.round(0), columns=[f"{j+1}년차" for j in range(n)])
out.insert(0, "사고연도", df["사고연도"].astype(int).to_numpy())
out""",
        ),
        md_block(
            "blk-cl-md3", sid, 30, 10,
            "## 3단계 — 지급준비금\n\n"
            "준비금 = 최종예상 − 현재까지 누적 지급(최신 대각선). 2016년은 완전 진전(8년차 관측)이라\n"
            "준비금 0이어야 정상이고, 최근 사고연도일수록 준비금이 커집니다 — 초기 관측 하나가\n"
            "누적개발계수로 증폭되므로 최근 연도는 BF 병행 검토가 실무 관례입니다.",
            "3단계 — 지급준비금",
        ),
        code_block(
            "blk-cl-reserve", sid, 32, 10, "사고연도별 지급준비금",
            CL_COMMON + """
full = tri.copy()
for i in range(n):
    for j in range(n - i, n):
        full[i, j] = full[i, j - 1] * f[j - 1]
latest = np.array([tri[i, n - 1 - i] for i in range(n)])   # 최신 대각선
ultimate = full[:, -1]
reserve = ultimate - latest
print(f"총 지급준비금 = {reserve.sum():,.0f} 백만원")
pd.DataFrame({"사고연도": df["사고연도"].astype(int).to_numpy(),
              "현재누적": latest.round(0), "최종예상": ultimate.round(0),
              "준비금": reserve.round(0)})""",
        ),
    ]
    return workbook(
        "wb-sample-chain-ladder",
        "체인래더 준비금 예제",
        [sheet_from_rows(sid, "삼각형", rows, row_count=60, col_count=26)],
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


def main():
    SAMPLES.mkdir(parents=True, exist_ok=True)
    for wb, fname in [
        (build_life_table(), "life-table.pygrid.json"),
        (build_loss_ratio(), "loss-ratio.pygrid.json"),
        (build_claim_severity(), "claim-severity.pygrid.json"),
        (build_chain_ladder(), "chain-ladder.pygrid.json"),
    ]:
        (SAMPLES / fname).write_text(
            json.dumps(wb, ensure_ascii=False, indent=1), encoding="utf-8"
        )
        print(f"-> {SAMPLES / fname}")
    SNIPPETS.write_text(
        json.dumps(SNIPPET_LIST, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    print(f"-> {SNIPPETS}")


if __name__ == "__main__":
    main()
