import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AdminObservabilityDashboard } from "@/components/admin/admin-observability-dashboard";
import { getAdminObservabilitySnapshotWithServiceRole } from "@/lib/api/query";
import { getServerEnv } from "@/lib/env/server";

export const metadata: Metadata = {
  title: "Admin",
  description: "Observability and admin dashboard for Crew Readiness.",
  robots: {
    follow: false,
    index: false,
  },
};

export default async function AdminPage() {
  await connection();

  const env = getServerEnv();

  if (!env.FEATURE_ADMIN_TOOLS) {
    notFound();
  }

  const snapshot = await getAdminObservabilitySnapshotWithServiceRole();

  return <AdminObservabilityDashboard snapshot={snapshot} />;
}
