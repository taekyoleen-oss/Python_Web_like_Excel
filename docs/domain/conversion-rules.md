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
| 15 | 출력 선택 `variable`이 정의되지 않은 이름 | `NameError` + 한국어 메시지 `출력 변수 '…'가 정의되지 않았습니다` (ConversionError 아님). 본문은 끝까지 실행된 뒤 판정 | 사용자가 고칠 대상은 변수명 — errors-ko의 NameError 요약이 그대로 맞는다 | 2026-09-04 |
| 16 | 출력 선택 `columns` 중 실제로 존재하는 열이 **하나도 없음** | 필터를 적용하지 않고 **전체 열 유지**(0열 spill 금지). 일부만 없으면 있는 열만 요청 순서대로 | 열 이름 오타·데이터 변경으로 결과가 통째로 사라지는 편이 더 나쁘다 | 2026-09-04 |
| 17 | 출력 선택 `rowLimit`와 헤더 행 | 헤더(DataFrame 열 이름·Series name)는 N에 포함하지 않는다 → spill 행 수는 헤더 유무에 따라 N 또는 N+1. `N ≤ 0`은 무제한, 스칼라·dict·Figure·기타 객체는 무시 | "상위 N행 보기"의 N은 데이터 행이라는 Excel·pandas 관행 | 2026-09-04 |
| 18 | 출력 선택 적용 시점 | §3.3 변환 **전**에 값을 좁힌다 → 값 모드 `cells`/`shape`와 객체 모드 `preview`/`shape`가 항상 일치 | 같은 블록을 값↔객체로 토글해도 보이는 데이터가 달라지지 않는다 | 2026-09-04 |
| 19 | 출력 선택 `columns`의 열 이름 비교 | `str(열이름)` 기준 — `headers=False` DataFrame의 정수 컬럼(`0`,`1`…)도 `"0"`으로 선택할 수 있다 | UI가 보는 열 이름은 객체 모드 preview의 `[str(c) …]`와 같아야 한다 | 2026-09-04 |
| 20 | 다중 출력(한 블록 → 여러 위치) 실행 횟수 | 코드 본문은 **1회만** 실행하고, 출력마다 `selection`(variable·columns·rowLimit)과 mode/includeIndex를 따로 적용해 변환한다. 선택 없는 출력은 마지막 표현식 값을 쓴다 | 같은 코드를 N번 돌리면 부작용(파일·난수·카운터)이 N번 일어나고 느리다. Excel의 셀 하나=수식 하나와 달라지는 지점 → parity 문서 참조 | 2026-09-04 |
| 21 | 출력 하나가 실패(없는 변수 등)했을 때 | **그 출력만** 실패(`OutputItemFailure`)로 표시하고 나머지 출력은 정상 배치한다. run 자체는 성공(`payload.ok = true`) | 요약표 변수명 오타 때문에 잘 나온 DataFrame까지 사라지면 안 된다 | 2026-09-04 |
| 22 | 값 모드 출력에 Figure를 지정 | 그 출력만 `PyGridImageError`(`이미지는 값으로 펼칠 수 없습니다`). 같은 Figure를 객체 모드로 지정한 다른 출력은 정상 PNG | #4의 판정을 출력 단위로 적용한 것 | 2026-09-04 |
| 23 | 코드 본문 자체의 오류·중단(KeyboardInterrupt) | 출력 단위 실패가 아니라 **run 전체 실패**(`RunFailure`, items 없음). grid-ui가 블록의 모든 출력에 같은 오류를 표시 | 본문이 안 돌았으면 어떤 출력도 유효하지 않다 | 2026-09-04 |

M4 진행 중 발견하는 케이스(날짜 텍스트, 혼합 dtype, timezone 등)를 여기에 추가한다.
