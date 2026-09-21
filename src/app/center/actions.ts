"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireCenterManager } from "@/lib/center-manager";
import { reassignClassCore } from "@/lib/reassign";
import { saveAvailabilityForCenterTeacher } from "@/lib/center-availability";
import type { Slot } from "@/lib/availability";

export type ActionResult = { ok: boolean; error?: string };

// 센터 매니저의 개별 회차 강사 대체 — 담당 센터 소속 강사 간에만 허용(공유 코어에 센터 제약 전달).
export async function centerReassignClass(classId: string, newTeacherId: string): Promise<ActionResult> {
  const mgr = await requireCenterManager();
  if (!mgr) return { ok: false, error: "권한이 없습니다." };
  return reassignClassCore(createAdminClient(), {
    classId,
    newTeacherId,
    actor: { id: mgr.userId, role: "center_manager" },
    constrainCenterIds: mgr.centerIds,
  });
}

// 센터 매니저의 강사 가용시간 대리 입력 — 담당 센터 소속 강사만. 강사가 화면을 쓰지 않아 데이터가 비어 있던 문제를 푸는 핵심 액션.
export async function centerSaveTeacherAvailability(teacherId: string, slots: Slot[]): Promise<ActionResult> {
  const mgr = await requireCenterManager();
  if (!mgr) return { ok: false, error: "You don't have permission." };
  const res = await saveAvailabilityForCenterTeacher(createAdminClient(), { teacherId, slots, allowedCenterIds: mgr.centerIds });
  if (res.ok) {
    revalidatePath("/center", "layout");
    revalidatePath("/learning");
  }
  return res;
}
