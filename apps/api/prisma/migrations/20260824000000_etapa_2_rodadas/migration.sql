CREATE TYPE "StatusRodada" AS ENUM ('PLANEJADA', 'PREPARACAO', 'EM_ANDAMENTO', 'ENCERRADA', 'CANCELADA');
CREATE TYPE "TipoParticipacao" AS ENUM ('LINHA', 'GOLEIRO');
CREATE TYPE "StatusPagamento" AS ENUM ('PENDENTE', 'PAGO');

CREATE TABLE "rodadas" (
  "id" UUID NOT NULL,
  "data" DATE NOT NULL,
  "horario" TIME(0) NOT NULL,
  "status" "StatusRodada" NOT NULL DEFAULT 'PLANEJADA',
  "valor_jogador_linha" DECIMAL(10,2) NOT NULL DEFAULT 11.00,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "started_at" TIMESTAMP(3),
  "ended_at" TIMESTAMP(3),
  CONSTRAINT "rodadas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "participacoes_rodada" (
  "id" UUID NOT NULL,
  "rodada_id" UUID NOT NULL,
  "jogador_id" UUID NOT NULL,
  "tipo" "TipoParticipacao" NOT NULL,
  "confirmado" BOOLEAN NOT NULL DEFAULT true,
  "presente" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "participacoes_rodada_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pagamentos" (
  "id" UUID NOT NULL,
  "participacao_id" UUID NOT NULL,
  "valor" DECIMAL(10,2) NOT NULL,
  "status" "StatusPagamento" NOT NULL DEFAULT 'PENDENTE',
  "pago_em" TIMESTAMP(3),
  "updated_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rodadas_data_idx" ON "rodadas"("data");
CREATE INDEX "rodadas_status_idx" ON "rodadas"("status");
CREATE INDEX "participacoes_rodada_rodada_id_idx" ON "participacoes_rodada"("rodada_id");
CREATE UNIQUE INDEX "participacoes_rodada_rodada_id_jogador_id_key" ON "participacoes_rodada"("rodada_id", "jogador_id");
CREATE UNIQUE INDEX "pagamentos_participacao_id_key" ON "pagamentos"("participacao_id");
CREATE INDEX "pagamentos_status_idx" ON "pagamentos"("status");

ALTER TABLE "rodadas" ADD CONSTRAINT "rodadas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "participacoes_rodada" ADD CONSTRAINT "participacoes_rodada_rodada_id_fkey" FOREIGN KEY ("rodada_id") REFERENCES "rodadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "participacoes_rodada" ADD CONSTRAINT "participacoes_rodada_jogador_id_fkey" FOREIGN KEY ("jogador_id") REFERENCES "jogadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_participacao_id_fkey" FOREIGN KEY ("participacao_id") REFERENCES "participacoes_rodada"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
