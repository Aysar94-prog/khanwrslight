var MapCore = function(options) {
	this.wrapperNode = options.wrapperNode;
	this.coordinatesX = options.coordinatesX; // 200, num X spots //300 since kw7.1
	this.coordinatesY = options.coordinatesY; // 200, num Y spots //300 since kw7.1
	this.coordinateWidth = options.coordinateWidth;   // 100, square width @ 100%
	this.coordinateHeight = options.coordinateHeight; // 100, square height @ 100%
	this.scaleNodeX = options.scaleNodeX;
	this.scaleNodeY = options.scaleNodeY;
	this.callBackFn = options.callBackFn;
	
	this.minVisibleX = parseInt(options.minVisibleX);
	this.minVisibleY = parseInt(options.minVisibleY);
	this.maxVisibleX = parseInt(options.maxVisibleX);
	this.maxVisibleY = parseInt(options.maxVisibleY);

	
	this.continerWidth = Element.up(this.wrapperNode).getWidth();
	this.continerHeight = Element.up(this.wrapperNode).getHeight();
	
	this.sizeMultypler = 1;
	
	//
	this.scaledWidth  = this.coordinateWidth  * this.sizeMultypler; // scaled square size, pixels. 100*this.sizeMultypler
	this.scaledHeight = this.coordinateHeight * this.sizeMultypler;
	
	this.scaledTotalWidth  = this.coordinatesX * this.scaledWidth; // scaled total map size, pixels. 200*100*this.sizeMultypler
	this.scaledTotalHeight = this.coordinatesY * this.scaledHeight;
	
	this.scaledRealWidth = this.continerWidth  - this.scaledTotalWidth; // 923 - 200*100*this.sizeMultypler
	this.scaledRealHeight = this.continerHeight - this.scaledTotalHeight;
	
	this.showedCoordinatesX = Math.round(this.continerWidth / (this.scaledWidth));
	this.showedCoordinatesY = Math.round(this.continerHeight / (this.scaledHeight));
	
	this.zoomCoefX = this.scaledTotalWidth/this.coordinatesX;
	this.zoomCoefY = this.scaledTotalHeight/this.coordinatesY;
	
	//
	this.scaledCache = {};
	
	this.scaledCache[100] = { // the 100% initial value
		'scaledWidth' : this.scaledWidth,
		'scaledHeight' : this.scaledHeight,
		
		'scaledTotalWidth'  : this.scaledTotalWidth,
		'scaledTotalHeight' : this.scaledTotalHeight,
		
		'scaledRealWidth'  : this.scaledRealWidth,
		'scaledRealHeight' : this.scaledRealHeight,
		
		'showedCoordinatesX' : this.showedCoordinatesX,
		'showedCoordinatesY' : this.showedCoordinatesY,
		
		'zoomCoefX' : this.zoomCoefX,
		'zoomCoefY' : this.zoomCoefY
		
	}
	//
	
	this.currentX = options.startX > 0 ? options.startX : this.minVisibleX;
	this.currentY = options.startY > 0 ? options.startY : this.minVisibleY;
	
	this.createMap();
	this.resize(null);
	this.setDraggable();
	this.isDragging = false;
	
};


MapCore.prototype.createMap = function() {
	// For no NaN values
	this.wrapperNode.style.left = 0;
	this.wrapperNode.style.top = 0;

	// Create scale X
	this.scaleNodeX.ul = document.createElement('ul');
	this.scaleNodeX.ul.nodes = {};
	this.scaleNodeX.appendChild(this.scaleNodeX.ul);
	var node;
	var gridNode;
	for (var i = 1; i <= this.coordinatesX; i++) {
		node = document.createElement('li');
		gridNode = document.createElement('div');
		this.scaleNodeX.ul.nodes[i] = node;
		node.innerHTML = i;
		this.scaleNodeX.ul.appendChild(node);
		node.appendChild(gridNode);
	}

	// Create scale Y
	this.scaleNodeY.ul = document.createElement('ul');
	this.scaleNodeY.ul.nodes = {};
	this.scaleNodeY.appendChild(this.scaleNodeY.ul);
	var node;
	var gridNode;
	for (var i = 1; i <= this.coordinatesY; i++) {
		node = document.createElement('li');
		gridNode = document.createElement('div');
		this.scaleNodeY.ul.nodes[i] = node;
		node.innerHTML = i;
		this.scaleNodeY.ul.appendChild(node);
		node.appendChild(gridNode);
	}
};


