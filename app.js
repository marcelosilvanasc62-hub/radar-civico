const API = 'https://dadosabertos.camara.leg.br/api/v2';
const $ = (id) => document.getElementById(id);
const state = { deputies: [], allDeputies: [], proposals: [], votes: [], timeline: [], comparisonScope: 'national', comparisonState: '', preferences: {}, selectedCandidates: {}, candidateResults: {A:[],B:[]}, candidateRequest: {A:0,B:0} };
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
  if ($('workspaceViews')) $('workspaceViews').hidden = !visible;
  if (visible) window.scrollTo({top:0,behavior:'smooth'});
}
function renderProfileContact(detail, fallbackDeputy) {
  const status=detail?.ultimoStatus||{};
  const cabinet=status.gabinete||detail?.gabinete||{};
  const email=cabinet.email||status.email||detail?.email||'';
  const phone=cabinet.telefone||status.telefone||'';
  const fields=[
    ['Gabinete',cabinet.nome],['Prédio',cabinet.predio],['Anexo',cabinet.anexo],['Andar',cabinet.andar],['Sala',cabinet.sala],['Telefone',phone]
  ].filter(([,value])=>value!==undefined&&value!==null&&String(value).trim()!=='');
  const socialRaw=detail?.redesSociais||detail?.redeSocial||status.redesSociais||status.redeSocial||[];
  const socials=(Array.isArray(socialRaw)?socialRaw:[socialRaw]).map(item=>typeof item==='string'?item:(item?.url||item?.uri||item?.redeSocial||'')).filter(Boolean).map(url=>safeUrl(url,'')).filter(Boolean);
  const contact=$('profileContact');
  contact.innerHTML='<div class="contact-grid">'+fields.map(([label,value])=>'<div class="contact-field"><small>'+escapeHtml(label)+'</small><strong>'+escapeHtml(value)+'</strong></div>').join('')+'</div>'+
    (email?'<div class="contact-actions"><a class="contact-link" href="mailto:'+encodeURIComponent(email)+'?subject='+encodeURIComponent('Solicitação de Esclarecimento Cidadão - Radar Cívico')+'">Enviar e-mail ao gabinete</a><button type="button" class="contact-copy" data-copy-email="'+escapeHtml(email)+'">Copiar e-mail</button></div>':'<p class="amendment-empty">E-mail oficial não informado no cadastro retornado pela API.</p>')+
    (socials.length?'<div class="contact-socials">'+socials.map((url,index)=>'<a href="'+url+'" target="_blank" rel="noopener">Rede social '+(index+1)+' ↗</a>').join('')+'</div>':'<p class="contact-muted">Nenhuma rede social foi retornada no campo consultado da API.</p>')+
    '<p class="contact-muted">Dados exibidos conforme cadastro oficial consultado. Em caso de divergência, confirme no <a href="https://www.camara.leg.br/deputados/" target="_blank" rel="noopener">portal da Câmara</a>.</p>';
  contact.querySelector('[data-copy-email]')?.addEventListener('click',async event=>{
    const value=event.currentTarget.dataset.copyEmail;
    try{await navigator.clipboard.writeText(value);showToast('E-mail copiado.');}
    catch(error){showToast('Não foi possível copiar automaticamente: '+value);}
  });
}
function renderProfileExpenses(rows,complete) {
  const host=$('profileExpenses');
  if(!rows.length){host.innerHTML='<div class="amendment-empty">A API não retornou despesas para o recorte consultado.</div>';return;}
  const total=rows.reduce((sum,row)=>sum+Number(row.valorLiquido??row.valorDocumento??0),0);
  host.innerHTML='<div class="expense-summary"><span>VALOR LÍQUIDO SOMADO NA CONSULTA</span><strong>'+money(total)+'</strong><small>'+rows.length+' registros · '+(complete?'paginação concluída':'consulta parcial')+'</small></div>'+
   '<div class="amendment-table-wrap"><table class="amendment-table"><thead><tr><th>Data</th><th>Tipo de despesa</th><th>Fornecedor</th><th>Valor líquido</th><th>Documento</th></tr></thead><tbody>'+
   rows.slice(0,30).map(row=>'<tr><td>'+fmtDate(row.dataDocumento)+'</td><td>'+escapeHtml(row.tipoDespesa||'Não informado')+'</td><td>'+escapeHtml(row.nomeFornecedor||'Não informado')+'</td><td>'+money(row.valorLiquido??row.valorDocumento)+'</td><td>'+(row.urlDocumento?'<a href="'+safeUrl(row.urlDocumento)+'" target="_blank" rel="noopener">Abrir ↗</a>':'Não informado')+'</td></tr>').join('')+
   '</tbody></table></div>'+(rows.length>30?'<p class="contact-muted">Exibidos 30 de '+rows.length+' registros retornados.</p>':'');
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
  $('profileContact').innerHTML='<div class="amendment-empty">Consultando dados oficiais do gabinete…</div>';
  $('profileExpenses').innerHTML='<div class="amendment-empty">Consultando despesas registradas…</div>';
  const results = await Promise.allSettled([
    api('deputados/' + id),
    api('deputados/' + id + '/eventos?ordem=DESC&ordenarPor=dataHoraInicio&itens=20'),
    api('deputados/' + id + '/discursos?ordem=DESC&ordenarPor=dataHoraInicio&itens=20'),
    api('deputados/' + id + '/despesas?ordem=DESC&ordenarPor=ano&itens=100')
  ]);
  const detail=results[0].status==='fulfilled'?(results[0].value.dados||{}):{};
  renderProfileContact(detail,deputy);
  if(results[3].status==='fulfilled')renderProfileExpenses(results[3].value.dados||[],!(results[3].value.links||[]).some(link=>link.rel==='next'));
  else $('profileExpenses').innerHTML='<div class="amendment-empty">Não foi possível consultar despesas. Tente novamente mais tarde.</div>';
  const entries = [], types = ['evento','discurso','despesa'];
  results.slice(1).forEach((result,index) => {
    if (result.status === 'fulfilled') (result.value.dados || []).forEach(item => entries.push(normalizeTimeline(types[index],item)));
  });
  state.timeline = entries.sort((a,b) => b.timestamp - a.timestamp);
  renderTimeline();
  const failures = results.slice(1).filter(result => result.status === 'rejected').length;
  if (!entries.length) $('timelineList').innerHTML = '<div class="timeline-empty">' + (failures === 3 ? 'Não foi possível consultar os registros agora. Tente novamente mais tarde.' : 'A API não retornou registros para este perfil nas consultas realizadas.') + '</div>';
  if(results[0].status==='rejected')$('profileContact').innerHTML='<div class="amendment-empty">Não foi possível consultar o cadastro do gabinete. Consulte o perfil oficial da Câmara.</div>';
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
let mainSearchTimer,mainSearchToken=0;
async function searchMainDeputies(token=++mainSearchToken){
 const term=$('deputySearch').value.trim();
 if(term.length<2){renderDeputies(state.deputies);$('deputyFoot').textContent=state.deputies.length+' registros na amostra inicial';return;}
 $('deputyList').innerHTML='<div class="empty-state">Buscando na base oficial…</div>';
 try{
  const result=await api('deputados?nome='+encodeURIComponent(term)+'&ordem=ASC&ordenarPor=nome&itens=100');
  if(token!==mainSearchToken)return;
  const rows=result.dados||[];renderDeputies(rows);
  $('deputyFoot').textContent=rows.length+' resultado(s) retornados pela API para “'+term+'”'+(rows.length===100?' · refine a busca para localizar outros homônimos':'');
 }catch(error){if(token!==mainSearchToken)return;$('deputyList').innerHTML='<div class="empty-state error-state">Busca indisponível. Verifique a conexão e tente novamente.</div>';showToast('A API da Câmara não respondeu à busca.');}
}
$('deputySearch').addEventListener('input',()=>{const token=++mainSearchToken;clearTimeout(mainSearchTimer);mainSearchTimer=setTimeout(()=>searchMainDeputies(token),350);});
$('searchForm').addEventListener('submit',event=>{event.preventDefault();clearTimeout(mainSearchTimer);searchMainDeputies(++mainSearchToken);});
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
function setCandidate(which,deputy){
 if(!deputy||!deputy.id)return;
 const select=$('compareDeputy'+which),id=String(deputy.id);
 let option=[...select.options].find(item=>item.value===id);
 if(!option){option=document.createElement('option');option.value=id;select.appendChild(option);}
 option.textContent=deputy.nome||('Parlamentar '+id);option.selected=true;
 state.selectedCandidates[which]=deputy;
 $('compareSearch'+which).value=deputy.nome||'';
 $('compareParty'+which).value=deputy.siglaPartido||'';
 $('compareResults'+which).innerHTML='';
}
async function renderCandidateResults(which){
 const query=$('compareSearch'+which).value.trim(),party=$('compareParty'+which).value;
 const token=++state.candidateRequest[which];
 const local=(state.allDeputies.length?state.allDeputies:state.deputies);
 const filterRows=rows=>rows.filter(d=>(!party||d.siglaPartido===party)&&
  (state.comparisonScope!=='state'||!state.comparisonState||d.siglaUf===state.comparisonState)).slice(0,12);
 const paint=rows=>{
  const selected=$('compareDeputy'+which).value;
  $('compareResults'+which).innerHTML=rows.length?rows.map(d=>'<button type="button" class="candidate-result" role="option" aria-selected="'+(String(d.id)===selected)+'" data-candidate-id="'+Number(d.id)+'" data-picker="'+which+'" style="--party-color:'+partyColorFor(d.siglaPartido)+'"><span class="candidate-result-party">'+escapeHtml(d.siglaPartido||'—')+'</span><span class="candidate-result-name">'+escapeHtml(d.nome||'Parlamentar')+'</span><small>'+escapeHtml(d.siglaUf||'UF não informada')+'</small></button>').join(''):'<div class="candidate-no-results">Nenhum parlamentar encontrado com esses filtros.</div>';
 };
 if(query.length<2){state.candidateResults[which]=filterRows(local);paint(state.candidateResults[which]);return;}
 paint(filterRows(local.filter(d=>(d.nome||'').toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')))));
 $('compareResults'+which).insertAdjacentHTML('beforeend','<div class="candidate-no-results">Consultando a base oficial…</div>');
 try{
  const params=new URLSearchParams({nome:query,ordem:'ASC',ordenarPor:'nome',itens:'100'});
  if(state.comparisonScope==='state'&&state.comparisonState)params.set('siglaUf',state.comparisonState);
  const result=await api('deputados?'+params.toString());
  if(token!==state.candidateRequest[which])return;
  const rows=filterRows(result.dados||[]);
  state.candidateResults[which]=rows;
  paint(rows);
 }catch(error){
  if(token!==state.candidateRequest[which])return;
  const rows=filterRows(local.filter(d=>(d.nome||'').toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))));
  state.candidateResults[which]=rows;paint(rows);
  if(!rows.length)$('compareResults'+which).insertAdjacentHTML('beforeend','<small class="candidate-no-results">Busca remota indisponível; tente novamente.</small>');
 }
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
  let timer;
  $('compareSearch'+which).addEventListener('input',()=>{
   state.candidateRequest[which]++;
   $('compareDeputy'+which).value='';delete state.selectedCandidates[which];
   clearTimeout(timer);timer=setTimeout(()=>renderCandidateResults(which),300);
  });
  $('compareParty'+which).addEventListener('change',()=>{$('compareDeputy'+which).value='';delete state.selectedCandidates[which];renderCandidateResults(which);});
  $('compareSearch'+which).addEventListener('focus',()=>renderCandidateResults(which));
  $('compareResults'+which).addEventListener('click',event=>{
   const button=event.target.closest('[data-candidate-id]');
   if(button){const pool=[...state.candidateResults[which],...state.deputies,...state.allDeputies];const deputy=pool.find(d=>String(d.id)===button.dataset.candidateId);setCandidate(which,deputy);}
  });
  document.querySelector('[data-clear="'+which+'"]').addEventListener('click',()=>{
   $('compareDeputy'+which).value='';$('compareDeputy'+which).innerHTML='<option value="">Selecione um deputado</option>';
   $('compareSearch'+which).value='';delete state.selectedCandidates[which];renderCandidateResults(which);
  });
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
async function fetchAllPages(path,maxPages=100,pageSize=100) {
  const byId=new Map(); let page=1, complete=false;
  while(page<=maxPages){
    const separator=path.includes('?')?'&':'?';
    let result;
    try { result=await api(path+separator+'pagina='+page+'&itens='+pageSize); }
    catch(error) { if(byId.size)return {rows:[...byId.values()],complete:false,pages:page-1,error}; throw error; }
    const rows=result.dados||[];
    rows.forEach((row,index)=>byId.set(row.id??(page+'-'+index),row));
    const hasNext=Array.isArray(result.links)&&result.links.some(link=>link.rel==='next');
    if(!hasNext && rows.length<pageSize){complete=true;break;}
    if(!hasNext && rows.length===0){complete=true;break;}
    if(!hasNext && rows.length<pageSize){complete=true;break;}
    page++;
  }
  return {rows:[...byId.values()],complete,pages:Math.min(page,maxPages)};
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
  if(!idA||!idB||String($('compareDeputyA').value)===String($('compareDeputyB').value)){showToast('Selecione dois parlamentares diferentes.');return;}
  const directory=comparisonDirectory();
  const a=state.selectedCandidates.A||directory.find(d=>Number(d.id)===idA),b=state.selectedCandidates.B||directory.find(d=>Number(d.id)===idB);
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
const defaultPreferences = {theme:'dark',accent:'cyan',density:'auto',motion:true,homeLayout:'balanced'};
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
  root.dataset.homeLayout=state.preferences.homeLayout || 'balanced';
  $('homeLayoutSelect').value=state.preferences.homeLayout || 'balanced';
  $('themeSelect').value=state.preferences.theme;
  $('accentSelect').value=state.preferences.accent;
  $('densitySelect').value=state.preferences.density;
  $('motionToggle').checked=state.preferences.motion;
}

function initGroupedWorkspace(){
 const main=document.querySelector('main.shell');
 const hero=main.querySelector('.hero'),heading=main.querySelector('.section-heading'),stats=main.querySelector('.stats-grid');
 const content=main.querySelector('.content-grid'),votes=main.querySelector('.votes-panel'),compare=main.querySelector('.comparison-section'),method=main.querySelector('.methodology');
 const views=document.createElement('div');views.id='workspaceViews';views.className='workspace-views';
 const home=document.createElement('section');home.className='workspace-view active';home.dataset.view='home';
 const activity=document.createElement('section');activity.className='workspace-view';activity.dataset.view='activity';
 const analysis=document.createElement('section');analysis.className='workspace-view';analysis.dataset.view='analysis';
 [hero,heading,stats,method].forEach(node=>node&&home.appendChild(node));
 [content,votes].forEach(node=>node&&activity.appendChild(node));
 if(compare)analysis.appendChild(compare);
 views.append(home,activity,analysis);
 const profile=main.querySelector('#profileView');
 profile.insertAdjacentElement('afterend',views);
 const subnav=document.createElement('div');subnav.id='workspaceSubnav';subnav.className='workspace-subnav';subnav.setAttribute('aria-label','Seções da área');
 const links={home:[['Visão geral','#visao-geral']],activity:[['Parlamentares','#parlamentares'],['Proposições','#proposicoes'],['Votações','#votacoes']],analysis:[['Comparar parlamentares','#comparar']]};
 const setView=(name,anchor)=>{
  if(!profile.hidden){setDashboardVisible(true);}
  views.querySelectorAll('.workspace-view').forEach(v=>v.classList.toggle('active',v.dataset.view===name));
  document.querySelectorAll('.workspace-tab').forEach(b=>{const active=b.dataset.workspace===name;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  subnav.innerHTML=links[name].map((item,index)=>'<button type="button" class="workspace-subtab '+((anchor===item[1]||(!anchor&&index===0))?'active':'')+'" data-anchor="'+item[1]+'">'+item[0]+'</button>').join('');
  subnav.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{subnav.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));document.querySelector(b.dataset.anchor)?.scrollIntoView({behavior:'smooth',block:'start'});}));
  if(anchor)document.querySelector(anchor)?.scrollIntoView({behavior:'smooth',block:'start'});else window.scrollTo({top:0,behavior:'smooth'});
 };
 document.querySelector('.topbar').insertAdjacentElement('afterend',subnav);
 document.querySelectorAll('.workspace-tab').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.workspace)));
 setView('home');
}

function initTheme() {
  applyPreferences();
  $('themeToggle').addEventListener('click',()=>{
    const dark=document.documentElement.dataset.theme==='dark';
    state.preferences.theme=dark?'light':'dark';
    $('themeSelect').value=state.preferences.theme;
    savePreferences();applyTheme(state.preferences.theme);
  });
  $('homeLayoutSelect').addEventListener('change',event=>{state.preferences.homeLayout=event.target.value;savePreferences();applyPreferences();});
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

initGroupedWorkspace();
initTheme();
initNavigationDrawer();
initComparisonPickers();
populateYears();
loadDashboard().then(()=>{
 populateComparisonFilters();
 $('deputyFoot').textContent=state.deputies.length+' registros na amostra inicial · pesquise para consultar toda a base disponível';
});
