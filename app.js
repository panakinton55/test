import { diagnose, questions, resultText } from "./score.js";

const STORAGE_KEY = "mukisaki-answers-v1";
const root = document.querySelector("#app");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let step = "intro";
let index = 0;
let answers = [];
let locked = false;
let timer = 0;

function h(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "className") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, "");
    else if (value !== false && value != null) node.setAttribute(key, String(value));
  }
  for (const child of children) {
    if (child) node.append(child);
  }
  return node;
}

function persist() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ answers, index, step }),
    );
  } catch {
    // Private mode can reject storage. The diagnosis still runs.
  }
}

function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!Array.isArray(data.answers)) return;
    const valid = data.answers.every(
      (choice) => Number.isInteger(choice) && choice >= 0 && choice <= 3,
    );
    if (!valid || data.answers.length > questions.length) return;
    answers = data.answers;
    if (data.step === "result" && answers.length === questions.length) {
      step = "result";
      index = questions.length;
      return;
    }
    if (data.step === "question") {
      step = "question";
      index = Math.min(data.index ?? answers.length, questions.length - 1);
      answers = answers.slice(0, index);
    }
  } catch {
    // Ignore a broken save and start clean.
  }
}

function setStep(next) {
  step = next;
  persist();
  render();
}

function choose(choice) {
  if (locked || step !== "question") return;
  locked = true;
  const delay = reduceMotion ? 0 : 160;
  timer = window.setTimeout(() => {
    answers[index] = choice;
    if (index === questions.length - 1) {
      index = questions.length;
      locked = false;
      setStep("result");
      return;
    }
    index += 1;
    locked = false;
    persist();
    render();
  }, delay);
}

function back() {
  if (step !== "question" || index === 0) return;
  window.clearTimeout(timer);
  locked = false;
  index -= 1;
  answers = answers.slice(0, index);
  persist();
  render();
}

function restart() {
  window.clearTimeout(timer);
  locked = false;
  answers = [];
  index = 0;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable.
  }
  setStep("intro");
}

function meter(progress) {
  const bar = h("div", { className: "meter", "aria-hidden": "true" });
  const fill = h("i");
  fill.style.width = `${Math.round(progress * 100)}%`;
  bar.append(fill);
  return bar;
}

function renderIntro() {
  document.title = "向き先";
  root.replaceChildren(
    meter(0),
    h("main", { className: "stage" }, [
      h("p", { className: "kicker", text: "向き先" }),
      h("h1", {}, [document.createTextNode("何に"), h("br"), document.createTextNode("向いてるか。")]),
      h("p", { className: "dek" }, [
        h("span", { text: "12の場面で、消耗が少なく続きやすい条件を見る。" }),
        h("span", { text: "才能の宣告ではない。" }),
      ]),
      h("button", { className: "start", type: "button", text: "診断をはじめる", onClick: () => setStep("question") }),
      h("p", {
        className: "fine",
        text: "迷ったら、少し面倒な方を選ぶ。回答はこのブラウザにだけ残り、サーバには送らない。",
      }),
    ]),
  );
  }

function renderQuestion() {
  const question = questions[index];
  const count = String(index + 1).padStart(2, "0");
  document.title = `${count} / 12 — 向き先`;

  const options = h("div", { className: "options", role: "group", "aria-labelledby": "prompt" });
  question.options.forEach((option, choice) => {
    const button = h("button", {
      className: "option",
      type: "button",
      onClick: () => {
        button.classList.add("is-chosen");
        choose(choice);
      },
    }, [
      h("span", { className: "key", text: String(choice + 1) }),
      h("span", { className: "label", text: option.label }),
    ]);
    options.append(button);
  });

  const header = h("header", { className: "top" }, [
    h("p", { className: "brand", text: "向き先" }),
    h("p", { className: "count", text: `${count} / 12` }),
  ]);

  const controls = h("div", { className: "controls" }, [
    index > 0
      ? h("button", { className: "text-button", type: "button", text: "一つ戻る", onClick: back })
      : h("span"),
    h("p", { className: "keys", text: "1–4 で選ぶ" }),
  ]);

  root.replaceChildren(
    meter(index / questions.length),
    h("main", { className: "stage" }, [
      header,
      h("h2", { id: "prompt", text: question.prompt }),
      options,
      controls,
    ]),
  );
  }

function renderProfile(profile, showIntro) {
  return h("section", { className: "profile" }, [
    showIntro ? h("h3", { className: "profile-name", text: profile.name }) : null,
    showIntro ? h("p", { text: profile.line }) : null,
    h("h4", { text: "向いている条件" }),
    h("ul", {}, profile.fit.map((item) => h("li", { text: item }))),
    h("h4", { text: "消耗しやすい条件" }),
    h("ul", {}, profile.drain.map((item) => h("li", { text: item }))),
  ]);
}

