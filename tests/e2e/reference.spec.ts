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
  await expect(quadrant).toBeVisible();

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
