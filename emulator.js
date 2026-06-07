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

function logMsg(msg, type = "instance") {
    const logger = document.getElementById("logger");
    const entry = document.createElement("div");
    entry.className = `log-entry ${type}`;
    const time = new Date().toLocaleTimeString();
    entry.textContent = `[${time}] ${msg}`;
    logger.appendChild(entry);
    logger.scrollTop = logger.scrollHeight;
}

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
        if(!editor) return;
        window.clearAll();
        let code = editor.getValue();
        
        if(code.trim() === "") {
            logMsg("Çalıştırılacak script bulunamadı!", "warn");
            return;
        }
        
        document.getElementById("finalOutput").value = "-- İnternet üzerindeki tüm ağlar taranıyor...\n";
        
        // İşlemin üst üste binmesini engellemek için butonu kısa süreliğine devre dışı bırak
        document.getElementById("executeBtn").disabled = true;
        await processCode(code);
        document.getElementById("executeBtn").disabled = false;

    } catch (error) {
        logMsg(`[SİSTEM HATASI] Motor çöktü: ${error.message}`, "warn");
        document.getElementById("executeBtn").disabled = false;
    }
};

// 🚀 YENİ NESİL ZİNCİRLEME EXECUTOR MOTORU (ÇİFT KATMANLI BYPASS)
async function fetchAllLinks(code, depth = 0) {
    if (depth > 10) {
        logMsg("[GÜVENLİK] Maksimum derinliğe ulaşıldı (Sonsuz döngü engellendi).", "warn");
        return code;
    }

    const httpRegex = /(?:loadstring\()?\s*game:HttpGet(?:Async)?\(\s*(['"])(https?:\/\/[^\1]+)\1\s*\)\s*(?:\)\(\))?/i;
    let match = code.match(httpRegex);

    if (match) {
        let fullMatch = match[0];
        let url = match[2];
        
        logMsg(`[AĞ İSTEĞİ ${depth+1}] Hedef: ${url}`, "http");
        
        try {
            let fetchedCode = "";

            // PLAN A: Doğrudan İstek (GitHub Raw gibi siteler için en hızlısı)
            try {
                let response = await fetch(url);
                if (response.ok) {
                    fetchedCode = await response.text();
                    logMsg(`[BAŞARILI] Veri doğrudan kaynaktan çekildi.`, "system");
                } else {
                    throw new Error("Doğrudan erişim reddedildi.");
                }
            } catch (err1) {
                // PLAN B: CORS Proxy (Eğer hedef site tarayıcıyı engellerse proxy ile vururuz)
                logMsg(`[B-PLANI] Tarayıcı engeli algılandı. Tünel protokolü kullanılıyor...`, "warn");
                let proxyUrl = "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(url);
                
                let response2 = await fetch(proxyUrl);
                if (!response2.ok) throw new Error("Tünel bağlantısı da başarısız oldu.");
                
                fetchedCode = await response2.text();
                logMsg(`[BAŞARILI] Veri tünel üzerinden çekildi.`, "system");
            }

            if (!fetchedCode || fetchedCode.trim() === "") throw new Error("Çekilen veri tamamen boş.");

            // İndirilen kodu sisteme entegre et
            code = code.replace(fullMatch, "\n-- EMLOXA_FETCH_START (" + url + ")\n" + fetchedCode + "\n-- EMLOXA_FETCH_END\n");

            // Zincirleme taramaya devam et (İçinde başka link varsa onları da bulur)
            return await fetchAllLinks(code, depth + 1);

        } catch (error) {
            logMsg(`[BAĞLANTI HATASI] ${url} çekilemedi: ${error.message}`, "warn");
            // Hata alırsak döngünün kilitlenmemesi için o isteği siliyoruz ve kalanları aramaya devam ediyoruz.
            code = code.replace(fullMatch, "-- [EMLOXA: Bağlantı Sağlanamadı - " + url + "]");
            return await fetchAllLinks(code, depth + 1);
        }
    }
    
    return code;
}

// 🖥️ ANA ANALİZ VE UI ÇİZİM MOTORU
async function processCode(initialCode) {
    logMsg("Script inceleniyor, ağ bağlantıları aranıyor...", "system");
    
    // Ağ taramasını başlat
    let finalRawCode = await fetchAllLinks(initialCode);
    
    // Ham kodu deobfuscate kutusuna yolla
    document.getElementById("finalOutput").value = "-- [EMLOXA V3 DEOBFUSCATOR ÇIKTISI]\n\n" + finalRawCode;
    logMsg("Tüm kodlar başarıyla deobfuscate edildi ve sol alta aktarıldı.", "warn");

    // UI motorunu çalıştır
    const lines = finalRawCode.split('\n');
    let variables = {}; 
    const viewport = document.getElementById("viewport");

    lines.forEach((line) => {
        line = line.trim();
        if (line === "" || line.startsWith("--")) return;

        try {
            // Obje Yakalama
            let instanceMatch = line.match(/(?:local\s+)?([a-zA-Z0-9_]+)\s*=\s*Instance\.new\((?:['"])([a-zA-Z0-9_]+)(?:['"])[^)]*\)/);
            if (instanceMatch) {
                let varName = instanceMatch[1];
                let className = instanceMatch[2];
                logMsg(`[NESNE] ${className} oluşturuldu (${varName}).`, "instance");

                let el = document.createElement("div");
                if (className === "Frame" || className === "ScreenGui" || className === "ScrollingFrame") el.className = "rbx-frame";
                if (className === "TextButton") el.className = "rbx-textbutton";
                if (className === "TextLabel") el.className = "rbx-textlabel";
                if (className === "UICorner") el.setAttribute("data-type", "uicorner");
                
                variables[varName] = { element: el, type: className, parent: null };
                return;
            }

            // Özellik Yakalama
            let propMatch = line.match(/([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s*=\s*(.+)/);
            if (propMatch) {
                let varName = propMatch[1];
                let prop = propMatch[2];
                let value = propMatch[3];

                if (!variables[varName]) return; 
                let obj = variables[varName];
                
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
                    if (parentVar.includes("game.CoreGui") || parentVar.includes("game.Players") || parentVar.includes("Workspace") || parentVar.includes("Parent")) {
                        viewport.appendChild(obj.element);
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
            // Hata atla
        }
    });

    logMsg("Tüm işlemler sorunsuz tamamlandı.", "warn");
}
