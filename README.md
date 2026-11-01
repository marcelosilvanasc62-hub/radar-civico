# Radar Cívico

Portal independente de transparência e acompanhamento da atividade parlamentar brasileira, começando pela Câmara dos Deputados.

## Versão atual — MVP visual

O repositório contém uma primeira interface web responsiva que consulta diretamente a API oficial de Dados Abertos da Câmara dos Deputados.

### O que já funciona
- Painel inicial com indicadores da amostra consultada.
- Listagem de parlamentares e busca por nome.
- Consulta de proposições recentes.
- Consulta de votações recentes.
- Links para as fontes oficiais.
- Atualização manual dos dados.
- Layout adaptado para computador e celular.

> Os indicadores exibem a quantidade de registros retornados em cada consulta, não totais oficiais da legislatura. Se a API estiver indisponível, o painel informa a falha em vez de inventar valores.

## Visualizar localmente

Não é necessário instalar dependências. Com Python 3 instalado, na pasta do projeto execute:

```bash
python3 -m http.server 8000
```

Abra no navegador: http://localhost:8000

No GitHub Codespaces, execute o mesmo comando no terminal e abra a porta 8000 na aba **Ports**.

## Publicação no GitHub Pages

O site é estático e pode ser publicado pelo GitHub Pages usando a branch `main` e a pasta raiz (`/`). No repositório, acesse **Settings → Pages**, selecione **Deploy from a branch**, escolha `main` e `/ (root)`, e salve.

Depois da publicação, o endereço padrão será:
https://marcelosilvanasc62-hub.github.io/radar-civico/

## Diagnóstico da API (M0)

O projeto também mantém o script de diagnóstico:

```bash
python3 diagnostico_camara.py --rapido
```

Para executar a bateria ampliada:

```bash
python3 diagnostico_camara.py
```

Os resultados são gravados em `m0_resultados/`.

## Fontes e princípios

- API oficial: https://dadosabertos.camara.leg.br/api/v2/
- Priorizar fontes oficiais e dados verificáveis.
- Começar com requisições somente de leitura.
- Respeitar limites da API, usar pausas e tentativas controladas.
- Separar fatos, indicadores calculados e interpretação editorial.
- Não publicar acusações ou conclusões sem evidência rastreável.

## Próximas etapas

1. Validar o MVP em diferentes dispositivos.
2. Revisar os endpoints e a cobertura dos dados.
3. Criar páginas de detalhe para parlamentares, proposições e votações.
4. Implementar histórico, filtros e metodologia dos indicadores.
5. Planejar backend e rotina de atualização sem sobrecarregar a API.


## Fontes oficiais e arquitetura de integração

A interface mantém a Câmara dos Deputados como fonte atualmente consultada. Integrações adicionais devem ser implementadas como adaptadores independentes, sem misturar campos de origem diferente:

| Fonte | Escopo documentado | Situação no projeto |
|---|---|---|
| [Câmara — Dados Abertos](https://dadosabertos.camara.leg.br/swagger/api.html) | Deputados, proposições, votações e CEAP | Em uso |
| [Senado — Dados Abertos](https://www12.senado.leg.br/dados-abertos) | Senadores, matérias, plenário, cotas e orçamento | Planejada |
| [Portal da Transparência — API](https://api.portaldatransparencia.gov.br/) | Emendas, documentos, despesas e favorecidos | Planejada |
| [TCU — Webservices](https://sites.tcu.gov.br/dados-abertos/webservices-tcu/) | Acórdãos, processos e dados de controle externo | Planejada |

### Contrato mínimo para cada integração

- Identificador estável da pessoa, órgão, proposição ou registro financeiro.
- Fonte e URL original do registro.
- Data/hora da consulta e período de referência.
- Unidade, moeda e definição do campo.
- Paginação, limites, erros e cobertura documentados.
- Regras de conciliação explícitas antes de cruzar bases.

O produto prioriza registros descritivos individuais e documentação de metodologia. Não publica notas, rankings, alinhamento partidário calculado, médias comparativas ou classificações de agentes políticos. Dados ausentes permanecem identificados como não disponíveis.
