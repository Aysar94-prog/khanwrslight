'use strict';

function Arena() {
	this.dialog = new kwModal({
		width: 1050,
		placeholder: 'arenaPopupContainer',
		borders: false,
		centerDialog: false,
		closeButton: false,
		defaultTopOffset: 20
	});
	this.initProperties();
}

Arena.prototype.sendData = function (data, callback, url) {
	url = url || 'ajax_arena.php';
	data = data || {};
	new Ajax.Request(url, {
		method: 'post',
		parameters: data,
		onSuccess: function (transport) {
			var response = transport.responseText.evalJSON(true);
			if (typeof callback === 'function') {
				callback(response);
			}
		}
	});

};

Arena.prototype.loadContent = function (handler, action, params) {
	var self = this;
	var data = {type: handler, action: action || 'loadContent'};
	params = params || {};
	data = Object.extend(data, params);
	this.dialog.show();

	this.sendData(data, function(response) {
		if (response.status === 1) {
			self.initProperties();
			if (response.data.responder) {
				if (typeof self['cleanupDOM_' + response.data.responder] === 'function') {
					self['cleanupDOM_' + response.data.responder]();
				}
			}
			if (response.data.opponentsIds) {
				self.opponentsIds = response.data.opponentsIds;
			}
			self.updateContent(response);
			self.assignEventHandlers();

			if (response.data.responder) {
				if (typeof self['eventHandler_' + response.data.responder] === 'function') {
					self['eventHandler_' + response.data.responder](response.data);
				}
				if (typeof self['dataHandler_' + response.data.responder] === 'function') {
					self['dataHandler_' + response.data.responder](response.data);
				}
			}
		} else if (response.status == 2) {
			self.showPopup('error', response.data.errorMsg);
		}
	});
};

Arena.prototype.updateContent = function(response) {
	if (response.data.responder) {
		if (response.data.responder === 'shuffleOpponents') {
			$('opponentsWrapper').update(response.body);
			return true;
		}
	}
	this.dialog.updateContent(response.body);
	return true;
};

Arena.prototype.showPopup = function (type, text) {
	if (type === 'error') {
		kwModal.error(text);
	} else {
		kwModal.info(text);
	}
	return;
};

Arena.prototype.initProperties = function() {
	this.arenaMaxPop = 0;
	this.requiredPopPerUnitType = null;
	this.bannedUnits = null;
	this.units = null;
    this.battleId = null;
    this.hasSelectedMessages = false;
};

