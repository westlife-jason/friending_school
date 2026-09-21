import "server-only";

import { headers } from "next/headers";
import { createAdminClient, getAdminEmails } from "@/utils/supabase/admin";
import { getOrigin } from "@/lib/origin";
import { getCourse } from "@/data/courses";
import { sendSms } from "@/lib/sms";
import { sendEnrollmentApprovedToAdmin, sendEnrollmentRejectedToAdmin } from "@/lib/mailer";
import {
  isValidSlot,
  lessonEndDate,
  overlappingIds,
  slotsOverlap,
  summarizeSlots,
  teacherHasAllSlots,
  TOTAL_SESSIONS,
  type Slot,
} from "@/lib/availability";
import { loadEndedEnrollmentIds } from "@/lib/booking";
import { logEnrollmentEvent } from "@/lib/events";

type Admin = ReturnType<typeof createAdminClient>;

// 센터 매니저의 수강신청 승인/거절.
// 운영 현실: 필리핀 강사는 시스템에 로그인하지 않아 "강사 승인"에서 신청이 멈춘다 → 강사 관리 책임을 가진
// 센터 매니저가 승인 주체가 된다. 강사 본인 승인(teacher/actions.ts approveEnrollment)은 그대로 두고 **추가**했다.
// ⚠️ 상태 전이·중복 예약 가드·학생 SMS·관리자 메일·이벤트 로그는 강사 승인과 같은 규칙이다(같은 status 가드 UPDATE).
//    원본 수정 권한이 생기면 두 경로를 하나의 공유 코어로 합칠 것.
//    다만 "담당 센터 매니저 알림"은 보내지 않는다 — 처리한 사람이 바로 그 매니저다.

const parseSlots = (raw: unknown): Slot[] =>
  Array.isArray(raw) ? raw.filter(isValidSlot).map((s) => ({ day: Number(s.day), min: Number(s.min) })) : [];

const displayName = (english: string | null, korean: string | null) => english?.trim() || korean?.trim() || "Student";

export type CenterRequest = {
  id: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  centerName: string | null;
  courseTitle: string;
  slots: Slot[];
  startDate: string;
  totalSessions: number;
  status: string;
  note: string | null;
  createdLabel: string; // 서버에서 KST로 포맷 — 클라이언트 로컬 TZ로 계산하면 서버/브라우저 표시가 어긋난다.
  outsideAvailability: boolean; // 요청 시간이 강사의 현재 가용시간 밖이다(매니저가 가용시간을 고친 뒤일 수 있음).
  conflict: boolean; // 같은 강사의 다른 대기 신청과 시간이 겹친다.
};

const createdLabelOf = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Seoul",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const REQUEST_COLUMNS =
  "id, teacher_id, teacher_name, student_name, student_english_name, course, course_title, slots, start_date, total_sessions, status, teacher_note, created_at";

async function loadCenterTeacherIds(admin: Admin, centerIds: string[]) {
  const { data } = await admin.from("profiles").select("id, center_id").eq("role", "teacher").in("center_id", centerIds);
  return (data ?? []) as { id: string; center_id: string | null }[];
}

export async function countPendingRequests(admin: Admin, centerIds: string[]): Promise<number> {
  if (centerIds.length === 0) return 0;
  const teachers = await loadCenterTeacherIds(admin, centerIds);
  if (teachers.length === 0) return 0;
  const { count } = await admin
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("status", "신청")
    .in(
      "teacher_id",
      teachers.map((t) => t.id),
    );
  return count ?? 0;
}