MapCore.prototype.resize = function(procent) {
	
	//coordinateWidth: 100, coordinatesX: 200, continerWidth: 923
	
	if (procent !== null) {
		this.sizeMultypler = procent / 100;
	}
	
	if ( procent != map.resize.lastLastProcent ) { // skip needless calculations
		if ( this.scaledCache[procent] ) {
			this.scaledWidth  = this.scaledCache[procent].scaledWidth;
			this.scaledHeight = this.scaledCache[procent].scaledHeight;
			
			this.scaledTotalWidth  = this.scaledCache[procent].scaledTotalWidth;
			this.scaledTotalHeight = this.scaledCache[procent].scaledTotalHeight;
			
			this.scaledRealWidth  = this.scaledCache[procent].scaledRealWidth;
			this.scaledRealHeight = this.scaledCache[procent].scaledRealHeight;
			
			this.showedCoordinatesX = this.scaledCache[procent].showedCoordinatesX;
			this.showedCoordinatesY = this.scaledCache[procent].showedCoordinatesY;
			
			this.zoomCoefX = this.scaledCache[procent].zoomCoefX;
			this.zoomCoefY = this.scaledCache[procent].zoomCoefY;
			
			
		} else {
			this.scaledWidth  = this.coordinateWidth  * this.sizeMultypler;
			this.scaledHeight = this.coordinateHeight * this.sizeMultypler;
			
			this.scaledTotalWidth  = this.coordinatesX * this.scaledWidth;
			this.scaledTotalHeight = this.coordinatesY * this.scaledHeight;
			
			this.scaledRealWidth  = this.continerWidth  - this.scaledTotalWidth;
			this.scaledRealHeight = this.continerHeight - this.scaledTotalHeight;
			
			this.showedCoordinatesX = Math.round(this.continerWidth / (this.scaledWidth));
			this.showedCoordinatesY = Math.round(this.continerHeight / (this.scaledHeight));
			
			this.zoomCoefX = this.scaledTotalWidth/this.coordinatesX;
			this.zoomCoefY = this.scaledTotalHeight/this.coordinatesY;
			
			
			this.scaledCache[procent] = {
				'scaledWidth' : this.scaledWidth,
				'scaledHeight' : this.scaledHeight,
				
				'scaledTotalWidth'  : this.scaledTotalWidth,
				'scaledTotalHeight' : this.scaledTotalHeight,
				
				'scaledRealWidth' : this.scaledRealWidth,
				'scaledRealHeight' : this.scaledRealHeight,
				
				'showedCoordinatesX' : this.showedCoordinatesX,
				'showedCoordinatesY' : this.showedCoordinatesY,
				
				'zoomCoefX' : this.zoomCoefX,
				'zoomCoefY' : this.zoomCoefY
				
			}
		}
	}
	
//	console.log(
//			'coordinateWidth: '+this.coordinateWidth+
//			', coordinatesX: '+this.coordinatesX+
//			', continerWidth: '+this.continerWidth+
//			', currentX: '+this.currentY+
//			'\n'
//		);
	
//	console.log(
//		'sizeMultypler: '+this.sizeMultypler+
//		', scaledWidth: '+this.scaledWidth+
//		', scaledTotalWidth: '+this.scaledTotalWidth+
//		', scaledRealWidth: '+this.scaledRealWidth+
//		', showedCoordinatesX: '+this.showedCoordinatesX+
//		'\n'
//	);
	
	
	var parentNodeUlX = this.scaleNodeX.ul.up();
	var parentNodeUlY = this.scaleNodeY.ul.up();
	
	this.scaleNodeY.ul = parentNodeUlY.removeChild(this.scaleNodeY.ul);
	this.scaleNodeX.ul = parentNodeUlX.removeChild(this.scaleNodeX.ul);

	//map.container = map.container.parentNode.removeChild(map.container);
	
	this.scaleNodeY.ul.style.width  = this.wrapperNode.style.width = this.scaledTotalWidth + 'px';
	this.scaleNodeX.ul.style.height = this.wrapperNode.style.height = this.scaledTotalHeight + 'px';

	// Set scale X
	for (var i = 1; i <= this.coordinatesX; i++) {
		this.scaleNodeX.ul.nodes[i].style.height = (this.scaledHeight) + 'px';
		this.scaleNodeX.ul.nodes[i].style.lineHeight = (this.scaledHeight) + 'px';
	}

	// Set scale Y
	for (var i = 1; i <= this.coordinatesY; i++) {
		this.scaleNodeY.ul.nodes[i].style.width = (this.scaledWidth) + 'px';
	}
	
	parentNodeUlX.insert(this.scaleNodeX.ul);
	parentNodeUlY.insert(this.scaleNodeY.ul);

	// Goto current X & Y to fix the map
	this.goTo(this.currentX, this.currentY, false, true, true);
};


