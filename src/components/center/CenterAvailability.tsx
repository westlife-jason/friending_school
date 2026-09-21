"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Copy, Loader2, Lock, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { centerSaveTeacherAvailability } from "@/app/center/actions";
import { Avatar } from "@/components/hub/AvatarStack";
import { DAY_LABELS, DISPLAY_DAYS, SLOT_MIN, fmtTime, type Slot } from "@/lib/availability";
import { DAY_MINUTES, dayRangesToSlots, slotsToDayRanges, summarizeRanges, weeklyHours, type TimeRange } from "@/lib/availability-ranges";
import type { AvailabilityTeacher } from "@/lib/center-availability";
import { cn } from "@/lib/utils";

const START_OPTIONS: number[] = [];
for (let m = 6 * 60; m < DAY_MINUTES; m += SLOT_MIN) START_OPTIONS.push(m);
const endOptionsAfter = (start: number): number[] => {
  const out: number[] = [];
  for (let m = start + SLOT_MIN; m <= DAY_MINUTES; m += SLOT_MIN) out.push(m);
  return out;
};

type Filter = "all" | "empty" | "set";
type EditRange = TimeRange & { id: string };

// 센터 매니저 — 강사 가용시간 대리 입력. 폰에서 쓰는 것이 기본이라 30분 칸을 하나씩 누르는 그리드가 아니라
// "요일 선택 → 시간 범위 입력 → 다른 요일에 복사" 흐름으로 만들었다(터치 타깃 44px 이상, 세로 스크롤 위주).
export default function CenterAvailability({ teachers: initial }: { teachers: AvailabilityTeacher[] }) {
  const [teachers, setTeachers] = useState(initial);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [centerFilter, setCenterFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => setTeachers(initial), [initial]);

  const centers = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of teachers) if (t.centerId && t.centerName) map.set(t.centerId, t.centerName);
    return Array.from(map.entries());
  }, [teachers]);

  const withData = teachers.filter((t) => t.slots.length > 0).length;
  const pct = teachers.length > 0 ? Math.round((withData / teachers.length) * 100) : 0;

  const shown = teachers.filter((t) => {
    if (filter === "empty" && t.slots.length > 0) return false;
    if (filter === "set" && t.slots.length === 0) return false;
    if (centerFilter !== "all" && t.centerId !== centerFilter) return false;
    return t.name.toLowerCase().includes(query.trim().toLowerCase());
  });

  const editing = teachers.find((t) => t.id === editingId) ?? null;

  if (teachers.length === 0) {
    return (
      <div className="border-rule rounded-2xl border bg-white px-6 py-14 text-center">
        <p className="text-ink text-sm font-bold">No teachers in your center yet.</p>
        <p className="text-muted-fg mt-1 text-sm">Ask the admin to assign teachers to your center.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="border-rule rounded-2xl border bg-white p-4 md:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-ink text-[15px] font-bold">Availability set</p>
          <p className="text-muted-fg text-sm">
            <span className="text-ink font-bold">{withData}</span> of {teachers.length} teachers
          </p>
        </div>
        <div className="bg-rule mt-2.5 h-2 overflow-hidden rounded-full" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="bg-brand-gradient h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-muted-fg-faint mt-2 text-[13px] leading-relaxed">
          Students are only matched with teachers who have availability here. Enter each teacher&apos;s weekly hours once, then keep them up to date.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        <div className="relative">
          <Search aria-hidden className="text-muted-fg-faint absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teachers"
            className="border-rule focus-visible:ring-accent-blue/50 h-11 w-full rounded-xl border bg-white pr-3 pl-10 text-[15px] focus-visible:ring-2 focus-visible:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", `All (${teachers.length})`],
              ["empty", `Not set (${teachers.length - withData})`],
              ["set", `Set (${withData})`],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={cn(
                "focus-visible:ring-accent-blue/50 h-10 rounded-full border px-4 text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none",
                filter === key ? "border-accent-blue-ink bg-accent-blue-soft text-accent-blue-ink" : "border-rule text-muted-fg bg-white",
              )}>
              {label}
            </button>
          ))}
          {centers.length > 1 && (
            <select
              value={centerFilter}
              onChange={(e) => setCenterFilter(e.target.value)}
              aria-label="Filter by center"
              className="border-rule text-muted-fg focus-visible:ring-accent-blue/50 h-10 rounded-full border bg-white px-3 text-sm font-bold focus-visible:ring-2 focus-visible:outline-none">
              <option value="all">All centers</option>
              {centers.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <ul className="mt-4 space-y-3">
        {shown.length === 0 && <li className="text-muted-fg py-10 text-center text-sm">No teachers match.</li>}
        {shown.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => setEditingId(t.id)}
              className="border-rule hover:border-accent-blue/50 focus-visible:ring-accent-blue/50 flex w-full items-center gap-3 rounded-2xl border bg-white p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none">
              <Avatar avatar={{ name: t.name, avatarUrl: t.avatarUrl }} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-ink truncate text-[15px] font-bold">{t.name}</p>
                  {t.centerName && (
                    <span className="bg-accent-blue-soft text-accent-blue-ink rounded-full px-2 py-0.5 text-xs font-bold">{t.centerName}</span>
                  )}
                </div>
                {t.slots.length === 0 ? (
                  <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-[#B45309]">
                    <AlertTriangle aria-hidden className="size-3.5" />
                    Not set — tap to add hours
                  </p>
                ) : (
                  <>
                    <p className="text-muted-fg mt-1 line-clamp-2 text-sm leading-snug">{summarizeRanges(t.slots)}</p>
                    <p className="text-muted-fg-faint mt-0.5 text-xs font-semibold">{weeklyHours(t.slots)} h / week</p>
                  </>
                )}
              </div>
              <span className="text-accent-blue-ink shrink-0 text-sm font-bold">Edit</span>
            </button>
          </li>
        ))}
      </ul>

      {editing && (
        <AvailabilityEditor
          key={editing.id}
          teacher={editing}
          onClose={() => setEditingId(null)}
          onSaved={(slots) => {
            setTeachers((prev) => prev.map((t) => (t.id === editing.id ? { ...t, slots } : t)));
            setEditingId(null);
          }}
        />
      )}
    </div>
  );
}

