const API = 'https://dadosabertos.camara.leg.br/api/v2';
const $ = (id) => document.getElementById(id);
const state = { deputies: [], proposals: [], votes: [] };
const fmtDate = (value) => {
  if (!value) return 'Data não informada';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('pt-BR');
};
async function api(path) {
  const response = await fetch(`${API}/${path}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`API respondeu HTTP ${response.status}`);
  return response.json();
}
function showToast(message) {
  const toast = $('toast'); toast.textContent = message; toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2800);
}
function setMetric(id, value) { $(id).textContent = value; }
function renderDeputies(items) {
  const host = $('deputyList');
  if (!items.length) { host.innerHTML = '<div class="empty-state">Nenhum parlamentar encontrado nesta consulta.</div>'; return; }
  host.innerHTML = items.map(d => {
    const initials = (d.nome || '??').split(' ').slice(0,2).map(x => x[0]).join('').toUpperCase();
    const photo = d.urlFoto ? `<img class="avatar" src="${d.urlFoto}" alt="" loading="lazy" onerror="this.outerHTML='<span class=&quot;avatar avatar-fallback&quot;>${initials}</span>'">` : `<span class="avatar avatar-fallback">${initials}</span>`;
    const url = d.uri || (d.id ? `https://dadosabertos.camara.leg.br/api/v2/deputados/${d.id}` : 'https://dadosabertos.camara.leg.br/');
    return `<div class="deputy-item">${photo}<div class="person"><strong>${escapeHtml(d.nome || 'Nome não informado')}</strong><small>${escapeHtml(d.siglaUf || '—')} · ${escapeHtml(d.siglaPartido || 'Partido não informado')}</small></div><span class="party-tag">${escapeHtml(d.siglaPartido || '—')}</span></div>`;
  }).join('');
}
function renderProposals(items) {
  const host = $('proposalList');
  if (!items.length) { host.innerHTML = '<div class="empty-state">Nenhuma proposição retornada.</div>'; return; }
  host.innerHTML = items.slice(0,7).map(p => {
    const label = [p.siglaTipo, p.numero && ` ${p.numero}`, p.ano && `/${p.ano}`].filter(Boolean).join('');
    const title = p.ementa || 'Ementa não informada pela API.';
    const href = p.uri || 'https://dadosabertos.camara.leg.br/';
    return `<article class="activity-item"><div class="activity-meta"><span class="type-tag">${escapeHtml(label || 'PROPOSIÇÃO')}</span><span class="date-tag">${fmtDate(p.dataApresentacao)}</span></div><a href="${href}" target="_blank" rel="noopener">${escapeHtml(title)}</a></article>`;
  }).join('');
}
function renderVotes(items) {
  const host = $('voteList');
  if (!items.length) { host.innerHTML = '<div class="empty-state">Nenhuma votação retornada.</div>'; return; }
  host.innerHTML = items.slice(0,8).map(v => {
    const title = v.descricao || v.proposicaoObjeto || 'Registro de votação';
    const date = fmtDate(v.dataHoraRegistro || v.data);
    const href = v.uri || 'https://dadosabertos.camara.leg.br/api/v2/votacoes';
    return `<article class="vote-item"><a href="${href}" target="_blank" rel="noopener"><strong>${escapeHtml(title)}</strong></a><small>${date} · REGISTRO OFICIAL</small></article>`;
  }).join('');
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
async function loadDashboard() {
  $('refreshBtn').disabled = true; $('refreshBtn').textContent = '↻ Consultando…';
  const tasks = await Promise.allSettled([
    api('deputados?ordem=ASC&ordenarPor=nome&itens=12'),
    api('proposicoes?ordem=DESC&ordenarPor=id&itens=7'),
    api('votacoes?ordem=DESC&ordenarPor=dataHoraRegistro&itens=8')
  ]);
  const [deputies, proposals, votes] = tasks;
  if (deputies.status === 'fulfilled') state.deputies = deputies.value.dados || [];
  if (proposals.status === 'fulfilled') state.proposals = proposals.value.dados || [];
  if (votes.status === 'fulfilled') state.votes = votes.value.dados || [];
  if (deputies.status === 'fulfilled') renderDeputies(state.deputies);
  else $('deputyList').innerHTML = '<div class="empty-state error-state">Não foi possível carregar parlamentares. Tente atualizar.</div>';
  if (proposals.status === 'fulfilled') renderProposals(state.proposals);
  else $('proposalList').innerHTML = '<div class="empty-state error-state">Não foi possível carregar proposições.</div>';
  if (votes.status === 'fulfilled') renderVotes(state.votes);
  else $('voteList').innerHTML = '<div class="empty-state error-state">Não foi possível carregar votações.</div>';
  setMetric('deputyCount', deputies.status === 'fulfilled' ? state.deputies.length : '—');
  setMetric('partyCount', deputies.status === 'fulfilled' ? new Set(state.deputies.map(d => d.siglaPartido).filter(Boolean)).size : '—');
  setMetric('proposalCount', proposals.status === 'fulfilled' ? state.proposals.length : '—');
  setMetric('voteCount', votes.status === 'fulfilled' ? state.votes.length : '—');
  $('proposalBadge').textContent = proposals.status === 'fulfilled' ? `${state.proposals.length} registros` : 'indisponível';
  $('voteBadge').textContent = votes.status === 'fulfilled' ? `${state.votes.length} registros` : 'indisponível';
  $('deputyFoot').textContent = deputies.status === 'fulfilled' ? `${state.deputies.length} registros nesta amostra` : 'Falha ao consultar a API';
  $('updatedAt').textContent = new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
  const failed = tasks.filter(t => t.status === 'rejected').length;
  $('refreshBtn').disabled = false; $('refreshBtn').innerHTML = '↻ <span>Atualizar</span>';
  if (failed === 3) showToast('Não foi possível acessar a API. Tente novamente.');
  else if (failed) showToast(`Consulta concluída com ${failed} fonte(s) indisponível(is).`);
  else showToast('Dados atualizados diretamente da Câmara.');
}
$('refreshBtn').addEventListener('click', loadDashboard);
$('searchForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const term = $('deputySearch').value.trim();
  if (!term) { renderDeputies(state.deputies); return; }
  $('deputyList').innerHTML = '<div class="empty-state">Buscando na API oficial…</div>';
  try {
    const result = await api(`deputados?nome=${encodeURIComponent(term)}&ordem=ASC&ordenarPor=nome&itens=20`);
    renderDeputies(result.dados || []);
    $('deputyFoot').textContent = `${(result.dados || []).length} resultado(s) para “${term}”`;
  } catch (error) {
    const filtered = state.deputies.filter(d => (d.nome || '').toLowerCase().includes(term.toLowerCase()));
    renderDeputies(filtered); showToast('Busca remota indisponível; exibindo apenas a amostra carregada.');
  }
});
loadDashboard();
