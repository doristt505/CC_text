// DeepSeek API 客户端（OpenAI 兼容格式）
// 支撑五步创作流程：语病检查 → 结构分析 → 分支创作 → 定稿 → 读者反馈

class DeepSeekApiClient {
    constructor(apiKey, model = 'deepseek-v4-flash') {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.deepseek.com';
        this.model = model;
    }

    setApiKey(apiKey) {
        this.apiKey = apiKey;
    }

    isValidApiKey() {
        return this.apiKey && this.apiKey.startsWith('sk-') && this.apiKey.length > 20;
    }

    /**
     * 通用流式对话请求，返回完整文本
     */
    async _streamComplete(systemPrompt, userMessage, maxTokens = 4096) {
        if (!this.isValidApiKey()) {
            throw new Error('Invalid API Key');
        }

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.model,
                    max_tokens: maxTokens,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage }
                    ],
                    stream: true
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `API Error: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const event = JSON.parse(data);
                            const delta = event.choices?.[0]?.delta?.content;
                            if (delta) {
                                fullResponse += delta;
                            }
                        } catch (e) {
                            console.error('Parse error:', e);
                        }
                    }
                }
            }

            return fullResponse;

        } catch (error) {
            console.error('API request error:', error);
            if (error instanceof TypeError && error.message.includes('fetch')) {
                throw new Error('无法连接到 DeepSeek API，请检查网络连接，或尝试通过 http(s):// 地址（而非 file://）打开本工具');
            }
            throw error;
        }
    }

    /**
     * 从返回文本中提取 JSON
     */
    _extractJson(response) {
        const cleaned = response.replace(/```json|```/g, '');
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('AI 返回内容中未找到有效 JSON，请重试');
        }
        return JSON.parse(jsonMatch[0]);
    }

    /**
     * 第①步：语病 / 句子通顺 / 用词检查
     */
    async runLineEdit(text, styleReference) {
        const styleGuide = styleReference && styleReference.trim()
            ? `作者的风格参考（学习这篇文章的用词和语感，不要改成与之无关的风格）:\n${styleReference.substring(0, 800)}`
            : '未提供风格参考，请保留原作者的表达习惯。';

        const systemPrompt = `你是一位经验丰富的中文文字编辑，专注于逐句检查小说初稿的语病、句子通顺度和用词准确性。

${styleGuide}

检查范围（只做这三件事，不要改动情节和结构）:
1. 语病：语法错误、搭配不当、逻辑不通的句子
2. 句子通顺：拗口、啰嗦、有歧义的表达
3. 用词：不够精准、重复、有更贴切替代词的地方

修改原则:
- 保留作者原有的声音和风格，不要"改写"成别的味道
- 只在真正有问题的地方标注，不要为了挑毛病而挑毛病
- 每一处标注要给出具体、可执行的替代方案

返回格式（严格 JSON，不要加 markdown 代码块标记）:
{
  "annotations": [
    {
      "position": { "start": 字符位置开始, "end": 字符位置结束 },
      "type": "grammar|word_choice|readability",
      "original": "原文片段",
      "suggestion": "建议修改",
      "reason": "修改理由（1句话）",
      "confidence": 0.0到1.0,
      "severity": "minor|medium|major"
    }
  ],
  "summary": "整体语言质量的简要评价"
}`;

        const userMessage = `请检查以下小说初稿的语病、句子通顺度和用词：\n\n${text}`;
        const response = await this._streamComplete(systemPrompt, userMessage, 4096);
        const data = this._extractJson(response);

        return {
            annotations: data.annotations || [],
            summary: data.summary || ''
        };
    }

    /**
     * 第②步：结构分析（参考指定作家风格）
     */
    async analyzeStructure(text, authorStyle) {
        const authorNote = authorStyle && authorStyle.trim()
            ? `请特别参考「${authorStyle}」的创作风格标准来评估这篇作品的文学质感和处理方式。`
            : '';

        const systemPrompt = `你是一位资深的小说创作导师，擅长分析行文脉络与结构，帮助创意写作者提升作品的完整度和吸引力。

${authorNote}

请从以下角度分析这篇小说初稿:
1. 行文脉络：叙事线索是否清晰，段落衔接是否顺畅，节奏安排是否得当
2. 读者吸引力：开头是否抓人，中段是否有张力，是否有让读者持续读下去的钩子
3. 创作要素检查：人物弧光、冲突张力、主题深度、场景/氛围营造、结局效力这五项是否达标
4. 对照参考作家风格的具体建议：如何让文本更贴近参考作家的文学质感

