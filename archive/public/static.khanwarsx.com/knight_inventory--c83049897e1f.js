'use strict';

function Inventory() {
	this.items = {};
	this.equippedItems = {};
	this.currentPage = 0;
	this.lock = 0;
	this.lockBucket = 0;
	this.jsonInventoryTitles = {};
	this.confirmDisposeItemMsg = '';
}

Inventory.prototype.init = function(respData) {
	if (respData.notPromoted) {
		return;
	}

	var self = this;

	var jsonInventory = respData.json_inventory.evalJSON(true);
	this.jsonInventoryTitles = respData.json_inventory_titles.evalJSON(true);
	this.tut_mode = respData.tut_mode;
	this.isDead = respData.isDead;
	this.inMarch = respData.inMarch;
	this.inEvent = respData.inEvent;
	this.knightIsBusyMsg = respData.knightIsBusyMsg;
	this.confirmDisposeItemMsg = respData.confirm_dispose_item_msg;
	this.deleteItems = respData.hasOwnProperty('deleteItemsEnabled') ? respData.deleteItemsEnabled : true;
	this.arenaMode = respData.arenaMode || false;

	var itemsListContainer = $('itemsListContainer');
	for (var key in jsonInventory) {
		var row = jsonInventory[key];
		row.isInFilter = true;

		// skip rendering non-item object properties
		if (!row.slot_id) {
			continue;
		}

		var nodes = {};
		nodes.wrapper = new Element('div', {className: 'inventory_slot' + row.slot_id,title: row.title});
		nodes.wrapper.itemKeyId = key;
		nodes.img = new Element('img', {src: row.image});
		nodes.count = new Element('span', {className: 'count'}).update(row.count);

		nodes.wrapper.insert(nodes.img);
		nodes.wrapper.insert(nodes.count);
		Element.insert(itemsListContainer, nodes.wrapper);

		/* if (row.can_equip) { */
			// Set dragable
			new Draggable(nodes.wrapper, {
				starteffect: Prototype.emptyFunction,
				endeffect: Prototype.emptyFunction,
				revert: true,
				onStart: function(slot_id) {
					self.hightlightSlot('start', slot_id);
				}.curry(row.slot_id),
				onEnd: function(slot_id) {
					self.hightlightSlot('end', slot_id);
				}.curry(row.slot_id)
			});
		/* } else { */
		if (!row.can_equip) {
			Element.addClassName(nodes.wrapper, 'cant_equip');
		}

		this.items[key] = {
			data: row,
			nodes: nodes
		};

		if (row.equipped) {
			this.equipItem(key, false);
		}
	}
	this.paging();
	if (typeof TUTORIAL_ADVISOR !== 'undefined' && TUTORIAL_ADVISOR){
		tutorialPointer($$('.inventory_slot3')[0], 'right');
	}

	//Hook event handlers
	this.initTouchEvents();
	// Set filter click
	$$('#itemsNav li a').each(function(node, i) {
		Event.stopObserving(node);
		Event.observe(node, 'click', function() {
			self.filterBySlot(i, node);
		});
		//node.onclick = self.filterBySlot(i, node);
	});
	$('itemsListPrev').stopObserving().observe('click', function() {
		self.paging('prev');
	});
	$('itemsListNext').stopObserving().observe('click', function() {
		self.paging('next');
	});

	if (this.isDead || this.inMarch || this.inEvent) {
		// Set dropables
		$$('#selectedHero .person div').each(function(node) {
			Droppables.add(node, {
				accept: 'inventory_' + node.id,
				hoverclass: 'hover',
				onDrop: function() {
					kwModal.error(self.knightIsBusyMsg);
				}
			});
		});

		Droppables.add($('itemsList'), {
			accept: 'slot_item',
			hoverclass: 'hover',
			onDrop: function() {
				kwModal.error(self.knightIsBusyMsg);
			}
		});
	} else {
		// Set dropables
		$$('#selectedHero .person div').each(function(node) {
			Droppables.add(node, {
				accept: 'inventory_' + node.id,
				hoverclass: 'hover',
				onDrop: function(itemNode) {
					if (self.lockBucket == 1)
						return false;
					self.equipItem(itemNode.itemKeyId, true);
				}
			});
		});

		if (this.deleteItems) {
			Droppables.add($('slot100'), {
				accept: ['inventory_slot1','inventory_slot2','inventory_slot3','inventory_slot4','inventory_slot5'],
				hoverclass: 'hover',
				onHover: function(itemNode) {
					if (!self.deleteItems) {
						return;
					}
					if (self.lockBucket == 1) {
						return false;
					}

					self.lockBucket = 1;
					var cbConfirmDispose = function() {
						self.disposeItem(itemNode.itemKeyId);
					};
					var cbCancelDispose = function() {
						self.lockBucket = 0;
					};
					kwModal.confirmNegative(self.confirmDisposeItemMsg, cbConfirmDispose, cbCancelDispose);
				}
			});
		}

		Droppables.add($('itemsList'), {
			accept: 'slot_item',
			hoverclass: 'hover',
			onDrop: function(slotNode) {
				if (self.lockBucket == 1)
					return false;
				self.unequipItem(slotNode.itemKeyId, true);
			}
		});


	}
};


