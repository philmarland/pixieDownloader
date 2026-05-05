// run sender: triggers content.js when the toolbar icon is clicked
chrome.action.onClicked.addListener(tab => {
	chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
		chrome.tabs.sendMessage(tabs[0].id, { run: 'true' }, {});
	});
});


// fetch proxy: content.js requests images one at a time as ArrayBuffers
// (fetching must happen here to bypass CORS — background requests are extension-origin)
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	if (request.fetchImage) {
		fetch(request.url)
			.then(response => {
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				return response.arrayBuffer();
			})
			.then(buffer => sendResponse({ ok: true, buffer }))
			.catch(err => sendResponse({ ok: false, error: err.message }));
		return true; // keep channel open for async response
	}
});
