import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LoginForm from "@/components/auth/LoginForm";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = { title: "센터 관리자 로그인 — Friending School", robots: { index: false } };

// (manager) 라우트 그룹 밖에 둔다 — 같은 계층에 두면 (manager)/layout.tsx의
// requireCenterManager() 가드가 로그인 전 방문자까지 막아 로그인 자체가 불가능해진다.
export default async function CenterLoginPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // 이미 로그인돼 있으면 바로 대시보드로 — 매니저가 아니면 (manager)/layout.tsx가 "/"로 돌려보낸다.
  if (user) redirect("/center");

  return (
    <main className="bg-ink flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="bg-brand-gradient inline-block rounded-full px-6 py-1.5 text-base font-bold text-white">CENTER</span>
          <p className="mt-3 text-sm text-white/60">FRIENDING SCHOOL · 센터 관리자 전용</p>
        </div>
        <LoginForm next="/center" variant="center" />
      </div>
    </main>
  );
}
