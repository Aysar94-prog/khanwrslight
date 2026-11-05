'use strict';

function ArmyOrder(config) {
	this.config = config || {};
	this.config.formationId = this.config.formationId || '';
	this.config.popLimitUnitType = this.config.popLimitUnitType || [];
	this.calcPopLimitUnitType = typeof(this.config.calcPopLimitUnitType)==='function' ? this.config.calcPopLimitUnitType : function() { return true; };
	this.config.bannedUnits = this.config.bannedUnits || [];


	this.currentUnitId = 0;

	this.cellWidth = 74;
	this.cellHeight = 115;

	this.columnMin = 1;
	this.columnMax = 8;
	this.lineMin = 1;
	this.lineMax = 4;

	// units positions - global vars for dragNdrop and arrows
	this.start_x = 0;
	this.start_y = 0;
	this.current_x = 0;
	this.current_y = 0;

	// global vars for timers
	this.timerRequestType = ''; //'increase' or 'decrease' action specified units count
	this.timerCurrentCount = 0; //specified units count
	this.timerUnitId = 0; //specified units id
	this.timerUnitPop = 0; //specified unit population
	this.timerId = 0; //timeout function id
	this.timerCounter = 1; //help variable for counting

	this.maxPopulation = 0; //max population(from constant)
	this.msgTotalPopReached = '';

	// units counting HTML elements
	this.countFormfield = null;
	this.countIndicator = null;
	this.totalPopIndicator = null;
}

/**
 * Loads page content
 * If armyId is given will load specified order
 * If not will load default order
 */
ArmyOrder.prototype.loadContent = function(armyId){
	var data = {
		type: 'loadContent',
		army_id: armyId
	};
	//scope solution
	var self = this;

	this.sendData(data, function(response) {
		self.loadContentCallback(response);
	});
};

ArmyOrder.prototype.initDimensions = function() {
	this.parent_dimensions = Element.getDimensions($('army-order' + this.config.formationId));

	this.max_x = this.parent_dimensions.width - this.cellWidth;
	this.max_y = this.parent_dimensions.height - this.cellHeight;
};

