import { expect, test, type Page } from "@playwright/test";

// R6: AI 코드 지원 — 키 미설정 유도 → 키 저장 → (모킹된) generate 1회 → 새 블록.
// 실제 Anthropic API는 호출하지 않는다 (page.route 모킹).

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

test("키 미설정 → 설정 유도 → 키 저장 → 모킹 generate → 새 블록(자동 실행 없음)", async ({
  page,
}) => {
  await page.goto("/");
  await waitForApp(page);

  const genInput = page.getByLabel("AI 코드 요청");
  await expect(genInput).toBeEnabled();

  // 1) 키 미설정: 생성 클릭 → AI 설정 다이얼로그 유도
  await genInput.fill("시트 합계를 구해줘");
  await page.getByRole("button", { name: "생성", exact: true }).click();
  const keyDialog = page.getByRole("dialog", { name: /AI 설정/ });
  await expect(keyDialog).toBeVisible();
  await expect(keyDialog.getByText(/IndexedDB.*에만 저장/)).toBeVisible();

  // 2) 키 저장 → 다이얼로그 닫힘, 입력은 그대로 활성
  await keyDialog.getByLabel("Anthropic API 키").fill("sk-ant-e2e-mock");
  await keyDialog.getByRole("button", { name: "저장", exact: true }).click();
  await expect(keyDialog).toBeHidden();
  await expect(genInput).toBeEnabled();

  // 3) API 모킹 → generate 1회 → 새 블록 생성 + 내용 확인
  let sentAuth = "";
  let sentBody = "";
  await page.route("https://api.anthropic.com/**", async (route) => {
    sentAuth = route.request().headers()["x-api-key"] ?? "";
    sentBody = route.request().postData() ?? "";
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        content: [
          {
            type: "text",
            text: '합계 코드입니다.\n```python\ndf = xl("A1:B3", headers=True)\ndf.sum()\n```',
          },
        ],
      }),
    });
  });

  await genInput.fill("시트 합계를 구해줘");
  await page.getByRole("button", { name: "생성", exact: true }).click();

  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as any).__pygridStore.getState().workbook.pyBlocks.length,
        ),
      { timeout: 15_000 },
    )
    .toBe(1);
  const block = await page.evaluate(
    () => (window as any).__pygridStore.getState().workbook.pyBlocks[0],
  );
  expect(block.title).toContain("AI 생성:");
  expect(block.code).toContain('df = xl("A1:B3", headers=True)');
  expect(block.last).toBeUndefined(); // 자동 실행 없음

  // 요청이 저장된 키·이 앱 규칙 프롬프트로 나갔는지 (모킹 라우트에서 캡처)
  expect(sentAuth).toBe("sk-ant-e2e-mock");
  expect(sentBody).toContain("claude-sonnet-4-6");
  expect(sentBody).toContain("시트기반 파이썬");
});
