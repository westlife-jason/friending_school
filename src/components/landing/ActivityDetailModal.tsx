"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Loader2, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { applyToActivity, cancelActivityApplication, loadActivityApplicationStatus } from "@/app/activities/actions";
import type { Activity } from "@/data/landing";

// 아웃팅 액티비티 세부정보 + 참가 신청. 정원·승인 없는 자유 참가라 프렌딩 방보다 훨씬 단순한
// 모달이다(RoomInfoModal의 패널 스켈레톤 + RoomBoardModal의 "마운트 시 자가 로드" 패턴을 합쳤다).
export default function ActivityDetailModal({ activity, onClose }: { activity: Activity | null; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [applied, setApplied] = useState(false);
  const [count, setCount] = useState(0);
  const [pending, startTransition] = useTransition();

  const slug = activity?.slug ?? null;

  useEffect(() => {
    if (!slug) return;
    let alive = true;
    setLoading(true);
    loadActivityApplicationStatus(slug).then((res) => {
      if (!alive) return;
      setIsLoggedIn(res.isLoggedIn);
      setApplied(res.applied);
      setCount(res.count);
      setLoading(false);
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      alive = false;
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (!activity || !activity.detail) return null;
  const { detail } = activity;

  const toggleApply = () => {
    if (!slug) return;
    startTransition(async () => {
      const res = applied ? await cancelActivityApplication(slug) : await applyToActivity(slug);
      if (!res.ok) {
        toast.error(res.error ?? "처리하지 못했습니다.");
        return;
      }
      setApplied(!applied);
      setCount((c) => (applied ? Math.max(0, c - 1) : c + 1));
      toast.success(applied ? "신청을 취소했습니다." : "참가 신청이 완료됐습니다.");
    });
  };

  return (
    <>
      <div aria-hidden="true" onClick={onClose} className="fixed inset-0 z-[110] bg-black/40" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${activity.title} 세부정보`}
        className="fixed top-1/2 left-1/2 z-[120] flex max-h-[88vh] w-[min(92vw,600px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="border-rule flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-ink truncate text-lg font-bold">{activity.title}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="text-muted-fg-faint hover:text-ink focus-visible:ring-accent-blue/50 ml-3 shrink-0 rounded transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none">
            <X className="size-5" />
          </button>
        </div>

        <div className="overflow-auto px-6 py-5">
          {detail.images.length > 0 && (
            <div className="mb-4 flex gap-2 overflow-x-auto">
              {detail.images.map((src) => (
                <div key={src} className="relative h-[150px] w-[220px] flex-none overflow-hidden rounded-lg">
                  <Image src={src} alt="" fill sizes="220px" className="object-cover" />
                </div>
              ))}
            </div>
          )}

          <p className="text-ink text-sm leading-relaxed">{activity.desc}</p>

          <dl className="mt-4 grid grid-cols-1 gap-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-muted-fg-faint w-16 shrink-0">일시</dt>
              <dd className="text-ink font-semibold">{detail.when}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-fg-faint w-16 shrink-0">장소</dt>
              <dd className="text-ink flex items-center gap-1 font-semibold">
                <MapPin aria-hidden className="size-3.5" />
                {detail.meetPoint}
              </dd>
            </div>
          </dl>

          {detail.notes.length > 0 && (
            <ul className="text-muted-fg mt-4 flex flex-col gap-1 text-sm leading-relaxed">
              {detail.notes.map((n) => (
                <li key={n}>· {n}</li>
              ))}
            </ul>
          )}

          {detail.en && (
            <div className="border-rule mt-4 border-t pt-4">
              <p className="text-muted-fg-faint mb-2 text-xs font-bold tracking-wide uppercase">English</p>
              <p className="text-ink text-sm leading-relaxed">{detail.en.desc}</p>

              <dl className="mt-3 grid grid-cols-1 gap-2 text-sm">
                <div className="flex gap-2">
                  <dt className="text-muted-fg-faint w-16 shrink-0">Date</dt>
                  <dd className="text-ink font-semibold">{detail.en.when}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-fg-faint w-16 shrink-0">Meet</dt>
                  <dd className="text-ink flex items-center gap-1 font-semibold">
                    <MapPin aria-hidden className="size-3.5" />
                    {detail.en.meetPoint}
                  </dd>
                </div>
              </dl>

              {detail.en.notes.length > 0 && (
                <ul className="text-muted-fg mt-3 flex flex-col gap-1 text-sm leading-relaxed">
                  {detail.en.notes.map((n) => (
                    <li key={n}>· {n}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <p className="text-muted-fg-faint mt-4 text-xs">{loading ? "참가 인원 확인 중…" : `지금까지 ${count}명이 신청했어요.`}</p>
        </div>

        <div className="border-rule flex items-center justify-end gap-2 border-t px-6 py-4">
          {!isLoggedIn ? (
            <Link
              href="/login"
              className="bg-cta rounded-md px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90">
              로그인하고 신청하기
            </Link>
          ) : (
            <button
              type="button"
              onClick={toggleApply}
              disabled={loading || pending}
              className={
                applied
                  ? "border-rule text-muted-fg hover:bg-surface rounded-md border px-4 py-2 text-sm font-bold transition-colors disabled:opacity-60"
                  : "bg-cta inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              }>
              {pending && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
              {applied ? (
                "참가 신청 취소"
              ) : (
                <>
                  <CheckCircle2 aria-hidden className="size-4" />
                  참가 신청하기
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
