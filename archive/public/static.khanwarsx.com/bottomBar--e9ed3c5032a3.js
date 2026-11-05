'use strict';

function BottomBar(isOpen, barType){
	var self = this;
	
	this.isOpen = isOpen;
	this.barType = barType;
	this.loadExtraInfo = {};
	
	this.postLoadHandlers = {
		'1' : function(data){self.initBuildingTimers(data);},
		'2' : function(data){self.initMarchTimers(data);},
		'3' : function(data){self.initUpgradesTimers(data);},
		'4' : function(data){self.initUnitsTimers(data);},
		'5' : function(data){self.initUnitsTimers(data);},
		'6' : function(data){self.initUnitsTimers(data);},
		'7' : function(data){self.initUnitsTimers(data);},
		'8' : function(data){self.initFriendsList(data);},
		'9' : function(data){},
		'10' : function(data){self.initChat(data)},
		'11' : function(data){self.initUnitsTimers(data);}
		
	};

	
	this.langStrings = {};

	this.btnTypeIds = {
		'1' : 'tabBuildings',
		'2' : 'tabMarches',
		'3' : 'tabBlacksmith',
		'4' : 'tabInfantry',
		'5' : 'tabCavalry',
		'6' : 'tabSiege',
		'7' : 'tabOrder',
		'8' : 'tabFriends',
		'9' : 'tabClan',
		'11' : 'tabArchery'
		
	};
	
	this.reloadContent = {
		'1' : true,
		'2' : true,
		'3' : true,
		'4' : true,
		'5' : true,
		'6' : true,
		'7' : true,
		'8' : true,
		'9' : true,
		'11' : true
	};
	
	this.contents = {};
	
	this.zeroTimerReloads = 0;
	
	this.scrollbar = new Control.ScrollBar('bottomBarContent','scrollbar_track'); 
	
	if(isOpen){
		this.load(barType, this.loadExtraInfo);
	}

}


BottomBar.prototype.load = function(type, extraInfo){
	$$('#barButtons a').each(function(elem){elem.removeClassName('active');});
        if(!this.btnTypeIds[type]){
            return;
        }
	$(this.btnTypeIds[type]).addClassName('active');
	
	var key;
	
	
	
	for (key in this.reloadContent) {
		if (this.contents[key]) {
			if (this.reloadContent[key]) {
				this.contents[key].innerHTML = '';
			} else {
				if (key == type) {
					this.contents[key].show();
					
					if(!$('bottomBarContent').visible()){
						this.open();
					}
					this.scrollbar.recalculateLayout();
					return;
				} else {
					this.contents[key].hide();
				}
			}
		}
	}

	var self = this;
	extraInfo = extraInfo || {};
	this.loadExtraInfo = extraInfo;
	var params = Object.toQueryString({type: 'load', bar_type : type}) + '&' + Object.toQueryString(extraInfo);
	new Ajax.Request('ajax_bottomBar.php', {
		method: 'post',
		parameters: params,
		onSuccess: function(transport) {
			if (!self.contents[type]) {
				self.contents[type] = new Element('div');
				$('bottomBarContent').insert(self.contents[type]);
			}
			self.barType = type;
			var response = transport.responseText.evalJSON(true);
			
			self.contents[type].innerHTML = response.body;
			self.scrollbar.recalculateLayout(); 
			
			if(response.data !== undefined && self.postLoadHandlers[type] !== undefined){
				self.postLoadHandlers[type](response.data);
			}
			
			if(!$('bottomBarContent').visible()){
				self.open();
			}
			response.body.evalScripts();
		}
	});
};


BottomBar.prototype.getIsOpen = function(){
	return this.isOpen;
};


BottomBar.prototype.getBarType = function(){
	return this.barType;
};


BottomBar.prototype.reload = function(){
	this.load(this.barType, this.loadExtraInfo);
};


BottomBar.prototype.positionBar = function(){
	var madmooBar, madmooBarLayout, bar;
	madmooBar = $('madmooBar');
	bar = $('bottomBarContainer');
	if(!madmooBar){
		bar.setStyle({bottom : ''});
		return false;
	}
	madmooBarLayout = madmooBar.getLayout();
	
	
	if(madmooBar.visible()){
		bar.setStyle({bottom : madmooBarLayout.get('height') + 'px'});
	} else {
		bar.setStyle({bottom : ''});
	}
};


