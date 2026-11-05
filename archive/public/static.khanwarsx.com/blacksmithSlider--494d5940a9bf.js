/**
 * blacksmithSlider Javascript class, which manages the slider
 *
 *
 *
 */
function blacksmithSlider(workers, allowedWorkers, allowedMaximum, minWorkers, maxWorkers, canUpdate, income) {
    this.default_workers = workers;
    this.difference = 0;
    this.workers = workers;
    this.allowedWorkers = allowedWorkers;
    this.minWorkers = minWorkers;
    this.maxWorkers = maxWorkers;
    this.canUpdate = canUpdate;
    this.income = income;
    this.allowedMaximum = allowedMaximum;
    var obj = this;
    var disabled = false;
    if (this.allowedMaximum == 0) {
        disabled = true;
    }
    this.sliderObject = new Control.Slider($('zoom_slider').down('.handle'), $('zoom_slider'), {
        //Options
        range: $R(this.minWorkers, this.allowedMaximum),
        values: $R(this.minWorkers, this.allowedMaximum),
        sliderValue: this.workers,
        minimum: this.minWorkers,
        disabled: disabled,
        onChange: function (value) {
            obj.sliderChanges(value);
        }
    });
    //Register the click of the save button
    $$('.saveButton')[0].observe('click', function (event) {
        obj.saveWorkers(event);
        closeOverviewPopup();
    });
}
/**
 * Method to strip the clothes of the lady
 *
 *
 */

function changeCost(difference) {
    if (difference < 0) {
        $("NeedGold").innerHTML = numberFormat(Math.abs(difference * 2));
        $("NeedIron").innerHTML = numberFormat(Math.abs(difference * 1));
        $("NeedWood").innerHTML = numberFormat(Math.abs(difference * 1));
        $("NeedFood").innerHTML = numberFormat(Math.abs(difference * 2));
    }
    else {
        $("NeedGold").innerHTML = 0;
        $("NeedIron").innerHTML = 0;
        $("NeedWood").innerHTML = 0;
        $("NeedFood").innerHTML = 0;
    }

    if (difference < 0 && (changeCost.gold < Math.abs(difference * 2) || changeCost.iron < Math.abs(difference * 1) || changeCost.wood < Math.abs(difference * 1) || changeCost.food < Math.abs(difference * 2))) {
        $("NeedGold").setStyle("color : red;");
        $("NeedIron").setStyle("color : red;");
        $("NeedWood").setStyle("color : red;");
        $("NeedFood").setStyle("color : red;");
    }
    else {
        //$("NeedResources").setStyle("NeedResources");
        //$("NeedResources").setStyle("background-color : #613810;");
    }
}

function sliderChanges(value) {
    // do ajax request to get the correct value
    var building_id = document.getElementsByName('b_id')[0].value;
    new Ajax.Request('ajax_buildings.php', {
        method: 'post',
        data: 'json',
        evalJS: true,
        parameters: {
            b_id: building_id,
            newWorkers: value
        },
        onSuccess: function (res) {
            var rs = JSON.parse(res.responseText);
            $('slider_income').update(parseInt(rs.sum) + ' %');
        }
    });

    this.workers = value;
    $('slider_all').update(parseInt(value));
    return true;
}
function saveWorkers(event) {
    var building_id = document.getElementsByName('b_id')[0].value;
    var income = this.income;
    new Ajax.Request('ajax_buildings.php', {
        method: 'post',
        parameters: {
            b_id: building_id,
            updateWorkers: this.workers
        },
        onSuccess: function (transport) {
            //New pop comes from here
            var data = transport.responseText.evalJSON(true);
            $("countPop").update(data.new_pop);
            $("countGold").update(numberFormat(data.gold));
            $("countIron").update(numberFormat(data.iron));
            $("countWood").update(numberFormat(data.wood));
            $("countFood").update(numberFormat(data.food));
            kwModalManager.getMaxObject().hide();
            showTooltip = 1;
        }
    });
    Event.stop(event);//Prevent the default event behaviour
}blacksmithSlider.prototype.sliderChanges = sliderChanges;
blacksmithSlider.prototype.saveWorkers = saveWorkers;