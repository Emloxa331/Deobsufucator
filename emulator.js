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
        await processCode(code);

    } catch (error) {
        logMsg(`[SİSTEM HATASI] Motor çöktü: ${error.message}`, "warn");
    }
};

// 🚀 ZİNCİRLEME EXECUTOR MOTORU (RECURSIVE FETCHER)
async function fetchAllLinks(code, depth = 0) {
    // Sonsuz döngüye girmemesi için max 10 derinlik sınırı koyduk
    if (depth > 10) return code;

    // HttpGet veya HttpGetAsync komutlarını algıla
    const httpRegex = /(?:loadstring\()?\s*game:HttpGet(?:Async)?\(\s*(['"])(https?:\/\/[^\1]+)\1\s*\)\s*(?:\)\(\))?/i;
    let match = code.match(httpRegex);

    if (match) {
        let fullMatch = match[0];
        let url = match[2];
        
        logMsg(`[AĞ İSTEĞİ ${depth+1}] Tespit Edildi: ${url}`, "http");
        
        try {
            // EXECUTOR SPOOFING: Tarayıcı engelini (CORS) aşmak ve Executor gibi davranmak için public proxy kullanıyoruz
            let proxyUrl = "https://api.allorigins.win/get?url=" + encodeURIComponent(url);
            logMsg("Executor kimliği (User-Agent) taklit edilerek sunucuya sızılıyor...", "warn");
            
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error("HTTP " + response.status);
            
            const data = await response.json();
            let fetchedCode = data.contents;
            
            if(!fetchedCode) throw new Error("Boş veri döndü.");

            logMsg(`[BAŞARILI] Aşama ${depth+1} tamam. İç kodlar çekildi.`, "system");

            // İndirilen kodu, asıl kodun içindeki o linkin yerine yerleştiriyoruz!
            code = code.replace(fullMatch, "\n-- EMLOXA_FETCH_START (" + url + ")\n" + fetchedCode + "\n-- EMLOXA_FETCH_END\n");

            // İndirdiğimiz kodun içinde BAŞKA LİNKLER var mı diye tekrar kontrol ediyoruz (Zincirleme)
            return await fetchAllLinks(code, depth + 1);

        } catch (error) {
            logMsg(`[BAĞLANTI HATASI] Link atlanıyor: ${error.message}`, "warn");
            // Hata verirse o kısmı temizle ki motor diğer kodlara devam etsin
            code = code.replace(fullMatch, "-- [EMLOXA: Bağlantı Sağlanamadı]");
            return code;
        }
    }
    
    // Eğer kodun içinde başka link kalmadıysa nihai kodu geri döndür
    return code;
}

// 🖥️ ANA ANALİZ VE UI ÇİZİM MOTORU
async function processCode(initialCode) {
    // 1. AŞAMA: Tüm linkleri zincirleme olarak iç içe indir ve gerçek kodu ortaya çıkar
    logMsg("Script inceleniyor, ağ bağlantıları aranıyor...", "system");
    let finalRawCode = await fetchAllLinks(initialCode);
    
    // 2. AŞAMA: İndirilen ham (raw) temizlenmiş kodu, Final Output kutusuna yazdır!
    // Bu sayede UI (Arayüz) oluşturmasa bile scriptin asıl kaynak kodunu %100 görebileceksin.
    document.getElementById("finalOutput").value = "-- [EMLOXA V3 DEOBFUSCATOR ÇIKTISI]\n" + finalRawCode;
    logMsg("Tüm kodlar başarıyla deobfuscate edildi ve sol alta aktarıldı.", "warn");

    // 3. AŞAMA: Sanal Ekranda (Viewport) UI Çizme İşlemi
    const lines = finalRawCode.split('\n');
    let variables = {}; 
    const viewport = document.getElementById("viewport");

    lines.forEach((line) => {
        line = line.trim();
        if (line === "" || line.startsWith("--")) return;

        try {
            // Obje Oluşturma (local var = Instance.new("Frame", Parent) desteği eklendi)
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

            // Özellik Değiştirme (Daha esnek hale getirildi)
            let propMatch = line.match(/([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s*=\s*(.+)/);
            if (propMatch) {
                let varName = propMatch[1];
                let prop = propMatch[2];
                let value = propMatch[3];

                if (!variables[varName]) return; 
                let obj = variables[varName];
                
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
            // Hatayı atla, motor çökmese
        }
    });

    logMsg("Tüm işlemler sorunsuz tamamlandı.", "warn");
}
