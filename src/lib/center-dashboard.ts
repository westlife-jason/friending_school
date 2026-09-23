import "server-only";

import { createAdminClient } from "@/utils/supabase/admin";
import { todayKst, loadBookedSlotsByTeacher } from "@/lib/booking";
import { kstDateMinToMs } from "@/lib/classtime";
import { subtractSlots, type Slot } from "@/lib/availability";
import { addDaysStr } from "@/lib/makeup";

type Admin = ReturnType<typeof createAdminClient>;

// 강사·수업 운영 대시보드 — 민수 피드백(2026-09-23) 3분류를 그대로 반영한다:
// ① 개요(강사 수·진행 중인 과정 수) ② 슬롯 관리(빈 시간대·오늘 수업·다음 7일 예정) ③ 출석 관리(오늘 강사 출근·수업별 상태).
// 전부 기존 데이터(teacher_availability, enrollments, classes.teacher_entered_at/conducted_at)에서
// 파생한다 — 새 테이블 없음. "출근"은 하루 단위 체크인이 아니라 "오늘 자기 수업에 입장했는가"로 본다
// (교사가 학생과의 화상수업에 들어가는 것 자체가 그날의 근무 시작이라는 이 서비스의 구조에 맞다).
//
// centerIds=null이면 전체(관리자용, 센터 무관 강사 포함) — 센터 매니저는 자기 담당 센터 배열을 넘긴다.

export type TodayClassStatus = "conducted" | "checked_in" | "late" | "waiting" | "overdue";

export type TodayClassRow = {
  id: string;
  teacherId: string;
  teacherName: string;
  centerName: string | null;
  studentName: string;
  startMin: number;
  endMin: number;
  status: TodayClassStatus;
};

export type CenterDashboard = {
  teacherCount: number;
  activeCourseCount: number;
  emptySlotCount: number;
  todayClassCount: number;
  upcomingWeekClassCount: number;
  todayConductedCount: number;
  todayOverdueCount: number;
  teachersWithClassTodayCount: number;
  teachersCheckedInTodayCount: number;
  todayClasses: TodayClassRow[];
};

export const EMPTY_CENTER_DASHBOARD: CenterDashboard = {
  teacherCount: 0,
  activeCourseCount: 0,
  emptySlotCount: 0,
  todayClassCount: 0,
  upcomingWeekClassCount: 0,
  todayConductedCount: 0,
  todayOverdueCount: 0,
  teachersWithClassTodayCount: 0,
  teachersCheckedInTodayCount: 0,
  todayClasses: [],
};

function statusOf(now: number, startMs: number, endMs: number, enteredAt: string | null, conducted: boolean): TodayClassStatus {
  if (conducted) return "conducted";
  if (now > endMs) return "overdue"; // 지났는데 표시 안 된 것 — 강사가 처리해야 함
  if (enteredAt) return "checked_in"; // 이미 입장(=출근) — 시작 전이어도 대기 중인 상태 포함
  if (now >= startMs) return "late"; // 시작했는데 아직 미입장
  return "waiting"; // 아직 시작 전, 정상 대기
}

