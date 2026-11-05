/* Helper: population (سعة سكانية) from overview.php.
 * Read-only, no navigation (single GET request to overview.php).
 * Run only in an authenticated game page context (window.Ajax must exist).
 */

/* Parse population from overview.php HTML.
 * callback receives: { popUsed, popCapacity, popFree, raw }
 */
function getPopulation(callback) {
	if (!window.Ajax || typeof window.Ajax.Request !== 'function') {
		throw new Error('Ajax.Request is unavailable in this page.');
	}
	new window.Ajax.Request('overview.php', {
		method: 'get',
		onSuccess: function (response) {
			var result = { parseError: null };
			try {
				var doc = new DOMParser().parseFromString(response.responseText, 'text/html');
				/* find the population listitem (title contains "السكان") */
				var popItem = null;
				var items = doc.querySelectorAll('li, [title]');
				for (var i = 0; i < items.length; i++) {
					var t = items[i].getAttribute('title') || '';
					if (t.indexOf('السكان') !== -1) { popItem = items[i]; break; }
				}
				if (popItem) {
					/* two numbers: used / capacity */
					var nums = (popItem.textContent || '').match(/\d+/g);
					if (nums && nums.length >= 2) {
						result.popUsed = parseInt(nums[0], 10);
						result.popCapacity = parseInt(nums[1], 10);
					}
					var title = popItem.getAttribute('title') || '';
					var fm = title.match(/سعة سكانية فارغة:\s*(\d+)/);
					if (fm) result.popFree = parseInt(fm[1], 10);
					if (result.popUsed != null && result.popCapacity != null && result.popFree == null) {
						result.popFree = Math.max(0, result.popCapacity - result.popUsed);
					}
				} else {
					result.parseError = 'population listitem not found';
				}
				result.raw = popItem ? popItem.textContent.replace(/\s+/g, ' ').trim() : null;
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
"