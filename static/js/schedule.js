// ------------------------------------------------------------------- week

let weekLoadVersion = 0;

async function loadWeek(){
  if (!current) return;
  const ctx = {...current};
  const version = ++weekLoadVersion;
  const q = `jugurtmoMainId=${encodeURIComponent(ctx.jugurtmoMainId)}&gradeId=${encodeURIComponent(ctx.gradeId)}&schoolId=${encodeURIComponent(ctx.schoolId)}`;
  const r = await api("GET", `/api/week?${q}`);
  if (!current || version !== weekLoadVersion || current.gradeId !== ctx.gradeId || current.jugurtmoMainId !== ctx.jugurtmoMainId) return;
  weekData = r.days;
  await resolveNames(ctx.gradeId);
  if (!current || version !== weekLoadVersion || current.gradeId !== ctx.gradeId || current.jugurtmoMainId !== ctx.jugurtmoMainId) return;
  render();
}
async function resolveNames(gradeId){
  const subjById = Object.fromEntries(subjects.map(s=>[s.id, s.name]));
  const roomById = Object.fromEntries(rooms.map(r=>[r.id, r.name]));
  const subjectIds = new Set();
  for (const d of Object.values(weekData)) for (const item of Object.values(d)) if (item?.subjectId) subjectIds.add(item.subjectId);
  const staffLists = await Promise.all([...subjectIds].map(id=>loadStaff(id, gradeId)));
  const staffById = {};
  staffLists.forEach(list=> list.forEach(s=> staffById[s.id]=s.name));
  for (const d of Object.values(weekData)){
    for (const item of Object.values(d)){
      if (!item) continue;
      if (!item.subj) item.subj = subjById[String(item.subjectId)] || subjById[item.subjectId] || "";
      if (!item.room) item.room = roomById[item.roomId] || "";
      if (!item.staff) item.staff = staffById[item.staffId] || "";
    }
  }
}
function cellAt(dayIdx1, lesson){
  const d = weekData[String(dayIdx1)];
  return d ? d[String(lesson)] : undefined;
}

// -------------------------------------------------------------- rendering
// Раскладка "колонка на день" с карточками уроков вместо жёсткой таблицы —
// удобнее читать, когда шаблонов/предметов много, и лучше ведёт себя на
// узких экранах (колонки листаются по горизонтали).

function cardHtml(day, l, item){
  if (!item){
    return `<div class="lesson-card empty" data-day="${day}" data-lesson="${l}">+</div>`;
  }
  if (!item.subjectId){
    return `<div class="lesson-card timed-empty" data-day="${day}" data-lesson="${l}">
      ${item.objectId ? `<button class="slot-delete" type="button" title="Удалить урок" data-day="${day}" data-lesson="${l}">×</button>` : ""}
      <div class="lc-time">${item.bell||""}</div><div class="lc-plus">+</div>
    </div>`;
  }
  return `<div class="lesson-card filled" draggable="true" data-day="${day}" data-lesson="${l}">
    <button class="slot-delete" type="button" title="Удалить урок" data-day="${day}" data-lesson="${l}">×</button>
    <div class="lc-time">${item.bell||""} · урок ${l}</div>
    <div class="lc-subj">${escapeHtml(item.subj || "(id "+item.subjectId.slice(0,6)+")")}</div>
    <div class="lc-staff">${escapeHtml(item.staff || (item.staffId? item.staffId.slice(0,6):""))}</div>
    <div class="lc-room">${escapeHtml(item.room || (item.roomId? item.roomId.slice(0,6):""))}</div>
  </div>`;
}

function render(){
  if (appMode === "view") { renderPublishedSchedule(); return; }
  const board = document.getElementById("daysBoard");
  board.innerHTML = DAYS.map((d,i)=>{
    const day = i+1;
    const cards = LESSON_ROWS.map(l=> cardHtml(day, l, cellAt(day,l))).join("");
    return `<div class="day-column" data-day="${day}">
      <div class="day-column-head">
        <span class="day-name" data-day="${day}">${d}</span>
        <div class="day-actions">
          <button class="day-action fillday-btn" data-day="${day}" title="Заполнить часы по шаблону смены">⏱</button>
          <button class="day-action copyday-btn" data-day="${day}" title="Скопировать этот день в другой">⧉</button>
          <button class="day-action swapday-btn" data-day="${day}" title="Поменять местами с другим днём">⇄</button>
        </div>
      </div>
      <div class="day-column-body" data-day="${day}">${cards}</div>
    </div>`;
  }).join("");
  attachHandlers();
  document.querySelectorAll(".lesson-card").forEach(el=>{
    const k=keyOf(+el.dataset.day,+el.dataset.lesson);
    el.classList.toggle("selected", selectedLessons.has(k));
  });
  updateSelectionUI();
}

