import { defaultMissions } from "./missions.js";

// البيانات محفوظة في المتصفح، ولا تُرسل إلى خادم.
export const storageKey = "digital-rescuer-family-v2";
export const colors = ["orange", "yellow", "blue", "purple", "teal", "pink"];
export function newData() {
  return {
    catalogVersion: 2,
    missions: structuredClone(defaultMissions),
    completed: [],
    awards: {},
    attempts: {},
    childName: "",
    soundAllowed: true,
    pin: null,
    gameQuestions: [],
  };
}

// أسئلة يكتبها الأبوان للعبة الأرقام والكلمات. الملفات القديمة بلا أسئلة تبقى صالحة.
export function validateGameQuestions(list = []) {
  if (!Array.isArray(list) || list.length > 60)
    throw Error("أسئلة اللعبة غير صالحة.");
  const ids = new Set();
  return list.map((q) => {
    if (
      !q ||
      typeof q.id !== "string" ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(q.id) ||
      ids.has(q.id)
    )
      throw Error("معرّف سؤال اللعبة غير صالح.");
    ids.add(q.id);
    if (!Number.isInteger(q.level) || q.level < 1 || q.level > 3)
      throw Error("اختر مستوى السؤال.");
    if (typeof q.prompt !== "string" || !q.prompt.trim() || q.prompt.length > 200)
      throw Error("اكتب السؤال في أقل من 200 حرف.");
    if (
      !Array.isArray(q.answers) ||
      q.answers.length !== 3 ||
      q.answers.some((a) => typeof a !== "string" || !a.trim() || a.length > 60) ||
      new Set(q.answers.map((a) => a.trim())).size !== 3 ||
      !Number.isInteger(q.correct) ||
      q.correct < 0 ||
      q.correct > 2
    )
      throw Error("اكتب ثلاث إجابات قصيرة مختلفة وحدّد الصحيحة.");
    return {
      id: q.id,
      level: q.level,
      prompt: q.prompt.trim(),
      answers: q.answers.map((a) => a.trim()),
      correct: q.correct,
    };
  });
}

export function validateData(value) {
  if (!value || typeof value !== "object")
    throw Error("ملف البيانات غير صالح.");
  if (
    !Array.isArray(value.missions) ||
    value.missions.length > 100 ||
    !Array.isArray(value.completed)
  )
    throw Error("قائمة المهمات غير صالحة.");
  if (
    typeof value.childName !== "string" ||
    value.childName.length > 40 ||
    typeof value.soundAllowed !== "boolean"
  )
    throw Error("إعدادات الطفل غير صالحة.");
  const ids = new Set();
  const missions = value.missions.map((m) => {
    if (
      !m ||
      typeof m.id !== "string" ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(m.id) ||
      ids.has(m.id) ||
      ["__proto__", "constructor", "prototype"].includes(m.id)
    )
      throw Error("معرّف المهمة غير صالح.");
    ids.add(m.id);
    const mission = {};
    for (const field of [
      "id",
      "title",
      "category",
      "color",
      "emoji",
      "brief",
      "question",
      "why",
      "tip",
    ]) {
      if (
        typeof m[field] !== "string" ||
        !m[field].trim() ||
        m[field].length > 2000
      )
        throw Error("املأ جميع نصوص المهمة.");
      mission[field] = m[field].trim();
    }
    if (
      !colors.includes(m.color) ||
      typeof m.enabled !== "boolean" ||
      !Number.isInteger(m.points) ||
      m.points < 0 ||
      m.points > 1000
    )
      throw Error("نقاط المهمة أو إعداداتها غير صالحة.");
    if (
      !Array.isArray(m.answers) ||
      m.answers.length !== 3 ||
      m.answers.some(
        (a) => typeof a !== "string" || !a.trim() || a.length > 500,
      ) ||
      new Set(m.answers.map((a) => a.trim())).size !== 3 ||
      !Number.isInteger(m.correct) ||
      m.correct < 0 ||
      m.correct > 2
    )
      throw Error("اكتب ثلاثة خيارات مختلفة وحدّد الإجابة الصحيحة.");
    // الملفات القديمة لا تحتوي مستوى؛ نبدأها من المستوى الأول دون كسر النسخ الاحتياطية.
    const level = Number.isInteger(m.level) && m.level >= 1 && m.level <= 3 ? m.level : 1;
    return {
      ...mission,
      level,
      points: m.points,
      enabled: m.enabled,
      answers: m.answers.map((a) => a.trim()),
      correct: m.correct,
    };
  });
  const completed = [...new Set(value.completed.filter((id) => ids.has(id)))];
  const awards = {},
    attempts = {};
  for (const m of missions) {
    if (completed.includes(m.id))
      awards[m.id] =
        Number.isInteger(value.awards?.[m.id]) &&
        value.awards[m.id] >= 0 &&
        value.awards[m.id] <= 1000
          ? value.awards[m.id]
          : m.points;
    const a = value.attempts?.[m.id];
    if (
      a &&
      Number.isSafeInteger(a.correct) &&
      a.correct >= 0 &&
      Number.isSafeInteger(a.wrong) &&
      a.wrong >= 0 &&
      typeof a.lastAt === "string"
    )
      attempts[m.id] = { correct: a.correct, wrong: a.wrong, lastAt: a.lastAt };
  }
  const pin = value.pin;
  if (
    pin !== null &&
    (!pin ||
      !/^[a-f0-9]{32}$/.test(pin.salt) ||
      !/^[a-f0-9]{64}$/.test(pin.hash))
  )
    throw Error("إعداد رمز وليّ الأمر غير صالح.");
  const catalogVersion =
    Number.isInteger(value.catalogVersion) && value.catalogVersion >= 1 && value.catalogVersion <= 2
      ? value.catalogVersion
      : 1;
  return {
    catalogVersion,
    missions,
    completed,
    awards,
    attempts,
    childName: value.childName.trim(),
    soundAllowed: value.soundAllowed,
    pin: pin ? { salt: pin.salt, hash: pin.hash } : null,
    gameQuestions: validateGameQuestions(value.gameQuestions ?? []),
  };
}

