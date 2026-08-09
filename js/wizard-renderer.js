// 五步流程中第②③④⑤步的渲染逻辑

class WizardRenderer {
    /**
     * 第②步：渲染结构分析结果
     */
    static renderStructure(container, analysis) {
        if (!analysis) {
            container.innerHTML = '<p class="placeholder">暂无结构分析结果</p>';
            return;
        }

        const elementsHtml = (analysis.creative_elements_check || []).map(item => `
            <div class="element-row">
                <span class="element-name">${this.escapeHtml(item.element)}</span>
                <span class="element-status ${item.status === '达标' ? 'ok' : 'warn'}">${this.escapeHtml(item.status)}</span>
                <span class="element-comment">${this.escapeHtml(item.comment)}</span>
            </div>
        `).join('');

        const suggestionsHtml = (analysis.structural_suggestions || []).map(s => `<li>${this.escapeHtml(s)}</li>`).join('');

        container.innerHTML = `
            <div class="structure-block">
                <h3>📖 行文脉络</h3>
                <p>${this.escapeHtml(analysis.narrative_flow || '')}</p>
            </div>
            <div class="structure-block">
                <h3>🎣 读者吸引力</h3>
                <p>${this.escapeHtml(analysis.engagement || '')}</p>
            </div>
            <div class="structure-block">
                <h3>✅ 创作要素检查</h3>
                <div class="element-list">${elementsHtml}</div>
            </div>
            <div class="structure-block">
                <h3>📚 参考作家风格建议</h3>
                <p>${this.escapeHtml(analysis.style_reference_notes || '')}</p>
            </div>
            <div class="structure-block">
                <h3>💡 结构性修改建议</h3>
                <ul class="suggestion-list">${suggestionsHtml}</ul>
            </div>
        `;
    }

    /**
     * 第③步：渲染分支版本列表
     */
    static renderBranches(container, branches) {
        if (!branches || branches.length === 0) {
            container.innerHTML = '<p class="placeholder">暂无分支版本</p>';
            return;
        }

        container.innerHTML = branches.map((branch, index) => `
            <div class="branch-card">
                <div class="branch-header">
                    <span class="branch-index">方向 ${index + 1}</span>
                    <span class="branch-title">${this.escapeHtml(branch.title)}</span>
                </div>
                <p class="branch-summary">${this.escapeHtml(branch.ending_summary)}</p>
                <details class="branch-detail">
                    <summary>查看全文</summary>
                    <div class="branch-fulltext">${this.escapeHtml(branch.full_text)}</div>
                </details>
            </div>
        `).join('');
    }

    /**
     * 第④步：渲染定稿选择卡片
     */
    static renderFinalizeOptions(container, originalText, branches, selectedIndex, onSelect) {
        const options = [
            { title: '保留第①②步修改后的原文（不采用分支）', ending_summary: '不改变结局走向，仅使用语病修改后的版本', full_text: originalText }
        ].concat(branches || []);

        container.innerHTML = options.map((opt, index) => `
            <label class="finalize-card ${selectedIndex === index ? 'selected' : ''}">
                <input type="radio" name="finalizeChoice" value="${index}" ${selectedIndex === index ? 'checked' : ''}>
                <div class="finalize-card-body">
                    <div class="finalize-card-title">${index === 0 ? '📄 原文版本' : `📌 ${this.escapeHtml(opt.title)}`}</div>
                    <p class="finalize-card-summary">${this.escapeHtml(opt.ending_summary)}</p>
                    <details class="branch-detail">
                        <summary>查看全文</summary>
                        <div class="branch-fulltext">${this.escapeHtml(opt.full_text)}</div>
                    </details>
                </div>
            </label>
        `).join('');

        container.querySelectorAll('input[name="finalizeChoice"]').forEach(input => {
            input.addEventListener('change', (e) => {
                onSelect(parseInt(e.target.value, 10), options[parseInt(e.target.value, 10)].full_text);
            });
        });
    }

    /**
     * 第⑤步：渲染5位读者反馈
     */
    static renderReaders(container, readers, synthesis) {
        if (!readers || readers.length === 0) {
            container.innerHTML = '<p class="placeholder">暂无读者反馈</p>';
            return;
        }

        const icons = ['📱', '🎓', '✍️', '🔍', '🎯'];

        const synthesisHtml = synthesis ? `
            <div class="reader-synthesis">
                <h3>📌 汇总</h3>
                <div class="synthesis-row">
                    <span class="synthesis-label shared">多人共同提到</span>
                    <p>${this.escapeHtml(synthesis.shared_problems)}</p>
                </div>
                <div class="synthesis-row">
                    <span class="synthesis-label single">单一视角的偏好</span>
                    <p>${this.escapeHtml(synthesis.single_view_preferences)}</p>
                </div>
                <div class="synthesis-row">
                    <span class="synthesis-label conflict">对立意见（取舍点）</span>
                    <p>${this.escapeHtml(synthesis.conflicts)}</p>
                </div>
                <p class="synthesis-note">追更读者和目标受众代表的意见反映的是<strong>阅读成本</strong>，不是质量问题。他们说"读不下去"的地方，可能正是文学评论者说"全篇最好"的地方。</p>
            </div>
        ` : '';

        container.innerHTML = synthesisHtml + readers.map((reader, index) => `
            <div class="reader-card">
                <div class="reader-header">
                    <span class="reader-icon">${icons[index] || '👤'}</span>
                    <span class="reader-persona">${this.escapeHtml(reader.persona)}</span>
                </div>
                <div class="reader-section">
                    <span class="reader-label">阅读体验</span>
                    <p>${this.escapeHtml(reader.reading_experience)}</p>
                </div>
                <div class="reader-section">
                    <span class="reader-label">修改建议</span>
                    <p>${this.escapeHtml(reader.suggestions)}</p>
                </div>
            </div>
        `).join('');
    }

    static escapeHtml(text) {
        if (text === undefined || text === null) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = WizardRenderer;
}
