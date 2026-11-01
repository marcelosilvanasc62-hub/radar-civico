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
