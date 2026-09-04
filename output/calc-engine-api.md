# 계산 엔진 API (M5) — grid-ui 연결 계약

원본: `lib/runtime/calc-engine.ts` (순수 TS, 스토어 비의존). 워커 프로토콜은 `output/runtime-protocol.md`.

## 순수 함수 (dirty 배지·검사용으로 grid-ui가 직접 호출 가능)

```ts
resolveRefs(refs, ownSheetId, resolveSheet): SheetRange[]   // 잘못된 참조는 건너뜀
buildGraph(blocks, resolved, spills): CalcGraph             // B의 참조 ∩ A의 spill(값 모드)/앵커(객체 모드)
calcOrder(blocks, sheetOrder, graph): { order, cycle }      // Kahn, 동순위 (시트 순, 앵커 r, c)
dirtyPropagation(resolved, graph, editedRanges, editedBlockIds): Set<blockId>
```

- `WorkbookView` = `{ blocks: CalcBlock[], sheetOrder: string[], spills: Map<id, CellRange|undefined> }` — 호출 시점 스토어 상태의 평면 사본. `CalcBlock` = PyBlock의 `{id, sheetId, anchor, code, outputMode, includeIndex, output?, kind?}` 부분집합.
- **마크다운 블록 제외(v1.1)**: `kind === "markdown"`인 블록은 실행 대상이 아니다(`isExecutable(b)`). `buildGraph`가 노드에서 빼므로 **의존 대상도 되지 못하고**(다른 블록이 그 앵커를 참조해도 의존이 생기지 않음), `calcOrder`의 `order`·`cycle`, `dirtyPropagation`의 결과, `runAll`/`runBlocks`/`notifyEdit` 큐에도 들어가지 않는다. `analyze`·`run` 메시지가 워커로 나가지 않고 `onBusy`/`onResult`도 호출되지 않는다. → grid-ui는 마크다운 카드에 실행 배지·`#BUSY!`·오류 셀을 표시하지 않는다.
  - `dirtyPropagation`은 `graph.deps`에 없는 id(마크다운 등)를 `editedBlockIds`·`resolved` 양쪽에서 걸러낸다 — 마크다운 본문을 편집해도 dirty 배지가 생기지 않는다.
- **출력 선택 전달(v1.1)**: `block.output`(`OutputSelection`)은 `client.run(..., timeoutSec, output)`의 마지막 인자로 그대로 넘어간다. 의미론은 `output/runtime-protocol.md` "출력 선택 계약".
- 값 모드 블록에 기록된 spill이 없으면(첫 실행 전 등) **앵커 1×1**이 의존 대상이 된다.
- **순환**: 순환에 속한 블록 전부 `cycle`, `order`에서 제외. 순환의 *하위*(순환을 참조하지만 스스로는 순환이 아닌) 블록은 순환 의존을 무시하고 `order`에 남는다 — 실행 시 이전 spill 값 또는 xl() 안전망(RuntimeError)으로 진행.
- **변수 공유 한계**(§2.4): `xl()` 없이 변수로만 이어진 블록은 의존성으로 추적되지 않는다. 순서 보장은 `runAll`(전 블록 calcOrder)에서만 — UI 안내 문구 필요.

## RunCoordinator

```ts
const co = new RunCoordinator(getRuntimeClient(), host);
co.mode = "auto" | "manual";      // 수동이면 notifyEdit 무시 (배지는 dirtyPropagation으로 직접)
co.timeoutSec = 60;               // 워크북 설정 값 전달
co.notifyEdit(ranges, blockIds, view);  // 자동 모드: 500ms 디바운스 → dirty만 실행
co.runAll(view);                  // 전체 실행 (전 블록)
co.runBlocks(ids, view);          // ▶: 시드 + 하위 의존
co.whenIdle();                    // 예약된 실행 완료 대기
```

`whenIdle()`은 **이미 큐에 들어간 실행만** 기다린다 — 아직 발화하지 않은 디바운스 타이머(notifyEdit 후 500ms 이내)는 포함하지 않으므로, 완전한 유휴가 필요하면(저장 직전 등) 디바운스가 발화한 뒤(또는 flush 후) `whenIdle()`을 기다릴 것.

- 실행은 **직렬 큐**(한 번에 한 시퀀스). analyze 결과는 코드 문자열 키로 캐시.
- 스냅샷은 `host.getCell`로 그 시점 그리드 값에서 만든다. 키는 analyze refs **원문 그대로**.

## CalcHost — grid-ui가 구현

```ts
interface CalcHost {
  getCell(sheetId, r, c): { v, t } | undefined;   // 빈 셀 → undefined
  resolveSheet(name): string | undefined;          // 시트 이름 → id
  onBusy(blockId): void;                           // 실행 대기 → '#BUSY!' 표시
  onResult(blockId, payload: RunPayload, cells: Cell[][]|null, spill: CellRange|null): void;
}
```

`onResult` 규약:
- `payload.ok && cells` — 값 모드 성공. **spill 충돌 검사(#SPILL!)와 셀 반영(src=blockId), 한 스토어 트랜잭션 = 한 undo 단계**는 grid-ui 몫. `spill`은 `spillRange(anchor, shape)` 계산값.
- `payload.ok && !cells` — 객체 모드 성공(객체 카드: kind/typeName/shape/preview/imagePng).
- `!payload.ok` — `#PYTHON!` 셀 + 진단 탭. 합성 errorType(엔진 발신, traceback 없음):

| errorType | message | 발생 |
|---|---|---|
| `PyGridCycleError` | `순환 참조` | 순환 구성원 (매 실행 시퀀스마다 전부 통지) |
| `PyGridAnalyzeError` | analyze의 한국어 메시지 (`xl() 인수는 문자열 리터럴이어야 합니다` 등) | 비리터럴 인수·구문 오류 |
| `PyGridRefError` | `잘못된 셀 참조입니다: …` / `시트를 찾을 수 없습니다: …` | A1 파스·시트 해석 실패 |
| `WorkerError` | 재부트 등 요청 거부 메시지 | client.run reject (타임아웃→재부트 포함) |

그 외 errorType은 워커 발신 Python 예외 클래스명(`errors-ko.ts` 매핑 대상).
