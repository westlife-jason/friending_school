import Image from "next/image";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { todayKst } from "@/lib/booking";
import { kstDateMinToMs } from "@/lib/classtime";
import { seatHeld } from "@/lib/room-time";
import SuccessBanner from "@/components/SuccessBanner";
import HeroBubbles from "@/components/HeroBubbles";
import FriendingRooms, { type HostProfile, type PublicRoom } from "@/components/friending/FriendingRooms";

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
  access_type: "public" | "shouting_only";
  recurrence_days: number[] | null;
};

type OccurrenceRow = {
  id: string; // friender_room_occurrences.id — join/leave/enter/후기가 여기 키로 동작한다.
  occurrence_date: string;
  friender_rooms: RoomEmbed | RoomEmbed[] | null; // many-to-one 임베드(런타임=객체, untyped 타입 추론=배열)
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

// 프렌딩 홈 — 4탭 리뉴얼 3단계로 샤우팅 수강신청 배너는 /shouting 독립 페이지로 옮겼다.
// 이 페이지는 이제 무료 연습방(FriendingRooms) 목록 전용이다.
export default async function Home({ searchParams }: { searchParams: Promise<{ reset?: string; verified?: string; signup?: string }> }) {
  // 비밀번호 재설정·이메일 인증 완료는 `/?reset=success`·`/?verified=success`로 돌아온다
  // (reset-password/actions.ts · AuthHashHandler) — 배너는 홈이 소유한다.
  const { reset, verified, signup } = await searchParams;
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 공개 조회 — friender_room_occurrences_select_public + friender_rooms_select_public(임베드)이
  // 둘 다 anon에도 열려 있다. 회차(occurrence) 단위로 조회해야 반복방이 날짜마다 카드로 갈린다.
  const { data } = await supabase
    .from("friender_room_occurrences")
    .select(
      "id, occurrence_date, friender_rooms(id, friender_id, friender_name, friender_nickname, title, description, level, capacity, start_min, duration_min, access_type, recurrence_days)",
    )
    .gte("occurrence_date", todayKst());

  // 오늘이지만 이미 끝난 회차는 SQL로 못 거른다(날짜 단위 필터) → 종료 시각 기준 JS 필터.
  // 임베드 room이 비어 있으면(드묾 — FK cascade라 정상 흐름에선 없다) 함께 걸러낸다.
  const now = Date.now();
  const rows = ((data ?? []) as unknown as OccurrenceRow[])
    .map((o) => {
      const room = Array.isArray(o.friender_rooms) ? o.friender_rooms[0] : o.friender_rooms;
      return room ? { occurrenceId: o.id, occurrenceDate: o.occurrence_date, room } : null;
    })
    .filter((r): r is { occurrenceId: string; occurrenceDate: string; room: RoomEmbed } => !!r)
    .filter((r) => kstDateMinToMs(r.occurrenceDate, r.room.start_min + r.room.duration_min) > now)
    .sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate) || a.room.start_min - b.room.start_min);

  // 참여 인원 집계 — 참가자 RLS는 select_own뿐이라 카운트는 service_role로 센다
  // (참가자 신원은 공개하지 않고 숫자만 노출). 회차 단위로 세야 반복방의 각 날짜가 독립적으로 찬다.
  const countByOccurrence = new Map<string, number>();
  // 개설자 프로필 — profiles_select_own RLS로 공개 조회가 막혀 있어 service_role로 읽는다.
  // 스냅샷 컬럼을 두지 않고 매 요청 조회하는 이유: ① 사진·소개 수정이 즉시 반영돼야 하고
  // ② cleanupOldAvatars가 옛 파일을 지워 스냅샷 avatar URL은 깨진다.
  // 방마다 중복 직렬화되지 않도록 friender_id 기준 맵으로 모아 별도 prop으로 넘긴다.
  const hosts: Record<string, HostProfile> = {};
  if (rows.length > 0) {
    const admin = createAdminClient();

    const { data: parts } = await admin
      .from("friender_room_participants")
      .select("occurrence_id, entered_at")
      .in(
        "occurrence_id",
        rows.map((r) => r.occurrenceId),
      );
    // 노쇼(시작 + 유예까지 미입장)는 자리를 반환한 것으로 보고 카운트에서 뺀다.
    const startMsByOccurrence = new Map(rows.map((r) => [r.occurrenceId, kstDateMinToMs(r.occurrenceDate, r.room.start_min)]));
    for (const p of (parts ?? []) as { occurrence_id: string; entered_at: string | null }[]) {
      if (!seatHeld(p.entered_at, startMsByOccurrence.get(p.occurrence_id) ?? 0, now)) continue;
      countByOccurrence.set(p.occurrence_id, (countByOccurrence.get(p.occurrence_id) ?? 0) + 1);
    }

    // ⚠️ email·phone·zoom_url은 의도적으로 select하지 않는다 — 공개 페이지라
    //    HTML 페이로드에 남기지 않기 위함. 특히 zoom_url은 방 입장의 사실상 열쇠다.
    const { data: profs } = await admin
      .from("profiles")
      .select("id, avatar_url, nickname, first_name, last_name, bio, nationality, gender")
      .in(
        "id",
        Array.from(new Set(rows.map((r) => r.room.friender_id))),
      );
    for (const p of (profs ?? []) as ProfileRow[]) {
      hosts[p.id] = {
        // 표시명 규칙: 닉네임 > 성+이름(공백 없이) > "프렌더".
        name: p.nickname?.trim() || `${p.last_name ?? ""}${p.first_name ?? ""}`.trim() || "프렌더",
        realName: `${p.last_name ?? ""}${p.first_name ?? ""}`.trim() || null,
        avatarUrl: p.avatar_url?.trim() || null,
        nationality: p.nationality,
        gender: p.gender,
        bio: p.bio,
      };
    }
  }

  // 내 참여 여부 + 내 입장 시각 — 본인 세션 client(RLS select_own).
  // ⚠️ entered_at까지 읽는 이유: 카드 CTA가 "노쇼면 예약 취소를 감춘다"를 판정해야 하는데
  //    그 판정은 본인 참가 행 없이는 불가능하다(/mypage/rooms의 같은 규칙과 한 쌍).
  // ⚠️ service_role로 바꾸지 말 것 — 남의 entered_at은 공개 페이지 페이로드에 실리면 안 된다.
  const enteredAtByOccurrence = new Map<string, string | null>();
  if (user && rows.length > 0) {
    const { data: mine } = await supabase.from("friender_room_participants").select("occurrence_id, entered_at").eq("user_id", user.id);
    for (const m of (mine ?? []) as { occurrence_id: string; entered_at: string | null }[]) enteredAtByOccurrence.set(m.occurrence_id, m.entered_at);
  }

  const rooms: PublicRoom[] = rows.map((r) => ({
    id: r.occurrenceId,
    roomId: r.room.id, // 시리즈 id — 게시판은 회차가 아니라 방 단위로 하나다.
    frienderId: r.room.friender_id,
    // 프로필 조회가 실패했거나 방금 탈퇴한 경우를 대비한 폴백 — 방 행의 이름 스냅샷을 쓴다.
    fallbackName: r.room.friender_nickname?.trim() || r.room.friender_name?.trim() || "프렌더",
    isMine: !!user && r.room.friender_id === user.id,
    title: r.room.title,
    description: r.room.description,
    level: r.room.level,
    capacity: r.room.capacity,
    sessionDate: r.occurrenceDate,
    startMin: r.room.start_min,
    durationMin: r.room.duration_min,
    participants: countByOccurrence.get(r.occurrenceId) ?? 0,
    joined: enteredAtByOccurrence.has(r.occurrenceId),
    enteredAt: enteredAtByOccurrence.get(r.occurrenceId) ?? null,
    accessType: r.room.access_type,
    recurring: !!r.room.recurrence_days && r.room.recurrence_days.length > 0,
  }));

  return (
    <div className="bg-surface">
      {reset === "success" && <SuccessBanner queryKey="reset" message="비밀번호가 성공적으로 변경되었습니다." />}
      {verified === "success" && <SuccessBanner queryKey="verified" message="이메일 인증이 완료되어 자동으로 로그인되었습니다." />}
      {signup === "success" && <SuccessBanner queryKey="signup" message="프렌딩 스쿨에 오신 것을 환영합니다." />}

      <div className="mx-auto max-w-[1100px] px-5 py-8 md:py-12">
        {/* 히어로 — v9 목업(mainhero_bg01) 이식. 이미지 위에 어둡게 깔고 카피를 올린다. */}
        <section className="relative isolate flex min-h-[140px] items-center justify-center overflow-hidden rounded-2xl md:min-h-[190px]">
          <Image src="/images/friending-hero.jpg" alt="" fill sizes="(max-width: 1100px) 100vw, 1100px" priority className="-z-10 object-cover" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-black/45" />
          {/* 말풍선 장식 — 목업 SVG 이식. 샤우팅 배너 히어로와 공용(`HeroBubbles`). */}
          <HeroBubbles className="pointer-events-none absolute inset-0 -z-10 hidden h-full w-full md:block" />

          <div className="px-5 py-8 text-center md:px-16">
            <p className="text-[12px] font-bold text-white/95 md:text-[15px]">친구와 친구가 만나 배우는, 프렌딩 스쿨</p>
            <h1 className="mt-1.5 text-[22px] font-bold tracking-[-0.04em] text-white md:mt-2 md:text-[34px]">
              스피킹은, <span className="underline decoration-white/60 underline-offset-[6px]">말한 만큼</span> 늘어요
            </h1>
          </div>
        </section>

        <FriendingRooms rooms={rooms} hosts={hosts} isLoggedIn={!!user} />
      </div>
    </div>
  );
}
