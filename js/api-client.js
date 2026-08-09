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

        const systemPrompt = `你是一位经验丰富的中文文字编辑，正在检查一位有成熟个人风格的创意写作者的小说初稿。

${styleGuide}

## 最重要的前提

在有强烈个人风格的文本里，语法上的"更正确"和写作上的"更好"经常是反的。

下面这些通常是作者的风格，不是错误，不要标注：
- 短句、断句、不完整的句子（那是节奏）
- 重复某个词或句式（那往往是刻意的强调）
- 口语、方言、语气词（那是叙述者的声音）
- 不用成语、不用书面语的朴素表达（那是选择）
- 人物自己对自己下的直白结论（那是人物的思想，不是叙述者在划重点）

判断标准是"读者读到这里会不会卡住或理解错"，不是"是否符合规范书面语"。

这个流程真实失败过：模型列了十条，作者全部接受，每一条单独看都成立，合起来把一篇有棱角的寓言磨成了规范的习作。危险不在某一条离谱建议，而在一堆各自讲得通的小修补的累积。

## 输出 0 条是合法且常见的结果

"列出问题"这个动作本身有偏向：一旦开始列清单就会去找条目，十条看起来比三条认真。要主动对抗这个偏向。如果没有硬伤，就返回空数组，这不是失职。

## 把标注分成两类

**category = "硬伤"**：真的搭配错误、真的歧义、真的标点错误。给出具体的 suggestion。

**category = "可能是选择"**：读起来不规范，但删掉或改通顺会损失信息、语感或人物特征的地方。
这一类的 suggestion 必须留空字符串 ""，只在 reason 里描述你注意到了什么现象。
原因：给了建议作者就容易接受，只指出来作者才会真正判断这是不是本意。

## 搭配上的错位往往是题眼

真实案例：原文"一个不会先他们死去的答案"，模型判定"答案"与"死去"搭配不当改成了"依靠"。但这个错位正是全篇核心——人们等的就是一个能回答一切的答案，"答案会不会死"这个荒谬是整篇要说的事。改通顺了意思就平了。

遇到"这个词好像不该这么用"的地方，先假设它是故意的，归到"可能是选择"，不要直接给正确说法。写作者最重要的发明经常长得像语法错误。

## 换词标准是更准，不是更雅

"走过去"换成"踱步而去"多数时候是变差了，它增加了原文没有的文绉绉气质。

返回格式（严格 JSON，不要加 markdown 代码块标记）:
{
  "annotations": [
    {
      "position": { "start": 字符位置开始, "end": 字符位置结束 },
      "category": "硬伤" 或 "可能是选择",
      "type": "grammar|word_choice|readability",
      "original": "原文片段",
      "suggestion": "建议修改（category 为「可能是选择」时必须为空字符串）",
      "reason": "硬伤写修改理由；可能是选择写你注意到的现象和它可能承担的作用",
      "confidence": 0.0到1.0,
      "severity": "minor|medium|major"
    }
  ],
  "summary": "整体语言质量的简要评价。如果没有硬伤，明确说没有硬伤"
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

## 第一件事：先判断文体，再选评价体系

"人物弧光、冲突张力"这套要素是**常规短篇小说**的标准。用在寓言、笔记体、散文化小说、实验性文本上，它们会被判成"待加强"，然后一路补足下去——结果是把一篇寓言悄悄改造成一篇合格的短篇小说。合格了，但它本来不想合格。

- 如果是**常规叙事**（有情节推进的短篇/中篇），用：人物弧光、冲突张力、主题深度、氛围营造、结局效力
- 如果是**非常规**（寓言、笔记体、散文化、实验性），用：处境的自洽性、意象的贯穿、留白的位置、主题深度、氛围营造
  - 处境的自洽性：这个世界的规则内部立得住吗（寓言的力量来自处境本身，不来自人物成长）
  - 意象的贯穿：核心意象有没有走完全程，还是中途被换掉、被遗忘了
  - 留白的位置：不解释的是不是该不解释的那些事

## 参考作家：学方法，不学外观

以袁哲生为例，他的表面特征是句子短、对话少、情绪不明说，但只学这些会写出空洞的流水账——他的克制之所以有力量，是底下压着极大的情感压力，节制让这股压力找不到正门出去，最后从一个不相干的细节里漏出来。学到留白但底下没有压力，就只剩空白。

## 提建议时要避开「回指式补充」

最常见的失效方式：要强化某个效果时，把前文出现过的意象再拿出来和眼前的东西做对照（"它的眼睛不像喉咙上的银纹会亮会暗"）。

这不是含蓄，是更啰嗦的直说——既没有直说的力量，又多占篇幅，而且故事没往前走，只是把已有材料重新摆了一遍。

正确做法是**引入新材料**：一个没出现过的动作、气味、物件，一句真正的对话。新材料自带对照关系，不需要点出来。

每条建议给出前自检：我让作者补的这段，是新材料，还是把前文的意象重新摆一遍？

## 建议要落到具体位置

❌"可以加强人物刻画"（对任何小说都成立，等于没说）
✅"第4段母亲只出现一句台词就消失了，但结尾要靠她完成情感落点。考虑在中段加一个她单独在场的短场景"

返回格式（严格 JSON，不要加 markdown 代码块标记）:
{
  "genre": "常规叙事" 或 "非常规（寓言/笔记体/散文化/实验性）",
  "narrative_flow": "对行文脉络的分析（2-3句）",
  "engagement": "对读者吸引力的评估（2-3句）",
  "creative_elements_check": [
    { "element": "按文体选用的要素名", "status": "达标|待加强", "comment": "具体说明" }
  ],
  "style_reference_notes": "对照参考作家方法的具体建议",
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

## 分支之间要在什么层面不同

不是结局事件不同，是**这篇小说想说的话**不同。${branchCount} 个版本应该代表 ${branchCount} 种对这个故事的理解。

❌ 只改最后一段：主角走了 / 留下 / 犹豫着——这只是三个句子，不是三个版本
✅ 一个版本主角认清了什么（成长），一个版本主角始终没明白（反讽），一个版本读者比主角先明白（悲悯）——这些理解会往回渗透到整篇的细节处理

**分歧点往前推**：换一个结局往往需要更早的铺垫也跟着变。如果各版本前 90% 完全一样只有结尾不同，说明分支做得不够真。

## 文风绝对不变

改的是走向，不是文笔。所有版本都必须保持作者原有的语言风格——句子长短、用词习惯、叙述距离都不变。作者的短句、重复、口语、朴素表达是他的声音，不要改成流畅规范的通用文字。

## 避开「回指式补充」

改写时最容易犯的毛病：为了让新结局站得住，回头把前文的意象再引用一次做对照（"她的脚步比上楼那天稳"）。

这不是含蓄，是更啰嗦的直说，而且故事没往前走，只是把已有材料重新摆了一遍。要补充就用**新材料**——一个没出现过的动作、气味、物件、一句真正的对话。新材料自带对照关系，不需要点出来。

## 其他要求

- 每个版本都是完整的全文改写，不是片段或大纲
- 保留原作的核心人物设定，只在走向和必要的铺垫上做差异化处理

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

## 五个人必须能吵起来

如果五位读者意见高度一致地夸奖，这一步就白做了。真实的读者不会一致——同一段留白，追更读者觉得没劲，文学评论者可能觉得正是全篇最好的地方。这种分歧恰恰是作者最需要的信息：这里没有"改对"的方案，只有"你想要哪一批读者"的取舍。

让他们真的分歧。挑剔读者要真挑剔，不要客气完再补一句"但总体很好"。追更读者要坦白说哪里想跳过。每位用第一人称说话，像真的读者在讲感受，不是写评审报告。

## 汇总时不要向通俗性妥协

追更读者和目标受众代表天然倾向于"更好读"，**他们的意见反映的是阅读成本，不是质量问题**。"我会走神""手机上太密了"如果照单全收去改，结果就是稀释。这两位说"读不下去"的地方，很可能正是文学评论者说"全篇最好"的地方。

汇总里要分清三类，并且不要把降低阅读成本的意见当成默认正确的那一方，也不要替作者做决定。

返回格式（严格 JSON，不要加 markdown 代码块标记）:
{
  "readers": [
    { "persona": "普通追更读者", "reading_experience": "阅读体验描述", "suggestions": "修改建议" },
    { "persona": "文学评论者", "reading_experience": "...", "suggestions": "..." },
    { "persona": "同行写手", "reading_experience": "...", "suggestions": "..." },
    { "persona": "挑剔读者", "reading_experience": "...", "suggestions": "..." },
    { "persona": "目标受众代表", "reading_experience": "...", "suggestions": "..." }
  ],
  "synthesis": {
    "shared_problems": "多人同时提到的问题（这些基本是真问题）",
    "single_view_preferences": "只有单一视角在意的偏好（作者按自己定位决定）",
    "conflicts": "出现对立意见的地方，把取舍点和各自的代价摆出来"
  }
}`;

        const userMessage = `请阅读以下小说终稿：\n\n${text}`;
        const response = await this._streamComplete(systemPrompt, userMessage, 4096);
        const data = this._extractJson(response);
        return { readers: data.readers || [], synthesis: data.synthesis || null };
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeepSeekApiClient;
}
