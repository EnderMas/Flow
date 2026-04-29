// --- 应用统筹 ---
        const app = {
            clickTimeout: null,
            isHomeDeleteMode: false,
            draggingHomeId: null,
            homeResizeSession: null,

            init() {
                timer.init(); 
                this.renderHomeModules();

                document.getElementById('priorityStyle').value = state.settings.priorityStyle;
                document.getElementById('aiProvider').value = state.settings.aiProvider;
                document.getElementById('apiKey').value = state.settings.apiKey || '';
                document.getElementById('clockFormat').value = state.settings.clockFormat;
                document.getElementById('dayStartTime').value = state.settings.dayStartTime;
                document.getElementById('ddlStyle').value = state.settings.ddlStyle;
                document.getElementById('ddlMaxUnit').value = state.settings.ddlMaxUnit;
                
                document.getElementById('headerTimerScale').value = state.settings.headerTimerScale;
                document.getElementById('headerTimerX').value = state.settings.headerTimerX;
                document.getElementById('starDdlColorNormal').value = state.settings.starDdlColorNormal;
                document.getElementById('starDdlColorRunning').value = state.settings.starDdlColorRunning;
                document.getElementById('starDdlShadow').checked = state.settings.starDdlShadow;
                document.getElementById('greetingSize').value = state.settings.greetingSize;
                document.getElementById('homeGridCols').value = state.settings.homeGridCols;
                if (state.settings.homeGridGap === undefined) state.settings.homeGridGap = 24;
                const gapEl = document.getElementById('homeGridGap');
                if(gapEl) gapEl.value = state.settings.homeGridGap;
                if (!state.settings.widgetStyles) state.settings.widgetStyles = {};
                if (document.getElementById('widgetStyleTarget')) this.loadWidgetStyles();
                
                document.getElementById('alertDuration').value = state.settings.alertDuration;
                document.getElementById('alertCount').value = state.settings.alertCount;
                document.getElementById('focusDelay').value = state.settings.focusDelay;
                document.getElementById('restDelay').value = state.settings.restDelay;
                document.getElementById('alertSound').value = state.settings.alertSound;
                document.getElementById('alertVolume').value = state.settings.alertVolume;
                document.getElementById('separateRestAlert').checked = state.settings.separateRestAlert;
                document.getElementById('restAlertSound').value = state.settings.restAlertSound;
                document.getElementById('restAlertVolume').value = state.settings.restAlertVolume;
                
                document.getElementById('matrixRows').value = state.settings.matrixRows;
                document.getElementById('matrixCols').value = state.settings.matrixCols;

                document.getElementById('promptReview').value = state.settings.promptReview;
                document.getElementById('promptFlow').value = state.settings.promptFlow;
                document.getElementById('ollamaUrl').value = state.settings.ollamaUrl;
                document.getElementById('ollamaModel').value = state.settings.ollamaModel;

                document.getElementById('musicApiUrl').value = state.settings.musicApiUrl;
                document.getElementById('musicCookie').value = state.settings.musicCookie;

                document.getElementById('cColor5').value = state.settings.priorityColors[5];
                document.getElementById('cColor4').value = state.settings.priorityColors[4];
                document.getElementById('cColor3').value = state.settings.priorityColors[3];
                document.getElementById('cColor2').value = state.settings.priorityColors[2];
                document.getElementById('cColor1').value = state.settings.priorityColors[1];

                document.getElementById('sortOrderIcon').innerText = state.settings.sortOrder === 'asc' ? '↑' : '↓';
                
                if(state.settings.libLeftWidth) {
                    document.documentElement.style.setProperty('--lib-left-w', state.settings.libLeftWidth + '%');
                }

                this.updateCSSVars();
                this.updateVolumeUI();
                this.toggleAiSettings();
                this.toggleRestAlertSettings();

                const customAudioBase64 = localStorage.getItem('nf_custom_audio');
                if(customAudioBase64) {
                    document.getElementById('audioCustom').src = customAudioBase64;
                    document.getElementById('customAudioName').innerText = "已加载自定义音频";
                }

                musicManager.init();
                this.showView('home');
                library.renderList(); 
            },

            saveHomeModules() {
                localStorage.setItem('nf_home_modules_v5.4', JSON.stringify(state.homeModules));
            },

            saveQuickNote(value) {
                state.settings.quickNotes = value;
                this.saveSettings();
            },

            toggleHomeAddMenu(e) {
                if (e) e.stopPropagation();
                const menu = document.getElementById('homeAddMenu');
                if (!menu) return;
                menu.classList.toggle('hidden');
                if (!menu.classList.contains('hidden')) this.renderHomeAddMenu();
            },

            renderHomeAddMenu() {
                const menu = document.getElementById('homeAddMenu');
                if (!menu) return;
                const hiddenModules = state.homeModules.filter((m) => m.hidden);
                if (!hiddenModules.length) {
                    menu.innerHTML = '<div class="text-xs text-white/45 font-bold px-3 py-2">没有可添加模块</div>';
                    return;
                }
                menu.innerHTML = hiddenModules.map((m) => {
                    const labels = {
                        greeting: '问候语', bridge: '断点恢复', ai_flow: 'AI 每日流',
                        notes: '随手记', tunes: '音乐播放器', lyrics: '歌词面板'
                    };
                    return `<button class="w-full text-left text-xs font-bold px-3 py-2 rounded hover:bg-white/10 transition-colors" onclick="app.addHomeModule('${m.id}')">+ ${labels[m.id] || m.id}</button>`;
                }).join('');
            },

            addHomeModule(id) {
                if (id.startsWith('spacer_')) {
                    state.homeModules.push({ id: id, type: 'spacer', w: 2, h: 1, hidden: false });
                } else {
                    const mod = state.homeModules.find((m) => m.id === id);
                    if (!mod) return;
                    mod.hidden = false;
                }
                this.saveHomeModules();
                this.renderHomeModules();
                this.saveSettings();
                const menu = document.getElementById('homeAddMenu');
                if (menu) menu.classList.add('hidden');
            },

            toggleHomeDeleteMode() {
                this.isHomeDeleteMode = !this.isHomeDeleteMode;
                const btn = document.getElementById('toggleDeleteModeBtn');
                if (btn) btn.classList.toggle('active-delete', this.isHomeDeleteMode);
                const gridEl = document.getElementById('homeGridStack');
                if (gridEl && this.grid) {
                    if (this.isHomeDeleteMode) {
                        gridEl.classList.add('delete-mode-active');
                        this.grid.disable(); // 进入删除模式时禁用拖拽
                    } else {
                        gridEl.classList.remove('delete-mode-active');
                        this.grid.enable(); // 退出删除模式时恢复拖拽
                    }
                }
            },

            hideHomeModule(id) {
                const mod = state.homeModules.find((m) => m.id === id);
                if (!mod) return;
                mod.hidden = true;
                this.saveHomeModules();
                if (this.grid) {
                    const el = document.querySelector(`[gs-id="${id}"]`);
                    if (el) this.grid.removeWidget(el);
                }
                this.saveSettings();
            },

            renderHomeModuleContent(mod) {
                if (mod.type === 'greeting') {
                    return `<div class="home-module-content flex flex-col justify-center"><h1 id="homeGreeting" class="home-greeting-text huge-text uppercase text-white/90 tracking-tighter">GOOD EVENING_</h1></div>`;
                }
                if (mod.type === 'bridge') {
                    return `
                        <div class="home-module-content module-scrollable no-scrollbar" data-glow-scroll="1">
                            <div class="text-[10px] font-bold uppercase tracking-[0.2em] opacity-50 mb-6 text-yellow-500 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-yellow-500"></span> BRIDGE_ 待恢复断点</div>
                            <div id="homeBridgeContainer" class="space-y-4"></div>
                        </div>
                    `;
                }
                if (mod.type === 'ai_flow') {
                    return `
                        <div class="home-module-content module-scrollable no-scrollbar" data-glow-scroll="1">
                            <div class="text-sm font-bold uppercase tracking-[0.2em] opacity-50 mb-8 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-purple-500"></span> AI 每日流与优先级指令</div>
                            <div id="homeEmptyState" class="text-white/50 text-lg font-bold">项目库为空。请前往【库】创建你的第一个项目。</div>
                            <div id="homeActiveState" class="space-y-6 hidden">
                                <button onclick="ai.generateDailyFlow()" class="bg-white text-black px-6 py-3 font-bold uppercase hover:invert transition-all flex items-center gap-3 rounded w-fit">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                                    生成今日计划
                                </button>
                                <div id="aiDailyFlowOutput" class="text-base md:text-lg font-bold leading-relaxed whitespace-pre-wrap text-white/80 bg-black/30 p-6 rounded-xl border border-white/5">点击上方按钮，让 AI 分析你的截止日期、外力约束与优先级，生成今日专属流程。</div>
                            </div>
                        </div>
                    `;
                }
                if (mod.type === 'notes') {
                    return `
                        <div class="home-module-content flex flex-col h-full overflow-hidden">
                            <div class="text-[10px] font-bold uppercase tracking-[0.2em] opacity-50 mb-2 text-blue-400 shrink-0">NOTES_ 随手记</div>
                            <div id="quillEditorContainer" class="flex-1 w-full bg-white/5 text-white/90 overflow-hidden flex flex-col"></div>
                        </div>
                    `;
                }
                if (mod.type === 'tunes') {
                    return `
                        <div id="miniTunes" class="home-module-content h-full flex flex-col">
                            <div class="text-[10px] font-bold uppercase tracking-[0.2em] opacity-50 mb-3 text-cyan-300 shrink-0">TUNES_ 迷你播放器</div>
                            <div class="flex items-center gap-4 mb-3">
                                <img id="miniTunesCover" src="" alt="cover" class="w-12 h-12 md:w-16 md:h-16 rounded-lg border border-white/15 object-cover bg-white/5 shrink-0">
                                <div class="min-w-0 flex-1">
                                    <div id="miniTunesTitle" class="text-sm font-black truncate text-white/90">--</div>
                                    <div id="miniTunesArtist" class="text-xs font-bold truncate text-white/50 mt-1">--</div>
                                </div>
                            </div>
                            <input id="miniTunesProgress" type="range" min="0" max="1000" value="0" class="w-full cursor-pointer h-1 mb-3" oninput="musicManager.seekFromUi(this.value)">
                            <div class="flex items-center justify-between mt-auto">
                                <input id="miniTunesVolume" type="range" min="0" max="1" step="0.01" value="1" class="w-20 cursor-pointer h-1" oninput="musicManager.setVolumeFromUi(this.value)" title="音量">
                                <div class="flex items-center gap-2">
                                    <button onclick="musicManager.prev()" class="w-8 h-8 rounded-full border border-white/20 hover:bg-white hover:text-black transition-all font-black text-xs">⟨</button>
                                    <button onclick="musicManager.togglePlay()" id="miniTunesPlayBtn" class="w-10 h-10 rounded-full border-2 border-white hover:bg-white hover:text-black transition-all font-black text-sm">▶</button>
                                    <button onclick="musicManager.next()" class="w-8 h-8 rounded-full border border-white/20 hover:bg-white hover:text-black transition-all font-black text-xs">⟩</button>
                                </div>
                            </div>
                        </div>
                    `;
                }
                if (mod.type.startsWith('spacer')) {
                    return `<div class="home-module-content flex-1"></div>`;
                }
                if (mod.type === 'lyrics') {
                    return `
                        <div class="home-module-content h-full flex flex-col">
                            <div class="text-[10px] font-bold uppercase tracking-[0.2em] opacity-50 mb-4 text-green-300">LYRICS_ 迷你歌词</div>
                            <div id="miniLyricsPanel" class="module-scrollable no-scrollbar space-y-2 text-sm font-bold leading-relaxed text-white/70 pr-2" data-glow-scroll="1"></div>
                        </div>
                    `;
                }
                return '<div class="home-module-content text-white/50">Unknown module</div>';
            },

            renderHomeModules() {
                const gridEl = document.getElementById('homeGridStack');
                if (!gridEl) return;

                // 1. 初始化 GridStack 引擎
                if (!this.grid) {
                    this.grid = GridStack.init({
                        column: state.settings.homeGridCols || 12,
                        cellHeight: '110px',
                        margin: `${state.settings.homeGridGap || 24}px`,
                        handle: '.drag-handle',
                        animate: true,
                        float: false, // 自动挤压补齐
                        alwaysShowResizeHandle: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
                        resizable: { handles: 'se' } // 仅开启右下角缩放
                    }, gridEl);

                    // 绑定拖拽和缩放的改动事件（持久化坐标保存）
                    this.grid.on('change', (event, items) => {
                        this.saveGridState();
                    });
                    
                    // 绑定拖拽开始时的网格背景显示暗示
                    this.grid.on('dragstart resizestart', () => {
                        gridEl.classList.add('home-grid-editing');
                    });
                    this.grid.on('dragstop resizestop', () => {
                        gridEl.classList.remove('home-grid-editing');
                    });
                }

                // 2. 更新列数 (同步你的设置面板)
                this.grid.column(state.settings.homeGridCols || 12, 'moveScale');

                // 3. 清空现有画布
                this.grid.removeAll();

                // 4. 注入用户可见的模块
                const visibleModules = state.homeModules.filter((m) => !m.hidden);
                visibleModules.forEach((mod) => {
                    // 兼容之前的 colSpan/rowSpan 数据结构，转为 GridStack 的 w/h
                    const w = mod.w || mod.colSpan || 4;
                    const h = mod.h || mod.rowSpan || 2;
                    const x = mod.x;
                    const y = mod.y;
                    
                    const gSty = state.settings.widgetStyles?.['all'] || { bc: '#ffffff', bw: 1, bgc: '#ffffff', bgo: 3 };
                    const mSty = state.settings.widgetStyles?.[mod.type] || gSty;
                    const styleStr = mod.type.startsWith('spacer') ? '' : `border: ${mSty.bw}px solid ${mSty.bc}; background-color: ${mSty.bgc}${Math.round(mSty.bgo*255/100).toString(16).padStart(2,'0')};`;

                    const contentHtml = `
                        <div class="w-full h-full rounded-[1.5rem] flex flex-col relative overflow-hidden p-6 transition-all" style="${styleStr}">
                            <div class="drag-handle" title="拖拽模块"></div>
                            <div class="delete-overlay" onclick="app.hideHomeModule('${mod.id}')">
                                <div class="text-4xl mb-2">🗑</div>
                                <div class="text-sm font-bold tracking-widest uppercase">点击删除</div>
                            </div>
                            ${this.renderHomeModuleContent(mod)}
                        </div>
                    `;

                    // 调用核心引擎 API 添加块
                    const el = this.grid.addWidget({
                        id: mod.id,
                        x: x, y: y, w: w, h: h,
                        content: contentHtml
                    });

                    // 去除原生的 border 和 bg 保持清爽
                    const contentEl = el.querySelector('.grid-stack-item-content');
                    if (contentEl) {
                        contentEl.style.background = 'transparent';
                        contentEl.style.border = 'none';
                        contentEl.style.padding = '0';
                    }
                });

                // 初始化 Quill 富文本编辑器
                const quillContainer = document.getElementById('quillEditorContainer');
                if (quillContainer && !this.quillInstance) {
                    this.quillInstance = new Quill(quillContainer, {
                        theme: 'snow',
                        placeholder: '记录你的即时想法...',
                        modules: { toolbar: [['bold', 'italic', 'underline'], [{ 'list': 'bullet' }, { 'size': ['small', false, 'large', 'huge'] }]] }
                    });
                    if (state.settings.quickNotes) this.quillInstance.root.innerHTML = state.settings.quickNotes;
                    this.quillInstance.on('text-change', () => {
                        state.settings.quickNotes = this.quillInstance.root.innerHTML;
                        this.saveSettings();
                    });
                } else if (quillContainer && this.quillInstance) {
                    quillContainer.parentNode.replaceChild(this.quillInstance.container.parentNode, quillContainer);
                }

                // 6. 更新模块内的业务数据
                this.updateHomeBridge();
                this.syncHomeMusicModules();

                const activeCount = state.tasks.filter(t => t.status === 'active').length;
                const emptyState = document.getElementById('homeEmptyState');
                const activeState = document.getElementById('homeActiveState');
                if (emptyState && activeState) {
                    if (activeCount === 0) {
                        emptyState.classList.remove('hidden');
                        activeState.classList.add('hidden');
                    } else {
                        emptyState.classList.add('hidden');
                        activeState.classList.remove('hidden');
                    }
                }
                updateClock();
            },

            saveGridState() {
                if (!this.grid) return;
                const items = this.grid.save(); // GridStack 原生序列化方法
                items.forEach(it => {
                    const mod = state.homeModules.find(m => m.id === it.id);
                    if (mod) {
                        mod.x = it.x; mod.y = it.y; mod.w = it.w; mod.h = it.h;
                    }
                });
                this.saveHomeModules();
            },

            renderMiniLyricsModule() {
                const panel = document.getElementById('miniLyricsPanel');
                if (!panel) return;
                const lines = musicManager.currentLyric?.lines || [];
                if (!lines.length) {
                    panel.innerHTML = '<div class="opacity-30">尚未加载歌词。</div>';
                    return;
                }
                const activeIdx = musicManager.currentLyric?.activeIndex ?? -1;
                panel.innerHTML = lines.map((l, i) => {
                    const cls = i === activeIdx ? 'text-white' : 'text-white/60';
                    return `<div id="miniLyricLine_${i}" class="${cls} transition-colors">${musicManager.escapeHtml(l.text)}</div>`;
                }).join('');
                const active = activeIdx >= 0 ? document.getElementById(`miniLyricLine_${activeIdx}`) : null;
                if (active) active.scrollIntoView({ block: 'center', behavior: 'smooth' });
            },

            syncHomeMusicModules() {
                const s = musicManager.getCurrentSong ? musicManager.getCurrentSong() : null;
                const cover = document.getElementById('miniTunesCover');
                const title = document.getElementById('miniTunesTitle');
                const artist = document.getElementById('miniTunesArtist');
                const playBtn = document.getElementById('miniTunesPlayBtn');
                const progress = document.getElementById('miniTunesProgress');
                const volume = document.getElementById('miniTunesVolume');
                
                if (cover) cover.src = s?.cover || '';
                if (title) title.innerText = s?.name || '--';
                if (artist) artist.innerText = s?.artist || '--';
                if (playBtn) playBtn.innerText = musicManager.audio && musicManager.audio.paused ? '▶' : '⏸';
                
                if (musicManager.audio && progress && !isNaN(musicManager.audio.duration)) {
                    progress.value = Math.floor((musicManager.audio.currentTime / musicManager.audio.duration) * 1000) || 0;
                }
                if (musicManager.audio && volume) volume.value = musicManager.audio.volume;
                this.renderMiniLyricsModule();
            },

            updateCSSVars() {
                const root = document.documentElement;
                const scale = document.getElementById('headerTimerScale').value;
                const xOffset = document.getElementById('headerTimerX').value;
                document.getElementById('lblScale').innerText = scale + 'x';
                document.getElementById('lblX').innerText = xOffset + 'px';
                
                const colorNormal = document.getElementById('starDdlColorNormal').value;
                const colorRunning = document.getElementById('starDdlColorRunning').value;
                const ddlShadow = document.getElementById('starDdlShadow').checked;
                const gSize = document.getElementById('greetingSize').value;
                const hGrid = document.getElementById('homeGridCols').value;
                const hGap = document.getElementById('homeGridGap').value;
                
                document.getElementById('lblGreeting').innerText = gSize + 'rem';
                document.getElementById('lblHomeGridCols').innerText = hGrid + '格';
                document.getElementById('lblHomeGridGap').innerText = hGap + 'px';
                document.getElementById('lblRows').innerText = document.getElementById('matrixRows').value;
                document.getElementById('lblCols').innerText = document.getElementById('matrixCols').value;

                root.style.setProperty('--header-timer-scale', scale);
                root.style.setProperty('--header-timer-x', xOffset + 'px');
                root.style.setProperty('--star-ddl-color-normal', colorNormal);
                root.style.setProperty('--star-ddl-color-running', colorRunning);
                root.style.setProperty('--star-ddl-shadow', ddlShadow ? '2px 2px 8px rgba(0,0,0,0.9)' : 'none');
                root.style.setProperty('--greeting-size', gSize + 'rem');
                root.style.setProperty('--home-grid-cols', hGrid);
                root.style.setProperty('--home-grid-margin', hGap + 'px');
                
                // 实时通知引擎对所有模块进行网格重排避让计算
                if (this.grid) {
                    this.grid.column(parseInt(hGrid, 10), 'moveScale');
                    this.grid.margin(hGap + 'px');
                }
                
                this.saveSettings();
            },

            updateVolumeUI() {
                const vol = document.getElementById('alertVolume').value;
                const restVol = document.getElementById('restAlertVolume').value;
                document.getElementById('lblVolume').innerText = Math.round(vol * 100) + '%';
                document.getElementById('lblRestVolume').innerText = Math.round(restVol * 100) + '%';
                
                document.getElementById('lblAlertDur').innerText = document.getElementById('alertDuration').value + 's';
                document.getElementById('lblAlertCount').innerText = document.getElementById('alertCount').value + '次';
                document.getElementById('lblFocusDelay').innerText = document.getElementById('focusDelay').value + 'min';
                document.getElementById('lblRestDelay').innerText = document.getElementById('restDelay').value + 's';

                this.saveSettings();
            },

            toggleAiSettings() {
                const prov = document.getElementById('aiProvider').value;
                if(prov === 'ollama') {
                    document.getElementById('cloudApiConfig').classList.add('hidden');
                    document.getElementById('ollamaConfig').classList.remove('hidden');
                } else {
                    document.getElementById('cloudApiConfig').classList.remove('hidden');
                    document.getElementById('ollamaConfig').classList.add('hidden');
                }
                this.saveSettings();
            },

            toggleRestAlertSettings() {
                const sep = document.getElementById('separateRestAlert').checked;
                if(sep) document.getElementById('restAlertConfig').classList.remove('hidden');
                else document.getElementById('restAlertConfig').classList.add('hidden');
                this.saveSettings();
            },

            showView(v) {
                if (state.view === 'library') library.select(state.activeTaskId);
                state.view = v;
                document.querySelectorAll('.view-page').forEach(el => el.classList.add('hidden'));
                document.getElementById(`${v}Page`).classList.remove('hidden');

                const titleMap = { 'home': '主页', 'library': '库', 'pomodoro': '番茄钟', 'music': '音乐控制台', 'settings': '设置', 'history': '历史归档' };
                document.getElementById('activeTabTitle').innerText = (titleMap[v] || v).toUpperCase();
                
                document.querySelectorAll('.nav-btn').forEach(b => { b.classList.remove('active'); if(b.dataset.view === v) b.classList.add('active'); });

                if (v === 'pomodoro') this.updateChain();
                else if (v === 'home') this.renderHomeModules();
                else if (v === 'music') musicManager.init();
                
                this.syncTheme(); timer.render(); 
            },

            showHistoryPage() {
                const t = state.tasks.find(x => x.id === state.activeTaskId); if(!t) return;
                document.getElementById('historyTaskTitle').innerText = t.title; document.getElementById('historySearchInput').value = "";
                this.renderHistoryList(); this.showView('history');
            },

            renderHistoryList() {
                const t = state.tasks.find(x => x.id === state.activeTaskId); if(!t) return;
                const q = document.getElementById('historySearchInput').value.toLowerCase();
                let history = t.bridgeHistory || [];
                const filtered = history.filter(h => h.note.toLowerCase().includes(q) || new Date(h.time).toLocaleString().includes(q)).reverse();
                const container = document.getElementById('historyListContainer');
                if(filtered.length === 0) { container.innerHTML = `<div class="text-center opacity-30 font-bold py-12">没有匹配的历史归档</div>`; return; }
                container.innerHTML = filtered.map(h => `<div class="p-6 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"><div class="flex justify-between items-center mb-3"><span class="text-yellow-500 text-xs font-bold uppercase tracking-widest">BRIDGE_ LOG</span><time class="text-xs text-white/40">${new Date(h.time).toLocaleString()}</time></div><p class="text-white/90 text-base font-bold leading-relaxed whitespace-pre-wrap">${h.note}</p></div>`).join('');
            },

            updateHomeBridge() {
                let bridges = state.tasks.filter(t => t.currentBridge && t.status === 'active');
                bridges.sort((a, b) => { if(a.weight !== b.weight) return b.weight - a.weight; return (a.ddl || Infinity) - (b.ddl || Infinity); });
                const container = document.getElementById('homeBridgeContainer');
                const wrapper = container ? container.closest('.home-module') : null;
                if (!container) return;
                if(bridges.length > 0) {
                    container.innerHTML = bridges.map(t => {
                        const pColor = state.settings.priorityColors[t.weight] || '#ffffff'; const starsStr = '⭐'.repeat(t.weight);
                        return `<div class="pl-8 border-l-4 cursor-pointer hover:bg-white/5 py-4 transition-all rounded-r" style="border-color: ${pColor}" onclick="app.jumpToLibraryTask(${t.id})"><div class="text-sm font-black uppercase tracking-widest mb-2 flex items-center gap-2" style="color: ${pColor}"><span>${t.title}</span><span class="text-[10px]">${starsStr}</span></div><div class="text-3xl font-black text-white/90 leading-snug">${t.currentBridge}</div></div>`;
                    }).join('');
                    if(wrapper) wrapper.classList.remove('hidden'); else container.classList.remove('hidden');
                } else { container.innerHTML = ''; if(wrapper) wrapper.classList.add('hidden'); else container.classList.add('hidden'); }
            },

            jumpToLibraryTask(tid) { library.setFilter('active'); library.select(tid); this.showView('library'); },
            jumpToLibraryAndFocusBridge(e) { if(e) e.stopPropagation(); this.showView('library'); setTimeout(() => { const input = document.getElementById('inlineBridgeInput'); if(input) input.focus(); }, 300); },

            handleGlobalClick(e) {
                const addMenu = document.getElementById('homeAddMenu');
                if (addMenu && !addMenu.classList.contains('hidden') && !e.target.closest('#homeAddMenu') && !e.target.closest('#homeAddModuleBtn')) {
                    addMenu.classList.add('hidden');
                }
                if (e.target.closest('input, button, select, .nav-btn, .hover-icon, .cursor-pointer, .drag-handle, svg, .dot-matrix, textarea, .ddl-part')) return;
                if (state.view === 'pomodoro') {
                    if (this.clickTimeout) { clearTimeout(this.clickTimeout); this.clickTimeout = null; timer.handleDoubleClick(); } 
                    else { this.clickTimeout = setTimeout(() => { timer.toggle(); this.clickTimeout = null; }, 250); }
                } 
                else if (e.target.closest('#headerTimer') && state.timer.status !== 'idle') timer.toggle();
            },

            syncTheme() {
                // 重置所有影响背景的 class
                document.body.classList.remove('pomo-work', 'pomo-rest', 'pomo-pause', 'is-focus-running');
                const h = document.getElementById('mainHeader'); h.style.backgroundColor = 'transparent';
                
                // 如果处于 focus running，全局通知 DDL 变色
                if (state.timer.status === 'running' && state.timer.mode === 'focus') {
                    document.body.classList.add('is-focus-running');
                }

                let colorClass = '';
                if (state.timer.status === 'paused') colorClass = 'pomo-pause';
                else if (state.timer.status !== 'idle') colorClass = state.timer.mode === 'focus' ? 'pomo-work' : 'pomo-rest';

                if (colorClass) {
                    if (state.view === 'pomodoro') {
                        document.body.classList.add(colorClass); // 番茄钟页全屏变色
                    } else {
                        // 非番茄钟页，背景黑，Header 变色
                        const colors = {'pomo-work': '#0ea5e9', 'pomo-rest': '#10b981', 'pomo-pause': '#27272a'};
                        h.style.backgroundColor = colors[colorClass];
                    }
                }
            },

            startFocusFromLibrary() { 
                musicManager.autoStartWorkMusic();
                const t = state.tasks.find(x => x.id === state.activeTaskId);
                if (t && t.currentBridge) {
                    if(!t.bridgeHistory) t.bridgeHistory = [];
                    t.bridgeHistory.push({ note: t.currentBridge, time: Date.now() });
                    t.currentBridge = ""; library.save(); app.updateHomeBridge();
                }
                this.showView('pomodoro'); timer.reset(); timer.start(); 
            },
            
            jumpToTask() { this.showView('library'); },

            startResize(e) {
                e.preventDefault();
                window.addEventListener('mousemove', app.doResize);
                window.addEventListener('mouseup', app.stopResize);
                document.body.style.cursor = 'col-resize';
            },
            doResize(e) {
                const container = document.getElementById('libraryPage');
                const totalWidth = container.clientWidth;
                let newPct = (e.clientX / totalWidth) * 100;
                if(newPct < 20) newPct = 20;
                if(newPct > 70) newPct = 70;
                document.documentElement.style.setProperty('--lib-left-w', newPct + '%');
                state.settings.libLeftWidth = newPct;
            },
            stopResize() {
                window.removeEventListener('mousemove', app.doResize);
                window.removeEventListener('mouseup', app.stopResize);
                document.body.style.cursor = '';
                app.saveSettings();
            },

            updateChain() {
                const t = state.tasks.find(x => x.id === state.activeTaskId);
                if (t) {
                    document.getElementById('chainBig').innerText = t.title;
                    const pendingSteps = t.steps.filter(s => !s.done);
                    document.getElementById('chainCurrent').innerText = `当前: ${pendingSteps[0] ? pendingSteps[0].text : '复盘与收尾'}`;
                    document.getElementById('chainNext').innerText = `下一步: ${pendingSteps[1] ? pendingSteps[1].text : '--'}`;
                } else {
                    document.getElementById('chainBig').innerText = '自由心流';
                    document.getElementById('chainCurrent').innerText = '当前: 专注时间';
                    document.getElementById('chainNext').innerText = '下一步: 休息';
                }
            },

            handleAudioUpload(e) {
                const file = e.target.files[0]; if(!file) return;
                if(file.size > 2 * 1024 * 1024) return alert("音频文件需小于 2MB 以便离线存储。");
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const base64 = evt.target.result; localStorage.setItem('nf_custom_audio', base64);
                    document.getElementById('audioCustom').src = base64; document.getElementById('customAudioName').innerText = file.name;
                    document.getElementById('alertSound').value = 'custom'; this.saveSettings(); alert("自定义音频导入成功！");
                };
                reader.readAsDataURL(file);
            },

            saveSettings() {
                state.settings.priorityStyle = document.getElementById('priorityStyle').value;
                state.settings.aiProvider = document.getElementById('aiProvider').value;
                state.settings.apiKey = document.getElementById('apiKey').value;
                state.settings.clockFormat = document.getElementById('clockFormat').value;
                state.settings.dayStartTime = document.getElementById('dayStartTime').value;
                state.settings.ddlStyle = document.getElementById('ddlStyle').value;
                state.settings.ddlMaxUnit = document.getElementById('ddlMaxUnit').value;

                state.settings.headerTimerScale = document.getElementById('headerTimerScale').value;
                state.settings.headerTimerX = document.getElementById('headerTimerX').value;
                state.settings.starDdlColorNormal = document.getElementById('starDdlColorNormal').value;
                state.settings.starDdlColorRunning = document.getElementById('starDdlColorRunning').value;
                state.settings.starDdlShadow = document.getElementById('starDdlShadow').checked;
                state.settings.greetingSize = document.getElementById('greetingSize').value;
                state.settings.homeGridCols = parseInt(document.getElementById('homeGridCols').value);
                
                state.settings.alertDuration = parseInt(document.getElementById('alertDuration').value);
                state.settings.alertCount = parseInt(document.getElementById('alertCount').value);
                state.settings.focusDelay = parseInt(document.getElementById('focusDelay').value);
                state.settings.restDelay = parseInt(document.getElementById('restDelay').value);
                state.settings.alertSound = document.getElementById('alertSound').value;
                state.settings.alertVolume = document.getElementById('alertVolume').value;
                state.settings.separateRestAlert = document.getElementById('separateRestAlert').checked;
                state.settings.restAlertSound = document.getElementById('restAlertSound').value;
                state.settings.restAlertVolume = document.getElementById('restAlertVolume').value;
                
                state.settings.matrixRows = document.getElementById('matrixRows').value;
                state.settings.matrixCols = document.getElementById('matrixCols').value;
                
                state.settings.ollamaUrl = document.getElementById('ollamaUrl').value;
                state.settings.ollamaModel = document.getElementById('ollamaModel').value;
                state.settings.promptReview = document.getElementById('promptReview').value;
                state.settings.promptFlow = document.getElementById('promptFlow').value;

                state.settings.musicApiUrl = document.getElementById('musicApiUrl').value;
                state.settings.musicCookie = document.getElementById('musicCookie').value;
                if (state.settings.quickNotes === undefined) state.settings.quickNotes = '';

                state.settings.priorityColors[5] = document.getElementById('cColor5').value;
                state.settings.priorityColors[4] = document.getElementById('cColor4').value;
                state.settings.priorityColors[3] = document.getElementById('cColor3').value;
                state.settings.priorityColors[2] = document.getElementById('cColor2').value;
                state.settings.priorityColors[1] = document.getElementById('cColor1').value;

                localStorage.setItem('nf_settings_v5.4', JSON.stringify(state.settings));
                if(state.view === 'library') library.renderList();
                updateClock(); app.updateHomeBridge();
            },

            downloadApp() {
                const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([document.documentElement.outerHTML], { type: 'text/html' }));
                a.download = `FLOW_v5.4_${Date.now()}.html`; a.click();
            },

            loadWidgetStyles() {
                const tgt = document.getElementById('widgetStyleTarget').value;
                const style = state.settings.widgetStyles?.[tgt] || { bc: '#ffffff', bw: 1, bgc: '#ffffff', bgo: 3 };
                document.getElementById('wgBorderColor').value = style.bc;
                document.getElementById('wgBorderWidth').value = style.bw;
                document.getElementById('lblWgBorderW').innerText = style.bw + 'px';
                document.getElementById('wgBgColor').value = style.bgc;
                document.getElementById('wgBgOpacity').value = style.bgo;
                document.getElementById('lblWgBgOp').innerText = style.bgo + '%';
            },

            saveWidgetStyles() {
                const tgt = document.getElementById('widgetStyleTarget').value;
                if(!state.settings.widgetStyles) state.settings.widgetStyles = {};
                state.settings.widgetStyles[tgt] = {
                    bc: document.getElementById('wgBorderColor').value,
                    bw: document.getElementById('wgBorderWidth').value,
                    bgc: document.getElementById('wgBgColor').value,
                    bgo: document.getElementById('wgBgOpacity').value
                };
                this.saveSettings();
                this.renderHomeModules();
            }
        };

window.app = app;
window.onload = () => { app.init(); };

