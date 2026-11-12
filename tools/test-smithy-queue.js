// Acceptance and queue-consumption regressions using the actual userscript functions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../userscript/khanwars-toolkit.user.js'), 'utf8');
function extract(name) {
  const start = source.indexOf('\tfunction ' + name + '(');
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n\t}', start) + 3);
}
const storage = {};
Object.defineProperties(storage, {
  setItem: { value(key, value) { storage[key] = String(value); } },
  removeItem: { value(key) { delete storage[key]; } }
});
const state = {};
let info, level, sends, failCheck, failSend, released;
const ctx = vm.createContext({
  state, localStorage: storage, Date, JSON, Promise, String, Number, Math,
  SMITHY_QUEUE_KEY: 'smithUpgradeQueue', SMITHY_MAX_QUEUE: 2, SMITHY_MAX_LEVEL: 10,
  SMITHY_SYNC_TTL: 60000,
  toInt: value => parseInt(value, 10) || 0,
  readJsonLS: (key, fallback) => storage[key] ? JSON.parse(storage[key]) : fallback,
  renderSmithy() {}, smithyQueueSummary: () => '',
  ensureSmithyCastle: cb => cb({ id: '251' }),
  withVerifiedCastle: (id, run) => run(() => { released++; }),
  fetchSmithyQueueInfo: async () => { if (failCheck) throw new Error('offline'); return info; },
  fetch: async () => {
    sends++;
    if (failSend) throw new Error('timeout');
    info = { count: info.count + 1, at: Date.now(), items: [...info.items, { id: 'new' + sends, remain: 600 }] };
    return { ok: true, text: async () => '<html>upgrade page</html>' };
  },
  DOMParser: class {
    parseFromString(text) {
      return { querySelectorAll: () => [], body: { textContent: text.replace(/<[^>]+>/g, '') } };
    }
  }
});
vm.runInContext([
  'smithyDataKey', 'smithyReadData', 'smithyReadQueue', 'smithySentKey',
  'smithyPendingKey', 'smithyConsumeAccepted', 'smithyFinishAccepted', 'smithyItemKey', 'smithyReadSent',
  'smithyPruneSent', 'smithyResponseError', 'smithyVerifyPending', 'smithyAutoTick'
].map(extract).join('\n'), ctx);
ctx.smithyFetchLevel = async () => level;
const queue = () => JSON.parse(storage.smithUpgradeQueue);
function reset(items = [[4, 0], [4, 0], [1, 1]]) {
  Object.keys(storage).forEach(key => delete storage[key]);
  storage.smithUpgradeQueue = JSON.stringify(items);
  Object.assign(state, { smithyAuto: true, smithyBusy: false, smithyLoading: false, smithyRetryAt: 0 });
  info = { count: 0, items: [], at: Date.now() };
  storage['kw.smithy.data.251'] = JSON.stringify({ levels: { '4': { attack: 4, defense: 4 }, '1': { attack: 4, defense: 4 } }, types: { '4': 1, '1': 1 }, at: Date.now(), queueCount: 0 });
  level = 4; sends = 0; released = 0; failCheck = false; failSend = false;
}
function pending() {
  return { queue: queue(), index: 0, unitId: '4', category: 1, stat: 'defense', before: 4, processIds: ['old'] };
}
async function settle() {
  for (let n = 0; n < 5; n++) await new Promise(resolve => setImmediate(resolve));
}
(async () => {
  // Confirmed acceptance pulls exactly one duplicate and preserves a dashboard append.
  reset();
  const p = pending();
  storage.smithUpgradeQueue = JSON.stringify([...queue(), [2, 1]]);
  info = { count: 1, items: [{ id: 'new' }], at: Date.now() };
  await ctx.smithyVerifyPending({ id: '251' }, p);
  assert.deepEqual(queue(), [[4, 0], [1, 1], [2, 1]]);
  assert.equal(storage['kw.smithy.pending.251'], undefined);
  assert.equal(released, 1);

  // Same count, different process ID is acceptance; a count increase is unnecessary.
  reset();
  info = { count: 1, items: [{ id: 'replacement' }], at: Date.now() };
  await ctx.smithyVerifyPending({ id: '251' }, pending());
  assert.equal(queue().length, 2);

  // HTTP success / error:0 alone is insufficient. Unchanged real queue/level preserves the order.
  reset();
  await ctx.smithyVerifyPending({ id: '251' }, pending());
  assert.equal(queue().length, 3);
  assert.ok(storage['kw.smithy.pending.251']);
  ctx.smithyAutoTick(); await settle();
  assert.equal(sends, 0, 'unresolved acceptance blocks resending');

  // Resource rejection leaves the command and schedules a retry instead of skipping it.
  reset();
  await ctx.smithyVerifyPending({ id: '251' }, { ...pending(), rejection: 'الذهب غير كافي' });
  assert.equal(queue().length, 3);
  assert.equal(storage['kw.smithy.pending.251'], undefined);
  assert.ok(state.smithyRetryAt > Date.now());
  ctx.smithyAutoTick(); await settle(); assert.equal(sends, 0);
  assert.match(ctx.smithyResponseError('{"data":{"error":1,"error_txt":"الذهب غير كافي"}}'), /الذهب/);
  assert.match(ctx.smithyResponseError('<p>الخشب غير كافي</p>'), /الخشب/);
  assert.equal(ctx.smithyResponseError('{"data":{"error":0}}'), '');

  // Completed fast upgrade can be confirmed by a fresh matching level.
  reset(); level = 5;
  await ctx.smithyVerifyPending({ id: '251' }, pending());
  assert.equal(queue().length, 2);

  // Reordering consumes one accepted pair at its new position, preserving other commands.
  reset(); const changed = pending();
  storage.smithUpgradeQueue = JSON.stringify([[1, 1], [4, 0], [4, 0]]);
  level = 5;
  await ctx.smithyVerifyPending({ id: '251' }, changed);
  assert.deepEqual(queue(), [[1, 1], [4, 0]]);
  assert.equal(storage['kw.smithy.pending.251'], undefined);

  // Real reported failure: dashboard replaced the queue; accepted old pair is absent.
  // Recover a persisted v1.7.25 journal even offline, without deleting the new head.
  reset(); const replaced = { ...pending(), accepted: true };
  const replacement = [[11, 1], [11, 1], [11, 0], [19, 1], [9, 0]];
  storage.smithUpgradeQueue = JSON.stringify(replacement);
  storage['kw.smithy.pending.251'] = JSON.stringify(replaced);
  failCheck = true;
  await ctx.smithyVerifyPending({ id: '251' }, replaced);
  assert.deepEqual(queue(), replacement);
  assert.equal(storage['kw.smithy.pending.251'], undefined);
  assert.equal(sends, 0);
  assert.equal(state.smithyBusy, false);
  // Execution resumes after local reconciliation.
  failCheck = false;
  storage['kw.smithy.data.251'] = JSON.stringify({ levels: { '11': { attack: 1, defense: 1 } }, types: { '11': 2 }, at: Date.now(), queueCount: 0 });
  ctx.smithyAutoTick(); await settle();
  assert.equal(sends, 1);
  assert.deepEqual(queue(), replacement.slice(1));

  // Removing a duplicate manually must not consume an additional duplicate on confirmation.
  reset(); const removed = { ...pending(), accepted: true };
  storage.smithUpgradeQueue = JSON.stringify([[4, 0], [1, 1]]);
  await ctx.smithyVerifyPending({ id: '251' }, removed);
  assert.deepEqual(queue(), [[4, 0], [1, 1]]);
  assert.equal(storage['kw.smithy.pending.251'], undefined);

  // Unrelated removal, middle insertion, and appends cannot block an accepted pair.
  reset(); const edited = { ...pending(), accepted: true };
  storage.smithUpgradeQueue = JSON.stringify([[2, 0], [4, 0], [3, 1], [4, 0], [9, 1]]);
  await ctx.smithyVerifyPending({ id: '251' }, edited);
  assert.deepEqual(queue(), [[2, 0], [3, 1], [4, 0], [9, 1]]);

  // Full executor path sends once, confirms, then consumes; a duplicate can send next.
  reset(); ctx.smithyAutoTick(); await settle();
  assert.equal(sends, 1); assert.equal(queue().length, 2);
  // Restore fresh synchronized data between ticks as the production level sync does.
  const data = JSON.parse(storage['kw.smithy.data.251']); data.at = Date.now();
  storage['kw.smithy.data.251'] = JSON.stringify(data);
  ctx.smithyAutoTick(); await settle();
  assert.equal(sends, 2); assert.equal(queue().length, 1);
  assert.deepEqual(queue(), [[1, 1]], 'both duplicate upgrades consumed one at a time');

  // A lost response survives reload via the persisted journal without being resent.
  reset(); failSend = true;
  ctx.smithyAutoTick(); await settle();
  assert.equal(sends, 1); assert.equal(queue().length, 3);
  const journal = JSON.parse(storage['kw.smithy.pending.251']); journal.nextCheck = 0;
  storage['kw.smithy.pending.251'] = JSON.stringify(journal);
  ctx.smithyAutoTick(); await settle(); assert.equal(sends, 1);

  // Reindex legacy occurrence records when exactly one pair is removed.
  reset();
  storage['kw.smithy.sent.999'] = JSON.stringify({ '4:0:0': { old: 1 }, '4:0:1': { old: 2 }, '1:1:0': { old: 3 } });
  assert.equal(ctx.smithyConsumeAccepted(pending()), 'removed');
  assert.deepEqual(JSON.parse(storage['kw.smithy.sent.999']), { '4:0:0': { old: 2 }, '1:1:0': { old: 3 } });

  console.log('Smithy queue acceptance and consumption checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
