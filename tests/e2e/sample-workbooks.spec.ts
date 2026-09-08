import { expect, test, type Page } from "@playwright/test";

// 부록 K — 계리 예제 데이터 내장 워크북 5종.
// 헤더 샘플 워크북 메뉴에서 열고 전체 실행 → 모든 코드 블록 status 'ok'(실런타임).
// scipy·statsmodels 첫 로드가 있어 테스트당 5분 상한.

/* eslint-disable @typescript-eslint/no-explicit-any */

async function waitForApp(page: Page) {
  await page.waitForFunction(
    () =>
      typeof (window as unknown as { __pygridStore?: unknown }).__pygridStore !== "undefined" &&
      (window as unknown as { __pygridReady?: boolean }).__pygridReady === true,
  );
  await page.waitForSelector('[data-testid="data-grid-canvas"]');
}

/** 코드 블록 실행 상태 목록 */
const codeStatuses = (page: Page) =>
  page.evaluate(() =>
    (window as any).__pygridStore
      .getState()
      .workbook.pyBlocks.filter((b: any) => b.kind !== "markdown")
      .map((b: any) => b.last?.status ?? null),
  );

/** 헤더 문자열 v를 가진 셀 아래로 이어지는 값의 개수 (spill 행 수) */
const spillRowsUnder = (page: Page, header: string) =>
  page.evaluate((h) => {
    const st = (window as any).__pygridStore.getState();
    for (const sh of st.workbook.sheets) {
      const hit = Object.entries(sh.cells).find(([, c]: any) => c.v === h);
      if (!hit) continue;
      const [r, c] = (hit[0] as string).split(":").map(Number);
      let n = 0;
      while (sh.cells[`${r + n + 1}:${c}`] !== undefined) n++;
      return n;
    }
    return -1;
  }, header);

/** 헤더의 샘플 워크북 메뉴 > <label> (파일 메뉴에서 분리됨) */
async function openSample(page: Page, label: string, title: string) {
  await page.getByRole("button", { name: "샘플 워크북", exact: true }).click();
  await page.getByRole("menuitem", { name: label, exact: true }).click();
  await expect
    .poll(
      () => page.evaluate(() => (window as any).__pygridStore.getState().workbook.title),
      { timeout: 30_000 },
    )
    .toBe(title);
}

/** 전체 실행 → 모든 코드 블록이 'ok'가 될 때까지 대기 */
async function runAll(page: Page, codeBlocks: number) {
  await page.getByRole("button", { name: "전체 실행", exact: true }).click();
  await expect
    .poll(async () => (await codeStatuses(page)).join(","), {
      timeout: 270_000,
      intervals: [3000],
    })
    .toBe(Array(codeBlocks).fill("ok").join(","));
}

const SAMPLES = [
  { label: "위험률·생명표", title: "위험률·생명표 예제", codeBlocks: 4 },
  { label: "보험료 요인 분석 (GLM)", title: "보험료 요인 분석 예제", codeBlocks: 4 },
  { label: "빈도·심도 모형", title: "빈도·심도 모형 예제", codeBlocks: 5 },
  { label: "생존분석·유지율", title: "생존분석·유지율 예제", codeBlocks: 4 },
  { label: "지급준비금 (체인래더)", title: "지급준비금 체인래더 예제", codeBlocks: 5 },
];

for (const s of SAMPLES) {
  test(`샘플 워크북: ${s.label} — 로드 직후 전체 실행 성공`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto("/");
    await waitForApp(page);
    await openSample(page, s.label, s.title);
    await runAll(page, s.codeBlocks);

    // 데이터가 시트에 내장되어 있어야 한다 (외부 파일 의존 없음)
    const dataRows = await page.evaluate(
      () => Object.keys((window as any).__pygridStore.getState().workbook.sheets[0].cells).length,
    );
    expect(dataRows).toBeGreaterThan(50);

    if (s.label === "보험료 요인 분석 (GLM)") {
      // GLM 계수표 spill — 상수항 + 연속형 4 + 더미 9 = 14행
      expect(await spillRowsUnder(page, "상대도 exp(계수)")).toBeGreaterThan(1);
      expect(await spillRowsUnder(page, "상대도 exp(계수)")).toBe(14);
    }
    if (s.label === "생존분석·유지율") {
      // KM 생존곡선은 객체 모드 — 앵커 셀에 Figure 카드가 놓인다
      const figures = await page.evaluate(() => {
        const st = (window as any).__pygridStore.getState();
        return Object.values(st.workbook.sheets[0].cells).filter((c: any) =>
          String(c.v ?? "").startsWith("[Figure"),
        ).length;
      });
      expect(figures).toBeGreaterThan(0);
      // 생존표 spill — 해지 시점 62개
      expect(await spillRowsUnder(page, "생존확률")).toBe(62);
    }
    if (s.label === "지급준비금 (체인래더)") {
      // 준비금 — 첫 사고연도는 완전 진전이라 0
      const first = await page.evaluate(() => {
        const st = (window as any).__pygridStore.getState();
        const sh = st.workbook.sheets[0];
        const hit = Object.entries(sh.cells).find(([, c]: any) => c.v === "준비금");
        if (!hit) return null;
        const [r, c] = (hit[0] as string).split(":").map(Number);
        return sh.cells[`${r + 1}:${c}`]?.v ?? null;
      });
      expect(first).toBe(0);
    }
  });
}
