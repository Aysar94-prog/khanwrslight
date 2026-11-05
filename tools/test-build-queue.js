// Regression checks against the userscript's actual queue functions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../userscript/khanwars-toolkit.user.js'), 'utf8');
function extract(name) {
	const start = source.indexOf('\tfunction ' + name + '(');
	assert.ok(start >= 0, name);
	const end = source.indexOf('\n\t}', start);
	return source.slice(start, end + 3);
}
const state = { pendingBuilds: [], abBlocked: {} };
const el = { buildQueue: {} };
let items = [];
const context = vm.createContext({
	state, el, Date, QUEST_STEP_MIN: 101, QUEST_STEP_MAX: 135,
	LS: { startCommand: 'startCommand' }, lsSet() {}, abLog() {},
	SKILL_ITEM_ID: 150, SKILL_ID: 7,
	toInt: v => parseInt(v, 10) || 0,
	pendingCastleOk: p => !p.castleId || p.castleId === '342',
	queueInfo: () => ({ key: '11', items }),
	currentCastleInfo: () => ({ id: '342', name: 'test', key: '11' }),
	esc: String, queueItemLabel: String
});
vm.runInContext(['setStartCommand', 'rearmStartCommandIfEmpty', 'pendingBuildCounts', 'nextAction', 'renderBuildQueue'].map(extract).join('\n'), context);
const next = () => context.nextAction(items, '11');
const pending = id => ({ id, key: '11', castleId: '342' });

