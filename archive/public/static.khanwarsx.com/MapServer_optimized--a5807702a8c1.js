/*
function getMousePositionHelper(e) {
	var posx = 0;
	var posy = 0;
	if (!e) var e = window.event;
	if (e.pageX || e.pageY) 	{
		posx = e.pageX;
		posy = e.pageY;
	}
	else if (e.clientX || e.clientY) 	{
		posx = e.clientX + document.body.scrollLeft
			+ document.documentElement.scrollLeft;
		posy = e.clientY + document.body.scrollTop
			+ document.documentElement.scrollTop;
	}
	return [posx,posy];
}
*/

map = {};

map.init = function(castleX, castleY, tutorialMode, sizeOptions) {
	// Variables
	map.coordinateWidth = 100;
	map.coordinateHeight = 100;
	map.coordinatesX = sizeOptions.mapSizeX; //300 since kw7.1
	map.coordinatesY = sizeOptions.mapSizeY; //300 since kw7.1
	map.minVisibleX = sizeOptions.minVisibleX;
	map.minVisibleY = sizeOptions.minVisibleY;
	map.maxVisibleX = sizeOptions.maxVisibleX;
	map.maxVisibleY = sizeOptions.maxVisibleY;
	map.container = $('mapContainer');

	map.bgToggled = false;
	map.scaleActiveX = $$('#mapScaleX .activeScale')[0];
	map.scaleActiveY = $$('#mapScaleY .activeScale')[0];

    map.tutorialMode = tutorialMode;
    map.blockMarchesPopup = false;


//	map.zoomOffcets = {
//		35: {x: 12, y: 7},
//		50: {x: 8, y: 4},
//		75: {x: 5, y: 3},
//		100: {x: 4, y: 2},
////		125: {x: 3, y: 2}
//	};

	// Stop mark
	$$('.worldMap')[0].observe('mousedown', function(event) {
		if (Event.element(event).tagName != 'INPUT') {
			Event.stop(event);
		}
	});

	// Init map
	map.MapBackground = new MapBackground({
		wrapperNode: map.container,
//		wrapperNode: $('mapGrass'),
		prefix: bgPrefixGrid,
		size: 1000
	});

	map.MiniMap = new MiniMap({
		wrapperNode: $('miniMapContainer'),
		coordinatesX: map.coordinatesX,
		coordinatesY: map.coordinatesY,
		partCoordinatesX: 60,
		partCoordinatesY: 35,
		coordinateSize: 5,
		imageServer: 'map_gd.php?x=__X__&y=__Y__',
		activeZone: $('miniMapActiveZone'),
		activeZoneWidth: 44,
		activeZoneHeight: 24,
		callBackClick: map.goTo
	});

	map._currentProcent = parseInt(document.cookie.replace(/.*last_zoom_procent=|;.*/g, ''));
	if (map._currentProcent <= 0 || isNaN(map._currentProcent))
		map._currentProcent = 100;
//	castleX -= map.getZoomOffcets().x;
//	castleY -= map.getZoomOffcets().y;

	map.MapCore = new MapCore({
		wrapperNode: map.container,
		coordinatesX: map.coordinatesX,
		coordinatesY: map.coordinatesY,
		coordinateWidth: map.coordinateWidth,
		coordinateHeight: map.coordinateHeight,
		scaleNodeX: $('mapScaleX'),
		scaleNodeY: $('mapScaleY'),
		startX: castleX,
		startY: castleY,
		callBackFn: map.callBack,
		minVisibleX: map.minVisibleX,
		minVisibleY: map.minVisibleY,
		maxVisibleX: map.maxVisibleX,
		maxVisibleY: map.maxVisibleY
	});

	// Scale active effect
	map.container.observe('mouseover', function() {
		if (map._scaleActiveXEffect) map._scaleActiveXEffect.cancel();
		if (map._scaleActiveYEffect) map._scaleActiveYEffect.cancel();

		map._scaleActiveXEffect = new Effect.Appear(map.scaleActiveX);
		map._scaleActiveYEffect = new Effect.Appear(map.scaleActiveY);
	});
	map.container.observe('mouseout', function() {
		if (map._scaleActiveXEffect) map._scaleActiveXEffect.cancel();
		if (map._scaleActiveYEffect) map._scaleActiveYEffect.cancel();

		map._scaleActiveXEffect = new Effect.Fade(map.scaleActiveX);
		map._scaleActiveYEffect = new Effect.Fade(map.scaleActiveY);
	});
	map.container.observe('mousemove', function(event) {
		var offset = Element.up(map.scaleActiveY).cumulativeOffset();
		map.scaleActiveY.style.left = (Event.pointerX(event) - offset.left) + 'px';
		map.scaleActiveX.style.top = (Event.pointerY(event) - offset.top) + 'px';
	});

	// Cursor drag
	map.container.observe('mouseover', function() {
		map.container.style.cursor = 'url(' + mapImages + 'cursor-drag_start.cur), move';
	});
	map.container.observe('mousedown', function() {
		map.container.style.cursor = 'url(' + mapImages + 'cursor-drag_end.cur), move';
	});
	map.container.observe('mouseup', function() {
		map.container.style.cursor = 'url(' + mapImages + 'cursor-drag_start.cur), move';
	});

	// Mouse on map
	$$('.worldMap')[0].observe('mouseover', function() {
		map.moseIsOverWrapper = true;
	});
	$$('.worldMap')[0].observe('mouseout', function() {
		map.moseIsOverWrapper = false;
	});

	// Keyboard arrows
	document.observe('keydown', function(event) {
		var arg = null;
		if (event.keyCode == Event.KEY_LEFT) {
			arg = [-1, 0, true];
		} else if (event.keyCode == Event.KEY_RIGHT) {
			arg = [1, 0, true];
		} else if (event.keyCode == Event.KEY_UP) {
			arg = [0, -1, true];
		} else if (event.keyCode == Event.KEY_DOWN) {
			arg = [0, 1, true];

		//Obsolated since kw5.0
		/*} else if (event.keyCode == 32 && map.moseIsOverWrapper) {
			map.miniMapToggle();
			Event.stop(event);
			return;*/

		}

		if (arg) {
			map.goTo.apply(this, arg);
			if (map.moseIsOverWrapper) {
				Event.stop(event);
			}
		}
	});

	// Slider
	map.slider = new Control.Slider($('mapZoomHandler'), $('mapZoomSlider'), {
//		range: $R(25, 125),
		range: $R(25, 100),
		sliderValue: map.tutorialMode ? 75 : 100,
		onSlide: map.resize,
		onChange: map.resize, // XXXXX if commented, uncomment line marked YYYYY
//		values: [35, 50, 75, 100, 125]
		values: map.tutorialMode ? [75] : [35, 50, 75, 100]
	});

	// Set last zoom
	var lastZoomProcent = document.cookie.replace(/.*last_zoom_procent=|;.*/g, '');
	if (lastZoomProcent > 0) {
		lastZoomProcent = parseInt(lastZoomProcent);
		map.slider.setValue(lastZoomProcent);
//		map.resize(lastZoomProcent); // YYYYY uncomment if {map.slider::onChange: map.resize} (line marked XXXXX) is functional
	}

	// Msg window dragable
	new Draggable($('playerMessage'), {handle: $$('#playerMessage .title')[0], revert: false});

	// Legend window dragable
	//new Draggable($('mapLegendWindow'), {handle: $$('#mapLegendWindow .title')[0], revert: false});

	// Minimap Dragable
	//Obsolated since kw5.0
	/*new Draggable($('miniMapOverflow'), {
		handle: $('miniMapDrag'),
		revert: false,
		constraint: 'horizontal',
		snap: function(x, y) {
			if (x < 45) {
				x = 45;
			} else if (x > 600) {
				x = 600;
			}
			return [x, y];
		}
	});*/

	// Mouse wheel event
    if (map.tutorialMode) {
        // no wheel events during tutorial
    } else {
        var mouseWheelEventName = (/Firefox/i.test(navigator.userAgent)) ? 'DOMMouseScroll' : 'mousewheel';
        if (document.attachEvent) {
            document.attachEvent('on' + mouseWheelEventName, map.wheel);
        } else if (document.addEventListener) {
            document.addEventListener(mouseWheelEventName, map.wheel, false);
        }
    }

	//Obsolated since kw5.0
	//var lastMinimapToggle = document.cookie.replace(/.*last_minimap_toggle=|;.*/g, '');
	//if (lastMinimapToggle == 1) {
	//	map.miniMapToggle();
	//}

	
	//var showBg = document.cookie.replace(/.*show_bg=|;.*/g, '');
	//if (showBg > 0) {
	//	map.backgroundToggle();
	//} 


	//map.MapPopup = new MapPopup();
	map.MapPopup = new mapMenu();
	$('boxMapId').observe('mouseup', function(e){
		if(map.MapCore.isDragging === false && !map.MapPopup.getIsOpen()){
			map.showMapPopup(e);
		}
	});


	$('mapContainer').observe('mousedown', function(){
		map.MapPopup.hide();
	});


};

