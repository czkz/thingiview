// ==UserScript==
// @name        Thingiview
// @match       https://www.thingiverse.com/*
// @grant       GM_xmlhttpRequest
// @connect     cdn.thingiverse.com
// @version     1.0
// @run-at      document-end
// @noframes
// @description Press on the image to the left of a "Download" button to open an interactive 3d preview
// ==/UserScript==

(function () {
  'use strict';
  
  (function() {
    function parseHeaders(rawHeaders) {
      const lines = rawHeaders.split(/\s*\r\n\s*/);
      let headers = {};
      lines.forEach(e => {
        let a = e.split(':');
        headers[a.shift().trim()] = a.join(':').trim();
      })
      return headers;
    }

    function root_fetch(resource, init = {}) {
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

          const makeResponse = (respobj) => {
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
          };

          let ret = makeResponse(respobj);
          //let ret = new Response(respobj.response, makeResponse(respobj));
          console.log('root_fetch will return...');
          console.log(ret);
          console.log('with response.text()...');
          console.log(ret.text());
          return resolve(ret);
        }

        init.onerror = function() {
          setTimeout(function() {
            reject(new TypeError('Network request failed'))
          }, 0)
        }

        init.ontimeout = function() {
          setTimeout(function() {
            reject(new TypeError('Network request failed'))
          }, 0)
        }

        init.onabort = function() {
          setTimeout(function() {
            reject(new DOMException('Aborted', 'AbortError'))
          }, 0)
        }

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

    unsafeWindow.fetch = root_fetch;
  })();



  function injectScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.addEventListener('load', resolve);
      script.addEventListener('error', e => reject(e.error));
      document.head.appendChild(script);
    });
  }

  console.log('Test Test Test...');

  injectScript('https://cdn.jsdelivr.net/npm/p5@1.1.9/lib/p5.js').then(() => {
    setInterval(function () {
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
        container.style = `height: ${sketchH}px; margin-bottom: ${sketchH/8}px`;
        
        img.onclick = function () {
          //lnk.removeAttribute('href');
          img.onclick = () => { container.hidden = !container.hidden; }
          e.after(container);
          console.log('creating p5 sketch...');
          new p5(p => {
            let mdl;
            let canvas;

            p.preload = function () {
              mdl = p.loadModel(download_btn.href, true, () => {}, onLoadModelFail, filename);
            }
            
            function onLoadModelFail(e) {
              container.innerHTML = '<h1>:(</h1>';
              container.style = 'text-align:center';
            }
            
            let model_scale = 1;
            let zoom = 1;

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
              const mod = 0.015;
              if (p.isLooping()) {
                camX -= p.movedY * mod;
                camY += p.movedX * mod;
              }
              p.rotateX(camX);
              p.rotateY(camY);

              p.background(220);
              p.noStroke();
              p.scale(model_scale);
              p.scale(zoom);
              p.scale(-1.5, 1.5, 1.5);
              p.rotateX(-p.HALF_PI);
              p.rotateY(p.PI);
              
              //p.normalMaterial();
              p.ambientMaterial(9, 106, 191);
              p.ambientLight(100);
              //p.pointLight(255, 255, 255, -150, -75, 200);
              //p.pointLight(255, 255, 255, +150, +75, 200);
              p.pointLight(255, 255, 255, -150, -75, 200);
              p.pointLight(255, 255, 255, +150, +150, 200);
              p.model(mdl);
            }

            let camX = 0,
              camY = 0;

            p.mouseReleased = function () {
              p.noLoop();
            }
            function changeZoom(e) {
              const zoomSpeed = 0.15;
              if (event.deltaY < 0) {
                zoom *= (1 + zoomSpeed);
              } else {
                zoom *= (1 - zoomSpeed);
              }
              p.redraw();
              e.preventDefault();
            }
          }, container);
        }
      })
    }, 500)
  });
})();
