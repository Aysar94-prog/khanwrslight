'use strict';

function Province(){
	var self = this;
	//this.dialog = new kwModal({'placeholder': 'cityEventsContainer', placeholderClass: 'buildingDialog newPopup3', 'width': 640});
	this.radialMenu = new mapMenu();
	this.radialMenu.registerCallback('onContent', function(){
		self.radialMenu.disableElementOnPosition(1);
		self.radialMenu.disableElementOnPosition(4);
		self.radialMenu.disableElementOnPosition(5);
		self.radialMenu.disableElementOnPosition(6);
	});
}



Province.prototype.slotAction = function(actionId, id){
	var self = this;
	new Ajax.Request('province.php', {
		method: 'post',
		parameters: 'action=' + actionId + '&id=' + id,
		onSuccess: function(res) {
			//console.log(res);
			res = res.responseJSON;
			if (res.data.error) {
				kwModal.error(res.html);
				return;
			}
			if (actionId == 2) {
				self.slotEventOpen(res.html);
				//console.log(res);
				//if ($('cityEventsTimerContainer') && res.data.timeLeft) {
				//	Timers.add('province.php', res.data.timeLeft, 'cityEventsTimerContainer');
				//}
			} else if (actionId == 3) {
				self.slotEventClose();
				window.location.reload();
			} else if (actionId == 4) {
				window.location.reload();
			}
		}
	});
};


Province.prototype.slotEventOpen = function(content){
	this.dialog = new kwModal({'placeholder': 'cityEventsContainer', placeholderClass: 'buildingDialog newPopup3', 'width': 640});
	this.dialog.updateContent(content);
	this.dialog.show();
	
	//To be sure that the tooltip is hidden
	$$('.tooltipHeader')[0].up().setStyle({visibility: 'hidden'});
};

Province.prototype.slotEventClose = function(){
	this.dialog.hide();
};


Province.prototype.openRadialMenu = function(element, mapX, mapY){
	this.radialMenu.positionOverElement(element);
	this.radialMenu.setMarchesPopupModifier(function(marchesPopup){
		marchesPopup.getCurrentMarch().setAttackerObjectType(false);
		marchesPopup.getCurrentMarch().setDefenderObjectType('province_object');
		marchesPopup.registerCallback('onMarchSent', function(data){
			bottomBar.load(2);
		});
	});
	this.radialMenu.loadContent(mapX, mapY, true);
	
	var self = this;
	$('mainWrapper').observe('mousedown', function() {
		self.radialMenu.hide();
	});
	
};

Province.prototype.loadCastleMineData = function(mineId) {
	this.dialog = new kwModal({'placeholder': 'cityEventsContainer', placeholderClass: 'buildingDialog newPopup3', 'width': 640});
    var self = this,
        data = {
            type: 'loadMineData',
            id: mineId
        };

    this.sendData('ajax_castleMines.php', data, function(response){
        if (!response.status) {
            kwModal.info(response.body);
            return;
        }
        self.dialog.updateContent(response.body);
        self.dialog.show();
        self.initCastleMinesDialogObservers(mineId);
    });
};

Province.prototype.sendData = function(url, data, callback) {
    new Ajax.Request(url, {
        method: 'post',
        parameters: data,
        onSuccess: function(transport) {
            var response = transport.responseText.evalJSON(true);
            if (typeof callback === 'function') {
                callback(response);
            }
        }
    });
};

Province.prototype.initCastleMinesDialogObservers = function(mineId) {
    var self = this;

    if ($('btnInitDiscover') && !$('btnInitDiscover').hasClassName('inactive')) {
        $('btnInitDiscover').observe('click', function(){
            var data = {
                type: 'discoverCastleMine',
                id: mineId
            };
            self.sendData('ajax_castleMines.php', data, function(response){
                if (!response.status) {
                    kwModal.error(response.body);
                    return;
                }

                window.location.reload();
            });
        });
    }

    if ($('btnInitUpgrade') && !$('btnInitUpgrade').hasClassName('inactive')) {
        $('btnInitUpgrade').observe('click', function(){
            var data = {
                type: 'upgrade',
                mine_id: mineId
            };
            self.sendData('ajax_castleMines.php', data, function(response){
                if (!response.status) {
                    kwModal.error(response.body);
                    return;
                }

                window.location.reload();
            });
        });
    }

    if ($('btnInitRepair') && !$('btnInitRepair').hasClassName('inactive')) {
        $('btnInitRepair').observe('click', function(){
            var data = {
                type: 'repairCastleMine',
                mine_id: mineId
            };
            self.sendData('ajax_castleMines.php', data, function(response){
                if (!response.status) {
                    kwModal.error(response.body);
                    return;
                }

                window.location.reload();
            });
        });
    }

    if ($('speedUpCastleMineProcess')) {
        $('speedUpCastleMineProcess').observe('click', function(){
            var data = {
                type: 'speedUpCastleMineProcess',
                mine_id: mineId
            };
            self.sendData('ajax_castleMines.php', data, function(response){
                if (!response.status) {
                    kwModal.error(response.body);
                    return;
                }
            });
        });
    }

    if ($('btnInstantFinishUpgrade')) {
        $('btnInstantFinishUpgrade').observe('click', function(){
            self.loadCastleMineInstantFinishData(mineId);
        });
    }
    if ($('btnInstantFinishRepair')) {
        $('btnInstantFinishRepair').observe('click', function(){
            self.loadCastleMineInstantFinishData(mineId);
        });
    }

    // Init timers
    if ($('protectionTimeLeft')) {
        Timers.add(function(){
            $('protectionTimeLeft').remove();
        }, +$('protectionTimeLeft').innerHTML, 'protectionTimeLeft');
    }
    if ($('repairTimeLeft')) {
        Timers.add(function(){
            $('repairTimeLeft').remove();
        }, +$('repairTimeLeft').innerHTML, 'repairTimeLeft');
    }
    if ($('upgradeTimeLeft')) {
        Timers.add(function(){
            $('upgradeTimeLeft').remove();
        }, +$('upgradeTimeLeft').innerHTML, 'upgradeTimeLeft');
    }

    handleSitting();
};

Province.prototype.loadCastleMineInstantFinishData = function(mineId) {
    var self = this,
        data = {
            type: 'instantFinish',
            execute: 0,
            id: mineId
        };

    this.sendData('ajax_castleMines.php', data, function(response){
        if (!response.status) {
            kwModal.error(response.body);
            return;
        }
        kwModal.confirm(response.body, function(){
            self.instantFinishCastleMineProcess(mineId);
        });
    });
};

Province.prototype.instantFinishCastleMineProcess = function(mineId) {
    var self = this,
        data = {
            type: 'instantFinish',
            execute: 1,
            id: mineId
        };

    this.sendData('ajax_castleMines.php', data, function(response){
        if (!response.status) {
            kwModal.error(response.body);
            return;
        }
        window.location.reload();
    });
};