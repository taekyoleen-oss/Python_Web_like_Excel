# 런타임 워커 프로토콜 (M3)

계약 원본: `lib/runtime/protocol.ts` — 이 문서는 그 해설이다. protocol.ts가 바뀌면 이 문서를 함께 갱신한다.
소비 측(grid-ui)은 워커를 직접 다루지 말고 **`lib/runtime/client.ts`의 `getRuntimeClient()`**를 쓴다.

## 구성 요소

| 파일 | 역할 |
|------|------|
| `workers/pyodide.worker.ts` | 모듈 워커. CDN에서 Pyodide 로드, 코드 실행, stdout/stderr 스트리밍 |
| `lib/runtime/client.ts` | 메인 스레드 클라이언트: 부트, 준비 전 큐잉, 요청/응답 매핑, 타임아웃·인터럽트·재부트 |
| `lib/runtime/py/bootstrap.py` | 워커 내부 헬퍼(`_pygrid_run`·`_pygrid_inspect`·`_pygrid_reset`·`_pygrid_mpl_setup`) |
| `lib/runtime/py/init_default.py` | 기본 초기화 스크립트. `client.ts`가 `DEFAULT_INIT_SCRIPT`로 재수출 |

원칙: **PyProxy는 postMessage로 넘기지 않는다.** 모든 페이로드는 JSON-safe(이미지 등 ArrayBuffer는 transferable).

## 부트 시퀀스

1. `RuntimeClient.boot({ initScript?, indexURL?, timeoutSec? })` — 멱등(중복 호출 시 같은 Promise).
   - indexURL 기본값: `NEXT_PUBLIC_PYODIDE_INDEX_URL` env → 없으면 `DEFAULT_PYODIDE_INDEX_URL`(jsDelivr v314.0.6).
2. 워커에 `{t:'boot', indexURL, packages:['numpy','pandas'], initScript, fontUrl:'/fonts/Pretendard-Regular.otf'}` 전송.
   `crossOriginIsolated`면 곧바로 `{t:'setInterruptBuffer', buffer: SharedArrayBuffer(1)}`도 전송(워커가 부트 완료 후 적용).
3. 워커 진행 단계 — `{t:'progress', pct, label}` (pct는 대략치):
   - 5% 스크립트 로드 → 20% 런타임 초기화 → 45% 패키지 로드(numpy·pandas) → 75% 폰트 등록 → 90% 초기화 스크립트 → 100% 완료
4. 폰트: `fontUrl`을 fetch해 Pyodide FS `/fonts/Pretendard-Regular.otf`에 기록. 실패해도 부트는 계속(stderr id 0으로 경고).
5. 초기화 스크립트 실행. **실패해도 부트는 성공** — 오류는 `{t:'stderr', id:0, ...}`로 스트리밍.
6. `{t:'ready', pyVersion, pyodideVersion}` → 클라이언트 상태 `ready`, 큐 flush.
   실패 시 `{t:'bootError', message}` → 상태 `error`, 대기 중 요청 전부 reject.

### matplotlib 지연 로드 정책 (선택한 구현)

- 부트 시 matplotlib을 내려받지 않는다. 초기화 스크립트의 `import matplotlib`은 `try/except ImportError`로 감싸져 있다.
- 워커는 **모든 run/repl 전에** `loadPackagesFromImports(code)`를 돌리고, 직후 `_pygrid_mpl_setup()`(멱등)을 호출한다.
  → 사용자가 처음 `import matplotlib` 하는 순간 패키지가 로드되고 Agg 백엔드 + Pretendard 폰트가 자동 적용된다.
- 초기화 스크립트에는 `loadPackagesFromImports`를 적용하지 않는다(guarded import를 부트 시 내려받지 않기 위함).
  **제약**: 커스텀 초기화 스크립트가 scipy 등 미로드 패키지를 import하면 ImportError가 stderr(id 0)로 보고되고 부트는 계속된다. — TODO(M4): 초기화 스크립트용 패키지 선로드 옵션.

## 준비 전 큐잉

`run`/`repl`/`analyze`/`inspect`/`reset`은 ready 전에 호출해도 되고, 클라이언트가 큐에 넣었다가 ready 때 순서대로 보낸다(스펙 §4.7 "런타임 준비 후 실행됩니다"). 워커 내부도 메시지를 프라미스 체인으로 **직렬 처리**한다 — 동시에 두 실행이 인터리빙되지 않는다.

## 메시지 목록

### 메인 → 워커 (`MainToWorker`)

| t | 필드 | 설명 |
|---|------|------|
| `boot` | indexURL, packages, initScript, fontUrl | 부트. 워커당 1회(중복 무시) |
| `setInterruptBuffer` | buffer: SharedArrayBuffer | 인터럽트 버퍼. 체인 밖에서 즉시 적용(부트 전이면 보관) |
| `analyze` | id, code | xl() 참조 추출. **M3는 빈 배열 반환** — TODO(M4) |
| `run` | id, blockId, code, snapshots, outputMode, includeIndex | 블록 실행. **M3는 snapshots 미사용, object 모드 repr 미리보기만** — TODO(M4): xl 캐시 주입 + convert.py 변환 |
| `repl` | id, code | 콘솔 실행(공유 네임스페이스) |
| `inspect` | id | 전역 변수 목록 |
| `resetRuntime` | id, initScript | 워커 안 best-effort 리셋(사용자 전역 삭제 → 초기화 스크립트 재실행) |

