import { useEffect } from "react";
import { claudeCode, listenClaudeCode, type EventClaude } from "../../../bridge/claudeCode";
import { frontCoversAIsland, frontAtScreenFull, notifyWindows } from "../../../desktop/desktop";
import { useClaudeCode } from "../../../state/claudeCode";
import { noticeEnabled, useIsland } from "../../../state/island";
import { useConfig } from "../../../state/settings";
import { playSound } from "../../../bridge/sounds";
import { T } from "../../../i18n/ptBR";
import { BRAND_TOOL, nameTool } from "./tools";

const TOLERANCE_MS = 1500;

function tabEnabled() {
  const { ilha: island } = useConfig.getState();
  return island.ativa && island.blocos.claude;
}

async function notifyIfHidden(body: string) {
  const cfg = useConfig.getState();
  if (!cfg.notificarClaude || cfg.naoPerturbe || !noticeEnabled("codigo")) return;
  const island = useIsland.getState();
  if (island.estado === "expandida" && island.aba === "claude") return;
  if (island.estado !== "escondida" && !(await frontCoversAIsland())) return;
  await notifyWindows(T.app.nome, body);
}

function returnOnTerminal(requestId: string) {
  useClaudeCode.getState().removeRequest(requestId);
  void claudeCode.decidir(requestId, "terminal").catch(() => undefined);
}

export function closeSession(id: string) {
  for (const p of useClaudeCode.getState().pedidos) if (p.sessao === id) returnOnTerminal(p.pedidoId);
  useClaudeCode.getState().close(id);
}

export function returnPendingOnTerminal() {
  for (const p of useClaudeCode.getState().pedidos) returnOnTerminal(p.pedidoId);
}

function react(e: EventClaude) {
  const state = useClaudeCode.getState();
  const session = state.sessoes[e.sessao];
  const project = session?.projeto ?? "";
  const tool = session?.ferramenta ?? e.ferramenta ?? "claude";
  const nameValue = nameTool(tool);
  const brand = BRAND_TOOL[tool];
  const silence = useConfig.getState().naoPerturbe || !noticeEnabled("codigo");
  const island = useIsland.getState();
  switch (e.evento) {
    case "PermissionRequest": {
      const requestId = e.pedidoId;
      if (!requestId) return;
      if (!tabEnabled()) {
        returnOnTerminal(requestId);
        return;
      }
      void frontAtScreenFull().then((full) => {
        if (full) {
          returnOnTerminal(requestId);
          return;
        }
        if (!useClaudeCode.getState().pedidos.some((p) => p.pedidoId === requestId)) return;
        useClaudeCode.getState().focus(e.sessao);
        void playSound("approval", "avisos");
        void notifyIfHidden(T.ilha.claude.notificacao.permissao(nameValue, project));
        const islandNow = useIsland.getState();
        if (islandNow.estado === "escondida") islandNow.setState("compacta");
      });
      return;
    }
    case "Stop":
      if (silence || !tabEnabled()) return;
      state.focus(e.sessao);
      void playSound("finish", "avisos");
      void notifyIfHidden(T.ilha.claude.notificacao.terminou(nameValue, project));
      if (island.estado !== "expandida") island.revelar({ texto: T.ilha.claude.terminouAviso(nameValue, project), tipo: "sucesso", marca: brand, aba: "claude" }, 7000);
      return;
    case "StopFailure":
      if (silence || !tabEnabled()) return;
      void playSound("error", "avisos");
      void notifyIfHidden(T.ilha.claude.notificacao.erro(nameValue, project));
      island.revelar({ texto: T.ilha.claude.erroAviso(nameValue, project), tipo: "alerta", marca: brand, aba: "claude" }, 6000);
      return;
    case "NikoPedidoEncerrado": {
      const reason = e.dados.motivo;
      if (!tabEnabled() || (reason !== "expirou" && reason !== "cancelado")) return;
      island.revelar({ texto: T.ilha.claude.pedidoEncerrado[reason], tipo: "alerta", marca: brand, aba: "claude" }, 6000);
      return;
    }
    case "Notification":
      if (silence || !tabEnabled()) return;
      if (session?.estado === "esperando") {
        void playSound("question", "avisos");
        island.revelar({ texto: T.ilha.claude.esperandoAviso(nameValue, project), tipo: "info", marca: brand, aba: "claude" }, 6000);
      } else if (session?.estado === "limite") {
        void playSound("rate", "avisos");
        island.revelar({ texto: T.ilha.claude.limiteAviso(nameValue, project), tipo: "alerta", marca: brand, aba: "claude" }, 6000);
      }
      return;
    default:
      return;
  }
}

function markInstalled(installed: boolean) {
  const cfg = useConfig.getState();
  if (cfg.claudeInstalado !== installed) cfg.set({ claudeInstalado: installed });
}

export function useClaudeCodeLifecycle(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    claudeCode
      .instalacao()
      .then((e) => markInstalled(e.instalado || e.parcial || e.desatualizado))
      .catch(() => undefined);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      useClaudeCode.getState().setConnected(false);
      return;
    }
    let connectedAt = Date.now();
    return listenClaudeCode(
      (e) => {
        if (e.sessao) markInstalled(true);
        useClaudeCode.getState().apply(e);
        if (Date.parse(e.recebidoEm) >= connectedAt - TOLERANCE_MS) react(e);
      },
      (connected) => {
        if (connected) connectedAt = Date.now();
        useClaudeCode.getState().setConnected(connected);
      },
    );
  }, [enabled]);
}