export function loadData(storage) {
  try {
    const saved = storage.getItem(storageKey);
    if (saved !== null) {
      const data = validateData(JSON.parse(saved));
      // تحديث واحد فقط يضيف مهمات المشروع الجديدة ويحفظ ما أضافه وليّ الأمر.
      if (data.catalogVersion < 2) {
        const knownIds = new Set(data.missions.map((mission) => mission.id));
        data.missions.push(
          ...structuredClone(defaultMissions).filter(
            (mission) => !knownIds.has(mission.id),
          ),
        );
        data.catalogVersion = 2;
      }
      return { data, issue: "" };
    }
    const old = JSON.parse(
      storage.getItem("digital-rescuer-murtadha-v1") || "{}",
    );
    const data = newData();
    if (Array.isArray(old.completed))
      data.completed = [
        ...new Set(
          old.completed.filter((id) => data.missions.some((m) => m.id === id)),
        ),
      ];
    data.completed.forEach((id) => {
      data.awards[id] = 100;
    });
    return { data, issue: "" };
  } catch {
    // لا نستبدل الملف المحفوظ التالف ببيانات فارغة تلقائيًا.
    return {
      data: newData(),
      issue:
        "تعذّرت قراءة البيانات المحفوظة. لم نغيّرها. يستطيع وليّ الأمر استعادة نسخة احتياطية أو تأكيد بدء جديد.",
    };
  }
}

export function totalPoints(data) {
  return Object.values(data.awards).reduce((sum, points) => sum + points, 0);
}

export function answerMission(data, id, choice, practice = false) {
  const mission = data.missions.find((m) => m.id === id);
  if (!mission || !Number.isInteger(choice) || choice < 0 || choice > 2)
    throw Error("الخيار غير صالح.");
  const correct = choice === mission.correct;
  if (practice) return { data, correct };
  const result = structuredClone(data);
  const attempt = result.attempts[id] || { correct: 0, wrong: 0, lastAt: "" };
  attempt[correct ? "correct" : "wrong"] += 1;
  attempt.lastAt = new Date().toISOString();
  result.attempts[id] = attempt;
  // النقاط تُمنح عند أول إجابة صحيحة فقط.
  if (correct && !result.completed.includes(id)) {
    result.completed.push(id);
    result.awards[id] = mission.points;
  }
  return { data: result, correct };
}

export function resetMission(data, id) {
  const result = structuredClone(data);
  result.completed = result.completed.filter((item) => item !== id);
  delete result.awards[id];
  delete result.attempts[id];
  return result;
}

export async function makePin(pin, salt) {
  const value = new TextEncoder().encode(salt + ":" + pin);
  const hash = await crypto.subtle.digest("SHA-256", value);
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function makeSalt() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
