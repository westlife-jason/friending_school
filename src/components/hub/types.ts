export type HubAvatar = { name: string; avatarUrl: string | null };

export type HubTickerItem = {
  id: string;
  kind: "learning" | "friending" | "outing" | "shouting";
  text: string;
  href: string;
  avatar: HubAvatar | null;
};

export type HubLive = {
  // count = 항목 수(방·강좌·선생님), people = 그 뒤에 있는 서로 다른 사람 수 — 아바타 옆 +N은 people 기준이다.
  friending: { count: number; people: number; avatars: HubAvatar[] };
  shouting: { count: number; people: number; avatars: HubAvatar[] };
  learning: { count: number; people: number; avatars: HubAvatar[] };
  outing: { dday: number | null; applicants: number };
  ticker: HubTickerItem[];
};

export const EMPTY_HUB_LIVE: HubLive = {
  friending: { count: 0, people: 0, avatars: [] },
  shouting: { count: 0, people: 0, avatars: [] },
  learning: { count: 0, people: 0, avatars: [] },
  outing: { dday: null, applicants: 0 },
  ticker: [],
};
