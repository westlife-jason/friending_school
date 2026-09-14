import "server-only";
import { dowOf } from "@/lib/availability";

export type RecurrenceInput = {
  sessionDate: string; // 첫 회차(YYYY-MM-DD)
  recurrenceDays: number[] | null; // null/빈 배열=1회성. 0=일~6=토(dowOf와 동일)
  recurrenceUntil: string | null; // 반복 마지막 날짜(포함). 1회성이면 무시.
};

// 안전판 — 무기한 반복은 지원하지 않는다(회차를 실제 행으로 미리 만들어두는 방식이라
// 끝없이 만들 수는 없다). 주 1회 기준 반년, 주 2~3회면 그보다 짧게 소진된다.
export const MAX_OCCURRENCES = 26;

const addDaysStr = (d: string, days: number): string => {
  const [y, m, day] = d.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, day));
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
};

// 반복 규칙에서 실제 회차 날짜들을 뽑는다. 1회성이면 시작일 하나만 반환.
export function computeOccurrenceDates({ sessionDate, recurrenceDays, recurrenceUntil }: RecurrenceInput): string[] {
  if (!recurrenceDays || recurrenceDays.length === 0) return [sessionDate];
  const until = recurrenceUntil && recurrenceUntil > sessionDate ? recurrenceUntil : sessionDate;
  const days = new Set(recurrenceDays);
  const dates: string[] = [];
  let cursor = sessionDate;
  while (cursor <= until && dates.length < MAX_OCCURRENCES) {
    if (days.has(dowOf(cursor))) dates.push(cursor);
    cursor = addDaysStr(cursor, 1);
  }
  return dates;
}
