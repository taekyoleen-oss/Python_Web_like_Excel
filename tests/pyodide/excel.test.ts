// R5 엑셀 엔진 지연 설치 — Pyodide 314.0.6 배포판에는 openpyxl이 아예 없다
// (loadPackage가 "No known package" 예외). 따라서 워커 ensureExcelSupport의 실경로는
// micropip(PyPI) 폴백이며, 여기서 그 폴백 체인 전체를 Node에서 그대로 재현해 검증한다.
// 게이트 정규식은 tests/unit/runtime-files.test.ts가 커버한다.

import path from "node:path";

import { loadPyodide, type PyodideInterface } from "pyodide";
import { beforeAll, expect, test } from "vitest";

let py: PyodideInterface;

beforeAll(async () => {
  py = await loadPyodide({
    packageCacheDir: path.resolve("node_modules/.pyodide-cache"),
  });
  await py.loadPackage(["numpy", "pandas"]);
}, 600_000);

test("엑셀 엔진 없이 to_excel → ImportError (지연 설치 게이트가 필요한 이유)", () => {
  expect(() =>
    py.runPython(
      'import pandas as pd\npd.DataFrame({"a": [1]}).to_excel("_x.xlsx", index=False)',
    ),
  ).toThrow(/openpyxl|ImportError|ModuleNotFoundError/);
});

test("워커 폴백 체인 재현 — loadPackage 실패 → micropip 설치 → 왕복", async () => {
  // 1차 시도(배포판): 314.0.6에는 openpyxl이 없어 실패해야 한다 — 폴백이 실경로라는 증거
  await expect(py.loadPackage("openpyxl")).rejects.toThrow(/No known package/);
  // 2차(micropip · PyPI) — 워커 ensureExcelSupport와 동일한 호출
  await py.loadPackage("micropip");
  const micropip = py.pyimport("micropip") as {
    install(pkg: string): Promise<void>;
    destroy(): void;
  };
  await micropip.install("openpyxl");
  micropip.destroy();
  py.runPython(`
import pandas as pd
pd.DataFrame({"a": [1, 2], "b": ["x", "y"]}).to_excel("_roundtrip.xlsx", index=False)
_df = pd.read_excel("_roundtrip.xlsx")
assert _df.shape == (2, 2), _df.shape
assert list(_df["a"]) == [1, 2]
assert list(_df["b"]) == ["x", "y"]
`);
}, 300_000);