map.callBack = function(coordinatesRange) {
	map.MapBackground.draw();
	mapServer.get(coordinatesRange);
	map.MiniMap.goTo(coordinatesRange);
};

map.goTo = function(x, y, isDirection) {

    if (map.tutorialMode) {
        return false;
    }

	var x = parseInt(x);
	var y = parseInt(y);
//	if (!isDirection) {
//		x -= map.getZoomOffcets().x;
//		y -= map.getZoomOffcets().y;
//	}
	map.MapCore.goTo(x, y, isDirection,false,true);
};

map.resize = function(procent) {
	map._currentProcent = procent;

	document.cookie = 'last_zoom_procent=' + procent + '; path=/';

	if (!map.resize.lastProcent) {
		map.resize.lastProcent = 100;
	}

	map.resize.lastLastProcent = map.resize.lastProcent;

	if (map.resize.effect) {
		map.resize.effect.cancel();
	}
	map.resize.effect = new Effect.Tween(null, map.resize.lastProcent, procent, function(p) {
		procent = Math.round(p);
		map.resize.lastProcent = procent;
		mapServer.resize(procent);
		map.MapCore.resize(procent);
		map.MapBackground.resize(procent);
		map.MiniMap.resize(procent);
	});



	// Fix current coordinats
	/*
	if (map.goTo._timer) {
		clearTimeout(map.goTo._timer);
	}
	map.goTo._timer = map.goTo.delay(1.5);
	*/
};