返回格式（严格 JSON，不要加 markdown 代码块标记）:
{
  "narrative_flow": "对行文脉络的分析（2-3句）",
  "engagement": "对读者吸引力的评估（2-3句）",
  "creative_elements_check": [
    { "element": "人物弧光", "status": "达标|待加强", "comment": "具体说明" },
    { "element": "冲突张力", "status": "达标|待加强", "comment": "具体说明" },
    { "element": "主题深度", "status": "达标|待加强", "comment": "具体说明" },
    { "element": "场景/氛围营造", "status": "达标|待加强", "comment": "具体说明" },
    { "element": "结局效力", "status": "达标|待加强", "comment": "具体说明" }
  ],
  "style_reference_notes": "对照参考作家风格的具体建议",
  "structural_suggestions": ["建议1", "建议2", "建议3"]
}`;

        const userMessage = `请分析以下小说初稿的结构和行文脉络：\n\n${text}`;
        const response = await this._streamComplete(systemPrompt, userMessage, 4096);
        return this._extractJson(response);
    }

    /**
     * 第③步：生成多个分支版本（不同结局方向）
     */
    async generateBranches(text, structuralAnalysis, authorStyle, branchCount = 3) {
        const suggestions = (structuralAnalysis?.structural_suggestions || []).join('；');
        const authorNote = authorStyle && authorStyle.trim()
            ? `改写时请贴近「${authorStyle}」式的文学质感。`
            : '';

        const systemPrompt = `你是一位资深小说创作者。基于结构分析建议，为这篇小说初稿创作 ${branchCount} 个不同方向的完整改写版本，每个版本代表不同的结局走向和情感基调。

结构分析建议：${suggestions || '无具体建议，请自行判断改进空间'}
${authorNote}

要求:
- 每个版本都是完整的全文改写，不是片段或大纲
- ${branchCount} 个版本的结局方向要有明显差异（例如：开放式/圆满式/悲剧式，或不同的情感落点）
- 保留原作的核心人物设定和主要情节，只在结局走向和部分铺陈上做差异化处理

返回格式（严格 JSON，不要加 markdown 代码块标记）:
{
  "branches": [
    {
      "title": "方向的简短标题（8字以内）",
      "ending_summary": "这个方向结局走向的简述（1-2句）",
      "full_text": "完整改写后的全文"
    }
  ]
}`;

        const userMessage = `原文：\n${text}`;
        const response = await this._streamComplete(systemPrompt, userMessage, 8192);
        const data = this._extractJson(response);
        return data.branches || [];
    }

    /**
     * 第⑤步：5位固定读者视角反馈
     */
    async getReaderFeedback(text) {
        const systemPrompt = `请你分别扮演以下5位读者，阅读这篇小说终稿，各自独立给出真实的阅读体验和修改建议（视角之间不要互相影响或混淆）：

1. 普通追更读者：只关心情节抓不抓人，有没有想一直看下去的冲动，会不会弃文
2. 文学评论者：关注文学性、主题深度、艺术手法是否到位
3. 同行写手：从创作技巧角度点评叙事安排、结构处理，指出可学习或可改进之处
4. 挑剔读者：专门挑毛病，找逻辑漏洞、人物行为不合理之处、细节疏漏
5. 目标受众代表（公众号/网络连载读者）：站在这类平台典型读者的期待上，评估是否符合阅读习惯

返回格式（严格 JSON，不要加 markdown 代码块标记）:
{
  "readers": [
    { "persona": "普通追更读者", "reading_experience": "阅读体验描述", "suggestions": "修改建议" },
    { "persona": "文学评论者", "reading_experience": "...", "suggestions": "..." },
    { "persona": "同行写手", "reading_experience": "...", "suggestions": "..." },
    { "persona": "挑剔读者", "reading_experience": "...", "suggestions": "..." },
    { "persona": "目标受众代表", "reading_experience": "...", "suggestions": "..." }
  ]
}`;

        const userMessage = `请阅读以下小说终稿：\n\n${text}`;
        const response = await this._streamComplete(systemPrompt, userMessage, 4096);
        const data = this._extractJson(response);
        return data.readers || [];
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeepSeekApiClient;
}
