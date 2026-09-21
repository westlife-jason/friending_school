"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { centerPostponeClass } from "@/app/center/actions";
import { fmtTime, formatDate, lessonEndMin } from "@/lib/availability";
import type { CenterClass } from "@/components/center/ReassignModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// 센터 매니저 — 강사 사정으로 수업 연기 확인 창. 필리핀 매니저가 강사와 조율해 "연기"로 결론 낸 뒤 여기서 끝낸다.
export default function PostponeModal({ cls, onClose }: { cls: CenterClass; onClose: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [pending, startTransition] = useTransition();
  const time = `${fmtTime(cls.startMin)}~${fmtTime(lessonEndMin(cls.endMin))}`;

  const close = () => {
    setOpen(false);
    onClose();
  };

  const submit = () => {
    startTransition(async () => {
      const res = await centerPostponeClass(cls.id);
      if (!res.ok) {
        toast.error(res.error ?? "Could not postpone the class.");
        return;
      }
      if (res.makeupDate) toast.success(`Postponed. Makeup lesson: ${res.makeupDate} ${time}.`);
      else toast.warning("Postponed, but the makeup lesson couldn't be created automatically. Please contact the admin.");
      close();
      router.refresh();
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && !pending && close()}>
      <AlertDialogContent className="z-[130]">
        <AlertDialogHeader>
          <AlertDialogTitle>Postpone this class?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="text-ink font-semibold">
              {formatDate(cls.sessionDate, false)} · {time}
            </span>
            <br />
            {cls.courseTitle} · {cls.studentName} · Session {cls.sessionNo}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="text-muted-fg list-disc space-y-1 pl-5 text-sm leading-relaxed">
          <li>A makeup lesson is added after the course&apos;s last session.</li>
          <li>It does not count against the student&apos;s postponements (teacher-side reason).</li>
          <li>The student is notified by text message and the teacher by email.</li>
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Back</AlertDialogCancel>
          <AlertDialogAction onClick={submit} variant="brand" disabled={pending}>
            {pending ? "Postponing…" : "Postpone"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
