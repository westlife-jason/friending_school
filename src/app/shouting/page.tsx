import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isPrepApplyOpen, prepChargeKrw, prepRemainingSessions } from "@/lib/prep";
import PrepEnrollBanner, { type OpenPrepCourse } from "@/components/prep/PrepEnrollBanner";
import type { HostProfile } from "@/components/friending/FriendingRooms";

export const metadata: Metadata = { title: "샤우팅 — 프렌딩 스쿨" };

type PrepRow = {
  id: string;
  friender_id: string;
  title: string;
  description: string | null;
  friender_name: string | null;
  friender_nickname: string | null;
  level: string;
  capacity: number;
  start_min: number;
  duration_min: number;
  price_krw: number;
  prep_sessions: { session_no: number; session_date: string; topic: string | null }[] | null;
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

// 샤우팅 독립 페이지(4탭 리뉴얼 3단계) — 예전엔 홈(/) 상단 배너로만 진입 가능했다.
// 데이터 로딩은 src/app/page.tsx가 하던 것 중 prep_courses 관련 부분만 떼어왔다
// (연습방 쪽 hosts/rows는 홈 전용이라 여기서는 다시 만들지 않는다).
export default async function ShoutingPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 공개 조회 — RLS prep_courses_select_public이 '승인'만 통과시킨다(비로그인 포함).
  const { data: prepData } = await supabase
    .from("prep_courses")
    .select(
      "id, friender_id, title, description, friender_name, friender_nickname, level, capacity, start_min, duration_min, price_krw, prep_sessions(session_no, session_date, topic)",
    )
    .eq("status", "승인");

  const prepRows = ((prepData ?? []) as unknown as PrepRow[])
    .map((c) => {
      const sessions = (c.prep_sessions ?? []).slice().sort((a, b) => a.session_no - b.session_no);
      const dates = sessions.map((s) => s.session_date).sort();
      return { ...c, sessions, dates, remaining: prepRemainingSessions(dates, c.start_min, c.duration_min) };
    })
    .filter((c) => c.remaining.length > 0)
    .sort((a, b) => a.remaining[0].localeCompare(b.remaining[0]));

  // 개설 프렌더 공개 프로필 — profiles_select_own RLS 때문에 service_role로 읽는다(홈과 동일 이유).
  const hosts: Record<string, HostProfile> = {};
  if (prepRows.length > 0) {
    const admin = createAdminClient();
    const { data: profs } = await admin
      .from("profiles")
      .select("id, avatar_url, nickname, first_name, last_name, bio, nationality, gender")
      .in(
        "id",
        Array.from(new Set(prepRows.map((c) => c.friender_id))),
      );
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

  // 신청자 수·내 신청 상태 — 신청자 RLS(select_own) 때문에 카운트는 service_role, 내 것만 세션 client.
  const prepCountByCourse = new Map<string, number>();
  const myPrep = new Map<string, "입금대기" | "수강확정">();
  if (prepRows.length > 0) {
    const ids = prepRows.map((c) => c.id);
    const { data: counts } = await createAdminClient()
      .from("prep_enrollments")
      .select("course_id, status")
      .in("course_id", ids)
      .neq("status", "취소");
    for (const row of (counts ?? []) as { course_id: string; status: string }[]) {
      prepCountByCourse.set(row.course_id, (prepCountByCourse.get(row.course_id) ?? 0) + 1);
    }
    if (user) {
      const { data: mine } = await supabase.from("prep_enrollments").select("course_id, status").in("course_id", ids).neq("status", "취소");
      for (const m of (mine ?? []) as { course_id: string; status: "입금대기" | "수강확정" }[]) myPrep.set(m.course_id, m.status);
    }
  }

  const prepCourses: OpenPrepCourse[] = prepRows.map((c) => ({
    id: c.id,
    frienderId: c.friender_id,
    title: c.title,
    description: c.description,
    frienderName: c.friender_nickname?.trim() || c.friender_name?.trim() || "프렌더",
    level: c.level,
    capacity: c.capacity,
    startMin: c.start_min,
    durationMin: c.duration_min,
    priceKrw: c.price_krw,
    sessionCount: c.dates.length,
    sessions: c.sessions.map((s) => ({ no: s.session_no, date: s.session_date, topic: s.topic })),
    firstDate: c.dates[0],
    lastDate: c.dates[c.dates.length - 1],
    remainingCount: c.remaining.length,
    remainingFirstDate: c.remaining[0],
    chargeKrw: prepChargeKrw(c.price_krw, c.dates.length, c.remaining.length),
    enrolled: prepCountByCourse.get(c.id) ?? 0,
    myStatus: myPrep.get(c.id) ?? null,
  }));

  // 신청 자격에서 빠진 항목 — 모달 사전 안내용(서버 RPC join_prep_course가 authoritative).
  const profileMissing: string[] = [];
  if (user) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("phone_verified_at, first_name, last_name, english_name")
      .eq("id", user.id)
      .maybeSingle();
    const p = (prof ?? {}) as {
      phone_verified_at?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      english_name?: string | null;
    };
    if (!p.phone_verified_at) profileMissing.push("휴대폰 인증");
    if (!p.last_name?.trim() || !p.first_name?.trim()) profileMissing.push("성·이름");
    if (!p.english_name?.trim()) profileMissing.push("영어 이름");
  }

  return (
    <div className="bg-surface">
      <div className="mx-auto max-w-[1100px] px-5 py-8 md:py-12">
        {prepCourses.length > 0 ? (
          <PrepEnrollBanner
            courses={prepCourses}
            hosts={hosts}
            isLoggedIn={!!user}
            profileMissing={profileMissing}
            applyOpenInitial={isPrepApplyOpen()}
          />
        ) : (
          <div className="border-rule rounded-2xl border bg-white px-5 py-16 text-center">
            <p className="text-ink text-lg font-bold">지금 신청할 수 있는 샤우팅 강좌가 없어요</p>
            <p className="text-muted-fg mt-2 text-sm">곧 새로운 강좌가 열릴 거예요.</p>
          </div>
        )}
      </div>
    </div>
  );
}
