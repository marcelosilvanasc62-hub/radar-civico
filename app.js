const API = 'https://dadosabertos.camara.leg.br/api/v2';
const $ = (id) => document.getElementById(id);
const state = { deputies: [], allDeputies: [], proposals: [], votes: [], timeline: [], comparisonScope: 'national', comparisonState: '', preferences: {} };
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
function partyColorFor(party) {
  const colors = {
    PT:'#E32636',PL:'#2455A4',UNIÃO:'#2454A6',UNIAO:'#2454A6',PP:'#2455A4',PSD:'#F28C28',
    MDB:'#2E9B57',REPUBLICANOS:'#2455A4',PSB:'#E32636',PDT:'#D92B35',PSOL:'#E5C52B',
    PODE:'#4C3B8F',PODEMOS:'#4C3B8F',NOVO:'#F07824',PV:'#23834B',PCDOB:'#C9252D',
    CIDADANIA:'#D52B36',AVANTE:'#1E70A6',SOLIDARIEDADE:'#E3B928',REDE:'#2B9B72',
    PSDB:'#2D78B7',PRD:'#265A9C',AGIR:'#E47A24',MISSÃO:'#5A4B8A',MISSAO:'#5A4B8A'
  };
  return colors[String(party || '').trim().toUpperCase()] || '#778795';
}
function renderDeputies(items) {
  const host = $('deputyList');
  if (!items.length) { host.innerHTML = '<div class="empty-state">Nenhum parlamentar encontrado nesta consulta.</div>'; return; }
  host.innerHTML = items.slice(0, 12).map(d => {
    const initials = (d.nome || '??').split(' ').slice(0,2).map(x => x[0]).join('').toUpperCase();
    const photo = d.urlFoto ? '<img class="avatar" src="' + safeUrl(d.urlFoto) + '" alt="" loading="lazy">' : '<span class="avatar avatar-fallback">' + initials + '</span>';
    const partyColor = partyColorFor(d.siglaPartido);
    return '<div class="deputy-item" style="--party-color:' + partyColor + '"><button class="deputy-open" type="button" data-deputy-id="' + Number(d.id) + '" aria-label="Abrir perfil de ' + escapeHtml(d.nome || 'parlamentar') + '">' + photo + '<span class="person"><strong>' + escapeHtml(d.nome || 'Nome não informado') + '</strong><small>' + escapeHtml(d.siglaUf || '—') + ' · ' + escapeHtml(d.siglaPartido || 'Partido não informado') + '</small></span></button><span class="party-tag">' + escapeHtml(d.siglaPartido || '—') + '</span></div>';
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
  const deputy = state.allDeputies.find(item => Number(item.id) === id) || state.deputies.find(item => Number(item.id) === id) || { id, nome: 'Deputado ' + id };
  setDashboardVisible(false);
  $('profileName').textContent = deputy.nome || 'Perfil parlamentar';
  $('profileMeta').textContent = [deputy.siglaPartido, deputy.siglaUf].filter(Boolean).join(' · ') || 'Consultando dados oficiais';
  $('profileView').style.setProperty('--party-color', partyColorFor(deputy.siglaPartido));
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
  $('profileAttendance').textContent='Não calculada';$('profileAttendanceNote').textContent='O percentual exige matrícula parlamentar e total de sessões plenárias elegíveis no período; não é estimado a partir de eventos.';
  $('profilePixTotal').textContent='Não consolidado';$('profilePixNote').textContent='A identificação de emendas PIX e seus pagamentos depende da base de execução orçamentária autenticada.';
  $('profileAmendmentTotal').textContent='Não consolidado';$('profileAmendmentNote').textContent='A consulta oficial permite filtrar autor, município beneficiado e valores pagos; ainda sem integração direta neste painel.';
  $('profileAmendmentsList').innerHTML='<tr><td colspan="4">Não há dados de emendas carregados para este parlamentar. Consulte a fonte oficial para conferir município, favorecido, valor empenhado, liquidado e pago. <a href="https://portaldatransparencia.gov.br/emendas" target="_blank" rel="noopener">Abrir consulta de emendas ↗</a></td></tr>';
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
const brazilStates=[['AC','Acre'],['AL','Alagoas'],['AP','Amapá'],['AM','Amazonas'],['BA','Bahia'],['CE','Ceará'],['DF','Distrito Federal'],['ES','Espírito Santo'],['GO','Goiás'],['MA','Maranhão'],['MT','Mato Grosso'],['MS','Mato Grosso do Sul'],['MG','Minas Gerais'],['PA','Pará'],['PB','Paraíba'],['PR','Paraná'],['PE','Pernambuco'],['PI','Piauí'],['RJ','Rio de Janeiro'],['RN','Rio Grande do Norte'],['RS','Rio Grande do Sul'],['RO','Rondônia'],['RR','Roraima'],['SC','Santa Catarina'],['SP','São Paulo'],['SE','Sergipe'],['TO','Tocantins']];
function comparisonDirectory(){const all=state.allDeputies.length?state.allDeputies:state.deputies;if(state.comparisonScope==='state')return state.comparisonState?all.filter(d=>d.siglaUf===state.comparisonState):[];return all;}
function setCandidate(which,deputy){if(!deputy)return;$('compareDeputy'+which).value=String(deputy.id);$('compareSearch'+which).value=deputy.nome||'';$('compareParty'+which).value=deputy.siglaPartido||'';$('compareResults'+which).innerHTML='';}
function renderCandidateResults(which){
 const query=$('compareSearch'+which).value.trim().toLocaleLowerCase('pt-BR'),party=$('compareParty'+which).value,directory=comparisonDirectory();
 let selected=$('compareDeputy'+which).value;
 if(selected&&!directory.some(d=>String(d.id)===selected)){$('compareDeputy'+which).value='';$('compareSearch'+which).value='';selected='';}
 const rows=directory.filter(d=>(!query||(d.nome||'').toLocaleLowerCase('pt-BR').includes(query))&&(!party||d.siglaPartido===party)).slice(0,10);
 $('compareResults'+which).innerHTML=rows.length?rows.map(d=>'<button type="button" class="candidate-result" role="option" aria-selected="'+(String(d.id)===selected)+'" data-candidate-id="'+Number(d.id)+'" data-picker="'+which+'" style="--party-color:'+partyColorFor(d.siglaPartido)+'"><span class="candidate-result-party">'+escapeHtml(d.siglaPartido||'—')+'</span><span class="candidate-result-name">'+escapeHtml(d.nome||'Parlamentar')+'</span><small>'+escapeHtml(d.siglaUf||'UF não informada')+'</small></button>').join(''):'<div class="candidate-no-results">Nenhum parlamentar encontrado com esses filtros.</div>';
}
function updateComparisonScope(){
 document.querySelectorAll('.scope-option').forEach(button=>{const active=button.dataset.scope===state.comparisonScope;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
 $('compareState').disabled=state.comparisonScope!=='state';
 $('scopeHint').textContent=state.comparisonScope==='state'?(state.comparisonState?'Filtro regional: '+brazilStates.find(x=>x[0]===state.comparisonState)?.[1]+'; apenas deputados desta UF.':'Escolha uma UF para ativar o filtro regional.'):'Exibindo parlamentares de todos os estados.';
}
function populateComparisonFilters(){
 const all=state.allDeputies.length?state.allDeputies:state.deputies;
 $('compareState').innerHTML='<option value="">Escolha seu estado</option>'+brazilStates.map(([uf,name])=>'<option value="'+uf+'">'+name+'</option>').join('');
 try{state.comparisonState=localStorage.getItem('radar-comparison-state')||'';}catch(error){}
 $('compareState').value=state.comparisonState;
 ['A','B'].forEach(which=>{const parties=[...new Set(all.map(d=>d.siglaPartido).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));$('compareParty'+which).innerHTML='<option value="">Todos os partidos</option>'+parties.map(p=>'<option value="'+escapeHtml(p)+'">'+escapeHtml(p)+'</option>').join('');});
 const first=all.find(d=>/nikolas ferreira/i.test(d.nome||'')),second=all.find(d=>/kim kataguiri/i.test(d.nome||''));
 if(first&&second){setCandidate('A',first);setCandidate('B',second);}
 renderCandidateResults('A');renderCandidateResults('B');updateComparisonScope();
}
function initComparisonPickers(){
 ['A','B'].forEach(which=>{
  $('compareSearch'+which).addEventListener('input',()=>{$('compareDeputy'+which).value='';renderCandidateResults(which);});
  $('compareParty'+which).addEventListener('change',()=>{$('compareDeputy'+which).value='';renderCandidateResults(which);});
  $('compareSearch'+which).addEventListener('focus',()=>renderCandidateResults(which));
  $('compareResults'+which).addEventListener('click',event=>{const button=event.target.closest('[data-candidate-id]');if(button){const deputy=comparisonDirectory().find(d=>Number(d.id)===Number(button.dataset.candidateId));setCandidate(which,deputy);}});
  document.querySelector('[data-clear="'+which+'"]').addEventListener('click',()=>{$('compareDeputy'+which).value='';$('compareSearch'+which).value='';renderCandidateResults(which);});
 });
 document.querySelectorAll('.scope-option').forEach(button=>button.addEventListener('click',()=>{state.comparisonScope=button.dataset.scope;updateComparisonScope();renderCandidateResults('A');renderCandidateResults('B');try{localStorage.setItem('radar-comparison-scope',state.comparisonScope);}catch(error){}}));
 $('compareState').addEventListener('change',()=>{state.comparisonState=$('compareState').value;try{localStorage.setItem('radar-comparison-state',state.comparisonState);}catch(error){}renderCandidateResults('A');renderCandidateResults('B');updateComparisonScope();});
 try{state.comparisonScope=localStorage.getItem('radar-comparison-scope')||'national';}catch(error){}
 updateComparisonScope();
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
  const partyColor = partyColorFor(deputy.siglaPartido);
  return '<article class="comparison-person" style="--party-color:' + partyColor + '"><div class="comparison-person-head">'+(photo?'<img src="'+safeUrl(photo)+'" alt="" loading="lazy">':'')+'<div><strong>'+escapeHtml(deputy.nome)+'</strong><small>'+escapeHtml([deputy.siglaPartido,deputy.siglaUf].filter(Boolean).join(' · '))+'</small></div></div><div class="comparison-value">'+value+'</div><div class="comparison-caption">'+label+'</div></article>';
}
function renderComparisonChart(a,b,aValue,bValue,formatter,title){
 const max=Math.max(aValue,bValue,1),widthA=Math.max(aValue===0?0:2,aValue/max*100),widthB=Math.max(bValue===0?0:2,bValue/max*100),colorA=partyColorFor(a.siglaPartido),colorB=partyColorFor(b.siglaPartido);
 return '<div class="comparison-chart hud-chart"><div class="hud-chart-head"><div><span class="hud-kicker">COMPARATIVO · '+escapeHtml(title)+'</span><div class="comparison-chart-title">Indicador em análise</div></div><span class="hud-live">● DADOS CONSULTADOS</span></div>'+
 '<div class="chart-row hud-chart-row" style="--bar-color:'+colorA+'"><div class="chart-name">'+escapeHtml(a.nome)+' <small>'+escapeHtml(a.siglaPartido||'')+'</small></div><div class="chart-track"><div class="chart-bar" style="--bar-width:'+widthA+'%;width:'+widthA+'%"></div></div><div class="chart-number">'+formatter(aValue)+'</div></div>'+
 '<div class="chart-row hud-chart-row" style="--bar-color:'+colorB+'"><div class="chart-name">'+escapeHtml(b.nome)+' <small>'+escapeHtml(b.siglaPartido||'')+'</small></div><div class="chart-track"><div class="chart-bar" style="--bar-width:'+widthB+'%;width:'+widthB+'%"></div></div><div class="chart-number">'+formatter(bValue)+'</div></div><div class="hud-scale"><span>0</span><span>ESCALA RELATIVA AO MAIOR VALOR</span><span>100%</span></div></div>';
}
async function runComparison() {
  const idA=Number($('compareDeputyA').value),idB=Number($('compareDeputyB').value);
  const metric=$('compareMetric').value,year=Number($('compareYear').value);
  if(!idA||!idB||idA===idB){showToast('Selecione dois parlamentares diferentes.');return;}
  const directory=comparisonDirectory();
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
        renderComparisonChart(a,b,ra.total,rb.total,money,'Despesas declaradas em '+year)+
        '<div class="comparison-difference">'+(higher?'<strong>'+escapeHtml(higher.nome)+'</strong> apresenta '+money(difference)+' a mais em despesas registradas.':'Os dois parlamentares apresentam o mesmo total de despesas neste recorte.')+' A comparação considera os registros retornados pela API para '+year+'; valores podem sofrer atualização ou glosa. '+(!ra.complete||!rb.complete?'Atenção: pelo menos uma consulta foi interrompida antes do fim da paginação.':'')+'</div>';
    } else {
      const [ra,rb]=await Promise.all([getProposalStats(idA,year),getProposalStats(idB,year)]);
      $('comparisonResults').innerHTML='<div class="comparison-summary">'+
        comparisonPersonCard(a,ra.presented.toLocaleString('pt-BR'),'Proposições localizadas em '+year+(ra.complete?'':' · consulta parcial'),a.urlFoto)+
        comparisonPersonCard(b,rb.presented.toLocaleString('pt-BR'),'Proposições localizadas em '+year+(rb.complete?'':' · consulta parcial'),b.urlFoto)+'</div>'+
        renderComparisonChart(a,b,ra.presented,rb.presented,v=>v.toLocaleString('pt-BR'),'Proposições apresentadas em '+year)+
        '<div class="comparison-difference">Situação consultada individualmente em até 40 proposições por parlamentar: <strong>'+escapeHtml(a.nome)+': '+ra.approved+' com situação contendo “aprovad” entre '+ra.checked+' verificadas</strong>; <strong>'+escapeHtml(b.nome)+': '+rb.approved+' entre '+rb.checked+' verificadas</strong>. Isso é uma amostra de situação processual, não o total de projetos aprovados. '+(!ra.complete||!rb.complete?'A paginação de proposições ficou incompleta.':'')+'</div>'+
        '<details class="comparison-detail-list"><summary>Ver situações verificadas</summary><ul>'+ra.items.slice(0,12).map(x=>'<li>'+escapeHtml(x.proposal.siglaTipo+' '+x.proposal.numero+'/'+x.proposal.ano)+' — '+escapeHtml(x.status)+'</li>').join('')+
        rb.items.slice(0,12).map(x=>'<li>'+escapeHtml(x.proposal.siglaTipo+' '+x.proposal.numero+'/'+x.proposal.ano)+' — '+escapeHtml(x.status)+'</li>').join('')+'</ul></details>';
    }
  } catch(error) {
    $('comparisonResults').innerHTML='<div class="empty-state error-state">Não foi possível concluir a comparação. A API pode estar indisponível ou ter limitado a consulta. Tente novamente.</div>';
    showToast('Falha ao consultar os dados para comparação.');
  } finally {$('compareBtn').disabled=false;$('compareBtn').textContent='Comparar dados';}
}
const defaultPreferences = {theme:'dark',accent:'cyan',density:'auto',motion:true};
function readPreferences() {
  try {
    const stored=JSON.parse(localStorage.getItem('radar-preferences') || '{}');
    const legacyTheme=localStorage.getItem('radar-theme');
    return {...defaultPreferences,...stored,theme:stored.theme || (['dark','light'].includes(legacyTheme)?legacyTheme:defaultPreferences.theme)};
  } catch(error) { return {...defaultPreferences}; }
}
function savePreferences() {
  try {
    localStorage.setItem('radar-preferences',JSON.stringify(state.preferences));
    if(state.preferences.theme==='dark'||state.preferences.theme==='light')localStorage.setItem('radar-theme',state.preferences.theme);
  } catch(error) {}
}
state.preferences = readPreferences();
function applyTheme(mode) {
  const prefersDark=window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)').matches:false;
  const dark=mode==='dark'||(mode==='system'&&prefersDark);
  document.documentElement.dataset.theme=dark?'dark':'light';
  document.body.classList.toggle('dark-theme',dark);
  document.documentElement.style.colorScheme=dark?'dark':'light';
  updateThemeButton();
}
function applyPreferences() {
  const root=document.documentElement;
  root.dataset.accent=state.preferences.accent;
  root.dataset.density=state.preferences.density;
  root.dataset.motion=state.preferences.motion?'on':'off';
  applyTheme(state.preferences.theme);
  $('themeSelect').value=state.preferences.theme;
  $('accentSelect').value=state.preferences.accent;
  $('densitySelect').value=state.preferences.density;
  $('motionToggle').checked=state.preferences.motion;
}
function initTheme() {
  applyPreferences();
  $('themeToggle').addEventListener('click',()=>{
    const dark=document.documentElement.dataset.theme==='dark';
    state.preferences.theme=dark?'light':'dark';
    $('themeSelect').value=state.preferences.theme;
    savePreferences();applyTheme(state.preferences.theme);
  });
  $('themeSelect').addEventListener('change',event=>{state.preferences.theme=event.target.value;savePreferences();applyTheme(state.preferences.theme);});
  $('accentSelect').addEventListener('change',event=>{state.preferences.accent=event.target.value;savePreferences();applyPreferences();});
  $('densitySelect').addEventListener('change',event=>{state.preferences.density=event.target.value;savePreferences();applyPreferences();});
  $('motionToggle').addEventListener('change',event=>{state.preferences.motion=event.target.checked;savePreferences();applyPreferences();});
  if(window.matchMedia){window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{if(state.preferences.theme==='system')applyTheme('system');});}
}
function updateThemeButton() {
  const dark=document.documentElement.dataset.theme==='dark';
  $('themeToggle').innerHTML='<span class="theme-icon">'+(dark?'☀':'☾')+'</span><span class="theme-text">'+(dark?'Tema claro':'Tema escuro')+'</span>';
  $('themeToggle').setAttribute('aria-label',dark?'Ativar modo claro':'Ativar modo noturno');
}
function initNavigationDrawer() {
  const drawer=$('sideDrawer'),backdrop=$('drawerBackdrop'),toggle=$('sidebarToggle');
  const close=()=>{drawer.classList.remove('open');drawer.setAttribute('aria-hidden','true');backdrop.hidden=true;toggle.setAttribute('aria-expanded','false');document.body.classList.remove('drawer-open');};
  const open=()=>{drawer.classList.add('open');drawer.setAttribute('aria-hidden','false');backdrop.hidden=false;toggle.setAttribute('aria-expanded','true');document.body.classList.add('drawer-open');};
  toggle.addEventListener('click',()=>drawer.classList.contains('open')?close():open());
  $('drawerClose').addEventListener('click',close);backdrop.addEventListener('click',close);
  drawer.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',close));
  document.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
  document.querySelector('.appearance-settings').addEventListener('toggle',event=>{if(event.target.open){const closeOnOutside=click=>{if(!event.target.contains(click.target)){event.target.open=false;document.removeEventListener('click',closeOnOutside);}};setTimeout(()=>document.addEventListener('click',closeOnOutside),0);}});
}
$('compareMetric').addEventListener('change',()=>{$('compareYearLabel').textContent=$('compareMetric').value==='expenses'?'Ano da despesa':'Ano de apresentação';});
$('compareBtn').addEventListener('click',runComparison);

initTheme();
initNavigationDrawer();
initComparisonPickers();
populateYears();
loadDashboard().then(async()=>{
  populateComparisonFilters();
  try {
    const result=await fetchAllPages('deputados?ordem=ASC&ordenarPor=nome',12,100);
    state.allDeputies=result.rows;
    populateComparisonFilters();
    if(!result.complete) showToast('Lista de parlamentares carregada parcialmente.');
  } catch(error) {
    populateComparisonFilters();
    showToast('Comparador usando a lista inicial de parlamentares; lista completa indisponível.');
  }
});