map.backgroundToggle = function() {
    if (map.tutorialMode) {
        map.bgToggled = false;
    }
	if (map.bgToggled) {
		map.bgToggled = false;
		$('mapBackground').addClassName('unactive');
		$$('.worldMap .mapWrapper #mapContainer .mapCoordinate img.landscape').each(function(el){
			el.style.display = 'block';
		});
	} else {
		map.bgToggled = true;
		$('mapBackground').removeClassName('unactive');
		$$('.worldMap .mapWrapper #mapContainer .mapCoordinate img.landscape').each(function(el) {
			el.style.display = 'none';
		});
	}

	document.cookie = 'show_bg=' + (this.bgToggled ? 1 : 0) + '; path=/';

	map.MapBackground.show(this.bgToggled);
};

/*
map.toggleGrid = function(){
	if (map.showGrid) {
		map.showGrid = false;
		if (map.bgToggled) {
			map.MapBackground.parts = {};
			map.MapBackground.prefix = bgPrefix;
			map.MapBackground.show(true);
		} else {
			$$('#mapScaleX ul li div').each(function(el) {
				el.style.display = 'none';
			});
			$$('#mapScaleY ul li div').each(function(el) {
				el.style.display = 'none';
			});
		}
	} else {
		map.showGrid = true;
		if (map.bgToggled) {
			map.MapBackground.parts = {};
			map.MapBackground.prefix = bgPrefixGrid;
			map.MapBackground.show(true);
		} else {
			$$('#mapScaleX ul li div').each(function(el) {
				el.style.display = 'block';
			});
			$$('#mapScaleY ul li div').each(function(el) {
				el.style.display = 'block';
			});
		}
	}
	document.cookie = 'show_grid=' + (this.showGrid ? 1 : 0) + '; path=/';
}
*/

map.wheel = function(event) {
	if (map.moseIsOverWrapper) {
		var zoomLevel = 20;
		var delta = event.detail ? event.detail * (-120) : event.wheelDelta;
		var zoom = delta < 0 ? -1 : 1;

//		map.mouseCoords = getMousePositionHelper(event);
//		map.boxCoords = Position.page($('mapWrapperId'));
//		map.boxCoords = $('mapWrapperId').viewportOffset;
//		map.mouseX = map.mouseCoords[0]-map.boxCoords[0];
//		map.mouseY = map.mouseCoords[1]-map.boxCoords[1];

//		map.MapCore.currentX = map.MapCore.currentX + map.zoom*Math.round(map.mouseX / map.MapCore.scaledWidth);
//		map.MapCore.currentY = map.MapCore.currentY + map.zoom*Math.round(map.mouseX / map.MapCore.scaledHeight);

		map.slider.setValue(map.slider.value + (zoom * zoomLevel));


		Event.stop(event);
	}
};