Arena.prototype.assignEventHandlers = function () {
	var self = this;

	if ($('arenaToolBtnMain')) {
		$('arenaToolBtnMain').stopObserving().observe('click', function() {
			self.loadContent('Arena_UI_Daily');
		});
	}

	if ($('arenaToolBtnOpenRanking')) {
		$('arenaToolBtnOpenRanking').stopObserving().observe('click', function() {
			self.loadContent('Arena_UI_Daily', 'loadRanking');
		});
	}

	if ($('arenaToolBtnOpenReports')) {
		$('arenaToolBtnOpenReports').stopObserving().observe('click', function() {
			self.loadContent('Arena_UI_Daily', 'loadReports');
		});
	}

	if ($('arenaToolBtnOpenRules')) {
		$('arenaToolBtnOpenRules').stopObserving().observe('click', function() {
			self.loadContent('Arena_UI_Daily', 'loadRulez');
		});
	}

	if ($('arenaToolBtnCloseWnd')) {
		$('arenaToolBtnCloseWnd').stopObserving().observe('click', function() {
			self.dialog.hide();
		});
	}

	if ($('btnOpenKnightWnd')) {
		$('btnOpenKnightWnd').stopObserving().observe('click', function() {
			self.loadContent('Arena_UI_Daily', 'loadKnight');
		});
	}

	if ($("btnUpdateTodayFormation")) {
		$("btnUpdateTodayFormation").stopObserving().observe('click', function() {
			self.loadContent('Arena_UI_Daily', 'loadFormation', {whichArena: 0});
		});
	}

	if ($("btnUpdateTomorrowFormation")) {
		$("btnUpdateTomorrowFormation").stopObserving().observe('click', function() {
			self.loadContent('Arena_UI_Daily', 'loadFormation', {whichArena: 1});
		});
	}

	if ($("btnShuffleOpponents")) {
		$("btnShuffleOpponents").stopObserving().observe('click', function() {
			self.loadContent('Arena_UI_Daily', 'shuffleOpponents');
		});

	}

	if ($('btnSaveFormations')) {
		$('btnSaveFormations').stopObserving().observe('click', function() {
			self.saveFormations();
		});
	}

	if ($('btnCancelFormationEdit')) {
		$('btnCancelFormationEdit').stopObserving().observe('click', function() {
			self.loadContent('Arena_UI_Daily');
		});
	}

	if ($('btnCloseKnightWnd')) {
		$('btnCloseKnightWnd').stopObserving().observe('click', function() {
			self.loadContent('Arena_UI_Daily');
		});
	}

	if ($('btnChangeKnightWnd')) {
		$('btnChangeKnightWnd').stopObserving().observe('click', function() {
			self.loadContent('Arena_UI_Daily', 'loadKnightChooser');
		});
	}

    self.assignChallengeButtonHandlers();

	if ($$('.btnSelectKnight')) {
		//console.log('kur');
		$$('.btnSelectKnight').each(function(element) {
			element.stopObserving().observe('click', function() {
				self.loadContent('Arena_UI_Daily', 'setKnight', { knightId: parseInt(this.readAttribute('data-knight-id'), 10) });
			});
		});
	}

	if ($('btnCloseKnightChooserWnd')) {
		$('btnCloseKnightChooserWnd').stopObserving().observe('click', function() {
			self.loadContent('Arena_UI_Daily', 'loadKnight');
		});
	}

	if ($('js-purchaseBattles')) {
		$('js-purchaseBattles').stopObserving().observe('click', function() {
			self.loadContent('Arena_UI_Daily', 'resetBattles');
		});
	}
};

Arena.prototype.eventHandler_loadRanking = function() {
	var self = this;

	if ($$('.js-pg-link')) {
		$$('.js-pg-link').each(function(element) {
			element.writeAttribute('href', 'javascript:void(0)');
			element.stopObserving().observe('click', function() {
				var page = this.readAttribute('data-page');
				self.loadContent('Arena_UI_Daily', 'loadRanking', {page: page});
			});
		});
	}
    self.assignRankingEventHandlers();
};

Arena.prototype.dataHandler_loadReports = function(data) {
	var self = this;

	if ($$('.js-pg-link')) {
		$$('.js-pg-link').each(function(element) {
			element.writeAttribute('href', 'javascript:void(0)');
			element.stopObserving().observe('click', function() {
				var page = this.readAttribute('data-page');
				self.loadContent('Arena_UI_Daily', 'loadReports', {page: page});
			});
		});
	}

    if ($('selectToggle')) {
        $('selectToggle').stopObserving().observe('click', function () {
            $$('.selectedMessages').each(function (element) {
                $(element).checked = $('selectToggle').checked;
            });

            if ($('selectToggle').checked) {
                $('deleteSelectedMessages').removeClassName('inactive');
            } else {
                $('deleteSelectedMessages').addClassName('inactive');
            }
        });
    }

    if ($$('.selectedMessages')) {
        $$('.selectedMessages').each(function (element) {
            element.stopObserving().observe('change', function() {
                if (self.checkForSelectedReports()) {
                    $('deleteSelectedMessages').removeClassName('inactive');
                } else {
                    $('deleteSelectedMessages').addClassName('inactive');
                }
            });
        });
    }

    if ($('deleteSelectedMessages')) {
        $('deleteSelectedMessages').stopObserving().observe('click', function() {
            var checked = [];
            $$('.selectedMessages').each(function(element) {
                if ($(element).checked) {
                    checked.push($(element).name);
                }
            });
            self.deleteReports(checked);
        });
    }

    if ($$('.arena .newMsg')) {
        if (data.newReportsCnt == 0) {
            $$('.arena .newMsg')[0].hide();
        } else {
            $$('.arena .newMsg')[0].innerHTML = data.newReportsCnt;
        }
    }
};

