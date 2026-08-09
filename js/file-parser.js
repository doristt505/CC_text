// 文件解析模块（支持 txt/md/docx/pdf）

class FileParser {
    static init() {
        if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
        }
    }

    /**
     * 根据扩展名解析文件，返回纯文本内容
     */
    static async parse(file) {
        const ext = file.name.split('.').pop().toLowerCase();

        if (ext === 'docx') {
            return await this.parseDocx(file);
        }
        if (ext === 'pdf') {
            return await this.parsePdf(file);
        }
        // 默认按纯文本处理（.txt/.md）
        return await readFile(file);
    }

    /**
     * 解析 .docx 文件
     */
    static async parseDocx(file) {
        if (!window.mammoth) {
            throw new Error('Word 解析库未加载，请检查 lib/mammoth.min.js 是否存在');
        }
        const arrayBuffer = await file.arrayBuffer();
        const result = await window.mammoth.extractRawText({ arrayBuffer });
        return result.value;
    }

    /**
     * 解析 .pdf 文件
     */
    static async parsePdf(file) {
        if (!window.pdfjsLib) {
            throw new Error('PDF 解析库未加载，请检查 lib/pdf.min.js 是否存在');
        }
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pageTexts = [];

        for (let i = 1; i <= pdf.numPages; i += 1) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const text = content.items.map((item) => item.str).join('');
            pageTexts.push(text);
        }

        return pageTexts.join('\n\n');
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileParser;
}