Inventory.prototype.initTouchEvents = function() {
	if (typeof window.eventsInit === 'undefined' || window.eventsInit === false) {
		$('itemsListContainer').observe("touchstart", touchHandler);
		$('itemsListContainer').observe("touchmove", touchHandler);
		$('itemsListContainer').observe("touchend", touchHandler);
		$('itemsListContainer').observe("touchcancel", touchHandler);
		$$('.itemSlot').each(function(element){
			element.observe("touchstart", touchHandler);
			element.observe("touchmove", touchHandler);
			element.observe("touchend", touchHandler);
			element.observe("touchcancel", touchHandler);
		});
		window.eventsInit = true;
		return true;
	}

	return false;
};


Inventory.prototype.disposeItem = function(itemKeyId) {
	//var self = this;
	var item = this.items[itemKeyId];

	/*
	if (confirm(confirm_dispose_item_msg)) {
		//return false;
	} else {
		return false;
	}
	*/

	// Decrement
	var cnt;
	if (this.items[itemKeyId]) {
		cnt = --this.items[itemKeyId].data.count;
		this.items[itemKeyId].nodes.count.update(cnt);
	}

	if (this.equippedItems[item.data.slot_id]) {
		//this.unequipItem(itemKeyId, false);
	}

	if (cnt <= 0) {
		Element.hide(item.nodes.wrapper);
	}

	var wrapper = new Element('div', {className: 'slot_item'});
	wrapper.itemKeyId = itemKeyId;
	var img = new Element('img', {src: item.data.image});

	Element.insert(wrapper, img);
	Element.insert($('slot100'), wrapper);

	new Effect.Fade(wrapper, {duration: 1.5});
	Element.remove.delay(1.5, wrapper);
	if (this.equippedItems[item.data.slot_id]) {
		//delete this.equippedItems[item.data.slot_id];
	}

	this.lockBucket = 0;

	this.paging();

	this.sendSlotData(itemKeyId, true, true);
	// refresh
};

Inventory.prototype.equipItem = function(itemKeyId, sendData) {
	//var self = this;
	var item = this.items[itemKeyId];

	if (!item.data.can_equip) {
		return;
	}

	// Decrement
	var cnt = --this.items[itemKeyId].data.count;
	this.items[itemKeyId].nodes.count.update(cnt);

	if (this.equippedItems[item.data.slot_id]) {
		this.unequipItem(itemKeyId, false);
	}

	if (cnt <= 0) {
		Element.hide(item.nodes.wrapper);
	}

	var wrapper = new Element('div', {className: 'slot_item', title: this.jsonInventoryTitles[(item.data.item_id===0?item.data.key:item.data.item_id+'_'+item.data.tier)], hasbox: '0'});
	wrapper.itemKeyId = itemKeyId;
	var img = new Element('img', {src: item.data.image});

	Element.insert(wrapper, img);
	Element.insert($('slot' + item.data.slot_id), wrapper);


	if (item.data.slot_id == 5) { // consumable item
		new Effect.Fade(wrapper, {duration: 1.5});
		Element.remove.delay(1.5, wrapper);
		delete this.equippedItems[item.data.slot_id];
	} else { // regular item
		new Draggable(wrapper, {
			starteffect: Prototype.emptyFunction,
			endeffect: Prototype.emptyFunction,
			revert: true,
			onStart: Element.addClassName.curry($('itemsList'), 'active'),
			onEnd: Element.removeClassName.curry($('itemsList'), 'active')
		});

		this.equippedItems[item.data.slot_id] = {
			itemKeyId: itemKeyId,
			wrapper: wrapper
		};
	}

	this.paging();

	if (sendData) {
		this.sendSlotData(itemKeyId, true);
	}

	// refresh
};

