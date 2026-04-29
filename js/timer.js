// --- 番茄钟核心引擎 ---
        const timer = {
            init() {
                const c = JSON.parse(localStorage.getItem('nf_timer_v5.4')) || JSON.parse(localStorage.getItem('nf_timer_v5.3'));
                if (c) { state.timer.focusSecs = c.f || 25*60; state.timer.restSecs = c.r || 5*60; }
                state.timer.timeLeft = state.timer.focusSecs;
                this.render();
            },
            updateFromInputs() {
                if(state.timer.status !== 'idle') return this.render();
                
                const cMins = parseTimeStr(document.getElementById('pomoCenterMins').value);
                const cSecs = parseTimeStr(document.getElementById('pomoCenterSecs').value);
                const kMins = parseTimeStr(document.getElementById('pomoCornerMins').value);
                const kSecs = parseTimeStr(document.getElementById('pomoCornerSecs').value);
                
                const activeVal = cMins * 60 + cSecs;
                const inactiveVal = kMins * 60 + kSecs;

                if (state.timer.mode === 'focus') {
                    state.timer.focusSecs = activeVal; state.timer.restSecs = inactiveVal;
                } else {
                    state.timer.restSecs = activeVal; state.timer.focusSecs = inactiveVal;
                }
                
                if (state.timer.status === 'idle') state.timer.timeLeft = activeVal;
                localStorage.setItem('nf_timer_v5.4', JSON.stringify({f: state.timer.focusSecs, r: state.timer.restSecs}));
                this.render();
            },
            scrollTime(e, type) {
                e.preventDefault();
                if(state.timer.status !== 'idle') return;
                const sign = e.deltaY < 0 ? 1 : -1;
                let el = document.getElementById('pomo' + type.charAt(0).toUpperCase() + type.slice(1));
                let val = parseInt(el.value) || 0;
                val += sign; if(val < 0) val = 0;
                el.value = String(val).padStart(2, '0');
                this.updateFromInputs();
            },
            toggle() {
                if (state.timer.status === 'finished') { this.ackFinish(); return; }
                if (state.timer.status === 'running') this.pause();
                else this.start();
            },
            start() {
                state.timer.status = 'running';
                clearInterval(state.timer.interval);
                state.timer.interval = setInterval(() => {
                    if (state.timer.timeLeft > 0) { state.timer.timeLeft--; this.render(); }
                    else this.finishPhase();
                }, 1000);
                app.syncTheme();
                this.updateInputState();
            },
            pause() {
                state.timer.status = 'paused';
                clearInterval(state.timer.interval);
                app.syncTheme();
                this.render();
                this.updateInputState();
            },
            reset() {
                clearInterval(state.timer.interval);
                state.timer.status = 'idle'; state.timer.mode = 'focus'; state.timer.timeLeft = state.timer.focusSecs;
                this.render(); app.syncTheme(); this.updateInputState();
            },
            handleDoubleClick() {
                if(state.timer.status === 'paused') {
                    this.reset();
                }
            },
            skip(e) { 
                if(e) e.stopPropagation();
                if(state.timer.status !== 'idle') this.finishPhase(true); 
            },
            finishPhase(isManual = false) {
                clearInterval(state.timer.interval);
                state.timer.status = 'finished';
                if (!isManual) this.startAlert();
                else this.ackFinish();
                this.updateInputState();
            },
            startAlert() {
                const isFocus = state.timer.mode === 'focus';
                const targetEl = state.view === 'pomodoro' ? document.body : document.getElementById('mainHeader');
                
                targetEl.classList.add('flash-active-bg');
                if(state.timer.flashInterval) clearInterval(state.timer.flashInterval);
                state.timer.flashInterval = setInterval(() => {
                    targetEl.classList.toggle('bg-flash-black');
                }, 250);

                this.playSound(state.settings.alertCount, isFocus);

                const durMs = state.settings.alertDuration * 1000;
                setTimeout(() => {
                    if (state.timer.status === 'finished') {
                        clearInterval(state.timer.flashInterval);
                        targetEl.classList.remove('flash-active-bg', 'bg-flash-black');
                    }
                }, durMs);
                
                if (state.timer.reminderTimeout) clearTimeout(state.timer.reminderTimeout);
                const delayMs = isFocus ? state.settings.focusDelay * 60000 : state.settings.restDelay * 1000;
                
                state.timer.reminderTimeout = setTimeout(() => {
                    if (state.timer.status === 'finished') {
                        const tgtSecondary = state.view === 'pomodoro' ? document.body : document.getElementById('mainHeader');
                        tgtSecondary.classList.add('flash-active-bg');
                        if(state.timer.flashInterval) clearInterval(state.timer.flashInterval);
                        state.timer.flashInterval = setInterval(() => {
                            tgtSecondary.classList.toggle('bg-flash-black');
                        }, 250);
                        this.playSound(9999, isFocus);
                    }
                }, delayMs);
            },
            ackFinish() {
                if(state.timer.flashInterval) clearInterval(state.timer.flashInterval);
                document.body.classList.remove('flash-active-bg', 'bg-flash-black');
                document.getElementById('mainHeader').classList.remove('flash-active-bg', 'bg-flash-black');
                this.stopSound();
                clearTimeout(state.timer.reminderTimeout);
                state.timer.mode = state.timer.mode === 'focus' ? 'rest' : 'focus';
                state.timer.timeLeft = state.timer.mode === 'focus' ? state.timer.focusSecs : state.timer.restSecs;
                this.start();
            },
            playSound(times, isFocus) {
                this.stopSound();
                state.timer.soundCount = 0;
                state.timer.targetSoundCount = times;
                
                let soundKey = state.settings.alertSound || 'preset1';
                let vol = state.settings.alertVolume !== undefined ? state.settings.alertVolume : 1;
                
                if (!isFocus && state.settings.separateRestAlert) {
                    soundKey = state.settings.restAlertSound || 'preset1';
                    vol = state.settings.restAlertVolume !== undefined ? state.settings.restAlertVolume : 1;
                }

                let audio = document.getElementById('audioCustom');
                if (soundKey === 'preset1') audio = document.getElementById('audioPreset1');
                if (soundKey === 'preset2') audio = document.getElementById('audioPreset2');

                if(!audio || !audio.src) audio = document.getElementById('audioPreset1');
                audio.volume = parseFloat(vol);

                const p = () => {
                    if (state.timer.status !== 'finished') return;
                    if (state.timer.soundCount >= state.timer.targetSoundCount) return;
                    
                    audio.currentTime = 0;
                    audio.play().catch(e=>{});
                    state.timer.soundCount++;
                    
                    if (state.timer.soundCount < state.timer.targetSoundCount) {
                        state.timer.soundInterval = setTimeout(p, 1500);
                    }
                };
                p();
            },
            stopSound() {
                if(state.timer.soundInterval) { clearTimeout(state.timer.soundInterval); state.timer.soundInterval = null; }
            },
            updateInputState() {
                const els = ['pomoCenterMins', 'pomoCenterSecs', 'pomoCornerMins', 'pomoCornerSecs'];
                const hint = document.getElementById('pomoHint');
                const isIdle = state.timer.status === 'idle';
                els.forEach(id => {
                    const el = document.getElementById(id);
                    if(isIdle) el.removeAttribute('readonly'); else el.setAttribute('readonly', 'true');
                });
                
                if(!isIdle && state.timer.status === 'paused') { hint.classList.remove('opacity-0'); hint.classList.add('opacity-30'); } 
                else { hint.classList.remove('opacity-30'); hint.classList.add('opacity-0'); }
            },
            render() {
                const isFocus = state.timer.mode === 'focus';
                const activeSecs = state.timer.status === 'idle' ? (isFocus ? state.timer.focusSecs : state.timer.restSecs) : state.timer.timeLeft;
                const inactiveSecs = isFocus ? state.timer.restSecs : state.timer.focusSecs;

                if (state.view === 'pomodoro') {
                    document.getElementById('pomoCornerLabel').innerText = isFocus ? '休息:' : '专注:';
                    
                    if(document.activeElement.id !== 'pomoCenterMins') document.getElementById('pomoCenterMins').value = String(Math.floor(activeSecs/60)).padStart(2,'0');
                    if(document.activeElement.id !== 'pomoCenterSecs') document.getElementById('pomoCenterSecs').value = String(activeSecs%60).padStart(2,'0');
                    
                    if(document.activeElement.id !== 'pomoCornerMins') document.getElementById('pomoCornerMins').value = String(Math.floor(inactiveSecs/60)).padStart(2,'0');
                    if(document.activeElement.id !== 'pomoCornerSecs') document.getElementById('pomoCornerSecs').value = String(inactiveSecs%60).padStart(2,'0');
                }
                
                const str = formatTimeStr(state.timer.timeLeft);
                document.getElementById('headerTimerVal').innerText = str;
                const hTimer = document.getElementById('headerTimer');
                if (state.view !== 'pomodoro' && state.timer.status !== 'idle') hTimer.classList.remove('hidden');
                else hTimer.classList.add('hidden');
            }
        };

window.timer = timer;

