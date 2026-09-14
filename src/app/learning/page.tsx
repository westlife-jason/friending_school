import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { loadEnrollTeachers } from "@/app/courses/enroll-actions";
import TeacherBrowser, { type BrowseTeacher } from "@/components/learning/TeacherBrowser";

export const metadata: Metadata = { title: "러닝 — 프렌딩 스쿨" };

// 러닝(1:1 화상수업) 탭 — 강사를 먼저 둘러보고, 상세 모달에서 과정을 골라 기존
// /courses/[slug]/enroll 위저드로 이어진다(신청 로직은 그대로 재사용, 강사만 미리 선택된 채 시작).
export default async function LearningPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 비로그인도 둘러볼 수 있다(신청 단계에서만 로그인 요구, 프렙·프렌딩과 같은 공개 브라우징 정책).
  const teachers = await loadEnrollTeachers(user?.id);

  // 실제 진행 횟수 — 강사 카드에 평점 대신 표시(평점 시스템은 없다). conducted_at이 찍힌 class만 센다.
  const conductedByTeacher = new Map<string, number>();
  if (teachers.length > 0) {
    const admin = createAdminClient();
    const { data: rows } = await admin
      .from("classes")
      .select("teacher_id")
      .in(
        "teacher_id",
        teachers.map((t) => t.id),
      )
      .not("conducted_at", "is", null);
    for (const r of (rows ?? []) as { teacher_id: string }[]) {
      conductedByTeacher.set(r.teacher_id, (conductedByTeacher.get(r.teacher_id) ?? 0) + 1);
    }
  }

  const browseTeachers: BrowseTeacher[] = teachers.map((t) => ({
    ...t,
    conductedCount: conductedByTeacher.get(t.id) ?? 0,
  }));

  return (
    <div className="bg-surface">
      <div className="mx-auto max-w-[1100px] px-5 py-8 md:py-12">
        <div className="text-center">
          <span className="bg-brand-gradient inline-block rounded-full px-6 py-1.5 text-base font-bold text-white">러닝</span>
          <h1 className="text-ink mt-3 text-2xl font-bold tracking-tight md:text-3xl">선생님과 1:1로 배우는, 러닝</h1>
          <p className="text-muted-fg mt-2 text-sm">원하는 강사님의 프로필을 확인하고, 과정을 선택해 바로 신청해 보세요.</p>
        </div>

        <div className="mt-8">
          <TeacherBrowser teachers={browseTeachers} />
        </div>
      </div>
    </div>
  );
}
