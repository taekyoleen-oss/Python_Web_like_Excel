// lib/reference/fit-runner.ts — 모델 적합 엔진 어댑터 (R4·R5)
// FIT_SCRIPT(lib/reference/pyFit.ts — 단일 원본)를 이 앱의 워커 런타임에서 실행한다.
//
// 흐름: boot(멱등) → "pkg": `import scipy` repl(워커의 loadPackagesFromImports가 scipy를
// 내려받는다 — repl 코드가 exec 래퍼 한 줄이면 스크립트 내부 import를 못 보므로 별도 단계)
// → "run": _fit_input.json·_fit_script.py를 FS에 기록 → exec 래퍼 repl → _fit_output.json 회수.
//
// 네임스페이스 격리: FIT_SCRIPT는 모듈 수준 파이썬이라 repl로 직접 실행하면 수십 개
// 이름(INP·OUT·fit_freq…)이 사용자 전역에 남는다. 대신 스크립트를 FS 파일로 쓰고
// `exec(compile(...), {빈 dict})`로 실행 — 모든 이름이 임시 dict에 담겨 GC되고
// 사용자 전역에는 아무것도 남지 않는다(pkg 단계의 `import scipy`도 del로 지운다).

import { getRuntimeClient } from "@/lib/runtime/client";

import { FIT_SCRIPT, type FitPayload, type FitRunResult, type RunPhase } from "./pyFit";

export const INPUT_FILE = "_fit_input.json";
export const SCRIPT_FILE = "_fit_script.py";
export const OUTPUT_FILE = "_fit_output.json";

/** 사용자 전역을 오염시키지 않는 실행 래퍼 — tests/pyodide/fit.test.ts가 같은 경로를 검증한다 */
export const EXEC_WRAPPER =
  `exec(compile(open("${SCRIPT_FILE}", encoding="utf-8").read(), ` +
  `"${SCRIPT_FILE}", "exec"), {"__name__": "_pygrid_fit"})`;

/**
 * 적합 실행 — 런타임 부트(onPhase "boot") → scipy 로드("pkg") → 스크립트 실행("run").
 * 결과는 FitRunResult. 오류는 예외로 던진다(트레이스백 포함).
 */
export async function runDistributionFit(
  payload: FitPayload,
  onPhase: (p: RunPhase) => void,
): Promise<FitRunResult> {
  const client = getRuntimeClient();

  onPhase("boot");
  await client.boot();

  onPhase("pkg");
  const pkg = await client.repl("import scipy; del scipy");
  if (pkg.traceback) throw new Error(`scipy 로드 실패:\n${pkg.traceback}`);

  onPhase("run");
  const enc = new TextEncoder();
  await client.writeFile(INPUT_FILE, enc.encode(JSON.stringify(payload)));
  await client.writeFile(SCRIPT_FILE, enc.encode(FIT_SCRIPT));
  const r = await client.repl(EXEC_WRAPPER);
  if (r.traceback) throw new Error(`적합 실행 실패:\n${r.traceback}`);
  const out = await client.readFile(OUTPUT_FILE);
  return JSON.parse(new TextDecoder().decode(out)) as FitRunResult;
}
