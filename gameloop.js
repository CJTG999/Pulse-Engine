// --- AUDIO SYSTEM INITIALIZATION ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const instGain = audioCtx.createGain();
const vocGain = audioCtx.createGain();
const hitGain = audioCtx.createGain();
const mediaDest = audioCtx.createMediaStreamDestination();

instGain.connect(audioCtx.destination);
vocGain.connect(audioCtx.destination);
hitGain.connect(audioCtx.destination);
instGain.connect(mediaDest);
vocGain.connect(mediaDest);
hitGain.connect(mediaDest);

// --- CANVAS & UI CONTEXT ---
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false }); 
const startBtn = document.getElementById('start-btn');
const startScreen = document.getElementById('start-screen');
const initScreen = document.getElementById('init-screen');
const captionBox = document.getElementById('caption-text');

canvas.width = 1280; 
canvas.height = 720;

// --- STATIC REPO ASSET LOCATIONS ---
const HITSOUND_URL = "https://codehs.com/uploads/09743623372843dc76af5b7736be6680";
const ARROW_PNG_URL = "https://codehs.com/uploads/18203ab3287b8e13f9dbfa755b53691e";
const PRESETS_ZIP_URL = "https://codehs.com/uploads/88a4105f0013f3ea174e0d94d81c130e"; 

// --- SHARED GLOBAL SYSTEM VARIABLES ---
window.globalPresetsZip = null;
window.loadedPems = {};
window.pemCounter = 0;

window.instBuf = null;
window.vocBuf = null;
window.hitSoundBuf = null;
window.instSource = null;
window.vocSource = null;

window.isPlaying = false;
window.startTime = 0;
window.songTime = 0;
window.notes = [];
window.activeNotes = [];
window.songCaptions = [];

window.scrollSpeed = 2.5;
window.isDownscroll = true;
window.isBotplay = false;
window.useHitSounds = true;
window.ghostTapping = true;
window.isMiddlescroll = false;
window.useArrowKeys = false;

window.health = 0.5;
window.score = 0;
window.combo = 0;
window.totalMisses = 0;
window.noteStyle = 'arrows';

// Capture Configs
window.isShowcasing = false;
window.mediaRecorder = null;
window.recordedChunks = [];

// Boyfriend System Coordinates
window.isBfMode = false;
window.bfLoaded = false;
window.bfOffsets = {}; 
window.bfImg = new Image();
window.bfFrames = {}; 
window.bfState = 'idle';
window.bfAnimStart = 0;
window.bfFrameIndex = 0;
window.bfLastFrameUpdate = 0;
const targetAnims = ['idle', 'singLEFT', 'singDOWN', 'singUP', 'singRIGHT', 'missLEFT', 'missDOWN', 'missUP', 'missRIGHT'];

window.comboUI = { rating: "", alpha: 0, scale: 1, yOffset: 0, isFC: true };

// Arrow UI Texture Maps
window.arrowSheet = new Image();
window.atlasData = {};
window.tintCachePlayer = [null, null, null, null];
window.tintCacheOpponent = [null, null, null, null];
window.receptorUnpressed = [null, null, null, null];
window.receptorPressed = [null, null, null, null];

// Dynamic Chip Circle Cache
window.chipSheet = new Image();
window.chipAtlas = {};
window.chipCachePlayer = [null, null, null, null];
window.chipCacheOpponent = [null, null, null, null];
window.chipReceptorUnpressed = [null, null, null, null];
window.chipReceptorPressed = [null, null, null, null];

window.keys = ['d', 'f', 'j', 'k'];
window.keyPressedState = [false, false, false, false];
window.opponentPressedState = [false, false, false, false];
window.colors = ['#C2439E', '#00FFFF', '#12FA05', '#F9393F'];
const dirNames = ['LEFT', 'DOWN', 'UP', 'RIGHT'];

// --- SHARED UTILITY SYSTEMS ---
function showToast(m) {
    const t = document.getElementById('toast');
    t.innerText = m; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
}

