import test from "node:test";
import assert from "node:assert/strict";
import {
  newData,
  validateData,
  loadData,
  answerMission,
  totalPoints,
  resetMission,
  storageKey,
  makePin,
  validateGameQuestions,
  makeRecoveryCode,
  normalizeRecoveryCode,
} from "../state.js";

test("first correct answer earns points once; wrong answers are recorded without deductions", () => {
  const before = newData();
  const m = before.missions[0];
  const wrong = answerMission(before, m.id, 0).data;
  assert.equal(totalPoints(wrong), 0);
  assert.equal(wrong.attempts[m.id].wrong, 1);
  const right = answerMission(wrong, m.id, m.correct).data;
  assert.equal(totalPoints(right), 100);
  assert.equal(right.attempts[m.id].correct, 1);
  assert.equal(totalPoints(answerMission(right, m.id, m.correct).data), 100);
  assert.deepEqual(before.completed, []);
});
test("parent preview does not mutate progress", () => {
  const data = newData();
  const result = answerMission(data, "fire", 1, true);
  assert.equal(result.correct, true);
  assert.equal(result.data, data);
  assert.equal(totalPoints(data), 0);
});
test("custom points survive round trip and resetting one mission preserves the others", () => {
  let data = newData();
  data.missions[0].points = 250;
  data = answerMission(data, "fire", 1).data;
  data = answerMission(data, "digital", 2).data;
  const restored = validateData(JSON.parse(JSON.stringify(data)));
  assert.equal(totalPoints(restored), 350);
  const reset = resetMission(restored, "fire");
  assert.equal(totalPoints(reset), 100);
  assert.deepEqual(reset.completed, ["digital"]);
});
test("invalid backup fields and duplicated answers are rejected", () => {
  const data = newData();
  data.missions[0].answers = ["نفس الخيار", "نفس الخيار", "خيار آخر"];
  assert.throws(() => validateData(data));
  assert.throws(() => validateData({ missions: [null] }));
  assert.throws(() => answerMission(newData(), "fire", 7));
});
test("corrupt saved data is protected and never silently overwritten", () => {
  let writes = 0;
  const storage = { getItem: () => "{broken", setItem: () => writes++ };
  const result = loadData(storage);
  assert.ok(result.issue);
  assert.equal(writes, 0);
});
test("migrates old progress and accepts v2 backups and empty mission lists", () => {
  const storage = {
    getItem: (key) =>
      key === storageKey
        ? null
        : JSON.stringify({ completed: ["fire", "fire", "missing"] }),
  };
  const result = loadData(storage);
  assert.equal(totalPoints(result.data), 100);
  const empty = newData();
  empty.missions = [];
  assert.equal(validateData(empty).missions.length, 0);
  assert.equal(validateData(newData()).missions.length, newData().missions.length);
});
test("upgrades an older saved catalog without deleting parent missions or progress", () => {
  const old = newData();
  old.catalogVersion = 1;
  old.missions = old.missions.slice(0, 12);
  old.completed = ["fire"];
  old.awards = { fire: 100 };
  const storage = {
    getItem: (key) => (key === storageKey ? JSON.stringify(old) : null),
  };
  const loaded = loadData(storage).data;
  assert.equal(loaded.catalogVersion, 2);
  assert.equal(loaded.missions.length, newData().missions.length);
  assert.deepEqual(loaded.completed, ["fire"]);
});
test("PIN digest stays compatible with previous SHA-256 salt scheme", async () => {
  const value = await makePin("1234", "00112233445566778899aabbccddeeff");
  assert.equal(value.length, 64);
  assert.notEqual(value, "1234");
  assert.equal(
    value,
    await makePin("1234", "00112233445566778899aabbccddeeff"),
  );
});
test("reserved object keys cannot be imported as mission IDs", () => {
  for (const id of ["__proto__", "constructor", "prototype"]) {
    const data = newData();
    data.missions[0].id = id;
    assert.throws(() => validateData(data));
  }
});

test("parent game questions are validated, kept in backups, and old files still load", () => {
  const data = newData();
  assert.deepEqual(data.gameQuestions, []);
  const { gameQuestions, ...oldFile } = data;
  assert.deepEqual(validateData(oldFile).gameQuestions, []);
  const question = { id: "game-a1", level: 2, prompt: " كم يومًا في الأسبوع؟ ", answers: ["٧", "٥", "٦"], correct: 0 };
  const saved = validateData(JSON.parse(JSON.stringify({ ...data, gameQuestions: [question] })));
  assert.equal(saved.gameQuestions[0].prompt, "كم يومًا في الأسبوع؟");
  assert.equal(saved.gameQuestions[0].level, 2);
  assert.throws(() => validateGameQuestions([{ ...question, answers: ["٧", "٧", "٦"] }]));
  assert.throws(() => validateGameQuestions([{ ...question, level: 4 }]));
  assert.throws(() => validateGameQuestions([question, question]));
});

test("recovery code survives saving, is never exported with the PIN, and normalizes input", () => {
  const data = newData();
  const salt = "a".repeat(32), hash = "b".repeat(64);
  const withRecovery = validateData({ ...data, pin: { salt, hash, recovery: { salt, hash } } });
  assert.deepEqual(withRecovery.pin.recovery, { salt, hash });
  assert.equal(validateData({ ...data, pin: { salt, hash } }).pin.recovery, undefined);
  assert.throws(() => validateData({ ...data, pin: { salt, hash, recovery: { salt: "x", hash } } }));
  const code = makeRecoveryCode();
  assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(normalizeRecoveryCode(code.toLowerCase().replace(/-/g, " ")), code.replace(/-/g, ""));
});