Arena.prototype.eventHandler_loadFormation = function(data) {
	var self = this;
	if ($('btnResetFormationEdit')) {
		$('btnResetFormationEdit').stopObserving().observe('click', function() {
			self.loadContent('Arena_UI_Daily', 'loadFormation', {whichArena: data.arenaTimeOffset || 0});
		});
	}
};

Arena.prototype.dataHandler_loadContent = function(data) {
	var self = this;
	if ($("timeUntilNextArena")) {
		Timers.add(function() {}, data.timeUntilNextArena, 'timeUntilNextArena', function() {});
	}

	if (data.newBattleAfter && data.newBattleAfter > 0 && $('newBattleAfterContainer')) {
		Timers.add(function() {
						/*
						if ($('battlesInfoContainer')) {
							$('battlesInfoContainer').update(data.preparingBattleMsg);
						}*/
						//We're waiting here 2 seconds in case event scheduler is busy
						setTimeout(function() {
										self.loadContent('Arena_UI_Daily');
									}, 7200);
					},
					data.newBattleAfter, 'newBattleAfter', function() {});
		$('newBattleAfterContainer').removeClassName('hidden');
	}
};

Arena.prototype.dataHandler_loadFormation = function(data) {
	this.arenaMaxPop = data.maxPop ? +data.maxPop : 0;
	this.popLimitUnitType = data.popLimitUnitType || [];
	this.bannedUnits = data.bannedUnits || {};
	this.arenaTimeOffset = data.arenaTimeOffset || 0;

	var attConfig = {
		formationId: data.attForm.formId,
		totalPopElementId: 'totalPopAttForm',
		bannedUnits: this.bannedUnits,
		popLimitUnitType: this.popLimitUnitType,
		calcPopLimitUnitType: this.calcPopLimitUnitType
	};
	this.attArmyOrder = new ArmyOrder(attConfig);

	var attResponse = {
		status: 1,
		data: data.attForm
	};
	this.attArmyOrder.loadContentCallback(attResponse);
	var elem;
	for (var i in data.attForm.popLimitsPerType) {
		elem = $('popLimitUnit' + data.attForm.formId + '_' + i);
		if (elem) {
			elem.innerHTML = data.attForm.popLimitsPerType[i];
		}
	}

	var defConfig = {
		formationId: data.defForm.formId,
		totalPopElementId: 'totalPopDefForm',
		bannedUnits: this.bannedUnits,
		popLimitUnitType: this.popLimitUnitType,
		calcPopLimitUnitType: this.calcPopLimitUnitType
	};
	this.defArmyOrder = new ArmyOrder(defConfig);

	var defResponse = {
		status: 1,
		data: data.defForm
	};
	this.defArmyOrder.loadContentCallback(defResponse);

	for (i in data.defForm.popLimitsPerType) {
		elem = $('popLimitUnit' + data.defForm.formId + '_' + i);
		if (elem) {
			elem.innerHTML = data.defForm.popLimitsPerType[i];
		}
	}

	if ($("timeUntilNextArena")) {
		Timers.add(function() {}, data.timeUntilNextArena, 'timeUntilNextArena', function() {});
	}

};

Arena.prototype.dataHandler_loadKnight = function(data) {
	window.touchFlag = false;
    window.eventsInit = false;
	var inventory = new Inventory();
	inventory.init(data);
};

