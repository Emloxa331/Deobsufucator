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

/* =========================================
   MÜZİK VE SİSTEM KONTROLLERİ
========================================= */
let isMusicPlaying = false;
const bgm = document.getElementById("bgm");
bgm.volume = 0.3;

// Siteye ilk tıklandığında müziği başlat (Tarayıcı otomatik ses kuralları gereği tık şarttır)
document.addEventListener('click', function initAudio() {
    if(!isMusicPlaying) { window.toggleMusic(); }
    document.removeEventListener('click', initAudio);
}, {once: true});

window.toggleMusic = function() {
    if (bgm.paused) {
        bgm.play().catch(e => console.log("Otomatik oynatma engellendi."));
        document.getElementById("musicToggle").innerText = "⏸️ Sesi Kapat";
        isMusicPlaying = true;
    } else {
        bgm.pause();
        document.getElementById("musicToggle").innerText = "🎵 Sesi Aç";
        isMusicPlaying = false;
    }
};

window.changeVolume = function() {
    bgm.volume = document.getElementById("volSlider").value;
};

function logMsg(msg, type = "instance") {
    const logger = document.getElementById("logger");
    const entry = document.createElement("div");
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logger.appendChild(entry);
    logger.scrollTop = logger.scrollHeight;
}

window.clearInput = () => { if(editor) editor.setValue(""); logMsg("Girdi alanı temizlendi.", "system"); };
window.clearAll = () => { document.getElementById("viewport").innerHTML = ""; document.getElementById("logger").innerHTML = '<div class="log-entry system">[SİSTEM] Ortam sıfırlandı.</div>'; document.getElementById("finalOutput").value = ""; };

/* =========================================
   DİNAMİK LUA VİRTUAL MACHINE (FENGARI HACK)
========================================= */
let dynamicallyDecryptedCode = null;

// Lua içinden JS'ye veri göndermek için kanca (hook)
window.reportDecrypted = function(code) {
    if (code && code.trim().length > 10) {
        dynamicallyDecryptedCode = code;
        logMsg("[VM HACK] Dinamik VM şifreyi İÇERİDEN çözdü! Saf Kod Yakalandı!", "magic");
    }
};

// Obfuscator'ı kandırmak için sahte Roblox ortamını Lua'ya enjekte ediyoruz
const LUA_SANDBOX_HOOKS = `
    local js = require "js"
    local global = js.global
    
    -- Loadstring'i Hookla (Şifre Çözülüp Yürütülmeden Hemen Önce Kodu Çal!)
    local old_loadstring = loadstring or load
    _G.loadstring = function(code, chunk)
        global:reportDecrypted(code)
        return old_loadstring(code, chunk)
    end
    _G.load = _G.loadstring
    
    -- Temel sahte çevreyi oluştur
    _G.game = setmetatable({}, {
        __index = function(t,k) 
            return function() return "Mocked" end 
        end
    })
    _G.getfenv = function() return _G end
    _G.setfenv = function() return _G end
`;

