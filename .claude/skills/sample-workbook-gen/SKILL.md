---
name: sample-workbook-gen
description: 샘플 워크북 JSON(생명표·손해율·히스토그램 예제)과 코드 스니펫(data/snippets.json) 생성. 샘플·스니펫을 추가·수정할 때 사용.
---

# sample-workbook-gen

## 실행

```bash
python .claude/skills/sample-workbook-gen/scripts/build_samples.py
```

산출물 — 부록 K 계리 예제 5종은 `public/samples/*.xlsx` 원본을 시트로 내장한다(openpyxl 없으면 zipfile+xml 파서로 폴백):

- `life-table.pygrid.json` — 위험률·생명표(mortality_table 101행): lx·dx·ex, Gompertz·Makeham 적합. **첫 방문 기본 로드 워크북**.
- `premium-glm.pygrid.json` — 보험료 요인 분석(policy 600행): 교차표, 감마 GLM(로그 링크) 상대도, 예측 검증.
- `freq-severity.pygrid.json` — 빈도·심도(claims 600행): 심도 AIC 비교, 과산포 검정, 순보험료, MC VaR·TVaR.
- `survival-retention.pygrid.json` — 생존분석·유지율(experience 800행): Kaplan-Meier 자체 구현, 구간 해지율, 로그순위.
- `chain-ladder.pygrid.json` — 지급준비금(triangle 8×8): 개발계수·완성 삼각형·IBNR·Mack 표준오차.
- `premium-term.pygrid.json` — 보험료 산출·정기보험(부록 M): 계산기수 → 보험료(원본 검산) → 준비금·해약환급금 → 표준/적용 비교.
  원본은 `PREMIUM_SRC`(OneDrive 산출과정표 xlsx) — 없으면 생성을 건너뛰고 기존 JSON을 유지한다.
- `cancer-multi.pygrid.json` — 암보험 다중탈퇴(부록 M.4 #6): 위험률 11종(발생률 vs 비율) → 담보별 다중탈퇴 생존자표
  → Cx·Mx(90일 면책 3/4) → 급부배율 SUMX → 순·영업공제료 → 원본 `총괄` 대조 검산.
  원본은 `CANCER_SRC`(OneDrive 더블암진단특약.xlsx) — 없으면 생성을 건너뛰고 기존 JSON을 유지한다.
- `risk-rate.pygrid.json` — 위험률 산출(부록 M.4 #5): 발생자수÷추계인구 = 조율 → 비만동반 비율·안전할증 0.5
  → 직선보간 + 그레빌 9항 평활(양끝 4개 외삽) → 원본 `3. 산출결과` 111행 대조 검산 → 연령별 곡선.
  원본은 `RISK_SRC`(OneDrive 영양조사.xlsx) — 없으면 생성을 건너뛰고 기존 JSON을 유지한다.
- `nonsurrender.pygrid.json` — 무해지환급형(부록 M.4 #8): 치매 CDR 발생률 → 해지율 4% 이중탈퇴 생존자표
  → 현금흐름 PV(Dx·Cx·Nx·Mx 대체, 중증치매 연금 10년) → 순·영업보험료(12) → 무해지 vs 표준형 환급률 곡선
  → 원본 `P테이블` 10개 조합 대조 검산. 원본은 `NS_SRC`(OneDrive 치매보험 PV산출.xlsm — zip 구조라 xlsx와 같은 파서로 읽힌다).
- `loss-ratio.pygrid.json` · `claim-severity.pygrid.json` — 소형 기본 예제(부록 H.2).
- `data/snippets.json` — 초보자용 스니펫(기술통계·그룹 집계·피벗·히스토그램·선형회귀·생명표 lx 계산).

## 규칙

- 워크북 JSON은 설계서 §3.1 스키마(`types/workbook.ts`)를 정확히 따른다. 스키마 변경 시 이 스크립트를 같이 고친다.
- 블록 코드는 `xl()` 참조가 실제 시트 범위와 일치해야 한다(로드 직후 전체 실행이 성공해야 함).
- 스니펫의 `{{range}}` 자리표시자는 삽입 시 현재 선택 범위의 `xl()` 참조로 치환된다.
- 사용 라이브러리는 Pyodide 가용 범위(numpy·pandas·scipy·statsmodels·matplotlib)로 한정 — lifelines 등은 자체 구현.
- 워크북 하나당 2MB 이하. 데이터 셀에는 서식(`f`)을 붙이지 않는다.
- 생성 후 검증: `npm test -- tests/unit/sample-workbooks.test.ts` + `npm run test:e2e -- tests/e2e/sample-workbooks.spec.ts`.
