// 工具函数

/**
 * 生成 UUID
 */
function generateId() {
    return 'id_' + Math.random().toString(36).substr(2, 9) + Date.now();
}

/**
 * 延迟执行
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 防抖
 */
function debounce(fn, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

/**
 * 节流
 */
function throttle(fn, delay) {
    let lastTime = 0;
    return function(...args) {
        const now = Date.now();
        if (now - lastTime >= delay) {
            fn(...args);
            lastTime = now;
        }
    };
}

/**
 * 从 localStorage 读取
 */
function getFromStorage(key, defaultValue = null) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : defaultValue;
    } catch (e) {
        console.error('Storage read error:', e);
        return defaultValue;
    }
}

/**
 * 保存到 localStorage
 */
function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.error('Storage write error:', e);
        return false;
    }
}

/**
 * 创建元素并设置属性
 */
function createElement(tag, className, innerHTML = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (innerHTML) el.innerHTML = innerHTML;
    return el;
}

/**
 * 类型标签显示
 */
function getTypeLabel(type) {
    const labels = {
        word_choice: '用词',
        grammar: '语法',
        structure: '结构',
        tone: '语气',
        readability: '可读性'
    };
    return labels[type] || type;
}

/**
 * 复制到剪贴板
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (e) {
        console.error('Copy error:', e);
        return false;
    }
}

/**
 * 显示通知
 */
function showNotification(message, type = 'info', duration = 3000) {
    const notif = createElement('div', `notification notification-${type}`, message);
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), duration);
}

/**
 * 计算读取时间（分钟）
 */
function calculateReadingTime(text, wpm = 200) {
    const words = text.trim().split(/\s+/).length;
    const time = Math.ceil(words / wpm);
    return time < 1 ? 1 : time;
}

/**
 * 统计字数（中文和英文）
 */
function countCharacters(text) {
    // 中文字符
    const chineseChars = (text.match(/[一-鿿]/g) || []).length;
    // 英文单词
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    // 其他字符
    const otherChars = text.replace(/[一-鿿\s\n\r]/g, '').length;

    return {
        total: chineseChars + englishWords + otherChars,
        chinese: chineseChars,
        english: englishWords,
        other: otherChars
    };
}

/**
 * 段落分割
 */
function splitParagraphs(text) {
    return text
        .split(/\n\n+/)
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .map((p, index) => ({
            id: `p_${index}`,
            index,
            content: p,
            sentences: p.split(/[。！？\n]/g).filter(s => s.trim())
        }));
}

/**
 * 高亮文本片段
 */
function highlightText(text, original, suggestion) {
    const parts = [];
    let lastIndex = 0;

    const index = text.indexOf(original);
    if (index !== -1) {
        parts.push(text.substring(0, index));
        parts.push({
            type: 'annotated',
            content: original,
            suggestion
        });
        parts.push(text.substring(index + original.length));
    } else {
        parts.push(text);
    }

    return parts;
}

/**
 * 格式化 API Key（显示部分）
 */
function maskApiKey(key) {
    if (!key) return '';
    return key.substring(0, 7) + '***' + key.substring(key.length - 4);
}

/**
 * 验证 API Key 格式
 */
function isValidApiKey(key) {
    return key && key.startsWith('sk-') && key.length > 20;
}

/**
 * 获取修改类型的颜色
 */
function getTypeColor(type) {
    const colors = {
        word_choice: '#ff9800',
        grammar: '#f44336',
        structure: '#2196f3',
        tone: '#9c27b0',
        readability: '#4caf50'
    };
    return colors[type] || '#666';
}

/**
 * 计算置信度等级
 */
function getConfidenceLevel(confidence) {
    if (confidence >= 0.9) return '高';
    if (confidence >= 0.7) return '中';
    return '低';
}

/**
 * 导出为文本
 */
function exportAsText(content, filename = 'document.txt') {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

/**
 * 读取文件
 */
function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}
