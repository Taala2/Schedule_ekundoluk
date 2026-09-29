// ---------------------------------------------------------------- publish

let weekPanelOpen = false;
let copyTargetCombo = null;

function renderWeekPicker(){
  const sel=document.getElementById("weekSelect"), input=document.getElementById("weekSearch"), list=document.getElementById("weekList");
  if(!sel||!input||!list) return;
  const q=input.value.trim().toLowerCase();
  const opts=[...sel.options].filter(o=>!q || o.textContent.toLowerCase().includes(q));
  list.innerHTML=opts.length ? opts.map(o=>{
    const meta=o.dataset.meta ? JSON.parse(o.dataset.meta) : {};
    const published=meta.published === true;
    return `<div class="week-option ${o.value===sel.value?"active":""}" data-value="${escapePublishHtml(o.value)}">
      <span class="week-status-dot ${published?"published":"unpublished"}" title="${published?"Опубликовано":"Не опубликовано"}"></span>
      <span class="week-option-main">
        <span class="week-option-title">Нед. ${escapePublishHtml(meta.weekNo || "")} · ${escapePublishHtml(meta.startDate || o.value)}</span>
        <span class="week-option-meta">${escapePublishHtml(meta.shift || "Смена не указана")}</span>
      </span>
    </div>`;
  }).join('') : '<div class="combo-empty">Неделя не найдена</div>';
  list.scrollTop=0;
  list.querySelectorAll('.week-option').forEach(o=>o.addEventListener('click',e=>{
    e.preventDefault();
    e.stopPropagation();
    sel.value=o.dataset.value;
    input.value='';
    // Не закрываем панель и не полагаемся на native change hidden-select:
    // выбранная неделя должна быть видна до нажатия «Отправить».
    renderWeekPicker();
  }));
}
function openWeekPanel(){
  if(!current) { showToast("Сначала выбери группу и смену"); return; }
  weekPanelOpen=true;
  document.getElementById('copyPanel').classList.remove('open');
  document.getElementById('tplPanel').classList.remove('open');
  document.getElementById('weekPanel').classList.add('open');
  document.getElementById('overlay').classList.add('show');
  const input=document.getElementById('weekSearch');
  input.value='';
  renderWeekPicker();
  setTimeout(()=>input.focus(),0);
}
function syncWeekPickerInput(){
  const input=document.getElementById('weekSearch');
  if(input) input.value='';
}
async function loadPublishWeeks(gradeId=current?.gradeId){
  if(!gradeId) return;
  const r = await api("GET", `/api/publish-weeks?gradeId=${encodeURIComponent(gradeId)}`);
  const sel = document.getElementById("weekSelect");
  const previous = sel.value;
  sel.innerHTML = r.weeks.map(w=>{
    const meta=JSON.stringify({weekNo:w.weekNo,startDate:w.startDate,published:Boolean(w.isPublished),shift:w.jugurtmoName || "Смена не указана",jugurtmoId:w.jugurtmoId || ""})
      .replace(/&/g,"&amp;").replace(/"/g,"&quot;");
    return `<option value="${escapePublishHtml(w.startDate)}" data-meta="${meta}">Нед.${w.weekNo} · ${w.startDate}</option>`;
  }).join("");
  if ([...sel.options].some(o=>o.value===previous)) sel.value=previous;
  syncWeekPickerInput();
  renderWeekPicker();
}

async function ensurePublishWeeksAvailable(){
  const sel=document.getElementById("weekSelect");
  if(sel && sel.options.length) return;
  const gradeId = selectedGradeId || current?.gradeId || groupsRaw[0]?.gradeId;
  if(!gradeId) throw new Error("Не удалось определить курсы для загрузки недель");
  await loadPublishWeeks(gradeId);
}

document.getElementById("weekClose").addEventListener("click", closePanel);
document.getElementById("weekSearch").addEventListener("input", renderWeekPicker);

document.getElementById("btnPublish").addEventListener("click", openWeekPanel);
document.getElementById("weekPublishGo").addEventListener("click", async ()=>{
  if(!current){ showToast("Сначала выбери группу и смену"); return; }
  const targetDate = document.getElementById("weekSelect").value;
  if(!targetDate){ showToast("Выбери неделю"); return; }
  closePanel();
  showToast("Публикую расписание...");
  try{
    await api("POST","/api/publish", {gradeId:current.gradeId, schoolId:current.schoolId, jugurtmoId:current.jugurtmoMainId, targetDate});
    showToast("Опубликовано");
    await loadPublishWeeks(current.gradeId);
  }catch(err){ showToast("Ошибка: "+err.message); }
});
function escapePublishHtml(value){
  return String(value ?? "").replace(/[&<>\"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[ch]);
}

function classifyPublishResult(status){
  if (status === "опубликовано") return "published";
  if (status.startsWith("пропущено:")) return "skipped";
  return "error";
}

function openPublishResult(results){
  const summary = {published:0, skipped:0, error:0};
  results.forEach(item => summary[classifyPublishResult(item.status)]++);

  document.getElementById("publishSummary").innerHTML = `
    <div class="publish-summary-item published"><span class="publish-summary-icon">✓</span><strong>${summary.published}</strong><span>групп опубликовано</span></div>
    <div class="publish-summary-item skipped"><span class="publish-summary-icon">⚠</span><strong>${summary.skipped}</strong><span>группы пропущено</span></div>
    <div class="publish-summary-item error"><span class="publish-summary-icon">✕</span><strong>${summary.error}</strong><span>ошибок</span></div>
  `;

  document.getElementById("publishResultList").innerHTML = results.length
    ? results.map((item, index) => {
        const kind = classifyPublishResult(item.status);
        const icon = kind === "published" ? "✓" : kind === "skipped" ? "⚠" : "✕";
        return `<div class="publish-result-row ${kind}">
          <span class="publish-result-icon">${icon}</span>
          <span class="publish-result-label">${escapePublishHtml(item.label)}</span>
          <span class="publish-result-status">${escapePublishHtml(item.status.replace(/^пропущено:\s*/, ""))}</span>
        </div>`;
      }).join("")
    : '<div class="publish-empty">Нет групп для публикации.</div>';

  document.getElementById("publishResultBackdrop").classList.add("show");
  document.getElementById("publishResult").classList.add("open");
}

function closePublishResult(){
  document.getElementById("publishResultBackdrop").classList.remove("show");
  document.getElementById("publishResult").classList.remove("open");
}

document.getElementById("publishResultClose").addEventListener("click", closePublishResult);
document.getElementById("publishResultCloseBtn").addEventListener("click", closePublishResult);
document.getElementById("publishResultBackdrop").addEventListener("click", closePublishResult);

function renderPublishAllWeekPicker(){
  const source=document.getElementById("weekSelect");
  const input=document.getElementById("publishAllWeekSearch");
  const list=document.getElementById("publishAllWeekList");
  if(!source||!input||!list) return;
  const q=input.value.trim().toLowerCase();
  const options=[...source.options].filter(o=>!q || o.textContent.toLowerCase().includes(q));
  list.innerHTML=options.length ? options.map(o=>{
    const meta=o.dataset.meta ? JSON.parse(o.dataset.meta) : {};
    const published=meta.published===true;
    return `<div class="week-option ${o.value===source.value?"active":""}" data-value="${escapePublishHtml(o.value)}">
      <span class="week-status-dot ${published?"published":"unpublished"}" title="${published?"Опубликовано":"Не опубликовано"}"></span>
      <span class="week-option-main">
        <span class="week-option-title">Нед. ${escapePublishHtml(meta.weekNo || "")} · ${escapePublishHtml(meta.startDate || o.value)}</span>
      </span>
    </div>`;
  }).join("") : '<div class="combo-empty">Неделя не найдена</div>';
  list.querySelectorAll(".week-option").forEach(row=>row.addEventListener("mousedown",e=>{
    e.preventDefault();
    source.value=row.dataset.value;
    updatePublishAllContext();
    renderPublishAllWeekPicker();
  }));
}

function updatePublishAllContext(){
  const sel=document.getElementById("weekSelect");
  const targetDate=sel?.value || "";
  const option=sel?.selectedOptions[0];
  const meta=option?.dataset.meta ? JSON.parse(option.dataset.meta) : {};
  const weekLabel=option?.textContent || targetDate;
  const uniqueGrades=[...new Map(groupsRaw.map(g=>[g.gradeId,g])).values()];
  const missing=uniqueGrades.filter(g=>!groupSettings[g.gradeId]?.defaultJugurtmoId);
  const ready=uniqueGrades.length-missing.length;
  document.getElementById("publishAllContext").innerHTML=`<strong>Нед. ${escapePublishHtml(meta.weekNo || "")} · ${escapePublishHtml(meta.startDate || targetDate)}</strong>`;
  document.getElementById("publishAllStats").innerHTML=`
    <div class="publish-all-stat"><strong>${ready}</strong><span>групп с основной сменой</span></div>
    <div class="publish-all-stat warning"><strong>${missing.length}</strong><span>будут пропущены</span></div>`;
}

async function openPublishAllPanel(){
  try{ await ensurePublishWeeksAvailable(); }
  catch(err){ showToast("Ошибка: "+err.message); return; }
  const input=document.getElementById("publishAllWeekSearch");
  if(input) input.value="";
  if(!document.getElementById("weekSelect").value){
    const first=document.getElementById("weekSelect").options[0];
    if(first) document.getElementById("weekSelect").value=first.value;
  }
  updatePublishAllContext();
  renderPublishAllWeekPicker();
  document.getElementById("publishAllPanel").classList.add("open");
  document.getElementById("publishAllBackdrop").classList.add("show");
}
function closePublishAllPanel(){
  document.getElementById("publishAllPanel").classList.remove("open");
  document.getElementById("publishAllBackdrop").classList.remove("show");
}
document.getElementById("btnPublishAll").addEventListener("click", openPublishAllPanel);
document.getElementById("publishAllClose").addEventListener("click", closePublishAllPanel);
document.getElementById("publishAllCancel").addEventListener("click", closePublishAllPanel);
document.getElementById("publishAllBackdrop").addEventListener("click", closePublishAllPanel);
document.getElementById("publishAllWeekSearch")?.addEventListener("input", renderPublishAllWeekPicker);
document.getElementById("publishAllGo").addEventListener("click", async ()=>{
  const targetDate = document.getElementById("weekSelect").value;
  if (!targetDate) { closePublishAllPanel(); showToast("Сначала выбери неделю"); return; }
  closePublishAllPanel();
  showToast("Публикую все группы...");
  try{
    const r = await api("POST","/api/publish-all", {targetDate});
    console.table(r.results);
    openPublishResult(r.results);
  }catch(err){ showToast("Ошибка: "+err.message); }
});
document.getElementById("btnCopyWeek").addEventListener("click", ()=>{
  if (!current) return;
  const sel = document.getElementById("copyTarget");
  sel.innerHTML = groupsRaw.filter(g=> !(g.gradeId===current.gradeId && g.objectId===current.jugurtmoMainId))
    .map(g=>`<option value="${g.gradeId}|${g.schoolId}|${g.objectId}">${escapePublishHtml(g.gradeName)} — ${escapePublishHtml(g.jugurtmoMainName)}</option>`).join("");
  if (!copyTargetCombo) copyTargetCombo=comboSetup({inputId:'copyTargetSearch',listId:'copyTargetList',selectId:'copyTarget'});
  copyTargetCombo.clear();
  document.getElementById("copyPanel").classList.add("open");
  document.getElementById("overlay").classList.add("show");
});
document.getElementById("copyClose").addEventListener("click", closePanel);
document.getElementById("copyGo").addEventListener("click", async ()=>{
  const targetValue = document.getElementById("copyTarget").value;
  if (!targetValue){ showToast("Выбери группу-получателя"); document.getElementById("copyTargetSearch")?.focus(); return; }
  const [gradeId, schoolId, jugurtmoMainId] = targetValue.split("|");
  const label = document.getElementById("copyTarget").selectedOptions[0]?.textContent || "";
  if (!confirm(`Перезаписать расписание группы «${label}» текущей неделей?`)) return;
  closePanel();
  showToast("Копирую неделю...");
  try{
    const r = await api("GET", `/api/week?jugurtmoMainId=${encodeURIComponent(jugurtmoMainId)}&gradeId=${encodeURIComponent(gradeId)}&schoolId=${encodeURIComponent(schoolId)}`);
    const targetData = r.days;
    for (const day of [1,2,3,4,5,6]){
      for (const l of LESSON_ROWS){
        const src = cellAt(day, l);
        if (!src) continue;
        const dst = targetData[String(day)]?.[String(l)];
        await api("POST","/api/lesson/save", {
          objectId: dst?.objectId ?? null,
          schoolId, gradeId, jugurtmoMainId,
          weekday: day, lesson: l, bell: dst?.bell || src.bell,
          subjectId: src.subjectId||null, staffId: src.staffId||null, realStaffId: src.staffId||null,
          staffSubjectId: src.staffSubjectId||null, roomId: src.roomId||null,
        });
      }
    }
    showToast("Неделя скопирована в «"+label+"». Не забудь опубликовать эту группу отдельно.");
  }catch(err){ showToast("Ошибка: "+err.message); }
});

document.getElementById("reloadBtn").addEventListener("click", async ()=>{
  if (!current) {
    showToast("Сначала выбери группу");
    return;
  }

  const btn = document.getElementById("reloadBtn");
  if (btn.disabled) return;

  btn.disabled = true;
  btn.classList.add("loading");
  showToast("Обновляю расписание...");

  try{
    if (appMode === "view") {
      await loadPublishWeeks(current.gradeId);
      syncViewSelectedWeek();
      renderViewWeekList();
      await refreshPublishedView();
    } else {
      await Promise.all([loadWeek(), loadPublishWeeks()]);
    }
    showToast("Расписание обновлено");
  }catch(err){
    showToast("Ошибка обновления: " + err.message);
  }finally{
    btn.disabled = false;
    btn.classList.remove("loading");
  }
});
