/* Helpers for marches (المسيرات/الارساليات).
 *
 * getMarchesStatus(callback):
 *   - On marches.php (where the page's `marches.loadContent` exists) it calls
 *     marches.loadContent() (request + render + handlers) then reads the LIVE DOM.
 *   - On ANY other authenticated page it performs the SAME request that
 *     loadContent performs (POST ajax_marches.php with type=loadContent) and
 *     parses the response. No navigation, no extra requests.
 *   - For every march it then reads the march's POPULATION from info.php
 *     (li#population) — the population carried by the march, NOT the castle units.
 *
 * Output:
 *   { marches: [ {id, type, typeLabel, from, to, timeRemaining, timeFormatted,
 *                  marchTime, marchTimeFormatted, sender, population, cargo, cargoText,
 *                  arrivalTime, returnTime, progress, rawText} ],
 *     pending, currentPlayer, source }
 */

/* Parse a "HH:MM:SS" string into seconds. */
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

/* Format seconds as HH:MM:SS. */
function formatSeconds(sec) {
	sec = Math.max(0, Math.floor(sec || 0));
	var h = Math.floor(sec / 3600);
	var m = Math.floor((sec % 3600) / 60);
	var s = sec % 60;
	function pad(n) { return (n < 10 ? '0' : '') + n; }
	return pad(h) + ':' + pad(m) + ':' + pad(s);
}

/* Arabic march label -> machine type. */
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

/* Extract a "YYYY-MM-DD HH:MM:SS" datetime that follows a label in a text. */
function extractMarchDateTime(text, label) {
	if (!text) return null;
	var idx = text.indexOf(label);
	if (idx === -1) return null;
	var rest = text.slice(idx + label.length);
	var m = rest.match(/[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}/);
	return m ? m[0] : null;
}

/* Read one march's population (li#population = الرجال), cargo (li#cargo = مجموع السعة),
 * arrival (ستصل) and return (ستعود) times from info.php. */
