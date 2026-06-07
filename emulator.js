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
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logger.appendChild(entry);
    logger.scrollTop = logger.scrollHeight;
}

window.clearInput = function() {
    if(editor) editor.setValue("");
    logMsg("Girdi alanı temizlendi.", "system");
};

window.clearAll = function() {
    document.getElementById("viewport").innerHTML = "";
    document.getElementById("logger").innerHTML = '<div class="log-entry system">[SİSTEM] Ortam sıfırlandı.</div>';
    document.getElementById("finalOutput").value = "";
};

window.startEmulator = async function() {
    try {
        if(!editor) return;
        window.clearAll();
        let code = editor.getValue();
        if(code.trim() === "") return;
        
        document.getElementById("finalOutput").value = "-- Analiz ediliyor...\n";
        document.getElementById("executeBtn").disabled = true;
        
        await executeEngine(code);
        
        document.getElementById("executeBtn").disabled = false;
    } catch (e) {
        logMsg(`[ÇÖKME] Sistem Hatası: ${e.message}`, "warn");
        document.getElementById("executeBtn").disabled = false;
    }
};

/* ==========================================================
   1. HEURISTIC DEOBFUSCATOR (ŞİFRE KIRICI MOTOR)
   Gizli dizeleri (Hex, Byte, Math, Base64) analiz eder, 
   içindeki saklı linkleri dışarı çıkarır.
========================================================== */
function advancedDeobfuscator(code) {
    let originalCode = code;
    let isObfuscated = false;

    if (code.includes("EMLOXA WARE") || code.includes("return (function(") || code.includes("getfenv") || code.match(/\{[\s\d\-\+\*\/,]+\}/)) {
        isObfuscated = true;
        logMsg("[ŞİFRE KIRICI] Obfuscation tespit edildi! Kripto bloklar çözülüyor...", "magic");
    }

    // 1. Lua Byte Çözücü (\104\116 -> ht)
    code = code.replace(/\\(\d{1,3})/g, (m, dec) => String.fromCharCode(parseInt(dec, 10)));

    // 2. Lua Hex Çözücü (\x68\x74 -> ht)
    code = code.replace(/\\x([0-9A-Fa-f]{2})/g, (m, hex) => String.fromCharCode(parseInt(hex, 16)));

    // 3. String.char(...) Çözücü
    code = code.replace(/string\.char\(([\d\s,]+)\)/g, (m, nums) => {
        return '"' + nums.split(',').map(n => String.fromCharCode(parseInt(n.trim()))).join('') + '"';
    });

    // 4. Parçalı Dizeleri Birleştir ("h".."t".."t".."p")
    code = code.replace(/"\s*\.\.\s*"/g, '').replace(/'\s*\.\.\s*'/g, '');

    // 5. Gizli URL Avcısı (Raw linkleri şifrelerin arasından cımbızla çek!)
    let urls = code.match(/https?:\/\/[a-zA-Z0-9.\/\-_\?=]+/g);
    if (urls) {
        let addedLink = false;
        urls.forEach(url => {
            // w3.org gibi standart Lua şemalarını yoksay
            if (!url.includes("w3.org") && !originalCode.includes(`HttpGet("${url}")`) && !originalCode.includes(`HttpGet('${url}')`)) {
                logMsg(`[ŞİFRE KIRICI] Şifrelerin altında gizli hedef bulundu: ${url}`, "magic");
                // Bulduğumuz gizli linki ana koda ENJEKTE EDİYORUZ ki motor oraya da gitsin!
                originalCode += `\nloadstring(game:HttpGet("${url}"))()\n`;
                addedLink = true;
            }
        });
        if(addedLink) logMsg("[ŞİFRE KIRICI] Gizli hedefler Ağ Tarayıcısına aktarıldı.", "system");
    }

    return originalCode; 
}

