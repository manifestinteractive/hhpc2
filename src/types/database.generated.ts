export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_summary_jobs: {
        Row: {
          attempt_count: number
          completed_at: string | null
          created_at: string
          crew_member_id: number
          enqueued_at: string
          id: number
          last_error: string | null
          readiness_score_id: number
          started_at: string | null
          status: Database["public"]["Enums"]["ai_summary_job_status"]
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          crew_member_id: number
          enqueued_at?: string
          id?: never
          last_error?: string | null
          readiness_score_id: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["ai_summary_job_status"]
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          crew_member_id?: number
          enqueued_at?: string
          id?: never
          last_error?: string | null
          readiness_score_id?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["ai_summary_job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_summary_jobs_crew_member_id_fkey"
            columns: ["crew_member_id"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_summary_jobs_readiness_score_id_fkey"
            columns: ["readiness_score_id"]
            isOneToOne: false
            referencedRelation: "readiness_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_summaries: {
        Row: {
          created_at: string
          crew_member_id: number | null
          generated_at: string
          id: number
          model_name: string
          provider_name: string
          readiness_score_id: number | null
          review_status: Database["public"]["Enums"]["summary_review_status"]
          reviewed_at: string | null
          scope_kind: Database["public"]["Enums"]["summary_scope_kind"]
          structured_input_context: Json
          summary_text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          crew_member_id?: number | null
          generated_at?: string
          id?: never
          model_name: string
          provider_name: string
          readiness_score_id?: number | null
          review_status?: Database["public"]["Enums"]["summary_review_status"]
          reviewed_at?: string | null
          scope_kind?: Database["public"]["Enums"]["summary_scope_kind"]
          structured_input_context?: Json
          summary_text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          crew_member_id?: number | null
          generated_at?: string
          id?: never
          model_name?: string
          provider_name?: string
          readiness_score_id?: number | null
          review_status?: Database["public"]["Enums"]["summary_review_status"]
          reviewed_at?: string | null
          scope_kind?: Database["public"]["Enums"]["summary_scope_kind"]
          structured_input_context?: Json
          summary_text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_summaries_crew_member_id_fkey"
            columns: ["crew_member_id"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_summaries_readiness_score_id_fkey"
            columns: ["readiness_score_id"]
            isOneToOne: false
            referencedRelation: "readiness_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_members: {
        Row: {
          baseline_profile: Json
          baseline_timezone: string
          call_sign: string | null
          created_at: string
          crew_code: string
          display_name: string
          family_name: string
          given_name: string
          id: number
          is_active: boolean
          profile_metadata: Json
          role_title: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          baseline_profile?: Json
          baseline_timezone?: string
          call_sign?: string | null
          created_at?: string
          crew_code: string
          display_name: string
          family_name: string
          given_name: string
          id?: never
          is_active?: boolean
          profile_metadata?: Json
          role_title: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          baseline_profile?: Json
          baseline_timezone?: string
          call_sign?: string | null
          created_at?: string
          crew_code?: string
          display_name?: string
          family_name?: string
          given_name?: string
          id?: never
          is_active?: boolean
          profile_metadata?: Json
          role_title?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      detected_events: {
        Row: {
          confidence_score: number
          created_at: string
          crew_member_id: number
          ended_at: string | null
          event_type: string
          evidence: Json
          explanation: string
          id: number
          normalized_reading_id: number | null
          primary_signal_type: Database["public"]["Enums"]["signal_type"] | null
          rule_id: string
          rule_version: string
          sensor_stream_id: number | null
          severity: Database["public"]["Enums"]["event_severity"]
          started_at: string
        }
        Insert: {
          confidence_score?: number
          created_at?: string
          crew_member_id: number
          ended_at?: string | null
          event_type: string
          evidence?: Json
          explanation: string
          id?: never
          normalized_reading_id?: number | null
          primary_signal_type?:
            | Database["public"]["Enums"]["signal_type"]
            | null
          rule_id: string
          rule_version: string
          sensor_stream_id?: number | null
          severity?: Database["public"]["Enums"]["event_severity"]
          started_at: string
        }
        Update: {
          confidence_score?: number
          created_at?: string
          crew_member_id?: number
          ended_at?: string | null
          event_type?: string
          evidence?: Json
          explanation?: string
          id?: never
          normalized_reading_id?: number | null
          primary_signal_type?:
            | Database["public"]["Enums"]["signal_type"]
            | null
          rule_id?: string
          rule_version?: string
          sensor_stream_id?: number | null
          severity?: Database["public"]["Enums"]["event_severity"]
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "detected_events_crew_member_id_fkey"
            columns: ["crew_member_id"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detected_events_normalized_reading_id_fkey"
            columns: ["normalized_reading_id"]
            isOneToOne: false
            referencedRelation: "normalized_readings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detected_events_sensor_stream_id_fkey"
            columns: ["sensor_stream_id"]
            isOneToOne: false
            referencedRelation: "sensor_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_runs: {
        Row: {
          accepted_record_count: number
          completed_at: string | null
          created_at: string
          error_summary: string | null
          id: number
          input_record_count: number
          rejected_record_count: number
          run_kind: Database["public"]["Enums"]["ingestion_run_kind"]
          run_metadata: Json
          source_label: string
          started_at: string
          status: Database["public"]["Enums"]["ingestion_run_status"]
          updated_at: string
        }
        Insert: {
          accepted_record_count?: number
          completed_at?: string | null
          created_at?: string
          error_summary?: string | null
          id?: never
          input_record_count?: number
          rejected_record_count?: number
          run_kind: Database["public"]["Enums"]["ingestion_run_kind"]
          run_metadata?: Json
          source_label: string
          started_at?: string
          status?: Database["public"]["Enums"]["ingestion_run_status"]
          updated_at?: string
        }
        Update: {
          accepted_record_count?: number
          completed_at?: string | null
          created_at?: string
          error_summary?: string | null
          id?: never
          input_record_count?: number
          rejected_record_count?: number
          run_kind?: Database["public"]["Enums"]["ingestion_run_kind"]
          run_metadata?: Json
          source_label?: string
          started_at?: string
          status?: Database["public"]["Enums"]["ingestion_run_status"]
          updated_at?: string
        }
        Relationships: []
      }
      normalized_readings: {
        Row: {
          captured_at: string
          confidence_score: number
          created_at: string
          crew_member_id: number
          id: number
          normalization_version: string
          normalized_unit: string
          normalized_value: number
          processing_metadata: Json
          raw_reading_id: number | null
          sensor_stream_id: number
          signal_type: Database["public"]["Enums"]["signal_type"]
          source_reading_count: number
          source_window_ended_at: string
          source_window_started_at: string
        }
        Insert: {
          captured_at: string
          confidence_score?: number
          created_at?: string
          crew_member_id: number
          id?: never
          normalization_version: string
          normalized_unit: string
          normalized_value: number
          processing_metadata?: Json
          raw_reading_id?: number | null
          sensor_stream_id: number
          signal_type: Database["public"]["Enums"]["signal_type"]
          source_reading_count?: number
          source_window_ended_at: string
          source_window_started_at: string
        }
        Update: {
          captured_at?: string
          confidence_score?: number
          created_at?: string
          crew_member_id?: number
          id?: never
          normalization_version?: string
          normalized_unit?: string
          normalized_value?: number
          processing_metadata?: Json
          raw_reading_id?: number | null
          sensor_stream_id?: number
          signal_type?: Database["public"]["Enums"]["signal_type"]
          source_reading_count?: number
          source_window_ended_at?: string
          source_window_started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "normalized_readings_crew_member_id_fkey"
            columns: ["crew_member_id"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "normalized_readings_raw_reading_id_fkey"
            columns: ["raw_reading_id"]
            isOneToOne: false
            referencedRelation: "raw_readings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "normalized_readings_sensor_stream_id_fkey"
            columns: ["sensor_stream_id"]
            isOneToOne: false
            referencedRelation: "sensor_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_readings: {
        Row: {
          captured_at: string
          created_at: string
          crew_member_id: number
          id: number
          ingestion_run_id: number
          raw_unit: string
          raw_value: number | null
          reading_status: Database["public"]["Enums"]["raw_reading_status"]
          received_at: string
          sensor_stream_id: number
          signal_type: Database["public"]["Enums"]["signal_type"]
          source_identifier: string
          source_metadata: Json
          source_payload: Json
          source_signal_type: string
        }
        Insert: {
          captured_at: string
          created_at?: string
          crew_member_id: number
          id?: never
          ingestion_run_id: number
          raw_unit: string
          raw_value?: number | null
          reading_status?: Database["public"]["Enums"]["raw_reading_status"]
          received_at?: string
          sensor_stream_id: number
          signal_type: Database["public"]["Enums"]["signal_type"]
          source_identifier: string
          source_metadata?: Json
          source_payload?: Json
          source_signal_type: string
        }
        Update: {
          captured_at?: string
          created_at?: string
          crew_member_id?: number
          id?: never
          ingestion_run_id?: number
          raw_unit?: string
          raw_value?: number | null
          reading_status?: Database["public"]["Enums"]["raw_reading_status"]
          received_at?: string
          sensor_stream_id?: number
          signal_type?: Database["public"]["Enums"]["signal_type"]
          source_identifier?: string
          source_metadata?: Json
          source_payload?: Json
          source_signal_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_readings_crew_member_id_fkey"
            columns: ["crew_member_id"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_readings_ingestion_run_id_fkey"
            columns: ["ingestion_run_id"]
            isOneToOne: false
            referencedRelation: "ingestion_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_readings_sensor_stream_id_fkey"
            columns: ["sensor_stream_id"]
            isOneToOne: false
            referencedRelation: "sensor_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      readiness_scores: {
        Row: {
          calculated_at: string
          composite_score: number
          confidence_modifier: number
          created_at: string
          crew_member_id: number
          id: number
          score_components: Json
          score_explanation: Json
          score_version: string
          window_ended_at: string
          window_started_at: string
        }
        Insert: {
          calculated_at?: string
          composite_score: number
          confidence_modifier?: number
          created_at?: string
          crew_member_id: number
          id?: never
          score_components?: Json
          score_explanation?: Json
          score_version: string
          window_ended_at: string
          window_started_at: string
        }
        Update: {
          calculated_at?: string
          composite_score?: number
          confidence_modifier?: number
          created_at?: string
          crew_member_id?: number
          id?: never
          score_components?: Json
          score_explanation?: Json
          score_version?: string
          window_ended_at?: string
          window_started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "readiness_scores_crew_member_id_fkey"
            columns: ["crew_member_id"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
        ]
      }
      sensor_streams: {
        Row: {
          created_at: string
          crew_member_id: number
          display_name: string
          id: number
          is_active: boolean
          sampling_cadence_seconds: number | null
          signal_type: Database["public"]["Enums"]["signal_type"]
          source_key: string
          source_vendor: string | null
          stream_metadata: Json
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          crew_member_id: number
          display_name: string
          id?: never
          is_active?: boolean
          sampling_cadence_seconds?: number | null
          signal_type: Database["public"]["Enums"]["signal_type"]
          source_key: string
          source_vendor?: string | null
          stream_metadata?: Json
          unit: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          crew_member_id?: number
          display_name?: string
          id?: never
          is_active?: boolean
          sampling_cadence_seconds?: number | null
          signal_type?: Database["public"]["Enums"]["signal_type"]
          source_key?: string
          source_vendor?: string | null
          stream_metadata?: Json
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sensor_streams_crew_member_id_fkey"
            columns: ["crew_member_id"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
        ]
      }
      summary_reviews: {
        Row: {
          ai_summary_id: number
          created_at: string
          decision: Database["public"]["Enums"]["summary_review_status"]
          id: number
          review_metadata: Json
          review_notes: string | null
          reviewer_display_name: string | null
          reviewer_user_id: string | null
        }
        Insert: {
          ai_summary_id: number
          created_at?: string
          decision: Database["public"]["Enums"]["summary_review_status"]
          id?: never
          review_metadata?: Json
          review_notes?: string | null
          reviewer_display_name?: string | null
          reviewer_user_id?: string | null
        }
        Update: {
          ai_summary_id?: number
          created_at?: string
          decision?: Database["public"]["Enums"]["summary_review_status"]
          id?: never
          review_metadata?: Json
          review_notes?: string | null
          reviewer_display_name?: string | null
          reviewer_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "summary_reviews_ai_summary_id_fkey"
            columns: ["ai_summary_id"]
            isOneToOne: false
            referencedRelation: "ai_summaries"
            referencedColumns: ["id"]
          },
        ]
      }
      system_logs: {
        Row: {
          component: string
          created_at: string
          details: Json
          event_type: string
          id: number
          level: Database["public"]["Enums"]["system_log_level"]
          message: string
          related_record_id: number | null
          related_table_name: string | null
        }
        Insert: {
          component: string
          created_at?: string
          details?: Json
          event_type: string
          id?: never
          level?: Database["public"]["Enums"]["system_log_level"]
          message: string
          related_record_id?: number | null
          related_table_name?: string | null
        }
        Update: {
          component?: string
          created_at?: string
          details?: Json
          event_type?: string
          id?: never
          level?: Database["public"]["Enums"]["system_log_level"]
          message?: string
          related_record_id?: number | null
          related_table_name?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      ai_summary_job_status: "pending" | "running" | "completed" | "failed"
      event_severity: "low" | "medium" | "high"
      ingestion_run_kind: "simulation" | "api" | "file" | "manual"
      ingestion_run_status:
        | "pending"
        | "running"
        | "completed"
        | "partially_completed"
        | "failed"
      raw_reading_status: "ok" | "missing" | "dropout"
      signal_type:
        | "heart_rate"
        | "heart_rate_variability"
        | "activity_level"
        | "temperature"
        | "sleep_duration"
        | "sleep_quality"
        | "custom"
      summary_review_status: "pending" | "approved" | "dismissed"
      summary_scope_kind: "crew_member" | "fleet"
      system_log_level: "debug" | "info" | "warn" | "error"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      ai_summary_job_status: ["pending", "running", "completed", "failed"],
      event_severity: ["low", "medium", "high"],
      ingestion_run_kind: ["simulation", "api", "file", "manual"],
      ingestion_run_status: [
        "pending",
        "running",
        "completed",
        "partially_completed",
        "failed",
      ],
      raw_reading_status: ["ok", "missing", "dropout"],
      signal_type: [
        "heart_rate",
        "heart_rate_variability",
        "activity_level",
        "temperature",
        "sleep_duration",
        "sleep_quality",
        "custom",
      ],
      summary_review_status: ["pending", "approved", "dismissed"],
      summary_scope_kind: ["crew_member", "fleet"],
      system_log_level: ["debug", "info", "warn", "error"],
    },
  },
} as const
