import { useEffect } from "react";
import { NATIVE, releaseSystemInitial, timeIdleMs, versionApp } from "../../../desktop/desktop";
import { useConfig, type Settings } from "../../../state/settings";
import { useIsland } from "../../../state/island";
import { todayISO } from "../../../utils/dates";

const ABSENCE_MS = 30 * 60_000;
const ACTIVE_NOW_MS = 60_000;
const INTERVAL_CHECK_MS = 60_000;
const WAIT_BEFORE_GREET_MS = 700;

type LastGreeting = Settings["ultimaSaudacao"];

export function decideGreetingOnOpen(last: LastGreeting, today: string, version: string): { saudar: boolean; versaoNova?: string } {
  if (!last) return { saudar: true };
  if (last.versao !== version) return { saudar: true, versaoNova: version };
  return { saudar: last.dia !== today };
}

export function returnedAfterAbsence(gapMs: number, idleMs: number, alreadyAbsent: boolean): { ausente: boolean; voltou: boolean } {
  const absent = alreadyAbsent || gapMs >= ABSENCE_MS || idleMs >= ABSENCE_MS;
  return absent && idleMs <= ACTIVE_NOW_MS ? { ausente: false, voltou: true } : { ausente: absent, voltou: false };
}

function waitSettings(): Promise<void> {
  if (useConfig.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const disable = useConfig.persist.onFinishHydration(() => {
      disable();
      resolve();
    });
  });
}

export function useDailyGreeting(enabled: boolean) {
  useEffect(() => {
    let alive = true;
    let version = "";
    let absent = false;
    let lastCheck = Date.now();
    let wait: number | undefined;
    let interval: number | undefined;

    const greetNow = (versionNew?: string) => {
      useConfig.getState().set({ ultimaSaudacao: { dia: todayISO(), versao: version } });
      useIsland.getState().greet(versionNew);
    };

    const checkReturn = async () => {
      const now = Date.now();
      const gap = now - lastCheck;
      lastCheck = now;
      const idle = NATIVE ? (await timeIdleMs()) ?? 0 : 0;
      if (!alive) return;
      const r = returnedAfterAbsence(gap, idle, absent);
      absent = r.ausente;
      if (r.voltou && useConfig.getState().ultimaSaudacao?.dia !== todayISO()) greetNow();
    };

    void (async () => {
      await waitSettings();
      version = await versionApp();
      if (!alive) return;
      if (!enabled) {
        void releaseSystemInitial();
        return;
      }
      const decision = decideGreetingOnOpen(useConfig.getState().ultimaSaudacao, todayISO(), version);
      if (decision.saudar) wait = window.setTimeout(() => alive && greetNow(decision.versaoNova), WAIT_BEFORE_GREET_MS);
      else void releaseSystemInitial();
      interval = window.setInterval(() => void checkReturn(), INTERVAL_CHECK_MS);
    })();

    return () => {
      alive = false;
      window.clearTimeout(wait);
      window.clearInterval(interval);
    };
  }, [enabled]);
}
