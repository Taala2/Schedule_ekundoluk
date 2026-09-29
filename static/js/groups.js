// ----------------------------------------------------------- group picker

async function loadGroupSettings(){
  const r = await api("GET","/api/group-settings");
  groupSettings = r.settings || {};
}
async function setMainShift(gradeId, jugurtmoMainId){
  await api("POST","/api/group-settings", {gradeId, jugurtmoId:jugurtmoMainId});
  groupSettings[gradeId] = {defaultJugurtmoId: jugurtmoMainId};
  renderGroupList();
  showToast("Основная смена сохранена");
}
async function loadGroups(){
  const r = await api("GET","/api/groups");
  groupsRaw = r.rows;
  buildGroupIndex();
  renderCategorySelect();
  renderGroupList();
}
function gradeSortKey(name){
  const m = String(name || "").match(/(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), String(name).toLowerCase()] : [999, 999, String(name || "").toLowerCase()];
}
function compareGradeNames(a, b){
  const ka = gradeSortKey(a), kb = gradeSortKey(b);
  if (ka[0] !== kb[0]) return ka[0] - kb[0];
  if (ka[1] !== kb[1]) return ka[1] - kb[1];
  return ka[2].localeCompare(kb[2], "ru");
}
function buildGroupIndex(){
  groupIndex = new Map();
  for (const g of groupsRaw){
    if (!groupIndex.has(g.gradeId)){
      groupIndex.set(g.gradeId, {
        gradeName: g.gradeName.trim(),
        category: parseCategory(g.gradeName),
        schoolId: g.schoolId,
        shifts: [],
      });
    }
    groupIndex.get(g.gradeId).shifts.push({id:g.objectId, name:g.jugurtmoMainName});
  }
  for (const g of groupIndex.values()) g.shifts.sort((a,b)=>a.name.localeCompare(b.name, "ru", {numeric:true}));
  categories = [...new Set([...groupIndex.values()].map(g=>g.category))].sort((a,b)=>compareGradeNames(a+" 1", b+" 1"));
}
function renderCategorySelect(){
  const sel = document.getElementById("categorySelect");
  const input = document.getElementById("categorySearch");
  const list = document.getElementById("categoryList");
  sel.innerHTML = '<option value="">Все курсы</option>' + categories.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  if (!sel.dataset.comboBound){
    const combo = input.closest('.combo');
    const render = () => {
      const q = input.value.trim().toLowerCase();
      const opts=[...sel.options].filter(o=>!q || o.textContent.toLowerCase().includes(q));
      list.innerHTML = opts.length ? opts.map(o=>`<div class="combo-option" data-value="${escapeHtml(o.value)}">${escapeHtml(o.textContent)}</div>`).join('') : '<div class="combo-empty">Ничего не найдено</div>';
      list.querySelectorAll('.combo-option').forEach(o=>o.addEventListener('mousedown', e=>{
        e.preventDefault();
        sel.value=o.dataset.value;
        input.value=o.textContent;
        combo.classList.remove('open');
        renderGroupList();
      }));
    };
    input.addEventListener('focus',()=>{render();combo.classList.add('open')});
    input.addEventListener('input',()=>{render();combo.classList.add('open')});
    input.addEventListener('keydown',e=>{
      if(e.key==='Escape'){combo.classList.remove('open');input.blur();}
      if(e.key==='Enter'){const first=list.querySelector('.combo-option'); if(first){first.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));e.preventDefault();}}
    });
    document.addEventListener('mousedown',e=>{if(!combo.contains(e.target)) combo.classList.remove('open')});
    sel.dataset.comboBound='1';
  }
  input.value = sel.selectedOptions[0]?.textContent || 'Все курсы';
}
function renderGroupList(){
  const cat = document.getElementById("categorySelect").value;
  const q = document.getElementById("groupSearch").value.trim().toLowerCase();
  const list = document.getElementById("groupList");
  const entries = [...groupIndex.entries()]
    .filter(([id,g])=> (!cat || g.category===cat) && (!q || g.gradeName.toLowerCase().includes(q)))
    .sort(([,a],[,b])=>compareGradeNames(a.gradeName,b.gradeName));
  const count = document.getElementById("groupCount");
  if (count) count.textContent = entries.length ? entries.length : "";
  list.innerHTML = entries.map(([id,g])=>{
    const mainId = groupSettings[id]?.defaultJugurtmoId || null;
    const shifts = g.shifts.map(s=>`
      <div class="group-shift-row">
        <button class="shift-chip ${s.id===mainId?"main":""} ${current?.gradeId===id && current?.jugurtmoMainId===s.id?"sel":""}" data-shift-id="${s.id}" data-grade-id="${id}">${escapeHtml(s.name)}</button>
        <button class="shift-main-btn ${s.id===mainId?"main":""}" data-id="${s.id}" data-grade-id="${id}" title="${s.id===mainId?"Основная смена":"Сделать основной"}">★</button>
      </div>`).join("");
    return `<div class="group-entry ${id===selectedGradeId?"sel":""}" data-id="${id}">
      <div class="group-entry-name">${escapeHtml(g.gradeName)}</div>
      <div class="group-shifts">${shifts}</div>
    </div>`;
  }).join("") || '<div class="row">Ничего не найдено</div>';

  list.querySelectorAll(".group-entry").forEach(row=>{
    row.addEventListener("click", async e=>{
      if (e.target.closest(".group-shift-row")) return;
      const gradeId=row.dataset.id;
      const g=groupIndex.get(gradeId);
      if(!g) return;

      if (appMode === "view") {
        // В просмотре клик по группе должен сразу показывать расписание.
        // Если у группы несколько смен, используем текущую смену этой же
        // группы, если она уже выбрана, иначе первую смену.
        const shift = current?.gradeId===gradeId
          ? g.shifts.find(s=>s.id===current.jugurtmoMainId)
          : g.shifts[0];
        if(!shift) return;
        if(current?.gradeId===gradeId && current?.jugurtmoMainId===shift.id) return;
        await selectShift(gradeId, shift.id);
        return;
      }

      selectGrade(gradeId);
    });
  });
  list.querySelectorAll(".shift-chip").forEach(chip=>{
    chip.addEventListener("click", e=>{
      e.stopPropagation();
      const gradeId = chip.dataset.gradeId;
      const shiftId = chip.dataset.shiftId;
      // Не сбрасываем current перед каждым кликом по смене: это
      // порождало повторные загрузки, особенно при двойном/быстром клике.
      // Для другой группы сначала меняем только выбранную группу.
      if (current?.gradeId !== gradeId) {
        selectGrade(gradeId, {autoSelect:false});
      } else {
        selectedGradeId = gradeId;
      }
      selectShift(gradeId, shiftId);
    });
  });
  list.querySelectorAll(".shift-main-btn").forEach(btn=>btn.addEventListener("click", async e=>{
    e.stopPropagation();
    try { await setMainShift(btn.dataset.gradeId, btn.dataset.id); }
    catch(err) { showToast("Ошибка: "+err.message); }
  }));
}
document.getElementById("groupSearch").addEventListener("input", renderGroupList);

