import { DAY_LABELS, DISPLAY_DAYS, SLOT_MIN, fmtTime, slotKey, type Slot } from "@/lib/availability";

// 매니저 화면은 30분 슬롯을 하나씩 탭하지 않고 "09:00 – 12:00" 같은 시간 범위로 입력한다.
// 저장 모델(30분 슬롯)과의 변환을 이 파일이 단일 소스로 맡는다.
// end는 배타적(끝나는 시각) — 09:00–12:00 = 09:00·09:30·…·11:30 슬롯 6개.

export type TimeRange = { start: number; end: number };

export const DAY_MINUTES = 24 * 60;

// 요일 하나의 슬롯 시작 분 목록 → 연속 구간(붙어 있는 슬롯은 한 범위로 합친다).
export function slotsToRanges(mins: number[]): TimeRange[] {
  const sorted = Array.from(new Set(mins)).sort((a, b) => a - b);
  const ranges: TimeRange[] = [];
  for (const m of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && last.end === m) last.end = m + SLOT_MIN;
    else ranges.push({ start: m, end: m + SLOT_MIN });
  }
  return ranges;
}

// 범위 목록 → 슬롯 시작 분 집합(겹치는 범위는 자동으로 합쳐진다). 잘못된 범위(end<=start)는 무시.
export function rangesToMins(ranges: TimeRange[]): number[] {
  const set = new Set<number>();
  for (const r of ranges) {
    if (!(r.end > r.start)) continue;
    for (let m = r.start; m < r.end && m < DAY_MINUTES; m += SLOT_MIN) set.add(m);
  }
  return Array.from(set).sort((a, b) => a - b);
}

// 요일별 범위 맵 → 저장용 슬롯 배열.
export function dayRangesToSlots(byDay: Record<number, TimeRange[]>): Slot[] {
  const out: Slot[] = [];
  for (const [day, ranges] of Object.entries(byDay)) {
    for (const min of rangesToMins(ranges)) out.push({ day: Number(day), min });
  }
  return out;
}

// 저장된 슬롯 배열 → 요일별 범위 맵(0=일 ~ 6=토, 값이 없는 요일도 빈 배열로 채운다).
export function slotsToDayRanges(slots: Slot[]): Record<number, TimeRange[]> {
  const byDay: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const s of slots) byDay[s.day]?.push(s.min);
  const out: Record<number, TimeRange[]> = {};
  for (let d = 0; d < 7; d++) out[d] = slotsToRanges(byDay[d]);
  return out;
}

// 주간 총 가용 시간(시간 단위, 소수 첫째 자리).
export function weeklyHours(slots: Slot[]): number {
  const unique = new Set(slots.map((s) => slotKey(s.day, s.min)));
  return Math.round(((unique.size * SLOT_MIN) / 60) * 10) / 10;
}

// 카드 요약용 — "Mon 09:00–12:00, 14:00–16:00 · Wed 10:00–12:00" (요일 월~일 순, 붙은 슬롯은 한 범위로).
export function summarizeRanges(slots: Slot[], sep = " · "): string {
  const byDay = slotsToDayRanges(slots);
  return DISPLAY_DAYS.filter((d) => byDay[d].length > 0)
    .map((d) => `${DAY_LABELS[DISPLAY_DAYS.indexOf(d)]} ${byDay[d].map((r) => `${fmtTime(r.start)}–${fmtTime(r.end)}`).join(", ")}`)
    .join(sep);
}
