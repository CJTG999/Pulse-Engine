// --- VOLUME SLIDER CONTROLS ---
['inst', 'voc', 'hit'].forEach(v => {
    const input = document.getElementById(`vol-${v}`);
    const display = document.getElementById(`vol-${v}-val`);
    input.oninput = () => {
        const val = parseFloat(input.value); 
        display.innerText = Math.round(val * 100) + '%';
        if (v === 'inst') instGain.gain.setTargetAtTime(val, audioCtx.currentTime, 0.05);
        if (v === 'voc') vocGain.gain.setTargetAtTime(val, audioCtx.currentTime, 0.05);
        if (v === 'hit') hitGain.gain.setTargetAtTime(val, audioCtx.currentTime, 0.05);
    };
});

// --- MANUAL ASSETS UPLOADS ---
document.getElementById('inst-up').onchange = async (e) => {
    if (!e.target.files[0]) return;
    showToast("Decoding Instrumental...");
    instBuf = await decodeAudio(await e.target.files[0].arrayBuffer());
    updateStartBtn();
    showToast("Inst Loaded");
};

document.getElementById('voc-up').onchange = async (e) => {
    if (!e.target.files[0]) return;
    showToast("Decoding Vocals...");
    vocBuf = await decodeAudio(await e.target.files[0].arrayBuffer());
    showToast("Vocals Loaded");
};

document.getElementById('chart-up').onchange = (e) => {
    if (!e.target.files[0]) return;
    const reader = new FileReader();
    reader.onload = (ev) => { 
        try { 
            parseChart(JSON.parse(ev.target.result)); 
            showToast("Chart Loaded"); 
        } catch(err) { showToast("Invalid Chart JSON"); } 
    };
    reader.readAsText(e.target.files[0]);
};

document.getElementById('zip-up').onchange = async (e) => {
    if (!e.target.files[0]) return;
    showToast("Reading ZIP...");
    try {
        const zip = await JSZip.loadAsync(e.target.files[0]);
        let i, v, c;
        for (let name in zip.files) {
            const l = name.toLowerCase();
            if (l.includes('inst')) i = zip.files[name];
            else if (l.includes('voc')) v = zip.files[name];
            else if (l.endsWith('.json')) c = zip.files[name];
        }
        if (i) instBuf = await decodeAudio(await i.async("arraybuffer"));
        if (v) vocBuf = await decodeAudio(await v.async("arraybuffer"));
        if (c) parseChart(JSON.parse(await c.async("string")));
        updateStartBtn();
        showToast("ZIP Assets Extracted");
    } catch(err) { showToast("Error reading ZIP"); }
};

