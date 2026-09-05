// R5 모델 적합 엔진 — FIT_SCRIPT를 Node용 Pyodide(314/Python 3.14 + 현재 scipy)에서
// 실제 실행해 이식 호환성을 검증한다. 실행 경로는 fit-runner와 동일:
// _fit_input.json 기록 → _fit_script.py를 빈 dict exec → _fit_output.json 회수.
// 첫 실행은 scipy CDN 다운로드로 느리다(node_modules/.pyodide-cache에 캐시).

import path from "node:path";

import { loadPyodide, type PyodideInterface } from "pyodide";
import { beforeAll, expect, test, vi } from "vitest";

import { EXEC_WRAPPER, INPUT_FILE, OUTPUT_FILE, SCRIPT_FILE } from "@/lib/reference/fit-runner";
import { FIT_SCRIPT, type FitPayload, type FitRunResult } from "@/lib/reference/pyFit";

// fit-runner → client.ts의 .py import(webpack asset/source)를 대체 — 여기서는 워커를 안 쓴다
vi.mock("@/lib/runtime/py/init_default.py", () => ({ default: "" }));

let py: PyodideInterface;
const enc = new TextEncoder();

const runFit = (payload: FitPayload): FitRunResult => {
  py.FS.writeFile(INPUT_FILE, enc.encode(JSON.stringify(payload)));
  py.runPython(EXEC_WRAPPER);
  const out = py.FS.readFile(OUTPUT_FILE) as Uint8Array;
  return JSON.parse(new TextDecoder().decode(out)) as FitRunResult;
};

// 결정적 의사난수(mulberry32) + Box-Muller → 로그정규(mu=1, sigma=0.5) 60개
const lognormalSample = (): number[] => {
  let seed = 42;
  const rand = (): number => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out: number[] = [];
  for (let i = 0; i < 60; i++) {
    const u1 = Math.max(rand(), 1e-12);
    const u2 = rand();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    out.push(Math.exp(1 + 0.5 * z));
  }
  return out;
};

const GRID = Array.from({ length: 40 }, (_, i) => 0.1 + i * 0.4);

beforeAll(async () => {
  py = await loadPyodide({
    packageCacheDir: path.resolve("node_modules/.pyodide-cache"),
  });
  await py.loadPackage(["numpy", "scipy"]);
  py.FS.writeFile(SCRIPT_FILE, enc.encode(FIT_SCRIPT));
}, 600_000);

test("개별 심도 — 로그정규·지수 적합: 필드 채움 + 로그정규가 AIC로 우세", () => {
  const res = runFit({
    mode: "individual",
    values: lognormalSample(),
    grid: GRID,
    sevDists: ["lognormal", "exponential"],
  });
  expect(res.severity).toHaveLength(2);
  const [ln, ex] = res.severity;
  expect(ln.id).toBe("lognormal");
  expect(ex.id).toBe("exponential");
  for (const row of [ln, ex]) {
    expect(row.ok).toBe(true);
    expect(row.params!.length).toBeGreaterThan(0);
    for (const f of [row.logL, row.aic, row.bic, row.ksD, row.ksP, row.a2] as number[]) {
      expect(Number.isFinite(f)).toBe(true);
    }
    expect(row.pdfY).toHaveLength(GRID.length);
    expect(row.cdfY).toHaveLength(GRID.length);
    expect(row.qq!.theo.length).toBeGreaterThan(0);
    expect(row.qq!.theo.length).toBe(row.qq!.samp.length);
  }
  // 참 모형(mu=1, sigma=0.5) 회수
  const p = Object.fromEntries(ln.params!.map((x) => [x.name, x.value]));
  expect(p.mu).toBeGreaterThan(0.7);
  expect(p.mu).toBeLessThan(1.3);
  expect(p.sigma).toBeGreaterThan(0.3);
  expect(p.sigma).toBeLessThan(0.7);
  expect(ln.aic!).toBeLessThan(ex.aic!);
});

test("그룹 심도 — 구간 우도 MLE: 지수·감마 적합 + χ² 필드", () => {
  const res = runFit({
    mode: "grouped",
    groups: { lo: [0, 1, 2, 3, 4], hi: [1, 2, 3, 4, 5], n: [40, 25, 15, 10, 5] },
    grid: GRID,
    sevDists: ["exponential", "gamma"],
  });
  expect(res.severity).toHaveLength(2);
  for (const row of res.severity) {
    expect(row.ok).toBe(true);
    expect(row.params!.length).toBeGreaterThan(0);
    for (const f of [row.logL, row.aic, row.bic, row.chi2] as number[]) {
      expect(Number.isFinite(f)).toBe(true);
    }
    expect(typeof row.chi2Df).toBe("number");
    expect(row.pdfY).toHaveLength(GRID.length);
    expect(row.qq!.theo.length).toBe(row.qq!.samp.length);
  }
});

test("빈도 — 포아송 MLE: lambda=평균, PMF·χ² 필드", () => {
  const counts = [2, 3, 1, 4, 2, 3, 5, 2, 3, 4]; // 평균 2.9
  const kGrid = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const res = runFit({
    mode: "individual",
    values: [],
    grid: GRID,
    sevDists: [],
    freq: { counts, dists: ["poisson"], kGrid },
  });
  expect(res.severity).toHaveLength(0);
  expect(res.frequency).toHaveLength(1);
  const row = res.frequency[0];
  expect(row.ok).toBe(true);
  expect(row.params![0].name).toBe("lambda");
  expect(row.params![0].value).toBeCloseTo(2.9, 6);
  for (const f of [row.logL, row.aic, row.bic, row.chi2] as number[]) {
    expect(Number.isFinite(f)).toBe(true);
  }
  expect(row.pmfY).toHaveLength(kGrid.length);
  expect(row.cdfY).toHaveLength(kGrid.length);
});

test("네임스페이스 격리 — exec 래퍼는 전역에 이름을 남기지 않는다", () => {
  // 위 테스트들이 이미 래퍼를 실행했다 — 스크립트 내부 이름이 __main__에 없어야 한다
  expect(
    py.runPython('any(n in globals() for n in ("INP", "OUT", "GRID", "fit_freq", "ZeroInflated"))'),
  ).toBe(false);
});
