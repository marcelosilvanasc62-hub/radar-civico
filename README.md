# Radar Cívico

Portal de transparência e acompanhamento da atividade parlamentar, começando pela Câmara dos Deputados.

## Estado atual

O projeto está na etapa **M0 — diagnóstico da API de Dados Abertos da Câmara**. O objetivo é validar endpoints, paginação, estruturas JSON e metadados antes de definir a ingestão definitiva.

## Requisitos

- Python 3.9 ou superior
- Nenhuma dependência externa para o diagnóstico inicial

## Executar

```bash
python3 diagnostico_camara.py --rapido
```

Para executar a bateria ampliada:

```bash
python3 diagnostico_camara.py
```

Os resultados são gravados em `m0_resultados/`:
- `resumo.txt`
- `resultados.json`
- `amostras/*.json`

## Princípios

- Priorizar fontes oficiais e dados verificáveis.
- Começar com requisições somente de leitura.
- Respeitar limites da API, usar pausas e tentativas controladas.
- Separar fatos, indicadores calculados e interpretação editorial.
- Não publicar acusações ou conclusões sem evidência rastreável.

## Próximas etapas

1. Executar o M0 e revisar os resultados.
2. Documentar os endpoints aprovados.
3. Definir modelo de dados e rotina de atualização.
4. Implementar backend e interface do portal.
