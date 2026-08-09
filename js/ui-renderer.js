// UI 渲染引擎

class UIRenderer {
    /**
     * 渲染编辑器文本（带批注）
     */
    static renderEditorText(container, text, annotations) {
        container.innerHTML = '';

        if (!text) {
            container.innerHTML = '<p class="placeholder">点击左侧"上传"或"粘贴"文本后，批注会在此显示</p>';
            return;
        }

        // 按位置排序批注
        const sortedAnnos = annotations
            .slice()
            .sort((a, b) => a.position.start - b.position.start);

        let html = '<p>';
        let lastIndex = 0;

        for (const anno of sortedAnnos) {
            const { start, end } = anno.position;

            // 添加未标注的部分
            if (start > lastIndex) {
                html += this.escapeHtml(text.substring(lastIndex, start));
            }

            // 添加标注部分
            const annoText = text.substring(start, end);
            html += `<span class="annotated" data-anno-id="${anno.id}" data-type="${anno.type}" title="${anno.reason}">`;
            html += this.escapeHtml(annoText);
            html += `<span class="annotation-badge" title="点击查看建议">💭</span>`;
            html += '</span>';

            lastIndex = end;
        }

        // 添加剩余部分
        if (lastIndex < text.length) {
            html += this.escapeHtml(text.substring(lastIndex));
        }

        html += '</p>';
        container.innerHTML = html;

        // 绑定点击事件
        container.querySelectorAll('.annotated').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const annoId = el.dataset.annoId;
                window.editor?.showAnnotationModal(annoId);
            });
        });
    }

    /**
     * 渲染批注列表
     */
    static renderAnnotationList(container, annotations, onAction) {
        container.innerHTML = '';

        if (!annotations || annotations.length === 0) {
            container.innerHTML = '<p class="placeholder">暂无批注</p>';
            return;
        }

        const fragment = document.createDocumentFragment();

        annotations.forEach(anno => {
            const item = this.createAnnotationItem(anno, onAction);
            fragment.appendChild(item);
        });

        container.appendChild(fragment);
    }

    /**
     * 创建单个批注项
     */
    static createAnnotationItem(anno, onAction) {
        const item = createElement('div', `annotation-item ${anno.status}`);

        const header = createElement('div', 'annotation-header');
        header.innerHTML = `
            <span class="annotation-type ${anno.type}">${getTypeLabel(anno.type)}</span>
            <span class="annotation-confidence">准确度: ${Math.round(anno.confidence * 100)}%</span>
        `;

        const text = createElement('div', 'annotation-text');
        text.innerHTML = `
            <div><span class="annotation-original">${this.escapeHtml(anno.original)}</span></div>
            <div style="margin: 0.3rem 0;">→</div>
            <div><span class="annotation-suggestion">${this.escapeHtml(anno.suggestion)}</span></div>
        `;

        const reason = createElement('div', 'annotation-reason', this.escapeHtml(anno.reason));

        const actions = createElement('div', 'annotation-actions');
        actions.innerHTML = `
            <button class="annotation-btn accept" data-id="${anno.id}" data-action="accept">✓ 接受</button>
            <button class="annotation-btn reject" data-id="${anno.id}" data-action="reject">✗ 拒绝</button>
        `;

        actions.addEventListener('click', (e) => {
            if (e.target.classList.contains('annotation-btn')) {
                const action = e.target.dataset.action;
                const id = e.target.dataset.id;
                if (onAction) onAction(action, id);
            }
        });

        item.appendChild(header);
        item.appendChild(text);
        item.appendChild(reason);
        item.appendChild(actions);

        return item;
    }

    /**
     * 显示批注模态框
     */
    static showAnnotationModal(modal, anno) {
        const titleEl = modal.querySelector('#modalTitle');
        const typeEl = modal.querySelector('#modalType');
        const confidenceEl = modal.querySelector('#modalConfidence');
        const originalEl = modal.querySelector('#modalOriginal');
        const suggestionEl = modal.querySelector('#modalSuggestion');
        const reasonEl = modal.querySelector('#modalReason');

        if (titleEl) titleEl.textContent = `修改建议 - ${getTypeLabel(anno.type)}`;
        if (typeEl) typeEl.textContent = getTypeLabel(anno.type);
        if (confidenceEl) confidenceEl.textContent = `${Math.round(anno.confidence * 100)}% (${getConfidenceLevel(anno.confidence)})`;
        if (originalEl) originalEl.textContent = anno.original;
        if (suggestionEl) suggestionEl.textContent = anno.suggestion;
        if (reasonEl) reasonEl.textContent = anno.reason;

        modal.style.display = 'flex';
    }

    /**
     * 隐藏模态框
     */
    static hideModal(modal) {
        modal.style.display = 'none';
    }

    /**
     * 更新字数统计
     */
    static updateCharCount(container, text) {
        if (!container || !text) return;

        const charCount = countCharacters(text);
        const parts = [
            `字数: ${charCount.total}`
        ];

        if (charCount.chinese > 0) parts.push(`中文: ${charCount.chinese}`);
        if (charCount.english > 0) parts.push(`英文: ${charCount.english}`);

        container.textContent = parts.join(' · ');
    }

    /**
     * 更新段数统计
     */
    static updateParaCount(container, text) {
        if (!container || !text) return;

        const paragraphs = splitParagraphs(text);
        container.textContent = `段数: ${paragraphs.length}`;
    }

    /**
     * 显示加载指示
     */
    static showLoading(show = true, message = 'AI 正在处理...') {
        const indicator = document.getElementById('loadingIndicator');
        if (indicator) {
            indicator.style.display = show ? 'flex' : 'none';
        }

        const messageEl = document.getElementById('loadingMessage');
        if (messageEl && show) {
            messageEl.textContent = message;
        }
    }

    /**
     * 显示通知
     */
    static showNotification(message, type = 'info') {
        const notif = createElement('div', `notification notification-${type}`, message);
        notif.style.cssText = `
            position: fixed;
            top: 1.5rem;
            right: 1.5rem;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
            color: white;
            z-index: 2000;
            animation: slideInRight 0.3s ease-out;
        `;

        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 3000);
    }

    /**
     * 转义 HTML
     */
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIRenderer;
}
