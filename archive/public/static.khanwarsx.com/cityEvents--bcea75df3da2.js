'use strict';

function CityEvents() {
	var self = this;
	this.isOpen = false;
	this.data = {};
	this.activeAttend = false;
	this.eventsModal = new kwModal({
		'placeholder': 'cityEventsContainer',
		'width': 820
	});
	
	this.loadDataHandlers = {
		'3': function(data, eventId, id) {self.handlerUnitsForResources(data, eventId, id);},
		'4': function(data, eventId, id) {self.handlerUnitsForResources(data, eventId, id);},
		'5': function(data, eventId, id) {self.handlerResourceExchange(data, eventId, id);},
		'6': function(data, eventId, id) {self.handlerResourceExchange(data, eventId, id);},
		'7': function(data, eventId, id) {self.handlerRiddles(data, eventId, id);},
		'8': function(data, eventId, id) {self.handlerRiddles(data, eventId, id);},
		'11': function(data, eventId, id) {self.handlerGiftUnits(data, eventId, id);},
		'12': function(data, eventId, id) {self.handlerGiftUnits(data, eventId, id);},
		'19': function(data, eventId, id) {self.handlerItemsForCoins(data, eventId, id);},
		'20': function(data, eventId, id) {self.handlerItemsForCoins(data, eventId, id);},	
		'21': function(data, eventId, id) {self.handlerCoinsPromo(data, eventId, id);},
		'22': function(data, eventId, id) {self.handlerCoinsPromo(data, eventId, id);}
	};
	
}


CityEvents.prototype.sendData = function(data, callback) {
	if (typeof data !== 'object') {
		data = {};
	}
	new Ajax.Request('ajax_cityEvents.php', {
		method: 'post',
		parameters: data,
		onSuccess: function(transport) {
			var response = transport.responseText.evalJSON(true);
			if (typeof callback === 'function') {
				callback(response);
			}
		}});
};


CityEvents.prototype.loadActiveEvents = function(){
	var self = this;
	$('cityEventsSlot_1').hide();
	$('cityEventsSlot_2').hide();
	$('cityEventsSlot_3').hide();
	this.sendData({type : 'getActive'}, function(response){
		var i, slot, eventId, id;
		for(i in response.data){
			if(!response.data.hasOwnProperty(i)){
				continue;
			}
			eventId = response.data[i].event_id;
			id = response.data[i].id;
			slot = $('cityEventsSlot_' + response.data[i].slot_id);

			if(!slot){
				continue;
			}
			slot.show();
			slot.stopObserving().observe('click', (function(eventId, id){
				return function(){
					self.loadContent(eventId, id);
				};	
			}(eventId, id)));
		}
	});
};


CityEvents.prototype.loadContent = function(eventId, id) {
	var self = this;
	this.open();
	this.sendData({type: 'load', event_id: eventId, id: id}, function(response) {
		if (response.success == 1) {
			//$('cityEventsContainer').innerHTML = response.body;
			self.eventsModal.updateContent(response.body);
			self.handleEventData(response.data, eventId, id);
		}
	});

};



CityEvents.prototype.handleEventData = function(data, eventId, id) {
	var self = this;
	var btn = $('attendBtn');

	if (btn) {
		btn.stopObserving().observe('click', function() { 
			self.attendEvent(eventId, id);
		});
	}
	if (data.time_left) {
		Timers.add('overview.php', data.time_left, 'cityEventsTimerContainer');
	}

	if (typeof self.loadDataHandlers[eventId] === 'function') {
		self.loadDataHandlers[eventId](data, eventId, id);
	}
};



CityEvents.prototype.open = function() {
	this.eventsModal.show();
	return;
//	var self = this;
//	var documentDimensions = document.viewport.getDimensions();
//	var frameDimensions = $('cityEventsContainer').getDimensions();
//
//	var top = Math.round(documentDimensions.height * 0.1) + frameDimensions.height;
//	var left = Math.round(documentDimensions.width / 2);
//
//	if ($('cityEventsContainer').visible()) {
//		return false;
//	}
//
//	$('cityEventsContainer').setStyle({display: 'block', top: (0 - frameDimensions.height) + 'px', left: left + 'px', position : 'absolute'});
//	new Effect.Move('cityEventsContainer', {
//		x: '0', y: top, mode: 'relative',
//		transition: Effect.Transitions.spring,
//		afterFinish: function() {
//			//in case something goes wrong
//			$('cityEventsContainer').setStyle({top: '10%', left: '50%', display : 'block'});
//		}
//	});
//	showOverlay();
};