BottomBar.prototype.open= function(){
	var self = this;
	Effect.BlindDown('bottomBarContent', { duration: 0.6, afterFinish: function(){
		$('bottomBarContainer').removeClassName('closed');
		self.scrollbar.recalculateLayout(); 
	} });

	$('bottomBarCloseBtn').setStyle({display:'block'});
	$('bottomBarOpenBtn').setStyle({display:'none'});
	
	this.isOpen = true;
	if($('bottomBarContent').descendants().length === 0){
		this.load(this.barType, this.loadExtraInfo);
	}
	new Ajax.Request('ajax_bottomBar.php', {
		method: 'post',
		parameters: {type: 'openBar'}
	});
};

BottomBar.prototype.close = function(){

	Effect.BlindUp('bottomBarContent', { duration: 0.6, afterFinish: function(){$('bottomBarContainer').addClassName('closed');} });
	$('bottomBarCloseBtn').setStyle({display:'none'});
	$('bottomBarOpenBtn').setStyle({display:'block'});

	this.isOpen = false;
	new Ajax.Request('ajax_bottomBar.php', {
		method: 'post',
		parameters: {type: 'closeBar'}
	});
};


BottomBar.prototype.addTimer = function(action, timeLeft, elementId, onTickAction){
	return Timers.add(action, timeLeft, elementId, onTickAction);
};





BottomBar.prototype.updateProgressBar = function(elementId, timeNeeded, timeLeft){
	var percent =  (1 - (timeLeft / timeNeeded)) * 100;
	if(percent < 1){
		percent = 1;
	}
	if(percent > 100){
		percent = 100;
	}
	if($(elementId)){
		$(elementId).setStyle({width : percent + '%'});
	}
};



BottomBar.prototype.initBuildingTimers = function(data){
	
	var i, self = this, actionFunc, tickFunc, timer;

	for(i in data.timers){
		if(!data.timers.hasOwnProperty(i)){
			continue;
		}

		actionFunc = function(){
			self.load(self.barType, self.loadExtraInfo);
		};

		tickFunc = function(elementId, timeNeeded){
			return function(timeLeft){
				if (timeLeft <= 60) {
					//get id from dom element ID string
					var id_fragments = elementId.split('_');
					var id = id_fragments[id_fragments.length - 1];
					//get instant finish element ID
					var instantFinishBtnId = 'barBuildingSpeedBtn_' + id;
					if ($(instantFinishBtnId).hasClassName('pulse') == false) {
						//add pulse and new observer
						$(instantFinishBtnId).addClassName('pulse');
						$(instantFinishBtnId).stopObserving('click').observe('click', function(){
							new InstantProcess(1, id, {instantFinishTimeReached: true});
						});
					}
				}
				self.updateProgressBar(elementId, timeNeeded, timeLeft);
			};
		}('barBuildingProgress_' + i, data.buildTimes[i]);

		timer = this.addTimer(actionFunc, data.timers[i], 'barQueBuildingTimer_' + i, tickFunc);

		if($('barBuildingCancelBtn_' + i)){
			$('barBuildingCancelBtn_' + i).observe('click', function(processId){
				return function(){
					/*kwDialog('info',
						self.langStrings.cancelProcess + '<br><br>' +
						self.langStrings.resourcesReturned + '<br><br>' +
						'<div class="cancelBuild2"><img src="'+ self.imgLink +'layout/res_ico_gold.png">' + numberFormat(data.resources[i].gold) + '</div>' + 
						'<div class="cancelBuild"><img src="'+ self.imgLink +'layout/res_ico_iron.png">' + numberFormat(data.resources[i].iron) + '</div><br>' +
						'<div class="cancelBuild2"><img src="'+ self.imgLink +'layout/res_ico_wood.png">' + numberFormat(data.resources[i].wood) + '</div>' +
						'<div class="cancelBuild"><img src="'+ self.imgLink +'layout/res_ico_food.png">' + numberFormat(data.resources[i].food) + '</div>' 
						,true, true, function(){self.cancelBuilding(processId);}
					);*/
					kwModal.confirm(
						self.langStrings.cancelProcess + '<br><br>' +
						self.langStrings.resourcesReturned + '<br><br>' +
						'<div class="cancelBuild2"><img src="'+ self.imgLink +'layout/res_ico_gold.png">' + numberFormat(data.resources[i].gold) + '</div>' + 
						'<div class="cancelBuild"><img src="'+ self.imgLink +'layout/res_ico_iron.png">' + numberFormat(data.resources[i].iron) + '</div><br>' +
						'<div class="cancelBuild2"><img src="'+ self.imgLink +'layout/res_ico_wood.png">' + numberFormat(data.resources[i].wood) + '</div>' +
						'<div class="cancelBuild"><img src="'+ self.imgLink +'layout/res_ico_food.png">' + numberFormat(data.resources[i].food) + '</div>'
						,function(){self.cancelBuilding(processId);}
					);
				};


			}(i));
		}
		
		if($('barBuildingSpeedBtn_' + i)){
			$('barBuildingSpeedBtn_' + i).observe('click', function(processId){
				return function(){
					new InstantProcess(1, processId);
				};
			}(i));
		}
		
		//sync the timer
		if(Timers.exists('standardQueTimer_' + i)){
			timer.syncWith('standardQueTimer_' + i);
		}
	}
	
	if($('barViewInAllCastles')){
		$('barViewInAllCastles').observe('click', function(){
			self.loadExtraInfo.all_castles = 1;
			self.load(self.barType, self.loadExtraInfo);
		});
	}
	
} ;

