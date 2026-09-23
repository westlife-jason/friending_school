import { createAdminClient } from "@/utils/supabase/admin";
import { loadCenterDashboard } from "@/lib/center-dashboard";
import CenterDashboardView from "@/components/center/CenterDashboard";

// 관리자용 — 센터 매니저 대시보드와 같은 화면을 센터 구분 없이 전체(모든 강사) 기준으로 보여준다.
// requireAdmin 별도 가드 불필요 — /admin/layout.tsx가 이미 admin role을 강제한다.
export default async function AdminDashboardPage() {
  const admin = createAdminClient();
  const data = await loadCenterDashboard(admin, null);

  return <CenterDashboardView data={data} />;
}