Inventory.prototype.unequipItem = function(itemKeyId, sendData) {
	//var self = this;
	var slotId =  this.items[itemKeyId].data.slot_id;
	var oldItem = this.equippedItems[slotId];
	var item = this.items[oldItem.itemKeyId];
	Element.remove(oldItem.wrapper);

	// Increment
	var cnt = ++item.data.count;
	item.nodes.count.update(cnt);

	Element.show(item.nodes.wrapper);

	delete this.equippedItems[slotId];

	this.paging();

	if (sendData) {
		this.sendSlotData(itemKeyId,false);
	}

	// refresh
};

Inventory.prototype.filterBySlot = function(slotId, node) {
	//var self = this;
	if (this.lock == 1)
		return false;

	this.lock = 1;

	// Set active tab
	Element.up(node).up().select('a').each(function(node) {
		Element.removeClassName(node, 'active');
	});
	node.addClassName('active');

	// Show/hide items
	for (var key in this.items) {
		var row = this.items[key];

		if (row.data.count > 0 && (slotId === 0 || slotId == row.data.slot_id)) {
			Element.show(row.nodes.wrapper);
			row.data.isInFilter = true;
		} else {
			Element.hide(row.nodes.wrapper);
			row.data.isInFilter = false;
		}
	}

	this.paging();
	this.lock = 0;
};

Inventory.prototype.paging = function(page) {
	//var self = this;
	if (!page) {
		this.currentPage = 0;
	} else if (page == 'next') {
		this.currentPage++;
	} else if (page == 'prev') {
		this.currentPage--;
	}

	var perPage = 21;
	var fromResult = this.currentPage * perPage;
	var toResult = fromResult + perPage;
	var activeItems = 0;

	for (var key in this.items) {
		var row = this.items[key];

		if (row.data.isInFilter && row.data.count > 0) {
			if (activeItems >= fromResult && activeItems < toResult) {
				Element.show(row.nodes.wrapper);
			} else {
				Element.hide(row.nodes.wrapper);
			}
			activeItems++;
		}
	}

	Element[fromResult > 0 ? 'show' : 'hide']($('itemsListPrev'));
	Element[toResult >= activeItems ? 'hide' : 'show']($('itemsListNext'));
};

Inventory.prototype.hightlightSlot = function(action, slotId) {
	var currentSlot = $('slot' + slotId);
	Element[action == 'start' ? 'addClassName' : 'removeClassName'](currentSlot, 'active');
};

Inventory.prototype.sendSlotData = function(itemKeyId, sendSlot, disposeItem) {
	if (typeof disposeItem === 'undefined') {
		disposeItem = false;
	}
	var item = this.items[itemKeyId];

	if (typeof(this.tut_mode) != 'undefined' && this.tut_mode !== 0) {
		window.location = "overview.php?finish_adviser=1";
	}

	if (this.arenaMode) {
		new Ajax.Request('ajax_arena.php', {
			method: 'post',
			parameters: {
				type: 'Arena_UI_Daily',
				action: sendSlot? 'equipItem' : 'unequipItem',
				itemId: item.data.item_db_id,
				slotId: item.data.slot_id
			},
			onSuccess: function (transport) {
				var response = transport.responseText.evalJSON(true);
				if (typeof callback === 'function') {
					if (response.status !== 1) {
						kwModal.error(response.data.errorMsg);
					}
				}
			}
		});
		return;
	}

	Element.show($('itemsPreloader'));
	new Ajax.Request('?set_slot=1', {
		method: 'post',
		parameters: {
			'slot_id': sendSlot ? item.data.slot_id : 0,
			'item_id': (item.data.item_id===0 ? item.data.key:item.data.item_id),
			'tier': item.data.tier,
			'dispose' : disposeItem ? '1':'0'
		},
		onSuccess: function(res) {
			res = res.responseJSON;

			Element.hide($('itemsPreloader'));
			if (res.error) {
				kwModal.error(res.msg);
			} else {
				if (res.msg != 'success') {
					kwModal.info(res.msg);
				}
			}
		}
	});

};
