import { describe, expect, it, vi } from "vitest";
import { chunkValues, fetchAllPages } from "@/lib/db/pagination";

describe("chunkValues", () => {
  it("splits arrays into stable chunks", () => {
    expect(chunkValues([1, 2, 3, 4, 5], 2)).toEqual([
      [1, 2],
      [3, 4],
      [5],
    ]);
  });
});

describe("fetchAllPages", () => {
  it("keeps requesting pages until a short page is returned", async () => {
    const fetchPage = vi.fn(async (from: number, to: number) => {
      if (from === 0 && to === 1) {
        return { data: [{ id: 1 }, { id: 2 }], error: null };
      }

      return { data: [{ id: 3 }], error: null };
    });

    await expect(fetchAllPages(fetchPage, 2)).resolves.toEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });
});