async function deleteLessonFast(day, lesson){
  const existing = cellAt(day, lesson);
  if (!existing?.objectId) return;
  const batch=[];
  recordPrev(batch, day, lesson);
  try{
    await api("POST", "/api/lesson/delete", {objectId: existing.objectId});
    pushHistory(batch);
    selectedLessons.delete(keyOf(day, lesson));
    showToast(`Удалено: ${DAYS[day-1]}, урок ${lesson}`);
    await loadWeek();
  }catch(err){
    showToast("Ошибка: "+err.message);
  }
}

function clearLessonSelection(){
  selectedLessons.clear();
  selectionAnchor = null;
  document.querySelectorAll(".lesson-card.selected").forEach(el=>el.classList.remove("selected"));
  updateSelectionUI();
}
function updateSelectionUI(){
  const count = selectedLessons.size;
  const btn = document.getElementById("btnDeleteSelected");
  const label = document.getElementById("selectionCount");
  if (btn) {
    btn.disabled = count === 0;
    btn.textContent = count ? `Удалить выбранные (${count})` : "Удалить выбранные";
  }
  if (label) label.textContent = count ? `Выбрано: ${count}` : "";
}
function selectLesson(day, lesson, mode){
  const key = keyOf(day, lesson);
  if (mode === "range" && selectionAnchor){
    const cards = [...document.querySelectorAll(".lesson-card")];
    const a = cards.findIndex(el=>keyOf(+el.dataset.day,+el.dataset.lesson)===selectionAnchor);
    const b = cards.findIndex(el=>keyOf(+el.dataset.day,+el.dataset.lesson)===key);
    if (a >= 0 && b >= 0){
      const lo=Math.min(a,b), hi=Math.max(a,b);
      for (let i=lo;i<=hi;i++){
        const el=cards[i];
        const d=+el.dataset.day, l=+el.dataset.lesson;
        if (cellAt(d,l)?.objectId) selectedLessons.add(keyOf(d,l));
      }
    }
  } else if (mode === "toggle") {
    if (selectedLessons.has(key)) selectedLessons.delete(key);
    else if (cellAt(day,lesson)?.objectId) selectedLessons.add(key);
    selectionAnchor = key;
  } else {
    clearLessonSelection();
    if (cellAt(day,lesson)?.objectId) selectedLessons.add(key);
    selectionAnchor = key;
  }
  document.querySelectorAll(".lesson-card").forEach(el=>{
    const k=keyOf(+el.dataset.day,+el.dataset.lesson);
    el.classList.toggle("selected", selectedLessons.has(k));
  });
  updateSelectionUI();
}
async function deleteSelectedLessons(){
  const entries = [...selectedLessons].map(k=>k.split("-").map(Number));
  const valid = entries.filter(([day,lesson])=>cellAt(day,lesson)?.objectId);
  if (!valid.length) return;
  const batch=[];
  try{
    for (const [day,lesson] of valid){
      const existing=cellAt(day,lesson);
      recordPrev(batch,day,lesson);
      await api("POST","/api/lesson/delete",{objectId:existing.objectId});
    }
    pushHistory(batch);
    const n=valid.length;
    clearLessonSelection();
    showToast(`Удалено уроков: ${n}`);
    await loadWeek();
  }catch(err){
    showToast("Ошибка удаления: "+err.message);
  }
}

