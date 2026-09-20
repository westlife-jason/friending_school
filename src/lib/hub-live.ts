import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/utils/supabase/admin";
import { todayKst } from "@/lib/booking";
import { kstDateMinToMs } from "@/lib/classtime";
import { fmtTime } from "@/lib/availability";
import { fmtDateKo, prepRemainingSessions } from "@/lib/prep";
import { loadAvailableTeachers } from "@/app/learning/actions";
import { ACTIVITIES } from "@/data/landing";
import { EMPTY_HUB_LIVE, type HubAvatar, type HubLive, type HubTickerItem } from "@/components/hub/types";

type Admin = ReturnType<typeof createAdminClient>;

const AVATAR_LIMIT = 4;

// 첫 화면(허브)이 카드마다 "지금 살아 있다"를 보여주기 위한 공개 집계.
// ⚠️ profiles는 RLS로 본인 행만 열려 있어 service_role로 읽는다 — 아바타·표시명만 select한다
//    (email·phone·zoom_url은 절대 담지 않는다. 이 결과는 공개 페이지 HTML에 그대로 실린다).
async function loadAvatars(admin: Admin, ids: string[]): Promise<Map<string, HubAvatar>> {
  const map = new Map<string, HubAvatar>();
  if (ids.length === 0) return map;
  const { data } = await admin
    .from("profiles")
    .select("id, avatar_url, nickname, first_name, last_name")
    .in("id", Array.from(new Set(ids)));
  for (const p of (data ?? []) as {
    id: string;
    avatar_url: string | null;
    nickname: string | null;
    first_name: string | null;
    last_name: string | null;
  }[]) {
    map.set(p.id, {
      name: p.nickname?.trim() || `${p.last_name ?? ""}${p.first_name ?? ""}`.trim() || "프렌더",
      avatarUrl: p.avatar_url?.trim() || null,
    });
  }
  return map;
}

const uniqueAvatars = (ids: string[], avatars: Map<string, HubAvatar>): HubAvatar[] =>
  Array.from(new Set(ids))
    .map((id) => avatars.get(id))
    .filter((a): a is HubAvatar => !!a)
    .slice(0, AVATAR_LIMIT);

async function loadFriending(admin: Admin) {
  const { data } = await admin
    .from("friender_room_occurrences")
    .select("id, occurrence_date, friender_rooms(id, friender_id, title, start_min, duration_min)")
    .gte("occurrence_date", todayKst());

  type Room = { friender_id: string; title: string; start_min: number; duration_min: number };
  const now = Date.now();
  const rows = ((data ?? []) as unknown as { occurrence_date: string; friender_rooms: Room | Room[] | null }[])
    .map((o) => {
      const room = Array.isArray(o.friender_rooms) ? o.friender_rooms[0] : o.friender_rooms;
      return room ? { date: o.occurrence_date, room } : null;
    })
    .filter((r): r is { date: string; room: Room } => !!r)
    .filter((r) => kstDateMinToMs(r.date, r.room.start_min + r.room.duration_min) > now)
    .sort((a, b) => a.date.localeCompare(b.date) || a.room.start_min - b.room.start_min);

  const avatars = await loadAvatars(
    admin,
    rows.map((r) => r.room.friender_id),
  );
  const tickers: HubTickerItem[] = rows.slice(0, 2).map((r, i) => ({
    id: `friending-${i}`,
    kind: "friending",
    text: `${fmtDateKo(r.date)} ${fmtTime(r.room.start_min)} · ${r.room.title}`,
    href: "/friending",
    avatar: avatars.get(r.room.friender_id) ?? null,
  }));
  return {
    count: rows.length,
    people: new Set(rows.map((r) => r.room.friender_id)).size,
    avatars: uniqueAvatars(
      rows.map((r) => r.room.friender_id),
      avatars,
    ),
    tickers,
  };
}

async function loadShouting(admin: Admin) {
  const { data } = await admin
    .from("prep_courses")
    .select("id, friender_id, title, start_min, duration_min, prep_sessions(session_date)")
    .eq("status", "승인");

  // /shouting과 같은 기준 — 남은 회차가 있는 승인 강좌만 "모집 중"이다.
  const rows = (
    (data ?? []) as unknown as {
      friender_id: string;
      title: string;
      start_min: number;
      duration_min: number;
      prep_sessions: { session_date: string }[] | null;
    }[]
  )
    .map((c) => ({
      ...c,
      remaining: prepRemainingSessions(
        (c.prep_sessions ?? []).map((s) => s.session_date),
        c.start_min,
        c.duration_min,
      ),
    }))
    .filter((c) => c.remaining.length > 0)
    .sort((a, b) => a.remaining[0].localeCompare(b.remaining[0]));

  const avatars = await loadAvatars(
    admin,
    rows.map((r) => r.friender_id),
  );
  const tickers: HubTickerItem[] = rows.slice(0, 1).map((r) => ({
    id: "shouting-0",
    kind: "shouting",
    text: `모집 중 · ${r.title}`,
    href: "/shouting",
    avatar: avatars.get(r.friender_id) ?? null,
  }));
  return {
    count: rows.length,
    people: new Set(rows.map((r) => r.friender_id)).size,
    avatars: uniqueAvatars(
      rows.map((r) => r.friender_id),
      avatars,
    ),
    tickers,
  };
}