function updatePreloader(text, pct) {
    document.getElementById('init-text').innerText = text;
    document.getElementById('init-progress').style.width = pct + '%';
}

function updateStartBtn() {
    if (window.instBuf && window.notes.length > 0) {
        startBtn.disabled = false;
        startBtn.innerText = "START SONG";
    }
}

async function decodeAudio(data) {
    let buffer = data;
    if (typeof data === 'string') buffer = await fetch(data).then(r => r.arrayBuffer());
    return await audioCtx.decodeAudioData(buffer);
}

// --- RENDERING PIPELINE METHODS ---
function updateTintCache() {
    const lanes = ["LEFT", "DOWN", "UP", "RIGHT"];
    const chipAnimKeys = ["purple0000", "blue0000", "green0000", "red0000"];
    const chipPressKeys = ["left press0002", "down press0002", "up press0002", "right press0002"];

    lanes.forEach((name, i) => {
        const data = atlasData[name];
        const baseCanvas = document.createElement('canvas');
        baseCanvas.width = data.w; baseCanvas.height = data.h;
        const bctx = baseCanvas.getContext('2d');
        bctx.drawImage(arrowSheet, data.x, data.y, data.w, data.h, 0, 0, data.w, data.h);
        bctx.globalCompositeOperation = 'multiply';
        bctx.fillStyle = colors[i];
        bctx.fillRect(0, 0, data.w, data.h);
        bctx.globalCompositeOperation = 'destination-in';
        bctx.drawImage(arrowSheet, data.x, data.y, data.w, data.h, 0, 0, data.w, data.h);
        tintCachePlayer[i] = baseCanvas;

        const oppCanvas = document.createElement('canvas');
        oppCanvas.width = data.w; oppCanvas.height = data.h;
        const octx = oppCanvas.getContext('2d');
        octx.filter = 'grayscale(100%) brightness(50%)';
        octx.drawImage(baseCanvas, 0, 0);
        tintCacheOpponent[i] = oppCanvas;

        const recUnCanvas = document.createElement('canvas');
        recUnCanvas.width = data.w; recUnCanvas.height = data.h;
        const ructx = recUnCanvas.getContext('2d');
        ructx.globalAlpha = 0.4; ructx.filter = 'grayscale(100%)';
        ructx.drawImage(baseCanvas, 0, 0);
        receptorUnpressed[i] = recUnCanvas;

        const pad = 30; 
        const recPrCanvas = document.createElement('canvas');
        recPrCanvas.width = data.w + pad*2; recPrCanvas.height = data.h + pad*2;
        const rpctx = recPrCanvas.getContext('2d');
        rpctx.shadowBlur = 20; rpctx.shadowColor = colors[i];
        rpctx.drawImage(baseCanvas, pad, pad);
        receptorPressed[i] = { img: recPrCanvas, pad: pad };

        const cData = chipAtlas[chipAnimKeys[i]];
        const cBase = document.createElement('canvas');
        cBase.width = cData.w; cBase.height = cData.h;
        const cbctx = cBase.getContext('2d');
        cbctx.drawImage(chipSheet, cData.x, cData.y, cData.w, cData.h, 0, 0, cData.w, cData.h);
        chipCachePlayer[i] = cBase;

        const cOpp = document.createElement('canvas');
        cOpp.width = cData.w; cOpp.height = cData.h;
        const coctx = cOpp.getContext('2d');
        coctx.filter = 'grayscale(100%) brightness(50%)';
        coctx.drawImage(cBase, 0, 0);
        chipCacheOpponent[i] = cOpp;

        const cRecData = chipAtlas["white0000"];
        const crUn = document.createElement('canvas');
        crUn.width = cRecData.w; crUn.height = cRecData.h;
        const cructx = crUn.getContext('2d');
        cructx.globalAlpha = 0.4;
        cructx.drawImage(chipSheet, cRecData.x, cRecData.y, cRecData.w, cRecData.h, 0, 0, cRecData.w, cRecData.h);
        chipReceptorUnpressed[i] = crUn;

        const cPrData = chipAtlas[chipPressKeys[i]];
        const crPr = document.createElement('canvas');
        crPr.width = cPrData.w; crPr.height = cPrData.h;
        const crpctx = crPr.getContext('2d');
        crpctx.drawImage(chipSheet, cPrData.x, cPrData.y, cPrData.w, cPrData.h, 0, 0, cPrData.w, cPrData.h);
        chipReceptorPressed[i] = { img: crPr, fx: cPrData.fx, fy: cPrData.fy };
    });
}

