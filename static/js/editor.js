// ------------------------------------------------------------------ panel

function comboSetup({inputId,listId,selectId, placeholder}){
  const input=document.getElementById(inputId), list=document.getElementById(listId), sel=document.getElementById(selectId);
  const combo=input.closest('.combo');
  function render(){
    const q=input.value.trim().toLowerCase();
    const opts=[...sel.options].filter(o=>!q || o.textContent.toLowerCase().includes(q));
    list.innerHTML=opts.length ? opts.map(o=>`<div class="combo-option" data-value="${o.value}">${o.textContent}</div>`).join('') : '<div class="combo-empty">Ничего не найдено</div>';
    list.querySelectorAll('.combo-option').forEach(o=>o.addEventListener('mousedown',e=>{
      e.preventDefault(); sel.value=o.dataset.value; input.value=o.textContent; combo.classList.remove('open'); sel.dispatchEvent(new Event('change',{bubbles:true}));
    }));
  }
  input.addEventListener('focus',()=>{render();combo.classList.add('open')});
  input.addEventListener('input',()=>{render();combo.classList.add('open')});
  input.addEventListener('keydown',e=>{if(e.key==='Escape'){combo.classList.remove('open');input.blur()} if(e.key==='Enter'){const first=list.querySelector('.combo-option'); if(first){first.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); e.preventDefault()}}});
  document.addEventListener('mousedown',e=>{if(!combo.contains(e.target)) combo.classList.remove('open')});
  return {render, setValue(v){sel.value=v||''; const o=sel.selectedOptions[0]; input.value=o?o.textContent:'';}, clear(){input.value='';combo.classList.remove('open')}};
}
const subjectCombo=comboSetup({inputId:'fSubjectSearch',listId:'fSubjectList',selectId:'fSubject'});
const staffCombo=comboSetup({inputId:'fStaffSearch',listId:'fStaffList',selectId:'fStaff'});
const roomCombo=comboSetup({inputId:'fRoomSearch',listId:'fRoomList',selectId:'fRoom'});
const templateKindCombo=comboSetup({inputId:'tKindSearch',listId:'tKindList',selectId:'tKind'});
const templateScopeCombo=comboSetup({inputId:'tScopeSearch',listId:'tScopeList',selectId:'tScope'});

async function openPanel(day, lesson, presetSubjectId){
  editing = {day, lesson};
  const existing = cellAt(day, lesson);
  document.getElementById("panelTitle").textContent = `${DAYS[day-1]}, урок ${lesson}`;
  document.getElementById("fBell").value = existing?.bell || "";
  const subjSel = document.getElementById("fSubject");
  subjSel.innerHTML = subjects.map(s=>`<option value="${s.id}">${s.name}</option>`).join("");
  const subjId = presetSubjectId || existing?.subjectId || (subjects[0] && subjects[0].id) || "";
  subjSel.value = subjId;
  subjectCombo.setValue(subjId);
  await fillStaffSelect(subjId, presetSubjectId ? null : existing?.staffId);
  const roomSel = document.getElementById("fRoom");
  roomSel.innerHTML = '<option value="">— без кабинета —</option>' + rooms.map(r=>`<option value="${r.id}">${r.name}</option>`).join("");
  roomCombo.setValue(existing?.roomId || "");
  document.getElementById("panel").classList.add("open");
  document.getElementById("overlay").classList.add("show");
  if (presetSubjectId) showToast("Выбери время, преподавателя и кабинет");
}
async function fillStaffSelect(subjectId, preselectStaffId){
  const list = await loadStaff(subjectId);
  const sel = document.getElementById("fStaff");
  sel.innerHTML = list.map(s=>`<option value="${s.id}" data-ssid="${s.staffSubjectId}">${s.name}</option>`).join("");
  if (preselectStaffId) sel.value = preselectStaffId;
  staffCombo.setValue(preselectStaffId || sel.value || "");
}
document.getElementById("fSubject").addEventListener("change", e=> fillStaffSelect(e.target.value, null));

