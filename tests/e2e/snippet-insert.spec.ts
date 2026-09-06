import { expect, test, type Page } from "@playwright/test";

// 부록 F: 코드 삽입 팝업(그룹→스니펫→미리보기→삽입 위치) · 목차 서브 항목 ·
// 카드 헤더 재배치·접기 · 제목 폴백. Python 실행 없이 스토어·DOM만 검증한다
// (수동 계산 모드 — 코드 편집이 자동 실행을 유발하지 않게).

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
    const st = (window as any).__pygridStore.getState();
    st.newWorkbook();
    st.setCalcMode("manual"); // 자동 재계산 차단 — 이 스펙은 실행 없이 구조만 본다
  });
}

const blocks = (page: Page) =>
  page.evaluate(() => (window as any).__pygridStore.getState().workbook.pyBlocks);

/** 계산 순서(시트 순 → 앵커 행 → 열)의 블록 id 목록 */
const orderedIds = (page: Page) =>
  page.evaluate(() => {
    const st = (window as any).__pygridStore.getState();
    const idx = new Map<string, number>(
      st.workbook.sheets.map((s: any, i: number) => [s.id, i] as [string, number]),
    );
    return [...st.workbook.pyBlocks]
      .sort(
        (a: any, b: any) =>
          (idx.get(a.sheetId) ?? 0) - (idx.get(b.sheetId) ?? 0) ||
          a.anchor.r - b.anchor.r ||
          a.anchor.c - b.anchor.c,
      )
      .map((b: any) => b.id);
  });

