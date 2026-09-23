import { redirect } from "next/navigation";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireCenterManager } from "@/lib/center-manager";
import { loadCenterDashboard } from "@/lib/center-dashboard";
import CenterDashboardView from "@/components/center/CenterDashboard";

// 센터 매니저 첫 화면 — 강사 목록 대신 대시보드가 뜬다(민수 피드백: "관리할 때 일단 통계부터 본다").
export default async function CenterPage() {
  const mgr = await requireCenterManager();
  if (!mgr) redirect("/");

  const admin = createAdminClient();
  const data = await loadCenterDashboard(admin, mgr.centerIds);

  return <CenterDashboardView data={data} />;
}
