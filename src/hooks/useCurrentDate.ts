import { useState, useEffect, useMemo } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getTodayDateStr } from '../utils/formatters';

export interface CurrentDateInfo {
  todayStr: string;
  yesterdayStr: string;
  currentMonthKey: string;
  currentYear: number;
  currentMonthIndex: number; // 0-11
  currentDayOfMonth: number; // 1-31
}

/**
 * Provides real-time local date values that automatically update across midnight
 * rollovers, app foreground resumes, and component re-renders.
 */
export function useCurrentDate(trigger?: unknown): CurrentDateInfo {
  const [todayStr, setTodayStr] = useState<string>(() => getTodayDateStr());

  // Always read the live clock on render so opening a modal after midnight
  // is immediately accurate on the very first frame without waiting for an effect.
  const liveTodayStr = getTodayDateStr();
  if (liveTodayStr !== todayStr) {
    setTodayStr(liveTodayStr);
  }

  useEffect(() => {
    const syncDate = () => {
      const next = getTodayDateStr();
      setTodayStr((prev) => (prev !== next ? next : prev));
    };

    syncDate();

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        syncDate();
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);

    // Schedule a wakeup right after local midnight so an open screen rolls over live
    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      0,
      100
    );
    const msUntilMidnight = Math.max(1000, nextMidnight.getTime() - now.getTime());
    const midnightTimer = setTimeout(syncDate, msUntilMidnight);

    return () => {
      sub.remove();
      clearTimeout(midnightTimer);
    };
  }, [todayStr, trigger]);

  const effectiveTodayStr = liveTodayStr;

  return useMemo(() => {
    const [y, m, d] = effectiveTodayStr.split('-').map(Number);
    const yesterdayDate = new Date(y, m - 1, d);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = `${yesterdayDate.getFullYear()}-${String(
      yesterdayDate.getMonth() + 1
    ).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;
    const currentMonthKey = `${y}-${String(m).padStart(2, '0')}`;

    return {
      todayStr: effectiveTodayStr,
      yesterdayStr,
      currentMonthKey,
      currentYear: y,
      currentMonthIndex: m - 1,
      currentDayOfMonth: d,
    };
  }, [effectiveTodayStr]);
}
