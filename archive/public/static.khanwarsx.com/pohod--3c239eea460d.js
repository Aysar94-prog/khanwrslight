"use strict";
//Requires on marchesPopup.

function Pohod(){
	this.heroMarches = [];
	this.langStrings = {};
	this.unitData = {};
	this.foramationsData = {};
	this.sendingIsBlocked = false;
	this.marchData = {
		currentMarch : 0,
		marches : []
	};
}


Pohod.prototype.setLangStrings = function(strings){
	this.langStrings = strings;
};


Pohod.prototype.setHeroMarches = function(marches){
	this.heroMarches = marches;
};

Pohod.prototype.setNoblesPresent = function(nobles) {
	this.noblesPresent = nobles;
}

Pohod.prototype.setSiegePresent = function(siege) {
	this.siegePresent = siege;
}

Pohod.prototype.getNoblesPresent = function() {
	return this.noblesPresent;
}

Pohod.prototype.getSiegePresent = function() {
	return this.siegePresent;
}

Pohod.prototype.setUnitData = function(data){
	var self = this;
	this.unitData = data;

};





Pohod.prototype.getMarchInfo = function(){
	var params = {getMarchInfo : 1};
	var marchInfo = this.marchData.marches.concat([this.collectMarchData()]);
	params.jsonData = encodeURI(Object.toJSON(marchInfo));
	new Ajax.Request('pohod.php', {
		method: 'post',
		parameters: params,
		onSuccess: function(transport) {
			var response = transport.responseText.evalJSON(true);
			var motivOptions, i;
			if($('pohodPopulation')){
				$('pohodPopulation').innerHTML = numberFormat(response.population);
			}
			if($('pohodCargo')){
				$('pohodCargo').innerHTML = numberFormat(response.cargo);
			}
			if($('timeDirection')){
				$('timeDirection').innerHTML = response.timeNeededFormated;
			}

			if(response.timeWithoutMotivation < 1800 && $('motiv_speed')){
				motivOptions = $$('select#motiv_speed option');
				for(i = 0; i < motivOptions.length; i++){
					if(motivOptions[i].value > 20){
						motivOptions[i].disabled = true;
					}
				}
			}

			if(response.timeWithoutMotivation > 1800 && $('motiv_speed')){
				motivOptions = $$('select#motiv_speed option');
				for(i = 0; i < motivOptions.length; i++){
					motivOptions[i].disabled = false;
				}
			}







			if($('resGold')){
				$('resGoldMaxBtn').stopObserving().observe('click', function(){
					$('resGold').value = response.availableResources.gold;
					$('resGoldMaxBtn').hide();
					$('resGoldMinBtn').show();
					recalculateTotalCargo();
				});
				$('resGoldMinBtn').stopObserving().observe('click', function(){
					$('resGold').value = 0;
					$('resGoldMaxBtn').show();
					$('resGoldMinBtn').hide();
					recalculateTotalCargo();
				});
			}
			if($('resIron')){
				$('resIronMaxBtn').stopObserving().observe('click', function(){
					$('resIron').value = response.availableResources.iron;
					$('resIronMaxBtn').hide();
					$('resIronMinBtn').show();
					recalculateTotalCargo();
				});
				$('resIronMinBtn').stopObserving().observe('click', function(){
					$('resIron').value = 0;
					$('resIronMaxBtn').show();
					$('resIronMinBtn').hide();
					recalculateTotalCargo();
				});
			}
			if($('resWood')){
				$('resWoodMaxBtn').stopObserving().observe('click', function(){
					$('resWood').value = response.availableResources.wood;
					$('resWoodMaxBtn').hide();
					$('resWoodMinBtn').show();
					recalculateTotalCargo();
				});
				$('resWoodMinBtn').stopObserving().observe('click', function(){
					$('resWood').value = 0;
					$('resWoodMaxBtn').show();
					$('resWoodMinBtn').hide();
					recalculateTotalCargo();
				});
			}
			if($('resFood')){
				$('resFoodMaxBtn').stopObserving().observe('click', function(){
					$('resFood').value = response.availableResources.food;
					$('resFoodMaxBtn').hide();
					$('resFoodMinBtn').show();
					recalculateTotalCargo();
				});
				$('resFoodMinBtn').stopObserving().observe('click', function(){
					$('resFood').value = 0;
					$('resFoodMaxBtn').show();
					$('resFoodMinBtn').hide();
					recalculateTotalCargo();
				});
			}



			$('resGold', 'resIron', 'resWood','resFood').each(function(el, k){
				el.observe('blur', function(event) {
					recalculateTotalCargo();
				});
			});

			function recalculateTotalCargo() {
				var totalCargo = 0;
				$('resGold', 'resIron', 'resWood', 'resFood').each(function (el, k) {
					var value = parseInt(el.value);
					totalCargo = totalCargo + value;
				});
				$('addedCargo').innerHTML = numberFormat(intVal(totalCargo));
			}

			$('resAllMaxBtn').stopObserving().observe('click', function () {
				var playerRes = {
					'Gold': parseInt(response.availableResources.gold),
					'Iron': parseInt(response.availableResources.iron),
					'Wood': parseInt(response.availableResources.wood),
					'Food': parseInt(response.availableResources.food)
				};

				var filledCargo = {
					'Gold': 0,
					'Iron': 0,
					'Wood': 0,
					'Food': 0
				};
				var cargo = response.cargo;
				var counter = 0;
				var resAmount;
				var delimiter;
				var key;
				while (cargo > 0 && counter <= 4) {
					counter++;
					delimiter = 0;
					for (key in playerRes) {
						if (playerRes.hasOwnProperty(key)) {
							delimiter++;
						}
					}
					resAmount = Math.floor(cargo / delimiter);
					if (resAmount == 0) {
						resAmount = 1;
					}

					for (key in playerRes) {
						if (playerRes[key] < resAmount) {
							if (!playerRes.hasOwnProperty(key)) {
								continue;
							}
							resAmount = playerRes[key];
						}
					}

					for (key in playerRes) {
						if (!playerRes.hasOwnProperty(key)) {
							continue;
						}
						filledCargo[key] += resAmount;
						cargo -= resAmount;
						if (cargo == 0) {
							break;
						}
						playerRes[key] -= resAmount;
						if (playerRes[key] == 0) {
							delete playerRes[key];
						}
					}
				}

				$('resGold').value = parseInt(filledCargo.Gold);
				$('resIron').value = filledCargo['Iron'];
				$('resWood').value = filledCargo['Wood'];
				$('resFood').value = filledCargo['Food'];
				recalculateTotalCargo();
				$('resGold', 'resIron', 'resWood', 'resFood').each(function (el, k) {
					if (el) {
						el.observe('blur', function (event) {
							recalculateTotalCargo();
						});
					}
				});
			});
		}
	});
};

