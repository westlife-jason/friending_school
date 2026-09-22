import "server-only";

import { headers } from "next/headers";
import { createAdminClient, getAdminEmails } from "@/utils/supabase/admin";
import { sendSms } from "@/lib/sms";
import { sendClassCancellationToTeacher, sendClassPostponedByManagerToAdmin } from "@/lib/mailer";
import { getOrigin } from "@/lib/origin";
import { getCourse } from "@/data/courses";
import { fmtTime, lessonEndMin } from "@/lib/availability";
import { kstDateMinToMs } from "@/lib/classtime";
import { createMakeupClass, type ClassForMakeup } from "@/lib/makeup";
import { logEnrollmentEvent } from "@/lib/events";

type Admin = ReturnType<typeof createAdminClient>;

// 센터 매니저의 "강사 사정으로 수업 연기".
// 운영 현실: 필리핀 매니저가 강사와 조율해 "이 수업은 연기하자"로 결론이 나도, 지금까지는 연기 권한이 관리자(한국 측)에게만
// 있어 다시 요청해야 했다. 관리자 연기(admin/actions.ts adminCancelClass)의 reason='company'와 같은 규칙으로 처리한다 —
// 학생의 연기 횟수는 차감하지 않고(회사 사유), 과정 마지막 수업 다음에 보강 1회를 자동 생성한다.
// ⚠️ 원본 수정 권한이 생기면 adminCancelClass와 하나의 공유 코어로 합칠 것.
//    관리자에게는 별도 메일 템플릿(sendClassPostponedByManagerToAdmin)을 보낸다 — 학생 연기용 템플릿
//    (sendClassPostponedToAdmin)은 "학생이 연기했다"고 못 박은 문구라 그대로 쓰면 사실과 다르다.

const CLASS_SELECT =
  "id, enrollment_id, student_id, teacher_id, course, course_title, course_english_title, teacher_name, student_name, student_english_name, session_no, session_date, start_min, end_min, status, is_makeup, conducted_at, conducted_override";

type ClassRow = ClassForMakeup & {
  id: string;
  course_english_title: string | null;
  session_no: number;
  status: string;
  is_makeup: boolean | null;
  conducted_at: string | null;
  conducted_override: boolean | null;
};

