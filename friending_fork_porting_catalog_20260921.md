# 포크(개인 샌드박스) → 원본 이관 목록 (2026-09-21)

> `westlife-jason/friending_school`(개인 포크·샌드박스)에서 만든 변경을, 인수인계 후 **회사 원본(`82orez/friending_school`)에 선별 이식**하기 위한 카탈로그.
> 병합(merge)은 하지 않는다 — 원본이 같은 기능(반복방·게시판)을 다른 DB 구조로 따로 만들어서 충돌하기 때문(2절). **재구현/이식** 기준으로 정리했다.

## 0. 기준선

| 항목 | 값 |
|---|---|
| 공통 조상 | `cb44de8` |
| 포크에서만 생긴 커밋 | 21개 (`80ff11d` … `2487c80`, 부록 A) |
| 포크 HEAD | `2487c80` (2026-09-20) |
| 원본 upstream/main | `2d27ad2` (2026-09-18, 태근) — 포크보다 17커밋 앞섬 |
| 포크가 바꾼 파일 | 55개 / 원본이 바꾼 파일 41개 / **양쪽 다 바꾼 파일 11개** |
| Supabase | 포크=개인 프로젝트(`jqomfm…`), 회사 운영 DB와 무관 |
| 배포 | `friending-school-gamma.vercel.app`(개인 Vercel, 시안 공유용) |

> 원본 상태는 2026-09-21에 `git fetch upstream`으로 확인한 시점 기준이다. 태근이 계속 커밋하므로 **이식 직전에 다시 비교**할 것:
> `git fetch upstream && git diff --name-only $(git merge-base main upstream/main) upstream/main`

권장: 이 시점을 고정해 두기 — `git tag fork-final-2026-09-21` (로컬 태그, 푸시는 선택).

---

## 1. 한눈에 보기

| 분류 | 의미 | 항목 | 난이도 |
|---|---|---|---|
| **A. DB 무관** | 화면·카피·스타일만. 원본 스키마와 무관 | 4탭 골격·메뉴, 글자 크기, 히어로 정리, 아웃팅 카피/모먼츠, 메뉴 밑줄 | 쉬움 (수동 재적용) |
| **B. DB 필요** | 새 테이블/컬럼 필요 → 원본 스키마 기준으로 마이그레이션 **새로 작성** | 아웃팅 참가신청, 러닝 스몰톡, 샤우팅 전용 연습방 | 중간 |
| **B'. DB 의존 UI** | 화면은 이식 가능하나 **조회 쿼리를 원본 스키마에 맞게 재작성** | 첫 화면 실시간 숫자·LIVE 띠 | 중간 |
| **C. 충돌** | 원본에 같은 기능이 이미 있음 → **원본 것 채택**, 우리 것은 참고만 | 반복방(회차), 방 게시판 | (이식 안 함) |
| **D. 개발 편의** | 이식 대상 아님/자동 처리 | `start-dev.bat`, 타입 재생성, lockfile | — |
| **E. 샌드박스 전용** | 이식 금지 | 데모 계정/데이터, 배포 설정, 데모 사진 일부 | — |

---

## 2. 원본과 충돌하는 영역 (병합 불가 이유)

| 기능 | 포크(우리) | 원본(태근) | 결론 |
|---|---|---|---|
| 반복방 | `20260914125155_add_room_recurrence_occurrences.sql` (`friender_room_occurrences` 테이블, 회차 실체화), `src/lib/room-recurrence.ts` | `20260917233513_add_friender_room_series.sql` (`friender_room_series`) | **택일** — 원본 채택 |
| 방 게시판 | `20260915132736_add_friender_room_board.sql`, `src/app/friending/board-actions.ts`, `RoomBoardModal.tsx` (시리즈 단위) | `20260918070523_add_room_board.sql`, 같은 경로 `board-actions.ts` | **택일** — 원본 채택 |
| 샤우팅 접수 시간 | 코드/주석에 KST 10:00~19:00 가정 | `20260916215319_prep_apply_window_open_11am.sql` (11시 오픈으로 변경) | 원본 기준으로 통일 |