map.toggleLegend = function() {
	data = $('mapLegendWindowContent').innerHTML;
	new kwModal({'placeholder': 'mapLegendWindow', 'content': data, 'width': 640}).show();
//	if ($('mapLegendWindow').visible()) {
//		$('mapLegendWindow').fade();
//		hideOverlay();
//	} else {
//		$('mapLegendWindow').appear();
//		showOverlay();
//	}
};

map.toggleNews = function() {
	data = $('globalNewsWrapperContent').innerHTML;
	new kwModal({'placeholder': 'globalNewsWrapper', 'content': data, 'width': 640}).show();

//	if ($('globalNewsWrapper').visible()) {
//		$('globalNewsWrapper').fade();
//		hideOverlay();
//	} else {
//		$('globalNewsWrapper').appear();
//		showOverlay();
//	}
};

map.miniMapToggle = function() {
	return true;

	//Obsolated since kw5.0
	/*var node = $('miniMapOverflow');

	var start = Element.getHeight(node);

	if (map.miniMapToggle.isOpen) {
		map.miniMapToggle.isOpen = false;
		var end = 53;
	} else {
		map.miniMapToggle.isOpen = true;
		var end = 265;
	}

	document.cookie = 'last_minimap_toggle=' + (map.miniMapToggle.isOpen ? '1' : '0') + '; path=/';

	if (this._miniMapEffect) {
		this._miniMapEffect.cancel();
	}
	this._miniMapEffect = new Effect.Tween(null, start, end, function(p) {
		node.style.height = p + 'px';
	}.bind(this));*/
};

//map.getZoomOffcets = function() {
//	if (map.zoomOffcets && map._currentProcent && map.zoomOffcets[map._currentProcent]) {
//		return map.zoomOffcets[map._currentProcent];
//	} else {
//		return {x: 0, y: 0};
//	}
//};

//////




map.showMapPopup = function(e){

	if (map.blockMarchesPopup) {
		map.blockMarchesPopup = false;
		return false;
	}

	var wraperOffset = Element.viewportOffset(map.container);

	var wrapperX = e.clientX - wraperOffset.left;
	var wrapperY = e.clientY - wraperOffset.top;

	var sizeX = Math.round(map.coordinateWidth * mapServer.sizeMultypler);
	var sizeY = Math.round(map.coordinateHeight * mapServer.sizeMultypler);
	var mapX = Math.ceil(wrapperX / sizeX);
	var mapY = Math.ceil(wrapperY / sizeY);

	map.MapPopup.setCoords(mapX, mapY);
	map.MapPopup.positionMenu(sizeX, sizeY);


	map.MapPopup.loadContent(mapX, mapY);
	//map.goTo(mapX, mapY);
};






mapServer = {
	requestStack: {},
	cache: {},
	coordinates: {},
	sizeMultypler: 1,
	currentRs: {},
	objectsToDraw : null
};