/* =========================================
   AĞ İNDİRME MOTORU (TÜM LİNKLERİ ÇEKER)
========================================= */
async function fetchAllLinks(code, depth = 0) {
    if (depth > 10) return code;

    const httpRegex = /(?:loadstring\()?\s*game:HttpGet(?:Async)?\(\s*(['"])(https?:\/\/[^\1]+)\1\s*\)\s*(?:\)\(\))?/ig;
    let matches = [...code.matchAll(httpRegex)];

    if (matches.length > 0) {
        for (let match of matches) {
            let fullMatch = match[0];
            let url = match[2];
            logMsg(`[AĞ İSTEĞİ ${depth+1}] Taranıyor: ${url}`, "http");
            
            try {
                let fetchedCode = "";
                try {
                    let res = await fetch(url);
                    if(res.ok) fetchedCode = await res.text();
                    else throw new Error();
                } catch(e) {
                    let res2 = await fetch("https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(url));
                    if(res2.ok) fetchedCode = await res2.text();
                }

                if(fetchedCode) {
                    logMsg(`[BAŞARILI] Katman ${depth+1} indirildi.`, "system");
                    code = code.replace(fullMatch, "\n-- [EMLOXA KATMAN " + (depth+1) + "]\n" + fetchedCode + "\n");
                }
            } catch (error) {}
        }
        return await fetchAllLinks(code, depth + 1);
    }
    return code; 
}

/* =========================================
   ANA YÜRÜTÜCÜ 
========================================= */
window.startEmulator = async function() {
    try {
        if(!editor || editor.getValue().trim() === "") return;
        window.clearAll();
        document.getElementById("executeBtn").disabled = true;
        document.getElementById("finalOutput").value = "-- Analiz ediliyor...\n";
        
        let initialCode = editor.getValue();
        dynamicallyDecryptedCode = null; // Sıfırla

        logMsg("Tüm ağ trafiği indiriliyor...", "warn");
        
        // 1. Önce koddaki linkleri indir
        let codeToAnalyze = await fetchAllLinks(initialCode);

        // 2. Eğer Obfuscation varsa (Örn EMLOXA WARE) kodu LUA VM'E ATARAK ÇALIŞTIR
        if (typeof fengari !== 'undefined' && codeToAnalyze.includes("getfenv") || codeToAnalyze.includes("EMLOXA")) {
            logMsg("[SİSTEM] Ağır şifreleme tespit edildi. Sanal Makineye (VM) gönderiliyor...", "warn");
            try {
                // Kodu tarayıcıda gerçek Lua olarak çalıştır ve hookla
                fengari.load(LUA_SANDBOX_HOOKS + "\n" + codeToAnalyze)();
            } catch (e) {
                logMsg(`[VM UYARISI] Kodda bazı özel kısımlar var, motor atladı.`, "warn");
            }
        }

        // 3. Eğer Lua VM içindeki şifreyi çözdüyse (dynamicallyDecryptedCode dolduysa), asıl kodu o yap!
        if (dynamicallyDecryptedCode) {
            codeToAnalyze = dynamicallyDecryptedCode;
            logMsg("[BAŞARILI] Şifre parçalandı ve ham koda ulaşıldı!", "system");
            
            // Eğer içinden çıkan şifresiz kodda yine link varsa (Russian Doll misali), bir daha indir!
            codeToAnalyze = await fetchAllLinks(codeToAnalyze);
        }

        // 4. Çıktıyı Ekrana Yazdır
        document.getElementById("finalOutput").value = "-- [EMLOXA V3 FİNAL DİNAMİK ÇIKTI]\n\n" + codeToAnalyze;
        logMsg("Tarama bitti. En ham Roblox kodu Output kutusuna aktarıldı.", "magic");

        // 5. Ham Kodu UI olarak Ekrana Çiz (Regex Fallback)
        parseUI(codeToAnalyze);

        document.getElementById("executeBtn").disabled = false;
    } catch (e) {
        logMsg(`[ÇÖKME] Sistem Hatası: ${e.message}`, "warn");
        document.getElementById("executeBtn").disabled = false;
    }
};

function parseUI(code) {
    const lines = code.split('\n');
    let variables = {}; 
    const viewport = document.getElementById("viewport");

    lines.forEach((line) => {
        line = line.trim();
        if (line === "" || line.startsWith("--")) return;
        try {
            let instanceMatch = line.match(/(?:local\s+)?([a-zA-Z0-9_]+)\s*=\s*Instance\.new\((?:['"])([a-zA-Z0-9_]+)(?:['"])[^)]*\)/);
            if (instanceMatch) {
                let varName = instanceMatch[1]; let className = instanceMatch[2];
                logMsg(`[UI BULUNDU] ${className} (${varName})`, "instance");
                let el = document.createElement("div");
                if (className === "Frame" || className === "ScreenGui") el.className = "rbx-frame";
                if (className === "TextButton") el.className = "rbx-textbutton";
                if (className === "TextLabel") el.className = "rbx-textlabel";
                if (className === "UICorner") el.setAttribute("data-type", "uicorner");
                variables[varName] = { element: el, type: className, parent: null };
                return;
            }

            let propMatch = line.match(/([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s*=\s*(.+)/);
            if (propMatch) {
                let varName = propMatch[1]; let prop = propMatch[2]; let value = propMatch[3];
                if (!variables[varName]) return; let obj = variables[varName];
                
                if (prop === "Size" && value.includes("UDim2.new")) {
                    let nums = value.match(/[-]?\d+(\.\d+)?/g); if(nums && nums.length >= 4) { obj.element.style.width = nums[1] + "px"; obj.element.style.height = nums[3] + "px"; }
                } else if (prop === "Position" && value.includes("UDim2.new")) {
                    let nums = value.match(/[-]?\d+(\.\d+)?/g); if(nums && nums.length >= 4) { obj.element.style.position = "absolute"; obj.element.style.left = nums[1] + "px"; obj.element.style.top = nums[3] + "px"; }
                } else if (prop === "BackgroundColor3" && value.includes("Color3.fromRGB")) {
                    let nums = value.match(/\d+/g); if(nums && nums.length >= 3) { obj.element.style.backgroundColor = `rgb(${nums[0]}, ${nums[1]}, ${nums[2]})`; }
                } else if (prop === "Transparency" || prop === "BackgroundTransparency") {
                    obj.element.style.opacity = 1 - parseFloat(value);
                } else if (prop === "Text") {
                    obj.element.textContent = value.replace(/^["']|["']$/g, ""); 
                } else if (prop === "CornerRadius" && value.includes("UDim.new")) {
                    let nums = value.match(/\d+/g); if(nums && nums.length >= 2) { obj.cornerRadius = nums[1] + "px"; }
                } else if (prop === "Parent") {
                    let parentVar = value;
                    if (parentVar.includes("game.CoreGui") || parentVar.includes("game.Players") || parentVar.includes("Workspace") || parentVar.includes("Parent")) {
                        viewport.appendChild(obj.element);
                    } else if (variables[parentVar]) {
                        if (obj.type === "UICorner") {
                            variables[parentVar].element.style.borderRadius = obj.cornerRadius || "8px"; variables[parentVar].element.style.overflow = "hidden";
                        } else { variables[parentVar].element.appendChild(obj.element); }
                    }
                }
            }
        } catch (e) {}
    });
}
