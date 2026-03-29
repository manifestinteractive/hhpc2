insert into public.crew_members (
  crew_code,
  display_name,
  given_name,
  family_name,
  call_sign,
  role_title,
  sort_order,
  baseline_timezone,
  baseline_profile,
  profile_metadata
)
values
  (
    'CRW-001',
    'Dr. Maya Chen',
    'Maya',
    'Chen',
    'Northstar',
    'Flight Surgeon',
    10,
    'UTC',
    jsonb_build_object(
      'resting_heart_rate_bpm', 56,
      'heart_rate_variability_ms', 72,
      'sleep_target_hours', 8.0,
      'daily_activity_target', 0.68
    ),
    jsonb_build_object(
      'specialty', 'Biomedical operations',
      'experience_band', 'senior'
    )
  ),
  (
    'CRW-002',
    'Commander Elena Alvarez',
    'Elena',
    'Alvarez',
    'Sable',
    'Mission Commander',
    20,
    'UTC',
    jsonb_build_object(
      'resting_heart_rate_bpm', 58,
      'heart_rate_variability_ms', 66,
      'sleep_target_hours', 7.5,
      'daily_activity_target', 0.71
    ),
    jsonb_build_object(
      'specialty', 'Operational leadership',
      'experience_band', 'senior'
    )
  ),
  (
    'CRW-003',
    'Amina Okafor',
    'Amina',
    'Okafor',
    'Harbor',
    'Flight Engineer',
    30,
    'UTC',
    jsonb_build_object(
      'resting_heart_rate_bpm', 60,
      'heart_rate_variability_ms', 64,
      'sleep_target_hours', 7.8,
      'daily_activity_target', 0.74
    ),
    jsonb_build_object(
      'specialty', 'Systems reliability',
      'experience_band', 'mid'
    )
  ),
  (
    'CRW-004',
    'Jordan Brooks',
    'Jordan',
    'Brooks',
    'Vector',
    'Payload Specialist',
    40,
    'UTC',
    jsonb_build_object(
      'resting_heart_rate_bpm', 62,
      'heart_rate_variability_ms', 69,
      'sleep_target_hours', 7.2,
      'daily_activity_target', 0.65
    ),
    jsonb_build_object(
      'specialty', 'Payload operations',
      'experience_band', 'mid'
    )
  ),
  (
    'CRW-005',
    'Priya Raman',
    'Priya',
    'Raman',
    'Circuit',
    'Systems Analyst',
    50,
    'UTC',
    jsonb_build_object(
      'resting_heart_rate_bpm', 57,
      'heart_rate_variability_ms', 74,
      'sleep_target_hours', 8.1,
      'daily_activity_target', 0.61
    ),
    jsonb_build_object(
      'specialty', 'Telemetry analysis',
      'experience_band', 'mid'
    )
  ),
  (
    'CRW-006',
    'Sofia Martinez',
    'Sofia',
    'Martinez',
    'Solstice',
    'Human Performance Scientist',
    60,
    'UTC',
    jsonb_build_object(
      'resting_heart_rate_bpm', 55,
      'heart_rate_variability_ms', 78,
      'sleep_target_hours', 8.3,
      'daily_activity_target', 0.67
    ),
    jsonb_build_object(
      'specialty', 'Readiness analytics',
      'experience_band', 'senior'
    )
  );
