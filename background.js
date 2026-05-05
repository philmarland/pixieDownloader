// run sender: triggers content.js when the toolbar icon is clicked
chrome.action.onClicked.addListener(tab => {
	chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
		chrome.tabs.sendMessage(tabs[0].id, { run: 'true' }, {});
	});
});
