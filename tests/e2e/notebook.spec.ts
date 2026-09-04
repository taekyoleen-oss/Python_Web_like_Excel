import { expect, test, type Page } from "@playwright/test";

// v1.1 노트북 기능: 출력 위치 지정(앵커 재지정) · 출력 선택(변수·열·행) ·
// 마크다운 블록 · 목차 · 블록 접기. 실제 런타임을 쓰므로 한 테스트로 묶어 부트를 1회만 치른다.

/* eslint-disable @typescript-eslint/no-explicit-any */

async function waitForApp(page: Page) {
  await page.waitForFunction(
    () =>
      typeof (window as unknown as { __pygridStore?: unknown }).__pygridStore !==
        "undefined" &&
      (window as unknown as { __pygridReady?: boolean }).__pygridReady === true,
  );
  await page.waitForSelector('[data-testid="data-grid-canvas"]');
  await page.evaluate(() => {
    (window as any).__pygridStore.getState().newWorkbook();
  });
}

const cellAt = (page: Page, key: string) =>
  page.evaluate(
    (k) => (window as any).__pygridStore.getState().workbook.sheets[0]?.cells[k] ?? null,
    key,
  );

const selection = (page: Page) =>
  page.evaluate(() => (window as any).__pygridStore.getState().selection);

const block0 = (page: Page) =>
  page.evaluate(() => (window as any).__pygridStore.getState().workbook.pyBlocks[0] ?? null);

/** 첫 블록의 spill 셀 수 */
const srcCount = (page: Page) =>
  page.evaluate(() => {
    const st = (window as any).__pygridStore.getState();
    const id = st.workbook.pyBlocks[0]?.id;
    if (!id) return 0;
    return Object.values(st.workbook.sheets[0].cells).filter((c: any) => c.src === id).length;
  });

/**
 * 캔버스 그리드 좌표 보정 — 헤더 높이·행 마커 폭을 가정하지 않는다.
 * 아무 셀이나 한 번 클릭해 (행 34px·열 88px 균일) 원점을 역산한다.
 */
async function calibrate(page: Page) {
  const box = (await page.locator('[data-testid="data-grid-canvas"]').boundingBox())!;
  const px = box.x + 200;
  const py = box.y + 100;
  await page.mouse.click(px, py);
  const sel = await selection(page);
  if (!sel) throw new Error("보정 실패: 그리드 선택을 읽지 못했습니다");
  return { x0: px - sel.c0 * 88, y0: py - sel.r0 * 34 };
}

const clickCell = (page: Page, cal: { x0: number; y0: number }, r: number, c: number) =>
  page.mouse.click(cal.x0 + c * 88, cal.y0 + r * 34);

