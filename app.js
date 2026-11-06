import {
  reconcile,
  setMemo,
  toggleMonth,
  toggleWeekly,
  withOutput,
} from "./seats.js";
import { render } from "./view.js";

const STORAGE_KEY = "juniseki.v1";
const app = document.querySelector("#app");

let state = load(new Date());

function load(date) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return reconcile(raw ? JSON.parse(raw) : null, date);
  } catch {
    return reconcile(null, date);
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // プライベートモードなどで保存できないときは、この画面のあいだだけ持つ。
  }
}

function focusKey(element) {
  if (!element || !element.dataset) return null;
  if (element.dataset.action === "output") {
    return `[data-action="output"][data-output="${element.dataset.output}"]`;
  }
  if (element.dataset.action && element.dataset.id) {
    return `[data-action="${element.dataset.action}"][data-id="${element.dataset.id}"]`;
  }
  return null;
}

function paint() {
  const key = focusKey(document.activeElement);
  const open = app.querySelector(".assignment")?.open === true;
  app.innerHTML = render(state, new Date());
  if (open) {
    const details = app.querySelector(".assignment");
    if (details) details.open = true;
  }
  if (!key) return;
  const next = app.querySelector(key);
  if (next) next.focus();
}

app.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || !app.contains(button)) return;
  const { action, id, output } = button.dataset;
  if (action === "output") state = withOutput(state, output);
  else if (action === "toggle-week") state = toggleWeekly(state, id);
  else if (action === "toggle-month") state = toggleMonth(state, id);
  else return;
  save();
  paint();
});

app.addEventListener("input", (event) => {
  const field = event.target;
  if (field.dataset.action !== "memo") return;
  state = setMemo(state, field.dataset.id, field.value);
  save();
});

paint();