export async function postponeClassAsCenterManager(
  admin: Admin,
  input: { classId: string; actorId: string; allowedCenterIds: string[] },
): Promise<{ ok: boolean; error?: string; makeupDate?: string }> {
  const id = String(input.classId ?? "").trim();
  if (!id) return { ok: false, error: "Invalid request." };

  const { data } = await admin.from("classes").select(CLASS_SELECT).eq("id", id).maybeSingle();
  const cls = data as ClassRow | null;
  if (!cls) return { ok: false, error: "Class not found. Please refresh." };

  const { data: prof } = await admin.from("profiles").select("role, center_id").eq("id", cls.teacher_id).maybeSingle();
  const p = prof as { role?: string; center_id?: string | null } | null;
  if (p?.role !== "teacher" || !p.center_id || !input.allowedCenterIds.includes(p.center_id)) {
    return { ok: false, error: "You don't have permission to postpone this class." };
  }

  if (cls.status !== "예정") return { ok: false, error: "This class was already handled. Please refresh." };
  if ((cls.conducted_override ?? !!cls.conducted_at) === true) return { ok: false, error: "A completed class can't be postponed." };
  // 시작 전 수업만 — 진행 중이거나 지난 수업의 사후 처리는 관리자 몫이다.
  if (Date.now() >= kstDateMinToMs(cls.session_date, cls.start_min)) {
    return { ok: false, error: "Only upcoming classes can be postponed. Contact the admin for classes that already started." };
  }

  const { data: updated, error: updErr } = await admin
    .from("classes")
    .update({ status: "취소", cancel_reason: "company" })
    .eq("id", cls.id)
    .eq("status", "예정")
    .select("id");
  if (updErr) return { ok: false, error: "Something went wrong. Please try again." };
  if (!updated || updated.length === 0) return { ok: false, error: "This class was already handled. Please refresh." };

  const makeupDate = await createMakeupClass(admin, cls);
  const sessionTime = `${fmtTime(cls.start_min)}~${fmtTime(lessonEndMin(cls.end_min))}`;

  const { data: actor } = await admin.from("profiles").select("first_name, last_name").eq("id", input.actorId).maybeSingle();
  const a = actor as { first_name?: string | null; last_name?: string | null } | null;
  const managerName = [a?.first_name, a?.last_name].filter(Boolean).join(" ").trim() || undefined;

  // 학생 SMS(best-effort) — 강사 대체와 같은 방식. 보강 날짜가 정해졌으면 함께 알린다.
  try {
    const { data: enr } = await admin.from("enrollments").select("student_phone").eq("id", cls.enrollment_id).maybeSingle();
    const phone = (enr as { student_phone?: string | null } | null)?.student_phone;
    if (phone) {
      await sendSms(
        phone,
        `[프렌딩 스쿨] ${cls.session_date} ${sessionTime} ${cls.course_title} 수업이 강사 사정으로 연기되었습니다. ${
          makeupDate ? `보강 수업: ${makeupDate} ${sessionTime}.` : "보강 일정은 별도로 안내드립니다."
        } 자세한 내용은 마이페이지(내 강의실)에서 확인하세요.`,
      );
    }
  } catch (err) {
    console.error("[postponeClassAsCenterManager] 학생 SMS 발송 실패:", err);
  }

  // 강사 알림 메일(best-effort) — 관리자 연기와 같은 메일러.
  try {
    const { data: teacherUser } = await admin.auth.admin.getUserById(cls.teacher_id);
    const teacherEmail = teacherUser?.user?.email;
    if (teacherEmail) {
      await sendClassCancellationToTeacher([teacherEmail], {
        studentName: cls.student_english_name || cls.student_name || "Student",
        courseTitle: cls.course_title,
        sessionDate: cls.session_date,
        sessionTime,
        makeupDate,
      });
    }
  } catch (err) {
    console.error("[postponeClassAsCenterManager] 강사 알림 발송 실패:", err);
  }

  // 관리자 알림 메일(best-effort) — 관리자 본인이 처리하는 회사 사유 연기와 달리, 이건 센터 매니저가
  // 처리하는 일이라 관리자가 실시간으로 알지 못한다. 프렌딩 스쿨 매니저 요청으로 추가.
  try {
    const origin = getOrigin(await headers());
    await sendClassPostponedByManagerToAdmin(await getAdminEmails(), {
      studentName: cls.student_name ?? "",
      studentEnglishName: cls.student_english_name ?? undefined,
      courseTitle: cls.course_title,
      courseEnglishTitle: getCourse(cls.course)?.englishTitle ?? cls.course_english_title ?? undefined,
      teacherName: cls.teacher_name ?? "",
      managerName,
      sessionDate: cls.session_date,
      sessionTime,
      sessionNo: cls.session_no,
      makeupDate,
      adminUrl: `${origin}/admin/classes`,
    });
  } catch (err) {
    console.error("[postponeClassAsCenterManager] 관리자 알림 발송 실패:", err);
  }

  await logEnrollmentEvent(admin, {
    enrollmentId: cls.enrollment_id,
    classId: cls.id,
    eventType: "class_postponed",
    actorId: input.actorId,
    actorName: managerName,
    actorRole: "center_manager",
    course: cls.course,
    courseTitle: cls.course_title,
    studentName: cls.student_name,
    teacherName: cls.teacher_name,
    detail: { reason: "company", sessionNo: cls.session_no, sessionDate: cls.session_date, makeupDate: makeupDate ?? null },
  });

  return { ok: true, makeupDate };
}
