'use strict';

function WhitePortal() {
	var self = this;
	this.modalWnd = new kwModal({
		'placeholder': 'whitePortalContainer',
		'width': 830
	});
	var data = {'act': 'load'};
	if ($('whitePortalSlot')) {
		$('whitePortalSlot').stopObserving().observe('click', function(event) {
				removeTutorialPointers();
				self.loadContent(data);
			}
		);
	}
}


WhitePortal.prototype.loadContent = function(data) {
	var self = this;
	//console.log('called loadContent()');
	if (typeof data !== 'object') {
		data = {};
	}
	new Ajax.Request('ajax_whitePortal.php', {
		method: 'post',
		parameters: data,
		onSuccess: function(transport) {
			var response = transport.responseText.evalJSON(true);
			//console.log(response);
			if (response.data.reloadUIContent) {
				self.modalWnd.updateContent(response.contentHtml);
			}
			self.modalWnd.show();
			self.attachEventHandlers(response.data);
			
			if (response.errorMsg && response.errorMsg != '') {
				if (response.error) {
					var type = 'error';
				} else {
					var type = '';
				}
				kwModal.info(response.errorMsg, null, type);
			}
		}
	});
};

WhitePortal.prototype.attachEventHandlers = function(responseData) {
	var self = this;
	if ($('claimReward') && responseData.enableClaim) {
		$('claimReward').show();
		$('claimReward').stopObserving().observe('click', function(event) {
			this.hide();
			var data = {'act': 'claim'};
			self.loadContent(data);
		})
	} else {
		$('claimReward').stopObserving();
		$('claimReward').hide();
	}
};



