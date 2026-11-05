/* Helper: building upgrade requirements + resource wait time.
 * Works from any authenticated game page (e.g. marches.php) without navigation.
 * Read-only: does not change game state.
 */

/* Parse a "HH:MM:SS" or "MM:SS" string into seconds. */
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

/* Fetch upgrade requirements for a building without navigating.
 * callback receives:
 * {
 *   buildingId, currentLevel, nextLevel, buildTime (seconds),
 *   resources: { gold: {required, available, lacking, waitSeconds, waitText}, iron: {...}, wood: {...}, food: {...} },
 *   maxWaitSeconds, maxWaitResource, maxWaitText
 * }
 */
function getBuildingRequirements(buildingId, callback) {
	if (!window.Ajax || typeof Ajax.Request !== 'function') {
		throw new Error('Ajax.Request is unavailable in this page.');
	}
	buildingId = parseInt(buildingId, 10);
	if (!Number.isInteger(buildingId) || buildingId < 1) {
		throw new TypeError('buildingId must be a positive integer.');
	}

	new Ajax.Request('ajax_buildings.php', {
		method: 'post',
		parameters: { b_id: buildingId, backto: 'overview.php' },
		onSuccess: function (response) {
			var result = { buildingId: buildingId, parseError: null };
			try {
				var doc = new DOMParser().parseFromString(response.responseText, 'text/html');

				// current level
				var levelEl = doc.querySelector('.buildingLevel');
				result.currentLevel = levelEl ? parseInt(levelEl.textContent, 10) : null;

				// next level from button value "طور الى المستوى N" or header "المستوى التالي: N"
				var btn = doc.querySelector('input[name="buy"], #attendBtn, input[value*="المستوى"]');
				var nextLevel = null;
				if (btn && btn.value) {
					var m = btn.value.match(/(\d+)\s*$/);
					if (m) nextLevel = parseInt(m[1], 10);
				}
				if (!nextLevel) {
					var headers = doc.querySelectorAll('th');
					for (var i = 0; i < headers.length; i++) {
						var mm = headers[i].textContent.match(/المستوى التالي:\s*(\d+)/);
						if (mm) { nextLevel = parseInt(mm[1], 10); break; }
					}
				}
				result.nextLevel = nextLevel;

				// build time from .time element
				var timeEl = doc.querySelector('.time');
				var timeText = timeEl ? timeEl.textContent.replace(/[^0-9:]/g, '') : '';
				var tm = timeText.match(/(\d{1,2}):(\d{2}):(\d{2})/);
				result.buildTime = tm ? parseTimeToSeconds(tm[0]) : 0;
				result.buildTimeText = tm ? tm[0] : timeText;

				// resources
				var resNames = ['gold', 'iron', 'wood', 'food'];
				var resLabels = { gold: 'الذهب', iron: 'الحديد', wood: 'الخشب', food: 'الطعام' };
				result.resources = {};
				var maxWait = 0, maxRes = null, maxWaitText = '';
				resNames.forEach(function (res) {
					var el = doc.querySelector('.requirements .' + res) || doc.querySelector('.' + res);
					var required = null, available = null, waitText = '', waitSec = 0, lacking = false;
					if (el) {
						var txt = el.textContent;
						var mm2 = txt.match(/(\d+)\s*\/\s*(\d+)/);
						if (mm2) { required = parseInt(mm2[1], 10); available = parseInt(mm2[2], 10); }
						lacking = el.classList.contains('lack');
						var title = el.getAttribute('title') || '';
						var wm = title.match(/متاح بعد حوالي\s*(\d{1,2}:\d{2}:\d{2})/);
						if (wm) { waitText = wm[1]; waitSec = parseTimeToSeconds(wm[1]); }
					}
					result.resources[res] = {
						label: resLabels[res],
						required: required,
						available: available,
						lacking: lacking,
						shortfall: (required != null && available != null) ? Math.max(0, required - available) : null,
						waitSeconds: waitSec,
						waitText: waitText
					};
					if (lacking && waitSec > maxWait) {
						maxWait = waitSec;
						maxRes = res;
						maxWaitText = waitText;
					}
				});
				result.maxWaitSeconds = maxWait;
				result.maxWaitResource = maxRes;
				result.maxWaitText = maxWaitText;
				result.maxWaitFormatted = formatSeconds(maxWait);
			} catch (error) {
				result.parseError = error.message;
			}
			if (typeof callback === 'function') callback(result);
		},
		onFailure: function (response) {
			if (typeof callback === 'function') callback({ httpError: response.status, raw: response.responseText });
		}
	});
}

/* Convenience: only the wait time needed (max among lacking resources). */
function getResourceWaitTime(buildingId, callback) {
	getBuildingRequirements(buildingId, function (req) {
		if (typeof callback === 'function') {
			callback({
				buildingId: req.buildingId,
				maxWaitSeconds: req.maxWaitSeconds,
				maxWaitFormatted: req.maxWaitFormatted,
				maxWaitResource: req.maxWaitResource,
				maxWaitText: req.maxWaitText,
				resources: req.resources
			});
		}
	});
}