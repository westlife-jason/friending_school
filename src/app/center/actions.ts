"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireCenterManager } from "@/lib/center-manager";
import { reassignClassCore } from "@/lib/reassign";
import { saveAvailabilityForCenterTeacher } from "@/lib/center-availability";
import { approveEnrollmentAsCenterManager, rejectEnrollmentAsCenterManager } from "@/lib/center-requests";
import { postponeClassAsCenterManager } from "@/lib/center-class-postpone";
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

// 센터 매니저의 수강신청 승인/거절 — 담당 센터 소속 강사의 '신청' 건만. 강사 승인(teacher/actions.ts)은 그대로 두고 추가한 경로.
export async function centerApproveEnrollment(enrollmentId: string): Promise<ActionResult> {
  const mgr = await requireCenterManager();
  if (!mgr) return { ok: false, error: "You don't have permission." };
  const res = await approveEnrollmentAsCenterManager(createAdminClient(), { enrollmentId, actorId: mgr.userId, allowedCenterIds: mgr.centerIds });
  if (res.ok) {
    revalidatePath("/center", "layout");
    revalidatePath("/admin/enrollments");
  }
  return res;
}

export async function centerRejectEnrollment(enrollmentId: string, reason: string): Promise<ActionResult> {
  const mgr = await requireCenterManager();
  if (!mgr) return { ok: false, error: "You don't have permission." };
  const res = await rejectEnrollmentAsCenterManager(createAdminClient(), {
    enrollmentId,
    reason,
    actorId: mgr.userId,
    allowedCenterIds: mgr.centerIds,
  });
  if (res.ok) {
    revalidatePath("/center", "layout");
    revalidatePath("/admin/enrollments");
  }
  return res;
}

// 센터 매니저의 "강사 사정으로 수업 연기" — 담당 센터 강사의 시작 전 수업만. 학생 연기 횟수 미차감, 보강 자동 생성(관리자 '회사 사유' 연기와 동일).
export async function centerPostponeClass(classId: string): Promise<ActionResult & { makeupDate?: string }> {
  const mgr = await requireCenterManager();
  if (!mgr) return { ok: false, error: "You don't have permission." };
  const res = await postponeClassAsCenterManager(createAdminClient(), { classId, actorId: mgr.userId, allowedCenterIds: mgr.centerIds });
  if (res.ok) {
    revalidatePath("/center", "layout");
    revalidatePath("/admin/classes");
    revalidatePath("/teacher", "layout");
    revalidatePath("/mypage", "layout");
  }
  return res;
}
