import { useEffect, useState } from 'react';
import { getInstallState, promptInstall, subscribeInstallState } from '../lib/pwaInstall.js';

export function usePwaInstall() {
  const [state, setState] = useState(getInstallState);

  useEffect(() => {
    // Re-check on mount too (display-mode can change if the user launches
    // the installed app in a new tab context) and whenever the singleton
    // manager reports a change.
    setState(getInstallState());
    return subscribeInstallState(() => setState(getInstallState()));
  }, []);

  return { ...state, promptInstall };
}
