import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import SuccessBanner from "@/components/SuccessBanner";
import AvatarStack from "@/components/hub/AvatarStack";
import LiveTicker from "@/components/hub/LiveTicker";
import type { HubAvatar } from "@/components/hub/types";
import { getHubLive } from "@/lib/hub-live";

type HubCard = {
  href: string;
  image: string;
  eyebrow: string;
  title: string;
  desc: string;
};

// 4탭 허브 — 방문자가 첫 화면에서 프렌딩/샤우팅/러닝/아웃팅 중 하나를 골라 들어간다(4탭 리뉴얼 6단계).
// 각 카드의 eyebrow/title은 해당 탭 자신의 히어로 카피를 그대로 재사용 — 톤을 새로 짓지 않고 통일한다.
const HUB_CARDS: HubCard[] = [
  {
    href: "/friending",
    image: "/images/friending-hero.jpg",
    eyebrow: "친구와 친구가 만나 배우는, 프렌딩",
    title: "프렌딩",
    desc: "무료 연습방에서 친구를 만나 자유롭게 말해요.",
  },
  {
    href: "/shouting",
    image: "/images/hero-shouting.jpg",
    eyebrow: "매일 함께 외치는, 샤우팅",
    title: "샤우팅",
    desc: "소리 내어 말하면 입이 트여요.",
  },
  {
    href: "/learning",
    image: "/images/learning-hero.jpg",
    eyebrow: "예약 없이 바로 연결되는, 러닝",
    title: "러닝",
    desc: "선생님과 나누는 스몰톡, 지금 바로 시작해요.",
  },
  {
    href: "/activities",
    image: "/images/activity-hwaseong-1.jpg",
    eyebrow: "원어민 · 세대교감 액티비티",
    title: "아웃팅",
    desc: "교실 밖에서 더 빨리 늘어요.",
  },
];

export default async function HubPage({ searchParams }: { searchParams: Promise<{ reset?: string; verified?: string; signup?: string }> }) {
  // 비밀번호 재설정·이메일 인증·회원가입 완료는 "/?reset=success" 등으로 루트에 돌아온다
  // (reset-password/actions.ts · AuthHashHandler) — 콘텐츠가 /friending으로 옮겨간 뒤에도
  // 리다이렉트 대상은 그대로 "/"라서, 이 배너들은 허브 페이지가 계속 소유한다.
  const { reset, verified, signup } = await searchParams;
  const live = await getHubLive();

  // 카드 위 "지금" 알약 — 값이 0이면 감춘다(빈 숫자는 오히려 죽은 사이트처럼 보인다).
  const pills: Record<string, { avatars: HubAvatar[]; total: number; label: string; pulse?: boolean } | null> = {
    "/friending":
      live.friending.count > 0 ? { avatars: live.friending.avatars, total: live.friending.people, label: `열린 방 ${live.friending.count}개` } : null,
    "/shouting":
      live.shouting.count > 0
        ? { avatars: live.shouting.avatars, total: live.shouting.people, label: `모집 중 강좌 ${live.shouting.count}개` }
        : null,
    "/learning":
      live.learning.count > 0
        ? { avatars: live.learning.avatars, total: live.learning.people, label: `지금 대화 가능 ${live.learning.count}명`, pulse: true }
        : null,
    "/activities":
      live.outing.dday !== null
        ? {
            avatars: [],
            total: 0,
            label: `${live.outing.dday === 0 ? "오늘" : `D-${live.outing.dday}`}${live.outing.applicants > 0 ? ` · 신청 ${live.outing.applicants}명` : ""}`,
          }
        : null,
  };

  return (
    <div className="bg-surface min-h-[calc(100vh-64px)]">
      {reset === "success" && <SuccessBanner queryKey="reset" message="비밀번호가 성공적으로 변경되었습니다." />}
      {verified === "success" && <SuccessBanner queryKey="verified" message="이메일 인증이 완료되어 자동으로 로그인되었습니다." />}
      {signup === "success" && <SuccessBanner queryKey="signup" message="프렌딩 스쿨에 오신 것을 환영합니다." />}

      <div className="mx-auto max-w-[720px] px-5 pt-12 pb-6 text-center md:pt-20 md:pb-8">
        <p className="text-brand text-base font-bold md:text-lg">친구와 친구가 만나 배우는, 프렌딩 스쿨</p>
        <h1 className="text-ink mt-2 text-[28px] font-bold tracking-[-0.03em] md:text-[44px]">오늘은 무엇을 해볼까요?</h1>
        <p className="text-muted-fg mt-3 text-base md:text-lg">아래 4가지 중 하나를 골라 바로 시작해보세요.</p>
      </div>

      <div className="px-5 pb-8 md:pb-10">
        <LiveTicker items={live.ticker} />
      </div>

      <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-5 px-5 pb-16 sm:grid-cols-2 md:gap-6 md:pb-24">
        {HUB_CARDS.map((card) => {
          const pill = pills[card.href];
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group focus-visible:ring-accent-blue/50 relative isolate block aspect-[4/3] overflow-hidden rounded-3xl shadow-sm transition-shadow duration-300 hover:shadow-2xl focus-visible:ring-4 focus-visible:outline-none sm:aspect-[16/11]">
              <Image
                src={card.image}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, 540px"
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/5 transition-colors duration-300 group-hover:from-black/85"
              />

              {pill && (
                <span className="text-ink absolute top-4 left-4 z-10 inline-flex items-center gap-2 rounded-full bg-white/95 py-1.5 pr-3.5 pl-2 text-sm font-bold shadow-md md:top-5 md:left-5 md:text-[15px]">
                  {pill.pulse && <span aria-hidden className="ml-1 size-2 shrink-0 rounded-full bg-[#22c55e] motion-safe:animate-pulse" />}
                  <AvatarStack avatars={pill.avatars} total={pill.total} size={28} />
                  <span className={pill.avatars.length === 0 && !pill.pulse ? "pl-1.5" : undefined}>{pill.label}</span>
                </span>
              )}

              <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 p-5 md:p-7">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-white/95 md:text-sm">{card.eyebrow}</p>
                  <p className="mt-1 text-[28px] font-bold tracking-[-0.03em] text-white md:text-[34px]">{card.title}</p>
                  <p className="mt-1.5 max-w-[280px] text-sm leading-snug text-white/95 md:text-base">{card.desc}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/40 bg-white/15 px-3.5 py-2 text-sm font-bold whitespace-nowrap text-white backdrop-blur-[2px] transition-transform duration-300 group-hover:translate-x-1">
                  바로가기
                  <ChevronRight aria-hidden className="size-4" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
