"use client";

import { useState } from "react";
import Image from "next/image";
import SectionIntro from "@/components/landing/SectionIntro";
import { MOMENTS } from "@/data/moments";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 3;

// 아웃팅 "모먼츠" — 지난 특강·모임 아카이브. 네이티브 <details> 아코디언(다른 곳과 동일 패턴) +
// 더보기 페이지네이션만 클라이언트 상태로 관리.
export default function MomentsSection({ id, className }: { id?: string; className?: string }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const items = MOMENTS.slice(0, visibleCount);
  const hasMore = visibleCount < MOMENTS.length;

  return (
    <section id={id} className={cn("pb-14", className)}>
      <SectionIntro label="아카이브" title="모먼츠" desc="지난 특강과 모임 기록을 모아봤어요" />
      <div className="mx-auto max-w-[800px] px-5 md:px-10">
        <div className="border-rule divide-rule flex flex-col divide-y rounded-2xl border bg-white">
          {items.map((m, i) => (
            <details key={`${m.label}-${m.date}`} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span className="text-ink text-[15px] font-bold">{m.label}</span>
                <span className="flex items-center gap-2">
                  <span className="text-muted-fg-faint text-sm">{m.date}</span>
                  <span aria-hidden className="text-muted-fg-faint text-xs transition-transform group-open:rotate-180">
                    ▾
                  </span>
                </span>
              </summary>
              <div className="mt-3">
                {m.imgs && m.imgs.length > 0 && (
                  <div className="mb-3 flex gap-2 overflow-x-auto">
                    {m.imgs.map((src) => (
                      <div key={src} className="relative h-[160px] w-[240px] flex-none overflow-hidden rounded-lg">
                        <Image src={src} alt="" fill sizes="240px" className="object-cover" />
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-muted-fg text-[15px] leading-relaxed">{m.content}</p>
              </div>
            </details>
          ))}
        </div>

        {hasMore && (
          <button
            type="button"
            onClick={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, MOMENTS.length))}
            className="text-accent-blue-ink hover:text-accent-blue mx-auto mt-4 block text-sm font-bold transition-colors">
            더보기 ↓
          </button>
        )}
      </div>
    </section>
  );
}