BottomBar.prototype.cancelBuilding = function(processId){
	var self = this;
	new Ajax.Request('ajax_bottomBar.php', {
		method: 'post',
		parameters: {type: 'cancelBuildingProccess', proccess_id : processId},
		onSuccess: function(transport) {
			var fileName = window.location.pathname;
			if(fileName.search('overview.php') >= 0 || fileName.search('buildings.php') >= 0){
				refreshSession();
				window.location.reload();
			} else {
				self.load(self.barType, self.loadExtraInfo);
				refreshSession();
			}
			
		}
	});
};





BottomBar.prototype.initMarchTimers = function(data){
	var i, self = this, actionFunc, tickFunc, reload = false;
	
	$('barAllMarchesBtn').observe('click', function(){
		self.loadExtraInfo.direction = 'all';
		self.loadExtraInfo.castle_id = $('barCastleFilter').getValue();
		self.loadExtraInfo.min_pop = $('barPopFilter').getValue();
		self.load(self.barType, self.loadExtraInfo);
	});
	$('barIncomingMarchesBtn').observe('click', function(){
		self.loadExtraInfo.direction = 'incoming';
		self.loadExtraInfo.castle_id = $('barCastleFilter').getValue();
		self.loadExtraInfo.min_pop = $('barPopFilter').getValue();
		self.load(self.barType, self.loadExtraInfo);
	});
	$('barOutgoingMarchesBtn').observe('click', function(){
		self.loadExtraInfo.direction = 'outgoing';
		self.loadExtraInfo.castle_id = $('barCastleFilter').getValue();
		self.loadExtraInfo.min_pop = $('barPopFilter').getValue();
		self.load(self.barType, self.loadExtraInfo);
	});
	
	$('barCastleFilter').observe('change', function(){
		self.loadExtraInfo.castle_id = $('barCastleFilter').getValue();
		self.loadExtraInfo.min_pop = $('barPopFilter').getValue();
		self.load(self.barType, self.loadExtraInfo);
	});
	
	$('barPopFilter').observe('change', function(){
		self.loadExtraInfo.castle_id = $('barCastleFilter').getValue();
		self.loadExtraInfo.min_pop = $('barPopFilter').getValue();
		self.load(self.barType, self.loadExtraInfo);
	});

	for(i in data.timers){

		if(!data.timers.hasOwnProperty(i)){
			continue;
		}
		
		if(parseInt(data.timers[i], 10) <= 0){
			reload = true;
		}

		actionFunc = function(){
			self.load(self.barType, self.loadExtraInfo);
		};

		tickFunc = function(elementId, timeNeeded){
			return function(timeLeft){
				self.updateProgressBar(elementId, timeNeeded, timeLeft);
			};
		}('barMarchProgress_' + i, data.marchTimes[i]);

		this.addTimer(actionFunc, data.timers[i], 'barMarchesTimer_' + i, tickFunc);
		
		$('barMarchesInfoBtn_' + i).observe('click', function(marchId){
			return function(){
				self.marchInfo(marchId);
			}
		}(i));
		
		if($('barMarchesRecallBtn_' + i)){
			$('barMarchesRecallBtn_' + i).observe('click', function(marchId){
				return function(){
					var from = $('barCastleFrom_' + marchId).innerHTML;
					var to = $('barCastleTo_' + marchId).innerHTML;
					var text = self.langStrings.recallMarch;
					text = text.replace('%1',from);
					text =  text.replace('%2',to);
//					kwDialog('info',
//						text, true, true, function(){self.recallMarch(marchId);}
//					);
					kwModal.confirm(text, function(){self.recallMarch(marchId);});

				}
			}(i));
		}
	}
	
	if(reload && self.zeroTimerReloads < 3){
		self.zeroTimerReloads++;
		setTimeout(function(){self.load(self.barType, self.loadExtraInfo);}, 1500);		
	}
	
	for(i in data.targetTimers){
		if(!data.targetTimers.hasOwnProperty(i)){
			continue;
		}
		this.addTimer(function(){}, data.targetTimers[i], 'barMarchesTargetTimer_' + i);
	}
};


