import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.generated";

export type { Database, Json };

export type PublicSchema = Database["public"];
export type TableName = keyof PublicSchema["Tables"];
export type TableRow<T extends TableName> = PublicSchema["Tables"][T]["Row"];
export type TableInsert<T extends TableName> = PublicSchema["Tables"][T]["Insert"];
export type TableUpdate<T extends TableName> = PublicSchema["Tables"][T]["Update"];
export type EnumName = keyof PublicSchema["Enums"];
export type TableEnum<T extends EnumName> = PublicSchema["Enums"][T];
export type DatabaseClient = SupabaseClient<Database>;
