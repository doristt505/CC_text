# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**小说编辑润色工具** 是一个 AI 驱动的创意写作辅助应用，按五步流程带公众号写手/小说作者把初稿打磨成终稿，同时保留作者本人的写作声音。

**五步流程：**
1. **语病检查** - 逐句检查语病、句子通顺度、用词准确性（不动情节和结构）
2. **结构分析** - 参考指定作家的风格标准，分析行文脉络、读者吸引力、创作要素（人物弧光/冲突张力/主题深度/氛围营造/结局效力）
3. **分支创作** - 基于结构分析建议，生成 3 个不同结局方向的完整改写版本
4. **选择定稿** - 在"原文"和 3 个分支版本之间选择一个作为终稿
5. **读者反馈** - 模拟 5 位固定读者视角（普通追更读者/文学评论者/同行写手/挑剔读者/目标受众代表）阅读终稿并给出反馈

## 技术栈

- **前端框架**: Vanilla JavaScript（无框架依赖）
- **API 集成**: DeepSeek API（OpenAI 兼容格式，`/chat/completions`）
- **存储**: LocalStorage
- **部署**: GitHub Pages（静态 HTML）/ 本地直接用浏览器打开

## 项目结构

```
/CC_text/
├── index.html                   # 应用入口（五步向导式界面）
├── css/
│   ├── editor.css              # 主样式表（布局、按钮、表单）
│   ├── annotations.css         # 批注高亮/列表/模态框样式（第①步使用）
│   └── wizard.css              # 五步流程专属样式（步骤条、各步骤内容卡片）
├── js/
│   ├── utils.js                # 工具函数库
│   ├── file-parser.js          # 文件解析（docx/pdf/txt/md）
│   ├── text-processor.js       # 文本分析和处理
│   ├── annotation-manager.js   # 批注数据管理（第①步用）
│   ├── api-client.js           # DeepSeek API 集成，封装五步各自的 prompt
│   ├── ui-renderer.js          # 通用 UI 渲染（批注、通知、加载提示等）
│   ├── wizard-renderer.js      # 第②③④⑤步专属渲染逻辑
│   └── editor-core.js          # 核心编辑器逻辑，五步状态机
├── lib/
│   ├── mammoth.min.js          # Word (.docx) 解析库（本地打包）
│   ├── pdf.min.js              # PDF 解析库（本地打包）
│   └── pdf.worker.min.js       # PDF.js worker
├── .claude/skills/novel-polish/ # Claude Skill 版本（同一套流程）
├── CLAUDE.md                    # 本文件
├── life-simulator.html          # 早期的另一个小项目，与本工具无关
├── README.md                    # 仓库首页说明
└── PROMPT.md                    # 五步流程的通用提示词版（可粘贴到任意 AI）
```

## 核心模块说明

### 1. index.html
五步向导式布局：
- **顶部**: 标题栏（保存进度/导出终稿/重新开始）+ 步骤指示器（①-⑤，当前步高亮、已完成步打勾）
- **左栏**: 输入区（初稿上传、风格范文上传、参考作家、API Key/模型选择、"开始创作流程"按钮）
- **主区域**: 5 个 `.step-panel`，同一时刻只显示 `currentStep` 对应的一个（通过 `active` class 控制）

### 2. utils.js
工具函数集合，无业务逻辑：`generateId()` / `debounce()` / `throttle()` / `getFromStorage()` / `saveToStorage()` / `countCharacters()` / `splitParagraphs()` / `exportAsText()` / `isValidApiKey()` 等。

### 3. text-processor.js
```javascript
TextProcessor.analyzeText(text)      // 分析文本（字数、段数等）
TextProcessor.parseFile(file)        // 解析上传文件（内部调用 FileParser）
TextProcessor.applyAnnotations(text, annotations) // 把已接受(status==='accepted')的批注应用到原文
```

### 4. file-parser.js
统一处理 `.txt/.md/.docx/.pdf` 四种格式的文件解析，`FileParser.init()` 需在页面加载时调用一次（设置 pdf.js worker 路径）。

### 5. annotation-manager.js
批注数据管理类，只在**第①步**使用：
```javascript
const manager = new AnnotationManager();
manager.addBatch(annotations)   // 批量添加（第①步 API 返回后）
manager.accept(id) / manager.reject(id)
manager.getAll() / manager.filterByStatus('accepted')
manager.acceptAll() / manager.rejectAll()
```

