// ==UserScript==
// @name         KhanWars: Sync Smithy Levels Without Navigation
// @namespace    khanwrslight
// @version      1.1
// @description  Fetches every smithy unit category in the background and merges attack/defense levels into localStorage.
// @match        https://71.game.khanwars.ae/*
// @match        https://71.game.khanwars.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    var LEVELS_KEY = 'unitLevelsById';
    var TYPES = [1, 5, 2, 4, 3]; // infantry, archers, cavalry, siege, special
    var CACHE_KEY = 'kwSmithyLevelsSyncAt';
    var MIN_SYNC_GAP_MS = 60 * 1000;

    function readStoredLevels() {
        try {
            var value = JSON.parse(localStorage.getItem(LEVELS_KEY) || '{}');
            return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        } catch (_) {
            return {};
        }
    }

    function readCategory(type) {
        var url = '/upgrades.php?u_type=' + encodeURIComponent(type);
        return fetch(url, {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store'
        }).then(function (response) {
            if (!response.ok) throw new Error('u_type=' + type + ' HTTP ' + response.status);
            return response.text();
        }).then(function (html) {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var container = doc.getElementById('upgradesList');
            if (!container) throw new Error('u_type=' + type + ': #upgradesList missing');

            var result = {};
            container.querySelectorAll('.upgradeItem').forEach(function (item, index) {
                var titleLink = item.querySelector('.title a');
                if (!titleLink) return;

                var url;
                try { url = new URL(titleLink.getAttribute('href') || '', location.origin); }
                catch (_) { return; }
                var id = url.searchParams.get('posted_id');
                if (!id || !/^\d+$/.test(id)) return;

                var levels = item.querySelectorAll('.typeLevel');
                if (levels.length < 2) return;

                var attack = parseInt((levels[0].textContent || '').replace(/[^\d-]/g, ''), 10);
                var defense = parseInt((levels[1].textContent || '').replace(/[^\d-]/g, ''), 10);
                if (!Number.isFinite(attack) || !Number.isFinite(defense)) return;

                result[id] = { attack: attack, defense: defense };
            });
            return { type: type, units: result };
        });
    }

    function syncAll() {
        return Promise.allSettled(TYPES.map(readCategory)).then(function (results) {
            var merged = readStoredLevels();
            var successful = 0;
            var count = 0;

            results.forEach(function (entry) {
                if (entry.status !== 'fulfilled') {
                    console.warn('[KhanWars] Smithy sync failed:', entry.reason);
                    return;
                }
                successful++;
                var units = entry.value.units;
                Object.keys(units).forEach(function (id) {
                    merged[id] = units[id];
                    count++;
                });
            });

            if (!successful) throw new Error('Could not read any smithy category.');
            localStorage.setItem(LEVELS_KEY, JSON.stringify(merged));
            localStorage.setItem(CACHE_KEY, String(Date.now()));
            console.info('[KhanWars] Smithy levels synced in background:', {
                categories: successful,
                units: count,
                levels: merged
            });
            return merged;
        });
    }

    var lastSync = parseInt(localStorage.getItem(CACHE_KEY) || '0', 10) || 0;
    if (Date.now() - lastSync < MIN_SYNC_GAP_MS) return;

    syncAll().catch(function (error) {
        console.error('[KhanWars] Smithy level sync failed:', error);
    });
})();