mapServer.get = function(coordinatesRange) {
	map.coordinatesData = {};
	var container = map.container;
	var offset = 12;
	var startX = coordinatesRange.startX - offset;
	var endX = coordinatesRange.endX;
	var startY = coordinatesRange.startY - offset;
	var endY = coordinatesRange.endY;

	var id,x,y;
	for (x = coordinatesRange.startX - offset; x <= coordinatesRange.endX; x++) {
		for (y = coordinatesRange.startY - offset; y <= coordinatesRange.endY; y++) {
			id = x + '_' + y;
			if (!mapServer.cache[id]) {
				mapServer.requestStack[id] = {x: x, y: y};
				mapServer.cache[id] = true;
			}
		}
	}

	if (mapServer._requestTimer) {
		clearTimeout(mapServer._requestTimer);
	}

	if ($('mapLoading').effect) {
		$('mapLoading').effect.cancel();
	}


	mapServer._requestTimer = setTimeout(function() {
		if ($H(mapServer.requestStack).size() > 0) {
			$('mapLoading').effect = new Effect.Appear($('mapLoading'));

			new Ajax.Request('ajax_map.php', {
				method: 'post',
				parameters: {
					start_x : startX,
					end_x : endX,
					start_y : startY,
					end_y : endY
				},
				onSuccess: function(transport) {
					mapServer.currentRs = transport.responseText.evalJSON(true);
					mapServer.objectsToDraw = document.createDocumentFragment();
					var i,l;

					if (mapServer.currentRs.castles) {
						l = mapServer.currentRs.castles.length;
						for (i=0;i<l;i++){
							mapServer.setCastleData(mapServer.currentRs.castles[i]);
						}
					}

					if (mapServer.currentRs.camp) {
						l = mapServer.currentRs.camp.length;
						for (i=0;i<l;i++){
							mapServer.setCampData(mapServer.currentRs.camp[i]);
						}
					}

					if (mapServer.currentRs.mine) {
						l = mapServer.currentRs.mine.length;
						for (i=0;i<l;i++){
							mapServer.setMineData(mapServer.currentRs.mine[i]);
						}
					}

					
					
					if (mapServer.currentRs.castleMines) {
						l = mapServer.currentRs.castleMines.length;
						for (i=0;i<l;i++){
							mapServer.setCastleMineData(mapServer.currentRs.castleMines[i]);
						}
					}
					
					
					if (mapServer.currentRs.cleanup) {
						l = mapServer.currentRs.cleanup.length;
						for (i=0;i<l;i++){
							mapServer.setCleanupData(mapServer.currentRs.cleanup[i]);
						}
					}

					if (mapServer.currentRs.landscape) {
						l = mapServer.currentRs.landscape.length;
						for (i=0;i<l;i++){
							mapServer.setLandscapeData(mapServer.currentRs.landscape[i]);
						}
					}

					map.container.appendChild(mapServer.objectsToDraw);
					mapServer.resize(null);

					if ($('mapLoading').effect) {
						$('mapLoading').effect.cancel();
					}
					$('mapLoading').effect = new Effect.Fade($('mapLoading'));

					if(map.tutorialMode){
						tutorialPointer($('mapCoord_108_106'), 'left');
					}

				}.bind(this)
			});

			mapServer.currentRs = {};
			mapServer.requestStack = {};
		}
	}, 100);
};

mapServer.setCastleData = function(row) {
    	if (!mapServer.coordinates[row.x + '_' + row.y]) {
		var coordinateNode = document.createElement('div');
		coordinateNode.className = 'mapCoordinate';
		coordinateNode.style.position = 'absolute';
		coordinateNode.x = row.x;
		coordinateNode.y = row.y;
		coordinateNode.id = 'mapCoord_' + row.x + '_' + row.y;

		mapServer.objectsToDraw.appendChild(coordinateNode);

		mapServer.coordinates[row.x + '_' + row.y] = coordinateNode;

		//////

		var img = new Element('img', {src: row.castle_icon, className: 'castle'});
		Element.update(coordinateNode, img);

		img.setAttribute('title', row.title);

		// Set msg window
		coordinateNode.onmousedown = function() {
			map._lastCoordinats = map.MapCore.currentX + '_' + map.MapCore.currentY;
		};

		coordinateNode.onclick = mapServer.clickObject.curry(row);

                // Add signs
		for (var i in row.signs) {
			if (!coordinateNode.signNodes) {
				coordinateNode.signNodes = {};
			}

			var signNode = new Element('img', {src: mapImages + 'signs/' + row.signs[i] + '.png', className: 'mapSign' + i});
			signNode.setAttribute('title', 'header=[' + signLegendTitle + '] body=[' + signs[row.signs[i]] + ']');
			coordinateNode.insert(signNode);

			coordinateNode.signNodes[i] = signNode;
		}

                //is this a guide castle
                if(row.p_flag & FLAG_GUIDE){
                    //var GuideSign = new Element('div',{className: 'guideIco map'});
                    var GuideSign = new Element('img', {src: mapImages + '/' + '24x24_guide.png', className: 'guideIcoMap'});
                    GuideSign.setAttribute('title', 'header=['+guideLegendTitle+'] body=['+guideLegendBody+']');
                    coordinateNode.insert(GuideSign);
                    coordinateNode.signNodes[coordinateNode.signNodes.leght+1] = GuideSign;
                }

		if(row.flag){
			//KNW-5194
			if(row.lang_code == 'pt_BR' && row.reg_game_id == 'pt') {
				var GuideSign = new Element('img', {src: flagsDir + '/pt_PT.gif', className: 'playerFlagOnCastleMap'});
			} else {
				var GuideSign = new Element('img', {src: flagsDir + '/' + row.flag, className: 'playerFlagOnCastleMap'});
			}
			coordinateNode.insert(GuideSign);
			coordinateNode.signNodes[coordinateNode.signNodes.leght+1] = GuideSign;
		}


        /*GuideSign.setAttribute('title', 'header=['+guideLegendTitle+'] body=['+mutedTitle+']');*/



		if (row.muted == 1) {
		    var GuideSign = new Element('img', {src: mapImages + '/' + 'mute-icon.png', className: 'mutePlayerMap'});
                    GuideSign.setAttribute('title', 'header=['+guideLegendTitle+'] body=['+mutedTitle+']');
                    coordinateNode.insert(GuideSign);
                    coordinateNode.signNodes[coordinateNode.signNodes.leght+1] = GuideSign;
		}
	}
};