export async function loadCenterRequests(admin: Admin, centerIds: string[]): Promise<{ pending: CenterRequest[]; recent: CenterRequest[] }> {
  if (centerIds.length === 0) return { pending: [], recent: [] };
  const teachers = await loadCenterTeacherIds(admin, centerIds);
  if (teachers.length === 0) return { pending: [], recent: [] };
  const ids = teachers.map((t) => t.id);

  const { data: centers } = await admin.from("centers").select("id, name").in("id", centerIds);
  const centerName = new Map(((centers ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const centerByTeacher = new Map(teachers.map((t) => [t.id, t.center_id ? (centerName.get(t.center_id) ?? null) : null]));

  const { data: rows } = await admin
    .from("enrollments")
    .select(REQUEST_COLUMNS)
    .in("teacher_id", ids)
    .order("created_at", { ascending: false })
    .limit(200);
  type Row = {
    id: string;
    teacher_id: string;
    teacher_name: string | null;
    student_name: string | null;
    student_english_name: string | null;
    course: string;
    course_title: string;
    slots: unknown;
    start_date: string;
    total_sessions: number | null;
    status: string;
    teacher_note: string | null;
    created_at: string;
  };
  const all = (rows ?? []) as Row[];

  const { data: avail } = await admin.from("teacher_availability").select("teacher_id, day_of_week, start_min").in("teacher_id", ids);
  const availByTeacher = new Map<string, Slot[]>();
  for (const a of (avail ?? []) as { teacher_id: string; day_of_week: number; start_min: number }[]) {
    const list = availByTeacher.get(a.teacher_id) ?? [];
    list.push({ day: a.day_of_week, min: a.start_min });
    availByTeacher.set(a.teacher_id, list);
  }

  const pendingRows = all.filter((r) => r.status === "신청");
  const conflicts = overlappingIds(pendingRows.map((r) => ({ id: r.id, group: r.teacher_id, slots: parseSlots(r.slots) })));

  const toRequest = (r: Row): CenterRequest => {
    const slots = parseSlots(r.slots);
    return {
      id: r.id,
      studentName: displayName(r.student_english_name, r.student_name),
      teacherId: r.teacher_id,
      teacherName: r.teacher_name ?? "Teacher",
      centerName: centerByTeacher.get(r.teacher_id) ?? null,
      courseTitle: getCourse(r.course)?.englishTitle ?? r.course_title,
      slots,
      startDate: r.start_date,
      totalSessions: r.total_sessions ?? TOTAL_SESSIONS,
      status: r.status,
      note: r.teacher_note,
      createdLabel: createdLabelOf(r.created_at),
      outsideAvailability: r.status === "신청" && slots.length > 0 && !teacherHasAllSlots(availByTeacher.get(r.teacher_id) ?? [], slots),
      conflict: conflicts.has(r.id),
    };
  };

  return {
    // 대기 목록은 오래된 신청부터(먼저 온 사람 먼저), 최근 처리 내역은 최신순.
    pending: pendingRows.map(toRequest).reverse(),
    recent: all
      .filter((r) => r.status !== "신청")
      .slice(0, 15)
      .map(toRequest),
  };
}

type Enrollment = {
  id: string;
  teacher_id: string;
  status: string;
  student_phone: string | null;
  student_name: string | null;
  student_english_name: string | null;
  course: string;
  course_title: string;
  course_english_title: string | null;
  teacher_name: string | null;
  slots: unknown;
  total_sessions: number | null;
  start_date: string;
};

function buildAdminMail(enr: Enrollment, origin: string, opts: { withEnd?: boolean; reason?: string }) {
  const slots = parseSlots(enr.slots);
  const totalSessions = enr.total_sessions ?? TOTAL_SESSIONS;
  const endDate = (() => {
    if (!opts.withEnd) return "";
    const [y, m, d] = String(enr.start_date ?? "")
      .split("-")
      .map(Number);
    if (!y || !m || !d) return "";
    const end = lessonEndDate(new Date(y, m - 1, d), slots, totalSessions);
    return end ? `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}` : "";
  })();
  return {
    studentName: enr.student_name ?? "",
    studentEnglishName: enr.student_english_name ?? "",
    courseTitle: enr.course_title,
    courseEnglishTitle: getCourse(enr.course)?.englishTitle ?? enr.course_english_title ?? "",
    teacherName: enr.teacher_name ?? "",
    schedule: summarizeSlots(slots, false, " / "),
    startDate: enr.start_date,
    endDate,
    totalSessions,
    adminUrl: `${origin}/admin/enrollments`,
    ...(opts.reason ? { reason: opts.reason } : {}),
  };
}

// 담당 센터 소속 강사의 '신청' 건만 처리 대상이다.
async function loadManagedPending(admin: Admin, enrollmentId: string, allowedCenterIds: string[]): Promise<{ enr?: Enrollment; error?: string }> {
  const { data } = await admin
    .from("enrollments")
    .select(
      "id, teacher_id, status, student_phone, student_name, student_english_name, course, course_title, course_english_title, teacher_name, slots, total_sessions, start_date",
    )
    .eq("id", enrollmentId)
    .maybeSingle();
  const enr = data as Enrollment | null;
  if (!enr) return { error: "Request not found. Please refresh the list." };

  const { data: prof } = await admin.from("profiles").select("role, center_id").eq("id", enr.teacher_id).maybeSingle();
  const p = prof as { role?: string; center_id?: string | null } | null;
  if (p?.role !== "teacher" || !p.center_id || !allowedCenterIds.includes(p.center_id)) {
    return { error: "You don't have permission to handle this request." };
  }
  if (enr.status !== "신청") return { error: "This request was already processed. Please refresh the list." };
  return { enr };
}

export async function approveEnrollmentAsCenterManager(
  admin: Admin,
  input: { enrollmentId: string; actorId: string; allowedCenterIds: string[] },
): Promise<{ ok: boolean; error?: string }> {
  const { enr, error } = await loadManagedPending(admin, input.enrollmentId, input.allowedCenterIds);
  if (!enr) return { ok: false, error };

  // 중복 예약 가드 — 이 강사의 다른 확정 예약('승인'·'결제대기'·'결제완료')과 시간이 겹치면 승인 차단.
  const target = parseSlots(enr.slots);
  const { data: confirmed } = await admin
    .from("enrollments")
    .select("id, slots, status")
    .eq("teacher_id", enr.teacher_id)
    .in("status", ["승인", "결제대기", "결제완료"])
    .neq("id", enr.id);
  const ended = await loadEndedEnrollmentIds(admin, [enr.teacher_id]);
  const booked = ((confirmed ?? []) as { id: string; status: string; slots: unknown }[])
    .filter((r) => !(r.status === "결제완료" && ended.has(r.id)))
    .flatMap((r) => parseSlots(r.slots));
  if (slotsOverlap(target, booked)) {
    return { ok: false, error: "This time is already booked by another student. Decline this request and suggest a different time." };
  }

  const { data, error: updErr } = await admin.from("enrollments").update({ status: "결제대기" }).eq("id", enr.id).eq("status", "신청").select("id");
  if (updErr) return { ok: false, error: "Something went wrong. Please try again." };
  if (!data || data.length === 0) return { ok: false, error: "This request was already processed. Please refresh the list." };

  if (enr.student_phone) {
    try {
      await sendSms(
        enr.student_phone,
        `[프렌딩 스쿨] 수강신청이 승인되었습니다(결제 대기). ${enr.course_title} · 시작 ${enr.start_date}. 자세한 내용은 마이페이지에서 확인하세요.`,
      );
    } catch (err) {
      console.error("[centerApproveEnrollment] SMS 발송 실패:", err);
    }
  }

  try {
    const origin = getOrigin(await headers());
    await sendEnrollmentApprovedToAdmin(await getAdminEmails(), buildAdminMail(enr, origin, { withEnd: true }));
  } catch (err) {
    console.error("[centerApproveEnrollment] 관리자 알림 발송 실패:", err);
  }

  await logEnrollmentEvent(admin, {
    enrollmentId: enr.id,
    eventType: "enrollment_approved",
    actorId: input.actorId,
    actorRole: "center_manager",
    course: enr.course,
    courseTitle: enr.course_title,
    studentName: enr.student_name,
    teacherName: enr.teacher_name,
    detail: { from: "신청", to: "결제대기" },
  });

  return { ok: true };
}

export async function rejectEnrollmentAsCenterManager(
  admin: Admin,
  input: { enrollmentId: string; reason: string; actorId: string; allowedCenterIds: string[] },
): Promise<{ ok: boolean; error?: string }> {
  const reason = String(input.reason ?? "").trim();
  if (!reason) return { ok: false, error: "Please enter a reason for declining." };

  const { enr, error } = await loadManagedPending(admin, input.enrollmentId, input.allowedCenterIds);
  if (!enr) return { ok: false, error };

  const { data, error: updErr } = await admin
    .from("enrollments")
    .update({ status: "거절", teacher_note: reason.slice(0, 1000) })
    .eq("id", enr.id)
    .eq("status", "신청")
    .select("id");
  if (updErr) return { ok: false, error: "Something went wrong. Please try again." };
  if (!data || data.length === 0) return { ok: false, error: "This request was already processed. Please refresh the list." };

  if (enr.student_phone) {
    try {
      await sendSms(enr.student_phone, `[프렌딩 스쿨] 수강신청이 거절되었습니다. ${enr.course_title}. 사유: ${reason}`);
    } catch (err) {
      console.error("[centerRejectEnrollment] SMS 발송 실패:", err);
    }
  }

  try {
    const origin = getOrigin(await headers());
    await sendEnrollmentRejectedToAdmin(await getAdminEmails(), buildAdminMail(enr, origin, { reason }));
  } catch (err) {
    console.error("[centerRejectEnrollment] 관리자 알림 발송 실패:", err);
  }

  await logEnrollmentEvent(admin, {
    enrollmentId: enr.id,
    eventType: "enrollment_rejected",
    actorId: input.actorId,
    actorRole: "center_manager",
    course: enr.course,
    courseTitle: enr.course_title,
    studentName: enr.student_name,
    teacherName: enr.teacher_name,
    detail: { reason },
  });

  return { ok: true };
}