BottomBar.prototype.marchInfo = function(marchId){
	var self = this;
	new Ajax.Request('info.php', {
		method: 'post',
		parameters: {what: 'pohod', posted_id : marchId},
		onSuccess: function(transport) {
			//kwDialog('marchInfo', transport.responseText);
			new kwModal({'placeholder': 'marchInfoModal', 'placeholderClass': 'newPopup3 marchInfo', 'content': transport.responseText, 'width': 640}).show();
		}
	});
};


BottomBar.prototype.recallMarch = function(marchId){
	var self = this;
	new Ajax.Request('ajax_bottomBar.php', {
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
				self.load(self.barType, self.loadExtraInfo);
			}
				
		}
	});
};




BottomBar.prototype.initUnitsTimers = function(data){
	var i, self = this, actionFunc, tickFunc, timer , timerPerUnit;
	for(i in data.timers){
		if(!data.timers.hasOwnProperty(i)){
			continue;
		}

		actionFunc = function(){
			self.load(self.barType, self.loadExtraInfo);
		};

		tickFunc = function(elementId, timeNeeded){
			return function(timeLeft){
				self.updateProgressBar(elementId, timeNeeded, timeLeft);
			};
		}('barUnitProgress_' + i, data.buildTimes[i]);

		timerPerUnit = this.addTimer(actionFunc, data.curentUnitTimers[i], 'barQueUnitTimer_' + i);
		timer = this.addTimer(actionFunc, data.timers[i], 'barQueUnitTimer2_' + i,tickFunc);

		if($('barUnitCancelBtn_' + i)){
			$('barUnitCancelBtn_' + i).observe('click', function(processId, unitId){
				return function (){
//					kwDialog('info',
//						self.langStrings.cancelProcess, true, true, function(){self.cancelUnit(processId, unitId);}
//					);
					
					kwModal.confirm(self.langStrings.cancelProcess, function(){self.cancelUnit(processId, unitId);});
				};

			}(i, data.unitIds[i]));
		}
		
		if($('barUnitSpeedBtn_' + i)){
			$('barUnitSpeedBtn_' + i).observe('click', function(processId){
				return function(){
					new InstantProcess(2, processId, {unit_type : data.unit_type});
				};
			}(i));
		}
		
		//sync the timer
		if(Timers.exists('standardQueTimer_' + i)){
			timer.syncWith('standardQueTimer_' + i);
		}
		if(Timers.exists('standardQueTimerPerUnit_' + i)){
			timerPerUnit.syncWith('standardQueTimerPerUnit_' + i);
		}
		
	}
	
	if($('barViewInAllCastles')){
		$('barViewInAllCastles').observe('click', function(){
			self.loadExtraInfo.all_castles = 1;
			self.load(self.barType, self.loadExtraInfo);
		});
	}
	
	
	
} ;