// Unresolved requests must not allow a later duplicate to jump ahead.
for (const sequence of [[7, 7, 7, 5], [5, 5, 5, 11]]) {
	items = sequence.slice();
	const submitted = [];
	while (items.length) {
		const action = next();
		assert.equal(action.id, items[0]);
		submitted.push(action.id);
		state.pendingBuilds = [pending(action.id)];
		if (items[1] === action.id) assert.equal(next(), null, 'duplicate must prevent later builds');
		context.renderBuildQueue();
		assert.equal((el.buildQueue.innerHTML.match(/ pending"/g) || []).length, 1);
		items.shift();
		state.pendingBuilds = [];
	}
	assert.deepEqual(submitted, sequence);
}

// Distinct buildings can still fill both slots, but cannot jump a duplicate.
items = [7, 5, 7, 11];
state.pendingBuilds = [pending(7)];
assert.equal(next().id, 5);
state.pendingBuilds.push(pending(5));
assert.equal(next(), null);
context.renderBuildQueue();
assert.equal((el.buildQueue.innerHTML.match(/ pending"/g) || []).length, 2);

// Pending records from another queue/castle must not mark or block this one.
items = [7, 7, 5];
state.pendingBuilds = [{ id: 7, key: 'other', castleId: '342' }, { id: 7, key: '11', castleId: '999' }];
assert.equal(next().id, 7);
context.renderBuildQueue();
assert.equal((el.buildQueue.innerHTML.match(/ pending"/g) || []).length, 0);

// A single active build still receives free finish, even while a duplicate waits.
let finished = false;
let slept = false;
Object.assign(context, {
	MAX_BUILD_QUEUE: 2, FREE_FINISH_SEC: 60,
	getBuildQueue: cb => cb({ items: [{ id: 123, remain: 30 }] }),
	finishHeadIfFree: (head, cb) => { finished = true; cb({ ok: true, remain: head.remain }); },
	abLog() {}, setAbStatus() {}, formatSeconds: String,
	sleepUntilHead: () => { slept = true; }
});
Object.assign(state, { pendingBuilds: [], ifBusy: false, autoBuild: true, instantFinish: true, open: false });
vm.runInContext(extract('checkBuildQueue'), context);
let freeSlot;
context.checkBuildQueue(value => { freeSlot = value; });
assert.equal(finished, true);
assert.equal(slept, false);
assert.equal(freeSlot, false, 'refresh real queue after free finish before sending');

// Exercise real acceptance handling: two copies of the same building are
// submitted before either process completes. A third waits for capacity.
let active = [];
let previewNext = null;
const sent = [];
Object.assign(context, {
	getBuildQueue: cb => cb({ items: active.slice() }),
	savePendingBuilds() {}, clearAutoBuildSleep() {}, renderAbStatus() {},
	getBuildingUpgradePreview: (id, cb) => cb({ nextLevel: previewNext }),
	withVerifiedCastle: (id, run) => run(() => {}),
	setTimeout: run => { run(); return 1; },
	consumeQueueItem: id => {
		const index = items.indexOf(id);
		assert.ok(index >= 0);
		items.splice(index, 1);
	},
	getBuildingLevelAjax: () => { throw new Error('acceptance must never read building levels'); }
});
vm.runInContext(['addPendingBuild', 'removePendingBuild', 'confirmAcceptedBuild', 'verifyPendingBuilds', 'handleBuildResult'].map(extract).join('\n'), context);
for (const sequence of [[7, 7, 7, 5], [5, 5, 5, 11]]) {
	items = sequence.slice();
	active = [];
	sent.length = 0;
	state.pendingBuilds = [];
	while (items.length) {
		let capacity;
		context.checkBuildQueue(value => { capacity = value; });
		if (!capacity) {
			assert.equal(active.length, 2);
			active.shift(); // Only now does the first queued construction finish.
			continue;
		}
		const id = next().id;
		const record = { ...pending(id), name: String(id), uncertain: true, targetLevel: sent.length + 3 };
		previewNext = record.targetLevel + 1;
		context.addPendingBuild(record);
		active.push({ id: 1000 + sent.length, remain: 180 });
		sent.push(id);
		context.handleBuildResult(id, null, { error: 0 }, record);
		assert.equal(state.pendingBuilds.length, 0);
		if (sent.length === 2) assert.equal(active.length, 2, 'both slots filled before any completion');
	}
	assert.deepEqual(sent, sequence);
}

// Preview target, not current building level or response acceptance, is proof.
const unknown = { ...pending(7), name: 'stable', uncertain: true, targetLevel: 3 };
previewNext = 4;
context.confirmAcceptedBuild(unknown, (ok, target) => {
	assert.equal(ok, true);
	assert.equal(target, 4);
});
previewNext = 3;
context.confirmAcceptedBuild(unknown, ok => assert.equal(ok, false));
previewNext = null;
context.confirmAcceptedBuild(unknown, ok => assert.equal(ok, false));
context.confirmAcceptedBuild({ ...unknown, targetLevel: null }, ok => assert.equal(ok, false));

// error:0 alone does not consume the item when the preview has not advanced.
items = [7, 7, 5];
previewNext = 3;
state.pendingBuilds = [];
const unconfirmed = { ...unknown };
context.addPendingBuild(unconfirmed);
context.handleBuildResult(7, null, { error: 0 }, unconfirmed);
assert.deepEqual(items, [7, 7, 5]);
assert.equal(state.pendingBuilds.length, 1);
// A fresh preview then confirms this one occurrence, before completion.
previewNext = 4;
context.verifyPendingBuilds(ok => assert.equal(ok, true));
assert.deepEqual(items, [7, 5]);
assert.equal(state.pendingBuilds.length, 0);

// Parser reads the offered upgrade target, including when the current level is stale.
vm.runInContext(extract('previewTargetLevel'), context);
assert.equal(context.previewTargetLevel({
 querySelector: () => ({ value: '\u0637\u0648\u0631 \u0627\u0644\u0649 \u0627\u0644\u0645\u0633\u062a\u0648\u0649 4' }),
 querySelectorAll: () => []
}), 4);
assert.equal(context.previewTargetLevel({
 querySelector: () => null,
 querySelectorAll: () => [{ textContent: '\u0627\u0644\u0645\u0633\u062a\u0648\u0649 \u0627\u0644\u062a\u0627\u0644\u064a: 5' }]
}), 5);
assert.equal(context.previewTargetLevel({
 querySelector: () => null,
 querySelectorAll: () => [{ textContent: '\u0627\u0644\u0645\u0633\u062a\u0648\u0649 \u0627\u0644\u062d\u0627\u0644\u064a: 2' }]
}), null);
// Full server queue: no attendBtn. The next target remains in a table header,
// matching the archived game markup. Honor selectors so this catches omission
// of th/td rather than returning a fake match for every selector.
function fullQueuePreview(target) {
 return {
  querySelector: () => null,
  querySelectorAll: selector => selector.split(',').map(s => s.trim()).includes('th')
   ? [{ textContent: '\u0627\u0644\u0645\u0633\u062a\u0648\u0649 \u0627\u0644\u062a\u0627\u0644\u064a: ' + target }]
   : []
 };
}
assert.equal(context.previewTargetLevel(fullQueuePreview(9)), 9);
// The second queued command is confirmed and consumed while both processes
// are still active; neither needs to complete or free a third slot.
items = [9, 9, 14];
active = [{ id: 101, remain: 360 }, { id: 102, remain: 580 }];
state.pendingBuilds = [{ ...pending(9), name: 'market', targetLevel: 8 }];
const previousPreviewReader = context.getBuildingUpgradePreview;
context.getBuildingUpgradePreview = (id, cb) => cb({ nextLevel: context.previewTargetLevel(fullQueuePreview(9)) });
context.verifyPendingBuilds(ok => assert.equal(ok, true), active);
assert.deepEqual(items, [9, 14]);
assert.equal(state.pendingBuilds.length, 0);
assert.equal(active.length, 2);
context.getBuildingUpgradePreview = previousPreviewReader;
// The preview sends only the read-only popup request, without a build request.
let requests = [];
Object.assign(context, {
 hasAjax: () => true,
 window: { Ajax: { Request: function (url, options) {
  requests.push({ url, options });
  options.onSuccess({ responseText: '<preview>' });
 } } },
 DOMParser: function () { this.parseFromString = () => ({
  querySelector: () => ({ value: '\u0627\u0644\u0645\u0633\u062a\u0648\u0649 4' }),
  querySelectorAll: () => []
 }); }
});
vm.runInContext(extract('getBuildingUpgradePreview'), context);
context.getBuildingUpgradePreview(5, result => assert.equal(result.nextLevel, 4));
assert.equal(requests.length, 1);
assert.equal(requests[0].url, 'ajax_buildings.php');
assert.equal(requests[0].options.parameters.b_id, 5);
assert.equal(requests[0].options.evalJS, false);
// Stale pre-send records must not permanently block the first queue entry.
items = [7, 7, 5];
previewNext = 4;
context.getBuildingUpgradePreview = (id, cb) => cb({ nextLevel: previewNext });
const stale = { ...pending(7), name: 'stable', targetLevel: 4, sentAt: Date.now() - 60000 };
state.pendingBuilds = [stale];
context.verifyPendingBuilds(ok => assert.equal(ok, true), []);
assert.deepEqual(items, [7, 7, 5], 'recovery must not consume an unsent command');
assert.equal(state.pendingBuilds.length, 0);
state.pendingBuilds = [{ ...stale, sentAt: Date.now() }];
context.verifyPendingBuilds(ok => assert.equal(ok, false), []);
assert.equal(state.pendingBuilds.length, 1, 'a fresh request must not be resent');
state.pendingBuilds = [{ ...stale }];
context.verifyPendingBuilds(ok => assert.equal(ok, false), [{ id: 9 }]);
assert.equal(state.pendingBuilds.length, 1, 'an active server process prevents recovery');

// Run the real first-command sender with no prior request: it must send once.
let firstSends = 0;
Object.assign(state, { pendingBuilds: [], autoBuildNextAt: 0, confirmBusy: false, autoBuildBusy: false });
Object.assign(context, {
 findBuilding: id => ({ id, name: 'stable' }),
 upgradeBuilding: id => { assert.equal(id, 7); firstSends++; }
});
active = [];
vm.runInContext(extract('sendNextBuild'), context);
context.sendNextBuild({ key: '11', items });
assert.equal(firstSends, 1);
assert.equal(state.pendingBuilds.length, 1);
assert.equal(state.pendingBuilds[0].targetLevel, 4);
// Start-command flag belongs to a run, survives failures, and never follows
// queue[0] as items are consumed.
const stored = new Map();
Object.assign(context, {
 LS: { autoBuild: 'autoBuild', startCommand: 'startCommand' },
 lsSet: (key, value) => stored.set(key, value),
 toast() {}, syncAutoBuildTimer() {}, autoBuildTick() {}
});
vm.runInContext(['setStartCommand', 'autoBuildSet'].map(extract).join('\n'), context);
state.autoBuild = false;
context.autoBuildSet(true);
assert.equal(state.startCommand, true);
assert.equal(stored.get('startCommand'), '1');
// The actual sender tags the first building without turning the flag off.
state.pendingBuilds = [];
state.autoBuildNextAt = 0;
context.sendNextBuild({ key: '11', items });
assert.equal(state.pendingBuilds[0].startCommand, true);
assert.equal(state.startCommand, true);
// Rejected/unchanged preview leaves the flag active.
previewNext = 4;
context.verifyPendingBuilds(ok => assert.equal(ok, false));
assert.equal(state.startCommand, true);
// Confirmation of the first upgrade, not construction completion, turns it off.
previewNext = 5;
context.verifyPendingBuilds(ok => assert.equal(ok, true));
assert.equal(state.startCommand, false);
assert.equal(stored.get('startCommand'), '0');
// A redundant start call and the next queue head do not re-arm it.
context.autoBuildSet(true);
assert.equal(state.startCommand, false);
state.autoBuildNextAt = 0;
context.sendNextBuild({ key: '11', items });
assert.equal(state.pendingBuilds[0].startCommand, false);
assert.equal(state.startCommand, false);
context.autoBuildSet(false);
assert.equal(state.startCommand, false);
context.autoBuildSet(true);
assert.equal(state.startCommand, true);
// Free finish must run even while an earlier build awaits preview confirmation.
finished = false;
active = [{ id: 900, remain: 30 }];
state.pendingBuilds = [{ ...unknown }];
Object.assign(state, { autoBuild: true, ifBusy: false, instantFinish: true });
context.checkBuildQueue(value => assert.equal(value, false));
assert.equal(finished, true, 'pending preview must not block free finish');
assert.equal(state.pendingBuilds.length, 1, 'free finish does not consume the local order');

// With free finish enabled, an empty local queue still checks the real queue,
// including after a reload when buildRunning starts false.
let realQueueChecks = 0;
let emptyQueueWaits = 0;
items = [];
Object.assign(context, {
 CASTLES_TTL: 300000,
 autoBuildSleepUntil: () => 0,
 checkBuildQueue: cb => { realQueueChecks++; cb(false); },
 sendNextBuild: () => { emptyQueueWaits++; }
});
Object.assign(state, {
 autoBuild: true, instantFinish: true, buildRunning: false,
 pendingBuilds: [], autoBuildBusy: false, confirmBusy: false,
 autoBuildNextAt: 0, ifCheckAt: 0, ifBusy: false,
 castles: [{ id: '342' }], castlesAt: Date.now()
});
vm.runInContext(['wakeOnLocalBuildCommands', 'autoBuildTick'].map(extract).join('\n'), context);
context.autoBuildTick();
assert.equal(realQueueChecks, 1);
assert.equal(emptyQueueWaits, 0);
state.instantFinish = false;
context.autoBuildTick();
assert.equal(realQueueChecks, 2);
assert.equal(emptyQueueWaits, 0);
// Emptying the local queue re-arms startup, without waiting for active server
// constructions; unresolved requests and a nonempty local queue must not.
state.startCommand = false;
items = [7];
context.rearmStartCommandIfEmpty({ key: '11', items });
assert.equal(state.startCommand, false);
items = [];
state.pendingBuilds = [{ ...unknown }];
context.rearmStartCommandIfEmpty({ key: '11', items });
assert.equal(state.startCommand, false);
state.pendingBuilds = [];
state.buildRunning = true;
context.rearmStartCommandIfEmpty({ key: '11', items });
assert.equal(state.startCommand, true);
assert.equal(stored.get('startCommand'), '1');
// The last confirmed local item also re-arms immediately.
items = [7];
state.startCommand = false;
previewNext = 5;
state.pendingBuilds = [{ ...unknown, targetLevel: 4 }];
context.verifyPendingBuilds(ok => assert.equal(ok, true));
assert.deepEqual(items, []);
assert.equal(state.startCommand, true);
// The next newly added command inherits the startup tag.
items = [7, 7];
state.autoBuildNextAt = 0;
active = [];
vm.runInContext(extract('sendNextBuild'), context);
context.sendNextBuild({ key: '11', items });
assert.equal(state.pendingBuilds[0].startCommand, true);
// Being stopped prevents automatic re-arming.
state.autoBuild = false;
state.pendingBuilds = [];
state.startCommand = false;
context.rearmStartCommandIfEmpty({ key: '11', items: [] });
assert.equal(state.startCommand, false);
// Empty local/server queues wait ten minutes, but local additions wake the
// existing loop before that deadline without a network request for detection.
let testNow = Date.now();
let sleepClears = 0;
Object.assign(context, {
 Date: { now: () => testNow }, EMPTY_QUEUE_RECHECK_MS: 600000,
 clearAutoBuildSleep: () => { sleepClears++; }
});
vm.runInContext(['abWait', 'sendNextBuild'].map(extract).join('\n'), context);
items = [];
Object.assign(state, { autoBuild: true, autoBuildNextAt: 0, ifCheckAt: 0,
 pendingBuilds: [], abEmptyWaiting: false, autoBuildBusy: false, confirmBusy: false });
context.wakeOnLocalBuildCommands();
context.sendNextBuild({ key: '11', items });
assert.equal(state.autoBuildNextAt, testNow + 600000);
realQueueChecks = 0;
testNow += 15000;
context.autoBuildTick();
assert.equal(realQueueChecks, 0, 'idle must not poll the server at 15 seconds');
testNow += 585001;
state.castlesAt = testNow;
context.autoBuildTick();
assert.equal(realQueueChecks, 1, 'the ten-minute fallback still checks the server');
// Re-enter idle, then add commands in the same page (no storage event).
state.autoBuildNextAt = testNow + 600000;
items = [7, 7];
const clearsBefore = sleepClears;
context.autoBuildTick();
assert.equal(realQueueChecks, 2, 'new local commands wake the pending wait');
assert.equal(state.autoBuildNextAt, 0);
assert.equal(state.abEmptyWaiting, false);
assert.equal(sleepClears, clearsBefore + 1);
// Regular resource/error backoff is not cancelled on every nonempty poll.
state.autoBuildNextAt = testNow + 90000;
context.autoBuildTick();
assert.equal(realQueueChecks, 2);
assert.equal(state.autoBuildNextAt, testNow + 90000);
// A remaining server construction keeps its free-finish deadline instead of
// entering the ten-minute idle wait just because the local queue is empty.
let scheduledHead = null;
items = [];
active = [{ id: 901, remain: 180 }];
Object.assign(state, { pendingBuilds: [], ifBusy: false, instantFinish: true });
context.sleepUntilHead = remain => { scheduledHead = remain; };
vm.runInContext(extract('checkBuildQueue'), context);
context.checkBuildQueue(value => assert.equal(value, false));
assert.equal(scheduledHead, 180);
console.log('Build queue, preview, startup, free-finish, and idle-wakeup regression checks passed.');
