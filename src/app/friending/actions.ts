"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isValidZoomUrl } from "@/lib/url";
import { canEnterClass, kstDateMinToMs } from "@/lib/classtime";

export type JoinResult = { ok: boolean; error?: string };
export type EnterRoomResult = { url?: string; error?: string };

// 프렌더 액션과 달리 일반 회원용이라 역할 가드가 없다 — 로그인 여부만 확인한다.
async function currentUserId(): Promise<string | null> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// join_friender_room RPC 반환 코드 → 사용자 메시지.
const JOIN_ERROR: Record<string, string> = {
  unauthenticated: "로그인이 필요합니다. 다시 로그인해 주세요.",
  not_found: "회차를 찾을 수 없어요. 목록을 새로고침해 주세요.",
  own_room: "내가 개설한 방에는 예약할 수 없어요.",
  ended: "이미 종료된 회차예요.",
  full: "정원이 모두 찼어요.",
  shouting_required: "이 방은 연결된 샤우팅 강좌를 수강확정한 학생만 입장할 수 있어요.",
};

// ⚠️ 4탭 리뉴얼 4단계(반복모임)부터 이 파일의 모든 함수는 "방(room)"이 아니라
//    "회차(occurrence, friender_room_occurrences.id)"를 단위로 동작한다. 1회성 방은 회차가
//    하나뿐이라 체감 동작은 이전과 동일하고, 반복방은 회차마다 별도로 예약·입장·후기가 갈린다.

export async function joinRoom(occurrenceId: string): Promise<JoinResult> {
  const id = String(occurrenceId ?? "").trim();
  if (!id) return { ok: false, error: "잘못된 요청입니다." };

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  // 표시 스냅샷용 이름 — 닉네임 우선, 없으면 성+이름(공백 없이), 그것도 없으면 이메일 앞부분.
  const admin = createAdminClient();
  const { data: prof } = await admin.from("profiles").select("first_name, last_name, nickname").eq("id", user.id).maybeSingle();
  const p = (prof ?? {}) as { first_name?: string | null; last_name?: string | null; nickname?: string | null };
  const userName = p.nickname?.trim() || `${p.last_name ?? ""}${p.first_name ?? ""}` || user.email?.split("@")[0] || null;

  // ⚠️ 본인 세션 client로 호출해야 RPC 안의 auth.uid()가 잡힌다(service_role로 부르면 null).
  const { data, error } = await supabase.rpc("join_friender_room", { p_occurrence_id: id, p_user_name: userName });
  if (error) return { ok: false, error: "예약 처리 중 문제가 발생했습니다." };

  const code = String(data ?? "");
  // already는 실패로 보지 않는다 — 이미 참여한 상태이므로 결과적으로 원하는 상태다(멱등).
  if (code !== "ok" && code !== "already") {
    return { ok: false, error: JOIN_ERROR[code] ?? "예약 처리 중 문제가 발생했습니다." };
  }

  revalidatePath("/");
  revalidatePath("/mypage/rooms"); // 마이페이지 예약 목록에도 바로 반영
  return { ok: true };
}

export async function leaveRoom(occurrenceId: string): Promise<JoinResult> {
  const id = String(occurrenceId ?? "").trim();
  if (!id) return { ok: false, error: "잘못된 요청입니다." };

  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "로그인이 필요합니다." };

  const admin = createAdminClient();
  const { error } = await admin.from("friender_room_participants").delete().eq("occurrence_id", id).eq("user_id", userId);
  if (error) return { ok: false, error: "취소 처리 중 문제가 발생했습니다." };

  revalidatePath("/");
  revalidatePath("/mypage/rooms"); // 마이페이지 예약 목록도 함께 갱신
  return { ok: true };
}

