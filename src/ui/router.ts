/**
 * Hash routing inside one page. The app stays a single document so the in-memory
 * scheduler and store survive navigation — a full page load would restart both.
 */
import { useEffect, useState } from 'preact/hooks';

function parse(hash: string): string[] {
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}

export function useRoute(): string[] {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const update = () => {
      setHash(location.hash);
      scrollTo({ top: 0 });
    };
    addEventListener('hashchange', update);
    return () => removeEventListener('hashchange', update);
  }, []);
  return parse(hash);
}

/** How many in-app screens we've pushed, so "back" never leaves the app. */
let depth = 0;

export function go(path: string): void {
  if (path === '/' || path === '') depth = 0;
  else depth++;
  location.hash = path;
}

export function back(): void {
  if (depth > 0) {
    depth--;
    history.back();
  } else {
    location.replace('#/');
  }
}
