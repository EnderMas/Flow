// --- 库引擎 ---
        let draggedListIndex = null; let draggedStepIndex = null;
        const library = {
            currentReviewTaskId: null,
            toggleSortMenu(e) { e.stopPropagation(); document.getElementById('sortDropdown').classList.toggle('hidden'); },
            setSortMethod(method) { state.settings.sortMethod = method; app.saveSettings(); document.getElementById('sortDropdown').classList.add('hidden'); },
            toggleSortOrder() {
                state.settings.sortOrder = state.settings.sortOrder === 'asc' ? 'desc' : 'asc';
                document.getElementById('sortOrderIcon').innerText = state.settings.sortOrder === 'asc' ? '↑' : '↓';
                app.saveSettings();
            },
            setFilter(f) {
                state.libraryFilter = f;
                document.querySelectorAll('.lib-filter').forEach(el => { el.classList.remove('active'); if(el.dataset.filter === f) el.classList.add('active'); });
                const btnTrash = document.getElementById('btnEmptyTrash');
                if (f === 'deleted') btnTrash.classList.remove('hidden'); else btnTrash.classList.add('hidden');
                document.getElementById('libPlaceholder').classList.remove('hidden'); document.getElementById('libActive').classList.add('hidden');
                state.activeTaskId = null; this.renderList();
            },
            emptyTrash() { if(confirm("确定清空垃圾桶？此操作无法恢复。")) { state.tasks = state.tasks.filter(t => t.status !== 'deleted'); this.save(); this.renderList(); } },
            getSortedTasks() {
                let list = state.tasks.filter(t => t.status === state.libraryFilter);
                const { sortMethod, sortOrder } = state.settings;
                if (sortMethod !== 'custom') {
                    list.sort((a, b) => {
                        let valA, valB;
                        if(sortMethod === 'ddl') { valA = a.ddl || Infinity; valB = b.ddl || Infinity; }
                        else if(sortMethod === 'weight') { valA = a.weight; valB = b.weight; }
                        else if(sortMethod === 'created') { valA = a.createdAt; valB = b.createdAt; }
                        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
                        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
                        return 0;
                    });
                }
                return list;
            },
            renderList() {
                const listEl = document.getElementById('projectList');
                const sorted = this.getSortedTasks();
                if(sorted.length === 0) { listEl.innerHTML = `<div class="opacity-30 text-sm font-bold mt-8 text-center border border-white/10 py-6 rounded">当前列表为空</div>`; return; }

                const style = state.settings.priorityStyle || 'bar';
                const isCustom = state.settings.sortMethod === 'custom';
                const nowTime = Date.now();

                listEl.innerHTML = sorted.map((t, index) => {
                    const pColor = state.settings.priorityColors[t.weight] || state.settings.priorityColors[2];
                    let itemStyles = ``; let titleStyles = ``; let titleClass = `font-bold uppercase truncate ${t.id === state.activeTaskId ? 'text-white' : 'text-white/60'}`;
                    
                    if (style === 'block') { itemStyles = `background-color: ${pColor}15; border-color: ${pColor}40;`; titleClass = `font-bold uppercase truncate text-white shadow-sm`; } 
                    else if (style === 'bar') { itemStyles = `border-left: 4px solid ${pColor};`; } 
                    else if (style === 'text') { titleStyles = `color: ${pColor};`; }
                    
                    return `
                    <div class="flex gap-4 p-4 border border-white/5 hover:bg-white/10 transition-all rounded ${t.id === state.activeTaskId ? 'bg-white/10 shadow-lg' : ''} ${isCustom?'cursor-grab active:cursor-grabbing':'cursor-pointer'}" 
                         style="${itemStyles}" 
                         ${isCustom ? `draggable="true" ondragstart="library.dragListStart(event, ${index})" ondragover="library.dragListOver(event)" ondrop="library.dragListDrop(event, ${index})" ondragend="library.dragListEnd(event)"` : ''}
                         onclick="library.select(${t.id})">
                        <div class="flex-1 min-w-0 flex flex-col justify-center">
                            <div class="flex justify-start items-center gap-2">
                                <button onclick="library.toggleStar(event, ${t.id})" class="shrink-0 text-lg leading-none ${t.isStarred ? 'text-yellow-400 opacity-100' : 'text-white opacity-20 hover:opacity-100'} transition-all" title="置顶星标">★</button>
                                <div class="${titleClass} flex-1" style="${titleStyles}">${t.title}</div>
                            </div>
                            ${t.extDdl ? `<div class="mt-3"><span class="text-[10px] font-bold text-red-400 bg-red-400/10 px-2 py-1 rounded">⚡ 约束</span></div>` : ''}
                        </div>
                        <div class="item-ddl-updater shrink-0 flex items-center justify-end" data-id="${t.id}">${renderDdlUi(t, nowTime).html}</div>
                    </div>`
                }).join('');
            },
            
            toggleStar(e, id) {
                e.stopPropagation(); state.tasks.forEach(t => t.isStarred = false);
                const tk = state.tasks.find(t => t.id === id); if(tk) tk.isStarred = true;
                this.save(); this.renderList(); updateClock();
            },

            addProject(e) {
                if (e && e.preventDefault) e.preventDefault();
                this.setFilter('active'); const id = Date.now(); const d = new Date(); d.setHours(23, 59, 59, 999);
                state.tasks.unshift({ id, title: '新建项目', status: 'active', weight: 2, extDdl: "", steps: [{text: '第一步动作', done: false}], isNew: true, ddl: d.getTime(), ddlHasTime: false, createdAt: id, currentBridge: "", bridgeHistory: [], isStarred: false });
                this.save(); this.select(id); setTimeout(() => document.getElementById('editTitle').focus(), 50);
            },

            select(id) {
                const prev = state.tasks.find(t => t.id === state.activeTaskId);
                if (prev && prev.isNew && prev.title === '新建项目') state.tasks = state.tasks.filter(t => t.id !== prev.id);

                state.activeTaskId = id; const task = state.tasks.find(t => t.id === id);
                if (!task) return;
                
                task.isNew = false;
                document.getElementById('libPlaceholder').classList.add('hidden'); document.getElementById('libActive').classList.remove('hidden');
                const reviewPanel = document.getElementById('archiveReviewPanel'); if (reviewPanel) reviewPanel.classList.add('hidden'); this.currentReviewTaskId = null;
                document.getElementById('editTitle').innerText = task.title; document.getElementById('editExtDdl').value = task.extDdl || ""; document.getElementById('inlineBridgeInput').value = task.currentBridge || "";

                this.renderStars(task.weight); this.updateDdlUi(); this.resetAiButton(); this.renderSteps(); this.updateExpectedCoinDisplay(task); this.renderList(); this.save(); updateClock();
            },

            saveInlineBridge() {
                const t = state.tasks.find(x => x.id === state.activeTaskId);
                if(t) { t.currentBridge = document.getElementById('inlineBridgeInput').value.trim(); this.save(); app.updateHomeBridge(); }
            },

            updateDdlUi() {
                const t = state.tasks.find(x => x.id === state.activeTaskId);
                const eY = document.getElementById('ddlYear'), eM = document.getElementById('ddlMonth'), eD = document.getElementById('ddlDate'), eH = document.getElementById('ddlHour'), eMi = document.getElementById('ddlMinute');
                if(!t || !t.ddl) {
                    eY.innerText = 'YYYY'; eM.innerText = 'MM'; eD.innerText = 'DD'; eH.innerText = '--'; eMi.innerText = '--'; return;
                }
                const d = new Date(t.ddl);
                eY.innerText = d.getFullYear(); eM.innerText = String(d.getMonth() + 1).padStart(2, '0'); eD.innerText = String(d.getDate()).padStart(2, '0');
                if(t.ddlHasTime) { eH.innerText = String(d.getHours()).padStart(2, '0'); eMi.innerText = String(d.getMinutes()).padStart(2, '0'); } 
                else { eH.innerText = '--'; eMi.innerText = '--'; }
            },
            
            editDdlDirect(type, val) {
                const t = state.tasks.find(x => x.id === state.activeTaskId); if(!t) return;
                if(!t.ddl) { t.ddl = new Date().setHours(23, 59, 59, 999); t.ddlHasTime = false; }
                let d = new Date(t.ddl);
                const num = parseInt(val); if(isNaN(num)) { this.updateDdlUi(); return; }

                switch(type) {
                    case 'year': d.setFullYear(num); break; case 'month': d.setMonth(num - 1); break; case 'date': d.setDate(num); break;
                    case 'hour': t.ddlHasTime = true; d.setHours(num); break; case 'minute': t.ddlHasTime = true; d.setMinutes(num); break;
                }
                t.ddl = d.getTime(); this.save(); this.updateDdlUi(); this.renderList(); this.updateExpectedCoinDisplay(t); updateClock();
            },

            scrollDdl(e, type) {
                e.preventDefault(); const t = state.tasks.find(x => x.id === state.activeTaskId); if(!t) return;
                if(!t.ddl) { t.ddl = new Date().setHours(23, 59, 59, 999); t.ddlHasTime = false; }
                let d = new Date(t.ddl); const sign = e.deltaY < 0 ? 1 : -1;

                switch(type) {
                    case 'year': d.setFullYear(d.getFullYear() + sign); break; case 'month': d.setMonth(d.getMonth() + sign); break; case 'date': d.setDate(d.getDate() + sign); break;
                    case 'hour': t.ddlHasTime = true; if(document.getElementById('ddlHour').innerText === '--') d.setHours(12); d.setHours(d.getHours() + sign); break;
                    case 'minute': t.ddlHasTime = true; if(document.getElementById('ddlMinute').innerText === '--') { d.setHours(12); d.setMinutes(0); } d.setMinutes(d.getMinutes() + sign * 1); break;
                }
                t.ddl = d.getTime(); this.save(); this.updateDdlUi(); this.renderList(); this.updateExpectedCoinDisplay(t); updateClock();
            },

            clearDdl() { const t = state.tasks.find(x => x.id === state.activeTaskId); if(t) { t.ddl = null; t.ddlHasTime = false; this.save(); this.updateDdlUi(); this.renderList(); updateClock(); } },

            renderStars(weight) {
                let html = '';
                for(let i=1; i<=5; i++) {
                    const color = i <= weight ? state.settings.priorityColors[weight] : '#ffffff33';
                    html += `<svg onclick="library.setWeight(${i})" class="w-5 h-5 cursor-pointer hover:scale-110 transition-transform" style="color: ${color};" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`;
                }
                document.getElementById('priorityStarsContainer').innerHTML = html;
                document.getElementById('priorityText').innerText = {1:'低', 2:'中', 3:'高', 4:'极高', 5:'决战'}[weight] || '中';
                document.getElementById('priorityText').style.color = state.settings.priorityColors[weight];
            },

            setWeight(val) { const t = state.tasks.find(x => x.id === state.activeTaskId); if(t) { t.weight = val; this.save(); this.renderStars(val); this.renderList(); this.updateExpectedCoinDisplay(t); app.updateHomeBridge(); updateClock(); } },
            resetAiButton() { const icon = document.getElementById('aiReviewIcon'); icon.innerText = '✨'; icon.classList.remove('spinning'); document.getElementById('aiReviewOutput').classList.add('hidden'); },
            saveTitle() { const t = state.tasks.find(x => x.id === state.activeTaskId); if (t) { t.title = document.getElementById('editTitle').innerText || '未命名项目'; this.save(); this.renderList(); app.updateHomeBridge(); updateClock(); } },
            saveAttrs() { const t = state.tasks.find(x => x.id === state.activeTaskId); if (!t) return; t.extDdl = document.getElementById('editExtDdl').value; this.save(); this.renderList(); updateClock(); app.updateHomeBridge(); },
            archiveProject() {
                const t = state.tasks.find(x => x.id === state.activeTaskId);
                if (!t) return;
                this.currentReviewTaskId = t.id;
                const panel = document.getElementById('archiveReviewPanel');
                if (!panel) return;
                document.getElementById('archiveReviewNote').value = t.reviewNote || '';
                const diff = t.reviewDifficulty !== undefined ? t.reviewDifficulty : 50;
                const slider = document.getElementById('archiveDifficulty');
                if (slider) slider.value = diff;
                const label = document.getElementById('archiveDifficultyValue');
                if (label) label.innerText = diff;
                this.updateExpectedCoinDisplay(t);
                panel.classList.remove('hidden');
                const steps = document.getElementById('libSteps');
                if (steps) steps.classList.add('opacity-50');
                panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
            },
            confirmArchiveProjectReview() {
                const task = state.tasks.find(x => x.id === this.currentReviewTaskId);
                if (!task) return;
                const note = document.getElementById('archiveReviewNote')?.value.trim() || '';
                const difficulty = parseInt(document.getElementById('archiveDifficulty')?.value, 10) || 0;
                task.reviewNote = note;
                task.reviewDifficulty = difficulty;
                task.completedAt = Date.now();
                const coins = this.calculateArchiveCoins(task);
                task.archiveCoins = coins;
                task.status = 'archived';
                state.coins = Math.round(((state.coins || 0) + coins) * 100) / 100;
                this.save(); app.saveCoinBalance(); this.setFilter('active'); app.updateHomeBridge();
                this.hideArchiveReview();
                alert(`归档成功，获得 ${coins.toFixed(2)} 金币！`);
            },
            cancelArchiveReview() {
                this.hideArchiveReview();
            },
            hideArchiveReview() {
                const panel = document.getElementById('archiveReviewPanel');
                if (panel) panel.classList.add('hidden');
                const steps = document.getElementById('libSteps');
                if (steps) steps.classList.remove('opacity-50');
                this.currentReviewTaskId = null;
            },
            calculateArchiveCoins(task) {
                const difficulty = Math.max(0, Number(task.reviewDifficulty || 0));
                if (difficulty === 0) return 0;
                const now = Date.now();
                const timeRemaining = task.ddl ? Math.max(0, task.ddl - now) : 0;
                const deadlineScore = task.ddl ? Math.min(1, timeRemaining / (21 * 24 * 60 * 60 * 1000)) : 0.5;
                const priorityScore = Math.min(1, Math.max(0, ((task.weight || 2) - 1) / 4));
                const complexityScore = Math.min(1, (((task.steps?.length || 1) - 1) + ((task.pomodoroCount || 0) / 2)) / 8);
                const reviewScore = Math.min(1, Math.max(0, difficulty / 100));
                const weightedTotal = deadlineScore * 0.2 + priorityScore * 0.1 + complexityScore * 0.2 + reviewScore * 0.5;
                const base = difficulty / 8;
                const modifier = 0.7 + weightedTotal * 0.6;
                const coins = base * modifier;
                return Math.round(coins * 100) / 100;
            },
            updateArchiveDifficultyLabel(val) {
                const label = document.getElementById('archiveDifficultyValue');
                if (label) label.innerText = val;
                const task = state.tasks.find(x => x.id === this.currentReviewTaskId || x.id === state.activeTaskId);
                if (task) this.updateExpectedCoinDisplay(task);
            },
            getExpectedArchiveCoins(task) {
                if (!task) return 0;
                const previewTask = { ...task, reviewDifficulty: Number(task.reviewDifficulty || document.getElementById('archiveDifficulty')?.value || task.reviewDifficulty || 0) };
                return this.calculateArchiveCoins(previewTask);
            },
            updateExpectedCoinDisplay(task) {
                const display = document.getElementById('expectedCoinDisplay');
                if (!display) return;
                const expected = this.getExpectedArchiveCoins(task);
                display.innerText = `预计: ${expected.toFixed(2)} 金币`;
            },
            scrollArchiveDifficulty(e) {
                e.preventDefault();
                const slider = document.getElementById('archiveDifficulty');
                if (!slider) return;
                const delta = e.deltaY < 0 ? 1 : -1;
                const next = Math.min(100, Math.max(0, parseInt(slider.value, 10) + delta));
                slider.value = next;
                this.updateArchiveDifficultyLabel(next);
            },
            deleteProject() { const t = state.tasks.find(x => x.id === state.activeTaskId); if(t) { t.status = 'deleted'; this.save(); this.setFilter('active'); app.updateHomeBridge(); } },
            renderSteps() {
                const task = state.tasks.find(t => t.id === state.activeTaskId); if(!task) return;
                document.getElementById('libSteps').innerHTML = task.steps.map((s, i) => `
                    <div class="flex items-center gap-4 group border-b border-white/5 pb-2 pt-2 transition-all">
                        <div class="cursor-pointer flex-shrink-0" onclick="library.toggleStep(${i})">
                            <div class="w-5 h-5 rounded-full border-2 ${s.done ? 'border-white bg-white' : 'border-white/30 hover:border-white/60'} flex items-center justify-center transition-all">
                                ${s.done ? '<svg class="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="M5 13l4 4L19 7"/></svg>' : ''}
                            </div>
                        </div>
                        <div class="drag-handle text-xs font-bold opacity-30 px-2 py-2 hover:opacity-100 transition-opacity bg-white/5 rounded" draggable="true" ondragstart="library.dragStepStart(event, ${i})" ondragover="library.dragStepOver(event)" ondrop="library.dragStepDrop(event, ${i})" ondragend="library.dragStepEnd(event)">0${i+1}</div>
                        <div contenteditable="true" id="stepInput_${i}" class="flex-1 bg-transparent outline-none editable-line font-bold break-words min-h-[1.5em] py-1 ${s.done ? 'line-through opacity-30' : ''}" onblur="library.updateStep(${i}, this.innerText)" onkeydown="if(event.key==='Enter' && !event.shiftKey){event.preventDefault(); this.blur(); library.addStep();}">${s.text}</div>
                        <div class="opacity-0 group-hover:opacity-100 flex gap-4 pr-2"><i class="hover-icon text-red-400 text-xl font-bold leading-none" onclick="library.delStep(${i})">×</i></div>
                    </div>`).join('');
                this.updateExpectedCoinDisplay(task);
            },

            addStep() { 
                const t = state.tasks.find(x => x.id === state.activeTaskId); 
                if (t) { 
                    t.steps.push({ text: '', done: false }); 
                    this.save(); 
                    this.renderSteps(); 
                    setTimeout(() => {
                        const el = document.getElementById(`stepInput_${t.steps.length - 1}`);
                        if(el) { 
                            el.focus(); 
                            const range = document.createRange();
                            const sel = window.getSelection();
                            range.selectNodeContents(el);
                            range.collapse(false);
                            sel.removeAllRanges();
                            sel.addRange(range);
                        }
                    }, 50);
                } 
            },
            updateStep(i, val) { 
            const t = state.tasks.find(x => x.id === state.activeTaskId); 
            if (t) { 
                if (val.trim() === '') {
                    t.steps.splice(i, 1);
                    this.save();
                    this.renderSteps();
                } else {
                    t.steps[i].text = val; 
                    this.save(); 
                }
                app.updateChain(); 
            } 
        },
            toggleStep(i) { const t = state.tasks.find(x => x.id === state.activeTaskId); if (t) { t.steps[i].done = !t.steps[i].done; this.save(); this.renderSteps(); app.updateChain(); } },
            delStep(i) { const t = state.tasks.find(x => x.id === state.activeTaskId); if (t) { t.steps.splice(i, 1); this.save(); this.renderSteps(); app.updateChain(); } },
            
            dragListStart(e, i) { draggedListIndex = i; e.dataTransfer.effectAllowed = 'move'; e.target.classList.add('dragging'); }, dragListOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; },