MapCore.prototype.setDraggable = function() {
    if (map.tutorialMode) {
        return false;
    }
	var dragable = new Draggable(this.wrapperNode, {
		revert: false,
		starteffect: function() {
			if (this._effectX) {
				this._effectX.cancel();
			}
			if (this._effectY) {
				this._effectY.cancel();
			}
			
		}.bind(this),
			
		endeffect: function() {
			this.callBack();

//			this.goTo(this.currentX, this.currentY,false,false,false); // snap to currentX/Y
		}.bind(this),
		
		/*
		onDrag: function(obj,e) {
			document.getElementById('gotoX').value = x;
			document.getElementById('gotoY').value = y;
		}.bind(this),
		*/
		
		snap: function(x, y) {
			var newX, newY;
			if (x >= 0) {
				x = 0;
			} else if (x <= this.scaledRealWidth) {
				x = this.scaledRealWidth;
			}

			if (y >= 0) {
				y = 0;
			} else if (y <= this.scaledRealHeight) {
				y = this.scaledRealHeight;
			}

//			this.currentX = Math.abs(Math.round(x / (this.scaledWidth))) + 1;
//			this.currentY = Math.abs(Math.round(y / (this.scaledHeight))) + 1;

			
			
			newX = Math.abs(Math.round(x / (this.scaledWidth)))  + Math.round(this.showedCoordinatesX/2);
			newY = Math.abs(Math.round(y / (this.scaledHeight))) + Math.round(this.showedCoordinatesY/2);
			
			//IE fix -- check if there is actual dragging
			if(this.currentX !== newX || this.currentY !==  newY){
				this.isDragging = true;
			}
			
			this.currentX =  newX;
			this.currentY =  newY;
			
			if (this.currentX < this.minVisibleX) {
				this.currentX = this.minVisibleX;
			}
			if (this.currentY < this.minVisibleY) {
				this.currentY = this.minVisibleY;
			}

			if (this.currentX > this.maxVisibleX) {
				this.currentX = this.maxVisibleX;
			}
			
			if (this.currentY > this.maxVisibleY) {
				this.currentY = this.maxVisibleY;
			}
			
			x = 0 - Math.round((this.currentX - this.showedCoordinatesX/2) * this.scaledWidth);
			y = 0 - Math.round((this.currentY - this.showedCoordinatesY/2) * this.scaledHeight);
			
			//console.log(newX + ':' + newY);
			
			// ugliest hack ever, for some reason this makes FF 3.6 more responsive
			document.getElementById('gotoXX').value = x;
			document.getElementById('gotoYY').value = y;
			
			document.getElementById('gotoX').value = this.currentX;
			document.getElementById('gotoY').value = this.currentY;
			
			this.moveScale(x, y);
			return [x, y];
		}.bind(this),
			
		

		
		onEnd : function(){
			this.isDragging = false;
		}.bind(this)
	});
};

MapCore.prototype.moveScale = function(x, y) {
	if (y !== null) {
		this.scaleNodeX.ul.style.top = y + 'px';
	}

	if (x !== null) {
		this.scaleNodeY.ul.style.left = x + 'px';
	}
};


