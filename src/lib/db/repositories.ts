import { createCrudRepository } from "@/lib/db/crud";

export const crewMembersRepository = {
  ...createCrudRepository("crew_members", {
    ascending: true,
    orderBy: "sort_order",
  }),
};

export const sensorStreamsRepository = {
  ...createCrudRepository("sensor_streams", {
    ascending: true,
    orderBy: "id",
  }),
};

export const ingestionRunsRepository = {
  ...createCrudRepository("ingestion_runs", {
    ascending: false,
    orderBy: "started_at",
  }),
};

export const rawReadingsRepository = {
  ...createCrudRepository("raw_readings", {
    ascending: false,
    orderBy: "captured_at",
  }),
};

export const normalizedReadingsRepository = {
  ...createCrudRepository("normalized_readings", {
    ascending: false,
    orderBy: "captured_at",
  }),
};

export const detectedEventsRepository = {
  ...createCrudRepository("detected_events", {
    ascending: false,
    orderBy: "started_at",
  }),
};

export const readinessScoresRepository = {
  ...createCrudRepository("readiness_scores", {
    ascending: false,
    orderBy: "calculated_at",
  }),
};

export const aiSummariesRepository = {
  ...createCrudRepository("ai_summaries", {
    ascending: false,
    orderBy: "generated_at",
  }),
};

export const aiSummaryJobsRepository = {
  ...createCrudRepository("ai_summary_jobs", {
    ascending: true,
    orderBy: "enqueued_at",
  }),
};

export const summaryReviewsRepository = {
  ...createCrudRepository("summary_reviews", {
    ascending: false,
    orderBy: "created_at",
  }),
};

export const systemLogsRepository = {
  ...createCrudRepository("system_logs", {
    ascending: false,
    orderBy: "created_at",
  }),
};