**양쪽이 모두 수정한 11개 파일** (이식 시 수동 조정 필요):
`docs/prep.md`, `package-lock.json`, `src/app/friender/(dashboard)/rooms/page.tsx`, `src/app/friender/actions.ts`, `src/app/friending/board-actions.ts`, `src/app/mypage/rooms/page.tsx`, `src/app/page.tsx`, `src/components/friender/RoomsManager.tsx`, `src/components/friending/FriendingRooms.tsx`, `src/components/prep/PrepEnrollBanner.tsx`, `src/types/database.types.ts`

⚠️ 원본이 **손대지 않은** 영역: 센터·강사·가용시간·수업 대체(`center`, `teacher`, `availab*`, `classes`, `reassign`, `makeup`, `classroom`). → 앞으로 이 영역에서 만드는 기능(강사 스케줄 관리)은 충돌 없이 이식 가능.

---

## 3. 분류별 상세

### A. DB 무관 (수동 재적용 권장)

**A-1. 4탭 골격 + 라우트 구조** — 난이도 M (구조 변경이라 합의 필요, 5절)
- 커밋: `c90f02c`(Navbar 4탭·`/learning`·`/shouting` 신설·`/philippines-english` 삭제), `40fb5e5`(샤우팅 배너를 홈→`/shouting`), `774fae3`(첫 화면 허브, 프렌딩 목록을 `/friending`으로 이동)
- 파일: `src/app/page.tsx`(허브), `src/app/friending/page.tsx`(신규), `src/app/shouting/page.tsx`, `src/app/learning/page.tsx`, `src/components/Navbar.tsx`, `src/components/mypage/ShoutingRoomAccess.tsx`(링크 `/`→`/friending`)
- 주의:
  - 인증 리다이렉트(`/?reset=success`, `/?verified=success`, `/?signup=success`)는 **루트로 돌아오므로 허브가 배너를 소유**한다(리다이렉트 대상은 안 바꿈).
  - `revalidatePath("/")`가 여러 액션(`friending/actions.ts`, `friender/actions.ts`, `admin/actions.ts` 등)에 있다. 동적 페이지라 동작엔 문제 없었지만 `/friending`도 함께 재검증할지 검토.
  - 허브에서는 데스크톱 상단 4탭 메뉴를 숨김(`usePathname() === "/"`).
  - `c90f02c`가 함께 고친 파일(2026-09-21 `git show`로 확인): `EnrollWizard.tsx`·`StudentEnrollments.tsx`의 링크 `/philippines-english`→`/learning`, `SpeakingDevelopSection.tsx`·`school/page.tsx`는 **주석만** 수정(`/school`은 admin 전용, 4탭 개편 후 nav에서 제외).
  - `/philippines-english` 페이지와 `src/data/philippines-english.ts`를 **삭제**했다(기존 학생용 "과정 보기" 페이지). 원본에서 삭제해도 되는지(SEO·기존 링크) 합의 필요.
  - **후속 문제**: `d5fbc9e`로 `/learning`이 스몰톡 전용이 되면서 과정 목록이 없어졌다. 그래서 마이페이지 "수강신청 내역"의 "과정 둘러보기 → `/learning`"은 **막다른 링크**가 됐다. 정규 과정(`/courses/<slug>`)으로 들어가는 입구는 지금 햄버거 메뉴의 "커리큘럼"뿐이다 → 이식 시 정규 과정의 진입 동선을 어디에 둘지 함께 결정.
  - 🔴 **회귀(포크에서 발생, 이식 금지)**: `c90f02c`의 Navbar/`layout.tsx` 교체가 **센터 매니저 감지(`centerManager`, `centers.manager_id` 조회)와 Navbar의 `isCenterManager` "센터 관리" 링크(데스크톱·모바일)를 제거**했다. 원본(`upstream/main`)과 공통 조상에는 그대로 있다. `/center` 라우트 자체는 살아 있지만 **포크에서는 매니저 계정에 메뉴가 안 보인다.** → **포크에서는 2026-09-21에 복구함**(`layout.tsx`의 `centerManager` 조회 + Navbar 데스크톱/모바일 "Center Management" 링크, 매니저에겐 "마이페이지" 대신 노출 — 원본과 동일 동작. 매니저 계정으로 로그인해 확인). Navbar를 이식할 때는 원본의 `isCenterManager`를 **반드시 유지**할 것. (같은 커밋이 추가한 `프렌더`/`프렌더 pro` 라벨 분리(`isFrienderPlus`)는 포크에서만 존재.)

