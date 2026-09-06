# 시트기반 파이썬 (Sheet Python)

> 내부 프로젝트명은 PyGrid Studio이며 파일 확장자(.pygrid.json)·코드 식별자는 호환성을 위해 유지합니다.

브라우저에서 서버 없이 실행되는 **Python in Excel** 스타일 워크북. 표를 붙여넣고, PY 블록에서 `xl("A1:C10", headers=True)` 참조로 시트 데이터를 받아 Pyodide(WASM)로 실행하고, 결과를 spill·객체 카드·이미지로 확인합니다.

- 설계서: `docs/pygrid-studio-design.md` (모든 규칙의 마스터)
- Excel과 다르게 동작하는 부분: `docs/domain/python-in-excel-parity.md`
- 변환 규칙·경계 케이스: `docs/domain/conversion-rules.md`
- 워커 프로토콜: `output/runtime-protocol.md` · 계산 엔진 계약: `output/calc-engine-api.md`

## 실행

```bash
npm install        # 의존성 (SheetJS는 cdn.sheetjs.com tarball — npm xlsx 설치 금지)
npm run dev        # http://localhost:3000 (COOP/COEP 헤더 포함 — 실행 중단 기능에 필요)
npm run build && npm start   # 프로덕션
```

첫 방문 시 생명표 샘플 워크북이 열리고, Pyodide(numpy·pandas)는 jsDelivr CDN에서 백그라운드 로드됩니다(약 10초, 재방문은 브라우저 캐시). matplotlib 등은 첫 import 때 지연 로드됩니다.

## 브라우저 파이썬의 한계

- **실행 지연**: 첫 접속 시 런타임 로드(~10초)와 각 패키지의 첫 import에 시간이 걸립니다(재방문은 캐시로 단축).
- **제한적인 패키지**: Pyodide가 제공하는 패키지와 순수 파이썬 패키지(micropip)만 사용할 수 있습니다 — xgboost·plotly·requests 등은 불가.
- **메모리**: 데이터 크기는 브라우저 탭 메모리 한도에 종속됩니다.
- **격리 환경**: 임의 네트워크 접근·로컬 파일 시스템 접근이 제한됩니다(데이터는 앱의 불러오기 기능 사용).

## AI 설정 (선택)

✦ AI 코드 지원(블록 생성·제안·변수 반영·에러분석)을 쓰려면 **파일 > AI 설정**에서 Anthropic API 키를 입력하세요(발급: [console.anthropic.com](https://console.anthropic.com)). 키는 이 브라우저의 IndexedDB에만 저장되며 Anthropic API 호출에만 사용됩니다 — 서버 라우트가 없고, 워크북 파일·내보내기·git 어디에도 포함되지 않습니다. AI 제안은 자동 실행되지 않으며 항상 확인 후 직접 적용·실행합니다.

## 테스트

```bash
npx tsc --noEmit   # 타입 검사
npm test           # vitest 단위 (a1·모델·클립보드 픽스처 30종·spill·계산 엔진·IO)
npm run test:py    # Node용 Pyodide 변환 테스트 (§3.3 전 행 + G2 골든, 첫 실행은 패키지 다운로드)
npm run test:e2e   # Playwright (dev 서버 자동 기동): G3·G4·G5·G6 골든 포함
```

골든 테스트 결과: `output/golden-results.json`

### G1 수동 검증 (실제 Excel 왕복)

자동화 불가 — Windows에서 Excel을 열고 다음을 확인하세요.

1. Excel에서 헤더 + 정수·소수·`1,234`·`12.5%`·`2026-09-02`·한글·빈 셀이 섞인 표(약 21×6)를 복사해 PyGrid 그리드에 붙여넣기 → 붙여넣기 미리보기에서 열 유형 추론 확인 후 적용
2. 같은 범위를 PyGrid에서 복사해 Excel 빈 시트에 붙여넣기
3. 확인: 숫자는 숫자로, `12.5%`는 퍼센트 서식 숫자로, 날짜는 날짜 셀로 인식되고 한글·빈 셀이 보존되는지

## 배포

Vercel: `vercel.json`에 COOP/COEP 헤더가 이미 설정되어 있습니다. `NEXT_PUBLIC_PYODIDE_INDEX_URL`로 Pyodide 셀프 호스팅(`public/pyodide/`) 전환 가능.

## 구조

`CLAUDE.md`(에이전트 지침·버전 고정), `components/`(shell·grid·python·panels), `lib/`(grid·runtime·storage·io), `workers/pyodide.worker.ts`, `data/`(샘플·스니펫), `tests/`(unit·pyodide·e2e).
