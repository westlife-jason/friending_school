"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { kstDateTimeText } from "@/lib/kst";
import {
  createRoomBoardComment,
  createRoomBoardPost,
  deleteRoomBoardComment,
  deleteRoomBoardPost,
  loadRoomBoard,
  updateRoomBoardPost,
  type BoardPost,
  type BoardResult,
  type BoardViewer,
} from "@/app/friending/board-actions";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const POST_MAX = 1000;
const COMMENT_MAX = 300;

/**
 * 프렌딩 연습방 게시판 — 방(시리즈) 단위로 하나(회차 카드 어디서든 같은 내용).
 * 읽기는 누구나, 쓰기는 개설 프렌더 ∥ 이 방 참가 이력이 있는 회원만이다(자격 판정은
 * **서버**가 내려 준 `viewer`만 믿는다). PrepCourseBoard의 모달-내-탭 구조를 독립 모달로 뗀 버전.
 */
export default function RoomBoardModal({
  target,
  isLoggedIn,
  onClose,
}: {
  target: { roomId: string; roomTitle: string } | null;
  isLoggedIn: boolean;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const [loading, setLoading] = useState(true);
  const [notices, setNotices] = useState<BoardPost[]>([]);
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [viewer, setViewer] = useState<BoardViewer>({ canWrite: false, canPostNotice: false });
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"공지" | "일반">("일반");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<{ type: "post" | "comment"; id: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const roomId = target?.roomId ?? null;

  const reload = useCallback(async () => {
    if (!roomId) return;
    const res = await loadRoomBoard(roomId);
    if (!res.ok) {
      toast.error(res.error ?? "게시판을 불러오지 못했습니다.");
      return;
    }
    setNotices(res.notices);
    setPosts(res.posts);
    setCursor(res.nextCursor);
    setViewer(res.viewer);
    setMyUserId(res.myUserId);
  }, [roomId]);

  // onClose를 ref로 받아둔다 — effect 의존성에 그대로 넣으면 부모가 인라인 함수를 매 렌더
  // 새로 만들 때마다(예: FriendingRooms의 1분 tick) 이 effect가 재실행돼 작성 중이던 글이
  // 사라진다(실제 겪은 버그). Esc 핸들러는 항상 최신 onClose를 이 ref로 호출한다.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // 열릴 때(방이 바뀔 때만) 로드 + 입력 상태 초기화. Esc 닫기 + body scroll lock + 닫기 버튼 포커스.
  useEffect(() => {
    if (!roomId) return;
    let alive = true;
    setLoading(true);
    setBody("");
    setKind("일반");
    setEditingId(null);
    setCommentDrafts({});
    loadRoomBoard(roomId)
      .then((res) => {
        if (!alive) return;
        if (res.ok) {
          setNotices(res.notices);
          setPosts(res.posts);
          setCursor(res.nextCursor);
          setViewer(res.viewer);
          setMyUserId(res.myUserId);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector('[role="alertdialog"]')) onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      alive = false;
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [roomId]);

  if (!target) return null;

  // 쓰기 액션 공통 — 성공하면 목록을 다시 읽는다(router.refresh()는 부르지 않는다: 홈 전체를 다시 그릴 이유가 없다).
  const run = (fn: () => Promise<BoardResult>, success: string, after?: () => void) => {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? "처리하지 못했습니다.");
        return;
      }
      after?.();
      await reload();
      toast.success(success);
    });
  };

  const loadMore = () => {
    if (!cursor || !roomId) return;
    startTransition(async () => {
      const res = await loadRoomBoard(roomId, cursor);
      if (!res.ok) {
        toast.error(res.error ?? "게시판을 불러오지 못했습니다.");
        return;
      }
      setPosts((prev) => [...prev, ...res.posts]);
      setCursor(res.nextCursor);
    });
  };

  const confirmDelete = () => {
    const del = deleteTarget;
    setDeleteTarget(null); // base-nova는 AlertDialogAction이 자동으로 닫지 않는다.
    if (!del) return;
    if (del.type === "post") run(() => deleteRoomBoardPost(del.id), "글을 삭제했습니다.");
    else run(() => deleteRoomBoardComment(del.id), "댓글을 삭제했습니다.");
  };

  const all = [...notices, ...posts];

  return (
    <>
      <div aria-hidden="true" onClick={onClose} className="fixed inset-0 z-[110] bg-black/40" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${target.roomTitle} 게시판`}
        className="fixed top-1/2 left-1/2 z-[120] flex max-h-[85vh] w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="border-rule flex items-center justify-between border-b px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-ink truncate text-lg font-bold">게시판</h2>
            <p className="text-muted-fg-faint truncate text-xs">{target.roomTitle}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="text-muted-fg-faint hover:text-ink focus-visible:ring-accent-blue/50 ml-3 shrink-0 rounded transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none">
            <X className="size-5" />
          </button>
        </div>

        <div className="overflow-auto px-6 py-5">
          {loading ? (
            <p className="text-muted-fg-faint flex items-center gap-1.5 py-4 text-sm">
              <Loader2 className="size-4 animate-spin" /> 불러오는 중…
            </p>
          ) : (
            <>
              {/* 작성 자격 안내 — 자격이 없을 때만. 이유(비로그인/미참가)를 나눠 알린다. */}
              {!viewer.canWrite && (
                <p className="border-rule text-muted-fg mb-3 rounded-lg border bg-white px-3 py-2.5 text-sm leading-relaxed">
                  {isLoggedIn || viewer.reason === "not_eligible" ? (
                    "이 방에 참가한 회원과 개설 프렌더만 글을 쓸 수 있어요."
                  ) : (
                    <>
                      <Link href="/login" className="text-accent-blue-ink font-bold underline underline-offset-2">
                        로그인
                      </Link>
                      하고 참가하시면 글을 남길 수 있어요.
                    </>
                  )}
                </p>
              )}

              {viewer.canWrite && (
                <div className="border-rule mb-3 rounded-lg border bg-white p-3">
                  {/* 공지 토글은 개설 프렌더에게만 — 서버도 같은 조건으로 다시 검사한다. */}
                  {viewer.canPostNotice && (
                    <div className="mb-2 flex gap-1.5">
                      {(["일반", "공지"] as const).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setKind(k)}
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-bold transition-colors",
                            kind === k ? "bg-ink text-white" : "bg-surface text-muted-fg hover:text-ink",
                          )}>
                          {k}
                        </button>
                      ))}
                    </div>
                  )}
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    maxLength={POST_MAX}
                    rows={3}
                    placeholder="궁금한 점이나 나누고 싶은 이야기를 남겨 주세요."
                    className="text-sm"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-muted-fg-faint text-xs">
                      {body.length}/{POST_MAX}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        run(
                          () => createRoomBoardPost(roomId!, kind, body),
                          "글을 등록했습니다.",
                          () => setBody(""),
                        )
                      }
                      disabled={pending || !body.trim()}
                      className="bg-cta hover:bg-cta/90 inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50">
                      {pending && <Loader2 className="size-3.5 animate-spin" />}
                      등록
                    </button>
                  </div>
                </div>
              )}

              {all.length === 0 ? (
                <p className="text-muted-fg-faint text-sm leading-relaxed">아직 글이 없어요. 첫 글을 남겨 보세요.</p>
              ) : (
                <ul className="flex list-none flex-col gap-2.5">
                  {all.map((post) => (
                    <li
                      key={post.id}
                      className={cn("rounded-lg border p-3", post.kind === "공지" ? "border-brand/20 bg-brand/5" : "border-rule bg-white")}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {post.kind === "공지" && (
                          <span className="bg-brand shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold text-white">공지</span>
                        )}
                        <span className="text-ink text-sm font-extrabold">{post.authorName}</span>
                        {post.isHost && (
                          <span
                            title="프렌더"
                            aria-hidden
                            className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-[50%_50%_50%_3px] bg-[#DC52B8] text-[8px] font-bold text-white">
                            F
                          </span>
                        )}
                        <span className="text-muted-fg-faint text-xs">
                          {kstDateTimeText(post.createdAt)}
                          {post.edited && " · 수정됨"}
                        </span>
                      </div>

                      {editingId === post.id ? (
                        <div className="mt-2">
                          <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} maxLength={POST_MAX} rows={3} className="text-sm" />
                          <div className="mt-1.5 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              disabled={pending}
                              className="text-muted-fg hover:text-ink text-xs font-bold disabled:opacity-60">
                              취소
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                run(
                                  () => updateRoomBoardPost(post.id, editBody),
                                  "글을 수정했습니다.",
                                  () => setEditingId(null),
                                )
                              }
                              disabled={pending || !editBody.trim()}
                              className="text-accent-blue-ink text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50">
                              저장
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-ink mt-1.5 text-sm leading-relaxed break-words whitespace-pre-wrap">{post.body}</p>
                      )}

                      {/* 수정은 본인만, 삭제는 본인 ∥ 개설 프렌더(모더레이션). 서버가 같은 규칙으로 다시 검사한다. */}
                      {editingId !== post.id && (myUserId === post.userId || viewer.canPostNotice) && (
                        <div className="mt-1.5 flex gap-3">
                          {myUserId === post.userId && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(post.id);
                                setEditBody(post.body);
                              }}
                              disabled={pending}
                              className="text-muted-fg hover:text-ink text-xs font-bold disabled:opacity-60">
                              수정
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ type: "post", id: post.id })}
                            disabled={pending}
                            aria-haspopup="dialog"
                            className="text-muted-fg hover:text-brand text-xs font-bold disabled:opacity-60">
                            삭제
                          </button>
                        </div>
                      )}

                      {(post.comments.length > 0 || viewer.canWrite) && (
                        <div className="border-rule mt-2.5 border-l pl-3">
                          <ul className="flex list-none flex-col gap-1.5">
                            {post.comments.map((comment) => (
                              <li key={comment.id} className="text-xs">
                                <span className="text-ink font-bold">{comment.authorName}</span>
                                {comment.isHost && <span className="font-bold text-[#DC52B8]"> · 프렌더</span>}
                                <span className="text-muted-fg-faint"> · {kstDateTimeText(comment.createdAt)}</span>
                                {(myUserId === comment.userId || viewer.canPostNotice) && (
                                  <button
                                    type="button"
                                    onClick={() => setDeleteTarget({ type: "comment", id: comment.id })}
                                    disabled={pending}
                                    aria-haspopup="dialog"
                                    className="text-muted-fg-faint hover:text-brand ml-1.5 font-bold disabled:opacity-60">
                                    삭제
                                  </button>
                                )}
                                <p className="text-ink mt-0.5 leading-relaxed break-words whitespace-pre-wrap">{comment.body}</p>
                              </li>
                            ))}
                          </ul>

                          {viewer.canWrite && (
                            <div className="mt-2 flex gap-1.5">
                              <input
                                type="text"
                                value={commentDrafts[post.id] ?? ""}
                                onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                                maxLength={COMMENT_MAX}
                                placeholder="댓글 남기기"
                                className="border-rule text-ink placeholder:text-muted-fg-faint min-w-0 flex-1 rounded-md border bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#6b8ff0]"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  run(
                                    () => createRoomBoardComment(post.id, commentDrafts[post.id] ?? ""),
                                    "댓글을 등록했습니다.",
                                    () => setCommentDrafts((prev) => ({ ...prev, [post.id]: "" })),
                                  )
                                }
                                disabled={pending || !(commentDrafts[post.id] ?? "").trim()}
                                className="border-rule text-muted-fg hover:bg-surface hover:text-ink shrink-0 rounded-md border px-3 py-1.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50">
                                댓글
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {cursor && (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={pending}
                  className="border-rule text-muted-fg hover:bg-surface hover:text-ink mt-2.5 w-full rounded-full border py-2 text-sm font-bold transition-colors disabled:opacity-60">
                  더보기
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 삭제 확인 — 모달 위에 뜨므로 z-[130](모달 패널은 z-[120]). */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="z-[130]">
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteTarget?.type === "comment" ? "댓글을 삭제할까요?" : "글을 삭제할까요?"}</AlertDialogTitle>
            <AlertDialogDescription>
              삭제하면 되돌릴 수 없습니다.
              {deleteTarget?.type === "post" && " 이 글에 달린 댓글도 함께 사라집니다."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} variant="brand">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
