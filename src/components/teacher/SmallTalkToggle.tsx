"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { setLearningAvailable } from "@/app/teacher/actions";
import { cn } from "@/lib/utils";

// 러닝 탭 "스몰톡" 실시간 토글 — 켜두는 동안 /learning에 뜨고, 학생이 입장하면 자동으로 꺼진다.
export default function SmallTalkToggle({ initialAvailable }: { initialAvailable: boolean }) {
  const [available, setAvailable] = useState(initialAvailable);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !available;
    startTransition(async () => {
      const res = await setLearningAvailable(next);
      if (res.ok) {
        setAvailable(next);
        toast.success(next ? "지금 가능으로 표시됩니다. 러닝 탭에 바로 노출돼요." : "가능 표시를 껐어요.");
      } else {
        toast.error(res.error ?? "저장 중 오류가 발생했습니다.");
      }
    });
  };

  return (
    <div className="border-rule mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white px-6 py-5">
      <div className="min-w-0">
        <h2 className="text-ink flex items-center gap-1.5 text-lg font-bold">
          <MessageCircle aria-hidden className="size-5" />
          스몰톡 실시간 가능
        </h2>
        <p className="text-muted-fg mt-1 text-sm">
          켜두면 러닝 탭에 바로 노출되고, 학생이 입장을 누르면 자동으로 꺼져요. 지금 대화할 준비가 됐을 때만 켜 주세요.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={available}
        onClick={toggle}
        disabled={pending}
        className={cn(
          "relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-60",
          available ? "bg-[#22c55e]" : "bg-rule",
        )}>
        <span
          className={cn(
            "absolute top-1 size-6 rounded-full bg-white shadow transition-transform",
            available ? "translate-x-7" : "translate-x-1",
          )}
        />
      </button>
    </div>
  );
}
