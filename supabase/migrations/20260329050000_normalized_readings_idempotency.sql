alter table public.normalized_readings
  add constraint normalized_readings_unique_raw_version
    unique (raw_reading_id, normalization_version);
