-- 러닝 탭 "스몰톡" — 강사가 "지금 가능"으로 켜두면 그 순간 학생이 골라 바로 Zoom으로
-- 들어가는 즉석 1:1 방식이다(주간 시간표 예약이 아니라 실시간 온/오프 토글).
-- teacher_availability(주간 템플릿)와는 별개 — 기존 커리큘럼 과정 신청 흐름은 그대로 둔다.
alter table public.profiles
  add column if not exists learning_available boolean not null default false;