function renderResult() {
  const result = diagnose(answers);
  document.title = `${result.headline} — 向き先`;
  const today = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const scores = h("ol", { className: "scores" });
  for (const row of result.ranked) {
    const width = result.maxPoints === 0 ? 0 : Math.round((row.points / result.maxPoints) * 100);
    const track = h("span", { className: "track", "aria-hidden": "true" });
    if (row.points > 0) {
      const fill = h("i", { className: row.id === result.top.id ? "is-top" : "" });
      fill.style.width = `${width}%`;
      track.append(fill);
    }
    scores.append(
      h("li", { className: row.id === result.top.id ? "is-top" : "" }, [
        h("span", { className: "score-name", text: row.type.name }),
        track,
        h("span", { className: "score-points", text: String(row.points) }),
      ]),
    );
  }

  const review = h("ol");
  questions.forEach((question, questionIndex) => {
    review.append(
      h("li", {}, [
        h("p", { className: "review-q", text: question.prompt }),
        h("p", { className: "review-a", text: question.options[answers[questionIndex]].label }),
      ]),
    );
  });

  const copyButton = h("button", {
    className: "text-button",
    type: "button",
    text: "結果をコピー",
    onClick: async () => {
      const text = resultText(result);
      let copied = false;
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.left = "-9999px";
        document.body.append(area);
        area.select();
        copied = document.execCommand("copy");
        area.remove();
      }
      copyButton.textContent = copied ? "コピーした" : "コピーできなかった";
      window.setTimeout(() => {
        copyButton.textContent = "結果をコピー";
      }, 1600);
    },
  });

  const evidence = result.evidence.length
    ? h("section", {}, [
        h("h3", { text: "こう選んでいた" }),
        h("ul", { className: "quotes" }, result.evidence.map((label) => h("li", { text: label }))),
      ])
    : null;

  root.replaceChildren(
    meter(1),
    h("main", { className: "stage result" }, [
      h("header", { className: "top" }, [
        h("p", { className: "brand", text: "診断書" }),
        h("p", { className: "count", text: today }),
      ]),
      h("p", { className: "kicker", text: result.tied ? "同点のふたつ" : result.close ? "近いふたつ" : "いちばん続きやすい型" }),
      h("h1", { className: "result-title", text: result.headline }),
      h("p", { className: "dek", text: result.lead }),
      h("section", {}, [
        h("h3", { text: "12問の厚み" }),
        h("p", { className: "fine", text: "太いほど、選んだ答えがその型に寄っている。点数は偏差値ではない。" }),
        scores,
      ]),
      evidence,
      h("div", { className: result.close ? "split" : "split is-single" }, result.profiles.map((profile) => renderProfile(profile, result.close))),
      h("section", { className: "try" }, [
        h("h3", { text: "今週ためすこと" }),
        ...result.profiles.map((profile) =>
          h("p", { text: result.close ? `${profile.name}。${profile.try}` : profile.try }),
        ),
      ]),
      h("section", {}, [
        h("h3", { text: "仕事の例" }),
        h("p", { text: result.profiles.flatMap((profile) => profile.roles).join("、") }),
        h("p", {
          className: "fine",
          text: "職種の名簿ではない。同じ名前の仕事でも、条件が違えば消耗する。",
        }),
      ]),
      h("details", { className: "review" }, [
        h("summary", { text: "12問の選び方" }),
        review,
      ]),
      h("div", { className: "actions" }, [
        h("button", { className: "start", type: "button", text: "もう一度", onClick: restart }),
        copyButton,
      ]),
      h("p", {
        className: "fine",
        text: "同じ人でも、時期が変われば結果は変わる。答えはこのブラウザにだけ残している。",
      }),
    ]),
  );
  root.querySelector("h1").focus();
}

function render() {
  if (step === "intro") renderIntro();
  else if (step === "question") renderQuestion();
  else renderResult();
  window.scrollTo(0, 0);
}

document.addEventListener("keydown", (event) => {
  if (step !== "question") return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === "ArrowLeft" || event.key === "Backspace") {
    event.preventDefault();
    back();
    return;
  }
  const choice = Number(event.key) - 1;
  if (choice >= 0 && choice <= 3) {
    event.preventDefault();
    const button = root.querySelectorAll(".option")[choice];
    if (button) button.classList.add("is-chosen");
    choose(choice);
  }
});

if (new URLSearchParams(location.search).has("new")) {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable.
  }
  history.replaceState(null, "", location.pathname);
}

restore();
render();