function triggerBfAnim(anim) {
    if (!isBfMode || !bfLoaded || !bfFrames[anim] || bfFrames[anim].length === 0) return;
    bfState = anim;
    bfFrameIndex = 0;
    bfAnimStart = songTime;
}

function playHitSound() {
    if (!useHitSounds || !hitSoundBuf) return;
    const source = audioCtx.createBufferSource();
    source.buffer = hitSoundBuf;
    source.connect(hitGain); source.start(0);
}

function triggerRating(diff) {
    let r = "SH!T"; const absDiff = Math.abs(diff);
    if (absDiff < 45) r = "Sick"; else if (absDiff < 90) r = "Good"; else if (absDiff < 135) r = "Bad";
    comboUI = { rating: r, alpha: 1.0, scale: 1.4, yOffset: 0, isFC: (totalMisses === 0) };
}

function parseChart(json) {
    const data = json.song || json;
    notes = [];
    songCaptions = json.captions || [];

    scrollSpeed = data.speed || 2.5;
    document.getElementById('speed-slider').value = scrollSpeed.toFixed(1);
    document.getElementById('speed-val').innerText = scrollSpeed.toFixed(1);

    (data.notes || []).forEach(section => {
        if (!section.sectionNotes) return;
        section.sectionNotes.forEach(n => {
            const lane = n[1] % 4;
            notes.push({ time: n[0], lane: lane, isPlayer: n[1] < 4 ? section.mustHitSection : !section.mustHitSection, hit: false, missed: false, xOffset: lane * 110 });
        });
    });
    notes.sort((a,b) => a.time - b.time);
    updateStartBtn();
}

function updateCaptions(currentTime) {
    let activeText = "";
    for (let i = 0; i < songCaptions.length; i++) {
        const [start, end, text] = songCaptions[i];
        if (currentTime >= start && currentTime <= end) {
            activeText = text;
            break;
        }
    }

    if (activeText !== "") {
        captionBox.innerText = activeText;
        captionBox.style.display = "inline-block";
    } else {
        captionBox.style.display = "none";
    }
}

