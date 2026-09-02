import { expect, test, type Page } from "@playwright/test";

async function waitForApp(page: Page) {
  await page.waitForFunction(
    () =>
      typeof (window as unknown as { __pygridStore?: unknown }).__pygridStore !==
        "undefined" &&
      (window as unknown as { __pygridReady?: boolean }).__pygridReady === true,
  );
  await page.waitForSelector('[data-testid="data-grid-canvas"]');
  await page.evaluate(() => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    (window as any).__pygridStore.getState().newWorkbook();
  });
}

/** window에 합성 paste 이벤트 발사 (그리드 포커스 경로) */
function dispatchPaste(page: Page, tsv: string) {
  return page.evaluate((text) => {
    const dt = new DataTransfer();
    dt.setData("text/plain", text);
    document.body.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }),
    );
  }, tsv);
}

const cellAt = (page: Page, key: string) =>
  page.evaluate(
    (k) =>
      (window as any).__pygridStore.getState().workbook.sheets[0]?.cells[k] ?? null,
    key,
  );

test("5행 초과 붙여넣기 → 미리보기 다이얼로그 → 적용", async ({ page }) => {
  await page.goto("/");
  await waitForApp(page);

  const tsv =
    "이름\t나이\n철수\t20\n영희\t21\n민수\t22\n지은\t23\n태호\t24\n수진\t25\n";
  await dispatchPaste(page, tsv);

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("붙여넣기 미리보기");
  // 헤더 자동 감지로 체크박스가 미리 체크됨
  await expect(dialog.getByRole("checkbox")).toBeChecked();

  await dialog.getByRole("button", { name: "적용" }).click();
  await expect(dialog).not.toBeVisible();

  expect(await cellAt(page, "0:0")).toEqual({ v: "이름", t: "s" });
  expect(await cellAt(page, "1:1")).toEqual({ v: 20, t: "n" });
  expect(await cellAt(page, "6:0")).toEqual({ v: "수진", t: "s" });
  expect(await cellAt(page, "6:1")).toEqual({ v: 25, t: "n" });
});

test("날짜 순서 설정(월-일-연) 후 9/2/2026 붙여넣기 → ISO 날짜", async ({ page }) => {
  await page.goto("/");
  await waitForApp(page);

  // 툴바 → 붙여넣기 옵션 다이얼로그에서 날짜 순서를 월-일-연으로 저장
  await page.getByRole("button", { name: "붙여넣기 옵션 (텍스트로 붙여넣기)" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("날짜 순서").click();
  await page.getByRole("option", { name: "월-일-연" }).click();

  // 같은 다이얼로그의 텍스트 폴백으로 붙여넣기 (2행 → 즉시 반영)
  await dialog.getByLabel("붙여넣을 텍스트").fill("9/2/2026\n12/25/2025");
  await dialog.getByRole("button", { name: "붙여넣기" }).click();

  await expect
    .poll(() => cellAt(page, "0:0"), { timeout: 5_000 })
    .toEqual({ v: "2026-09-02", t: "d", f: "yyyy-mm-dd" });
  expect(await cellAt(page, "1:0")).toEqual({ v: "2025-12-25", t: "d", f: "yyyy-mm-dd" });
});

test("5행 이하 붙여넣기는 다이얼로그 없이 즉시 반영", async ({ page }) => {
  await page.goto("/");
  await waitForApp(page);

  await dispatchPaste(page, "1\tTRUE\t2026-09-02\n2.5\tFALSE\t2026-09-03\n");

  // 즉시 반영 (startPasteFlow는 설정 로드만큼만 비동기)
  await expect
    .poll(() => cellAt(page, "0:0"), { timeout: 5_000 })
    .toEqual({ v: 1, t: "n" });
  expect(await cellAt(page, "1:0")).toEqual({ v: 2.5, t: "n" });
  expect(await cellAt(page, "0:1")).toEqual({ v: true, t: "b" });
  expect(await cellAt(page, "1:1")).toEqual({ v: false, t: "b" });
  expect(await cellAt(page, "0:2")).toEqual({ v: "2026-09-02", t: "d", f: "yyyy-mm-dd" });
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
