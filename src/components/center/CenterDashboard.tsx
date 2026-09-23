import { AlertTriangle, CheckCircle2, GraduationCap, Users, type LucideIcon } from "lucide-react";
import { fmtTime, lessonEndMin } from "@/lib/availability";
import { cn } from "@/lib/utils";
import type { CenterDashboard, TodayClassRow, TodayClassStatus } from "@/lib/center-dashboard";

// 센터 매니저 첫 화면 — 민수 피드백 3분류(개요 / 슬롯 관리 / 출석 관리) 그대로.
// 통계만 보여주고 끝나지 않게, 오늘 수업은 상태별로 바로 훑을 수 있는 목록까지 함께 둔다.
export default function CenterDashboardView({ data }: { data: CenterDashboard }) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-muted-fg-faint mb-2 text-xs font-bold tracking-wide uppercase">Overview</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatTile icon={Users} label="Teachers" value={data.teacherCount} />
          <StatTile icon={GraduationCap} label="Active courses" value={data.activeCourseCount} />
        </div>
      </section>

      <section>
        <h2 className="text-muted-fg-faint mb-2 text-xs font-bold tracking-wide uppercase">Slots</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Open slots" value={data.emptySlotCount} sub="unbooked this week" />
          <StatTile label="Today" value={data.todayClassCount} sub="classes" />
          <StatTile label="Next 7 days" value={data.upcomingWeekClassCount} sub="classes" />
        </div>
      </section>

      <section>
        <h2 className="text-muted-fg-faint mb-2 text-xs font-bold tracking-wide uppercase">Attendance</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatTile
            icon={CheckCircle2}
            label="Checked in"
            value={`${data.teachersCheckedInTodayCount}/${data.teachersWithClassTodayCount}`}
            sub="teachers today"
            tone={data.teachersWithClassTodayCount > 0 && data.teachersCheckedInTodayCount < data.teachersWithClassTodayCount ? "warn" : undefined}
          />
          <StatTile label="Completed" value={data.todayConductedCount} sub="today" />
          <StatTile
            icon={data.todayOverdueCount > 0 ? AlertTriangle : undefined}
            label="Not marked"
            value={data.todayOverdueCount}
            sub="ended, unconfirmed"
            tone={data.todayOverdueCount > 0 ? "danger" : undefined}
          />
        </div>

        {data.todayClasses.length === 0 ? (
          <p className="border-rule text-muted-fg mt-3 rounded-2xl border border-dashed bg-white px-6 py-8 text-center text-sm">
            No classes scheduled today.
          </p>
        ) : (
          <ul className="border-rule mt-3 divide-y overflow-hidden rounded-2xl border bg-white">
            {data.todayClasses.map((c) => (
              <TodayRow key={c.id} row={c} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon?: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  tone?: "warn" | "danger";
}) {
  return (
    <div className="border-rule rounded-2xl border bg-white p-3.5">
      <div className="text-muted-fg-faint flex items-start gap-1">
        {Icon && <Icon aria-hidden className="mt-0.5 size-3 shrink-0" />}
        <p className="text-[11px] leading-tight font-semibold">{label}</p>
      </div>
      <p
        className={cn(
          "mt-1 text-2xl font-extrabold tabular-nums",
          tone === "danger" ? "text-brand" : tone === "warn" ? "text-[#B97400]" : "text-ink",
        )}>
        {value}
      </p>
      {sub && <p className="text-muted-fg-faint mt-0.5 text-[11px] leading-tight">{sub}</p>}
    </div>
  );
}

const STATUS_META: Record<TodayClassStatus, { label: string; className: string }> = {
  conducted: { label: "Completed", className: "bg-[#E6F4EA] text-[#1E7E34]" },
  checked_in: { label: "Checked in", className: "bg-[#E6F4EA] text-[#1E7E34]" },
  late: { label: "Not in yet", className: "bg-[#FFF7E6] text-[#B97400]" },
  waiting: { label: "Upcoming", className: "bg-surface text-muted-fg" },
  overdue: { label: "Not marked", className: "bg-[#FDECEC] text-[#B22222]" },
};

function TodayRow({ row }: { row: TodayClassRow }) {
  const meta = STATUS_META[row.status];
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="text-ink w-16 shrink-0 text-sm font-bold tabular-nums">
        {fmtTime(row.startMin)}
        <span className="text-muted-fg-faint block text-[11px] font-medium">–{fmtTime(lessonEndMin(row.endMin))}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-ink truncate text-sm font-bold">{row.teacherName}</p>
          {row.centerName && <span className="bg-accent-blue-soft text-accent-blue-ink shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold">{row.centerName}</span>}
        </div>
        <p className="text-muted-fg truncate text-xs">{row.studentName}</p>
      </div>
      <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap", meta.className)}>{meta.label}</span>
    </li>
  );
}
