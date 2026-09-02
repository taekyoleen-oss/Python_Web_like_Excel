import { defineConfig } from "vitest/config";
import path from "node:path";

// Node용 Pyodide로 xl.py/convert.py를 실제 실행하는 느린 스위트.
// 첫 실행 시 numpy·pandas를 CDN에서 받아 node_modules/.pyodide-cache에 캐시한다.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    include: ["tests/pyodide/**/*.test.ts"],
    environment: "node",
    testTimeout: 120_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
