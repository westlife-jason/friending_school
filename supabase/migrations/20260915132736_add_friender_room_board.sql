-- 프렌딩 연습방 게시판 — 글(공지/일반) + 댓글. 방(시리즈) 단위로 하나씩 묶는다(회차별이 아님) —
-- 반복방이면 매주 화/목 카드 어디서든 같은 게시판을 본다. prep_board(20260903020848)와 같은 패턴.
-- 읽기: friender_rooms_select_public과 동일하게 조건 없음(using(true)). 쓰기: 서버 액션(service_role)
-- 전담 — 작성 자격이 "개설 프렌더(friender_rooms.friender_id) ∥ 참가 이력(friender_room_participants)"라
-- join이 필요하고, 공지는 그중 호스트만이라는 조건이 하나 더 붙어 RLS with check로는 못 담는다.
create type public.friender_room_board_post_kind as enum ('공지', '일반');

create table if not exists public.friender_room_board_posts (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.friender_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 표시 스냅샷 — profiles_select_own RLS라 타인 profiles를 못 읽는다(friender_room_reviews.user_name과 같은 이유).
  author_name text not null,
  -- 작성 시점의 개설 프렌더 여부(배지 표시용 스냅샷). 권한 판정은 매 요청 서버가 다시 계산하므로
  -- 이 값은 authoritative가 아니다.
  is_host boolean not null default false,
  kind public.friender_room_board_post_kind not null default '일반',
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists friender_room_board_posts_room_idx on public.friender_room_board_posts (room_id, kind, created_at desc);

create table if not exists public.friender_room_board_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.friender_room_board_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  is_host boolean not null default false,
  body text not null check (char_length(body) between 1 and 300),
  -- 댓글은 수정이 없다(작성·삭제만) → updated_at·트리거를 두지 않는다.
  created_at timestamptz not null default now()
);

create index if not exists friender_room_board_comments_post_idx on public.friender_room_board_comments (post_id, created_at);

alter table public.friender_room_board_posts enable row level security;
alter table public.friender_room_board_comments enable row level security;

create policy "friender_room_board_posts_select_public" on public.friender_room_board_posts
  for select to anon, authenticated
  using (true);

create policy "friender_room_board_comments_select_public" on public.friender_room_board_comments
  for select to anon, authenticated
  using (true);

-- 사용자 INSERT/UPDATE/DELETE 정책 없음 — prep_board_posts와 같은 이유(위 주석 참고).

create trigger friender_room_board_posts_set_updated_at before update on public.friender_room_board_posts
  for each row execute function public.tg_set_updated_at();
