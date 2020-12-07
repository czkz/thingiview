// ==UserScript==
// @name        Thingiview
// @match       https://www.thingiverse.com/*
// @grant       GM_xmlhttpRequest
// @connect     cdn.thingiverse.com
// @version     1.2
// @run-at      document-end
// @noframes
// @description Press on the image to the left of a "Download" button to open an interactive 3d preview
// ==/UserScript==

'use strict';

const c_zoomSpeed = 1.15;
const c_mouseSensitivity = 0.015;
const c_backgroundColor = [220];      // Same syntax as in c_modelColor
const c_useNormalMaterial = false;    // Trippy colors
const c_modelColor = [9, 106, 191];   // [grayscale] or [r, g, b] or ['red'] or ['#aabbcc']
const c_bottomPadding = 1/8;          // Fraction of sketch height to add as an empty space after the sketch


// cdn.thingiverse.com is not configured
// to be accessible from www.thingiverse.com (but should've been),
// so the browser blocks fetch() because of CORS.
// p5.js uses fetch() to load stl files from cdn.thingiverse.com.
// That's why we have to use Greasemonkey's GM_xmlhttpRequest() wrapped in root_fetch() to bypass CORS.
function main() {
  console.log('Entered thingiview main()');
  unsafeWindow.fetch = root_fetch;
  injectScript('https://cdn.jsdelivr.net/npm/p5@1.1.9/lib/p5.js').then(function() {  // Load p5.js
    setInterval(makeButtons, 500);
  });
}
main();


function injectScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.addEventListener('load', resolve);
    script.addEventListener('error', e => reject(e.error));
    document.head.appendChild(script);
  });
}

function makeButtons() {
  document.querySelectorAll('div[class^=ThingFilesList__fileList]>div[class^=ThingFile__fileRow]').forEach(e => {
    if (e.classList.contains('injectedPreviewBtn')) {
      return;
    }
    e.classList.add('injectedPreviewBtn');
    let download_btn = e.querySelector('a[class^=ThingFile__download]');
    let img = e.querySelector('img') || e.querySelector('div[class^=ThingFile__fileExtentionBody]');
    let lnk = document.createElement('a');
    lnk.onclick = (e) => e.preventDefault();
    img.before(lnk);
    lnk.append(img);
    lnk.href = '';
    let filename = e.querySelector('div[class^=ThingFile__fileName]').getAttribute('title');
    let container = document.createElement('div');

    let sketchW = e.offsetWidth;
    let sketchH = sketchW / 16 * 9;
    container.style = `height: ${sketchH}px; margin-bottom: ${sketchH * c_bottomPadding}px`;

    img.onclick = function() {
      img.onclick = function() { container.hidden = !container.hidden; }
      e.after(container);
      console.log('creating p5 sketch...');
      new p5(function sketchLogic(p) {
        let mdl;
        let canvas;
        let model_scale = 1;
        let zoom = 1;
        let camX = 0;
        let camY = 0;

        p.preload = function () {
          mdl = p.loadModel(download_btn.href, true, () => {}, onLoadModelFail, filename);
        }

        function onLoadModelFail(e) {
          container.innerHTML = '<h1>:(</h1>';
          container.style = 'text-align:center';
        }

        p.setup = function () {
          console.log('swh', sketchW, sketchH);
          if (mdl.vertices.length == 0) {
            onLoadModelFail();
            p.draw = () => {};
            return;
          }
          canvas = p.createCanvas(sketchW, sketchH, p.WEBGL);
          canvas.mousePressed(() => p.loop());
          canvas.mouseWheel(changeZoom);
          p.noLoop();
          model_scale = p.min(p.width, p.height) / 400;
        }

        p.draw = function() {
          const mod = c_mouseSensitivity;
          if (p.isLooping()) {
            camX -= p.movedY * mod;
            camY += p.movedX * mod;
          }
          p.rotateX(camX);
          p.rotateY(camY);

          p.background(...c_backgroundColor);
          p.noStroke();
          p.scale(model_scale);
          p.scale(zoom);
          p.scale(-1.5, 1.5, 1.5);
          p.rotateX(-p.HALF_PI);
          p.rotateY(p.PI);

          if (c_useNormalMaterial) {
            p.normalMaterial();
          } else {
            p.ambientMaterial(...c_modelColor);
            p.ambientLight(100);
            //          ( r,   g,   b,    x,    y,   z )
            p.pointLight(255, 255, 255, -150, -75,  200);
            p.pointLight(255, 255, 255, +150, +150, 200);
          }
          p.model(mdl);
        }

        p.mouseReleased = function () {
          p.noLoop();
        }

        function changeZoom(e) {
          const zoomSpeed = c_zoomSpeed;
          if (event.deltaY < 0) {
            zoom *= zoomSpeed;
          } else {
            zoom /= zoomSpeed;
          }
          p.redraw();
          e.preventDefault();
        }
      }, container);
    }
  });
}


// Used in root_fetch
function parseHeaders(rawHeaders) {
  const lines = rawHeaders.split(/\s*\r\n\s*/);
  let headers = {};
  for (const e of lines) {
    let a = e.split(':');
    headers[a.shift().trim()] = a.join(':').trim();
  }
  return headers;
}

// Fetch polyfill that bypasses CORS
function root_fetch(resource, init) {
  init = init || {};
  console.log('root_fetch called');
  return new Promise((resolve, reject) => {
    if (typeof(resource) === 'string') {
      init.url = resource;
    } else {
      init = { ...resource, ...init };
      init.url = resource.url;
    }
    init.method = init.method || 'GET';
    init.responseType = 'blob';

    init.onload = function(respobj) {

      function makeResponse() {
        let headers_obj = parseHeaders(respobj.responseHeaders || '');
        console.log('response is of type', typeof(respobj.response));
        return {
          ok: (respobj.status/100|0) == 2,  // 200-299
          statusText: respobj.statusText,
          status: respobj.status,
          url: respobj.finalUrl,
          text: () => Promise.resolve(respobj.responseText),
          json: () => Promise.resolve(respobj.responseText).then(JSON.parse),
          blob: () => Promise.resolve(respobj.response),
          arrayBuffer: () => Promise.resolve(respobj.response.arrayBuffer()),
          clone: makeResponse,
          headers: {
            keys: () => Object.keys(headers_obj),
            entries: () => Object.entries(headers_obj),
            get: n => headers_obj[n.toLowerCase()],
            has: n => n.toLowerCase() in headers_obj
          }
        };
      }

      let ret = makeResponse();
      //let ret = new Response(respobj.response, makeResponse(respobj));
      console.log('root_fetch will return...');
      console.log(ret);
      console.log('with response.text()...');
      console.log(ret.text());
      return resolve(ret);
    }

    init.onerror = init.ontimeout = function() {
      setTimeout(function() {
        reject(new TypeError('Network request failed'))
      }, 0)
    }

    init.onabort = function() {
      setTimeout(function() {
        reject(new DOMException('Aborted', 'AbortError'))
      }, 0)
    }

    // Remove entries which GM_xmlhttpRequest doesn't understand
    for (const i in init) {
      if (!['url','method','user','password','overrideMimeType','headers','responseType','timeout','data','binary','context','anonymous',
        'onabort','onerror','onload','onloadend','onloadstart','onprogress','onreadystatechange','ontimeout'
      ].includes(i)) {
        delete init[i];
        console.log('root_fetch found an illegal arg: ' + i);
      }
    }

    console.log('root_fetch will send...');
    console.log(init);
    GM_xmlhttpRequest(init);
  })
}
root_fetch.polyfill = 'root_fetch';

