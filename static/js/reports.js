// ---------------------------------------------------------------- reports

const REPORT_TYPES_FALLBACK = [
  {key:"10m", label:"10 мес", filename:"10 мес.xlsx"},
  {key:"1budget", label:"1 курс — бюджет", filename:"1 курс бюджет.xlsx"},
  {key:"1contract", label:"1 курс — контракт", filename:"1 курс контракт.xlsx"},
  {key:"2budget", label:"2 курс — бюджет", filename:"2 курс бюджет.xlsx"},
  {key:"2contract", label:"2 курс — контракт", filename:"2 курс контракт.xlsx"},
];

let reportsTypes = [...REPORT_TYPES_FALLBACK];
let reportsSettings = {academicYear:"", includeSaturday:true, groups:{}};
let reportsSelectedType = "10m";
let reportsPanelOpen = false;
let reportsConfigBackup = null;
let reportsWeeks = [];
let reportsWeekDate = "";
let reportsWeekSourceGradeId = "";
let reportsWeeksLoading = false;

function reportEsc(v){ return escapeHtml(v); }

function normalizeReportsSettings(data){
  const groups = {};
  reportsTypes.forEach(t=> groups[t.key] = Array.isArray(data?.groups?.[t.key]) ? data.groups[t.key].map(String) : []);
  reportsSettings = {
    academicYear: String(data?.academicYear || ""),
    includeSaturday: data?.includeSaturday !== false,
    groups,
  };
}

function reportYearParts(){
  const m = String(reportsSettings.academicYear || "").match(/^(\d{4})-(\d{4})$/);
  return m ? [m[1],m[2]] : ["",""];
}

function selectedReportKeys(){
  return reportsTypes.filter(t=>document.querySelector(`.reports-type-check[data-key="${CSS.escape(t.key)}"]`)?.checked).map(t=>t.key);
}

function currentReportsGroups(){
  return new Map([...groupIndex.entries()].map(([id,g])=>[String(id),g]));
}

function configuredGroupIds(){
  const ids=[];
  reportsTypes.forEach(t=>(reportsSettings.groups[t.key]||[]).forEach(id=>ids.push(String(id))));
  return ids;
}

function renderReportsSummary(){
  const list=document.getElementById("reportsTypeList");
  if(!list) return;
  const map=currentReportsGroups();
  list.innerHTML=reportsTypes.map(t=>{
    const count=(reportsSettings.groups[t.key]||[]).filter(id=>map.has(String(id))).length;
    return `<label class="reports-type-row">
      <input type="checkbox" class="reports-type-check" data-key="${reportEsc(t.key)}" checked>
      <span class="reports-type-main"><span class="reports-type-label">${reportEsc(t.label)}</span><span class="reports-type-count">${count} ${count===1?"группа":"групп"}</span></span>
    </label>`;
  }).join("");
  list.querySelectorAll(".reports-type-check").forEach(cb=>cb.addEventListener("change",()=>{
    reportsSelectedType=cb.dataset.key;
    renderReportsConfigPanel();
  }));
}

function renderReportsConfigPanel(){
  const list=document.getElementById("reportsTypeList");
  if(!list) return;
  list.querySelectorAll(".reports-type-row").forEach(row=>{
    const input=row.querySelector("input");
    row.classList.toggle("active", Boolean(input?.checked) && input?.dataset.key===reportsSelectedType);
  });
}

function reportsWeekMeta(week){
  return {
    weekNo: week?.weekNo ?? "",
    startDate: String(week?.startDate || "").slice(0,10),
    published: Boolean(week?.isPublished),
    shift: week?.jugurtmoName || "Смена не указана",
  };
}

