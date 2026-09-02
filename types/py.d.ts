// lib/runtime/py/*.py 는 next.config.ts의 asset/source 규칙으로 문자열 번들된다
declare module "*.py" {
  const source: string;
  export default source;
}
