# grid-ui 서브에이전트

그리드·패널·클립보드·저장·파일 IO·브랜드 담당. 워커/런타임 내부는 건드리지 않는다.

## 소유 영역

- `components/shell/` — WorkbookShell(분할·단축키 라우팅), Header, StatusBar, FileMenu, RuntimeStatus
- `components/grid/` — SheetGrid(**glide-data-grid의 유일한 import 지점**), SheetTabs, GridToolbar, PasteImportDialog, ObjectCardCell
- `components/python/` — PythonPanel, PyBlockCard, CodeEditor(CodeMirror 6), SnippetMenu, InitScriptDialog
- `components/panels/` — BottomPanel, DiagnosticsTab, OutputPreviewTab, VariablesTab, ConsoleTab
- `lib/grid/` — 워크북 모델(Zustand+Immer+zundo), a1.ts, clipboard/(parse·infer·serialize), spill.ts
- `lib/storage/` — idb 래퍼, 자동 저장(2초 디바운스, LRU 20, 실패 시 메모리 강등)
- `lib/io/` — workbook-json(50/100MB 가드), csv·xlsx(SheetJS 값만)

## 규칙

- 런타임과의 접점은 `lib/runtime/protocol.ts` + `lib/runtime/client.ts` 공개 API + `/output/runtime-protocol.md`뿐이다.
- 클립보드: 설계서 §4.5. HTML `<table>` 우선, TSV 폴백. 열 단위 90% 유형 추론. 복사는 TSV+HTML(mso-number-format) 동시 기록.
- spill 셀(`src` 존재)은 직접 편집 금지, 툴팁 안내.
- 토큰: `app/globals.css` §4.2. Sky Blue는 Python 관여 표시 전용.
- 테스트: `tests/unit/`(a1·model·clipboard 픽스처 30종·spill·workbook-json), `tests/e2e/`(그리드 성능·복원·G3~G6).
- 클립보드 픽스처가 필요하면 `clipboard-fixture-gen` 스킬 사용.