CityEvents.prototype.close = function(removeOverlay) {
	this.eventsModal.hide();
	return;
//	var self = this;
//	var documentDimensions = document.viewport.getDimensions();
//	var top = Math.round(documentDimensions.height * 0.1);
//	var left = Math.round(documentDimensions.width / 2);
//	$('cityEventsContainer').setStyle({left: left + 'px', top: top});
//
//	new Effect.Move('cityEventsContainer', {
//		x: '0', y: (0 - (top + $('cityEventsContainer').getHeight())), mode: 'relative',
//		transition: Effect.Transitions.linear,
//		duration: 0.3,
//		afterFinish: function() {
//			//in case something goes wrong
//			$('cityEventsContainer').setStyle({display: 'none'});
//		}
//	});
//
//	if (typeof(removeOverlay) == 'undefined' || removeOverlay == null) {
//		removeOverlay = true;
//	}
//
//	if (removeOverlay) {
//		hideOverlay();
//	}
};


CityEvents.prototype.attendEvent = function(eventId, id, params){
	var self = this;
	

	params = params || {};
	params.type = 'attend';
	params.event_id = eventId;
	params.id = id;
	if (self.activeAttend != true) {
		self.activeAttend = true;
		this.sendData(params, function(response) {
			self.handleAttendResponse(response, eventId, id, params);
		});
	}
};



CityEvents.prototype.handleAttendResponse = function(response, eventId, id, params) {
	var self = this;
	self.activeAttend = false;
	if (response.success == 1) {
		//kwDialog('cityEventsMessage', response.message, true, null, null, null, null, null, null, false);
		
		var handleDisplayData = function () {
			if (response.reload == 1){
				self.loadContent(eventId, id);
			} else {
				self.close(false);
			}
		} 
		
		var modalObj = self.createResultModalObj();
		modalObj.updateContent(response.message)
				.addButton(kwModal.langStrings.OK, (
							function() {
								this.hide();
								handleDisplayData();
							})
				.bind(modalObj)).show();
		
		refreshSession();
		self.loadActiveEvents();
	} else {
		if(response.error_code == 0){
			// ne mahame overlay
//			kwDialog('error', response.message, true, null, function(){
//				self.close(false);
//				self.loadActiveEvents();
//			}, null, null, null, null, false);
			kwModal.error(response.message, function(){
				self.close(false);
				self.loadActiveEvents();
			});
			
		} else if(response.error_code == 1) {
			
//			kwDialog('error', response.message, true, true, function(){
//				params.confirmed = 1;
//				self.attendEvent(eventId, id, params);
//			}, null, null, null, null, false, false);
			
			kwModal.confirmNegative(response.message, function(){
				params.confirmed = 1;
				self.attendEvent(eventId, id, params);
			});
		}	
	}
	
};
CityEvents.prototype.handlerRiddles = function(data, eventId, id) {
	var i;
	var self = this;
	for (i = 1; i <= 4; i++) {
		$('cityEventsRiddleAnswer_' + i).stopObserving().observe('click', function(i) {
			return function() {
				self.attendEvent(eventId, id, {answer : i});
			};
		}(i));
	}
};

