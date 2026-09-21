import { redirect } from "next/navigation";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireCenterManager } from "@/lib/center-manager";
import { loadCenterRequests } from "@/lib/center-requests";
import CenterRequests from "@/components/center/CenterRequests";

// 센터 매니저 — 수강신청 승인/거절. 강사가 시스템에 로그인하지 않는 운영 현실에서 승인 단계가 멈추지 않게 한다.
export default async function CenterRequestsPage() {
  const mgr = await requireCenterManager();
  if (!mgr) redirect("/");

  const { pending, recent } = await loadCenterRequests(createAdminClient(), mgr.centerIds);
  return <CenterRequests pending={pending} recent={recent} />;
}
