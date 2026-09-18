"use client";

import { useState } from "react";
import Image from "next/image";
import { Calendar, ChevronRight } from "lucide-react";
import SectionIntro from "@/components/landing/SectionIntro";
import ActivityDetailModal from "@/components/landing/ActivityDetailModal";
import { ACTIVITIES, type Activity } from "@/data/landing";
import { cn } from "@/lib/utils";

const ACTIVITY_BADGE: Record<string, string> = {
  open: "bg-[#E1F5EE] text-[#0F6E56]",
  plan: "bg-[#E6F1FB] text-[#0C447C]",
  new: "bg-[#EAF3DE] text-[#27500A]",
};

// 원어민 · 세대교감 액티비티 — /school 5번 섹션과 /activities에서 공유. 카드 데이터는 landing.ts의 ACTIVITIES 단일 소스.
// ⚠️ 라벨에서 "액티비티"를 뺐다 — /activities 페이지 H1이 이미 "액티비티"라 라벨까지 반복하면
//    같은 단어가 페이지 안에서 두 번 겹쳐 보인다(사용자 피드백).
export default function ActivitySection({
  id,
  className,
  introTitle = "영어는 밖에서도 빨리 늘어요!",
  introDesc = "국내에서도 많은 활동이 있어요. 함께해요.",
}: {
  id?: string;
  className?: string;
  /** /activities는 히어로 리드 문구를 여기로 옮겨와 오버라이드한다 — 기본값은 /school 5번 섹션용. */
  introTitle?: React.ReactNode;
  introDesc?: React.ReactNode;
}) {
  const [detailTarget, setDetailTarget] = useState<Activity | null>(null);

  return (
    <section id={id} className={cn("pb-14", className)}>
      <SectionIntro label="원어민 · 세대교감" title={introTitle} desc={introDesc} />
      <div className="mx-auto max-w-[1200px] px-5 md:px-10">
        <div className="flex flex-col gap-3.5 md:flex-row md:flex-wrap md:justify-center">
          {ACTIVITIES.map((a) => (
            <div
              key={a.slug}
              className="border-rule w-full overflow-hidden rounded-2xl border bg-white transition-transform hover:-translate-y-0.5 md:w-[364px]">
              <div className="relative h-[110px]">
                <Image src={a.image} alt="" fill sizes="(max-width: 768px) 100vw, 400px" className="object-cover" />
                <div className="absolute inset-0 bg-black/30" />
                <span
                  className={cn(
                    "absolute top-2.5 left-2.5 z-[1] rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                    ACTIVITY_BADGE[a.badgeVariant],
                  )}>
                  {a.badge}
                </span>
              </div>
              <div className="p-3.5">
                <p className="text-ink mb-1.5 text-base font-bold">{a.title}</p>
                <p className="text-muted-fg mb-3 text-[15px] leading-relaxed">{a.desc}</p>
                <div className="flex items-center justify-between gap-2">
                  {/* 확정된 다음 일정은 눈에 띄게 — 막연한 "상시진행" 문구와 같은 회색이면 묻힌다(사용자 피드백).
                      완전히 사라지는 하드 블링크 대신 opacity가 100%↔50%로 오가는 pulse — 가독성 유지. */}
                  <span
                    className={cn(
                      "flex items-center gap-1 text-sm",
                      a.dateHighlight ? "text-brand motion-safe:animate-pulse font-bold" : "text-muted-fg-faint",
                    )}>
                    <Calendar aria-hidden className="size-3.5" /> {a.date}
                  </span>
                  {a.detail && (
                    <button
                      type="button"
                      onClick={() => setDetailTarget(a)}
                      className="text-accent-blue-ink focus-visible:ring-accent-blue/50 inline-flex shrink-0 items-center gap-0.5 rounded text-xs font-bold transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none">
                      세부정보 보기
                      <ChevronRight aria-hidden className="size-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ActivityDetailModal activity={detailTarget} onClose={() => setDetailTarget(null)} />
    </section>
  );
}
