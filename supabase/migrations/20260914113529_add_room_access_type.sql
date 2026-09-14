-- 샤우팅 연습방 무료입장 — 4탭 리뉴얼 3단계(2부).
-- 프렌더가 본인의 승인된 샤우팅 강좌(prep_courses)에 연습방을 연결해두면,
-- 그 강좌를 수강확정한 학생만 입장할 수 있는 "강좌 전용 연습방"을 만들 수 있다.

alter table public.friender_rooms
  add column if not exists access_type text not null default 'public'
    check (access_type in ('public', 'shouting_only'));

alter table public.friender_rooms
  add column if not exists linked_prep_course_id uuid references public.prep_courses (id) on delete set null;

-- 무결성: shouting_only면 반드시 연결된 강좌가 있어야 한다(둘이 따로 놀면 아무도 못 들어오는 방이 된다).
alter table public.friender_rooms
  add constraint friender_rooms_shouting_link_check
  check (access_type <> 'shouting_only' or linked_prep_course_id is not null);

-- 참여 RPC 재선언 — shouting_only 방은 연결된 강좌를 '수강확정'한 학생만 입장 허용.
-- 나머지 정의는 20260821013406 그대로(plpgsql은 부분 수정이 안 돼 본문을 통째로 다시 쓴다).
create or replace function public.join_friender_room(p_room_id uuid, p_user_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.friender_rooms%rowtype;
  v_count int;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return 'unauthenticated';
  end if;

  select * into v_room from public.friender_rooms where id = p_room_id for update;
  if not found then
    return 'not_found';
  end if;
  if v_room.friender_id = v_uid then
    return 'own_room';
  end if;

  if (v_room.session_date::timestamp + make_interval(mins => v_room.start_min + v_room.duration_min))
       at time zone 'Asia/Seoul' <= now() then
    return 'ended';
  end if;

  if exists (select 1 from public.friender_room_participants where room_id = p_room_id and user_id = v_uid) then
    return 'already';
  end if;

  -- 샤우팅 전용 방 — 연결된 강좌를 '수강확정'한 학생만 예약할 수 있다.
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
  where p.room_id = p_room_id
    and (
      p.entered_at is not null
      or now() < (v_room.session_date::timestamp + make_interval(mins => v_room.start_min + 10))
                   at time zone 'Asia/Seoul'
    );
  if v_count >= v_room.capacity then
    return 'full';
  end if;

  insert into public.friender_room_participants (room_id, user_id, user_name)
    values (p_room_id, v_uid, p_user_name);

  return 'ok';
end;
$$;

revoke all on function public.join_friender_room(uuid, text) from public;
grant execute on function public.join_friender_room(uuid, text) to authenticated;