Pohod.prototype.getformationInfo = function(){
	var params = {getformationInfo : 1};
	var marchInfo = [this.collectMarchData()];
	params.jsonData = encodeURI(Object.toJSON(marchInfo));
	new Ajax.Request('pohod.php', {
		method: 'post',
		parameters: params,
		onSuccess: function(transport) {
			var response = transport.responseText.evalJSON(true);
			var i;
			for(i in response.formationData){
				if(!response.formationData.hasOwnProperty(i)){
					continue;
				}
				if($('pohodUnitCount_' + i)){
					$('pohodUnitCount_' + i).value = response.formationData[i].count;
				}

			}
			this.validateUnits();
		}
	});
};

Pohod.prototype.collectMarchData = function(){
	//console.log(march);
	var i;
	var march = new MarchInfo();
	var units = {};
	var coords;
	for (i = 0; i <  this.unitData.length; i++){
		if($('pohodUnitCount_' + this.unitData[i].unit_id)){
			units[this.unitData[i].unit_id] = $('pohodUnitCount_' + this.unitData[i].unit_id).value;
		}
	}

	march.setUnits(units);
	march.setAttackerCoords($('attackerX').value, $('attackerY').value);




	if($('defenderX') && $('defenderY')){
		march.setDefenderCoords($('defenderX').value, $('defenderY').value);
	}

	if($('pohodMarchType')){
		march.setMarchType($('pohodMarchType').value);
	}

	if($('pohodSendHero') && $('pohodSendHero').value == 1){
		march.setHero($('pohodSendHeroId').value);
	}

	if($('pohodFormation')){
		march.setFormation($('pohodFormation').value);
	}

	if($('pohodSpeed')){
		march.setSpeed($('pohodSpeed').value);
	}

	if($('motiv_speed')){
		march.setSpeedMotivation($('motiv_speed').value);
	}

	if($('motiv_noble')){
		march.setNobleMotivation($('motiv_noble').value);
	}

	if($('motiv_spy')){
		march.setSpyMotivation($('motiv_spy').value);
	}

	if($('motiv_cargo')){
		march.setCargoMotivation($('motiv_cargo').value);
	}

	if($('motiv_cleanup')){
		march.setCleanupMotivation($('motiv_cleanup').value);
	}

	if($('motiv_siege')){
		march.setSiegeMotivation($('motiv_siege').value);
	}

	if($('siegeType')){
		march.setSiegeType($('siegeType').value);
	}


	if (march.marchType == 1 || march.marchType == 16) {
		var goldValue = $('resGold').value;
		if (goldValue <= 0 || isNaN(goldValue)) {
			$('resGold').value = 0;
		}
		if (goldValue > 0) {
			march.setGold(goldValue);
		}

		var ironValue = $('resIron').value;
		if (ironValue <= 0 || isNaN(ironValue)) {
			$('resIron').value = 0;
		}
		if (ironValue > 0) {
			march.setIron(ironValue);
		}

		var woodValue = $('resWood').value;
		if (woodValue <= 0 || isNaN(woodValue)) {
			$('resWood').value = 0;
		}
		if (woodValue > 0) {
			march.setWood(woodValue);
		}

		var foodValue = $('resFood').value;
		if (foodValue <= 0 || isNaN(foodValue)) {
			$('resFood').value = 0;
		}
		if (foodValue > 0) {
			march.setFood(foodValue);
		}

	} else {
		if($('sendFood')){
			march.setFood(parseInt($('sendFood').value, 10));
		}
	}

	return march;

};