document.getElementById("panelClose").addEventListener("click", closePanel);
document.getElementById("overlay").addEventListener("click", closePanel);
function closePanel(){
  document.getElementById("panel").classList.remove("open");
  document.getElementById("tplPanel").classList.remove("open");
  document.getElementById("copyPanel").classList.remove("open");
  document.getElementById("weekPanel").classList.remove("open");
  document.getElementById("shiftPanel")?.classList.remove("open");
  document.getElementById("reportsPanel")?.classList.remove("open");
  document.querySelector("#reportsPanel")?.classList.remove("reports-config-mode");
  if (typeof reportsConfigBackup !== "undefined" && reportsConfigBackup) { reportsSettings = reportsConfigBackup; reportsConfigBackup = null; }
  document.querySelector("#reportsPanel .reports-config-body")?.remove();
  document.getElementById("overlay").classList.remove("show");
  editing = null;
}

document.getElementById("fSave").addEventListener("click", async ()=>{
  if (!editing) return;
  const {day, lesson} = editing;
  const existing = cellAt(day, lesson);
  const bell = document.getElementById("fBell").value.trim();
  if (!bell){
    showToast("Укажи время урока");
    document.getElementById("fBell").focus();
    return;
  }
  const staffSel = document.getElementById("fStaff");
  const ssid = staffSel.selectedOptions[0]?.dataset.ssid || "";
  const batch=[]; recordPrev(batch, day, lesson);
  try{
    await api("POST","/api/lesson/save", {
      ...baseLessonPayload(day, lesson, existing),
      bell,
      subjectId: document.getElementById("fSubject").value,
      staffId: staffSel.value, realStaffId: staffSel.value, staffSubjectId: ssid,
      roomId: document.getElementById("fRoom").value || null,
    });
    pushHistory(batch);
    closePanel(); showToast("Сохранено");
    await loadWeek();
  }catch(err){ showToast("Ошибка: "+err.message); }
});
document.getElementById("fDelete").addEventListener("click", async ()=>{
  if (!editing) return;
  const existing = cellAt(editing.day, editing.lesson);
  if (!existing?.objectId){ closePanel(); return; }
  const batch=[]; recordPrev(batch, editing.day, editing.lesson);
  try{
    await api("POST","/api/lesson/delete", {objectId: existing.objectId});
    pushHistory(batch);
    closePanel(); showToast("Удалено");
    await loadWeek();
  }catch(err){ showToast("Ошибка: "+err.message); }
});
document.getElementById("fCopy").addEventListener("click", ()=>{
  if (!editing) return;
  const existing = cellAt(editing.day, editing.lesson);
  if (!existing?.subjectId){ showToast("Урок пуст, нечего копировать"); return; }
  clipboard = {subj:existing.subj, subjectId:existing.subjectId, staff:existing.staff, staffId:existing.staffId,
               staffSubjectId:existing.staffSubjectId, room:existing.room, roomId:existing.roomId, bell:existing.bell};
  closePanel();
  showClipboardBanner();
});
document.getElementById("fMakeTpl").addEventListener("click", async ()=>{
  if (!editing) return;
  const existing = cellAt(editing.day, editing.lesson);
  if (!existing?.subjectId){ showToast("Сначала сохрани урок"); return; }
  const staffSel = document.getElementById("fStaff");
  await api("POST","/api/templates", {
    kind:"combo", scope:`group:${current.gradeId}`,
    label: (subjects.find(s=>s.id===existing.subjectId)?.name || "Шаблон"),
    subj: existing.subj, subjectId: existing.subjectId,
    staff: existing.staff, staffId: existing.staffId,
    staffSubjectId: staffSel.selectedOptions[0]?.dataset.ssid || existing.staffSubjectId,
    room: existing.room, roomId: existing.roomId,
  });
  await loadTemplates(); renderTray();
  showToast("Добавлено в локальные шаблоны этой группы");
});
