// --- 库引擎 ---
        let draggedListIndex = null; let draggedStepIndex = null;
        const LIB_GROUP_COLLAPSE_KEY = 'nf_library_group_collapse_v5.5';
        const GROUP_META = {
            activity: { label: '活动', accent: 'text-sky-300' },
            daily: { label: '日常', accent: 'text-emerald-300' },
            default: { label: '默认', accent: 'text-white/70' }
        };
        const library = {
            currentReviewTaskId: null,
            groupCollapsed: (() => {
                try {
                    const parsed = JSON.parse(localStorage.getItem(LIB_GROUP_COLLAPSE_KEY) || '{}');
                    return {
                        activity: !!parsed.activity,
                        daily: !!parsed.daily,
                        default: !!parsed.default
                    };
                } catch (error) {
                    return { activity: false, daily: false, default: false };
                }
            })(),
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
            isDailyCompleted(task) {
                if (!task || task.type !== 'daily') return false;
                const occurrences = parseInt(task.daily?.occurrences, 10);
                if (occurrences === -1) return false;
                const count = task.daily?.checkmarks?.length || 0;
                return count >= Math.max(0, occurrences || 0);
            },
            getNextDailyOccurrence(task, fromTime = Date.now()) {
                const frequencyValue = Math.max(1, parseInt(task.daily?.frequencyValue, 10) || 1);
                const unit = task.daily?.frequencyUnit || 'day';
                const base = task.daily?.startAt || fromTime;
                const step = unit === 'week' ? frequencyValue * 7 * 24 * 60 * 60 * 1000 : unit === 'hour' ? frequencyValue * 60 * 60 * 1000 : frequencyValue * 24 * 60 * 60 * 1000;
                let next = base;
                while (next <= fromTime) next += step;
                return next;
            },
            isTaskVisibleInList(task) {
                if (!task || state.libraryFilter !== 'active' || task.type !== 'daily') return true;
                if (this.isDailyCompleted(task)) return true;
                const nextAt = task.daily?.nextAt || null;
                const canUndo = !!task.daily?.canUndo;
                if (task.id === state.activeTaskId) return true;
                if (canUndo) return true;
                if (!nextAt) return true;
                return Date.now() >= nextAt;
            },
            getSortedTasks() {
                let list = state.tasks.filter(t => t.status === state.libraryFilter).filter(t => this.isTaskVisibleInList(t));
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
            getGroupedTasks(sortedList) {
                const grouped = { activity: [], daily: [], default: [] };
                sortedList.forEach((task, index) => {
                    const type = GROUP_META[task.type] ? task.type : 'default';
                    grouped[type].push({ task, index });
                });
                return grouped;
            },
            toggleGroupCollapse(type) {
                if (!GROUP_META[type]) return;
                this.groupCollapsed[type] = !this.groupCollapsed[type];
                localStorage.setItem(LIB_GROUP_COLLAPSE_KEY, JSON.stringify(this.groupCollapsed));
                this.renderList();
            },
            getItemTypeClasses(task) {
                if (task.type === 'daily') {
                    const color = state.settings.priorityColors[task.weight] || '#22c55e';
                    return `background-color: ${color}1f; border-color: ${color}55;`;
                }
                if (task.type === 'activity') return '';
                return '';
            },
            renderTaskRow(t, index, isCustom, nowTime, listIndex) {
                const pColor = state.settings.priorityColors[t.weight] || state.settings.priorityColors[2];
                let itemStyles = this.getItemTypeClasses(t);
                let titleStyles = ``;
                let titleClass = `font-bold uppercase truncate ${t.id === state.activeTaskId ? 'text-white' : 'text-white/60'}`;
                const style = state.settings.priorityStyle || 'bar';
                if (style === 'block') { itemStyles += `background-color: ${pColor}15; border-color: ${pColor}40;`; titleClass = `font-bold uppercase truncate text-white shadow-sm`; }
                else if (style === 'bar' && t.type === 'default') { itemStyles += `border-left: 4px solid ${pColor};`; }
                else if (style === 'text') { titleStyles = `color: ${pColor};`; }
                const typeTag = t.type === 'activity' ? '<span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-sky-400/15 text-sky-300">活动</span>' : (t.type === 'daily' ? '<span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-400/15 text-emerald-300">日常</span>' : '');
                const activityClass = t.type === 'activity' ? 'task-activity-glow' : '';
                return `
                    <div class="flex gap-4 p-4 border border-white/5 hover:bg-white/10 transition-all rounded ${activityClass} ${t.id === state.activeTaskId ? 'bg-white/10 shadow-lg' : ''} ${isCustom?'cursor-grab active:cursor-grabbing':'cursor-pointer'}"
                        style="${itemStyles}"
                        ${isCustom ? `draggable="true" ondragstart="library.dragListStart(event, ${listIndex})" ondragover="library.dragListOver(event)" ondrop="library.dragListDrop(event, ${listIndex})" ondragend="library.dragListEnd(event)"` : ''}
                        onclick="library.select(${t.id})">
                        <div class="flex-1 min-w-0 flex flex-col justify-center">
                            <div class="flex justify-start items-center gap-2">
                                <button onclick="library.toggleStar(event, ${t.id})" class="shrink-0 text-lg leading-none ${t.isStarred ? 'text-yellow-400 opacity-100' : 'text-white opacity-20 hover:opacity-100'} transition-all" title="置顶星标">★</button>
                                <div class="${titleClass} flex-1" style="${titleStyles}">${t.title}</div>
                                ${typeTag}
                            </div>
                            ${t.extDdl ? `<div class="mt-3"><span class="text-[10px] font-bold text-red-400 bg-red-400/10 px-2 py-1 rounded">⚡ 约束</span></div>` : ''}
                        </div>
                        <div class="item-ddl-updater shrink-0 flex items-center justify-end" data-id="${t.id}">${renderDdlUi(t, nowTime).html}</div>
                    </div>`;
            },
            renderList() {
                const listEl = document.getElementById('projectList');
                const sorted = this.getSortedTasks();
                if(sorted.length === 0) { listEl.innerHTML = `<div class="opacity-30 text-sm font-bold mt-8 text-center border border-white/10 py-6 rounded">当前列表为空</div>`; return; }

                const isCustom = state.settings.sortMethod === 'custom';
                const nowTime = Date.now();
                const grouped = this.getGroupedTasks(sorted);
                const order = ['activity', 'daily', 'default'];
                listEl.innerHTML = order.map((type) => {
                    const rows = grouped[type] || [];
                    const groupInfo = GROUP_META[type];
                    const collapsed = this.groupCollapsed[type];
                    const groupRows = rows.map(({ task, index }) => this.renderTaskRow(task, index, isCustom, nowTime, index)).join('');
                    return `
                        <div class="border border-white/10 rounded-xl p-2 bg-white/5">
                            <button type="button" onclick="library.toggleGroupCollapse('${type}')" class="w-full flex items-center justify-between px-2 py-2 text-left hover:bg-white/10 rounded transition-all">
                                <span class="text-xs font-bold uppercase tracking-widest ${groupInfo.accent}">${groupInfo.label} (${rows.length})</span>
                                <span class="text-xs font-black opacity-70">${collapsed ? '▸' : '▾'}</span>
                            </button>
                            <div class="space-y-3 pt-2 ${collapsed ? 'hidden' : ''}">${groupRows || '<div class="opacity-30 text-xs px-2 py-2">暂无项目</div>'}</div>
                        </div>`;
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
                state.tasks.unshift({
                    id,
                    title: '新建项目',
                    status: 'active',
                    weight: 2,
                    extDdl: "",
                    steps: [{ text: '第一步动作', done: false }],
                    isNew: true,
                    ddl: d.getTime(),
                    ddlHasTime: false,
                    createdAt: id,
                    currentBridge: "",
                    bridgeHistory: [],
                    isStarred: false,
                    type: 'default',
                    daily: {
                        startAt: d.getTime(),
                        hasTime: false,
                        frequencyValue: 1,
                        frequencyUnit: 'day',
                        occurrences: -1,
                        checkmarks: [],
                        nextAt: null,
                        canUndo: false,
                        undoCheckpoint: null
                    },
                    activity: {
                        link: '',
                        summary: '',
                        linkedTaskIds: []
                    }
                });
                this.save(); this.select(id); setTimeout(() => document.getElementById('editTitle').focus(), 50);
            },

            clearPrevDailyUndoIfNeeded(prevTaskId, nextTaskId) {
                if (!prevTaskId || prevTaskId === nextTaskId) return;
                const prev = state.tasks.find(t => t.id === prevTaskId);
                if (!prev || prev.type !== 'daily' || !prev.daily?.canUndo) return;
                prev.daily.canUndo = false;
                prev.daily.undoCheckpoint = null;
            },

            updateTypeUi(task) {
                const type = task?.type || 'default';
                const ddlLabel = document.getElementById('ddlLabel');
                const dailyPanel = document.getElementById('dailyTaskPanel');
                const activityPanel = document.getElementById('activityTaskPanel');
                const activityEdit = document.getElementById('activityLinkEditWrap');
                const activityInput = document.getElementById('activityLinkInputWrap');
                const activityLinkView = document.getElementById('activityLinkViewWrap');

                if (ddlLabel) ddlLabel.innerText = type === 'daily' ? '起始日期:' : '截止日期:';
                if (dailyPanel) dailyPanel.classList.toggle('hidden', type !== 'daily');
                if (activityPanel) activityPanel.classList.toggle('hidden', type !== 'activity');

                ['default', 'daily', 'activity'].forEach((itemType) => {
                    const btn = document.getElementById(`taskTypeBtn_${itemType}`);
                    if (!btn) return;
                    const active = itemType === type;
                    btn.classList.toggle('bg-white', active);
                    btn.classList.toggle('text-black', active);
                    btn.classList.toggle('border-white/40', active);
                    btn.classList.toggle('text-white/60', !active);
                });

                if (type === 'activity') {
                    const hasLink = !!task.activity?.link;
                    const editing = !!task.activity?.editingLink;
                    if (activityEdit) activityEdit.classList.toggle('hidden', !hasLink);
                    if (activityInput) activityInput.classList.toggle('hidden', hasLink && !editing);
                    if (activityLinkView) activityLinkView.classList.toggle('hidden', !hasLink || editing);
                    const linkView = document.getElementById('activityLinkView');
                    if (linkView && hasLink) {
                        linkView.href = task.activity.link;
                        linkView.innerText = task.activity.link;
                    }
                }

                this.updateActionButtons(task);
            },

            updateActionButtons(task) {
                const actionBtn = document.getElementById('taskActionBtn');
                const actionLabel = document.getElementById('taskActionLabel');
                const confirmBtn = document.getElementById('confirmArchiveBtn');
                if (!actionBtn || !actionLabel || !confirmBtn) return;

                // If not daily or already completed => archive (show archive icon)
                if (task.type !== 'daily' || this.isDailyCompleted(task)) {
                    actionBtn.title = '归档';
                    actionBtn.setAttribute('onclick', 'library.archiveProject()');
                    actionLabel.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect></svg> 归档';
                    confirmBtn.innerText = '确认归档';
                    return;
                }

                if (task.daily?.canUndo) {
                    actionBtn.title = '撤销打卡';
                    actionBtn.setAttribute('onclick', 'library.undoDailyCheckin()');
                    actionLabel.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V12"/></svg> 撤销';
                } else {
                    actionBtn.title = '打卡';
                    actionBtn.setAttribute('onclick', 'library.checkInDailyTask()');
                    actionLabel.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                }
                confirmBtn.innerText = '确认归档';
            },

            switchTaskType(type) {
                const task = state.tasks.find(t => t.id === state.activeTaskId);
                if (!task || !['default', 'daily', 'activity'].includes(type)) return;
                task.type = type;
                if (!task.daily) {
                    task.daily = {
                        startAt: task.ddl || Date.now(),
                        hasTime: !!task.ddlHasTime,
                        frequencyValue: 1,
                        frequencyUnit: 'day',
                        occurrences: -1,
                        checkmarks: [],
                        nextAt: null,
                        canUndo: false,
                        undoCheckpoint: null
                    };
                }
                if (!task.activity) task.activity = { link: '', summary: '', linkedTaskIds: [], editingLink: false };
                if (type === 'daily' && !task.daily.startAt) {
                    task.daily.startAt = task.ddl || Date.now();
                    task.daily.hasTime = task.ddlHasTime !== undefined ? !!task.ddlHasTime : false;
                }
                this.save();
                this.updateTypeUi(task);
                this.updateDdlUi();
                this.updateDailyPanel(task);
                this.updateActivityPanel(task);
                this.renderList();
            },

            updateDailyPanel(task) {
                const daily = task?.daily;
                if (!daily) return;
                const freqValue = document.getElementById('dailyFrequencyValue');
                const freqUnit = document.getElementById('dailyFrequencyUnit');
                const occurrences = document.getElementById('dailyOccurrences');
                const progress = document.getElementById('dailyProgressText');
                if (freqValue) freqValue.value = Math.max(1, parseInt(daily.frequencyValue, 10) || 1);
                if (freqUnit) freqUnit.value = daily.frequencyUnit || 'day';
                if (occurrences) occurrences.innerText = daily.occurrences === -1 ? '∞' : String(Math.max(0, parseInt(daily.occurrences, 10) || 0));
                if (progress) {
                    const done = daily.checkmarks?.length || 0;
                    const total = parseInt(daily.occurrences, 10) === -1 ? '∞' : Math.max(0, parseInt(daily.occurrences, 10) || 0);
                    progress.innerText = `打卡进度: ${done}/${total}`;
                }
            },

            saveDailySettings() {
                const task = state.tasks.find(t => t.id === state.activeTaskId);
                if (!task || task.type !== 'daily') return;
                task.daily.frequencyValue = Math.max(1, parseInt(document.getElementById('dailyFrequencyValue')?.value, 10) || 1);
                task.daily.frequencyUnit = document.getElementById('dailyFrequencyUnit')?.value || 'day';
                this.save();
                this.updateDailyPanel(task);
            },

            adjustDailyOccurrences(delta) {
                const task = state.tasks.find(t => t.id === state.activeTaskId);
                if (!task || task.type !== 'daily') return;
                const current = parseInt(task.daily.occurrences, 10);
                const next = Math.max(-1, (Number.isNaN(current) ? -1 : current) + delta);
                task.daily.occurrences = next;
                this.save();
                this.updateDailyPanel(task);
                this.updateActionButtons(task);
            },

            checkInDailyTask() {
                const task = state.tasks.find(t => t.id === state.activeTaskId);
                if (!task || task.type !== 'daily' || this.isDailyCompleted(task)) return;
                const now = Date.now();
                task.daily.checkmarks = task.daily.checkmarks || [];

                // Method B: exponential growth with total equality to default * n
                const growth = 1.15;
                const occurrences = parseInt(task.daily?.occurrences, 10);
                const defaultCoin = Math.max(0.01, this.getExpectedArchiveCoins(task) || 1);

                let base;
                if (occurrences > 0) {
                    const n = occurrences;
                    const numerator = defaultCoin * n * (growth - 1);
                    const denom = Math.pow(growth, n) - 1;
                    base = denom > 0 ? numerator / denom : defaultCoin;
                } else {
                    // fallback for infinite occurrences: base scaled by weight
                    base = this.getDailyBaseUnit ? this.getDailyBaseUnit(task) : (this.getExpectedArchiveCoins(task) || 1);
                }

                const idx = task.daily.checkmarks.length; // 0-based index for this check
                let awarded = Math.round((base * Math.pow(growth, idx)) * 100) / 100;
                if (this.isTaskLinkedToActivity(task)) awarded = Math.round(awarded * 1.2 * 100) / 100;

                // store checkmark as object {ts, coin}
                task.daily.checkmarks.push({ ts: now, coin: awarded });
                task.daily.canUndo = true;
                task.daily.undoCheckpoint = { ts: now, coin: awarded };
                task.daily.nextAt = this.getNextDailyOccurrence(task, now);

                // award coins
                state.coins = Math.round(((state.coins || 0) + awarded) * 100) / 100;
                if (typeof app?.saveCoinBalance === 'function') app.saveCoinBalance();

                this.save();
                this.updateDailyPanel(task);
                this.updateActionButtons(task);
                this.renderDailySchedule(task);
                this.renderList();
            },

            undoDailyCheckin() {
                const task = state.tasks.find(t => t.id === state.activeTaskId);
                if (!task || task.type !== 'daily' || !task.daily?.canUndo) return;
                const marks = task.daily.checkmarks || [];
                if (!marks.length) return;

                // remove last object and subtract its coin
                const last = marks.pop();
                const coin = (last && last.coin) ? Number(last.coin) : 0;
                task.daily.checkmarks = marks;
                task.daily.canUndo = false;
                task.daily.undoCheckpoint = null;

                // recompute nextAt
                if (marks.length) {
                    const prev = marks[marks.length - 1];
                    task.daily.nextAt = this.getNextDailyOccurrence(task, prev.ts || prev);
                } else {
                    task.daily.nextAt = null;
                }

                state.coins = Math.round(((state.coins || 0) - (coin || 0)) * 100) / 100;
                if (state.coins < 0) state.coins = 0;
                if (typeof app?.saveCoinBalance === 'function') app.saveCoinBalance();

                this.save();
                this.updateDailyPanel(task);
                this.updateActionButtons(task);
                this.renderDailySchedule(task);
                this.renderList();
            },

            updateActivityPanel(task) {
                if (!task || task.type !== 'activity') return;
                const summary = document.getElementById('activitySummaryInput');
                const linkInput = document.getElementById('activityLinkInput');
                if (summary) summary.value = task.activity?.summary || '';
                if (linkInput) linkInput.value = task.activity?.link || '';
                this.renderActivityLinkedList(task);
                this.updateTypeUi(task);
            },

            saveActivityAttrs() {
                const task = state.tasks.find(t => t.id === state.activeTaskId);
                if (!task || task.type !== 'activity') return;
                task.activity.summary = document.getElementById('activitySummaryInput')?.value.trim() || '';
                // linkedTaskIds are managed via the activity selector modal; do not parse free-text input here anymore
                this.save();
                this.updateActivityPanel(task);
            },

            saveActivityLink() {
                const task = state.tasks.find(t => t.id === state.activeTaskId);
                if (!task || task.type !== 'activity') return;
                const raw = document.getElementById('activityLinkInput')?.value.trim() || '';
                if (!raw) {
                    task.activity.link = '';
                    task.activity.editingLink = false;
                    this.save();
                    this.updateActivityPanel(task);
                    return;
                }
                try {
                    const u = new URL(raw);
                    if (!['http:', 'https:'].includes(u.protocol)) throw new Error('invalid protocol');
                    task.activity.link = raw;
                    task.activity.editingLink = false;
                    this.save();
                    this.updateActivityPanel(task);
                } catch (error) {
                    alert('活动链接无效，请输入 http/https 链接');
                }
            },

            toggleActivityLinkEdit() {
                const task = state.tasks.find(t => t.id === state.activeTaskId);
                if (!task || task.type !== 'activity') return;
                task.activity.editingLink = !task.activity.editingLink;
                this.save();
                this.updateActivityPanel(task);
            },

            select(id) {
                const prev = state.tasks.find(t => t.id === state.activeTaskId);
                if (prev && prev.isNew && prev.title === '新建项目') state.tasks = state.tasks.filter(t => t.id !== prev.id);
                this.clearPrevDailyUndoIfNeeded(state.activeTaskId, id);

                state.activeTaskId = id; const task = state.tasks.find(t => t.id === id);
                if (!task) return;
                
                task.isNew = false;
                document.getElementById('libPlaceholder').classList.add('hidden'); document.getElementById('libActive').classList.remove('hidden');
                const reviewPanel = document.getElementById('archiveReviewPanel'); if (reviewPanel) reviewPanel.classList.add('hidden'); this.currentReviewTaskId = null;
                document.getElementById('editTitle').innerText = task.title; document.getElementById('editExtDdl').value = task.extDdl || ""; document.getElementById('inlineBridgeInput').value = task.currentBridge || "";

                this.renderStars(task.weight);
                this.migrateDailyCheckmarks(task);
                this.updateDdlUi();
                this.updateTypeUi(task);
                this.updateDailyPanel(task);
                this.updateActivityPanel(task);
                this.resetAiButton();
                this.renderSteps();
                this.updateExpectedCoinDisplay(task);
                this.renderDailySchedule(task);
                this.renderList();
                this.save();
                updateClock();
            },

            saveInlineBridge() {
                const t = state.tasks.find(x => x.id === state.activeTaskId);
                if(t) { t.currentBridge = document.getElementById('inlineBridgeInput').value.trim(); this.save(); app.updateHomeBridge(); }
            },

            getTaskDateModel(task) {
                if (task?.type === 'daily') {
                    return {
                        value: task.daily?.startAt || null,
                        hasTime: task.daily?.hasTime !== undefined ? !!task.daily.hasTime : false,
                        setter: (dateVal, hasTimeVal) => {
                            task.daily.startAt = dateVal;
                            task.daily.hasTime = hasTimeVal;
                        }
                    };
                }
                return {
                    value: task?.ddl || null,
                    hasTime: task?.ddlHasTime !== undefined ? !!task.ddlHasTime : false,
                    setter: (dateVal, hasTimeVal) => {
                        task.ddl = dateVal;
                        task.ddlHasTime = hasTimeVal;
                    }
                };
            },

            updateDdlUi() {
                const t = state.tasks.find(x => x.id === state.activeTaskId);
                const eY = document.getElementById('ddlYear'), eM = document.getElementById('ddlMonth'), eD = document.getElementById('ddlDate'), eH = document.getElementById('ddlHour'), eMi = document.getElementById('ddlMinute');
                const dateModel = this.getTaskDateModel(t);
                if(!t || !dateModel.value) {
                    eY.innerText = 'YYYY'; eM.innerText = 'MM'; eD.innerText = 'DD'; eH.innerText = '--'; eMi.innerText = '--'; return;
                }
                const d = new Date(dateModel.value);
                eY.innerText = d.getFullYear(); eM.innerText = String(d.getMonth() + 1).padStart(2, '0'); eD.innerText = String(d.getDate()).padStart(2, '0');
                if(dateModel.hasTime) { eH.innerText = String(d.getHours()).padStart(2, '0'); eMi.innerText = String(d.getMinutes()).padStart(2, '0'); } 
                else { eH.innerText = '--'; eMi.innerText = '--'; }
            },
            
            editDdlDirect(type, val) {
                const t = state.tasks.find(x => x.id === state.activeTaskId); if(!t) return;
                const dateModel = this.getTaskDateModel(t);
                let current = dateModel.value;
                let hasTime = dateModel.hasTime;
                if(!current) { current = new Date().setHours(23, 59, 59, 999); hasTime = false; }
                let d = new Date(current);
                const num = parseInt(val); if(isNaN(num)) { this.updateDdlUi(); return; }

                switch(type) {
                    case 'year': d.setFullYear(num); break; case 'month': d.setMonth(num - 1); break; case 'date': d.setDate(num); break;
                    case 'hour': hasTime = true; d.setHours(num); break; case 'minute': hasTime = true; d.setMinutes(num); break;
                }
                dateModel.setter(d.getTime(), hasTime);
                this.save(); this.updateDdlUi(); this.renderList(); this.updateExpectedCoinDisplay(t); updateClock();
            },

            scrollDdl(e, type) {
                e.preventDefault(); const t = state.tasks.find(x => x.id === state.activeTaskId); if(!t) return;
                const dateModel = this.getTaskDateModel(t);
                let current = dateModel.value;
                let hasTime = dateModel.hasTime;
                if(!current) { current = new Date().setHours(23, 59, 59, 999); hasTime = false; }
                let d = new Date(current); const sign = e.deltaY < 0 ? 1 : -1;

                switch(type) {
                    case 'year': d.setFullYear(d.getFullYear() + sign); break; case 'month': d.setMonth(d.getMonth() + sign); break; case 'date': d.setDate(d.getDate() + sign); break;
                    case 'hour': hasTime = true; if(document.getElementById('ddlHour').innerText === '--') d.setHours(12); d.setHours(d.getHours() + sign); break;
                    case 'minute': hasTime = true; if(document.getElementById('ddlMinute').innerText === '--') { d.setHours(12); d.setMinutes(0); } d.setMinutes(d.getMinutes() + sign * 1); break;
                }
                dateModel.setter(d.getTime(), hasTime);
                this.save(); this.updateDdlUi(); this.renderList(); this.updateExpectedCoinDisplay(t); updateClock();
            },

            clearDdl() {
                const t = state.tasks.find(x => x.id === state.activeTaskId);
                if (!t) return;
                const dateModel = this.getTaskDateModel(t);
                dateModel.setter(null, false);
                this.save();
                this.updateDdlUi();
                this.renderList();
                updateClock();
            },

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
            saveAttrs() {
                const t = state.tasks.find(x => x.id === state.activeTaskId);
                if (!t) return;
                t.extDdl = document.getElementById('editExtDdl').value;
                this.save();
                this.renderList();
                this.saveDailySettings();
                this.saveActivityAttrs();
                updateClock();
                app.updateHomeBridge();
            },
            archiveProject() {
                const t = state.tasks.find(x => x.id === state.activeTaskId);
                if (!t) return;
                if (t.type === 'daily' && !this.isDailyCompleted(t)) {
                    this.checkInDailyTask();
                    return;
                }
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

            // --- Daily helpers ---
            getDailyBaseUnit(task) {
                // fallback base based on weight when occurrences is infinite or unknown
                const weight = Math.max(1, Number(task.weight || 2));
                const base = Math.round((0.8 * Math.pow(1.25, weight - 1)) * 100) / 100;
                return Math.max(0.01, base);
            },

            isTaskLinkedToActivity(task) {
                if (!task) return false;
                if (task.activity && (task.activity.link || (task.activity.linkedTaskIds && task.activity.linkedTaskIds.length))) return true;
                return (state.tasks || []).some(t => t.type === 'activity' && (t.activity?.linkedTaskIds || []).includes(task.id));
            },

            migrateDailyCheckmarks(task) {
                if (!task || task.type !== 'daily') return;
                task.daily.checkmarks = task.daily.checkmarks || [];
                // if first element is numeric, migrate to objects using Method B distribution
                if (task.daily.checkmarks.length && typeof task.daily.checkmarks[0] === 'number') {
                    const raw = task.daily.checkmarks.slice();
                    task.daily.checkmarks = [];
                    const growth = 1.15;
                    const occurrences = parseInt(task.daily?.occurrences, 10);
                    const defaultCoin = Math.max(0.01, this.getExpectedArchiveCoins(task) || 1);
                    let base;
                    if (occurrences > 0) {
                        const n = occurrences;
                        const numerator = defaultCoin * n * (growth - 1);
                        const denom = Math.pow(growth, n) - 1;
                        base = denom > 0 ? numerator / denom : defaultCoin;
                    } else base = this.getDailyBaseUnit(task);
                    for (let i = 0; i < raw.length; i++) {
                        let coin = Math.round((base * Math.pow(growth, i)) * 100) / 100;
                        if (this.isTaskLinkedToActivity(task)) coin = Math.round(coin * 1.2 * 100) / 100;
                        task.daily.checkmarks.push({ ts: raw[i], coin });
                    }
                    this.save();
                }
            },

            renderDailySchedule(task) {
                const wrap = document.getElementById('dailyScheduleContainer');
                if (!wrap) return;
                if (!task || task.type !== 'daily') { wrap.innerHTML = ''; return; }
                const start = task.daily?.startAt || Date.now();
                const freq = Math.max(1, parseInt(task.daily?.frequencyValue, 10) || 1);
                const unit = task.daily?.frequencyUnit || 'day';
                const step = unit === 'week' ? freq * 7 * 24 * 60 * 60 * 1000 : unit === 'hour' ? freq * 60 * 60 * 1000 : freq * 24 * 60 * 60 * 1000;
                const occ = parseInt(task.daily?.occurrences, 10);
                const marks = (task.daily?.checkmarks || []).slice();
                let listHtml = '';
                const n = occ === -1 ? Math.max(marks.length, 5) : Math.max(marks.length, Math.min(occ, Math.max(marks.length, 5)));
                for (let i = 0; i < n; i++) {
                    const planned = new Date(start + i * step);
                    if (i < marks.length) {
                        const m = marks[i];
                        const actual = new Date(m.ts || m);
                        listHtml += `<div class="flex justify-between items-center p-2 border border-white/6 rounded"><div class="text-xs font-bold">${actual.toLocaleString()}</div><div class="text-sm font-black">${(m.coin||0).toFixed(2)}◎</div></div>`;
                    } else {
                        listHtml += `<div class="flex justify-between items-center p-2 border border-white/6 rounded opacity-50"><div class="text-xs">计划 ${planned.toLocaleString()}</div><div class="text-sm">—</div></div>`;
                    }
                }
                const nextAt = task.daily?.nextAt ? new Date(task.daily.nextAt).toLocaleString() : '—';
                wrap.innerHTML = `<div class="text-[10px] uppercase opacity-50 tracking-wider mb-2">日程 / 打卡记录</div><div class="p-3 bg-white/3 rounded space-y-2">${listHtml}<div class="text-xs opacity-50 pt-2">下次： ${nextAt}</div></div>`;
            },

            openActivitySelector() {
                const modal = document.getElementById('activitySelectorModal');
                if (!modal) return;
                this.populateActivityModal();
                modal.classList.remove('hidden');
            },

            populateActivityModal() {
                const listWrap = document.getElementById('activitySelectorList');
                if (!listWrap) return;
                const currentActivity = state.tasks.find(t => t.id === state.activeTaskId);
                if (!currentActivity || currentActivity.type !== 'activity') return;
                
                // Show all non-activity tasks (active or archived)
                const linkableTargets = (state.tasks || []).filter(t => t.type !== 'activity' && (t.status === 'active' || t.status === 'archived'));
                const linkedIds = currentActivity.activity?.linkedTaskIds || [];
                
                listWrap.innerHTML = linkableTargets.map(t => {
                    return `<label class="flex items-center gap-3 p-2 border border-white/6 rounded hover:bg-white/6 cursor-pointer">
                        <input type="checkbox" name="activitySelector" value="${t.id}" ${linkedIds.includes(t.id) ? 'checked' : ''}>
                        <div class="flex-1"><div class="font-bold">${t.title}</div><div class="text-xs opacity-60">${t.description || ''}</div></div>
                    </label>`;
                }).join('') || '<div class="opacity-40 p-3 text-sm">当前无可链接任务</div>';
            },

            saveActivitySelection() {
                const checked = Array.from(document.querySelectorAll('#activitySelectorList input[name="activitySelector"]:checked')).map(n => parseInt(n.value, 10));
                const task = state.tasks.find(t => t.id === state.activeTaskId);
                if (!task || task.type !== 'activity') return;
                
                task.activity.linkedTaskIds = checked.filter(x => !Number.isNaN(x) && x !== task.id);
                this.save();
                this.renderActivityLinkedList(task);
                
                const modal = document.getElementById('activitySelectorModal');
                if (modal) modal.classList.add('hidden');
            },

            renderActivityLinkedList(task) {
                const container = document.getElementById('activityLinkedList');
                if (!container) return;
                const ids = (task.activity?.linkedTaskIds || []);
                if (!ids.length) { container.innerHTML = `<div class="opacity-40 text-sm">未关联任何任务</div>`; return; }
                const items = ids.map(id => {
                    const t = state.tasks.find(x => x.id === id);
                    return `<div class="flex items-center justify-between p-2 border border-white/6 rounded">
                        <div class="flex-1 truncate">${t ? t.title : ('#' + id)}</div>
                        <div class="ml-4"><button type="button" class="text-xs px-2 py-1 border border-white/10 rounded" onclick="library.unlinkActivityTask(${task.id}, ${id})">删除</button></div>
                    </div>`;
                }).join('');
                container.innerHTML = items;
            },

            unlinkActivityTask(activityId, linkedTaskId) {
                const act = state.tasks.find(t => t.id === activityId);
                if (!act || act.type !== 'activity') return;
                act.activity.linkedTaskIds = (act.activity.linkedTaskIds || []).filter(x => x !== linkedTaskId);
                this.save();
                this.renderActivityLinkedList(act);
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

            save() {
                const payload = JSON.stringify(state.tasks);
                localStorage.setItem('nf_tasks_v5.5', payload);
                localStorage.setItem('nf_tasks_v5.4', payload);
            }
        };

window.library = library;

