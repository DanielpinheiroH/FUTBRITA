-- Etapa 4: partidas reais, gols e resultado operacional integrado ao rodízio.
CREATE TYPE "StatusPartida" AS ENUM ('AGUARDANDO', 'EM_ANDAMENTO', 'FINALIZADA', 'CANCELADA');
CREATE TYPE "ResultadoPartida" AS ENUM ('TIME_1', 'TIME_2', 'EMPATE');

CREATE TABLE "partidas" (
  "id" UUID NOT NULL,
  "rodada_id" UUID NOT NULL,
  "ciclo_id" UUID NOT NULL,
  "numero" INTEGER NOT NULL,
  "status" "StatusPartida" NOT NULL DEFAULT 'AGUARDANDO',
  "time_permanente" "LadoEquipe" NOT NULL,
  "time_entrante" "LadoEquipe" NOT NULL,
  "placar_time_1" INTEGER NOT NULL DEFAULT 0,
  "placar_time_2" INTEGER NOT NULL DEFAULT 0,
  "resultado" "ResultadoPartida",
  "time_vencedor" "LadoEquipe",
  "time_que_saiu" "LadoEquipe",
  "iniciada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "encerrada_em" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "partidas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "partidas_times_distintos_check" CHECK ("time_permanente" <> "time_entrante"),
  CONSTRAINT "partidas_placar_nao_negativo_check" CHECK ("placar_time_1" >= 0 AND "placar_time_2" >= 0)
);
CREATE UNIQUE INDEX "partidas_ciclo_id_key" ON "partidas"("ciclo_id");
CREATE UNIQUE INDEX "partidas_rodada_id_numero_key" ON "partidas"("rodada_id", "numero");
CREATE INDEX "partidas_rodada_id_status_idx" ON "partidas"("rodada_id", "status");
CREATE UNIQUE INDEX "partidas_rodada_em_andamento_key" ON "partidas"("rodada_id") WHERE "status" = 'EM_ANDAMENTO';

CREATE TABLE "gols" (
  "id" UUID NOT NULL,
  "partida_id" UUID NOT NULL,
  "participacao_id" UUID NOT NULL,
  "lado" "LadoEquipe" NOT NULL,
  "ordem_evento" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "gols_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "gols_partida_id_ordem_evento_key" ON "gols"("partida_id", "ordem_evento");
CREATE INDEX "gols_partida_id_lado_idx" ON "gols"("partida_id", "lado");
CREATE INDEX "gols_participacao_id_idx" ON "gols"("participacao_id");

ALTER TABLE "partidas" ADD CONSTRAINT "partidas_rodada_id_fkey" FOREIGN KEY ("rodada_id") REFERENCES "rodadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "partidas" ADD CONSTRAINT "partidas_ciclo_id_fkey" FOREIGN KEY ("ciclo_id") REFERENCES "ciclos_rodada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gols" ADD CONSTRAINT "gols_partida_id_fkey" FOREIGN KEY ("partida_id") REFERENCES "partidas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gols" ADD CONSTRAINT "gols_participacao_id_fkey" FOREIGN KEY ("participacao_id") REFERENCES "participacoes_rodada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
