/*Global array for castle gold,wood ....
Idvat ot barracks.tpl
var train_gold=;
var train_iron=;
var train_wood=;
var train_food;
var train_population;
*/
/**
Unit prices come from a different js named unit_prices.js
*/
function recalculate_max(element,unit_id){
	var num=parseInt(element.value);
	var unit_id=parseInt(unit_id);
}
function recalculate_all(unitId){
	var form=document.getElementById('build_army');
	var input_array=form.elements;
	var units = new Object();
	var options = new Object();
	var id;
	var speed, time, totalTime = 0;
	var speedMap = {1 : 1, 3 : 2, 5 : 3};

	for(var i=0;i<input_array.length;i++){
		if(input_array[i].type=='text'){//Input element where the quantity resides
			id=parseInt(input_array[i].name.match(/\d+/g));
			units[id]=(input_array[i].value)?parseInt(input_array[i].value):0;//Get the quantity for all units
			options[id]=1;
		}
		if(input_array[i].type=='select-one'){
			id=parseInt(input_array[i].name.match(/\d+/g));
			options[id]=parseInt(input_array[i].value);//Get the options for all units
			if(options[id]==2)options[id]=3;
			else if(options[id]==3)options[id]=5;
			
		}
		
		
		
	}
	set_max(units,options);
	
	for(i in units){
		if(!units.hasOwnProperty(i)){
			continue;
		}
		options[i] = options[i] || 1;
		units[i] = units[i] || 0;
		totalTime += parseInt((parseInt(units[i], 10) * trainTimes[i] / parseInt(speedMap[options[i]], 10)), 10);
	}
	
	if($('unitTimeAll_' + unitId) && $('unitCount_' + unitId)){
		speed = $('unitSpeed_' + unitId) ? parseInt($('unitSpeed_' + unitId).value, 10) : 1;
		if(speed == 2){
			speed = 3;
		}else if(speed == 3){
			speed = 5;
		}
		time = parseInt((parseInt($('unitCount_' + unitId).value, 10) * trainTimes[unitId]) / speedMap[speed], 10);
		$('unitTimeAll_' + unitId).innerHTML = sec2time(time);
		if(parseInt($('unitCount_' + unitId).value, 10) > 0){
			$('unitTimeAll_' + unitId).setStyle({display : 'block'});
		} else {
			$('unitTimeAll_' + unitId).setStyle({display : 'none'});
		}
	}
	$('barracksTotalTime').innerHTML = sec2time(totalTime);
}
function set_max(units,options){

	var gold=train_gold;
	var iron=train_iron;
	var wood=train_wood;
	var food=train_food;
	var population=train_population;
	var valid=1;
	for(unit_id in units){
		unit_id=parseInt(unit_id);
		if(!isNaN(unit_id)){
			gold-=units[unit_id]*req_gold[unit_id]*options[unit_id];
			iron-=units[unit_id]*req_iron[unit_id]*options[unit_id];
			wood-=units[unit_id]*req_wood[unit_id]*options[unit_id];
			food-=units[unit_id]*req_food[unit_id]*options[unit_id];
			population-=units[unit_id]*req_population[unit_id];
	
			document.getElementById('neededGold' + unit_id).innerHTML = numberFormat(req_gold[unit_id]*options[unit_id]);
			document.getElementById('neededIron' + unit_id).innerHTML = numberFormat(req_iron[unit_id]*options[unit_id]);
			document.getElementById('neededWood' + unit_id).innerHTML = numberFormat(req_wood[unit_id]*options[unit_id]);
			document.getElementById('neededFood' + unit_id).innerHTML = numberFormat(req_food[unit_id]*options[unit_id]);

			timeInSec = document.getElementById('unitTime' + unit_id).getAttribute('alt');
			if(options[unit_id] == 3){
			    newTimeInSec = timeInSec/2;
			    timeToTrain = secToTime(newTimeInSec);
			} else if (options[unit_id] == 5){
			    newTimeInSec = timeInSec/3;
			    timeToTrain = secToTime(newTimeInSec);
			}else{
			    newTimeInSec = timeInSec;
			    timeToTrain = secToTime(newTimeInSec);
			}
			
			document.getElementById('unitTime' + unit_id).innerHTML = timeToTrain;
			
			if(gold<0 || iron<0 || wood<0 || food<0 || population<0){
				set_train_null(units);
				valid=0;
				break;
			}
		}
	}
	if(valid){//Reset the max quantities
		var num;
		var available=new Array();
		var minimum=0;
		for(unit_id in units){
			unit_id=parseInt(unit_id);
			if(!isNaN(unit_id)){
					minimum=0;//Reset
					//Calculate how many units can be build with current resource
					num=Math.floor(gold/(req_gold[unit_id]*options[unit_id]));
					if(num<0){
						set_element_max(unit_id,0);
						continue;
					}
					available[0]=num;
					num=Math.floor(iron/(req_iron[unit_id]*options[unit_id]));
					if(num<0){
						set_element_max(unit_id,0);
						continue;
					}
					available[1]=num;
					num=Math.floor(wood/(req_wood[unit_id]*options[unit_id]));
					if(num<0){
						set_element_max(unit_id,0);
						continue;
					}
					available[2]=num;
					num=Math.floor(food/(req_food[unit_id]*options[unit_id]));
					if(num<0){
						set_element_max(unit_id,0);
						continue;
					}
					available[3]=num;
					num=Math.floor(population/(req_population[unit_id]));
					if(num<0){
						set_element_max(unit_id,0);
						continue;
					}
					available[4]=num;
					minimum=Math.min.apply( Math, available )
					set_element_max(unit_id,minimum+units[unit_id]);
			}
		}
	} 
}
function set_element_max(unit_id,quantity){
	var element=document.getElementById('max_'+unit_id);
	var pos = element.innerHTML.lastIndexOf(' ',10);
	var max_str;
	
	if(pos > 0) { 
		max_str = element.innerHTML.substring(0,pos+1); // 'MAX: ';
	}
	else {
		pos = element.innerHTML.lastIndexOf(':',10);
		max_str = element.innerHTML.substring(0,pos+1); // 'MAX: ';
	}
	element.innerHTML=numberFormat(max_str+quantity);
	element.href='javascript:setMaximum(\'unit['+unit_id+']\','+quantity+');recalculate_all('+unit_id+');';
	element.setAttribute("onclick", "");
}
function set_train_null(units){
	for(unit_id in units){
		unit_id=parseInt(unit_id);
		if(!isNaN(unit_id))
	 		set_element_max(unit_id,0);
	}
}

