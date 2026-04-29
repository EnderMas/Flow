const ai = {
            async call(prompt) {
                const s = state.settings;
                if (s.aiProvider === 'gemini') {
                    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${s.apiKey}`, {
                        method: 'POST', body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                    });
                    const d = await res.json(); return d.candidates[0].content.parts[0].text;
                } else if (s.aiProvider === 'deepseek') {
                    const res = await fetch('https://api.deepseek.com/chat/completions', {
                        method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${s.apiKey}`},
                        body: JSON.stringify({ model: 'deepseek-chat', messages: [{role: 'user', content: prompt}] })
                    });
                    const d = await res.json(); return d.choices[0].message.content;
                } else if (s.aiProvider === 'ollama') {
                    const res = await fetch(`${s.ollamaUrl}/api/generate`, {
                        method: 'POST', headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ model: s.ollamaModel, prompt: prompt, stream: false })
                    });
                    const d = await res.json(); return d.response;
                }
                return "AI Error: 缺少 API 密钥或配置";
            },

            async testOllama() {
                const btn = event.target; const orig = btn.innerText; btn.innerText = "测试中...";
                try {
                    const s = state.settings; const res = await fetch(`${s.ollamaUrl}/api/tags`);
                    if(res.ok) { alert("连接成功！Ollama 服务运行正常。"); } else { alert("连接失败：服务器返回异常状态码。"); }
                } catch(e) { alert("无法连接到 Ollama: " + e.message); }
                btn.innerText = orig;
            },

            async reviewTask() {
                const t = state.tasks.find(x => x.id === state.activeTaskId); if (!t) return;
                const icon = document.getElementById('aiReviewIcon'); const out = document.getElementById('aiReviewOutput');
                icon.innerText = '⚙️'; icon.classList.add('spinning'); out.classList.remove('hidden'); out.innerText = "正在链接 AI 评估...";
                try {
                    const prompt = `${state.settings.promptReview}\n\n目标: "${t.title}"\n外力约束: ${t.extDdl || '无'}`;
                    const res = await this.call(prompt);
                    icon.classList.remove('spinning');
                    if (res.includes('不合理') || res.includes('空泛') || res.includes('太大') || t.title.length <= 2) icon.innerText = '⚠️'; else icon.innerText = '✅';
                    out.innerText = res;
                    const stepsText = res.split('\n').filter(l => /^\d+[\.\、]/.test(l)).map(l => l.replace(/^\d+[\.\、\s]*/, '').trim());
                    if(stepsText.length > 0 && confirm("AI 已生成落地步骤。是否覆盖当前执行步骤？")) {
                        t.steps = stepsText.map(s => ({ text: s, done: false }));
                        library.save(); library.renderSteps(); app.updateChain(); icon.innerText = '✅';
                    }
                } catch(e) { icon.classList.remove('spinning'); icon.innerText = '❌'; out.innerText = "网络或 API 错误。"; }
            },

            async generateDailyFlow() {
                const out = document.getElementById('aiDailyFlowOutput'); out.innerText = "系统初始化中... 分析库优先级约束...";
                try {
                    const activeTasks = state.tasks.filter(t => t.status === 'active');
                    const taskStr = activeTasks.map(t => {
                        const labels = {1: '低', 2: '中', 3: '高', 4: '极高', 5: '决战'};
                        let info = `- [优先级 ${labels[t.weight]}] ${t.title}`;
                        if(t.extDdl) info += ` | 约束: ${t.extDdl}`;
                        if(t.ddl) info += ` | DDL: ${new Date(t.ddl).toLocaleDateString()}`;
                        return info;
                    }).join('\n');
                    const prompt = `当前时间: ${new Date().toLocaleString()}。每日起始时间: ${state.settings.dayStartTime}。\n任务库:\n${taskStr}\n\n${state.settings.promptFlow}`;
                    const res = await this.call(prompt); out.innerText = res;
                } catch(e) { out.innerText = "[ERROR] AI 计划生成失败。请检查 API Key。"; }
            }
        };

window.ai = ai;

