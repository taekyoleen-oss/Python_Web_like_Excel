# Excel ↔ Python 값 변환 규칙 + 경계 케이스

마스터 표: 설계서 §3.3. 이 문서는 구현하며 확정한 **경계 케이스 판정**을 누적 기록한다.
검증: `tests/pyodide/convert.test.ts`(§3.3 행당 1테스트) → `/output/conversion-report.json`.

## 경계 케이스 결정 로그

| # | 케이스 | 결정 | 근거 | 결정일 |
|---|--------|------|------|--------|
| 1 | 열 전체 정수 + 빈 셀 혼재 | `float64` + `NaN` (int64 불가) | pandas nullable Int64 대신 Excel 관행(빈 셀=NaN) 우선 | (M4에서 확정) |
| 2 | `xl("A1")` 단일 셀 | 스칼라 (2D 아님) | Excel 동일 | 설계서 확정 |
| 3 | DataFrame RangeIndex | `includeIndex:'auto'`면 제외, 그 외 index는 첫 열 | Excel 기본 동작 | 설계서 확정 |
| 4 | matplotlib Figure를 값 모드로 | `#PYTHON! 이미지는 값으로 펼칠 수 없습니다` | 설계서 §3.3 | 설계서 확정 |
| 5 | `None` 출력 | 빈 셀 | 설계서 §3.3 | 설계서 확정 |
| 6 | pandas 3.x(Pyodide 314)의 전용 `str` dtype | `xl()` 문자열·혼합 열은 `object`로 강제(`dtype="object"`), 빈 셀은 `None` 유지 | §3.3 표가 `object` 명시. `str` dtype은 빈 셀을 NaN으로 바꿔 §3.3 위반 | 2026-09-03 |
| 7 | pandas 3.x `to_datetime`이 ISO 문자열에서 `us` 해상도 추론 | `.as_unit("ns")`로 `datetime64[ns]` 고정 | §3.3·G2 골든이 ns 명시 | 2026-09-03 |
| 8 | 값 모드 `NaN`/`NaT`/`±inf` 출력 | 빈 셀(`v:null`) | JSON 직렬화 불가 + Excel 관행 | 2026-09-03 |
| 9 | `headers=True`인데 헤더 셀이 빈 셀 | 열 이름 `Unnamed: {j}` | pandas `read_csv` 관행 | 2026-09-03 |
| 10 | 시간 성분 있는 날짜 출력 | `v` `"yyyy-mm-dd hh:mm:ss"`(초 미만은 f 서식과 맞춰 잘라냄), `f` 동일 서식. 자정이면 날짜만 | 복사 시 Excel 인식 | 2026-09-03 |
| 11 | 들쭉날쭉한 중첩 list `[[1,2],[3]]` | 최대 너비로 빈 셀(`v:null`) 패딩, shape=(행 수, 최대 열 수) | 직사각 spill 보장 | 2026-09-03 |
| 12 | DataFrame index 포함 시 헤더 셀 | `index.name` 또는 빈 문자열 `""` | pandas 관행 | 2026-09-03 |
| 13 | `'b'` 열 + 빈 셀 | `bool` 불가 → `object` + `None` | numpy bool은 결측 표현 불가 | 2026-09-03 |
| 14 | `xl` 별칭 호출(`f = xl; f("A1")`) | 의존성 분석(ast)에서 누락 → 스냅샷 미주입 → 런타임 `RuntimeError` 안전망 | Excel의 Python in Excel과 동일 한계. parity #4 | 2026-09-03 |

M4 진행 중 발견하는 케이스(날짜 텍스트, 혼합 dtype, timezone 등)를 여기에 추가한다.
