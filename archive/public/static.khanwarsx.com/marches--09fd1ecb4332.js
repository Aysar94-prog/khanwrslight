'use strict';

function Marches(){
	
	this.castleId = 0;
	this.minPopulation = 0;
	this.direction = 0;
	this.marchType = 0;
	this.useTimeLeftFilter = 0
	this.timeLeftDirection = 'up';
	
	//this is used to compensate for delays in the cron
	this.zeroTimerReloads = 0;
	
	this.langStrings = {};
	
	this.callbacks = {
		onDataLoad : [],
		onMarchFinish : []
	};
}


Marches.prototype.loadContent = function(){
	var self = this;
	var data = {
		type : 'loadContent', 
		castle_id : this.castleId,
		min_pop : this.minPopulation,
		direction : this.direction,
		march_type : this.marchType,
		use_time_filter : this.useTimeLeftFilter,
		time_left_direction : this.timeLeftDirection
	};
	new Ajax.Request('ajax_marches.php', {
		method: 'post',
		parameters: data,
		onSuccess: function(transport) {
			var response = transport.responseText.evalJSON(true);
			$('marchesContentContainer').innerHTML = response.body;
			self.assignHandlers(response.data);
            if (response.data.inSitting) {
                handleSitting();
            }
		}});
};


Marches.prototype.assignHandlers = function(data){
	var self = this, i, tickFunc, actionFunc, reload = false;

	
	$('marchesTypeFilter').stopObserving().observe('change', function(){
		self.marchType = $('marchesTypeFilter').getValue();
		self.castleId = $('marchesCastleFilter').getValue();
		self.minPopulation = $('marchesPopFilter').getValue();
		self.loadContent();
	});
	
	$('marchesIncomingMarchesBtn').stopObserving().observe('click', function(){		
		self.direction = self.direction === 'incoming' ? 0 : 'incoming';
		self.castleId = $('marchesCastleFilter').getValue();
		self.minPopulation = $('marchesPopFilter').getValue();
		self.loadContent();
	});
	$('marchesOutgoingMarchesBtn').stopObserving().observe('click', function(){
		self.direction = self.direction === 'outgoing' ? 0 : 'outgoing';
		self.castleId = $('marchesCastleFilter').getValue();
		self.minPopulation = $('marchesPopFilter').getValue();
		self.loadContent();
	});

    $('marchesAllMarchesBtn').stopObserving().observe('click', function(){
        self.direction = 'all';
        self.castleId = $('marchesCastleFilter').getValue();
        self.minPopulation = $('marchesPopFilter').getValue();
        self.loadContent();
    });

	$('marchesCastleFilter').stopObserving().observe('change', function(){
		self.castleId = $('marchesCastleFilter').getValue();
		self.marchType = $('marchesTypeFilter').getValue();
		self.minPopulation = $('marchesPopFilter').getValue();
		self.loadContent();
	});
	
	$('marchesPopFilter').stopObserving().observe('change', function(){
		self.castleId = $('marchesCastleFilter').getValue();
		self.marchType = $('marchesTypeFilter').getValue();
		self.minPopulation = $('marchesPopFilter').getValue();
		self.loadContent();
	});

	(data.units).each(function (unit) {
		if($('addToTower_' + unit.unit_id)){
			$('addToTower_' + unit.unit_id).stopObserving().observe('click', function () {
				self.addToTower(unit, data.towerFreePop);

			});
		}
		
	});

	if($('emptyTower')){
		$('emptyTower').stopObserving().observe('click', function () {
			self.emptyTower();
		});
	}
	

	(data.unitsInTower).each(function (unit) {

		if ($('emptyTower_' + unit.unit_id)) {
			$('emptyTower_' + unit.unit_id).stopObserving().observe('click', function () {
				self.emptyTowerByUnit(unit.unit_id, unit.in_tower_count);

			});
		}
	});




	for(i in data.timers){

		if(!data.timers.hasOwnProperty(i)){
			continue;
		}
		
		if(parseInt(data.timers[i], 10) <= 0){
			reload = true;
		}

		actionFunc = function(){
			self.loadContent();
			self.executeCallbacks('onMarchFinish',{});
		};

		tickFunc = function(elementId, timeNeeded){
			return function(timeLeft){
				updateProgressBar(elementId, timeNeeded, timeLeft);
			};
		}('marchesMarchProgress_' + i, data.marchTimes[i]);

		Timers.add(actionFunc, data.timers[i], 'marchesMarchesTimer_' + i, tickFunc);

		$('marchesMarchesInfoBtn_' + i).observe('click', function(marchId){
			return function(){
				self.marchInfo(marchId);
			};
		}(i));
	
		if($('marchesMarchesRecallBtn_' + i)){
			$('marchesMarchesRecallBtn_' + i).observe('click', function(marchId){
				return function(){
					var from = $('marchesCastleFrom_' + marchId).innerHTML;
					var to = $('marchesCastleTo_' + marchId).innerHTML;
					var text = self.langStrings.recallMarch;
					text = text.replace('%1',from);
					text =  text.replace('%2',to);
//					kwModal Replaced
//					kwDialog('info',
//						text, true, true, function(){self.recallMarch(marchId);}
//					);
					kwModal.confirm(text, function(){self.recallMarch(marchId);});
				};
			}(i));
		}
	}
	

	if(reload && self.zeroTimerReloads < 3){
		self.zeroTimerReloads++;
		setTimeout(function(){self.loadContent();}, 1500);		
	}
	
	for(i in data.targetTimers){
		if(!data.targetTimers.hasOwnProperty(i)){
			continue;
		}
		Timers.add(function(){}, data.targetTimers[i], 'marchesMarchesTargetTimer_' + i);
	}
	
	for(i in data.pendingTimers){
		if(!data.pendingTimers.hasOwnProperty(i)){
			continue;
		}
		
		tickFunc = function(elementId, timeNeeded){
			return function(timeLeft){
				updateProgressBar(elementId, timeNeeded, timeLeft);
			};
		}('marchesMarchPendingProgress_' + i, data.pendingTimes[i]);
		
		actionFunc = function(){
			setTimeout(function(){
				self.loadContent();
			}, 1000);
		};
		
		Timers.add(actionFunc, data.pendingTimers[i], 'marchesMarchesPendingTargetTimer_' + i, tickFunc);
	}
	
	$$('a[name="marchTypes_2"]').each(function(elem){
		elem.stopObserving().observe('click', function(){
			self.marchType = 2;
			self.castleId = $('marchesCastleFilter').getValue();
			self.minPopulation = $('marchesPopFilter').getValue();
			self.loadContent();
		});
	});
	$$('a[name="marchTypes_3"]').each(function(elem){
		elem.stopObserving().observe('click', function(){
			self.marchType = 3;
			self.castleId = $('marchesCastleFilter').getValue();
			self.minPopulation = $('marchesPopFilter').getValue();
			self.loadContent();
		});
	});
	$$('a[name="marchTypes_5"]').each(function(elem){
		elem.stopObserving().observe('click', function(){
			self.marchType = 5;
			self.castleId = $('marchesCastleFilter').getValue();
			self.minPopulation = $('marchesPopFilter').getValue();
			self.loadContent();
		});
	});
	$$('a[name="marchTypes_5"]').each(function(elem){
		elem.stopObserving().observe('click', function(){
			self.marchType = 5;
			self.castleId = $('marchesCastleFilter').getValue();
			self.minPopulation = $('marchesPopFilter').getValue();
			self.loadContent();
		});
	});
	$$('a[name="marchTypes_8"]').each(function(elem){
		elem.stopObserving().observe('click', function(){
			self.marchType = 8;
			self.castleId = $('marchesCastleFilter').getValue();
			self.minPopulation = $('marchesPopFilter').getValue();
		});
	});
	$$('a[name="marchTypes_13"]').each(function(elem){
		elem.stopObserving().observe('click', function(){
			self.marchType = 13;
			self.castleId = $('marchesCastleFilter').getValue();
			self.minPopulation = $('marchesPopFilter').getValue();
			self.loadContent();
		});
	});
	
	$$('a.downTime').each(function(elem){
		elem.stopObserving().observe('click', function(){
			self.marchType = $('marchesTypeFilter').getValue();
			self.castleId = $('marchesCastleFilter').getValue();
			self.minPopulation = $('marchesPopFilter').getValue();
			self.useTimeLeftFilter = 1;
			self.timeLeftDirection = 'down';
			self.loadContent();
		});
	});
	
	$$('a.upTime').each(function(elem){
		elem.stopObserving().observe('click', function(){
			self.marchType = $('marchesTypeFilter').getValue();
			self.castleId = $('marchesCastleFilter').getValue();
			self.minPopulation = $('marchesPopFilter').getValue();
			self.useTimeLeftFilter = 1;
			self.timeLeftDirection = 'up';
			self.loadContent();
		});
	});
};


