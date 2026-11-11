import { defaultMissions } from './missions.js';
import { storageKey, colors, newData, validateData, loadData, totalPoints, answerMission, resetMission, makePin, makeSalt } from './state.js';

// ١. نقرأ البيانات ونحفظ حالة الشاشة التي يشاهدها المستخدم.
let browserStorage;
try {browserStorage=localStorage;} catch {browserStorage={getItem(){throw Error('Storage unavailable');}};}
const loaded = loadData(browserStorage);
let data = loaded.data;
let storageIssue = loaded.issue;
let currentScreen = 'home';
let category = 'الكل';
let parentUnlocked = false;
let draft = null;
let quiz = null;
let soundOn = false;
let confirmation = null;
let toastTimer;
const main = document.querySelector('#main');
const quizDialog = document.querySelector('#quiz-dialog');
const confirmDialog = document.querySelector('#confirm-dialog');
const navigation = [
  {id:'home',title:'الرئيسية',icon:'home'},
  {id:'missions',title:'المهمات',icon:'shield'},
  {id:'awards',title:'إنجازاتي',icon:'award'},
  {id:'about',title:'عن المشروع',icon:'book'},
  {id:'parent',title:'وليّ الأمر',icon:'lock'},
];
const shapes = {
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  shield:'<path d="m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6z"/><path d="m8 12 3 3 5-6"/>',
  award:'<circle cx="12" cy="8" r="6"/><path d="m8 13-1 9 5-3 5 3-1-9"/>',
  book:'<path d="M12 5c-3-3-7-3-10-2v16c4-1 7 0 10 2 3-2 6-3 10-2V3c-3-1-7-1-10 2zm0 0v16"/>',
  lock:'<rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 4v3"/>',
  star:'<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>',
  arrow:'<path d="M20 12H4m7-7-7 7 7 7"/>',
  sound:'<path d="m11 3-6 5H2v8h3l6 5zm5 4a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16"/>',
  mute:'<path d="m11 3-6 5H2v8h3l6 5zm5 6 6 6m0-6-6 6"/>',
  plus:'<path d="M12 4v16M4 12h16"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
};
function icon(name,size=22) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name] || shapes.shield}</svg>`;
}
// نحمي النصوص التي كتبها الأب قبل عرضها داخل HTML.
function escapeHTML(text) {
  return String(text).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
const e = escapeHTML;
const number = value => Number(value).toLocaleString('ar-IQ');
function availableMissions() {return data.missions.filter(m=>m.enabled);}
function completedMissions() {return availableMissions().filter(m=>data.completed.includes(m.id));}
function save() {
  if (storageIssue) return false;
  try {localStorage.setItem(storageKey,JSON.stringify(data)); return true;}
  catch {notify('تعذّر الحفظ على هذا الجهاز. حمّل نسخة احتياطية من لوحة وليّ الأمر.',true);return false;}
}
function notify(message,bad=false) {
  const toast=document.querySelector('#toast');
  toast.textContent=message;toast.className='toast'+(bad?' error':'');toast.hidden=false;
  toast.setAttribute('role',bad?'alert':'status');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toast.hidden=true;},7500);
}
function ask(message,run) {
  confirmation=run;document.querySelector('#confirm-message').textContent=message;confirmDialog.showModal();
}
function speak(text) {
  if (!soundOn || !data.soundAllowed || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();const speech=new SpeechSynthesisUtterance(text);speech.lang='ar-SA';speech.rate=.85;speechSynthesis.speak(speech);
}

// ٢. نرسم الشاشات باستخدام دوال صغيرة ذات أسماء واضحة.
function render() {
  const nav=navigation.map(item=>`<a href="#${item.id}" class="nav-link ${currentScreen===item.id?'active':''}" ${currentScreen===item.id?'aria-current="page"':''}>${icon(item.icon)}<span>${item.title}</span>${item.id==='missions'?`<small>${number(availableMissions().length)}</small>`:''}</a>`).join('');
  document.querySelector('.main-nav').innerHTML=nav;
  const soundButton=document.querySelector('[data-action="sound"]');
  soundButton.innerHTML=icon(soundOn?'sound':'mute');soundButton.disabled=!data.soundAllowed;
  soundButton.setAttribute('aria-label',soundOn?'إيقاف القراءة الصوتية':'تفعيل القراءة الصوتية');
  const screens={home:renderHome,missions:renderMissions,awards:renderAwards,about:renderAbout,parent:renderParent};
  main.innerHTML=screens[currentScreen]();
  document.title=(currentScreen==='home'?'المنقذ الرقمي':navigation.find(n=>n.id===currentScreen).title+' | المنقذ الرقمي')+' | مرتضى مصطفى العوادي';
}
function heading(kicker,title,description) {
  return `<div class="page-heading"><div><span class="eyebrow">${kicker}</span><h1>${title}</h1><p>${description}</p></div><span class="tiny-badge">${icon('shield',16)} معرفة تمنحك الأمان</span></div>`;
}
function statistics() {
  const count=completedMissions().length,total=availableMissions().length;
  const level=total>0&&count===total?'منقذ رقمي':count>=3?'بطل واعٍ':'بطل مستكشف';
  return `<section class="statistics" aria-label="تقدّم الطفل"><div class="stat"><span class="stat-icon gold">${icon('star',26)}</span><div><small>نجوم تستحقّها</small><strong>${number(totalPoints(data))}<em>نقطة</em></strong></div></div><div class="stat"><span class="stat-icon mint">${icon('shield',26)}</span><div><small>مهمات أنجزتها</small><strong>${number(count)}<em>من ${number(total)} مهمات</em></strong></div><div class="mini-meter"><i style="width:${total?count/total*100:0}%"></i></div></div><div class="stat"><span class="stat-icon lavender">${icon('award',26)}</span><div><small>خطوتك نحو البطولة</small><strong class="level">${level}</strong></div></div></section>`;
}
function renderHome() {
  const next=availableMissions().find(m=>!data.completed.includes(m.id))||availableMissions()[0];
  return `${heading('كل اختيار آمن يصنع بطلًا',data.childName?`أهلًا بالبطل ${e(data.childName)}! 👋`:'أهلًا يا بطل السلامة! 👋','مغامرات صغيرة، معرفة كبيرة. لنكتشف الاختيار الأكثر أمانًا معًا.')}
  ${storageIssue?`<div class="recovery-note" role="alert">${e(storageIssue)} <a href="#parent">فتح لوحة وليّ الأمر</a></div>`:''}
  <section class="hero"><div class="hero-copy"><span class="hero-tag"><span></span>تعلّم · جرّب · احمِ نفسك</span><h2>شجاعتك تبدأ<br>باختيار <span>آمن.</span></h2><p>لست بحاجة إلى قوة خارقة.<br>فكّر بهدوء، تعلّم من الموقف،<br class="phone-only"> وكن بطلًا في الحياة.</p><button class="primary hero-start" data-action="start" ${!next?'disabled':''}>${next?(completedMissions().length?'أكمل مغامرتك':'هيا نبدأ المغامرة'):'بانتظار مهمات من وليّ أمرك'}${icon('arrow',21)}</button><div class="hero-details"><span>✓ دون مؤقّت</span><span>✓ نتعلّم من الخطأ</span></div></div><div class="hero-visual"><div class="hero-orbit"></div><img src="assets/hero.svg" alt="بطل السلامة الصغير يحمل درع الاختيار الآمن"><div class="floating-label">${icon('shield',18)} بطل اليوم، واعٍ للغد</div><span class="hero-spark spark-one">✦</span><span class="hero-spark spark-two">✧</span></div></section>
  ${statistics()}<section class="mission-section"><div class="section-heading"><div><span class="eyebrow">رحلتك إلى عالم أكثر أمانًا</span><h2>مهمات صغيرة، بطولة كبيرة</h2></div><a href="#missions" class="text-link">كل المهمات ${icon('arrow',17)}</a></div>${missionGrid(availableMissions().slice(0,6))}</section>
  <section class="parent-invitation"><span class="invitation-icon">${icon('lock',27)}</span><div><h3>مهمات من تأليف أبي وأمي</h3><p>كل طفل مختلف. اكتب مواقف تناسب طفلك، وشاركْه رحلة التعلّم.</p></div><a href="#parent" class="secondary">افتح لوحة وليّ الأمر ${icon('arrow',17)}</a></section>`;
}
function missionGrid(missions) {
  if (!missions.length) return `<div class="empty-state"><span>🌱</span><h3>مغامرات جديدة تنتظرك</h3><p>يمكن لوليّ أمرك إضافة مهمة أو إظهارها من لوحته.</p></div>`;
  return `<div class="mission-grid">${missions.map(m=>`<button class="mission-card ${e(m.color)}" data-action="mission" data-id="${e(m.id)}"><div class="card-top"><span class="mission-emoji">${e(m.emoji)}</span><span class="mission-tag ${data.completed.includes(m.id)?'finished':''}">${data.completed.includes(m.id)?'✓ أنجزتها':'اكتشف وتعلّم'}</span></div><small>${e(m.category)}</small><h3>${e(m.title)}</h3><p>${e(m.brief)}</p><div class="card-bottom"><span>${icon('star',16)} ${number(m.points)} نقطة</span><span class="card-arrow">${icon('arrow',20)}</span></div><span class="card-decoration" aria-hidden="true">✦</span></button>`).join('')}</div>`;
}
function renderMissions() {
  const missions=availableMissions(),categories=['الكل',...new Set(missions.map(m=>m.category))];
  if (!categories.includes(category)) category='الكل';
  return `${heading('كل موقف فرصة للتعلّم','اختر مهمتك التالية','اقرأ بهدوء، فكّر، ثم اختر. المهم أن تفهم كيف تتصرّف بأمان.')}${statistics()}<div class="filters" aria-label="تصنيفات المهمات">${categories.map(c=>`<button class="filter ${category===c?'active':''}" aria-pressed="${category===c}" data-action="filter" data-category="${e(c)}">${e(c)}</button>`).join('')}</div>${missionGrid(missions.filter(m=>category==='الكل'||m.category===category))}`;
}
function renderAwards() {
  const complete=completedMissions().length,total=availableMissions().length,percent=total?Math.round(complete/total*100):0;
  return `${heading('كل خطوة تستحقّ أن تحتفل بها','خزانة إنجازاتك ✨','مع كل مهمة تُكملها، تضيف معرفة وشارة جديدة إلى رحلتك.')}
  <section class="achievement-banner"><div class="progress-ring" style="--progress:${percent}%"><span>${number(percent)}<small>٪ من الرحلة</small></span></div><div><span class="eyebrow">تقدّمك محفوظ على هذا الجهاز</span><h2>${total>0&&complete===total?'أحسنت، أنت منقذ رقمي!':'كل اختيار آمن يجعلك أقوى'}</h2><p>أنجزت ${number(complete)} من ${number(total)} مهمات، وجمعت ${number(totalPoints(data))} نقطة.</p></div><span class="award-art">🏆</span></section>
  <div class="badge-grid">${availableMissions().map(m=>`<article class="achievement ${data.completed.includes(m.id)?'earned':''}"><span>${data.completed.includes(m.id)?e(m.emoji):icon('lock',33)}</span><h3>${e(m.title)}</h3><p>${data.completed.includes(m.id)?'حصلت على هذه الشارة. رائع يا بطل!':'أكمل هذه المهمة لتحصل على شارتها.'}</p></article>`).join('')}</div><p class="hint">يمكن لوليّ الأمر إعادة التقدّم من لوحته عند بدء رحلة جديدة.</p>`;
}
function renderAbout() {
  return `${heading('البرمجة تصنع فرقًا','فكرة صغيرة، أثر كبير','تعرّف إلى هوية المشروع والهدف منه وكيف بُني.')}
  <section class="about-cover"><img src="assets/hero.svg" alt="بطل المنقذ الرقمي"><div><span class="eyebrow">برمجة وتطوير</span><h2>مرتضى مصطفى العوادي</h2><p>مشروع تخرّج نادي أبدع للبرمجة<br><bdi>1001</bdi> مبرمج صغير</p><span class="about-badge">صُنع بإبداع، ليُستخدم بأمان</span></div></section>
  <div class="about-grid"><section class="panel"><span class="panel-icon">${icon('shield',27)}</span><h2>الهدف من المشروع</h2><p>يهدف «المنقذ الرقمي» إلى تعليم الأطفال التصرف الآمن في المواقف الخطرة من خلال تجربة تفاعلية سهلة. يعرض موقفًا وخيارات، ويشرح التصرف الأكثر أمانًا، ويشجّع الطفل بالنقاط والشارات. يشارك الأب والأم في التعلّم بإضافة مهمات تناسب الطفل ومتابعة تقدّمه، ليجمع المشروع بين البرمجة والتوعية بالسلامة.</p></section><section class="panel"><span class="panel-icon gold">${icon('star',27)}</span><h2>ما الذي يميّزه؟</h2><ul class="feature-list"><li>مواقف واقعية وشرح هادئ لكل إجابة.</li><li>مهمات يكتبها الأب أو الأم بأنفسهم.</li><li>نقاط وشارات دون عقوبة على الخطأ.</li><li>تصميم عربي يعمل على الهاتف والحاسوب.</li><li>حفظ محلي ونسخ احتياطي للبيانات.</li><li>كود واضح يمكن للطفل قراءته وتعلّمه.</li></ul></section></div>
  <section class="panel technology-panel"><div><span class="eyebrow">كيف نُفِّذ البرنامج؟</span><h2>ثلاث أدوات، مشروع كامل</h2><p>نسخة الويب الحالية مكتوبة دون إطار عمل أو مكتبات واجهة إضافية.</p></div><div class="technology-list"><article><b>HTML</b><span>يبني هيكل الصفحة والأزرار.</span></article><article><b>CSS</b><span>يصمّم الألوان والشكل والهاتف.</span></article><article><b>JavaScript</b><span>يفحص الإجابات ويحفظ التقدّم.</span></article></div></section>
  <div class="safety-note">${icon('book',23)}<p>البرنامج للتعلّم والتدريب. عند الخطر الحقيقي ابتعد عن مصدره واطلب مساعدة شخص بالغ. القراءة الصوتية حسب الأصوات المتاحة على الجهاز. <a href="https://www.usfa.fema.gov/gallery/pictographs/escape-planning.html" target="_blank" rel="noreferrer">مرجع التوعية من الحريق ↗</a></p></div>`;
}
// ٣. لوحة وليّ الأمر: نتحقّق من الرمز قبل عرض أدوات التعديل.
function renderParent() {
  if (!parentUnlocked) return `${heading('أنت تعرف طفلك أكثر','مساحة وليّ الأمر','جهّز لطفلك رحلة يتعلّم فيها ما يحتاج إليه، بطريقته الخاصة.')}<section class="parent-gate panel"><span class="gate-icon">${icon('lock',35)}</span><h2>${data.pin?'مرحبًا بعودتك':'مغامرته تبدأ بإعدادك'}</h2><p>${data.pin?'اكتب رمزك لفتح لوحة الإدارة.':'اختر رمزًا خاصًا لحماية لوحة التعديل.'}</p><form id="pin-form"><label for="parent-pin">رمز وليّ الأمر</label><input id="parent-pin" name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,8}" minlength="4" maxlength="8" required autocomplete="${data.pin?'current-password':'new-password'}" placeholder="من 4 إلى 8 أرقام إنجليزية">${!data.pin?'<label for="confirm-pin">تأكيد الرمز</label><input id="confirm-pin" name="repeat" type="password" inputmode="numeric" maxlength="8" required autocomplete="new-password" placeholder="اكتب الرمز مرة أخرى">':''}<button class="primary">${data.pin?'فتح اللوحة':'حفظ الرمز والبدء'} ${icon('arrow',18)}</button><p id="pin-error" role="alert" class="form-error" hidden></p></form><p class="hint">قفل محلي لهذا المتصفح، وليس حسابًا على الإنترنت. احتفظ بالرمز؛ لا توجد خدمة لاستعادته.</p></section>`;
  return `${heading('مهمات من تأليفك، تعلّم يناسب طفلك','لوحة وليّ الأمر','كل شيء جاهز لتصنع رحلة خاصة لطفلك.')}
  <div class="parent-toolbar"><span class="saved-label">${icon('check',18)} ${storageIssue?'هناك بيانات تحتاج إلى استعادة':'الحفظ على هذا المتصفح والجهاز'}</span><button class="secondary" data-action="lock">${icon('lock',17)} قفل اللوحة</button></div>
  ${storageIssue?`<div class="recovery-note">${e(storageIssue)}<button class="secondary" data-action="fresh-start">بدء جديد بعد التأكيد</button></div>`:''}
  <section class="parent-overview"><div><strong>${number(data.missions.length)}</strong><span>مهمة في مكتبتك</span></div><div><strong>${number(availableMissions().length)}</strong><span>مهمة ظاهرة للطفل</span></div><div><strong>${number(data.completed.length)}</strong><span>مهمة أنجزها طفلك</span></div><div><strong>${number(totalPoints(data))}</strong><span>مجموع نقاط الطفل</span></div></section>
  <section class="panel"><div class="section-heading"><div><span class="eyebrow">رحلة تحمل اسمه</span><h2>إعدادات طفلك</h2></div></div><form id="settings-form" class="settings-form"><div class="form-field"><label for="child-name">اسم الطفل</label><input id="child-name" name="childName" maxlength="40" value="${e(data.childName)}" placeholder="اختياري، مثل: علي"></div><label class="checkbox-label"><input name="soundAllowed" type="checkbox" ${data.soundAllowed?'checked':''}> السماح بالقراءة الصوتية</label><button class="primary">حفظ الإعدادات</button></form></section>
  <section class="panel"><div class="section-heading"><div><span class="eyebrow">كل موقف تكتبه قد يصنع فرقًا</span><h2>مكتبة المهمات</h2><p>اكتب، عدّل، أخفِ، ورتّب. جرّب المهمات دون التأثير في نقاط الطفل.</p></div><button class="primary" data-action="add" ${data.missions.length>=100?'disabled':''}>${icon('plus',18)} إضافة مهمة</button></div><div class="managed-list">${data.missions.map((m,index)=>`<article class="managed-mission"><span class="managed-emoji ${e(m.color)}">${e(m.emoji)}</span><div class="managed-info"><h3>${e(m.title)}</h3><p>${e(m.category)} · ${number(m.points)} نقطة · ${data.completed.includes(m.id)?'مكتملة':'لم تكتمل'}</p><small>إجابات صحيحة: ${number(data.attempts[m.id]?.correct||0)} · محاولات تحتاج مراجعة: ${number(data.attempts[m.id]?.wrong||0)}</small></div><div class="manage-buttons"><button class="visibility-button ${m.enabled?'visible':''}" data-action="visibility" data-id="${e(m.id)}" aria-pressed="${m.enabled}">${m.enabled?'✓ ظاهرة':'مخفية'}</button><button class="small-button" data-action="move-up" data-id="${e(m.id)}" aria-label="تقديم ${e(m.title)}" ${index===0?'disabled':''}>↑</button><button class="small-button" data-action="move-down" data-id="${e(m.id)}" aria-label="تأخير ${e(m.title)}" ${index===data.missions.length-1?'disabled':''}>↓</button><button class="small-button" data-action="practice" data-id="${e(m.id)}" aria-label="تجربة ${e(m.title)}">تجربة</button><button class="small-button" data-action="edit" data-id="${e(m.id)}" aria-label="تعديل ${e(m.title)}">تعديل</button><button class="small-button danger" data-action="delete" data-id="${e(m.id)}" aria-label="حذف ${e(m.title)}">حذف</button></div></article>`).join('')||'<p class="empty-state">أضف أول مهمة لطفلك.</p>'}</div></section>
  ${draft?renderEditor():''}
  <div class="parent-tools"><section class="panel"><h2>التقدّم والنسخ الاحتياطي</h2><p>انقل مهمات طفلك وتقدّمه إلى جهاز آخر بنسخة احتياطية. رمز اللوحة لا يُصدَّر.</p><div class="tool-buttons"><button class="secondary" data-action="export">↓ تنزيل نسخة احتياطية</button><label class="secondary file-button">↑ استعادة نسخة<input type="file" id="backup-file" accept=".json,application/json" aria-label="ملف النسخة الاحتياطية"></label><button class="secondary danger" data-action="reset-progress">إعادة تقدّم الطفل</button><button class="secondary danger" data-action="reset-missions">استعادة المهمات الأصلية</button></div><p class="hint">إخفاء المهمة لا يحذف نقاطها المكتسبة. تعديل سؤال أو إجابات مهمة يعيد تقدّمها وحدها بعد التأكيد.</p></section><section class="panel"><h2>تغيير رمز وليّ الأمر</h2><form id="change-pin-form"><label for="new-pin">الرمز الجديد</label><input id="new-pin" name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,8}" minlength="4" maxlength="8" required autocomplete="new-password"><label for="new-repeat">تأكيد الرمز الجديد</label><input id="new-repeat" name="repeat" type="password" inputmode="numeric" maxlength="8" required autocomplete="new-password"><button class="secondary">حفظ الرمز الجديد</button><p class="form-error" role="alert" hidden></p></form></section></div>`;
}
function renderEditor() {
  return `<section class="panel mission-editor"><div class="section-heading"><div><span class="eyebrow">فكرتك تصبح مغامرة</span><h2 id="editor-title" tabindex="-1">${data.missions.some(m=>m.id===draft.id)?'تعديل المهمة':'مهمة جديدة من تأليفك'}</h2></div><button class="icon-button" data-action="cancel-edit" aria-label="إغلاق محرّر المهمة">${icon('close',20)}</button></div><form id="mission-form"><div class="editor-grid"><div class="form-field"><label for="mission-title">عنوان المهمة</label><input id="mission-title" name="title" maxlength="80" required value="${e(draft.title)}"></div><div class="form-field"><label for="mission-category">التصنيف</label><input id="mission-category" name="category" maxlength="60" list="categories" required value="${e(draft.category)}"><datalist id="categories">${[...new Set(data.missions.map(m=>m.category))].map(c=>`<option value="${e(c)}">`).join('')}</datalist></div><div class="form-field"><label for="mission-brief">وصف مختصر</label><input id="mission-brief" name="brief" maxlength="140" required value="${e(draft.brief)}"></div><div class="form-field"><label for="mission-points">نقاط المهمة</label><input id="mission-points" name="points" type="number" min="0" max="1000" step="1" required value="${draft.points}"></div><div class="form-field"><label for="mission-emoji">رمز المهمة</label><select id="mission-emoji" name="emoji">${[...new Set([draft.emoji,'🌟','🔥','⚡','🚦','🧭','🔐','💊','🏠','💧','🎒','🤝','🛡️'])].map(emoji=>`<option ${draft.emoji===emoji?'selected':''}>${e(emoji)}</option>`).join('')}</select></div><div class="form-field"><label for="mission-color">لون البطاقة</label><select id="mission-color" name="color">${colors.map((c,i)=>`<option value="${c}" ${draft.color===c?'selected':''}>${['برتقالي','ذهبي','أزرق','بنفسجي','أخضر','وردي'][i]}</option>`).join('')}</select></div><div class="form-field wide"><label for="mission-question">الموقف أو السؤال</label><textarea id="mission-question" name="question" rows="3" maxlength="1000" required>${e(draft.question)}</textarea></div><fieldset class="wide answer-editor"><legend>الخيارات — اختر دائرة الإجابة الصحيحة</legend>${draft.answers.map((text,i)=>`<div><label class="correct-choice"><input type="radio" name="correct" value="${i}" ${draft.correct===i?'checked':''} required> الصحيح ${number(i+1)}</label><input name="answer${i}" maxlength="500" required aria-label="الخيار ${i+1}" value="${e(text)}"></div>`).join('')}</fieldset><div class="form-field wide"><label for="mission-why">شرح التصرف الآمن</label><textarea id="mission-why" name="why" rows="3" maxlength="2000" required>${e(draft.why)}</textarea></div><div class="form-field wide"><label for="mission-tip">نصيحة يتذكّرها الطفل</label><input id="mission-tip" name="tip" maxlength="300" required value="${e(draft.tip)}"></div><label class="checkbox-label wide"><input type="checkbox" name="enabled" ${draft.enabled?'checked':''}> إظهار المهمة للطفل بعد حفظها</label></div><p class="hint">تغيير السؤال أو إجاباته يعيد تقدّم هذه المهمة. تغيير نقاطها يؤثر في الإنجازات القادمة فقط.</p><p class="form-error" role="alert" hidden></p><div class="button-row"><button class="primary">حفظ المهمة ${icon('check',18)}</button><button type="button" class="secondary" data-action="cancel-edit">إلغاء التعديل</button></div></form></section>`;
}
// ٤. عند فتح المهمة نعرض السؤال، وبعد الاختيار نعرض الشرح.
function openQuiz(id,practice=false) {
  const mission=data.missions.find(m=>m.id===id);
  if (!mission || (!mission.enabled && !practice) || (practice && !parentUnlocked)) return;
  quiz={id,practice,answer:null};renderQuiz();speak(mission.question);
}
function renderQuiz() {
  const m=data.missions.find(m=>m.id===quiz.id), answered=quiz.answer!==null,correct=quiz.answer===m.correct;
  quizDialog.innerHTML=`<button class="close-dialog" data-action="close-quiz" aria-label="إغلاق المهمة">${icon('close',22)}</button><div class="quiz-intro"><span class="quiz-emoji ${e(m.color)}">${e(m.emoji)}</span><span class="eyebrow">${quiz.practice?'معاينة وليّ الأمر · دون نقاط':e(m.category)}</span><h2 id="quiz-title">${e(m.title)}</h2><p>${e(m.question)}</p></div><div class="answer-options">${m.answers.map((answer,index)=>`<button data-action="answer" data-choice="${index}" class="answer ${answered&&index===m.correct?'correct':answered&&index===quiz.answer?'incorrect':''}" ${answered?'disabled':''}><span>${['أ','ب','ج'][index]}</span><b>${e(answer)}</b>${answered&&index===m.correct?icon('check',23):''}</button>`).join('')}</div>${answered?`<section class="feedback ${correct?'success':'learn'}" tabindex="-1" role="status"><h3>${correct?'اختيار رائع يا بطل! 🌟':'لا بأس.. نتعلّم معًا 💛'}</h3><p>${e(m.why)}</p><div class="takeaway">💡 ${e(m.tip)}</div><div class="feedback-bottom"><small>${quiz.practice?'تجربة فقط؛ لن يتغيّر تقدّم الطفل.':correct?'أنت تتعلّم وتحمي نفسك. المهمة تُحتسب مرة واحدة.':'جرّب مجددًا، دون خسارة نقاط.'}</small><button class="primary" data-action="quiz-next">${!correct?'أحاول مجددًا':quiz.practice?'العودة إلى اللوحة':availableMissions().some(item=>!data.completed.includes(item.id))?'المهمة التالية':'شاهد إنجازاتك'} ${icon('arrow',18)}</button></div></section>`:'<p class="quiz-hint">خذ وقتك. لا يوجد مؤقّت.. فكّر ثم اختر.</p>'}`;
  if (!quizDialog.open) {quizDialog.showModal();document.body.classList.add('dialog-open');}
  if (answered) quizDialog.querySelector('.feedback').focus();
}
function closeQuiz() {quizDialog.close();quiz=null;document.body.classList.remove('dialog-open');window.speechSynthesis?.cancel();}
function editMission(mission) {
  draft=structuredClone(mission);render();requestAnimationFrame(()=>{document.querySelector('#editor-title').focus();document.querySelector('.mission-editor').scrollIntoView({behavior:'smooth',block:'start'});});
}
function makeMission() {
  return {id:crypto.randomUUID(),title:'',category:'مهمات من أبي',emoji:'🌟',color:'teal',brief:'',question:'',answers:['','',''],correct:0,why:'',tip:'',points:100,enabled:true};
}