function renderReportsWeekList(){
  const input=document.getElementById("reportsWeekSearch");
  const list=document.getElementById("reportsWeekList");
  const select=document.getElementById("reportsWeekSelect");
  if(!input||!list||!select) return;
  const q=input.value.trim().toLowerCase();
  const options=reportsWeeks.filter(w=>{
    const m=reportsWeekMeta(w);
    const text=`нед. ${m.weekNo} ${m.startDate} ${m.shift}`.toLowerCase();
    return !q || text.includes(q);
  });
  list.innerHTML=options.length ? options.map(w=>{
    const m=reportsWeekMeta(w);
    return `<div class="week-option reports-week-option ${m.startDate===reportsWeekDate?"active":""}" data-value="${reportEsc(m.startDate)}">
      <span class="week-status-dot ${m.published?"published":"unpublished"}" title="${m.published?"Опубликовано":"Не опубликовано"}"></span>
      <span class="week-option-main">
        <span class="week-option-title">Нед. ${reportEsc(m.weekNo)} · ${reportEsc(m.startDate)}</span>
        <span class="week-option-meta">${reportEsc(m.shift)}</span>
      </span>
    </div>`;
  }).join("") : '<div class="combo-empty">Неделя не найдена</div>';
  list.querySelectorAll(".reports-week-option").forEach(row=>row.addEventListener("mousedown",e=>{
    e.preventDefault();
    reportsWeekDate=row.dataset.value;
    window.currentPublishedWeekStartDate=reportsWeekDate;
    renderReportsWeekList();
    renderReportsContext();
  }));
  select.innerHTML=reportsWeeks.map(w=>{
    const m=reportsWeekMeta(w);
    return `<option value="${reportEsc(m.startDate)}">Нед.${reportEsc(m.weekNo)} · ${reportEsc(m.startDate)}</option>`;
  }).join("");
  if(reportsWeekDate && [...select.options].some(o=>o.value===reportsWeekDate)) select.value=reportsWeekDate;
}

function chooseReportsWeekDefault(){
  const viewDate=(typeof viewSelectedWeekDate!=="undefined" && viewSelectedWeekDate) ? String(viewSelectedWeekDate).slice(0,10) : "";
  if(viewDate && reportsWeeks.some(w=>reportsWeekMeta(w).startDate===viewDate)) reportsWeekDate=viewDate;
  else if(reportsWeekDate && reportsWeeks.some(w=>reportsWeekMeta(w).startDate===reportsWeekDate)) return;
  else {
    const published=reportsWeeks.find(w=>reportsWeekMeta(w).published);
    reportsWeekDate=reportsWeekMeta(published || reportsWeeks[0]).startDate || "";
  }
  window.currentPublishedWeekStartDate=reportsWeekDate;
}

function getReportsWeekSourceGradeId(){
  const configured=configuredGroupIds();
  return String(selectedGradeId || current?.gradeId || configured[0] || [...groupIndex.keys()][0] || "");
}

async function loadReportsWeeks(){
  const primary=getReportsWeekSourceGradeId();
  const candidates=[primary,...configuredGroupIds(),...groupIndex.keys()].map(String).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);
  if(!candidates.length){
    reportsWeeks=[]; reportsWeekDate=""; renderReportsWeekList(); renderReportsContext(); return;
  }
  if(reportsWeeksLoading) return;
  reportsWeeksLoading=true;
  try{
    let loaded=[]; let sourceId=""; let lastError=null;
    for(const gradeId of candidates){
      try{
        const r=await api("GET", `/api/reports/weeks?gradeId=${encodeURIComponent(gradeId)}`);
        const weeks=Array.isArray(r.weeks) ? r.weeks : [];
        if(weeks.length){ loaded=weeks; sourceId=gradeId; break; }
      }catch(err){ lastError=err; }
    }
    if(!loaded.length && lastError) throw lastError;
    reportsWeeks=loaded;
    reportsWeekSourceGradeId=sourceId;
    chooseReportsWeekDefault();
    renderReportsWeekList();
    renderReportsContext();
    const g=groupIndex.get(sourceId);
    const source=document.getElementById("reportsWeekSource");
    if(source) source.textContent=g ? `Недели загружены по группе «${g.gradeName}»` : "";
  }catch(err){
    reportsWeeks=[]; reportsWeekDate="";
    renderReportsWeekList();
    renderReportsContext();
    showToast("Не удалось загрузить недели: "+err.message);
  }finally{
    reportsWeeksLoading=false;
  }
}

