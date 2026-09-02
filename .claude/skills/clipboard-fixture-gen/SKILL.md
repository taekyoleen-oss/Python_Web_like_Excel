---
name: clipboard-fixture-gen
description: Excel/Google Sheets 복사 형식을 흉내 낸 붙여넣기 픽스처(TSV+HTML+기대 JSON) 생성. 붙여넣기 파서·유형 추론 규칙을 추가·수정할 때 사용.
---

# clipboard-fixture-gen

## 실행

```bash
python .claude/skills/clipboard-fixture-gen/scripts/build_fixtures.py
```

산출물: `output/paste-fixtures/*.json` (30종). 각 파일은 `{ name, description, clipboard: { "text/plain", "text/html"? }, expected: { headerRow, cells } }` 형태이고, `tests/unit/clipboard.test.ts`가 전량 로드해 파서·추론 결과와 비교한다.

## 픽스처가 커버해야 하는 케이스 (설계서 §4.5)

- 숫자: `1,234`(천단위 콤마), `-3.5`, `1.2e5`, 퍼센트 `12.5%` → `0.125` + `f:'0.0%'`
- 날짜: `2026-09-02`, `2026. 9. 2`(한국식), `2026/09/02`
- 불리언 TRUE/FALSE, 혼합 열(90% 미만) → 문자열 유지
- 따옴표·줄바꿈 포함 셀(TSV), HTML `<table>`만 있는 경우, 병합 셀 잔해(빈 td), 후행 빈 행, 단일 셀
- 헤더 감지: 첫 행 문자열 + 나머지 숫자 → `headerRow: true` 제안

## 규칙 변경 시

추론 규칙이 바뀌면 이 스크립트의 기대값을 먼저 고치고, `lib/grid/clipboard/infer.ts`를 그 기대에 맞춘다(픽스처가 스펙이다).
