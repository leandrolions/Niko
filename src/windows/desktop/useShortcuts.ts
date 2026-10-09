import { useEffect } from "react";
import { useInterface } from "../../state/interface";
import { useConfig } from "../../state/settings";
import { usePomodoro } from "../../state/pomodoro";
import { useMedia } from "../../state/media";
import { useRoutine } from "../../state/routine";
import { playSound } from "../../bridge/sounds";
import { T } from "../../i18n/ptBR";
import { routeEnabled } from "../../utils/features";

function atFieldText(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
}

export const EVENT_NEW = "niko:novo";

export function useShortcuts() {
  useEffect(() => {
    const onPress = (e: KeyboardEvent) => {
      const ui = useInterface.getState();
      const cfg = useConfig.getState();
      const key = e.key.toLowerCase();

      if (e.ctrlKey && e.altKey) {
        if (e.code === "Space") {
          e.preventDefault();
          ui.openCapture(true);
          return;
        }
        if (key === "p") {
          e.preventDefault();
          usePomodoro.getState().toggle();
          void playSound("blip");
          return;
        }
        if (key === "m") {
          e.preventDefault();
          useMedia.getState().toggle();
          return;
        }
        if (key === "h") {
          e.preventDefault();
          cfg.set({ privacidade: !cfg.privacidade });
          return;
        }
        if (key === "n") {
          e.preventDefault();
          const visible = ui.sistemaAberto && !ui.sistemaMinimizado;
          ui.setSystem(visible ? { sistemaMinimizado: true } : { sistemaAberto: true, sistemaMinimizado: false });
          if (!visible) ui.focusSystem();
          return;
        }
      }

      if (!e.ctrlKey || e.altKey) return;

      if (key === "k") {
        e.preventDefault();
        ui.openSearch(!ui.buscaAberta);
        return;
      }
      if (key === "s") {
        e.preventDefault();
        ui.notify(T.geral.salvoAgora);
        return;
      }
      if (key === "b") {
        e.preventDefault();
        cfg.set({ barraRecolhida: !cfg.barraRecolhida });
        return;
      }
      if (/^[1-9]$/.test(e.key)) {
        const visible = cfg.barraLateral.filter((i) => i.visivel && routeEnabled(i.rota, cfg.funcoesDesligadas));
        const target = visible[Number(e.key) - 1];
        if (target) {
          e.preventDefault();
          ui.navigateTo(target.rota);
        }
        return;
      }
      if (key === "n" && !e.shiftKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(EVENT_NEW, { detail: ui.rota }));
        return;
      }
      if (key === "z" && !atFieldText(e.target) && ui.rota === "journal") {
        e.preventDefault();
        if (e.shiftKey) useRoutine.getState().redo();
        else useRoutine.getState().undo();
      }
    };
    window.addEventListener("keydown", onPress);
    return () => window.removeEventListener("keydown", onPress);
  }, []);
}
