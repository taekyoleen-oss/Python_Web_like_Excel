import type { NextConfig } from "next";

// COOP/COEP는 SharedArrayBuffer(실행 중단 인터럽트 버퍼)에 필요하다.
// jsDelivr는 CORP: cross-origin을 보내므로 require-corp에서도 Pyodide CDN 로드가 된다.
const crossOriginIsolationHeaders = [
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: crossOriginIsolationHeaders }];
  },
  webpack: (config) => {
    // lib/runtime/py/*.py 를 문자열로 번들해 워커에 주입한다
    config.module.rules.push({ test: /\.py$/, type: "asset/source" });
    return config;
  },
};

export default nextConfig;
