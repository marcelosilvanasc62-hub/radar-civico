# Radar Cívico

Portal independente para consulta de informações legislativas públicas.

## Estrutura
- `index.html`: estrutura e navegação.
- `styles.css`: sistema visual editorial responsivo, temas escuro/claro.
- `app.js`: filtros, busca com debounce e integração com dados abertos da Câmara.

## Fontes
- Câmara dos Deputados: https://dadosabertos.camara.leg.br/swagger/api.html
- Senado Federal: https://www12.senado.leg.br/dados-abertos

## Notas técnicas
A API da Câmara limita listagens a 100 registros por requisição. O diretório usa paginação e filtros `siglaUf`, `nome` e `siglaPartido`. A aba Senado exibe a fonte oficial enquanto a integração automática do serviço é validada. As cores partidárias são identificadores visuais e não expressam avaliação.

## Agenda, notícias e emendas
- Agenda institucional: consulta eventos futuros pelo endpoint `GET /eventos` da API oficial da Câmara, com filtro por período.
- Alertas: usam a API de notificações do navegador e ficam programados localmente enquanto o navegador permanecer aberto. É necessário conceder permissão; o navegador/sistema pode limitar notificações em segundo plano.
- Notícias: leitura do RSS oficial da Agência Câmara (`https://www.camara.leg.br/noticias/rss/ultimas-noticias`). Se o navegador bloquear CORS, o portal oferece link direto para o feed.
- Emendas: o painel direciona para as consultas oficiais do Portal da Transparência. A API do Portal exige cadastro e token, por isso o site estático não armazena credenciais nem apresenta valores não verificados. No Portal, diferencie empenho, liquidação e pagamento; consulte o favorecido/localidade e os documentos de despesa.

## Fontes oficiais adicionais
- Agenda e eventos da Câmara: https://dadosabertos.camara.leg.br/swagger/api.html
- RSS Agência Câmara: https://www.camara.leg.br/noticias/rss
- Consulta de emendas: https://portaldatransparencia.gov.br/emendas/consulta
- Consulta por documentos de despesa: https://portaldatransparencia.gov.br/emendas/consulta-por-documento
- API pública Transferegov: https://api-publica.transferegov.gestao.gov.br/
