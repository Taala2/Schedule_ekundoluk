// ------------------------------------------------------------------ token

async function checkToken(){
  const s = await api("GET","/api/token");
  document.getElementById("tokenGate").style.display = s.hasToken ? "none" : "flex";
  return s.hasToken;
}
document.getElementById("tokenSave").addEventListener("click", async ()=>{
  const token = document.getElementById("tokenInput").value.trim();
  if (!token) return;
  await api("POST","/api/token",{token});
  document.getElementById("tokenGate").style.display="none";
  boot();
});
document.getElementById("changeTokenBtn").addEventListener("click", ()=>{
  document.getElementById("tokenGate").style.display="flex";
});
