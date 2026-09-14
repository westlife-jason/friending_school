import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { kstDateMinToMs } from "@/lib/classtime";
import { seatHeld } from "@/lib/room-time";
import type { HostProfile } from "@/components/friending/FriendingRooms";
import MyRoomReservations, { type ReservedRoom } from "@/components/mypage/MyRoomReservations";

type RoomEmbed = {
  id: string;
  friender_id: string;
  friender_name: string | null;
  friender_nickname: string | null;
  title: string;
  description: string | null;
  level: string;
  capacity: number;
  start_min: number;
  duration_min: number;
};

type OccurrenceEmbed = {
  occurrence_date: string;
  friender_rooms: RoomEmbed | RoomEmbed[] | null;
};

type ProfileRow = {
  id: string;
  avatar_url: string | null;
  nickname: string | null;
  first_name: string | null;
  last_name: string | null;
  bio: string | null;
  nationality: string | null;
  gender: string | null;
};

const ROOM_COLUMNS = "id, friender_id, friender_name, friender_nickname, title, description, level, capacity, start_min, duration_min";

// ⚠️ 4탭 리뉴얼 4단계(반복모임)부터 이 화면은 "방(room)"이 아니라 "회차(occurrence)" 단위로 예약을 다룬다.
//    1회성 방은 회차가 하나뿐이라 체감 동작은 이전과 동일하고, 반복방은 회차마다 예약·입장·후기가 갈린다.
export default async function MyPageRooms() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/mypage/rooms");

  // 내 예약 — RLS friender_room_participants_select_own + friender_room_occurrences_select_public
  // + friender_rooms_select_public(중첩 임베드).
  const { data } = await supabase
    .from("friender_room_participants")
    .select(`occurrence_id, entered_at, friender_room_occurrences(occurrence_date, friender_rooms(${ROOM_COLUMNS}))`)
    .eq("user_id", user.id);

  // ⚠️ 임베드 결과는 many-to-one이라 런타임에 객체로 오지만, 타입 추론(untyped client)은 배열로 본다.
  //    두 단계(회차→방) 모두 양쪽을 받아 넘긴다.
  const rows = (
    (data ?? []) as unknown as {
      occurrence_id: string;
      entered_at: string | null;
      friender_room_occurrences: OccurrenceEmbed | OccurrenceEmbed[] | null;
    }[]
  )
    .map((p) => {
      const occ = Array.isArray(p.friender_room_occurrences) ? p.friender_room_occurrences[0] : p.friender_room_occurrences;
      const room = occ ? (Array.isArray(occ.friender_rooms) ? occ.friender_rooms[0] : occ.friender_rooms) : null;
      return occ && room ? { occurrenceId: p.occurrence_id, occurrenceDate: occ.occurrence_date, room, entered_at: p.entered_at } : null;
    })
    .filter((r): r is { occurrenceId: string; occurrenceDate: string; room: RoomEmbed; entered_at: string | null } => !!r)
    // 임베드 컬럼은 PostgREST로 정렬할 수 없어 여기서 정렬한다(가까운 순).
    .sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate) || a.room.start_min - b.room.start_min);

  // 참여 인원 카운트 + 개설자 프로필은 프렌딩 홈(src/app/page.tsx)와 같은 이유로 service_role로 읽는다
  // (참가자 RLS는 select_own뿐, profiles RLS는 본인 row만). 반복방의 각 날짜가 독립적으로 차야 하므로
  // 회차(occurrence_id) 단위로 집계한다.
  const now = Date.now();
  const countByOccurrence = new Map<string, number>();
  const hosts: Record<string, HostProfile> = {};
  if (rows.length > 0) {
    const admin = createAdminClient();
    const occurrenceIds = rows.map((r) => r.occurrenceId);

    const { data: parts } = await admin.from("friender_room_participants").select("occurrence_id, entered_at").in("occurrence_id", occurrenceIds);
    // 노쇼(시작 + 유예까지 미입장)는 자리를 반환한 것으로 보고 카운트에서 뺀다.
    const startMsByOccurrence = new Map(rows.map((r) => [r.occurrenceId, kstDateMinToMs(r.occurrenceDate, r.room.start_min)]));
    for (const p of (parts ?? []) as { occurrence_id: string; entered_at: string | null }[]) {
      if (!seatHeld(p.entered_at, startMsByOccurrence.get(p.occurrence_id) ?? 0, now)) continue;
      countByOccurrence.set(p.occurrence_id, (countByOccurrence.get(p.occurrence_id) ?? 0) + 1);
    }

    // ⚠️ email·phone·zoom_url은 select하지 않는다 — zoom_url은 방 입장의 사실상 열쇠라
    //    HTML 페이로드에 실리면 안 된다(프렌딩 홈(/)과 동일 정책).
    const { data: profs } = await admin
      .from("profiles")
      .select("id, avatar_url, nickname, first_name, last_name, bio, nationality, gender")
      .in("id", Array.from(new Set(rows.map((r) => r.room.friender_id))));
    for (const p of (profs ?? []) as ProfileRow[]) {
      hosts[p.id] = {
        name: p.nickname?.trim() || `${p.last_name ?? ""}${p.first_name ?? ""}`.trim() || "프렌더",
        realName: `${p.last_name ?? ""}${p.first_name ?? ""}`.trim() || null,
        avatarUrl: p.avatar_url?.trim() || null,
        nationality: p.nationality,
        gender: p.gender,
        bio: p.bio,
      };
    }
  }

  // 내가 쓴 후기 — RLS friender_room_reviews_select_own(작성자 본인). 반복방은 회차마다 후기가
  // 갈리므로(occurrence_id,user_id) unique) room_id가 아니라 occurrence_id로 맵을 만든다.
  const reviewByOccurrence = new Map<string, { rating: number; comment: string }>();
  if (rows.length > 0) {
    const { data: reviews } = await supabase.from("friender_room_reviews").select("occurrence_id, rating, comment").eq("user_id", user.id);
    for (const rv of (reviews ?? []) as { occurrence_id: string | null; rating: number; comment: string | null }[]) {
      if (rv.occurrence_id) reviewByOccurrence.set(rv.occurrence_id, { rating: rv.rating, comment: rv.comment ?? "" });
    }
  }

  const reservations: ReservedRoom[] = rows.map((r) => ({
    id: r.occurrenceId,
    frienderId: r.room.friender_id,
    fallbackName: r.room.friender_nickname?.trim() || r.room.friender_name?.trim() || "프렌더",
    title: r.room.title,
    description: r.room.description,
    level: r.room.level,
    capacity: r.room.capacity,
    sessionDate: r.occurrenceDate,
    startMin: r.room.start_min,
    durationMin: r.room.duration_min,
    participants: countByOccurrence.get(r.occurrenceId) ?? 0,
    enteredAt: r.entered_at,
    review: reviewByOccurrence.get(r.occurrenceId) ?? null,
  }));

  return <MyRoomReservations rooms={reservations} hosts={hosts} />;
}