async function loadLearning() {
  const teachers = await loadAvailableTeachers();
  const avatars: HubAvatar[] = teachers.map((t) => ({ name: t.name, avatarUrl: t.avatarUrl }));
  const tickers: HubTickerItem[] = teachers.slice(0, 3).map((t, i) => ({
    id: `learning-${i}`,
    kind: "learning",
    text: `${t.name} 선생님이 지금 대화 가능해요`,
    href: "/learning",
    avatar: avatars[i],
  }));
  return { count: teachers.length, people: teachers.length, avatars: avatars.slice(0, AVATAR_LIMIT), tickers };
}

async function loadOuting(admin: Admin) {
  const a = ACTIVITIES.find((x) => x.eventDate);
  if (!a?.eventDate) return { dday: null, applicants: 0, tickers: [] as HubTickerItem[] };

  const [ty, tm, td] = todayKst().split("-").map(Number);
  const [ey, em, ed] = a.eventDate.split("-").map(Number);
  const dday = Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
  if (dday < 0) return { dday: null, applicants: 0, tickers: [] as HubTickerItem[] };

  const { count } = await admin.from("activity_applications").select("id", { count: "exact", head: true }).eq("activity_slug", a.slug);
  const applicants = count ?? 0;
  const label = dday === 0 ? "오늘" : `D-${dday}`;
  const tickers: HubTickerItem[] = [
    {
      id: "outing-0",
      kind: "outing",
      text: `${em}월 ${ed}일 ${a.title} · ${label}${applicants > 0 ? ` · 신청 ${applicants}명` : ""}`,
      href: "/activities",
      avatar: null,
    },
  ];
  return { dday, applicants, tickers };
}

const settle = async <T>(p: Promise<T>, fallback: T): Promise<T> => {
  try {
    return await p;
  } catch (e) {
    console.error("[hub-live] 조회 실패:", e);
    return fallback;
  }
};

async function loadHubLive(): Promise<HubLive> {
  const admin = createAdminClient();
  const [friending, shouting, learning, outing] = await Promise.all([
    settle(loadFriending(admin), { count: 0, people: 0, avatars: [], tickers: [] as HubTickerItem[] }),
    settle(loadShouting(admin), { count: 0, people: 0, avatars: [], tickers: [] as HubTickerItem[] }),
    settle(loadLearning(), { count: 0, people: 0, avatars: [], tickers: [] as HubTickerItem[] }),
    settle(loadOuting(admin), { dday: null as number | null, applicants: 0, tickers: [] as HubTickerItem[] }),
  ]);

  // 롤링 순서: "지금" 성격이 강한 것부터(러닝) → 곧 시작하는 방 → 모집 중 강좌 → 액티비티. 종류가 섞이도록 번갈아 배치한다.
  const lanes = [learning.tickers, friending.tickers, shouting.tickers, outing.tickers];
  const ticker: HubTickerItem[] = [];
  for (let i = 0; ticker.length < 8 && lanes.some((l) => i < l.length); i++) {
    for (const lane of lanes) if (i < lane.length) ticker.push(lane[i]);
  }

  return {
    friending: { count: friending.count, people: friending.people, avatars: friending.avatars },
    shouting: { count: shouting.count, people: shouting.people, avatars: shouting.avatars },
    learning: { count: learning.count, people: learning.people, avatars: learning.avatars },
    outing: { dday: outing.dday, applicants: outing.applicants },
    ticker,
  };
}

// 30초 캐시 — 첫 화면은 모든 방문자가 지나가는 관문이라 요청마다 DB 4곳을 두드리지 않는다.
// 강사가 "지금 가능"을 켜거나 예약이 생겨도 최대 30초 안에 반영된다.
const cachedHubLive = unstable_cache(loadHubLive, ["hub-live-v2"], { revalidate: 30 });

export async function getHubLive(): Promise<HubLive> {
  try {
    return await cachedHubLive();
  } catch (e) {
    console.error("[hub-live] 실패, 빈 값으로 대체:", e);
    return EMPTY_HUB_LIVE;
  }
}