**A-2. 상단 메뉴: 현재 탭 표시(그라디언트 밑줄)** — 난이도 S
- 커밋: `6c8e292` / 파일: `src/components/Navbar.tsx` (`NAV_TABS`, `NavTabLink`, `aria-current`)
- `bg-brand-gradient`는 `globals.css`의 일반 CSS 클래스라 `after:` 같은 variant가 안 먹는다 → 실제 `<span>` 요소로 그렸다.

**A-3. 글자 크기 상향(가시성)** — 난이도 S, 클래스명만 수동 재적용
- 커밋: `d461e29` (+ 허브 자체는 `2487c80`에 포함)
- 규칙: 히어로 상단 12/15→14/17px, 하단 문장 14→15/16px, 흰 글씨 `white/80`→`white/95`, 카드 배지 11→12px, 메타·링크 12~13→14px, 상단 메뉴 14→15px
- 파일: 4개 탭 페이지, `Navbar`, `FriendingRooms`(**원본과 겹침**), `PrepEnrollBanner`(**겹침**), `ActivitySection`, `SmallTalkBrowser`
- 겹치는 파일은 diff가 아니라 **위 규칙을 원본 파일에 다시 적용**하는 게 안전하다.

**A-4. 히어로 통일 + 말풍선 제거** — 난이도 S
- 커밋: `260a247`(러닝·아웃팅에 포토 히어로), `ed0252d`(`HeroBubbles` 컴포넌트와 4곳 사용 제거)
- 파일: `learning/page.tsx`, `activities/page.tsx`, `friending/page.tsx`, `PrepEnrollBanner.tsx`(겹침), `docs/prep.md`(겹침), `HeroBubbles.tsx` 삭제
- 이미지: `public/images/learning-hero.jpg`, 화성 사진 3장 재압축(수 MB→수백 KB)

**A-5. 아웃팅 페이지 카피/콘텐츠** — 난이도 S
- 커밋: `ac99087`(모먼츠 아카이브 `MomentsSection.tsx`, `data/moments.ts`), `872bb2e`(10/10 수원 화성 확정 일정 + 영문 섹션), `0916aed`(다음 일정 pulse 강조), `c9457e6`(히어로 리드 문구→"원어민·세대교감" 섹션으로 이동, `ActivitySection`에 `introTitle/introDesc` props)
- 파일: `data/landing.ts`(`ACTIVITIES`, `eventDate`), `ActivityDetailModal.tsx`, `ActivitySection.tsx`, `activities/page.tsx`
- `ActivitySection`은 `/school`과 공유 → `/school` 문구는 기본값으로 유지한다.
- 이미지 출처: 아래 6절(라이선스) 참고.

### B. DB 필요 (원본 스키마 기준으로 마이그레이션 새로 작성)

**B-1. 아웃팅 참가신청** — 난이도 M
- 커밋: `3a04e32`
- DB: `20260916124655_add_activity_applications.sql` (`activity_applications`: `activity_slug`, `user_id`, `user_name`, unique(`activity_slug`,`user_id`))
- 패턴: **RLS는 select만 공개 + 쓰기는 서버 액션(service_role)에서 검증**(원본 `prep_enrollments`·게시판과 같은 관례)
- 파일: `src/app/activities/actions.ts`(`applyToActivity`, `cancelActivityApplication`, `loadActivityApplicationStatus`), `ActivityDetailModal.tsx`
- 주의: 액티비티는 DB가 아니라 `data/landing.ts` 정적 데이터이고 `slug`로만 식별. 마이페이지에는 신청 내역이 아직 없다(마이페이지 개선안 5번).

