import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { requireCenterManager } from "@/lib/center-manager";
import { countPendingRequests } from "@/lib/center-requests";
import { createAdminClient } from "@/utils/supabase/admin";
import CenterTabs from "@/components/center/CenterTabs";
import { LangProvider } from "@/components/LangProvider";

export const metadata: Metadata = { title: "Center Management — Friending School", robots: { index: false } };

export default async function CenterLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // 로그인 자체를 안 한 방문자는 센터 매니저 전용 로그인 화면으로.
  // (로그인은 했지만 매니저가 아닌 경우는 아래에서 "/"로 보낸다 — /center/login으로 보내면
  //  그 페이지가 "이미 로그인됨"을 보고 다시 /center로 돌려보내 무한 리다이렉트가 된다.)
  if (!user) redirect("/center/login");

  const mgr = await requireCenterManager();
  if (!mgr) redirect("/");

  const { data: profile } = await supabase.from("profiles").select("first_name, last_name").eq("id", mgr.userId).maybeSingle();
  // 원어민 강사/매니저 위주라 영문 이름 순서(first last), 없으면 이메일 앞부분.
  const displayName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || user?.email?.split("@")[0]
    : user?.email?.split("@")[0];

  const pendingCount = await countPendingRequests(createAdminClient(), mgr.centerIds);

  return (
    <div className="bg-surface min-h-screen">
      <div className="px-5 py-7 text-center">
        <span className="bg-brand-gradient inline-block rounded-full px-6 py-1.5 text-base font-bold text-white md:text-xl">CENTER</span>
      </div>

      <div className="mx-auto max-w-[760px] px-5 pb-16">
        <div className="bg-brand-gradient mb-5 rounded-2xl px-6 py-7 text-white">
          <p className="text-xs font-bold tracking-[0.1em] opacity-90">
            FRIENDING SCHOOL · CENTER MANAGER · {mgr.centers.map((c) => c.name).join(" / ")}
          </p>
          <p className="mt-2 text-xl font-bold md:text-2xl">Welcome, {displayName}! 👋</p>
          <p className="mt-1 text-sm opacity-90">
            Keep your teachers&apos; availability up to date, approve enrollment requests, and reassign a session&apos;s teacher when a class
            can&apos;t be held.
          </p>
        </div>

        <CenterTabs pendingCount={pendingCount} />

        <LangProvider lang="en">{children}</LangProvider>
      </div>
    </div>
  );
}
