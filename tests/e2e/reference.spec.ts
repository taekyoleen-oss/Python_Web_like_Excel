import { expect, test, type Page } from "@playwright/test";

// 부록 E R2·R3: 참조 뷰(데이터 예제/분석) — 뷰 전환·엑셀함수/파이썬코드 탭·
// 다이얼로그·블록으로 보내기·워크북 상태 보존·단축키 격리.
// 한 테스트로 묶어 페이지 로드를 1회만 치른다.

/* eslint-disable @typescript-eslint/no-explicit-any */

async function waitForApp(page: Page) {
  await page.waitForFunction(
    () =>
      typeof (window as unknown as { __pygridStore?: unknown }).__pygridStore !== "undefined" &&
      (window as unknown as { __pygridReady?: boolean }).__pygridReady === true,
  );
  await page.waitForSelector('[data-testid="data-grid-canvas"]');
  await page.evaluate(() => {
    (window as any).__pygridStore.getState().newWorkbook();
  });
}

const blockCount = (page: Page) =>
  page.evaluate(() => (window as any).__pygridStore.getState().workbook.pyBlocks.length);

test("참조 뷰: 전환 → 엑셀함수 사분면·다이얼로그 → 파이썬코드 → 블록으로 보내기 → 워크북 왕복", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await waitForApp(page);

  // 워크북 상태 표식 — 뷰 왕복 후에도 살아 있어야 한다
  await page.evaluate(() => {
    const st = (window as any).__pygridStore.getState();
    st.setCellValue(st.activeSheetId, 0, 0, { v: "지속성", t: "s" });
  });

  // ── 참조 뷰로 전환 (엑셀함수 탭 기본) ──
  await page.getByTestId("view-reference").click();
  const quadrant = page.getByTestId("excel-quadrant");
  await expect(quadrant).toBeVisible({ timeout: 60_000 }); // dev 첫 컴파일 여유

  // 참조 뷰에서는 Ctrl+Shift+P가 블록을 만들지 않는다
  await page.keyboard.press("Control+Shift+P");
  expect(await blockCount(page)).toBe(0);

  // 사분면에 함수명 렌더 (결정적 배치)
  await expect(quadrant.getByRole("button", { name: "AVERAGE", exact: true })).toBeVisible();
  await expect(quadrant.getByRole("button", { name: "MEDIAN", exact: true })).toBeVisible();
  // 버전 위첨자가 이름에 붙는 함수 (XLOOKUP²¹)
  await expect(quadrant.getByRole("button", { name: /^XLOOKUP/ })).toBeVisible();

  // ── AVERAGE 다이얼로그 — 예제 필터(전체/기초/고급) ──
  await quadrant.getByRole("button", { name: "AVERAGE", exact: true }).click();
  const fnDialog = page.getByTestId("excel-fn-dialog");
  await expect(fnDialog).toBeVisible();
  await expect(fnDialog.getByText("=AVERAGE(숫자1, [숫자2], ...)")).toBeVisible(); // 구문
  await expect(fnDialog.getByText("특정 상품만 골라 평균 (조건부)")).toBeVisible(); // 고급 예제
  await fnDialog.getByRole("button", { name: "기초", exact: true }).click();
  await expect(fnDialog.getByText("특정 상품만 골라 평균 (조건부)")).toBeHidden();
  await expect(fnDialog.getByText("청구액 평균 구하기")).toBeVisible(); // 기초 예제 유지
  await page.keyboard.press("Escape");
  await expect(fnDialog).toBeHidden();

  // ── 파이썬코드 탭 — 메서드 다이얼로그 ──
  await page.getByTestId("ref-tab-methods").click();
  const mq = page.getByTestId("method-quadrant");
  await expect(mq).toBeVisible();
  await mq.getByRole("button", { name: "선형회귀", exact: true }).click();
  const dlg = page.getByTestId("method-dialog");
  await expect(dlg).toBeVisible();

  // 기본 탭 = 정의 및 방법 — KaTeX 산출식 렌더
  await expect(dlg.locator(".katex").first()).toBeVisible();

  // 파이썬 코드 적용 탭 → 블록으로 보내기 (현재 필터 = 전체)
  await dlg.getByRole("tab", { name: "파이썬 코드 적용" }).click();
  await dlg.getByTestId("send-to-workbook").click();

  // ── 워크북 뷰로 자동 전환 + 블록 생성(자동 실행 없음) ──
  await expect(page.getByTestId("reference-view")).toBeHidden();
  await expect(page.locator('[data-testid="data-grid-canvas"]')).toBeVisible();
  const blocks = await page.evaluate(() =>
    (window as any).__pygridStore.getState().workbook.pyBlocks.map((b: any) => ({
      kind: b.kind ?? "code",
      title: b.title ?? null,
      ran: !!b.last,
    })),
  );
  expect(blocks[0]).toEqual({
    kind: "markdown",
    title: "선형회귀 (Linear Regression)",
    ran: false,
  });
  expect(blocks.length).toBeGreaterThanOrEqual(2); // 마크다운 1 + 코드 ≥1
  expect(blocks.slice(1).every((b: any) => b.kind === "code" && !b.ran)).toBe(true);

  // 목차에 제목 표시
  await page.evaluate(() => (window as any).__pygridStore.getState().setTocOpen(true));
  await expect(page.getByLabel("선형회귀 (Linear Regression)", { exact: true })).toBeVisible();

  // 뷰 왕복 전에 넣은 셀 값이 살아 있다
  const a1 = await page.evaluate(
    () => (window as any).__pygridStore.getState().workbook.sheets[0].cells["0:0"]?.v ?? null,
  );
  expect(a1).toBe("지속성");

  // 워크북 뷰에서는 Ctrl+Shift+P가 다시 동작한다 (격리 검증의 대조군)
  const before = await blockCount(page);
  const box = (await page.locator('[data-testid="data-grid-canvas"]').boundingBox())!;
  await page.mouse.click(box.x + 200, box.y + 100); // glide 캔버스는 좌표 클릭으로 (오버레이 대응)
  await page.keyboard.press("Control+Shift+P");
  expect(await blockCount(page)).toBe(before + 1);
});