mapServer.setCampData = function(row) {
	if (!mapServer.coordinates[row.x + '_' + row.y]) {
		var coordinateNode = document.createElement('div');
		coordinateNode.className = 'mapCoordinate';
		coordinateNode.style.position = 'absolute';
		coordinateNode.x = row.x;
		coordinateNode.y = row.y;

		// Set msg window
		coordinateNode.onmousedown = function() {
			map._lastCoordinats = map.MapCore.currentX + '_' + map.MapCore.currentY;
		};

		coordinateNode.onclick = mapServer.clickObject.curry(row);

		mapServer.objectsToDraw.appendChild(coordinateNode);

		mapServer.coordinates[row.x + '_' + row.y] = coordinateNode;

		//////
		var img = new Element('img', {src: mapServer.currentRs.icons.camp, className: 'camp'});
		coordinateNode.update(img);

		coordinateNode.setAttribute('title', row.title);
	}
};

mapServer.setMineData = function(row) {
	if (!mapServer.coordinates[row.x + '_' + row.y]) {
		var coordinateNode = document.createElement('div');
		coordinateNode.className = 'mapCoordinate';
		coordinateNode.style.position = 'absolute';
		coordinateNode.x = row.x;
		coordinateNode.y = row.y;

		// Set msg window
		coordinateNode.onmousedown = function() {
			map._lastCoordinats = map.MapCore.currentX + '_' + map.MapCore.currentY;
		};

		//coordinateNode.onclick = mapServer.clickObject.curry(row);
		//coordinateNode.onclick = function() {kwMines.toggleDialog(coordinateNode, 'all_mines_admin_window');};
		if (row.own_mine == 1) {
			coordinateNode.onmouseup = function() {
				map.blockMarchesPopup = true;
				kwMines.showDialog();
			};
		}
		/*
		 else
			coordinateNode.onclick = mapServer.clickObject.curry(row);
		*/

		mapServer.objectsToDraw.appendChild(coordinateNode);

		mapServer.coordinates[row.x + '_' + row.y] = coordinateNode;

		//////

		var img = new Element('img', {src: row.mine_icon, className: 'mine'});
		Element.update(coordinateNode, img);

		//var img = new Element('img', {src: mapServer.currentRs.icons.mine, className: 'mine'});
		//coordinateNode.update(img);

		coordinateNode.setAttribute('title', row.title);
	}
}

mapServer.parseFormattedInt = function(string) {
	return parseInt(string.replace(',',''));
}

mapServer.setCleanupData = function(row) {
	if (!mapServer.coordinates[row.x + '_' + row.y]) {
		if (
			this.parseFormattedInt(row.g) > 0 ||
			this.parseFormattedInt(row.j) > 0 ||
			this.parseFormattedInt(row.d) > 0 ||
			this.parseFormattedInt(row.h) > 0 ||
			this.parseFormattedInt(row.pop) > 0
		) {
			var coordinateNode = document.createElement('div');
			coordinateNode.className = 'mapCoordinate';
			coordinateNode.style.position = 'absolute';
			coordinateNode.x = row.x;
			coordinateNode.y = row.y;

			// Set msg window
			coordinateNode.onmousedown = function() {
				map._lastCoordinats = map.MapCore.currentX + '_' + map.MapCore.currentY;
			};

			coordinateNode.onclick = function(row) {
				return true;
				if (map._lastCoordinats != map.MapCore.currentX + '_' + map.MapCore.currentY) {
					return;
				}

				document.location = 'pohod.php?attackx=' + row.x + '&attacky=' + row.y;
			}.curry(row);

			mapServer.objectsToDraw.appendChild(coordinateNode);

			mapServer.coordinates[row.x + '_' + row.y] = coordinateNode;

			coordinateNode.setAttribute('title', row.title);
		}
	}
};