**B-2. 러닝 스몰톡(실시간 "지금 가능" 매칭)** — 난이도 M, **방향 재결정 필요(5절)**
- 커밋: `d5fbc9e`(최종안), `fb3f627`(강사 브라우징 초안 → `d5fbc9e`에서 방향 전환. **`fb3f627`을 재생하지 말고 최종 상태 diff만 볼 것**)
- DB: `20260915123245_add_small_talk_availability.sql` (`profiles.learning_available boolean`)
- 파일: `src/app/learning/actions.ts`(`loadAvailableTeachers`, `enterSmallTalk` — 조건부 UPDATE로 한 명만 선점하는 원자적 claim), `SmallTalkBrowser.tsx`, `src/components/teacher/SmallTalkToggle.tsx`, `teacher/(dashboard)/page.tsx`, `teacher/actions.ts`(`setLearningAvailable`)
- 동료 피드백(민수): "지금 대화 가능 + 레귤러(정기) 과정 라벨 + 정렬" 요청 → 스몰톡 단일안을 그대로 이식할지 확장할지 먼저 정해야 함.

**B-3. 샤우팅 수강생 전용 무료 연습방** — 난이도 M~L, 원본 프렌더 작업과 겹침
- 커밋: `da31bd9`
- DB: `20260914113529_add_room_access_type.sql` (`friender_rooms.access_type`, `linked_prep_course_id`)
- 파일: `friender/actions.ts`, `RoomsManager.tsx`, `FriendingRooms.tsx`, `mypage/enrollments/page.tsx`, `ShoutingRoomAccess.tsx` 등 (**앞 3개가 원본과 겹침**)
- 원본의 `friender_room_series` 구조 위에서 다시 설계해야 한다.

### B'. DB 의존 UI

**B'-1. 첫 화면 실시간 숫자·아바타·LIVE 롤링 띠** — 난이도 M
- 커밋: `2487c80`
- 화면 부품은 그대로 이식 가능: `src/components/hub/AvatarStack.tsx`, `LiveTicker.tsx`, `types.ts`
- **쿼리는 재작성 필요**: `src/lib/hub-live.ts`가 아래 **우리 쪽 스키마**에 의존한다.
  - `friender_room_occurrences` (우리 반복방 테이블 → 원본은 `friender_room_series`)
  - `profiles.learning_available` (B-2)
  - `activity_applications` (B-1)
  - `prep_courses`/`prep_sessions`/`profiles`는 원본에도 있음
- 30초 `unstable_cache`, 실패 시 빈 값으로 대체(관문 페이지를 죽이지 않기 위해), 값이 0이면 알약 숨김, 아바타 옆 `+N`은 **항목 수가 아니라 서로 다른 사람 수** 기준.
- `Activity` 타입에 `eventDate`(KST 날짜) 추가 — 다음 아웃팅 일정이 바뀌면 함께 갱신해야 D-day가 맞는다.

### C. 충돌 — 이식하지 않음 (원본 채택)

**C-1. 반복방(회차 실체화)** — 커밋 `0c87646`, DB `20260914125155…`, `src/lib/room-recurrence.ts`
**C-2. 방 게시판** — 커밋 `f719741`, DB `20260915132736…`, `board-actions.ts`, `RoomBoardModal.tsx`
- 버리되 **얻은 지식은 태근/원본 코드 리뷰에 활용**:
  - 게시판을 **방(시리즈) 단위**로 둔 이유: 반복방의 회차마다 갈라지면 대화가 끊긴다.
  - `RoomBoardModal`에서 겪은 버그: 부모의 60초 tick이 인라인 `onClose`를 새로 만들어 자식 `useEffect([roomId, onClose])`가 재실행 → 입력 중이던 글이 지워짐. `useRef`로 최신 콜백을 들고 effect 의존성에서 뺐다. 원본 게시판에도 같은 패턴이 있는지 확인할 가치가 있다.
  - `friender_room_participants.room_id`를 회차 테이블과 별개로 남겨 "이 사용자가 이 방의 참가자인가"를 조인 없이 조회한 결정.

### D. 개발 편의 (이식 대상 아님)
- `80ff11d`, `1861a10`: Supabase 타입 재생성 → 원본에서 `db:types`로 다시 생성
- `91f2094`: `.gitignore`에 `start-dev.bat`(개인 PC 절대경로 스크립트)
- `package-lock.json`: `package.json`은 변경 없음, lockfile만 96줄 삭제(정리된 것뿐) → 이식 불필요

