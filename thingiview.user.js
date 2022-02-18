// ==UserScript==
// @name        Thingiview
// @namespace   https://github.com/czkz
// @match       https://www.thingiverse.com/*
// @version     1.3
// @run-at      document-end
// @require     https://cdn.jsdelivr.net/npm/p5
// @noframes
// @description Press on the image to the left of a "Download" button to open an interactive 3d preview
// @author      czkz
// @homepageURL https://github.com/czkz/thingiview
// @downloadURL https://github.com/czkz/thingiview/raw/master/thingiview.user.js
// ==/UserScript==

'use strict';

const c_zoomSpeed = 1.15;
const c_mouseSensitivity = 0.015;
const c_backgroundColor = [220];      // Same syntax as in c_modelColor
const c_useNormalMaterial = false;    // Trippy colors
const c_modelColor = [9, 106, 191];   // [grayscale] or [r, g, b] or ['red'] or ['#aabbcc']
const c_bottomPadding = 1/8;          // Fraction of sketch height to add as an empty space after the sketch


setInterval(function makeButtons() {
    document.querySelectorAll('div[class^=ThingFilesList__fileList]>div[class^=ThingFile__fileRow]').forEach((e, i) => {
        if (e.classList.contains('injectedPreviewBtn')) {
            return;
        }
        e.classList.add('injectedPreviewBtn');
        let img = e.querySelector('img') || e.querySelector('div[class^=ThingFile__fileExtentionBody]');
        let lnk = document.createElement('a');
        lnk.onclick = (e) => e.preventDefault();
        img.before(lnk);
        lnk.append(img);
        lnk.href = '#';
        let thingInfo = JSON.parse(JSON.parse(localStorage["persist:root"]).currentThing).thing.files[i];
        let container = document.createElement('div');

        let sketchW = e.offsetWidth;
        let sketchH = sketchW / 16 * 9;
        container.style = `height: ${sketchH}px; margin-bottom: ${sketchH * c_bottomPadding}px`;

        img.onclick = function() {
            img.onclick = function() { container.hidden = !container.hidden; }
            e.after(container);
            new p5(function sketchLogic(p) {
                let mdl;
                let canvas;
                let model_scale = 1;
                let zoom = 1;
                let camX = 0;
                let camY = 0;

                p.preload = function () {
                    mdl = p.loadModel(thingInfo.direct_url, true, () => {}, onLoadModelFail, thingInfo.name);
                }

                function onLoadModelFail(e) {
                    container.innerHTML = '<h1>:(</h1>';
                    container.style = 'text-align:center';
                }

                p.setup = function () {
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
}, 500);