function clearCurrentSelection(){
  current = null;
  weekData = {};
  subjects = [];
  rooms = [];
  staffCache = {};
  const groupBtn = document.getElementById("btnChooseShift");
  if (groupBtn) groupBtn.textContent = "Выберите смену";
  const weekSelect = document.getElementById("weekSelect");
  if (weekSelect) weekSelect.innerHTML = "";
  render();
  renderTray();
}

function selectGrade(gradeId, options={}){
  const autoSelect = options.autoSelect !== false;
  const g = groupIndex.get(gradeId);
  if (!g) return;

  // Повторный клик по уже выбранной группе не должен сбрасывать
  // текущее расписание и заново инициировать загрузку.
  if (selectedGradeId === gradeId) {
    renderGroupList();
    return;
  }

  selectedGradeId = gradeId;
  currentCategory = g.category;
  clearCurrentSelection();
  renderGroupList();
  if (autoSelect && g.shifts.length===1) selectShift(gradeId, g.shifts[0].id);
}
let shiftLoadPromise = null;
let shiftLoadKey = "";

async function selectShift(gradeId, jugurtmoMainId){
  const requestKey = `${appMode}|${gradeId}|${jugurtmoMainId}`;
  if (current?.gradeId === gradeId && current?.jugurtmoMainId === jugurtmoMainId) {
    selectedGradeId = gradeId;
    renderGroupList();
    return shiftLoadPromise;
  }
  if (shiftLoadPromise && shiftLoadKey === requestKey) return shiftLoadPromise;

  shiftLoadKey = requestKey;
  shiftLoadPromise = (async ()=>{
  const g = groupIndex.get(gradeId);
  const shift = g?.shifts.find(s=>s.id===jugurtmoMainId);
  if(!g || !shift) return;
  selectedGradeId = gradeId;
  current = {gradeId, schoolId:g.schoolId, jugurtmoMainId, gradeName:g.gradeName, jugurtmoMainName:shift.name};
  currentCategory = g.category;
  const groupBtn = document.getElementById("btnChooseShift");
  if (groupBtn) groupBtn.textContent = `${g.gradeName} — ${shift.name}`;
  await Promise.all([loadSubjects(), loadRooms()]);
  await loadWeek();
  await loadPublishWeeks();
  if (appMode === "view") {
    syncViewSelectedWeek();
    renderViewWeekList();
  }
  renderTray();
  renderGroupList();
  if (appMode === "view") await refreshPublishedView();
  })();
  try { return await shiftLoadPromise; }
  finally {
    if (shiftLoadKey === requestKey) {
      shiftLoadPromise = null;
      shiftLoadKey = "";
    }
  }
}