function renderReportsContext(){
  const context=document.getElementById("reportsContext");
  if(!context) return;
  if(reportsWeekDate){
    context.innerHTML=`<div class="reports-context-title">Опубликованная версия</div><div class="reports-context-value">Неделя: ${reportEsc(formatReportDateRange(reportsWeekDate, reportsSettings.includeSaturday))}</div><div class="reports-context-note">Источник: опубликованное расписание · неделю можно изменить ниже</div>`;
  }else{
    context.innerHTML=`<div class="reports-context-title">Неделя не выбрана</div><div class="reports-context-note">Выбери неделю в панели отчётов.</div>`;
  }
  const generate=document.getElementById("reportsGenerate");
  if(generate) generate.disabled=!reportsWeekDate;
}

function openReportsPanel(){
  reportsPanelOpen=true;
  closePanel();
  document.getElementById("reportsPanel")?.classList.add("open");
  document.getElementById("overlay")?.classList.add("show");
  renderReportsPanel();
  loadReportsWeeks();
}
function closeReportsPanel(){
  if(reportsConfigBackup){ reportsSettings=reportsConfigBackup; reportsConfigBackup=null; }
  reportsPanelOpen=false;
  const panel=document.getElementById("reportsPanel");
  panel?.classList.remove("open","reports-config-mode");
  panel?.querySelector(".reports-config-body")?.remove();
  if(!document.querySelector("aside.panel.open")) document.getElementById("overlay")?.classList.remove("show");
}

function renderReportsPanel(){
  const [from,to]=reportYearParts();
  const fromEl=document.getElementById("reportsYearFrom"), toEl=document.getElementById("reportsYearTo"), sat=document.getElementById("reportsSaturday");
  if(fromEl) fromEl.value=from;
  if(toEl) toEl.value=to;
  if(sat) sat.checked=reportsSettings.includeSaturday;
  renderReportsContext();
  renderReportsWeekList();
  renderReportsSummary();
  renderReportsConfigPanel();
  const result=document.getElementById("reportsResult");
  if(result && !result.dataset.persistent) result.hidden=true;
}

function formatReportDateRange(startDate, includeSaturday){
  const d=new Date(`${startDate}T00:00:00`);
  if(Number.isNaN(d.getTime())) return startDate;
  const end=new Date(d);
  end.setDate(end.getDate()+(includeSaturday?5:4));
  const f=x=>`${String(x.getDate()).padStart(2,"0")}.${String(x.getMonth()+1).padStart(2,"0")}.${x.getFullYear()}`;
  return `${f(d)} — ${f(end)}`;
}

async function loadReportsConfig(){
  const r=await api("GET","/api/reports/config");
  reportsTypes=Array.isArray(r.types)&&r.types.length?r.types:REPORT_TYPES_FALLBACK;
  normalizeReportsSettings(r.settings||{});
}

async function saveReportsConfig(){
  const from=document.getElementById("reportsYearFrom")?.value.trim()||"";
  const to=document.getElementById("reportsYearTo")?.value.trim()||"";
  reportsSettings.academicYear=(from && to) ? `${from}-${to}` : "";
  reportsSettings.includeSaturday=Boolean(document.getElementById("reportsSaturday")?.checked);
  const r=await api("POST","/api/reports/config",reportsSettings);
  normalizeReportsSettings(r.settings||reportsSettings);
}

function renderReportsConfigTabs(){
  const tabs=document.getElementById("reportsConfigTabs");
  if(!tabs) return;
  tabs.innerHTML=reportsTypes.map(t=>{
    const count=(reportsSettings.groups[t.key]||[]).length;
    return `<button type="button" class="reports-config-tab ${t.key===reportsSelectedType?"active":""}" data-key="${reportEsc(t.key)}">${reportEsc(t.label)} <span>${count}</span></button>`;
  }).join("");
  tabs.querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{
    reportsSelectedType=btn.dataset.key;
    renderReportsConfigTabs();
    renderReportsGroupAssignment();
  }));
}

