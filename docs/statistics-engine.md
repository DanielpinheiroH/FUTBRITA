# Motor de estatísticas — Etapa 5

## Fonte de verdade

A arquitetura é integralmente derivada. Não existe contador manual nem tabela materializada: o serviço lê jogadores, participações, rodadas, partidas finalizadas, escalações dos ciclos e eventos de gol. Uma correção futura em gol ou resultado será refletida na consulta seguinte sem sincronização adicional.

As consultas usam três conjuntos carregados em paralelo — jogadores, partidas/escalações/gols e presenças — e calculam todos os jogadores em memória em uma passagem. Isso evita uma consulta por jogador e elimina N+1 nos rankings. Os filtros de rodada e temporada já são aplicados no PostgreSQL.

## Métricas

- Partida: uma partida `FINALIZADA` em cuja escalação de linha o jogador aparece.
- Vitória: escalação no lado persistido como vencedor.
- Derrota: escalação no lado oposto ao vencedor.
- Empate: qualquer jogador de ambos os lados quando `resultado = EMPATE`.
- Gol: um evento em `gols` atribuído à participação do jogador.
- Média: `gols / partidas`; zero quando não há partidas.
- Pontos: `3 × vitórias + empates`.
- Aproveitamento: `(3 × vitórias + empates) / (3 × partidas) × 100`; zero sem partidas.
- Presença: uma participação presente em rodada encerrada, deduplicada por rodada.
- Sequência atual: vitórias consecutivas no fim do período; empate ou derrota interrompe.
- Maior sequência: maior bloco de vitórias consecutivas no período filtrado.

Goleiros podem receber presença, mas não entram em partidas, vitórias, derrotas, empates, gols ou rankings baseados em escalação. O time entrante retirado após empate recebe empate, nunca derrota.

## Ordem temporal e filtros

Partidas são ordenadas por data da rodada e `numero`, com o identificador apenas como desempate estável. Os filtros suportados são:

- `roundId`: uma rodada específica;
- `season`: ano UTC da data da rodada;
- `scope=all`: todo o histórico.

O histórico de rodadas lista somente rodadas `ENCERRADA`. Jogadores inativos permanecem nos conjuntos históricos e rankings, embora continuem fora da listagem pública operacional de jogadores ativos.

## Rankings e desempates

- Artilharia: gols, média, vitórias, apelido/nome.
- Vitórias: vitórias, aproveitamento, partidas, apelido/nome.
- Aproveitamento: percentual, partidas, vitórias, apelido/nome.
- Jogos: partidas, vitórias, apelido/nome.
- Presenças: presenças, partidas, apelido/nome.
- Média de gols: média, gols, partidas, apelido/nome.
- Sequência: maior sequência, vitórias, aproveitamento, apelido/nome.

`minGames` é aceito pela API e tem valor padrão 1. A interface sempre exibe o número de partidas para contextualizar percentuais de amostras pequenas.

## Performance e índices

A migration `20260824030000_etapa_5_indices_estatisticas` acrescenta índices para `rodadas(status, data)`, `participacoes_rodada(jogador_id)` e `escalacoes_ciclo(participacao_id)`. Os índices anteriores já cobrem gols por participação, partidas por rodada/status e rodadas por data.

Não há cache para recalcular. A própria consulta é o recálculo idempotente: executá-la repetidamente sobre o mesmo histórico produz exatamente o mesmo resultado.