// Shift selector in the current schedule context
function renderShiftPicker(){
  const list=document.getElementById("shiftList");
  const label=document.getElementById("shiftPanelGroupLabel");
  const gradeId=current?.gradeId || selectedGradeId;
  if(!list || !gradeId) return;
  const g=groupIndex.get(gradeId);
  if(!g) return;
  if(label) label.textContent=g.gradeName;
  const mainId=groupSettings[gradeId]?.defaultJugurtmoId || null;
  const activeId=current?.gradeId===gradeId ? current.jugurtmoMainId : null;
  list.innerHTML=g.shifts.map(s=>`
    <div class="week-option shift-option ${s.id===activeId?"active":""}" data-shift-id="${escapeHtml(s.id)}" data-grade-id="${escapeHtml(gradeId)}">
      <span class="shift-status-dot ${s.id===activeId?"active":""}"></span>
      <span class="week-option-main">
        <span class="week-option-title">${escapeHtml(s.name)}</span>
        <span class="week-option-meta">${s.id===mainId?"★ Основная смена":""}</span>
      </span>
    </div>`).join("");
  list.querySelectorAll(".shift-option").forEach(row=>row.addEventListener("mousedown",async e=>{
    e.preventDefault();
    const id=row.dataset.shiftId;
    const rowGradeId=row.dataset.gradeId;
    closePanel();
    await selectShift(rowGradeId,id);
  }));
}
function openShiftPanel(){
  const gradeId=current?.gradeId || selectedGradeId;
  if(!gradeId) { showToast("Сначала выбери группу"); return; }
  document.getElementById("weekPanel")?.classList.remove("open");
  document.getElementById("copyPanel")?.classList.remove("open");
  document.getElementById("tplPanel")?.classList.remove("open");
  renderShiftPicker();
  document.getElementById("shiftPanel")?.classList.add("open");
  document.getElementById("overlay")?.classList.add("show");
}
document.getElementById("btnChooseShift")?.addEventListener("click", openShiftPanel);
document.getElementById("shiftClose")?.addEventListener("click", closePanel);
