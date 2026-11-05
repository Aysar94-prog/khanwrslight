function get_building_info(element,b_id){
	var attributes=element.attributes;
	var displayed=attributes.getNamedItem("displayed").value; 
	if(parseInt(displayed)==0){
		b_id=parseInt(b_id);
		new Ajax.Request('get_building_tooltip.php',{
			method: 'post',
			parameters: {b_id: b_id},
			onSuccess: function(transport){
			//<div class="buildInfo" title="header=[{t}Required buildings{/t}] body=[<span class='tinyBuild'><img src='img/buildings/tiny/1.jpg' /> Building name here <small>5 level</small></span> <span class='tinyBuild'><img src='img/buildings/tiny/2.jpg' /> Building name here <small>5 level</small></span> <span class='tinyBuild'><img src='img/buildings/tiny/3.jpg' /> Building name here <small>5 level</small></span>]"></div>
				var info=transport.responseText.split('#;#');
				var header=info[0];
				var body=info[1];
				element.title="header=["+header+"] body=["+body+"]";
				//title="header=["+lang[0]+"] body=["+xmlHttp.responseText+"] cssbody=[help_bdy] cssheader=[help_hdr]";
				//document.getElementById("page-help").title=title;
				scanBO(element);
				applyStyles();
				attributes.getNamedItem("displayed").value=1;
			} 
		});
	}
}
function get_building_tooltip(element,b_id){
	var attributes=element.attributes;
	var displayed=attributes.getNamedItem("displayed").value;
	if(parseInt(displayed)==0){
		b_id=parseInt(b_id);
		new Ajax.Request('get_building_tooltip.php',{
			method: 'post',
			parameters: {overview_b_id: b_id},
			onSuccess: function(transport){
				var info=transport.responseText.split('#;#');
				var header=info[0];
				var body=info[1];
				//Get old header
				element.boBDY=body;
				element.boHDR=header;
				element.hasBox=1;
				element.title='';
				if(showTooltip)
					showBox();
				//element.title="header=["+element.boHDR+"] body=["+body+"]";
				//scanBO(element);
				//applyStyles();
				attributes.getNamedItem("displayed").value=1;
			}
		});
	}
}