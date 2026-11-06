import assert from "node:assert/strict";
import test from "node:test";
import { freshState, setMemo, toggleWeekly } from "../seats.js";
import { render } from "../view.js";

const now = new Date("2026-11-06T01:24:00Z");

test("出荷する週は開発が必須で、発信は今週はやらない", () => {
  const html = render(freshState(now, "ship"), now);
  assert.match(html, /今週の4席のうち、0席が終わっている/);
  assert.match(html, /東京 2026年11月6日（金）/);
  assert.match(html, /11月2日–8日/);
  const required = html.split("届いたら、その日")[0];
  assert.match(required, /CTO \/ エンジニア/);
  assert.doesNotMatch(required, /マーケター/);
  assert.match(html, /今週は出さない/);
  assert.match(html, /一人起業での担当/);
  assert.match(html, /あなた（ファウンダーセールス）/);
});

test("届ける週は発信が必須で、開発は障害のときだけ", () => {
  const html = render(freshState(now, "reach"), now);
  const required = html.split("届いたら、その日")[0];
  assert.match(required, /マーケター/);
  assert.doesNotMatch(required, /CTO \/ エンジニア/);
  const inbound = html.split("届いたら、その日")[1].split("なければ、何もしない")[0];
  assert.match(inbound, /CTO \/ エンジニア/);
  assert.match(inbound, /止まっていなければ触らない/);
});

test("メモは表示しつつ、タグとしては解釈しない", () => {
  let state = setMemo(freshState(now), "ceo", `<script>alert("x")</script>`);
  state = toggleWeekly(state, "ceo");
  const html = render(state, now);
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /未了に戻す/);
  assert.match(html, /今週の4席のうち、1席が終わっている/);
});

test("11月10日は、未了の月次席だけ残す", () => {
  const later = new Date("2026-11-10T01:00:00Z");
  const html = render(freshState(later), later);
  assert.match(html, /まだ済んでいない席だけ残している/);
  assert.match(html, /UX・UIデザイナー/);
  assert.match(html, /経理代行・税理士/);
});
