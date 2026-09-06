import { describe, expect, it } from "vitest";
import { dataEdge } from "@/lib/grid/navigate";
import type { Sheet } from "@/types/workbook";

const sheet = (cells: Sheet["cells"], rowCount = 10, colCount = 8): Sheet => ({
  id: "s1",
  name: "Sheet1",
  rowCount,
  colCount,
  cells,
});

// A1:C5 데이터 (r 0..4, c 0..2) + 떨어진 셀 E8(r7,c4)
const sh = sheet({
  ...Object.fromEntries(
    Array.from({ length: 5 }, (_, r) =>
      Array.from({ length: 3 }, (_, c) => [`${r}:${c}`, { v: r * 10 + c, t: "n" }]),
    ).flat(),
  ),
  "7:4": { v: "외딴", t: "s" },
});

describe("dataEdge — 연속 데이터 구간의 끝", () => {
  it("차 있는 셀에서 인접이 차 있으면 구간 끝으로 (4방향)", () => {
    expect(dataEdge(sh, { r: 0, c: 0 }, "down")).toEqual({ r: 4, c: 0 });
    expect(dataEdge(sh, { r: 4, c: 1 }, "up")).toEqual({ r: 0, c: 1 });
    expect(dataEdge(sh, { r: 2, c: 0 }, "right")).toEqual({ r: 2, c: 2 });
    expect(dataEdge(sh, { r: 2, c: 2 }, "left")).toEqual({ r: 2, c: 0 });
  });

  it("v===null 셀은 비어 있는 것으로 취급되어 구간이 끊긴다", () => {
    const s = sheet({
      "0:0": { v: 1, t: "n" },
      "1:0": { v: 2, t: "n" },
      "2:0": { v: null, t: "s" },
      "3:0": { v: 4, t: "n" },
    });
    expect(dataEdge(s, { r: 0, c: 0 }, "down")).toEqual({ r: 1, c: 0 });
  });
});

describe("dataEdge — 빈 칸을 건너 다음 데이터로", () => {
  it("인접이 비어 있으면 다음 비어 있지 않은 셀로", () => {
    // r4,c2(구간 끝)에서 아래 → 빈 칸 건너 r7? 열이 다르므로 그리드 끝. c4 열로 확인
    expect(dataEdge(sh, { r: 0, c: 4 }, "down")).toEqual({ r: 7, c: 4 });
    expect(dataEdge(sh, { r: 9, c: 4 }, "up")).toEqual({ r: 7, c: 4 });
    expect(dataEdge(sh, { r: 7, c: 0 }, "right")).toEqual({ r: 7, c: 4 });
    expect(dataEdge(sh, { r: 7, c: 7 }, "left")).toEqual({ r: 7, c: 4 });
  });

  it("빈 셀에서 출발해도 다음 비어 있지 않은 셀로 (인접이 데이터면 인접 셀)", () => {
    expect(dataEdge(sh, { r: 5, c: 0 }, "up")).toEqual({ r: 4, c: 0 }); // 인접이 데이터 → 그 셀
    expect(dataEdge(sh, { r: 9, c: 0 }, "up")).toEqual({ r: 4, c: 0 }); // 빈 칸 건너 데이터
  });

  it("그 방향에 데이터가 없으면 그리드 끝", () => {
    expect(dataEdge(sh, { r: 4, c: 0 }, "down")).toEqual({ r: 9, c: 0 });
    expect(dataEdge(sh, { r: 0, c: 2 }, "right")).toEqual({ r: 0, c: 7 });
    expect(dataEdge(sh, { r: 7, c: 4 }, "down")).toEqual({ r: 9, c: 4 });
  });
});

describe("dataEdge — 경계·빈 시트", () => {
  it("이미 그리드 끝이면 제자리", () => {
    expect(dataEdge(sh, { r: 0, c: 0 }, "up")).toEqual({ r: 0, c: 0 });
    expect(dataEdge(sh, { r: 0, c: 0 }, "left")).toEqual({ r: 0, c: 0 });
    expect(dataEdge(sh, { r: 9, c: 7 }, "down")).toEqual({ r: 9, c: 7 });
    expect(dataEdge(sh, { r: 9, c: 7 }, "right")).toEqual({ r: 9, c: 7 });
  });

  it("범위 밖 좌표는 0..rowCount-1/colCount-1로 클램프", () => {
    expect(dataEdge(sh, { r: -3, c: 100 }, "down")).toEqual({ r: 9, c: 7 });
    expect(dataEdge(sh, { r: 100, c: -3 }, "up")).toEqual({ r: 4, c: 0 });
  });

  it("빈 시트는 그리드 끝으로", () => {
    const empty = sheet({}, 5, 4);
    expect(dataEdge(empty, { r: 0, c: 0 }, "down")).toEqual({ r: 4, c: 0 });
    expect(dataEdge(empty, { r: 4, c: 3 }, "up")).toEqual({ r: 0, c: 3 });
    expect(dataEdge(empty, { r: 2, c: 1 }, "right")).toEqual({ r: 2, c: 3 });
    expect(dataEdge(empty, { r: 2, c: 1 }, "left")).toEqual({ r: 2, c: 0 });
  });
});
