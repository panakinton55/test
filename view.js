import {
  SEATS,
  formatLongDate,
  formatWeekRange,
  lineFor,
  monthlyVisibleIds,
  placement,
  seatById,
  seatsIn,
  summary,
} from "./seats.js";

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function card(seat, state, mode) {
  const doneMap = mode === "month" ? state.monthDone : state.weeklyDone;
  const done = doneMap[seat.id] === true;
  const action = mode === "month" ? "toggle-month" : "toggle-week";
  const memo = state.memos[seat.id] ?? "";
  return `<article class="card${done ? " is-done" : ""}" data-seat="${seat.id}">
    <div class="card-top">
      <p class="area">${escapeHtml(seat.area)}</p>
      <p class="holder">${escapeHtml(seat.holder)}</p>
    </div>
    <h3>${escapeHtml(seat.role)}</h3>
    <p class="line">${escapeHtml(lineFor(seat, state.output))}</p>
    <p class="meta"><span>主な仕事</span>${escapeHtml(seat.work)}</p>
    <p class="meta"><span>自分に残す</span>${escapeHtml(seat.keep)}</p>
    <div class="actions">
      <button type="button" data-action="${action}" data-id="${seat.id}" aria-pressed="${done ? "true" : "false"}">${done ? "未了に戻す" : "終えた"}</button>
      <label class="memo">
        <span class="visually-hidden">${escapeHtml(seat.area)}のメモ</span>
        <input data-action="memo" data-id="${seat.id}" maxlength="200" value="${escapeHtml(memo)}" placeholder="メモ（このブラウザだけ）">
      </label>
    </div>
  </article>`;
}

function deferred(seat, state) {
  return `<article class="card is-deferred" data-seat="${seat.id}">
    <div class="card-top">
      <p class="area">${escapeHtml(seat.area)}</p>
      <p class="holder">${escapeHtml(seat.holder)}</p>
    </div>
    <h3>${escapeHtml(seat.role)}</h3>
    <p class="line">${escapeHtml(lineFor(seat, state.output))}</p>
    <p class="meta"><span>主な仕事</span>${escapeHtml(seat.work)}</p>
  </article>`;
}

function section(title, intro, body) {
  return `<section class="block">
    <div class="block-head">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(intro)}</p>
    </div>
    <div class="cards">${body}</div>
  </section>`;
}

function assignmentRows() {
  return SEATS.map((seat) => {
    return `<tr>
      <td>${escapeHtml(seat.area)}</td>
      <td>${escapeHtml(seat.role)}</td>
      <td>${escapeHtml(seat.work)}</td>
      <td>${escapeHtml(seat.holder)}</td>
    </tr>`;
  }).join("");
}

export function render(state, date) {
  const counts = summary(state, date);
  const output = state.output === "reach" ? "reach" : "ship";
  const monthIds = monthlyVisibleIds(state, date);
  const monthSeats = monthIds.map((id) => seatById(id));
  const required = seatsIn("required", output).map((seat) => card(seat, state, "week")).join("");
  const inbound = seatsIn("inbound", output).map((seat) => card(seat, state, "week")).join("");
  const light = seatsIn("light", output).map((seat) => card(seat, state, "week")).join("");
  const parked = seatsIn("deferred", output).map((seat) => deferred(seat, state)).join("");
  const monthly = monthSeats.map((seat) => card(seat, state, "month")).join("");
  const monthIntro = tokyoMonthIntro(date, monthIds, counts);

  const monthlyBlock = monthIds.length
    ? section("今月、渡した席を確認する", monthIntro, monthly)
    : `<section class="block">
        <div class="block-head">
          <h2>今月、渡した席を確認する</h2>
          <p>${escapeHtml(monthIntro)}</p>
        </div>
      </section>`;

  return `<main class="stage">
    <header class="mast">
      <p class="kicker">一人起業の役割</p>
      <h1>十二席</h1>
      <p class="lead">12の仕事のうち、自分が出る席と、人・道具・代行に渡す席を分けた。<br>今週やることは、その割り当てから先に4つへ絞る。</p>
      <p class="when">東京 ${escapeHtml(formatLongDate(date))} · ${escapeHtml(formatWeekRange(date))}</p>
      <p class="progress" aria-live="polite">今週の${counts.requiredTotal}席のうち、${counts.requiredDone}席が終わっている。</p>
    </header>

    <section class="choice">
      <h2>今週の出力</h2>
      <p>経営の席で先に決める。出荷と発信は、同じ週に必須にしない。</p>
      <div class="pick" role="group" aria-label="今週の出力">
        <button type="button" data-action="output" data-output="ship" aria-pressed="${output === "ship" ? "true" : "false"}">
          <span class="pick-title">出荷する</span>
          <span class="pick-sub">開発を終える。発信は来週。</span>
        </button>
        <button type="button" data-action="output" data-output="reach" aria-pressed="${output === "reach" ? "true" : "false"}">
          <span class="pick-title">届ける</span>
          <span class="pick-sub">発信を1本出す。開発は障害だけ。</span>
        </button>
      </div>
    </section>

    ${section(
      "今週、自分で終える",
      "経営、プロダクト、営業と、今週の出力。この4つが終われば、今週の自分の仕事は足りている。",
      required,
    )}
    ${section("届いたら、その日", "来ていなければ、開かなくていい。", inbound)}
    ${section("なければ、何もしない", "問題がなければ、終えたにしなくていい。空のまま週を越えてよい。", light)}
    ${section("今週はやらない", "出力を片方に決めたので、こちらは今週の仕事に入れない。", parked)}
    ${monthlyBlock}

    <details class="assignment">
      <summary>12席の割り当て</summary>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>機能領域</th>
              <th>役割名</th>
              <th>主な仕事</th>
              <th>一人起業での担当</th>
            </tr>
          </thead>
          <tbody>${assignmentRows()}</tbody>
        </table>
      </div>
    </details>
    <p class="footnote">記録はこのブラウザの中だけ。サーバには送らない。週が変わると「終えた」は戻り、メモは残る。</p>
  </main>`;
}

function tokyoMonthIntro(date, monthIds, counts) {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    day: "2-digit",
  }).format(date);
  const dayNum = Number(day);
  if (monthIds.length === 0) {
    return "今月の確認は済んでいる。次は、来月の最初の7日。";
  }
  if (dayNum <= 7) {
    return `デザイン、インフラ、収益、財務は自分ではやらない。月の初めに、渡した先が動いているかだけ見る。${counts.monthShown}席のうち${counts.monthDone}席が済んでいる。`;
  }
  return "月の初めの7日を過ぎて、まだ済んでいない席だけ残している。";
}

export function placementOf(id, output) {
  const seat = seatById(id);
  return seat ? placement(seat, output) : null;
}
