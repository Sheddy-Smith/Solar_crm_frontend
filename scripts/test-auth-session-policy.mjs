/**
 * Regression checks for JWT refresh / logout event policy (BUG 03).
 * Run: node scripts/test-auth-session-policy.mjs
 */
import assert from 'node:assert/strict';
import {
  authSessionEventName,
  shouldApplyRefreshResult,
  shouldClearTokensOnRefreshFailure,
} from '../src/lib/authSession.js';

assert.equal(shouldClearTokensOnRefreshFailure('r1', 'r1'), true);
assert.equal(shouldClearTokensOnRefreshFailure('r1', 'r2'), false, 'new login must keep tokens');
assert.equal(shouldClearTokensOnRefreshFailure('r1', null), false);
assert.equal(shouldClearTokensOnRefreshFailure(null, 'r1'), false);

assert.equal(shouldApplyRefreshResult('r1', 'r1'), true);
assert.equal(shouldApplyRefreshResult('r1', 'r2'), false, 'stale refresh must not overwrite login');
assert.equal(shouldApplyRefreshResult(null, 'r1'), false);

assert.equal(authSessionEventName('manual'), 'auth:logout');
assert.equal(authSessionEventName('expired'), 'auth:session-expired');

console.log('auth-session-policy: OK');
