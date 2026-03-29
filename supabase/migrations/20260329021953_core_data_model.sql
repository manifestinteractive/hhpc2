create type public.signal_type as enum (
  'heart_rate',
  'heart_rate_variability',
  'activity_level',
  'temperature',
  'sleep_duration',
  'sleep_quality',
  'custom'
);

create type public.ingestion_run_kind as enum (
  'simulation',
  'api',
  'file',
  'manual'
);

create type public.ingestion_run_status as enum (
  'pending',
  'running',
  'completed',
  'partially_completed',
  'failed'
);

create type public.event_severity as enum (
  'low',
  'medium',
  'high'
);

create type public.summary_scope_kind as enum (
  'crew_member',
  'fleet'
);

create type public.summary_review_status as enum (
  'pending',
  'approved',
  'dismissed'
);

create type public.system_log_level as enum (
  'debug',
  'info',
  'warn',
  'error'
);

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.crew_members (
  id bigint generated always as identity primary key,
  crew_code text not null unique,
  display_name text not null,
  given_name text not null,
  family_name text not null,
  call_sign text,
  role_title text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  baseline_timezone text not null default 'UTC',
  baseline_profile jsonb not null default '{}'::jsonb,
  profile_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crew_members_baseline_profile_object_check
    check (jsonb_typeof(baseline_profile) = 'object'),
  constraint crew_members_profile_metadata_object_check
    check (jsonb_typeof(profile_metadata) = 'object')
);

create table public.sensor_streams (
  id bigint generated always as identity primary key,
  crew_member_id bigint not null references public.crew_members(id) on delete cascade,
  signal_type public.signal_type not null,
  source_key text not null,
  display_name text not null,
  source_vendor text,
  unit text not null,
  sampling_cadence_seconds integer,
  is_active boolean not null default true,
  stream_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sensor_streams_unique_source unique (crew_member_id, source_key, signal_type),
  constraint sensor_streams_sampling_cadence_positive_check
    check (sampling_cadence_seconds is null or sampling_cadence_seconds > 0),
  constraint sensor_streams_stream_metadata_object_check
    check (jsonb_typeof(stream_metadata) = 'object')
);

create table public.ingestion_runs (
  id bigint generated always as identity primary key,
  run_kind public.ingestion_run_kind not null,
  status public.ingestion_run_status not null default 'pending',
  source_label text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  input_record_count integer not null default 0,
  accepted_record_count integer not null default 0,
  rejected_record_count integer not null default 0,
  error_summary text,
  run_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ingestion_runs_completed_after_started_check
    check (completed_at is null or completed_at >= started_at),
  constraint ingestion_runs_input_record_count_check
    check (input_record_count >= 0),
  constraint ingestion_runs_accepted_record_count_check
    check (accepted_record_count >= 0),
  constraint ingestion_runs_rejected_record_count_check
    check (rejected_record_count >= 0),
  constraint ingestion_runs_run_metadata_object_check
    check (jsonb_typeof(run_metadata) = 'object')
);

create table public.raw_readings (
  id bigint generated always as identity primary key,
  crew_member_id bigint not null references public.crew_members(id) on delete cascade,
  sensor_stream_id bigint not null references public.sensor_streams(id) on delete cascade,
  ingestion_run_id bigint not null references public.ingestion_runs(id) on delete restrict,
  captured_at timestamptz not null,
  received_at timestamptz not null default now(),
  signal_type public.signal_type not null,
  source_identifier text not null,
  source_signal_type text not null,
  raw_value numeric(12, 4) not null,
  raw_unit text not null,
  source_payload jsonb not null default '{}'::jsonb,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint raw_readings_unique_source_record unique (
    sensor_stream_id,
    source_identifier,
    captured_at
  ),
  constraint raw_readings_source_payload_object_check
    check (jsonb_typeof(source_payload) = 'object'),
  constraint raw_readings_source_metadata_object_check
    check (jsonb_typeof(source_metadata) = 'object')
);