/* ==========================================================
   2. RECURSIVE FETCHER (ZİNCİRLEME AĞ MOTORU)
========================================================== */
async function fetchAllLinks(code, depth = 0) {
    if (depth > 10) return code; // Sonsuz döngü koruması

    // Önce kodu Şifre Kırıcıdan (Deobfuscator) geçir
    code = advancedDeobfuscator(code);

    // Koddaki TÜM HttpGet linklerini bul
    const httpRegex = /(?:loadstring\()?\s*game:HttpGet(?:Async)?\(\s*(['"])(https?:\/\/[^\1]+)\1\s*\)\s*(?:\)\(\))?/ig;
    let matches = [...code.matchAll(httpRegex)];

    if (matches.length > 0) {
        for (let match of matches) {
            let fullMatch = match[0];
            let url = match[2];
            
            logMsg(`[AĞ İSTEĞİ ${depth+1}] Sunucuya sızılıyor: ${url}`, "http");
            
            try {
                let fetchedCode = "";
                // Plan A: Doğrudan İstek (Hızlı)
                try {
                    let res = await fetch(url);
                    if(res.ok) fetchedCode = await res.text();
                    else throw new Error("Doğrudan erişim reddedildi");
                } catch(e) {
                    // Plan B: CORS Tüneli (Güvenli)
                    logMsg(`[TÜNEL] Tarayıcı engeli aşılarak Proxy üzerinden çekiliyor...`, "warn");
                    let res2 = await fetch("https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(url));
                    if(res2.ok) fetchedCode = await res2.text();
                    else throw new Error("Bağlantı koptu");
                }

                if(fetchedCode && fetchedCode.trim() !== "") {
                    logMsg(`[BAŞARILI] Katman ${depth+1} kodu başarıyla indirildi.`, "system");
                    // Eski link komutunu, indirdiğimiz GERÇEK kod ile değiştiriyoruz
                    code = code.replace(fullMatch, "\n-- [[ EMLOXA ENGINE KATMAN " + (depth+1) + " ]]\n" + fetchedCode + "\n-- [[ KATMAN SONU ]]\n");
                }
            } catch (error) {
                logMsg(`[HATA] URL okunamadı: ${url}`, "warn");
                code = code.replace(fullMatch, "-- [EMLOXA: Bağlantı Başarısız]");
            }
        }
        
        // Tüm linkler değişti. İndirdiğimiz yeni kodlarda BAŞKA link veya şifre var mı diye zinciri tekrar başlat!
        return await fetchAllLinks(code, depth + 1);
    }
    
    return code; // İçinde link kalmadığında (sadece saf UI kodları kaldığında) bu döner.
}

/* ==========================================================
   3. ANA YÜRÜTÜCÜ VE SANAL EKRAN (UI) ÇİZİCİ
========================================================== */
async function executeEngine(initialCode) {
    logMsg("Tüm ağ trafiği ve şifre katmanları analiz ediliyor...", "warn");
    
    // Ağ ve Şifre kırma motorunu çalıştır
    let finalRawCode = await fetchAllLinks(initialCode);
    
    // Ulaştığımız EN SAF kodu çıktı kutusuna yazdır
    document.getElementById("finalOutput").value = "-- [EMLOXA V3 DEOBFUSCATOR FİNAL ÇIKTISI]\n\n" + finalRawCode;
    logMsg("Tarama bitti. Ulaşılan en ham Roblox kodu (Output) kutusuna döküldü.", "magic");

    // Şimdi ulaştığımız bu temiz kodu UI olarak ekrana (Viewport) çiz
    const lines = finalRawCode.split('\n');
    let variables = {}; 
    const viewport = document.getElementById("viewport");

    lines.forEach((line) => {
        line = line.trim();
        if (line === "" || line.startsWith("--")) return;

        try {
            // Nesne oluşturma (local myFrame = Instance.new("Frame"))
            let instanceMatch = line.match(/(?:local\s+)?([a-zA-Z0-9_]+)\s*=\s*Instance\.new\((?:['"])([a-zA-Z0-9_]+)(?:['"])[^)]*\)/);
            if (instanceMatch) {
                let varName = instanceMatch[1];
                let className = instanceMatch[2];
                logMsg(`[UI OLUŞTURULDU] ${className} (${varName})`, "instance");

                let el = document.createElement("div");
                if (className === "Frame" || className === "ScreenGui" || className === "ScrollingFrame") el.className = "rbx-frame";
                if (className === "TextButton") el.className = "rbx-textbutton";
                if (className === "TextLabel") el.className = "rbx-textlabel";
                if (className === "UICorner") el.setAttribute("data-type", "uicorner");
                
                variables[varName] = { element: el, type: className, parent: null };
                return;
            }

            // Nesne özellikleri (myFrame.Size = UDim2.new(...))
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

    logMsg("İşlem başarıyla sonlandırıldı.", "system");
}