MapCore.prototype.goTo = function(x, y, isDirection, noEffect, isZoom) {
	x = parseInt(x);
	y = parseInt(y);
	
//	console.log('MapCore.prototype.goTo isZoom: '+(isZoom?'yes':'no')+'\n');
//	console.log('MapCore.prototype.goTo this.wrapperNode.style.width: '+this.wrapperNode.style.width+'\n');
//	console.log('MapCore.prototype.goTo x,y: '+x+','+y+'\n');
//	console.log('MapCore.prototype.goTo this.showedCoordinatesX,this.showedCoordinatesY: '+this.showedCoordinatesX+','+this.showedCoordinatesY+'\n');

	if (isDirection) {
		this.currentX = parseInt(this.currentX) + (x * Math.floor( this.showedCoordinatesX  / 2));
		this.currentY = parseInt(this.currentY) + (y * Math.floor( this.showedCoordinatesY  / 2));
	} else {
		this.currentX = x;
		this.currentY = y;
	}

	if (this.currentX < this.minVisibleX) {
		this.currentX = this.minVisibleX;
	}
	if (this.currentY < this.minVisibleY) {
		this.currentY = this.minVisibleY;
	}

	if (this.currentX > this.maxVisibleX) {
		this.currentX = this.maxVisibleX;
	}
	
	if (this.currentY > this.maxVisibleY) {
		this.currentY = this.maxVisibleY;
	}

	// Fix current coordinates
        //console.log('Showed coordinates x,y: '+this.showedCoordinatesX+','+this.showedCoordinatesY+' Current x,y: '+this.currentX+','+this.currentY);
	if (this.currentX < 1) {
		this.currentX = 1;
	} else if (this.currentX > this.coordinatesX - this.showedCoordinatesX) {
		this.currentX = this.coordinatesX - Math.floor(  this.showedCoordinatesX  / 2);
	}

	if (this.currentY < 1) {
		this.currentY = 1;
	} else if (this.currentY > this.coordinatesY - this.showedCoordinatesY) {
		this.currentY = this.coordinatesY - Math.floor(  this.showedCoordinatesY  / 2);
	}
        //console.log('Showed coordinates x,y: '+this.showedCoordinatesX+','+this.showedCoordinatesY+' Current x,y: '+this.currentX+','+this.currentY);
	document.getElementById('gotoXX').value = this.currentX;
	document.getElementById('gotoYY').value = this.currentY;
	document.getElementById('gotoX').value = this.currentX;
	document.getElementById('gotoY').value = this.currentY;

	// Move effect
	var startX = parseInt(this.wrapperNode.style.left);
	
	if ( isZoom ) {
		var endX = Math.round(this.continerWidth/2 - this.zoomCoefX*this.currentX); 
//		var endX = Math.round(map.mouseX - this.zoomCoefX*this.currentX); 
	} else {
		var endX = (this.currentX - 1) * -(this.scaledWidth);
	}
	
	if (endX > 0)
		endX = 0;
//	else
//	if (endX < (-200)*this.scaledWidth)
//		endX = (-200)*this.scaledWidth;

	
	if (startX != endX) {
		if (noEffect) {
			this.wrapperNode.style.left = endX + 'px';
			this.moveScale(endX, null);
		} else {
			if (this._effectX) {
				this._effectX.cancel();
			}
			this._effectX = new Effect.Tween(null, startX, endX, function(p) {
				this.wrapperNode.style.left = p + 'px';
				this.moveScale(p, null);
			}.bind(this));
		}
	}

	var startY = parseInt(this.wrapperNode.style.top);
	
	if ( isZoom ) {
		var endY = Math.round(this.continerHeight/2 - this.zoomCoefY*this.currentY); 
//		var endY = Math.round(map.mouseY - this.zoomCoefY*this.currentY); 
	} else {
		var endY = (this.currentY - 1) * -(this.scaledHeight);
	}
	
	if (endY > 0)
		endY = 0;
//	else
//	if (endY < (-200)*this.scaledHeight)
//		endY = (-200)*this.scaledHeight;

	if (startY != endY) {
		if (noEffect) {
			this.wrapperNode.style.top = endY + 'px';
			this.moveScale(null, endY);
		} else {
			if (this._effectY) {
				this._effectY.cancel();
			}
			this._effectY = new Effect.Tween(null, startY, endY, function(p) {
				this.wrapperNode.style.top = p + 'px';
				this.moveScale(null, p);
			}.bind(this));
		}
	}
	
	var callBackDelay = (startX != endX || startY != endY) ? 1 : .2;
	if (this._callBackDelay) {
		clearTimeout(this._callBackDelay);
	}
	this._callBackDelay = this.callBack.bind(this).delay(callBackDelay);
	
};


