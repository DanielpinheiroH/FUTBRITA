-- Etapa 5: índices para estatísticas derivadas e filtros históricos.
CREATE INDEX "rodadas_status_data_idx" ON "rodadas"("status", "data");
CREATE INDEX "participacoes_rodada_jogador_id_idx" ON "participacoes_rodada"("jogador_id");
CREATE INDEX "escalacoes_ciclo_participacao_id_idx" ON "escalacoes_ciclo"("participacao_id");
