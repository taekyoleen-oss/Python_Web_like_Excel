---
name: sample-workbook-gen
description: 샘플 워크북 JSON(생명표·손해율·히스토그램 예제)과 코드 스니펫(data/snippets.json) 생성. 샘플·스니펫을 추가·수정할 때 사용.
---

# sample-workbook-gen

## 실행

```bash
python .claude/skills/sample-workbook-gen/scripts/build_samples.py
```

산출물:

- `data/sample-workbooks/life-table.pygrid.json` — 생명표(연령 x, qx) 데이터 + `lx, dx, ex` 계산 블록 + 히스토그램 블록. 첫 방문 기본 로드 워크북.
- `data/sample-workbooks/loss-ratio.pygrid.json` — 손해율 집계(그룹 집계 + 피벗) 예제.
- `data/snippets.json` — 초보자용 스니펫(기술통계·그룹 집계·피벗·히스토그램·선형회귀·생명표 lx 계산).

## 규칙

- 워크북 JSON은 설계서 §3.1 스키마(`types/workbook.ts`)를 정확히 따른다. 스키마 변경 시 이 스크립트를 같이 고친다.
- 블록 코드는 `xl()` 참조가 실제 시트 범위와 일치해야 한다(로드 직후 전체 실행이 성공해야 함).
- 스니펫의 `{{range}}` 자리표시자는 삽입 시 현재 선택 범위의 `xl()` 참조로 치환된다.