### 6. api-client.js
`DeepSeekApiClient` 封装了五步流程里四次不同用途的 AI 调用（第④步是纯前端选择，不调用 API）：
```javascript
const client = new DeepSeekApiClient(apiKey, model); // model: deepseek-v4-flash | deepseek-v4-pro

client.runLineEdit(text, styleReference)
      // 第①步：返回 { annotations, summary }

client.analyzeStructure(text, authorStyle)
      // 第②步：返回 { narrative_flow, engagement, creative_elements_check[], style_reference_notes, structural_suggestions[] }

client.generateBranches(text, structuralAnalysis, authorStyle, branchCount=3)
      // 第③步：返回 [{ title, ending_summary, full_text }, ...]

client.getReaderFeedback(text)
      // 第⑤步：返回 [{ persona, reading_experience, suggestions }, ...]（固定5位读者）
```

四个方法内部都走同一个私有的 `_streamComplete(systemPrompt, userMessage, maxTokens)`（SSE 流式请求，返回拼接后的完整文本），再用 `_extractJson()` 从返回文本里提取 JSON。**每一步的 system prompt 都是硬编码在 api-client.js 里**，如果流程细节要调整，改这里的 prompt 文案即可，不需要改 UI 逻辑。

### 7. ui-renderer.js
通用渲染方法（跨步骤复用）：`renderEditorText()` / `renderAnnotationList()` / `showAnnotationModal()` / `hideModal()` / `updateCharCount()` / `updateParaCount()` / `showLoading(show, message)` / `showNotification()`。

### 8. wizard-renderer.js
`WizardRenderer` 静态类，只负责第②③④⑤步的内容渲染（不处理事件绑定，选择回调通过参数传入）：
```javascript
WizardRenderer.renderStructure(container, analysis)
WizardRenderer.renderBranches(container, branches)
WizardRenderer.renderFinalizeOptions(container, originalText, branches, selectedIndex, onSelect)
WizardRenderer.renderReaders(container, readers)
```

### 9. editor-core.js
核心编辑器类 `NovelEditor`，维护五步状态机：
```javascript
editor.currentStep         // 1-5
editor.originalText        // 用户上传的初稿原文
editor.lineEditedText       // 第①步应用批注后的文本（第②③步基于这个文本分析/创作）
editor.structuralAnalysis   // 第②步结果
editor.branches             // 第③步结果（数组）
editor.finalDraft           // 第④步选定的终稿（第⑤步基于这个文本生成反馈）
editor.readerFeedback       // 第⑤步结果（数组）
```

**关键方法**（一步步串联，每步完成后才解锁下一步的按钮）:
```javascript
editor.startWorkflow()  // 校验输入和 API Key，进入第①步并调用 runStep1()
editor.runStep1()       // 语病检查
editor.runStep2()       // 应用已接受批注 → 结构分析
editor.runStep3()       // 生成 3 个分支版本
editor.goToStep4()      // 渲染定稿选择卡片（不调用 API）
editor.runStep5()       // 5位读者反馈
editor.renderStep()     // 切换 .step-panel 的显隐 + 步骤指示器状态
editor.exportDocument() // 导出终稿（含读者反馈）为 .txt
```

## 数据流

```
用户上传初稿 + （可选）风格范文 + 指定参考作家 + API Key
    ↓
① runLineEdit → 批注列表 → 用户接受/拒绝 → lineEditedText
    ↓
② analyzeStructure（基于 lineEditedText，参考作家风格）→ structuralAnalysis
    ↓
③ generateBranches（基于 lineEditedText + structuralAnalysis）→ 3 个分支全文
    ↓
④ 用户在"原文"与 3 个分支之间选择 → finalDraft
    ↓
⑤ getReaderFeedback（基于 finalDraft）→ 5 位读者反馈
    ↓
导出终稿（正文 + 读者反馈）
```

## API 集成细节

**模型**: `deepseek-v4-flash`（默认，速度快成本低）或 `deepseek-v4-pro`（质量更高），界面下拉框可切换。

**注意**：DeepSeek 模型名会随官方更新变化（本项目开发过程中就从 `deepseek-chat` 变成了 `deepseek-v4-flash/pro`），如果日后再报"不支持的模型名"错误，去 `js/api-client.js` 的 constructor 默认值和 `index.html` 的 `#modelSelect` 选项里同步改掉即可。

