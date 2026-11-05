'use strict';

function mapMenu() {
	this.isOpen = false;
	this.x = 0;
	this.y = 0;
	this.attackerObjectType = false;
	this.defenderbjectType = false;

	this.marchesPopupModifier = false;

	this.container = $('radialMenuContainer');
	if(!this.container){
		this.container = document.createElement('div');
		this.container.id = 'radialMenuContainer';
		this.container.setStyle({margin : 0,display:"none"});
		$$('body')[0].insert(this.container);
	}
	
	
	this.callbacks = {
		onOpen : [],
		onClose : [],
		onContent : []
	};
}


mapMenu.prototype.loadContent = function(x, y, isProvince) {
	if (isProvince == undefined){
		isProvince = false;
	}
	var data = {x: x, y: y, type: 'loadContent', isProvince: isProvince};
	var self = this;
	this.sendData(data, function(response) {
		if(response.success == 1){
			$('radialMenuContainer').innerHTML = response.body;
			self.show();
			self.handleData(response.data);
			self.executeCallbacks('onContent', response.data);
		}


	});

};


mapMenu.prototype.sendData = function(data, callback, url) {
	url = url || 'ajax_mapMenu.php';
	if (typeof data !== 'object') {
		data = {};
	}

	new Ajax.Request(url, {
		method: 'post',
		parameters: data,
		onSuccess: function(transport) {
			var response = transport.responseText.evalJSON(true);
			if (typeof callback === 'function') {
				callback(response);
			}
		}});
};


mapMenu.prototype.show = function() {
	this.container.show();
	this.isOpen = true;
	this.executeCallbacks('onOpen');
};

mapMenu.prototype.hide = function() {
	this.container.hide();
	this.isOpen = false;
	this.executeCallbacks('onClose');
};


mapMenu.prototype.handleData = function(data) {
	var self = this, offset, documentOffset;

	if(data.tutorial_mode){
		removeTutorialPointers();
		tutorialPointer($('radialMenuMarchBtn'),'left');
	}

	$('radialMenuMarchBtn').stopObserving().observe('click', function() {
		var popup = new MarchPopup();
		popup.getCurrentMarch().setAttackerCoords(data.attackerX, data.attackerY);
		popup.getCurrentMarch().setDefenderCoords(data.defenderX, data.defenderY);
		popup.getCurrentMarch().setStep(2);

		if(typeof self.marchesPopupModifier === 'function'){
			self.marchesPopupModifier(popup);
		}


		popup.registerCallback('onPopupOpen', function(data){
			self.hide();
		});
		popup.registerCallback('onMarchSent', function(data){
			self.hide();
		});

		popup.loadContent();
	});

	$('radialMenuListBtn').stopObserving().observe('click', function() {
		var savedCoords = new SavedCoords();
		savedCoords.openAddMenu(data.defenderX, data.defenderY, function() {
			self.hide();
		});
	});

	if (data.darkPortalMode) {
		$$('.pos1').each(function(elem) {
			elem.setAttribute('href', 'javascript:void(0)');
			elem.stopObserving();
		});
		$$('.pos3').each(function(elem) {
			elem.setAttribute('href', 'javascript:void(0)');
			elem.stopObserving();
		});
		$$('.pos4').each(function(elem) {
			elem.setAttribute('href', 'javascript:void(0)');
			elem.stopObserving();
		});
		$$('.pos5').each(function(elem) {
			elem.setAttribute('href', 'javascript:void(0)');
			elem.stopObserving();
		});
		$$('.pos6').each(function(elem) {
			elem.setAttribute('href', 'javascript:void(0)');
			elem.stopObserving();
		});
	}
};


mapMenu.prototype.getIsOpen = function() {
	return this.isOpen;
};


mapMenu.prototype.setCoords = function(x, y) {
	this.x = parseInt(x, 10);
	this.y = parseInt(y, 10);
};


mapMenu.prototype.positionMenu = function(sizeX, sizeY) {
	var x = this.x == 1 ? 2 : this.x;
	var y = this.y == 1 ? 2 : this.y;
	var wraperOffset = Element.viewportOffset($('mapContainer'));
	var contentOffset = Element.viewportOffset($('boxMapId'));
	var wrapperX = Math.ceil(x * sizeX) - sizeX / 2;
	var wrapperY = Math.ceil(y * sizeY) - sizeY / 2;

	var coordScreenCenterX = wrapperX + wraperOffset.left;
	var coordScreenCenterY = wrapperY + wraperOffset.top;

	coordScreenCenterX = Math.round(coordScreenCenterX);
	coordScreenCenterY = Math.round(coordScreenCenterY);

	coordScreenCenterX -= contentOffset.left;
	coordScreenCenterY -= contentOffset.top;

	$('radialMenuContainer').setStyle({
		left: coordScreenCenterX + 'px',
		top: coordScreenCenterY + 'px'
	});

};



mapMenu.prototype.positionOverElement = function(element) {
	var position = getElementAbsolutePosition(element);
	var containerDimensions = this.container.getDimensions();
	var elementDimansions = element.getDimensions();
	var x, y;

	x = Math.round(position.x - containerDimensions.width / 2 + elementDimansions.width / 2);
	y = Math.round(position.y - containerDimensions.height / 2 + elementDimansions.height / 2);

	$('radialMenuContainer').setStyle({
		left: x + 'px',
		top: y + 'px'
	});
};


mapMenu.prototype.disableElementOnPosition = function(pos){
	var element = $$('a.pos' + pos)[0];
	element.href = 'javascript:void(0)';
	element.addClassName('inactive');
	element.stopObserving('click');
};


mapMenu.prototype.setMarchesPopupModifier = function(func){
	this.marchesPopupModifier = func;
};


mapMenu.prototype.registerCallback = function(type, callback){
	if(typeof callback === 'function'){
		this.callbacks[type].push(callback);
	}
};


mapMenu.prototype.executeCallbacks = function(type, data){
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