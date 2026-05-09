# Flow 项目 Copilot 代码规范

## 1. 目的

此文档为 Flow 项目的项目级代码规范，适用于 `d:\DETERMINATION\PROJECTS\MISC\Flow\Flow` 目录下的所有文件。目标是让 Copilot 在无需人工复查的前提下，基于完整工作区上下文给出有效解决方案并直接生成代码。

> 人工介入仅限于提供高层 prompt 以及在 plan 模式下做简单选项选择。具体实现、代码修改和重构由 Copilot 全权负责。


### 1.1 核心约定

- No Frameworks：严格使用原生 Vanilla JavaScript（ES6+）。
- 状态管理：所有全局数据必须保存在 `state` 对象中，`state.js` 是唯一的全局状态定义入口。
- 模块边界：功能范围应限于全局对象 `app`、`timer`、`library`、`musicManager`、`ai`，避免散落的全局变量。
- 修改现有模块方法时，保持对象字面量方法语法 `methodName() { ... }`，不要随意改成箭头函数写法。
- 保持现有 Geek 风格：暗色主题、大字号、点阵矩阵、硬核视觉风格。

## 2. 适用范围

- 根目录所有 HTML、CSS、JS 文件
- `index.html`
- `css/` 目录
- `js/` 目录及其模块文件
- 任何新增文件也应遵循本规范


## 3. 交互与 DOM 规则

- 只使用原生 DOM API：`document.getElementById(...)`、`document.querySelector(...)`、`document.querySelectorAll(...)`
- 不引入任何框架库（Vue/React/jQuery/Angular 等）
- 事件绑定首选 `addEventListener`，避免新增大量 inline `onclick` / `onchange` 属性
- 对于页面内交互按钮，若不提交表单，应显式使用 `type="button"`，避免发生意外表单提交或额外跳转
- 仅在确有必要时使用 `event.target`、`closest()`、`dataset` 等原生方式
- UI 更新应遵循“先状态、后 DOM、再持久化”的顺序：先修改 `state`，再更新 DOM，最后保存 localStorage。
- 元素引用应保留在模块内部，避免全局 window 变量污染


## 4. TailwindCSS 规范

- Tailwind-First：优先使用 TailwindCSS 实现布局、间距、排版和视觉效果。
- 仅在 Tailwind 无法表达时，才在 `css/style.css` 中编写原生 CSS。
- `style.css` 仅用于复杂伪元素、隐藏滚动条、复杂 CSS 变量计算（如 `--header-timer-scale`）和主题 token 细节。

### 4.1 Class 排序习惯

HTML 中的 Tailwind 类应保持统一顺序，建议：

1. 布局：`flex`, `grid`, `items-center`, `justify-between`
2. 大小：`w-...`, `h-...`, `min-w-...`, `max-w-...`
3. 间距：`p-...`, `px-...`, `py-...`, `m-...`
4. 排版：`text-...`, `font-...`, `tracking-...`, `leading-...`
5. 背景与边框：`bg-...`, `border-...`, `rounded-...`
6. 效果：`shadow-...`, `opacity-...`, `transition-...`, `hover:...`, `focus:...`
7. 状态：`hidden`, `disabled`, `active`, `cursor-...`
8. 自定义类或类级别修饰器放最后，如 `module-scrollable`, `home-module-content`

示例：

```html
<div class="flex items-center justify-between w-full p-4 text-sm font-bold bg-black/20 rounded-xl shadow-sm hover:bg-white/10">
```

### 4.2 CSS 变量使用场景

- 颜色主题、背景、边框、阴影等应尽量使用 CSS 变量
- 常见变量命名：
  - `--bg-base`
  - `--bg-surface`
  - `--text-base`
  - `--text-muted`
  - `--accent`
  - `--border-base`
  - `--shadow-base`
- 自定义变量只用于可复用的视觉 token，不用于表示业务状态
- 不建议把变量用于与业务逻辑强耦合的状态名称


## 5. 数据持久化规范

### 5.1 localStorage 键名规则

- 所有 localStorage 键名必须以 `nf_` 开头
- 版本号必须写入键名，避免不同版本冲突
- 例如：
  - `nf_settings_v5.4`
  - `nf_tasks_v5.4`
  - `nf_timer_v5.4`
  - `nf_home_modules_v5.4`

### 5.2 JSON.stringify / JSON.parse 标准

- 写入前统一使用 `JSON.stringify(value)`
- 读取时必须加 `try/catch` 防止异常
- 读取后若无有效数据，应提供默认值
- 不要将复杂 DOM 元素、事件或函数写入 localStorage

推荐辅助函数范式：

```js
function storageSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function storageGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`storageGet failed: ${key}`, error);
    return fallback;
  }
}
```

### 5.3 版本兼容

- 遇到历史版本时，应优先读取当前版本键
- 若不可用，可回退到前一版本键
- 回退处理应确保字段补齐默认值


## 6. 模块架构与职责边界

本项目采用模块对象模式，主要模块如下：

