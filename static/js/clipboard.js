// ------------------------------------------------------------- clipboard

function showClipboardBanner(){
  showBanner(`📋 Скопировано «${clipboard.subj}». Клик по ячейке — вставить.`);
}
function hideClipboardBanner(){ hideBanner(); }
document.getElementById("clipCancel").addEventListener("click", ()=>{ clipboard=null; dayClipboard=null; clearArmed(); hideBanner(); });
document.addEventListener("keydown", e=>{
  if (e.key==="Escape"){
    if (clipboard){ clipboard=null; hideClipboardBanner(); }
    if (dayClipboard!==null){ dayClipboard=null; showToast("Копирование дня отменено"); hideBanner(); }
    if (armedSubject || armedTemplate || armedDaySwap!==null){ clearArmed(); hideBanner(); showToast("Отменено"); }
  }
});

async function copyDay(srcDay, dstDay){
  const batch=[];
  try{
    for (const l of LESSON_ROWS){
      const src = cellAt(srcDay, l);
      if (!src) continue;
      const dst = cellAt(dstDay, l);
      recordPrev(batch, dstDay, l);
      await api("POST","/api/lesson/save", {
        ...baseLessonPayload(dstDay, l, {...dst, bell: dst?.bell || src.bell}),
        subjectId: src.subjectId || null, staffId: src.staffId || null, realStaffId: src.staffId || null,
        staffSubjectId: src.staffSubjectId || null, roomId: src.roomId || null,
      });
    }
    pushHistory(batch);
    showToast(`День ${DAYS[srcDay-1]} скопирован в ${DAYS[dstDay-1]}`);
    await loadWeek();
  }catch(err){ showToast("Ошибка: "+err.message); }
}

async function pasteClipboard(day, lesson){
  const existing = cellAt(day, lesson);
  const batch=[]; recordPrev(batch, day, lesson);
  try{
    await api("POST","/api/lesson/save", {
      ...baseLessonPayload(day, lesson, {...existing, bell: existing?.bell || clipboard.bell || "08:00-09:20"}),
      subjectId: clipboard.subjectId, staffId: clipboard.staffId, realStaffId: clipboard.staffId,
      staffSubjectId: clipboard.staffSubjectId, roomId: clipboard.roomId,
    });
    pushHistory(batch);
    showToast("Вставлено");
    await loadWeek();
  }catch(err){ showToast("Ошибка: "+err.message); }
  clipboard = null; hideClipboardBanner();
}

function baseLessonPayload(day, lesson, existing){
  return {
    objectId: existing?.objectId ?? null,
    schoolId: current.schoolId,
    gradeId: current.gradeId,
    jugurtmoMainId: current.jugurtmoMainId,
    weekday: day,
    lesson: lesson,
    bell: existing?.bell ?? "",
  };
}

async function swapCells(a, b){
  const ca = cellAt(a.day, a.lesson), cb = cellAt(b.day, b.lesson);
  if (!ca?.objectId || !cb?.objectId){ showToast("Сначала заполни часы для этого дня"); return; }
  const batch=[]; recordPrev(batch,a.day,a.lesson); recordPrev(batch,b.day,b.lesson);
  try{
    await api("POST","/api/lesson/swap", {a:{...ca, ...baseLessonPayload(a.day,a.lesson,ca)}, b:{...cb, ...baseLessonPayload(b.day,b.lesson,cb)}});
    pushHistory(batch);
    showToast("Уроки поменяны местами");
    await loadWeek();
  }catch(err){ showToast("Ошибка: "+err.message); }
}
async function swapDays(dayA, dayB){
  const batch=[];
  try{
    for (const l of LESSON_ROWS){
      const ca = cellAt(dayA,l), cb = cellAt(dayB,l);
      if (ca?.objectId && cb?.objectId){
        recordPrev(batch,dayA,l); recordPrev(batch,dayB,l);
        await api("POST","/api/lesson/swap", {a:{...ca, ...baseLessonPayload(dayA,l,ca)}, b:{...cb, ...baseLessonPayload(dayB,l,cb)}});
      }
    }
    pushHistory(batch);
    showToast("Дни поменяны местами");
    await loadWeek();
  }catch(err){ showToast("Ошибка: "+err.message); }
}

async function applyTemplate(day, lesson, tpl){
  const existing = cellAt(day, lesson);
  const batch=[]; recordPrev(batch, day, lesson);
  try{
    if (tpl.kind === "time"){
      await api("POST","/api/lesson/save", {
        ...baseLessonPayload(day, lesson, {...existing, bell: tpl.bell}),
        subjectId: existing?.subjectId || null, staffId: existing?.staffId || null,
        realStaffId: existing?.staffId || null, staffSubjectId: existing?.staffSubjectId || null,
        roomId: existing?.roomId || null,
      });
    } else {
      const bell = existing?.bell || tpl.bell || "08:00-09:20";
      await api("POST","/api/lesson/save", {
        ...baseLessonPayload(day, lesson, {...existing, bell}),
        subjectId: tpl.subjectId, staffId: tpl.staffId, realStaffId: tpl.staffId,
        staffSubjectId: tpl.staffSubjectId, roomId: tpl.roomId || null,
      });
    }
    pushHistory(batch);
    showToast(`Применён шаблон «${tpl.label}»`);
    await loadWeek();
  }catch(err){ showToast("Ошибка: "+err.message); }
}
