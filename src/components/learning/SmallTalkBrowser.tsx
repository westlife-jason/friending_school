"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { nationalityLabel } from "@/data/nationalities";
import { genderLabelKo } from "@/data/genders";
import { enterSmallTalk, type SmallTalkTeacher } from "@/app/learning/actions";
import EnterZoomButton from "@/components/EnterZoomButton";

const POLL_MS = 15_000;

// 실시간 가능 강사만 보여준다 — 카드 자체가 소개 전부(별도 상세 모달 없음), 맨 아래 입장 버튼으로 바로 연결.
export default function SmallTalkBrowser({ teachers }: { teachers: SmallTalkTeacher[] }) {
  const router = useRouter();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  // 서버가 새로 내려준 목록으로 교체될 때마다 로컬 숨김 상태를 리셋한다(이미 반영됐으므로).
  useEffect(() => setHiddenIds(new Set()), [teachers]);

  // 폴링 — 강사가 방금 켠 "가능"을 실시간에 가깝게 반영한다(웹소켓 없이 가장 단순한 방법).
  useEffect(() => {
    const t = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [router]);

  const visible = teachers.filter((t) => !hiddenIds.has(t.id));

  if (visible.length === 0) {
    return (
      <div className="border-rule rounded-2xl border bg-white px-5 py-16 text-center">
        <p className="text-ink text-lg font-bold">지금은 가능한 선생님이 없어요</p>
        <p className="text-muted-fg mt-2 text-sm">선생님이 접속하면 여기 바로 나타나요. 잠시 후 다시 확인해 주세요.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {visible.map((t) => (
        <TeacherCard key={t.id} teacher={t} onEntered={() => setHiddenIds((prev) => new Set(prev).add(t.id))} />
      ))}
    </div>
  );
}

function TeacherCard({ teacher, onEntered }: { teacher: SmallTalkTeacher; onEntered: () => void }) {
  const bio = teacher.bio?.trim() ?? "";

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
          <span className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-[#22c55e]">
            <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-[#22c55e]" />
            지금 가능
          </span>
        </div>
      </div>

      {bio && <p className="text-muted-fg mt-3 line-clamp-4 text-sm whitespace-pre-wrap">{bio}</p>}

      <div className="mt-4">
        <EnterZoomButton
          enter={async () => {
            const res = await enterSmallTalk(teacher.id);
            if (res.url) onEntered();
            return res;
          }}
          withGuide
          label="입장하기"
          guideTitle="입장 전 확인해 주세요"
          guideBody="Zoom으로 바로 연결돼요. 화면을 켜고 밝은 인사로 시작해 보세요. 예의를 지켜 즐겁게 대화해요."
          className="bg-cta w-full justify-center rounded-md py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        />
      </div>
    </div>
  );
}
