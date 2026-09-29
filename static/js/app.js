// ------------------------------------------------------------------- boot

async function boot(){
  const ok = await checkToken();
  if (!ok) return;
  await loadTemplates();
  await loadGroupSettings();
  await loadGroups();
}
boot();
