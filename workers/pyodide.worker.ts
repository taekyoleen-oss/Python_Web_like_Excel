// workers/pyodide.worker.ts — Pyodide 모듈 워커 (M3: 부트·REPL·스트리밍·인터럽트)
// 계약: lib/runtime/protocol.ts (문서: /output/runtime-protocol.md)
// 규칙: PyProxy를 postMessage로 넘기지 않는다 — JSON-safe 페이로드만.

import type { PyodideInterface } from "pyodide";

import type { MainToWorker, VariableInfo, WorkerToMain } from "../lib/runtime/protocol";
import bootstrapPy from "../lib/runtime/py/bootstrap.py";

// tsconfig lib이 dom이므로 webworker 전역을 좁은 타입으로 캐스팅해 쓴다
// Next는 청크 끝에 `_N_E = __webpack_exports__` (output.library 대입)를 붙인다.
// 클래식 워커(sloppy)에서는 암묵적 전역이 되지만 모듈 워커(strict)에서는 ReferenceError가
// 나므로 전역 프로퍼티를 미리 만들어 둔다.
(globalThis as Record<string, unknown>)._N_E = undefined;

const ctx = globalThis as unknown as {
  postMessage(msg: WorkerToMain, transfer?: Transferable[]): void;
  location: { origin: string };
  addEventListener(type: "message", fn: (ev: MessageEvent<MainToWorker>) => void): void;
};

const post = (msg: WorkerToMain): void => ctx.postMessage(msg);

let pyodide: PyodideInterface | null = null;
let initScript = "";
/** 실행 중인 run/repl id. 유휴(부트·리셋 스크립트 출력)는 0 */
let currentRunId = 0;
/** boot 완료 전에 setInterruptBuffer가 오면 보관했다가 적용 */
let pendingInterrupt: Uint8Array | null = null;

interface PyRunResult {
  ok: boolean;
  repr?: string | null;
  type?: string | null;
  etype?: string;
  msg?: string;
  tb?: string;
}

/** _pygrid_run 헬퍼로 코드 실행(마지막 표현식 repr 캡처) */
async function pyRun(py: PyodideInterface, code: string): Promise<PyRunResult> {
  py.globals.set("_pygrid_code", code);
  const raw: string = await py.runPythonAsync("_pygrid_run(_pygrid_code)");
  return JSON.parse(raw) as PyRunResult;
}

/** import 기반 패키지 지연 로드 + matplotlib이 로드됐다면 Agg·폰트 설정(멱등) */
async function loadImports(py: PyodideInterface, code: string): Promise<void> {
  try {
    await py.loadPackagesFromImports(code);
  } catch {
    // 구문 오류 등은 _pygrid_run이 더 나은 트레이스백으로 보고한다
  }
  try {
    py.runPython("_pygrid_mpl_setup()");
  } catch {
    // 백엔드/폰트 설정 실패는 실행을 막지 않는다
  }
}

/** 초기화 스크립트 실행(부트·리셋 공용). 실패해도 부트는 계속한다 — stderr(id 0)로 알린다.
 *  주의: 여기서는 loadPackagesFromImports를 하지 않는다 — 기본 스크립트의 guarded
 *  `import matplotlib`을 부트 시 내려받지 않기 위해서다(지연 로드, CLAUDE.md §5).
 *  커스텀 초기화 스크립트가 추가 패키지를 import하면 ImportError가 stderr로 보고된다. */
async function runInitScript(py: PyodideInterface): Promise<void> {
  const r = await pyRun(py, initScript);
  if (!r.ok) {
    post({ t: "stderr", id: 0, chunk: `초기화 스크립트 오류:\n${r.tb ?? r.msg ?? ""}` });
  }
  try {
    py.runPython("_pygrid_mpl_setup()");
  } catch {
    // 무시
  }
}

