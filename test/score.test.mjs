import assert from "node:assert/strict";
import test from "node:test";
import { TYPE_ORDER, diagnose, questions, types } from "../score.js";

test("twelve questions, four options, known types only", () => {
  assert.equal(questions.length, 12);
  const prompts = new Set();
  for (const question of questions) {
    assert.equal(prompts.has(question.prompt), false);
    prompts.add(question.prompt);
    assert.equal(question.options.length, 4);
    const labels = new Set();
    for (const option of question.options) {
      assert.ok(option.label.length > 0);
      assert.equal(labels.has(option.label), false);
      labels.add(option.label);
      for (const id of Object.keys(option.scores)) {
        assert.ok(TYPE_ORDER.includes(id));
        assert.ok(option.scores[id] > 0);
      }
    }
  }
});

test("each type is the strongest choice on six options", () => {
  const counts = Object.fromEntries(TYPE_ORDER.map((id) => [id, 0]));
  for (const question of questions) {
    const primaries = question.options.map((option) => {
      let best = null;
      let bestPoints = -1;
      for (const id of TYPE_ORDER) {
        const points = option.scores[id] ?? 0;
        if (points > bestPoints) {
          best = id;
          bestPoints = points;
        }
      }
      return best;
    });
    assert.equal(new Set(primaries).size, 4);
    for (const id of primaries) counts[id] += 1;
  }
  for (const id of TYPE_ORDER) assert.equal(counts[id], 6, id);
});

test("a consistent pattern wins as that type, with daylight", () => {
  for (const id of TYPE_ORDER) {
    const answers = questions.map((question) => {
      let pick = 0;
      let best = -1;
      question.options.forEach((option, choice) => {
        const points = option.scores[id] ?? 0;
        if (points > best) {
          best = points;
          pick = choice;
        }
      });
      return pick;
    });
    const result = diagnose(answers);
    assert.equal(result.top.id, id, types[id].name);
    assert.ok(result.top.points - result.second.points > 2, types[id].name);
    assert.equal(result.close, false);
    assert.equal(result.headline, types[id].name);
    assert.ok(result.evidence.length >= 4);
  }
});

test("a margin of two points or less is marked close", () => {
  const answers = [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
  const result = diagnose(answers);
  assert.ok(result.top.points - result.second.points <= 2);
  assert.equal(result.close, true);
  assert.match(result.headline, /×/);
  assert.equal(result.profiles.length, 2);
  assert.ok(result.evidence.some((label) => label.includes("動くまで")));
  assert.ok(result.evidence.some((label) => label.includes("一本の線")));
});

test("incomplete answers are rejected", () => {
  assert.throws(() => diagnose([0, 1, 2]), /12問/);
  assert.throws(() => diagnose(Array(12).fill(4)), /不正/);
});
