import { redirect } from "next/navigation";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireCenterManager } from "@/lib/center-manager";
import { loadAvailabilityTeachers } from "@/lib/center-availability";
import CenterAvailability from "@/components/center/CenterAvailability";

// 센터 매니저 — 강사 가용시간 대리 입력. 강사가 가용시간 화면을 쓰지 않아 매칭 데이터가 비어 있던 문제를 푼다.
export default async function CenterAvailabilityPage() {
  const mgr = await requireCenterManager();
  if (!mgr) redirect("/");

  const teachers = await loadAvailabilityTeachers(createAdminClient(), mgr.centerIds);
  return <CenterAvailability teachers={teachers} />;
}