function drawReceptor(ctx, x, y, size, lane, style, isPressed) {
    x = Math.floor(x); y = Math.floor(y);
    const cx = x + size/2; const cy = y + size/2; const r = size * 0.45;

    if (style === 'arrows' && receptorUnpressed[lane]) {
        if (isPressed) {
            const cache = receptorPressed[lane];
            const scale = size / (cache.img.width - cache.pad*2);
            ctx.drawImage(cache.img, x - cache.pad*scale, y - cache.pad*scale, cache.img.width * scale, cache.img.height * scale);
        } else {
            const sprite = receptorUnpressed[lane];
            const scale = size / sprite.width;
            ctx.drawImage(sprite, x, y, sprite.width * scale, sprite.height * scale);
        }
        return;
    }

    if (style === 'circle' && chipReceptorUnpressed[lane]) {
        if (isPressed) {
            const cache = chipReceptorPressed[lane];
            const scale = size / 152;
            ctx.drawImage(cache.img, x + (cache.fx * scale), y + (cache.fy * scale), cache.img.width * scale, cache.img.height * scale);
        } else {
            const sprite = chipReceptorUnpressed[lane];
            const scale = size / sprite.width;
            ctx.drawImage(sprite, x, y, sprite.width * scale, sprite.height * scale);
        }
        return;
    }

    ctx.strokeStyle = isPressed ? colors[lane] + '44' : '#222';
    ctx.lineWidth = isPressed ? 12 : 4;
    ctx.fillStyle = isPressed ? colors[lane] + '44' : 'transparent';

    switch(style) {
        case 'square':
            const rs = size * 0.8; ctx.strokeRect(cx - rs/2, cy - rs/2, rs, rs);
            if (isPressed) { ctx.lineWidth = 4; ctx.strokeStyle = colors[lane]; ctx.strokeRect(cx - rs/2, cy - rs/2, rs, rs); ctx.fillRect(cx - rs/2, cy - rs/2, rs, rs); }
            break;
        case 'triangle':
            ctx.beginPath();
            const angle = [Math.PI, Math.PI/2, -Math.PI/2, 0][lane];
            for(let i=0; i<3; i++) ctx.lineTo(cx + r * Math.cos(angle + (i * 2 * Math.PI / 3)), cy + r * Math.sin(angle + (i * 2 * Math.PI / 3)));
            ctx.closePath(); ctx.stroke();
            if (isPressed) { ctx.lineWidth = 4; ctx.strokeStyle = colors[lane]; ctx.stroke(); ctx.fill(); }
            break;
    }
}

function drawNote(ctx, x, y, size, lane, style, isPlayer) {
    x = Math.floor(x); y = Math.floor(y);
    const cx = x + size/2; const cy = y + size/2; const r = size * 0.45;

    if (style === 'arrows' && tintCachePlayer[lane]) {
        const sprite = isPlayer ? tintCachePlayer[lane] : tintCacheOpponent[lane];
        const scale = size / sprite.width;
        ctx.drawImage(sprite, x, y, sprite.width * scale, sprite.height * scale);
        return;
    }

    if (style === 'circle' && chipCachePlayer[lane]) {
        const sprite = isPlayer ? chipCachePlayer[lane] : chipCacheOpponent[lane];
        const scale = size / sprite.width;
        ctx.drawImage(sprite, x, y, sprite.width * scale, sprite.height * scale);
        return;
    }

    ctx.fillStyle = isPlayer ? colors[lane] : '#444';
    switch(style) {
        case 'square': const rs = size * 0.8; ctx.fillRect(cx - rs/2, cy - rs/2, rs, rs); break;
        case 'triangle':
            ctx.beginPath();
            const angle = [Math.PI, Math.PI/2, -Math.PI/2, 0][lane];
            for(let i=0; i<3; i++) ctx.lineTo(cx + r * Math.cos(angle + (i * 2 * Math.PI / 3)), cy + r * Math.sin(angle + (i * 2 * Math.PI / 3)));
            ctx.closePath(); ctx.fill();
            break;
    }
}

// --- ENGINE STATE LOOPS ---
async function start() {
    if (!instBuf) return;
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    isPlaying = true; health = 0.5; score = 0; combo = 0; totalMisses = 0;
    activeNotes = notes.map(n => ({...n}));
    bfState = 'idle';
    
    instSource = audioCtx.createBufferSource(); instSource.buffer = instBuf; instSource.connect(instGain);
    if (vocBuf) { vocSource = audioCtx.createBufferSource(); vocSource.buffer = vocBuf; vocSource.connect(vocGain); }

    if (isShowcasing) {
        recordedChunks = [];
        const canvasStream = canvas.captureStream(60); 
        const combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...mediaDest.stream.getAudioTracks()]);
        mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm' });
        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
        mediaRecorder.onstop = () => {
            const url = URL.createObjectURL(new Blob(recordedChunks, { type: 'video/webm' }));
            const a = document.createElement('a'); a.href = url; a.download = 'FNF_Showcase.webm'; a.click();
            document.body.classList.remove('showcase-active'); isShowcasing = false;
        };
        mediaRecorder.start();
    }

    startTime = audioCtx.currentTime;
    instSource.start(0); if (vocSource) vocSource.start(0);
    startScreen.classList.add('hidden');
    requestAnimationFrame(loop);
}

