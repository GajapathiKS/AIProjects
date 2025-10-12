import { useCallback, useEffect, useState } from 'react';

export function useAsync<T>(factory: () => Promise<T>, deps: unknown[] = []) {
  const [value, setValue] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const run = useCallback(() => {
    setLoading(true);
    setError(null);
    return factory()
      .then(data => setValue(data))
      .catch(err => setError(err instanceof Error ? err : new Error(String(err))))
      .finally(() => setLoading(false));
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { value, loading, error, refresh: run };
}
