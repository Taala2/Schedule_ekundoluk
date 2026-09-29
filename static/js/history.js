// --------------------------------------------------------- history / undo

function recordPrev(batch, day, lesson){
  const c = cellAt(day, lesson);
  batch.push({day, lesson, prevState: c ? {...c} : null});
}
function pushHistory(batch){
  history.push(batch);
  if (history.length > 10) history.shift();
  updateUndoButton();
}
function updateUndoButton(){
  document.getElementById("btnUndo").disabled = history.length === 0;
}
async function undo(){
  const batch = history.pop();
  updateUndoButton();
  if (!batch){ showToast("Нечего отменять"); return; }
  try{
    for (const entry of batch){
      const cur = cellAt(entry.day, entry.lesson);
      if (entry.prevState === null){
        if (cur?.objectId) await api("POST","/api/lesson/delete", {objectId: cur.objectId});
      } else {
        const p = entry.prevState;
        await api("POST","/api/lesson/save", {
          objectId: p.objectId ?? cur?.objectId ?? null,
          schoolId: current.schoolId, gradeId: current.gradeId, jugurtmoMainId: current.jugurtmoMainId,
          weekday: entry.day, lesson: entry.lesson, bell: p.bell,
          subjectId: p.subjectId ?? null, staffId: p.staffId ?? null, realStaffId: p.staffId ?? null,
          staffSubjectId: p.staffSubjectId ?? null, roomId: p.roomId ?? null,
        });
      }
    }
    showToast("Отменено");
    await loadWeek();
  }catch(err){ showToast("Ошибка отмены: "+err.message); }
}
document.getElementById("btnUndo").addEventListener("click", undo);