Arena.prototype.cleanupDOM_loadKnight = function() {
	if ($('itemsListContainer')) {
		//console.log('removing itemsListContainer ...');
		$('itemsListContainer').remove();
		//console.log('removed');
	}
	if ($$('.itemSlot')) {
		$$('.itemSlot').each(function(element) {
			element.remove();
		});
	}
};

Arena.prototype.calcPopLimitUnitType = function(changedUnitId, newCnt, popLimitUnitType, formationId, formation) {
	var unitCnt = 0, unitPop = 0, pop = 0;
	var elem = null;

	for (var i = 0; i < popLimitUnitType.length; i++) {
		elem = popLimitUnitType[i];

		if (inArrayOpts(changedUnitId, elem.unitIds, false)) {
			pop = 0;
			for (var j = 0; j < elem.unitIds.length; j++) {
				if (+changedUnitId === +elem.unitIds[j]) {
					unitCnt = newCnt;
				} else {
					if ($('ucount' + formationId + '_' + elem.unitIds[j])) {
						unitCnt = $('ucount' + formationId + '_' + elem.unitIds[j]).value;
					}
				}
				if (formation[elem.unitIds[j]]) {
					unitPop = formation[elem.unitIds[j]].pop;
					pop += unitCnt * unitPop;
				}
			}
			if (pop > +elem.pop) {
				return false;
			}
			$('popLimitUnit' + formationId + '_' + elem.unit_type_id).innerHTML = pop;
			return true;
		}
	}
	return true;
};

Arena.prototype.saveFormations = function() {
	var formations = {
		attack: this.attArmyOrder.buildFormationSaveData(),
		defense: this.defArmyOrder.buildFormationSaveData()
	};

	this.loadContent('Arena_UI_Daily', 'saveFormations', {
		formations: Object.toJSON(formations),
		arenaTimeOffset: this.arenaTimeOffset || 0
	});
};

Arena.prototype.chooseKnightPopup = function() {
	var knightChooser = new ArenaKnightChooser();
	knightChooser.loadContent('Arena_UI_KnightChooser');
};


/**
 *  read below on your own risk... Luci was here
 */
Arena.prototype.assignRankingEventHandlers = function () {
    var self = this;
    if ($('js-myRank')) {
        $('js-myRank').stopObserving().observe('click', function () {
            var page = this.readAttribute('data-page');
            self.loadContent('Arena_UI_Daily', 'loadRanking', {page: page});
        });
    }

    if ($$('.js-viewPlayer')) {
        $$('.js-viewPlayer').each(function (element) {
            element.stopObserving().observe('click', function () {
                var playerId = this.readAttribute('data-pid');
                var data = {
                    'id': playerId,
                    'type': 'Arena_UI_Daily',
                    'action': 'viewPlayer'
                };
                self.sendData(data, function (response) {
                    if (response.status === 1) {
                        var dialogModal = new kwModal({
                            width: 200,
                            placeholder: 'infoDialogArenaPlayer',
                            placeholderClass: 'newPopup newPopup3',
                            borders: false,
                            backgroundDim: true,
                            centerDialog: false
                        });
                        dialogModal.updateContent(response.body);
                        dialogModal.show();
                        self.assignChallengeButtonHandlers();
                    } else if (response.status === 2) {
                        self.showPopup('error', response.data.errorMsg);
                    }
                });

            });
        });
    }

};

Arena.prototype.assignChallengeButtonHandlers = function () {
    var self = this;

    if ($$('.js-challenge')) {
        $$('.js-challenge').each(function (element) {
            element.stopObserving().observe('click', function () {
                var playerId = parseInt(this.readAttribute('data-pid'));
				if (self.opponentsIds.indexOf(playerId) < 0){
					self.showPopup('error', 'Invalid opponent')
					return;
				}
                var data = {
                    'id': playerId,
                    'type': 'Arena_UI_Daily',
                    'action': 'challenge'
                };
                self.sendData(data, function (response) {
                    if (response.status === 1) {
                        if (response.data.responder) {
                            self.battleId = response.data.bid;
                            if (typeof self['eventHandler_' + response.data.responder] === 'function') {
                                self['eventHandler_' + response.data.responder]();
                            }
                            if (typeof self['dataHandler_' + response.data.responder] === 'function') {
                                self['dataHandler_' + response.data.responder](response.data);
                            }
                        }
                    } else if (response.status === 2) {
                        self.showPopup('error', response.data.errorMsg);
                    }
                });
            });
        });
    }
};

