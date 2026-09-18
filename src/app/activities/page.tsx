import type { Metadata } from "next";
import Image from "next/image";
import ActivitySection from "@/components/landing/ActivitySection";
import MomentsSection from "@/components/landing/MomentsSection";
import HeroBubbles from "@/components/HeroBubbles";
import { ACTIVITIES_HERO } from "@/data/activities-page";

export const metadata: Metadata = { title: "액티비티 — 프렌딩 스쿨" };

// 액티비티 안내 페이지. 히어로 문구는 src/data/activities-page.ts,
// 카드는 /school 5번 섹션과 동일한 ActivitySection(공유)을 재사용한다.
export default function ActivitiesPage() {
  const { label, title, lead, points } = ACTIVITIES_HERO;

  return (
    <div className="bg-surface">
      <div className="mx-auto max-w-[1100px] px-5 pt-8 md:pt-12">
        {/* 히어로 — 홈(/)·샤우팅·러닝과 같은 스켈레톤(사진 + 어두운 오버레이 + 가운데 카피).
            사진은 페이지 제목("교실 밖에서")에 맞춰 실제 하이킹 사진으로 골랐다. */}
        <section className="relative isolate flex min-h-[140px] items-center justify-center overflow-hidden rounded-2xl md:min-h-[190px]">
          <Image src="/images/activity-hwaseong-1.jpg" alt="" fill sizes="(max-width: 1100px) 100vw, 1100px" priority className="-z-10 object-cover" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-black/45" />
          <HeroBubbles className="pointer-events-none absolute inset-0 -z-10 hidden h-full w-full md:block" />

          <div className="px-5 py-8 text-center md:px-16">
            <p className="text-[12px] font-bold text-white/95 md:text-[15px]">{label}</p>
            <h1 className="mt-1.5 text-[22px] font-bold tracking-[-0.04em] text-white md:mt-2 md:text-[34px]">{title}</h1>
            <p className="mx-auto mt-2 max-w-[520px] text-sm text-white/80">{lead}</p>

            <ul className="mt-4 flex list-none flex-wrap justify-center gap-2">
              {points.map((p) => (
                <li
                  key={p}
                  className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur-[2px]">
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      {/* 액티비티 카드 — /school 5번 섹션과 동일 컴포넌트 */}
      <ActivitySection />

      {/* 아웃팅 모먼츠 — 지난 특강·모임 아카이브(4탭 리뉴얼 2단계 신규) */}
      <MomentsSection />
    </div>
  );
}
