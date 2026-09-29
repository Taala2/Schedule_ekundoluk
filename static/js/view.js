// ------------------------------------------------------------- student view
let viewSelectedWeekDate = "";

function setAppMode(mode){
  appMode = mode === "view" ? "view" : "edit";
  document.body.classList.toggle("view-mode", appMode === "view");
  document.querySelectorAll(".mode-btn").forEach(btn=>btn.classList.toggle("active", btn.dataset.mode===appMode));
  const editorResources=document.getElementById("editorResources");
  const viewResources=document.getElementById("viewResources");
  const editorActions=document.getElementById("editorScheduleActions");
  const shiftBtn=document.getElementById("btnChooseShift");
  const publishBtn=document.getElementById("btnPublish");
  const editActions=document.querySelector("#editorScheduleActions .schedule-edit-actions");
  const title=document.getElementById("scheduleTitle");
  const hint=document.getElementById("scheduleHint");
  const status=document.getElementById("viewStatus");
  if(editorResources) editorResources.hidden=appMode==="view";
  if(viewResources) viewResources.hidden=appMode!=="view";
  if(editorActions) editorActions.hidden=false;
  if(shiftBtn) shiftBtn.hidden=appMode==="view";
  if(publishBtn) publishBtn.hidden=appMode==="view";
  if(editActions) editActions.hidden=appMode==="view";
  if(title) title.textContent=appMode==="view" ? "Просмотр расписания" : "Расписание";
  if(hint) hint.textContent=appMode==="view" ? "Опубликованная версия · только для просмотра" : "Клик — редактирование · Ctrl+click — несколько · Shift+click — диапазон · Delete — удалить";
  if(status) status.hidden=appMode!=="view";
  if(appMode==="view"){
    syncViewSelectedWeek();
    renderViewWeekList();
    if(current) refreshPublishedView();
    else showViewStatus("Сначала выбери группу.", "info");
  }else{
    publishedWeekData={};
    publishedWeekMeta=null;
    publishedCompare=null;
    render();
  }
}

function showViewStatus(text, kind="info"){
  const el=document.getElementById("viewStatus");
  if(!el) return;
  el.hidden=false;
  el.className=`view-status ${kind}`;
  el.textContent=text;
}
function hideViewStatus(){ const el=document.getElementById("viewStatus"); if(el){el.hidden=true;el.textContent="";} }

function getWeekMetaFromOption(option){
  if(!option) return {};
  try{return option.dataset.meta ? JSON.parse(option.dataset.meta) : {};}catch{return {};}
}

function syncViewSelectedWeek(){
  const source=document.getElementById("weekSelect");
  if(!source || !source.options.length) return;
  if(viewSelectedWeekDate && [...source.options].some(o=>o.value===viewSelectedWeekDate)) source.value=viewSelectedWeekDate;
  else if(!viewSelectedWeekDate) viewSelectedWeekDate=source.value;
  else viewSelectedWeekDate=source.value;
  window.currentPublishedWeekStartDate=viewSelectedWeekDate || "";
}

function renderViewWeekList(){
  const source=document.getElementById("weekSelect");
  const input=document.getElementById("viewWeekSearch");
  const list=document.getElementById("viewWeekList");
  const count=document.getElementById("viewWeekCount");
  if(!source||!input||!list) return;
  syncViewSelectedWeek();
  const q=input.value.trim().toLowerCase();
  const options=[...source.options].filter(o=>!q || o.textContent.toLowerCase().includes(q));
  if(count) count.textContent=source.options.length ? source.options.length : "";
  list.innerHTML=options.length ? options.map(o=>{
    const meta=getWeekMetaFromOption(o);
    const published=meta.published===true;
    return `<div class="week-option view-week-option ${o.value===source.value?"active":""}" data-value="${escapeHtml(o.value)}">
      <span class="week-status-dot ${published?"published":"unpublished"}" title="${published?"Опубликовано":"Не опубликовано"}"></span>
      <span class="week-option-main">
        <span class="week-option-title">Нед. ${escapeHtml(meta.weekNo || "")} · ${escapeHtml(meta.startDate || o.value)}</span>
        <span class="week-option-meta">${escapeHtml(meta.shift || "Смена не указана")}</span>
      </span>
    </div>`;
  }).join("") : '<div class="combo-empty">Неделя не найдена</div>';
  list.querySelectorAll(".view-week-option").forEach(row=>row.addEventListener("mousedown",async e=>{
    e.preventDefault();
    source.value=row.dataset.value;
    viewSelectedWeekDate=source.value;
    window.currentPublishedWeekStartDate=viewSelectedWeekDate;
    renderViewWeekList();
    await refreshPublishedView();
  }));
}