Pohod.prototype.checkHero = function(){
	var marchType = $('pohodMarchType').value;

	if(!$('heroRow')){
		return;
	}

	if(this.heroMarches.indexOf(parseInt(marchType, 10)) === -1){
		if($('heroSendButton')){
			$('heroSendButton').hide();
		}

		$('pohodSendHero').value = 0;
		$('heroMsg').innerHTML = this.langStrings.heroMessagesOnlyTypes;
	} else {
		if($('heroSendButton')){
			$('heroSendButton').show();
		}
		$('heroMsg').innerHTML = this.langStrings.heroMessagesWaiting;
	}
};


Pohod.prototype.toggleHeroBtn = function(){
	if($('pohodSendHero').value == 0){
		$('pohodSendHero').value = 1;
		$('heroSendButton').value = this.langStrings.heroMessagesBtnRemoveHero;
		$('heroMsg').innerHTML = this.langStrings.heroMessagesWillGo;
	} else {
		$('pohodSendHero').value = 0;
		$('heroSendButton').value = this.langStrings.heroMessagesBtnSendHero;
		$('heroMsg').innerHTML = this.langStrings.heroMessagesWaiting;
	}
	this.getMarchInfo();
};


Pohod.prototype.selectAllUnits = function(){
	var i;
	for(i = 0; i < this.unitData.length; i++){
		if($('pohodUnitCount_' + this.unitData[i].unit_id)){
			$('pohodUnitCount_' + this.unitData[i].unit_id).value = this.unitData[i].count;
		}
	}
	this.getMarchInfo();
	this.validateUnits();
};

Pohod.prototype.selectNoneUnits = function(){
	var i;
	for(i = 0; i < this.unitData.length; i++){
		if($('pohodUnitCount_' + this.unitData[i].unit_id)){
			$('pohodUnitCount_' + this.unitData[i].unit_id).value = 0;
		}
	}
	this.getMarchInfo();
	this.validateUnits();
};


Pohod.prototype.validateUnits = function(){
	var i;
	for(i = 0; i < this.unitData.length; i++){
		if($('pohodUnitCount_' + this.unitData[i].unit_id)){
			if(parseInt($('pohodUnitCount_' + this.unitData[i].unit_id).value, 10) > this.unitData[i].count){
				$('cact' + this.unitData[i].unit_id).innerHTML = parseInt($('pohodUnitCount_' + this.unitData[i].unit_id).value, 10) - this.unitData[i].count;
				$('note' + this.unitData[i].unit_id).show();
				$('pohodUnitCount_' + this.unitData[i].unit_id).value = this.unitData[i].count;
			} else {
				$('note' + this.unitData[i].unit_id).hide();
			}
		}
	}
};




Pohod.prototype.switchToNewInterface = function(){
	var params = {
		type : 'switchInterface',
		useNewInterface : 1
	};

	new Ajax.Request('ajax_marches.php', {
		method: 'post',
		parameters: params,
		onSuccess: function(transport) {
			window.location.reload();
		}
	});
};

