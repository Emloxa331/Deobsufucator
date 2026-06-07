require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs' }});
let editor;

require(['vs/editor/editor.main'], function () {
    editor = monaco.editor.create(document.getElementById('editor-container'), {
        value: `loadstring(game:HttpGet("https://raw.githubusercontent.com/deadnegzel61/EMLOXAWARE/main/FBJIQFQWF"))()`,
        language: 'lua',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false }
    });
});

// Günlük (Log) Yazdırma Fonksiyonu
function logMsg(msg, type = "instance") {
    const logger = document.getElementById("logger");
    const entry = document.createElement("div");
    entry.className = `log-entry ${type}`;
    const time = new Date().toLocaleTimeString();
    entry.textContent = `[${time}] ${msg}`;
    logger.appendChild(entry);
    logger.scrollTop = logger.scrollHeight;
}

// Global (Her yerden erişilebilir) buton fonksiyonları
window.clearInput = function() {
    if(editor) editor.setValue("");
    logMsg("Girdi alanı temizlendi.", "system");
};

window.clearAll = function() {
    document.getElementById("viewport").innerHTML = "";
    document.getElementById("logger").innerHTML = '<div class="log-entry system">[SİSTEM] Tüm ortam sıfırlandı.</div>';
    document.getElementById("finalOutput").value = "";
};

window.startEmulator = async function() {
    try {
        if(!editor) {
            logMsg("[HATA] Editör henüz yüklenmedi, lütfen bekleyin.", "warn");
            return;
        }

        window.clearAll();
        let code = editor.getValue();
        
        if(code.trim() === "") {
            logMsg("Çalıştırılacak script bulunamadı!", "warn");
            return;
        }
        
        document.getElementById("finalOutput").value = "-- Analiz ediliyor...\n";
        await processCode(code);

    } catch (error) {
        logMsg(`[SİSTEM HATASI] Motor çöktü: ${error.message}`, "warn");
    }
};

// Asenkron Deobfuscation Motoru
async function processCode(code) {
    let finalScriptLines = [];
    
    // HTTP GET KONTROLÜ
    const httpRegex = /game:HttpGet\((['"])(https?:\/\/[^\1]+)\1\)/i;
    const match = code.match(httpRegex);
    
    if (match) {
        const url = match[2];
        logMsg(`[AĞ İSTEĞİ] Dış bağlantı saptandı: ${url}`, "http");
        try {
            logMsg("Bağlantıdan script indiriliyor...", "warn");
            // GitHub Raw linklerinden CORS hatası almamak için fetch
            const response = await fetch(url);
            if (!response.ok) throw new Error("Sayfa bulunamadı (HTTP " + response.status + ")");
            
            code = await response.text();
            logMsg("[BAŞARILI] Script başarıyla çekildi. Sanallaştırma başlıyor...", "system");
        } catch (error) {
            logMsg(`[BAĞLANTI HATASI] Linkten kod çekilemedi: ${error.message}`, "warn");
            logMsg("Lütfen linkin doğru (Raw) olduğuna veya internetinizin açık olduğuna emin olun.", "system");
            return; // Çekemezse analizi durdur
        }
    } else {
        logMsg("Sadece yerel kod analiz ediliyor...", "system");
    }

    // LUAU KOD ANALİZİ VE SANALLAŞTIRMA
    const lines = code.split('\n');
    let variables = {}; 
    const viewport = document.getElementById("viewport");

    lines.forEach((line) => {
        line = line.trim();
        if (line === "" || line.startsWith("--")) return;

        try {
            // 1. Obje Oluşturma (Instance.new)
            let instanceMatch = line.match(/(?:local\s+)?([a-zA-Z0-9_]+)\s*=\s*Instance\.new\("([a-zA-Z0-9_]+)"\)/);
            if (instanceMatch) {
                let varName = instanceMatch[1];
                let className = instanceMatch[2];
                logMsg(`[NESNE] ${varName} (${className}) oluşturuldu.`, "instance");
                finalScriptLines.push(`local ${varName} = Instance.new("${className}")`);

                let el = document.createElement("div");
                if (className === "Frame" || className === "ScreenGui" || className === "ScrollingFrame") el.className = "rbx-frame";
                if (className === "TextButton") el.className = "rbx-textbutton";
                if (className === "TextLabel") el.className = "rbx-textlabel";
                if (className === "UICorner") el.setAttribute("data-type", "uicorner");
                
                variables[varName] = { element: el, type: className, parent: null };
                return;
            }

            // 2. Özellik Değiştirme
            let propMatch = line.match(/([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s*=\s*(.+)/);
            if (propMatch) {
                let varName = propMatch[1];
                let prop = propMatch[2];
                let value = propMatch[3];

                if (!variables[varName]) return; 
                let obj = variables[varName];
                
                logMsg(`[DEĞİŞİM] ${varName}.${prop} ayarlandı.`, "property");
                finalScriptLines.push(`${varName}.${prop} = ${value}`);

                // Arayüz motoru çizimleri
                if (prop === "Size" && value.includes("UDim2.new")) {
                    let nums = value.match(/[-]?\d+(\.\d+)?/g);
                    if(nums && nums.length >= 4) {
                        obj.element.style.width = nums[1] + "px";
                        obj.element.style.height = nums[3] + "px";
                    }
                }
                else if (prop === "Position" && value.includes("UDim2.new")) {
                    let nums = value.match(/[-]?\d+(\.\d+)?/g);
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
                else if (prop === "Transparency" || prop === "BackgroundTransparency") {
                    obj.element.style.opacity = 1 - parseFloat(value);
                }
                else if (prop === "Text") {
                    let textVal = value.replace(/^["']|["']$/g, ""); 
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
                    if (parentVar.includes("game.CoreGui") || parentVar.includes("game.Players") || parentVar.includes("Workspace")) {
                        viewport.appendChild(obj.element);
                        logMsg(`[RENDER] ${varName} sanal ekrana çizildi.`, "system");
                    } else if (variables[parentVar]) {
                        if (obj.type === "UICorner") {
                            variables[parentVar].element.style.borderRadius = obj.cornerRadius || "8px";
                            variables[parentVar].element.style.overflow = "hidden";
                        } else {
                            variables[parentVar].element.appendChild(obj.element);
                        }
                    }
                }
            }
        } catch (e) {
            // Kodun o satırında bir hata varsa es geç ve devam et
            console.error("Satır hatası:", e);
        }
    });

    finalScriptLines.push("\n-- EMLOXA V3 Tarafından Başarıyla Deobfuscate Edildi.");
    document.getElementById("finalOutput").value = finalScriptLines.join("\n");
    logMsg("Analiz tamamlandı. Temiz kod (Output) kısmına yazdırıldı.", "warn");
}
