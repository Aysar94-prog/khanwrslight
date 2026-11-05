/* Helpers based on the game's observed frontend requests.
 * Run only in the authenticated game page context.
 */
function build(buildingId, callback) {
	if (!window.Ajax || typeof Ajax.Request !== 'function') {
		throw new Error('Ajax.Request is unavailable in this page.');
	}
	buildingId = parseInt(buildingId, 10);
	if (!Number.isInteger(buildingId) || buildingId < 1) {
		throw new TypeError('buildingId must be a positive integer.');
	}
	new Ajax.Request('buildings.php?tb_id=' + buildingId + '&method=ajax', {
		method: 'get',
		onSuccess: function (response) {
			var result;
			try { result = response.responseText.evalJSON(); }
			catch (error) { result = { raw: response.responseText, parseError: error.message }; }
			if (typeof callback === 'function') callback(result);
		},
		onFailure: function (response) {
			if (typeof callback === 'function') callback({ httpError: response.status, raw: response.responseText });
		}
	});
}

function getBuildingLevel(buildingId) {
	if (!window.Ajax || typeof Ajax.Request !== 'function') {
		throw new Error('Ajax.Request is unavailable in this page.');
	}
	buildingId = parseInt(buildingId, 10);
	if (!Number.isInteger(buildingId) || buildingId < 1) {
		throw new TypeError('buildingId must be a positive integer.');
	}
	return new Promise(function (resolve, reject) {
		new Ajax.Request('buildings.php', {
			method: 'get',
			onSuccess: function (response) {
				var doc = new DOMParser().parseFromString(response.responseText, 'text/html');
				var link = doc.querySelector('a[href*="posted_id=' + buildingId + '"][href*="what=building"]');
				var item = link && link.closest('.buildingItem');
				var level = item && item.querySelector('.buildingLevel');
				resolve(level ? parseInt(level.textContent, 10) : null);
			},
			onFailure: function (response) {
				reject(new Error('HTTP ' + response.status));
			}
		});
	});
}
