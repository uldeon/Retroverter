let abortConversion = false;
const outputZip = new JSZip();

const rules = {
  nds: { 
    resolution: [256,192], 
    colorDepth: 16, 
    sound: { sampleRate: 11025, bitDepth: 8 }, 
    inputMap: { A: 'A', B: 'B', X: 'X', Y: 'Y', Start: 'START', Select: 'SELECT', L: 'L', R: 'R', Up: 'UP', Down: 'DOWN', Left: 'LEFT', Right: 'RIGHT' } 
  },
  gba: { 
    resolution: [240,160], 
    colorDepth: 15, 
    sound: { sampleRate: 8192, bitDepth: 8 }, 
    inputMap: { A: 'A', B: 'B', Start: 'START', Select: 'SELECT', L: 'L', R: 'R', Up: 'UP', Down: 'DOWN', Left: 'LEFT', Right: 'RIGHT' } 
  },
  psp: { 
    resolution: [480,272], 
    colorDepth: 24, 
    sound: { sampleRate: 44100, bitDepth: 16 }, 
    inputMap: { Cross: 'X', Circle: 'O', Triangle: '△', Square: '□', Start: 'START', Select: 'SELECT', L: 'L', R: 'R', Up: 'UP', Down: 'DOWN', Left: 'LEFT', Right: 'RIGHT' } 
  },
  ps1: { 
    resolution: [320,240], 
    colorDepth: 24, 
    sound: { sampleRate: 22050, bitDepth: 16 }, 
    inputMap: { Cross: 'X', Circle: 'O', Square: '□', Triangle: '△', Start: 'START', Select: 'SELECT', L1: 'L1', R1: 'R1', L2: 'L2', R2: 'R2', Up: 'UP', Down: 'DOWN', Left: 'LEFT', Right: 'RIGHT' } 
  },
  ps2: { 
    resolution: [640,448], 
    colorDepth: 32, 
    sound: { sampleRate: 44100, bitDepth: 16 }, 
    inputMap: { Cross: 'X', Circle: 'O', Square: '□', Triangle: '△', Start: 'START', Select: 'SELECT', L1: 'L1', R1: 'R1', L2: 'L2', R2: 'R2', Up: 'UP', Down: 'DOWN', Left: 'LEFT', Right: 'RIGHT', L3: 'L3', R3: 'R3' } 
  },
  xbox: { 
    resolution: [640,480], 
    colorDepth: 32, 
    sound: { sampleRate: 44100, bitDepth: 16 }, 
    inputMap: { A: 'A', B: 'B', X: 'X', Y: 'Y', Start: 'START', Back: 'BACK', LB: 'LB', RB: 'RB', Up: 'UP', Down: 'DOWN', Left: 'LEFT', Right: 'RIGHT', LT: 'LT', RT: 'RT' } 
  },
  xbox360: { 
    resolution: [1280,720], 
    colorDepth: 32, 
    sound: { sampleRate: 48000, bitDepth: 16 }, 
    inputMap: { A: 'A', B: 'B', X: 'X', Y: 'Y', Start: 'START', Back: 'BACK', LB: 'LB', RB: 'RB', Up: 'UP', Down: 'DOWN', Left: 'LEFT', Right: 'RIGHT', LT: 'LT', RT: 'RT', L3: 'L3', R3: 'R3' } 
  },
  ps3: { 
    resolution: [1280,720], 
    colorDepth: 32, 
    sound: { sampleRate: 48000, bitDepth: 16 }, 
    inputMap: { Cross: 'X', Circle: 'O', Square: '□', Triangle: '△', Start: 'START', Select: 'SELECT', L1: 'L1', R1: 'R1', L2: 'L2', R2: 'R2', L3: 'L3', R3: 'R3', Up: 'UP', Down: 'DOWN', Left: 'LEFT', Right: 'RIGHT' } 
  },
  gamecube: { 
    resolution: [640,480], 
    colorDepth: 24, 
    sound: { sampleRate: 32000, bitDepth: 16 }, 
    inputMap: { A: 'A', B: 'B', X: 'X', Y: 'Y', Start: 'START', Z: 'Z', L: 'L', R: 'R', Up: 'UP', Down: 'DOWN', Left: 'LEFT', Right: 'RIGHT' } 
  },
  snes: { 
    resolution: [256,224], 
    colorDepth: 8, 
    sound: { sampleRate: 32000, bitDepth: 8 }, 
    inputMap: { A: 'A', B: 'B', X: 'X', Y: 'Y', Start: 'START', Select: 'SELECT', L: 'L', R: 'R', Up: 'UP', Down: 'DOWN', Left: 'LEFT', Right: 'RIGHT' } 
  }
};

function toggleTheme() {
  document.body.classList.toggle("dark");
}

function downloadConverted() {
  outputZip.generateAsync({ type: "blob" }).then(function (content) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(content);
    a.download = "converted_game.zip";
    a.click();
  });
}

