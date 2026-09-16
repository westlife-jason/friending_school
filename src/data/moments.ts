/* ===== 아웃팅 "모먼츠" 섹션(/activities) 데이터 ===== */
// 지난 특강·모임 아카이브. imgs는 로컬 에셋 경로(`public/images/`)만 사용 —
// 외부 플레이스홀더 이미지 서비스는 쓰지 않는다. 실제 사진이 준비되면 추가.

export type Moment = {
  label: string;
  date: string; // "MM.DD" 표시용
  content: string;
  imgs?: string[];
};

export const MOMENTS: Moment[] = [
  {
    label: "수원 화성 하이킹",
    date: "10.10",
    content:
      "10월 10일, 외국인 친구들과 함께 수원 화성 성곽길을 걸어요! 화서문·장안문 등 주요 명소를 둘러보며 영어로 편하게 대화 나눌 예정입니다. 편한 신발 챙겨오세요 :)",
    // 앞 2장은 실제 답사 사진, 뒤 2장은 위키미디어 커먼즈 자유이용 사진(출처: Bernard Gagnon, CC0 / Craig Wyzik, CC BY 2.0).
    imgs: [
      "/images/activity-hwaseong-1.jpg",
      "/images/activity-hwaseong-2.jpg",
      "/images/activity-hwaseong-wiki-1.jpg",
      "/images/activity-hwaseong-wiki-2.jpg",
    ],
  },
  {
    label: "대한대학교 특강",
    date: "07.10",
    content:
      "대한대학교 국제교류처 초청으로 영어 스몰톡 클럽을 소개하고 왔어요. 워홀 준비하는 학생들이 정말 많이 와주셔서, 실제로 우리 클럽에서 어떻게 대화가 이루어지는지 시연도 하고 질문도 많이 받았어요. 다음에 또 불러주신다고 하셔서 너무 감사했습니다!",
  },
  {
    label: "원어민들과 하이킹",
    date: "07.20",
    content: "7월 20일 원어민들과 관악산에 등산하고 왔어요. 즐거운 시간이었어요.",
  },
  {
    label: "수원과학대 워홀 특강",
    date: "07.05",
    content: "요리학과 학생들과 함께 영어 구조강의와 워홀 영어에 대해서 강의하고 왔어요.",
  },
  {
    label: "강화도 여행 답사",
    date: "06.28",
    content: "강화도 여행 답사 갔다왔어요. 추후에 강화도 여행 함께 해요~",
  },
  {
    label: "OO고등학교 특강",
    date: "06.15",
    content:
      "진로 특강 다녀왔어요. 워킹홀리데이와 해외 진출을 준비하는 고등학생 친구들 대상으로, 영어를 대하는 마인드셋부터 실전 회화까지 폭넓게 다뤘어요. 눈빛이 반짝이는 학생들 보면서 저희도 많은 힘을 얻었습니다.",
  },
];
