// ==UserScript==
// @name         KhanWars Toolkit — الإرساليات والمباني والقلاع
// @namespace    khanwrslight
// @version      1.7.14
// @description  إدارة الإرساليات والمباني والحداد والقلاع والأمير عبر طلبات خلفية دون التنقل بين الصفحات.
// @author       khanwrslight
// @match        https://*.game.khanwars.ae/*
// @match        https://*.game.khanwars.com/*
// @run-at       document-idle
// @grant        none
// @noframes
// ==/UserScript==

/* KhanWars Toolkit
 * ------------------------------------------------------------------
 * يعمل داخل سياق الصفحة (@grant none) حتى يستخدم window.Ajax.Request
 * الخاص باللعبة. كل الدوال معزولة داخل IIFE، ويُعرَّض فقط window.KW.
 *
 * واجهة الاستخدام من Console:
 *   KW.getMarches(function (r) { console.log(r); });
 *   KW.getMarchInfo(353064, function (i) { console.log(i); });
 *   KW.getBuildings(function (b) { console.log(b); });
 *   KW.buildQueue();                 // اقرأ طابور البناء (khanBuildQueues) لهذه القلعة
 *   KW.buildQueueLive(function (q) { console.log(q); });   // جدول البناء الحقيقي (ajax_bottomBar)
 *   KW.instantFinishQueue(function (r) { console.log(r); }); // إنهاء فوري مجاني إن تبقّى ≤60ث
 *   KW.checkQueueNow(function (freeSlot) { console.log(freeSlot); });
 *   KW.autoBuildStart(); KW.autoBuildStop();
 *   KW.autoBuildStatus();            // includes verifyMode:'strict' + pending[]
 *   KW.pendingBuilds();              // ترقيات أُرسلت وتنتظر تأكيد المستوى
 *   KW.buildingLevel(1, cb);         // { level, name } من ajax_buildings.php
 *   KW.quests(cb);                   // المهام الأربعة + isClaimable
 *   KW.claimQuests(cb);              // استلام المهام الجاهزة فقط
 *   KW.getCastles(function (c) { console.log(c); });
 *   KW.switchCastle(342);   // تبديل بالسيرفر بدون مغادرة الصفحة
 *   KW.cycleCastles();      // زيارة كل القلاع مرة واحدة ثم العودة
 *   KW.province.status();   // حالة مهام المدينة (الأمير)
 *   KW.province.check(cb);  // فحص مهام المدينة (قراءة فقط)
 *   KW.province.attend(cb); // إرسال الأمير لأول مهمة متاحة
 *   KW.upgrade(4, function (res) { console.log(res); });
 *   KW.open(); KW.close(); KW.toggle();
 * ------------------------------------------------------------------
 */