Pohod.prototype.setCoords = function(element){
	for(var i = 0; i < element.childNodes.length; i++){
		if(element.childNodes[i].selected){
			var coords = element.childNodes[i].value.split(':');
			document.getElementById('defenderX').value = coords[0];
			document.getElementById('defenderY').value = coords[1];
			break;
		}
	}

	this.getMarchInfo();
};

Pohod.prototype.showMotivation = function() {
	//Get the march type
	var form = document.getElementsByName('form1')[0];
	var type = parseInt( form.type.value );

	var speedMotivation = [2,3,5,7,8,13];
	var cleanupMotivation = [5];
	var nobleMotivation = [3];
	var spyMotivation = [7];
	var siegeMotivation = [3];
	var cargoMotivation = [3,5];
	var noExtraMotivation = [2,13];

	if ($('motivationOptions') != null) {
		if(inArray(type, noExtraMotivation))
			$('motivationOptions').hide();
		else
			$('motivationOptions').show();
	}

	if ($('motivSpeedHolder') != null) {
		if( inArray(type, speedMotivation) )
			$('motivSpeedHolder').show();
		else {
			$('motivSpeedHolder').hide();
			document.getElementById('motiv_speed').value = 0;
		}
	}

	if ($('motivNobleHolder') != null) {
        console.log(type);
		if( inArray(type, nobleMotivation) && this.noblesPresent) {
            $('motivNobleHolder').show();
        } else {
            $('motivNobleHolder').hide();
			document.getElementById('motiv_noble').value = 0;
		}
	}

	if ($('motivSpyHolder') != null) {
		if( inArray(type, spyMotivation) )
			$('motivSpyHolder').show();
		else {
			$('motivSpyHolder').hide();
			document.getElementById('motiv_spy').value = 0;
		}
	}

	if ($('motivSiegeHolder') != null) {
		if( inArray(type, siegeMotivation) && this.siegePresent)
			$('motivSiegeHolder').show();
		else {
			$('motivSiegeHolder').hide();
			document.getElementById('motiv_siege').value = 0;
		}
	}

	if ($('motivCargoHolder') != null) {
		if( inArray(type, cargoMotivation) )
			$('motivCargoHolder').show();
		else {
			$('motivCargoHolder').hide();
			document.getElementById('motiv_cargo').value = 0;
		}
	}

	if ($('motivCleanUpHolder') != null) {
		if( inArray(type, cleanupMotivation)) {
			$('motivCleanUpHolder').show();
		} else {
			$('motivCleanUpHolder').hide();
			document.getElementById('motiv_cleanup').value = 0;
		}
	}
};

Pohod.prototype.setSiegeType = function (siegeType) {
	//console.log(siegeType);
	var siegeTypeFieldId = 'siegeType';
	var triggers_prefix = 'siegeType';
	var siegeTypes = [1,2,3];
	if (typeof siegeType == 'undefined' || siegeTypes.indexOf(siegeType) < 0) {
		$(siegeTypeFieldId).value = 0;
		return false;
	}
	for ( var i=0 ; i<siegeTypes.length ; i++ ) {
		var triggerId = triggers_prefix+siegeTypes[i];
		if (siegeTypes[i] == siegeType) {
			if ($(triggerId).className == 'siegeTypeActive') {
				$(triggerId).className = 'siegeTypeInactive';
				$(siegeTypeFieldId).value = 0;
			} else {
				$(triggerId).className = 'siegeTypeActive';
				$(siegeTypeFieldId).value = siegeType;
			}
		} else {
			$(triggerId).className = 'siegeTypeInactive';
		}
	}
	return false;
};

// Pohod.prototype.sendMarch = function () {
// 	var params = {sendMarch : 1};
// 	var marchInfo = [this.collectMarchData()];
// 	params.jsonData = encodeURI(Object.toJSON(marchInfo));
// 	console.log(params);
// 	console.log(marchInfo);
// 	new Ajax.Request('pohod.php', {
// 		method: 'post',
// 		parameters: params,
// 		onSuccess: function(transport) {
// 			var response = transport.responseText.evalJSON(true);
// 			if(response.error == 1) {
// 				$('errorContainer').show();
// 				$$('#errorContainer .text')[0].update(response.message);
// 			} else {
// 				//window.location = 'pohod.php';
// 				console.log('we will redirect now - 1');
// 			}
// 		}
// 	});
// }

