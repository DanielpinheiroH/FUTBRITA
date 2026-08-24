# Motor de partidas — Etapa 4

## Ciclo de vida

Uma partida nasce somente quando a rodada está `EM_ANDAMENTO`, o ciclo atual possui exatamente seis jogadores de linha válidos em cada lado e não existe outra partida em andamento. O início persiste o ciclo, o número sequencial e os papéis de time permanente e entrante. Na primeira partida, o Time 1 recebe deterministicamente a vantagem inicial do empate; nas seguintes, o lado que permaneceu no ciclo anterior conserva essa vantagem.

O estado operacional é `EM_ANDAMENTO` durante o registro de gols e `FINALIZADA` após o processamento completo do resultado. A próxima partida não começa automaticamente: a finalização gera o próximo ciclo e deixa a interface em “Próxima partida pronta”. Partidas finalizadas são imutáveis no fluxo normal.

## Gols e placar

Cada gol referencia a partida, uma participação escalada e o lado dessa escalação. Apenas jogador de linha presente, não retirado e pertencente a um dos dois times do ciclo pode marcar. Fila, goleiros, ausentes e jogadores do lado oposto são recusados.

Os eventos de `gols` são a fonte de verdade. Após criação, correção ou exclusão, o backend conta os eventos de cada lado e atualiza o placar-cache na mesma transação. Assim, placar e eventos não podem divergir. A ordem do evento preserva a cronologia; não há minuto ou cronômetro nesta etapa.

## Resultado esportivo e resultado operacional

- Placar do Time 1 maior: resultado `TIME_1`; Time 1 fica e Time 2 sai.
- Placar do Time 2 maior: resultado `TIME_2`; Time 2 fica e Time 1 sai.
- Placar igual, inclusive 0 × 0: resultado `EMPATE`; o time permanente fica e o time entrante sai.

Empate não é derrota. `time_vencedor` fica nulo, enquanto `time_que_saiu` registra somente a consequência operacional. A vantagem pertence à equipe persistida como permanente, nunca ao nome fixo do lado. No primeiro jogo, e somente como regra inicial determinística, Time 1 é permanente e Time 2 é entrante.

## Integração com o motor de rodízio

A Etapa 4 não duplica o algoritmo. A finalização calcula quem sai e chama `rotateRoundInTransaction`, a mesma aplicação transacional do motor puro de `rotation-engine.ts`. O motor recebe o time que permanece, o que sai, a fila e os contadores de permanência; então cria o novo ciclo, as escalações, a fila e os contadores atualizados.

Como o lado permanente não troca de número durante a composição, a próxima partida pode derivar os papéis do `time_que_saiu` anterior: o lado oposto é o permanente e o time recém-formado é o entrante.

## Transação, concorrência e rollback

Início, gols e finalização usam transações e advisory lock por rodada. O índice parcial `partidas_rodada_em_andamento_key` também impede duas partidas simultâneas. Na finalização, após adquirir o lock, o backend relê o status; um segundo request recebe `PARTIDA_JA_FINALIZADA` e não cria ciclo duplicado.

Na mesma transação de finalização são executados: validação, recontagem dos gols, persistência do resultado, fechamento da partida, aplicação do motor, criação do próximo ciclo, atualização de fila/permanências e auditoria. Qualquer falha provoca rollback completo. O teste real força um estado de escalação inconsistente e confirma que partida, fila e ciclos permanecem sem alteração parcial.

## Auditoria

São registrados os eventos `PARTIDA_INICIADA`, `GOL_CRIADO`, `GOL_CORRIGIDO`, `GOL_REMOVIDO`, `PARTIDA_FINALIZADA` e `RODIZIO_PARTIDA`, com identificadores e dados operacionais essenciais. A auditoria não é exposta na área pública.