CityEvents.prototype.handlerResourceExchange = function(data, eventId, id){
	var self = this;
	var fromType = $('cityEventsResourcesFromType');
	var fromValue = $('cityEventsResourcesFromValue');
	var toType = $('cityEventsResourcesToType');
	var toValue = $('cityEventsResourcesToValue');
	var resTypesIndex = {
		'gold': 0,
		'iron': 1,
		'wood': 2,
		'food': 3
	};
	
	fromType.stopObserving().observe('change', function(){
		var value = parseInt(fromValue.getValue(), 10);
		var type = fromType.getValue();
		var resource = parseInt(data.resources[type], 10);
		if(value > resource){
			fromValue.setValue(resource);
			toValue.setValue(resource);
		} 
	});
	
	fromValue.stopObserving().observe('keyup', function(){
		var value = parseInt(fromValue.getValue(), 10);
		var type = fromType.getValue();
		var resource = parseInt(data.resources[type], 10);
		if(value > resource){
			fromValue.setValue(resource);
			toValue.setValue(resource);
		} else {
			toValue.setValue(value);
		}
	});
	
	fromType.observe('change', function(){
		var fromTypeValue = fromType.getValue();
		var toTypeValue = toType.getValue();
		
		//get select box option index
		var optionIndex = resTypesIndex[fromType.getValue()];
		
		for (var i = 0; i < toType.options.length; i++) {
			if (i == optionIndex){
				toType.options[i].disabled = true;
			} else {
				toType.options[i].removeAttribute('disabled');
			}
		}
	});
	
	toType.observe('change', function(){
		var fromTypeValue = fromType.getValue();
		var toTypeValue = toType.getValue();
		
		//get select box option index
		var optionIndex = resTypesIndex[toType.getValue()];
		
		for (var i = 0; i < fromType.options.length; i++) {
			if (i == optionIndex){
				fromType.options[i].disabled = true;
			} else {
				fromType.options[i].removeAttribute('disabled');
			}
		}
	});
	
	var toOptionIndex = resTypesIndex[toType.getValue()];
	var fromOptionIndex = resTypesIndex[fromType.getValue()];
	
	if (typeof fromOptionIndex != undefined && typeof toOptionIndex != undefined) {
		for (var i = 0; i < fromType.options.length; i++) {
			if (i == toOptionIndex){
				fromType.options[i].disabled = true;
			} else {
				fromType.options[i].removeAttribute('disabled');
			}
		}
		for (var i = 0; i < toType.options.length; i++) {
			if (i == fromOptionIndex){
				toType.options[i].disabled = true;
			} else {
				toType.options[i].removeAttribute('disabled');
			}
		}
	}

	$('cityEventsResourceExchangeAttendBtn').stopObserving().observe('click', function(){
		var fromValueValue = parseInt(fromValue.getValue(), 10);
		var toValueValue = parseInt(toValue.getValue(), 10);
		var fromTypeValue = fromType.getValue();
		var toTypeValue = toType.getValue();
		
		if(isNaN(fromValueValue) || fromValueValue === 0){
			return;
		}

		var params = {
			resource_from_type : fromTypeValue, 
			resource_to_type : toTypeValue,
			resource_from_value : fromValueValue,
			resource_to_value : toValueValue
		};
		
		self.attendEvent(eventId, id, params);
	});
	
	
};


CityEvents.prototype.handlerCoinsPromo = function(data, eventId, id){
	var paymentsBtn = $('cityEventsOpenPayments');
	if(paymentsBtn){
		var self = this;
		paymentsBtn.stopObserving().observe('click', function(){
			if (data.paymentURL == '') {
				paymentsOpen();
			} else {
				window.open(data.paymentURL,'_blank');
				self.close();
			}
		});
	}
	
};


CityEvents.prototype.handlerItemsForCoins = function(data, eventId, id) {
	var obj = this;
	var params = {option : "0"};
	var btnBuy = $('attendBtn');
	var singleItem = $$('.buySingleItem');
	var packItems = $$('.buyPackItems');
	
	btnBuy.stopObserving().observe('click', function() {
		if (params.option == 0) {
			return false;
		}
		obj.attendEvent(eventId, id, params);
		$('buySingleItem').removeClassName('selectedOption');
		$('buyPackItems').removeClassName('selectedOption');
		//btnBuy.disable();
	});
	
	singleItem.each(function(element) {
		element.stopObserving().observe('click', function() {
			params.option = 1;
			$('buySingleItem').addClassName('selectedOption');
			$('buyPackItems').removeClassName('selectedOption');
			$('attendBtn').removeClassName('inactive');
		});
	});
	
	packItems.each(function(element) {
		element.stopObserving().observe('click', function() {
			params.option = 2;
			$('buySingleItem').removeClassName('selectedOption');
			$('buyPackItems').addClassName('selectedOption');
			$('attendBtn').removeClassName('inactive');
		});
	});
};

CityEvents.prototype.createResultModalObj = function() {
	return new kwModal({
			'placeholder': 'cityEventsModal',
			'placeholderClass': 'newPopup3 cityEventsResponse',
			'contentClass': 'message cityEventsMessage',
			'width': 650
		});
}