function stop() {
    isPlaying = false;
    try { if(instSource) instSource.stop(); if(vocSource) vocSource.stop(); } catch(e){}
    startScreen.classList.remove('hidden');
    captionBox.style.display = "none";
    if (isShowcasing && mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
}

function loop() {
    if (!isPlaying) return;
    songTime = (audioCtx.currentTime - startTime) * 1000;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height); 
    ctx.fillStyle = '#000'; ctx.fillRect(0,0,canvas.width,canvas.height);

    updateCaptions(songTime);

    const sY = isDownscroll ? 600 : 100;
    
    let playerX = isMiddlescroll ? (isBfMode ? 600 : 465) : 740; 
    let opponentX = 140;

    opponentPressedState.fill(false);
    
    if (isShowcasing) {
        const lastNote = activeNotes[activeNotes.length - 1];
        if (lastNote && songTime > lastNote.time + 2500) { stop(); return; }
    }

    // DRAW BF
    if (isBfMode && bfLoaded) {
        if (songTime - bfLastFrameUpdate > 1000/24) { bfFrameIndex++; bfLastFrameUpdate = songTime; }
        if (bfState !== 'idle' && songTime - bfAnimStart > 500) { bfState = 'idle'; bfFrameIndex = 0; }

        const frames = bfFrames[bfState] || bfFrames['idle'];
        if (frames && frames.length > 0) {
            if (bfFrameIndex >= frames.length) bfFrameIndex = bfState === 'idle' ? 0 : frames.length - 1;
            const frame = frames[bfFrameIndex];
            
            const offX = (bfOffsets[bfState] && bfOffsets[bfState].x) ? bfOffsets[bfState].x : 0;
            const offY = (bfOffsets[bfState] && bfOffsets[bfState].y) ? bfOffsets[bfState].y : 0;
            
            const drawX = 100 - (frame.fx || 0) - offX; 
            const drawY = 200 - (frame.fy || 0) - offY;
            
            ctx.drawImage(bfImg, frame.x, frame.y, frame.w, frame.h, drawX, drawY, frame.w, frame.h);
        }
    }

    // DRAW NOTES
    for (let i = 0; i < activeNotes.length; i++) {
        const n = activeNotes[i];
        if (n.hit || n.missed) continue;
        const diff = n.time - songTime;
        if (diff > (2500 / scrollSpeed)) break; 
        const y = isDownscroll ? sY - (diff * scrollSpeed) : sY + (diff * scrollSpeed);
        
        if (diff < -150) { 
            n.missed = true; 
            if (n.isPlayer) { 
                health -= 0.08; combo = 0; totalMisses++; 
                triggerBfAnim('miss' + dirNames[n.lane]);
            } 
        }
        if (y < -100 || y > 820) continue;

        if (isBotplay && n.isPlayer && diff <= 0) { 
            n.hit = true; playHitSound(); combo++; triggerRating(0); 
            keyPressedState[n.lane] = true;
            triggerBfAnim('sing' + dirNames[n.lane]);
            setTimeout(() => { keyPressedState[n.lane] = false; }, 100);
        }
        if (!n.isPlayer && diff <= 0) { n.hit = true; opponentPressedState[n.lane] = true; }
        if (!n.isPlayer && isMiddlescroll) continue;

        drawNote(ctx, (n.isPlayer ? playerX : opponentX) + n.xOffset, y, 100, n.lane, noteStyle, n.isPlayer);
    }

    // DRAW RECEPTORS
    for (let i=0; i<8; i++) {
        const lane = i % 4; const isPlayer = i >= 4;
        if (!isPlayer && isMiddlescroll) continue;
        const x = (isPlayer ? playerX : opponentX) + (lane * 110);
        const pressed = isPlayer ? keyPressedState[lane] : opponentPressedState[lane];
        drawReceptor(ctx, x, sY, 100, lane, noteStyle, pressed);
    }

    // DRAW UI OVERLAYS
    ctx.save();
    const uiX = Math.floor(canvas.width / 2); const uiY = Math.floor(canvas.height / 2 - 50);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";

    if (combo > 0) {
        ctx.fillStyle = comboUI.isFC ? "#FFD700" : "white";
        ctx.font = "bold 35px Inter"; ctx.fillText(combo, uiX, uiY + 50);
        ctx.font = "bold 12px Inter"; ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.fillText("COMBO", uiX, uiY + 75);
    }

    if (comboUI.alpha > 0) {
        ctx.globalAlpha = comboUI.alpha;
        comboUI.yOffset -= 1.5; if (comboUI.scale > 1.0) comboUI.scale -= 0.05; comboUI.alpha -= 0.018; 
        ctx.fillStyle = "white"; ctx.font = `italic bold ${Math.floor(45 * comboUI.scale)}px Inter`;
        ctx.fillText(comboUI.rating.toUpperCase(), uiX, uiY + Math.floor(comboUI.yOffset));
    }
    ctx.restore();

    ctx.fillStyle = '#111'; ctx.fillRect(340, 680, 600, 15);
    ctx.fillStyle = '#38EF7D'; ctx.fillRect(340 + (600 * (1-health)), 680, 600 * health, 15);
    
    if (health <= 0) stop();
    if (isPlaying) requestAnimationFrame(loop);
}