function renderReportsGroupAssignment(){
  const list=document.getElementById("reportsGroupAssignment");
  if(!list) return;
  const q=(document.getElementById("reportsGroupSearch")?.value||"").trim().toLowerCase();
  const map=currentReportsGroups();
  const assigned=new Set((reportsSettings.groups[reportsSelectedType]||[]).map(String));
  const assignedElsewhere=new Set();
  reportsTypes.forEach(t=>{
    if(t.key===reportsSelectedType) return;
    (reportsSettings.groups[t.key]||[]).forEach(id=>assignedElsewhere.add(String(id)));
  });
  const selected=[...assigned].map(id=>({id,name:map.get(id)?.gradeName || id})).sort((a,b)=>compareGradeNames(a.name,b.name));
  const available=[...map.entries()]
    .map(([id,g])=>({id:String(id),name:g.gradeName}))
    .filter(x=>!assigned.has(x.id) && !assignedElsewhere.has(x.id))
    .filter(x=>!q || x.name.toLowerCase().includes(q))
    .sort((a,b)=>compareGradeNames(a.name,b.name));

  list.innerHTML=`
    <div class="reports-assigned-block">
      <div class="reports-assignment-heading">В этом отчёте <span>${selected.length}</span></div>
      <div class="reports-assigned-list">${selected.length ? selected.map(x=>`<div class="reports-assigned-row"><span>${reportEsc(x.name)}</span><button type="button" data-remove-id="${reportEsc(x.id)}" title="Убрать">×</button></div>`).join("") : '<div class="reports-assignment-empty">Группы пока не выбраны</div>'}</div>
    </div>
    <div class="reports-assignment-heading available-heading">Доступные группы <span>${available.length}</span></div>
    <div class="reports-available-list">${available.length ? available.map(x=>`<label class="reports-group-row"><input type="checkbox" data-id="${reportEsc(x.id)}"><span>${reportEsc(x.name)}</span></label>`).join("") : '<div class="combo-empty">Нет доступных групп</div>'}</div>`;

  list.querySelectorAll("input[data-id]").forEach(cb=>cb.addEventListener("change",()=>{
    const ids=new Set((reportsSettings.groups[reportsSelectedType]||[]).map(String));
    if(cb.checked) ids.add(String(cb.dataset.id)); else ids.delete(String(cb.dataset.id));
    reportsSettings.groups[reportsSelectedType]=[...ids];
    renderReportsConfigTabs();
    renderReportsGroupAssignment();
  }));
  list.querySelectorAll("button[data-remove-id]").forEach(btn=>btn.addEventListener("click",()=>{
    reportsSettings.groups[reportsSelectedType]=(reportsSettings.groups[reportsSelectedType]||[]).filter(id=>String(id)!==String(btn.dataset.removeId));
    renderReportsConfigTabs();
    renderReportsGroupAssignment();
  }));
}

function renderGroupAssignmentPanel(){
  const panel=document.getElementById("reportsPanel");
  if(!panel) return;
  reportsConfigBackup=JSON.parse(JSON.stringify(reportsSettings));
  panel.classList.add("reports-config-mode");
  panel.querySelector(".reports-config-body")?.remove();
  const body=document.createElement("div");
  body.className="reports-config-body";
  body.innerHTML=`
    <div class="reports-config-top">
      <button class="reports-back" id="reportsConfigBack">← Назад</button>
      <div><div class="panel-kicker">Настройка</div><h2>Группы в отчётах</h2></div>
    </div>
    <div class="reports-config-tabs" id="reportsConfigTabs"></div>
    <div class="reports-config-help">Группа после выбора исчезает из остальных отчётов.</div>
    <input class="select-search reports-group-search" id="reportsGroupSearch" placeholder="Поиск группы…" autocomplete="off">
    <div class="reports-group-assignment" id="reportsGroupAssignment"></div>
    <div class="panel-primary-action"><button class="primary" id="reportsConfigSave">Сохранить</button></div>`;
  panel.appendChild(body);
  renderReportsConfigTabs();
  renderReportsGroupAssignment();
  document.getElementById("reportsConfigBack").addEventListener("click",()=>{
    reportsSettings=reportsConfigBackup||reportsSettings;
    reportsConfigBackup=null;
    panel.classList.remove("reports-config-mode");
    body.remove();
    renderReportsPanel();
  });
  document.getElementById("reportsGroupSearch").addEventListener("input",renderReportsGroupAssignment);
  document.getElementById("reportsConfigSave").addEventListener("click",async()=>{
    try{
      await saveReportsConfig();
      reportsConfigBackup=null;
      panel.classList.remove("reports-config-mode");
      body.remove();
      renderReportsPanel();
      showToast("Настройки отчётов сохранены");
      await loadReportsWeeks();
    }catch(e){showToast("Ошибка: "+e.message);}
  });
}

