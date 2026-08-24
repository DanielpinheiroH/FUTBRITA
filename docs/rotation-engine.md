# Motor de rodízio — Etapa 3

## Escopo

O motor organiza exclusivamente jogadores de linha presentes. Goleiros, ausentes e participantes que saíram nunca são entradas válidas. `PLAYERS_PER_TEAM = 6` centraliza o tamanho das equipes.

O algoritmo puro fica em `apps/api/src/domain/rotation/rotation-engine.ts` e não depende de HTTP, React, Prisma, banco ou sessão.

## Formação inicial

Os elegíveis são ordenados por `ordem_chegada`. Com menos de 12, a formação é recusada. Os 12 primeiros são distribuídos assim:

- Time 1: 1, 3, 5, 7, 9 e 11;
- Time 2: 2, 4, 6, 8, 10 e 12;
- fila: posição 13 em diante, em ordem FIFO.

A formação cria o Ciclo 1, muda a rodada para `EM_ANDAMENTO` e fecha a correção da ordem original.

## Algoritmo de rodízio

`rotateTeams` recebe o time que fica, o time que sai, fila, estatísticas de permanência e próximo ciclo. A transformação:

1. consome até seis pessoas do início da fila;
2. calcula `faltantes = 6 - consumidos`;
3. escolhe os faltantes no time que saiu por menor contador, ciclo mais antigo da última permanência (`null` primeiro) e menor ordem original;
4. forma o novo time com promovidos e selecionados;
5. forma a nova fila com excedentes antigos e não selecionados do time que saiu, preservando a ordem;
6. atualiza a permanência somente dos selecionados.

Não existe aleatoriedade. O motor recusa times incompletos, duplicidades e jogadores presentes em mais de um grupo.

| Linhas | Fila inicial | Permanecem |
| ---: | ---: | ---: |
| 12 | 0 | 6 |
| 13 | 1 | 5 |
| 14 | 2 | 4 |
| 15 | 3 | 3 |
| 16 | 4 | 2 |
| 17 | 5 | 1 |
| 18 | 6 | 0 |
| 19 | 7 | 0; sobra 1 na fila |
| 20 | 8 | 0; sobram 2 na fila |

Os mesmos invariantes valem para 24, 30 ou mais jogadores.

## Persistência e concorrência

Cada ciclo é um snapshot relacional em `ciclos_rodada`, `escalacoes_ciclo` e `filas_ciclo`. `estados_rodada_jogo` aponta o ciclo atual e mantém versão; `permanencias_rodada` registra justiça acumulada; `auditorias_jogo` registra as ações.

Chegada, reordenação, formação, rodízio e saída usam transação serializável e `pg_advisory_xact_lock` por rodada. Índices únicos protegem ordem de chegada, ciclo, escalação e posição da fila.

## Chegada tardia e saída

Depois da formação, uma chegada elegível recebe a próxima ordem histórica e entra no fim da fila sem alterar os times. Uma saída remove a pessoa da fila. Se estiver em time entre ciclos, a primeira da fila ocupa a vaga; sem reposição, o estado fica incompleto e bloqueia novo rodízio.

## Limitações

“Time 1 sai” e “Time 2 sai” apenas criam o próximo ciclo. Não geram partida, placar, vitória, derrota, empate, gol ou estatística. Na Etapa 4, o resultado real substituirá esse gatilho provisório.

Execute `npm run test` para o motor puro e `npm run test:integration` para migrations, constraints e fluxo HTTP no PostgreSQL real.
