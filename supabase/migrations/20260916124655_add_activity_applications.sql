-- 아웃팅 액티비티(하이킹 등) 참가 신청. 액티비티는 아직 코드(src/data/landing.ts)의 정적
-- 데이터라 DB에 activities 테이블이 없다 — slug(코드 상수)로만 어느 액티비티인지 식별한다.
-- 정원·승인 개념이 없는 자유 참가라 friender_rooms보다 훨씬 단순하다: 신청=참가, 취소=탈퇴.
create table if not exists public.activity_applications (
  id uuid primary key default gen_random_uuid(),
  activity_slug text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 표시 스냅샷 — profiles_select_own RLS라 타인 profiles를 못 읽는다(friender_room 계열과 동일 이유).
  user_name text not null,
  created_at timestamptz not null default now(),
  unique (activity_slug, user_id)
);

create index if not exists activity_applications_slug_idx on public.activity_applications (activity_slug);

alter table public.activity_applications enable row level security;

-- 본인 신청만 조회 — 신청자 명단은 공개하지 않는다(참가 인원 수는 서버가 service_role로 집계해 내려준다).
create policy "activity_applications_select_own" on public.activity_applications
  for select to authenticated
  using (auth.uid() = user_id);

-- 쓰기 정책 없음 — 참가자 수 집계는 service_role로만 세므로 일반 사용자에게 select를 넓게 열 필요가
-- 없고, insert/delete도 서버 액션(service_role)이 로그인만 확인하고 처리한다(단순 자유 참가라
-- friender_rooms처럼 정원 검사가 필요 없어 RPC 없이 바로 insert/delete로 충분하다).