// --- DYNAMIC PEM EXTRACTOR PORTAL ---
document.getElementById('pem-up').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    showToast("Parsing PEM Archive...");
    try {
        const pemZip = await JSZip.loadAsync(file);
        const pemId = `pem_${pemCounter++}`;
        loadedPems[pemId] = pemZip;

        let songListText = "";
        const songListFile = pemZip.file("songlist.txt");
        
        if (songListFile) {
            songListText = await songListFile.async("text");
        } else {
            const detectedFolders = new Set();
            pemZip.forEach((relativePath) => {
                const parts = relativePath.split('/');
                if (parts.length > 1 && parts[0] !== "") {
                    detectedFolders.add(parts[0]);
                }
            });
            songListText = Array.from(detectedFolders).join('\n');
        }

        const songNames = songListText.split('\n').map(s => s.trim()).filter(s => s.length > 0);
        const select = document.getElementById('preset-select');

        let loadedChartsCount = 0;

        for (const rawSongName of songNames) {
            const cleanSong = rawSongName.toLowerCase().replace(/\s+/g, '-');
            const versionsFile = pemZip.file(new RegExp(`${cleanSong}/versions.txt$`, 'i')) || 
                                 pemZip.file(new RegExp(`${rawSongName}/versions.txt$`, 'i'));

            if (versionsFile) {
                const versionsText = await versionsFile.async("text");
                const lines = versionsText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

                for (const line of lines) {
                    const parts = line.split(',').map(p => p.trim());
                    if (parts.length > 1) {
                        const version = parts[0];
                        const difficulties = parts.slice(1);

                        for (const diff of difficulties) {
                            const option = document.createElement('option');
                            option.value = `pem|${pemId}|${cleanSong}|${version}|${diff}`;
                            option.innerText = `[PEM] ${rawSongName.toUpperCase()} (${version} - ${diff})`;
                            select.appendChild(option);
                            loadedChartsCount++;
                        }
                    }
                }
            } else {
                const folderRegex = new RegExp(`^${cleanSong}/`, 'i');
                const matchedFiles = pemZip.file(folderRegex);
                
                for (const chartFile of matchedFiles) {
                    if (chartFile.name.endsWith('.json') && !chartFile.name.includes('metadata')) {
                        const fileName = chartFile.name.split('/').pop().replace('.json', '');
                        const option = document.createElement('option');
                        option.value = `pem_fallback|${pemId}|${cleanSong}|${fileName}`;
                        option.innerText = `[PEM] ${rawSongName.toUpperCase()} (${fileName})`;
                        select.appendChild(option);
                        loadedChartsCount++;
                    }
                }
            }
        }

        if (loadedChartsCount > 0) {
            showToast(`PEM Loaded! Added ${loadedChartsCount} dynamic presets.`);
        } else {
            showToast("No playable JSON charts detected inside PEM structure.", true);
        }

    } catch (err) {
        console.error(err);
        showToast("Error processing .pem file archive.", true);
    }
};

// --- PRESET DROPDOWN STATE CONTROLLER ---
document.getElementById('preset-select').onchange = async (e) => {
    const val = e.target.value;
    if (!val) return;

    if (val.startsWith("pem|") || val.startsWith("pem_fallback|")) {
        const parts = val.split('|');
        const isFallback = parts[0] === 'pem_fallback';
        
        const pemId = parts[1];
        const songName = parts[2];
        const pemZip = loadedPems[pemId];

        if (!pemZip) return showToast("PEM Archive Context Lost!", true);

        showToast(`Extracting ${songName}...`);
        try {
            let chartFile, audioFile;

            if (isFallback) {
                const fileName = parts[3];
                chartFile = pemZip.file(new RegExp(`${songName}/${fileName}\\.json$`, 'i'));
                audioFile = pemZip.file(new RegExp(`${songName}/${songName}-default\\.mp3$`, 'i')) ||
                            pemZip.file(new RegExp(`${songName}/${songName}-default\\.wav$`, 'i')) ||
                            pemZip.file(new RegExp(`${songName}/${songName}\\.(mp3|wav|ogg)$`, 'i'));
            } else {
                const version = parts[3];
                const diff = parts[4];

                chartFile = pemZip.file(new RegExp(`${songName}/${version}-${diff}\\.json$`, 'i'));
                audioFile = pemZip.file(new RegExp(`${songName}/${songName}-${version}\\.(mp3|wav|ogg)$`, 'i'));
            }

            if (!chartFile || !audioFile) {
                throw new Error("Target file layouts not found inside PEM bundle.");
            }

            const chartData = JSON.parse(await chartFile.async("text"));
            parseChart(chartData);

            instBuf = await decodeAudio(await audioFile.async("arraybuffer"));
            vocBuf = null; 

            updateStartBtn();
            showToast("PEM Track Ready!");

        } catch (err) {
            console.error(err);
            showToast("Failed to load selected PEM chart configuration.", true);
        }
        return;
    }

    const folder = val;
    if (!folder || !globalPresetsZip) return;
    showToast(`Loading ${folder}...`);
    try {
        instBuf = await findAndDecodeAudioFromZip(folder, ['Inst']);
        vocBuf = await findAndDecodeAudioFromZip(folder, ['Vocals', 'Voices']);
        
        const chartRegex = new RegExp(`${folder}/.*\\.json$`, 'i');
        const chartFiles = globalPresetsZip.file(chartRegex);
        
        if (chartFiles.length > 0) {
            parseChart(JSON.parse(await chartFiles[0].async("string")));
            showToast("Preset Ready!");
        } else {
            showToast("Error: No .json chart found in this folder!");
        }
    } catch (err) { 
        console.error(err);
        showToast("Error loading preset files."); 
    }
};