function fetchMarchPopulation(marchId, callback) {
	if (!window.Ajax || typeof window.Ajax.Request !== 'function') {
		if (typeof callback === 'function') callback({ error: 'Ajax.Request unavailable' });
		return;
	}
	new window.Ajax.Request('info.php', {
		method: 'post',
		parameters: { what: 'pohod', posted_id: marchId },
		onSuccess: function (response) {
			var out = { population: null, cargo: null, cargoText: null, arrivalTime: null, returnTime: null, totalTime: null };
			try {
				var doc = new DOMParser().parseFromString(response.responseText || '', 'text/html');
				var popEl = doc.getElementById('population');
				if (popEl) {
					var popNum = parseInt(popEl.textContent.replace(/[^\d]/g, ''), 10);
					if (!isNaN(popNum)) out.population = popNum;
				}
				var cargoEl = doc.getElementById('cargo');
				if (cargoEl) {
					out.cargoText = cargoEl.textContent.replace(/\s+/g, ' ').trim();
					var cargoNum = parseInt(cargoEl.textContent.replace(/[^\d]/g, ''), 10);
					if (!isNaN(cargoNum)) out.cargo = cargoNum;
				}
				/* arrival (ستصل) and return (ستعود) times */
				var infoCol = doc.querySelector('.pohod-info-column-info');
				if (infoCol) {
					var items = infoCol.querySelectorAll('li');
					for (var j = 0; j < items.length; j++) {
						var txt = items[j].textContent || '';
						if (!out.arrivalTime && txt.indexOf('ستصل') !== -1) out.arrivalTime = extractMarchDateTime(txt, 'ستصل');
						if (!out.returnTime && txt.indexOf('ستعود') !== -1) out.returnTime = extractMarchDateTime(txt, 'ستعود');
					}
				}
				/* Total time is also embedded in the popup's own progress script:
				   updateProgressBar('barMarchProgress_marchInfo', 720, timeLeft) */
				var tmatch = (response.responseText || '').match(/barMarchProgress_marchInfo'[^0-9]*([0-9]+)/);
				if (tmatch) out.totalTime = parseInt(tmatch[1], 10);
			} catch (e) {
				out.error = e.message;
			}
			if (typeof callback === 'function') callback(out);
		},
		onFailure: function (response) {
			if (typeof callback === 'function') callback({ error: response.status });
		}
	});
}

/* Fetch population for every march in parallel, then call done(). */
function enrichMarchesWithPopulation(marches, done) {
	if (!marches || !marches.length) { if (done) done(); return; }
	var remaining = marches.length;
	for (var i = 0; i < marches.length; i++) {
		(function (m) {
			fetchMarchPopulation(m.id, function (info) {
				m.population = info.population;
				m.cargo = info.cargo;
				m.cargoText = info.cargoText;
				m.arrivalTime = info.arrivalTime;
				m.returnTime = info.returnTime;
				/* total time: prefer loadContent's marchTimes, fall back to the info popup */
				if ((m.marchTime == null || m.marchTime === '' || isNaN(parseInt(m.marchTime, 10))) && info.totalTime != null) {
					m.marchTime = info.totalTime;
				}
				m.marchTimeFormatted = (m.marchTime != null && !isNaN(parseInt(m.marchTime, 10)))
					? formatSeconds(parseInt(m.marchTime, 10))
					: (m.marchTimeFormatted || null);
				if (m.progress == null) m.progress = computeMarchProgress(m.timeRemaining, m.marchTime);
				if (info.error) m.populationError = info.error;
				remaining--;
				if (remaining === 0 && typeof done === 'function') done();
			});
		})(marches[i]);
	}
}

/* The same request loadContent() makes. Works from any authenticated page. */
function requestMarchesLoadContent(callback, filters) {
	if (!window.Ajax || typeof window.Ajax.Request !== 'function') {
		throw new Error('Ajax.Request is unavailable on this page.');
	}
	filters = filters || {};
	var params = {
		type: 'loadContent',
		castle_id: filters.castle_id || 0,
		min_pop: filters.min_pop || 0,
		direction: (typeof filters.direction !== 'undefined') ? filters.direction : 0,
		march_type: filters.march_type || 0,
		use_time_filter: filters.use_time_filter || 0,
		time_left_direction: filters.time_left_direction || 'up'
	};
	new window.Ajax.Request('ajax_marches.php', {
		method: 'post',
		parameters: params,
		onSuccess: function (response) {
			var result;
			try {
				result = response.responseText.evalJSON(true);
				parseMarchesResponse(result);
				result.source = 'ajax';
			} catch (error) {
				result = { raw: response.responseText, parseError: error.message };
			}
			if (result.marches) {
				enrichMarchesWithPopulation(result.marches, function () {
					if (typeof callback === 'function') callback(result);
				});
			} else {
				if (typeof callback === 'function') callback(result);
			}
		},
		onFailure: function (response) {
			if (typeof callback === 'function') callback({ httpError: response.status, raw: response.responseText });
		}
	});
}

/* Progress in percent, computed exactly like the game's own updateProgressBar():
 *   100 * (1 - timeLeft / timeNeeded), then clamped to 1..100.
 * `loadContent` does not send a percentage; it sends timers (timeLeft) and
 * marchTimes (timeNeeded), and the browser computes the bar from them. */
function computeMarchProgress(timeRemaining, marchTime) {
	var needed = parseInt(marchTime, 10);
	var left = parseInt(timeRemaining, 10);
	if (!needed || needed <= 0 || isNaN(left)) return null;
	var pct = 100 * (1 - left / needed);
	if (pct < 1) pct = 1;
	if (pct > 100) pct = 100;
	return Math.round(pct * 10) / 10;
}

/* Parse the ajax_marches.php JSON ({body, data}) into a normalized result. */
function parseMarchesResponse(result) {
	var doc = new DOMParser().parseFromString(result.body || '', 'text/html');
	var data = result.data || {};
	var timers = data.timers || {};
	var marchTimes = data.marchTimes || {};

	/* current player from the castle filter (e.g. "rambo_عالمدار..") */
	var currentPlayer = null;
	var castleSel = doc.getElementById('marchesCastleFilter');
	if (castleSel && castleSel.options) {
		for (var ci = 0; ci < castleSel.options.length; ci++) {
			var otxt = castleSel.options[ci].textContent.trim();
			if (otxt && otxt !== 'كل القلاع' && otxt !== 'all castles') { currentPlayer = otxt; break; }
		}
	}

	var marches = [];
	for (var id in timers) {
		if (!timers.hasOwnProperty(id)) continue;
		var fromEl = doc.getElementById('marchesCastleFrom_' + id);
		var toEl = doc.getElementById('marchesCastleTo_' + id);
		var from = fromEl ? fromEl.textContent.trim() : null;
		var to = toEl ? toEl.textContent.trim() : null;

		/* sender: title on the "from" castle link */
		var sender = null;
		if (fromEl) {
			var link = fromEl.querySelector('a');
			var title = link ? (link.getAttribute('title') || '') : '';
			var tm = title.match(/header=\[\s*([^\(\)\[\]]+?)\s*(?:\(|\[|\])/);
			if (tm) sender = tm[1].trim();
		}

		/* row container, to read type + raw text */
		var anchor = fromEl || toEl;
		var row = null;
		if (anchor) {
			row = anchor;
			for (var i = 0; i < 6 && row && row.parentElement; i++) {
				row = row.parentElement;
				if (row.querySelector && row.querySelector('a[name^="marchTypes_"]')) break;
			}
		}

		var typeLabel = null, type = null, rawText = null;
		/* `data.timers[id]` is the AUTHORITATIVE remaining time (the body's
		   timer span is often rendered as 00:00:00 and is not reliable). */
		var hasTimer = (timers[id] != null);
		var timeRemaining = hasTimer ? parseInt(timers[id], 10) : 0;

		if (row) {
			rawText = row.textContent.replace(/\s+/g, ' ').trim();
			var typeLink = row.querySelector('a[name^="marchTypes_"]');
			if (typeLink) {
				typeLabel = typeLink.textContent.trim();
				type = marchTypeMap()[typeLabel] || null;
			}
		}

		marches.push({
			id: id,
			type: type,
			typeLabel: typeLabel,
			from: from,
			to: to,
			timeRemaining: timeRemaining,
			timeFormatted: formatSeconds(timeRemaining),
			marchTime: (marchTimes[id] != null) ? marchTimes[id] : null,
			marchTimeFormatted: (marchTimes[id] != null && !isNaN(parseInt(marchTimes[id], 10))) ? formatSeconds(parseInt(marchTimes[id], 10)) : null,
			sender: sender || currentPlayer,
			population: null,
			cargo: null,
			cargoText: null,
			arrivalTime: null,
			returnTime: null,
			progress: computeMarchProgress(timeRemaining, marchTimes[id]),
			rawText: rawText
		});
	}

	/* pending marches */
	var pending = [];
	var ptimers = data.pendingTimers || {};
	for (var pid in ptimers) {
		if (!ptimers.hasOwnProperty(pid)) continue;
		var psec = parseInt(ptimers[pid], 10) || 0;
		pending.push({ id: pid, timeRemaining: psec, timeFormatted: formatSeconds(psec) });
	}

	result.marches = marches;
	result.pending = pending;
	result.currentPlayer = currentPlayer;
	return result;
}

/* Read marches from the LIVE DOM after a loadContent render (marches.php only). */
function readMarchesFromLiveDom(result) {
	var container = document.getElementById('marchesContentContainer');
	var text = container ? container.textContent.replace(/\s+/g, ' ').trim() : '';
	var html = container ? container.innerHTML : '';

	result.marches = [];
	result.pending = [];
	result.containerText = text;
	result.currentPlayer = null;

	var unameEl = document.querySelector('a.username, .username span, .username');
	if (unameEl) result.currentPlayer = unameEl.textContent.trim();

	var idRegex = /marchesMarchProgress_(\d+)/g;
	var match, seen = {};
	while ((match = idRegex.exec(html)) !== null) {
		var id = match[1];
		if (seen[id]) continue;
		seen[id] = true;

		var fromEl = document.getElementById('marchesCastleFrom_' + id);
		var toEl = document.getElementById('marchesCastleTo_' + id);
		var timerEl = document.getElementById('marchesMarchesTimer_' + id);
		var from = fromEl ? fromEl.textContent.trim() : null;
		var to = toEl ? toEl.textContent.trim() : null;
		var timeText = timerEl ? timerEl.textContent.trim() : null;

		var sender = null;
		if (fromEl) {
			var link = fromEl.querySelector('a');
			var title = link ? (link.getAttribute('title') || '') : '';
			var tm = title.match(/header=\[\s*([^\(\)\[\]]+?)\s*(?:\(|\[|\])/);
			if (tm) sender = tm[1].trim();
		}

		var row = fromEl;
		for (var i = 0; row && i < 8; i++) {
			if (row.querySelector && row.querySelector('a[name^="marchTypes_"]')) break;
			if (row.parentElement) row = row.parentElement;
		}
		var typeLabel = null, type = null;
		if (row) {
			var typeLink = row.querySelector('a[name^="marchTypes_"]');
			if (typeLink) {
				typeLabel = typeLink.textContent.trim();
				type = marchTypeMap()[typeLabel] || null;
			}
		}

		var timeSec = timeText ? parseTimeToSeconds(timeText) : 0;

		/* On marches.php the bar is ticked live by the game, so its width is the real progress. */
		var progress = null;
		var progEl = document.getElementById('marchesMarchProgress_' + id);
		if (progEl && progEl.style && progEl.style.width) {
			var pw = parseFloat(progEl.style.width);
			if (!isNaN(pw)) progress = pw;
		}

		result.marches.push({
			id: id,
			type: type,
			typeLabel: typeLabel,
			from: from,
			to: to,
			timeRemaining: timeSec,
			timeFormatted: timeText || formatSeconds(timeSec),
			marchTime: null,
			marchTimeFormatted: null,
			sender: sender || result.currentPlayer,
			population: null,
			cargo: null,
			cargoText: null,
			arrivalTime: null,
			returnTime: null,
			progress: progress,
			rawText: (typeLabel && from && to) ? (typeLabel + ' ' + from + ' ' + to + ' ' + (timeText || '')) : null
		});
	}
	return result;
}

/* Main entry. */
function getMarchesStatus(callback, filters) {
	/* Preferred: the page's own loadContent (renders + binds timers) when available. */
	if (typeof marches !== 'undefined' && marches && typeof marches.loadContent === 'function') {
		marches.loadContent();
		var attempts = 0;
		var timer = setInterval(function () {
			attempts++;
			var c = document.getElementById('marchesContentContainer');
			var text = c ? c.textContent.replace(/\s+/g, ' ').trim() : '';
			if (text.length > 100 || attempts > 50) {
				clearInterval(timer);
				var result = readMarchesFromLiveDom({ source: 'loadContent' });
				enrichMarchesWithPopulation(result.marches, function () {
					if (typeof callback === 'function') callback(result);
				});
			}
		}, 100);
		return;
	}
	/* Fallback: identical request, works on any authenticated page (no navigation). */
	requestMarchesLoadContent(callback, filters);
}

/* Read march info (read-only) via info.php. */
function getMarchInfo(marchId, callback) {
	if (!window.Ajax || typeof window.Ajax.Request !== 'function') {
		throw new Error('Ajax.Request is unavailable in this page.');
	}
	marchId = parseInt(marchId, 10);
	if (!Number.isInteger(marchId) || marchId < 1) {
		throw new TypeError('marchId must be a positive integer.');
	}
	new window.Ajax.Request('info.php', {
		method: 'post',
		parameters: { what: 'pohod', posted_id: marchId },
		onSuccess: function (response) {
			if (typeof callback === 'function') callback({ html: response.responseText });
		},
		onFailure: function (response) {
			if (typeof callback === 'function') callback({ httpError: response.status, raw: response.responseText });
		}
	});
}

/* Recall a march (STATE-CHANGING). Use with care. */
function recallMarch(marchId, callback) {
	if (!window.Ajax || typeof window.Ajax.Request !== 'function') {
		throw new Error('Ajax.Request is unavailable in this page.');
	}
	marchId = parseInt(marchId, 10);
	if (!Number.isInteger(marchId) || marchId < 1) {
		throw new TypeError('marchId must be a positive integer.');
	}
	new window.Ajax.Request('ajax_marches.php', {
		method: 'post',
		parameters: { type: 'recallMarch', march_id: marchId },
		onSuccess: function (response) {
			var result;
			try { result = response.responseText.evalJSON(true); }
			catch (error) { result = { raw: response.responseText, parseError: error.message }; }
			if (typeof callback === 'function') callback(result);
		},
		onFailure: function (response) {
			if (typeof callback === 'function') callback({ httpError: response.status, raw: response.responseText });
		}
	});
}