Arena.prototype.dataHandler_battleInProgress = function (data) {
    //var self = this;

    if ($('js-oponentsOverlay')) {
        $('js-oponentsOverlay').innerHTML = data.templateBody;

        var count = parseInt($('js-battleTimer').innerHTML, 10);
        var interval = setInterval(function(){
            if (!count || !$('js-battleTimer') || count === 1) {
                clearInterval(interval);
            }

            if ($('js-battleTimer')) {
                $('js-battleTimer').innerHTML = --count;
            }
        }, 1000);

        $('js-oponentsOverlay').show();
    }

    $$('.js-challenge').each(function (element) {
        element.stopObserving();
    });

    this.eventHandler_runTimer();
};

Arena.prototype.eventHandler_runTimer = function () {
    var self = this;

    setTimeout(function () {
        self.eventHandler_checkBattleStatus();
    }, 3000);
};

Arena.prototype.eventHandler_checkBattleStatus = function () {
    var self = this;
    var data = {
        'type': 'Arena_UI_Daily',
        'action': 'checkBattle',
        'bid': self.battleId
    };

    this.sendData(data, function (response) {
        if (response.status === 1) {
            if (response.data.responder) {
                if (typeof self['eventHandler_' + response.data.responder] === 'function') {
                    self['eventHandler_' + response.data.responder]();
                }
                if (typeof self['dataHandler_' + response.data.responder] === 'function') {
                    self['dataHandler_' + response.data.responder](response.data);
                }
            }
        } else {
            self.showPopup('error', response.data.errorMsg);
        }
    });
};

Arena.prototype.dataHandler_notifyUser = function (data) {
    //this.loadContent('Arena_UI_Daily', 'shuffleOpponents');
    this.loadContent('Arena_UI_Daily', 'loadContent'); // this saves me a lot of.. changing around the ui...


    var modal = new kwModal({
        width: 624,
        placeholder: 'arenaBattleResult',
        borders: false,
        centerDialog: false,
        closeButton: true,
        defaultTopOffset: 20
    });
    modal.updateContent(data.html);
    modal.show();

    if ($('js-oponentsOverlay')) {
        $('js-oponentsOverlay').hide();
        $('js-oponentsOverlay').innerHTML = '';
    }

    if ($$('.arena .newMsg')) {
        if (data.newReportsCnt == 0) {
            $$('.arena .newMsg')[0].hide();
        } else {
            $$('.arena .newMsg')[0].innerHTML = data.newReportsCnt;
        }
    }
};

Arena.prototype.deleteReports = function(reportsIds) {
    if (reportsIds.length === 0) {
        return false;
    }

    var self = this;
    var data = {
        'ids' : JSON.stringify(reportsIds),
        'type': 'Arena_UI_Daily',
        'action': 'deleteReports'
    };
    this.sendData(data, function (response) {
        if (response.status === 1) {
            self.loadContent('Arena_UI_Daily', 'loadReports');
        }
    });
};

Arena.prototype.dataHandler_reloadContent = function (data) {
    this.loadContent('Arena_UI_Daily', 'loadContent'); // this saves me a lot of.. changing around the ui...
    if (typeof data.successMessage !== 'undefined') {
        this.showPopup('info', data.successMessage);
    }
};

Arena.prototype.checkForSelectedReports = function() {
    var checked = false;
    $$('.selectedMessages').each(function(element) {
        if ($(element).checked) {
            checked = true;
            return false;
        }
    });
    return checked;
};
/**
 * I'm sorry :-(
 */
