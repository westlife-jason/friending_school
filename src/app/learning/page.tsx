import type { Metadata } from "next";
import Image from "next/image";
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
        {/* 히어로 — 홈(/)·샤우팅과 같은 스켈레톤(사진 + 어두운 오버레이 + 가운데 카피). 탭마다 톤을
            통일해 달라는 피드백 반영 — 이미지는 페이지 제목("스몰톡")에 맞춰 화상 통화 사진으로 골랐다. */}
        <section className="relative isolate flex min-h-[140px] items-center justify-center overflow-hidden rounded-2xl md:min-h-[190px]">
          <Image src="/images/learning-hero.jpg" alt="" fill sizes="(max-width: 1100px) 100vw, 1100px" priority className="-z-10 object-cover" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-black/45" />

          <div className="px-5 py-8 text-center md:px-16">
            <p className="text-[14px] font-bold text-white md:text-[17px]">예약 없이 바로 연결되는, 러닝</p>
            <h1 className="mt-1.5 text-[22px] font-bold tracking-[-0.04em] text-white md:mt-2 md:text-[34px]">선생님과 나누는 스몰톡</h1>
            <p className="mt-2 text-[15px] text-white/95 md:text-base">
              지금 가능한 선생님 {teachers.length}명 <span className="text-white/50">· </span>예약 없이 곧장 Zoom에서 대화를 시작해요.
            </p>
          </div>
        </section>

        <div className="mt-8">
          <SmallTalkBrowser teachers={teachers} />
        </div>
      </div>
    </div>
  );
}