// --- CORE INPUT HANDLERS ---
window.onkeydown = (e) => {
    if (document.activeElement.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); isPlaying ? stop() : start(); return; }
    if (k === 'r') { stop(); start(); return; }

    const arrowMap = { "arrowleft": 0, "arrowdown": 1, "arrowup": 2, "arrowright": 3 };
    let lane = (useArrowKeys && arrowMap[k] !== undefined) ? (e.preventDefault(), arrowMap[k]) : keys.indexOf(k);

    if (lane !== -1) {
        keyPressedState[lane] = true;
        if (isPlaying && !isBotplay) {
            const note = activeNotes.find(n => n.isPlayer && !n.hit && n.lane === lane && Math.abs(n.time - songTime) < 160);
            if (note) { 
                note.hit = true; health = Math.min(1, health + 0.02); score += 100; combo++; 
                playHitSound(); triggerRating(note.time - songTime);
                triggerBfAnim('sing' + dirNames[lane]);
            }
            else if (!ghostTapping) { 
                health -= 0.04; combo = 0; totalMisses++; 
                triggerBfAnim('miss' + dirNames[lane]);
            }
        }
    }
};

window.onkeyup = (e) => {
    if (isBotplay) return;
    const k = e.key.toLowerCase();
    const arrowMap = { "arrowleft": 0, "arrowdown": 1, "arrowup": 2, "arrowright": 3 };
    let lane = (useArrowKeys && arrowMap[k] !== undefined) ? arrowMap[k] : keys.indexOf(k);
    if (lane !== -1) keyPressedState[lane] = false;
};