BottomBar.prototype.cancelUnit = function(processId, unitId){
	var self = this;
	new Ajax.Request('ajax_bottomBar.php', {
		method: 'post',
		parameters: {type: 'cancelTrainingProccess', proccess_id : processId, unit_id : unitId},
		onSuccess: function(transport) {
			var fileName = window.location.pathname;
			if(fileName.search('barracks.php') >= 0){
				refreshSession();
				window.location.reload();
			} else {
				self.load(self.barType, self.loadExtraInfo);
				refreshSession();
			}
			
		}
	});
};




BottomBar.prototype.initUpgradesTimers = function(data){
	var i, self = this, actionFunc, tickFunc, timer;
	for(i in data.timers){
		if(!data.timers.hasOwnProperty(i)){
			continue;
		}

		actionFunc = function(){
			self.load(self.barType, self.loadExtraInfo);
		};

		tickFunc = function(elementId, timeNeeded){
			return function(timeLeft){
				self.updateProgressBar(elementId, timeNeeded, timeLeft);
			};
		}('barUpgradeProgress_' + i, data.buildTimes[i]);

		timer = this.addTimer(actionFunc, data.timers[i], 'barQueUpgradeTimer_' + i, tickFunc, 'barQueTimer_' + i);


		if($('barUpgradeCancelBtn_' + i)){
			$('barUpgradeCancelBtn_' + i).observe('click', function(processId){
				return function (){
//					kwDialog('info',
//						self.langStrings.cancelProcess, true, true, function(){self.cancelUpgrade(processId);}
//					);
					kwModal.confirm(self.langStrings.cancelProcess, function(){self.cancelUpgrade(processId);});
				};

			}(i));
		}
		
		if($('barUpgradeSpeedBtn_' + i)){
			$('barUpgradeSpeedBtn_' + i).observe('click', function(processId){
				return function(){
					new InstantProcess(3, processId);
				};
			}(i));
		}
		
		
		//sync the timer
		if(Timers.exists('standardQueTimer_' + i)){
			timer.syncWith('standardQueTimer_' + i);
		}
	}
	
	
	
} ;



BottomBar.prototype.cancelUpgrade = function(processId, unitId){
	var self = this;
	new Ajax.Request('ajax_bottomBar.php', {
		method: 'post',
		parameters: {type: 'cancelUpgradeProccess', proccess_id : processId, unit_id : unitId},
		onSuccess: function(transport) {
			var response = transport.responseText.evalJSON(true);
			var fileName = window.location.pathname;
			
			if(response.success == 0){
				//kwDialog('error', response.message, true);
				kwModal.error(response.message);
				return;
			} else {
				//kwDialog('info', response.message, true);
				kwModal.info(response.message);
			}
			
			if(fileName.search('upgrades.php') >= 0){
				refreshSession();
				window.location.reload();
			} else {
				self.load(self.barType, self.loadExtraInfo);
				refreshSession();
			}
			
		}
	});
};



BottomBar.prototype.initFriendsList = function(data){
	var i, self = this;

	for(i = 0; i < data.friendIds.length; i++){
		$('barRemoveFriendBtn_' + data.friendIds[i]).observe('click', function(friendId){
			return function (){
//				kwDialog('info',
//					self.langStrings.deleteFriend, true, true, function(){self.deleteFriend(friendId);}
//				);
					
				kwModal.confirm(self.langStrings.deleteFriend, function(){self.deleteFriend(friendId);});
			};

		}(data.friendIds[i]));
	}
};


BottomBar.prototype.deleteFriend = function(friendId){
	var self = this;
	new Ajax.Request('ajax_bottomBar.php', {
		method: 'post',
		parameters: {type: 'deleteFriend', friend_id : friendId},
		onSuccess: function(transport) {
			var fileName = window.location.pathname;
			if(fileName.search('options.php') >= 0){
				refreshSession();
				window.location.reload();
			} else {
				self.load(self.barType, self.loadExtraInfo);
				refreshSession();
			}
		}
	});
};



BottomBar.prototype.initChat = function(data){
	//var scrollBar = new Control.ScrollBar('barChatContent','barChatTrack'); 
};
