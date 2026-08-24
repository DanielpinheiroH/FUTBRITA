CREATE TABLE "admins" (
  "id" UUID NOT NULL,
  "nome" VARCHAR(120) NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "senha_hash" VARCHAR(255) NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "jogadores" (
  "id" UUID NOT NULL,
  "nome" VARCHAR(120) NOT NULL,
  "apelido" VARCHAR(60) NOT NULL,
  "telefone" VARCHAR(13) NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "jogadores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");
CREATE INDEX "jogadores_nome_idx" ON "jogadores"("nome");
CREATE INDEX "jogadores_apelido_idx" ON "jogadores"("apelido");