export async function loadCenterDashboard(admin: Admin, centerIds: string[] | null): Promise<CenterDashboard> {
  if (centerIds !== null && centerIds.length === 0) return EMPTY_CENTER_DASHBOARD;

  let teacherQuery = admin.from("profiles").select("id, center_id").eq("role", "teacher");
  if (centerIds !== null) teacherQuery = teacherQuery.in("center_id", centerIds);
  const { data: teacherRows } = await teacherQuery;
  const teachers = (teacherRows ?? []) as { id: string; center_id: string | null }[];
  const teacherIds = teachers.map((t) => t.id);
  if (teacherIds.length === 0) return EMPTY_CENTER_DASHBOARD;

  // 센터 이름 — 관리자(전체) 화면이나 센터를 2곳 이상 담당하는 매니저는 오늘 수업이 어느 센터
  // 소속인지 구분해서 봐야 한다.
  const usedCenterIds = Array.from(new Set(teachers.map((t) => t.center_id).filter((id): id is string => !!id)));
  const centerNameById = new Map<string, string>();
  if (usedCenterIds.length > 0) {
    const { data: centerRows } = await admin.from("centers").select("id, name").in("id", usedCenterIds);
    for (const c of (centerRows ?? []) as { id: string; name: string }[]) centerNameById.set(c.id, c.name);
  }
  const centerNameByTeacher = new Map(teachers.map((t) => [t.id, t.center_id ? (centerNameById.get(t.center_id) ?? null) : null]));

  const today = todayKst();
  const now = Date.now();
  // 다음 7일(오늘 제외) — "예정 수업"을 전체 미래로 잡으면 24회차 과정들 때문에 숫자가 계속 불어나
  // 관리자가 참고할 수 없는 값이 된다. 실무에서 바로 쓸 수 있는 창(1주)으로 제한한다.
  const weekAhead = addDaysStr(today, 7);

  const [activeCourseRes, todayRows, upcomingCountRes, availRows, bookedByTeacher] = await Promise.all([
    admin.from("enrollments").select("id", { count: "exact", head: true }).eq("status", "결제완료").in("teacher_id", teacherIds),
    admin
      .from("classes")
      .select(
        "id, teacher_id, teacher_name, student_name, student_english_name, start_min, end_min, teacher_entered_at, conducted_at, conducted_override",
      )
      .eq("session_date", today)
      .eq("status", "예정")
      .in("teacher_id", teacherIds)
      .order("start_min", { ascending: true }),
    admin
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("status", "예정")
      .gt("session_date", today)
      .lte("session_date", weekAhead)
      .in("teacher_id", teacherIds),
    admin.from("teacher_availability").select("teacher_id, day_of_week, start_min").in("teacher_id", teacherIds),
    loadBookedSlotsByTeacher(admin, teacherIds),
  ]);

  const availByTeacher = new Map<string, Slot[]>();
  for (const a of (availRows.data ?? []) as { teacher_id: string; day_of_week: number; start_min: number }[]) {
    const list = availByTeacher.get(a.teacher_id) ?? [];
    list.push({ day: a.day_of_week, min: a.start_min });
    availByTeacher.set(a.teacher_id, list);
  }
  let emptySlotCount = 0;
  for (const id of teacherIds) emptySlotCount += subtractSlots(availByTeacher.get(id) ?? [], bookedByTeacher.get(id) ?? []).length;

  type TodayRow = {
    id: string;
    teacher_id: string;
    teacher_name: string | null;
    student_name: string | null;
    student_english_name: string | null;
    start_min: number;
    end_min: number;
    teacher_entered_at: string | null;
    conducted_at: string | null;
    conducted_override: boolean | null;
  };
  const rows = (todayRows.data ?? []) as TodayRow[];

  const todayClasses: TodayClassRow[] = rows.map((r) => {
    const startMs = kstDateMinToMs(today, r.start_min);
    const endMs = kstDateMinToMs(today, r.end_min);
    const conducted = (r.conducted_override ?? !!r.conducted_at) === true;
    return {
      id: r.id,
      teacherId: r.teacher_id,
      teacherName: r.teacher_name ?? "Teacher",
      centerName: centerNameByTeacher.get(r.teacher_id) ?? null,
      studentName: r.student_english_name?.trim() || r.student_name?.trim() || "Student",
      startMin: r.start_min,
      endMin: r.end_min,
      status: statusOf(now, startMs, endMs, r.teacher_entered_at, conducted),
    };
  });

  const teachersWithClassToday = new Set(todayClasses.map((c) => c.teacherId));
  const teachersCheckedIn = new Set(todayClasses.filter((c) => c.status === "checked_in" || c.status === "conducted").map((c) => c.teacherId));

  return {
    teacherCount: teacherIds.length,
    activeCourseCount: activeCourseRes.count ?? 0,
    emptySlotCount,
    todayClassCount: todayClasses.length,
    upcomingWeekClassCount: upcomingCountRes.count ?? 0,
    todayConductedCount: todayClasses.filter((c) => c.status === "conducted").length,
    todayOverdueCount: todayClasses.filter((c) => c.status === "overdue").length,
    teachersWithClassTodayCount: teachersWithClassToday.size,
    teachersCheckedInTodayCount: teachersCheckedIn.size,
    todayClasses,
  };
}
