"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

// 러닝 탭 "스몰톡" — 강사가 지금 이 순간 가능(learning_available)으로 켜둔 사람만 보여주고,
// 학생이 입장하면 그 자리에서 자동으로 꺼진다(1:1이라 동시에 여러 명이 들어가면 안 된다).
// 주간 시간표 기반 수강신청(courses/enroll-actions.ts)과는 완전히 별개 기능이다.

export type SmallTalkTeacher = {
  id: string;
  name: string;
  avatarUrl: string | null;
  nationality: string | null;
  gender: string | null;
  bio: string | null;
};

export async function loadAvailableTeachers(): Promise<SmallTalkTeacher[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, first_name, last_name, avatar_url, nationality, gender, bio")
    .eq("role", "teacher")
    .eq("learning_available", true);
  if (error) {
    console.error("[loadAvailableTeachers] 조회 실패:", error);
    return [];
  }
  return (
    data as {
      id: string;
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
      nationality: string | null;
      gender: string | null;
      bio: string | null;
    }[]
  ).map((t) => ({
    id: t.id,
    name: [t.first_name, t.last_name].filter(Boolean).join(" ").trim() || "강사",
    avatarUrl: t.avatar_url,
    nationality: t.nationality,
    gender: t.gender,
    bio: t.bio,
  }));
}

export type EnterSmallTalkResult = { url?: string; error?: string };

export async function enterSmallTalk(teacherId: string): Promise<EnterSmallTalkResult> {
  const id = String(teacherId ?? "").trim();
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다. 다시 로그인해 주세요." };

  const admin = createAdminClient();

  // 선점(claim) — "가능" 상태인 동안 딱 한 번만 통과시킨다. 조건부 update가 동시 클릭에도
  // 단 하나만 성공하게 만드는 실질적 락 역할(성공한 행이 있어야만 zoom_url을 내준다).
  const { data: claimed, error: claimError } = await admin
    .from("profiles")
    .update({ learning_available: false })
    .eq("id", id)
    .eq("role", "teacher")
    .eq("learning_available", true)
    .select("zoom_url");
  if (claimError) return { error: "입장 처리 중 문제가 발생했습니다." };
  if (!claimed || claimed.length === 0) {
    return { error: "이미 다른 학생이 입장했어요. 목록을 새로고침해 주세요." };
  }

  const zoomUrl = (claimed[0] as { zoom_url: string | null }).zoom_url?.trim();
  if (!zoomUrl) return { error: "강사님의 화상 링크가 아직 등록되지 않았어요." };

  revalidatePath("/learning");
  return { url: zoomUrl };
}
