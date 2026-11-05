const PAGE_SIZE = 1000;

/**
 * Supabase returns at most 1000 rows per request, so counting or exporting from
 * one request silently undercounts big events. This pages through all of them.
 * `page` must apply a stable order (e.g. created_at + id).
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE_SIZE) return rows;
  }
}
