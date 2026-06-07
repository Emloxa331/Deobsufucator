require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs' }});
let editor;
require(['vs/editor/editor.main'], function () {
    editor = monaco.editor.create(document.getElementById('editor-container'), {
        value: `loadstring(game:HttpGet("https://raw.githubusercontent.com/deadnegzel61/EMLOXAWARE/refs/heads/main/FBJIQFQWF"))()`,
        language: 'lua',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false }
    });
});

function logMsg(msg, type = "instance") {
    const logger = document.getElementById("logger");
    const entry = document.createElement("div");
    entry.className = `log-entry ${type}`;
    const time = new Date().toLocaleTimeString();
    entry.textContent = `[${time}] ${msg}`;
    logger.appendChild(entry);
    logger.scrollTop = logger.scrollHeight;
}

function clearInput() {
    editor.setValue("");
}

function clearAll() {
    document.getElementById("viewport").innerHTML = "";
    document.getElementById("logger").innerHTML = '<div class="log-entry system">[SİSTEM] Temizlendi.</div>';
    document.getElementById("finalOutput").value = "";
}

// Ana Başlatıcı
async function startEmulator() {
    clearAll();
    const code = editor.getValue();
    if(code.trim() === "") {
        logMsg("Lütfen çalıştırılacak bir script girin.", "warn");
        return;
    }
    
    document.getElementById("finalOutput").value = "-- Analiz ediliyor...\n";
    await processCode(code);
}

// Asenkron Kod İşleyici
async function processCode(code) {
    let finalScriptLines = [];
    
    // HTTP GET KONTROLÜ (Executor Mantığı)
    const httpRegex = /game:HttpGet\((['"])(https?:\/\/[^\1]+)\1\)/i;
    const match = code.match(httpRegex);
    
    if (match) {
        const url = match[2];
        logMsg(`[AĞ İSTEĞİ] Dış bağlantı saptandı: ${url}`, "http");
        try {
            logMsg("Bağlantıdan script indiriliyor (Executor Simülasyonu)...", "warn");
            const response = await fetch(url);
            if (!response.ok) throw new Error("HTTP " + response.status);
            
            const fetchedCode = await response.text();
            logMsg("[BAŞARILI] Script başarıyla çekildi. Sanallaştırma başlıyor...", "system");
            
            // Çekilen kodu işlemeye devam et
            code = fetchedCode;
        } catch (error) {
            logMsg(`[HATA] URL çekilemedi: ${error.message}`, "warn");
            return;
        }
    } else {
        logMsg("Yerel kod analiz ediliyor...", "system");
    }

    // SANALLAŞTIRMA VE UI OLUŞTURMA
    const lines = code.split('\n');
    let variables = {}; 
    const viewport = document.getElementById("viewport");

    lines.forEach((line) => {
        line = line.trim();
        if (line === "" || line.startsWith("--")) return;

        // 1. Instance Yakalama
        let instanceMatch = line.match(/(?:local\s+)?([a-zA-Z0-9_]+)\s*=\s*Instance\.new\("([a-zA-Z0-9_]+)"\)/);
        if (instanceMatch) {
            let varName = instanceMatch[1];
            let className = instanceMatch[2];
            logMsg(`[YENİ NESNE] ${varName} (${className})`, "instance");
            
            // Temiz koda ekle
            finalScriptLines.push(`local ${varName} = Instance.new("${className}")`);

            let el = document.createElement("div");
            if (className === "Frame" || className === "ScreenGui") el.className = "rbx-frame";
            if (className === "TextButton") el.className = "rbx-textbutton";
            if (className === "TextLabel") el.className = "rbx-textlabel";
            if (className === "UICorner") el.setAttribute("data-type", "uicorner");
            
            variables[varName] = { element: el, type: className, parent: null };
            return;
        }

        // 2. Özellik (Property) Yakalama
        let propMatch = line.match(/([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s*=\s*(.+)/);
        if (propMatch) {
            let varName = propMatch[1];
            let prop = propMatch[2];
            let value = propMatch[3];

            if (!variables[varName]) return; 
            let obj = variables[varName];
            
            logMsg(`[ÖZELLİK] ${varName}.${prop} = ${value}`, "property");
            
            // Temiz koda ekle
            finalScriptLines.push(`${varName}.${prop} = ${value}`);

            // Arayüz Çizimi
            if (prop === "Size" && value.includes("UDim2.new")) {
                let nums = value.match(/[-]?\d+(\.\d+)?/g);
                if(nums && nums.length >= 4) {
                    obj.element.style.width = nums[1] + "px";
                    obj.element.style.height = nums[3] + "px";
                }
            }
            else if (prop === "Position" && value.includes("UDim2.new")) {
                let nums = value.match(/[-]?\d+(\.\d+)?/g);
                // Child elementler için absolute position uygulanır. 
                // Ana frame CSS'teki Flexbox sayesinde zaten ortalanır.
                if(nums && nums.length >= 4) {
                    obj.element.style.position = "absolute";
                    obj.element.style.left = nums[1] + "px";
                    obj.element.style.top = nums[3] + "px";
                }
            }
            else if (prop === "BackgroundColor3" && value.includes("Color3.fromRGB")) {
                let nums = value.match(/\d+/g);
                if(nums && nums.length >= 3) {
                    obj.element.style.backgroundColor = `rgb(${nums[0]}, ${nums[1]}, ${nums[2]})`;
                }
            }
            else if (prop === "Transparency") {
                obj.element.style.opacity = 1 - parseFloat(value);
            }
            else if (prop === "Text") {
                let textVal = value.replace(/^["']|["']$/g, ""); // Başındaki sonundaki tırnakları sil
                obj.element.textContent = textVal;
            }
            else if (prop === "CornerRadius" && value.includes("UDim.new")) {
                let nums = value.match(/\d+/g);
                if(nums && nums.length >= 2) {
                    obj.cornerRadius = nums[1] + "px";
                }
            }
            else if (prop === "Parent") {
                let parentVar = value;
                if (parentVar.includes("game.CoreGui") || parentVar.includes("game.Players")) {
                    viewport.appendChild(obj.element);
                    logMsg(`[RENDER] ${varName} merkeze oturtuldu.`, "system");
                } else if (variables[parentVar]) {
                    if (obj.type === "UICorner") {
                        variables[parentVar].element.style.borderRadius = obj.cornerRadius || "8px";
                    } else {
                        variables[parentVar].element.appendChild(obj.element);
                    }
                }
            }
        }
    });

    // Analiz bitince Temiz Kodu output ekranına yaz
    finalScriptLines.push("\n-- EMLOXA V3 Tarafından Başarıyla Deobfuscate Edildi.");
    document.getElementById("finalOutput").value = finalScriptLines.join("\n");
    logMsg("Analiz tamamlandı. Temiz kod hazır.", "warn");
}