let idSeq = 0;
const newId = () => `r${++idSeq}`;
const withIds = (byDay: Record<number, TimeRange[]>): Record<number, EditRange[]> => {
  const out: Record<number, EditRange[]> = {};
  for (let d = 0; d < 7; d++) out[d] = (byDay[d] ?? []).map((r) => ({ ...r, id: newId() }));
  return out;
};
const toPlain = (byDay: Record<number, EditRange[]>): Record<number, TimeRange[]> => {
  const out: Record<number, TimeRange[]> = {};
  for (let d = 0; d < 7; d++) out[d] = byDay[d].map(({ start, end }) => ({ start, end }));
  return out;
};

function AvailabilityEditor({ teacher, onClose, onSaved }: { teacher: AvailabilityTeacher; onClose: () => void; onSaved: (slots: Slot[]) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [byDay, setByDay] = useState<Record<number, EditRange[]>>(() => withIds(slotsToDayRanges(teacher.slots)));
  const firstDay = DISPLAY_DAYS.find((d) => teacher.slots.some((s) => s.day === d)) ?? 1;
  const [day, setDay] = useState<number>(firstDay);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTargets, setCopyTargets] = useState<number[]>([]);

  const slots = useMemo(() => dayRangesToSlots(toPlain(byDay)), [byDay]);
  const original = useMemo(() => new Set(teacher.slots.map((s) => `${s.day}-${s.min}`)), [teacher.slots]);
  const dirty = slots.length !== original.size || slots.some((s) => !original.has(`${s.day}-${s.min}`));
  const booked = useMemo(() => new Set(teacher.bookedSlots.map((s) => `${s.day}-${s.min}`)), [teacher.bookedSlots]);

  // Esc로 닫기 + 배경 스크롤 잠금(모달이 열린 동안 뒤 화면이 같이 움직이면 폰에서 조작이 어렵다).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !pending && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, pending]);

  const setDayRanges = (d: number, next: EditRange[]) => setByDay((prev) => ({ ...prev, [d]: next }));

  const addRange = () => {
    const list = byDay[day];
    const last = list[list.length - 1];
    const start = last && last.end <= DAY_MINUTES - 2 * SLOT_MIN ? last.end : 9 * 60;
    setDayRanges(day, [...list, { id: newId(), start, end: Math.min(start + 180, DAY_MINUTES) }]);
  };

  const updateRange = (id: string, patch: Partial<TimeRange>) =>
    setDayRanges(
      day,
      byDay[day].map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        if (next.end <= next.start) next.end = Math.min(next.start + SLOT_MIN, DAY_MINUTES);
        return next;
      }),
    );

  const removeRange = (id: string) =>
    setDayRanges(
      day,
      byDay[day].filter((r) => r.id !== id),
    );

  const applyCopy = () => {
    if (copyTargets.length === 0) return;
    setByDay((prev) => {
      const next = { ...prev };
      for (const t of copyTargets) next[t] = prev[day].map(({ start, end }) => ({ id: newId(), start, end }));
      return next;
    });
    toast.success(`Copied ${DAY_LABELS[DISPLAY_DAYS.indexOf(day)]} to ${copyTargets.length} day${copyTargets.length > 1 ? "s" : ""}.`);
    setCopyOpen(false);
    setCopyTargets([]);
  };

  const save = () =>
    startTransition(async () => {
      const res = await centerSaveTeacherAvailability(teacher.id, slots);
      if (!res.ok) {
        toast.error(res.error ?? "Could not save.");
        return;
      }
      toast.success("Availability saved.");
      onSaved(slots);
      router.refresh();
    });

  const dayLabel = DAY_LABELS[DISPLAY_DAYS.indexOf(day)];
  const otherDays = DISPLAY_DAYS.filter((d) => d !== day);
  const rangeHasBooked = (r: TimeRange) => {
    for (let m = r.start; m < r.end; m += SLOT_MIN) if (booked.has(`${day}-${m}`)) return true;
    return false;
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Edit availability for ${teacher.name}`}>
      <div aria-hidden onClick={() => !pending && onClose()} className="absolute inset-0 bg-black/40" />
      <div className="relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:max-w-[520px] sm:rounded-3xl">
        <div className="border-rule flex items-center gap-3 border-b px-5 py-4">
          <Avatar avatar={{ name: teacher.name, avatarUrl: teacher.avatarUrl }} size={40} />
          <div className="min-w-0 flex-1">
            <p className="text-ink truncate text-base font-bold">{teacher.name}</p>
            <p className="text-muted-fg text-xs">{teacher.centerName ?? "No center"} · weekly availability</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Close"
            className="text-muted-fg hover:text-ink focus-visible:ring-accent-blue/50 flex size-11 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none">
            <X className="size-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Day of week">
            {DISPLAY_DAYS.map((d, i) => {
              const count = byDay[d].length;
              const active = d === day;
              return (
                <button
                  key={d}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setDay(d);
                    setCopyOpen(false);
                    setCopyTargets([]);
                  }}
                  className={cn(
                    "focus-visible:ring-accent-blue/50 relative flex h-12 min-w-[3.4rem] shrink-0 flex-col items-center justify-center rounded-xl border text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none",
                    active ? "border-accent-blue-ink bg-accent-blue-soft text-accent-blue-ink" : "border-rule text-muted-fg bg-white",
                  )}>
                  {DAY_LABELS[i]}
                  <span className={cn("mt-0.5 h-1 w-1 rounded-full", count > 0 ? "bg-[#22c55e]" : "bg-transparent")} />
                </button>
              );
            })}
          </div>

          <div className="mt-4 space-y-3">
            {byDay[day].length === 0 && (
              <p className="text-muted-fg bg-surface rounded-xl px-4 py-5 text-center text-sm">
                Not available on {dayLabel}. Add a time range, or leave it empty.
              </p>
            )}
            {byDay[day].map((r) => {
              const locked = rangeHasBooked(r);
              return (
                <div key={r.id} className="border-rule rounded-xl border p-3">
                  <div className="flex items-center gap-2">
                    <select
                      aria-label="Start time"
                      value={r.start}
                      onChange={(e) => updateRange(r.id, { start: Number(e.target.value) })}
                      className="border-rule focus-visible:ring-accent-blue/50 h-11 min-w-0 flex-1 rounded-lg border bg-white px-2 text-[15px] font-semibold focus-visible:ring-2 focus-visible:outline-none">
                      {START_OPTIONS.map((m) => (
                        <option key={m} value={m}>
                          {fmtTime(m)}
                        </option>
                      ))}
                    </select>
                    <span aria-hidden className="text-muted-fg-faint">
                      –
                    </span>
                    <select
                      aria-label="End time"
                      value={r.end}
                      onChange={(e) => updateRange(r.id, { end: Number(e.target.value) })}
                      className="border-rule focus-visible:ring-accent-blue/50 h-11 min-w-0 flex-1 rounded-lg border bg-white px-2 text-[15px] font-semibold focus-visible:ring-2 focus-visible:outline-none">
                      {endOptionsAfter(r.start).map((m) => (
                        <option key={m} value={m}>
                          {fmtTime(m)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeRange(r.id)}
                      aria-label="Remove time range"
                      className="text-muted-fg hover:text-brand focus-visible:ring-accent-blue/50 flex size-11 shrink-0 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:outline-none">
                      <Trash2 className="size-[18px]" />
                    </button>
                  </div>
                  {locked && (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#B45309]">
                      <Lock aria-hidden className="size-3" />
                      Includes booked lesson times — those can&apos;t be removed.
                    </p>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={addRange}
              className="border-accent-blue/40 text-accent-blue-ink focus-visible:ring-accent-blue/50 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed text-sm font-bold focus-visible:ring-2 focus-visible:outline-none">
              <Plus aria-hidden className="size-4" />
              Add time range
            </button>
          </div>

          {byDay[day].length > 0 && (
            <div className="mt-4">
              {!copyOpen ? (
                <button
                  type="button"
                  onClick={() => setCopyOpen(true)}
                  className="text-accent-blue-ink focus-visible:ring-accent-blue/50 inline-flex h-11 items-center gap-1.5 rounded-lg px-1 text-sm font-bold focus-visible:ring-2 focus-visible:outline-none">
                  <Copy aria-hidden className="size-4" />
                  Copy {dayLabel} to other days
                </button>
              ) : (
                <div className="bg-surface rounded-xl p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-ink text-sm font-bold">Copy {dayLabel} to…</p>
                    <div className="flex gap-3 text-xs font-bold">
                      <button
                        type="button"
                        className="text-accent-blue-ink h-8"
                        onClick={() => setCopyTargets(otherDays.filter((d) => d >= 1 && d <= 5))}>
                        Weekdays
                      </button>
                      <button type="button" className="text-accent-blue-ink h-8" onClick={() => setCopyTargets(otherDays)}>
                        All days
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {otherDays.map((d) => {
                      const on = copyTargets.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setCopyTargets((prev) => (on ? prev.filter((x) => x !== d) : [...prev, d]))}
                          className={cn(
                            "h-11 min-w-[3.4rem] rounded-lg border text-sm font-bold",
                            on ? "border-accent-blue-ink bg-accent-blue-ink text-white" : "border-rule text-muted-fg bg-white",
                          )}>
                          {DAY_LABELS[DISPLAY_DAYS.indexOf(d)]}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-muted-fg-faint mt-2 text-xs">This replaces the selected days&apos; existing hours.</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={applyCopy}
                      disabled={copyTargets.length === 0}
                      className="bg-cta h-11 flex-1 rounded-lg text-sm font-bold text-white disabled:opacity-40">
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCopyOpen(false);
                        setCopyTargets([]);
                      }}
                      className="border-rule text-muted-fg h-11 rounded-lg border bg-white px-4 text-sm font-bold">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-rule flex items-center gap-3 border-t bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="text-muted-fg min-w-0 flex-1 text-sm">
            <span className="text-ink font-bold">{weeklyHours(slots)} h</span> / week
          </p>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="border-rule text-muted-fg h-12 rounded-xl border bg-white px-5 text-sm font-bold disabled:opacity-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || pending}
            className="bg-cta inline-flex h-12 items-center justify-center gap-1.5 rounded-xl px-6 text-sm font-bold text-white disabled:opacity-40">
            {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
