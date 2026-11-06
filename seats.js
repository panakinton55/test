/** 一人起業の12席。担当の文言は、割り当ての表のとおり。 */

export const SEATS = [
  {
    id: "ceo",
    area: "経営",
    role: "CEO / 事業責任者",
    work: "事業方針、優先順位、資金、主要な顧客判断",
    holder: "あなた",
    group: "required",
    keep: "方針、優先順位、資金、大きな顧客の判断。",
    lines: {
      ship: "今週やらないことを3つ書く。現金が何週分あるかを1行残す。",
      reach: "今週やらないことを3つ書く。現金が何週分あるかを1行残す。",
    },
  },
  {
    id: "pm",
    area: "プロダクト",
    role: "プロダクトマネージャー",
    work: "課題発見、要件定義、ロードマップ、優先順位付け",
    holder: "あなた",
    group: "required",
    keep: "何を解くか、何を作らないか。",
    lines: {
      ship: "顧客の言葉を1件、次に作るものへ落とす。「今・次・やらない」の3行を更新する。",
      reach: "顧客の言葉を1件、次に作るものへ落とす。「今・次・やらない」の3行を更新する。",
    },
  },
  {
    id: "dev",
    area: "開発",
    role: "CTO / エンジニア",
    work: "設計、実装、テスト、リリース、障害対応、セキュリティ",
    holder: "あなた＋AI／外注",
    group: "output",
    keep: "設計の最終判断と、本番が止まったときの対応。実装の下書きはAIか外注に渡してよい。",
    lines: {
      ship: "動くものを1つ出す。テストしてからリリースする。",
      reach: "止まっていなければ触らない。止まったら直して、原因を1行残す。",
    },
  },
  {
    id: "design",
    area: "デザイン",
    role: "UX・UIデザイナー",
    work: "画面設計、使いやすさ、ブランド表現",
    holder: "テンプレート＋外注",
    group: "monthly",
    keep: "使いやすさの最終確認だけ。画面の量産はテンプレートと外注。",
    lines: {
      ship: "新しい画面がテンプレートから外れていないか見る。外すなら、外注に渡す1枚を決める。",
      reach: "新しい画面がテンプレートから外れていないか見る。外すなら、外注に渡す1枚を決める。",
    },
  },
  {
    id: "infra",
    area: "インフラ",
    role: "DevOps / SRE",
    work: "ホスティング、監視、バックアップ、コスト管理",
    holder: "マネージドサービス中心",
    group: "monthly",
    keep: "通知が届く場所。ホスティングの中身はマネージドに置く。",
    lines: {
      ship: "監視が生きているか、バックアップを1つ戻せるか、請求が跳ねていないかを見る。",
      reach: "監視が生きているか、バックアップを1つ戻せるか、請求が跳ねていないかを見る。",
    },
  },
  {
    id: "marketing",
    area: "マーケティング",
    role: "マーケター",
    work: "ポジショニング、LP、SEO、メール、SNS、分析",
    holder: "あなた＋AI／外注",
    group: "output",
    keep: "誰に何を言うかの一文。下書きはAIか外注に渡してよい。",
    lines: {
      ship: "今週は出さない。",
      reach: "誰に何を言うかを一文で確認し、LP・メール・SNSのどれか1本を出す。数字は1つだけ見る。",
    },
  },
  {
    id: "sales",
    area: "営業",
    role: "セールス",
    work: "デモ、見積、契約、初期顧客獲得",
    holder: "あなた（ファウンダーセールス）",
    group: "required",
    keep: "初期の顧客は、自分の言葉で取る。",
    lines: {
      ship: "デモ、見積、契約のどれかを1段進める。相手がいない週は、次に話す人を1人決める。",
      reach: "デモ、見積、契約のどれかを1段進める。相手がいない週は、次に話す人を1人決める。",
    },
  },
  {
    id: "support",
    area: "顧客支援",
    role: "カスタマーサポート",
    work: "問い合わせ対応、FAQ、不具合受付",
    holder: "あなた＋ヘルプデスク",
    group: "inbound",
    keep: "返事の責任。ヘルプデスクは振り分けまで。",
    lines: {
      ship: "未返信を返す。同じ問いが2回目なら、FAQに1行足す。不具合は開発の席へ渡す。",
      reach: "未返信を返す。同じ問いが2回目なら、FAQに1行足す。不具合は開発の席へ渡す。",
    },
  },
  {
    id: "success",
    area: "顧客成功",
    role: "カスタマーサクセス",
    work: "オンボーディング、活用支援、解約防止、アップセル",
    holder: "あなた＋自動化",
    group: "light",
    keep: "解約の相談と、値上げの判断。",
    lines: {
      ship: "新しく使い始めた人が止まっていないかだけ見る。止まっていれば1通。問題なければ何もしない。",
      reach: "新しく使い始めた人が止まっていないかだけ見る。止まっていれば1通。問題なければ何もしない。",
    },
  },
  {
    id: "revops",
    area: "収益管理",
    role: "RevOps",
    work: "料金、請求、契約、CRM、KPI管理",
    holder: "課金SaaS＋スプレッドシート",
    group: "monthly",
    keep: "料金の決め方。請求の作業は課金SaaSに置く。",
    lines: {
      ship: "課金の失敗、未請求、契約期限、主要KPIをシートで更新する。",
      reach: "課金の失敗、未請求、契約期限、主要KPIをシートで更新する。",
    },
  },
  {
    id: "finance",
    area: "財務・法務",
    role: "CFO / 経理",
    work: "記帳、請求、税務、資金繰り、契約書確認",
    holder: "経理代行・税理士",
    group: "monthly",
    keep: "資金繰りの判断と、契約の可否。記帳と税務は渡したまま。",
    lines: {
      ship: "入金予定と支払予定を突合する。新しい契約書があれば、不利な条項だけ読む。",
      reach: "入金予定と支払予定を突合する。新しい契約書があれば、不利な条項だけ読む。",
    },
  },
  {
    id: "ops",
    area: "管理業務",
    role: "COO / オペレーションズ",
    work: "業務手順、ツール整備、採用、契約管理",
    holder: "あなた＋自動化",
    group: "light",
    keep: "何を仕組みに残し、何を捨てるか。",
    lines: {
      ship: "頭の中にしかない手順があれば1つ書く。増えたツールがあれば1つやめる。どちらもなければ何もしない。",
      reach: "頭の中にしかない手順があれば1つ書く。増えたツールがあれば1つやめる。どちらもなければ何もしない。",
    },
  },
];