### 워커 → 메인 (`WorkerToMain`)

| t | 필드 | 설명 |
|---|------|------|
| `progress` | pct, label | 부트 진행률 |
| `ready` | pyVersion, pyodideVersion | 부트 완료 |
| `bootError` | message | 부트 실패 |
| `stdout` / `stderr` | id, chunk | 라인 단위 스트리밍. id = 진행 중인 run/repl id, **유휴(부트·리셋 출력)는 id 0** |
| `analyzed` | id, refs | M3: 항상 `[]` |
| `analyzeError` | id, message | M3: 미발생 |
| `result` | id, blockId + RunPayload | run 결과. 성공 M3: `kind:'object'`, typeName, `preview:{kind:'repr',repr}`. 실패: errorType(예외 클래스명)·message·traceback·durationMs |
| `replResult` | id, repr, stdout:'', stderr:'', traceback? | repr = 마지막 표현식의 `repr()`, None이면 null. stdout/stderr 필드는 빈 문자열(이미 스트리밍됨) |
| `variables` | id, vars: VariableInfo[] | name·type·shape(2D만)·summary(repr ≤80자). 모듈·함수·클래스·`_` 이름 제외 |
| `resetDone` | id | 리셋 완료 |

## 실행 의미론 (run/repl 공통)

1. `loadPackagesFromImports(code)` (오류 무시 — 구문 오류는 실행 단계에서 더 나은 트레이스백으로 보고)
2. `_pygrid_mpl_setup()` (멱등)
3. `_pygrid_run(code)`: `ast`로 본문을 exec하고, **마지막 문장이 표현식이면 eval해 repr 캡처**(None → null).
   예외 시 워커 래퍼 프레임을 지운 트레이스백(`<pygrid>` 프레임부터) + 예외 클래스명(errorType).
   `KeyboardInterrupt`(중단)도 같은 실패 경로로 보고된다 → errorType `"KeyboardInterrupt"`.
4. 제약: 콘솔/블록 코드의 **top-level await 미지원**(ast exec/eval 캡처 방식) — 필요해지면 `PyCF_ALLOW_TOP_LEVEL_AWAIT`로 확장.

## 타임아웃 · 인터럽트 · 재부트

- run/repl마다 타임아웃(기본 60초, `timeoutSec` 인자·`defaultTimeoutSec`으로 조정). 만료 시 `client.interrupt()`.
- `interrupt()`: `crossOriginIsolated`면 SAB[0]=2(SIGINT) → 실행 중 코드에 `KeyboardInterrupt`.
  **2초 안에 결과가 없거나 비격리 환경이면 `terminateAndReboot()`** — 워커 종료 후 같은 initScript로 재부트.
- `terminateAndReboot()`: 대기 중 요청 전부 `"런타임이 재설정되어 실행이 중단되었습니다"`로 reject, 상태 `rebooting` → `loading` → `ready`, `'reboot'` 이벤트 발생(UI 토스트: "런타임이 재설정되어 변수가 초기화되었습니다").
- `reset()`(워커 안 리셋)은 변수만 지운다. `sys.modules`에 남은 모듈 상태까지 지우려면 `terminateAndReboot()`.

## 클라이언트 API 요약 (`RuntimeClient`)

```ts
getRuntimeClient(): RuntimeClient            // 앱 전역 싱글턴 (브라우저 전용)
boot(opts?): Promise<void>                   // 멱등
run(blockId, code, snapshots?, outputMode?, includeIndex?, timeoutSec?): Promise<RunPayload>
repl(code, timeoutSec?): Promise<{ repr: string | null; traceback?: string }>
analyze(code): Promise<string[]>             // M3: []
inspect(): Promise<VariableInfo[]>
reset(): Promise<void>
interrupt(): void
terminateAndReboot(): Promise<void>
on(event, fn): () => void                    // 'progress' | 'status' | 'stdout' | 'stderr' | 'reboot'
getStatus(): 'idle'|'loading'|'ready'|'running'|'error'|'rebooting'
getVersions(): { pyVersion, pyodideVersion } | null
DEFAULT_INIT_SCRIPT                          // init_default.py 원문 (UI 기본값)
```

## M4에서 바뀔 표면 (grid-ui 참고)

- `analyze` → 실제 xl() 참조 문자열 배열(비리터럴 인수는 `analyzeError`).
- `run` → `snapshots`가 xl() 캐시에 주입되고, values 모드는 `cells: OutCell[][]`, table/image kind·`imagePng`(transferable) 등 RunPayload의 나머지 필드가 채워진다.
- 프로토콜 타입 자체(`protocol.ts`)는 M3에서 변경하지 않았다 — 소비 코드는 지금 형태로 작성해도 M4와 호환된다.
