import type { PostgrestError } from "@supabase/supabase-js";
import type {
  DatabaseClient,
  TableInsert,
  TableName,
  TableRow,
  TableUpdate,
} from "@/lib/db/types";

type MatchValue = string | number | boolean | null;
type MatchFilters<T extends TableName> = Partial<Record<keyof TableRow<T>, MatchValue>>;

type ListOptions<T extends TableName> = {
  ascending?: boolean;
  limit?: number;
  orderBy?: Extract<keyof TableRow<T>, string>;
};

function formatError(table: string, action: string, error: PostgrestError) {
  return new Error(`[${table}] ${action} failed: ${error.message}`);
}

export function createCrudRepository<T extends TableName>(
  table: T,
  options: ListOptions<T> = {},
) {
  const defaultOrderBy = (options.orderBy ?? "id") as Extract<
    keyof TableRow<T>,
    string
  >;
  const defaultAscending = options.ascending ?? false;

  return {
    async create(client: DatabaseClient, values: TableInsert<T>) {
      const { data, error } = await client
        .from(table)
        .insert(values as never)
        .select()
        .single();

      if (error) {
        throw formatError(table, "create", error);
      }

      return data as unknown as TableRow<T>;
    },

    async delete(client: DatabaseClient, id: number) {
      const { error } = await client
        .from(table)
        .delete()
        .eq("id" as never, id);

      if (error) {
        throw formatError(table, "delete", error);
      }
    },

    async getById(client: DatabaseClient, id: number) {
      const { data, error } = await client
        .from(table)
        .select("*")
        .eq("id" as never, id)
        .maybeSingle();

      if (error) {
        throw formatError(table, "getById", error);
      }

      return data as unknown as TableRow<T> | null;
    },

    async list(
      client: DatabaseClient,
      filters: MatchFilters<T> = {},
      listOptions: ListOptions<T> = {},
    ) {
      let query = client
        .from(table)
        .select("*")
        .order((listOptions.orderBy ?? defaultOrderBy) as never, {
          ascending: listOptions.ascending ?? defaultAscending,
        });

      for (const [column, value] of Object.entries(filters)) {
        query = query.eq(column as never, value as never);
      }

      if (typeof listOptions.limit === "number") {
        query = query.limit(listOptions.limit);
      }

      const { data, error } = await query;

      if (error) {
        throw formatError(table, "list", error);
      }

      return (data ?? []) as unknown as TableRow<T>[];
    },

    async update(client: DatabaseClient, id: number, values: TableUpdate<T>) {
      const { data, error } = await client
        .from(table)
        .update(values as never)
        .eq("id" as never, id)
        .select()
        .single();

      if (error) {
        throw formatError(table, "update", error);
      }

      return data as unknown as TableRow<T>;
    },
  };
}