Marches.prototype.marchInfo = function(marchId){
	new Ajax.Request('info.php', {
		method: 'post',
		parameters: {what: 'pohod', posted_id : marchId},
		onSuccess: function(transport) {
			//kwDialog('marchInfo', transport.responseText);
			new kwModal({'placeholder': 'marchInfoModal', 'placeholderClass': 'newPopup3 marchInfo', 'content': transport.responseText, 'width': 640}).show();
		}
	});
};



Marches.prototype.recallMarch = function(marchId){
	var self = this;
	new Ajax.Request('ajax_marches.php', {
		method: 'post',
		parameters: {type: 'recallMarch', march_id : marchId},
		onSuccess: function(transport) {
			var response = transport.responseText.evalJSON(true);
			
			if(response.status != 1){
				//workaround popup bug ... ask Val
				setTimeout(function(){
					kwModal.error(response.body);
				}, 500);
				
			} else {
				self.loadContent();
			}	
		}
	});
};




Marches.prototype.setLangStrings = function(strings){
	this.langStrings = strings;
};

Marches.prototype.registerCallback = function(type, callback){
	if(typeof callback === 'function'){
		this.callbacks[type].push(callback);
	}
};


Marches.prototype.executeCallbacks = function(type, data){
	var i, self = this;
	data = data || {};
	if(this.callbacks[type] === undefined){
		return false;
	}

	for(i = 0; i < this.callbacks[type].length; i++){
		setTimeout((function(index){
			return function(){
				self.callbacks[type][index](data);
			};
		}(i)), 0);	
	}
};


