import type { Metadata } from "next";

export const metadata: Metadata = { title: "샤우팅 — 프렌딩 스쿨" };

// TODO(4탭 리뉴얼 3단계): prep_courses 재사용한 독립 페이지로 교체 예정.
// 지금은 Navbar 4탭 개편(1단계)만 반영된 상태라 자리표시자만 둔다.
export default function ShoutingPage() {
  return (
    <div className="bg-surface flex min-h-[50vh] items-center justify-center px-5 text-center">
      <div>
        <span className="bg-brand-gradient mb-3 inline-block rounded-full px-6 py-1.5 text-base font-bold text-white">샤우팅</span>
        <h1 className="text-ink mt-2 text-2xl font-bold">준비 중입니다</h1>
        <p className="text-muted-fg mt-2 text-sm">곧 샤우팅 강좌 목록으로 채워질 예정이에요.</p>
      </div>
    </div>
  );
}