MapCore.prototype.callBack = function() {
	if (this.callBack._lastX != this.currentX || this.callBack._lastY != this.currentY || this.callBack._sizeMultypler != this.sizeMultypler) {
		this.callBackFn({
			startX: this.currentX,
			endX: this.currentX + this.showedCoordinatesX,
			startY: this.currentY,
			endY: this.currentY + this.showedCoordinatesY
		});
	}

	this.callBack._lastX = this.currentX;
	this.callBack._lastY = this.currentY;
	this.callBack._sizeMultypler = this.sizeMultypler;
};






////////////////////////
////////////////////////

var MapBackground = function(options) {
	this.wrapperNode = options.wrapperNode;
	this.prefix = options.prefix;
	this.size = options.size;
	this.isShowed = false;

	this.sizeMultypler = 1;
	this.parts = {};
};


MapBackground.prototype.draw = function() {
	var usedParts = {};
	
//	console.log(this.prefix);

	if (this.isShowed) {
		var size = (this.size * this.sizeMultypler);

		var wrapperLeft = parseInt(this.wrapperNode.style.left) * -1;
		var wrapperTop = parseInt(this.wrapperNode.style.top) * -1;

		var parentWidth = Element.up(this.wrapperNode).getWidth();
		var parentHeight = Element.up(this.wrapperNode).getHeight();

		var startX = Math.round(wrapperLeft / size);
		var startY = Math.round(wrapperTop / size);

		var endX = startX + Math.round(parentWidth / size);
		var endY = startY + Math.round(parentHeight / size);

		var offcetX = Math.round(parentWidth / size);
		var offcetY = Math.round(parentHeight / size);

		if (offcetX < 2) offcetX = 2;
		if (offcetY < 2) offcetY = 2;

		var maxX = this.wrapperNode.getWidth() / size;
		var maxY = this.wrapperNode.getHeight() / size;

		var iY;
		var i;
		for (var iX = startX - offcetX; iX < endX + offcetX; iX++) {
			for (iY = startY - offcetY; iY < endY + offcetY; iY++) {
				// Check
				if (iX < 0 || iY < 0 || iX >= maxX || iY >= maxY) {
					continue;
				}

				// Build
				id = iX + '_' + iY;

				if (!this.parts[id]) {
					this.parts[id] = document.createElement('img');
					this.parts[id].src = this.prefix + (iX * this.size) + '_' + (iY * this.size) + '.jpg';
					this.parts[id].style.position = 'absolute';

					this.parts[id].iX = iX;
					this.parts[id].iY = iY;
				}

				if (!this.parts[id].isAppend) {
					this.parts[id].isAppend = true;
					this.wrapperNode.appendChild(this.parts[id]);
				}

				usedParts[id] = true;
			}
		}

		this.resize(null);
	}

	for (var id in this.parts) {
		if (!usedParts[id] && this.parts[id].isAppend) {
			this.parts[id].isAppend = false;
			this.wrapperNode.removeChild(this.parts[id]);
		}
	}
};


MapBackground.prototype.resize = function(procent) {
	if (procent !== null) {
		this.sizeMultypler = procent / 100;
	}

	var size = Math.round(this.size * this.sizeMultypler);

	for (var id in this.parts) {
		this.parts[id].style.width = size + 'px';
		this.parts[id].style.height = size + 'px';

		this.parts[id].style.left = this.parts[id].iX * size + 'px';
		this.parts[id].style.top = this.parts[id].iY * size + 'px';
	}
};


MapBackground.prototype.show = function(show) {
	this.isShowed = show;
	this.draw();
};

////////////////////////
////////////////////////

var MiniMap = function(options) {
	this.wrapperNode = options.wrapperNode;
	this.coordinatesX = options.coordinatesX;
	this.coordinatesY = options.coordinatesY;
	this.partCoordinatesX = options.partCoordinatesX;
	this.partCoordinatesY = options.partCoordinatesY;
	this.coordinateSize = options.coordinateSize;
	this.imageServer = options.imageServer;
	this.activeZone = options.activeZone;
	this.activeZoneWidth = options.activeZoneWidth;
	this.activeZoneHeight = options.activeZoneHeight;
	this.callBackClick = options.callBackClick;

	this.sizeMultypler = 1;
	this.mapsParts = {};
	this.offsetX = 0;
	this.offsetY = 0;

	this.resize(null);
};


