"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

// 아웃팅 액티비티(하이킹 등) 참가 신청 — 정원·승인 없는 자유 참가라 friender_rooms보다 단순하다.
// 액티비티 자체는 DB 테이블이 아니라 src/data/landing.ts의 정적 데이터라 slug로만 식별한다.

export type ActivityApplicationStatus = { isLoggedIn: boolean; applied: boolean; count: number };
export type ActivityActionResult = { ok: boolean; error?: string };

async function currentUser() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function loadActivityApplicationStatus(slug: string): Promise<ActivityApplicationStatus> {
  const id = String(slug ?? "").trim();
  if (!id) return { isLoggedIn: false, applied: false, count: 0 };

  const { user } = await currentUser();

  // 신청 인원 수 — 신청자 명단은 비공개라 service_role로만 센다(friender_rooms 참가자 수와 같은 이유).
  const admin = createAdminClient();
  const { count } = await admin
    .from("activity_applications")
    .select("id", { count: "exact", head: true })
    .eq("activity_slug", id);

  if (!user) return { isLoggedIn: false, applied: false, count: count ?? 0 };

  const { data } = await admin.from("activity_applications").select("id").eq("activity_slug", id).eq("user_id", user.id).maybeSingle();
  return { isLoggedIn: true, applied: !!data, count: count ?? 0 };
}

export async function applyToActivity(slug: string): Promise<ActivityActionResult> {
  const id = String(slug ?? "").trim();
  if (!id) return { ok: false, error: "잘못된 요청입니다." };

  const { user } = await currentUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const admin = createAdminClient();
  const { data: prof } = await admin.from("profiles").select("first_name, last_name, nickname").eq("id", user.id).maybeSingle();
  const p = (prof ?? {}) as { first_name?: string | null; last_name?: string | null; nickname?: string | null };
  const userName = p.nickname?.trim() || `${p.last_name ?? ""}${p.first_name ?? ""}`.trim() || user.email?.split("@")[0] || "회원";

  // 이미 신청했으면 성공으로 본다(멱등) — unique(activity_slug, user_id)가 중복을 막는다.
  const { error } = await admin.from("activity_applications").upsert(
    { activity_slug: id, user_id: user.id, user_name: userName },
    { onConflict: "activity_slug,user_id", ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: "신청 처리 중 문제가 발생했습니다." };

  revalidatePath("/activities");
  return { ok: true };
}

export async function cancelActivityApplication(slug: string): Promise<ActivityActionResult> {
  const id = String(slug ?? "").trim();
  if (!id) return { ok: false, error: "잘못된 요청입니다." };

  const { user } = await currentUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const admin = createAdminClient();
  const { error } = await admin.from("activity_applications").delete().eq("activity_slug", id).eq("user_id", user.id);
  if (error) return { ok: false, error: "취소 처리 중 문제가 발생했습니다." };

  revalidatePath("/activities");
  return { ok: true };
}