function attachHandlers(){
  document.querySelectorAll(".fillday-btn").forEach(btn=>{
    btn.addEventListener("click", async e=>{
      e.stopPropagation();
      try{
        const day = +btn.dataset.day;
        const batch = LESSON_ROWS.map(l=>({day, lesson:l, prevState: cellAt(day,l)?{...cellAt(day,l)}:null}));
        await api("POST","/api/day/fill", {jugurtmoMainId:current.jugurtmoMainId, day});
        pushHistory(batch);
        showToast("Часы заполнены");
        await loadWeek();
      }catch(err){ showToast("Ошибка: "+err.message); }
    });
  });
  document.querySelectorAll(".copyday-btn").forEach(btn=>{
    btn.addEventListener("click", e=>{
      e.stopPropagation();
      dayClipboard = +btn.dataset.day; armedDaySwap = null; clearArmed();
      showBanner(`⧉ Копирую день ${DAYS[dayClipboard-1]} — клик по другому дню, чтобы вставить туда (Esc — отмена)`);
    });
  });
  document.querySelectorAll(".swapday-btn").forEach(btn=>{
    btn.addEventListener("click", e=>{
      e.stopPropagation();
      dayClipboard = null; clearArmed();
      armedDaySwap = +btn.dataset.day;
      showBanner(`⇄ Меняю день ${DAYS[armedDaySwap-1]} — клик по другому дню, чтобы поменять местами (Esc — отмена)`);
    });
  });
  document.querySelectorAll(".day-name").forEach(el=>{
    el.addEventListener("click", async e=>{
      e.stopPropagation();
      const dst = +el.dataset.day;
      if (dayClipboard!==null){
        if (dst!==dayClipboard) await copyDay(dayClipboard, dst);
        dayClipboard = null; hideBanner();
        return;
      }
      if (armedDaySwap!==null){
        if (dst!==armedDaySwap) await swapDays(armedDaySwap, dst);
        armedDaySwap = null; hideBanner();
        return;
      }
    });
  });
  document.querySelectorAll(".day-column").forEach(col=>{
    col.addEventListener("dragover", e=>{ e.preventDefault(); });
    col.addEventListener("drop", async e=>{
      e.preventDefault();
      const dstDay=+col.dataset.day;
      if (dragDay===null || dragDay===dstDay) return;
      await swapDays(dragDay, dstDay);
      dragDay=null;
    });
  });
  document.querySelectorAll(".day-column-head").forEach(head=>{
    head.setAttribute("draggable","true");
    head.addEventListener("dragstart", ()=>{ dragDay=+head.closest(".day-column").dataset.day; });
  });
  document.querySelectorAll(".slot-delete").forEach(btn=>{
    btn.addEventListener("click", async e=>{
      e.preventDefault();
      e.stopPropagation();
      await deleteLessonFast(+btn.dataset.day, +btn.dataset.lesson);
    });
  });
  document.querySelectorAll(".lesson-card").forEach(el=>{
    el.addEventListener("click", e=>{
      const day=+el.dataset.day, lesson=+el.dataset.lesson;
      if (clipboard){ pasteClipboard(day, lesson); return; }
      if (armedTemplate){ const t=armedTemplate; clearArmed(); hideBanner(); applyTemplate(day, lesson, t); return; }
      if (armedSubject){ const s=armedSubject; clearArmed(); hideBanner(); openPanel(day, lesson, s); return; }
      if (e.ctrlKey || e.metaKey){
        selectLesson(day, lesson, "toggle");
        return;
      }
      if (e.shiftKey){
        selectLesson(day, lesson, "range");
        return;
      }
      if (selectedLessons.size){ clearLessonSelection(); }
      openPanel(day, lesson);
    });
    el.addEventListener("dragstart", e=>{
      if (!el.classList.contains("filled")){ e.preventDefault(); return; }
      dragSrc = {day:+el.dataset.day, lesson:+el.dataset.lesson};
    });
    el.addEventListener("dragover", e=>{ e.preventDefault(); e.stopPropagation(); el.classList.add("dragover"); });
    el.addEventListener("dragleave", ()=> el.classList.remove("dragover"));
    el.addEventListener("drop", async e=>{
      e.preventDefault(); e.stopPropagation(); el.classList.remove("dragover");
      const day=+el.dataset.day, lesson=+el.dataset.lesson;
      if (dragTemplate){ await applyTemplate(day, lesson, dragTemplate); dragTemplate=null; return; }
      if (dragSubject){ openPanel(day, lesson, dragSubject); dragSubject=null; return; }
      if (dragSrc){ await swapCells(dragSrc, {day,lesson}); dragSrc=null; }
    });
  });
}


// ------------------------------------------------------------- multi-select

document.addEventListener("keydown", e=>{
  const tag=(e.target?.tagName||"").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select" || e.isComposing) return;
  if (e.key === "Delete" || e.key === "Backspace") {
    if (!selectedLessons.size) return;
    e.preventDefault();
    deleteSelectedLessons();
  }
  if (e.key === "Escape" && selectedLessons.size) {
    clearLessonSelection();
  }
});

document.getElementById("btnDeleteSelected")?.addEventListener("click", deleteSelectedLessons);


// ---------------------------------------------------------- published view
function publishedCellAt(day, lesson){
  const d = publishedWeekData[String(day)];
  return d ? d[String(lesson)] : undefined;
}

function publishedCardHtml(day, lesson, item){
  if (!item) return `<div class="lesson-card empty view-only"><span class="view-empty-label">—</span></div>`;
  return `<div class="lesson-card filled view-only${item.differs ? " published-diff" : ""}">
    <div class="lc-time">${escapeHtml(item.bell || "")} · урок ${lesson}</div>
    <div class="lc-subj">${escapeHtml(item.subjectName || "")}</div>
    <div class="lc-staff">${escapeHtml(item.staffName || "")}</div>
    <div class="lc-room">${escapeHtml(item.roomName || "")}</div>
  </div>`;
}

function renderPublishedSchedule(){
  const board=document.getElementById("daysBoard");
  if (!board) return;
  board.innerHTML = DAYS.map((name, idx)=>{
    const day=idx+1;
    const cards=LESSON_ROWS.map(l=>publishedCardHtml(day,l,publishedCellAt(day,l))).join("");
    return `<div class="day-column view-only" data-day="${day}">
      <div class="day-column-head"><span class="day-name">${name}</span></div>
      <div class="day-column-body">${cards}</div>
    </div>`;
  }).join("");
  document.querySelectorAll(".lesson-card.view-only").forEach(el=>{
    el.setAttribute("draggable","false");
    el.querySelectorAll("button").forEach(b=>b.remove());
  });
}
