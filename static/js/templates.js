// -------------------------------------------------------------- templates

async function loadTemplates(){
  const r = await api("GET","/api/templates");
  templates = r.rows;
}
function templateMatchesScope(t){
  if (!t.scope || t.scope === "global") return true;
  if (t.scope.startsWith("course:")) return t.scope.slice(7) === currentCategory;
  if (t.scope.startsWith("group:")) return t.scope.slice(6) === (current && current.gradeId);
  return true;
}
function renderTemplates(){
  const q = document.getElementById("templateSearch").value.trim().toLowerCase();
  const visible = templates.filter(templateMatchesScope).filter(t=>
    !q || (t.label||"").toLowerCase().includes(q) || (t.subj||"").toLowerCase().includes(q) || (t.staff||"").toLowerCase().includes(q));
  const combos = visible.filter(t=>t.kind!=="time");
  const times = visible.filter(t=>t.kind==="time");

  const tray = document.getElementById("templateTray");
  const chip = t => `<div class="tpl-chip ${armedTemplate?.id===t.id?"armed":""}" draggable="true" data-id="${t.id}">
      <span class="tpl-del" data-id="${t.id}">✕</span>
      <div class="t-subj">${escapeHtml(t.label)}</div>
      <div class="t-meta">${t.kind==="time" ? escapeHtml(t.bell) : `${escapeHtml(t.staff)} · ${escapeHtml(t.room)}`}</div>
    </div>`;
  tray.innerHTML =
    (combos.length ? `<div class="tpl-section-title">Предмет+препод+кабинет</div>${combos.map(chip).join("")}` : "") +
    (times.length ? `<div class="tpl-section-title">Время</div>${times.map(chip).join("")}` : "");

  tray.querySelectorAll(".tpl-chip").forEach(el=>{
    el.addEventListener("dragstart", ()=>{ dragTemplate = templates.find(t=>t.id===el.dataset.id); });
    el.addEventListener("dragend", ()=>{ dragTemplate = null; });
    el.addEventListener("click", e=>{
      if (e.target.classList.contains("tpl-del")) return;
      const t = templates.find(x=>x.id===el.dataset.id);
      if (armedTemplate?.id === t.id){ clearArmed(); hideBanner(); return; }
      clearArmed();
      armedTemplate = t;
      el.classList.add("armed");
      showBanner(`Выбран шаблон «${t.label}» — клик по уроку, чтобы применить (Esc — отмена)`);
    });
  });
  tray.querySelectorAll(".tpl-del").forEach(x=>{
    x.addEventListener("click", async e=>{
      e.stopPropagation();
      await api("DELETE", `/api/templates/${x.dataset.id}`);
      await loadTemplates(); renderTemplates();
    });
  });
}
document.getElementById("templateSearch").addEventListener("input", renderTemplates);

document.getElementById("addTplBtn").addEventListener("click", openTplPanel);
function openTplPanel(){
  document.getElementById("tSubject").innerHTML = subjects.map(s=>`<option value="${s.id}" data-name="${s.name}">${s.name}</option>`).join("");
  document.getElementById("tRoom").innerHTML = '<option value="">— без кабинета —</option>' + rooms.map(r=>`<option value="${r.id}" data-name="${r.name}">${r.name}</option>`).join("");
  templateSubjectCombo.setValue(document.getElementById("tSubject").value || "");
  templateRoomCombo.setValue("");
  document.getElementById("tScope").innerHTML =
    `<option value="global">Везде</option>
     <option value="course:${currentCategory}">Только курс ${currentCategory}</option>
     <option value="group:${current?.gradeId||""}">Только эта группа (${current?.gradeName||""})</option>`;
  templateScopeCombo.setValue(document.getElementById("tScope").value || "");
  templateKindCombo.setValue(document.getElementById("tKind").value || "combo");
  onTplSubjectChange();
  onTplKindChange();
  document.getElementById("panel").classList.remove("open");
  document.getElementById("tplPanel").classList.add("open");
  document.getElementById("overlay").classList.add("show");
}
async function onTplSubjectChange(){
  const subjId = document.getElementById("tSubject").value;
  const list = await loadStaff(subjId);
  document.getElementById("tStaff").innerHTML = list.map(s=>`<option value="${s.id}" data-ssid="${s.staffSubjectId}" data-name="${s.name}">${s.name}</option>`).join("");
  templateStaffCombo.setValue(document.getElementById("tStaff").value || "");
}
function onTplKindChange(){
  const isTime = document.getElementById("tKind").value === "time";
  document.getElementById("tComboFields").style.display = isTime ? "none" : "block";
  document.getElementById("tTimeFields").style.display = isTime ? "block" : "none";
}
const templateSubjectCombo=comboSetup({inputId:'tSubjectSearch',listId:'tSubjectList',selectId:'tSubject'});
const templateStaffCombo=comboSetup({inputId:'tStaffSearch',listId:'tStaffList',selectId:'tStaff'});
const templateRoomCombo=comboSetup({inputId:'tRoomSearch',listId:'tRoomList',selectId:'tRoom'});
document.getElementById("tKind").addEventListener("change", onTplKindChange);
document.getElementById("tSubject").addEventListener("change", onTplSubjectChange);
document.getElementById("tplClose").addEventListener("click", closePanel);
document.getElementById("tSave").addEventListener("click", async ()=>{
  const kind = document.getElementById("tKind").value;
  const scope = document.getElementById("tScope").value;
  let body;
  if (kind === "time"){
    const bell = document.getElementById("tBell").value.trim();
    if (!bell){ showToast("Укажи время"); return; }
    body = {kind, scope, label: document.getElementById("tLabel").value || bell, bell};
  } else {
    const subjSel = document.getElementById("tSubject");
    const staffSel = document.getElementById("tStaff");
    const roomSel = document.getElementById("tRoom");
    body = {
      kind, scope,
      label: document.getElementById("tLabel").value || subjSel.selectedOptions[0]?.dataset.name,
      subj: subjSel.selectedOptions[0]?.dataset.name || "", subjectId: subjSel.value,
      staff: staffSel.selectedOptions[0]?.dataset.name || "", staffId: staffSel.value,
      staffSubjectId: staffSel.selectedOptions[0]?.dataset.ssid || "",
      room: roomSel.selectedOptions[0]?.dataset.name || "", roomId: roomSel.value,
    };
  }
  await api("POST","/api/templates", body);
  await loadTemplates(); renderTemplates();
  closePanel(); showToast("Шаблон добавлен");
});