### E. 샌드박스 전용 (이식 금지)
- 데모 계정(`friending.demo1/2@example.com`, `admin-test@example.com`)과 테스트 방/신청 데이터
- `.claude/launch.json`(OneDrive 폴더), Vercel 프로젝트, `.env.local`
- 아웃팅 사진 `activity-hwaseong-*.jpg` — 6절 참고

---

## 4. 이식 방법 (제안)

1. **커밋을 재생(cherry-pick)하지 말고, 기능 단위로 최종 상태를 본다.**
   `git diff cb44de8 main -- <해당 경로들>` 로 우리 최종 변경만 보고, 원본 파일에 **수동으로 다시 적용**한다.
2. 원본 작업 폴더는 이 폴더와 **다른 디렉터리 + 다른 `.env.local` + 다른 `supabase link`** (개인 DB와 회사 DB 혼동 방지). `npm run db:push`는 반드시 연결된 프로젝트를 확인하고 실행.
3. 새 마이그레이션은 원본 최신 타임스탬프(`20260918070523…`)보다 **뒤 날짜**로 만들고, 문서의 DB 안전 수칙(`db:diff` → `DROP/TRUNCATE/ALTER COLUMN` grep → 로컬/연습 프로젝트 검증 → 백업)을 따른다.
4. PR은 작게: 기능 1개 = PR 1개.

## 5. 원본에 넣기 전에 회사(민수·태근)와 합의할 것

- [ ] **4탭 구조 + 첫 화면 허브**: `/`를 허브로 바꾸고 프렌딩을 `/friending`으로 옮기는 안(기존 `/` 링크·북마크 영향)을 채택하는가
- [ ] **`/philippines-english` 삭제** 여부 + 정규 과정(`/courses/<slug>`)의 **학생용 진입 동선**을 어디에 둘지(현재는 햄버거 "커리큘럼"뿐)
- [ ] **센터 매니저 메뉴**: 원본의 `isCenterManager` 링크를 유지한 채 4탭 Navbar를 이식 (포크의 회귀 방지)
- [ ] **러닝 방향**: 스몰톡 단일 vs (민수 제안) 지금 가능 + 레귤러 과정 라벨 + 정렬
- [ ] **아웃팅 참가신청**을 서비스 기능으로 넣을 것인가(현재 시연 목적)
- [ ] **반복방·게시판**은 원본 것으로 확정(우리 것 폐기)
- [ ] 마이페이지 개선안(별도 메모리 `project_mypage_review_pending`): 잘못된 링크 3건(수강신청 내역 "과정 둘러보기"→`/learning`, 빈 화면 CTA), 게시판 버튼, 아웃팅 신청 내역 등 — 종합 재검토 후 결정

## 6. 이식 시 알아둘 사실 / 주의

- **이미지 라이선스(Wikimedia Commons)**
  - `public/images/learning-hero.jpg`: *Cheerful woman smiling and making gestures with her hands while talking on a video call on her laptop.jpg*, 작성자 Shixart1985, **CC BY 2.0** → 이식·공개 시 **출처 표기 필요**
  - `activity-hwaseong-wiki-1.jpg`, `activity-hwaseong-wiki-2.jpg`: Wikimedia Commons 출처. 당시 허용 라이선스만 사용했으나 **정확한 라이선스·작성자는 이 목록에 기록하지 못함 → 이식 전 각 파일의 Commons 페이지 재확인 필요**
  - `activity-hwaseong-1.jpg`, `-2.jpg`: 사용자가 직접 올린 사진(사용 권한은 사용자 확인 사항)
- **`.next` 충돌**: dev 서버가 켜진 채 `next build`/`tsc`를 돌리면 `.next/dev/types/routes.d.ts`가 깨져 오류가 난다(코드 문제 아님). 빌드 확인은 dev 서버를 끄고.
- **CRLF 경고**: Windows에서 커밋 시 LF→CRLF 경고가 뜬다(무해).
- **프리티어**: 원본 파일 중 이미 프리티어 기준을 안 지키는 것이 있다(예: `ActivitySection`, `FriendingRooms`, `src/app/page.tsx`의 이전 버전). **원래 깨끗했던 파일만** 포맷하고 나머지는 건드리지 않아 무관한 diff를 만들지 않았다.
- **RLS 관례**: 공개 조회는 select 정책만 두고, 쓰기 권한 판정(역할·중복·레이트리밋)은 서버 액션(service_role)에서 한다. 새 테이블도 같은 방식.
- **역할 저장**: 원본 `CLAUDE.md` 주의 — role은 `app_metadata`에만 저장(user_metadata 금지). 이식하는 코드에 role 관련 변경은 없었다.