const SEAT_IDS = new Set(SEATS.map((seat) => seat.id));
const MONTHLY_IDS = SEATS.filter((seat) => seat.group === "monthly").map((seat) => seat.id);
const MEMO_LIMIT = 200;

export function seatById(id) {
  return SEATS.find((seat) => seat.id === id) ?? null;
}

export function lineFor(seat, output) {
  return seat.lines[output === "reach" ? "reach" : "ship"];
}

/** 出荷する週は開発、届ける週は発信。両方を必須にしない。 */
export function placement(seat, output) {
  const mode = output === "reach" ? "reach" : "ship";
  if (seat.id === "dev") return mode === "ship" ? "required" : "inbound";
  if (seat.id === "marketing") return mode === "reach" ? "required" : "deferred";
  return seat.group;
}

export function seatsIn(group, output) {
  return SEATS.filter((seat) => placement(seat, output) === group);
}

export function requiredIds(output) {
  return seatsIn("required", output).map((seat) => seat.id);
}

export function tokyoYmd(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const pick = (type) => Number(parts.find((part) => part.type === type).value);
  return { year: pick("year"), month: pick("month"), day: pick("day") };
}

export function isoWeek(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const weekYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return { weekYear, week };
}

export function weekId(date) {
  const { year, month, day } = tokyoYmd(date);
  const { weekYear, week } = isoWeek(year, month, day);
  return `${weekYear}-W${String(week).padStart(2, "0")}`;
}

