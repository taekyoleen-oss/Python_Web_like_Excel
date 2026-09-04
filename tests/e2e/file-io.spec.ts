import { expect, test, type Page } from "@playwright/test";

// M7: 저장→열기 왕복, 샘플 워크북 실행(생명표 lx spill + 히스토그램 카드), XLSX 내보내기

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

const cellAt = (page: Page, key: string) =>
  page.evaluate(
    (k) =>
      (window as any).__pygridStore.getState().workbook.sheets[0]?.cells[k] ?? null,
    key,
  );

test("저장 다운로드 → 새 워크북 → 다시 열기 → 셀·블록 복원", async ({ page }, testInfo) => {
  await page.goto("/");
  await waitForApp(page);

  await page.evaluate(() => {
    const st = (window as any).__pygridStore.getState();
    const sid = st.workbook.sheets[0].id;
    st.setTitle("왕복검증");
    st.setCellValue(sid, 0, 0, { v: "왕복", t: "s" });
    const id = st.addPyBlock(sid, { r: 0, c: 3 });
    st.setBlockCode(id, 'xl("A1")');
  });

  // 저장 (.pygrid.json) 다운로드
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "파일" }).click();
  await page.getByRole("menuitem", { name: "저장 (.pygrid.json)" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("왕복검증.pygrid.json");
  // 확장자 판별이 파일 이름 기반이므로 올바른 이름으로 저장해 다시 연다
  const savedPath = testInfo.outputPath("roundtrip.pygrid.json");
  await download.saveAs(savedPath);

  // 새 워크북으로 초기화 → 값 사라짐 확인
  await page.evaluate(() => (window as any).__pygridStore.getState().newWorkbook());
  expect(await cellAt(page, "0:0")).toBeNull();

  // 파일 열기 (숨김 input에 직접 주입)
  await page.locator('input[aria-label="워크북 파일 열기"]').setInputFiles(savedPath);
  await expect
    .poll(async () => (await cellAt(page, "0:0"))?.v, { timeout: 10_000 })
    .toBe("왕복");
  const restored = await page.evaluate(() => {
    const wb = (window as any).__pygridStore.getState().workbook;
    return { title: wb.title, code: wb.pyBlocks[0]?.code, anchor: wb.pyBlocks[0]?.anchor };
  });
  expect(restored.title).toBe("왕복검증");
  expect(restored.code).toBe('xl("A1")');
  expect(restored.anchor).toEqual({ r: 0, c: 3 });
});

test("샘플 워크북(생명표) → 전체 실행 → lx spill + 히스토그램 카드", async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto("/");
  await waitForApp(page);

  await page.getByRole("button", { name: "파일" }).click();
  await page.getByRole("menuitem", { name: "샘플: 생명표" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__pygridStore.getState().workbook.title),
    )
    .toBe("생명표 예제");

  await page.getByRole("button", { name: "전체 실행", exact: true }).click();

  // 값 블록(D1): lx 포함 DataFrame spill — src 셀 다수
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const st = (window as any).__pygridStore.getState();
          const blockId = st.workbook.pyBlocks.find(
            (b: any) => b.kind !== "markdown" && b.outputMode === "values",
          )?.id;
          return Object.values(st.workbook.sheets[0].cells).filter(
            (c: any) => typeof c.src === "string" && c.src.split(":")[0] === blockId,
          ).length;
        }),
      { timeout: 240_000, intervals: [2000] },
    )
    .toBeGreaterThan(200);

  // 객체 블록(I2): 히스토그램 Figure 카드
  await expect
    .poll(async () => String((await cellAt(page, "1:8"))?.v ?? ""), {
      timeout: 120_000,
      intervals: [2000],
    })
    .toMatch(/^\[Figure/);
  const statuses = await page.evaluate(() =>
    (window as any).__pygridStore
      .getState()
      .workbook.pyBlocks.filter((b: any) => b.kind !== "markdown")
      .map((b: any) => b.last?.status),
  );
  expect(statuses).toEqual(["ok", "ok"]);
});

test("XLSX 내보내기 다운로드", async ({ page }) => {
  await page.goto("/");
  await waitForApp(page);
  await page.evaluate(() => {
    const st = (window as any).__pygridStore.getState();
    st.setCellValue(st.workbook.sheets[0].id, 0, 0, { v: 42, t: "n" });
  });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "파일" }).click();
  await page.getByRole("menuitem", { name: "XLSX로 내보내기 (전 시트)" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
});
