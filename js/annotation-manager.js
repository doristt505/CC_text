// 批注管理模块

class AnnotationManager {
    constructor() {
        this.annotations = new Map();
        this.stats = {
            total: 0,
            accepted: 0,
            rejected: 0,
            pending: 0
        };
    }

    /**
     * 添加批注
     */
    add(annotation) {
        const id = generateId();
        const normalized = {
            id,
            paraId: annotation.paraId || 'unknown',
            type: annotation.type || 'word_choice',
            original: annotation.original || '',
            suggestion: annotation.suggestion || '',
            reason: annotation.reason || '',
            confidence: annotation.confidence || 0.5,
            severity: annotation.severity || 'minor',
            position: annotation.position || { start: 0, end: 0 },
            status: annotation.status || 'pending',
            createdAt: new Date().toISOString()
        };

        if (!this.annotations.has(normalized.paraId)) {
            this.annotations.set(normalized.paraId, []);
        }

        this.annotations.get(normalized.paraId).push(normalized);
        this.updateStats();

        return normalized;
    }

    /**
     * 批量添加批注
     */
    addBatch(annotations) {
        return annotations.map(anno => this.add(anno));
    }

    /**
     * 获取批注
     */
    get(id) {
        for (const [, annos] of this.annotations) {
            const found = annos.find(a => a.id === id);
            if (found) return found;
        }
        return null;
    }

    /**
     * 更新批注状态
     */
    updateStatus(id, status) {
        const anno = this.get(id);
        if (anno) {
            anno.status = status;
            this.updateStats();
        }
        return anno;
    }

    /**
     * 接受批注
     */
    accept(id) {
        return this.updateStatus(id, 'accepted');
    }

    /**
     * 拒绝批注
     */
    reject(id) {
        return this.updateStatus(id, 'rejected');
    }

    /**
     * 获取所有批注
     */
    getAll() {
        const all = [];
        for (const [, annos] of this.annotations) {
            all.push(...annos);
        }
        return all.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * 获取段落批注
     */
    getParagraphAnnotations(paraId) {
        return this.annotations.get(paraId) || [];
    }

    /**
     * 按类型筛选
     */
    filterByType(type) {
        return this.getAll().filter(a => a.type === type);
    }

    /**
     * 按状态筛选
     */
    filterByStatus(status) {
        return this.getAll().filter(a => a.status === status);
    }

    /**
     * 更新统计
     */
    updateStats() {
        const all = this.getAll();
        this.stats = {
            total: all.length,
            accepted: all.filter(a => a.status === 'accepted').length,
            rejected: all.filter(a => a.status === 'rejected').length,
            pending: all.filter(a => a.status === 'pending').length
        };
    }

    /**
     * 获取统计
     */
    getStats() {
        return this.stats;
    }

    /**
     * 获取类型分布
     */
    getTypeDistribution() {
        const dist = {};
        const all = this.getAll();

        for (const anno of all) {
            if (!dist[anno.type]) {
                dist[anno.type] = { total: 0, accepted: 0, rejected: 0, pending: 0 };
            }
            dist[anno.type].total++;
            dist[anno.type][anno.status]++;
        }

        return dist;
    }

    /**
     * 全部接受
     */
    acceptAll() {
        const pending = this.filterByStatus('pending');
        pending.forEach(a => this.accept(a.id));
        return pending.length;
    }

    /**
     * 全部拒绝
     */
    rejectAll() {
        const pending = this.filterByStatus('pending');
        pending.forEach(a => this.reject(a.id));
        return pending.length;
    }

    /**
     * 清空所有
     */
    clear() {
        this.annotations.clear();
        this.stats = {
            total: 0,
            accepted: 0,
            rejected: 0,
            pending: 0
        };
    }

    /**
     * 保存到 JSON
     */
    toJSON() {
        const data = {};
        for (const [key, value] of this.annotations) {
            data[key] = value;
        }
        return {
            annotations: data,
            stats: this.stats,
            exportTime: new Date().toISOString()
        };
    }

    /**
     * 从 JSON 加载
     */
    fromJSON(data) {
        this.clear();
        if (data.annotations) {
            for (const [paraId, annos] of Object.entries(data.annotations)) {
                this.annotations.set(paraId, annos);
            }
        }
        this.updateStats();
    }

    /**
     * 计算平均置信度
     */
    getAverageConfidence() {
        const all = this.getAll();
        if (all.length === 0) return 0;
        const sum = all.reduce((s, a) => s + a.confidence, 0);
        return Math.round((sum / all.length) * 100);
    }

    /**
     * 获取最高置信度的批注
     */
    getTopAnnotations(limit = 10) {
        return this.getAll()
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, limit);
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnnotationManager;
}
