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

/** 헤더 문자열 v를 가진 셀 아래로 이어지는 값들 */
const columnUnder = (page: Page, header: string) =>
  page.evaluate((h) => {
    const st = (window as any).__pygridStore.getState();
    for (const sh of st.workbook.sheets) {
      const hit = Object.entries(sh.cells).find(([, c]: any) => c.v === h);
      if (!hit) continue;
      const [r, c] = (hit[0] as string).split(":").map(Number);
      const out: unknown[] = [];
      for (let i = 1; sh.cells[`${r + i}:${c}`] !== undefined; i++) {
        out.push(sh.cells[`${r + i}:${c}`].v);
      }
      return out;
    }
    return [];
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
  {
    label: "보험료 산출 (정기보험)",
    title: "보험료 산출 — 정기보험(계산기수·준비금)",
    codeBlocks: 6,
  },
  {
    label: "암보험 (다중탈퇴)",
    title: "암보험 — 다중탈퇴 기수·급부배율 보험료",
    codeBlocks: 7,
  },
  {
    label: "위험률 산출 (원시통계)",
    title: "위험률 산출 — 원시통계에서 적용률까지",
    codeBlocks: 6,
  },
  {
    label: "무해지환급형 (해지율 PV)",
    title: "무해지환급형 — 해지율 반영 PV 산출",
    codeBlocks: 6,
  },
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
    if (s.label === "보험료 산출 (정기보험)") {
      // 부록 M ② — 검산 표의 "차이" 열이 전부 허용오차(1e-6) 안이어야 한다
      const diffs = await columnUnder(page, "차이");
      expect(diffs.length).toBe(9);
      for (const d of diffs) expect(Math.abs(Number(d))).toBeLessThanOrEqual(1e-6);
      // 부록 M ④ — 표준·적용 비교표 spill (경과년 25행)
      expect(await spillRowsUnder(page, "표준준비금")).toBe(25);
      expect(await spillRowsUnder(page, "해약환급금")).toBe(25);
    }
    if (s.label === "암보험 (다중탈퇴)") {
      // 부록 M.4 ⑥ — 원본 `총괄` 대조 검산표의 "차이" 열이 전부 허용오차(1e-6) 안이어야 한다
      const diffs = await columnUnder(page, "차이");
      expect(diffs.length).toBe(12);
      for (const d of diffs) expect(Math.abs(Number(d))).toBeLessThanOrEqual(1e-6);
      // ② 다중탈퇴 생존자표 — 가입 40세 ~ 만기 80세 = 41행
      expect(await spillRowsUnder(page, "lx(2) 일반암")).toBe(41);
      // ④ 급부배율 표 — 담보 8종
      expect(await spillRowsUnder(page, "기여도")).toBe(8);
      // ⑦ 담보별 기여도 그래프는 객체 모드
      const figures = await page.evaluate(() =>
        Object.values(
          (window as any).__pygridStore.getState().workbook.sheets[0].cells,
        ).filter((c: any) => String(c.v ?? "").startsWith("[Figure")).length,
      );
      expect(figures).toBeGreaterThan(0);
    }
    if (s.label === "위험률 산출 (원시통계)") {
      // 부록 M.4 #5 ⑤ — 원본 `3. 산출결과` 대조표의 차이 열 (연령 19개 샘플)
      for (const col of ["차이_남", "차이_여"]) {
        const diffs = await columnUnder(page, col);
        expect(diffs.length, col).toBe(19);
        for (const d of diffs) expect(Math.abs(Number(d))).toBeLessThanOrEqual(1e-9);
      }
      // ④ 연령별 적용률 — 0~110세 111행
      expect(await spillRowsUnder(page, "최종_남")).toBe(111);
      // ⑥ 조율·적용률 곡선은 객체 모드
      const figures = await page.evaluate(() =>
        Object.values(
          (window as any).__pygridStore.getState().workbook.sheets[0].cells,
        ).filter((c: any) => String(c.v ?? "").startsWith("[Figure")).length,
      );
      expect(figures).toBeGreaterThan(0);
    }
    if (s.label === "무해지환급형 (해지율 PV)") {
      // 부록 M.4 #8 ⑥ — 원본 `P테이블` 10개 조합 대조. 요율은 원 단위라 차이 0이어야 한다
      for (const col of ["차이_순p", "차이_영업p", "차이_정기순p", "차이_알파"]) {
        const diffs = await columnUnder(page, col);
        expect(diffs.length, col).toBe(10);
        for (const d of diffs) expect(Math.abs(Number(d))).toBeLessThanOrEqual(1e-6);
      }
      // ② 이중탈퇴 생존자표 — 가입 45세 ~ 만기 90세 = 46행
      expect(await spillRowsUnder(page, "전탈퇴생존자")).toBe(46);
      // ⑤ 무해지 vs 표준형 환급률 곡선은 객체 모드
      const figures = await page.evaluate(() =>
        Object.values(
          (window as any).__pygridStore.getState().workbook.sheets[0].cells,
        ).filter((c: any) => String(c.v ?? "").startsWith("[Figure")).length,
      );
      expect(figures).toBeGreaterThan(0);
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
