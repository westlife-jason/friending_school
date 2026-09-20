import Image from "next/image";
import { cn } from "@/lib/utils";
import type { HubAvatar } from "@/components/hub/types";

const FALLBACK_BG = ["bg-[#6b8ff0]", "bg-[#f06b9d]", "bg-[#22c55e]", "bg-[#f59e0b]", "bg-[#8b5cf6]"];

// 이름 글자 코드로 색을 고정해서 같은 사람은 새로고침해도 같은 색이다.
const bgOf = (name: string) => FALLBACK_BG[Array.from(name).reduce((s, c) => s + c.charCodeAt(0), 0) % FALLBACK_BG.length];

export function Avatar({ avatar, size = 28, className }: { avatar: HubAvatar; size?: number; className?: string }) {
  const initial = Array.from(avatar.name.trim())[0] ?? "?";
  return avatar.avatarUrl ? (
    <Image
      src={avatar.avatarUrl}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={cn("shrink-0 rounded-full object-cover", className)}
    />
  ) : (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white", bgOf(avatar.name), className)}>
      {initial}
    </span>
  );
}

// 아바타를 겹쳐 쌓고 남은 인원은 +N으로 — Slack/Zoom의 "지금 접속 중" 표시와 같은 문법.
export default function AvatarStack({ avatars, total, size = 28 }: { avatars: HubAvatar[]; total: number; size?: number }) {
  if (avatars.length === 0) return null;
  const rest = total - avatars.length;
  return (
    <span className="flex items-center -space-x-2" aria-hidden>
      {avatars.map((a, i) => (
        <Avatar key={`${a.name}-${i}`} avatar={a} size={size} className="ring-2 ring-white" />
      ))}
      {rest > 0 && (
        <span
          style={{ width: size, height: size }}
          className="text-ink-soft inline-flex shrink-0 items-center justify-center rounded-full bg-[#eef1fd] text-[12px] font-bold ring-2 ring-white">
          +{rest}
        </span>
      )}
    </span>
  );
}
