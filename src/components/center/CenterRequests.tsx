"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { centerApproveEnrollment, centerRejectEnrollment } from "@/app/center/actions";
import { summarizeRanges } from "@/lib/availability-ranges";
import type { CenterRequest } from "@/lib/center-requests";
import { cn } from "@/lib/utils";
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

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  결제대기: { label: "Awaiting payment", className: "bg-[#FFF7E6] text-[#B97400]" },
  승인: { label: "Approved", className: "bg-[#FFF7E6] text-[#B97400]" },
  결제완료: { label: "Confirmed", className: "bg-[#E6F4EA] text-[#1E7E34]" },
  거절: { label: "Declined", className: "bg-[#FDECEC] text-[#B22222]" },
  취소: { label: "Cancelled", className: "bg-surface text-muted-fg" },
};

// 센터 매니저 — 수강신청 승인/거절. 필리핀 강사는 시스템에 로그인하지 않으므로 강사 관리 책임을 가진 매니저가 처리한다.
export default function CenterRequests({ pending: initialPending, recent: initialRecent }: { pending: CenterRequest[]; recent: CenterRequest[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(initialPending);
  const [recent, setRecent] = useState(initialRecent);
  const [busy, startTransition] = useTransition();
  const [approveTarget, setApproveTarget] = useState<CenterRequest | null>(null);
  const [declineTarget, setDeclineTarget] = useState<CenterRequest | null>(null);
  const [reason, setReason] = useState("");

  const moveToRecent = (req: CenterRequest, status: string, note: string | null) => {
    setPending((prev) => prev.filter((r) => r.id !== req.id));
    setRecent((prev) => [{ ...req, status, note, conflict: false, outsideAvailability: false }, ...prev].slice(0, 15));
  };

  const approve = () => {
    const target = approveTarget;
    setApproveTarget(null);
    if (!target) return;
    startTransition(async () => {
      const res = await centerApproveEnrollment(target.id);
      if (!res.ok) {
        toast.error(res.error ?? "Could not approve.");
        return;
      }
      toast.success(`Approved ${target.studentName}. The student can now pay.`);
      moveToRecent(target, "결제대기", null);
      router.refresh();
    });
  };

  const decline = () => {
    const target = declineTarget;
    const text = reason.trim();
    if (!target || !text) return;
    setDeclineTarget(null);
    setReason("");
    startTransition(async () => {
      const res = await centerRejectEnrollment(target.id, text);
      if (!res.ok) {
        toast.error(res.error ?? "Could not decline.");
        return;
      }
      toast.success(`Declined ${target.studentName}.`);
      moveToRecent(target, "거절", text);
      router.refresh();
    });
  };

  return (
    <div>
      <div className="border-rule rounded-2xl border bg-white p-4 md:p-5">
        <p className="text-ink text-[15px] font-bold">
          {pending.length > 0 ? `${pending.length} request${pending.length > 1 ? "s" : ""} waiting for you` : "No requests waiting"}
        </p>
        <p className="text-muted-fg-faint mt-1 text-[13px] leading-relaxed">
          Approving holds the time slot and asks the student to pay. Decline if the teacher can&apos;t take the slot — the student is told why.
        </p>
      </div>

      <ul className="mt-4 space-y-3">
        {pending.length === 0 && (
          <li className="border-rule text-muted-fg rounded-2xl border border-dashed bg-white px-6 py-12 text-center text-sm">
            New enrollment requests will appear here.
          </li>
        )}
        {pending.map((r) => (
          <li key={r.id} className="border-rule rounded-2xl border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-ink truncate text-base font-bold">{r.studentName}</p>
                <p className="text-muted-fg mt-0.5 text-sm">{r.courseTitle}</p>
              </div>
              <span className="text-muted-fg-faint shrink-0 text-xs font-semibold">{r.createdLabel}</span>
            </div>

            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex gap-3">
                <dt className="text-muted-fg-faint w-16 shrink-0">Teacher</dt>
                <dd className="text-ink min-w-0 font-semibold">
                  {r.teacherName}
                  {r.centerName && (
                    <span className="bg-accent-blue-soft text-accent-blue-ink ml-2 rounded-full px-2 py-0.5 text-xs font-bold">{r.centerName}</span>
                  )}
                </dd>
              </div>
              <div className="flex gap-3">
                <dt className="text-muted-fg-faint w-16 shrink-0">Weekly</dt>
                <dd className="text-ink min-w-0 font-semibold">{summarizeRanges(r.slots) || "—"}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="text-muted-fg-faint w-16 shrink-0">Starts</dt>
                <dd className="text-ink font-semibold">
                  {r.startDate} · {r.totalSessions} lessons
                </dd>
              </div>
            </dl>

            {(r.conflict || r.outsideAvailability) && (
              <div className="mt-3 space-y-1.5">
                {r.conflict && (
                  <p className="flex items-start gap-1.5 rounded-lg bg-[#FFF7E6] px-3 py-2 text-xs leading-relaxed font-semibold text-[#B97400]">
                    <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                    Overlaps with another pending request for this teacher — approving one blocks the other.
                  </p>
                )}
                {r.outsideAvailability && (
                  <p className="flex items-start gap-1.5 rounded-lg bg-[#FFF7E6] px-3 py-2 text-xs leading-relaxed font-semibold text-[#B97400]">
                    <CalendarClock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                    These times are outside the teacher&apos;s current availability. Check Availability before approving.
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setApproveTarget(r)}
                disabled={busy}
                className="bg-cta focus-visible:ring-accent-blue/50 inline-flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50">
                {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
                Approve
              </button>
              <button
                type="button"
                onClick={() => setDeclineTarget(r)}
                disabled={busy}
                className="border-brand/40 text-brand hover:bg-brand/5 focus-visible:ring-accent-blue/50 h-12 flex-1 rounded-xl border text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50">
                Decline
              </button>
            </div>
          </li>
        ))}
      </ul>

      {recent.length > 0 && (
        <details className="mt-6" open>
          <summary className="text-ink cursor-pointer py-2 text-sm font-extrabold">Recently handled ({recent.length})</summary>
          <ul className="border-rule mt-2 divide-y overflow-hidden rounded-2xl border bg-white">
            {recent.map((r) => {
              const s = STATUS_LABEL[r.status] ?? { label: r.status, className: "bg-surface text-muted-fg" };
              return (
                <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-ink truncate text-sm font-bold">{r.studentName}</p>
                    <p className="text-muted-fg mt-0.5 truncate text-xs">
                      {r.teacherName} · {summarizeRanges(r.slots) || "—"}
                    </p>
                    {r.status === "거절" && r.note && <p className="text-muted-fg-faint mt-0.5 line-clamp-2 text-xs">Reason: {r.note}</p>}
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold", s.className)}>{s.label}</span>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      <AlertDialog open={approveTarget !== null} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this request?</AlertDialogTitle>
            <AlertDialogDescription>
              {approveTarget && (
                <>
                  <span className="text-ink font-semibold">{approveTarget.studentName}</span> with{" "}
                  <span className="text-ink font-semibold">{approveTarget.teacherName}</span>. The time slot is held and the student is asked to pay.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction onClick={approve} variant="brand">
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={declineTarget !== null}
        onOpenChange={(o) => {
          if (!o) {
            setDeclineTarget(null);
            setReason("");
          }
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline this request?</AlertDialogTitle>
            <AlertDialogDescription>
              {declineTarget && (
                <>
                  <span className="text-ink font-semibold">{declineTarget.studentName}</span> will be told the reason by text message. The slot opens
                  up again.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* ⚠️ AlertDialogDescription은 <p>라 입력창은 그 바깥 형제로 둔다. */}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Reason (e.g. the teacher isn't available at this time — please suggest another time)"
            className="border-rule focus-visible:ring-accent-blue/50 w-full resize-none rounded-lg border p-3 text-[15px] focus-visible:ring-2 focus-visible:outline-none"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction onClick={decline} variant="brand" disabled={reason.trim().length === 0}>
              Decline
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