// --- AUTO RUN PREFLIGHT ON LOAD ---
async function loadBFAssetsPreflight() {
    try {
        bfImg.src = 'bf/BOYFRIEND.png'; 
        await new Promise((resolve, reject) => {
            bfImg.onload = resolve;
            bfImg.onerror = () => reject(new Error("Missing Boyfriend Texture"));
        });

        const xmlRes = await fetch('bf/BOYFRIEND.xml');
        const xmlText = await xmlRes.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const subTextures = xmlDoc.getElementsByTagName("SubTexture");

        const animMap = {
            'idle': 'BF idle dance', 'singLEFT': 'BF NOTE LEFT0', 'singDOWN': 'BF NOTE DOWN0',
            'singUP': 'BF NOTE UP0', 'singRIGHT': 'BF NOTE RIGHT0', 'missLEFT': 'BF NOTE LEFT MISS',
            'missDOWN': 'BF NOTE DOWN MISS', 'missUP': 'BF NOTE UP MISS', 'missRIGHT': 'BF NOTE RIGHT MISS'
        };

        targetAnims.forEach(k => bfFrames[k] = []);

        for (let i = 0; i < subTextures.length; i++) {
            const st = subTextures[i];
            const name = st.getAttribute('name');
            const frameData = {
                x: parseInt(st.getAttribute('x')), y: parseInt(st.getAttribute('y')),
                w: parseInt(st.getAttribute('width')), h: parseInt(st.getAttribute('height')),
                fx: parseInt(st.getAttribute('frameX') || 0), fy: parseInt(st.getAttribute('frameY') || 0)
            };

            for (let animName in animMap) {
                if (name.startsWith(animMap[animName])) {
                    bfFrames[animName].push(frameData);
                    break;
                }
            }
        }
        
        try {
            const jsonRes = await fetch('bf/bf.json');
            if (jsonRes.ok) {
                const bfJson = await jsonRes.json();
                if (bfJson.animations) {
                    bfJson.animations.forEach(anim => { bfOffsets[anim.anim] = { x: anim.offsets[0], y: anim.offsets[1] }; });
                } else {
                    for (let key in bfJson) {
                        if (Array.isArray(bfJson[key])) bfOffsets[key] = { x: bfJson[key][0], y: bfJson[key][1] };
                    }
                }
            }
        } catch(err) { }
        bfLoaded = true;
    } catch (e) { 
        console.warn("Character Loader Idle Fallback:", e);
    }
}

// Global Launcher Engine Hooks
window.onload = async () => {
    try {
        updatePreloader("Decoding UI Sounds...", 15);
        hitSoundBuf = await decodeAudio(HITSOUND_URL);
        
        updatePreloader("Loading Arrows...", 30);
        arrowSheet.src = ARROW_PNG_URL;
        await new Promise(r => arrowSheet.onload = r);
        atlasData = {
            LEFT: { x: 156, y: 237, w: 154, h: 157 }, DOWN: { x: 479, y: 234, w: 157, h: 154 },
            UP: { x: 637, y: 234, w: 157, h: 154 }, RIGHT: { x: 311, y: 237, w: 154, h: 157 }
        };

        updatePreloader("Loading Chip Assets...", 40);
        chipSheet.src = './circles/chip.png';
        await new Promise(r => chipSheet.onload = r);
        const chipXmlRes = await fetch('./circles/chip.xml');
        const chipXmlText = await chipXmlRes.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(chipXmlText, "text/xml");
        const subTextures = xmlDoc.getElementsByTagName("SubTexture");
        for (let i = 0; i < subTextures.length; i++) {
            const st = subTextures[i];
            chipAtlas[st.getAttribute('name')] = {
                x: parseInt(st.getAttribute('x')), y: parseInt(st.getAttribute('y')),
                w: parseInt(st.getAttribute('width')), h: parseInt(st.getAttribute('height')),
                fx: parseInt(st.getAttribute('frameX') || 0), fy: parseInt(st.getAttribute('frameY') || 0)
            };
        }

        updateTintCache();

        updatePreloader("Hunting for BF Assets...", 60);
        await loadBFAssetsPreflight();
        
        updatePreloader("Downloading Song Pack...", 80);
        await loadPresetsFromZip();
        
        updatePreloader("Engine Ready!", 100);
        setTimeout(() => {
            initScreen.style.opacity = '0';
            setTimeout(() => initScreen.style.display = 'none', 500);
        }, 600);

        startBtn.innerText = "AWAITING SONG SELECT";
    } catch(e) { console.error(e); updatePreloader("ERROR LOADING ENGINE", 100); }
};