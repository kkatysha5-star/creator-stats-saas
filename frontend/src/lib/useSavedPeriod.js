import { useEffect, useMemo, useState } from 'react';

const DEFAULT_PERIOD = {
  period: 'month',
  customFrom: '',
  customTo: '',
};

const PERIODS = new Set(['month', 'lastmonth', 'quarter', 'all', 'custom']);

function readSavedPeriod(key) {
  if (!key) return DEFAULT_PERIOD;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (!saved || !PERIODS.has(saved.period)) return DEFAULT_PERIOD;
    return {
      period: saved.period,
      customFrom: saved.customFrom || '',
      customTo: saved.customTo || '',
    };
  } catch {
    return DEFAULT_PERIOD;
  }
}

export function useSavedPeriod(auth) {
  const userId = auth?.user?.id || auth?.user?.email;
  const workspace = auth?.workspaces?.[0];
  const workspaceId = workspace?.id || workspace?.public_id;
  const storageKey = useMemo(
    () => userId && workspaceId ? `selectedPeriod:${userId}:${workspaceId}` : null,
    [userId, workspaceId]
  );

  const [periodState, setPeriodState] = useState(DEFAULT_PERIOD);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPeriodState(readSavedPeriod(storageKey));
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!ready || !storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(periodState));
  }, [periodState, ready, storageKey]);

  const setPeriod = (period) => {
    setPeriodState(prev => ({ ...prev, period }));
  };

  const setCustomRange = (customFrom, customTo) => {
    setPeriodState(prev => ({ ...prev, customFrom, customTo }));
  };

  const resetPeriod = () => {
    setPeriodState(DEFAULT_PERIOD);
  };

  return {
    period: periodState.period,
    customFrom: periodState.customFrom,
    customTo: periodState.customTo,
    setPeriod,
    setCustomRange,
    resetPeriod,
    ready,
  };
}
