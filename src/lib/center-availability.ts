import "server-only";

import { createAdminClient } from "@/utils/supabase/admin";
import { loadBookedSlotsByTeacher, loadTeacherBookedSlots } from "@/lib/booking";
import { slotKey, subtractSlots, summarizeSlots, type Slot } from "@/lib/availability";

type Admin = ReturnType<typeof createAdminClient>;

export type AvailabilityTeacher = {
  id: string;
  name: string;
  avatarUrl: string | null;
  centerId: string | null;
  centerName: string | null;
  slots: Slot[];
  // 진행 중 수강신청이 걸린 슬롯 — 매니저가 해제할 수 없다(서버가 다시 검증한다).
  bookedSlots: Slot[];
};

// 센터 매니저의 "가용시간 대리 입력" 화면용 — 담당 센터 소속 강사와 그 가용시간·예약 슬롯.
// 강사가 가용시간 화면을 쓰지 않는 운영 현실 때문에 매니저가 입력 주체가 된다.
export async function loadAvailabilityTeachers(admin: Admin, centerIds: string[]): Promise<AvailabilityTeacher[]> {
  if (centerIds.length === 0) return [];

  const { data: profs } = await admin
    .from("profiles")
    .select("id, first_name, last_name, avatar_url, center_id")
    .eq("role", "teacher")
    .in("center_id", centerIds);
  const teachers = (profs ?? []) as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    center_id: string | null;
  }[];
  if (teachers.length === 0) return [];
  const ids = teachers.map((t) => t.id);

  const { data: centers } = await admin.from("centers").select("id, name").in("id", centerIds);
  const centerName = new Map(((centers ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));

  const slotsByTeacher = new Map<string, Slot[]>();
  const { data: rows } = await admin.from("teacher_availability").select("teacher_id, day_of_week, start_min").in("teacher_id", ids);
  for (const r of (rows ?? []) as { teacher_id: string; day_of_week: number; start_min: number }[]) {
    const list = slotsByTeacher.get(r.teacher_id) ?? [];
    list.push({ day: r.day_of_week, min: r.start_min });
    slotsByTeacher.set(r.teacher_id, list);
  }

  const booked = await loadBookedSlotsByTeacher(admin, ids);

  return teachers
    .map((t) => ({
      id: t.id,
      // 센터 매니저 화면은 영문(first last) 이름 순서 — 다른 /center 화면과 동일.
      name: [t.first_name, t.last_name].filter(Boolean).join(" ").trim() || "Teacher",
      avatarUrl: t.avatar_url,
      centerId: t.center_id,
      centerName: t.center_id ? (centerName.get(t.center_id) ?? null) : null,
      slots: slotsByTeacher.get(t.id) ?? [],
      bookedSlots: booked.get(t.id) ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// 매니저가 강사의 주간 가용시간을 저장한다. allowedCenterIds 밖 강사는 거부(다른 센터 강사를 못 건드린다).
// ⚠️ 검증 규칙은 강사 본인 저장(teacher/actions.ts updateTeacherAvailability)과 같다 —
//    특히 진행 중 수강신청이 걸린 슬롯은 해제할 수 없다. 다만 여기서는 전체 삭제 후 재삽입이 아니라
//    바뀐 슬롯만 지우고 넣어서, 중간에 실패해도 기존 가용시간이 통째로 사라지지 않게 했다.
export async function saveAvailabilityForCenterTeacher(
  admin: Admin,
  input: { teacherId: string; slots: Slot[]; allowedCenterIds: string[] },
): Promise<{ ok: boolean; error?: string }> {
  const teacherId = String(input.teacherId ?? "").trim();
  if (!teacherId || !Array.isArray(input.slots) || input.slots.length > 7 * 48) return { ok: false, error: "Invalid request." };

  const { data: prof } = await admin.from("profiles").select("role, center_id").eq("id", teacherId).maybeSingle();
  const p = prof as { role?: string; center_id?: string | null } | null;
  if (p?.role !== "teacher" || !p.center_id || !input.allowedCenterIds.includes(p.center_id)) {
    return { ok: false, error: "You don't have permission to edit this teacher." };
  }

  const wanted = new Map<string, Slot>();
  for (const s of input.slots) {
    const day = Number(s?.day);
    const min = Number(s?.min);
    if (!Number.isInteger(day) || day < 0 || day > 6) return { ok: false, error: "Invalid request." };
    if (!Number.isInteger(min) || min < 0 || min > 1439 || min % 30 !== 0) return { ok: false, error: "Invalid request." };
    wanted.set(slotKey(day, min), { day, min });
  }
  const next = Array.from(wanted.values());

  const booked = await loadTeacherBookedSlots(admin, teacherId);
  const missing = subtractSlots(
    booked.map(({ day, min }) => ({ day, min })),
    next,
  );
  if (missing.length > 0) {
    return { ok: false, error: `Booked slots can't be removed: ${summarizeSlots(missing, false, " / ")}. Decline or reassign the enrollment first.` };
  }

  const { data: existingRows, error: readErr } = await admin
    .from("teacher_availability")
    .select("day_of_week, start_min")
    .eq("teacher_id", teacherId);
  if (readErr) return { ok: false, error: "Something went wrong while saving." };
  const existing = new Map<string, Slot>();
  for (const r of (existingRows ?? []) as { day_of_week: number; start_min: number }[]) {
    existing.set(slotKey(r.day_of_week, r.start_min), { day: r.day_of_week, min: r.start_min });
  }

  const toInsert = next.filter((s) => !existing.has(slotKey(s.day, s.min)));
  const toDelete = Array.from(existing.values()).filter((s) => !wanted.has(slotKey(s.day, s.min)));

  // 요일별로 묶어 삭제 — start_min in (...) 한 번으로 그 요일의 해제 슬롯을 지운다.
  const deleteByDay = new Map<number, number[]>();
  for (const s of toDelete) deleteByDay.set(s.day, [...(deleteByDay.get(s.day) ?? []), s.min]);
  for (const [day, mins] of Array.from(deleteByDay.entries())) {
    const { error } = await admin.from("teacher_availability").delete().eq("teacher_id", teacherId).eq("day_of_week", day).in("start_min", mins);
    if (error) return { ok: false, error: "Something went wrong while saving." };
  }

  if (toInsert.length > 0) {
    const { error } = await admin
      .from("teacher_availability")
      .insert(toInsert.map((s) => ({ teacher_id: teacherId, day_of_week: s.day, start_min: s.min })));
    if (error) return { ok: false, error: "Something went wrong while saving." };
  }

  return { ok: true };
}
