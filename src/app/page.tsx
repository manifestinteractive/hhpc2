import { LiveDashboardShell } from "@/components/dashboard/live-dashboard-shell";
import { getDashboardLiveSnapshotWithServiceRole } from "@/lib/api/query";

export default async function Home() {
  const initialSnapshot = await getDashboardLiveSnapshotWithServiceRole();
  return <LiveDashboardShell initialSnapshot={initialSnapshot} />;
}