test("분포 탭: 로그정규 선택 → 차트 SVG · 파라미터 슬라이더 → 통계량 갱신 · 비교 토글", async ({
  page,
}) => {
  await page.goto("/");
  await waitForApp(page);
  await page.getByTestId("view-reference").click();
  await page.getByTestId("ref-tab-dist").click();
  const lab = page.getByTestId("dist-lab");
  await expect(lab).toBeVisible({ timeout: 60_000 }); // dev 첫 컴파일 여유
  // 이산형 카드에도 CDF·비교 버튼이 있으므로 연속형 그룹으로 스코프
  const cont = lab.locator("section", { hasText: "연속형 분포" }).first();

  // 로그정규 선택 → PDF·CDF SVG 렌더
  await cont.getByRole("tab", { name: "로그정규", exact: true }).click();
  await expect(cont.getByRole("img", { name: "확률밀도함수 (PDF) 그래프" })).toBeVisible();
  await expect(cont.getByRole("img", { name: "누적분포함수 (CDF) 그래프" })).toBeVisible();

  // 통계량 표의 평균 값 → σ 슬라이더 조작 후 갱신 확인
  const meanCell = cont
    .locator("tr", { hasText: "평균" })
    .first()
    .locator("td")
    .last();
  const meanBefore = await meanCell.innerText();
  const sigma = cont.getByRole("slider", { name: "σ (로그표준편차)" });
  await sigma.focus();
  for (let i = 0; i < 6; i++) await sigma.press("ArrowRight");
  await expect(meanCell).not.toHaveText(meanBefore);

  // 비교 토글 → A/B 두 열 통계량 표
  await cont.getByRole("button", { name: "비교" }).click();
  await expect(cont.getByText("A 값", { exact: true })).toBeVisible();
  await expect(cont.getByText("B 값", { exact: true })).toBeVisible();
  await cont.getByRole("button", { name: "비교" }).click(); // 원복
  await expect(cont.getByText("A 값", { exact: true })).toBeHidden();
});

test("모델적합: 샘플 체험 → 적합 실행(로그정규+지수) → 결과 표 2행·정렬·행 클릭 오버레이", async ({
  page,
}) => {
  test.setTimeout(420_000); // 실런타임 — Pyodide + scipy 다운로드 여유
  await page.goto("/");
  await waitForApp(page);
  await page.getByTestId("view-reference").click();
  await page.getByTestId("ref-tab-fit").click();
  const lab = page.getByTestId("fit-lab");
  await expect(lab).toBeVisible({ timeout: 60_000 }); // dev 첫 컴파일 여유

  // 샘플 데이터 체험 → 시트 → 형식 감지 → 확정
  await lab.getByTestId("fit-sample").click();
  const sheet = page.getByTestId("data-sheet-dialog");
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "확인", exact: true }).click();
  await expect(sheet.getByText("감지된 형식:")).toBeVisible();
  await sheet.getByRole("button", { name: "이 형식으로 확정" }).click();
  await expect(lab.getByText("데이터 요약")).toBeVisible();

  // 분포 선택 — 전체 해제 후 심도 로그정규+지수만
  const clearButtons = lab.getByRole("button", { name: "전체 해제" });
  await clearButtons.nth(0).click();
  await clearButtons.nth(1).click(); // 빈도(연도+값 샘플)도 해제
  await lab.getByRole("checkbox", { name: "로그정규" }).check();
  await lab.getByRole("checkbox", { name: "지수", exact: true }).check();

  // 적합 실행 — 워커 런타임(scipy) 실경로
  await lab.getByTestId("fit-run").click();
  const results = lab.getByTestId("fit-results-sev");
  await expect(results).toBeVisible({ timeout: 300_000 });
  await expect(results.locator("tbody tr")).toHaveCount(2);

  // AIC 기본 정렬 → BIC 클릭으로 재정렬
  await expect(results.getByText("최적 적합 Top 3 (AIC 기준)")).toBeVisible();
  await results.locator("th", { hasText: "BIC" }).click();
  await expect(results.getByText("최적 적합 Top 3 (BIC 기준)")).toBeVisible();

  // 행 클릭 오버레이 — 기본은 1위가 표시 중, 다른 행을 누르면 이동
  // (hasNotText 필터는 클릭 후 자기 자신과 안 맞게 되므로 분포명을 먼저 캡처)
  await expect(results.getByText("표시 중")).toBeVisible();
  const otherRow = results.locator("tbody tr").filter({ hasNotText: "표시 중" }).first();
  const otherName = (await otherRow.locator("td").nth(1).innerText()).trim();
  await otherRow.click();
  await expect(
    results.locator("tbody tr", { hasText: otherName }).getByText("표시 중"),
  ).toBeVisible();
});