mapServer.setCastleMineData = function(row) {
	if (!mapServer.coordinates[row.x + '_' + row.y]) {
		var coordinateNode = document.createElement('div');
		var prodType, style, prodSubType, level, textureName;
		coordinateNode.className = 'mapCoordinate';
		coordinateNode.style.position = 'absolute';
		coordinateNode.x = row.x;
		coordinateNode.y = row.y;


		coordinateNode.onmousedown = function() {
			map._lastCoordinats = map.MapCore.currentX + '_' + map.MapCore.currentY;
		};

	
	
		//return;
		mapServer.objectsToDraw.appendChild(coordinateNode);

		mapServer.coordinates[row.x + '_' + row.y] = coordinateNode;


		var img = new Element('img', {src: row.image, className: 'mine'});
		Element.update(coordinateNode, img);


		coordinateNode.setAttribute('title', row.title);
	}
};


mapServer.setLandscapeData = function(row) {
	if (!mapServer.coordinates[row.x + '_' + row.y]) {
		var coordinateNode = document.createElement('div');
		coordinateNode.className = 'mapCoordinate';
		coordinateNode.style.position = 'absolute';
		coordinateNode.x = row.x;
		coordinateNode.y = row.y;

		mapServer.objectsToDraw.appendChild(coordinateNode);

		mapServer.coordinates[row.x + '_' + row.y] = coordinateNode;


		//////
//		var lsc = new Element('div', {className: 'landscape'});
		var lsc = new Element('img', {src: mapServer.currentRs.icons.landscape, className: 'landscape'});
//		var lsc = new Element('img', {src: mapServer.currentRs.icons.landscape, className: 'landscape_'+row.type});
		if ( map.bgToggled ) {
			lsc.style.display = 'none';
		}
		coordinateNode.update(lsc);

	}
};



mapServer.getArchitectureStyle = function(row){
	var i, styles = {
		AS : [11],
		EEU : [1,5,9],
		ME : [7,12],
		WEU : [6,4,2,3,10,8]
	};
	for(i in styles){
		if(!styles.hasOwnProperty(i)){
			continue;
		}
		if(styles[i].indexOf(+row.race_id) >= 0){
			return i;
		}
	}
	return 'AS';
};


mapServer.getProductionSubType = function(row){
	var production = row.production_type[0], i;
	var unitTypes = {
		1 : [1, 2, 3, 4],
		2 : [9, 10, 11, 19],
		3 : [5, 6, 7, 8, 21, 22, 23, 24, 25, 26, 27, 28],
		4 : [12, 13, 14, 15],
		5 : [16, 17, 18]
	};
	if(+row.type === 1){
		return production;
	} else {
		for(i in unitTypes){
			if(!unitTypes.hasOwnProperty(i)){
				continue;
			}
			if(unitTypes[i].indexOf(+production) >= 0){
				return i;
			}
		}
	}
	return 1;
};


mapServer.clickObject = function(row) {
	if (map._lastCoordinats != map.MapCore.currentX + '_' + map.MapCore.currentY) {
		return;
	}

	return;
	if(typeof (tut_mode) != 'undefined' && tut_mode != null){
		$('playerMessage').appear();

		$('playerMessageSend').href = 'writenote.php?player_to=' + row.user;
		$('playerMessageProfile').href = 'preview.php?castle_id=' + row.castle_id;
		$('playerMessageMarch').href = 'pohod.php?attackx=' + row.x + '&attacky=' + row.y;
		$('playerMessageResources').href = 'market.php?action=22&tox=' + row.x + '&toy=' + row.y;

		Element.removeClassName($('playerMessageCoordinatesStack'), 'message');
		$('playerMessageCoordinatesStack').innerHTML = addToStackTitle;
		$('playerMessageCoordinatesStack').href = 'javascript:;';
		$('playerMessageCoordinatesStack').onclick = function(row) {
			Element.update(this, doneTitle);
			Element.addClassName(this, 'message');
			this.onclick = Prototype.emptyFunction;

			new Ajax.Request('ajax_addCoordinates.php', {
				parameters: 'x=' + row.x + '&y=' + row.y
			});
		}.curry(row);
		//tut --

            showTutArrow('left',650,520);
        } else {
		//new MapPopup(1, {x : row.x, y : row.y});
	}
};


