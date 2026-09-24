"use client";

import { usePathname } from "next/navigation";

// Footer는 공지 조회 때문에 서버 컴포넌트라 usePathname을 직접 못 쓴다.
// children으로 감싸서 화면에 그릴지만 이 클라이언트 경계에서 결정한다.
export default function ChromeGate({ hideOn, children }: { hideOn: string[]; children: React.ReactNode }) {
  const pathname = usePathname();
  if (hideOn.includes(pathname)) return null;
  return <>{children}</>;
}