// --- CUSTOM CHARACTER DIRECTORY UPLOADERS ---
document.getElementById('char-folder-up').onchange = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let imgFile = null, xmlFile = null, jsonFile = null;

    for (let file of files) {
        const name = file.name.toLowerCase();
        if (name.endsWith('.png')) imgFile = file;
        else if (name.endsWith('.xml')) xmlFile = file;
        else if (name.endsWith('.json')) jsonFile = file;
    }

    if (!imgFile || !xmlFile) {
        return showToast("Folder needs at least a PNG and XML!");
    }

    showToast("Processing Character Folder...");
    bfImg.src = URL.createObjectURL(imgFile);

    const xmlReader = new FileReader();
    xmlReader.onload = (ev) => {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(ev.target.result, "text/xml");
            const subTextures = xmlDoc.getElementsByTagName("SubTexture");

            targetAnims.forEach(k => bfFrames[k] = []); 

            for (let i = 0; i < subTextures.length; i++) {
                const st = subTextures[i];
                const name = st.getAttribute('name').toLowerCase();
                const frameData = {
                    x: parseInt(st.getAttribute('x')), y: parseInt(st.getAttribute('y')),
                    w: parseInt(st.getAttribute('width')), h: parseInt(st.getAttribute('height')),
                    fx: parseInt(st.getAttribute('frameX') || 0), fy: parseInt(st.getAttribute('frameY') || 0)
                };

                for (let anim of targetAnims) {
                    if (name.includes(anim.toLowerCase())) {
                        bfFrames[anim].push(frameData);
                        break;
                    }
                }
            }
            bfLoaded = true;

            if (jsonFile) {
                const jsonReader = new FileReader();
                jsonReader.onload = (jev) => {
                    try {
                        const charJson = JSON.parse(jev.target.result);
                        bfOffsets = {};
                        
                        const mapOffsets = (animName, offsetX, offsetY) => {
                            let matchKey = targetAnims.find(k => animName.toLowerCase().includes(k.toLowerCase()));
                            if (matchKey) bfOffsets[matchKey] = { x: offsetX, y: offsetY };
                            else bfOffsets[animName] = { x: offsetX, y: offsetY };
                        };

                        if (charJson.animations) {
                            charJson.animations.forEach(anim => mapOffsets(anim.anim, anim.offsets[0], anim.offsets[1]));
                        } else {
                            for (let key in charJson) {
                                if (Array.isArray(charJson[key])) mapOffsets(key, charJson[key][0], charJson[key][1]);
                            }
                        }
                        showToast("Character + Offsets Loaded!");
                    } catch(err) {
                        showToast("Loaded, but JSON is invalid");
                    }
                };
                jsonReader.readAsText(jsonFile);
            } else {
                showToast("Character Loaded! (No Offsets)");
            }
        } catch(err) {
            showToast("Invalid Character XML");
        }
    };
    xmlReader.readAsText(xmlFile);
};

// --- INDIVIDUAL CHARACTER ASSET IMPORTS ---
document.getElementById('char-img-up').onchange = (e) => {
    if (!e.target.files[0]) return;
    bfImg.src = URL.createObjectURL(e.target.files[0]);
    showToast("Custom PNG Loaded");
};

document.getElementById('char-xml-up').onchange = (e) => {
    if (!e.target.files[0]) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(ev.target.result, "text/xml");
            const subTextures = xmlDoc.getElementsByTagName("SubTexture");

            targetAnims.forEach(k => bfFrames[k] = []);

            for (let i = 0; i < subTextures.length; i++) {
                const st = subTextures[i];
                const name = st.getAttribute('name').toLowerCase();
                const frameData = {
                    x: parseInt(st.getAttribute('x')), y: parseInt(st.getAttribute('y')),
                    w: parseInt(st.getAttribute('width')), h: parseInt(st.getAttribute('height')),
                    fx: parseInt(st.getAttribute('frameX') || 0), fy: parseInt(st.getAttribute('frameY') || 0)
                };

                for (let anim of targetAnims) {
                    if (name.includes(anim.toLowerCase())) {
                        bfFrames[anim].push(frameData);
                        break;
                    }
                }
            }
            bfLoaded = true;
            showToast("Custom XML Parsed!");
        } catch(err) {
            showToast("Invalid Character XML");
        }
    };
    reader.readAsText(e.target.files[0]);
};

