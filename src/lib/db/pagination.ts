type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export const DEFAULT_PAGE_SIZE = 1000;
export const DEFAULT_CHUNK_SIZE = 250;

export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<PageResult<T>>,
  pageSize = DEFAULT_PAGE_SIZE,
) {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const result = await fetchPage(from, to);

    if (result.error) {
      throw new Error(result.error.message);
    }

    const page = result.data ?? [];
    rows.push(...page);

    if (page.length < pageSize) {
      return rows;
    }

    from += pageSize;
  }
}

export function chunkValues<T>(values: T[], chunkSize = DEFAULT_CHUNK_SIZE) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
}
