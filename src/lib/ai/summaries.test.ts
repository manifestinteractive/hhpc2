import { beforeEach, describe, expect, it, vi } from "vitest";
import { reviewSummary } from "@/lib/ai/summaries";

const mockListSummaries = vi.fn();
const mockGetSummaryById = vi.fn();
const mockUpdateSummary = vi.fn();
const mockCreateSummaryReview = vi.fn();
const mockCreateSystemLog = vi.fn();

vi.mock("@/lib/api/query", () => ({
  listSummaries: (...args: unknown[]) => mockListSummaries(...args),
}));

vi.mock("@/lib/db", () => ({
  aiSummariesRepository: {
    getById: (...args: unknown[]) => mockGetSummaryById(...args),
    update: (...args: unknown[]) => mockUpdateSummary(...args),
  },
  createSupabaseServiceRoleClient: () => ({
    from: (table: string) => {
      if (table === "crew_members") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  crew_code: "CRW-002",
                },
                error: null,
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table lookup in test: ${table}`);
    },
  }),
  summaryReviewsRepository: {
    create: (...args: unknown[]) => mockCreateSummaryReview(...args),
  },
  systemLogsRepository: {
    create: (...args: unknown[]) => mockCreateSystemLog(...args),
  },
}));

describe("AI summary orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records review decisions for an existing summary", async () => {
    mockGetSummaryById.mockResolvedValue({
      crew_member_id: 2,
      id: 202,
      scope_kind: "crew_member",
    });
    mockUpdateSummary.mockResolvedValue({});
    mockCreateSummaryReview.mockResolvedValue({ id: 1 });
    mockListSummaries.mockResolvedValue({
      summaries: [
        {
          crewCode: "CRW-002",
          crewDisplayName: "Commander Elena Alvarez",
          generatedAt: "2026-03-30T05:15:00.000Z",
          id: 202,
          modelName: "gpt-5-mini",
          providerName: "openai",
          readinessScoreId: 77,
          reviewStatus: "approved",
          reviewedAt: "2026-03-30T05:16:00.000Z",
          scopeKind: "crew_member",
          structuredInputContext: {},
          summaryText:
            "Telemetry confidence is acceptable, but sensor reliability remains the main concern.",
        },
      ],
    });

    const summary = await reviewSummary({
      decision: "approved",
      summaryId: 202,
    });

    expect(summary.reviewStatus).toBe("approved");
    expect(mockUpdateSummary).toHaveBeenCalledWith(
      expect.anything(),
      202,
      expect.objectContaining({
        review_status: "approved",
      }),
    );
    expect(mockCreateSummaryReview).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ai_summary_id: 202,
        decision: "approved",
      }),
    );
    expect(mockCreateSystemLog).toHaveBeenCalled();
  });
});
