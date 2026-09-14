import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { kstDateMinToMs } from "@/lib/classtime";
import { seatHeld } from "@/lib/room-time";
import RoomsManager, { type FrienderRoom, type PrepCourseOption } from "@/components/friender/RoomsManager";

export default async function FrienderRoomsPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/friender/rooms");

  // ⚠️ 소유권은 쿼리에서 강제한다 — RLS에 기대면 안 된다.
  //    friender_rooms에는 SELECT 정책이 둘(`_select_own`, `_select_public`)이고 permissive 정책은 OR로 합쳐지는데,
  //    `_select_public`이 is_visible 폐지(20260820220759) 이후 `using (true)`가 되어 로그인 사용자에게 전 방이 열린다.
  //    실제로 이 필터가 없던 동안 남의 방이 관리 목록에 섞여 나왔다.
  const { data } = await supabase
    .from("friender_rooms")
    .select(
      "id, title, description, level, capacity, session_date, start_min, duration_min, access_type, linked_prep_course_id, recurrence_days, recurrence_until",
    )
    .eq("friender_id", user.id)
    .order("session_date", { ascending: false })
    .order("start_min", { ascending: false });

  type BaseRoom = Omit<FrienderRoom, "participants" | "noShows" | "session_date"> & { session_date: string };
  const rows = (data ?? []) as BaseRoom[];

  // 이 화면은 시리즈(방) 단위 목록이다 — 실제 참여 가능한 날짜는 friender_room_occurrences에
  // 따로 있으므로, 목록에 보여줄 "대표 날짜"(다음 예정 회차, 없으면 마지막 회차)와 자가입장 대상
  // 회차 id를 여기서 계산해 시리즈 첫 날짜(session_date)를 그대로 쓰지 않게 한다.
  const now = Date.now();
  const countByRoom = new Map<string, number>();
  const noShowByRoom = new Map<string, number>();
  const displayDateByRoom = new Map<string, string>();
  const enterOccurrenceByRoom = new Map<string, string>();

  if (rows.length > 0) {
    const admin = createAdminClient();
    const roomById = new Map(rows.map((r) => [r.id, r]));

    const { data: occs } = await admin
      .from("friender_room_occurrences")
      .select("id, room_id, occurrence_date")
      .in(
        "room_id",
        rows.map((r) => r.id),
      );
    const occurrenceInfo = new Map(((occs ?? []) as { id: string; room_id: string; occurrence_date: string }[]).map((o) => [o.id, o]));

    // 방마다 회차를 날짜순으로 모아 "다음 회차"(끝나지 않은 것 중 가장 이른 날)를 뽑는다.
    const occByRoom = new Map<string, { id: string; occurrence_date: string }[]>();
    for (const o of Array.from(occurrenceInfo.values())) {
      const list = occByRoom.get(o.room_id) ?? [];
      list.push(o);
      occByRoom.set(o.room_id, list);
    }
    for (const [roomId, list] of Array.from(occByRoom)) {
      const room = roomById.get(roomId);
      if (!room) continue;
      list.sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date));
      const next = list.find((o) => kstDateMinToMs(o.occurrence_date, room.start_min + room.duration_min) > now);
      const chosen = next ?? list[list.length - 1];
      if (chosen) {
        displayDateByRoom.set(roomId, chosen.occurrence_date);
        if (next) enterOccurrenceByRoom.set(roomId, next.id);
      }
    }

    // 예약 인원 — 참가자 RLS는 select_own뿐이라 개설자도 자기 방 참가자를 세션 client로 못 읽는다.
    // 카운트만 필요하므로 service_role로 집계한다(신원은 노출하지 않음, 프렌딩 홈(/)과 동일 방식).
    // ⚠️ 시리즈 단위 목록이라 참가자 수는 그 시리즈의 모든 회차 합산이다(특정 날짜 인원이 아니다).
    //    노쇼 판정은 회차마다 실제 날짜가 달라 occurrence_id로 그 회차의 진짜 날짜를 찾아야 한다.
    const { data: parts } = await admin
      .from("friender_room_participants")
      .select("room_id, occurrence_id, entered_at")
      .in(
        "room_id",
        rows.map((r) => r.id),
      );
    for (const p of (parts ?? []) as { room_id: string; occurrence_id: string; entered_at: string | null }[]) {
      const occ = occurrenceInfo.get(p.occurrence_id);
      const room = roomById.get(p.room_id);
      if (!occ || !room) continue;
      const startMs = kstDateMinToMs(occ.occurrence_date, room.start_min);
      const target = seatHeld(p.entered_at, startMs, now) ? countByRoom : noShowByRoom;
      target.set(p.room_id, (target.get(p.room_id) ?? 0) + 1);
    }
  }

  const rooms: FrienderRoom[] = rows.map((r) => ({
    ...r,
    // 대표 날짜 — 목록 정렬·예정/지난 분류에 이 값을 쓴다(반복방은 첫 날짜가 지나도 다음 회차가 남아있을 수 있다).
    session_date: displayDateByRoom.get(r.id) ?? r.session_date,
    participants: countByRoom.get(r.id) ?? 0,
    noShows: noShowByRoom.get(r.id) ?? 0,
    enterOccurrenceId: enterOccurrenceByRoom.get(r.id) ?? null,
  }));

  // 방 입장은 개설자의 zoom_url로 연결되므로 미등록이면 개설을 막는다(서버 액션도 동일 가드).
  const { data: prof } = await supabase.from("profiles").select("zoom_url").eq("id", user.id).maybeSingle();
  const hasZoomUrl = !!(prof as { zoom_url?: string | null } | null)?.zoom_url?.trim();

  // 방을 연결할 수 있는 강좌 목록 — 본인이 개설해 승인된 것만(폼의 select 옵션용).
  const { data: coursesData } = await supabase.from("prep_courses").select("id, title").eq("friender_id", user.id).eq("status", "승인");
  const prepCourses: PrepCourseOption[] = (coursesData ?? []) as PrepCourseOption[];

  return <RoomsManager rooms={rooms} hasZoomUrl={hasZoomUrl} prepCourses={prepCourses} />;
}
