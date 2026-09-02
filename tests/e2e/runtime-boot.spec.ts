// M3 골든 스모크: 런타임 부트 → 콘솔 REPL (실 CDN 로드 — 첫 실행은 60~90초 걸릴 수 있다)

import { expect, test } from "@playwright/test";

test("런타임 부트 후 콘솔 REPL이 동작한다", async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto("/runtime-dev");

  // COOP/COEP 헤더가 적용되어 SAB 인터럽트가 가능한 환경이어야 한다
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);

  // 부트: 진행률 → 준비됨
  await expect(page.getByText("준비됨")).toBeVisible({ timeout: 120_000 });

  const input = page.getByPlaceholder("Python 코드를 입력하세요 (Enter 실행)");
  const output = page.getByTestId("console-output");

  // 마지막 표현식 repr
  await input.fill("1+1");
  await input.press("Enter");
  await expect(output).toContainText("2", { timeout: 30_000 });

  // stdout 스트리밍 + 마지막 표현식 repr 동시
  await input.fill('print("안녕"); 40+2');
  await input.press("Enter");
  await expect(output).toContainText("안녕", { timeout: 30_000 });
  await expect(output).toContainText("42", { timeout: 30_000 });
});