// ٥. الأزرار ترسل اسم الفعل إلى هذه الدالة الواحدة.
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');if (!button || button.disabled) return;
  const action=button.dataset.action,id=button.dataset.id;
  const parentActions=['lock','add','edit','delete','visibility','move-up','move-down','practice','cancel-edit','export','reset-progress','reset-missions','fresh-start'];
  if (parentActions.includes(action) && !parentUnlocked) return;
  if (action==='sound') {
    if (!data.soundAllowed) return; soundOn=!soundOn;window.speechSynthesis?.cancel();render();
    if (soundOn) {if(!('speechSynthesis' in window))notify('هذا المتصفح لا يدعم القراءة الصوتية.',true);else {speak('أهلًا يا بطل السلامة');notify('فُعّلت القراءة. الصوت العربي يعتمد على الأصوات المثبتة في الجهاز.');}}
  }
  if (action==='start') {const m=availableMissions().find(m=>!data.completed.includes(m.id))||availableMissions()[0];if(m)openQuiz(m.id);}
  if (action==='mission') openQuiz(id);
  if (action==='filter') {category=button.dataset.category;render();}
  if (action==='close-quiz') closeQuiz();
  if (action==='answer' && quiz && quiz.answer===null) {
    quiz.answer=Number(button.dataset.choice);const result=answerMission(data,quiz.id,quiz.answer,quiz.practice);data=result.data;
    if(!quiz.practice)save();render();renderQuiz();speak(data.missions.find(m=>m.id===quiz.id).why);
  }
  if (action==='quiz-next' && quiz) {
    const m=data.missions.find(m=>m.id===quiz.id);
    if(quiz.answer!==m.correct){quiz.answer=null;renderQuiz();}
    else if(quiz.practice)closeQuiz();
    else {const next=availableMissions().find(m=>!data.completed.includes(m.id));if(next)openQuiz(next.id);else {closeQuiz();location.hash='awards';}}
  }
  if (action==='lock') {parentUnlocked=false;draft=null;render();}
  if (action==='add' && data.missions.length<100)editMission(makeMission());
  if (action==='edit')editMission(data.missions.find(m=>m.id===id));
  if (action==='cancel-edit') {draft=null;render();}
  if (action==='practice')openQuiz(id,true);
  if (action==='visibility') {data.missions.find(m=>m.id===id).enabled=!data.missions.find(m=>m.id===id).enabled;save();render();}
  if (action==='move-up'||action==='move-down') {
    const index=data.missions.findIndex(m=>m.id===id),target=index+(action==='move-up'?-1:1);
    if(target>=0&&target<data.missions.length){[data.missions[index],data.missions[target]]=[data.missions[target],data.missions[index]];save();render();}
  }
  if (action==='delete')ask('سيُحذف محتوى هذه المهمة ونقاطها وسجلّ محاولاتها. هل تريد المتابعة؟',()=>{data=resetMission(data,id);data.missions=data.missions.filter(m=>m.id!==id);if(draft?.id===id)draft=null;save();render();notify('حُذفت المهمة.');});
  if (action==='reset-progress')ask('ستُمسح النقاط والشارات والمحاولات، وستبقى مهماتك وإعداداتك.',()=>{data.completed=[];data.awards={};data.attempts={};save();render();notify('بدأت رحلة جديدة للطفل.');});
  if (action==='reset-missions')ask('ستعود المهمات الستّ الأصلية. ستُحذف المهمات التي أضفتها وجميع النقاط والمحاولات.',()=>{data={...data,missions:structuredClone(defaultMissions),completed:[],awards:{},attempts:{}};draft=null;save();render();});
  if (action==='fresh-start')ask('هذا سيستبدل البيانات التي تعذّرت قراءتها ببيانات جديدة. يُفضّل استعادة نسخة احتياطية أولًا. هل تريد البدء من جديد؟',()=>{storageIssue='';save();render();});
  if (action==='export') {
    const blob=new Blob([JSON.stringify({version:2,data:{...data,pin:null}},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='digital-rescuer-backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('حُمّلت نسخة المهمات والتقدّم. رمز الدخول لا يُصدَّر.');
  }
  if (action==='confirm-no'){confirmDialog.close();confirmation=null;}
  if (action==='confirm-yes' && confirmation){const run=confirmation;confirmation=null;confirmDialog.close();await run();}
});

// ٦. النماذج تحفظ ما كتبه الأب بعد التحقّق من صحته.
document.addEventListener('submit',async event=>{
  event.preventDefault();const form=event.target,values=new FormData(form);
  try {
    if (form.id==='pin-form') {
      const pin=values.get('pin');if(!/^[0-9]{4,8}$/.test(pin))throw Error('اكتب من 4 إلى 8 أرقام إنجليزية.');
      if(data.pin){if(await makePin(pin,data.pin.salt)!==data.pin.hash)throw Error('الرمز غير صحيح. حاول مجددًا.');}
      else {if(pin!==values.get('repeat'))throw Error('الرمزان غير متطابقين.');const salt=makeSalt();data.pin={salt,hash:await makePin(pin,salt)};save();}
      parentUnlocked=true;render();
    }
    if (!parentUnlocked) return;
    if (form.id==='settings-form') {data.childName=values.get('childName').trim();data.soundAllowed=values.has('soundAllowed');if(!data.soundAllowed){soundOn=false;window.speechSynthesis?.cancel();}save();render();notify('حُفظت إعدادات طفلك.');}
    if (form.id==='change-pin-form') {
      const pin=values.get('pin');if(!/^[0-9]{4,8}$/.test(pin)||pin!==values.get('repeat'))throw Error('اكتب رمزًا من 4 إلى 8 أرقام إنجليزية وأكّده بنفس القيمة.');
      const salt=makeSalt();data.pin={salt,hash:await makePin(pin,salt)};save();form.reset();notify('حُفظ الرمز الجديد.');
    }
    if (form.id==='mission-form' && draft) {
      const mission={...draft};for(const key of ['title','category','emoji','color','brief','question','why','tip'])mission[key]=values.get(key).trim();
      mission.points=Number(values.get('points'));mission.correct=Number(values.get('correct'));mission.enabled=values.has('enabled');mission.answers=[0,1,2].map(i=>values.get('answer'+i).trim());
      const previous=data.missions.find(m=>m.id===mission.id);
      const list=previous?data.missions.map(m=>m.id===mission.id?mission:m):[...data.missions,mission];validateData({...data,missions:list});
      const changed=previous&&(previous.question!==mission.question||previous.correct!==mission.correct||JSON.stringify(previous.answers)!==JSON.stringify(mission.answers));
      const finish=()=>{if(changed)data=resetMission(data,mission.id);data.missions=list;draft=null;save();render();notify('حُفظت المهمة. حان وقت مغامرة جديدة!');};
      if(changed&&(data.completed.includes(mission.id)||data.attempts[mission.id]))ask('تغيّر السؤال أو إجاباته. حفظ التعديل سيعيد تقدّم هذه المهمة وحدها.',finish);else finish();
    }
  } catch(error) {const field=form.querySelector('.form-error');if(field){field.textContent=error.message;field.hidden=false;}else notify(error.message,true);}
});
document.addEventListener('change',async event=>{
  if(event.target.id!=='backup-file'||!parentUnlocked)return;
  const input=event.target,file=input.files[0];if(!file)return;
  try {
    if(file.size>5_000_000)throw Error('اختر نسخة احتياطية لا تتجاوز 5 ميغابايت.');
    const backup=JSON.parse(await file.text());if(backup.version!==2)throw Error('هذه ليست نسخة احتياطية مدعومة.');
    const imported=validateData({...backup.data,pin:data.pin});
    ask('ستستبدل النسخة الاحتياطية المهمات والتقدّم وإعدادات الطفل. سيبقى رمزك الحالي.',()=>{data=imported;storageIssue='';draft=null;save();render();notify('استُعيدت النسخة الاحتياطية بنجاح.');});
  } catch(error){notify(error.message||'تعذّرت قراءة النسخة الاحتياطية.',true);}finally{input.value='';}
});
quizDialog.addEventListener('cancel',event=>{event.preventDefault();closeQuiz();});
quizDialog.addEventListener('click',event=>{if(event.target===quizDialog){const r=quizDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeQuiz();}});
confirmDialog.addEventListener('cancel',()=>{confirmation=null;});
function navigate() {
  const name=location.hash.slice(1);const next=navigation.some(n=>n.id===name)?name:'home';
  if(next!=='parent'){parentUnlocked=false;draft=null;}
  currentScreen=next;render();window.scrollTo(0,0);
}
window.addEventListener('hashchange',navigate);
navigate();
if(!storageIssue)save();

// ٧. الهاتف: يمكن تثبيت الموقع وفتح نسخته المحفوظة دون إنترنت.
let installPrompt;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;document.querySelector('#install-button').hidden=false;});
document.querySelector('#install-button').addEventListener('click',async()=>{if(!installPrompt)return;await installPrompt.prompt();installPrompt=null;document.querySelector('#install-button').hidden=true;});
function connectionStatus(){document.querySelector('#connection-status').textContent=navigator.onLine?'مساحة تعلّم آمنة':'أنت دون إنترنت · التقدّم محفوظ محليًا';}
window.addEventListener('online',connectionStatus);window.addEventListener('offline',connectionStatus);connectionStatus();
if('serviceWorker' in navigator && location.protocol!=='file:' && !document.documentElement.hasAttribute('data-standalone'))navigator.serviceWorker.register('./sw.js').catch(()=>{});

