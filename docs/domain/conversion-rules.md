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
| 10 | 시간 성분 있는 날짜 출력 | `v` `"yyyy-mm-dd hh:mm:ss"`, `f` 동일 서식. 자정이면 날짜만 | 복사 시 Excel 인식 | 2026-09-03 |

M4 진행 중 발견하는 케이스(날짜 텍스트, 혼합 dtype, timezone 등)를 여기에 추가한다.
