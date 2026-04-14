import { useCallback, useEffect, useState } from 'react';
import useSWR, { mutate } from 'swr';

import { stationFetcher, stationPoster } from 'utils/stationApi';

export function useMobileState(scopeKey, defaultValue) {
  const endpoint = scopeKey ? `/api/v1/mobile/state/${encodeURIComponent(scopeKey)}` : null;
  const { data, error, isLoading } = useSWR(endpoint, stationFetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });
  const [state, setLocalState] = useState(defaultValue);

  useEffect(() => {
    if (typeof data?.data?.state !== 'undefined' && data?.data?.state !== null) {
      setLocalState(data.data.state);
    }
  }, [data]);

  const persist = useCallback(
    async (nextState) => {
      if (!endpoint) return;
      await stationPoster(endpoint, { state: nextState });
      await mutate(endpoint, { data: { state: nextState } }, false);
    },
    [endpoint]
  );

  const setState = useCallback(
    (updater) => {
      setLocalState((prev) => {
        const base = typeof prev === 'undefined' ? defaultValue : prev;
        const next = typeof updater === 'function' ? updater(base) : updater;
        void persist(next);
        return next;
      });
    },
    [defaultValue, persist]
  );

  const setField = useCallback((field, value) => {
    setState((prev) => ({
      ...prev,
      [field]: value
    }));
  }, [setState]);

  const resetState = useCallback(() => {
    setState(defaultValue);
  }, [defaultValue, setState]);

  return {
    state,
    setState,
    setField,
    resetState,
    loading: isLoading,
    error
  };
}
