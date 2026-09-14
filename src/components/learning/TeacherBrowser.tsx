"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { nationalityLabel } from "@/data/nationalities";
import { genderLabelKo } from "@/data/genders";
import { summarizeSlots, summarizeWeekdays } from "@/lib/availability";
import { COURSE_SLUGS, getCourse } from "@/data/courses";
import type { EnrollTeacherCard } from "@/app/courses/enroll-actions";
import { cn } from "@/lib/utils";

export type BrowseTeacher = EnrollTeacherCard & { conductedCount: number };

// 강사 브라우징(러닝 탭) — 신청 로직은 새로 만들지 않고 기존 /courses/[slug]/enroll 위저드로
// 넘긴다(?teacher=<id>로 강사를 미리 선택한 채 시작, EnrollWizard의 browseAll 토글 참고).

export default function TeacherBrowser({ teachers }: { teachers: BrowseTeacher[] }) {
  const [detailTarget, setDetailTarget] = useState<BrowseTeacher | null>(null);

  if (teachers.length === 0) {
    return (
      <div className="border-rule rounded-2xl border bg-white px-5 py-16 text-center">
        <p className="text-ink text-lg font-bold">지금은 등록된 강사님이 없어요</p>
        <p className="text-muted-fg mt-2 text-sm">곧 새로운 강사님이 합류할 거예요.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teachers.map((t) => (
          <TeacherCard key={t.id} teacher={t} onOpenDetail={() => setDetailTarget(t)} />
        ))}
      </div>

      <TeacherDetailModal teacher={detailTarget} onClose={() => setDetailTarget(null)} />
    </>
  );
}

function TeacherCard({ teacher, onOpenDetail }: { teacher: BrowseTeacher; onOpenDetail: () => void }) {
  const bio = teacher.bio?.trim() ?? "";
  const weekdays = summarizeWeekdays(teacher.slots);

  return (
    <div className="border-rule flex flex-col rounded-2xl border bg-white p-5">
      <div className="flex items-start gap-3">
        {teacher.avatarUrl ? (
          <Image src={teacher.avatarUrl} alt="" width={56} height={56} className="border-rule size-14 shrink-0 rounded-xl border object-cover" />
        ) : (
          <span className="bg-surface text-muted-fg-faint flex size-14 shrink-0 items-center justify-center rounded-xl text-lg font-bold">
            {teacher.name.charAt(0)}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-ink truncate font-bold">{teacher.name} 강사님</p>
          <p className="text-muted-fg mt-0.5 text-sm">
            {nationalityLabel(teacher.nationality)} · {genderLabelKo(teacher.gender)}
          </p>
        </div>
      </div>

      {bio && <p className="text-muted-fg mt-3 line-clamp-2 text-sm">{bio}</p>}

      <div className="text-muted-fg-faint mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {weekdays && <span className="bg-accent-blue-soft text-accent-blue-ink rounded-full px-2 py-0.5 font-bold">{weekdays} 가능</span>}
        <span>{teacher.conductedCount > 0 ? `${teacher.conductedCount}회 진행` : "아직 진행 이력 없음"}</span>
      </div>

      <button
        type="button"
        onClick={onOpenDetail}
        className="border-rule text-ink hover:bg-surface mt-4 rounded-md border px-4 py-2 text-sm font-bold transition-colors">
        세부정보 보기
      </button>
    </div>
  );
}

function TeacherDetailModal({ teacher, onClose }: { teacher: BrowseTeacher | null; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [courseSlug, setCourseSlug] = useState<string>("");

  useEffect(() => {
    if (!teacher) return;
    setCourseSlug(""); // 강사가 바뀌면 이전에 고른 과정 선택을 지운다.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [teacher, onClose]);

  if (!teacher) return null;

  const fullSchedule = summarizeSlots(teacher.slots);

  return (
    <>
      <div aria-hidden="true" onClick={onClose} className="fixed inset-0 z-[110] bg-black/40" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${teacher.name} 강사님 프로필`}
        className="fixed top-1/2 left-1/2 z-[120] flex max-h-[90vh] w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="border-rule flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-ink truncate text-lg font-bold">강사님 프로필</h2>
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
          <div className="mb-5 flex items-center gap-4">
            {teacher.avatarUrl ? (
              <Image src={teacher.avatarUrl} alt="" width={80} height={80} className="border-rule size-20 rounded-2xl border object-cover" />
            ) : (
              <div className="border-rule bg-surface text-muted-fg-faint flex size-20 shrink-0 items-center justify-center rounded-2xl border text-2xl font-bold">
                {teacher.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-ink truncate text-base font-bold">{teacher.name} 강사님</p>
              <p className="text-muted-fg-faint mt-0.5 text-xs">
                {teacher.conductedCount > 0 ? `${teacher.conductedCount}회 진행` : "아직 진행 이력 없음"}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm">
            {(
              [
                ["국적", nationalityLabel(teacher.nationality)],
                ["성별", genderLabelKo(teacher.gender)],
                ["소속 센터", teacher.centerName ?? "-"],
                ["가능한 시간", fullSchedule || "등록된 가능 시간이 없어요."],
                ["소개", teacher.bio?.trim() || "아직 소개글이 없어요."],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <dt className="text-muted-fg-faint w-20 shrink-0">{label}</dt>
                <dd className="text-ink break-words whitespace-pre-wrap">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="border-rule mt-5 border-t pt-5">
            <p className="text-ink text-sm font-bold">어떤 과정을 신청할까요?</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {COURSE_SLUGS.map((slug) => {
                const course = getCourse(slug);
                if (!course) return null;
                const on = courseSlug === slug;
                return (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => setCourseSlug(slug)}
                    aria-pressed={on}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-xs font-bold transition-colors",
                      on ? "border-progress bg-progress/5 text-ink" : "border-rule text-muted-fg hover:border-rule-faint bg-white",
                    )}>
                    {course.title}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-rule flex justify-end gap-2 border-t px-6 py-4">
          <button type="button" onClick={onClose} className="border-rule text-muted-fg hover:bg-surface rounded-md border px-4 py-2 text-sm font-bold transition-colors">
            닫기
          </button>
          {courseSlug ? (
            <Link
              href={`/courses/${courseSlug}/enroll?teacher=${teacher.id}`}
              className="bg-cta rounded-md px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90">
              이 강사님께 신청하기
            </Link>
          ) : (
            <button type="button" disabled className="bg-rule text-muted-fg-faint cursor-default rounded-md px-4 py-2 text-sm font-bold">
              과정을 먼저 선택하세요
            </button>
          )}
        </div>
      </div>
    </>
  );
}