dragListDrop(e, targetIdx) { e.preventDefault(); if (state.settings.sortMethod === 'custom' && draggedListIndex !== null && draggedListIndex !== targetIdx) { const sorted = this.getSortedTasks(); const movedId = sorted[draggedListIndex].id; const targetId = sorted[targetIdx].id; const aIdx = state.tasks.findIndex(t => t.id === movedId); const [moved] = state.tasks.splice(aIdx, 1); const newTargetIdx = state.tasks.findIndex(t => t.id === targetId); state.tasks.splice(newTargetIdx, 0, moved); this.save(); this.renderList(); } draggedListIndex = null; },
            dragListEnd(e) { e.target.classList.remove('dragging'); draggedListIndex = null; },

            dragStepStart(e, i) { draggedStepIndex = i; e.dataTransfer.effectAllowed = 'move'; e.target.parentElement.classList.add('dragging'); }, dragStepOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; },
            dragStepDrop(e, targetIdx) { e.preventDefault(); if (draggedStepIndex !== null && draggedStepIndex !== targetIdx) { const t = state.tasks.find(x => x.id === state.activeTaskId); const [moved] = t.steps.splice(draggedStepIndex, 1); t.steps.splice(targetIdx, 0, moved); this.save(); this.renderSteps(); app.updateChain(); } draggedStepIndex = null; }, dragStepEnd(e) { e.target.parentElement.classList.remove('dragging'); draggedStepIndex = null; },

            save() { localStorage.setItem('nf_tasks_v5.4', JSON.stringify(state.tasks)); }
        };

window.library = library;

