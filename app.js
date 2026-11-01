const API = 'https://dadosabertos.camara.leg.br/api/v2';
const $ = (id) => document.getElementById(id);
const state = { deputies: [], allDeputies: [], proposals: [], votes: [], timeline: [] };
const fmtDate = (value) => {
  if (!value) return 'Data não informada';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('pt-BR');
};
async function api(path) {
  const response = await fetch(API + '/' + path, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('API respondeu HTTP ' + response.status);
  return response.json();
}
function showToast(message) {
  const toast = $('toast'); toast.textContent = message; toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2800);
}
function setMetric(id, value) { $(id).textContent = value; }
function safeUrl(value, fallback = 'https://dadosabertos.camara.leg.br/') {
  try { const url = new URL(value || fallback); return url.protocol === 'https:' ? url.href : fallback; }
  catch { return fallback; }
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function renderDeputies(items) {
  const host = $('deputyList');
  if (!items.length) { host.innerHTML = '<div class="empty-state">Nenhum parlamentar encontrado nesta consulta.</div>'; return; }
  host.innerHTML = items.slice(0, 12).map(d => {
    const initials = (d.nome || '??').split(' ').slice(0,2).map(x => x[0]).join('').toUpperCase();
    const photo = d.urlFoto ? '<img class="avatar" src="' + safeUrl(d.urlFoto) + '" alt="" loading="lazy">' : '<span class="avatar avatar-fallback">' + initials + '</span>';
    return '<div class="deputy-item"><button class="deputy-open" type="button" data-deputy-id="' + Number(d.id) + '" aria-label="Abrir perfil de ' + escapeHtml(d.nome || 'parlamentar') + '">' + photo + '<span class="person"><strong>' + escapeHtml(d.nome || 'Nome não informado') + '</strong><small>' + escapeHtml(d.siglaUf || '—') + ' · ' + escapeHtml(d.siglaPartido || 'Partido não informado') + '</small></span></button><span class="party-tag">' + escapeHtml(d.siglaPartido || '—') + '</span></div>';
  }).join('');
}
function renderProposals(items) {
  const host = $('proposalList');
  if (!items.length) { host.innerHTML = '<div class="empty-state">Nenhuma proposição retornada.</div>'; return; }
  host.innerHTML = items.slice(0,7).map(p => {
    const label = [p.siglaTipo, p.numero && ' ' + p.numero, p.ano && '/' + p.ano].filter(Boolean).join('');
    return '<article class="activity-item"><div class="activity-meta"><span class="type-tag">' + escapeHtml(label || 'PROPOSIÇÃO') + '</span><span class="date-tag">' + fmtDate(p.dataApresentacao) + '</span></div><a href="' + safeUrl(p.uri) + '" target="_blank" rel="noopener">' + escapeHtml(p.ementa || 'Ementa não informada pela API.') + '</a></article>';
  }).join('');
}
function renderVotes(items) {
  const host = $('voteList');
  if (!items.length) { host.innerHTML = '<div class="empty-state">Nenhuma votação retornada.</div>'; return; }
  host.innerHTML = items.slice(0,8).map(v => '<article class="vote-item"><a href="' + safeUrl(v.uri, 'https://dadosabertos.camara.leg.br/api/v2/votacoes') + '" target="_blank" rel="noopener"><strong>' + escapeHtml(v.descricao || v.proposicaoObjeto || 'Registro de votação') + '</strong></a><small>' + fmtDate(v.dataHoraRegistro || v.dataHoraVoto || v.data) + ' · REGISTRO OFICIAL</small></article>').join('');
}
function normalizeTimeline(type, item) {
  const date = item.dataHoraInicio || item.dataDocumento || item.data || '';
  const timestamp = date ? new Date(date).getTime() : 0;
  let title = '', detail = '', href = 'https://dadosabertos.camara.leg.br/';
  if (type === 'evento') {
    title = item.descricao || item.descricaoTipo || 'Participação em evento';
    detail = [item.descricaoTipo, item.localExterno].filter(Boolean).join(' · ');
    href = item.uri || href;
  } else if (type === 'discurso') {
    title = item.sumario || item.tipoDiscurso || 'Discurso registrado';
    detail = item.tipoDiscurso || '';
    href = item.urlTexto || item.uri || href;
  } else {
    title = item.tipoDespesa || 'Despesa parlamentar';
    detail = [item.nomeFornecedor, item.valorDocumento != null && Number(item.valorDocumento).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})].filter(Boolean).join(' · ');
    href = item.urlDocumento || href;
  }
  return { type, date, timestamp: Number.isFinite(timestamp) ? timestamp : 0, title, detail, href: safeUrl(href) };
}
function renderTimeline() {
  const filter = $('timelineFilter').value;
  const entries = state.timeline.filter(item => filter === 'todos' || item.type === filter);
  $('timelineCount').textContent = state.timeline.length;
  if (!entries.length) { $('timelineList').innerHTML = '<div class="timeline-empty">Não há registros deste tipo nas consultas disponíveis.</div>'; return; }
  const labels = { evento: 'EVENTO', discurso: 'DISCURSO', despesa: 'DESPESA' };
  $('timelineList').innerHTML = entries.map(item => '<article class="timeline-entry"><div class="timeline-entry-head"><span class="timeline-date">' + fmtDate(item.date) + '</span><span class="timeline-type">' + labels[item.type] + '</span></div><h3>' + escapeHtml(item.title) + '</h3>' + (item.detail ? '<p>' + escapeHtml(item.detail) + '</p>' : '') + '<a href="' + item.href + '" target="_blank" rel="noopener">Consultar registro oficial ↗</a></article>').join('');
}
function setDashboardVisible(visible) {
  ['.hero','.section-heading','.stats-grid','.content-grid','.votes-panel','.methodology'].forEach(selector => {
    document.querySelectorAll(selector).forEach(node => node.hidden = !visible);
  });
  $('profileView').hidden = visible;
  if (visible) window.scrollTo({top:0,behavior:'smooth'});
}
async function openDeputyProfile(id) {
  if (!Number.isInteger(id) || id <= 0) return;
  const deputy = state.deputies.find(item => Number(item.id) === id) || { id, nome: 'Deputado ' + id };
  setDashboardVisible(false);
  $('profileName').textContent = deputy.nome || 'Perfil parlamentar';
  $('profileMeta').textContent = [deputy.siglaPartido, deputy.siglaUf].filter(Boolean).join(' · ') || 'Consultando dados oficiais';
  $('profileSource').href = 'https://www.camara.leg.br/deputados/' + id;
  const photo = $('profilePhoto');
  if (deputy.urlFoto) { photo.src = safeUrl(deputy.urlFoto); photo.hidden = false; } else photo.hidden = true;
  $('timelineList').innerHTML = '<div class="empty-state">Consultando atividade parlamentar na API oficial…</div>';
  $('timelineCount').textContent = '…';
  $('timelineFilter').value = 'todos';
  const results = await Promise.allSettled([
    api('deputados/' + id + '/eventos?ordem=DESC&ordenarPor=dataHoraInicio&itens=20'),
    api('deputados/' + id + '/discursos?ordem=DESC&ordenarPor=dataHoraInicio&itens=20'),
    api('deputados/' + id + '/despesas?ordem=DESC&ordenarPor=ano&itens=20')
  ]);
  const entries = [], types = ['evento','discurso','despesa'];
  results.forEach((result,index) => {
    if (result.status === 'fulfilled') (result.value.dados || []).forEach(item => entries.push(normalizeTimeline(types[index],item)));
  });
  state.timeline = entries.sort((a,b) => b.timestamp - a.timestamp);
  renderTimeline();
  const failures = results.filter(result => result.status === 'rejected').length;
  if (!entries.length) $('timelineList').innerHTML = '<div class="timeline-empty">' + (failures === 3 ? 'Não foi possível consultar os registros agora. Tente novamente mais tarde.' : 'A API não retornou registros para este perfil nas consultas realizadas.') + '</div>';
  if (failures) showToast(failures + ' consulta(s) de atividade não responderam.');
}
async function loadDashboard() {
  $('refreshBtn').disabled = true; $('refreshBtn').textContent = '↻ Consultando…';
  const tasks = await Promise.allSettled([
    api('deputados?ordem=ASC&ordenarPor=nome&itens=100'),
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
  $('proposalBadge').textContent = proposals.status === 'fulfilled' ? state.proposals.length + ' registros' : 'indisponível';
  $('voteBadge').textContent = votes.status === 'fulfilled' ? state.votes.length + ' registros' : 'indisponível';
  $('deputyFoot').textContent = deputies.status === 'fulfilled' ? state.deputies.length + ' registros nesta amostra' : 'Falha ao consultar a API';
  $('updatedAt').textContent = new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
  const failed = tasks.filter(t => t.status === 'rejected').length;
  $('refreshBtn').disabled = false; $('refreshBtn').innerHTML = '↻ <span>Atualizar</span>';
  if (failed === 3) showToast('Não foi possível acessar a API. Tente novamente.');
  else if (failed) showToast('Consulta concluída com ' + failed + ' fonte(s) indisponível(is).');
  else showToast('Dados atualizados diretamente da Câmara.');
}
$('refreshBtn').addEventListener('click', loadDashboard);
$('searchForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const term = $('deputySearch').value.trim();
  if (!term) { renderDeputies(state.deputies); return; }
  $('deputyList').innerHTML = '<div class="empty-state">Buscando na API oficial…</div>';
  try {
    const result = await api('deputados?nome=' + encodeURIComponent(term) + '&ordem=ASC&ordenarPor=nome&itens=20');
    renderDeputies(result.dados || []);
    $('deputyFoot').textContent = (result.dados || []).length + ' resultado(s) para “' + term + '”';
  } catch (error) {
    const filtered = state.deputies.filter(d => (d.nome || '').toLowerCase().includes(term.toLowerCase()));
    renderDeputies(filtered); showToast('Busca remota indisponível; exibindo apenas a amostra carregada.');
  }
});
$('deputyList').addEventListener('click', event => {
  const button = event.target.closest('[data-deputy-id]');
  if (button) openDeputyProfile(Number(button.dataset.deputyId));
});
$('backToDashboard').addEventListener('click', () => setDashboardVisible(true));
$('timelineFilter').addEventListener('change', renderTimeline);

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}
function fillComparisonDeputies(deputies=state.allDeputies.length?state.allDeputies:state.deputies) {
  const options=deputies.map(d=>'<option value="'+Number(d.id)+'">'+escapeHtml(d.nome)+' — '+escapeHtml(d.siglaUf||'')+'/'+escapeHtml(d.siglaPartido||'')+'</option>').join('');
  ['compareDeputyA','compareDeputyB'].forEach(id=>{$(id).innerHTML='<option value="">Selecione um deputado</option>'+options;});
  const first=deputies.find(d=>/nikolas ferreira/i.test(d.nome||''));
  const second=deputies.find(d=>/kim kataguiri/i.test(d.nome||''));
  if(first&&second){$('compareDeputyA').value=String(first.id);$('compareDeputyB').value=String(second.id);}
  else if(deputies.length>1){$('compareDeputyA').value=String(deputies[0].id);$('compareDeputyB').value=String(deputies[1].id);}
}
function populateYears() {
  const year = new Date().getFullYear();
  $('compareYear').innerHTML = Array.from({length:7},(_,i)=>year-i).map(y=>'<option value="'+y+'">'+y+'</option>').join('');
}
async function fetchAllPages(path,maxPages=20,pageSize=100) {
  const all=[];
  for(let page=1;page<=maxPages;page++){
    const separator=path.includes('?')?'&':'?';
    let result;
    try { result=await api(path+separator+'pagina='+page+'&itens='+pageSize); }
    catch(error) { if(all.length)return {rows:all,complete:false}; throw error; }
    const rows=result.dados||[];
    all.push(...rows);
    if(rows.length<pageSize)return {rows:all,complete:true};
  }
  return {rows:all,complete:false};
}
async function getExpenseTotal(id,year) {
  const result=await fetchAllPages('deputados/'+id+'/despesas?ano='+year+'&ordem=ASC&ordenarPor=ano',20,50);
  const rows=result.rows;
  const total=rows.reduce((sum,row)=>sum+Number(row.valorLiquido??row.valorDocumento??0),0);
  return {total,records:rows.length,rows,complete:result.complete};
}
async function getProposalStats(id,year) {
  const result=await fetchAllPages('proposicoes?idDeputadoAutor='+id+'&ano='+year+'&ordem=DESC&ordenarPor=ano',20,100);
  const rows=result.rows;
  const checked=rows.slice(0,40);
  const statuses=[];
  for(let i=0;i<checked.length;i+=8){
    const batch=await Promise.allSettled(checked.slice(i,i+8).map(p=>api('proposicoes/'+p.id)));
    batch.forEach((entry,index)=>{
      if(entry.status==='fulfilled'){
        const item=entry.value.dados||{};
        const status=item.statusProposicao||{};
        statuses.push({proposal:checked[i+index],status:status.descricaoSituacao||'Situação não informada'});
      }
    });
  }
  const approved=statuses.filter(x=>/aprovad/i.test(x.status));
  return {presented:rows.length,checked:statuses.length,approved:approved.length,items:statuses,complete:result.complete};
}
function comparisonPersonCard(deputy,value,label,photo) {
  return '<article class="comparison-person"><div class="comparison-person-head">'+(photo?'<img src="'+safeUrl(photo)+'" alt="" loading="lazy">':'')+'<div><strong>'+escapeHtml(deputy.nome)+'</strong><small>'+escapeHtml([deputy.siglaPartido,deputy.siglaUf].filter(Boolean).join(' · '))+'</small></div></div><div class="comparison-value">'+value+'</div><div class="comparison-caption">'+label+'</div></article>';
}
function renderComparisonChart(aName,bName,aValue,bValue,formatter,title) {
  const max=Math.max(aValue,bValue,1);
  const widthA=Math.max(aValue===0?0:2,aValue/max*100);
  const widthB=Math.max(bValue===0?0:2,bValue/max*100);
  return '<div class="comparison-chart"><div class="comparison-chart-title">'+title+'</div>'+
    '<div class="chart-row"><div class="chart-name">'+escapeHtml(aName)+'</div><div class="chart-track"><div class="chart-bar" style="width:'+widthA+'%"></div></div><div class="chart-number">'+formatter(aValue)+'</div></div>'+
    '<div class="chart-row"><div class="chart-name">'+escapeHtml(bName)+'</div><div class="chart-track"><div class="chart-bar" style="width:'+widthB+'%"></div></div><div class="chart-number">'+formatter(bValue)+'</div></div></div>';
}
async function runComparison() {
  const idA=Number($('compareDeputyA').value),idB=Number($('compareDeputyB').value);
  const metric=$('compareMetric').value,year=Number($('compareYear').value);
  if(!idA||!idB||idA===idB){showToast('Selecione dois parlamentares diferentes.');return;}
  const directory=state.allDeputies.length?state.allDeputies:state.deputies;
  const a=directory.find(d=>Number(d.id)===idA),b=directory.find(d=>Number(d.id)===idB);
  $('compareBtn').disabled=true;$('compareBtn').textContent='Consultando…';
  $('comparisonResults').innerHTML='<div class="comparison-loading">Consultando registros oficiais. Isso pode levar alguns segundos…</div>';
  try {
    if(metric==='expenses'){
      const [ra,rb]=await Promise.all([getExpenseTotal(idA,year),getExpenseTotal(idB,year)]);
      const difference=Math.abs(ra.total-rb.total),higher=ra.total>rb.total?a:ra.total<rb.total?b:null;
      $('comparisonResults').innerHTML='<div class="comparison-summary">'+
        comparisonPersonCard(a,money(ra.total),'Total líquido identificado · '+ra.records+' registros',a.urlFoto)+
        comparisonPersonCard(b,money(rb.total),'Total líquido identificado · '+rb.records+' registros',b.urlFoto)+'</div>'+
        renderComparisonChart(a.nome,b.nome,ra.total,rb.total,money,'Despesas declaradas em '+year)+
        '<div class="comparison-difference">'+(higher?'<strong>'+escapeHtml(higher.nome)+'</strong> apresenta '+money(difference)+' a mais em despesas registradas.':'Os dois parlamentares apresentam o mesmo total de despesas neste recorte.')+' A comparação considera os registros retornados pela API para '+year+'; valores podem sofrer atualização ou glosa. '+(!ra.complete||!rb.complete?'Atenção: pelo menos uma consulta foi interrompida antes do fim da paginação.':'')+'</div>';
    } else {
      const [ra,rb]=await Promise.all([getProposalStats(idA,year),getProposalStats(idB,year)]);
      $('comparisonResults').innerHTML='<div class="comparison-summary">'+
        comparisonPersonCard(a,ra.presented.toLocaleString('pt-BR'),'Proposições localizadas em '+year+(ra.complete?'':' · consulta parcial'),a.urlFoto)+
        comparisonPersonCard(b,rb.presented.toLocaleString('pt-BR'),'Proposições localizadas em '+year+(rb.complete?'':' · consulta parcial'),b.urlFoto)+'</div>'+
        renderComparisonChart(a.nome,b.nome,ra.presented,rb.presented,v=>v.toLocaleString('pt-BR'),'Proposições apresentadas em '+year)+
        '<div class="comparison-difference">Situação consultada individualmente em até 40 proposições por parlamentar: <strong>'+escapeHtml(a.nome)+': '+ra.approved+' com situação contendo “aprovad” entre '+ra.checked+' verificadas</strong>; <strong>'+escapeHtml(b.nome)+': '+rb.approved+' entre '+rb.checked+' verificadas</strong>. Isso é uma amostra de situação processual, não o total de projetos aprovados. '+(!ra.complete||!rb.complete?'A paginação de proposições ficou incompleta.':'')+'</div>'+
        '<details class="comparison-detail-list"><summary>Ver situações verificadas</summary><ul>'+ra.items.slice(0,12).map(x=>'<li>'+escapeHtml(x.proposal.siglaTipo+' '+x.proposal.numero+'/'+x.proposal.ano)+' — '+escapeHtml(x.status)+'</li>').join('')+
        rb.items.slice(0,12).map(x=>'<li>'+escapeHtml(x.proposal.siglaTipo+' '+x.proposal.numero+'/'+x.proposal.ano)+' — '+escapeHtml(x.status)+'</li>').join('')+'</ul></details>';
    }
  } catch(error) {
    $('comparisonResults').innerHTML='<div class="empty-state error-state">Não foi possível concluir a comparação. A API pode estar indisponível ou ter limitado a consulta. Tente novamente.</div>';
    showToast('Falha ao consultar os dados para comparação.');
  } finally {$('compareBtn').disabled=false;$('compareBtn').textContent='Comparar dados';}
}
function applyTheme(dark) {
  document.documentElement.dataset.theme=dark?'dark':'light';
  document.body.classList.toggle('dark-theme',dark);
  document.documentElement.style.colorScheme=dark?'dark':'light';
  updateThemeButton();
}
function initTheme() {
  let saved=null;
  try{saved=localStorage.getItem('radar-theme');}catch(error){}
  const prefersDark=window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)').matches:false;
  applyTheme(saved==='dark'||(saved===null&&prefersDark));
  $('themeToggle').addEventListener('click',()=>{
    const next=document.documentElement.dataset.theme!=='dark';
    applyTheme(next);
    try{localStorage.setItem('radar-theme',next?'dark':'light');}catch(error){}
  });
}
function updateThemeButton() {
  const dark=document.documentElement.dataset.theme==='dark';
  $('themeToggle').innerHTML='<span class="theme-icon">'+(dark?'☀':'☾')+'</span><span class="theme-text">'+(dark?'Tema claro':'Tema escuro')+'</span>';
  $('themeToggle').setAttribute('aria-label',dark?'Ativar modo claro':'Ativar modo noturno');
}
$('compareMetric').addEventListener('change',()=>{$('compareYearLabel').textContent=$('compareMetric').value==='expenses'?'Ano da despesa':'Ano de apresentação';});
$('compareBtn').addEventListener('click',runComparison);

initTheme();
populateYears();
loadDashboard().then(async()=>{
  fillComparisonDeputies();
  try {
    const result=await fetchAllPages('deputados?ordem=ASC&ordenarPor=nome',12,100);
    state.allDeputies=result.rows;
    fillComparisonDeputies(state.allDeputies);
    if(!result.complete) showToast('Lista de parlamentares carregada parcialmente.');
  } catch(error) {
    showToast('Comparador usando a lista inicial de parlamentares; lista completa indisponível.');
  }
});
