
        const defaultPromptReview = "1. 若目标空泛（如“要瘦”），指出不合理并给出 3 个今天能执行的动作。\n2. 若目标清晰，优化执行路径。\n请保持极客风格，简练直接。如果是步骤，请用数字(1. 2. 3.)列出。";
        const defaultPromptFlow = "要求：\n1. 挑出今天必须干的核心任务作为“启动项”。\n2. 给出简短、强硬的执行指令。\n3. 极客日志风格，中文输出。";

        const DEFAULT_HOME_MODULES = [
            { id: 'greeting', type: 'greeting', colSpan: 4, rowSpan: 1, hidden: false },
            { id: 'bridge', type: 'bridge', colSpan: 4, rowSpan: 1, hidden: false },
            { id: 'ai_flow', type: 'ai_flow', colSpan: 4, rowSpan: 2, hidden: false },
            { id: 'notes', type: 'notes', colSpan: 2, rowSpan: 2, hidden: false },
            { id: 'tunes', type: 'tunes', colSpan: 2, rowSpan: 1, hidden: false },
            { id: 'lyrics', type: 'lyrics', colSpan: 2, rowSpan: 2, hidden: false }
        ];

        const state = {
            view: 'home',
            libraryFilter: 'active', 
            tasks: JSON.parse(localStorage.getItem('nf_tasks_v5.4')) || JSON.parse(localStorage.getItem('nf_tasks_v5.3')) || [],
            activeTaskId: null,
            homeModules: JSON.parse(localStorage.getItem('nf_home_modules_v5.4')) || DEFAULT_HOME_MODULES,
            storeItems: (() => {
                try {
                    const raw = localStorage.getItem('nf_store_v5.4') || localStorage.getItem('nf_store_v5.3');
                    return raw ? JSON.parse(raw) : [];
                } catch (error) {
                    console.warn('store load failed', error);
                    return [];
                }
            })(),
            storeView: localStorage.getItem('nf_store_view_v5.4') || 'shop',
            storeFormVisible: (() => {
                try {
                    const raw = localStorage.getItem('nf_store_form_visible_v5.4');
                    return raw ? JSON.parse(raw) : false;
                } catch (error) {
                    console.warn('storeFormVisible load failed', error);
                    return false;
                }
            })(),
            coins: (() => {
                try {
                    const raw = localStorage.getItem('nf_coins_v5.4');
                    if (!raw) return 0;
                    const parsed = JSON.parse(raw);
                    return typeof parsed === 'number' ? parsed : (parsed?.coins || 0);
                } catch (error) {
                    console.warn('coin load failed', error);
                    return 0;
                }
            })(),
            timer: {
                focusSecs: 25 * 60, restSecs: 5 * 60, timeLeft: 25 * 60,
                status: 'idle', mode: 'focus', interval: null, reminderTimeout: null, soundInterval: null, soundCount: 0, targetSoundCount: 1
            },
            settings: JSON.parse(localStorage.getItem('nf_settings_v5.4')) || JSON.parse(localStorage.getItem('nf_settings_v5.3')) || {
                aiProvider: 'gemini', apiKey: '', clockFormat: 'MM/DD hh:mm:ss', dayStartTime: '06:00', 
                priorityStyle: 'bar', sortMethod: 'custom', sortOrder: 'asc', ddlStyle: 'dot', alertSound: 'preset1',
                headerTimerScale: 1, headerTimerX: 0, starDdlColorNormal: '#ef4444', starDdlColorRunning: '#ffffff', starDdlShadow: true,
                ddlMaxUnit: 'days', greetingSize: 8, alertVolume: 1, matrixRows: 3, matrixCols: 66, homeGridCols: 4,
                ollamaUrl: 'http://localhost:11434', ollamaModel: 'llama3', promptReview: defaultPromptReview, promptFlow: defaultPromptFlow,
                priorityColors: { 5: '#ef4444', 4: '#f97316', 3: '#eab308', 2: '#84cc16', 1: '#22c55e' },
                alertDuration: 3, alertCount: 1, focusDelay: 5, restDelay: 90, separateRestAlert: false, restAlertSound: 'preset1', restAlertVolume: 1,
                musicApiUrl: 'http://localhost:3000', musicCookie: '', quickNotes: ''
            }
        };
        
        if(!state.settings.priorityColors || state.settings.priorityColors[5] === '#000000') {
            state.settings.priorityColors = { 5: '#ef4444', 4: '#f97316', 3: '#eab308', 2: '#84cc16', 1: '#22c55e' };
        }
        if(state.settings.alertDuration === undefined) {
            state.settings.alertDuration = 3; state.settings.alertCount = 1; state.settings.focusDelay = 5; state.settings.restDelay = 90;
            state.settings.separateRestAlert = false; state.settings.restAlertSound = 'preset1'; state.settings.restAlertVolume = 1;
        }
        if(state.settings.musicApiUrl === undefined) state.settings.musicApiUrl = 'http://localhost:3000';
        if(state.settings.musicCookie === undefined) state.settings.musicCookie = '';
        if(state.settings.homeGridCols === undefined) state.settings.homeGridCols = 4;
        if(state.settings.quickNotes === undefined) state.settings.quickNotes = '';

        state.homeModules = (state.homeModules || []).map((m) => ({
            id: m.id,
            type: m.type || m.id,
            colSpan: Math.max(1, parseInt(m.colSpan, 10) || 1),
            rowSpan: Math.max(1, parseInt(m.rowSpan, 10) || 1),
            hidden: !!m.hidden
        }));
        DEFAULT_HOME_MODULES.forEach((base) => {
            if (!state.homeModules.find((m) => m.id === base.id)) {
                state.homeModules.push({ ...base });
            }
        });

        state.tasks = state.tasks.map(t => ({
            ...t,
            status: t.status || 'active', weight: parseInt(t.weight) || 2, extDdl: t.extDdl || "",
            steps: (t.steps || []).map(s => typeof s === 'string' ? { text: s, done: false } : s),
            createdAt: t.createdAt || Date.now(), currentBridge: t.currentBridge || "", 
            bridgeHistory: t.bridgeHistory || [], isStarred: !!t.isStarred,
            ddl: t.ddl || null, ddlHasTime: t.ddlHasTime !== undefined ? t.ddlHasTime : (t.ddl ? true : false)
        }));

        state.storeItems = (state.storeItems || []).map(item => ({
            ...item,
            price: Math.round((Number(item.price) || 0) * 100) / 100,
            image: item.image || '',
            purchased: !!item.purchased,
            status: item.status || 'active',
            deletedAt: item.deletedAt || null,
            createdAt: item.createdAt || Date.now()
        }));

        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('sortDropdown');
            if(!dropdown.classList.contains('hidden') && !e.target.closest('#sortDropdown') && !e.target.closest('button[title="排序依据"]')) {
                dropdown.classList.add('hidden');
            }
        });

        // --- DDL 计算 ---
        function renderDdlUi(task, nowTime) {
            if (!task.ddl || !task.ddlHasTime) return { html: '', txt: '' };
            const diff = task.ddl - nowTime;
            const style = state.settings.ddlStyle || 'dot';
            const maxU = state.settings.ddlMaxUnit || 'days';
            const color = state.settings.priorityColors[task.weight] || state.settings.priorityColors[2];
            
            if (diff <= 0) return { html: `<span class="text-xs font-bold text-black bg-red-500 px-2 py-1 rounded">已逾期</span>`, txt: '已逾期' };

            const totS = Math.floor(diff / 1000); const remS = String(totS % 60).padStart(2, '0');
            const totM = Math.floor(totS / 60); const remM = String(totM % 60).padStart(2, '0');
            const totH = Math.floor(totM / 60); const remH = String(totH % 24).padStart(2, '0');
            const totD = Math.floor(totH / 24); const remD = totD % 30;
            const totMo = Math.floor(totD / 30); const remMo = totMo % 12; const totY = Math.floor(totD / 365);

            let timeStr = "";
            if(maxU === 'seconds') timeStr = `${totS}s`;
            else if(maxU === 'minutes') timeStr = `${totM}:${remS}`;
            else if(maxU === 'hours') timeStr = `${totH}:${remM}:${remS}`;
            else if(maxU === 'days') timeStr = totD > 0 ? `${totD}d ${remH}:${remM}:${remS}` : `${remH}:${remM}:${remS}`;
            else if(maxU === 'months') timeStr = totMo > 0 ? `${totMo}m ${remD}d ${remH}:${remM}:${remS}` : (totD > 0 ? `${totD}d ${remH}:${remM}:${remS}` : `${remH}:${remM}:${remS}`);
            else if(maxU === 'years') timeStr = totY > 0 ? `${totY}y ${remMo}m ${remD}d ${remH}:${remM}:${remS}` : (totMo > 0 ? `${totMo}m ${remD}d ${remH}:${remM}:${remS}` : (totD > 0 ? `${totD}d ${remH}:${remM}:${remS}` : `${remH}:${remM}:${remS}`));

            if (style === 'text') {
                return { html: `<span class="text-xs font-bold text-white/70 bg-white/10 px-3 py-1 rounded shrink-0 tracking-widest">${timeStr}</span>`, txt: timeStr };
            } else {
                const totalDur = task.ddl - task.createdAt;
                const elapsed = nowTime - task.createdAt;
                let ratio = 1 - (elapsed / totalDur);
                if(ratio < 0) ratio = 0; if(ratio > 1) ratio = 1;
                
                const rows = parseInt(state.settings.matrixRows) || 3;
                const cols = parseInt(state.settings.matrixCols) || 66;
                const totalDots = rows * cols;
                const remainingCount = Math.ceil(ratio * totalDots);
                
                let dotsHtml = '';
                for(let i=0; i<totalDots; i++) {
                    if(i < remainingCount) dotsHtml += `<div class="dot" style="background-color: ${color}; box-shadow: 0 0 4px ${color}60;"></div>`;
                    else dotsHtml += `<div class="dot" style="background-color: ${color}; opacity: 0.15;"></div>`;
                }
                return { html: `<div class="flex flex-col items-end"><div class="dot-matrix" style="grid-template-columns: repeat(${cols}, 1fr);" title="剩余 ${timeStr}">${dotsHtml}</div></div>`, txt: timeStr };
            }
        }

        const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        function updateClock() {
            const now = new Date();
            const nowTime = now.getTime();
            const format = state.settings.clockFormat || 'MM/DD hh:mm:ss';
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            const h = String(now.getHours()).padStart(2, '0');
            const min = String(now.getMinutes()).padStart(2, '0');
            const s = String(now.getSeconds()).padStart(2, '0');
            
            let str = format.replace('MM', m).replace('DD', d).replace('hh', h).replace('mm', min).replace('ss', s);
            const parts = str.split(' ');
            
            if (parts.length >= 2) {
                document.getElementById('sysDate').innerText = parts[0];
                document.getElementById('sysTime').innerText = parts.slice(1).join(' ');
            } else {
                document.getElementById('sysDate').innerText = `${m}/${d}`; 
                document.getElementById('sysTime').innerText = str;
            }
            document.getElementById('sysDay').innerText = WEEKDAYS[now.getDay()];

            const ddlDetail = document.getElementById('detailDdlDisplay');
            if (state.activeTaskId && state.view === 'library') {
                const task = state.tasks.find(t => t.id === state.activeTaskId);
                const ddlData = renderDdlUi(task, nowTime);
                if(task && task.ddl && task.ddlHasTime) {
                    ddlDetail.innerHTML = ddlData.txt;
                    ddlDetail.classList.remove('hidden');
                } else ddlDetail.classList.add('hidden');
            } else ddlDetail.classList.add('hidden');

            const starredTask = state.tasks.find(t => t.isStarred && t.status === 'active');
            const headerStar = document.getElementById('headerStarredTask');
            if(starredTask && starredTask.ddl && starredTask.ddlHasTime) {
                document.getElementById('headerStarTitleText').innerText = starredTask.title;
                document.getElementById('headerStarIcon').style.color = state.settings.priorityColors[starredTask.weight] || '#ffffff';
                document.getElementById('headerStarDdl').innerText = renderDdlUi(starredTask, nowTime).txt;
                headerStar.classList.remove('hidden');
            } else headerStar.classList.add('hidden');
            
            if (state.view === 'library') {
                document.querySelectorAll('.item-ddl-updater').forEach(el => {
                    const tk = state.tasks.find(x => x.id === parseInt(el.dataset.id));
                    if(tk) el.innerHTML = renderDdlUi(tk, nowTime).html;
                });
            }

            if (state.view === 'home') {
                const hour = now.getHours();
                let greet = "HELLO_";
                if(hour >= 5 && hour < 12) greet = "GOOD MORNING_";
                else if(hour >= 12 && hour < 18) greet = "GOOD AFTERNOON_";
                else greet = "GOOD EVENING_";
                const greetEl = document.getElementById('homeGreeting');
                if (greetEl) greetEl.innerText = greet;
            }
        }
        setInterval(updateClock, 1000);

        function parseTimeStr(val) { return parseInt(val, 10) || 0; }
        function formatTimeStr(totalSecs) {
            const m = Math.floor(totalSecs / 60); const s = totalSecs % 60;
            return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        }

window.DEFAULT_HOME_MODULES = DEFAULT_HOME_MODULES;
window.state = state;
window.renderDdlUi = renderDdlUi;
window.updateClock = updateClock;
window.parseTimeStr = parseTimeStr;
window.formatTimeStr = formatTimeStr;