export function monthKey(date) {
  const { year, month } = tokyoYmd(date);
  return `${year}-${String(month).padStart(2, "0")}`;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function tokyoWeekday(date) {
  const { year, month, day } = tokyoYmd(date);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

function addDays(year, month, day, delta) {
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + delta);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export function weekRange(date) {
  const { year, month, day } = tokyoYmd(date);
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay() || 7;
  const monday = addDays(year, month, day, 1 - dow);
  const sunday = addDays(monday.year, monday.month, monday.day, 6);
  return { monday, sunday };
}

export function formatMonthDay(part) {
  return `${part.month}月${part.day}日`;
}

export function formatLongDate(date) {
  const ymd = tokyoYmd(date);
  return `${ymd.year}年${ymd.month}月${ymd.day}日（${tokyoWeekday(date)}）`;
}

export function formatWeekRange(date) {
  const { monday, sunday } = weekRange(date);
  if (monday.month === sunday.month) {
    return `${monday.month}月${monday.day}日–${sunday.day}日`;
  }
  return `${formatMonthDay(monday)}–${formatMonthDay(sunday)}`;
}

/** 月の最初の7日は確認週。過ぎて未了なら、済むまで残す。 */
export function monthlyVisibleIds(state, date) {
  const { day } = tokyoYmd(date);
  if (day <= 7) return [...MONTHLY_IDS];
  return MONTHLY_IDS.filter((id) => !state.monthDone[id]);
}

export function freshState(date, output = "ship") {
  return {
    weekId: weekId(date),
    monthKey: monthKey(date),
    output: output === "reach" ? "reach" : "ship",
    weeklyDone: {},
    monthDone: {},
    memos: {},
  };
}

function boolMap(value) {
  if (!value || typeof value !== "object") return {};
  const next = {};
  for (const id of SEAT_IDS) {
    if (value[id] === true) next[id] = true;
  }
  return next;
}

function memoMap(value) {
  if (!value || typeof value !== "object") return {};
  const next = {};
  for (const id of SEAT_IDS) {
    if (typeof value[id] !== "string") continue;
    const text = value[id].slice(0, MEMO_LIMIT);
    if (text) next[id] = text;
  }
  return next;
}

export function reconcile(saved, date) {
  const base = freshState(date);
  if (!saved || typeof saved !== "object") return base;
  const output = saved.output === "reach" ? "reach" : "ship";
  const sameWeek = saved.weekId === base.weekId;
  const sameMonth = saved.monthKey === base.monthKey;
  return {
    weekId: base.weekId,
    monthKey: base.monthKey,
    output,
    weeklyDone: sameWeek ? boolMap(saved.weeklyDone) : {},
    monthDone: sameMonth ? boolMap(saved.monthDone) : {},
    memos: memoMap(saved.memos),
  };
}

export function withOutput(state, output) {
  if (output !== "ship" && output !== "reach") return state;
  if (state.output === output) return state;
  return { ...state, output };
}

export function toggleWeekly(state, id) {
  if (!SEAT_IDS.has(id)) return state;
  const weeklyDone = { ...state.weeklyDone };
  if (weeklyDone[id]) delete weeklyDone[id];
  else weeklyDone[id] = true;
  return { ...state, weeklyDone };
}

export function toggleMonth(state, id) {
  if (!MONTHLY_IDS.includes(id)) return state;
  const monthDone = { ...state.monthDone };
  if (monthDone[id]) delete monthDone[id];
  else monthDone[id] = true;
  return { ...state, monthDone };
}

export function setMemo(state, id, text) {
  if (!SEAT_IDS.has(id)) return state;
  const memos = { ...state.memos };
  const clipped = String(text).slice(0, MEMO_LIMIT);
  if (clipped) memos[id] = clipped;
  else delete memos[id];
  return { ...state, memos };
}

export function summary(state, date) {
  const ids = requiredIds(state.output);
  const monthIds = monthlyVisibleIds(state, date);
  return {
    requiredTotal: ids.length,
    requiredDone: ids.filter((id) => state.weeklyDone[id]).length,
    monthShown: monthIds.length,
    monthDone: monthIds.filter((id) => state.monthDone[id]).length,
  };
}

export const MEMO_MAX = MEMO_LIMIT;
