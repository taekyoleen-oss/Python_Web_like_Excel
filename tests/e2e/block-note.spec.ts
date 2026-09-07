import { expect, test, type Page } from "@playwright/test";

// 부록 J.4: 추천 제목 채택(포커스 시드) + 설명(note) — Ctrl+Enter 생성·편집/미리보기·목차·삭제·undo

/* eslint-disable @typescript-eslint/no-explicit-any */

async function waitForApp(page: Page) {
  await page.waitForFunction(
    () =>
      typeof (window as any).__pygridStore !== "undefined" &&
      (window as any).__pygridReady === true,
  );
  await page.waitForSelector('[data-testid="data-grid-canvas"]');
  await page.evaluate(() => (window as any).__pygridStore.getState().newWorkbook());
}

const block = (page: Page) =>
  page.evaluate(() => {
    const b = (window as any).__pygridStore.getState().workbook.pyBlocks[0];
    return b ? { title: b.title ?? null, note: b.note ?? null } : null;
  });

/** 그리드 좌표 클릭 (textarea blur → 미리보기 전환. .dvn-scroller가 locator 클릭을 가로챈다) */
async function clickGrid(page: Page) {
  const box = (await page.getByTestId("data-grid-canvas").first().boundingBox())!;
  await page.mouse.click(box.x + 300, box.y + 250);
}

test("폴백 제목 포커스 시드·덮어쓰기 → Ctrl+Enter 설명 → 미리보기·목차 → ✕ 삭제 → undo 복원", async ({
  page,
}) => {
  await page.goto("/");
  await waitForApp(page);
  await page.evaluate(() => {
    const st = (window as any).__pygridStore.getState();
    const sid = st.workbook.sheets[0].id;
    const id = st.addPyBlock(sid, { r: 0, c: 3 });
    st.setBlockCode(id, "# 데이터 로드\nx = 1");
  });

  // 1) 제목이 비어 폴백 표시 중 → 포커스하면 실제 값으로 시드 + 전체 선택
  const title = page.getByLabel("블록 제목");
  await expect(title).toHaveAttribute("placeholder", "데이터 로드");
  await title.click();
  await expect.poll(async () => (await block(page))?.title).toBe("데이터 로드");
  await page.waitForFunction(() => {
    const el = document.activeElement as HTMLInputElement | null;
    return (
      el?.getAttribute("aria-label") === "블록 제목" &&
      el.selectionStart === 0 &&
      el.selectionEnd === el.value.length
    );
  });
  // 전체 선택 상태라 바로 덮어쓸 수 있다
  await page.keyboard.type("정제 단계");
  await expect.poll(async () => (await block(page))?.title).toBe("정제 단계");
  // 전부 지우면 폴백 placeholder 복귀
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Backspace");
  await expect.poll(async () => (await block(page))?.title).toBe(null);
  await expect(title).toHaveAttribute("placeholder", "데이터 로드");

  // 2) 제목 입력에서 Ctrl+Enter → 빈 note 생성 + 설명 편집기 포커스
  await page.keyboard.press("Control+Enter");
  await expect.poll(async () => (await block(page))?.note).toBe("");
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === "설명",
  );
  await page.keyboard.type("## 배경");
  await expect.poll(async () => (await block(page))?.note).toBe("## 배경");

  // 3) blur → 미리보기 렌더 (동일 렌더러 h2) + 목차 서브 항목
  await clickGrid(page);
  await expect(page.getByTestId("note-preview").locator("h2")).toHaveText("배경");
  await page.getByRole("button", { name: "목차 패널 열기" }).click();
  const toc = page.getByTestId("toc-panel");
  // 블록 항목(폴백 제목)과 코드 섹션 서브가 같은 라벨 — 존재만 확인
  await expect(toc.getByRole("button", { name: "데이터 로드", exact: true }).first()).toBeVisible();
  await expect(toc.getByRole("button", { name: "배경", exact: true })).toBeVisible(); // note 헤딩 서브

  // 4) 편집 재진입 → ✕ 삭제 (확인 없음) → 영역 소멸
  await page.waitForTimeout(400); // undo 이력 경계 (300ms 스로틀)
  await page.getByTestId("note-preview").dblclick();
  await page.getByRole("button", { name: "설명 삭제" }).click();
  await expect(page.getByTestId("block-note")).toHaveCount(0);
  await expect.poll(async () => (await block(page))?.note).toBe(null);
  await expect(toc.getByRole("button", { name: "배경", exact: true })).toHaveCount(0);

  // 5) Ctrl+Z → note 복원 (1 undo)
  await page.waitForTimeout(400);
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await block(page))?.note).toBe("## 배경");
  await expect(page.getByTestId("block-note")).toBeVisible();
});

test("설명 편집기: 전용 툴바(제목1/2/3 없음)와 하위 제목 ## 삽입, ⋮ 메뉴 진입", async ({
  page,
}) => {
  await page.goto("/");
  await waitForApp(page);
  await page.evaluate(() => {
    const st = (window as any).__pygridStore.getState();
    const id = st.addPyBlock(st.workbook.sheets[0].id, { r: 0, c: 3 });
    st.setBlockCode(id, "1 + 1");
  });

  // ⋮ 메뉴로 설명 추가 (카드 hover로 셀 툴바 노출)
  await page.locator('[data-block-kind="code"]').first().hover();
  await page.getByRole("button", { name: "더보기" }).click();
  await page.getByRole("menuitem", { name: /설명 추가/ }).click();
  // 메뉴가 닫히고 편집기가 포커스를 유지한다 (onCloseAutoFocus 억제)
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === "설명",
  );

  // 전용 툴바: 제목1/2/3 버튼 없음, 하위 제목은 ##부터
  const bar = page.getByTestId("note-toolbar");
  await expect(bar.getByRole("button", { name: "제목1" })).toHaveCount(0);
  await expect(bar.getByRole("button", { name: "제목2" })).toHaveCount(0);
  await page.keyboard.type("요약");
  await bar.getByRole("button", { name: "하위 제목" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).__pygridStore.getState().workbook.pyBlocks[0].note,
      ),
    )
    .toBe("요약\n## ");
});