async function generateReports(){
  const date=reportsWeekDate;
  if(!date){showToast("Сначала выбери неделю в панели отчётов");return;}
  const from=document.getElementById("reportsYearFrom")?.value.trim()||"";
  const to=document.getElementById("reportsYearTo")?.value.trim()||"";
  if(!/^\d{4}$/.test(from)||!/^\d{4}$/.test(to)){showToast("Укажи учебный год, например 2025-2026");return;}
  reportsSettings.academicYear=`${from}-${to}`;
  reportsSettings.includeSaturday=Boolean(document.getElementById("reportsSaturday")?.checked);
  const keys=selectedReportKeys();
  if(!keys.length){showToast("Выбери хотя бы один отчёт");return;}
  const hasConfigured=keys.some(key=>(reportsSettings.groups[key]||[]).length);
  if(!hasConfigured){showToast("Для выбранных отчётов не назначены группы");return;}
  try{
    await saveReportsConfig();
    const btn=document.getElementById("reportsGenerate"); if(btn){btn.disabled=true;btn.textContent="Формирование…";}
    const r=await api("POST","/api/reports/generate",{academicYear:reportsSettings.academicYear,includeSaturday:reportsSettings.includeSaturday,weekStartDate:date,reportKeys:keys,groups:reportsSettings.groups});
    renderReportsResult(r);
  }catch(e){showToast("Ошибка: "+e.message);}
  finally{const btn=document.getElementById("reportsGenerate");if(btn){btn.disabled=false;btn.textContent="Сформировать выбранные";}}
}

function renderReportsResult(r){
  const el=document.getElementById("reportsResult"); if(!el)return;
  const files=r.files||[];
  const skipped=r.skipped||[];
  const emptyConfigured=r.emptyConfigured||[];
  el.dataset.persistent="1";el.hidden=false;
  el.innerHTML=`<div class="reports-result-title">Готово: ${files.length} ${files.length===1?"файл":"файлов"}</div>
    ${files.length?`<div class="reports-file-list">${files.map(f=>`<a class="reports-file-row" href="${reportEsc(f.url)}" download><span>${reportEsc(f.label)}</span><span>${f.groups} гр. · Скачать</span></a>`).join("")}</div>`:'<div class="reports-empty">Ни один отчёт не создан.</div>'}
    ${emptyConfigured.length?`<div class="reports-result-note">Нет опубликованного расписания: ${emptyConfigured.map(reportEsc).join("; ")}</div>`:""}
    ${skipped.length?`<div class="reports-result-note">Пропущено при получении данных: ${skipped.map(reportEsc).join("; ")}</div>`:""}`;
}

document.getElementById("btnReports")?.addEventListener("click",openReportsPanel);
document.getElementById("reportsClose")?.addEventListener("click",closeReportsPanel);
document.getElementById("reportsConfigure")?.addEventListener("click",renderGroupAssignmentPanel);
document.getElementById("reportsGenerate")?.addEventListener("click",generateReports);
document.getElementById("reportsWeekSearch")?.addEventListener("input",renderReportsWeekList);
document.getElementById("reportsSaturday")?.addEventListener("change",()=>renderReportsContext());

loadReportsConfig().catch(err=>showToast("Не удалось загрузить настройки отчётов: "+err.message));