test("코드 삽입 팝업 → 아래 새 블록·현재 블록 추가·undo → 목차 서브 항목 → 접기 헤더", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await waitForApp(page);

  // ── 기준 블록: D1에 코드 블록 + "x = 1" (편집기 포커스 → lastEditorBlockId)
  await page.evaluate(() => {
    (window as any).__pygridStore.getState().setSelection({ r0: 0, c0: 3, r1: 0, c1: 3 });
  });
  await page.keyboard.press("Control+Shift+P");
  const editor = page.getByLabel("Python 코드");
  await expect(editor).toBeFocused();
  await editor.fill("x = 1");
  await expect
    .poll(async () => (await blocks(page))[0]?.code, { timeout: 10_000 })
    .toBe("x = 1"); // 디바운스 커밋 대기
  const refId: string = (await blocks(page))[0].id;
  const refCard = page.locator(`[data-block-id="${refId}"]`);

  // ── 팝업: 그래프 그룹 → 스니펫(SVG 미리보기) → 코드 미리보기(# ▸ 접두)
  await page.getByRole("button", { name: "코드 삽입" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("코드 삽입 — 핸들링·그래프 스니펫")).toBeVisible();
  await expect(dialog.getByText("기준 블록: Sheet1!D1")).toBeVisible(); // 제목 없음 → 앵커 주소

  await dialog.getByRole("button", { name: "탐색 (EDA)", exact: true }).click();
  const snippetBtn = dialog.getByRole("button", { name: /히스토그램 \+ KDE/ });
  await expect(snippetBtn.locator("svg")).toBeVisible(); // 그래프는 SVG 썸네일
  await snippetBtn.click();
  const preview = dialog.getByTestId("snippet-code-preview");
  await expect(preview).toContainText("# ▸ 히스토그램 + KDE"); // 삽입될 코드 그대로
  await expect(preview).toContainText("plt.subplots");

  // ── 아래 새 블록으로 — 계산 순서상 기준 바로 다음, 자동 실행 없음
  await dialog.getByRole("button", { name: "아래 새 블록으로" }).click();
  await expect(dialog).toBeHidden();
  const all = await blocks(page);
  expect(all).toHaveLength(2);
  const created = all.find((b: any) => b.id !== refId)!;
  expect(created.title).toBe("히스토그램 + KDE");
  expect(created.code.startsWith("# ▸ 히스토그램 + KDE\n")).toBe(true);
  expect(created.anchor).toEqual({ r: 1, c: 3 }); // 같은 열 인접 행 (D2)
  expect(created.last).toBeUndefined(); // 실행되지 않았다
  expect(await orderedIds(page)).toEqual([refId, created.id]);

  // 패널 나열 순서 = 계산 순서 (기준 바로 다음)
  expect(
    await page.$$eval("[data-block-id]", (els) =>
      els.map((el) => el.getAttribute("data-block-id")),
    ),
  ).toEqual([refId, created.id]);

  // 목차에서도 기준(D1) 바로 다음
  await page.getByRole("button", { name: "목차 패널 열기" }).click();
  const toc = page.getByTestId("toc-panel");
  await expect(toc.getByRole("button", { name: "D1", exact: true })).toBeVisible();
  await expect(
    toc.getByRole("button", { name: "히스토그램 + KDE", exact: true }).first(),
  ).toBeVisible();
  const liTexts = await toc.locator("ul > li").allTextContents();
  expect(liTexts[0]).toContain("D1");
  expect(liTexts[1]).toContain("히스토그램 + KDE");

  // ── 현재 블록에 추가 — 기존 코드 뒤 빈 줄 + 스니펫, Ctrl+Z 한 번에 복원
  await refCard.getByLabel("Python 코드").click(); // 기준 블록 편집기 재포커스
  await page.getByRole("button", { name: "코드 삽입" }).click();
  await expect(dialog).toBeVisible();
  // 패널 재마운트로 선택이 초기화될 수 있으니 명시적으로 다시 고른다
  await dialog.getByRole("button", { name: "탐색 (EDA)", exact: true }).click();
  await dialog.getByRole("button", { name: /히스토그램 \+ KDE/ }).click();
  await dialog.getByRole("button", { name: "현재 블록에 추가" }).click();
  await expect(dialog).toBeHidden();
  await expect
    .poll(async () => (await blocks(page)).find((b: any) => b.id === refId)?.code)
    .toMatch(/^x = 1\n\n# ▸ 히스토그램 \+ KDE\n/);

  // 텍스트 입력 밖으로 (캔버스는 dvn-scroller가 포인터를 가로채므로 blur로)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Control+z");
  await expect
    .poll(async () => (await blocks(page)).find((b: any) => b.id === refId)?.code)
    .toBe("x = 1");

  // ── 목차 서브 항목 (# ── … ── 포함 코드) — 클릭 → 블록 포커스
  await page.evaluate((id) => {
    (window as any).__pygridStore
      .getState()
      .setBlockCode(id, "# ── 준비 ──\nx = 1\n\n# ▸ 계산\ny = 2");
  }, refId);
  // "준비"는 블록 항목(제목 폴백) + 서브 항목으로 두 번, "계산"은 서브 항목으로만
  await expect(toc.getByRole("button", { name: "준비", exact: true })).toHaveCount(2);
  const subCalc = toc.getByRole("button", { name: "계산", exact: true });
  await expect(subCalc).toBeVisible();
  await expect(subCalc).toContainText("·"); // 한 단계 안쪽 서브 항목 표시

  await subCalc.click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__pygridStore.getState().selection),
    )
    .toMatchObject({ r0: 0, c0: 3 }); // 그리드 선택 = 블록 앵커
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.activeElement
          ?.closest("[data-block-id]")
          ?.getAttribute("data-block-id"),
      ),
    )
    .toBe(refId); // 편집기 포커스가 기준 블록 카드 안에 있다

  // ── 접기 — 헤더(제목·주소)는 남고 본문(코드)만 숨는다. 제목 폴백 = 첫 섹션 주석
  await refCard.getByRole("button", { name: "블록 접기" }).click();
  const title = refCard.getByLabel("블록 제목");
  await expect(title).toBeVisible();
  await expect(title).toHaveAttribute("placeholder", "준비"); // 표시 전용 제목 폴백
  expect((await blocks(page)).find((b: any) => b.id === refId)?.title).toBeUndefined();
  await expect(refCard.getByRole("button", { name: "Sheet1!D1" })).toBeVisible(); // 주소 맨 뒤 유지
  await expect(refCard.getByLabel("Python 코드")).toBeHidden(); // 코드 숨김
  // 목차 라벨도 폴백 제목을 쓴다
  await expect(toc.getByRole("button", { name: "준비", exact: true }).first()).toBeVisible();
});
