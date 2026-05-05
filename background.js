// run sender: triggers content.js when the toolbar icon is clicked
chrome.action.onClicked.addListener(tab => {
	chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
		chrome.tabs.sendMessage(tabs[0].id, { run: 'true' }, {});
	});
});


// fetch proxy: content.js requests images one at a time as base64 strings
// (fetching must happen here to bypass CORS — background requests are extension-origin)
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	if (request.fetchImage) {
		fetch(request.url)
			.then(response => {
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				return response.arrayBuffer();
			})
			.then(buffer => {
				// ArrayBuffers sent via sendResponse arrive detached (zero bytes) due to
				// a Chrome structured-clone limitation between service worker and content
				// script contexts. Encode as base64 in 32 KB chunks to avoid stack overflow.
				const uint8 = new Uint8Array(buffer);
				const chunks = [];
				for (let i = 0; i < uint8.length; i += 0x8000) {
					chunks.push(String.fromCharCode(...uint8.subarray(i, i + 0x8000)));
				}
				sendResponse({ ok: true, base64: btoa(chunks.join('')), byteLength: uint8.length });
			})
			.catch(err => sendResponse({ ok: false, error: err.message }));
		return true; // keep channel open for async response
	}
});
