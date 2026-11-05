function toggleHotLinks() {
	if(document.getElementById('showHotLinks').style.display == 'none') {
		document.getElementById('showHotLinks').style.display='block';
		document.getElementById('hotlinksMenu').style.display='none';
		document.getElementById('hotelinkPanelWrapper').style.height='50px';
		createCookie('hotLink',2,30);
	} else {
		document.getElementById('showHotLinks').style.display='none';
		document.getElementById('hotlinksMenu').style.display='block';
		document.getElementById('hotlinksPanel').style.top='0px';
		var height = $('hotlinksMenu').getHeight();
		document.getElementById('hotelinkPanelWrapper').style.height=height+'px';
		createCookie('hotLink',1,30);
	}
}

var showHot = readCookie('hotLink');
if( showHot == null) {
	createCookie('hotLink',1,30);
	showHot=1;
}

if(showHot == 1){
	document.getElementById('showHotLinks').style.display= 'none';
	document.getElementById('hotlinksMenu').style.display='block';
	var height = $('hotlinksMenu').getHeight();
	document.getElementById('hotelinkPanelWrapper').style.height=height+'px';
} else {
	document.getElementById('showHotLinks').style.display= 'block';
	document.getElementById('hotlinksMenu').style.display='none';
}

animationInProgress = 0;

$$('.hotLink div, .addToHotlinks div, .manageHotlinks div').invoke('observe', 'mouseover', function(){
    container = $(this);
    inside = container.firstDescendant();
    insideContent = inside.innerHTML;
    if((insideContent).length > 20 && animationInProgress == '0'){
    	stringLength = (insideContent).length;
    	animationDiv = inside;
    	animationInProgress = 1;
    	hiddenChars = (stringLength - 20);
    	moveAreaTo = 4.5*hiddenChars;
		moveAreaSpeed = hiddenChars*0.15;
		new Effect.Morph(animationDiv, {
	        style: hotlinkDirecton+': -'+moveAreaTo+'px;',
	        duration: moveAreaSpeed,
	        afterFinish: function() {
	        	new Effect.Morph(animationDiv, {
	        		style: hotlinkDirecton+': 0px;',
	        		duration: moveAreaSpeed,
	        		afterFinish: function(){
	        			animationInProgress = 0;
	        		}
	        	});
	        }
        });
    }
});