async function refreshPublishedView(){
  if(appMode!=="view" || !current) return;
  const source=document.getElementById("weekSelect");
  if(!source || !source.value){
    showViewStatus("Выбери неделю справа.","info");
    return;
  }
  const option=source.selectedOptions[0];
  const meta=getWeekMetaFromOption(option);
  publishedWeekMeta=meta;
  if(meta.published!==true){
    publishedWeekData={};
    publishedCompare=null;
    showViewStatus(`Нед. ${meta.weekNo || ""} · ${meta.startDate || source.value} ещё не опубликована. Здесь будет показана версия, которую видят студенты после публикации.`,"warning");
    renderPublishedSchedule();
    return;
  }
  showViewStatus("Загружаю опубликованное расписание…","info");
  try{
    const r=await api("GET", `/api/published-week?gradeId=${encodeURIComponent(current.gradeId)}&selectedDay=${encodeURIComponent(meta.startDate || source.value)}`);
    publishedWeekData=normalizePublishedSchedule(r.schedule);
    publishedCompare=await comparePublishedWithEditor(publishedWeekData, meta);
    renderPublishedSchedule();
    if(publishedCompare?.differs){
      showViewStatus("Опубликованное расписание отличается от текущей версии в редакторе.","warning");
    }else{
      hideViewStatus();
    }
  }catch(err){
    publishedWeekData={};
    publishedCompare=null;
    renderPublishedSchedule();
    showViewStatus("Не удалось загрузить опубликованное расписание: "+err.message,"error");
  }
}

function normalizePublishedSchedule(schedule){
  const details=schedule?.scheduleDetails || {};
  const names={1:"schedulesMon",2:"schedulesTue",3:"schedulesWed",4:"schedulesThu",5:"schedulesFri",6:"schedulesSat"};
  const out={};
  for(let day=1;day<=6;day++){
    out[String(day)]={};
    for(const item of (details[names[day]] || [])){
      out[String(day)][String(item.lesson)]={
        bell:item.bell || "",
        subjectName:item.subjectName || "",
        staffName:item.staffName || "",
        roomName:item.roomName || ""
      };
    }
  }
  return out;
}

function normalizedText(v){return String(v||"").trim().replace(/\s+/g," ").toLowerCase();}
function staffNamesEquivalent(a,b){
  const aa=normalizedText(a).split(" ").filter(Boolean);
  const bb=normalizedText(b).split(" ").filter(Boolean);
  if(!aa.length || !bb.length) return aa.length===bb.length;
  // Сначала сравниваем токены с учётом инициалов: «Усупов Эгемберди Айылевич»
  // и «Усупов Э. А.» должны считаться одним преподавателем.
  if(aa.length!==bb.length) return normalizedText(a)===normalizedText(b);
  const tokenEquivalent=(x,y)=>{
    const xx=String(x).replace(/\./g,"");
    const yy=String(y).replace(/\./g,"");
    if(xx===yy) return true;
    if(xx.length===1 && yy.startsWith(xx)) return true;
    if(yy.length===1 && xx.startsWith(yy)) return true;
    return false;
  };
  return aa.every((token,i)=>tokenEquivalent(token,bb[i]));
}

function canonicalEditorCell(item){
  if(!item) return null;
  const subject=normalizedText(item.subj || item.subjectName);
  const staff=normalizedText(item.staff || item.staffName);
  const room=normalizedText(item.room || item.roomName);
  const bell=normalizedText(item.bell);
  const hasContent=Boolean(subject || staff || room || bell || item.objectId);
  if(!hasContent) return null;
  return {subject,staff,room,bell};
}

