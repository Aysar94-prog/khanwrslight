// ==UserScript==
// @name         KhanWars Smithy Automation
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Automates building upgrades specifically for castle smithy
// @author       YourName
// @match       https://71.game.khanwars.ae/upgrades.php?u_type=3
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const QUEUE_KEY = 'smithUpgradeQueue';
    const MAX_LEVEL = 10;
    const DEVELOPMENT_CASTLE_NAME = "ي-8-"; // اسم قلعة التطوير عند وجود أكثر من قلعة

    // Initialize queue if not exists
    if (!localStorage.getItem(QUEUE_KEY)) {
        localStorage.setItem(QUEUE_KEY, JSON.stringify([]));
    }

    // احسب القلاع من قائمة اللعبة المخزنة محلياً.
    // عند غياب القائمة لا نفترض أن الحساب يملك قلعة واحدة.
    function getKnownCastleCount() {
        let count = null;
        for (const key of ['castle_name', 'castle_id']) {
            try {
                const value = JSON.parse(localStorage.getItem(key) || 'null');
                if (Array.isArray(value) && value.length > 0) {
                    count = Math.max(count || 0, value.length);
                }
            } catch (error) {
                console.warn(`[KhanWars] Could not read ${key}.`, error);
            }
        }
        return count;
    }

    // قلعة واحدة: لا حاجة لمقارنة الاسم. عدة قلاع: اسم ي-8- مطلوب.
    function isDevelopmentCastle() {
        const castleCount = getKnownCastleCount();
        if (castleCount === 1) return true;

        const titleElement = document.getElementById("title");
        if (!titleElement) return false;

        // Get all child elements of the title
        const children = titleElement.children;
        if (!children || children.length === 0) return false;

        // Get text content of first child
        const titleText = children[0].textContent.trim();
        return titleText.includes(DEVELOPMENT_CASTLE_NAME);
    }

    function readJson(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key));
            return value == null ? fallback : value;
        } catch (error) {
            return fallback;
        }
    }

    // فئة الوحدة (u_type) كما يحفظها KhanWars Toolkit؛ 4 هو السلوك القديم عند غيابها.
    function unitCategory(unitId) {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || key.indexOf('kw.smithy.data.') !== 0) continue;
            const types = (readJson(key, {}) || {}).types || {};
            if (types[unitId] != null) return types[unitId];
        }
        return 4;
    }

    // Main function to process the queue
    function processQueue() {
        // كلا السكربتين يستهلكان smithUpgradeQueue؛ تشغيلهما معاً يكرر الأوامر.
        if (localStorage.getItem('kw.smithy.auto') === '1') {
            console.log('KhanWars Toolkit smithy automation is on - legacy script stays idle');
            return;
        }
        if (!isDevelopmentCastle()) {
            console.log(`Not in development castle (${DEVELOPMENT_CASTLE_NAME}) - skipping automation`);
            return;
        }

        console.log("Smithy Automation: Starting processing in castle smithy");

        // Get the queue from localStorage
        const stored = readJson(QUEUE_KEY, []);
        const queue = Array.isArray(stored) ? stored : [];
        const queueElement = document.getElementById("upgradesQueue");

        // Get building levels (assuming game data is available)
        const levelsById = readJson('unitLevelsById', {});

        // Calculate available queue spaces
        let availableSpaces = 2;
        if (queueElement) {
            availableSpaces = 2 - queueElement.childElementCount;
        }
        console.log(`Available upgrade slots: ${availableSpaces}`);

        // Process queue if space is available
        if (availableSpaces > 0) {
            const newQueue = [];
            let picked = null;

            for (const item of queue) {
                const [buildingId, upgradeType] = item;
                const statType = upgradeType === 1 ? 'attack' : 'defense';

                // Levels not synced yet is not proof the command is invalid: keep it.
                if (!levelsById[buildingId]) {
                    console.log(`Building ${buildingId} not found in synced levels. Keeping it queued.`);
                    newQueue.push(item);
                    continue;
                }

                // Drop only commands that can never run (already at max level)
                if (levelsById[buildingId][statType] >= MAX_LEVEL) {
                    console.log(`Building ${buildingId} ${statType} already maxed. Removing.`);
                    continue;
                }

                // Send the first runnable command; it leaves the queue only after the request succeeds
                if (!picked) picked = item;
                newQueue.push(item);
            }

            // Save the queue without maxed commands; the picked one is still in it
            localStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));

            if (picked) {
                const [buildingId, upgradeType] = picked;
                startUpgrade(buildingId, upgradeType).then(ok => {
                    if (!ok) {
                        console.warn('Upgrade request failed - command kept in queue');
                        return;
                    }
                    // Re-read: the dashboard may have edited the queue meanwhile
                    const current = readJson(QUEUE_KEY, []);
                    const index = Array.isArray(current)
                        ? current.findIndex(x => Array.isArray(x) && String(x[0]) === String(buildingId) && Number(x[1]) === Number(upgradeType))
                        : -1;
                    if (index >= 0) {
                        current.splice(index, 1);
                        localStorage.setItem(QUEUE_KEY, JSON.stringify(current));
                    }
                    console.log(`Started upgrade: Building ${buildingId}. Page will refresh in 3 seconds`);
                    setTimeout(() => location.reload(), 3000);
                });
            }
        } else {
            console.log("No available slots - skipping queue processing");
        }
    }

    // Function to send upgrade request
    function startUpgrade(buildingId, upgradeType) {
        const url = `https://${location.host}/upgrades.php?up_id=${encodeURIComponent(buildingId)}` +
            `&type=${encodeURIComponent(upgradeType)}&u_type=${encodeURIComponent(unitCategory(buildingId))}`;
        console.log(`Sending upgrade request to ${url}`);

        // Send upgrade request; resolves true only when the server answered OK
        return fetch(url, {
            method: 'GET',
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Upgrade request failed');
            }
            return response.text();
        })
        .then(() => {
            console.log("Upgrade request successful");
            return true;
        })
        .catch(error => {
            console.error('Upgrade error:', error);
            return false;
        });
    }

    // Enhanced queue management functions
    window.smithyQueue = {
        // Add a new upgrade to the queue
        add: function(buildingId, upgradeType) {
            const queue = JSON.parse(localStorage.getItem(QUEUE_KEY));
            queue.push([buildingId, upgradeType]);
            localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
            console.log(`Added to queue: Building ${buildingId} ${upgradeType === 1 ? 'Attack' : 'Defense'}`);
            return queue.length;
        },

        // View current queue
        view: function() {
            const queue = JSON.parse(localStorage.getItem(QUEUE_KEY));
            console.log('Current Smithy Queue:');
            if (queue.length === 0) {
                console.log('  Queue is empty');
            } else {
                queue.forEach((item, index) => {
                    const [buildingId, upgradeType] = item;
                    console.log(`${index + 1}. Building ${buildingId} - ${upgradeType === 1 ? 'Attack' : 'Defense'}`);
                });
            }
            return queue;
        },

        // Clear the queue
        clear: function() {
            localStorage.setItem(QUEUE_KEY, JSON.stringify([]));
            console.log('Queue cleared');
            return [];
        },

        // Remove specific item from queue
        remove: function(index) {
            const queue = JSON.parse(localStorage.getItem(QUEUE_KEY));
            if (index >= 0 && index < queue.length) {
                const removed = queue.splice(index, 1);
                localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
                console.log(`Removed: Building ${removed[0][0]} ${removed[0][1] === 1 ? 'Attack' : 'Defense'}`);
                return removed[0];
            }
            console.error('Invalid index for removal');
            return null;
        }
    };

    // Run the queue processor after a short delay to allow page to load
    setTimeout(processQueue, 2500);

    // Initialization message
    console.log('KhanWars Smithy Automation loaded!');
    console.log('With one castle, name matching is skipped; with multiple castles, automation runs only in ي-8-.');
    console.log('Available commands:');
    console.log('  smithyQueue.add(buildingId, type) - Add upgrade to queue');
    console.log('  smithyQueue.view() - View current queue');
    console.log('  smithyQueue.remove(index) - Remove item from queue');
    console.log('  smithyQueue.clear() - Clear entire queue');
})();
