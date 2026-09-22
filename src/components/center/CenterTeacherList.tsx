"use client";

import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/hub/AvatarStack";
import { nationalityLabelEn } from "@/data/nationalities";
import { genderLabelEn } from "@/data/genders";
import type { CurrentTeacher } from "@/components/admin/TeacherRequestsManager";

// 센터 매니저 '강사 관리' — CurrentTeacherTable(admin, 640px 표)을 그대로 쓰면 폰에서
// 표 전체가 가로로 끌려다녀 "화면이 움직인다"는 문제가 생긴다(실제 사용자 피드백).
// admin 데스크톱 화면(CurrentTeacherTable)은 그대로 두고, 여기서는 카드 목록으로 새로 만든다.
export default function CenterTeacherList({
  teachers,
  onView,
  onViewClasses,
}: {
  teachers: CurrentTeacher[];
  onView: (t: CurrentTeacher) => void;
  onViewClasses?: (t: CurrentTeacher) => void;
}) {
  const sorted = [...teachers].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, "en"));

  return (
    <ul className="flex flex-col gap-3">
      {sorted.map((t) => (
        <li key={t.id} className="border-rule rounded-2xl border bg-white p-4">
          <div className="flex items-start gap-3">
            <Avatar avatar={{ name: t.name || t.email, avatarUrl: t.avatarUrl }} size={44} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-ink truncate text-[15px] font-bold">{t.name || t.email}</p>
                {t.centerName && (
                  <span className="bg-accent-blue-soft text-accent-blue-ink rounded-full px-2 py-0.5 text-xs font-bold">{t.centerName}</span>
                )}
              </div>
              <p className="text-muted-fg mt-0.5 truncate text-sm">
                {nationalityLabelEn(t.nationality)} · {genderLabelEn(t.gender)}
              </p>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => onView(t)}
              className="border-rule text-ink hover:bg-surface focus-visible:ring-accent-blue/50 h-11 flex-1 rounded-xl border text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none">
              View info
            </button>
            {onViewClasses && (
              <button
                type="button"
                onClick={() => onViewClasses(t)}
                className="border-rule text-ink hover:bg-surface focus-visible:ring-accent-blue/50 inline-flex h-11 flex-1 items-center justify-center gap-1 rounded-xl border text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none">
                Classes
                <ChevronRight aria-hidden className="size-3.5" />
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