async function getEditorScheduleForPublishedWeek(meta){
  const boundShiftId=String(meta?.jugurtmoId || "");
  const schoolId=current?.schoolId || groupIndex.get(current?.gradeId)?.schoolId || "";
  if(!boundShiftId) return null;

  // Если опубликованная неделя привязана к текущей смене, используем уже
  // загруженное редактором расписание: это и быстрее, и гарантирует, что
  // только что сохранённые изменения учитываются.
  if(current?.jugurtmoMainId && String(current.jugurtmoMainId)===boundShiftId){
    return weekData;
  }

  // Иначе сравниваем с той сменой, к которой реально привязана выбранная
  // опубликованная неделя. Это позволяет корректно сравнивать несколько
  // смен одной группы, не переключая редактор и не меняя его состояние.
  const r=await api("GET", `/api/week?jugurtmoMainId=${encodeURIComponent(boundShiftId)}&gradeId=${encodeURIComponent(current.gradeId)}&schoolId=${encodeURIComponent(schoolId)}`);
  const data=r.days || {};

  // /api/week уже возвращает имена из редактора. На случай старых ответов,
  // где имени нет, дозаполняем его из тех же справочников, не изменяя weekData.
  const subjectById=Object.fromEntries(subjects.map(x=>[String(x.id),x.name]));
  const roomById=Object.fromEntries(rooms.map(x=>[String(x.id),x.name]));
  const subjectIds=new Set();
  for(const day of Object.values(data)) for(const item of Object.values(day||{})){
    if(item?.subjectId) subjectIds.add(String(item.subjectId));
  }
  const staffLists=await Promise.all([...subjectIds].map(id=>loadStaff(id,current.gradeId)));
  const staffById={};
  staffLists.forEach(list=>list.forEach(staff=>{staffById[String(staff.id)]=staff.name;}));
  for(const day of Object.values(data)) for(const item of Object.values(day||{})){
    if(!item) continue;
    if(!item.subj && item.subjectId) item.subj=subjectById[String(item.subjectId)] || "";
    if(!item.room && item.roomId) item.room=roomById[String(item.roomId)] || "";
    if(!item.staff && item.staffId) item.staff=staffById[String(item.staffId)] || "";
  }
  return data;
}

async function comparePublishedWithEditor(published, meta){
  const selectedDate=String(meta?.startDate || "").slice(0,10);
  const editor=getCurrentEditorWeekStart();
  // Для опубликованной недели источник сравнения определяется самой неделей:
  // если она привязана к смене, можно точно сравнить её с соответствующей
  // редактируемой версией. Не используем «сегодня» как замену дате недели.
  if(!selectedDate || !meta?.jugurtmoId) return {differs:false,comparable:false};

  const editorSchedule=await getEditorScheduleForPublishedWeek(meta);
  if(!editorSchedule) return {differs:false,comparable:false};

  let differs=false;
  for(let d=1;d<=6;d++) for(const l of LESSON_ROWS){
    const p=published?.[String(d)]?.[String(l)] || null;
    const e=editorSchedule?.[String(d)]?.[String(l)] || null;
    const pv=canonicalEditorCell(p);
    const ev=canonicalEditorCell(e);

    if(Boolean(pv)!==Boolean(ev)){
      differs=true;
      if(p) p.differs=true;
      continue;
    }
    if(!pv || !ev) continue;

    const sameSubject=pv.subject===ev.subject;
    const sameStaff=staffNamesEquivalent(pv.staff,ev.staff);
    const sameRoom=pv.room===ev.room;
    const sameBell=pv.bell===ev.bell;
    if(!(sameSubject && sameStaff && sameRoom && sameBell)){
      differs=true;
      if(p) p.differs=true;
    }
  }
  return {differs,comparable:true};
}

function getCurrentEditorWeekStart(){
  const source=document.getElementById("weekSelect");
  const currentShiftId=current?.jugurtmoMainId || "";
  if(source && currentShiftId){
    const option=[...source.options].find(o=>{
      const meta=getWeekMetaFromOption(o);
      return meta.jugurtmoId && String(meta.jugurtmoId)===String(currentShiftId);
    });
    if(option) return String(option.value).slice(0,10);
  }
  const raw = current?.weekStartDate || current?.startDate || window.currentWeekStartDate || "";
  return raw ? String(raw).slice(0,10) : "";
}

document.querySelectorAll(".mode-btn").forEach(btn=>btn.addEventListener("click",()=>setAppMode(btn.dataset.mode)));
document.getElementById("viewWeekSearch")?.addEventListener("input",renderViewWeekList);
