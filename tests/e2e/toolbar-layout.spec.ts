import { expect, test, type Page } from "@playwright/test";

// 툴바 배치 — 그리드 툴바는 시트 편집 + 좌우 패널 접기만, Python 조작은 Python 패널 헤더로.

async function waitForApp(page: Page) {
  await page.waitForFunction(
    () =>
      typeof (window as unknown as { __pygridStore?: unknown }).__pygridStore !==
        "undefined" &&
      (window as unknown as { __pygridReady?: boolean }).__pygridReady === true,
  );
  await page.waitForSelector('[data-testid="data-grid-canvas"]');
}

const boxOf = async (page: Page, name: string) => {
  const box = await page.getByRole("button", { name, exact: true }).boundingBox();
  expect(box, `${name} 버튼이 보이지 않는다`).not.toBeNull();
  return box!;
};

test("그리드 툴바: 스프레드시트 감추기가 맨 왼쪽, Python 패널 감추기가 맨 오른쪽", async ({
  page,
}) => {
  await page.goto("/");
  await waitForApp(page);

  const toolbar = page.getByTestId("grid-toolbar");
  const bar = (await toolbar.boundingBox())!;

  const gridToggle = await boxOf(page, "스프레드시트 감추기 (Ctrl+Alt+1)");
  const paste = await boxOf(page, "붙여넣기 옵션 (텍스트로 붙여넣기)");
  const pyToggle = await boxOf(page, "Python 패널 감추기 (Ctrl+Alt+2)");

  // 1) 스프레드시트 감추기 = 붙여넣기 옵션 바로 왼쪽(= 첫 항목)
  expect(gridToggle.x).toBeLessThan(paste.x);
  expect(gridToggle.x - bar.x).toBeLessThan(48); // 좌측 패딩 + 한 칸 이내

  // 2) Python 패널 감추기 = 우측 끝
  expect(pyToggle.x).toBeGreaterThan(bar.x + bar.width * 0.7);
  // 3) 같은 툴바 행에서 서로 마주본다
  expect(Math.abs(gridToggle.y - pyToggle.y)).toBeLessThan(2);

  // 그리드 툴바에는 Python 조작이 남아 있지 않다
  await expect(toolbar.getByRole("button", { name: "Python 블록 추가 (Ctrl+Shift+P)" })).toHaveCount(0);
  await expect(toolbar.getByRole("button", { name: "전체 실행", exact: true })).toHaveCount(0);
  await expect(toolbar.getByRole("button", { name: "목차 패널 열기" })).toHaveCount(0);
});

test("Python 패널 헤더가 Python 조작을 모두 갖는다 (블록 N 오른쪽)", async ({ page }) => {
  await page.goto("/");
  await waitForApp(page);

  const header = page.getByTestId("python-panel-header");
  await expect(header).toBeVisible();
  await expect(header).toContainText("블록");

  for (const name of [
    "Python 블록 추가 (Ctrl+Shift+P)",
    "마크다운 블록 추가",
    "전체 실행",
    "실행 중단",
    "목차 패널 열기",
    "AI 채팅 패널 열기",
  ]) {
    await expect(header.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await expect(header.getByRole("combobox", { name: "계산 모드" })).toBeVisible();

  // "블록 N" 라벨보다 오른쪽에 놓인다
  const label = (await header.getByText("블록", { exact: true }).boundingBox())!;
  const add = (await header
    .getByRole("button", { name: "Python 블록 추가 (Ctrl+Shift+P)", exact: true })
    .boundingBox())!;
  expect(add.x).toBeGreaterThan(label.x);

  // 좁은 패널에서도 넘치지 않는다 — flex-wrap으로 흘러서 가로 스크롤이 생기지 않는다
  const overflow = await header.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("Python 패널을 접으면 ▶ 전체 실행이 그리드 툴바로 돌아온다", async ({ page }) => {
  await page.goto("/");
  await waitForApp(page);

  const toolbar = page.getByTestId("grid-toolbar");
  await expect(toolbar.getByRole("button", { name: "전체 실행", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Python 패널 감추기 (Ctrl+Alt+2)" }).click();
  await expect(page.getByTestId("python-panel-header")).toHaveCount(0);
  // 접힌 상태에서도 재계산 가능 — 중복 없이 툴바에 하나만 존재한다
  await expect(page.getByRole("button", { name: "전체 실행", exact: true })).toHaveCount(1);
  await expect(toolbar.getByRole("button", { name: "전체 실행", exact: true })).toBeVisible();

  // 스트립으로 복원하면 다시 패널 헤더로 돌아간다
  await page.getByTestId("strip-python").click();
  await expect(toolbar.getByRole("button", { name: "전체 실행", exact: true })).toHaveCount(0);
  await expect(
    page.getByTestId("python-panel-header").getByRole("button", { name: "전체 실행", exact: true }),
  ).toBeVisible();
});
