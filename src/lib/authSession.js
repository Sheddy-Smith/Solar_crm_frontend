/**
 * Pure helpers for JWT refresh / logout event policy.
 * Kept free of browser APIs so Node regression tests can import them.
 */

/** Clear tokens only if the failed refresh is still the stored refresh. */
export function shouldClearTokensOnRefreshFailure(attemptedRefresh, currentRefresh) {
  if (!attemptedRefresh) return false;
  return currentRefresh === attemptedRefresh;
}

/** Apply rotated tokens only if login did not replace the refresh mid-flight. */
export function shouldApplyRefreshResult(attemptedRefresh, currentRefresh) {
  if (!attemptedRefresh) return false;
  return currentRefresh === attemptedRefresh;
}

/** Session wipe vs intentional logout — UI toasts only for session expiry. */
export function authSessionEventName(kind) {
  return kind === 'manual' ? 'auth:logout' : 'auth:session-expired';
}
