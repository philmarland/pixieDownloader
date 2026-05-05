let running = false;
let autoScrolling = true;
let status;
let albumZip;


// run receiver: extension is triggered by a message from background.js
chrome.runtime.onMessage.addListener(
	function(request, sender, sendResponse) {
		if (request.run == 'true') {
			if (running) {
				alert('There is a download already in progress!');
			} else {
				running = true;
				init();
			}
		}
	}
);


function init() {
	const compatCheck = (document.getElementById('meta_og_site_name').content.toUpperCase() == 'PIXIESET');

	if (!compatCheck) {
		alert("This doesn't look like a Pixieset website.");
		running = false;
	} else {
		if (!document.getElementById('statusText')) {
			// add status text to navbar
			let nav = document.evaluate(
				'//div[@id="nav-icon-buttons" and @class="pull-right"]',
				document, null, XPathResult.ANY_TYPE, null
			);
			if (nav) {
				nav = nav.iterateNext();

				let div = document.createElement('div');
				div.className = 'nav-buy-photos__container';
				div.innerHTML = `
					<a id="statusText" title="pixieDownloader" style="cursor: default; font-weight: bold; font-size: 15px" class="nav-buy-photos">Ready</a></div>
					<span class="f-24 spacer-right-15 spacer-left-15 bl o-20"></span>
				`;
				nav.insertBefore(div, nav.firstChild);
				status = document.getElementById('statusText');
			}
		}

		if (autoScrolling) {
			// scroll to the bottom to load all images in the current album
			setStatus('Scrolling...', '#45b0e6');
			let lastScrollHeight = 0;
			function autoScroll() {
				let scrollHeight = document.documentElement.scrollHeight;
				if (scrollHeight != lastScrollHeight) {
					lastScrollHeight = scrollHeight;
					document.documentElement.scrollTop = scrollHeight;
				}
			}
			window.setInterval(autoScroll, 50);
		}

		// initialize JSZip object
		albumZip = new JSZip();

		// give it some time to (hopefully) finish completely scrolling/loading first
		setTimeout(() => { zip() }, 2000);
	}
}


// helper function to update navbar status text
function setStatus(text, color = null) {
	status.style.color = color;
	status.innerText = text;
}


async function zip() {
	setStatus('Preparing...', '#45b0e6');

	// locate all <img> elements
	const container = document.getElementById('gamma-container');
	const imgElements = container.getElementsByTagName('img');

	const re_imgUrl = /(.*images.pixieset.*-)(.*)(.jpg)/;

	let imgObjects = [];

	for (let i = 0; i < imgElements.length; i++) {
		const currEle = imgElements[i];
		const currSrc = currEle.currentSrc;

		// filter out irrelevant images (i.e. site assets)
		if (currSrc.match(re_imgUrl)) {
			// obtain largest size available ('xxlarge')
			const newUrl = currSrc.replace(re_imgUrl, '$1xxlarge$3');
			// obtain original filename
			const origName = currEle.alt;

			imgObjects.push({ url: newUrl, name: origName });
		}
	}

	console.log(`pixieDownloader: found ${imgObjects.length} images`);

	// set default ZIP filename — combination of window title and current album
	let albumName = window.location.pathname.split('/');
	albumName = albumName.pop() || albumName.pop();
	let zipName = document.title + ' - ' + albumName;

	// fetch each image via background.js (which bypasses CORS) as an ArrayBuffer,
	// one at a time — avoids both the base64 overhead and the 64MB message limit
	let failed = 0;
	for (let i = 0; i < imgObjects.length; i++) {
		const obj = imgObjects[i];
		const num = i + 1;
		setStatus(`Photo ${num} / ${imgObjects.length}`, '#eca142');
		console.log(`pixieDownloader: (${num}/${imgObjects.length}) fetching ${obj.url}`);

		const result = await new Promise(resolve => {
			chrome.runtime.sendMessage({ fetchImage: true, url: obj.url }, resolve);
		});

		if (result && result.ok) {
			console.log(`pixieDownloader: (${num}/${imgObjects.length}) ${obj.name} — ${(result.buffer.byteLength / 1024).toFixed(1)} KB`);
			albumZip.file(obj.name, result.buffer);
		} else {
			failed++;
			console.warn(`pixieDownloader: (${num}/${imgObjects.length}) failed to fetch ${obj.url} — ${result?.error}`);
		}
	}

	if (failed > 0) {
		console.warn(`pixieDownloader: ${failed} image(s) could not be downloaded`);
	}

	download(albumZip, zipName, true);
}


function download(zip, name, ask) {
	setStatus('Zipping...', '#45b0e6');

	zip.generateAsync(
		{ type: 'blob' },
		metadata => {
			setStatus(`Zipping ${Math.round(metadata.percent)}%...`, '#45b0e6');
		}
	).then(blob => {
		if (ask) {
			name = prompt('What should the name of the ZIP file be?', name);
			if (name === null) {
				setStatus('Cancelled', '#e71d1d');
				running = false;
				return;
			}
		}

		// https://stackoverflow.com/a/9834261
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.style.display = 'none';
		a.href = url;
		a.download = name + '.zip';
		document.body.appendChild(a);
		a.click();
		window.URL.revokeObjectURL(url);

		setStatus('Finished', '#37ae3d');
		running = false;
	});
}
