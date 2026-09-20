"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/hub/AvatarStack";
import { cn } from "@/lib/utils";
import type { HubTickerItem } from "@/components/hub/types";

const ROTATE_MS = 3500;

// 지금 살아 있는 것(대화 가능한 선생님·곧 시작하는 방·모집 중 강좌·다가오는 액티비티)을
// 한 줄씩 돌려 보여주는 띠. 방문자에게 "지금 사람이 있다"를 한눈에 전한다.
// ⚠️ 자동 회전은 마우스/포커스가 올라가 있거나 모션 최소화 설정이면 멈춘다(읽는 중에 바뀌면 안 된다).
export default function LiveTicker({ items }: { items: HubTickerItem[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (paused || reduceMotion || items.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [paused, reduceMotion, items.length]);

  if (items.length === 0) return null;
  const item = items[index % items.length];

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className="border-rule mx-auto flex h-16 w-full max-w-[600px] items-center gap-3 rounded-full border bg-white px-4 shadow-sm md:h-14">
      <span className="text-brand flex shrink-0 items-center gap-1.5 text-[13px] font-extrabold tracking-wide">
        <span aria-hidden className="bg-brand size-2 rounded-full motion-safe:animate-pulse" />
        LIVE
      </span>

      <Link
        key={item.id}
        href={item.href}
        className="focus-visible:ring-accent-blue/50 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 flex min-w-0 flex-1 items-center gap-2.5 rounded-full duration-500 focus-visible:ring-2 focus-visible:outline-none">
        {item.avatar ? (
          <Avatar avatar={item.avatar} size={30} />
        ) : (
          <span aria-hidden className="bg-accent-blue-soft inline-flex size-[30px] shrink-0 items-center justify-center rounded-full text-base">
            {item.kind === "outing" ? "🥾" : "📣"}
          </span>
        )}
        <span className="text-ink line-clamp-2 text-[15px] leading-snug font-bold break-keep md:line-clamp-1 md:text-base">{item.text}</span>
      </Link>

      {items.length > 1 && (
        <span className="hidden shrink-0 items-center sm:flex" role="group" aria-label="롤링 항목 선택">
          {items.map((it, i) => {
            const active = i === index % items.length;
            return (
              <button
                key={it.id}
                type="button"
                aria-label={`${i + 1}번째 소식 보기`}
                aria-current={active}
                onClick={() => setIndex(i)}
                className="focus-visible:ring-accent-blue/50 flex size-4 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none">
                <span className={cn("size-1.5 rounded-full transition-colors", active ? "bg-brand" : "bg-rule-faint")} />
              </button>
            );
          })}
        </span>
      )}
    </div>
  );
}