(function () {
	'use strict';

	if (window.__KW_TOOLKIT_LOADED__) return;
	window.__KW_TOOLKIT_LOADED__ = true;

	var VERSION = '1.7.14';

	/* ============================================================
	 * 1) Helpers (منقولة من analysis/*.js)
	 * ============================================================ */

	function hasAjax() {
		return !!(window.Ajax && typeof window.Ajax.Request === 'function');
	}

	function toInt(v, def) {
		var n = parseInt(v, 10);
		return isNaN(n) ? (def == null ? null : def) : n;
	}

	function formatSeconds(sec) {
		sec = Math.max(0, Math.floor(Number(sec) || 0));
		var h = Math.floor(sec / 3600);
		var m = Math.floor((sec % 3600) / 60);
		var s = sec % 60;
		function pad(n) { return (n < 10 ? '0' : '') + n; }
		return pad(h) + ':' + pad(m) + ':' + pad(s);
	}

	function parseTimeToSeconds(str) {
		if (!str) return 0;
		var parts = String(str).trim().split(':');
		var s = 0, m = 1;
		for (var i = parts.length - 1; i >= 0; i--) {
			s += (parseInt(parts[i], 10) || 0) * m;
			m *= 60;
		}
		return s;
	}

	/* تحويل نص «ستظهر المهمة التالية خلال ~28m» إلى ميلي ثانية.
	 * يدعم: "28m", "5s", "1h", "1h 30m", "28m 30s", "2d", إلخ. */
	function parseWaitMs(text) {
		text = String(text || '').trim().toLowerCase();
		if (!text) return 0;
		var total = 0, found = false;
		var re = /(\d+)\s*(minutes?|mins?|min|m|hours?|hrs?|hr|h|seconds?|secs?|sec|s|days?|d|دقيقة|دقائق|ساعة|ساعات|ثانية|ثواني|يوم)/gi;
		var m;
		while ((m = re.exec(text)) !== null) {
			var n = parseInt(m[1], 10);
			var u = m[2].toLowerCase();
			if (u === 'd' || u === 'day' || u === 'days' || u === 'يوم') total += n * 86400000;
			else if (u === 'h' || u === 'hr' || u === 'hrs' || u === 'hour' || u === 'hours' || u === 'ساعة' || u === 'ساعات') total += n * 3600000;
			else if (u === 'm' || u === 'min' || u === 'mins' || u === 'minute' || u === 'minutes' || u === 'دقيقة' || u === 'دقائق') total += n * 60000;
			else if (u === 's' || u === 'sec' || u === 'secs' || u === 'second' || u === 'seconds' || u === 'ثانية' || u === 'ثواني') total += n * 1000;
			found = true;
		}
		if (found) return total;
		/* احتياط: رقم مفرد → اعتباره دقائق (مطابق لشكل "28m" عند فقدان الوحدة) */
		var bare = text.match(/^(\d+)$/);
		if (bare) return parseInt(bare[1], 10) * 60000;
		return 0;
	}

	function fmtNum(n) {
		if (n == null || isNaN(n)) return '—';
		try { return Number(n).toLocaleString('en-US'); } catch (e) { return String(n); }
	}

	function marchTypeMap() {
		return {
			'هجوم': 'attack',
			'جمع الفائض': 'gather',
			'التجسس': 'spy',
			'تحويل': 'transfer',
			'دعم': 'support',
			'استوطن': 'settle',
			'دورية': 'patrol'
		};
	}

	function normalizeMarchName(value) {
		return String(value || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
	}

	function currentMarchPlayer(doc) {
		var root = doc || document;
		var el = root.querySelector && root.querySelector('a.username, .username span, .username');
		return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : null;
	}

	function marchSideOwner(el) {
		if (!el) return null;
		var link = el.querySelector ? el.querySelector('a') : null;
		var title = link ? (link.getAttribute('title') || '') : '';
		var match = title.match(/header=\[\s*([^\[\]]+?)\s*(?:\(|\])/i);
		if (match) return match[1].trim();
		var dataOwner = link && (link.getAttribute('data-player') || link.getAttribute('data-owner'));
		return dataOwner ? dataOwner.trim() : null;
	}

	function marchCastleLabel(el) {
		if (!el) return null;
		var text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
		if (text) return text;
		var link = el.querySelector ? el.querySelector('a') : null;
		if (link && link.textContent.trim()) return link.textContent.replace(/\s+/g, ' ').trim();
		var title = link ? (link.getAttribute('title') || '') : '';
		var match = title.match(/header=\[\s*([^\]]+?)\s*\]/i);
		return match ? match[1].trim() : null;
	}

	function marchDirectionFromRow(row, fallback) {
		var classes = String(row && row.className || '');
		if (/(^|\s)incoming(\s|$)/i.test(classes)) return 'incoming';
		if (/(^|\s)outgoing(\s|$)/i.test(classes)) return 'outgoing';
		return fallback === 'incoming' || fallback === 'outgoing' ? fallback : 'unknown';
	}

	function marchSideIsOurs(el, sideText, owner, currentPlayer) {
		var me = normalizeMarchName(currentPlayer);
		if (owner && me && normalizeMarchName(owner) === me) return true;
		var raw = String(sideText || '') + ' ' + String(el && el.textContent || '') + ' ' + String((el && el.querySelector && el.querySelector('a') && el.querySelector('a').getAttribute('title')) || '');
		var coord = raw.match(/\(?([0-9]{1,4}:[0-9]{1,4})\)?/);
		if (coord && state && Array.isArray(state.castles)) {
			for (var i = 0; i < state.castles.length; i++) {
				if (state.castles[i].coords && String(state.castles[i].coords) === coord[1]) return true;
			}
		}
		var side = normalizeMarchName(sideText);
		if (side && state && Array.isArray(state.castles)) {
			for (var j = 0; j < state.castles.length; j++) {
				var castleName = normalizeMarchName(state.castles[j].name);
				if (castleName && (side === castleName || side.indexOf(castleName) !== -1 || castleName.indexOf(side) !== -1)) return true;
			}
		}
		return false;
	}

	function marchParticipants(fromEl, toEl, from, to, currentPlayer, type, directionHint) {
		var fromOwner = marchSideOwner(fromEl);
		var toOwner = marchSideOwner(toEl);
		var ownFrom = marchSideIsOurs(fromEl, from, fromOwner, currentPlayer);
		var ownTo = marchSideIsOurs(toEl, to, toOwner, currentPlayer);
		var incoming = directionHint === 'incoming' || (directionHint === 'all' && ownTo && !ownFrom);
		var outgoing = directionHint === 'outgoing' || (directionHint === 'all' && ownFrom && !ownTo);
		var sender = null, receiver = null, targetCastle = null, routeFrom = from, routeTo = to;
		if (incoming) {
			/* The AJAX row class is authoritative: game markup labels the
			   displayed sides in the opposite order for incoming marches. */
			sender = toOwner;
			receiver = fromOwner || currentPlayer;
			targetCastle = from;
			routeFrom = to;
			routeTo = from;
		} else if (outgoing) {
			sender = fromOwner || currentPlayer;
			receiver = toOwner;
			targetCastle = to;
			routeFrom = from;
			routeTo = to;
		}
		return {
			fromOwner: fromOwner,
			toOwner: toOwner,
			sender: sender,
			receiver: receiver,
			targetCastle: targetCastle,
			routeFrom: routeFrom,
			routeTo: routeTo,
			direction: incoming ? 'incoming' : (outgoing ? 'outgoing' : 'unknown'),
			incomingAttack: type === 'attack' && incoming
		};
	}

	/* نفس معادلة اللعبة: updateProgressBar(el, timeNeeded, timeLeft) */
	function computeProgress(timeLeft, timeTotal) {
		var total = toInt(timeTotal);
		var left = toInt(timeLeft);
		if (!total || total <= 0 || left == null) return null;
		var pct = 100 * (1 - left / total);
		if (pct < 1) pct = 1;
		if (pct > 100) pct = 100;
		return Math.round(pct * 10) / 10;
	}

	function extractDateTime(text, label) {
		if (!text) return null;
		var idx = text.indexOf(label);
		if (idx === -1) return null;
		var rest = text.slice(idx + label.length);
		var m = rest.match(/[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}/);
		return m ? m[0] : null;
	}

	/* --- info.php: السكان + الحمولة + وقت الوصول/العودة + الوقت الكلي --- */
	function fetchMarchInfo(marchId, callback) {
		if (!hasAjax()) { callback({ error: 'no-ajax' }); return; }
		new window.Ajax.Request('info.php', {
			evalJS: false,
			method: 'post',
			parameters: { what: 'pohod', posted_id: marchId },
			onSuccess: function (response) {
				var raw = response.responseText || '';
				var out = {
					population: null, cargo: null, cargoText: null,
					arrivalTime: null, returnTime: null, totalTime: null
				};
				try {
					var doc = new DOMParser().parseFromString(raw, 'text/html');
					var popEl = doc.getElementById('population');
					if (popEl) out.population = toInt(popEl.textContent.replace(/[^\d]/g, ''));

					var cargoEl = doc.getElementById('cargo');
					if (cargoEl) {
						out.cargoText = cargoEl.textContent.replace(/\s+/g, ' ').trim();
						out.cargo = toInt(cargoEl.textContent.replace(/[^\d]/g, ''));
					}

					var col = doc.querySelector('.pohod-info-column-info');
					if (col) {
						var items = col.querySelectorAll('li');
						for (var i = 0; i < items.length; i++) {
							var txt = items[i].textContent || '';
							if (!out.arrivalTime && txt.indexOf('ستصل') !== -1) out.arrivalTime = extractDateTime(txt, 'ستصل');
							if (!out.returnTime && txt.indexOf('ستعود') !== -1) out.returnTime = extractDateTime(txt, 'ستعود');
						}
					}
					/* updateProgressBar('barMarchProgress_marchInfo', <total>, timeLeft) */
					var tm = raw.match(/barMarchProgress_marchInfo'[^0-9]*([0-9]+)/);
					if (tm) out.totalTime = toInt(tm[1]);
				} catch (e) {
					out.error = e.message;
				}
				callback(out);
			},
			onFailure: function (response) {
				callback({ error: 'http-' + response.status });
			}
		});
	}

	function enrichMarches(marches, done) {
		if (!marches || !marches.length) { if (done) done(); return; }
		var remaining = marches.length;
		marches.forEach(function (m) {
			fetchMarchInfo(m.id, function (info) {
				m.population = info.population;
				m.cargo = info.cargo;
				m.cargoText = info.cargoText;
				m.arrivalTime = info.arrivalTime;
				m.returnTime = info.returnTime;
				if ((m.marchTime == null) && info.totalTime != null) m.marchTime = info.totalTime;
				m.marchTimeFormatted = (m.marchTime != null) ? formatSeconds(m.marchTime) : null;
				if (m.progress == null) m.progress = computeProgress(m.timeRemaining, m.marchTime);
				if (info.error) m.infoError = info.error;
				remaining--;
				if (remaining === 0 && done) done();
			});
		});
	}

	/* --- تحويل رد ajax_marches.php --- */
	function parseLoadContent(payload, directionHint) {
		var doc = new DOMParser().parseFromString(payload.body || '', 'text/html');
		var data = payload.data || {};
		var timers = data.timers || {};
		var marchTimes = data.marchTimes || {};

		/* Parse only the AJAX response; do not inspect the currently rendered page. */
		var currentPlayer = currentMarchPlayer(doc);

		var marches = [];
		Object.keys(timers).forEach(function (id) {
			var fromEl = doc.getElementById('marchesCastleFrom_' + id);
			var toEl = doc.getElementById('marchesCastleTo_' + id);
			var from = marchCastleLabel(fromEl);
			var to = marchCastleLabel(toEl);

			var row = fromEl || toEl;
			if (row) {
				for (var i = 0; i < 6 && row && row.parentElement; i++) {
					row = row.parentElement;
					if (row.querySelector && row.querySelector('a[name^="marchTypes_"]')) break;
				}
			}
			var typeLabel = null, type = null;
			if (row) {
				var a = row.querySelector('a[name^="marchTypes_"]');
				if (a) {
					typeLabel = a.textContent.trim();
					type = marchTypeMap()[typeLabel] || null;
				}
			}
			var marchDirection = marchDirectionFromRow(row, directionHint);
			var people = marchParticipants(fromEl, toEl, from, to, currentPlayer, type, marchDirection);

			var left = toInt(timers[id], 0);
			marches.push({
				id: id,
				type: type,
				typeLabel: typeLabel,
				from: from,
				to: to,
				timeRemaining: left,
				timeFormatted: formatSeconds(left),
				marchTime: marchTimes[id] != null ? toInt(marchTimes[id]) : null,
				marchTimeFormatted: marchTimes[id] != null ? formatSeconds(toInt(marchTimes[id])) : null,
				sender: people.sender,
				receiver: people.receiver,
				targetCastle: people.targetCastle,
				from: people.routeFrom,
				to: people.routeTo,
				direction: people.direction,
				incomingAttack: people.incomingAttack,
				incomingAttackKey: people.incomingAttack ? ('march-attack-' + id) : null,
				population: null,
				cargo: null,
				cargoText: null,
				arrivalTime: null,
				returnTime: null,
				progress: computeProgress(left, marchTimes[id])
			});
		});

		var pending = [];
		var ptimers = data.pendingTimers || {};
		Object.keys(ptimers).forEach(function (pid) {
			pending.push({ id: pid, timeRemaining: toInt(ptimers[pid], 0) });
		});

		return { marches: marches, pending: pending, currentPlayer: currentPlayer };
	}

	/* --- الطلب نفسه الذي يرسله loadContent (يعمل من أي صفحة) --- */
	function requestLoadContent(callback) {
		var gameMarches = window.marches || null;
		var direction = gameMarches && typeof gameMarches.direction !== 'undefined' ? gameMarches.direction : 0;
		new window.Ajax.Request('ajax_marches.php', {
			evalJS: false,
			method: 'post',
			parameters: {
				type: 'loadContent',
				castle_id: gameMarches && gameMarches.castleId != null ? gameMarches.castleId : 0,
				min_pop: gameMarches && gameMarches.minPopulation != null ? gameMarches.minPopulation : 0,
				direction: direction,
				march_type: gameMarches && gameMarches.marchType != null ? gameMarches.marchType : 0,
				use_time_filter: gameMarches && gameMarches.useTimeLeftFilter != null ? gameMarches.useTimeLeftFilter : 0,
				time_left_direction: gameMarches && gameMarches.timeLeftDirection ? gameMarches.timeLeftDirection : 'up'
			},
			onSuccess: function (response) {
				var result;
				try {
					var payload = response.responseText.evalJSON(true);
					result = parseLoadContent(payload, direction);
					result.source = 'ajax';
				} catch (e) {
					result = { marches: [], pending: [], error: 'parse: ' + e.message, raw: response.responseText };
				}
				result.at = Date.now();
				callback(result);
			},
			onFailure: function (response) {
				callback({ marches: [], pending: [], error: 'http-' + response.status, at: Date.now() });
			}
		});
	}

	/* --- المدخل الرئيسي --- */
	function getMarches(callback) {
		var called = false;
		function done(r) { if (!called) { called = true; callback(r); } }

		if (!hasAjax()) {
			done({ marches: [], pending: [], error: 'no-ajax', at: Date.now() });
			return;
		}

		function fetchMarchLists() {
			/* Mirror Marches.prototype.loadContent: one AJAX request, with its
			   current filters when present; parse only the response payload. */
			requestLoadContent(function (all) {
				if (!all.source) all.source = 'ajax';
				all.at = all.at || Date.now();
				enrichMarches(all.marches, function () { done(all); });
			});
		}

		/* Ownership detection needs the player's castle coordinates. Load them
		   once on demand, then reuse the cached list for later march refreshes. */
		if (Array.isArray(state.castles) && state.castles.length) {
			fetchMarchLists();
		} else {
			getCastles(function (res) {
				if (res && Array.isArray(res.castles)) {
					state.castles = res.castles;
					state.castlesAt = res.at || Date.now();
				}
				fetchMarchLists();
			});
		}
	}

	function getMarchInfo(marchId, callback) {
		fetchMarchInfo(toInt(marchId), callback);
	}

	/* --- المباني: قائمة + مستوى + تكلفة + وقت + إمكانية ترقية --- */
	function getBuildings(callback) {
		if (!hasAjax()) { callback({ error: 'no-ajax', buildings: [] }); return; }
		new window.Ajax.Request('buildings.php', {
			evalJS: false,
			method: 'get',
			onSuccess: function (response) {
				var list = [];
				try {
					var doc = new DOMParser().parseFromString(response.responseText, 'text/html');
					var items = doc.querySelectorAll('.buildingItem');
					for (var i = 0; i < items.length; i++) {
						var item = items[i];
						var link = item.querySelector('.title a[href*="posted_id="]');
						if (!link) continue;
						var idm = (link.getAttribute('href') || '').match(/posted_id=(\d+)/);
						if (!idm) continue;

						var lvlEl = item.querySelector('.buildingLevel');
						var actionEl = item.querySelector('a.action');
						var nextLevel = null;
						if (actionEl) {
							var nm = actionEl.textContent.replace(/\s+/g, ' ').match(/(\d+)\s*$/);
							if (nm) nextLevel = toInt(nm[1]);
						}
						var costs = {};
						var needed = item.querySelectorAll('.neededResources li');
						for (var k = 0; k < needed.length; k++) {
							var cls = needed[k].className || '';
							var val = toInt(needed[k].textContent.replace(/[^\d]/g, ''));
							if (cls.indexOf('Gold') !== -1) costs.gold = val;
							else if (cls.indexOf('Iron') !== -1) costs.iron = val;
							else if (cls.indexOf('Wood') !== -1) costs.wood = val;
							else if (cls.indexOf('Food') !== -1) costs.food = val;
						}
						var timeEl = item.querySelector('.buildingTime');
						var timeText = timeEl ? timeEl.textContent.trim() : null;

						list.push({
							id: toInt(idm[1]),
							name: link.textContent.trim(),
							level: lvlEl ? toInt(lvlEl.textContent) : null,
							nextLevel: nextLevel,
							canUpgrade: !!actionEl,
							costs: costs,
							timeText: timeText,
							time: timeText ? parseTimeToSeconds(timeText.replace(',', '.')) : null
						});
					}
				} catch (e) {
					callback({ error: e.message, buildings: [] });
					return;
				}
				callback({ buildings: list, at: Date.now() });
			},
			onFailure: function (response) {
				callback({ error: 'http-' + response.status, buildings: [] });
			}
		});
	}

	function upgradeBuilding(buildingId, callback) {
		if (!hasAjax()) { callback({ error: 'no-ajax' }); return; }
		var id = toInt(buildingId);
		if (!id || id < 1) { callback({ error: 'bad-id' }); return; }
		new window.Ajax.Request('buildings.php?tb_id=' + id + '&method=ajax', {
			method: 'get',
			evalJS: false,
			onSuccess: function (response) {
				var json;
				try { json = response.responseText.evalJSON(); }
				catch (e) { json = { raw: response.responseText, parseError: e.message }; }
				callback(json);
			},
			onFailure: function (response) {
				callback({ httpError: response.status });
			}
		});
	}

	/* مستوى المبنى الحالي من ردّ خفيف (بدون فتح buildings.php):
	 *   ajax_buildings.php { b_id } → HTML فيه .buildingLevel
	 *   المستوى 0 لا يظهر فيه .buildingLevel، فنقرأ زر «طور الى المستوى N»
	 *   ونحسب المستوى الحالي = N - 1.
	 */
	function getBuildingLevelAjax(buildingId, callback) {
		if (!hasAjax()) { callback({ level: null, error: 'no-ajax' }); return; }
		var id = toInt(buildingId);
		if (!id || id < 1) { callback({ level: null, error: 'bad-id' }); return; }
		/* cache per-building (5s TTL) — تقليل طلبات ajax_buildings.php during rapid builds */
		var cached = state.buildingLevelCache && state.buildingLevelCache[id];
		if (cached && (Date.now() - cached.at) < 5000) {
			callback({ level: cached.level, name: cached.name, error: cached.level == null ? 'no-level' : null });
			return;
		}
		new window.Ajax.Request('ajax_buildings.php', {
			evalJS: false,
			method: 'post',
			parameters: { b_id: id, backto: 'overview.php' },
			onSuccess: function (response) {
				var level = null, name = null;
				try {
					var doc = new DOMParser().parseFromString(response.responseText || '', 'text/html');
					var title = doc.querySelector('.headline h3');
					if (title) name = title.textContent.trim() || null;
					var lv = doc.querySelector('.buildingLevel');
					if (lv) {
						var n = toInt(lv.textContent);
						if (n != null) level = n;
					}
					if (level == null) {
						var btn = doc.querySelector('#attendBtn, input[name="buy"]');
						var m = btn ? String(btn.value || '').match(/المستوى[^\d]{0,6}(\d+)/) : null;
						if (m) level = Math.max(0, toInt(m[1]) - 1);
					}
				} catch (e) { level = null; }
				callback({ level: level, name: name, error: level == null ? 'no-level' : null });
				if (!state.buildingLevelCache) state.buildingLevelCache = {};
				state.buildingLevelCache[id] = { level: level, name: name, at: Date.now() };
			},
			onFailure: function (response) {
				callback({ level: null, error: 'http-' + response.status });
			}
		});
	}

	/* يقرأ تقدير اللعبة للوقت اللازم لتأمين موارد ترقية مبنى. */
	function getBuildingResourceWait(buildingId, callback) {
		if (!hasAjax()) { callback({ error: 'no-ajax' }); return; }
		new window.Ajax.Request('ajax_buildings.php', {
			evalJS: false,
			method: 'post',
			parameters: { b_id: toInt(buildingId), backto: 'overview.php' },
			onSuccess: function (response) {
				var result = { seconds: 0, resource: null };
				try {
					var doc = new DOMParser().parseFromString(response.responseText || '', 'text/html');
					var resources = ['gold', 'iron', 'wood', 'food'];
					var labels = { gold: 'الذهب', iron: 'الحديد', wood: 'الخشب', food: 'الطعام' };
					resources.forEach(function (key) {
						var el = doc.querySelector('.requirements .' + key) || doc.querySelector('.' + key);
						if (!el || !el.classList.contains('lack')) return;
						var match = String(el.getAttribute('title') || '').match(/متاح بعد حوالي\s*(\d{1,3}):(\d{2}):(\d{2})/);
						if (!match) return;
						var seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
						if (seconds > result.seconds) { result.seconds = seconds; result.resource = labels[key]; }
					});
				} catch (error) { result.error = error.message; }
				callback(result);
			},
			onFailure: function (response) { callback({ error: 'http-' + response.status, seconds: 0 }); }
		});
	}

	/* --- القلاع: القائمة الحقيقية من ajax_castles.php ---
	 * الرد HTML مثل:
	 *   <dd class=" current capital">
	 *     <a href="main.php?tpid=342&location=...">
	 *       <big>اسم القلعة</big>
	 *       <div class="smallHoder"><small>(144:171)</small><small>الولاء: ...</small><small>السكان: ...</small></div>
	 *     </a>
	 *   </dd>
	 */
	function getCastles(callback) {
		if (!hasAjax()) { callback({ error: 'no-ajax', castles: [] }); return; }
		new window.Ajax.Request('ajax_castles.php', {
			evalJS: false,
			method: 'post',
			onSuccess: function (response) {
				var list = [];
				try {
					var doc = new DOMParser().parseFromString(response.responseText || '', 'text/html');
					var dds = doc.querySelectorAll('dd');
					for (var i = 0; i < dds.length; i++) {
						var dd = dds[i];
						var a = dd.querySelector('a[href*="tpid="]');
						if (!a) continue;
						var m = (a.getAttribute('href') || '').match(/tpid=(\d+)/);
						if (!m) continue;

						var big = dd.querySelector('big');
						var coords = null, loyalty = null, population = null;
						var smalls = dd.querySelectorAll('small');
						for (var j = 0; j < smalls.length; j++) {
							var tx = (smalls[j].textContent || '').replace(/\s+/g, ' ').trim();
							var cm = tx.match(/\((\d+:\d+)\)/);
							if (cm && !coords) coords = cm[1];
							if (tx.indexOf('الولاء') !== -1) loyalty = tx.split(':').slice(1).join(':').trim();
							if (tx.indexOf('السكان') !== -1) population = tx.split(':').slice(1).join(':').trim();
						}

						var cls = dd.className || '';
						list.push({
							id: m[1],
							name: big ? big.textContent.trim() : ('#' + m[1]),
							coords: coords,
							isCurrent: /(^|\s)current(\s|$)/.test(cls),
							isCapital: /(^|\s)capital(\s|$)/.test(cls),
							loyalty: loyalty,
							population: population
						});
					}
				} catch (e) {
					callback({ error: e.message, castles: [] });
					return;
				}
				callback({ castles: list, at: Date.now() });
			},
			onFailure: function (response) {
				callback({ error: 'http-' + response.status, castles: [] });
			}
		});
	}

	/* قفل قصير يمنع تبديل القلعة بين التحقق وإرسال طلب تغيير الحالة. */
	var castleOperationBusy = false;
	var castleOperationQueue = [];

	function withCastleLock(task) {
		castleOperationQueue.push(task);
		function drain() {
			if (castleOperationBusy || !castleOperationQueue.length) return;
			castleOperationBusy = true;
			var released = false;
			var taskRelease = function () {
				if (released) return;
				released = true;
				castleOperationBusy = false;
				setTimeout(drain, 0);
			};
			try { castleOperationQueue.shift()(taskRelease); }
			catch (error) { taskRelease(); throw error; }
		}
		drain();
	}

	/* تحقق حي من القلعة النشطة، مع إبقاء القفل حتى انتهاء الطلب المرتبط بها. */
	function verifyActiveCastle(expectedId, callback) {
		expectedId = expectedId == null ? null : String(expectedId);
		/* استخدام كاش القلاع إذا كان حديثاً (<10 ث) لتجنّب طلب ajax_castles.php
		 * في كل محاولة بناء — تقليل طلبات السيرفر أثناء البناء النشط. */
		if (state.castles && state.castles.length && (Date.now() - (state.castlesAt || 0)) < 10000) {
			var cachedActive = null;
			for (var ci = 0; ci < state.castles.length; ci++) {
				if (state.castles[ci].isCurrent) { cachedActive = state.castles[ci]; break; }
			}
			if (cachedActive) state.currentCastleId = String(cachedActive.id);
			callback(!!(cachedActive && expectedId && String(cachedActive.id) === expectedId), cachedActive,
				cachedActive ? 'القلعة النشطة تغيّرت' : 'لم تُحدد القلعة النشطة');
			return;
		}
		getCastles(function (res) {
			if (!res || res.error || !Array.isArray(res.castles)) {
				callback(false, null, (res && res.error) || 'تعذّر التحقق من القلعة');
				return;
			}
			state.castles = res.castles;
			state.castlesAt = Date.now();
			state.smithyCastleCheckedAt = state.castlesAt;
			var active = null;
			for (var i = 0; i < res.castles.length; i++) {
				if (res.castles[i].isCurrent) { active = res.castles[i]; break; }
			}
			if (active) state.currentCastleId = String(active.id);
			saveCastlesCache();
			callback(!!(active && expectedId && String(active.id) === expectedId), active,
				active ? 'القلعة النشطة تغيّرت' : 'لم تُحدد القلعة النشطة');
		});
	}

	function withVerifiedCastle(expectedId, action, onMismatch) {
		withCastleLock(function (releaseLock) {
			verifyActiveCastle(expectedId, function (ok, active, error) {
				if (!ok) {
					releaseLock();
					if (onMismatch) onMismatch(active, error);
					return;
				}
				var done = false;
				var release = function () {
					if (done) return;
					done = true;
					releaseLock();
				};
				try { action(release, active); }
				catch (error) { release(); throw error; }
			});
		});
	}

	/* --- تبديل القلعة عبر طلب السيرفر نفسه (بدون أي تنقّل) ---
	 * main.php?tpid=<id>&location=... يضبط القلعة النشطة في الجلسة ثم يعيد
	 * ردّاً من نوع text/javascript فيه: window.location = '...'
	 *
	 * مهم: لا نستخدم Ajax.Request هنا! نسخة Prototype في اللعبة تنفّذ
	 * ردود text/javascript تلقائياً (evalResponse)، لذلك أي طلب تبديل عبر
	 * Ajax.Request ينتقل بالصفحة فعلياً. نستخدم fetch لأنه لا ينفّذ شيئاً.
	 *
	 * ثم نتحقق من ajax_castles.php أن class "current" انتقل للقلعة المطلوبة.
	 */
	function setCastle(castleId, callback) {
		var id = toInt(castleId);
		if (!id || id < 1) { callback({ error: 'bad-id', ok: false }); return; }
		if (typeof window.fetch !== 'function') { callback({ error: 'no-fetch', ok: false }); return; }

		var target = String(location.href).split('#')[0];
		var url = 'main.php?tpid=' + id + '&location=' + encodeURIComponent(target);
		var finished = false;

		function done(res) {
			if (finished) return;
			finished = true;
			clearTimeout(watchdog);
			callback(res);
		}

		var watchdog = setTimeout(function () {
			done({ error: 'timeout', ok: false });
		}, 12000);

		window.fetch(url, {
			method: 'GET',
			credentials: 'same-origin',
			cache: 'no-store'
		}).then(function () {
			/* الجلسة تغيّرت على السيرفر — تحقّق من القلعة النشطة */
			setTimeout(function () {
				getCastles(function (res) {
					var current = null;
					(res.castles || []).forEach(function (c) {
						if (c.isCurrent) current = c;
					});
					done({
						ok: !!(current && String(current.id) === String(id)),
						castleId: id,
						current: current,
						castles: res.castles || [],
						at: Date.now()
					});
				});
			}, 300);
		}).catch(function () {
			done({ error: 'network', ok: false });
		});
	}

	/* ============================================================
	 * 2) الحالة + التخزين المحلي
	 * ============================================================ */

	var LS = {
		open: 'kw.panel.open',
		pos: 'kw.panel.pos',
		auto: 'kw.panel.auto',
		interval: 'kw.panel.interval',
		tab: 'kw.panel.tab',
		cycle: 'kw.cycle',
		cycleInterval: 'kw.cycle.interval',
		autoBuild: 'kw.autoBuild',
		autoBuildAll: 'kw.autoBuild.all',
		autoBuildSleep: 'kw.autoBuildSleep',
		instantFinish: 'kw.instantFinish',
		smithyCastle: 'kw.smithy.castle',
		smithyCastleCount: 'kw.smithy.castleCount',
		smithyAuto: 'kw.smithy.auto',
		provinceAuto: 'kw.provinceAuto',
		provinceLastAuto: 'kw.provinceLastAuto',
		provinceSleep: 'kw.provinceSleep'
	};

	function lsGet(k, def) {
		try {
			var v = localStorage.getItem(k);
			return v == null ? def : v;
		} catch (e) { return def; }
	}
	function lsSet(k, v) {
		try { localStorage.setItem(k, v); } catch (e) { /* ignore */ }
	}

	var state = {
		open: lsGet(LS.open, '1') === '1',
		tab: lsGet(LS.tab, 'marches'),
		auto: lsGet(LS.auto, '0') === '1',
		interval: Math.max(10, toInt(lsGet(LS.interval, '30'), 30)),
		marches: [],
		pending: [],
		fetchedAt: 0,
		source: null,
		loading: false,
		error: null,
		buildings: [],
		buildingsAt: 0,
		buildingsLoading: false,
		buildingsError: null,
		castles: [],
		castlesAt: 0,
		castlesLoading: false,
		castlesError: null,
		currentCastleId: null,
		cycle: lsGet(LS.cycle, '0') === '1',
		cycleInterval: Math.max(5, toInt(lsGet(LS.cycleInterval, '20'), 20)),
		cycleTimer: null,
		autoBuild: lsGet(LS.autoBuild, '0') === '1',
		autoBuildAll: lsGet(LS.autoBuildAll, '0') === '1',
		instantFinish: lsGet(LS.instantFinish, '1') !== '0',
		buildRunning: false,
		ifCheckAt: 0,
		ifBusy: false,
		ifBusyAt: 0,
		autoBuildBusy: false,
		autoBuildNextAt: 0,
		autoBuildTimer: null,
		buildingLevelCache: {},
		abStatus: 'idle',
		abStatusText: '',
		abLog: [],
		abSwitchFails: 0,
		abBlocked: {},
		abBlockedResetAt: 0,
		abWaitKey: null,
		abErrorCount: 0,
		pendingBuilds: [],
		abQuestFails: 0,
		abSkillBlockedAt: 0,
		pendingSkill: null,
		smithyCastleId: lsGet(LS.smithyCastle, ''),
		smithyAuto: lsGet(LS.smithyAuto, '0') === '1',
		smithyLevels: {},
		smithyTypes: {},
		smithyLoading: false,
		smithyBusy: false,
		smithyStatus: '',
		smithyTimer: null,
		smithyCastleCheckedAt: 0,
		pvAuto: lsGet(LS.provinceAuto, '1') !== '0',
		pvBusy: false,
		pvLoading: false,
		pvAt: 0,
		pvSlots: [],
		pvMissions: [],
		pvError: null,
		pvStatus: 'idle',
		pvStatusText: '',
		pvLog: [],
		pvSent: {},
		pvAutoTimer: null,
		autoTimer: null,
		refreshSeq: 0,
		doneRefreshAt: 0
	};

	var lastJson = {};

	/* ============================================================
	 * 3) الواجهة
	 * ============================================================ */

	var el = {}; /* مراجع العناصر */

	var CSS = [
		'#kw-panel,#kw-launcher{direction:rtl;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial,sans-serif;font-size:12.5px;line-height:1.45;color:#e5e7eb;}',
		'#kw-panel *{box-sizing:border-box;}',
		'#kw-panel{position:fixed;z-index:2147483000;width:660px;max-width:calc(100vw - 20px);max-height:calc(100vh - 24px);display:flex;flex-direction:column;background:linear-gradient(180deg,#0f172a 0%,#111827 100%);border:1px solid rgba(255,255,255,.10);border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.55);overflow:hidden;left:14px;bottom:14px;}',
		'#kw-panel.kw-hidden{display:none;}',
		'#kw-panel .kw-hidden{display:none;}',
		'#kw-panel .kw-head{display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.08);cursor:move;user-select:none;}',
		'#kw-panel .kw-dot{width:9px;height:9px;border-radius:50%;background:#6b7280;box-shadow:0 0 0 3px rgba(107,114,128,.18);flex:0 0 auto;}',
		'#kw-panel .kw-dot.ok{background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.20);}',
		'#kw-panel .kw-dot.err{background:#ef4444;box-shadow:0 0 0 3px rgba(239,68,68,.20);}',
		'#kw-panel .kw-dot.busy{background:#f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,.20);}',
		'#kw-panel .kw-title{font-weight:700;letter-spacing:.2px;}',
		'#kw-panel .kw-ver{font-size:10px;color:#94a3b8;background:rgba(255,255,255,.06);padding:1px 6px;border-radius:999px;}',
		'#kw-panel .kw-castle{font-size:11px;color:#c7d2fe;background:rgba(99,102,241,.14);border:1px solid rgba(99,102,241,.30);padding:1px 8px;border-radius:999px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
		'#kw-panel tr.kw-current td{background:rgba(34,197,94,.07);}',
		'#kw-panel .kw-cur{color:#86efac;font-weight:700;}',
		'#kw-panel .kw-spacer{flex:1 1 auto;}',
		'#kw-panel button{font-family:inherit;font-size:12.5px;cursor:pointer;}',
		'#kw-panel .kw-btn{background:transparent;color:#cbd5e1;border:1px solid rgba(255,255,255,.10);border-radius:8px;padding:2px 8px;line-height:1.6;}',
		'#kw-panel .kw-btn:hover{background:rgba(255,255,255,.10);color:#fff;}',
		'#kw-panel .kw-btn.kw-spin{animation:kwspin .8s linear infinite;}',
		'@keyframes kwspin{from{transform:rotate(0)}to{transform:rotate(360deg)}}',
		'#kw-panel .kw-tabs{display:flex;gap:4px;padding:6px 8px 0;background:rgba(0,0,0,.15);}',
		'#kw-panel .kw-tab{background:transparent;color:#94a3b8;border:1px solid transparent;border-bottom:none;border-radius:8px 8px 0 0;padding:5px 12px;}',
		'#kw-panel .kw-tab:hover{color:#e5e7eb;}',
		'#kw-panel .kw-tab.active{background:rgba(255,255,255,.07);color:#fff;border-color:rgba(255,255,255,.10);}',
		'#kw-panel .kw-body{padding:8px;overflow:auto;}',
		'#kw-panel .kw-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px;color:#cbd5e1;}',
		'#kw-panel .kw-check{display:inline-flex;align-items:center;gap:5px;cursor:pointer;}',
		'#kw-panel select{background:#0b1220;color:#e5e7eb;border:1px solid rgba(255,255,255,.14);border-radius:6px;padding:2px 6px;font-family:inherit;font-size:12px;}',
		'#kw-panel .kw-meta{color:#94a3b8;font-size:11px;}',
		'#kw-panel .kw-table-wrap{overflow-x:auto;border:1px solid rgba(255,255,255,.07);border-radius:8px;}',
		'#kw-panel table{width:100%;border-collapse:collapse;white-space:nowrap;}',
		'#kw-panel th{font-size:11px;font-weight:600;color:#94a3b8;background:rgba(255,255,255,.04);text-align:right;padding:5px 7px;border-bottom:1px solid rgba(255,255,255,.08);}',
		'#kw-panel td{padding:5px 7px;border-bottom:1px solid rgba(255,255,255,.05);text-align:right;vertical-align:middle;}',
		'#kw-panel tr:last-child td{border-bottom:none;}',
		'#kw-panel .kw-march-card{display:block!important;width:100%;padding:10px 12px;border:1px solid rgba(255,255,255,.09);border-radius:10px;margin:7px 0;background:linear-gradient(135deg,rgba(30,41,59,.92),rgba(15,23,42,.96));box-shadow:0 3px 10px rgba(0,0,0,.14);white-space:normal;text-align:right;} ',
		'#kw-panel .kw-march-card:last-child{border-bottom:none;}',
		'#kw-panel .kw-march-card.kw-incoming-attack{background:linear-gradient(135deg,rgba(127,29,29,.40),rgba(30,41,59,.96));border-color:rgba(248,113,113,.40);color:#fee2e2;}',
		'#kw-panel .kw-march-card.kw-done{opacity:.55;}',
		'#kw-panel .kw-march-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px;padding-bottom:7px;border-bottom:1px solid rgba(255,255,255,.08);}',
		'#kw-panel .kw-march-badges{display:flex;align-items:center;gap:5px;flex-wrap:wrap;}',
		'#kw-panel .kw-march-id{color:#bfdbfe;font:600 12px ui-monospace,Consolas,monospace;}',
		'#kw-panel .kw-march-participants{display:grid;grid-template-columns:minmax(0,1fr) 26px minmax(0,1fr);align-items:center;gap:8px;padding:7px 8px;margin-bottom:6px;border-radius:8px;background:rgba(2,6,23,.24);}',
		'#kw-panel .kw-march-party{min-width:0;text-align:center;}',
		'#kw-panel .kw-march-party-label{display:block;color:#94a3b8;font-size:10px;}',
		'#kw-panel .kw-march-party-name{display:block;color:#f1f5f9;font-size:12px;font-weight:700;overflow-wrap:anywhere;unicode-bidi:plaintext;}',
		'#kw-panel .kw-march-arrow{color:#93c5fd;text-align:center;font-size:18px;}',
		'#kw-panel .kw-march-route{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 2px 6px;color:#cbd5e1;font-size:10px;}',
		'#kw-panel .kw-march-route-value{direction:ltr;unicode-bidi:isolate;font:600 11px ui-monospace,Consolas,monospace;color:#e2e8f0;}',
		'#kw-panel .kw-march-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px 8px;padding-top:6px;border-top:1px solid rgba(255,255,255,.07);}',
		'#kw-panel .kw-march-field{min-width:0;padding:1px 0;}',
		'#kw-panel .kw-march-label{display:block;margin-bottom:1px;color:#94a3b8;font-size:9px;white-space:nowrap;}',
		'#kw-panel .kw-march-value{display:block;color:#e2e8f0;font-size:10px;font-weight:600;overflow-wrap:anywhere;unicode-bidi:plaintext;}',
		'#kw-panel .kw-march-value[dir="ltr"]{text-align:right;font-family:ui-monospace,Consolas,monospace;}',
		'#kw-panel .kw-march-extra{grid-column:1/-1;display:flex;justify-content:space-between;gap:8px;padding-top:4px;color:#cbd5e1;font-size:10px;}',
		'#kw-panel .kw-march-status{display:block;margin-bottom:6px;color:#94a3b8;font-size:11px;}',
		'#kw-panel .kw-march-status-list{display:block;width:100%;}',
		'@media(max-width:480px){#kw-panel .kw-march-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}',
		'#kw-panel .kw-march-alert{display:none;margin:0 0 7px;padding:7px 10px;border:1px solid rgba(239,68,68,.55);border-radius:8px;background:rgba(127,29,29,.35);color:#fecaca;font-weight:700;}',
		'#kw-panel .kw-id{color:#93c5fd;font-family:ui-monospace,Consolas,monospace;font-size:11px;}',
		'#kw-panel .kw-qhead{margin:0 0 6px;font-size:12px;color:#cbd5e1;line-height:1.6;}',
		'#kw-panel .kw-qhead b{color:#f1f5f9;}',
		'#kw-panel .kw-badge{display:inline-block;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid transparent;}',
		'#kw-panel .kw-badge.attack{background:rgba(239,68,68,.16);color:#fca5a5;border-color:rgba(239,68,68,.30);}',
		'#kw-panel .kw-badge.support{background:rgba(34,197,94,.16);color:#86efac;border-color:rgba(34,197,94,.30);}',
		'#kw-panel .kw-badge.patrol{background:rgba(59,130,246,.16);color:#93c5fd;border-color:rgba(59,130,246,.30);}',
		'#kw-panel .kw-badge.gather{background:rgba(245,158,11,.16);color:#fcd34d;border-color:rgba(245,158,11,.30);}',
		'#kw-panel .kw-badge.spy{background:rgba(168,85,247,.16);color:#d8b4fe;border-color:rgba(168,85,247,.30);}',
		'#kw-panel .kw-badge.transfer{background:rgba(148,163,184,.16);color:#cbd5e1;border-color:rgba(148,163,184,.30);}',
		'#kw-panel .kw-badge.settle{background:rgba(20,184,166,.16);color:#5eead4;border-color:rgba(20,184,166,.30);}',
		'#kw-panel .kw-badge.other{background:rgba(107,114,128,.16);color:#d1d5db;border-color:rgba(107,114,128,.30);}',
		'#kw-panel .kw-badge.free{background:rgba(34,197,94,.16);color:#86efac;border-color:rgba(34,197,94,.30);}',
		'#kw-panel .kw-badge.busy{background:rgba(245,158,11,.16);color:#fcd34d;border-color:rgba(245,158,11,.30);}',
		'#kw-panel .kw-badge.locked{background:rgba(148,163,184,.14);color:#cbd5e1;border-color:rgba(148,163,184,.30);}',
		'#kw-panel .kw-time{font-family:ui-monospace,Consolas,monospace;}',
		'#kw-panel .kw-total{font-weight:700;color:#e2e8f0;}',
		'#kw-panel .kw-left-cell{min-width:96px;}',
		'#kw-panel .kw-bar{height:4px;border-radius:999px;background:rgba(255,255,255,.10);overflow:hidden;margin-top:3px;}',
		'#kw-panel .kw-bar > i{display:block;height:100%;width:0;background:linear-gradient(90deg,#22c55e,#38bdf8);transition:width .4s linear;}',
		'#kw-panel .kw-empty{padding:14px;text-align:center;color:#94a3b8;}',
		'#kw-panel .kw-json{margin:0;padding:8px;max-height:340px;overflow:auto;background:#0b1220;border:1px solid rgba(255,255,255,.08);border-radius:8px;color:#a5b4fc;font-family:ui-monospace,Consolas,monospace;font-size:11px;white-space:pre-wrap;word-break:break-word;direction:ltr;text-align:left;}',
		'#kw-panel .kw-cost{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:#cbd5e1;}',
		'#kw-panel .kw-up{background:rgba(34,197,94,.14);color:#86efac;border:1px solid rgba(34,197,94,.35);border-radius:7px;padding:2px 10px;}',
		'#kw-panel .kw-up:hover{background:rgba(34,197,94,.24);color:#fff;}',
		'#kw-panel .kw-up:disabled{opacity:.35;cursor:not-allowed;}',
		'#kw-panel .kw-auto{border:1px solid rgba(34,197,94,.22);background:rgba(34,197,94,.05);border-radius:9px;padding:6px;margin-bottom:6px;}',
		'#kw-panel .kw-auto.kw-on{border-color:rgba(34,197,94,.55);box-shadow:0 0 0 1px rgba(34,197,94,.18) inset;}',
		'#kw-panel .kw-btn.kw-run{background:rgba(34,197,94,.16);border-color:rgba(34,197,94,.45);color:#bbf7d0;}',
		'#kw-panel .kw-btn.kw-run:hover{background:rgba(34,197,94,.28);color:#fff;}',
		'#kw-panel .kw-btn.kw-stop{background:rgba(239,68,68,.14);border-color:rgba(239,68,68,.45);color:#fecaca;}',
		'#kw-panel .kw-qrow{display:flex;flex-wrap:wrap;gap:4px;margin-top:3px;min-height:20px;}',
		'#kw-panel .kw-chip{display:inline-flex;align-items:center;gap:4px;background:rgba(99,102,241,.16);border:1px solid rgba(99,102,241,.35);border-radius:999px;padding:1px 7px;font-size:11px;color:#c7d2fe;}',
		'#kw-panel .kw-chip b{font-weight:700;color:#fff;}',
		'#kw-panel .kw-chip.unsupported{border-color:rgba(239,68,68,.40);background:rgba(239,68,68,.12);color:#fecaca;}',
		'#kw-panel .kw-chip.blocked{border-color:rgba(245,158,11,.45);background:rgba(245,158,11,.12);color:#fde68a;text-decoration:line-through;}',
		'#kw-panel .kw-chip.quest{border-color:rgba(34,197,94,.45);background:rgba(34,197,94,.12);color:#bbf7d0;}',
		'#kw-panel .kw-chip.skill{border-color:rgba(56,189,248,.45);background:rgba(56,189,248,.12);color:#bae6fd;}',
		'#kw-panel .kw-chip.pending{border-color:rgba(59,130,246,.55);background:rgba(59,130,246,.16);color:#bfdbfe;}',
		'#kw-panel .kw-ablog{margin-top:5px;max-height:58px;overflow:auto;font-size:11px;color:#94a3b8;font-family:ui-monospace,Consolas,monospace;}',
		'#kw-panel .kw-ablog .ok{color:#86efac;}',
		'#kw-panel .kw-ablog .err{color:#fca5a5;}',
		'#kw-panel .kw-ablog .warn{color:#fcd34d;}',
		'#kw-panel .kw-toast{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);background:#111827;border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:6px 14px;color:#e5e7eb;box-shadow:0 10px 25px rgba(0,0,0,.5);opacity:0;pointer-events:none;transition:opacity .2s;}',
		'#kw-panel .kw-toast.show{opacity:1;}',
		'#kw-panel .kw-toast.ok{border-color:rgba(34,197,94,.45);}',
		'#kw-panel .kw-toast.err{border-color:rgba(239,68,68,.45);}',
		'#kw-launcher{position:fixed;z-index:2147483000;left:14px;bottom:14px;width:38px;height:38px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:linear-gradient(180deg,#1e293b,#0f172a);color:#e2e8f0;font-weight:800;font-size:12px;letter-spacing:.5px;box-shadow:0 8px 20px rgba(0,0,0,.45);cursor:pointer;}',
		'#kw-launcher:hover{background:linear-gradient(180deg,#334155,#1e293b);color:#fff;}',
		'#kw-launcher.kw-hidden{display:none;}'
	].join('\n');

	var HTML = [
		'<div class="kw-head" id="kw-head">',
		'  <span class="kw-dot" id="kw-dot"></span>',
		'  <span class="kw-title">KhanWars Toolkit</span>',
		'  <span class="kw-ver">v' + VERSION + '</span>',
		'  <span class="kw-castle" id="kw-castle" title="القلعة النشطة">—</span>',
		'  <span class="kw-spacer"></span>',
		'  <button class="kw-btn" id="kw-refresh" title="تحديث">⟳</button>',
		'  <button class="kw-btn" id="kw-min" title="تصغير">▾</button>',
		'  <button class="kw-btn" id="kw-close" title="إغلاق">✕</button>',
		'</div>',
		'<div class="kw-tabs">',
		'  <button class="kw-tab active" data-tab="marches">الإرساليات</button>',
		'  <button class="kw-tab" data-tab="buildings">المباني</button>',
		'  <button class="kw-tab" data-tab="smithy">الحداد</button>',
		'  <button class="kw-tab" data-tab="castles">القلاع</button>',
		'  <button class="kw-tab" data-tab="province">الأمير</button>',
		'  <button class="kw-tab" data-tab="raw">JSON</button>',
		'</div>',
		'<div class="kw-body">',
		'  <div class="kw-pane" data-pane="marches">',
		'    <div class="kw-toolbar">',
		'      <label class="kw-check"><input type="checkbox" id="kw-auto"> تحديث تلقائي</label>',
		'      <select id="kw-interval">',
		'        <option value="10">كل 10ث</option>',
		'        <option value="20">كل 20ث</option>',
		'        <option value="30">كل 30ث</option>',
		'        <option value="60">كل دقيقة</option>',
		'        <option value="120">كل دقيقتين</option>',
		'      </select>',
		'      <span class="kw-meta" id="kw-meta">—</span>',
		'    </div>',
		'    <div class="kw-march-alert" id="kw-march-alert" role="alert"></div>',
		'    <div class="kw-table-wrap kw-march-list" id="kw-marches" role="list"></div>',
		'    <div class="kw-empty" id="kw-marches-empty">لا توجد إرساليات نشطة.</div>',
		'  </div>',
		'  <div class="kw-pane kw-hidden" data-pane="buildings">',
		'    <div class="kw-auto" id="kw-ab-box">',
		'      <div class="kw-toolbar">',
		'        <button class="kw-btn kw-run" id="kw-ab-toggle">▶ تشغيل آلي</button>',
		'        <label class="kw-check"><input type="checkbox" id="kw-ab-all"> كل القلاع</label>',
		'        <label class="kw-check" title="اللعبة تسمح بإنهاء فوري مجاني عندما يتبقى 60 ثانية أو أقل"><input type="checkbox" id="kw-ab-instant"> ⚡ إنهاء فوري ≤60ث</label>',
		'        <span class="kw-meta" id="kw-ab-status">متوقف</span>',
		'      </div>',
		'      <div class="kw-qrow" id="kw-build-queue"></div>',
		'      <div class="kw-ablog" id="kw-ab-log"></div>',
		'    </div>',
		'    <div class="kw-toolbar">',
		'      <button class="kw-btn" id="kw-b-load">تحميل / تحديث</button>',
		'      <span class="kw-meta" id="kw-b-meta"></span>',
		'    </div>',
		'    <div class="kw-table-wrap"><table id="kw-buildings"></table></div>',
		'    <div class="kw-empty" id="kw-buildings-empty">اضغط «تحميل / تحديث».</div>',
		'  </div>',
		'  <div class="kw-pane kw-hidden" data-pane="smithy">',
		'    <div class="kw-auto" id="kw-smith-box">',
		'      <div class="kw-toolbar">',
		'        <label class="kw-check" for="kw-smith-castle">قلعة التطوير:</label>',
		'        <select id="kw-smith-castle" aria-label="اختر قلعة التطوير"></select>',
		'        <button class="kw-btn" id="kw-smith-load">تحديث المستويات</button>',
		'        <label class="kw-check"><input type="checkbox" id="kw-smith-auto"> تطوير تلقائي</label>',
		'        <span class="kw-meta" id="kw-smith-status">اختر العاصمة «ي-8-» من قائمة القلاع.</span>',
		'      </div>',
		'      <div class="kw-qhead" id="kw-smith-castle-label">—</div>',
		'      <div class="kw-ablog" id="kw-smith-note">الطابور للقراءة فقط هنا؛ استخدم داشبوردك الحالية للإضافة والحذف.</div>',
		'    </div>',
		'    <div class="kw-table-wrap"><table id="kw-smith-levels"></table></div>',
		'    <div class="kw-empty" id="kw-smith-empty">اختر قلعة التطوير ثم اضغط «تحديث المستويات».</div>',
		'    <div class="kw-table-wrap" style="margin-top:8px"><table id="kw-smith-queue"></table></div>',
		'    <div class="kw-empty" id="kw-smith-queue-empty">طابور الحداد فارغ.</div>',
		'  </div>',
		'  <div class="kw-pane kw-hidden" data-pane="castles">',
		'    <div class="kw-toolbar">',
		'      <button class="kw-btn" id="kw-c-load">تحميل / تحديث</button>',
		'      <label class="kw-check"><input type="checkbox" id="kw-cycle"> تبديل تلقائي</label>',
		'      <select id="kw-cycle-interval">',
		'        <option value="5">كل 5ث</option>',
		'        <option value="10">كل 10ث</option>',
		'        <option value="20">كل 20ث</option>',
		'        <option value="30">كل 30ث</option>',
		'        <option value="60">كل دقيقة</option>',
		'      </select>',
		'      <button class="kw-btn" id="kw-cycle-once">دورة كاملة</button>',
		'      <span class="kw-meta" id="kw-c-meta"></span>',
		'    </div>',
		'    <div class="kw-table-wrap"><table id="kw-castles"></table></div>',
		'    <div class="kw-empty" id="kw-castles-empty">اضغط «تحميل / تحديث».</div>',
		'  </div>',
		'  <div class="kw-pane kw-hidden" data-pane="province">',
		'    <div class="kw-auto" id="kw-pv-box">',
		'      <div class="kw-toolbar">',
		'        <button class="kw-btn kw-run" id="kw-pv-send">⚔ إرسال الأمير الآن</button>',
		'        <button class="kw-btn" id="kw-pv-check">فحص المهام</button>',
		'        <label class="kw-check" title="مخزَّن في localStorage[prov] باسم القلعة"><input type="checkbox" id="kw-pv-enabled"> مفعّل لهذه القلعة</label>',
		'        <label class="kw-check" title="يفحص مهام المدينة دورياً من أي صفحة ويرسل الأمير فور توفر مهمة متاحة، بدون تأكيد"><input type="checkbox" id="kw-pv-auto"> تلقائي من أي صفحة</label>',
		'        <span class="kw-meta" id="kw-pv-status">—</span>',
		'      </div>',
		'      <div class="kw-qhead" id="kw-pv-castle">—</div>',
		'      <div class="kw-ablog" id="kw-pv-log"></div>',
		'    </div>',
		'    <div class="kw-table-wrap"><table id="kw-pv-slots"></table></div>',
		'    <div class="kw-empty" id="kw-pv-empty">اضغط «فحص المهام».</div>',
		'  </div>',
		'  <div class="kw-pane kw-hidden" data-pane="raw">',
		'    <div class="kw-toolbar"><button class="kw-btn" id="kw-copy">نسخ JSON</button></div>',
		'    <pre class="kw-json" id="kw-json">—</pre>',
		'  </div>',
		'</div>',
		'<div class="kw-toast" id="kw-toast"></div>'
	].join('');

	function esc(s) {
		if (s == null) return '';
		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function buildUI() {
		var style = document.createElement('style');
		style.id = 'kw-style';
		style.textContent = CSS;
		(document.head || document.documentElement).appendChild(style);

		var panel = document.createElement('div');
		panel.id = 'kw-panel';
		panel.setAttribute('dir', 'rtl');
		panel.innerHTML = HTML;

		var launcher = document.createElement('button');
		launcher.id = 'kw-launcher';
		launcher.type = 'button';
		launcher.textContent = 'KW';
		launcher.title = 'KhanWars Toolkit';

		document.body.appendChild(panel);
		document.body.appendChild(launcher);

		el.panel = panel;
		el.launcher = launcher;
		el.dot = panel.querySelector('#kw-dot');
		el.meta = panel.querySelector('#kw-meta');
		el.marchesList = panel.querySelector('#kw-marches');
		el.marchesWrap = panel.querySelector('[data-pane="marches"] .kw-table-wrap');
		el.marchesEmpty = panel.querySelector('#kw-marches-empty');
		el.marchAlert = panel.querySelector('#kw-march-alert');
		el.auto = panel.querySelector('#kw-auto');
		el.interval = panel.querySelector('#kw-interval');
		el.buildingsTable = panel.querySelector('#kw-buildings');
		el.buildingsEmpty = panel.querySelector('#kw-buildings-empty');
		el.buildingsMeta = panel.querySelector('#kw-b-meta');
		el.smithCastle = panel.querySelector('#kw-smith-castle');
		el.smithLoad = panel.querySelector('#kw-smith-load');
		el.smithAuto = panel.querySelector('#kw-smith-auto');
		el.smithStatus = panel.querySelector('#kw-smith-status');
		el.smithLevels = panel.querySelector('#kw-smith-levels');
		el.smithEmpty = panel.querySelector('#kw-smith-empty');
		el.smithQueue = panel.querySelector('#kw-smith-queue');
		el.smithQueueEmpty = panel.querySelector('#kw-smith-queue-empty');
		el.smithCastleLabel = panel.querySelector('#kw-smith-castle-label');
		el.castlesTable = panel.querySelector('#kw-castles');
		el.castlesEmpty = panel.querySelector('#kw-castles-empty');
		el.castlesMeta = panel.querySelector('#kw-c-meta');
		el.castleChip = panel.querySelector('#kw-castle');
		el.cycle = panel.querySelector('#kw-cycle');
		el.cycleInterval = panel.querySelector('#kw-cycle-interval');
		el.cycleOnce = panel.querySelector('#kw-cycle-once');
		el.abBox = panel.querySelector('#kw-ab-box');
		el.abBtn = panel.querySelector('#kw-ab-toggle');
		el.abStatus = panel.querySelector('#kw-ab-status');
		el.buildQueue = panel.querySelector('#kw-build-queue');
		el.abLog = panel.querySelector('#kw-ab-log');
		el.abAll = panel.querySelector('#kw-ab-all');
		el.abInstant = panel.querySelector('#kw-ab-instant');
		el.pvBox = panel.querySelector('#kw-pv-box');
		el.pvSend = panel.querySelector('#kw-pv-send');
		el.pvCheck = panel.querySelector('#kw-pv-check');
		el.pvEnabled = panel.querySelector('#kw-pv-enabled');
		el.pvAuto = panel.querySelector('#kw-pv-auto');
		el.pvStatus = panel.querySelector('#kw-pv-status');
		el.pvCastle = panel.querySelector('#kw-pv-castle');
		el.pvLog = panel.querySelector('#kw-pv-log');
		el.pvSlots = panel.querySelector('#kw-pv-slots');
		el.pvEmpty = panel.querySelector('#kw-pv-empty');
		el.json = panel.querySelector('#kw-json');
		el.toast = panel.querySelector('#kw-toast');
		el.refresh = panel.querySelector('#kw-refresh');

		/* restore position */
		var pos = null;
		try { pos = JSON.parse(lsGet(LS.pos, 'null')); } catch (e) { pos = null; }
		if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') applyPos(pos.left, pos.top);

		/* events */
		panel.querySelector('#kw-close').addEventListener('click', function () { setOpen(false); });
		panel.querySelector('#kw-min').addEventListener('click', function () { setOpen(false); });
		launcher.addEventListener('click', function () { setOpen(true); });
		el.refresh.addEventListener('click', function () { refreshActive(true); });

		el.auto.checked = state.auto;
		el.interval.value = String(state.interval);
		el.auto.addEventListener('change', function () {
			state.auto = el.auto.checked;
			lsSet(LS.auto, state.auto ? '1' : '0');
			syncAutoTimer();
		});
		el.interval.addEventListener('change', function () {
			state.interval = Math.max(10, toInt(el.interval.value, 30));
			lsSet(LS.interval, String(state.interval));
			syncAutoTimer();
		});

		Array.prototype.forEach.call(panel.querySelectorAll('.kw-tab'), function (btn) {
			btn.addEventListener('click', function () { setTab(btn.getAttribute('data-tab')); });
		});
		panel.querySelector('#kw-b-load').addEventListener('click', function () { loadBuildings(); });
		el.smithLoad.addEventListener('click', function () { syncSmithyLevels(true); });
		el.smithCastle.addEventListener('change', function () {
			state.smithyCastleId = String(el.smithCastle.value || '');
			lsSet(LS.smithyCastle, state.smithyCastleId);
			state.smithyLevels = {};
			state.smithyTypes = {};
			renderSmithy();
			if (state.smithyCastleId) syncSmithyLevels(false);
		});
		el.smithAuto.checked = state.smithyAuto;
		el.smithAuto.addEventListener('change', function () { setSmithyAuto(el.smithAuto.checked); });
		panel.querySelector('#kw-c-load').addEventListener('click', function () { loadCastles(true); });
		panel.querySelector('#kw-cycle-once').addEventListener('click', function () { cycleOnce(); });

		/* البناء الآلي */
		el.abBtn.addEventListener('click', function () { autoBuildSet(!state.autoBuild); });
		el.abAll.checked = state.autoBuildAll;
		el.abAll.addEventListener('change', function () {
			state.autoBuildAll = el.abAll.checked;
			lsSet(LS.autoBuildAll, state.autoBuildAll ? '1' : '0');
		});
		if (el.abInstant) {
			el.abInstant.checked = state.instantFinish;
			el.abInstant.addEventListener('change', function () {
				state.instantFinish = el.abInstant.checked;
				lsSet(LS.instantFinish, state.instantFinish ? '1' : '0');
				if (state.instantFinish) {
					state.ifCheckAt = 0;
					if (state.autoBuild) autoBuildTick();
				}
			});
		}

		/* الأمير / المدينة */
		el.pvSend.addEventListener('click', function () { provinceSendNow({ manual: true }); });
		el.pvCheck.addEventListener('click', function () { loadProvince(true); });
		el.pvAuto.checked = state.pvAuto;
		el.pvAuto.addEventListener('change', function () {
			state.pvAuto = !!el.pvAuto.checked;
			lsSet(LS.provinceAuto, state.pvAuto ? '1' : '0');
			renderProvince();
			syncProvinceAutoTimer();
			if (state.pvAuto) autoProvinceTry();
		});
		el.pvEnabled.addEventListener('change', function () {
			setProvinceEnabled(!!el.pvEnabled.checked);
		});

		el.cycle.checked = state.cycle;
		el.cycleInterval.value = String(state.cycleInterval);
		el.cycle.addEventListener('change', function () {
			state.cycle = el.cycle.checked;
			lsSet(LS.cycle, state.cycle ? '1' : '0');
			if (state.cycle) startCycle(); else stopCycle();
		});
		el.cycleInterval.addEventListener('change', function () {
			state.cycleInterval = Math.max(5, toInt(el.cycleInterval.value, 20));
			lsSet(LS.cycleInterval, String(state.cycleInterval));
			if (state.cycle) startCycle();
		});
		panel.querySelector('#kw-copy').addEventListener('click', function () {
			var txt = el.json.textContent || '';
			if (navigator.clipboard && navigator.clipboard.writeText) {
				navigator.clipboard.writeText(txt).then(function () { toast('تم النسخ', 'ok'); }, function () { toast('تعذّر النسخ', 'err'); });
			} else {
				toast('النسخ غير مدعوم', 'err');
			}
		});

		makeDraggable(panel, panel.querySelector('#kw-head'));
		window.addEventListener('resize', clampPanel);

		setTab(state.tab, true);
		setOpen(state.open, true);
		renderCastleChip();
		renderAbStatus();
		renderBuildQueue();
		renderAbLog();
		renderProvince();
		renderPvLog();
		renderSmithy();
		syncAutoBuildTimer();
		if (state.autoBuild) autoBuildTick();
		if (state.smithyAuto) setSmithyAuto(true);
		if (state.cycle) startCycle();
	}

	function applyPos(left, top) {
		if (!el.panel) return;
		var maxL = Math.max(0, window.innerWidth - el.panel.offsetWidth - 4);
		var maxT = Math.max(0, window.innerHeight - 60);
		left = Math.min(Math.max(0, left), maxL);
		top = Math.min(Math.max(0, top), maxT);
		el.panel.style.left = left + 'px';
		el.panel.style.top = top + 'px';
		el.panel.style.bottom = 'auto';
	}

	function clampPanel() {
		if (!el.panel) return;
		var r = el.panel.getBoundingClientRect();
		applyPos(r.left, r.top);
	}

	function makeDraggable(panel, handle) {
		var dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
		handle.addEventListener('pointerdown', function (ev) {
			if (ev.target && ev.target.closest && ev.target.closest('button')) return;
			dragging = true;
			var r = panel.getBoundingClientRect();
			sx = ev.clientX; sy = ev.clientY; ox = r.left; oy = r.top;
			handle.setPointerCapture && handle.setPointerCapture(ev.pointerId);
			ev.preventDefault();
		});
		handle.addEventListener('pointermove', function (ev) {
			if (!dragging) return;
			var left = ox + (ev.clientX - sx);
			var top = oy + (ev.clientY - sy);
			var maxL = Math.max(0, window.innerWidth - panel.offsetWidth - 4);
			var maxT = Math.max(0, window.innerHeight - 60);
			left = Math.min(Math.max(0, left), maxL);
			top = Math.min(Math.max(0, top), maxT);
			panel.style.left = left + 'px';
			panel.style.top = top + 'px';
			panel.style.bottom = 'auto';
		});
		function stop() {
			if (!dragging) return;
			dragging = false;
			var r = panel.getBoundingClientRect();
			lsSet(LS.pos, JSON.stringify({ left: r.left, top: r.top }));
		}
		handle.addEventListener('pointerup', stop);
		handle.addEventListener('pointercancel', stop);
	}

	function setOpen(open, silent) {
		state.open = !!open;
		lsSet(LS.open, state.open ? '1' : '0');
		if (el.panel) el.panel.classList.toggle('kw-hidden', !state.open);
		if (el.launcher) el.launcher.classList.toggle('kw-hidden', state.open);
		if (state.open) {
			if (el.panel) clampPanel();
			if (state.tab === 'marches' && (!state.fetchedAt || Date.now() - state.fetchedAt > 30000)) refreshMarches();
			if (state.tab === 'buildings' && !state.buildings.length) loadBuildings();
			if (state.tab === 'smithy') {
				if (!state.castles.length) loadCastles(true);
				else syncSmithyLevels(false);
			}
			if (state.tab === 'castles' && !state.castles.length) loadCastles(true);
			if (state.tab === 'province' && !state.pvAt) loadProvince(false);
			if (!state.castlesAt || Date.now() - state.castlesAt > CASTLES_TTL) loadCastles(true);
		}
		syncAutoTimer();
	}

	function setTab(tab, silent) {
		state.tab = tab;
		lsSet(LS.tab, tab);
		Array.prototype.forEach.call(document.querySelectorAll('#kw-panel .kw-tab'), function (b) {
			b.classList.toggle('active', b.getAttribute('data-tab') === tab);
		});
		Array.prototype.forEach.call(document.querySelectorAll('#kw-panel .kw-pane'), function (p) {
			p.classList.toggle('kw-hidden', p.getAttribute('data-pane') !== tab);
		});
		if (tab === 'buildings' && !state.buildings.length && !silent) loadBuildings();
		if (tab === 'smithy') {
			if (!state.castles.length) loadCastles(true);
			renderSmithy();
			if (state.castles.length && state.smithyCastleId) syncSmithyLevels(false);
		}
		if (tab === 'buildings') { renderBuildQueue(); renderAbStatus(); renderAbLog(); }
		if (tab === 'castles' && !silent && !state.castles.length) loadCastles(true);
		if (tab === 'province') {
			renderProvince();
			renderPvLog();
			if (!silent && !state.pvAt && !state.pvLoading) loadProvince(false);
		}
		if (tab === 'marches' && !silent && state.open && (!state.fetchedAt || Date.now() - state.fetchedAt > 15000)) refreshMarches();
		if (tab === 'raw') renderJson();
	}

	/* ============================================================
	 * الحداد: قراءة المستويات والطابور دون تغييره، وتنفيذ طلب التطوير
	 * على القلعة المختارة. الداشبورد القديمة وحدها تدير عناصر الطابور.
	 * ============================================================ */
	var SMITHY_TYPES = [1, 5, 2, 4, 3];
	var SMITHY_MAX_LEVEL = 10;
	var SMITHY_MAX_QUEUE = 2;
	var SMITHY_SYNC_TTL = 60000;
	var SMITHY_MAX_TIMER_CHECK_MS = 10 * 60 * 1000;
	var SMITHY_QUEUE_KEY = 'smithUpgradeQueue';

	function smithyDataKey(castleId) { return 'kw.smithy.data.' + String(castleId); }

	function smithyReadData(castleId) {
		var data = readJsonLS(smithyDataKey(castleId), { levels: {}, types: {}, at: 0, queueCount: null, queueItems: [], queueAt: 0 });
		if (!Array.isArray(data.queueItems)) data.queueItems = [];
		return data;
	}

	function smithyQueueSummary(data) {
		var count = toInt(data.queueCount, 0) || 0;
		var summary = 'الخانات ' + count + '/' + SMITHY_MAX_QUEUE;
		if (data.queueItems && data.queueItems.length && data.queueAt) {
			var remain = Math.max(0, toInt(data.queueItems[0].remain, 0) - Math.floor((Date.now() - data.queueAt) / 1000));
			summary += ' — أول عنصر ينتهي بعد ' + formatSeconds(remain);
		}
		return summary;
	}

	function smithyFirstRemain(data) {
		if (!data.queueItems || !data.queueItems.length || !data.queueAt) return null;
		return Math.max(0, toInt(data.queueItems[0].remain, 0) - Math.floor((Date.now() - data.queueAt) / 1000));
	}

	/* طابور الحداد الحقيقي من bottomBar (bar_type=3)، مع المؤقّتات دون DOM الصفحة. */
	function fetchSmithyQueueInfo() {
		return new Promise(function (resolve, reject) {
			if (!hasAjax()) { reject(new Error('no-ajax')); return; }
			new window.Ajax.Request('ajax_bottomBar.php', {
				evalJS: false,
				method: 'post',
				parameters: { type: 'load', bar_type: 3 },
				onSuccess: function (response) {
					try {
						var payload = JSON.parse(response.responseText || '{}');
						var timers = payload && payload.data && payload.data.timers;
						if (!timers || typeof timers !== 'object') throw new Error('بيانات طابور الحداد غير موجودة');
						var buildTimes = payload.data.buildTimes || {};
						var ids = Object.keys(timers).sort(function (a, b) { return Number(a) - Number(b); });
						resolve({ count: ids.length, at: Date.now(), items: ids.map(function (id) {
							return { id: id, remain: toInt(timers[id], 0), total: toInt(buildTimes[id], 0) };
						}) });
					} catch (error) { reject(error); }
				},
				onFailure: function (response) { reject(new Error('HTTP ' + response.status)); }
			});
		});
	}

	function smithyReadQueue() {
		var q = readJsonLS(SMITHY_QUEUE_KEY, []);
		return Array.isArray(q) ? q.filter(function (x) {
			return Array.isArray(x) && toInt(x[0]) > 0 && (toInt(x[1]) === 0 || toInt(x[1]) === 1);
		}) : [];
	}

	function smithySentKey(castleId) { return 'kw.smithy.sent.' + String(castleId); }

	function smithyItemKey(item, queue, index) {
		var id = String(item[0]), type = String(toInt(item[1]) === 1 ? 1 : 0), occurrence = 0;
		for (var i = 0; i < index; i++) {
			if (String(queue[i][0]) === id && String(toInt(queue[i][1]) === 1 ? 1 : 0) === type) occurrence++;
		}
		return id + ':' + type + ':' + occurrence;
	}

	function smithyReadSent(castleId) {
		var sent = readJsonLS(smithySentKey(castleId), {});
		return sent && typeof sent === 'object' && !Array.isArray(sent) ? sent : {};
	}

	function smithyItemState(item, queue, index, castleId) {
		if (!castleId) return 'بانتظار التنفيذ';
		var entry = smithyReadSent(castleId)[smithyItemKey(item, queue, index)];
		if (!entry) return 'بانتظار التنفيذ';
		return entry.skipped === 'max-level' ? 'الحد الأقصى — متخطّى' : 'أُرسل — الطابور للداشبورد';
	}

	function smithyPruneSent(castleId, queue) {
		var sent = smithyReadSent(castleId), keep = {};
		queue.forEach(function (item, index) { keep[smithyItemKey(item, queue, index)] = true; });
		Object.keys(sent).forEach(function (key) { if (!keep[key]) delete sent[key]; });
		localStorage.setItem(smithySentKey(castleId), JSON.stringify(sent));
		return sent;
	}

	function smithySelectedCastle() {
		var id = String(state.smithyCastleId || '');
		for (var i = 0; i < state.castles.length; i++) {
			if (String(state.castles[i].id) === id) return state.castles[i];
		}
		return null;
	}

	function renderSmithy() {
		if (!el.smithCastle) return;
		var count = state.castles.length;
		var selected = String(state.smithyCastleId || '');
		if (count === 1) {
			selected = String(state.castles[0].id);
			state.smithyCastleId = selected;
			lsSet(LS.smithyCastle, selected);
		}
		if (count > 0) lsSet(LS.smithyCastleCount, String(count));
		var options = count > 1 ? '<option value="">— اختر قلعة التطوير (ي-8-) —</option>' : '';
		for (var i = 0; i < count; i++) {
			var c = state.castles[i];
			options += '<option value="' + esc(c.id) + '">' + esc(c.name || ('#' + c.id)) +
				(c.coords ? ' (' + esc(c.coords) + ')' : '') + (c.isCapital ? ' — العاصمة' : '') + '</option>';
		}
		el.smithCastle.innerHTML = options || '<option value="">— حمّل القلاع —</option>';
		el.smithCastle.value = selected;
		el.smithCastle.disabled = count <= 1;
		var chosen = smithySelectedCastle();
		if (el.smithCastleLabel) {
			el.smithCastleLabel.innerHTML = chosen
				? 'قلعة التطوير: <b>' + esc(chosen.name) + '</b> <span class="kw-id">#' + esc(chosen.id) + '</span>'
				: (count > 1 ? 'اختر العاصمة «ي-8-» التي ستُنفّذ فيها ترقيات الحداد.' : 'بانتظار تحميل قائمة القلاع.');
		}
		if (el.smithStatus && !state.smithyBusy && !state.smithyLoading) {
			el.smithStatus.textContent = state.smithyStatus || (chosen ? 'جاهز' : 'اختر قلعة التطوير أولاً');
		}
		var data = chosen ? smithyReadData(chosen.id) : { levels: {}, types: {}, at: 0 };
		state.smithyLevels = data.levels || {};
		state.smithyTypes = data.types || {};
		var ids = Object.keys(state.smithyLevels);
		if (el.smithLevels) {
			if (!ids.length) {
				el.smithLevels.innerHTML = '';
				el.smithLevels.style.display = 'none';
				el.smithEmpty.style.display = '';
				el.smithEmpty.textContent = chosen ? 'لا توجد مستويات محفوظة. اضغط «تحديث المستويات».' : 'اختر قلعة التطوير ثم اضغط «تحديث المستويات». ';
			} else {
				el.smithLevels.style.display = '';
				el.smithEmpty.style.display = 'none';
				var body = '<thead><tr><th>الوحدة</th><th>المعرّف</th><th>الهجوم</th><th>الدفاع</th></tr></thead><tbody>';
				ids.sort(function (a, b) { return Number(a) - Number(b); }).forEach(function (id) {
					var u = state.smithyLevels[id] || {};
					body += '<tr><td>' + esc(u.name || ('وحدة #' + id)) + '</td><td class="kw-id">' + esc(id) + '</td><td>' + esc(u.attack) + '</td><td>' + esc(u.defense) + '</td></tr>';
				});
				el.smithLevels.innerHTML = body + '</tbody>';
			}
		}
		var q = smithyReadQueue();
		if (chosen) smithyPruneSent(chosen.id, q);
		if (el.smithQueue) {
			if (!q.length) {
				el.smithQueue.innerHTML = '';
				el.smithQueue.style.display = 'none';
				el.smithQueueEmpty.style.display = '';
			} else {
				el.smithQueue.style.display = '';
				el.smithQueueEmpty.style.display = 'none';
				var rows = '<thead><tr><th>#</th><th>الوحدة</th><th>النوع</th><th>المستوى الحالي</th><th>الحالة</th></tr></thead><tbody>';
				q.forEach(function (item, index) {
					var id = String(item[0]), kind = toInt(item[1]) === 1 ? 'attack' : 'defense';
					var unit = state.smithyLevels[id] || {};
					var itemState = smithyItemState(item, q, index, chosen && chosen.id);
					rows += '<tr><td>' + (index + 1) + '</td><td>' + esc(unit.name || ('#' + id)) + '</td>' +
						'<td>' + (kind === 'attack' ? 'هجوم' : 'دفاع') + '</td><td>' + esc(unit[kind] == null ? '—' : unit[kind]) + '</td>' +
						'<td>' + esc(itemState) + '</td></tr>';
				});
				el.smithQueue.innerHTML = rows + '</tbody>';
			}
		}
	}

	function ensureSmithyCastle(callback) {
		if (!state.castles.length) {
			getCastles(function (res) {
				if (!res || res.error || !res.castles.length) { callback(null, 'تعذّر تحميل القلاع'); return; }
				state.castles = res.castles;
				state.smithyCastleCheckedAt = Date.now();
				var previousCount = toInt(lsGet(LS.smithyCastleCount, '0'), 0);
				if (previousCount <= 1 && state.castles.length > 1) {
					state.smithyCastleId = '';
					lsSet(LS.smithyCastle, '');
				}
				lsSet(LS.smithyCastleCount, String(state.castles.length));
				state.castlesAt = Date.now();
				var current = currentCastle();
				if (current) state.currentCastleId = String(current.id);
				saveCastlesCache();
				renderSmithy();
				ensureSmithyCastle(callback);
			});
			return;
		}
		if (Date.now() - state.smithyCastleCheckedAt > 30000) {
			getCastles(function (res) {
				if (!res || res.error || !res.castles.length) { callback(null, 'تعذّر التحقق من القلعة النشطة'); return; }
				var previousCount = toInt(lsGet(LS.smithyCastleCount, '0'), 0);
				state.castles = res.castles;
				if (previousCount <= 1 && state.castles.length > 1) {
					state.smithyCastleId = '';
					lsSet(LS.smithyCastle, '');
				}
				lsSet(LS.smithyCastleCount, String(state.castles.length));
				state.smithyCastleCheckedAt = Date.now();
				state.castlesAt = state.smithyCastleCheckedAt;
				var active = null;
				state.castles.forEach(function (c) { if (c.isCurrent) active = c; });
				if (active) state.currentCastleId = String(active.id);
				saveCastlesCache();
				renderSmithy();
				ensureSmithyCastle(callback);
			});
			return;
		}
		if (state.castles.length === 1) {
			state.smithyCastleId = String(state.castles[0].id);
			lsSet(LS.smithyCastle, state.smithyCastleId);
		}
		var target = smithySelectedCastle();
		if (!target) { callback(null, 'اختر قلعة التطوير من القائمة'); return; }
		if (String(state.currentCastleId) === String(target.id)) { callback(target, null); return; }
		if (!hasAjax()) { callback(null, 'الجلسة غير متصلة باللعبة'); return; }
		switchCastle(target.id, { silent: true, onDone: function (ok) {
			callback(ok ? target : null, ok ? null : 'تعذّر التبديل إلى قلعة التطوير');
		} });
	}

	function syncSmithyLevels(showToast, callback) {
		if (state.smithyLoading) { if (callback) callback({ error: 'busy' }); return; }
		state.smithyLoading = true;
		if (el.smithStatus) el.smithStatus.textContent = 'جارٍ قراءة مستويات الحداد…';
		renderSmithy();
		ensureSmithyCastle(function (castle, err) {
			if (!castle) {
				state.smithyLoading = false;
				state.smithyStatus = err;
				renderSmithy();
				if (callback) callback({ error: err });
				return;
			}
			Promise.all(SMITHY_TYPES.map(function (type) {
				return fetch('/upgrades.php?u_type=' + type, { credentials: 'same-origin', cache: 'no-store' })
					.then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
					.then(function (html) {
						var doc = new DOMParser().parseFromString(html, 'text/html');
						var container = doc.getElementById('upgradesList');
						if (!container) throw new Error('لم أجد قائمة التطويرات للفئة ' + type);
						var units = {};
						container.querySelectorAll('.upgradeItem').forEach(function (item) {
							var link = item.querySelector('.title a');
							if (!link) return;
							var url = new URL(link.getAttribute('href') || '', location.origin);
							var id = url.searchParams.get('posted_id');
							var lv = item.querySelectorAll('.typeLevel');
							if (!id || lv.length < 2) return;
							var attack = parseInt((lv[0].textContent || '').replace(/[^\d-]/g, ''), 10);
							var defense = parseInt((lv[1].textContent || '').replace(/[^\d-]/g, ''), 10);
							if (!Number.isFinite(attack) || !Number.isFinite(defense)) return;
							units[id] = { name: (link.textContent || '').trim() || ('#' + id), attack: attack, defense: defense };
						});
						return { type: type, units: units };
				});
			})).then(function (categories) {
				var levels = {}, types = {};
				categories.forEach(function (category) {
					Object.keys(category.units).forEach(function (id) { levels[id] = category.units[id]; types[id] = category.type; });
				});
				return fetchSmithyQueueInfo().catch(function () { return null; }).then(function (queueInfo) {
					return { levels: levels, types: types, at: Date.now(), queueCount: queueInfo ? queueInfo.count : null,
						queueItems: queueInfo ? queueInfo.items : [], queueAt: queueInfo ? queueInfo.at : 0 };
				});
			}).then(function (data) {
				localStorage.setItem(smithyDataKey(castle.id), JSON.stringify(data));
				localStorage.setItem('unitLevelsById', JSON.stringify(data.levels));
				localStorage.setItem('kwSmithyLevelsSyncAt', String(Date.now()));
				state.smithyLevels = data.levels;
				state.smithyTypes = data.types;
				state.smithyLoading = false;
				state.smithyStatus = 'تم تحديث ' + Object.keys(data.levels).length + ' وحدة' +
					(data.queueCount == null ? ' — تعذّر قراءة خانات الطابور' : ' — ' + smithyQueueSummary(data));
				renderSmithy();
				if (showToast) toast(state.smithyStatus, 'ok');
				if (callback) callback(data);
			}).catch(function (error) {
				state.smithyLoading = false;
				state.smithyStatus = 'تعذّر تحديث المستويات: ' + error.message;
				renderSmithy();
				if (showToast) toast(state.smithyStatus, 'err');
				if (callback) callback({ error: error.message });
			});
		});
	}

	function smithyAutoTick() {
		if (!state.smithyAuto || state.smithyBusy || state.smithyLoading) return;
		ensureSmithyCastle(function (castle, err) {
			if (!state.smithyAuto) return;
			if (!castle) { state.smithyStatus = err; renderSmithy(); return; }
			var data = smithyReadData(castle.id);
			var queue = smithyReadQueue();
			if (!queue.length) { state.smithyStatus = 'الطابور فارغ — ' + smithyQueueSummary(data); renderSmithy(); return; }
			if (data.queueCount == null) { state.smithyStatus = 'تعذّر قراءة خانات الحداد؛ اضغط «تحديث المستويات»'; renderSmithy(); return; }
			var available = Math.max(0, SMITHY_MAX_QUEUE - (toInt(data.queueCount, 0) || 0));
			if (!available) {
				var remain = smithyFirstRemain(data);
				/* العدّ التنازلي محلي؛ نعيد سؤال الخادم قرب انتهاء أول تطوير فقط. */
				var timerAge = data.queueAt ? Date.now() - data.queueAt : Infinity;
				if (remain != null && remain > 5 && timerAge < SMITHY_MAX_TIMER_CHECK_MS) {
					state.smithyStatus = 'بانتظار خانة شاغرة — ' + smithyQueueSummary(data);
					renderSmithy();
					return;
				}
				state.smithyBusy = true;
				fetchSmithyQueueInfo().then(function (info) {
					data.queueCount = info.count; data.queueItems = info.items; data.queueAt = info.at;
					localStorage.setItem(smithyDataKey(castle.id), JSON.stringify(data));
					state.smithyStatus = info.count < SMITHY_MAX_QUEUE ? 'خانة شاغرة — جارٍ تجهيز العنصر التالي' : 'بانتظار خانة شاغرة — ' + smithyQueueSummary(data);
				}).catch(function (error) {
					state.smithyStatus = 'تعذّر تحديث مؤقّت الحداد: ' + error.message;
				}).finally(function () {
					state.smithyBusy = false; renderSmithy();
					if (state.smithyAuto && data.queueCount < SMITHY_MAX_QUEUE) smithyAutoTick();
				});
				return;
			}
			if (!data.at || Date.now() - data.at > SMITHY_SYNC_TTL) {
				syncSmithyLevels(false);
				return;
			}
			var sent = smithyPruneSent(castle.id, queue);
			var picked = null;
			for (var qi = 0; qi < queue.length; qi++) {
				var candidate = queue[qi];
				var key = smithyItemKey(candidate, queue, qi);
				if (Object.prototype.hasOwnProperty.call(sent, key)) continue;
				var id = String(candidate[0]);
				var stat = toInt(candidate[1]) === 1 ? 'attack' : 'defense';
				var unit = data.levels[id];
				if (!unit || data.types[id] == null) {
					state.smithyStatus = 'المستويات غير محدثة أو الوحدة غير موجودة — حدّث المستويات';
					renderSmithy(); return;
				}
				if (toInt(unit[stat], 0) >= SMITHY_MAX_LEVEL) {
					sent[key] = { at: Date.now(), skipped: 'max-level' };
					continue;
				}
				picked = { item: candidate, key: key, unitId: id, stat: stat, category: data.types[id], before: toInt(unit[stat], 0) };
				break;
			}
			if (!picked) {
				localStorage.setItem(smithySentKey(castle.id), JSON.stringify(sent));
				state.smithyStatus = 'كل عناصر الطابور أُرسلت أو بلغت الحد الأقصى؛ الطابور بقي دون تعديل — ' + smithyQueueSummary(data); renderSmithy(); return;
			}
			state.smithyBusy = true;
			state.smithyStatus = 'التحقق من خانات الحداد قبل الإرسال…';
			renderSmithy();
			var url = '/upgrades.php?up_id=' + encodeURIComponent(picked.unitId) +
				'&type=' + encodeURIComponent(picked.item[1]) + '&u_type=' + encodeURIComponent(picked.category);
			fetchSmithyQueueInfo().then(function (queueInfo) {
				var currentCount = queueInfo.count;
				data.queueCount = currentCount; data.queueItems = queueInfo.items; data.queueAt = queueInfo.at;
				localStorage.setItem(smithyDataKey(castle.id), JSON.stringify(data));
				if (currentCount >= SMITHY_MAX_QUEUE) {
					state.smithyStatus = 'طابور الحداد ممتلئ — ' + smithyQueueSummary(data) + ' — لم أرسل أمراً';
					state.smithyBusy = false;
					renderSmithy();
					return;
				}
				withVerifiedCastle(castle.id, function (releaseCastleLock) {
					state.smithyStatus = 'إرسال تطوير ' + (data.levels[picked.unitId].name || picked.unitId) + ' (' + currentCount + '/' + SMITHY_MAX_QUEUE + ')…';
					renderSmithy();
					fetch(url, { method: 'GET', credentials: 'same-origin', cache: 'no-store' })
					.then(function (response) {
						if (!response.ok) throw new Error('HTTP ' + response.status);
					if (response.redirected && /login|signin/i.test(response.url)) throw new Error('انتهت جلسة اللعبة');
					return response.text();
				})
					.then(function (text) {
						var payload = null;
						try { payload = JSON.parse(text); } catch (_) { /* رد اللعبة قد يكون HTML */ }
						var gameError = payload && payload.data && payload.data.error != null ? payload.data.error : (payload && payload.error);
						if (gameError === true || (gameError != null && String(gameError) !== '0' && String(gameError) !== 'false')) {
							throw new Error((payload && (payload.error_txt || payload.message)) || String(gameError));
						}
						sent[picked.key] = { at: Date.now(), before: picked.before, unitId: picked.unitId, type: picked.item[1] };
						localStorage.setItem(smithySentKey(castle.id), JSON.stringify(sent));
						data.queueCount = currentCount + 1;
						data.at = 0;
						localStorage.setItem(smithyDataKey(castle.id), JSON.stringify(data));
						state.smithyStatus = 'أُرسل الأمر؛ ' + data.queueCount + '/' + SMITHY_MAX_QUEUE + ' والطابور المحلي لم يتغير';
					})
					.catch(function (error) {
						state.smithyStatus = 'فشل التطوير، أبقيت العنصر بالطابور: ' + error.message;
					})
						.finally(function () { releaseCastleLock(); state.smithyBusy = false; renderSmithy(); });
				}, function () {
					state.smithyStatus = 'تغيّرت القلعة النشطة؛ لم أرسل تطوير الحداد';
					state.smithyBusy = false;
					renderSmithy();
				});
			}).catch(function (error) {
				state.smithyStatus = 'تعذّر التحقق من خانات الحداد؛ لم أرسل أمراً: ' + error.message;
				state.smithyBusy = false;
				renderSmithy();
			});
		});
	}

	function setSmithyAuto(on) {
		state.smithyAuto = !!on;
		lsSet(LS.smithyAuto, state.smithyAuto ? '1' : '0');
		if (state.smithyTimer) { clearInterval(state.smithyTimer); state.smithyTimer = null; }
		if (state.smithyAuto) {
			state.smithyTimer = setInterval(smithyAutoTick, 5000);
			smithyAutoTick();
		}
		if (el.smithAuto) el.smithAuto.checked = state.smithyAuto;
		state.smithyStatus = state.smithyAuto ? 'التطوير التلقائي يعمل' : 'التطوير التلقائي متوقف';
		renderSmithy();
	}

	function toast(msg, kind) {
		if (!el.toast) return;
		el.toast.textContent = msg;
		el.toast.className = 'kw-toast show' + (kind ? ' ' + kind : '');
		clearTimeout(toast._t);
		toast._t = setTimeout(function () {
			el.toast.className = 'kw-toast';
		}, 2600);
	}

	function setDot(kind) {
		if (!el.dot) return;
		el.dot.className = 'kw-dot' + (kind ? ' ' + kind : '');
	}

	function renderMeta() {
		if (!el.meta) return;
		if (state.loading) { el.meta.textContent = 'جارٍ التحميل…'; return; }
		if (state.error) { el.meta.textContent = 'خطأ: ' + state.error; return; }
		if (!state.fetchedAt) { el.meta.textContent = '—'; return; }
		var marches = Array.isArray(state.marches) ? state.marches : [];
		var secs = Math.max(0, Math.round((Date.now() - state.fetchedAt) / 1000));
		var src = state.source === 'loadContent' ? 'loadContent' : 'ajax';
		var statusLine =
			'آخر تحديث: ' + formatSeconds(secs) + ' مضت • ' +
			marches.length + ' إرسالية' +
			(state.pending.length ? ' • ' + state.pending.length + ' معلّقة' : '') +
			' • ' + src;
		var detailCards = marches.map(function (m) { return renderMarchCard(m); }).join('');
		el.meta.innerHTML = '<div class="kw-march-status">' + esc(statusLine) + '</div>' +
			(detailCards ? '<div class="kw-march-status-list" role="list">' + detailCards + '</div>' : '');
		el.meta.style.whiteSpace = 'normal';
		el.meta.style.display = 'block';
		el.meta.style.flexBasis = marches.length ? '100%' : '';
		el.meta.style.width = marches.length ? '100%' : '';
		el.meta.style.maxHeight = marches.length > 2 ? '220px' : '';
		el.meta.style.overflowY = marches.length > 2 ? 'auto' : '';
	}

	/* ---------- جدول الإرساليات ---------- */

	function typeBadge(m) {
		var cls = m.type || 'other';
		var label = m.typeLabel || (m.type ? m.type : 'غير معروف');
		return '<span class="kw-badge ' + cls + '">' + esc(label) + '</span>';
	}

	function renderMarchCard(m) {
		var progress = (m.progress != null) ? m.progress : computeProgress(m.timeRemaining, m.marchTime);
		var pct = progress == null ? 0 : progress;
		var direction = m.direction === 'incoming' ? 'وارد' : (m.direction === 'outgoing' ? 'صادر' : 'اتجاه غير محدد');
		var directionClass = m.direction === 'incoming' ? 'attack' : 'other';
		return '<div class="kw-march-card' + (m.incomingAttack ? ' kw-incoming-attack' : '') + '" role="listitem" data-kw-row="' + esc(m.id) + '" data-kw-incoming-attack="' + (m.incomingAttack ? '1' : '0') + '">' +
			'<div class="kw-march-top"><span class="kw-march-id">إرسالية #' + esc(m.id) + '</span><span class="kw-march-badges">' + typeBadge(m) +
			'<span class="kw-badge ' + directionClass + '">' + direction + '</span></span></div>' +
			'<div class="kw-march-participants" dir="rtl"><div class="kw-march-party"><span class="kw-march-party-label">المرسل</span><span class="kw-march-party-name" dir="auto">' + esc(m.sender || '—') + '</span></div>' +
			'<span class="kw-march-arrow">←</span><div class="kw-march-party"><span class="kw-march-party-label">المستقبل</span><span class="kw-march-party-name" dir="auto">' + esc(m.receiver || '—') + '</span></div></div>' +
			'<div class="kw-march-route"><span>المسار</span><span class="kw-march-route-value">' + esc(m.from || '—') + ' → ' + esc(m.to || '—') + '</span></div>' +
			'<div class="kw-march-grid">' +
			'<div class="kw-march-field"><span class="kw-march-label">القلعة المستهدفة</span><span class="kw-march-value" dir="ltr">' + esc(m.targetCastle || m.to || '—') + '</span></div>' +
			'<div class="kw-march-field"><span class="kw-march-label">المتبقي</span><span class="kw-march-value" dir="ltr" data-kw-left="' + esc(m.id) + '" data-kw-base="' + esc(m.timeRemaining) + '" data-kw-total="' + esc(m.marchTime) + '">' + esc(m.timeFormatted || formatSeconds(m.timeRemaining)) + '</span></div>' +
			'<div class="kw-march-field"><span class="kw-march-label">الوصول</span><span class="kw-march-value" dir="ltr">' + esc(m.marchTimeFormatted || (m.marchTime != null ? formatSeconds(m.marchTime) : '—')) + '</span></div>' +
			'<div class="kw-march-field"><span class="kw-march-label">العودة</span><span class="kw-march-value" dir="ltr">' + fmtReturn(m.returnTime) + '</span></div>' +
			'<div class="kw-march-extra"><span>الجيش: ' + (m.population != null ? fmtNum(m.population) : '—') + '</span><span>الحمولة: ' + (m.cargo != null ? fmtNum(m.cargo) : '—') + '</span></div>' +
			'</div>' +
			'<div class="kw-bar"><i data-kw-bar="' + esc(m.id) + '" style="width:' + pct + '%"></i></div></div>';
	}

	function fmtReturn(ts) {
		if (!ts) return '—';
		var m = String(ts).match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
		if (!m) return esc(ts);
		var now = new Date();
		var sameDay = (now.getFullYear() === +m[1] && (now.getMonth() + 1) === +m[2] && now.getDate() === +m[3]);
		return sameDay ? (m[4] + ':' + m[5] + ':' + m[6]) : (m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5]);
	}

	function ensureMarchRenderNodes() {
		if (!el.panel) return false;
		var pane = el.panel.querySelector('[data-pane="marches"]');
		if (!pane) return false;
		var wrap = pane.querySelector('.kw-table-wrap');
		if (!wrap) {
			wrap = document.createElement('div');
			wrap.className = 'kw-table-wrap';
			pane.appendChild(wrap);
		}
		var list = pane.querySelector('#kw-marches');
		if (!list) {
			list = document.createElement('div');
			list.id = 'kw-marches';
			list.className = 'kw-table-wrap kw-march-list';
			list.setAttribute('role', 'list');
			wrap.appendChild(list);
		}
		var empty = pane.querySelector('#kw-marches-empty');
		if (!empty) {
			empty = document.createElement('div');
			empty.id = 'kw-marches-empty';
			empty.className = 'kw-empty';
			empty.textContent = 'لا توجد إرساليات نشطة.';
			pane.appendChild(empty);
		}
		el.marchesWrap = wrap;
		el.marchesList = list;
		el.marchesEmpty = empty;
		el.marchAlert = pane.querySelector('#kw-march-alert') || el.marchAlert;
		return true;
	}

	function renderMarches() {
		if (!ensureMarchRenderNodes()) return;
		var rows = Array.isArray(state.marches) ? state.marches : [];
		var hasRows = rows.length > 0;
		if (el.marchesEmpty) {
			el.marchesEmpty.hidden = hasRows;
			el.marchesEmpty.style.setProperty('display', hasRows ? 'none' : 'block', 'important');
		}
		el.marchesList.hidden = !hasRows;
		el.marchesList.style.setProperty('display', hasRows ? 'block' : 'none', 'important');
		if (el.marchesWrap) {
			el.marchesWrap.hidden = true;
			el.marchesWrap.style.setProperty('display', 'none', 'important');
		}
		var incoming = rows.filter(function (m) { return !!m.incomingAttack; });
		if (el.marchAlert) {
			if (incoming.length) {
				var targets = incoming.map(function (m) { return m.targetCastle || m.to || 'قلعتك'; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
				el.marchAlert.textContent = '⚠ هجوم قادم: ' + incoming.length + ' — القلعة المستهدفة: ' + targets.join('، ') + ' (تنبيه محلي؛ ربط تيليغرام لاحقاً)';
				el.marchAlert.style.display = 'block';
			} else {
				el.marchAlert.textContent = '';
				el.marchAlert.style.display = 'none';
			}
		}
		if (!rows.length) {
			el.marchesList.innerHTML = '';
			if (el.marchesEmpty) el.marchesEmpty.textContent = state.error ? ('تعذّر التحميل: ' + state.error) : 'لا توجد إرساليات نشطة.';
			return;
		}

		var body = rows.map(renderMarchCard).join('');

		el.marchesList.innerHTML = body;
	}

	function tickMarches() {
		if (!state.open || state.tab !== 'marches' || !state.marches.length || !state.fetchedAt) return;
		var elapsed = (Date.now() - state.fetchedAt) / 1000;
		var allDone = true;
		state.marches.forEach(function (m) {
			var left = Math.max(0, (m.timeRemaining || 0) - elapsed);
			var cell = document.querySelector('#kw-panel [data-kw-left="' + m.id + '"]');
			var bar = document.querySelector('#kw-panel [data-kw-bar="' + m.id + '"]');
			if (cell) {
				cell.textContent = left > 0 ? formatSeconds(left) : 'انتهت';
			}
			var total = m.marchTime;
			if (bar && total) {
				var pct = 0;
				if (left > 0) {
					pct = computeProgress(left, total);
				} else {
					pct = 100;
				}
				bar.style.width = pct + '%';
			}
			if (left > 0) allDone = false;
			var row = document.querySelector('#kw-panel [data-kw-row="' + m.id + '"]');
			if (row) row.classList.toggle('kw-done', left <= 0);
		});
		renderMeta();
		if (state.autoBuild && state.open && state.tab === 'buildings') renderAbStatus();
		if (allDone && !state.loading && Date.now() - state.doneRefreshAt > 8000) {
			state.doneRefreshAt = Date.now();
			setTimeout(function () { refreshMarches(); }, 1500);
		}
	}

	/* ---------- المباني ---------- */

	function renderBuildings() {
		if (!el.buildingsTable) return;
		var rows = state.buildings;
		if (!rows.length) {
			el.buildingsTable.innerHTML = '';
			el.buildingsTable.style.display = 'none';
			el.buildingsEmpty.style.display = '';
			el.buildingsEmpty.textContent = state.buildingsError ? ('تعذّر التحميل: ' + state.buildingsError) : 'اضغط «تحميل / تحديث».';
			return;
		}
		el.buildingsEmpty.style.display = 'none';
		el.buildingsTable.style.display = '';

		var head = '<thead><tr>' +
			'<th>المبنى</th>' +
			'<th>المستوى</th>' +
			'<th>التالي</th>' +
			'<th>التكلفة</th>' +
			'<th>الوقت</th>' +
			'<th></th>' +
			'</tr></thead>';

		var body = '<tbody>' + rows.map(function (b) {
			var costs = [];
			if (b.costs && b.costs.gold != null) costs.push('🪙' + fmtNum(b.costs.gold));
			if (b.costs && b.costs.iron != null) costs.push('⛏' + fmtNum(b.costs.iron));
			if (b.costs && b.costs.wood != null) costs.push('🪵' + fmtNum(b.costs.wood));
			if (b.costs && b.costs.food != null) costs.push('🌾' + fmtNum(b.costs.food));
			return '<tr data-kw-b="' + esc(b.id) + '">' +
				'<td>' + esc(b.name) + '</td>' +
				'<td class="kw-total">' + (b.level != null ? b.level : '—') + '</td>' +
				'<td>' + (b.nextLevel != null ? b.nextLevel : '—') + '</td>' +
				'<td class="kw-cost">' + (costs.join(' ') || '—') + '</td>' +
				'<td class="kw-time">' + esc(b.timeText || '—') + '</td>' +
				'<td><button class="kw-up" data-kw-up="' + esc(b.id) + '" ' + (b.canUpgrade ? '' : 'disabled') + '>ترقية</button></td>' +
				'</tr>';
		}).join('') + '</tbody>';

		el.buildingsTable.innerHTML = head + body;

		Array.prototype.forEach.call(el.buildingsTable.querySelectorAll('[data-kw-up]'), function (btn) {
			btn.addEventListener('click', function () {
				var id = toInt(btn.getAttribute('data-kw-up'));
				var b = findBuilding(id);
				var label = b ? (b.name + ' (مستوى ' + b.level + ' → ' + (b.nextLevel != null ? b.nextLevel : '?')) + ')' : ('#' + id);
				if (!window.confirm('ترقية ' + label + '؟')) return;
				btn.disabled = true;
				btn.textContent = '…';
				upgradeBuilding(id, function (res) {
					var ok = res && String(res.error) === '0';
					if (ok) {
						toast('تم إرسال الترقية ✓', 'ok');
					} else {
						var msg = (res && (res.error_txt || res.httpError || res.error || res.parseError)) || 'خطأ غير معروف';
						toast('فشل: ' + msg, 'err');
					}
					setTimeout(function () { loadBuildings(true); }, 1200);
				});
			});
		});
	}

	function findBuilding(id) {
		for (var i = 0; i < state.buildings.length; i++) {
			if (state.buildings[i].id === id) return state.buildings[i];
		}
		return null;
	}

	/* ============================================================
	 * 3.5) البناء الآلي — منفّذ طابور البناء
	 * ============================================================
	 * الطابور يجهّزه "KhanWars Build Queue Manager" في localStorage،
	 * ونحن نقرأه وننفّذه فقط (لا إضافة/حذف/ترتيب من اللوحة):
	 *   khanBuildQueues[revIdx]  ← المصدر
	 *   revIdx = 11 - عدد القلاع + (رقم القلعة 1-based)
	 *   قائمة القلاع (الاسم + المعرّف) تُقرأ من ajax_castles.php مرة واحدة
	 *   وتُخزَّن في kw.castlesCache (صلاحية 5 دقائق) → أقل حمل ممكن على المتصفح.
	 *
	 * التنفيذ: buildings.php?tb_id=N&method=ajax من أي صفحة،
	 * بدون فتح buildings.php وبدون إعادة تحميل الصفحة.
	 */

	function readJsonLS(key, fallback) {
		try {
			var v = JSON.parse(localStorage.getItem(key));
			return v || fallback;
		} catch (e) { return fallback; }
	}

	function loadQueues() {
		var obj = readJsonLS('khanBuildQueues', {});
		return (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : {};
	}

	function saveQueues(obj) {
		try { localStorage.setItem('khanBuildQueues', JSON.stringify(obj)); } catch (e) { /* ignore */ }
	}

	/* ---------- القلاع: الاسم + المعرّف من طلب القلاع نفسه ----------
	   نقرأ ajax_castles.php مرة واحدة فقط (يُستخدم أصلاً لتبويب القلاع)
	   ونحفظ النتيجة في localStorage (kw.castlesCache) لأقل حمل ممكن على المتصفح،
	   ثم نحدّثها كل 5 دقائق أو بعد تبديل القلعة.
	   لا نعتمد على نصوص castle_name ولا على أي مطابقة أسماء. */

	var CASTLES_TTL = 300000;

	/* أسماء القلاع ومعرّفاتها في نفس المتغيرين الذين يستخدمهما كود القلاع القديم
	   (ويعتمد عليهما مدير الطابور لبناء قائمة القلاع): castle_name / castle_id */
	function saveCastleVars() {
		if (!state.castles.length) return;
		var names = [], ids = [];
		for (var i = 0; i < state.castles.length; i++) {
			var c = state.castles[i];
			names.push(String(c.name || ('#' + c.id)));
			ids.push(toInt(c.id));
		}
		try {
			localStorage.setItem('castle_name', JSON.stringify(names));
			localStorage.setItem('castle_id', JSON.stringify(ids));
		} catch (e) { /* ignore */ }
	}

	function saveCastlesCache() {
		saveCastleVars();
		try {
			localStorage.setItem('kw.castlesCache', JSON.stringify({
				at: state.castlesAt || Date.now(),
				current: state.currentCastleId || null,
				list: state.castles.map(function (c) {
					return { id: c.id, name: c.name, coords: c.coords, isCurrent: !!c.isCurrent };
				})
			}));
		} catch (e) { /* ignore */ }
	}

	function hydrateCastlesCache() {
		var cache = readJsonLS('kw.castlesCache', null);
		if (!cache || !Array.isArray(cache.list) || !cache.list.length) return false;
		state.castles = cache.list;
		if (cache.current) state.currentCastleId = String(cache.current);
		state.castlesAt = toInt(cache.at) || 0;
		var cur = currentCastle();
		if (cur) state.currentCastleId = String(cur.id);
		/* حتى لو الكاش محفوظ من نسخة أقدم: نضمن وجود castle_name / castle_id */
		if (!readJsonLS('castle_name', null) || !readJsonLS('castle_id', null)) saveCastleVars();
		return true;
	}

	/* ترتيب القلاع = ترتيب طلب القلاع (id + name) */
	function castleList() {
		return state.castles.map(function (c) {
			return { id: c.id, name: c.name, coords: c.coords, isCurrent: !!c.isCurrent };
		});
	}

	function castleIndexInList() {
		var id = String(state.currentCastleId || '');
		var i;
		for (i = 0; i < state.castles.length; i++) {
			if (String(state.castles[i].id) === id) return i;
		}
		for (i = 0; i < state.castles.length; i++) {
			if (state.castles[i].isCurrent) return i;
		}
		return -1;
	}

	/* revIdx = 11 - عدد القلاع + (رقم القلعة 1-based) */
	function keyForIndex(total, idx0) {
		return String(11 - total + (idx0 + 1));
	}

	function castleQueueKey() {
		if (!state.castles.length) return null;
		var idx = castleIndexInList();
		if (idx < 0) return null;
		return keyForIndex(state.castles.length, idx);
	}

	/* اسم + معرّف القلعة النشطة + مفتاح طابورها */
	function currentCastleInfo() {
		var idx = castleIndexInList();
		if (idx < 0) return null;
		var c = state.castles[idx];
		return {
			id: c.id,
			name: c.name || ('#' + c.id),
			coords: c.coords || '',
			index: idx,
			total: state.castles.length,
			key: keyForIndex(state.castles.length, idx)
		};
	}

	/* احتياطي: مفتاح واحد فقط غير فاضي في khanBuildQueues */
	function fallbackQueueKey() {
		var queues = loadQueues();
		var keys = [];
		for (var k in queues) {
			if (!Object.prototype.hasOwnProperty.call(queues, k)) continue;
			if (Array.isArray(queues[k]) && queues[k].length) keys.push(k);
		}
		return keys.length === 1 ? keys[0] : null;
	}

	function normalizeQueue(arr) {
		return (arr || []).map(function (v) { return toInt(v); })
			.filter(function (v) { return v > 0; });
	}

	function queueForKey(key) {
		var queues = loadQueues();
		return Array.isArray(queues[key]) ? normalizeQueue(queues[key]) : [];
	}

	/* يعيد { key, items } للمفتاح الفعلي المستخدم (مع احتياطي المفتاح الوحيد) */
	function queueInfo() {
		var key = castleQueueKey();
		var alt = fallbackQueueKey();

		if (key === null) {
			return alt === null ? null : { key: alt, items: queueForKey(alt) };
		}
		var items = queueForKey(key);
		if (!items.length && alt !== null && alt !== key) {
			return { key: alt, items: queueForKey(alt) };
		}
		return { key: key, items: items };
	}

	function currentQueue() {
		var info = queueInfo();
		return info ? info.items : null;
	}

	/* يُستدعى فقط بعد التحقق من نجاح الترقية (بمقارنة المستوى)
	   أو بعد استلام مكافأة المهمة. key اختياري لتثبيت الطابور الذي أُرسل منه. */
	function consumeQueueItem(id, key) {
		var info = (key != null) ? { key: String(key) } : queueInfo();
		if (!info) return;
		var queues = loadQueues();
		var q = normalizeQueue(queues[info.key]);
		var at = -1;
		for (var i = 0; i < q.length; i++) {
			if (toInt(q[i]) === toInt(id)) { at = i; break; }
		}
		if (at < 0) return;
		q.splice(at, 1);
		queues[info.key] = q;
		saveQueues(queues);
		renderBuildQueue();
	}

	/* ---------- ترقية مُرسلة تنتظر تأكيد المستوى ----------
	 * نحفظها في localStorage حتى لا تضيع عند إعادة تحميل الصفحة،
	 * هي الدليل الوحيد على أن الترقية فعلاً تمّت (مقارنة المستوى قبل/بعد).
	 */
	var PENDING_KEY = 'kw.pendingBuilds';

	function loadPendingBuilds() {
		var arr = readJsonLS(PENDING_KEY, []);
		if (!Array.isArray(arr)) arr = [];
		var out = [];
		for (var i = 0; i < arr.length; i++) {
			var p = arr[i] || {};
			var id = toInt(p.id);
			var before = toInt(p.before);
			if (!id || id < 1 || before == null || before < 0) continue;
			out.push({
				id: id,
				name: String(p.name || ('#' + id)),
				before: before,
				sentAt: toInt(p.sentAt, 0) || 0,
				castleId: p.castleId != null ? String(p.castleId) : null,
				key: p.key != null ? String(p.key) : null,
				tries: toInt(p.tries, 0) || 0,
				levelFails: toInt(p.levelFails, 0) || 0,
				uncertain: !!p.uncertain
			});
		}
		state.pendingBuilds = out;
	}

	function savePendingBuilds() {
		try { localStorage.setItem(PENDING_KEY, JSON.stringify(state.pendingBuilds)); } catch (e) { /* ignore */ }
	}

	/* عملية مهارة أُرسلت وتنتظر تأكيد ارتفاع المستوى (مثل pendingBuilds).
	   وجودها يمنع تنفيذ المهارة مرتين لو ضاع ردّ السيرفر أو أُعيد تحميل الصفحة. */
	function loadPendingSkill() {
		var p = readJsonLS(SKILL_PENDING_KEY, null);
		if (!p || typeof p !== 'object') return null;
		if (toInt(p.id) !== SKILL_ITEM_ID) return null;
		var before = toInt(p.before);
		if (before == null || before < 0) return null;
		return {
			id: SKILL_ITEM_ID,
			skillId: toInt(p.skillId, SKILL_ID),
			before: before,
			sentAt: toInt(p.sentAt, 0) || 0,
			castleId: p.castleId != null ? String(p.castleId) : null,
			key: p.key != null ? String(p.key) : null
		};
	}

	function savePendingSkill(p) {
		state.pendingSkill = p || null;
		try {
			if (p) localStorage.setItem(SKILL_PENDING_KEY, JSON.stringify(p));
			else localStorage.removeItem(SKILL_PENDING_KEY);
		} catch (e) { /* ignore */ }
	}

	function addPendingBuild(p) {
		state.pendingBuilds.push(p);
		savePendingBuilds();
	}

	function removePendingBuild(p) {
		for (var i = state.pendingBuilds.length - 1; i >= 0; i--) {
			if (state.pendingBuilds[i] === p) {
				state.pendingBuilds.splice(i, 1);
				break;
			}
		}
		savePendingBuilds();
	}

	/* تسمية عنصر الطابور — نفس تقسيم مدير الطابور */
	function queueItemLabel(id) {
		id = toInt(id);
		if (id > 100) {
			if (id === SKILL_ITEM_ID) return 'مهارة ' + (SKILL_NAMES[SKILL_ID] || ('#' + SKILL_ID)) + ' #' + id;
			if (id >= QUEST_STEP_MIN && id <= QUEST_STEP_MAX) return 'مكافأة #' + id;
			return 'عنصر #' + id;
		}
		var b = findBuilding(id);
		return b ? b.name : ('مبنى #' + id);
	}

	function renderBuildQueue() {
		if (!el.buildQueue) return;
		var info = queueInfo();
		var cur = currentCastleInfo();

		/* سطر التعريف: اسم القلعة + معرّفها + مفتاح طابورها */
		var head = '';
		if (cur) {
			head = '<div class="kw-qhead">القلعة: <b>' + esc(cur.name) + '</b> ' +
				'<span class="kw-id">#' + esc(cur.id) + '</span>' +
				(cur.coords ? ' <span class="kw-meta">' + esc(cur.coords) + '</span>' : '') +
				' <span class="kw-meta">• khanBuildQueues[' + esc(cur.key) + ']</span>' +
				'</div>';
		} else if (state.castles.length) {
			head = '<div class="kw-qhead kw-meta">تعذّر تحديد القلعة النشطة من قائمة القلاع.</div>';
		} else {
			head = '<div class="kw-qhead kw-meta">لم أقرأ قائمة القلاع بعد.</div>';
		}

		if (!info) {
			el.buildQueue.innerHTML = head + '<span class="kw-meta">لم أجد طابوراً في <code>khanBuildQueues</code> لهذه القلعة.</span>';
			return;
		}
		if (!info.items.length) {
			el.buildQueue.innerHTML = head + '<span class="kw-meta">طابور البناء فاضي.</span>';
			return;
		}
		var blocked = state.abBlocked || {};
		var pendingIds = {};
		for (var pi = 0; pi < state.pendingBuilds.length; pi++) {
			pendingIds[toInt(state.pendingBuilds[pi].id)] = true;
		}
		el.buildQueue.innerHTML = head + info.items.map(function (id, i) {
			var v = toInt(id);
			var isQuest = v >= QUEST_STEP_MIN && v <= QUEST_STEP_MAX;
			var isSkill = v === SKILL_ITEM_ID;
			var unsupported = v > QUEST_STEP_MAX && !isSkill;
			var isBlocked = !!blocked[v];
			var isPending = !!pendingIds[v];
			var cls = isQuest ? ' quest' : (isSkill ? ' skill' : (unsupported ? ' unsupported' : (isBlocked ? ' blocked' : (isPending ? ' pending' : ''))));
			var what = isQuest ? 'مهمة/مكافأة — تُنفَّذ في مكانها' :
				(isSkill ? 'مهارة الموارد — تُنفَّذ مرة واحدة وتُحذف بعد تأكيد ارتفاع المستوى' :
				(unsupported ? 'عنصر غير مدعوم — يُتخطّى دون حذف' :
				(isBlocked ? 'محجوب بشرط مسبق في هذه الجلسة' :
				(isPending ? 'أُرسلت — بانتظار تأكيد المستوى' : ''))));
			var title = 'khanBuildQueues[' + info.key + '] — العنصر ' + (i + 1) +
				(what ? ' — ' + what : '');
			return '<span class="kw-chip' + cls + '" title="' + esc(title) + '">' +
				'<b>' + (i + 1) + '.</b> ' + esc(queueItemLabel(v)) + '</span>';
		}).join('');
	}

	function abLog(msg, kind) {
		state.abLog.push({ t: Date.now(), msg: msg, kind: kind || '' });
		if (state.abLog.length > 40) state.abLog.shift();
		renderAbLog();
	}

	function renderAbLog() {
		if (!el.abLog) return;
		el.abLog.innerHTML = state.abLog.slice(-6).map(function (l) {
			return '<div class="' + l.kind + '">' +
				new Date(l.t).toLocaleTimeString('en-GB') + ' — ' + esc(l.msg) +
				'</div>';
		}).join('');
		el.abLog.scrollTop = el.abLog.scrollHeight;
	}

	function setAbStatus(kind, text) {
		state.abStatus = kind || 'idle';
		state.abStatusText = text || '';
		renderAbStatus();
	}

	function renderAbStatus() {
		if (!el.abBtn) return;
		var on = state.autoBuild;
		el.abBtn.textContent = on ? '■ إيقاف' : '▶ تشغيل آلي';
		el.abBtn.classList.toggle('kw-stop', on);
		el.abBtn.classList.toggle('kw-run', !on);
		if (el.abBox) el.abBox.classList.toggle('kw-on', on);
		if (el.abAll) el.abAll.disabled = !(state.castles.length > 1);

		if (el.abStatus) {
			var txt = state.abStatusText || 'متوقف';
			if (on && state.pendingBuilds.length) {
				var p = state.pendingBuilds[0];
				txt = 'بانتظار تأكيد مستوى ' + (p.name || ('#' + p.id)) + ' (' + p.before + ' → ' + (p.before + 1) + ')';
			}
			if (on && state.autoBuildNextAt > Date.now()) {
				txt += ' — بعد ' + Math.ceil((state.autoBuildNextAt - Date.now()) / 1000) + 'ث';
			} else if (on && state.ifCheckAt > Date.now()) {
				txt += ' — فحص الجدول بعد ' + Math.ceil((state.ifCheckAt - Date.now()) / 1000) + 'ث';
			}
			el.abStatus.textContent = txt;
		}
	}

	/* انتظار غير مُنهٍ: لا يوقف التشغيل الآلي أبداً — يجدول المحاولة القادمة فقط.
	   key يمنع تكرار نفس رسالة السجل كل دورة. */
	function abWait(key, text, delayMs, logMsg, kind) {
		state.autoBuildNextAt = Date.now() + Math.max(1000, toInt(delayMs, 15000));
		setAbStatus(kind || 'waiting', text);
		if (state.abWaitKey !== key) {
			state.abWaitKey = key;
			if (logMsg) abLog(logMsg, 'warn');
		}
		renderAbStatus();
	}

	function autoBuildSet(on, quiet) {
		on = !!on;
		if (on && !hasAjax()) { toast('لا اتصال باللعبة', 'err'); return; }

		state.autoBuild = on;
		lsSet(LS.autoBuild, on ? '1' : '0');
		state.autoBuildBusy = false;
		state.abSwitchFails = 0;
		state.abBlocked = {};
		state.abBlockedResetAt = 0;
		state.abWaitKey = null;
		state.abErrorCount = 0;
		state.abSkillBlockedAt = 0;

		if (on) {
			state.autoBuildNextAt = 0;
			state.ifCheckAt = 0;
			state.ifBusy = false;
			state.buildRunning = false;
			setAbStatus('running', 'يعمل');
			abLog('▶ تشغيل البناء الآلي', 'ok');
			toast('البناء الآلي: يعمل', 'ok');
		} else if (!quiet) {
			setAbStatus('idle', 'متوقف');
			abLog('■ إيقاف البناء الآلي', 'warn');
		}

		renderAbStatus();
		syncAutoBuildTimer();
		if (on) autoBuildTick();
	}

	function syncAutoBuildTimer() {
		if (state.autoBuildTimer) { clearTimeout(state.autoBuildTimer); state.autoBuildTimer = null; }
		if (!state.autoBuild) return;
		state.autoBuildTimer = setTimeout(autoBuildTickLoop, 2000);
	}

	function autoBuildTickLoop() {
		if (!state.autoBuild) { state.autoBuildTimer = null; return; }
		autoBuildTick();
		var sleepUntil = autoBuildSleepUntil(state.currentCastleId);
		var sleeping = (sleepUntil && Date.now() < sleepUntil) || (Date.now() < state.autoBuildNextAt);
		var delay = sleeping ? 5000 : 2000;
		state.autoBuildTimer = setTimeout(autoBuildTickLoop, delay);
	}

	function nextCastleWithQueue() {
		var total = state.castles.length;
		if (total < 2) return null;
		var curIdx = castleIndexInList();
		if (curIdx < 0) return null;

		var queues = loadQueues();
		for (var step = 1; step < total; step++) {
			var idx = (curIdx + step) % total;
			var key = keyForIndex(total, idx);
			if (!Array.isArray(queues[key]) || !queues[key].length) continue;
			return state.castles[idx].id;
		}
		return null;
	}

	/* أول عنصر قابل للتنفيذ بالترتيب:
	 *   مبنى (≤100) غير محجوب  → {type:'build'}
	 *   خطوة مكافأة (101..135) → {type:'quest'}
	 *   مهارة (150)           → {type:'skill'} مثل السكربت القديم (مهارة الموارد)
	 *   غير ذلك               → يُتخطّى دون حذف
	 * لا نُعيد ترتيب الطابور ولا نحذف العناصر غير المنفّذة. */
	function nextAction(items) {
		var blocked = state.abBlocked || {};
		var pendingIds = {};
		for (var pi = 0; pi < state.pendingBuilds.length; pi++) pendingIds[toInt(state.pendingBuilds[pi].id)] = true;
		for (var i = 0; i < items.length; i++) {
			var id = toInt(items[i]);
			if (!id || id < 1) continue;
			if (id >= QUEST_STEP_MIN && id <= QUEST_STEP_MAX) {
				return { type: 'quest', id: id };
			}
			if (id === SKILL_ITEM_ID) {
				if (state.abSkillBlockedAt && Date.now() < state.abSkillBlockedAt) continue;
				return { type: 'skill', id: id, skillId: SKILL_ID };
			}
			if (id <= 100) {
				if (blocked[id] || pendingIds[id]) continue;
				return { type: 'build', id: id };
			}
			/* >135 غير 150 (عنصر غير مدعوم): يُتخطّى في هذه الدورة */
		}
		return null;
	}

	function hasBuildable(items) {
		for (var i = 0; i < items.length; i++) {
			if (toInt(items[i]) > 0 && toInt(items[i]) <= 100) return true;
		}
		return false;
	}

	function hasSkillItem(items) {
		for (var i = 0; i < items.length; i++) {
			if (toInt(items[i]) === SKILL_ITEM_ID) return true;
		}
		return false;
	}

	/* ============================================================
	 * 3.6) جدول البناء الحقيقي + الإنهاء الفوري المجاني
	 * ============================================================
	 * القراءة: ajax_bottomBar.php (type=load&bar_type=1)
	 *   data.timers     = { processId: ثوانٍ متبقية }
	 *   data.buildTimes = { processId: المدة الكلية }
	 *
	 * الإنهاء المجاني (≤60ث) — نفس مسار زر «السرعة» في اللعبة:
	 *   type=getPopupStatus&process_type=1&instantFinishTimeReached=true
	 *   ثم نتحقق من الجدول (وinstantProcess بالمعرّف كاحتياطي فقط).
	 *   ملاحظة: الرد عند الإنهاء المجاني نص JS (window.location=...) وليس JSON،
	 *   لذلك كل الطلبات هنا بـ evalJS:false حتى لا يُنفَّذ ويُعيد تحميل الصفحة.
	 *
	 * السياسة:
	 *   - لا يُرسَل طلب بناء إلا إذا كان في الجدول أقل من طابورين (الحد 2).
	 *   - النوم يُحسب من متبقي أول بناء، بحد أقصى 5 دقائق (لا نوم عشوائي).
	 */

	var MAX_BUILD_QUEUE = 2;
	var FREE_FINISH_SEC = 60;
	var MAX_SLEEP_SEC = 300;
	/* التشغيل الآلي لا يتوقف تلقائياً أبداً — ينتظر ويعيد المحاولة */
	var EMPTY_QUEUE_RECHECK_MS = 15000;    /* طابور فاضي: فحص محلي سريع (بدون طلبات) */
	var ALL_BLOCKED_RECHECK_MS = 90000;    /* كل المباني محجوبة: محاولة دورية */
	var ALL_SPECIAL_RECHECK_MS = 120000;   /* كل العناصر غير قابلة للتنفيذ الآن (مهام/مهارات مؤجلة) */
	var UNKNOWN_ERROR_BASE_MS = 60000;     /* خطأ غير معروف: تباعد تصاعدي */
	var UNKNOWN_ERROR_MAX_MS = 300000;

	/* التحقق من نجاح الترقية بمقارنة المستوى قبل/بعد */
	var PENDING_LEVEL_RETRY_MS = 3000;     /* قراءة ثانية عند تأخر تحديث المستوى */
	var PENDING_LEVEL_MAX_TRIES = 2;       /* محاولتان ثم نعتبرها فشلاً ونعيدها */
	var PENDING_LEVEL_FAIL_MAX = 5;        /* تعذّر قراءة المستوى 5 مرات → تخلَّ عن الانتظار */
	var PENDING_MIN_AGE_MS = 4000;         /* مهلة استقرار بعد الإرسال قبل التحقق */
	var PENDING_POLL_SEC = 60;             /* أثناء انتظار بناء: لا ننام أكثر من دقيقة للتحقق */

	/* مهام/مكافآت الطابور: العناصر 101..135 = خطوات استلام مكافآت
	   (نفس فكرة build2023 القديم). نستلم كل مهمة جاهزة فعلاً، ولا نفرض
	   استلام مهمة غير مكتملة. */
	var QUEST_ENDPOINT = 'ajax_quester_v63.php';
	var QUEST_TYPES = ['Quest_UI_Production', 'Quest_UI_Military', 'Quest_UI_Knights', 'Quest_UI_Upgrades'];
	var QUEST_STEP_MIN = 101;
	var QUEST_STEP_MAX = 135;

	/* المهارة #150: نفس s7 في build2023 القديم — مهارة «الموارد» (#7) مرة واحدة.
	   لا نحذف العنصر من الطابور إلا بعد ارتفاع مستوى المهارة فعلياً. */
	var SKILL_ITEM_ID = 150;
	var SKILL_ID = 7;
	var SKILL_RETRY_MS = 5 * 60 * 1000;         /* فشل/شبكة: إعادة المحاولة بعد 5د */
	var SKILL_NO_POINTS_MS = 30 * 60 * 1000;    /* لا توجد نقاط مهارة: بعد 30د */
	var SKILL_MAX_RECHECK_MS = 6 * 60 * 60 * 1000; /* أقصى مستوى: فحص بعد 6س */
	var SKILL_PENDING_KEY = 'kw.pendingSkill';
	var SKILL_NAMES = {
		1: 'القيادة', 2: 'القتال', 3: 'الرماة', 4: 'الفروسية', 5: 'المدافع',
		6: 'الخيول', 7: 'الموارد', 8: 'المعالجة', 9: 'فك الحصار', 10: 'الحظ',
		11: 'التعليم', 12: 'مهارة المخيمات', 14: 'الناظر'
	};

	/* per-castle sleep for auto-build (موارد غير كافية وما شابه): { castleId: untilTimestamp } */
	function autoBuildSleepMap() {
		try {
			var o = JSON.parse(lsGet(LS.autoBuildSleep, '{}'));
			return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
		} catch (e) { return {}; }
	}
	function autoBuildSleepUntil(castleId) {
		if (castleId == null) return 0;
		var m = autoBuildSleepMap();
		return toInt(m[String(castleId)], 0);
	}
	function setAutoBuildSleep(castleId, until) {
		if (castleId == null) return;
		var m = autoBuildSleepMap();
		m[String(castleId)] = until;
		try { localStorage.setItem(LS.autoBuildSleep, JSON.stringify(m)); }
		catch (e) { /* ignore */ }
	}
	function clearAutoBuildSleep(castleId) {
		if (castleId == null) return;
		var m = autoBuildSleepMap();
		delete m[String(castleId)];
		try { localStorage.setItem(LS.autoBuildSleep, JSON.stringify(m)); }
		catch (e) { /* ignore */ }
	}

	function getBuildQueue(cb) {
		if (!hasAjax()) { cb({ error: 'no-ajax', items: [] }); return; }
		new window.Ajax.Request('ajax_bottomBar.php', {
			evalJS: false,
			method: 'post',
			parameters: { type: 'load', bar_type: 1 },
			onSuccess: function (response) {
				var out = { items: [] };
				try {
					var data = JSON.parse(response.responseText) || {};
					var timers = (data.data && data.data.timers) || {};
					var totals = (data.data && data.data.buildTimes) || {};
					var ids = [];
					for (var k in timers) {
						if (Object.prototype.hasOwnProperty.call(timers, k)) ids.push(toInt(k));
					}
					ids.sort(function (a, b) { return a - b; });  /* الأقدم = رأس الجدول */
					for (var i = 0; i < ids.length; i++) {
						out.items.push({
							id: ids[i],
							remain: toInt(timers[ids[i]]),
							total: toInt(totals[ids[i]])
						});
					}
				} catch (e) {
					cb({ error: e.message, items: [] });
					return;
				}
				cb(out);
			},
			onFailure: function (response) {
				cb({ error: 'http-' + response.status, items: [] });
			}
		});
	}

	function instantFinishProcess(id, cb) {
		if (!hasAjax()) { cb({ error: 'no-ajax' }); return; }
		new window.Ajax.Request('ajax_instantProcess.php', {
			evalJS: false,
			method: 'post',
			parameters: {
				type: 'instantProcess',
				process_type: 1,
				process_id: toInt(id),
				skip_popup: 0
			},
			onSuccess: function (response) {
				var out;
				try { out = JSON.parse(response.responseText) || {}; }
				catch (e) { out = { success: 0, message: String(response.responseText).slice(0, 160) }; }
				cb(out);
			},
			onFailure: function (response) {
				cb({ error: 'http-' + response.status });
			}
		});
	}

	/* نوم محسوب من متبقي أول بناء: نستيقظ عند دخول آخر 60ث أو بعد 5 دقائق كحد أقصى.
	   أثناء وجود ترقية تنتظر تأكيد المستوى لا ننام أكثر من دقيقة (حتى لو أنهاها اللاعب يدوياً). */
	function sleepUntilHead(remain) {
		var wait = toInt(remain) - FREE_FINISH_SEC;
		if (wait < 1) wait = 1;
		if (wait > MAX_SLEEP_SEC) wait = MAX_SLEEP_SEC;
		state.ifCheckAt = Date.now() + wait * 1000;
		/* per-castle sleep: чтобы другие замки могли строить */
		setAutoBuildSleep(state.currentCastleId, Date.now() + wait * 1000);
	}

	/* طلب الإنهاء المجاني كما يفعله زر «السرعة» في اللعبة عند ≤60ث:
	   getPopupStatus + instantFinishTimeReached=true (بدون process_id). */
	function requestFreeFinish(cb) {
		if (!hasAjax()) { cb({ error: 'no-ajax' }); return; }
		new window.Ajax.Request('ajax_instantProcess.php', {
			evalJS: false,
			method: 'post',
			parameters: {
				type: 'getPopupStatus',
				process_type: 1,
				instantFinishTimeReached: 'true'
			},
			onSuccess: function (response) {
				var txt = String(response.responseText || '');
				var data = null;
				try { data = JSON.parse(txt); } catch (e) { data = null; }
				cb({ data: data, text: txt.slice(0, 120) });
			},
			onFailure: function (response) {
				cb({ error: 'http-' + response.status });
			}
		});
	}

	/* ---------- مهام/مكافآت الطابور (العناصر 101..135) ----------
	 * نفس مسار QuesterUI في اللعبة:
	 *   نوع المهمة: type=Quest_UI_*&action=loadContent  → data.isClaimable + questId
	 *   الاستلام:  type=Quest_UI_Base&action=claimReward&questId=..&forceClaim=1
	 * الطلبات كلها بـ evalJS:false (ردودها JSON لكن بعض مسارات اللعبة تنفّذ JS).
	 */
	function questPageCont() {
		return String(window.location.pathname || '') + String(window.location.search || '');
	}

	/* اللعبة تحدّث اسم ملف الـquester أحياناً (v63 → v64…). نقرأه من دالة
	   QuesterUI نفسها إن وُجدت، وإلا نستخدم الاحتياطي. */
	function questEndpoint() {
		try {
			var src = String((window.QuesterUI && window.QuesterUI.prototype && window.QuesterUI.prototype.sendData) || '');
			var m = src.match(/["'](ajax_quester[^"']*\.php)["']/);
			if (m && m[1]) return m[1];
		} catch (e) { /* ignore */ }
		return QUEST_ENDPOINT;
	}

	function questLoadAll(cb) {
		if (!hasAjax()) { cb({ error: 'no-ajax', list: [] }); return; }
		var list = [];
		var left = QUEST_TYPES.length;
		var failed = 0;

		function done() {
			left--;
			if (left > 0) return;
			/* نكتفي بما نجح؛ الفشل الكامل فقط إذا لم يصل أي نوع */
			if (!list.length) cb({ error: failed ? 'all-failed' : 'no-data', list: [] });
			else cb({ list: list, failed: failed });
		}

		for (var i = 0; i < QUEST_TYPES.length; i++) {
			(function (type) {
				new window.Ajax.Request(questEndpoint(), {
					evalJS: false,
					method: 'post',
					parameters: { type: type, action: 'loadContent', pageCont: questPageCont() },
					onSuccess: function (response) {
						var j = null;
						try { j = JSON.parse(response.responseText); } catch (e) { j = null; }
						var d = j && j.data;
						if (d && d.questId) {
							list.push({
								type: type,
								questId: String(d.questId),
								isClaimable: !!d.isClaimable
							});
						} else {
							failed++;
						}
						done();
					},
					onFailure: function () { failed++; done(); }
				});
			})(QUEST_TYPES[i]);
		}
	}

	function questClaim(questId, cb) {
		if (!hasAjax()) { cb({ ok: false, error: 'no-ajax' }); return; }
		new window.Ajax.Request(questEndpoint(), {
			evalJS: false,
			method: 'post',
			parameters: {
				type: 'Quest_UI_Base',
				action: 'claimReward',
				questId: String(questId),
				forceClaim: 1,
				pageCont: questPageCont()
			},
			onSuccess: function (response) {
				var j = null;
				try { j = JSON.parse(response.responseText); } catch (e) { j = null; }
				cb({
					ok: !!(j && String(j.status) === '1'),
					status: j ? j.status : null,
					body: j ? j.body : null,
					raw: String(response.responseText || '').slice(0, 160)
				});
			},
			onFailure: function (response) {
				cb({ ok: false, error: 'http-' + response.status });
			}
		});
	}

	function queueHas(items, id) {
		for (var i = 0; i < (items || []).length; i++) {
			if (toInt(items[i].id) === toInt(id)) return true;
		}
		return false;
	}

	/* ينهي رأس الجدول مجاناً ثم يتحقق من الجدول فعلياً قبل اعتبار النجاح */
	function finishHeadIfFree(head, cb) {
		requestFreeFinish(function (r1) {
			setTimeout(function () {
				getBuildQueue(function (res1) {
					if (res1 && !res1.error && !queueHas(res1.items, head.id)) {
						cb({ ok: true, remain: head.remain });
						return;
					}
					/* احتياطي: المسار المباشر بالمعرّف */
					instantFinishProcess(head.id, function (r2) {
						setTimeout(function () {
							getBuildQueue(function (res2) {
								cb({
									ok: !!(res2 && !res2.error && !queueHas(res2.items, head.id)),
									remain: head.remain,
									first: r1,
									second: r2
								});
							});
						}, 1200);
					});
				});
			}, 1200);
		});
	}

	/* القلعة الحالية تطابق قلعة الترقية المنتظرة؟ (التحقق يقرأ مستوى القلعة النشطة) */
	function pendingCastleOk(p) {
		if (!p.castleId) return true;
		var ci = currentCastleInfo();
		var cur = ci ? String(ci.id) : (state.currentCastleId != null ? String(state.currentCastleId) : null);
		if (!cur) return true;
		return String(cur) === String(p.castleId);
	}

	/* تحقق من الترقيات المُرسلة: الجدول صار فاضياً ⇒ اقرأ مستوى المبنى.
	 *   level > before  → نجاح مؤكد ⇒ احذف العنصر من الطابور
	 *   level == before → فشل (بعد قراءتين) ⇒ أبقِ العنصر ليُعاد إرساله
	 * هذا هو مصدر الحقيقة 100% بدل الاعتماد على ردّ الطلب وحده. */
	function verifyPendingBuilds(cb) {
		if (!state.pendingBuilds.length) { cb(true); return; }
		var list = state.pendingBuilds.slice();
		var at = 0;
		var waiting = false;

		function next() {
			if (at >= list.length) {
				savePendingBuilds();
				cb(!waiting);
				return;
			}
			var p = list[at++];

			if (!pendingCastleOk(p)) {
				waiting = true;
				state.ifCheckAt = Date.now() + 30000;
				setAbStatus('waiting', 'بانتظار قلعة ' + p.name + ' للتحقق');
				next();
				return;
			}

			if (Date.now() - p.sentAt < PENDING_MIN_AGE_MS) {
				waiting = true;
				state.ifCheckAt = Date.now() + 2500;
				setAbStatus('waiting', 'بانتظار استقرار جدول البناء…');
				next();
				return;
			}

			getBuildingLevelAjax(p.id, function (r) {
				if (!state.autoBuild) { cb(false); return; }

				if (r.level == null) {
					p.levelFails = toInt(p.levelFails, 0) + 1;
					savePendingBuilds();
					if (p.levelFails >= PENDING_LEVEL_FAIL_MAX) {
						removePendingBuild(p);
						abLog('✕ تعذّر قراءة مستوى ' + p.name + ' — إعادة الترقية', 'err');
						state.autoBuildNextAt = Date.now() + 60000;
						setAbStatus('waiting', 'تعذّر قراءة المستوى');
					} else {
						waiting = true;
						state.ifCheckAt = Date.now() + 15000;
						setAbStatus('waiting', 'تعذّر قراءة مستوى ' + p.name);
					}
					next();
					return;
				}

				if (r.level > p.before) {
					removePendingBuild(p);
					consumeQueueItem(p.id, p.key);
					state.abBlocked = {};
					state.abBlockedResetAt = 0;
					state.abErrorCount = 0;
					state.abQuestFails = 0;
					abLog('✓ تحقق المستوى: ' + p.name + ' ' + p.before + ' → ' + r.level + ' — حُذف من الطابور', 'ok');
					setAbStatus('running', 'تم تأكيد ترقية ' + p.name);
					if (state.open && state.tab === 'buildings') {
						setTimeout(function () { loadBuildings(true); }, 500);
					}
					next();
					return;
				}

				/* المستوى لم يرتفع بعد — قد يكون تحديث السيرفر متأخراً */
				p.tries = toInt(p.tries, 0) + 1;
				savePendingBuilds();
				if (p.tries < PENDING_LEVEL_MAX_TRIES) {
					waiting = true;
					state.ifCheckAt = Date.now() + PENDING_LEVEL_RETRY_MS;
					setAbStatus('waiting', 'تحقق ثانٍ من مستوى ' + p.name);
				} else {
					removePendingBuild(p);
					/* لا نستهلك العنصر: يبقى ليُعاد إرساله */
					state.autoBuildNextAt = Date.now() + 5000;
					state.ifCheckAt = 0;
					abLog('✕ لم يرتفع مستوى ' + p.name + ' (بقي ' + r.level + ') — سأعيد الترقية', 'err');
					setAbStatus('waiting', 'إعادة محاولة ' + p.name);
				}
				next();
			});
		}

		next();
	}

	/* يقرأ جدول البناء؛ يسمح بملء الخانتين، ويتحقق من الترقيات المعلقة بعد فراغه. */
	function checkBuildQueue(cb) {
		if (state.ifBusy) return;
		state.ifBusy = true;
		state.ifBusyAt = Date.now();

		getBuildQueue(function (res) {
			if (!res || res.error) {
				state.ifBusy = false;
				state.ifCheckAt = Date.now() + 30000;
				setAbStatus('waiting', 'تعذّر قراءة جدول البناء');
				if (cb) cb(false);
				return;
			}

			var items = res.items || [];
			state.buildRunning = items.length > 0;

			/* ترقية سابقة تنتظر تأكيد المستوى والجدول صار فاضياً → تحقق الآن */
			if (state.pendingBuilds.length && !items.length) {
				state.ifCheckAt = 0;
				verifyPendingBuilds(function (done) {
					state.ifBusy = false;
					if (!state.autoBuild) return;
					if (done) {
						state.ifCheckAt = 0;
						if (cb) cb(true);
					} else {
						if (cb) cb(false);
					}
				});
				return;
			}

			if (!items.length) {
				/* لا بناء جارٍ — لا نوم، افحص الطابور مباشرة */
				clearAutoBuildSleep(state.currentCastleId);
				state.ifBusy = false;
				state.ifCheckAt = 0;
				if (cb) cb(true);
				return;
			}

			/* إذا بقيت خانة من الحد الأقصى، أرسل لها عملاً دون انتظار انتهاء الحالي. */
			if (items.length < MAX_BUILD_QUEUE) {
				state.ifBusy = false;
				state.ifCheckAt = 0;
				if (cb) cb(true);
				return;
			}

			var head = items[0];

			/* اللعبة: 60 ثانية أو أقل ⇒ إنهاء فوري مجاني */
			if (state.instantFinish && head.remain <= FREE_FINISH_SEC) {
				finishHeadIfFree(head, function (out) {
					state.ifBusy = false;
					if (out.ok) {
						abLog('⚡ إنهاء فوري مجاني (كان متبقياً ' + formatSeconds(out.remain) + ')', 'ok');
						setAbStatus('running', 'إنهاء فوري مجاني');
						state.ifCheckAt = 0;
						state.autoBuildNextAt = Date.now() + 1500;
						if (state.open && state.tab === 'buildings') {
							setTimeout(function () { loadBuildings(true); }, 1500);
						}
					} else {
						abLog('✕ تعذّر الإنهاء الفوري — إعادة المحاولة بعد 30ث', 'err');
						state.ifCheckAt = Date.now() + 30000;
					}
					if (cb) cb(false);
				});
				return;
			}

			state.ifBusy = false;

			/* بناء جارٍ: نم حتى آخر 60 ثانية أو 5 دقائق (ودقيقة واحدة أثناء التحقق) */
			sleepUntilHead(head.remain);
			setAbStatus('waiting', 'البناء جارٍ — متبقٍ ' + formatSeconds(head.remain) +
				(state.pendingBuilds.length ? ' (بانتظار التحقق)' : ''));
			if (cb) cb(false);
		});
	}

	function autoBuildTick() {
		if (!state.autoBuild || state.autoBuildBusy || state.confirmBusy) return;
		/* حماية: طلب جدول البناء لا يعلّق التشغيل للأبد */
		if (state.ifBusy && Date.now() - state.ifBusyAt > 25000) state.ifBusy = false;
		/* per-castle sleep: قلعة без ресурсов (أو نائمة) لا تُطلب — castles أخرى могут строить */
		var abSleepUntil = autoBuildSleepUntil(state.currentCastleId);
		if (abSleepUntil && Date.now() < abSleepUntil) {
			/* في وضع «كل القلاع»: جرّب التبديل لقلعة أخرى عندها طابور غير نائم */
			if (state.autoBuildAll && state.castles.length > 1) {
				var nextAwake = null;
				var total = state.castles.length;
				var curIdx = castleIndexInList();
				if (curIdx >= 0) {
					for (var step = 1; step < total; step++) {
						var idx = (curIdx + step) % total;
						var cid = state.castles[idx].id;
						var key = keyForIndex(total, idx);
						var queues = loadQueues();
						if (!Array.isArray(queues[key]) || !queues[key].length) continue;
						if (autoBuildSleepUntil(cid) > Date.now()) continue;
						nextAwake = cid;
						break;
					}
				}
				if (nextAwake) {
					state.autoBuildNextAt = Date.now() + 8000;
					setAbStatus('running', 'القلعة الحالية نائمة — انتقال لقلعة أخرى…');
					switchCastle(nextAwake, {
						silent: true,
						onDone: function (ok) {
							state.autoBuildNextAt = Date.now() + (ok ? 1500 : 10000);
							if (ok) state.ifCheckAt = 0;
						}
					});
					renderAbStatus();
					return;
				}
			}
			renderAbStatus();
			return;
		}

		if (Date.now() < state.autoBuildNextAt) { renderAbStatus(); return; }
		if (!hasAjax()) return;

		if (!state.castles.length || Date.now() - state.castlesAt > CASTLES_TTL) {
			/* تحديث خفيف لقائمة القلاع (اسم + معرّف) — طلب واحد فقط وكل 5 دقائق */
			if (!state.castlesLoading) loadCastles(true);
			if (!state.castles.length) {
				state.autoBuildNextAt = Date.now() + 2500;
				setAbStatus('waiting', 'أقرأ القلاع…');
				return;
			}
		}

		var info = queueInfo();
		if (!info) {
			state.autoBuildNextAt = Date.now() + 5000;
			setAbStatus('waiting', 'لم أجد طابوراً لهذه القلعة');
			return;
		}

		/* «كل القلاع»: إن كانت الترقية المنتظرة في قلعة أخرى، ارجع إليها للتحقق
		   (وإلا يبقى التحقق معلّقاً لأن قراءة المستوى تخص القلعة النشطة). */
		if (state.pendingBuilds.length && state.autoBuildAll && state.castles.length > 1) {
			var p0 = state.pendingBuilds[0];
			if (p0.castleId && !pendingCastleOk(p0)) {
				state.autoBuildNextAt = Date.now() + 8000;
				setAbStatus('running', 'العودة لقلعة ' + p0.name + ' للتحقق…');
				switchCastle(p0.castleId, {
					silent: true,
					onDone: function (ok) {
						state.autoBuildNextAt = Date.now() + (ok ? 1500 : 15000);
						if (ok) state.ifCheckAt = 0;
					}
				});
				return;
			}
		}

		/* طابور فاضي بلا ترقية منتظرة: لا نطلب جدول البناء ولا نوقف التشغيل —
		   ننتظر عناصر جديدة (يضيفها مدير الطابور أو أنت). */
		if (!info.items.length && !state.pendingBuilds.length) {
			sendNextBuild(info);
			return;
		}

		/* افحص الجدول الحقيقي: التحقق من الترقية السابقة + الإنهاء الفوري */
		if (Date.now() >= state.ifCheckAt && !state.ifBusy) {
			checkBuildQueue(function (hasFreeSlot) {
				if (!state.autoBuild) return;
				if (!hasFreeSlot) { renderAbStatus(); return; }
				var fresh = queueInfo();
				if (fresh) sendNextBuild(fresh);
			});
			return;
		}

		/* ما زلنا في فترة النوم المحسوبة */
		renderAbStatus();
	}

	function sendNextBuild(info) {
		if (!state.autoBuild) return;
		if (state.confirmBusy) return;
		if (Date.now() < state.autoBuildNextAt) return;

		if (!info.items.length) {
			/* «كل القلاع»: انتقل لقلعة أخرى عندها طابور */
			if (state.autoBuildAll) {
				var next = nextCastleWithQueue();
				if (next) {
					state.autoBuildNextAt = Date.now() + 8000;
					setAbStatus('running', 'انتقال لقلعة أخرى…');
					switchCastle(next, {
						silent: true,
						onDone: function (ok) {
							if (ok) {
								state.abSwitchFails = 0;
								state.autoBuildNextAt = Date.now() + 1500;
								state.ifCheckAt = 0;
								return;
							}
							state.abSwitchFails++;
							if (state.abSwitchFails >= 3) {
								state.abSwitchFails = 0;
								abWait('switch', 'تعذّر التبديل — إعادة المحاولة تلقائياً', 60000,
									'✕ فشل التبديل بين القلاع — سأعيد المحاولة تلقائياً');
							} else {
								state.autoBuildNextAt = Date.now() + 10000;
							}
						}
					});
					return;
				}
			}
			/* لا إيقاف: نبقى شغالين وننتظر أن تُضاف عناصر جديدة للطابور */
			abWait('empty', 'الطابور فاضي — بانتظار عناصر جديدة', EMPTY_QUEUE_RECHECK_MS,
				'… الطابور فاضي — البناء الآلي شغّال وسينتظر عناصر جديدة');
			return;
		}

		/* فك الحجب الدوري (شرط مسبق قد يزول بعد ترقية أخرى) */
		if (state.abBlockedResetAt && Date.now() >= state.abBlockedResetAt) {
			state.abBlockedResetAt = 0;
			state.abBlocked = {};
			renderBuildQueue();
		}
		state.abWaitKey = null;

		var action = nextAction(info.items);

		/* لا عنصر قابل للتنفيذ: إما كله مهارات/عناصر غير مدعومة أو كله محجوب —
		   لا نوقف التشغيل، بل نعيد المحاولة دورياً. */
		if (!action) {
			if (state.pendingBuilds.length) {
				state.ifCheckAt = Date.now() + PENDING_POLL_SEC * 1000;
				state.autoBuildNextAt = 0;
				setAbStatus('waiting', 'بانتظار خانة شاغرة أو تأكيد البناء الجاري');
				return;
			}
			if (hasBuildable(info.items)) {
				state.abBlockedResetAt = Date.now() + ALL_BLOCKED_RECHECK_MS;
				abWait('blocked', 'كل المباني محجوبة — إعادة المحاولة تلقائياً', ALL_BLOCKED_RECHECK_MS,
					'… كل المباني محجوبة مؤقتاً — البناء الآلي شغّال وسيعيد المحاولة');
			} else if (hasSkillItem(info.items)) {
				/* المهارة مؤجلة (نقاط/أقصى مستوى/شبكة): لا نجمّد الطابور طويلاً،
				   نعيد الفحص المحلي كل دقيقتين حتى تزول المهلة أو تُضاف عناصر. */
				var skillWait = ALL_SPECIAL_RECHECK_MS;
				if (state.abSkillBlockedAt > Date.now()) {
					skillWait = Math.min(ALL_SPECIAL_RECHECK_MS, Math.max(5000, state.abSkillBlockedAt - Date.now()));
				}
				abWait('skill-wait', 'مهارة الموارد مؤجلة — إعادة المحاولة', skillWait,
					'… مهارة الموارد مؤجلة مؤقتاً — سأعيد المحاولة', 'warn');
			} else {
				abWait('special', 'الطابور كله مهام/عناصر غير مدعومة (100+) — بانتظار تعديله', ALL_SPECIAL_RECHECK_MS,
					'… لا يوجد مبنى/مهارة قابل للتنفيذ — البناء الآلي شغّال وسينتظر');
			}
			return;
		}

		/* خطوة مكافأة: استلم كل مهمة جاهزة فعلاً ثم احذف الخطوة */
		if (action.type === 'quest') {
			runQuestStep(action.id, info);
			return;
		}

		/* مهارة: نفذها كما كان في السكربت القديم (مهارة الموارد #7) */
		if (action.type === 'skill') {
			runSkillStep(action.id, info, action.skillId);
			return;
		}

		var head = action.id;
		var b = findBuilding(head);
		var name = b ? b.name : ('#' + head);
		var actionCastle = currentCastleInfo();
		if (!actionCastle) {
			state.autoBuildNextAt = Date.now() + 5000;
			setAbStatus('waiting', 'تحديد القلعة قبل البناء…');
			return;
		}

		state.autoBuildBusy = true;
		setAbStatus('running', 'التحقق من القلعة وقراءة مستوى ' + name + '…');

		/* القفل يغطي التحقق والقراءة والإرسال حتى لا يبدّل الحداد/الأمير
		 * القلعة بين قراءة المستوى وطلب البناء. */
		withVerifiedCastle(actionCastle.id, function (releaseCastleLock) {
			getBuildingLevelAjax(head, function (lv) {
				if (!state.autoBuild) { state.autoBuildBusy = false; releaseCastleLock(); return; }
				if (lv.level == null) {
					state.autoBuildBusy = false;
					releaseCastleLock();
					abWait('level-read', 'تعذّر قراءة مستوى ' + name + ' — إعادة المحاولة',
						30000, '… تعذّر قراءة مستوى ' + name + ' — سأعيد المحاولة', 'warn');
					return;
				}

			/* اسم المبنى من ردّ القراءة الخفيف إن لم تكن القائمة محمّلة */
			name = b ? b.name : (lv.name || ('#' + head));
			abLog('→ ترقية ' + name + ' (' + lv.level + ' → ' + (lv.level + 1) + ')', '');

			var pending = {
				id: head,
				name: name,
				before: lv.level,
				sentAt: Date.now(),
				castleId: String(actionCastle.id),
				key: info.key,
				tries: 0,
				levelFails: 0,
				uncertain: false
			};

				setAbStatus('running', 'إرسال ترقية ' + name + ' (' + lv.level + ' → ' + (lv.level + 1) + ')');
				upgradeBuilding(head, function (res) {
					state.autoBuildBusy = false;
					releaseCastleLock();
					handleBuildResult(head, b, res, pending);
				});
			});
		}, function () {
			state.autoBuildBusy = false;
			state.autoBuildNextAt = Date.now() + 5000;
			setAbStatus('waiting', 'تغيّرت القلعة؛ لم أرسل البناء وسأعيد التحقق');
			renderAbStatus();
		});
	}

	/* استلام مكافآت خطوة مهمة (101..135): نستلم فقط ما isClaimable=true.
	 * لا نفرض استلام مهمة غير مكتملة، ولا نستهلك الخطوة إلا بعد نجاح
	 * استلام واحد على الأقل — أو بعد التأكد أنه لا توجد مكافأة جاهزة. */
	function runQuestStep(itemId, info) {
		if (!state.autoBuild) return;
		var questCastle = currentCastleInfo();
		var expectedCastleId = questCastle ? String(questCastle.id) : (state.currentCastleId != null ? String(state.currentCastleId) : null);
		state.autoBuildBusy = true;
		setAbStatus('running', 'فحص المهام القابلة للاستلام…');
		abLog('🎁 خطوة مكافأة #' + itemId + ' — أفحص المهام', '');

		questLoadAll(function (loadRes) {
			if (!state.autoBuild) { state.autoBuildBusy = false; return; }

			if (loadRes.error) {
				state.autoBuildBusy = false;
				abWait('quest-load', 'تعذّر قراءة المهام — إعادة المحاولة', 60000,
					'… تعذّر قراءة المهام — سأعيد المحاولة', 'warn');
				return;
			}

			var claimable = [];
			var list = loadRes.list || [];
			for (var i = 0; i < list.length; i++) {
				if (list[i] && list[i].isClaimable && list[i].questId) claimable.push(list[i]);
			}

			if (!claimable.length) {
				consumeQueueItem(itemId, info.key);
				state.autoBuildBusy = false;
				state.abQuestFails = 0;
				abLog('… لا توجد مكافآت جاهزة — تخطّي خطوة المهمة #' + itemId, 'warn');
				setAbStatus('running', 'لا مكافآت جاهزة — تخطّي');
				state.ifCheckAt = 0;
				state.autoBuildNextAt = Date.now() + 1200;
				return;
			}

			var at = 0, ok = 0, failed = 0;

			function nextClaim() {
				if (!state.autoBuild) { state.autoBuildBusy = false; return; }
				if (at >= claimable.length) {
					state.autoBuildBusy = false;
					if (ok > 0) {
						consumeQueueItem(itemId, info.key);
						state.abQuestFails = 0;
						abLog('🎁 تم استلام ' + ok + ' مكافأة' + (failed ? (' (فشل ' + failed + ')') : ''), 'ok');
						setAbStatus('running', 'تم استلام المكافآت');
						state.ifCheckAt = 0;
						state.autoBuildNextAt = Date.now() + 1200;
					} else {
						state.abQuestFails = toInt(state.abQuestFails, 0) + 1;
						if (state.abQuestFails >= 3) {
							state.abQuestFails = 0;
							consumeQueueItem(itemId, info.key);
							abLog('✕ فشل استلام المكافآت 3 مرات — تخطّي الخطوة', 'err');
							state.ifCheckAt = 0;
							state.autoBuildNextAt = Date.now() + 2000;
						} else {
							abWait('quest-claim', 'تعذّر استلام المكافأة — إعادة المحاولة', 60000,
								'✕ تعذّر استلام المكافأة — سأعيد المحاولة', 'err');
						}
					}
					return;
				}

				var q = claimable[at++];
				withVerifiedCastle(expectedCastleId, function (releaseCastleLock) {
					questClaim(q.questId, function (cl) {
						releaseCastleLock();
						if (cl && cl.ok) {
							ok++;
							abLog('🎁 مكافأة مستلمة: مهمة #' + q.questId, 'ok');
						} else {
							failed++;
							abLog('✕ تعذّر استلام مهمة #' + q.questId, 'err');
						}
						nextClaim();
					});
				}, function () {
					state.autoBuildBusy = false;
					abWait('quest-castle', 'تغيّرت القلعة؛ لم أستلم المهمة', 10000,
						'… تغيّرت القلعة النشطة — أوقفت استلام المهمة', 'warn');
				});
			}

			nextClaim();
		});
	}

	/* ---------- مهارة الموارد (#7) — عنصر الطابور 150 ----------
	 * نفس فكرة s7 في build2023 القديم، لكن بدون فتح نافذة/تنقّل:
	 *   GET skills.php?skill_id=7   (الرابط نفسه الموجود في صفحة المهارات)
	 * نقرأ المستوى قبل/بعد، ولا نحذف 150 إلا إذا ارتفع المستوى فعلياً.
	 * إن كان الردّ غير واضحاً نُبقي pendingSkill ونحسم في الدورة التالية.
	 */
	function skillLevelFromHtml(html, skillId) {
		var out = { level: null, text: '', href: '', maxed: false };
		try {
			var sid = toInt(skillId, SKILL_ID);
			var doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
			var link = doc.getElementById('skill_' + (sid - 1));
			var item = null;
			if (link) {
				item = link;
				while (item && item.nodeType === 1 && !(item.className && String(item.className).indexOf('skillItem') !== -1)) {
					item = item.parentNode;
				}
			}
			/* احتياط: لو اختفى رابط المهارة (أقصى مستوى/بنية مختلفة) نأخذ صفّها بالترتيب */
			if (!item) {
				var rows = doc.querySelectorAll('.skillItem');
				var order = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14];
				var idx = order.indexOf(sid);
				if (idx < 0) idx = sid - 1;
				item = rows && rows[idx] ? rows[idx] : null;
			}
			if (!item) return out;
			var lvlEl = (item.querySelector) ? item.querySelector('.skillLevel') : null;
			var lv = lvlEl ? toInt(String(lvlEl.textContent || '').replace(/[^\d]/g, '')) : null;
			if (lv != null && lv >= 0) out.level = lv;
			if (link) {
				out.text = String(link.textContent || '').replace(/\s+/g, ' ').trim();
				out.href = link.getAttribute('href') || '';
			}
			out.maxed = !link || /أقصى|الحد الأقصى|max/i.test(out.text) ||
				(out.level != null && out.level >= 3);
			return out;
		} catch (e) { return out; }
	}

	function skillGetPage(skillId, cb) {
		var url = 'skills.php' + (skillId ? ('?skill_id=' + encodeURIComponent(skillId)) : '');
		try {
			fetch(url, { method: 'GET', credentials: 'same-origin', cache: 'no-store' })
				.then(function (r) {
					return r.text().then(function (t) {
						cb({ ok: r.ok, status: r.status, url: r.url || url, html: t });
					});
				})
				.catch(function (e) {
					cb({ ok: false, error: String((e && e.message) || e), html: '' });
				});
		} catch (e) {
			cb({ ok: false, error: String((e && e.message) || e), html: '' });
		}
	}

	function skillSkip(waitMs, msg, kind) {
		state.autoBuildBusy = false;
		state.abSkillBlockedAt = Date.now() + Math.max(1000, toInt(waitMs, SKILL_RETRY_MS));
		setAbStatus('waiting', msg + ' — تخطّي مؤقت');
		abLog(msg, kind || 'warn');
		state.autoBuildNextAt = Date.now() + 1500;
	}

	function sendSkillAction(itemId, info, skillId, skillName) {
		if (!state.autoBuild) { state.autoBuildBusy = false; return; }
		var skillCastle = currentCastleInfo();
		var expectedCastleId = skillCastle ? String(skillCastle.id) : (state.currentCastleId != null ? String(state.currentCastleId) : null);
		setAbStatus('running', 'إرسال طلب مهارة ' + skillName + '…');
		abLog('→ إرسال GET skills.php?skill_id=' + skillId, '');

		withVerifiedCastle(expectedCastleId, function (releaseCastleLock) {
			skillGetPage(skillId, function (act) {
			if (!state.autoBuild) { releaseCastleLock(); state.autoBuildBusy = false; return; }
			if (!act.ok) {
				releaseCastleLock();
				state.autoBuildBusy = false;
				state.abSkillBlockedAt = Date.now() + SKILL_RETRY_MS;
				setAbStatus('waiting', 'تعذّر إرسال طلب المهارة');
				abLog('✕ فشل طلب المهارة (HTTP ' + (act.status || 'شبكة') + ')', 'error');
				state.autoBuildNextAt = Date.now() + 1500;
				return;
			}
			releaseCastleLock();
			consumeQueueItem(itemId, info.key);
			state.autoBuildBusy = false;
			state.abSkillBlockedAt = 0;
			abLog('✓ أُرسل طلب مهارة ' + skillName + ' دون فحص المستوى', 'ok');
			setAbStatus('running', 'تم إرسال طلب المهارة');
			state.autoBuildNextAt = Date.now() + 1500;
			});
		}, function () {
			state.autoBuildBusy = false;
			state.autoBuildNextAt = Date.now() + 5000;
			setAbStatus('waiting', 'تغيّرت القلعة؛ لم أرسل طلب المهارة');
		});
	}

	function runSkillStep(itemId, info, skillId) {
		if (!state.autoBuild) return;
		skillId = toInt(skillId, SKILL_ID);
		if (!SKILL_NAMES[skillId]) skillId = SKILL_ID;
		var skillName = SKILL_NAMES[skillId] || ('#' + skillId);
		state.autoBuildBusy = true;
		setAbStatus('running', 'قراءة مهارة ' + skillName + '…');

		savePendingSkill(null);
		sendSkillAction(itemId, info, skillId, skillName);
	}

	/* بعد قبول الترقية: في هذه النسخة من اللعبة قد يظهر «المستوى التالي» في الصفحة
	 * فور القبول (قبل انتهاء المؤقّت)، وقد لا يظهر إلا بعد الاكتمال. نجرب القراءة
	 * الآن أولاً؛ فإن ارتفع المستوى نعتبرها ناجحة فوراً، وإلا نُبقيها pending
	 * ونعود للتحقق عند فراغ جدول البناء (كما كان). لا نستهلك العنصر قبل ارتفاع المستوى. */
	function confirmAcceptedBuild(pending, cb) {
		var attempts = 0;
		var maxAttempts = 3;
		var done = false;
		var safety = null;
		state.confirmBusy = true;

		function finish(ok, level) {
			if (done) return;
			done = true;
			if (safety) { clearTimeout(safety); safety = null; }
			state.confirmBusy = false;
			cb(ok, level);
		}

		safety = setTimeout(function () { finish(false, null); }, 15000);

		function attempt() {
			attempts++;
			getBuildingLevelAjax(pending.id, function (r) {
				var lv = (r && r.level != null) ? r.level : null;
				if (lv != null && lv > pending.before) {
					if (r.name) pending.name = r.name;
					finish(true, lv);
					return;
				}
				if (attempts < maxAttempts) {
					setTimeout(attempt, 1500);
					return;
				}
				finish(false, lv);
			});
		}

		setTimeout(attempt, 150);
	}

	function handleBuildResult(id, b, res, pending) {
		var name = (pending && pending.name) ? pending.name : (b ? b.name : ('#' + id));

		/* لا ردّ إطلاقاً: قد يكون الطلب وصل السيرفر — نتحقق من المستوى قبل الإعادة */
		if (!res) {
			if (pending) {
				pending.uncertain = true;
				addPendingBuild(pending);
				state.buildRunning = true;
				state.ifCheckAt = 0;
				state.autoBuildNextAt = Date.now() + 3000;
				abLog('… لا ردّ واضح من السيرفر — سأتحقق من مستوى ' + name + ' قبل الإعادة', 'warn');
				setAbStatus('running', 'بانتظار التحقق من ' + name);
				return;
			}
			failAutoBuild('لا رد من السيرفر');
			return;
		}

		var raw = String(res.error_txt || res.raw || res.parseError || '');

		/* نجاح الإرسال: نسجّل pending فوراً (حتى لو أُعيد تحميل الصفحة)، ثم نجرّب
		   قراءة المستوى الآن. إن ارتفع فوراً ⇒ نجاح مؤكد واستهلاك مباشر.
		   إن لم يظهر بعد ⇒ يبقى pending ويُتحقق منه عند فراغ جدول البناء. */
		if (String(res.error) === '0') {
			state.abBlocked = {};
			state.abBlockedResetAt = 0;
			state.abErrorCount = 0;
			state.abWaitKey = null;
			state.buildRunning = true;
			state.ifCheckAt = 0;
			state.autoBuildNextAt = Date.now() + 6000;
			clearAutoBuildSleep(pending ? pending.castleId : state.currentCastleId);
			if (state.buildingLevelCache && pending) delete state.buildingLevelCache[toInt(pending.id)];

			if (pending) {
				addPendingBuild(pending);
				setAbStatus('running', 'أتحقق من مستوى ' + name + '…');
				confirmAcceptedBuild(pending, function (ok, level) {
					if (ok) {
						removePendingBuild(pending);
						consumeQueueItem(pending.id, pending.key);
						abLog('✓ تحقق المستوى: ' + name + ' ' + pending.before + ' → ' + level +
							' — حُذف من الطابور', 'ok');
						state.autoBuildNextAt = Date.now() + 1200;
					} else {
						abLog('… أُرسلت ترقية ' + name + ' (' + pending.before + ' → ' + (pending.before + 1) +
							') — لم يظهر المستوى بعد، سأتحقق عند اكتمالها', 'warn');
						setAbStatus('running', 'بانتظار اكتمال ' + name);
						state.autoBuildNextAt = Date.now() + 3000;
					}
					state.ifCheckAt = 0;
					renderBuildQueue();
					renderAbStatus();
				});
			}
			return;
		}

		/* خطأ شبكة/ردّ غير JSON: قد يكون الطلب نُفّذ — تحقق من المستوى */
		if (res.httpError || res.parseError || res.raw != null) {
			if (pending) {
				pending.uncertain = true;
				addPendingBuild(pending);
				state.buildRunning = true;
				state.ifCheckAt = 0;
				state.autoBuildNextAt = Date.now() + 3000;
				abLog('… ردّ غير واضح (' + String(res.httpError || res.parseError || '').slice(0, 60) +
					') — سأتحقق من مستوى ' + name + ' قبل الإعادة', 'warn');
				setAbStatus('running', 'بانتظار التحقق من ' + name);
				return;
			}
			failAutoBuild('ردّ غير واضح');
			return;
		}

		/* شرط مسبق: «يجب عمل بعض التطويرات اولاً» → احجبه في هذه الجلسة وجرّب التالي
		   (يُفحص قبل «أعلى مستوى» لأن رسالته تحتوي كلمة التطويرات)
		   لا نعدّل ترتيب الطابور — الحجب في الذاكرة فقط. */
		if (/يجب/.test(raw)) {
			state.abBlocked = state.abBlocked || {};
			state.abBlocked[toInt(id)] = true;
			renderBuildQueue();
			abLog('⏸ ' + name + ': ' + raw + ' — تجاوزه مؤقتاً', 'warn');
			setAbStatus('running', 'عنصر غير جاهز — تجاوزه');
			state.ifCheckAt = 0;
			state.autoBuildNextAt = Date.now() + 1200;
			return;
		}

		/* وصل لأعلى مستوى: «تم الوصول لاعلى مستوى!» → احذفه من الطابور */
		if (/اعلى مستوى|أعلى مستوى|على مستوى|الوصول لاعلى/.test(raw)) {
			consumeQueueItem(id, pending ? pending.key : null);
			abLog('⛔ ' + name + ' بأعلى مستوى — حُذف من الطابور', 'warn');
			setAbStatus('running', 'تخطّي مبنى مكتمل');
			state.ifCheckAt = 0;
			state.autoBuildNextAt = Date.now() + 1200;
			return;
		}

		/* طابور البناء مشغول: «يتم بناء مبنى اخر حالياً ! انتظر رجاءً.» أو «جدول مهام البناء ممتلئ» */
		if (/مبنى اخر|مبنى آخر|البناء مشغول|قائمة البناء|جدول مهام|مهام البناء/.test(raw)) {
			setAbStatus('waiting', 'البناء مشغول — بانتظار');
			/* لا نوم ثابت: نقرأ متبقي أول بناء في الدورة القادمة وننام على أساسه */
			state.buildRunning = true;
			state.ifCheckAt = 0;
			state.autoBuildNextAt = Date.now() + 1500;
			abLog('… ' + raw + ' — سأقرأ متبقي أول بناء', 'warn');
			return;
		}

		/* موارد غير كافية: «الذهب غير كافي» وأمثالها */
		if (/غير كاف|غير كافي|موارد|ذهب|حديد|خشب|طعام/.test(raw)) {
			/* حافظ على ترتيب الكيو، واستخدم تقدير متطلبات اللعبة لتوقيت إعادة المحاولة.
			 * per-castle sleep: قلعة без ресурсов спит до 5 мин, не блокируя другие замки. */
			state.autoBuildBusy = true;
			getBuildingResourceWait(id, function (estimate) {
				state.autoBuildBusy = false;
				if (!state.autoBuild) return;
				var seconds = estimate && toInt(estimate.seconds, 0);
				var waitMs = seconds > 0 ? (seconds * 1000 + 5000) : 120000;
				/* cap at 5 min per user request */
				if (waitMs > 5 * 60 * 1000) waitMs = 5 * 60 * 1000;
				state.ifCheckAt = 0;
				setAutoBuildSleep(actionCastle ? actionCastle.id : state.currentCastleId, Date.now() + waitMs);
				state.autoBuildNextAt = Date.now() + 2000;  /* short: per-castle sleep gates */
				var estimateText = seconds > 0 ? 'حوالي ' + formatSeconds(seconds) + (estimate.resource ? ' (' + estimate.resource + ')' : '') : 'وقت تقريبي غير متاح؛ إعادة الفحص بعد دقيقتين';
				setAbStatus('waiting', 'موارد غير كافية لـ ' + name + ' — متوقع توفرها بعد ' + estimateText);
				abLog('… ' + name + ': بانتظار الموارد ' + estimateText + ' — سيبقى أولاً في الكيو', 'warn');
				renderBuildQueue();
				renderAbStatus();
			});
			return;
		}

		failAutoBuild(raw || 'خطأ غير معروف');
	}

	function failAutoBuild(msg) {
		/* لا نوقف التشغيل الآلي: خطأ غير معروف ⇒ تباعد تصاعدي ثم إعادة المحاولة */
		state.abErrorCount = toInt(state.abErrorCount, 0) + 1;
		var wait = Math.min(UNKNOWN_ERROR_MAX_MS, UNKNOWN_ERROR_BASE_MS * state.abErrorCount);
		abLog('✕ ' + msg + ' — إعادة المحاولة بعد ' + Math.round(wait / 1000) + 'ث', 'err');
		abWait('error', 'خطأ — إعادة المحاولة تلقائياً', wait, null, 'error');
	}

	/* ---------- القلاع ---------- */

	function currentCastle() {
		for (var i = 0; i < state.castles.length; i++) {
			if (state.castles[i].isCurrent) return state.castles[i];
		}
		return null;
	}

	function renderCastleChip() {
		if (!el.castleChip) return;
		var c = currentCastle();
		if (c) {
			el.castleChip.textContent = (c.name || ('#' + c.id)) + (c.coords ? ' (' + c.coords + ')' : '');
			el.castleChip.title = 'القلعة النشطة: ' + (c.name || c.id) + (c.coords ? ' — ' + c.coords : '') + ' (id ' + c.id + ')';
		} else if (state.currentCastleId) {
			el.castleChip.textContent = '#' + state.currentCastleId;
			el.castleChip.title = 'القلعة النشطة: #' + state.currentCastleId;
		} else {
			el.castleChip.textContent = '—';
			el.castleChip.title = 'القلعة النشطة غير معروفة';
		}
	}

	function renderCastles() {
		if (!el.castlesTable) return;
		var rows = state.castles;

		/* الدوران يحتاج أكثر من قلعة — مع قلعة واحدة تُعطَّل الأدوات */
		var canCycle = rows.length > 1;
		if (el.cycle) {
			el.cycle.disabled = !canCycle;
			el.cycle.title = canCycle ? '' : 'قلعة واحدة فقط — لا يوجد دوران';
			if (!canCycle && state.cycle) disableCycle(null);
		}
		if (el.cycleInterval) el.cycleInterval.disabled = !canCycle;
		if (el.cycleOnce) {
			el.cycleOnce.disabled = !canCycle;
			el.cycleOnce.title = canCycle ? '' : 'قلعة واحدة فقط — لا يوجد ما يُدار';
		}

		if (!rows.length) {
			el.castlesTable.innerHTML = '';
			el.castlesTable.style.display = 'none';
			el.castlesEmpty.style.display = '';
			el.castlesEmpty.textContent = state.castlesError ? ('تعذّر التحميل: ' + state.castlesError) : 'اضغط «تحميل / تحديث».';
			return;
		}
		el.castlesEmpty.style.display = 'none';
		el.castlesTable.style.display = '';

		var head = '<thead><tr>' +
			'<th>القلعة</th>' +
			'<th>الإحداثيات</th>' +
			'<th>السكان</th>' +
			'<th>الولاء</th>' +
			'<th>الحالة</th>' +
			'<th></th>' +
			'</tr></thead>';

		var body = '<tbody>' + rows.map(function (c) {
			return '<tr class="' + (c.isCurrent ? 'kw-current' : '') + '" data-kw-c="' + esc(c.id) + '">' +
				'<td>' + esc(c.name) + ' <span class="kw-id">#' + esc(c.id) + '</span></td>' +
				'<td class="kw-time">' + esc(c.coords || '—') + '</td>' +
				'<td>' + esc(c.population || '—') + '</td>' +
				'<td>' + esc(c.loyalty || '—') + '</td>' +
				'<td>' + (c.isCurrent ? '<span class="kw-cur">● الحالية</span>' : (c.isCapital ? 'العاصمة' : '—')) + '</td>' +
				'<td><button class="kw-up" data-kw-switch="' + esc(c.id) + '" ' + (c.isCurrent ? 'disabled' : '') + '>تبديل</button></td>' +
				'</tr>';
		}).join('') + '</tbody>';

		el.castlesTable.innerHTML = head + body;

		Array.prototype.forEach.call(el.castlesTable.querySelectorAll('[data-kw-switch]'), function (btn) {
			btn.addEventListener('click', function () {
				switchCastle(toInt(btn.getAttribute('data-kw-switch')));
			});
		});
	}

	function loadCastles(silent) {
		if (!hasAjax()) {
			state.castlesError = 'الجلسة غير متصلة (no Ajax).';
			renderCastles();
			return;
		}
		if (state.castlesLoading) return;
		state.castlesLoading = true;
		if (el.castlesMeta) el.castlesMeta.textContent = 'جارٍ التحميل…';

		var watchdog = setTimeout(function () {
			state.castlesLoading = false;
			state.castlesError = 'timeout';
			renderCastles();
			if (el.castlesMeta) el.castlesMeta.textContent = 'انتهت المهلة';
		}, 15000);

		getCastles(function (res) {
			clearTimeout(watchdog);
			state.castlesLoading = false;
			if (res && res.error) {
				state.castlesError = res.error;
			} else {
				state.castles = (res && res.castles) || [];
				var previousSmithyCastleCount = toInt(lsGet(LS.smithyCastleCount, '0'), 0);
				if (previousSmithyCastleCount <= 1 && state.castles.length > 1) {
					state.smithyCastleId = '';
					lsSet(LS.smithyCastle, '');
				}
				lsSet(LS.smithyCastleCount, String(state.castles.length));
				state.castlesError = null;
				state.castlesAt = Date.now();
				state.smithyCastleCheckedAt = state.castlesAt;
				var cur = currentCastle();
				if (cur) state.currentCastleId = cur.id;
				saveCastlesCache();
			}
			lastJson.castles = res;
			renderCastles();
			renderCastleChip();
			renderProvince();
			renderSmithy();
			renderBuildQueue();
			renderAbStatus();
			if (el.castlesMeta) {
				var n = state.castles.length;
				el.castlesMeta.textContent = n
					? (n + ' قلعة' + (n < 2
						? ' • قلعة واحدة — لا دوران'
						: ' • ' + new Date().toLocaleTimeString('en-GB')))
					: '';
			}
			if (state.tab === 'raw') renderJson();
			if (state.tab === 'smithy' && state.smithyCastleId) syncSmithyLevels(false);
			if (!silent && state.castles.length < 2) {
				toast(state.castles.length === 1
					? 'عندك قلعة واحدة فقط — لا حاجة للتبديل أو الدوران'
					: 'تعذّر جلب القلاع', 'err');
			}
		});
	}

	/* تبديل القلعة عبر السيرفر فقط — الصفحة لا تنتقل. */
	function switchCastle(id, opts) {
		opts = opts || {};
		id = toInt(id);
		if (!id) return;
		if (!hasAjax()) { toast('لا اتصال باللعبة', 'err'); return; }
		withCastleLock(function (releaseCastleLock) {
			setDot('busy');
			setCastle(id, function (res) {
			if (!res || !res.ok) {
				var msg = (res && (res.error || 'لم يتم التبديل')) || 'فشل';
				toast('تبديل القلعة: ' + msg, 'err');
				setDot('err');
				releaseCastleLock();
				if (opts.onDone) opts.onDone(false, res);
				return;
			}
			state.castles = res.castles || state.castles;
			state.currentCastleId = String(id);
			state.castlesAt = Date.now();
			state.smithyCastleCheckedAt = state.castlesAt;
			saveCastlesCache();
			/* المباني خاصة بالقلعة → أبطِلها */
			state.buildings = [];
			state.buildingsAt = 0;
			renderCastles();
			renderCastleChip();
			renderProvince();
			state.abBlocked = {};
			renderBuildQueue();
			renderAbStatus();
			renderSmithy();
			if (state.autoBuild) {
				state.autoBuildNextAt = Date.now() + 1500;
				state.ifCheckAt = 0;      /* جدول البناء يخصّ القلعة الجديدة */
				state.buildRunning = false;
			}
			setDot('ok');
			if (!opts.silent) {
				var c = currentCastle();
				toast('تم التبديل إلى ' + (c ? (c.name + (c.coords ? ' (' + c.coords + ')' : '')) : ('#' + id)), 'ok');
			}
			if (state.tab === 'buildings') loadBuildings(true);
			releaseCastleLock();
			if (opts.onDone) opts.onDone(true, res);
			});
		});
	}

	function nextCastle() {
		var list = state.castles;
		if (list.length < 2) return null;
		var idx = -1;
		for (var i = 0; i < list.length; i++) {
			if (String(list[i].id) === String(state.currentCastleId)) { idx = i; break; }
		}
		if (idx === -1) {
			for (var k = 0; k < list.length; k++) {
				if (list[k].isCurrent) { idx = k; break; }
			}
		}
		return list[(idx + 1) % list.length];
	}

	function startCycle() {
		stopCycle();
		if (!state.cycle) return;

		/* لم نعرف القلاع بعد: نتحقق أولاً ثم نقرر */
		if (!state.castles.length) {
			loadCastles(true);
			setTimeout(function () {
				if (!state.cycle) return;
				if (state.castles.length > 1) startCycle();
				else disableCycle(state.castles.length
					? 'عندك قلعة واحدة فقط — لا حاجة للدوران'
					: 'تعذّر معرفة القلاع — أُوقفت الدورة');
			}, 1500);
			return;
		}

		/* قلعة واحدة = لا دوران */
		if (state.castles.length < 2) {
			disableCycle('عندك قلعة واحدة فقط — لا حاجة للدوران');
			return;
		}

		var fails = 0;
		state.cycleTimer = setInterval(function () {
			if (!hasAjax()) return;
			if (!state.castles.length) { loadCastles(true); return; }
			var n = nextCastle();
			if (!n) return;
			switchCastle(n.id, {
				silent: true,
				onDone: function (ok) {
					if (ok) { fails = 0; return; }
					fails++;
					if (fails >= 3) {
						disableCycle('أُوقفت الدورة التلقائية بعد 3 محاولات فاشلة');
					}
				}
			});
		}, state.cycleInterval * 1000);
	}

	function stopCycle() {
		if (state.cycleTimer) { clearInterval(state.cycleTimer); state.cycleTimer = null; }
	}

	/* إيقاف الدورة وإطفاء الخيار (مع رسالة اختيارية) */
	function disableCycle(msg) {
		state.cycle = false;
		lsSet(LS.cycle, '0');
		if (el.cycle) el.cycle.checked = false;
		stopCycle();
		if (msg) toast(msg, 'err');
	}

	/* زيارة كل القلاع مرة واحدة ثم العودة للقلعة الأصلية */
	function cycleOnce() {
		if (!hasAjax()) { toast('لا اتصال باللعبة', 'err'); return; }
		toast('جاري دورة القلاع…', 'ok');
		getCastles(function (res) {
			if (!res || res.error || !res.castles.length) { toast('تعذّر جلب القلاع', 'err'); return; }
			state.castles = res.castles;
			renderCastles();
			renderCastleChip();

			if (state.castles.length < 2) {
				toast(state.castles.length === 1
					? 'عندك قلعة واحدة فقط — لا حاجة للدوران'
					: 'لا توجد قلاع للدوران', 'err');
				return;
			}

			var cur = currentCastle();
			var startId = cur ? cur.id : state.currentCastleId;
			var i = 0;
			(function step() {
				if (i >= state.castles.length) {
					if (startId) switchCastle(startId);
					else toast('انتهت دورة القلاع', 'ok');
					return;
				}
				var c = state.castles[i++];
				switchCastle(c.id, { silent: true });
				setTimeout(step, 3000);
			})();
		});
	}

	/* ============================================================
	 * 3.8) الأمير / المدينة (province.php)
	 * ============================================================
	 * نفس مسار اللعبة، عبر Ajax فقط وبدون أي تنقّل:
	 *   GET  province.php                → HTML فيه  $('slot_N')…slotAction(2, <id>)
	 *   POST province.php action=2&id=…  → نافذة المهمة (فيها #attendBtn)
	 *   POST province.php action=3&id=…  → إرسال الأمير  {"data":{"error":false}}
	 *
	 * بعد الإرسال تبقى الفتحة ظاهرة مع مؤقّت:
	 *   Timers.add(…, <ثوانٍ>, 'slot_timer_<N>')
	 * لذلك نستخرج المؤقّت ونعتبر الفتحة «مشغولة» حتى انتهائه (منع الإرسال المكرر).
	 *
	 * إعدادات لكل قلعة: localStorage['prov'] = { castleName: true|false }
	 * (نفس صيغة سكربت Prov2026 القديم — غياب المفتاح يعني مفعّل).
	 */

	var PROVINCE_MAX_SLOTS = 4;
	var PROVINCE_AUTO_COOLDOWN_MS = 30000;
	var PROVINCE_AUTO_POLL_MS = 31000;
	var PROVINCE_SENT_TTL_MS = 30 * 60 * 1000;

	function isProvincePage() {
		return /\/province\.php$/i.test(String(location.pathname || ''));
	}

	function provinceSettings() {
		try {
			var o = JSON.parse(lsGet('prov', '{}'));
			return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
		} catch (e) { return {}; }
	}

	function provinceCastleName() {
		var cur = currentCastle();
		if (cur && cur.name) return String(cur.name).replace(/\s+/g, ' ').trim();
		var title = document.getElementById('title');
		if (title && title.firstElementChild) {
			var n = (title.firstElementChild.textContent || '').replace(/\s+/g, ' ').trim();
			if (n) return n;
		}
		/* احتياطي: castle_name / castle_id مصفوفتان متوازيتان */
		var names = readJsonLS('castle_name', null);
		var ids = readJsonLS('castle_id', null);
		if (Array.isArray(names) && Array.isArray(ids) && state.currentCastleId != null) {
			for (var i = 0; i < ids.length; i++) {
				if (String(ids[i]) === String(state.currentCastleId) && names[i]) {
					return String(names[i]).replace(/\s+/g, ' ').trim();
				}
			}
		}
		return null;
	}

	/* إعدادات نوم per-castle: { castleId: untilTimestamp } — для того чтобы не запрашивать
	 * province.php каждые 30с, если миссий нет и ждать >5 мин. */
	function provinceSleepMap() {
		try {
			var o = JSON.parse(lsGet(LS.provinceSleep, '{}'));
			return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
		} catch (e) { return {}; }
	}
	function provinceSleepUntil(castleId) {
		if (castleId == null) return 0;
		var m = provinceSleepMap();
		return toInt(m[String(castleId)], 0);
	}
	function setProvinceSleep(castleId, until) {
		if (castleId == null) return;
		var m = provinceSleepMap();
		m[String(castleId)] = until;
		try { localStorage.setItem(LS.provinceSleep, JSON.stringify(m)); }
		catch (e) { /* ignore */ }
	}
	function clearProvinceSleep(castleId) {
		if (castleId == null) return;
		var m = provinceSleepMap();
		delete m[String(castleId)];
		try { localStorage.setItem(LS.provinceSleep, JSON.stringify(m)); }
		catch (e) { /* ignore */ }
	}

	function provinceIsEnabled(name) {
		name = name || provinceCastleName();
		if (!name) return true;   /* بلا اسم: نفس سلوك السكربت القديم (مفعّل) */
		var s = provinceSettings();
		if (!Object.prototype.hasOwnProperty.call(s, name)) return true;
		var v = s[name];
		return !(v === false || v === 'false' || v === 0 || v === '0');
	}

	function setProvinceEnabled(on) {
		var name = provinceCastleName();
		if (!name) {
			toast('تعذّر تحديد اسم القلعة', 'err');
			renderProvince();
			return false;
		}
		var s = provinceSettings();
		s[name] = !!on;
		try { localStorage.setItem('prov', JSON.stringify(s)); }
		catch (e) { toast('تعذّر حفظ إعداد الأمير', 'err'); renderProvince(); return false; }
		pvLog((on ? '✔ تفعيل' : '⏸ تعطيل') + ' الأمير للقلعة «' + name + '»', on ? 'ok' : 'warn');
		renderProvince();
		return true;
	}

	function pvLog(msg, kind) {
		state.pvLog.push({ t: Date.now(), msg: msg, kind: kind || '' });
		if (state.pvLog.length > 40) state.pvLog.shift();
		renderPvLog();
	}

	function renderPvLog() {
		if (!el.pvLog) return;
		el.pvLog.innerHTML = state.pvLog.slice(-6).map(function (l) {
			return '<div class="' + l.kind + '">' +
				new Date(l.t).toLocaleTimeString('en-GB') + ' — ' + esc(l.msg) +
				'</div>';
		}).join('');
		el.pvLog.scrollTop = el.pvLog.scrollHeight;
	}

	function setPvStatus(kind, text) {
		state.pvStatus = kind || 'idle';
		state.pvStatusText = text || '';
		renderProvince();
	}

	function renderProvince() {
		if (!el.pvBox) return;
		var name = provinceCastleName();
		var enabled = provinceIsEnabled(name);

		if (el.pvEnabled) {
			el.pvEnabled.checked = enabled;
			el.pvEnabled.disabled = !name;
		}
		if (el.pvAuto) el.pvAuto.checked = state.pvAuto;
		el.pvBox.classList.toggle('kw-on', enabled);

		if (el.pvCastle) {
			if (name) {
				el.pvCastle.innerHTML = 'القلعة: <b>' + esc(name) + '</b> ' +
					(state.currentCastleId != null ? '<span class="kw-id">#' + esc(state.currentCastleId) + '</span> ' : '') +
					'<span class="kw-meta">• prov[' + esc(name) + '] = ' + (enabled ? 'مفعّل' : 'معطّل') + '</span>';
			} else {
				el.pvCastle.innerHTML = '<span class="kw-meta">تعذّر تحديد اسم القلعة — سيُعتبر الأمير مفعّلاً.</span>';
			}
		}
		if (el.pvStatus) el.pvStatus.textContent = state.pvStatusText || '—';
		renderProvinceSlots();
	}

	function renderProvinceSlots() {
		if (!el.pvSlots) return;
		var rows = state.pvSlots;
		if (!rows.length) {
			el.pvSlots.innerHTML = '';
			el.pvSlots.style.display = 'none';
			el.pvEmpty.style.display = '';
			el.pvEmpty.textContent = state.pvError ? ('تعذّر الفحص: ' + state.pvError) : 'اضغط «فحص المهام».';
			return;
		}
		el.pvEmpty.style.display = 'none';
		el.pvSlots.style.display = '';

		var head = '<thead><tr>' +
			'<th>الفتحة</th>' +
			'<th>المهمة</th>' +
			'<th>الحالة</th>' +
			'<th>المتبقي</th>' +
			'</tr></thead>';

		var body = '<tbody>' + rows.map(function (s) {
			var cls = s.status === 'free' ? 'free' : (s.status === 'busy' ? 'busy' : 'locked');
			var label = s.status === 'free' ? 'متاحة' : (s.status === 'busy' ? 'الأمير في مهمة' : 'بانتظار المهمة');
			return '<tr class="' + (s.status === 'free' ? 'kw-current' : '') + '">' +
				'<td class="kw-time">' + esc(s.slot) + '</td>' +
				'<td>' + esc(s.type || '—') + '</td>' +
				'<td><span class="kw-badge ' + cls + '">' + label + '</span></td>' +
				'<td class="kw-time">' + esc(s.timer || '—') + '</td>' +
				'</tr>';
		}).join('') + '</tbody>';

		el.pvSlots.innerHTML = head + body;
	}

	function parseProvince(html) {
		html = html || '';
		var slots = [], busySec = {};
		var reT = /Timers\.add\([\s\S]{0,400}?,\s*(\d+)\s*,\s*'slot_timer_(\d+)'\s*\)/g, tm;
		while ((tm = reT.exec(html))) busySec[toInt(tm[2])] = toInt(tm[1]);

		try {
			var doc = new DOMParser().parseFromString(html, 'text/html');
			for (var i = 1; i <= PROVINCE_MAX_SLOTS; i++) {
				var node = doc.getElementById('slot_' + i);
				if (!node) continue;
				var cls = node.className || '';
				var inactive = /(^|\s)inactive(\s|$)/.test(cls);
				var timerEl = doc.getElementById('slot_timer_' + i);
				var waitTxt = timerEl ? (timerEl.textContent || '').replace(/\s+/g, ' ').trim() : '';
				var title = node.getAttribute('title') || '';
				var hm = title.match(/header=\[([^\]]*)\]/);
				var remain = toInt(busySec[i], 0);
				var status;
				if (inactive) status = 'waiting';
				else if (remain > 0 || timerEl) status = 'busy';
				else status = 'free';
				slots.push({
					slot: i,
					type: (hm ? hm[1] : '').replace(/\s+/g, ' ').trim(),
					status: status,
					remain: remain,
					timer: remain > 0 ? formatSeconds(remain) : waitTxt
				});
			}
		} catch (e) { /* نكمل بالبيانات المتاحة */ }

		var missions = [], seen = {};
		var re = /\$\('slot_(\d+)'\)[\s\S]{0,400}?slotAction\(\s*2\s*,\s*(\d+)\s*\)/g, m;
		while ((m = re.exec(html))) {
			var key = m[1] + ':' + m[2];
			if (seen[key]) continue;
			seen[key] = 1;
			missions.push({ slot: toInt(m[1]), id: toInt(m[2]) });
		}
		if (!missions.length) {
			var re2 = /slotAction\(\s*2\s*,\s*(\d+)\s*\)/g;
			while ((m = re2.exec(html))) {
				var k2 = '0:' + m[1];
				if (seen[k2]) continue;
				seen[k2] = 1;
				missions.push({ slot: 0, id: toInt(m[1]) });
			}
		}

		/* استبعد مهام الفتحات المشغولة (الأمير في مهمة) */
		var bySlot = {};
		for (var s = 0; s < slots.length; s++) bySlot[slots[s].slot] = slots[s];
		missions = missions.filter(function (x) {
			if (!x.slot) return true;
			var st = bySlot[x.slot];
			return !st || st.status === 'free';
		});

		return { slots: slots, missions: missions };
	}

	function provinceAjax(params, cb) {
		if (!hasAjax()) { cb({ error: 'no-ajax' }); return; }
		var opts = {
			evalJS: false,
			method: params ? 'post' : 'get',
			onSuccess: function (response) {
				var txt = response.responseText || '';
				var json = null;
				try { json = txt.evalJSON(true); } catch (e) { json = null; }
				cb({ ok: true, text: txt, json: json });
			},
			onFailure: function (response) {
				cb({ error: 'http-' + response.status });
			}
		};
		if (params) opts.parameters = params;
		new window.Ajax.Request('province.php', opts);
	}

	function provinceText(html) {
		try {
			var doc = new DOMParser().parseFromString(html || '', 'text/html');
			return ((doc.body ? doc.body.textContent : '') || '').replace(/\s+/g, ' ').trim();
		} catch (e) { return ''; }
	}

	function provinceReplyError(resp) {
		if (!resp) return 'لا رد من السيرفر';
		if (resp.error) return resp.error;
		var j = resp.json;
		if (j && j.data) return j.data.error ? (provinceText(j.html) || 'رفض السيرفر الطلب') : null;
		if (j) return null;
		var t = provinceText(resp.text);
		if (/(خطأ|غير كاف|غير مسموح|ممنوع|لا يمكن|يجب|مشغول)/.test(t)) return t.slice(0, 160);
		return 'ردّ غير متوقع من السيرفر';
	}

	function loadProvince(manual, cb) {
		if (state.pvLoading) { if (cb) cb({ ok: false, reason: 'loading' }); return; }
		state.pvLoading = true;
		if (manual) setPvStatus('busy', 'جارٍ فحص المهام…');

		provinceAjax(null, function (res) {
			state.pvLoading = false;
			if (res.error) {
				state.pvError = res.error;
				setPvStatus('error', 'تعذّر الفحص: ' + res.error);
				if (manual) pvLog('✕ تعذّر فحص المهام: ' + res.error, 'err');
				if (cb) cb({ ok: false, error: res.error });
				return;
			}
			var parsed = parseProvince(res.text);
			state.pvSlots = parsed.slots;
			state.pvMissions = parsed.missions;
			state.pvError = null;
			state.pvAt = Date.now();
			setPvStatus('ok', parsed.missions.length
				? (parsed.missions.length + ' مهمة متاحة')
				: 'لا توجد مهام متاحة الآن');
			if (manual) pvLog('فحص: ' + parsed.missions.length + ' مهمة متاحة', parsed.missions.length ? 'ok' : '');
			if (cb) cb({ ok: true, slots: parsed.slots, missions: parsed.missions });
		});
	}

	function provinceSendNow(opts) {
		opts = opts || {};
		var startCastle = currentCastleInfo();
		var expectedCastleId = startCastle ? String(startCastle.id) : (state.currentCastleId != null ? String(state.currentCastleId) : null);
		var releaseCastleContext = null;
		function finish(out) {
			if (releaseCastleContext) { releaseCastleContext(); releaseCastleContext = null; }
			state.pvBusy = false;
			if (opts.cb) opts.cb(out);
		}

		if (state.pvBusy) { finish({ ok: false, reason: 'busy' }); return; }
		if (!hasAjax()) {
			setPvStatus('error', 'لا اتصال باللعبة');
			finish({ ok: false, error: 'no-ajax' });
			return;
		}
		if (!opts.force && !provinceIsEnabled()) {
			setPvStatus('idle', 'معطّل لهذه القلعة');
			if (opts.manual) {
				pvLog('⏸ الأمير معطّل لهذه القلعة', 'warn');
				toast('الأمير معطّل لهذه القلعة', 'err');
			}
			finish({ ok: false, reason: 'disabled' });
			return;
		}

		state.pvBusy = true;
		setPvStatus('busy', opts.auto ? 'فحص تلقائي…' : 'جارٍ إرسال الأمير…');
		if (opts.manual) pvLog('→ فحص المهام وإرسال الأمير…', '');

		provinceAjax(null, function (load) {
			if (load.error) {
				setPvStatus('error', 'تعذّر الفحص: ' + load.error);
				pvLog('✕ ' + load.error, 'err');
				finish({ ok: false, error: load.error });
				return;
			}
			var parsed = parseProvince(load.text);
			state.pvSlots = parsed.slots;
			state.pvMissions = parsed.missions;
			state.pvAt = Date.now();
			state.pvError = null;
			renderProvince();

			var target = null;
			for (var i = 0; i < parsed.missions.length; i++) {
				var mm = parsed.missions[i];
				var last = state.pvSent[mm.id] || 0;
				if (Date.now() - last < PROVINCE_SENT_TTL_MS) continue;
				target = mm;
				break;
			}
			if (!target) {
				/* حساب أقرب وقت ظهور مهمة من مؤقّتات الفتحات «بانتظار»
				 * (الصفحة تقول: "ستظهر المهمة التالية خلال ~28m").
				 * نؤخّر الفحص التلقائي حتى قرب ذلك الوقت (مع هامش 2 د)
				 * بدل طلب province.php كل 30 ثانية بلا فائدة. */
				var minWaitMs = 0;
				for (var wi = 0; wi < parsed.slots.length; wi++) {
					var wslot = parsed.slots[wi];
					if (!wslot) continue;
					var candidate = 0;
					if (wslot.status === 'waiting') {
						candidate = parseWaitMs(wslot.timer);
					} else if (wslot.status === 'busy') {
						/* الأمير في مهمة: نوم حتى عودته (remain بالثواني) */
						candidate = (wslot.remain || 0) * 1000;
					}
					if (candidate > 0 && (minWaitMs === 0 || candidate < minWaitMs)) minWaitMs = candidate;
				}
				setPvStatus('idle', parsed.missions.length ? 'المهام المتاحة أُرسلت بالفعل' : 'لا توجد مهام متاحة');
				if (opts.manual) pvLog('… لا توجد مهمة جديدة لإرسال الأمير إليها', 'warn');
				if (minWaitMs > 5 * 60 * 1000) {
					var delay = Math.min(Math.max(0, minWaitMs - 120000), 5 * 60 * 1000);
					var nextAt = Date.now() + delay;
					setProvinceSleep(expectedCastleId || state.currentCastleId, nextAt);
					state.pvNextCheckAt = nextAt;
					pvLog('⏳ لا مهمات الآن — الفحص التالي بعد ' +
						formatSeconds(Math.round(delay / 1000)) +
						' (المهمة تظهر خلال ~' +
						formatSeconds(Math.round(minWaitMs / 1000)) + ')', '');
				}
				finish({ ok: false, reason: 'no-mission' });
				return;
			}

			/* نافذة المهمة — نفس ما يحدث عند الضغط على الفتحة */
			provinceAjax('action=2&id=' + target.id, function (detail) {
				var derr = provinceReplyError(detail);
				if (derr) {
					setPvStatus('error', derr);
					pvLog('✕ المهمة #' + target.id + ': ' + derr, 'err');
					finish({ ok: false, error: derr });
					return;
				}
				var html = (detail.json && detail.json.html) || '';
				var sendBtn = new RegExp('slotAction\\(\\s*3\\s*,\\s*' + target.id + '\\s*\\)');
				if (html.indexOf('attendBtn') === -1 || !sendBtn.test(html)) {
					var msg = 'زر «أرسل الأمير» غير متاح لهذه المهمة';
					setPvStatus('error', msg);
					pvLog('✕ ' + msg + ' (مهمة #' + target.id + ')', 'err');
					finish({ ok: false, error: msg });
					return;
				}

				/* لا ترسل إذا أُوقف الخيار أو عُطّلت القلعة أثناء الفحص */
				if (opts.auto && (!state.pvAuto || !provinceIsEnabled())) {
					setPvStatus('idle', 'معطّل');
					finish({ ok: false, reason: 'disabled' });
					return;
				}

				withVerifiedCastle(expectedCastleId, function (releaseLock) {
					releaseCastleContext = releaseLock;
					provinceAjax('action=3&id=' + target.id, function (send) {
					var serr = provinceReplyError(send);
					if (serr) {
						setPvStatus('error', serr);
						pvLog('✕ إرسال الأمير: ' + serr, 'err');
						finish({ ok: false, error: serr });
						return;
					}
					state.pvSent[target.id] = Date.now();
					clearProvinceSleep(expectedCastleId || state.currentCastleId);
					lsSet(LS.provinceLastAuto, String(Date.now()));
					setPvStatus('ok', 'أُرسل الأمير — مهمة #' + target.id);
					pvLog('✔ أُرسل الأمير (مهمة #' + target.id +
						(target.slot ? '، فتحة ' + target.slot : '') + ')', 'ok');
					if (opts.manual) toast('أُرسل الأمير', 'ok');
					finish({ ok: true, mission: target, reply: send.json });

					/* تحديث الحالة بعد أن يحدّث السيرفر الفتحة والمؤقّت */
					setTimeout(function () {
						loadProvince(false, function (r) {
							if (!r || !r.ok) return;
							var still = false;
							for (var z = 0; z < r.missions.length; z++) {
								if (r.missions[z].id === target.id) { still = true; break; }
							}
							if (still) {
								setPvStatus('error', 'المهمة لم تتغيّر حالتها بعد الإرسال');
								pvLog('… المهمة #' + target.id + ' ما زالت متاحة — تحقق يدوياً', 'warn');
							}
						});
					}, 1500);
					});
				}, function () {
					setPvStatus('error', 'تغيّرت القلعة النشطة؛ لم أرسل الأمير');
					finish({ ok: false, reason: 'castle-changed' });
				});
			});
		});
	}

	/* إرسال تلقائي من أي صفحة: محاولة فورية عند التحميل + فحص دوري.
	 * لا يظهر أي تأكيد، ولا يتطلب فتح province.php. */
	function autoProvinceTry() {
		if (!state.pvAuto) return;
		if (!provinceIsEnabled()) return;
		/* نوم per-castle */
		var sleepUntil = provinceSleepUntil(state.currentCastleId);
		if (sleepUntil && Date.now() < sleepUntil) return;
		var last = toInt(lsGet(LS.provinceLastAuto, '0'), 0);
		if (last && Date.now() - last < PROVINCE_AUTO_COOLDOWN_MS) return;
		lsSet(LS.provinceLastAuto, String(Date.now()));
		var delay = isProvincePage() ? 1200 : 800;
		setTimeout(function () {
			/* قد يُعطّل المستخدم الخيار خلال المهلة القصيرة */
			if (!state.pvAuto || !provinceIsEnabled()) return;
			provinceSendNow({ auto: true });
		}, delay);
	}

	function syncProvinceAutoTimer() {
		if (state.pvAutoTimer) { clearInterval(state.pvAutoTimer); state.pvAutoTimer = null; }
		if (!state.pvAuto) return;
		state.pvAutoTimer = setInterval(autoProvinceTry, PROVINCE_AUTO_POLL_MS);
	}

	/* ============================================================
	 * 4) التحديث
	 * ============================================================ */

	function refreshMarches() {
		if (!hasAjax()) {
			state.error = 'الجلسة غير متصلة (no Ajax).';
			setDot('err');
			renderMarches();
			renderMeta();
			return;
		}
		state.loading = true;
		state.error = null;
		setDot('busy');
		renderMeta();
		if (el.refresh) el.refresh.classList.add('kw-spin');

		var seq = ++state.refreshSeq;
		var finished = false;

		function finish(res) {
			if (finished) return;
			finished = true;
			if (seq !== state.refreshSeq) return;
			state.loading = false;
			if (el.refresh) el.refresh.classList.remove('kw-spin');

			if (!res || res.error) {
				state.error = (res && res.error) || 'unknown';
				state.marches = [];
				state.pending = [];
				setDot('err');
			} else {
				state.marches = res.marches || [];
				state.pending = res.pending || [];
				state.fetchedAt = Date.now();
				state.source = res.source || 'ajax';
				setDot('ok');
			}
			lastJson.marches = res;
			renderMarches();
			renderMeta();
			if (state.tab === 'raw') renderJson();
		}

		/* حماية من التعليق */
		var watchdog = setTimeout(function () {
			finish({ error: 'timeout' });
		}, 20000);

		getMarches(function (res) {
			clearTimeout(watchdog);
			finish(res);
		});
	}

	function refreshActive() {
		if (state.tab === 'buildings') loadBuildings(true);
		else if (state.tab === 'smithy') syncSmithyLevels(false);
		else if (state.tab === 'castles') loadCastles(true);
		else refreshMarches();
	}

	function loadBuildings(force) {
		if (!hasAjax()) {
			state.buildingsError = 'الجلسة غير متصلة (no Ajax).';
			renderBuildings();
			return;
		}
		if (state.buildingsLoading) return;
		state.buildingsLoading = true;
		state.buildingsError = null;
		el.buildingsMeta.textContent = 'جارٍ التحميل…';

		var watchdog = setTimeout(function () {
			state.buildingsLoading = false;
			state.buildingsError = 'timeout';
			renderBuildings();
			el.buildingsMeta.textContent = 'انتهت المهلة';
		}, 20000);

		getBuildings(function (res) {
			clearTimeout(watchdog);
			state.buildingsLoading = false;
			if (res && res.error) {
				state.buildingsError = res.error;
			} else {
				state.buildings = (res && res.buildings) || [];
				state.buildingsAt = Date.now();
			}
			lastJson.buildings = res;
			renderBuildings();
			renderBuildQueue();
			el.buildingsMeta.textContent = state.buildings.length
				? (state.buildings.length + ' مبنى • ' + new Date().toLocaleTimeString('en-GB'))
				: '';
			if (state.tab === 'raw') renderJson();
		});
	}

	function renderJson() {
		if (!el.json) return;
		var obj = {};
		if (Object.keys(lastJson).length === 0) {
			obj = { note: 'لا توجد بيانات بعد', marches: state.marches, pending: state.pending };
		} else {
			obj = lastJson;
		}
		try { el.json.textContent = JSON.stringify(obj, null, 2); }
		catch (e) { el.json.textContent = String(obj); }
	}

	function syncAutoTimer() {
		if (state.autoTimer) { clearInterval(state.autoTimer); state.autoTimer = null; }
		if (!state.auto || !state.open) return;
		state.autoTimer = setInterval(function () {
			if (!state.open) return;
			if (state.tab === 'buildings') loadBuildings();
			else if (state.tab === 'castles') loadCastles(true);
			else if (state.tab === 'marches') refreshMarches();
		}, state.interval * 1000);
	}

	/* ============================================================
	 * 5) التشغيل
	 * ============================================================ */

	function init() {
		/* قائمة القلاع من الكاش أولاً (اسم + معرّف) → أول رسم بدون أي طلب */
		hydrateCastlesCache();
		/* ترقيات أُرسلت قبل إعادة التحميل وتنتظر تأكيد المستوى */
		loadPendingBuilds();
		/* مهارة أُرسلت قبل إعادة التحميل وتنتظر تأكيد ارتفاع المستوى */
		state.pendingSkill = loadPendingSkill();
		buildUI();
		setInterval(tickMarches, 1000);

		/* طلب واحد خفيف لـ ajax_castles.php فقط إن كان الكاش غائباً أو قديماً */
		if (!state.castles.length || Date.now() - state.castlesAt > CASTLES_TTL) loadCastles(true);

		/* إعادة التحميل عند عودة الاتصال */
		window.addEventListener('online', function () { if (state.open) refreshActive(); });

		/* الأمير: إرسال تلقائي من أي صفحة (عند التحميل ثم دورياً) */
		syncProvinceAutoTimer();
		autoProvinceTry();
	}

	/* API عام */
	window.KW = {
		version: VERSION,
		getMarches: getMarches,
		getMarchInfo: getMarchInfo,
		incomingAttacks: function () {
			return state.marches.filter(function (m) { return !!m.incomingAttack; }).map(function (m) {
				return {
					key: m.incomingAttackKey,
					marchId: m.id,
					sender: m.sender,
					receiver: m.receiver,
					targetCastle: m.targetCastle || m.to,
					timeRemaining: m.timeRemaining,
					timeFormatted: m.timeFormatted,
					type: m.type,
					typeLabel: m.typeLabel
				};
			});
		},
		getBuildings: getBuildings,
		buildQueue: function () { return currentQueue(); },
		buildQueueLive: getBuildQueue,
		instantFinishQueue: function (cb) {
			getBuildQueue(function (res) {
				if (!res || res.error) { if (cb) cb({ ok: false, reason: 'error', queue: res }); return; }
				if (!res.items.length) { if (cb) cb({ ok: false, reason: 'empty' }); return; }
				var head = res.items[0];
				if (head.remain > FREE_FINISH_SEC) {
					if (cb) cb({ ok: false, reason: 'too-early', remain: head.remain });
					return;
				}
				finishHeadIfFree(head, function (out) {
					if (cb) cb(out);
				});
			});
		},
		checkQueueNow: function (cb) {
			state.ifBusy = false;
			checkBuildQueue(cb);
		},
		autoBuildStart: function () { autoBuildSet(true); },
		autoBuildStop: function () { autoBuildSet(false); },
		autoBuildStatus: function () {
			return {
				on: state.autoBuild,
				status: state.abStatus,
				text: state.abStatusText,
				nextInMs: Math.max(0, state.autoBuildNextAt - Date.now()),
				queueCheckInMs: Math.max(0, state.ifCheckAt - Date.now()),
				buildRunning: state.buildRunning,
				instantFinish: state.instantFinish,
				verifyMode: 'strict',
				pending: state.pendingBuilds.map(function (p) {
					return { id: p.id, name: p.name, before: p.before, tries: p.tries, uncertain: !!p.uncertain };
				}),
				log: state.abLog.slice(-10)
			};
		},
		pendingBuilds: function () {
			return state.pendingBuilds.map(function (p) {
				return { id: p.id, name: p.name, before: p.before, sentAt: p.sentAt, key: p.key, tries: p.tries };
			});
		},
		buildingLevel: function (id, cb) {
			getBuildingLevelAjax(id, function (res) { if (cb) cb(res); });
		},
		quests: function (cb) {
			questLoadAll(function (res) {
				if (cb) cb(res);
			});
		},
		claimQuests: function (cb) {
			var ci = currentCastleInfo();
			var expectedCastleId = ci ? String(ci.id) : (state.currentCastleId != null ? String(state.currentCastleId) : null);
			state.autoBuildBusy = true;
			questLoadAll(function (res) {
				state.autoBuildBusy = false;
				if (res.error) { if (cb) cb({ ok: false, error: res.error }); return; }
				var list = res.list || [];
				var claimable = [];
				for (var i = 0; i < list.length; i++) {
					if (list[i].isClaimable) claimable.push(list[i]);
				}
				if (!claimable.length) { if (cb) cb({ ok: true, claimed: 0, list: list }); return; }
				var at = 0, ok = 0;
				function next() {
					if (at >= claimable.length) { if (cb) cb({ ok: ok > 0, claimed: ok, list: list }); return; }
					var questId = claimable[at++].questId;
					withVerifiedCastle(expectedCastleId, function (releaseCastleLock) {
						questClaim(questId, function (r) {
							releaseCastleLock();
							if (r && r.ok) ok++;
							next();
						});
					}, function () {
						state.autoBuildBusy = false;
						if (cb) cb({ ok: false, claimed: ok, error: 'castle-changed', list: list });
					});
				}
				next();
			});
		},
		getCastles: getCastles,
		smithy: {
			refresh: function (cb) { syncSmithyLevels(true, cb); },
			queue: function () { return smithyReadQueue(); },
			setCastle: function (id) {
				state.smithyCastleId = String(id || '');
				lsSet(LS.smithyCastle, state.smithyCastleId);
				renderSmithy();
				return state.smithyCastleId;
			},
			setAuto: setSmithyAuto,
			status: function () {
				var castle = smithySelectedCastle();
				return {
					auto: state.smithyAuto,
					castle: castle ? { id: castle.id, name: castle.name } : null,
					levels: castle ? smithyReadData(castle.id).levels : {},
					queue: smithyReadQueue(),
					status: state.smithyStatus
				};
			}
		},
		castleMap: function () {
			var out = [];
			for (var i = 0; i < state.castles.length; i++) {
				var key = keyForIndex(state.castles.length, i);
				out.push({
					id: state.castles[i].id,
					name: state.castles[i].name,
					coords: state.castles[i].coords || '',
					current: String(state.castles[i].id) === String(state.currentCastleId),
					queueKey: key,
					queue: queueForKey(key)
				});
			}
			return out;
		},
		currentCastle: function () { return currentCastleInfo(); },
		setCastle: function (id, cb) {
			switchCastle(id, { silent: true, onDone: function (ok, result) {
				if (cb) cb(ok ? result : { ok: false, error: result && result.error ? result.error : 'switch-failed' });
			} });
		},
		switchCastle: switchCastle,
		cycleCastles: cycleOnce,
		upgrade: function (id, cb) {
			var ci = currentCastleInfo();
			var expectedCastleId = ci ? String(ci.id) : (state.currentCastleId != null ? String(state.currentCastleId) : null);
			withVerifiedCastle(expectedCastleId, function (releaseCastleLock) {
				upgradeBuilding(id, function (result) {
					releaseCastleLock();
					if (cb) cb(result);
				});
			}, function () {
				if (cb) cb({ error: 'castle-changed' });
			});
		},
		province: {
			status: function () {
				return {
					enabled: provinceIsEnabled(),
					castle: provinceCastleName(),
					auto: state.pvAuto,
					busy: state.pvBusy,
					slots: state.pvSlots,
					missions: state.pvMissions,
					at: state.pvAt,
					log: state.pvLog.slice(-10)
				};
			},
			check: function (cb) { loadProvince(true, cb); },
			attend: function (cb) { provinceSendNow({ manual: true, cb: cb }); },
			setEnabled: setProvinceEnabled,
			setAuto: function (on) {
				state.pvAuto = !!on;
				lsSet(LS.provinceAuto, state.pvAuto ? '1' : '0');
				renderProvince();
				syncProvinceAutoTimer();
				if (state.pvAuto) autoProvinceTry();
			}
		},
		open: function () { setOpen(true); },
		close: function () { setOpen(false); },
		toggle: function () { setOpen(!state.open); },
		refresh: function () { refreshActive(); },
		render: function () { renderMarches(); renderBuildings(); renderCastles(); renderSmithy(); renderMeta(); },
		state: function () { return state; }
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();