Pohod.prototype.sendMarches = function (forceSend) {
	if(typeof forceSend == 'undefined') {
		forceSend = false;
	}

	var params = {sendMarch : 1};
	var self = this;

	if(this.sendingIsBlocked && !forceSend){
		return false;
	}

	this.sendingIsBlocked = true;

	if(this.marchData.marches.length == 0) {
		var marchInfo = [this.collectMarchData()];
	} else {
		var marchInfo = this.marchData.marches;
	}

	var i;
	for( i in attack_limit) {
		if(attack_limit[i].target == (marchInfo[0].defenderX+':'+marchInfo[0].defenderY) && marchInfo[0].marchType == 3) {
			if(!forceSend) {
				var text = self.langStrings.confirmFood.replace('%1', 7);
				text =  text.replace('%2', attack_limit[i].food);
				kwModal.confirm(text, function() {
					self.sendMarches(true);
				}, function() {
					self.sendingIsBlocked = false;
				});

				return false;
			}
		}
	}

	params.jsonData = encodeURI(Object.toJSON(marchInfo));
	new Ajax.Request('pohod.php', {
		method: 'post',
		parameters: params,
		onSuccess: function(transport) {
			self.sendingIsBlocked = false;
			var response = transport.responseText.evalJSON(true);
			if(response.error == 1) {
				$('errorContainer').show();
				$$('#errorContainer .text')[0].update(response.message);
			} else {
				window.location = 'pohod.php';
			}
		}
	});
};

Pohod.prototype.addTarget = function () {
	this.marchData.marches.push(this.collectMarchData());
	//this.marchData.currentMarch = this.marchData.currentMarch + 1;
};

Pohod.prototype.removeTarget = function (arrayKey) {
	this.marchData.marches.splice(arrayKey, this.marchData.marches.length);
};

Pohod.prototype.updateTarget = function (arrayKey) {
	this.marchData.marches[arrayKey] = this.collectMarchData();
};


Pohod.prototype.assignUnitsHandlers = function () {
	var i, self = this;
	for(i = 0; i < this.unitData.length; i++){

		if($('pohodUnitCount_' + this.unitData[i].unit_id)){
			$('pohodUnitCount_' + this.unitData[i].unit_id).observe('blur', function(){
				self.getMarchInfo();
				self.validateUnits();
			});
		}

		if($('set_max_' + this.unitData[i].unit_id)){
			$('set_max_' + this.unitData[i].unit_id).observe('click', function(id, count){
				return function(){
					$('pohodUnitCount_' + id).value = count;
					self.getMarchInfo();
					self.validateUnits();
				};
			}(this.unitData[i].unit_id, this.unitData[i].count));

		}
		if($('set_min_' + this.unitData[i].unit_id)){
			$('set_min_' + this.unitData[i].unit_id).observe('click', function(id, count){
				return function(){
					$('pohodUnitCount_' + id).value = 0;
					self.getMarchInfo();
					self.validateUnits();
				};

			}(this.unitData[i].unit_id, this.unitData[i].count));
		}
	}
};



Pohod.prototype.getRequiredUnits = function () {
	var params = {getRequiredUnits : 1};
	var self = this;

	if(this.marchData.marches.length == 0) {
		var marchInfo = [this.collectMarchData()];
	} else {
		var marchInfo = this.marchData.marches
	}

	params.jsonData = encodeURI(Object.toJSON(marchInfo));
	new Ajax.Request('pohod.php', {
		method: 'post',
		parameters: params,
		onSuccess: function(transport) {
			var response = transport.responseText.evalJSON(true);
			var i;
			for(i in response.units){
				if(!response.units.hasOwnProperty(i)){
					continue;
				}
				if($('pohodUnitCount_' + i)){
					if($('pohodUnitCount_' + i).value == 0){
						$('pohodUnitCount_' + i).value = response.units[i];
					}
				}
			}
			self.getMarchInfo();
			self.validateUnits();
		}
	});
};


Pohod.prototype.abandonMine = function (mineId) {

	var params = {
		action : 'abandonMine',
		mine_id : mineId
	};
	new Ajax.Request('ajax_mines.php', {
		method: 'get',
		parameters: params,
		onSuccess: function(transport) {
			var response = transport.responseText.evalJSON(true);
			if(response.status == 0){
				kwModal.error(response.message);
			} else {
				window.location.href = 'overview.php';
			}


		}
	});
};

Pohod.prototype.showMarchDecription = function (id){
	var arrLi = $$('.marchInfoRetro ul > li');
	arrLi.each(function(node){
			$(node).addClassName('hidden');
	});
	$("marchInfoRetro_" + id).removeClassName('hidden');
}