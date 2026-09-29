// -------------------------------------------------------------- reference

async function loadSubjects(){
  const r = await api("GET", `/api/subjects?gradeId=${encodeURIComponent(current.gradeId)}`);
  subjects = pickArray(r.rows).map(normOption);
  staffCache = {};
}
async function loadRooms(){
  const r = await api("GET","/api/rooms");
  rooms = pickArray(r.rows).map(normOption);
}
async function loadStaff(subjectId, gradeId = current?.gradeId){
  if (!gradeId) return [];
  const cacheKey = `${gradeId}:${subjectId}`;
  if (staffCache[cacheKey]) return staffCache[cacheKey];
  const r = await api("GET", `/api/staff?subjectId=${encodeURIComponent(subjectId)}&gradeId=${encodeURIComponent(gradeId)}`);
  const list = pickArray(r.rows).map(normOption);
  staffCache[cacheKey] = list;
  return list;
}
