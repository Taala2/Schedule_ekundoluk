// --------------------------------------------------------------- subjects

function renderTray(){
  const q = document.getElementById("subjectSearch").value.trim().toLowerCase();
  const tray = document.getElementById("subjectTray");
  const visibleSubjects = subjects.filter(s=>!q || s.name.toLowerCase().includes(q));
  const count = document.getElementById("subjectCount");
  if (count) count.textContent = visibleSubjects.length ? visibleSubjects.length : "";
  tray.innerHTML = visibleSubjects
    .map(s=>`<div class="chip ${armedSubject===s.id?"armed":""}" draggable="true" data-id="${s.id}">${escapeHtml(s.name)}</div>`).join("");
  tray.querySelectorAll(".chip").forEach(chip=>{
    chip.addEventListener("dragstart", ()=>{ dragSubject = chip.dataset.id; });
    chip.addEventListener("dragend", ()=>{ dragSubject = null; });
    chip.addEventListener("click", ()=>{
      const id = chip.dataset.id;
      if (armedSubject === id){ clearArmed(); hideBanner(); return; }
      clearArmed();
      armedSubject = id;
      chip.classList.add("armed");
      showBanner(`Выбран предмет «${chip.textContent}» — клик по уроку, чтобы применить (Esc — отмена)`);
    });
  });
  renderTemplates();
}
document.getElementById("subjectSearch").addEventListener("input", renderTray);
