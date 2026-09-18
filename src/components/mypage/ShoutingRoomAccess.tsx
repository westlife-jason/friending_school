import Link from "next/link";
import { fmtTime, formatDateKo } from "@/lib/availability";
import { fmtRoomEnd } from "@/lib/room-time";

export type AccessibleRoom = {
  id: string;
  title: string;
  sessionDate: string; // KST YYYY-MM-DD
  startMin: number;
  durationMin: number;
  courseTitle: string; // 이 방을 열어준 강좌 제목
};

// 샤우팅 강좌를 수강확정한 학생에게 무료로 열린 "강좌 전용 연습방" 안내.
// 예약·입장 자체는 프렌딩 탭(/friending)의 기존 흐름을 그대로 쓴다 — 여기서는 존재를 알려주고 링크만 준다.
export default function ShoutingRoomAccess({ rooms }: { rooms: AccessibleRoom[] }) {
  if (rooms.length === 0) return null;

  return (
    <div className="border-rule rounded-2xl border bg-white p-5">
      <h2 className="text-ink flex items-center gap-1.5 text-base font-extrabold">
        🔊 무료입장 가능한 연습방
        <span className="bg-progress/10 text-progress rounded-full px-2 py-0.5 text-[11px] font-bold">수강생 전용</span>
      </h2>
      <p className="text-muted-fg mt-1 text-sm">수강확정한 샤우팅 강좌의 프렌더가 연 연습방이에요. 무료로 입장할 수 있어요.</p>

      <ul className="border-rule divide-rule mt-3 flex flex-col divide-y rounded-xl border">
        {rooms.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="min-w-0">
              <p className="text-ink truncate text-sm font-bold">{r.title}</p>
              <p className="text-muted-fg-faint mt-0.5 text-xs">
                {formatDateKo(r.sessionDate)} · {fmtTime(r.startMin)}~{fmtRoomEnd(r.startMin + r.durationMin)} · {r.courseTitle}
              </p>
            </div>
            <Link href="/friending" className="text-accent-blue-ink shrink-0 text-sm font-bold underline underline-offset-2 hover:opacity-90">
              프렌딩에서 예약하기
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