create table public.normalized_readings (
  id bigint generated always as identity primary key,
  crew_member_id bigint not null references public.crew_members(id) on delete cascade,
  sensor_stream_id bigint not null references public.sensor_streams(id) on delete cascade,
  raw_reading_id bigint references public.raw_readings(id) on delete set null,
  captured_at timestamptz not null,
  signal_type public.signal_type not null,
  normalized_value numeric(12, 4) not null,
  normalized_unit text not null,
  confidence_score numeric(5, 4) not null default 1.0,
  source_window_started_at timestamptz not null,
  source_window_ended_at timestamptz not null,
  source_reading_count integer not null default 1,
  normalization_version text not null,
  processing_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint normalized_readings_confidence_score_check
    check (confidence_score >= 0 and confidence_score <= 1),
  constraint normalized_readings_source_window_check
    check (source_window_ended_at >= source_window_started_at),
  constraint normalized_readings_source_reading_count_check
    check (source_reading_count >= 1),
  constraint normalized_readings_processing_metadata_object_check
    check (jsonb_typeof(processing_metadata) = 'object')
);

create table public.detected_events (
  id bigint generated always as identity primary key,
  crew_member_id bigint not null references public.crew_members(id) on delete cascade,
  sensor_stream_id bigint references public.sensor_streams(id) on delete set null,
  normalized_reading_id bigint references public.normalized_readings(id) on delete set null,
  event_type text not null,
  severity public.event_severity not null default 'low',
  confidence_score numeric(5, 4) not null default 1.0,
  started_at timestamptz not null,
  ended_at timestamptz,
  primary_signal_type public.signal_type,
  rule_id text not null,
  rule_version text not null,
  explanation text not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint detected_events_confidence_score_check
    check (confidence_score >= 0 and confidence_score <= 1),
  constraint detected_events_time_window_check
    check (ended_at is null or ended_at >= started_at),
  constraint detected_events_evidence_object_check
    check (jsonb_typeof(evidence) = 'object')
);

create table public.readiness_scores (
  id bigint generated always as identity primary key,
  crew_member_id bigint not null references public.crew_members(id) on delete cascade,
  window_started_at timestamptz not null,
  window_ended_at timestamptz not null,
  composite_score numeric(5, 2) not null,
  confidence_modifier numeric(5, 4) not null default 1.0,
  score_components jsonb not null default '{}'::jsonb,
  score_explanation jsonb not null default '{}'::jsonb,
  score_version text not null,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint readiness_scores_time_window_check
    check (window_ended_at >= window_started_at),
  constraint readiness_scores_composite_score_check
    check (composite_score >= 0 and composite_score <= 100),
  constraint readiness_scores_confidence_modifier_check
    check (confidence_modifier >= 0 and confidence_modifier <= 1),
  constraint readiness_scores_score_components_object_check
    check (jsonb_typeof(score_components) = 'object'),
  constraint readiness_scores_score_explanation_object_check
    check (jsonb_typeof(score_explanation) = 'object'),
  constraint readiness_scores_unique_window unique (
    crew_member_id,
    window_started_at,
    window_ended_at,
    score_version
  )
);

create table public.ai_summaries (
  id bigint generated always as identity primary key,
  crew_member_id bigint references public.crew_members(id) on delete set null,
  readiness_score_id bigint references public.readiness_scores(id) on delete set null,
  scope_kind public.summary_scope_kind not null default 'crew_member',
  review_status public.summary_review_status not null default 'pending',
  summary_text text not null,
  structured_input_context jsonb not null default '{}'::jsonb,
  provider_name text not null,
  model_name text not null,
  generated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_summaries_scope_check
    check (
      (scope_kind = 'crew_member' and crew_member_id is not null)
      or (scope_kind = 'fleet')
    ),
  constraint ai_summaries_reviewed_at_check
    check (
      (review_status = 'pending' and reviewed_at is null)
      or (review_status <> 'pending')
    ),
  constraint ai_summaries_structured_input_context_object_check
    check (jsonb_typeof(structured_input_context) = 'object')
);

