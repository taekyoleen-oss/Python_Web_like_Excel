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
  {
    label: "종신공제 (다급부)",
    title: "종신공제 — 다급부 합산(이중탈퇴)",
    codeBlocks: 7,
  },
  {
    label: "정기보험 변형 (체증형·미달체)",
    title: "정기보험 변형 — 체증형·미달체 비교",
    codeBlocks: 6,
  },
  {
    label: "상해공제 (직종축)",
    title: "상해공제 — 직종별 위험률·만기환급형",
    codeBlocks: 7,
  },
  {
    label: "암보험 (진단 후 생활비)",
    title: "암보험 — 진단 후 생활비(연금) 현가",
    codeBlocks: 7,
  },
  {
    label: "CI종신 (3중탈퇴)",
    title: "CI종신 — 3중탈퇴 생존자표",
    codeBlocks: 7,
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
    if (s.label === "종신공제 (다급부)") {
      // 부록 M.5 #9 ⑥ — 원본 `총괄` 대조 검산표의 "차이" 열이 전부 허용오차(1e-6) 안이어야 한다
      const diffs = await columnUnder(page, "차이");
      expect(diffs.length).toBe(28);
      for (const d of diffs) expect(Math.abs(Number(d))).toBeLessThanOrEqual(1e-6);
      // ② 이중탈퇴 생존자표 — 가입 59세 ~ 만기 110세 = 52행
      expect(await spillRowsUnder(page, "lx'(납입자)")).toBe(52);
      // ④ 급부배율 SUMX 표 — 급부 5종
      expect(await spillRowsUnder(page, "비중(%)")).toBe(5);
      // ⑦ 급부별 기여도 · lx vs lx′ 그래프는 객체 모드
      const figures = await page.evaluate(() =>
        Object.values(
          (window as any).__pygridStore.getState().workbook.sheets[0].cells,
        ).filter((c: any) => String(c.v ?? "").startsWith("[Figure")).length,
      );
      expect(figures).toBeGreaterThan(0);
    }
    if (s.label === "정기보험 변형 (체증형·미달체)") {
      // 부록 M.5 #7 ⑥ — 원본 P·(표준)P·미달P·미달표준P·V·미달V 대조 27행 + 체증 항등식 1행
      const diffs = await columnUnder(page, "검산차이");
      expect(diffs.length).toBe(28);
      for (const d of diffs) expect(Math.abs(Number(d))).toBeLessThanOrEqual(1e-6);
      // ③ 미달체 비교표 — 항목 7행
      expect(await spillRowsUnder(page, "미달_경험x3")).toBe(7);
      // ④ 3종 비교표 — 평준·체증·미달
      expect(await spillRowsUnder(page, "영업P배수")).toBe(3);
      // ⑤ 3종 준비금·환급률 곡선은 객체 모드
      const figures = await page.evaluate(() =>
        Object.values(
          (window as any).__pygridStore.getState().workbook.sheets[0].cells,
        ).filter((c: any) => String(c.v ?? "").startsWith("[Figure")).length,
      );
      expect(figures).toBeGreaterThan(0);
    }
    if (s.label === "상해공제 (직종축)") {
      // 부록 M.5 #10 ⑥ — 원본 PV테이블 8행(형태 2 × 직종 2 × 성별 2) 대조. 원 단위라 차이 0
      for (const col of ["차이_영업", "차이_순", "차이_만기"]) {
        const diffs = await columnUnder(page, col);
        expect(diffs.length, col).toBe(8);
        for (const d of diffs) expect(Math.abs(Number(d))).toBeLessThanOrEqual(1e-6);
      }
      // ② 경과 기수표 — 경과 0~5년 6행 (x축이 나이가 아니다)
      expect(await spillRowsUnder(page, "lx(80)")).toBe(6);
      // ⑤ 직종 × 형태 매트릭스 — 8칸
      expect(await spillRowsUnder(page, "순공제료율")).toBe(8);
      // ⑦ 직종·형태별 공제료 그래프는 객체 모드
      const figures = await page.evaluate(() =>
        Object.values(
          (window as any).__pygridStore.getState().workbook.sheets[0].cells,
        ).filter((c: any) => String(c.v ?? "").startsWith("[Figure")).length,
      );
      expect(figures).toBeGreaterThan(0);
    }
    if (s.label === "암보험 (진단 후 생활비)") {
      // 부록 M.6 #11 ⑥ — 원본 `기수표(생활비암)` 공제료 블록·`급부기준` 45항목 대조
      const diffs = await columnUnder(page, "차이");
      expect(diffs.length).toBe(45);
      for (const d of diffs) expect(Math.abs(Number(d))).toBeLessThanOrEqual(1e-6);
      // ① 주요암 qc 도출 — 가입 40세 ~ 만기 15년 = 16행
      expect(await spillRowsUnder(page, "qc 주요암발생률")).toBe(16);
      // ② 암발생후사망률 2차원표 — 진단연령 16행 × 경과 0~10 (데이터 시트 헤더와 겹치지 않는 열로 센다)
      expect(await spillRowsUnder(page, "10년생존율")).toBe(16);
      // ④ 급부 6종 현가
      expect(await spillRowsUnder(page, "비중(%)")).toBe(6);
      // ⑦ 연령별 공제료·급부 구성비 그래프는 객체 모드
      const figs = await page.evaluate(() =>
        Object.values(
          (window as any).__pygridStore.getState().workbook.sheets[0].cells,
        ).filter((c: any) => String(c.v ?? "").startsWith("[Figure")).length,
      );
      expect(figs).toBeGreaterThan(0);
    }
    if (s.label === "CI종신 (3중탈퇴)") {
      // 부록 M.6 #12 ⑥ — 원본이 산출방법서 PDF(산식만·발생률 수치 없음)라 원본 산출값 대조가
      // 불가능하다. 검산 대신 **자체 정합성 검증** 29행 — `판정`에 '실패'가 하나도 없어야 한다.
      const verdicts = await columnUnder(page, "판정");
      expect(verdicts.length).toBe(29);
      expect(verdicts.filter((v) => v === "실패")).toEqual([]);
      expect(verdicts.filter((v) => v === "OK").length).toBeGreaterThanOrEqual(16);
      // ② 경합 제거 결합은 언제나 단순 합산보다 작다 (제1보험기간 40~80세 = 41행)
      const comb = await columnUnder(page, "q^CI(결합)");
      const naive = await columnUnder(page, "단순합 Σwʲ+b");
      expect(comb.length).toBe(41);
      expect(naive.length).toBe(41);
      comb.forEach((c, i) => expect(Number(c)).toBeLessThanOrEqual(Number(naive[i]) + 1e-12));
      // ③ 3중탈퇴 생존자표 — L¹은 단조감소하고 Lx를 넘지 않는다
      const L = (await columnUnder(page, "Lx")).map(Number);
      const L1 = (await columnUnder(page, "L1x")).map(Number);
      const L2 = (await columnUnder(page, "L2x")).map(Number);
      expect(L1.length).toBe(41);
      L1.forEach((v, i) => {
        expect(v).toBeLessThanOrEqual(L[i] + 1e-6);
        expect(L2[i]).toBeLessThanOrEqual(v + 1e-6);
        if (i > 0) expect(v).toBeLessThanOrEqual(L1[i - 1] + 1e-6);
      });
      // ④ 급부 기수 — 가입 40세 ~ 110세 = 71행
      expect(await spillRowsUnder(page, "C2x")).toBe(71);
      // ⑤ 보험료 산출 단계 18행
      expect(await spillRowsUnder(page, "산출항목")).toBe(18);
      // ⑦ 생존자 곡선·탈퇴 원인별 기여도는 객체 모드
      const figs = await page.evaluate(() =>
        Object.values(
          (window as any).__pygridStore.getState().workbook.sheets[0].cells,
        ).filter((c: any) => String(c.v ?? "").startsWith("[Figure")).length,
      );
      expect(figs).toBeGreaterThan(0);
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