// 방 입장 — 참가자(또는 개설자) 검증 + 시간창 검증 후 개설자 zoom URL(최신값) 반환.
// enterClass(src/app/classroom/actions.ts)와 같은 구조. 클라가 새 탭으로 연다.
export async function enterRoom(occurrenceId: string): Promise<EnterRoomResult> {
  const id = String(occurrenceId ?? "").trim();
  if (!id) return { error: "잘못된 요청입니다." };

  const userId = await currentUserId();
  if (!userId) return { error: "로그인이 필요합니다. 다시 로그인해 주세요." };

  const admin = createAdminClient();
  const { data: occ } = await admin
    .from("friender_room_occurrences")
    .select("id, occurrence_date, friender_rooms(id, friender_id, start_min, duration_min)")
    .eq("id", id)
    .maybeSingle();
  // ⚠️ 임베드 결과는 many-to-one이라 런타임엔 객체지만 untyped client 타입 추론은 배열로 본다.
  type RoomEmbed = { id: string; friender_id: string; start_min: number; duration_min: number };
  const occRow = occ as { id: string; occurrence_date: string; friender_rooms: RoomEmbed | RoomEmbed[] | null } | null;
  const room = occRow ? (Array.isArray(occRow.friender_rooms) ? occRow.friender_rooms[0] : occRow.friender_rooms) : null;
  if (!occRow || !room) return { error: "회차를 찾을 수 없어요." };

  // 개설자 본인이거나 참가자여야 입장 가능.
  const isHost = room.friender_id === userId;
  let participant: { entered_at: string | null } | null = null;
  if (!isHost) {
    const { data: part } = await admin
      .from("friender_room_participants")
      .select("occurrence_id, entered_at")
      .eq("occurrence_id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!part) return { error: "먼저 예약하기를 눌러 주세요." };
    participant = part as { entered_at: string | null };
  }

  // 시간창 검증(서버 authoritative). ⚠️ lessonEndMin은 수업 전용(30→25분 축소)이라 쓰지 않는다.
  const startMs = kstDateMinToMs(occRow.occurrence_date, room.start_min);
  const endMs = kstDateMinToMs(occRow.occurrence_date, room.start_min + room.duration_min);
  if (!canEnterClass(Date.now(), startMs, endMs)) {
    return { error: "시작 15분 전부터 입장할 수 있어요." };
  }

  // 첫 입장 기록 — 노쇼 판정(시작 + 유예까지 미입장이면 자리 반환)의 근거.
  // sticky: 한 번 찍히면 유지한다(classes.teacher_entered_at과 같은 규칙).
  // best-effort — 기록 실패가 입장을 막지 않는다. 시간창 검증을 통과한 뒤에만 찍는다.
  if (participant && !participant.entered_at) {
    const { error: stampError } = await admin
      .from("friender_room_participants")
      .update({ entered_at: new Date().toISOString() })
      .eq("occurrence_id", id)
      .eq("user_id", userId)
      .is("entered_at", null);
    if (stampError) console.error("[enterRoom] entered_at 기록 실패", stampError);
  }

  // 개설자 zoom URL 최신값(방 행에 저장하지 않는 이유는 friender_rooms 마이그레이션 주석 참고).
  const { data: host } = await admin.from("profiles").select("zoom_url").eq("id", room.friender_id).maybeSingle();
  const zoomUrl = ((host as { zoom_url?: string | null } | null)?.zoom_url ?? "").trim();
  if (!zoomUrl || !isValidZoomUrl(zoomUrl)) {
    return { error: "개설자의 화상 링크가 아직 등록되지 않았어요." };
  }

  return { url: zoomUrl };
}

// ─────────────────────────────────────────────────────────────
// 평점·후기 — 회원이 마이페이지에서 지난 예약에 남긴다.
// 열람은 프렌더 본인 + 관리자만(공개 목록에는 노출하지 않는 정책).
// ─────────────────────────────────────────────────────────────

export type ReviewResult = { ok: boolean; error?: string };

const MAX_COMMENT = 1000;

export async function saveRoomReview(occurrenceId: string, rating: number, comment: string): Promise<ReviewResult> {
  const id = String(occurrenceId ?? "").trim();
  if (!id) return { ok: false, error: "잘못된 요청입니다." };

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const score = Number(rating);
  if (!Number.isInteger(score) || score < 1 || score > 5) return { ok: false, error: "별점을 선택해 주세요." };
  const body = String(comment ?? "")
    .trim()
    .slice(0, MAX_COMMENT);

  const admin = createAdminClient();
  const { data: occ } = await admin
    .from("friender_room_occurrences")
    .select("id, occurrence_date, friender_rooms(id, friender_id, title, start_min, duration_min)")
    .eq("id", id)
    .maybeSingle();
  type RoomEmbed = { id: string; friender_id: string; title: string; start_min: number; duration_min: number };
  const occRow = occ as { id: string; occurrence_date: string; friender_rooms: RoomEmbed | RoomEmbed[] | null } | null;
  const room = occRow ? (Array.isArray(occRow.friender_rooms) ? occRow.friender_rooms[0] : occRow.friender_rooms) : null;
  if (!occRow || !room) return { ok: false, error: "회차를 찾을 수 없어요." };

  // 종료된 회차만 — 진행 전·진행 중에는 평가할 대화가 아직 없다.
  if (kstDateMinToMs(occRow.occurrence_date, room.start_min + room.duration_min) > Date.now()) {
    return { ok: false, error: "대화가 끝난 뒤에 후기를 남길 수 있어요." };
  }

  // 자격: 실제로 입장한 예약자만(노쇼는 평가 대상이 아니다).
  const { data: part } = await admin
    .from("friender_room_participants")
    .select("user_name, entered_at")
    .eq("occurrence_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!part) return { ok: false, error: "예약한 회차에만 후기를 남길 수 있어요." };
  if (!(part as { entered_at: string | null }).entered_at) {
    return { ok: false, error: "입장한 대화에만 후기를 남길 수 있어요." };
  }

  // 방/회차가 삭제돼도 후기가 의미를 유지하도록 표시 값을 스냅샷으로 함께 저장한다.
  const { error } = await admin.from("friender_room_reviews").upsert(
    {
      occurrence_id: id,
      room_id: room.id,
      friender_id: room.friender_id,
      user_id: user.id,
      user_name: (part as { user_name: string | null }).user_name,
      room_title: room.title,
      session_date: occRow.occurrence_date,
      rating: score,
      comment: body || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "occurrence_id,user_id" },
  );
  if (error) return { ok: false, error: "후기 저장 중 문제가 발생했습니다." };

  revalidatePath("/mypage/rooms");
  revalidatePath("/friender/reviews");
  return { ok: true };
}

export async function deleteRoomReview(occurrenceId: string): Promise<ReviewResult> {
  const id = String(occurrenceId ?? "").trim();
  if (!id) return { ok: false, error: "잘못된 요청입니다." };

  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "로그인이 필요합니다." };

  const admin = createAdminClient();
  const { error } = await admin.from("friender_room_reviews").delete().eq("occurrence_id", id).eq("user_id", userId);
  if (error) return { ok: false, error: "삭제 중 문제가 발생했습니다." };

  revalidatePath("/mypage/rooms");
  revalidatePath("/friender/reviews");
  return { ok: true };
}
