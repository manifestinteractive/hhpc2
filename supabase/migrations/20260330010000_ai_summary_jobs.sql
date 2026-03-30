create type public.ai_summary_job_status as enum (
  'pending',
  'running',
  'completed',
  'failed'
);

create table public.ai_summary_jobs (
  id bigint generated always as identity primary key,
  crew_member_id bigint not null references public.crew_members(id) on delete cascade,
  readiness_score_id bigint not null references public.readiness_scores(id) on delete cascade,
  status public.ai_summary_job_status not null default 'pending',
  attempt_count integer not null default 0,
  last_error text,
  enqueued_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_summary_jobs_attempt_count_check
    check (attempt_count >= 0),
  constraint ai_summary_jobs_running_time_check
    check (
      (status = 'pending' and started_at is null and completed_at is null)
      or (status = 'running' and started_at is not null and completed_at is null)
      or (status in ('completed', 'failed') and completed_at is not null)
    )
);

create unique index ai_summaries_unique_crew_score_idx
  on public.ai_summaries (readiness_score_id)
  where scope_kind = 'crew_member' and readiness_score_id is not null;

create unique index ai_summary_jobs_active_crew_idx
  on public.ai_summary_jobs (crew_member_id)
  where status in ('pending', 'running');

create unique index ai_summary_jobs_readiness_score_id_idx
  on public.ai_summary_jobs (readiness_score_id);

create index ai_summary_jobs_status_enqueued_at_idx
  on public.ai_summary_jobs (status, enqueued_at asc);

create trigger set_ai_summary_jobs_updated_at
before update on public.ai_summary_jobs
for each row
execute function public.set_updated_at_timestamp();