MiniMap.prototype.goTo = function(coordinatesRange) {
	// Create
	var startX = coordinatesRange.startX - this.partCoordinatesX - this.activeZoneWidth;
	var startY = coordinatesRange.startY - this.partCoordinatesY - this.activeZoneHeight;
//	var startX = coordinatesRange.startX;
//	var startY = coordinatesRange.startY;

	var endX = startX + (this.partCoordinatesX * 2);
	var endY = startY + (this.partCoordinatesY * 2);

	var id;
	var iY;
	for (var iX = startX; iX < endX; iX++) {
		if (iX < 0 || iX > this.coordinatesX || iX % this.partCoordinatesX != 0) {
			continue;
		}

		for (iY = startY; iY < endY; iY++) {
			if (iY < 0 || iY > this.coordinatesY || iY % this.partCoordinatesY != 0) {
				continue;
			}

			id = iX + '_' + iY;
			if (!this.mapsParts[id]) {
				var img = new Element('img', {src: this.imageServer.replace('__X__', iX + 1).replace('__Y__', iY + 1)});
				img.style.position = 'absolute';
				img.style.left = (iX * this.coordinateSize) + 'px';
				img.style.top = (iY * this.coordinateSize) + 'px';
				img.iX = iX;
				img.iY = iY;
				Element.insert(this.wrapperNode, img);

				Event.observe(img, 'click', this.partClick.bind(this));

				this.mapsParts[id] = img;
			}
		}
	}

	// Move
	var moveStartX = parseInt(this.wrapperNode.style.left) || 0;
	var moveStartY = parseInt(this.wrapperNode.style.top) || 0;

	var moveEndX = ((coordinatesRange.startX - 1) * -this.coordinateSize) + this.offsetX;
	var moveEndY = ((coordinatesRange.startY - 1) * -this.coordinateSize) + this.offsetY;

	if (this._effectX) {
		this._effectX.cancel();
	}
	this._effectX = new Effect.Tween(null, moveStartX, moveEndX, function(p) {
		this.wrapperNode.style.left = p + 'px';
	}.bind(this));

	if (this._effectY) {
		this._effectY.cancel();
	}
	this._effectY = new Effect.Tween(null, moveStartY, moveEndY, function(p) {
		this.wrapperNode.style.top = p + 'px';
	}.bind(this));
};


MiniMap.prototype.resize = function(procent) {
	if (procent !== null) {
		this.sizeMultypler = 100 / procent;
	}
	
	var resizedActiveZoneWidth  = this.activeZoneWidth * this.sizeMultypler;
	var resizedActiveZoneHeight = this.activeZoneHeight * this.sizeMultypler;

	this.activeZone.style.width  = resizedActiveZoneWidth + 'px';
	this.activeZone.style.height = resizedActiveZoneHeight + 'px';

	this.offsetX = ((Element.up(this.wrapperNode).getWidth() ) / 2);
	this.offsetX = this.offsetX - (this.offsetX % this.coordinateSize);

	this.offsetY = ((Element.up(this.wrapperNode).getHeight() ) / 2);
	this.offsetY = this.offsetY - (this.offsetY % this.coordinateSize);


	this.activeZone.style.left = this.offsetX - resizedActiveZoneWidth/2 + 'px';
	this.activeZone.style.top = this.offsetY - resizedActiveZoneHeight/2 + 'px';
};


MiniMap.prototype.partClick = function(event) {
    if (map.tutorialMode) {
        return false;
    }
	var part = Event.element(event);
	var parent = Element.up(part);
	var parentOffset = Element.up(parent).viewportOffset();
	var partX = parseInt(part.style.left) - (parseInt(parent.style.left) * -1);
	var partY = parseInt(part.style.top) - (parseInt(parent.style.top) * -1);
	var xClick = Event.pointerX(event) - parentOffset.left;
	var yClick = Event.pointerY(event) - parentOffset.top;

	var goX = Math.round((xClick - partX) / this.coordinateSize) + part.iX;
	var goY = Math.round((yClick - partY) / this.coordinateSize) + part.iY;

	var scrollOffsets = document.viewport.getScrollOffsets()
	goX -= Math.round(scrollOffsets[0] / 5); // I have no idea why I wrote this, but it works (agavazov)
	goY -= Math.round(scrollOffsets[1] / 5); // I have no idea why I wrote this, but it works (agavazov)

	this.callBackClick(goX, goY);
};







