create type public.raw_reading_status as enum (
  'ok',
  'missing',
  'dropout'
);

alter table public.raw_readings
  add column reading_status public.raw_reading_status not null default 'ok',
  alter column raw_value drop not null;

alter table public.raw_readings
  add constraint raw_readings_status_value_check
    check (
      (reading_status = 'ok' and raw_value is not null)
      or (reading_status = 'missing' and raw_value is null)
      or reading_status = 'dropout'
    );

create index raw_readings_ingestion_status_captured_at_idx
  on public.raw_readings (ingestion_run_id, reading_status, captured_at desc);
