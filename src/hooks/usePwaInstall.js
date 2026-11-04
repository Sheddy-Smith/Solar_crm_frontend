import { useEffect, useState } from 'react';
import {
  adoptEarlyInstallPrompt,
  getInstallState,
  promptInstall,
  subscribeInstallState,
} from '../lib/pwaInstall.js';

export function usePwaInstall() {
  const [state, setState] = useState(getInstallState);

  useEffect(() => {
    // Pull in the early-boot deferred prompt once (getInstallState is read-only
    // to avoid notify ↔ getInstallState recursion).
    adoptEarlyInstallPrompt();
    // Re-check on mount too (display-mode can change if the user launches
    // the installed app in a new tab context) and whenever the singleton
    // manager reports a change.
    setState(getInstallState());
    return subscribeInstallState(() => setState(getInstallState()));
  }, []);

  return { ...state, promptInstall };
}