ArmyOrder.prototype.sendData = function(data, callback, url) {
	url = url || 'ajax_army_order.php';
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

ArmyOrder.prototype.chooseFormation = function(armyId) {
	if(typeof armyId == 'undefined' && !isNaN(parseInt(armyId))) {
		return false;
	}

	var self = this;
	var data = {
		type: 'chooseFormation',
		army_id: armyId
	};

	this.sendData(data, function(response) {
		self.loadContentCallback(response);
	});
};

/**
 * Load json response data into the page;
 * Init handlers and page variables;
 */
ArmyOrder.prototype.loadContentCallback = function(response) {
	if(response.status === 0) {
		if (response.body && response.body !== '') {
			$('armyOrderMsgText').innerHTML = response.body;
			$('armyOrderMsg').setStyle({'display': 'block'});
		} else {
			$('armyOrderMsg').setStyle({'display': 'none'});
		}
	} else {
		var self = this;
		if ($('armyOrderPageContent')) {
			$('armyOrderPageContent').innerHTML = response.body;
		}

		self.totalPop = response.data.units_pop;
		self.jsonUnits = response.data.json_units;
		self.maxPopulation = response.data.max_pop;
		self.msgPopLimitReached = response.data.msg_total_pop_reached;
		self.msgConfirmDel = response.data.msg_confirm_delete;
		self.msgEmptyOrderName = response.data.msg_empty_order_name;
		self.msgNoUnitSelected = response.data.msg_no_unit_selected;
		self.armies = response.data.armies;
		self.unitsTooltips = response.data.units_tooltips;

		if (response.data.response_msg && response.data.response_msg !== '') {
			if ($('armyOrderMsgText')) {
				$('armyOrderMsgText').innerHTML = response.data.response_msg;
			}
		} else {
			if ($('armyOrderMsg')) {
				$('armyOrderMsg').setStyle({'display': 'none'});
			}
		}
		self.initDimensions();
		self.initDragable();
		self.assignHandlers();
		self.selectFirstUnit();

		$$('.draggable').each(function(element) {
			element.observe("touchstart", self.initTouchControls);
			element.observe("touchmove", self.initTouchControls);
			element.observe("touchend", self.initTouchControls);
			element.observe("touchcancel", self.initTouchControls);
		});
	}

	if ($('armyOrderPageContent')) {
		Effect.ScrollTo($('armyOrderPageContent'));
	}
};

/**
 * Gets all form field parameters and calls a function
 * @params boolean isNewFormation
 */
ArmyOrder.prototype.requestSave = function(isNewFormation, formationId) {
	var self = this;
	if(isNewFormation === true && $('army_save').value === '') {
		kwModal.error(self.msgEmptyOrderName);
		return;
	}

	//init default params
	//var unitPosArray = [];
	var data = {
		unitsPos: {},
		unitsCount: {},
		armyName: '',
		type: '',
		formationId: 0
	};
	if(isNewFormation) {
		data.type = 'addNewFormation';
		data.armyName = $('army_save').value;
	} else {
		data.type = 'editFormation';
		data.formationId = formationId;
	}
	for ( var unitId in this.jsonUnits ) {
		data.unitsPos[unitId] = $('upos' + this.config.formationId + '_' + unitId).value;
		data.unitsCount[unitId] = $('ucount' + this.config.formationId + '_' + unitId).value;
	}
	//convert object to JSON strings
	data.unitsPos = Object.toJSON(data.unitsPos);
	data.unitsCount = Object.toJSON(data.unitsCount);

	this.sendData(data, function(response) {
		self.loadContentCallback(response);
	});
};

ArmyOrder.prototype.deleteFormation = function(formationId) {
	var self = this;
	kwModal.confirm(self.msgConfirmDel, function() {
		var data = {
			type: 'deleteFormation',
			formationId: formationId
		};

		self.sendData(data, function(response) {
			self.loadContentCallback(response);
		});
	});
};

ArmyOrder.prototype.initDragable = function() {
	var self = this;
	for ( var json_unit in this.jsonUnits ) {
		new Draggable( $('div_units' + this.config.formationId + '_' + json_unit),
			{
				onStart : function(obj,event) {
					self.selectUnits( obj.handle.id, obj.handle.id.substring(obj.handle.id.lastIndexOf('_')+1) );
				},
				onEnd : function() {
					var column = Math.round(self.current_x / self.cellWidth) + 1;
					var line   = Math.round(self.current_y / self.cellHeight) + 1;
					if (column < self.columnMin) column = self.columnMin;
					if (column > self.columnMax) column = self.columnMax;
					if (line < self.lineMin) line = self.lineMin;
					if (line > self.lineMax) line = self.lineMax;
					self.moveUnits_setClasses_positionConcurrentUnit(column,line);
				},
				snap : function(x,y) {
					if ( self.start_x === 0 && self.start_y === 0 ) {
						self.start_x = x;
						self.start_y = y;
					}

					self.current_x = x;
					self.current_y = y;

					function constrain(n, lower, upper, dir) {
						var m = 0, moveSnap = 0;
						if (dir=='x'){
							moveSnap = Math.round(n/self.cellWidth);
							m = moveSnap * self.cellWidth;
						} else if(dir=='y') {
							moveSnap = Math.round(n/self.cellHeight);
							m = moveSnap * self.cellHeight;
						}

						if (m > upper) {
							return upper;
						} else if (m < lower) {
							return lower;
						} else {
							return m;
						}
					}

					return[
						constrain(x, 0, self.max_x ,'x'),
						constrain(y, 0, self.max_y, 'y')
					];
				}
			}
		);
	}
};

ArmyOrder.prototype.initTouchControls = function() {
	// For mobile browsers
	var touchFlag = false;
	//var eventsInit = false;

	var simulatedEvent;
	var touches = event.changedTouches,
		first = touches[0],
		type = "";

	if(event.touches.length >= 2) {
		return true;
	}

	switch(event.type)
	{
		case "touchstart":  type="mousedown"; break;
		case "touchmove":	type="mousemove"; break;
		case "touchcancel": type="mouseup"; break;
		case "touchend": 	type="mouseup"; break;
		default: return;
	}
	if (event.type == "touchstart" && !touchFlag) {
		touchFlag = true;
		setTimeout(function(){ touchFlag = false; }, 300);
	}
	if((event.type == "touchcancel" || event.type == "touchend") && touchFlag) {
		//type = "click";
		simulatedEvent = document.createEvent("MouseEvent");
		simulatedEvent.initMouseEvent('click', true, true, window, 1,
									first.screenX, first.screenY,
									first.clientX, first.clientY, false,
									false, false, false, 0/*left*/, null);

		first.target.dispatchEvent(simulatedEvent);
		event.preventDefault();
	}

	simulatedEvent = document.createEvent("MouseEvent");
	simulatedEvent.initMouseEvent(type, true, true, window, 1,
								first.screenX, first.screenY,
								first.clientX, first.clientY, false,
								false, false, false, 0/*left*/, null);

	first.target.dispatchEvent(simulatedEvent);
	event.preventDefault();
};

ArmyOrder.prototype.assignHandlers = function() {
	var self = this;
	for ( var unitId in this.jsonUnits ) {
		if (inArrayOpts(unitId, this.config.bannedUnits, false)) {
			continue;
		}

		if($('link_units' + this.config.formationId + '_' + unitId)) {
			$('link_units' + this.config.formationId + '_' + unitId).observe('mousedown', function(unitId){
				return function() {
					var elementId = 'div_units' + self.config.formationId + '_' + unitId;
					self.selectUnits(elementId, unitId);
				};
			}(unitId));
		}
		//for mobile
		if($('mobile_link_units' + this.config.formationId + '_' + unitId)) {
			$('mobile_link_units' + this.config.formationId + '_' + unitId).observe('mousedown', function(unitId) {
				return function(){
					var elementId = 'div_units' + self.config.formationId + '_' + unitId;
					self.selectUnits(elementId, unitId);
					self.showUnitInfo(unitId);
				};
			}(unitId));
		}
		//end of mobile

		if($('increase_units' + this.config.formationId + '_' + unitId)) {
			$('increase_units' + this.config.formationId + '_' + unitId).observe('mousedown', function(unitId){
				return function() {
					var unitsCount = parseInt($('num_units' + self.config.formationId + '_' + unitId).innerHTML);
					self.startCount('increase', unitId, unitsCount);
				};
			}(unitId));
			$('increase_units' + this.config.formationId + '_' + unitId).observe('mouseup', function(){
				self.stopCount();
			});
			$('increase_units' + this.config.formationId + '_' + unitId).observe('mouseout', function(){
				self.stopCount();
			});
		}

		if($('decrease_units' + this.config.formationId + '_' + unitId)) {
			$('decrease_units' + this.config.formationId + '_' + unitId).observe('mousedown', function(unitId){
				return function() {
					var unitsCount = parseInt($('num_units' + self.config.formationId + '_' + unitId).innerHTML);
					self.startCount('decrease', unitId, unitsCount);
				};
			}(unitId));
			$('decrease_units' + this.config.formationId + '_' + unitId).observe('mouseup', function(){
				self.stopCount();
			});
			$('decrease_units' + this.config.formationId + '_' + unitId).observe('mouseout', function(){
				self.stopCount();
			});
		}
	}

	//check if armies array is not empty object
	if (Object.inspect(this.armies) != "[]") {
		for( var armyId in this.armies ) {
			$('link_load_formation_' + armyId).observe('click', function(armyId){
				return function(){
					self.loadContent(armyId);
				};
			}(armyId));

			$('link_delete_formation_' + armyId).observe('click', function(armyId){
				return function(){
					self.deleteFormation(armyId);
				};
			}(armyId));

			if(this.armies[armyId].is_default != 1) {
				$('link_choose_formation_' + armyId).observe('click', function(armyId){
					return function(){
						self.chooseFormation(armyId);
					};
				}(armyId));
			}
		}
	}

	if ($('army_save')) {
		$('army_save').observe('keyup', function(){
			if ($('army_save').value !== ''){
				$('save_new_formation').removeClassName('inactive');
			}
		 	if ($('army_save').value === ''){
				$('save_new_formation').addClassName('inactive');
		 	}
		});
	}

	if ($('save_new_formation')) {
		$('save_new_formation').observe('click', function(){
			self.requestSave(true);
		});

		if ($('edit_formation')) {
			$('edit_formation').observe('click', function(){
				var formation_id = $('army_orders').value;
				self.requestSave(false, formation_id);
			});
		}
	}

	//for mobile
	if ($('mobile_increase_units')) {
		$('mobile_increase_units').observe('mousedown', function(){
			var currCount = parseInt($('num_units' + self.config.formationId + '_' + self.currentUnitId).innerHTML, 10);
			self.startCount('increase', self.currentUnitId, currCount);
		});
		$('mobile_increase_units').observe('mouseup', function(){
			self.stopCount();
		});
		$('mobile_increase_units').observe('mouseout', function(){
			self.stopCount();
		});
	}

	if ($('mobile_decrease_units')) {
		$('mobile_decrease_units').observe('mousedown', function(){
			var currCount = parseInt($('num_units' + self.config.formationId + '_' + self.currentUnitId).innerHTML, 10);
			self.startCount('decrease', self.currentUnitId, currCount);
		});
		$('mobile_decrease_units').observe('mouseup', function(){
			self.stopCount();
		});
		$('mobile_decrease_units').observe('mouseout', function(){
			self.stopCount();
		});
	}

	if ($('up') && $('right') && $('down') && $('left')) {
		$('up').observe('mousedown', function(){
			self.moveUnits_positionCurrentUnit('up');
		});
		$('right').observe('mousedown', function(){
			self.moveUnits_positionCurrentUnit('right');
		});
		$('down').observe('mousedown', function(){
			self.moveUnits_positionCurrentUnit('down');
		});
		$('left').observe('mousedown', function(){
			self.moveUnits_positionCurrentUnit('left');
		});
	}
 	//end of mobile
};

ArmyOrder.prototype.selectFirstUnit = function() {
	var units_keys = Object.keys(this.jsonUnits);

	if (units_keys.length > 0) {
		var first_unit_id = parseInt(units_keys[0]);
		this.selectUnits('div_units' + this.config.formationId + '_' + first_unit_id, first_unit_id);
		this.showUnitInfo(first_unit_id);
	}
};

ArmyOrder.prototype.selectUnits = function(divId, unitsId){
    this.currentUnitId = unitsId;
    $$('div.selected').each(function(obj) {
    	obj.removeClassName('selected');
    });
    $(divId).addClassName('selected');

    this.start_x = $(divId).getStyle('left').replace('px','');
    this.start_y = $(divId).getStyle('top').replace('px','');

    return;
};

ArmyOrder.prototype.moveUnits_positionCurrentUnit = function(direction){

    if (0 === this.currentUnitId) {
    	kwModal.error(this.msgNoUnitSelected);
	    return;
    }

    var currentUnitDiv = $('div_units' + this.config.formationId + '_' + this.currentUnitId);

    this.start_x = currentUnitDiv.getStyle('left').replace('px','');
    this.start_y = currentUnitDiv.getStyle('top').replace('px','');

    var column = Math.round(this.start_x/this.cellWidth) + 1;
    var line   = Math.round(this.start_y/this.cellHeight) + 1;
    var pixels;

    switch (direction) {
	    case 'left':
		    if (column > 1) {
		    	column--;
				pixels = (column-1)*this.cellWidth;
				currentUnitDiv.setStyle({'left' : pixels+'px'});
			}
		    break;
	    case 'right':
		    if (column < 8) {
		    	column++;
				pixels = (column-1)*this.cellWidth;
				currentUnitDiv.setStyle({'left' : pixels+'px'});
			}
		    break;
	    case 'up':
		    if (line > 1){
		    	line--;
				pixels = (line-1)*this.cellHeight;
				currentUnitDiv.setStyle({'top' : pixels+'px'});
			}
		    break;
	    case 'down':
		    if (line < 4) {
		    	line++;
				pixels = (line-1)*this.cellHeight;
				currentUnitDiv.setStyle({'top' : pixels+'px'});
			}
		    break;
    }

    this.moveUnits_setClasses_positionConcurrentUnit(column,line);
};

ArmyOrder.prototype.moveUnits_setClasses_positionConcurrentUnit = function(column,line) {

    if (0 === this.currentUnitId) {
    	kwModal.error(this.msgNoUnitSelected);
	    return;
    }

    var posArr = $('upos' + this.config.formationId + '_' + this.currentUnitId).value.split('_');
    var oldColumn = posArr[0];
    var oldLine   = posArr[1];

    $('div_units' + this.config.formationId + '_' + this.currentUnitId).removeClassName('x' + oldColumn + 'y' + oldLine);

    var newPosDivs = $$('div.x' + column + 'y' + line);

	var divIndex = -1;
	for (var i = 0; i < newPosDivs.length; i++) {
		if (newPosDivs[i].id.split('_')[1] === 'units' + this.config.formationId) {
			divIndex = i;
			break;
		}
	}

    if (newPosDivs.length > 0 && divIndex >= 0)
    {
    	//aoDebugLog('exists');
    	var newPosDiv = newPosDivs[divIndex];
    	var newPosDivUnitId = newPosDiv.id.split('_')[2];

    	//aoDebugLog('newPosDivUnitId: '+newPosDivUnitId);

		newPosDiv.setStyle({'left': this.start_x+'px'});
		newPosDiv.setStyle({'top' : this.start_y+'px'});

		newPosDiv.removeClassName('x' + column + 'y' + line);
		newPosDiv.addClassName('x' + oldColumn + 'y' + oldLine);
		$('upos' + this.config.formationId + '_' + newPosDivUnitId).value = oldColumn + '_' + oldLine;
	}

    $('upos' + this.config.formationId + '_' + this.currentUnitId).value = column + '_' + line;
	$('div_units' + this.config.formationId + '_' + this.currentUnitId).addClassName('x' + column + 'y' + line);

	this.start_x = 0;
	this.start_y = 0;
};

ArmyOrder.prototype.startCount = function(requestType, unitId, currentCount) {
	if (inArrayOpts(unitId, this.config.bannedUnits, false)) {
		return;
	}

	var self = this;

	// select units(required for mobile tooltip - if unit is not selected tooltip will not work properly)
	this.selectUnits('div_units' + this.config.formationId + '_' + unitId, unitId);
	if ($('mobile_unit_count')) {
		this.showUnitInfo(unitId);
	}

	// set global vars for timers
	// this.doCount() will be executed N times per second
	this.timerRequestType = requestType;
	this.timerCurrentCount = currentCount;
	this.timerUnitId = unitId;
	this.timerUnitPop = this.jsonUnits[unitId].pop;

	// units counting elements
	this.countFormfield = document.getElementById('ucount' + this.config.formationId + '_' + unitId);
	this.countIndicator = document.getElementById('num_units' + this.config.formationId + '_' + unitId);
	if (this.config.totalPopElementId && document.getElementById(this.config.totalPopElementId)) {
		this.totalPopIndicator = document.getElementById(this.config.totalPopElementId);
	} else {
		this.totalPopIndicator = document.getElementById('tot_pop');
	}

	// execute requested action
	this.doCount();
	this.timerId = setInterval(function(){self.doCount();}, 75);
};

ArmyOrder.prototype.stopCount = function() {
    if (this.timerId) {
        clearInterval(this.timerId);
    }
    this.timerCounter = 1;
};

ArmyOrder.prototype.doCount = function(){
    var curr_num = parseInt(this.countIndicator.innerHTML);
    var new_num = curr_num;
	var unitId = this.countFormfield.id.split('_')[1];

    if (this.timerRequestType == 'decrease') {
        if ( curr_num === 0 ) {
        	this.stopCount();
            return;
        }
        if ( curr_num - this.timerCounter < 0 ) {
        	this.timerCounter = 1;
        }
        new_num -= this.timerCounter;

		this.calcPopLimitUnitType(unitId, new_num, this.config.popLimitUnitType, this.config.formationId, this.jsonUnits);
        this.totalPop -= this.timerCounter * this.timerUnitPop;
    } else {
        new_num += this.timerCounter;

		if (!this.calcPopLimitUnitType(unitId, new_num, this.config.popLimitUnitType, this.config.formationId, this.jsonUnits)) {
			this.stopCount();
			return;
		}

        this.totalPop += this.timerCounter * this.timerUnitPop;

        if (this.totalPop > this.maxPopulation) {
            do {
                new_num--;
                this.totalPop -= this.timerUnitPop;
            }
            while (this.totalPop > this.maxPopulation);

            this.countIndicator.innerHTML = new_num;
            this.countFormfield.value = new_num;
            this.totalPopIndicator.innerHTML = this.totalPop + this.msgPopLimitReached; //max population reached.
            //if mobile counter field exists copy counter
            if ($('mobile_unit_count')) {
        		$('mobile_unit_count').innerHTML = new_num;
        	}

            this.stopCount();
            return;
        }
    }

    if(isNaN(new_num)) {
    	new_num = 0;
    }
    this.countIndicator.innerHTML = new_num;
    this.countFormfield.value = new_num;
    this.totalPopIndicator.innerHTML = this.totalPop;
    if ($('mobile_unit_count')) {
		$('mobile_unit_count').innerHTML = new_num;
	}

    this.timerCounter += 3;
};

ArmyOrder.prototype.showUnitInfo = function(unitId) {
	if (inArrayOpts(unitId, this.config.bannedUnits, false)) {
		return;
	}

	if ($('unitsInfo')) {
		$('unitsInfo').show().innerHTML = this.unitsTooltips[unitId];
	}

	//copy unit count into mobile unit counter
	if ($('mobile_unit_count')) {
		$('mobile_unit_count').innerHTML = $('num_units' + this.config.formationId + '_' + unitId).innerHTML;
	}
};

ArmyOrder.prototype.hideUnitInfo = function() {
	$('unitsInfo').hide();
};

ArmyOrder.prototype.buildFormationSaveData = function() {
	var data = {
		units: {},
		formationId: this.config.formationId
	};

	for (var unitId in this.jsonUnits) {
		var unitData = {
			unitId: unitId,
			col: $('upos' + this.config.formationId + '_' + unitId).value.split('_')[0],
			line: $('upos' + this.config.formationId + '_' + unitId).value.split('_')[1],
			cnt: $('ucount' + this.config.formationId + '_' + unitId).value
		};
		data.units[unitId] = unitData;
	}
	return data;
};
