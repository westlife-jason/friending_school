import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import SuccessBanner from "@/components/SuccessBanner";

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

export default async function HubPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; verified?: string; signup?: string }>;
}) {
  // 비밀번호 재설정·이메일 인증·회원가입 완료는 "/?reset=success" 등으로 루트에 돌아온다
  // (reset-password/actions.ts · AuthHashHandler) — 콘텐츠가 /friending으로 옮겨간 뒤에도
  // 리다이렉트 대상은 그대로 "/"라서, 이 배너들은 허브 페이지가 계속 소유한다.
  const { reset, verified, signup } = await searchParams;

  return (
    <div className="bg-surface min-h-[calc(100vh-64px)]">
      {reset === "success" && <SuccessBanner queryKey="reset" message="비밀번호가 성공적으로 변경되었습니다." />}
      {verified === "success" && <SuccessBanner queryKey="verified" message="이메일 인증이 완료되어 자동으로 로그인되었습니다." />}
      {signup === "success" && <SuccessBanner queryKey="signup" message="프렌딩 스쿨에 오신 것을 환영합니다." />}

      <div className="mx-auto max-w-[720px] px-5 pt-12 pb-8 text-center md:pt-20 md:pb-12">
        <p className="text-brand text-sm font-bold md:text-base">친구와 친구가 만나 배우는, 프렌딩 스쿨</p>
        <h1 className="text-ink mt-2 text-[26px] font-bold tracking-[-0.03em] md:text-[42px]">오늘은 무엇을 해볼까요?</h1>
        <p className="text-muted-fg mt-3 text-sm md:text-base">아래 4가지 중 하나를 골라 바로 시작해보세요.</p>
      </div>

      <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-5 px-5 pb-16 sm:grid-cols-2 md:gap-6 md:pb-24">
        {HUB_CARDS.map((card) => (
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

            <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 p-5 md:p-7">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-bold text-white/85 md:text-xs">{card.eyebrow}</p>
                <p className="mt-1 text-2xl font-bold tracking-[-0.03em] text-white md:text-[32px]">{card.title}</p>
                <p className="mt-1.5 max-w-[240px] text-xs text-white/80 md:text-sm">{card.desc}</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-bold whitespace-nowrap text-white backdrop-blur-[2px] transition-transform duration-300 group-hover:translate-x-1">
                바로가기
                <ChevronRight aria-hidden className="size-3.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
