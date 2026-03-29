import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env/server";
import type { DatabaseClient } from "@/lib/db/types";
import type { Database } from "@/types/database.generated";

type ClientOptions = {
  key?: string;
  url?: string;
};

function resolveClientConfig(options: ClientOptions = {}) {
  const env = getServerEnv();
  const url = options.url ?? env.SUPABASE_URL;
  const key = options.key;

  if (!url) {
    throw new Error("SUPABASE_URL is required to create a database client.");
  }

  if (!key) {
    throw new Error("A Supabase API key is required to create a database client.");
  }

  return { key, url };
}

export function createDatabaseClient(
  options: Required<ClientOptions>,
): DatabaseClient {
  return createClient<Database>(options.url, options.key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function createSupabaseAnonClient(
  options: ClientOptions = {},
): DatabaseClient {
  const env = getServerEnv();
  const config = resolveClientConfig({
    ...options,
    key: options.key ?? env.SUPABASE_ANON_KEY,
  });

  return createDatabaseClient(config);
}

export function createSupabaseServiceRoleClient(
  options: ClientOptions = {},
): DatabaseClient {
  const env = getServerEnv();
  const config = resolveClientConfig({
    ...options,
    key: options.key ?? env.SUPABASE_SERVICE_ROLE_KEY,
  });

  return createDatabaseClient(config);
}
