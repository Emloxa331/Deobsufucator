// --- Monaco Editor Kurulumu ---
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs' }});
let editor;
require(['vs/editor/editor.main'], function () {
    editor = monaco.editor.create(document.getElementById('editor-container'), {
        value: `-- Örnek Obfuscate Edilmiş / UI Scripti
local myFrame = Instance.new("Frame")
myFrame.Size = UDim2.new(0, 300, 0, 150)
myFrame.Position = UDim2.new(0, 50, 0, 50)
myFrame.BackgroundColor3 = Color3.fromRGB(45, 45, 45)
myFrame.Transparency = 0.1

local myCorner = Instance.new("UICorner")
myCorner.CornerRadius = UDim.new(0, 12)
myCorner.Parent = myFrame

local myButton = Instance.new("TextButton")
myButton.Size = UDim2.new(0, 100, 0, 40)
myButton.Position = UDim2.new(0, 100, 0, 55)
myButton.BackgroundColor3 = Color3.fromRGB(88, 166, 255)
myButton.Text = "HACK"
myButton.Parent = myFrame
`,
        language: 'lua',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false }
    });
});

// --- Emloxa Logger Sistemi ---
function logMsg(msg, type = "instance") {
    const logger = document.getElementById("logger");
    const entry = document.createElement("div");
    entry.className = `log-entry ${type}`;
    const time = new Date().toLocaleTimeString();
    entry.textContent = `[${time}] ${msg}`;
    logger.appendChild(entry);
    logger.scrollTop = logger.scrollHeight;
}

function clearAll() {
    document.getElementById("viewport").innerHTML = "";
    document.getElementById("logger").innerHTML = '<div class="log-entry system">[SİSTEM] Temizlendi.</div>';
}

// --- EMLOXA LUA -> HTML PARSER (SANAL MOTOR) ---
function runEmulator() {
    clearAll();
    logMsg("Script analiz ediliyor ve Sanal Motor'da çalıştırılıyor...", "warn");
    const code = editor.getValue();
    const lines = code.split('\n');
    
    let variables = {}; // Roblox Instance'larını tutacağımız sözlük
    const viewport = document.getElementById("viewport");

    // Satır satır okuma (Regex ile deobfuscation)
    lines.forEach((line, index) => {
        line = line.trim();
        if (line === "" || line.startsWith("--")) return;

        // 1. Instance.new Yakalama
        // Örn: local x = Instance.new("Frame")
        let instanceMatch = line.match(/(?:local\s+)?([a-zA-Z0-9_]+)\s*=\s*Instance\.new\("([a-zA-Z0-9_]+)"\)/);
        if (instanceMatch) {
            let varName = instanceMatch[1];
            let className = instanceMatch[2];
            logMsg(`[YENİ NESNE] ${varName} oluşturuldu. (Türü: ${className})`, "instance");
            
            let el = document.createElement("div");
            if (className === "Frame") el.className = "rbx-frame";
            if (className === "TextButton") el.className = "rbx-textbutton";
            if (className === "TextLabel") el.className = "rbx-textlabel";
            if (className === "UICorner") el.setAttribute("data-type", "uicorner");
            
            variables[varName] = { element: el, type: className, parent: null };
            return;
        }

        // 2. Özellik (Property) Yakalama
        // Örn: myFrame.Size = UDim2.new(...)
        let propMatch = line.match(/([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s*=\s*(.+)/);
        if (propMatch) {
            let varName = propMatch[1];
            let prop = propMatch[2];
            let value = propMatch[3];

            if (!variables[varName]) return; // Tanımsız değişken atla
            let obj = variables[varName];
            
            logMsg(`[ÖZELLİK DEĞİŞTİ] ${varName}.${prop} = ${value}`, "property");

            // Değerleri Parse Et
            if (prop === "Size" && value.includes("UDim2.new")) {
                let nums = value.match(/[\d\.]+/g);
                if(nums && nums.length >= 4) {
                    // Sadece offsetleri alıyoruz şimdilik (px)
                    obj.element.style.width = nums[1] + "px";
                    obj.element.style.height = nums[3] + "px";
                }
            }
            else if (prop === "Position" && value.includes("UDim2.new")) {
                let nums = value.match(/[\d\.]+/g);
                if(nums && nums.length >= 4) {
                    obj.element.style.left = nums[1] + "px";
                    obj.element.style.top = nums[3] + "px";
                }
            }
            else if (prop === "BackgroundColor3" && value.includes("Color3.fromRGB")) {
                let nums = value.match(/[\d\.]+/g);
                if(nums && nums.length >= 3) {
                    obj.element.style.backgroundColor = `rgb(${nums[0]}, ${nums[1]}, ${nums[2]})`;
                }
            }
            else if (prop === "Transparency") {
                obj.element.style.opacity = 1 - parseFloat(value);
            }
            else if (prop === "Text") {
                let textVal = value.replace(/"/g, ""); // Tırnakları temizle
                obj.element.textContent = textVal;
            }
            else if (prop === "Visible") {
                obj.element.style.display = value.includes("false") ? "none" : "block";
            }
            else if (prop === "CornerRadius" && value.includes("UDim.new")) {
                let nums = value.match(/[\d\.]+/g);
                if(nums && nums.length >= 2) {
                    obj.cornerRadius = nums[1] + "px";
                }
            }
            else if (prop === "Parent") {
                let parentVar = value;
                if (parentVar === "game.CoreGui" || parentVar === "game.Players.LocalPlayer.PlayerGui") {
                    viewport.appendChild(obj.element);
                    logMsg(`[RENDER] ${varName} Ana Ekrana Eklendi.`, "system");
                } else if (variables[parentVar]) {
                    // Eğer UICorner eklendiyse, parent'ın CSS'ini değiştir
                    if (obj.type === "UICorner") {
                        variables[parentVar].element.style.borderRadius = obj.cornerRadius || "8px";
                        logMsg(`[UI EFEKT] ${parentVar} nesnesine köşe yumuşatma (UICorner) uygulandı.`, "warn");
                    } else {
                        variables[parentVar].element.appendChild(obj.element);
                    }
                }
            }
        }
    });

    logMsg("Analiz tamamlandı.", "warn");
}