mapServer.resize = function(procent) {
	if (procent !== null) {
		mapServer.sizeMultypler = procent / 100;
	}

	var sizeX = Math.round(map.coordinateWidth * mapServer.sizeMultypler);
	var sizeY = Math.round(map.coordinateHeight * mapServer.sizeMultypler);

	for (id in mapServer.coordinates) {
		var row = mapServer.coordinates[id];
		row.style.width = sizeX + 'px';
		row.style.height = sizeY + 'px';

		row.style.left = (row.x - 1) * sizeX + 'px';
		row.style.top = (row.y - 1) * sizeY + 'px';
	}


	if (mapServer.resize._signsTimer) {
		clearTimeout(mapServer.resize._signsTimer);
	}

	mapServer.resize._signsTimer = setTimeout(function() {
		for (id in mapServer.coordinates) { // TODO XXX
			var row = mapServer.coordinates[id];
			if (row.signNodes) {
				for (idN in row.signNodes) {
					if (row.signNodes[idN].className != "playerFlagOnCastleMap") {
						var size = 22 * mapServer.sizeMultypler;
						if (size < 15) size = 15;
						if (size > 40) size = 40;
						row.signNodes[idN].style.width = row.signNodes[idN].style.height = size + 'px';
					} else {
						var size = 16 * mapServer.sizeMultypler;
						var height = 11 * mapServer.sizeMultypler;
						row.signNodes[idN].style.width = size + 'px';
						row.signNodes[idN].style.height = height + 'px';
					}
				}
			}
		}
		if(map.MapPopup.getIsOpen()){
			var sizeX = Math.round(map.coordinateWidth * mapServer.sizeMultypler);
			var sizeY = Math.round(map.coordinateHeight * mapServer.sizeMultypler);
			map.MapPopup.positionMenu(sizeX, sizeY);
		}

	}, 300);
};

/*
mapServer.resize = function(procent) {
	var id, idN;
	if (procent !== null) {
		mapServer.sizeMultypler = procent / 100;
	}

	var sizeX = Math.round(map.coordinateWidth * mapServer.sizeMultypler);
	var sizeY = Math.round(map.coordinateHeight * mapServer.sizeMultypler);
	
	var parentNode = map.container.up();

	map.container = map.container.parentNode.removeChild(map.container);
	 
	for (id in mapServer.coordinates) {
		var row = mapServer.coordinates[id];
		row.style.width = sizeX + 'px';
		row.style.height = sizeY + 'px';

		row.style.left = (row.x - 1) * sizeX + 'px';
		row.style.top = (row.y - 1) * sizeY + 'px';
	}
	
	


	if (mapServer.resize._signsTimer) {
		clearTimeout(mapServer.resize._signsTimer);
	}

	mapServer.resize._signsTimer = setTimeout(function() {
		

	}, 1000);
	
	for (id in mapServer.coordinates) { // TODO XXX
		var row = mapServer.coordinates[id];
		if (row.signNodes) {
			for (idN in row.signNodes) {
				if (row.signNodes[idN].className != "playerFlagOnCastleMap") {
					var size = 22 * mapServer.sizeMultypler;
					if (size < 15) size = 15;
					if (size > 40) size = 40;
					row.signNodes[idN].style.width = row.signNodes[idN].style.height = size + 'px';
				} else {
					var size = 16 * mapServer.sizeMultypler;
					var height = 11 * mapServer.sizeMultypler;
					row.signNodes[idN].style.width = size + 'px';
					row.signNodes[idN].style.height = height + 'px';
				}
			}
		}
	}
	
	
	if(map.MapPopup.getIsOpen()){
		var sizeX = Math.round(map.coordinateWidth * mapServer.sizeMultypler);
		var sizeY = Math.round(map.coordinateHeight * mapServer.sizeMultypler);
		map.MapPopup.positionMenu(sizeX, sizeY);
	}
	
	parentNode.insert(map.container);
};

*/