create table public.summary_reviews (
  id bigint generated always as identity primary key,
  ai_summary_id bigint not null references public.ai_summaries(id) on delete cascade,
  reviewer_user_id uuid references auth.users(id) on delete set null,
  reviewer_display_name text,
  decision public.summary_review_status not null,
  review_notes text,
  review_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint summary_reviews_decision_check
    check (decision in ('approved', 'dismissed')),
  constraint summary_reviews_review_metadata_object_check
    check (jsonb_typeof(review_metadata) = 'object')
);

create table public.system_logs (
  id bigint generated always as identity primary key,
  level public.system_log_level not null default 'info',
  component text not null,
  event_type text not null,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  related_table_name text,
  related_record_id bigint,
  created_at timestamptz not null default now(),
  constraint system_logs_details_object_check
    check (jsonb_typeof(details) = 'object')
);

create index crew_members_active_sort_idx
  on public.crew_members (is_active, sort_order, id);

create index sensor_streams_crew_member_id_idx
  on public.sensor_streams (crew_member_id);

create index sensor_streams_crew_signal_active_idx
  on public.sensor_streams (crew_member_id, signal_type, is_active);

create index ingestion_runs_status_started_at_idx
  on public.ingestion_runs (status, started_at desc);

create index raw_readings_crew_captured_at_idx
  on public.raw_readings (crew_member_id, captured_at desc);

create index raw_readings_sensor_captured_at_idx
  on public.raw_readings (sensor_stream_id, captured_at desc);

create index raw_readings_ingestion_run_id_idx
  on public.raw_readings (ingestion_run_id);

create index normalized_readings_crew_signal_captured_at_idx
  on public.normalized_readings (crew_member_id, signal_type, captured_at desc);

create index normalized_readings_sensor_captured_at_idx
  on public.normalized_readings (sensor_stream_id, captured_at desc);

create index normalized_readings_raw_reading_id_idx
  on public.normalized_readings (raw_reading_id)
  where raw_reading_id is not null;

create index detected_events_crew_started_at_idx
  on public.detected_events (crew_member_id, started_at desc);

create index detected_events_primary_signal_started_at_idx
  on public.detected_events (primary_signal_type, started_at desc);

create index detected_events_normalized_reading_id_idx
  on public.detected_events (normalized_reading_id)
  where normalized_reading_id is not null;

create index readiness_scores_crew_calculated_at_idx
  on public.readiness_scores (crew_member_id, calculated_at desc);

create index readiness_scores_crew_window_idx
  on public.readiness_scores (crew_member_id, window_started_at desc, window_ended_at desc);

create index ai_summaries_crew_generated_at_idx
  on public.ai_summaries (crew_member_id, generated_at desc);

create index ai_summaries_readiness_score_id_idx
  on public.ai_summaries (readiness_score_id)
  where readiness_score_id is not null;

create index ai_summaries_pending_review_idx
  on public.ai_summaries (generated_at desc)
  where review_status = 'pending';

create index summary_reviews_ai_summary_created_at_idx
  on public.summary_reviews (ai_summary_id, created_at desc);

create index summary_reviews_reviewer_user_id_idx
  on public.summary_reviews (reviewer_user_id)
  where reviewer_user_id is not null;

create index system_logs_component_created_at_idx
  on public.system_logs (component, created_at desc);

create index system_logs_level_created_at_idx
  on public.system_logs (level, created_at desc);

create index system_logs_related_record_idx
  on public.system_logs (related_table_name, related_record_id)
  where related_table_name is not null and related_record_id is not null;

create trigger set_crew_members_updated_at
before update on public.crew_members
for each row
execute function public.set_updated_at_timestamp();

create trigger set_sensor_streams_updated_at
before update on public.sensor_streams
for each row
execute function public.set_updated_at_timestamp();

create trigger set_ingestion_runs_updated_at
before update on public.ingestion_runs
for each row
execute function public.set_updated_at_timestamp();

create trigger set_ai_summaries_updated_at
before update on public.ai_summaries
for each row
execute function public.set_updated_at_timestamp();