function mapInputs(codeStr, inputMap) {
  for (const key in inputMap) {
    const regex = new RegExp(`\\b${key}\\b`, "g");
    codeStr = codeStr.replace(regex, inputMap[key]);
  }
  return codeStr;
}

async function processSprite(blob, [targetW, targetH]) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, targetW, targetH);
      resolve(canvas.toDataURL("image/png"));
    };
    img.src = URL.createObjectURL(blob);
  });
}

async function processSound(blob, sampleRate) {
  const ctx = new AudioContext();
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arrayBuffer);
  const offlineCtx = new OfflineAudioContext(1, sampleRate * buffer.duration, sampleRate);
  const src = offlineCtx.createBufferSource();
  src.buffer = buffer;
  src.connect(offlineCtx.destination);
  src.start();
  const renderedBuffer = await offlineCtx.startRendering();
  return audioBufferToWav(renderedBuffer);
}

async function convertGame() {
  abortConversion = false;
  const fileInput = document.getElementById("gameFile");
  const resultBox = document.getElementById("resultBox");
  const resultText = document.getElementById("resultText");
  const targetConsole = document.getElementById("console").value;

  if (!fileInput.files.length) {
    alert("Veuillez sélectionner un fichier de jeu compressé.");
    return;
  }

  const rule = rules[targetConsole];
  if (!rule) {
    alert("Console non supportée.");
    return;
  }

  const file = fileInput.files[0];
  resultBox.style.display = "block";
  resultText.innerText = `📦 Décompression de ${file.name}...`;

  const extension = file.name.split(".").pop().toLowerCase();
  let archiveFiles = {};

  if (extension === "zip") {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    for (const fileName in zip.files) {
      archiveFiles[fileName] = await zip.files[fileName].async("uint8array");
    }
  } else if (extension === "rar") {
    const extractor = await window.Unrar.createExtractorFromData({ data: new Uint8Array(await file.arrayBuffer()) });
    const list = extractor.extractAll();
    list.files.forEach((f) => {
      if (f.fileHeader.flags.directory === false) {
        archiveFiles[f.fileHeader.name] = f.extractor.extract({ start: 0, end: f.fileHeader.uncompressedSize });
      }
    });
  } else if (extension === "7z") {
    const archive = await window.SevZip.archiveFromFile(file);
    const entries = await archive.getFilesArray();
    for (const entry of entries) {
      if (!entry.file.endsWith("/")) {
        archiveFiles[entry.file] = new Uint8Array(await archive.readFile(entry.file));
      }
    }
  } else if (extension === "tar") {
    const tar = new Tar();
    tar.append(file.name, await file.arrayBuffer());
    archiveFiles[file.name] = new Uint8Array(await file.arrayBuffer());
  } else {
    alert("Format de fichier non supporté pour la décompression.");
    return;
  }

  resultText.innerText = `🔍 Analyse du contenu...`;

  const spriteFiles = Object.keys(archiveFiles).filter((f) => f.match(/\.(png|bmp|gif|jpg)$/i));
  const soundFiles = Object.keys(archiveFiles).filter((f) => f.match(/\.(wav|ogg|mp3)$/i));
  const codeFiles = Object.keys(archiveFiles).filter((f) => f.match(/\.(js|json|cfg|xml|txt)$/i));

  // Check inputs usage in code files
  const requiredInputs = new Set();
  for (const fileName of codeFiles) {
    const decoder = new TextDecoder();
    const code = decoder.decode(archiveFiles[fileName]);
    const matches = code.match(/\b[A-Z]{1,5}\b/g);
    if (matches) matches.forEach((cmd) => requiredInputs.add(cmd));
  }

  const availableInputs = new Set(Object.values(rule.inputMap));
  const unsupportedInputs = Array.from(requiredInputs).filter((cmd) => !availableInputs.has(cmd));
  if (unsupportedInputs.length > 0) {
    const dialog = document.getElementById("inputWarning");
    dialog.showModal();
    return; // stop conversion until user reacts to dialog (for demo, just stop)
  }

  // Convert sprites
  for (const fileName of spriteFiles) {
    const blob = new Blob([archiveFiles[fileName]]);
    const newImg = await processSprite(blob, rule.resolution);
    outputZip.file(`sprites/${fileName}`, newImg.split(",")[1], { base64: true });
  }

  // Convert sounds
  for (const fileName of soundFiles) {
    const blob = new Blob([archiveFiles[fileName]]);
    const wav = await processSound(blob, rule.sound.sampleRate);
    outputZip.file(`audio/${fileName.replace(/\.[a-z0-9]+$/i, ".wav")}`, new Uint8Array(wav));
  }

  // Convert code inputs
  for (const fileName of codeFiles) {
    const decoder = new TextDecoder();
    const code = decoder.decode(archiveFiles[fileName]);
    const newCode = mapInputs(code, rule.inputMap);
    outputZip.file(`code/${fileName}`, newCode);
  }

  resultText.innerHTML += `<br>✅ Conversion terminée pour ${targetConsole.toUpperCase()}`;
      }
