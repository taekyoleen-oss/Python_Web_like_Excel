import { describe, expect, test } from "vitest";

import { spillRange, toCells } from "@/lib/runtime/converters";

describe("converters", () => {
  test("toCells: v/t/f 매핑, v:null은 빈 셀(f 제거)", () => {
    expect(
      toCells([
        [
          { v: 1, t: "n" },
          { v: "2026-09-02", t: "d", f: "yyyy-mm-dd" },
        ],
        [
          { v: null, t: "s", f: "yyyy-mm-dd" },
          { v: true, t: "b" },
        ],
      ]),
    ).toEqual([
      [
        { v: 1, t: "n" },
        { v: "2026-09-02", t: "d", f: "yyyy-mm-dd" },
      ],
      [
        { v: null, t: "s" },
        { v: true, t: "b" },
      ],
    ]);
  });

  test("spillRange: 앵커 + shape → 끝 포함 범위", () => {
    expect(spillRange({ r: 2, c: 3 }, 5, 2)).toEqual({ r0: 2, c0: 3, r1: 6, c1: 4 });
    expect(spillRange({ r: 0, c: 0 }, 1, 1)).toEqual({ r0: 0, c0: 0, r1: 0, c1: 0 });
  });
});
