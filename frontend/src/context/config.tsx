import { useQuery } from "@tanstack/react-query";
import React, { createContext, useContext, useMemo } from "react";

import { apiFetch } from "@/src/api/client";
import { useTheme } from "@/src/theme";

export type Thresholds = { yellow: number; green: number };
export type AppConfig = { labels: Record<string, string>; thresholds: Thresholds };

// Textos padrão dos dashboards (editáveis no painel de Parametrização)
export const DEFAULT_LABELS: Record<string, string> = {
  title_painel: "Painel de Performance",
  title_progresso: "Progresso da Meta de Vendas",
  label_meta_mes: "META DE VENDAS DO MÊS",
  label_meta_dia: "Meta do dia",
  pct_faturado: "Faturado",
  pct_previsionado: "Previsionado",
  pct_gap: "Gap falta (%)",
  kpi_faturado: "Faturado",
  kpi_previsionado: "Previsionado",
  kpi_gap_valor: "Gap (falta) R$",
  kpi_falta_meta: "Falta para a meta",
  section_ordenar: "Ordenar clientes",
  section_cidade: "Filtrar por cidade",
};

// Rótulos amigáveis dos campos na tela de Parametrização
export const LABEL_META: { key: string; grupo: string; nome: string }[] = [
  { key: "title_painel", grupo: "Cabeçalho", nome: "Título do painel" },
  { key: "title_progresso", grupo: "Progresso", nome: "Título do progresso" },
  { key: "label_meta_mes", grupo: "Progresso", nome: "Rótulo meta do mês" },
  { key: "label_meta_dia", grupo: "Progresso", nome: "Rótulo meta do dia" },
  { key: "pct_faturado", grupo: "Cartões de %", nome: "% Faturado" },
  { key: "pct_previsionado", grupo: "Cartões de %", nome: "% Previsionado" },
  { key: "pct_gap", grupo: "Cartões de %", nome: "% Gap" },
  { key: "kpi_faturado", grupo: "KPIs", nome: "KPI Faturado" },
  { key: "kpi_previsionado", grupo: "KPIs", nome: "KPI Previsionado" },
  { key: "kpi_gap_valor", grupo: "KPIs", nome: "KPI Gap R$" },
  { key: "kpi_falta_meta", grupo: "KPIs", nome: "KPI Falta para a meta" },
  { key: "section_ordenar", grupo: "Seções", nome: "Seção Ordenar" },
  { key: "section_cidade", grupo: "Seções", nome: "Seção Cidade" },
];

const DEFAULTS: AppConfig = { labels: {}, thresholds: { yellow: 0.76, green: 1.0 } };

const Ctx = createContext<AppConfig>(DEFAULTS);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const { data } = useQuery({
    queryKey: ["app-config"],
    queryFn: () => apiFetch<AppConfig>("/config", { auth: false }),
    staleTime: 60_000,
  });

  const value = useMemo<AppConfig>(
    () => ({
      labels: data?.labels ?? {},
      thresholds: { ...DEFAULTS.thresholds, ...(data?.thresholds ?? {}) },
    }),
    [data],
  );

  return React.createElement(Ctx.Provider, { value }, children);
}

export function useConfig(): AppConfig {
  return useContext(Ctx);
}

// Retorna o texto configurado ou o padrão
export function useLabels() {
  const { labels } = useConfig();
  return (key: string) => labels[key] || DEFAULT_LABELS[key] || key;
}

// Cor pela regra de ritmo (limiares configuráveis)
export function usePaceTone() {
  const { thresholds } = useConfig();
  const { colors } = useTheme();
  return (ritmo: number | null | undefined, hasMeta = true): string => {
    if (!hasMeta) return colors.borderStrong;
    const r = ritmo ?? 0;
    return r >= thresholds.green ? colors.success : r >= thresholds.yellow ? colors.warning : colors.error;
  };
}

export function usePaceToneKey() {
  const { thresholds } = useConfig();
  return (ritmo: number | null | undefined): "success" | "warning" | "error" => {
    const r = ritmo ?? 0;
    return r >= thresholds.green ? "success" : r >= thresholds.yellow ? "warning" : "error";
  };
}