test("v1.1: 앵커 재지정 → 출력 변수·열·행 선택 → 마크다운·목차 → 접기", async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto("/");
  await waitForApp(page);

  // 데이터 A1:B6 — 헤더 + 5행
  await page.evaluate(() => {
    const st = (window as any).__pygridStore.getState();
    const sid = st.workbook.sheets[0].id;
    st.setCells(sid, [
      { r: 0, c: 0, cell: { v: "a", t: "s" } },
      { r: 0, c: 1, cell: { v: "b", t: "s" } },
      ...[1, 2, 3, 4, 5].flatMap((i) => [
        { r: i, c: 0, cell: { v: i, t: "n" } },
        { r: i, c: 1, cell: { v: i * 10, t: "n" } },
      ]),
    ]);
  });

  const cal = await calibrate(page);
  await page.evaluate(() => {
    (window as any).__pygridStore.getState().setSelection({ r0: 0, c0: 3, r1: 0, c1: 3 }); // D1
  });

  // ── 1) 코드 블록 생성·실행 → D1 spill (6행 × 2열)
  await page.keyboard.press("Control+Shift+P");
  const editor = page.getByLabel("Python 코드");
  await expect(editor).toBeFocused();
  await editor.fill('df = xl("A1:B6", headers=True)\nwide = df.assign(c=df["a"] * 2)\ndf');
  await page.getByRole("button", { name: "실행", exact: true }).click();
  await expect
    .poll(() => srcCount(page), { timeout: 150_000, intervals: [1000] })
    .toBe(12);
  expect((await cellAt(page, "0:3"))?.v).toBe("a"); // D1 헤더
  expect((await cellAt(page, "5:4"))?.v).toBe(50); // E6 마지막 값

  // ── 2) 출력 위치 지정 → F10으로 앵커 이동 (옛 spill 제거 + 새 위치에 재실행)
  await page.getByRole("button", { name: "출력 위치 지정" }).click();
  await expect(page.getByText("결과를 놓을 셀을 클릭하세요")).toBeVisible();
  await clickCell(page, cal, 9, 5); // F10
  expect((await block0(page)).anchor).toEqual({ r: 9, c: 5 });
  expect(await cellAt(page, "0:3")).toBeNull(); // 옛 앵커 비워짐
  await expect
    .poll(async () => (await cellAt(page, "9:5"))?.v, { timeout: 90_000, intervals: [500] })
    .toBe("a"); // 자동 모드 재실행 → F10에 새 spill
  expect(await srcCount(page)).toBe(12);
  expect(await cellAt(page, "5:4")).toBeNull(); // 옛 spill 전부 제거

  // ── 3) 출력 변수 = wide (6행 × 3열)
  await page.getByLabel("출력 변수").click();
  await expect(page.getByRole("option", { name: "wide" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("option", { name: "wide" }).click();
  await expect
    .poll(() => srcCount(page), { timeout: 90_000, intervals: [500] })
    .toBe(18);
  expect((await cellAt(page, "9:7"))?.v).toBe("c"); // H10: assign으로 생긴 열
  expect((await block0(page)).output).toEqual({ variable: "wide" });

  // ── 4) 열 a만 + 상위 3행 → 4행 × 1열
  await page.getByRole("button", { name: "열 선택" }).click();
  await page.getByRole("menuitemcheckbox", { name: "b", exact: true }).click();
  await page.getByRole("menuitemcheckbox", { name: "c", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByLabel("상위 N행").fill("3");
  await expect
    .poll(() => srcCount(page), { timeout: 90_000, intervals: [500] })
    .toBe(4);
  expect((await block0(page)).output).toEqual({
    variable: "wide",
    columns: ["a"],
    rowLimit: 3,
  });
  expect((await cellAt(page, "9:5"))?.v).toBe("a"); // 헤더
  expect((await cellAt(page, "12:5"))?.v).toBe(3); // 상위 3행의 마지막
  expect(await cellAt(page, "13:5")).toBeNull(); // 4번째 행은 없다
  expect(await cellAt(page, "9:6")).toBeNull(); // b 열은 없다

  // ── 5) 마크다운 블록 — 앵커 셀에 아무것도 쓰지 않는다
  await page.evaluate(() => {
    (window as any).__pygridStore.getState().setSelection({ r0: 0, c0: 9, r1: 0, c1: 9 }); // J1
  });
  await page.getByRole("button", { name: "마크다운 블록 추가" }).click();
  const md = page.getByLabel("마크다운", { exact: true });
  await md.fill("# 분석 개요\n본문 **굵게**");
  await md.blur();
  await expect(page.getByRole("heading", { name: "분석 개요" })).toBeVisible();
  await expect(page.getByText("굵게")).toBeVisible();
  expect(await cellAt(page, "0:9")).toBeNull(); // 앵커 셀은 비어 있다
  expect(
    await page.evaluate(
      () => (window as any).__pygridStore.getState().workbook.pyBlocks.length,
    ),
  ).toBe(2);

  // ── 6) 목차 — 마크다운 헤딩 + 그 아래 코드 블록, 클릭하면 앵커로 이동
  await page.getByRole("tab", { name: "목차" }).click();
  const tocEntry = page.getByRole("button", { name: "분석 개요" });
  await expect(tocEntry).toBeVisible();
  await expect(page.getByRole("button", { name: "F10" })).toBeVisible(); // 코드 블록 = 앵커 주소
  await tocEntry.click();
  await expect.poll(() => selection(page)).toMatchObject({ r0: 0, c0: 9 });
  await expect(page.getByRole("heading", { name: "분석 개요" })).toBeVisible(); // 블록 탭 복귀

  // ── 7) 블록 접기 — 헤더만 남고 편집기·출력 컨트롤은 숨는다
  const codeCard = page.locator('[data-block-kind="code"]');
  await codeCard.getByRole("button", { name: "블록 접기" }).click();
  await expect(page.getByLabel("Python 코드")).toBeHidden();
  await expect(codeCard.getByRole("button", { name: "출력 위치 지정" })).toBeHidden();
  await expect(codeCard.getByRole("button", { name: "실행", exact: true })).toBeVisible();
  await expect(codeCard.getByRole("button", { name: "블록 펼치기" })).toBeVisible();
  expect((await block0(page)).collapsed).toBe(true);

  await codeCard.getByRole("button", { name: "블록 펼치기" }).click();
  await expect(page.getByLabel("Python 코드")).toBeVisible();
});
