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
