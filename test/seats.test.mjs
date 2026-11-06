import assert from "node:assert/strict";
import test from "node:test";
import {
  SEATS,
  freshState,
  monthlyVisibleIds,
  placement,
  reconcile,
  requiredIds,
  setMemo,
  summary,
  toggleMonth,
  toggleWeekly,
  weekId,
  withOutput,
} from "../seats.js";

const HOLDERS = [
  "あなた",
  "あなた",
  "あなた＋AI／外注",
  "テンプレート＋外注",
  "マネージドサービス中心",
  "あなた＋AI／外注",
  "あなた（ファウンダーセールス）",
  "あなた＋ヘルプデスク",
  "あなた＋自動化",
  "課金SaaS＋スプレッドシート",
  "経理代行・税理士",
  "あなた＋自動化",
];

const AREAS = [
  "経営",
  "プロダクト",
  "開発",
  "デザイン",
  "インフラ",
  "マーケティング",
  "営業",
  "顧客支援",
  "顧客成功",
  "収益管理",
  "財務・法務",
  "管理業務",
];

test("12席の領域と担当は割り当て表のとおり", () => {
  assert.deepEqual(SEATS.map((seat) => seat.area), AREAS);
  assert.deepEqual(SEATS.map((seat) => seat.holder), HOLDERS);
  assert.equal(new Set(SEATS.map((seat) => seat.id)).size, 12);
});

test("日付は東京。週番号はISO", () => {
  assert.equal(weekId(new Date("2026-11-06T01:24:00Z")), "2026-W45");
  assert.equal(weekId(new Date("2026-11-05T14:59:00Z")), "2026-W45");
  assert.equal(weekId(new Date("2026-11-01T14:59:00Z")), "2026-W44");
  assert.equal(weekId(new Date("2026-11-01T15:00:00Z")), "2026-W45");
  assert.equal(weekId(new Date("2025-12-31T15:00:00Z")), "2026-W01");
  assert.equal(weekId(new Date("2025-12-28T03:00:00Z")), "2025-W52");
});

test("出荷する週の必須は開発、届ける週の必須は発信", () => {
  assert.deepEqual(requiredIds("ship"), ["ceo", "pm", "dev", "sales"]);
  assert.deepEqual(requiredIds("reach"), ["ceo", "pm", "marketing", "sales"]);
  assert.equal(placement(SEATS.find((seat) => seat.id === "dev"), "ship"), "required");
  assert.equal(placement(SEATS.find((seat) => seat.id === "dev"), "reach"), "inbound");
  assert.equal(placement(SEATS.find((seat) => seat.id === "marketing"), "ship"), "deferred");
  assert.equal(placement(SEATS.find((seat) => seat.id === "marketing"), "reach"), "required");
  assert.equal(placement(SEATS.find((seat) => seat.id === "design"), "ship"), "monthly");
});

test("週が変わると終了は戻り、メモと月次は残る", () => {
  const now = new Date("2026-11-06T01:00:00Z");
  let state = freshState(now);
  state = toggleWeekly(state, "ceo");
  state = toggleMonth(state, "infra");
  state = setMemo(state, "ceo", "現金は14週");
  const nextWeek = reconcile(state, new Date("2026-11-09T00:00:00Z"));
  assert.equal(nextWeek.weekId, "2026-W46");
  assert.deepEqual(nextWeek.weeklyDone, {});
  assert.equal(nextWeek.monthDone.infra, true);
  assert.equal(nextWeek.memos.ceo, "現金は14週");
});

test("月が変わると月次の確認は戻る", () => {
  const now = new Date("2026-11-06T01:00:00Z");
  const state = toggleMonth(freshState(now), "finance");
  const nextMonth = reconcile(state, new Date("2026-12-01T00:00:00Z"));
  assert.equal(nextMonth.monthKey, "2026-12");
  assert.deepEqual(nextMonth.monthDone, {});
});

test("壊れた保存は、今週の初期状態に戻す", () => {
  const date = new Date("2026-11-06T01:00:00Z");
  const state = reconcile({ output: "nope", weeklyDone: { ceo: "yes" } }, date);
  assert.equal(state.output, "ship");
  assert.deepEqual(state.weeklyDone, {});
  assert.equal(state.weekId, "2026-W45");
});

test("月次の席は、7日まで全部、その後は未了だけ", () => {
  const opening = new Date("2026-11-06T01:00:00Z");
  const later = new Date("2026-11-10T01:00:00Z");
  let state = freshState(opening);
  assert.deepEqual(monthlyVisibleIds(state, opening), ["design", "infra", "revops", "finance"]);
  state = reconcile(state, later);
  state = toggleMonth(toggleMonth(state, "design"), "infra");
  assert.deepEqual(monthlyVisibleIds(state, later), ["revops", "finance"]);
  state = toggleMonth(toggleMonth(state, "revops"), "finance");
  assert.deepEqual(monthlyVisibleIds(state, later), []);
});

test("メモは200字で切る", () => {
  const state = setMemo(freshState(new Date("2026-11-06T01:00:00Z")), "pm", "あ".repeat(240));
  assert.equal(state.memos.pm.length, 200);
  const cleared = setMemo(state, "pm", "");
  assert.equal(cleared.memos.pm, undefined);
});

test("出力を変えても、終えた印は消さない", () => {
  let state = toggleWeekly(freshState(new Date("2026-11-06T01:00:00Z")), "dev");
  state = withOutput(state, "reach");
  assert.equal(state.weeklyDone.dev, true);
  assert.equal(summary(state, new Date("2026-11-06T01:00:00Z")).requiredDone, 0);
  state = toggleWeekly(state, "marketing");
  assert.equal(summary(state, new Date("2026-11-06T01:00:00Z")).requiredDone, 1);
});