async function boot(msg: Extract<MainToWorker, { t: "boot" }>): Promise<void> {
  if (pyodide) return; // 중복 부트 무시
  try {
    initScript = msg.initScript;

    post({ t: "progress", pct: 5, label: "스크립트 로드" });
    // webpackIgnore: npm pyodide는 번들에 넣지 않고 CDN(indexURL)에서 로드한다
    const mod = (await import(/* webpackIgnore: true */ msg.indexURL + "pyodide.mjs")) as {
      loadPyodide(opts: { indexURL: string }): Promise<PyodideInterface>;
    };

    post({ t: "progress", pct: 20, label: "런타임 초기화" });
    const py = await mod.loadPyodide({ indexURL: msg.indexURL });

    py.setStdout({ batched: (chunk) => post({ t: "stdout", id: currentRunId, chunk }) });
    py.setStderr({ batched: (chunk) => post({ t: "stderr", id: currentRunId, chunk }) });

    post({ t: "progress", pct: 45, label: "패키지 로드(numpy·pandas)" });
    if (msg.packages.length > 0) await py.loadPackage(msg.packages);

    post({ t: "progress", pct: 75, label: "폰트 등록" });
    try {
      const fontUrl = new URL(msg.fontUrl, ctx.location.origin).href;
      const resp = await fetch(fontUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const bytes = new Uint8Array(await resp.arrayBuffer());
      py.FS.mkdirTree("/fonts");
      py.FS.writeFile("/fonts/Pretendard-Regular.otf", bytes);
    } catch {
      post({ t: "stderr", id: 0, chunk: "한글 폰트 등록 실패 — 차트 한글이 깨질 수 있습니다" });
    }

    py.runPython(bootstrapPy); // _pygrid_* 헬퍼 정의

    post({ t: "progress", pct: 90, label: "초기화 스크립트" });
    pyodide = py;
    if (pendingInterrupt) {
      py.setInterruptBuffer(pendingInterrupt);
      pendingInterrupt = null;
    }
    await runInitScript(py);

    post({ t: "progress", pct: 100, label: "완료" });
    post({
      t: "ready",
      pyVersion: py.runPython("__import__('sys').version.split()[0]") as string,
      pyodideVersion: py.version,
    });
  } catch (err) {
    post({ t: "bootError", message: err instanceof Error ? err.message : String(err) });
  }
}

async function handleRepl(msg: Extract<MainToWorker, { t: "repl" }>): Promise<void> {
  const py = pyodide;
  if (!py) {
    post({
      t: "replResult",
      id: msg.id,
      repr: null,
      stdout: "",
      stderr: "",
      traceback: "런타임이 아직 준비되지 않았습니다",
    });
    return;
  }
  currentRunId = msg.id;
  try {
    await loadImports(py, msg.code);
    const r = await pyRun(py, msg.code);
    post({
      t: "replResult",
      id: msg.id,
      repr: r.ok ? (r.repr ?? null) : null,
      stdout: "", // stdout/stderr는 이미 스트리밍됨
      stderr: "",
      ...(r.ok ? {} : { traceback: r.tb ?? r.msg ?? "실행 오류" }),
    });
  } catch (err) {
    post({
      t: "replResult",
      id: msg.id,
      repr: null,
      stdout: "",
      stderr: "",
      traceback: err instanceof Error ? err.message : String(err),
    });
  } finally {
    currentRunId = 0;
  }
}

async function handleRun(msg: Extract<MainToWorker, { t: "run" }>): Promise<void> {
  const t0 = performance.now();
  const fail = (errorType: string, message: string, traceback: string): void =>
    post({
      t: "result",
      id: msg.id,
      blockId: msg.blockId,
      ok: false,
      errorType,
      message,
      traceback,
      stdout: "",
      stderr: "",
      durationMs: Math.round(performance.now() - t0),
    });
  const py = pyodide;
  if (!py) {
    fail("RuntimeNotReady", "런타임이 아직 준비되지 않았습니다", "");
    return;
  }
  // TODO(M4): msg.snapshots를 xl.py 캐시에 주입하고 outputMode/includeIndex에 따라
  //           convert.py로 values/object 변환을 수행한다. M3는 repr 미리보기만 반환.
  currentRunId = msg.id;
  try {
    await loadImports(py, msg.code);
    const r = await pyRun(py, msg.code);
    const durationMs = Math.round(performance.now() - t0);
    if (r.ok) {
      post({
        t: "result",
        id: msg.id,
        blockId: msg.blockId,
        ok: true,
        kind: "object",
        typeName: r.type ?? "NoneType",
        preview: { kind: "repr", repr: r.repr ?? "None" },
        stdout: "",
        stderr: "",
        durationMs,
      });
    } else {
      post({
        t: "result",
        id: msg.id,
        blockId: msg.blockId,
        ok: false,
        errorType: r.etype ?? "Exception",
        message: r.msg ?? "",
        traceback: r.tb ?? "",
        stdout: "",
        stderr: "",
        durationMs,
      });
    }
  } catch (err) {
    fail("WorkerError", err instanceof Error ? err.message : String(err), "");
  } finally {
    currentRunId = 0;
  }
}

function handleInspect(msg: Extract<MainToWorker, { t: "inspect" }>): void {
  const py = pyodide;
  if (!py) {
    post({ t: "variables", id: msg.id, vars: [] });
    return;
  }
  try {
    const raw = py.runPython("_pygrid_inspect()") as string;
    post({ t: "variables", id: msg.id, vars: JSON.parse(raw) as VariableInfo[] });
  } catch {
    post({ t: "variables", id: msg.id, vars: [] });
  }
}

async function handleReset(msg: Extract<MainToWorker, { t: "resetRuntime" }>): Promise<void> {
  const py = pyodide;
  if (py) {
    initScript = msg.initScript;
    try {
      py.runPython("_pygrid_reset()");
      await runInitScript(py);
    } catch {
      // best-effort — 완전 리셋은 클라이언트의 terminateAndReboot가 담당
    }
  }
  post({ t: "resetDone", id: msg.id });
}

async function dispatch(msg: MainToWorker): Promise<void> {
  switch (msg.t) {
    case "boot":
      return boot(msg);
    case "repl":
      return handleRepl(msg);
    case "run":
      return handleRun(msg);
    case "analyze":
      // TODO(M4): xl.py의 ast 분석으로 실제 xl() 참조를 추출한다
      post({ t: "analyzed", id: msg.id, refs: [] });
      return;
    case "inspect":
      handleInspect(msg);
      return;
    case "resetRuntime":
      return handleReset(msg);
    default:
      return;
  }
}

// 메시지는 프라미스 체인으로 직렬 처리한다(run/repl 인터리빙 시 currentRunId가 섞이는 것 방지).
// setInterruptBuffer만 예외 — 실행 중에도 즉시 적용해야 하므로 체인에 넣지 않는다.
let chain: Promise<void> = Promise.resolve();

ctx.addEventListener("message", (ev) => {
  const msg = ev.data;
  if (msg.t === "setInterruptBuffer") {
    const view = new Uint8Array(msg.buffer);
    if (pyodide) pyodide.setInterruptBuffer(view);
    else pendingInterrupt = view;
    return;
  }
  chain = chain.then(() => dispatch(msg)).catch(() => undefined);
});
