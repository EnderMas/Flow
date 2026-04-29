// --- 网易云音乐控制核心 ---
        const musicManager = {
            audio: new Audio(),
            inited: false,
            isPlaying: false,
            source: 'daily', // 'daily' | 'liked'
            playMode: 'sequence', // 'sequence' | 'shuffle' | 'single'
            playlist: [],
            currentIndex: 0,
            likedIds: [],
            userId: null,
            currentSongUrl: '',
            currentLyric: { lines: [], activeIndex: -1 },
            dragFromIndex: null,
            urlCache: new Map(),
            urlCacheSizeBytes: 0,
            URL_CACHE_LIMIT_BYTES: 512 * 1024 * 1024,
            ui: {
                cover: null, title: null, artist: null,
                progress: null, timeNow: null, timeTotal: null,
                playBtn: null, prevBtn: null, nextBtn: null, likeBtn: null,
                playModeBtn: null, sourceDailyBtn: null, sourceLikedBtn: null,
                volume: null, volumeLabel: null,
                lyrics: null, status: null, queueInfo: null, queueList: null
            },
            lastUiProgressVal: null,

            init() {
                if (this.inited) return;
                this.inited = true;

                this.audio.preload = 'auto';
                this.audio.volume = Math.max(0, Math.min(1, parseFloat(this.audio.volume || 1)));

                this.ui.cover = document.getElementById('musicCover');
                this.ui.title = document.getElementById('musicTitle');
                this.ui.artist = document.getElementById('musicArtist');
                this.ui.progress = document.getElementById('musicProgress');
                this.ui.timeNow = document.getElementById('musicTimeNow');
                this.ui.timeTotal = document.getElementById('musicTimeTotal');
                this.ui.playBtn = document.getElementById('musicPlayBtn');
                this.ui.prevBtn = document.getElementById('musicPrevBtn');
                this.ui.nextBtn = document.getElementById('musicNextBtn');
                this.ui.likeBtn = document.getElementById('musicLikeBtn');
                this.ui.playModeBtn = document.getElementById('musicPlayModeBtn');
                this.ui.sourceDailyBtn = document.getElementById('musicSourceDaily');
                this.ui.sourceLikedBtn = document.getElementById('musicSourceLiked');
                this.ui.volume = document.getElementById('musicVolume');
                this.ui.volumeLabel = document.getElementById('musicVolumeLabel');
                this.ui.lyrics = document.getElementById('musicLyrics');
                this.ui.status = document.getElementById('musicStatus');
                this.ui.queueInfo = document.getElementById('musicQueueInfo');
                this.ui.queueList = document.getElementById('musicQueueList');

                this.audio.addEventListener('ended', () => this.next(true));
                this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
                this.audio.addEventListener('loadedmetadata', () => this.renderTimeTotal());
                this.audio.addEventListener('play', () => { this.isPlaying = true; this.renderPlayState(); });
                this.audio.addEventListener('pause', () => { this.isPlaying = false; this.renderPlayState(); });

                document.addEventListener('visibilitychange', () => {
                    if (!document.hidden) this.render();
                });

                if (this.ui.volume) {
                    const v = parseFloat(this.ui.volume.value);
                    if (!isNaN(v)) this.audio.volume = Math.max(0, Math.min(1, v));
                }

                // 预热红心列表，不阻塞 init。
                this.fetchLikedIds().catch(() => {});
                this.render();
            },

            hasValidConfig() {
                const apiUrl = (state.settings.musicApiUrl || '').trim();
                const cookie = (state.settings.musicCookie || '').trim();
                return !!apiUrl && !!cookie;
            },

            getConfig() {
                const apiUrl = (state.settings.musicApiUrl || 'http://localhost:3000').trim().replace(/\/+$/, '');
                const cookie = (state.settings.musicCookie || '').trim();
                return { apiUrl, cookie };
            },

            buildUrl(path, params = {}) {
                const { apiUrl, cookie } = this.getConfig();
                const u = new URL(apiUrl + path);
                const qp = new URLSearchParams();
                Object.keys(params).forEach(k => {
                    const v = params[k];
                    if (v === undefined || v === null || v === '') return;
                    qp.set(k, String(v));
                });
                if (cookie) qp.set('cookie', cookie);
                qp.set('timestamp', String(Date.now()));
                u.search = qp.toString();
                return u.toString();
            },

            async requestJson(path, params = {}) {
                const url = this.buildUrl(path, params);
                const res = await fetch(url);
                if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
                return await res.json();
            },

            async fetchUserId() {
                if (this.userId) return this.userId;
                const d = await this.requestJson('/login/status');
                const uid = d?.data?.profile?.userId || d?.data?.account?.id || d?.profile?.userId || null;
                if (uid) this.userId = uid;
                return this.userId;
            },

            normalizeSong(item) {
                const id = item?.id;
                const name = item?.name || '--';
                const artist = (item?.artists || item?.ar || []).map(a => a?.name).filter(Boolean).join(' / ') || '--';
                const cover = item?.album?.picUrl || item?.al?.picUrl || '';
                return { id, name, artist, cover };
            },

            escapeHtml(text) {
                return String(text || '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            },

            calcEntrySizeBytes(songId, url) {
                return String(songId).length * 2 + String(url || '').length * 2 + 64;
            },

            shrinkUrlCacheIfNeeded() {
                while (this.urlCacheSizeBytes > this.URL_CACHE_LIMIT_BYTES && this.urlCache.size > 0) {
                    const oldestKey = this.urlCache.keys().next().value;
                    const oldest = this.urlCache.get(oldestKey);
                    this.urlCache.delete(oldestKey);
                    this.urlCacheSizeBytes = Math.max(0, this.urlCacheSizeBytes - (oldest?.sizeBytes || 0));
                }
            },

            setSongUrlCache(songId, url) {
                if (!songId || !url) return;
                const old = this.urlCache.get(songId);
                if (old) this.urlCacheSizeBytes = Math.max(0, this.urlCacheSizeBytes - (old.sizeBytes || 0));
                const sizeBytes = this.calcEntrySizeBytes(songId, url);
                this.urlCache.delete(songId);
                this.urlCache.set(songId, { url, sizeBytes, cachedAt: Date.now() });
                this.urlCacheSizeBytes += sizeBytes;
                this.shrinkUrlCacheIfNeeded();
            },

            getCachedSongUrl(songId) {
                const entry = this.urlCache.get(songId);
                if (!entry?.url) return '';
                this.urlCache.delete(songId);
                this.urlCache.set(songId, { ...entry, cachedAt: Date.now() });
                return entry.url;
            },

            async getSongUrl(id) {
                const cached = this.getCachedSongUrl(id);
                if (cached) return cached;
                const d = await this.requestJson('/song/url/v1', { id, level: 'standard' });
                const url = d?.data?.[0]?.url || '';
                if (url) this.setSongUrlCache(id, url);
                return url || '';
            },

            async preloadNextUrl() {
                const nextIdx = this.getNextIndex(1, false);
                if (nextIdx < 0 || nextIdx === this.currentIndex) return;
                const nextSong = this.playlist[nextIdx];
                if (!nextSong?.id) return;
                if (this.getCachedSongUrl(nextSong.id)) return;
                try {
                    await this.getSongUrl(nextSong.id);
                } catch (_) {
                    // 预加载失败不影响主流程。
                }
            },

            async fetchSongDetail(id) {
                const d = await this.requestJson('/song/detail', { ids: id });
                const s = d?.songs?.[0];
                if (!s) return null;
                return { id: s?.id || id, name: s?.name || '--', artist: (s?.ar || []).map(a => a?.name).filter(Boolean).join(' / ') || '--', cover: s?.al?.picUrl || '' };
            },

            parseLrc(lrcText) {
                const lines = [];
                const raw = (lrcText || '').split('\n');
                raw.forEach(line => {
                    const matches = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
                    if (!matches.length) return;
                    const text = line.replace(/\[[^\]]+\]/g, '').trim();
                    matches.forEach(m => {
                        const mm = parseInt(m[1], 10) || 0;
                        const ss = parseInt(m[2], 10) || 0;
                        const ms = parseInt((m[3] || '0').padEnd(3, '0'), 10) || 0;
                        lines.push({ t: mm * 60 + ss + ms / 1000, text: text || '...' });
                    });
                });
                lines.sort((a, b) => a.t - b.t);
                return lines;
            },

            async fetchLyrics(id) {
                try {
                    const d = await this.requestJson('/lyric', { id });
                    const lrc = d?.lrc?.lyric || '';
                    this.currentLyric = { lines: this.parseLrc(lrc), activeIndex: -1 };
                    this.renderLyrics();
                } catch (_) {
                    this.currentLyric = { lines: [], activeIndex: -1 };
                    this.renderLyrics(true);
                }
            },

            async fetchLikedIds() {
                const uid = await this.fetchUserId();
                if (!uid) throw new Error('无法从 Cookie 解析 UID（请检查 Cookie 是否有效）');
                const d = await this.requestJson('/likelist', { uid });
                const ids = d?.ids || d?.data?.ids || [];
                this.likedIds = (ids || []).filter(Boolean);
                return this.likedIds;
            },

            async loadDailySourceAndPlay() {
                this.init();
                if (!this.hasValidConfig()) { this.setStatus('missing_config'); return; }
                const d = await this.requestJson('/recommend/songs');
                const list = d?.data?.dailySongs || d?.recommend || d?.data?.recommend || [];
                this.source = 'daily';
                this.playlist = (list || []).map(x => this.normalizeSong(x)).filter(x => !!x.id);
                this.currentIndex = 0;
                this.currentLyric = { lines: [], activeIndex: -1 };
                this.render();
                if (this.playlist.length) await this.loadAndPlayIndex(0);
                else this.setStatus('empty_playlist');
            },

            async loadLikedPlaylistAndPlay() {
                this.init();
                if (!this.hasValidConfig()) { this.setStatus('missing_config'); return; }
                const uid = await this.fetchUserId();
                if (!uid) throw new Error('无法读取用户信息');
                const p = await this.requestJson('/user/playlist', { uid, limit: 100 });
                const playlists = p?.playlist || [];
                const liked = playlists.find(x => x?.specialType === 5)
                    || playlists.find(x => (x?.name || '').includes('喜欢'))
                    || playlists.find(x => Number(x?.creator?.userId) === Number(uid));
                if (!liked?.id) throw new Error('未找到“我喜欢的音乐”歌单');
                const d = await this.requestJson('/playlist/track/all', { id: liked.id, limit: 1000, offset: 0 });
                const list = d?.songs || d?.data?.songs || [];
                this.source = 'liked';
                this.playlist = (list || []).map(x => this.normalizeSong(x)).filter(x => !!x.id);
                this.currentIndex = 0;
                this.currentLyric = { lines: [], activeIndex: -1 };
                this.render();
                if (this.playlist.length) await this.loadAndPlayIndex(0);
                else this.setStatus('empty_liked_playlist');
            },

            getCurrentSong() {
                return this.playlist[this.currentIndex] || null;
            },

            getNextIndex(direction = 1, fromEnded = false) {
                const len = this.playlist.length;
                if (!len) return -1;

                let base = this.currentIndex;
                if (base < 0) base = 0;
                if (base >= len) base = len - 1;

                if (this.playMode === 'single') return base;

                if (this.playMode === 'shuffle') {
                    if (len === 1) return base;
                    let idx = base;
                    let guard = 0;
                    while (idx === base && guard < 12) {
                        idx = Math.floor(Math.random() * len);
                        guard += 1;
                    }
                    return idx;
                }

                if (direction < 0) return (base - 1 + len) % len;
                return (base + 1) % len;
            },

            async loadAndPlayIndex(idx) {
                if (!this.playlist.length) return false;
                if (idx < 0) idx = 0;
                if (idx >= this.playlist.length) idx = this.playlist.length - 1;

                this.currentIndex = idx;
                let s = this.getCurrentSong();
                if (!s?.id) return false;

                if ((!s.name || s.name === '--') && s.id) {
                    const detail = await this.fetchSongDetail(s.id);
                    if (detail) {
                        this.playlist[this.currentIndex] = detail;
                        s = detail;
                    }
                }

                this.render();
                const url = await this.getSongUrl(s.id);
                if (!url) throw new Error('无法获取歌曲播放 URL（可能需要 VIP 或 API 限制）');

                this.currentSongUrl = url;
                if (this.audio.src !== url) this.audio.src = url;
                await this.audio.play();
                this.fetchLyrics(s.id);
                this.preloadNextUrl();
                this.setStatus('playing');
                return true;
            },

            async play() {
                this.init();
                if (!this.hasValidConfig()) { this.setStatus('missing_config'); return; }
                if (!this.audio.src) {
                    if (!this.playlist.length) {
                        await this.loadDailySourceAndPlay();
                        return;
                    }
                    await this.loadAndPlayIndex(this.currentIndex);
                    return;
                }
                await this.audio.play();
            },

            pause() {
                this.init();
                this.audio.pause();
            },

            async togglePlay() {
                this.init();
                try {
                    if (this.audio.paused) await this.play();
                    else this.pause();
                } catch (e) {
                    console.error(e);
                    this.setStatus('play_error');
                }
            },

            async next(fromEnded = false) {
                this.init();
                if (!this.playlist.length) return;
                try {
                    const idx = this.getNextIndex(1, fromEnded);
                    if (idx >= 0) await this.loadAndPlayIndex(idx);
                } catch (e) {
                    console.error(e);
                    this.setStatus('next_error');
                }
            },

            async prev() {
                this.init();
                if (!this.playlist.length) return;
                try {
                    const idx = this.getNextIndex(-1, false);
                    if (idx >= 0) await this.loadAndPlayIndex(idx);
                } catch (e) {
                    console.error(e);
                    this.setStatus('prev_error');
                }
            },

            async playIndex(idx) {
                this.init();
                if (!this.playlist.length) return;
                try {
                    await this.loadAndPlayIndex(idx);
                } catch (e) {
                    console.error(e);
                    this.setStatus('play_index_error');
                }
            },

            async removeFromQueue(index) {
                this.init();
                if (index < 0 || index >= this.playlist.length) return;

                const removingCurrent = index === this.currentIndex;
                this.playlist.splice(index, 1);

                if (!this.playlist.length) {
                    this.audio.pause();
                    this.audio.removeAttribute('src');
                    this.audio.load();
                    this.currentSongUrl = '';
                    this.currentIndex = 0;
                    this.currentLyric = { lines: [], activeIndex: -1 };
                    this.render();
                    this.setStatus('queue_empty');
                    return;
                }

                if (index < this.currentIndex) {
                    this.currentIndex -= 1;
                    this.render();
                    return;
                }

                if (removingCurrent) {
                    this.currentIndex = Math.max(0, index - 1);
                    await this.next(false);
                    return;
                }

                this.render();
            },

            reorderQueue(fromIndex, toIndex) {
                this.init();
                if (fromIndex === toIndex) return;
                if (fromIndex < 0 || toIndex < 0) return;
                if (fromIndex >= this.playlist.length || toIndex >= this.playlist.length) return;

                const [moved] = this.playlist.splice(fromIndex, 1);
                this.playlist.splice(toIndex, 0, moved);

                if (this.currentIndex === fromIndex) {
                    this.currentIndex = toIndex;
                } else if (fromIndex < this.currentIndex && toIndex >= this.currentIndex) {
                    this.currentIndex -= 1;
                } else if (fromIndex > this.currentIndex && toIndex <= this.currentIndex) {
                    this.currentIndex += 1;
                }
                this.render();
            },

            onQueueDragStart(event, index) {
                this.dragFromIndex = index;
                if (event.dataTransfer) {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', String(index));
                }
            },

            onQueueDragOver(event) {
                event.preventDefault();
                if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
            },

            onQueueDrop(event, toIndex) {
                event.preventDefault();
                const fallback = event.dataTransfer ? parseInt(event.dataTransfer.getData('text/plain'), 10) : NaN;
                const fromIndex = Number.isInteger(this.dragFromIndex) ? this.dragFromIndex : fallback;
                this.dragFromIndex = null;
                if (!Number.isInteger(fromIndex)) return;
                this.reorderQueue(fromIndex, toIndex);
            },

            onQueueDragEnd() {
                this.dragFromIndex = null;
            },

            cyclePlayMode() {
                this.init();
                const seq = ['sequence', 'shuffle', 'single'];
                const idx = seq.indexOf(this.playMode);
                this.playMode = seq[(idx + 1) % seq.length];
                this.renderPlayMode();
            },

            async refresh() {
                this.init();
                if (!this.hasValidConfig()) { this.setStatus('missing_config'); return; }
                try {
                    if (this.source === 'liked') await this.loadLikedPlaylistAndPlay();
                    else await this.loadDailySourceAndPlay();
                } catch (e) {
                    console.error(e);
                    this.setStatus('refresh_error');
                }
            },

            async toggleLike() {
                this.init();
                const s = this.getCurrentSong();
                if (!s?.id || !this.hasValidConfig()) return;

                try {
                    if (!this.likedIds.length) await this.fetchLikedIds();
                } catch (_) {
                    // 即使预热失败，也继续尝试 toggle。
                }

                const liked = this.likedIds.includes(s.id);
                const nextLiked = !liked;
                try {
                    await this.requestJson('/like', { id: s.id, like: nextLiked });
                    if (nextLiked) {
                        if (!this.likedIds.includes(s.id)) this.likedIds.push(s.id);
                        this.setStatus('liked');
                    } else {
                        this.likedIds = this.likedIds.filter(id => id !== s.id);
                        this.setStatus('unliked');
                    }
                    this.renderLikeState();
                } catch (e) {
                    console.error(e);
                    this.setStatus('like_error');
                }
            },

            seekFromUi(val) {
                this.init();
                if (!this.audio.duration || isNaN(this.audio.duration)) return;
                const n = parseInt(val, 10);
                if (isNaN(n)) return;
                const ratio = Math.max(0, Math.min(1, n / 1000));
                this.audio.currentTime = ratio * this.audio.duration;
                this.onTimeUpdate(true);
            },

            setVolumeFromUi(val) {
                this.init();
                const v = Math.max(0, Math.min(1, parseFloat(val)));
                if (isNaN(v)) return;
                this.audio.volume = v;
                this.renderVolume();
            },

            autoStartWorkMusic() {
                this.init();
                if (this.isPlaying || (!this.audio.paused && this.audio.currentTime > 0)) return;
                if (!this.hasValidConfig()) return;
                if (this.playlist.length) {
                    this.loadAndPlayIndex(this.currentIndex).catch(() => {});
                    return;
                }
                this.loadDailySourceAndPlay().catch(() => {});
            },

            setStatus(val) {
                if (this.ui.status) this.ui.status.innerText = String(val);
            },

            renderPlayState() {
                if (!this.ui.playBtn) return;
                this.ui.playBtn.innerText = this.audio.paused ? '▶' : '⏸';
                this.setStatus(this.audio.paused ? 'paused' : 'playing');
            },

            renderTimeTotal() {
                if (!this.ui.timeTotal) return;
                const dur = this.audio.duration;
                if (!dur || isNaN(dur)) { this.ui.timeTotal.innerText = '00:00'; return; }
                this.ui.timeTotal.innerText = formatTimeStr(Math.floor(dur));
            },

            renderVolume() {
                if (this.ui.volume) this.ui.volume.value = String(this.audio.volume);
                if (this.ui.volumeLabel) this.ui.volumeLabel.innerText = Math.round(this.audio.volume * 100) + '%';
            },

            renderQueueInfo() {
                if (!this.ui.queueInfo) return;
                const cur = this.playlist.length ? (this.currentIndex + 1) : 0;
                this.ui.queueInfo.innerText = `${cur}/${this.playlist.length}`;
            },

            renderPlayMode() {
                if (!this.ui.playModeBtn) return;
                this.ui.playModeBtn.innerText = this.playMode;
            },

            renderSourceTabs() {
                if (!this.ui.sourceDailyBtn || !this.ui.sourceLikedBtn) return;
                const isDaily = this.source === 'daily';
                const activeCls = 'bg-white text-black border-white';
                const inactiveCls = 'text-white border-white/20 hover:bg-white hover:text-black';
                this.ui.sourceDailyBtn.className = `text-[10px] font-bold border px-3 py-1 rounded transition-all ${isDaily ? activeCls : inactiveCls}`;
                this.ui.sourceLikedBtn.className = `text-[10px] font-bold border px-3 py-1 rounded transition-all ${!isDaily ? activeCls : inactiveCls}`;
            },

            renderLikeState() {
                if (!this.ui.likeBtn) return;
                const s = this.getCurrentSong();
                const liked = !!(s?.id && this.likedIds.includes(s.id));
                this.ui.likeBtn.innerText = liked ? '♥' : '♡';
                this.ui.likeBtn.title = liked ? '取消喜欢' : '添加红心喜欢';
            },

            renderQueueList() {
                if (!this.ui.queueList) return;
                if (!this.playlist.length) {
                    this.ui.queueList.innerHTML = '<div class="opacity-30 text-sm">当前播放列表为空。</div>';
                    return;
                }

                this.ui.queueList.innerHTML = this.playlist.map((song, i) => {
                    const active = i === this.currentIndex;
                    const rowCls = active
                        ? 'border-cyan-300/70 bg-cyan-500/10'
                        : 'border-white/10 bg-black/20 hover:border-white/40 hover:bg-white/5';
                    return `
                        <div class="group rounded-lg border px-3 py-2 transition-all ${rowCls}" draggable="true"
                            ondragstart="musicManager.onQueueDragStart(event, ${i})"
                            ondragover="musicManager.onQueueDragOver(event)"
                            ondrop="musicManager.onQueueDrop(event, ${i})"
                            ondragend="musicManager.onQueueDragEnd()">
                            <div class="flex items-start gap-2">
                                <button onclick="musicManager.playIndex(${i})" class="flex-1 text-left min-w-0">
                                    <div class="text-xs font-black truncate ${active ? 'text-cyan-200' : 'text-white/90'}">${this.escapeHtml(song?.name || '--')}</div>
                                    <div class="text-[10px] font-bold truncate text-white/50 mt-1">${this.escapeHtml(song?.artist || '--')}</div>
                                </button>
                                <button onclick="event.stopPropagation(); musicManager.removeFromQueue(${i});" class="text-xs font-black text-white/40 hover:text-red-300 transition-colors" title="移除出队">✕</button>
                            </div>
                        </div>
                    `;
                }).join('');
            },

            renderLyrics(showEmpty = false) {
                if (!this.ui.lyrics) return;
                const lines = this.currentLyric.lines || [];
                if (!lines.length) {
                    this.ui.lyrics.innerHTML = `<div class="opacity-30">${showEmpty ? '暂无歌词或加载失败。' : '尚未加载歌词。'}</div>`;
                    return;
                }
                this.ui.lyrics.innerHTML = lines.map((l, i) => {
                    const active = i === this.currentLyric.activeIndex;
                    const cls = active ? 'text-white' : 'text-white/60';
                    return `<div id="lyricLine_${i}" class="${cls} transition-colors">${this.escapeHtml(l.text)}</div>`;
                }).join('');
            },

            highlightLyric(idx) {
                if (!this.ui.lyrics) return;
                if (idx === this.currentLyric.activeIndex) return;
                const prevActive = this.currentLyric.activeIndex;
                this.currentLyric.activeIndex = idx;

                const prev = prevActive >= 0 ? document.getElementById(`lyricLine_${prevActive}`) : null;
                if (prev) prev.className = 'text-white/60 transition-colors';
                const cur = document.getElementById(`lyricLine_${idx}`);
                if (cur) {
                    cur.className = 'text-white transition-colors';
                    cur.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }
            },

            onTimeUpdate(force = false) {
                if (!this.ui.timeNow || !this.ui.progress) return;
                const dur = this.audio.duration || 0;
                const cur = this.audio.currentTime || 0;
                this.ui.timeNow.innerText = formatTimeStr(Math.floor(cur));
                if (dur > 0) {
                    const v = Math.floor((cur / dur) * 1000);
                    if (force || v !== this.lastUiProgressVal) {
                        this.lastUiProgressVal = v;
                        this.ui.progress.value = String(v);
                    }
                }

                const lines = this.currentLyric.lines || [];
                if (lines.length) {
                    let idx = -1;
                    for (let i = 0; i < lines.length; i++) {
                        if (cur + 0.15 >= lines[i].t) idx = i;
                        else break;
                    }
                    if (idx >= 0) this.highlightLyric(idx);
                }
                if (window.app && typeof app.syncHomeMusicModules === 'function') {
                    app.syncHomeMusicModules();
                }
            },

            render() {
                this.init();
                const s = this.getCurrentSong();
                if (this.ui.cover) this.ui.cover.src = s?.cover || '';
                if (this.ui.title) this.ui.title.innerText = s?.name || '--';
                if (this.ui.artist) this.ui.artist.innerText = s?.artist || '--';
                this.renderQueueInfo();
                this.renderVolume();
                this.renderPlayState();
                this.renderTimeTotal();
                this.renderPlayMode();
                this.renderSourceTabs();
                this.renderLikeState();
                this.renderQueueList();
                if (window.app && typeof app.syncHomeMusicModules === 'function') {
                    app.syncHomeMusicModules();
                }
            }
        };

window.musicManager = musicManager;