**每一步的返回格式**都要求"严格 JSON，不要加 markdown 代码块标记"，但 `_extractJson()` 做了兼容处理（会先去掉 \`\`\`json 代码块标记再解析），防止模型偶尔还是包了代码块。

## 关键开发任务

### 已完成
- [x] 五步向导式界面（步骤指示器 + 单步显示）
- [x] 文件上传解析（txt/md/docx/pdf，本地打包 mammoth.js + pdf.js）
- [x] 第①步：语病/用词批注 + 接受/拒绝交互
- [x] 第②步：结构分析（含参考作家风格输入）
- [x] 第③步：3 个分支版本生成
- [x] 第④步：定稿选择（原文 vs 分支）
- [x] 第⑤步：5位固定读者反馈
- [x] LocalStorage 持久化（API Key + 草稿文本）
- [x] DeepSeek API 集成（OpenAI 兼容格式，流式请求）

### 待开发 / 可扩展方向
- [ ] 风格范文支持一次上传多个文件（目前一次一个）
- [ ] 分支数量可配置（目前固定生成 3 个）
- [ ] DOCX 格式导出（目前只能导出 .txt）
- [ ] 历史版本管理（保留多次五步流程的记录）
- [ ] 5位读者的具体设定改为可自定义（目前是固定的 5 种类型）

## 常用开发命令

### 本地开发
由于本工具直接用 `file://` 协议打开浏览器即可运行（纯静态文件 + DeepSeek 直连浏览器调用），一般不需要起本地服务器。如果需要（比如避免个别浏览器对 `file://` 的限制）：
```bash
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000/
```

### 测试
```bash
# 打开浏览器开发者工具 (F12) → Console
# 走一遍完整五步流程，观察每步的 loading 提示和错误提示
```

### 调试技巧
```javascript
// 浏览器 Console 里直接访问全局的 editor 实例
window.editor.currentStep
window.editor.structuralAnalysis
window.editor.branches
window.editor.annotations.getAll()
```

## 配置和部署

### 环境变量
- **DeepSeek API Key**: 用户在界面输入，可选择保存到 LocalStorage（不会上传到任何服务器）

### GitHub Pages 部署
1. 确保 `index.html` 和相关文件在仓库根目录（工作流在 `.github/workflows/main.yml`）
2. 在 GitHub Settings 中启用 Pages
3. 访问 `https://用户名.github.io/CC_text/`

## 性能与成本考虑

- 第③步（生成3个完整分支全文）和第⑤步（5位读者反馈）请求的 `max_tokens` 设置较高（8192/4096），耗时可能到 1-2 分钟，UI 已有对应的加载提示文案
- 长初稿（例如整章小说）可能导致单次请求超出模型上下文或耗时过长，目前没有做自动分块处理（旧版本的分块逻辑已在改版时移除，因为五步流程需要模型看到全文才能做结构分析和分支创作，分块会破坏这个前提）

## 安全性

- ✅ API Key 存储在浏览器 LocalStorage（不上传服务器）
- ✅ 所有文本处理在客户端完成
- ✅ 使用 HTML 转义防止 XSS（`WizardRenderer.escapeHtml` / `UIRenderer.escapeHtml`）
- ✅ 输入验证和 API Key 格式检查（`sk-` 开头）

## 常见问题排查

### 问题: 报错 "Failed to fetch"
**原因**: 浏览器 CORS 拦截了直连 DeepSeek API 的请求，或网络问题。
**解决**: 检查网络连接；确认没有被浏览器扩展/防火墙拦截。

### 问题: 报错 "The supported API model names are xxx, but you passed xxx"
**原因**: DeepSeek 更新了模型名。
**解决**: 在界面"模型"下拉框里换一个选项试试；如果两个选项都不对，需要改 `js/api-client.js` 和 `index.html` 里的模型名。

### 问题: 报错 "AI 返回内容中未找到有效 JSON"
**原因**: 模型返回的内容不是预期的 JSON 格式（可能被截断，或模型没有遵循格式要求）。
**解决**: 重试一次；如果反复出现，检查是不是初稿过长导致返回被截断（可以尝试调大对应方法里的 `maxTokens`，或减少初稿长度分段处理）。

### 问题: 某一步一直卡在"处理中"
**解决**: 打开浏览器 Console 看具体报错；检查 API Key 余额和网络。

## 扩展和改进想法

1. **后端代理**: 加一层 Node.js 后端代理 API 调用，避免 API Key 暴露在前端
2. **风格范文批量上传**: 支持一次选择多个文件拼接为风格参考
3. **分支数量/读者人设可配置**: 目前"3个分支"和"5位读者"都是写死的，可以做成可调整的
4. **版本历史**: 保留每次五步流程的完整记录，方便回顾对比
5. **高级导出**: 支持导出为 DOCX 格式（保留终稿+读者反馈的排版）

## 相关文档

- [DeepSeek API 官方文档](https://platform.deepseek.com/docs)
- GitHub 仓库: https://github.com/doristt505/CC_text

## 联系方式

项目维护者: claude@anthropic.com
问题反馈: https://github.com/doristt505/CC_text/issues