document.getElementById('char-json-up').onchange = (e) => {
    if (!e.target.files[0]) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const charJson = JSON.parse(ev.target.result);
            bfOffsets = {}; 
            
            const mapOffsets = (animName, offsetX, offsetY) => {
                let matchKey = targetAnims.find(k => animName.toLowerCase().includes(k.toLowerCase()));
                if (matchKey) bfOffsets[matchKey] = { x: offsetX, y: offsetY };
                else bfOffsets[animName] = { x: offsetX, y: offsetY };
            };

            if (charJson.animations) {
                charJson.animations.forEach(anim => mapOffsets(anim.anim, anim.offsets[0], anim.offsets[1]));
            } else {
                for (let key in charJson) {
                    if (Array.isArray(charJson[key])) mapOffsets(key, charJson[key][0], charJson[key][1]);
                }
            }
            showToast("Custom Offsets Mapped!");
        } catch(err) {
            showToast("Invalid Offsets JSON");
        }
    };
    reader.readAsText(e.target.files[0]);
};

// --- GAMEPLAY CONFIG Toggles ---
document.getElementById('note-style-select').onchange = (e) => {
    noteStyle = e.target.value;
    document.getElementById('arrow-colors-ui').classList.toggle('hidden-ui', noteStyle !== 'arrows');
};

[0,1,2,3].forEach(i => {
    document.getElementById(`color-${i}`).onchange = (e) => { colors[i] = e.target.value; updateTintCache(); };
    document.getElementById(`key-${i}`).oninput = (e) => { if (e.target.value) keys[i] = e.target.value.toLowerCase(); };
});

const speedSlider = document.getElementById('speed-slider');
const speedVal = document.getElementById('speed-val');

speedSlider.oninput = (e) => {
    scrollSpeed = parseFloat(e.target.value);
    speedVal.innerText = scrollSpeed.toFixed(1);
};

document.getElementById('arrow-toggle').onclick = (e) => { useArrowKeys = !useArrowKeys; e.target.innerText = `CONTROL: ${useArrowKeys ? 'ARROWS' : 'LETTERS'}`; };
document.getElementById('scroll-toggle').onclick = (e) => { isDownscroll = !isDownscroll; e.target.innerText = `DOWNSCROLL: ${isDownscroll ? 'ON' : 'OFF'}`; };
document.getElementById('middle-toggle').onclick = (e) => { isMiddlescroll = !isMiddlescroll; e.target.innerText = `MIDDLESCROLL: ${isMiddlescroll ? 'ON' : 'OFF'}`; };
document.getElementById('bot-toggle').onclick = (e) => { isBotplay = !isBotplay; e.target.innerText = `BOTPLAY: ${isBotplay ? 'ON' : 'OFF'}`; };
document.getElementById('hitsound-toggle').onclick = (e) => { useHitSounds = !useHitSounds; e.target.innerText = `HIT SOUNDS: ${useHitSounds ? 'ON' : 'OFF'}`; };

document.getElementById('bf-toggle').onclick = (e) => {
    isBfMode = !isBfMode;
    e.target.innerText = `BF MODE: ${isBfMode ? 'ON' : 'OFF'}`;
    if (isBfMode) {
        isMiddlescroll = true;
        document.getElementById('middle-toggle').innerText = "MIDDLESCROLL: ON";
    }
};

document.getElementById('showcase-btn').onclick = () => {
    if (!instBuf) return showToast("Load a song first!");
    isShowcasing = true; isBotplay = true; 
    document.getElementById('bot-toggle').innerText = "BOTPLAY: ON";
    document.body.classList.add('showcase-active'); start();
};

startBtn.onclick = start;