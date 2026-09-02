# -*- coding: utf-8 -*-
"""붙여넣기 픽스처 생성기 — 설계서 §4.5의 유형 추론 규칙을 기대 JSON으로 인코딩한다.

산출물: output/paste-fixtures/<name>.json
형식: { name, description, clipboard: {"text/plain", "text/html"?}, options?, expected: { headerRow, cells } }
cells: (Cell | null)[][], Cell = {v, t, f?}. null = 빈 셀(저장 안 함).

이 픽스처가 곧 스펙이다: lib/grid/clipboard/{parse,infer}.ts는 이 기대값에 맞춘다.
"""
import json
import html as html_mod
from pathlib import Path

OUT = Path(__file__).resolve().parents[4] / "output" / "paste-fixtures"

# ── 셀 헬퍼 ──────────────────────────────────────────────


def n(v, f=None):
    c = {"v": v, "t": "n"}
    if f:
        c["f"] = f
    return c


def s(v):
    return {"v": v, "t": "s"}


def b(v):
    return {"v": v, "t": "b"}


def d(iso):
    return {"v": iso, "t": "d", "f": "yyyy-mm-dd"}


def pct(v, f="0.0%"):
    return {"v": v, "t": "n", "f": f}


def com(v):
    return {"v": v, "t": "n", "f": "#,##0"}


# ── 클립보드 직렬화 ──────────────────────────────────────


def tsv(rows):
    """raw 문자열 2D → TSV. 탭/줄바꿈/따옴표 포함 셀은 Excel 방식으로 인용한다."""
    out = []
    for row in rows:
        cells = []
        for cell in row:
            if any(ch in cell for ch in ("\t", "\n", '"')):
                cells.append('"' + cell.replace('"', '""') + '"')
            else:
                cells.append(cell)
        out.append("\t".join(cells))
    return "\r\n".join(out) + "\r\n"


def html_table(rows):
    """raw 문자열 2D → Excel풍 HTML table. 셀 안 줄바꿈은 <br>로."""
    trs = []
    for row in rows:
        tds = "".join(
            "<td>{}</td>".format(html_mod.escape(cell).replace("\n", "<br>"))
            for cell in row
        )
        trs.append("<tr>{}</tr>".format(tds))
    return "<table>{}</table>".format("".join(trs))


def fixture(name, description, raw_rows, expected_cells, header_row=False,
            with_html=True, options=None, html_rows=None, plain_rows=None):
    clip = {}
    if plain_rows is not False:
        clip["text/plain"] = tsv(plain_rows if plain_rows else raw_rows)
    if with_html:
        clip["text/html"] = html_table(html_rows if html_rows else raw_rows)
    fx = {
        "name": name,
        "description": description,
        "clipboard": clip,
        "expected": {"headerRow": header_row, "cells": expected_cells},
    }
    if options:
        fx["options"] = options
    return fx


# ── 픽스처 정의 ──────────────────────────────────────────

