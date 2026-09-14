-- 프렌딩 반복모임 — 4탭 리뉴얼 4단계.
--
-- friender_rooms는 이제 "시리즈"(주제·시간대·정원·반복규칙)를 정의하고, 실제 참여 가능한
-- 각 날짜는 friender_room_occurrences 행으로 실체화한다(prep_courses/prep_sessions와 같은 패턴 —
-- 이 앱은 반복되는 것을 가상 계산이 아니라 실제 행으로 미리 만들어두는 관례를 일관되게 쓴다).
--
-- room_id는 참가자·후기 테이블에 계속 남겨둔다(완전 제거하면 기존 room_id 기준 조회가 전부
-- 깨진다) — occurrence_id가 정확한 조인 자격을 결정하고, room_id는 "어느 시리즈였는지" 조회
-- 편의를 위한 비정규화 컬럼이다.

alter table public.friender_rooms
  add column if not exists recurrence_days smallint[]; -- null/빈 배열=1회성. 0=일~6=토(JS getDay와 동일, availability.ts 관례)
alter table public.friender_rooms
  add column if not exists recurrence_until date; -- 반복 마지막 날짜(포함). 1회성이면 null.

create table if not exists public.friender_room_occurrences (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.friender_rooms (id) on delete cascade,
  occurrence_date date not null,
  created_at timestamptz not null default now(),
  unique (room_id, occurrence_date)
);
create index if not exists friender_room_occurrences_room_idx on public.friender_room_occurrences (room_id, occurrence_date);
create index if not exists friender_room_occurrences_date_idx on public.friender_room_occurrences (occurrence_date);

alter table public.friender_room_occurrences enable row level security;
-- friender_rooms와 같은 공개 가시성(방이 보이면 그 회차 날짜도 보인다). 쓰기 정책 없음(service_role만).
create policy "friender_room_occurrences_select_public" on public.friender_room_occurrences
  for select to anon, authenticated
  using (true);

-- 기존 방(전부 1회성이었다)은 자기 자신의 session_date를 유일한 회차로 갖는다.
insert into public.friender_room_occurrences (room_id, occurrence_date)
select id, session_date from public.friender_rooms
on conflict (room_id, occurrence_date) do nothing;

-- ── 참가자: 회차 단위로 전환 ────────────────────────────────────────────
-- ⚠️ PK가 (occurrence_id, user_id)가 되면서, 반복방은 회차마다 별도로 참여할 수 있게 된다
--    (매주 다시 예약) — 1회성 방은 회차가 하나뿐이라 기존과 동일하게 동작한다.
alter table public.friender_room_participants
  add column if not exists occurrence_id uuid references public.friender_room_occurrences (id) on delete cascade;

update public.friender_room_participants p
set occurrence_id = o.id
from public.friender_room_occurrences o
where o.room_id = p.room_id and p.occurrence_id is null;

alter table public.friender_room_participants drop constraint if exists friender_room_participants_pkey;
alter table public.friender_room_participants alter column occurrence_id set not null;
alter table public.friender_room_participants add primary key (occurrence_id, user_id);
create index if not exists friender_room_participants_room_idx on public.friender_room_participants (room_id);

-- ── 후기: 회차 단위로 전환(반복방은 회차마다 후기를 남길 수 있다) ─────────
alter table public.friender_room_reviews
  add column if not exists occurrence_id uuid references public.friender_room_occurrences (id) on delete set null;

update public.friender_room_reviews r
set occurrence_id = o.id
from public.friender_room_occurrences o
where o.room_id = r.room_id and r.occurrence_id is null;

alter table public.friender_room_reviews drop constraint if exists friender_room_reviews_room_id_user_id_key;
create unique index if not exists friender_room_reviews_occurrence_user_key
  on public.friender_room_reviews (occurrence_id, user_id)
  where occurrence_id is not null;

-- ── join_friender_room RPC: 회차 단위로 재정의(첫 인자가 room_id→occurrence_id로 의미 변경) ──
drop function if exists public.join_friender_room(uuid, text);

create function public.join_friender_room(p_occurrence_id uuid, p_user_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_occ public.friender_room_occurrences%rowtype;
  v_room public.friender_rooms%rowtype;
  v_count int;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return 'unauthenticated';
  end if;

  select * into v_occ from public.friender_room_occurrences where id = p_occurrence_id for update;
  if not found then
    return 'not_found';
  end if;
  select * into v_room from public.friender_rooms where id = v_occ.room_id;
  if not found then
    return 'not_found';
  end if;
  if v_room.friender_id = v_uid then
    return 'own_room';
  end if;

  if (v_occ.occurrence_date::timestamp + make_interval(mins => v_room.start_min + v_room.duration_min))
       at time zone 'Asia/Seoul' <= now() then
    return 'ended';
  end if;

  if exists (select 1 from public.friender_room_participants where occurrence_id = p_occurrence_id and user_id = v_uid) then
    return 'already';
  end if;

  -- 샤우팅 전용 방 — 연결된 강좌를 '수강확정'한 학생만 예약할 수 있다(20260914113529와 동일 규칙).
  if v_room.access_type = 'shouting_only' then
    if not exists (
      select 1 from public.prep_enrollments
      where course_id = v_room.linked_prep_course_id
        and user_id = v_uid
        and status = '수강확정'
    ) then
      return 'shouting_required';
    end if;
  end if;

  select count(*) into v_count
  from public.friender_room_participants p
  where p.occurrence_id = p_occurrence_id
    and (
      p.entered_at is not null
      or now() < (v_occ.occurrence_date::timestamp + make_interval(mins => v_room.start_min + 10))
                   at time zone 'Asia/Seoul'
    );
  if v_count >= v_room.capacity then
    return 'full';
  end if;

  insert into public.friender_room_participants (occurrence_id, room_id, user_id, user_name)
    values (p_occurrence_id, v_room.id, v_uid, p_user_name);

  return 'ok';
end;
$$;

revoke all on function public.join_friender_room(uuid, text) from public;
grant execute on function public.join_friender_room(uuid, text) to authenticated;
