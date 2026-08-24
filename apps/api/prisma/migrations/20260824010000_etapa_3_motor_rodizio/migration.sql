-- Etapa 3: ordem de chegada, ciclos, times, fila, permanências e auditoria.
CREATE TYPE "LadoEquipe" AS ENUM ('TIME_1', 'TIME_2');

ALTER TABLE "participacoes_rodada"
  ADD COLUMN "ordem_chegada" INTEGER,
  ADD COLUMN "chegou_em" TIMESTAMP(3),
  ADD COLUMN "saiu_em" TIMESTAMP(3);
CREATE UNIQUE INDEX "participacoes_rodada_rodada_id_ordem_chegada_key"
  ON "participacoes_rodada"("rodada_id", "ordem_chegada");

CREATE TABLE "estados_rodada_jogo" (
  "id" UUID NOT NULL, "rodada_id" UUID NOT NULL, "ciclo_atual" INTEGER NOT NULL DEFAULT 1,
  "versao" INTEGER NOT NULL DEFAULT 1, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "estados_rodada_jogo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "estados_rodada_jogo_rodada_id_key" ON "estados_rodada_jogo"("rodada_id");

CREATE TABLE "ciclos_rodada" (
  "id" UUID NOT NULL, "rodada_id" UUID NOT NULL, "numero" INTEGER NOT NULL,
  "time_saiu" "LadoEquipe", "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ciclos_rodada_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ciclos_rodada_rodada_id_numero_key" ON "ciclos_rodada"("rodada_id", "numero");
CREATE INDEX "ciclos_rodada_rodada_id_idx" ON "ciclos_rodada"("rodada_id");

CREATE TABLE "escalacoes_ciclo" (
  "id" UUID NOT NULL, "ciclo_id" UUID NOT NULL, "participacao_id" UUID NOT NULL,
  "lado" "LadoEquipe" NOT NULL, "permaneceu" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "escalacoes_ciclo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "escalacoes_ciclo_ciclo_id_participacao_id_key" ON "escalacoes_ciclo"("ciclo_id", "participacao_id");
CREATE INDEX "escalacoes_ciclo_ciclo_id_lado_idx" ON "escalacoes_ciclo"("ciclo_id", "lado");

CREATE TABLE "filas_ciclo" (
  "id" UUID NOT NULL, "ciclo_id" UUID NOT NULL, "participacao_id" UUID NOT NULL, "posicao" INTEGER NOT NULL,
  CONSTRAINT "filas_ciclo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "filas_ciclo_ciclo_id_participacao_id_key" ON "filas_ciclo"("ciclo_id", "participacao_id");
CREATE UNIQUE INDEX "filas_ciclo_ciclo_id_posicao_key" ON "filas_ciclo"("ciclo_id", "posicao");

CREATE TABLE "permanencias_rodada" (
  "id" UUID NOT NULL, "rodada_id" UUID NOT NULL, "participacao_id" UUID NOT NULL,
  "quantidade" INTEGER NOT NULL DEFAULT 0, "ultima_permanencia_ciclo" INTEGER,
  CONSTRAINT "permanencias_rodada_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "permanencias_rodada_rodada_id_participacao_id_key" ON "permanencias_rodada"("rodada_id", "participacao_id");

CREATE TABLE "auditorias_jogo" (
  "id" UUID NOT NULL, "rodada_id" UUID NOT NULL, "admin_id" UUID NOT NULL,
  "acao" VARCHAR(40) NOT NULL, "detalhes" JSONB, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auditorias_jogo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "auditorias_jogo_rodada_id_created_at_idx" ON "auditorias_jogo"("rodada_id", "created_at");

ALTER TABLE "estados_rodada_jogo" ADD CONSTRAINT "estados_rodada_jogo_rodada_id_fkey" FOREIGN KEY ("rodada_id") REFERENCES "rodadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ciclos_rodada" ADD CONSTRAINT "ciclos_rodada_rodada_id_fkey" FOREIGN KEY ("rodada_id") REFERENCES "rodadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "escalacoes_ciclo" ADD CONSTRAINT "escalacoes_ciclo_ciclo_id_fkey" FOREIGN KEY ("ciclo_id") REFERENCES "ciclos_rodada"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "escalacoes_ciclo" ADD CONSTRAINT "escalacoes_ciclo_participacao_id_fkey" FOREIGN KEY ("participacao_id") REFERENCES "participacoes_rodada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "filas_ciclo" ADD CONSTRAINT "filas_ciclo_ciclo_id_fkey" FOREIGN KEY ("ciclo_id") REFERENCES "ciclos_rodada"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "filas_ciclo" ADD CONSTRAINT "filas_ciclo_participacao_id_fkey" FOREIGN KEY ("participacao_id") REFERENCES "participacoes_rodada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "permanencias_rodada" ADD CONSTRAINT "permanencias_rodada_rodada_id_fkey" FOREIGN KEY ("rodada_id") REFERENCES "rodadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "permanencias_rodada" ADD CONSTRAINT "permanencias_rodada_participacao_id_fkey" FOREIGN KEY ("participacao_id") REFERENCES "participacoes_rodada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "auditorias_jogo" ADD CONSTRAINT "auditorias_jogo_rodada_id_fkey" FOREIGN KEY ("rodada_id") REFERENCES "rodadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auditorias_jogo" ADD CONSTRAINT "auditorias_jogo_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
