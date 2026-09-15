import type { Metadata } from "next";
import { loadAvailableTeachers } from "@/app/learning/actions";
import SmallTalkBrowser from "@/components/learning/SmallTalkBrowser";

export const metadata: Metadata = { title: "러닝 — 프렌딩 스쿨" };

// 러닝(스몰톡) 탭 — 강사가 "지금 가능"으로 켜둔 순간에만 학생 화면에 뜬다(실시간).
// 예약·과정 선택 없이 카드에서 바로 Zoom으로 들어간다(src/app/learning/actions.ts).
export default async function LearningPage() {
  const teachers = await loadAvailableTeachers();

  return (
    <div className="bg-surface">
      <div className="mx-auto max-w-[1100px] px-5 py-8 md:py-12">
        <div className="text-center">
          <span className="bg-brand-gradient inline-block rounded-full px-6 py-1.5 text-base font-bold text-white">러닝</span>
          <h1 className="text-ink mt-3 text-2xl font-bold tracking-tight md:text-3xl">선생님과 나누는 스몰톡</h1>
          <p className="text-muted-fg mt-2 text-sm">지금 바로 가능한 선생님 중 한 분을 골라, 예약 없이 곧장 Zoom에서 대화를 시작해 보세요.</p>
        </div>

        <div className="mt-8">
          <SmallTalkBrowser teachers={teachers} />
        </div>
      </div>
    </div>
  );
}
