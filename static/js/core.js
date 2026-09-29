
const DAYS = ["Пн","Вт","Ср","Чт","Пт","Сб"];
const LESSON_ROWS = [1,2,3,4,5];

let groupsRaw = [];
let groupIndex = new Map();   // gradeId -> {gradeName, category, schoolId, shifts:[{id,name}]}
let categories = [];
let selectedGradeId = null;
let current = null;           // {gradeId, schoolId, jugurtmoMainId, gradeName, jugurtmoMainName}
let currentCategory = "";
let weekData = {};
let subjects = [];
let rooms = [];
let staffCache = {};
let templates = [];
let groupSettings = {};
let appMode = "edit";
let publishedWeekData = {};
let publishedWeekMeta = null;
let publishedCompare = null;

let dragSrc=null, dragDay=null, dragSubject=null, dragTemplate=null, editing=null;
let history=[], clipboard=null, dayClipboard=null;
let selectedLessons = new Set();
let selectionAnchor = null;


// ---------------------------------------------------------------- helpers

function escapeHtml(value){
  return String(value ?? "").replace(/[&<>"]/g, ch => {
    if (ch === "&") return "&amp;";
    if (ch === "<") return "&lt;";
    if (ch === ">") return "&gt;";
    return "&quot;";
  });
}

function pickArray(x){
  if (Array.isArray(x)) return x;
  if (!x || typeof x !== "object") return [];
  for (const k of ["data","rows","items","list","staffList","subGroups","jugurtmoLookUpStaff"]) if (Array.isArray(x[k])) return x[k];
  return [];
}
function normOption(o){
  return {
    id: o.objectId ?? o.objectID ?? o.subjectId ?? o.subjectID ?? o.id ?? o.value ?? o.staffId ?? "",
    name: o.translatedName ?? o.subjectNameRu ?? o.subjectName ?? o.translatedSubjectName ?? o.name ?? o.text ?? "?",
    staffSubjectId: o.staffSubjectId ?? o.objectId ?? o.id ?? "",
  };
}
function keyOf(d,l){ return d+"-"+l; }
let toastTimer;
function showToast(msg){
  const t=document.getElementById("toast");
  t.textContent=msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove("show"),2500);
}
async function api(method, path, body){
  const opts = {method, headers:{"Content-Type":"application/json"}};
  if (body!==undefined) opts.body = JSON.stringify(body);
  const resp = await fetch(path, opts);
  const data = await resp.json().catch(()=>({}));
  if (!resp.ok || data.ok===false) throw new Error(data.error || `Ошибка запроса ${path}`);
  return data;
}
function parseCategory(name){
  const m = name.match(/(\d)\.(\d)/);
  return m ? `${m[1]}.${m[2]}` : "Без категории";
}

// -------------------------------------------------------------- arm banner
// Общий баннер "что-то выбрано, клик по цели — применить" для копирования
// урока, дня, предмета и шаблона.
function showBanner(text){
  const b = document.getElementById("clipBanner");
  b.style.display = "flex";
  b.querySelector("span").textContent = text;
}
function hideBanner(){ document.getElementById("clipBanner").style.display = "none"; }

let armedSubject=null, armedTemplate=null, armedDaySwap=null;
function clearArmed(){
  armedSubject=null; armedTemplate=null; armedDaySwap=null;
  document.querySelectorAll(".chip.armed,.tpl-chip.armed").forEach(el=>el.classList.remove("armed"));
}