- `app`：应用统筹层，负责页面初始化、设置加载、模块渲染、视图切换、主题同步等全局逻辑
- `timer`：番茄钟核心引擎，负责计时器状态、开始/暂停/重置、时间渲染、闹钟提醒与节奏控制
- `library`：任务/项目库引擎，负责任务 CRUD、排序、筛选、列表渲染、步骤管理、书签与归档
- `ai`：AI 交互层，负责 prompt 组装、AI API 调用、结果显示与任务评估逻辑
- `musicManager`：音乐播放控制，负责播放列表、音频请求、缓存、UI 控件与歌词处理
- `state`：全局状态容器，存放视图、任务、设置、计时器和模块配置等数据

### 6.1 责任边界

- `app` 不直接执行业务计算细节，只负责调用模块方法并协调状态
- `timer` 不直接管理任务数据、项目库或音乐逻辑
- `library` 不直接控制计时器、音频播放或 AI 调用
- `ai` 不渲染任务列表或处理本地音乐逻辑
- `musicManager` 仅聚焦音频与播放状态，不关注任务或定时器业务
- 保留全局模块对象 `app`, `timer`, `library`, `musicManager`, `ai`，不要创建零散的全局变量或函数

### 6.2 跨模块通信方式

- 推荐通过 `app` 中的显式方法完成跨模块同步，例如 `app.updateHomeBridge()`、`app.syncTheme()`
- 若确实需要模块间通知，优先使用自定义事件 `new CustomEvent(...)` 或统一回调接口
- 避免模块直接修改另一个模块的内部数据结构
- 警惕直接写 `window.state.tasks`、`window.state.settings` 之外的深层依赖。

### 6.3 HyperOS / 未来封装兼容

- 保留与外部调度 / 闹钟集成的接口形式。
- 避免把计时器和提醒逻辑写成无法由外部宿主调用的私有实现。
- 未来封装为 HyperOS 应用时，应能在外部调用 `timer.start()`、`timer.pause()`、`timer.reset()`、`app.syncTheme()`、`library.addProject()` 等标准接口。
- 不要把浏览器环境特有的行为写死成不可替换逻辑。


## 7. 代码风格要求

### 7.1 语法与命名

- 使用 ES6+ 语法
- 使用 `const` 优先，仅在需要重新赋值时使用 `let`
- 不使用 `var`
- 变量、函数、属性使用驼峰命名法
- 对象属性与方法名保持描述性，避免缩写过度
- 函数名推荐动词开头：`renderList`, `saveSettings`, `toggleHomeDeleteMode`

### 7.2 函数与可读性

- 函数应保持短小、单一职责
- 一般不超过 40 行，必要时拆分成多个辅助函数
- 复杂条件使用早返回（guard clause）
- 代码块缩进 2 个空格
- 注释应说明“为什么做”，而非“做了什么”

### 7.3 字符串与模板

- 优先使用反引号模板字符串
- 字符串拼接推荐模板语法
- `JSON.stringify` 与 `JSON.parse` 应放在明确的存取边界内

### 7.4 对象方法语法

- 修改现有模块方法时，优先保持对象字面量方法语法 `methodName() { ... }`
- 避免在模块对象中使用箭头函数作为方法定义

### 7.5 迭代与数组

- 优先使用 `forEach`, `map`, `filter`, `reduce`，而不是手动 `for` 循环
- 需要索引时再使用 `for...of` 或经典 `for`
- 避免修改原数组，优先生成新数组


## 8. Copilot 使用约定

### 8.1 Prompt 模式

当人工提供 prompt 时，内容应包含：

- 目标页面或模块，例如 `library`, `timer`, `app` 或 `music` 之一
- 预期行为或功能变化
- 关键场景与输入/输出

示例：

> "请在 library 模块中新增一个按优先级过滤的快捷按钮，点击后只显示高优先级任务。"

### 8.2 Plan 模式

对于需要人工选择的方案，保留简单选项列表，例如：

- 方案 A：保留当前 library 列表样式
- 方案 B：改为卡片式展示
- 方案 C：添加右侧详情面板

选择后，Copilot 可直接继续实现。

### 8.3 代码交付

- 处理变更时，优先在当前文件中修改；必要时可新增 JS/CSS 文件
- 任何新增本地持久化数据须遵循 `nf_` 前缀规则
- 任何 UI 或样式改动须遵循 Tailwind class 排序与 CSS 变量规则
- 避免引入第三方依赖

### 8.4 AI 代码修改

- 保持代码极度简练，避免冗余。
- 保留现有 Geek aesthetic：暗色、硬核、大字号、点阵风。
- AI 修改 JS 逻辑时，优先沿用现有模块对象风格和 `methodName() { ... }` 语法。
- 避免过度抽象，优先可读、可维护、可直接执行。


## 9. 质量保障

- 所有新增存储逻辑均需考虑历史兼容
- 所有 DOM 查询必须做空值检查
- 所有 API / fetch 调用应处理异常并保持界面可用
- 所有模块方法应在 `window` 之外保持独立封装，尽量减少全局污染


---

## 10. 关键约束总结

- 只用原生 `getElementById` / `querySelector` / `querySelectorAll`
- localStorage 键名必须以 `nf_` 开头
- JSON 存取都要 `try/catch`
- 模块职责清晰：`app`, `timer`, `library`, `ai`, `musicManager`, `state`
- ES6 + 驼峰 + 函数短小
- Tailwind Class 有序，CSS 变量用于主题 token


> 本规范旨在让 Copilot 直接在当前 Flow 全工作区上下文中生成可用代码，并保持项目一致性。