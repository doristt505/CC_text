// 文本处理模块

class TextProcessor {
    /**
     * 解析文本文件
     */
    static async parseFile(file) {
        if (!file) return null;

        try {
            const text = await FileParser.parse(file);
            return {
                filename: file.name,
                content: text,
                size: file.size,
                type: file.type,
                uploadTime: new Date().toISOString()
            };
        } catch (error) {
            console.error('File parse error:', error);
            throw new Error('文件读取失败');
        }
    }

    /**
     * 分析文本
     */
    static analyzeText(text) {
        const normalized = this.normalizeText(text);
        const charCount = countCharacters(normalized);
        const paragraphs = splitParagraphs(normalized);
        const sentences = this.extractSentences(normalized);

        return {
            original: text,
            normalized,
            analysis: {
                charCount,
                paragraphCount: paragraphs.length,
                sentenceCount: sentences.length,
                readingTime: calculateReadingTime(normalized),
                language: this.detectLanguage(normalized)
            },
            paragraphs,
            sentences
        };
    }

    /**
     * 规范化文本
     */
    static normalizeText(text) {
        return text
            .replace(/\r\n/g, '\n')  // 统一换行符
            .replace(/\t/g, '  ')    // Tab 转空格
            .replace(/[ 　]/g, ' ')  // 移除特殊空格
            .trim();
    }

    /**
     * 提取句子
     */
    static extractSentences(text) {
        return text
            .split(/[。！？\n]+/)
            .map(s => s.trim())
            .filter(s => s.length > 0)
            .map((s, i) => ({
                id: `s_${i}`,
                index: i,
                content: s
            }));
    }

    /**
     * 检测语言
     */
    static detectLanguage(text) {
        const chineseChars = (text.match(/[一-鿿]/g) || []).length;
        const totalChars = text.length;

        if (chineseChars / totalChars > 0.3) {
            return 'zh-CN';
        }
        return 'en';
    }

    /**
     * 合并修改建议到原文
     */
    static applyAnnotations(originalText, annotations) {
        let result = originalText;
        const sorted = [...annotations]
            .filter(a => a.status === 'accepted')
            .sort((a, b) => b.position.start - a.position.start); // 从后往前替换

        for (const anno of sorted) {
            if (anno.position && anno.suggestion) {
                const start = anno.position.start;
                const end = anno.position.end;
                result = result.substring(0, start) + anno.suggestion + result.substring(end);
            }
        }

        return result;
    }

    /**
     * 生成 Diff（简单实现）
     */
    static generateSimpleDiff(original, modified) {
        const origWords = original.split(' ');
        const modWords = modified.split(' ');
        const diffs = [];

        let i = 0, j = 0;
        while (i < origWords.length || j < modWords.length) {
            if (i < origWords.length && j < modWords.length && origWords[i] === modWords[j]) {
                diffs.push({ type: 'unchanged', text: origWords[i] + ' ' });
                i++;
                j++;
            } else if (j < modWords.length && (i >= origWords.length || origWords[i + 1] === modWords[j])) {
                diffs.push({ type: 'inserted', text: modWords[j] + ' ' });
                j++;
            } else if (i < origWords.length) {
                diffs.push({ type: 'deleted', text: origWords[i] + ' ' });
                i++;
            } else {
                diffs.push({ type: 'inserted', text: modWords[j] + ' ' });
                j++;
            }
        }

        return diffs;
    }

    /**
     * 创建文档对象
     */
    static createDocument(text, metadata = {}) {
        const analysis = this.analyzeText(text);

        return {
            id: generateId(),
            title: metadata.title || '未命名文档',
            content: analysis.normalized,
            analysis: analysis.analysis,
            paragraphs: analysis.paragraphs,
            metadata: {
                created: new Date().toISOString(),
                ...metadata
            }
        };
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TextProcessor;
}