---

## 7. 권장 이식 순서

1. **A-3 글자 크기**, **A-2 메뉴 밑줄**, **A-4 히어로 정리** — 독립적이고 위험이 작다. 원본 코드 구조를 익히는 첫 PR로 적합.
2. **A-5 아웃팅 카피/모먼츠** (일정 확정분만)
3. (5절 합의 후) **A-1 4탭 골격 + 허브**
4. **B'-1 허브 실시간 띠** — A-1 이후, 원본 스키마(`friender_room_series` 등)에 맞춰 쿼리 재작성
5. **B-1 아웃팅 참가신청**, **B-2 러닝**(방향 확정 후)
6. **B-3 샤우팅 전용 연습방**은 원본 프렌더 구조가 안정된 뒤

## 부록 A. 포크 전용 커밋 21개 (오래된 순)

| 커밋 | 날짜 | 내용 | 분류 |
|---|---|---|---|
| `80ff11d` | 09-14 | chore: Supabase 타입 재생성 | D |
| `c90f02c` | 09-14 | Navbar 4탭 구조 (프렌딩/샤우팅/러닝/아웃팅) | A-1 |
| `ac99087` | 09-14 | 아웃팅 "모먼츠" 아카이브 섹션 | A-5 |
| `40fb5e5` | 09-14 | 샤우팅 수강신청 배너를 홈→`/shouting` | A-1 |
| `da31bd9` | 09-14 | 샤우팅 전용 무료 프렌더 방(`access_type`) | B-3 |
| `1861a10` | 09-14 | chore: 타입 재생성(access_type) | D |
| `0c87646` | 09-14 | 프렌딩 반복모임(회차 실체화) | C-1 |
| `fb3f627` | 09-14 | 러닝 탭: 강사 브라우징+주제토론 (→ d5fbc9e에서 방향 전환) | B-2(초안) |
| `d5fbc9e` | 09-15 | 러닝 탭 실시간 "스몰톡" 재설계 | B-2 |
| `f719741` | 09-15 | 프렌딩 연습방 게시판 | C-2 |
| `3a04e32` | 09-16 | 아웃팅 세부정보·참가 신청 | B-1 |
| `260a247` | 09-18 | 러닝·아웃팅 포토 히어로 | A-4 |
| `91f2094` | 09-18 | `start-dev.bat` gitignore | D |
| `872bb2e` | 09-18 | 수원 화성 확정 일정 + 영문 버전 | A-5 |
| `0916aed` | 09-18 | 다음 일정 pulse 애니메이션 | A-5 |
| `774fae3` | 09-18 | 첫 화면 4탭 선택 허브 | A-1 |
| `c9457e6` | 09-18 | 아웃팅 히어로 리드 문구 이동 | A-5 |
| `6c8e292` | 09-20 | 상단 메뉴 현재 페이지 밑줄 | A-2 |
| `ed0252d` | 09-20 | 히어로 말풍선 장식 제거 | A-4 |
| `d461e29` | 09-20 | 글자 크기 상향 | A-3 |
| `2487c80` | 09-20 | 첫 화면 실시간 숫자·아바타·LIVE 띠 | B'-1 |

## 부록 B. 포크가 추가한 마이그레이션 5개 vs 원본이 추가한 3개

| 포크 | 원본 |
|---|---|
| `20260914113529_add_room_access_type.sql` | `20260916215319_prep_apply_window_open_11am.sql` |
| `20260914125155_add_room_recurrence_occurrences.sql` | `20260917233513_add_friender_room_series.sql` |
| `20260915123245_add_small_talk_availability.sql` | `20260918070523_add_room_board.sql` |
| `20260915132736_add_friender_room_board.sql` | |
| `20260916124655_add_activity_applications.sql` | |
