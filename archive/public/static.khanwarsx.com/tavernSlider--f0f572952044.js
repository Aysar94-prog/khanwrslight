/**
 * tavernSlider Javascript class, which manages the slider 
 *
 *
 *
 */
function tavernSlider(currentLevel, maxLevel, minLevel){
	this.currentLevel = currentLevel;
	this.maxLevel = maxLevel;
	this.minLevel = minLevel;
	var obj = this;
	this.sliderObject = new Control.Slider($('zoom_slider').down('.handle'),$('zoom_slider'),{
		//Options
		range: $R(this.minLevel, this.maxLevel),
		values: $R(this.minLevel, this.maxLevel),
		sliderValue: this.currentLevel,
		minimum: this.minLevel,
		disabled: false,
		onSlide: function(value){
			obj.handleSlides(value);
		},
		onChange: function(value){
			obj.handleSlides(value);
		}
	});
	//Register the click of the save button
	$$('.saveButton')[0].observe('click',function(event){
		obj.setLevel(event);
	});
}

/**
 * Method to strip the clothes of the lady!!!
 *
 *
 */
function handleSlides(value){
	this.currentLevel = value;
	$('slider_all').update(parseInt(value));
	if (tavernSlider.currentFoodIncome) {
		$('tavern_food_income').update(Math.round(tavernSlider.currentFoodIncome * tavernSlider.tavernFoodDeductions[value - 1]));
	}
	if (tavernSlider.tavernMarches) {
		$('tavern_available_marches').update(tavernSlider.tavernMarches[value - 1]);
	}
 	return true;
}

function setLevel(event){
	//$('tavernBuilding').className = 'building b-tavern-l-' + this.currentLevel;

    new Ajax.Request('army_marches.php',{
        method: 'post',
        parameters: {action: 'setLevel', level: this.currentLevel},
        onSuccess: function(transport){
        	//New pop comes from here
         	var data = transport.responseText.evalJSON(true);
         	if(data.error == 0) {
				$('msg1').hide();
				showTooltip = 1;
         	} else {
         		//Check if there is already a tavern errror
				var element = document.getElementById('tavernError');
				if(!element)
					element = document.createElement('div');
				else
					element.innerHTML = '';
				
				//Create an error and mark the wrong march					
				element.className = "errorsmall";
				element.id = 'tavernError';
				
				var iconDiv = document.createElement('div');
				iconDiv.className = "icon";
				element.appendChild(iconDiv);
				
				var textDiv = document.createElement('div');
				textDiv.className = "text";
				textDiv.innerHTML = data.text;
				element.appendChild(textDiv);

				$('buildingDetails').insert({bottom: element});
         	}
		}
    });
    Event.stop(event);//Prevent the default event behaviour
}
tavernSlider.prototype.handleSlides = handleSlides;
tavernSlider.prototype.sliderChanges = sliderChanges;
tavernSlider.prototype.setLevel = setLevel;