FIXTURES = [
    fixture(
        "plain-integers", "정수만 있는 3×2 표",
        [["1", "2"], ["3", "4"], ["5", "6"]],
        [[n(1), n(2)], [n(3), n(4)], [n(5), n(6)]],
    ),
    fixture(
        "plain-floats", "소수 열",
        [["1.5", "2.25"], ["-0.5", "3.0"]],
        [[n(1.5), n(2.25)], [n(-0.5), n(3.0)]],
    ),
    fixture(
        "negative-numbers", "음수 표기",
        [["-1"], ["-2.5"], ["-100"]],
        [[n(-1)], [n(-2.5)], [n(-100)]],
    ),
    fixture(
        "thousand-comma", "천단위 콤마 → 숫자 정규화 + #,##0 서식",
        [["1,234"], ["12,345,678"], ["1,000"]],
        [[com(1234)], [com(12345678)], [com(1000)]],
    ),
    fixture(
        "scientific-notation", "지수 표기",
        [["1.2e5"], ["3E2"], ["-1.5e-3"]],
        [[n(120000.0)], [n(300.0)], [n(-0.0015)]],
    ),
    fixture(
        "percent-integer", "정수 퍼센트 → 값/100 + 0.0% 서식",
        [["12%"], ["100%"], ["5%"]],
        [[pct(0.12)], [pct(1.0)], [pct(0.05)]],
    ),
    fixture(
        "percent-decimal", "소수 퍼센트 12.5% → 0.125",
        [["12.5%"], ["0.5%"], ["99.9%"]],
        [[pct(0.125)], [pct(0.005)], [pct(0.999)]],
    ),
    fixture(
        "date-iso", "ISO 날짜 yyyy-mm-dd",
        [["2026-09-02"], ["2025-01-31"], ["2024-12-25"]],
        [[d("2026-09-02")], [d("2025-01-31")], [d("2024-12-25")]],
    ),
    fixture(
        "date-korean-dots", "한국식 2026. 9. 2 (공백·마침표)",
        [["2026. 9. 2"], ["2025. 12. 25"], ["2026. 1. 1"]],
        [[d("2026-09-02")], [d("2025-12-25")], [d("2026-01-01")]],
    ),
    fixture(
        "date-slash-ymd", "연/월/일 슬래시(기본 ymd)",
        [["2026/09/02"], ["2025/01/31"]],
        [[d("2026-09-02")], [d("2025-01-31")]],
    ),
    fixture(
        "date-mdy-option", "월/일/연 — dateOrder 'mdy' 옵션 지정 시",
        [["9/2/2026"], ["12/25/2025"]],
        [[d("2026-09-02")], [d("2025-12-25")]],
        options={"dateOrder": "mdy"},
    ),
    fixture(
        "boolean-truefalse", "TRUE/FALSE 열",
        [["TRUE"], ["FALSE"], ["TRUE"]],
        [[b(True)], [b(False)], [b(True)]],
    ),
    fixture(
        "boolean-case-insensitive", "대소문자 무시 True/false",
        [["True"], ["false"], ["TRUE"]],
        [[b(True)], [b(False)], [b(True)]],
    ),
    fixture(
        "mixed-column-below-90", "숫자 60%뿐인 열 → 전체 문자열 유지",
        [["1"], ["2"], ["3"], ["abc"], ["def"]],
        [[s("1")], [s("2")], [s("3")], [s("abc")], [s("def")]],
    ),
    fixture(
        "mixed-column-above-90", "숫자 90% 열 → 숫자 열, 불일치 셀만 문자열",
        [["1"], ["2"], ["3"], ["4"], ["5"], ["6"], ["7"], ["8"], ["9"], ["x"]],
        [[n(1)], [n(2)], [n(3)], [n(4)], [n(5)],
         [n(6)], [n(7)], [n(8)], [n(9)], [s("x")]],
    ),
    fixture(
        "empty-cells-in-column", "빈 셀 섞인 숫자 열 → 숫자 열 유지(빈 셀은 null)",
        [["1"], [""], ["3"], [""], ["5"]],
        [[n(1)], [None], [n(3)], [None], [n(5)]],
    ),
    fixture(
        "header-detection", "첫 행 문자열 + 본문 숫자 → headerRow 제안",
        [["이름", "나이"], ["철수", "20"], ["영희", "21"]],
        [[s("이름"), s("나이")], [s("철수"), n(20)], [s("영희"), n(21)]],
        header_row=True,
    ),
    fixture(
        "no-header", "전부 숫자 → headerRow 아님",
        [["1", "2"], ["3", "4"]],
        [[n(1), n(2)], [n(3), n(4)]],
    ),
    fixture(
        "single-cell", "단일 셀 붙여넣기",
        [["42"]],
        [[n(42)]],
    ),
    fixture(
        "single-column", "1열",
        [["a"], ["b"], ["c"]],
        [[s("a")], [s("b")], [s("c")]],
    ),
    fixture(
        "single-row", "1행",
        [["a", "b", "c"]],
        [[s("a"), s("b"), s("c")]],
    ),
    fixture(
        "quoted-tsv-newline", "따옴표로 감싼 줄바꿈 셀 (TSV만)",
        [["보험\n계리", "1"], ["통계", "2"]],
        [[s("보험\n계리"), n(1)], [s("통계"), n(2)]],
        with_html=False,
    ),
    fixture(
        "quoted-tsv-quotes", '이스케이프된 따옴표 "" (TSV만)',
        [['그는 "안녕"이라 말했다', "1"]],
        [[s('그는 "안녕"이라 말했다'), n(1)]],
        with_html=False,
    ),
    fixture(
        "html-newline-cell", "HTML <br> 셀 — 경계는 HTML, 값은 줄바꿈 유지",
        [["보험\n계리", "10"], ["통계", "20"]],
        [[s("보험\n계리"), n(10)], [s("통계"), n(20)]],
        # Excel은 줄바꿈 셀을 text/plain에서 따옴표로 감싼다. HTML 경계가 우선돼야 안전.
    ),
    fixture(
        "html-merged-residue", "병합 셀 잔해 — 빈 td는 빈 셀",
        [["병합", "", "값"], ["a", "b", "c"]],
        [[s("병합"), None, s("값")], [s("a"), s("b"), s("c")]],
    ),
    fixture(
        "trailing-empty-rows", "후행 빈 행 제거",
        [["1"], ["2"]],
        [[n(1)], [n(2)]],
        plain_rows=[["1"], ["2"], [""], [""]],
        html_rows=[["1"], ["2"], [""], [""]],
    ),
    fixture(
        "trailing-empty-cols", "후행 빈 열 제거",
        [["1", "2"], ["3", "4"]],
        [[n(1), n(2)], [n(3), n(4)]],
        plain_rows=[["1", "2", ""], ["3", "4", ""]],
        html_rows=[["1", "2", ""], ["3", "4", ""]],
    ),
    fixture(
        "korean-text", "한글 텍스트 열",
        [["보험계리"], ["손해율"], ["생명표"]],
        [[s("보험계리")], [s("손해율")], [s("생명표")]],
    ),
    fixture(
        "whitespace-padding", "앞뒤 공백은 추론 전에 trim",
        [[" 1 ", " abc "], ["2", "def"]],
        [[n(1), s("abc")], [n(2), s("def")]],
    ),
    # G1 근사 픽스처: 헤더 + 정수·소수·콤마·퍼센트·날짜·한글·빈 셀 (6열)
    fixture(
        "excel-full-g1", "G1 시나리오 축약판 — 유형 총집합 + 빈 셀",
        [
            ["연령", "인원", "보험료", "손해율", "가입일", "비고"],
            ["20", "1,234", "150000.5", "12.5%", "2026-09-02", "신규"],
            ["30", "2,345", "180000.0", "45.0%", "2025-01-31", ""],
            ["40", "3,456", "210000.25", "78.9%", "2024-12-25", "갱신"],
        ],
        [
            [s("연령"), s("인원"), s("보험료"), s("손해율"), s("가입일"), s("비고")],
            [n(20), com(1234), n(150000.5), pct(0.125), d("2026-09-02"), s("신규")],
            [n(30), com(2345), n(180000.0), pct(0.45), d("2025-01-31"), None],
            [n(40), com(3456), n(210000.25), pct(0.789), d("2024-12-25"), s("갱신")],
        ],
        header_row=True,
    ),
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for fx in FIXTURES:
        path = OUT / (fx["name"] + ".json")
        path.write_text(
            json.dumps(fx, ensure_ascii=False, indent=1), encoding="utf-8"
        )
    print(f"{len(FIXTURES)} fixtures -> {OUT}")
    assert len(FIXTURES) == len({f['name'] for f in FIXTURES}), "중복 이름"


if __name__ == "__main__":
    main()