Marches.prototype.switchToOldInterface = function(){
	var params = {
		type : 'switchInterface',
		useNewInterface : 0	
	};

	new Ajax.Request('ajax_marches.php', {
		method: 'post',
		parameters: params,
		onSuccess: function(transport) {
			window.location.reload();
		}
	});
};

Marches.prototype.addToTower = function(unit, towerFreePop){
	var count,
		params,
		self = this;
	/**
	 * Adding only such number of units that can be placed in tower
	 *
	 */

	if(unit.pop * unit.count > towerFreePop) {
		count = Math.floor(towerFreePop / unit.pop);
	} else {
		count = unit.count;
	}

		params = {
		type :'addToTower',
		unitId : unit.unit_id,
		count : count
		};

	new Ajax.Request('ajax_tower.php', {
		method: 'post',
		parameters: params,
		onSuccess: function(transport) {
			self.loadContent();

			}
	});
};

Marches.prototype.emptyTower = function () {
	var self = this,
		params = {
		type: 'emptyTower'

	};

	new Ajax.Request('ajax_tower.php', {
		method: 'post',
		parameters: params,
		onSuccess: function (transport) {
			self.loadContent();

		}
	});
};
Marches.prototype.emptyTowerByUnit = function (unitId) {
	var params,
		unitId = unitId,
		self = this;

	params = {
		type: 'emptyTowerByUnit',
		unitId :unitId

	};

	new Ajax.Request('ajax_tower.php', {
		method: 'post',
		parameters: params,
		onSuccess: function (transport) {
			self.loadContent();

		}
	});
};