function secToTime(d) {
	d = Number(d);
	var h = Math.floor(d / 3600);
	var m = Math.floor(d % 3600 / 60);
	var s = Math.floor(d % 3600 % 60);
	return ((h > 0 ? h + ":" : "00:") + (m > 0 ? (m < 10 ? "0" : "") + m + ":" : "00:") + (s < 10 ? "0" : "") + s);
}



function unitTooltip(unitId, element){
		params = {
			type : 'unitTooltip',
			unit_id : unitId
		};
		new Ajax.Request('ajax_units.php', {
			method: 'post',
			parameters: params,
			onSuccess: function(transport) {
				var response = transport.responseText.evalJSON(true);
				setTooltip(element.id, '', response.body);
			}});
		
		
}



function loadQueue(unitType, updateCounts, mineId){
	unitType = unitType || 1;
	updateCounts = updateCounts || false;
	var params = {
		type : 'loadQueue',
		unitType : unitType,
		mineId : mineId
		};
	var queType = mineId !== undefined && mineId > 0 ? 5 : 2;
	new Ajax.Request('ajax_barracks.php', {
		method: 'post',
		parameters: params,
		onSuccess: function(transport) {
			var response = transport.responseText.evalJSON(true);
			var i, tickFunc;
			var timers = response.data.timers;
			$('armyQueueContainer').innerHTML = response.body;
			
			for(i = 0; i < timers.length; i++){
				tickFunc = function(elementId, timeNeeded){
					return function(timeLeft){
						updateProgressBar(elementId, timeNeeded, timeLeft);
					};
					
				}('barracksUnitProgress_' + timers[i].id, timers[i].time_needed);
				
				Timers.add(function(){
					if(typeof tut_mode !== 'undefined' && tut_mode == 1){
						window.location.href = 'barracks.php?unit_type=2';
						return;
					}
					loadQueue(unitType, true, mineId);
				}, timers[i].current_unit_time_left, 'barracksUnitTimer_' + timers[i].id, false, 'standardQueTimerPerUnit_' + timers[i].id);
				
				Timers.add(function(){}, timers[i].time_left, 'barracksUnitTimer2_' + timers[i].id, tickFunc, 'standardQueTimer_' + timers[i].id);
			
				if($('barracksUnitSpeedBtn_' + timers[i].id)){
					$('barracksUnitSpeedBtn_' + timers[i].id).observe('click', function(id){
						return function(){
							new InstantProcess(queType, id ,{unit_type : unitType});
						};
					}(timers[i].id));
				}
                // sitting mode..
                handleSitting();
			}
			
			if(updateCounts){
				getCounts();
			}

		}});
}



function getCounts(){

	var params = {
		type : 'getCounts'
		};
		
	

	new Ajax.Request('ajax_barracks.php', {
		method: 'post',
		parameters: params,
		onSuccess: function(transport) {
			var response = transport.responseText.evalJSON(true);
			var i, counts = response.data, containers;
			for(i in counts){
				containers = $$('#unitCountContainer_' + i + ' strong');
				if(containers.length > 0){
					containers[0].innerHTML = counts[i];
				}
				
			}
			

		}});
}
