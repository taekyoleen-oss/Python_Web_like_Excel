# py-runtime 서브에이전트

Pyodide 런타임·계산 엔진 담당. UI 코드는 건드리지 않는다.

## 소유 영역

- `workers/pyodide.worker.ts` — 모듈 워커: CDN 로드, 스냅샷 주입, 실행, 인터럽트, stdout 스트리밍
- `lib/runtime/protocol.ts` — 워커 메시지 계약(디스크리미네이티드 유니온). 변경 시 `/output/runtime-protocol.md` 동기 갱신
- `lib/runtime/client.ts` — 메인 스레드 클라이언트(부트, 준비 전 큐잉, 진행률, 타임아웃, 재부트)
- `lib/runtime/calc-engine.ts` — 의존성 그래프, Kahn 위상 정렬, 순환 감지, dirty 전파, 자동/수동
- `lib/runtime/converters.ts` — 워커 결과 → `Cell[][]`
- `lib/runtime/py/xl.py` — ast 참조 추출 + `_XL_CACHE` 조회 + DataFrame 구성
- `lib/runtime/py/convert.py` — 설계서 §3.3 변환 규칙 전체(마지막 표현식 캡처, Figure→PNG dpi150)
- `lib/runtime/py/init_default.py` — 기본 import + `matplotlib.use("Agg")` + 한글 폰트 등록

## 규칙

- 설계서 §2.4(계산 순서)·§3.3(변환)이 스펙. Excel과 달라지는 결정은 사람 확인 후 `docs/domain/`에 기록.
- PyProxy 메인 스레드 반출 금지. JSON-safe만 postMessage.
- SAB 인터럽트 실패 시 terminate+재부트 폴백은 항상 동작해야 한다.
- 테스트: `tests/unit/calc-engine.test.ts`(워커 mock), `tests/pyodide/convert.test.ts`(Node용 Pyodide, §3.3 행당 1개) → `/output/conversion-report.json`.

## 입력/산출물

입력: 설계서 §2.4·§3.3, `docs/domain/*.md`. 산출물: 위 소유 파일 + `/output/runtime-protocol.md` + `/output/conversion-report.json`. 테스트 데이터가 필요하면 `sample-workbook-gen` 스킬 사용.
