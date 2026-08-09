// 编辑器核心逻辑 - 五步创作流程
// ① 语病检查 → ② 结构分析 → ③ 分支创作 → ④ 选择定稿 → ⑤ 读者反馈

class NovelEditor {
    constructor() {
        this.originalText = '';
        this.annotations = new AnnotationManager();
        this.api = null;
        this.currentStep = 1;
        this.selectedAnnotationId = null;

        // 各步骤产出的数据
        this.lineEditedText = '';       // 第①步应用批注后的文本
        this.structuralAnalysis = null; // 第②步结果
        this.branches = [];             // 第③步结果
        this.finalDraft = '';           // 第④步选定的终稿
        this.readerFeedback = [];       // 第⑤步结果
        this.readerSynthesis = null;    // 第⑤步的汇总

        FileParser.init();
        this.initializeDOM();
        this.attachEventListeners();
        this.loadFromStorage();
        this.renderStep();
    }

    /**
     * 初始化 DOM 元素
     */
    initializeDOM() {
        this.elements = {
            fileInput: document.getElementById('fileInput'),
            uploadArea: document.getElementById('uploadArea'),
            originalTextInput: document.getElementById('originalTextInput'),
            styleTextInput: document.getElementById('styleTextInput'),
            styleUploadBtn: document.getElementById('styleUploadBtn'),
            styleFileInput: document.getElementById('styleFileInput'),
            authorStyleInput: document.getElementById('authorStyleInput'),

            apiKeyInput: document.getElementById('apiKeyInput'),
            saveApiKeyCheckbox: document.getElementById('saveApiKeyCheckbox'),
            modelSelect: document.getElementById('modelSelect'),

            charCount: document.getElementById('charCount'),
            paraCount: document.getElementById('paraCount'),

            startBtn: document.getElementById('startBtn'),
            saveBtn: document.getElementById('saveBtn'),
            exportBtn: document.getElementById('exportBtn'),
            resetBtn: document.getElementById('resetBtn'),

            stepIndicator: document.getElementById('stepIndicator'),
            stepPanels: document.querySelectorAll('.step-panel'),

            // 第①步
            step1Status: document.getElementById('step1Status'),
            editorContent: document.getElementById('editorContent'),
            annotationList: document.getElementById('annotationList'),
            acceptAllBtn: document.getElementById('acceptAllBtn'),
            rejectAllBtn: document.getElementById('rejectAllBtn'),
            toStep2Btn: document.getElementById('toStep2Btn'),

            // 第②步
            structureContent: document.getElementById('structureContent'),
            toStep3Btn: document.getElementById('toStep3Btn'),

            // 第③步
            branchesContent: document.getElementById('branchesContent'),
            toStep4Btn: document.getElementById('toStep4Btn'),

            // 第④步
            finalizeContent: document.getElementById('finalizeContent'),
            toStep5Btn: document.getElementById('toStep5Btn'),

            // 第⑤步
            readersContent: document.getElementById('readersContent'),
            finishBtn: document.getElementById('finishBtn'),

            // 模态
            annotationModal: document.getElementById('annotationModal'),
            modalCloseBtn: document.getElementById('modalCloseBtn'),
            modalAcceptBtn: document.getElementById('modalAcceptBtn'),
            modalRejectBtn: document.getElementById('modalRejectBtn')
        };
    }

    /**
     * 绑定事件监听
     */
    attachEventListeners() {
        // 文件上传
        this.elements.uploadArea.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.elements.uploadArea.style.borderColor = 'var(--primary-light)';
        });
        this.elements.uploadArea.addEventListener('dragleave', () => {
            this.elements.uploadArea.style.borderColor = 'var(--border)';
        });
        this.elements.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.elements.uploadArea.style.borderColor = 'var(--border)';
            if (e.dataTransfer.files.length) {
                this.handleFileUpload(e.dataTransfer.files[0]);
            }
        });

        this.elements.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) {
                this.handleFileUpload(e.target.files[0]);
            }
        });

        // 风格范文上传
        this.elements.styleUploadBtn.addEventListener('click', () => this.elements.styleFileInput.click());
        this.elements.styleFileInput.addEventListener('change', (e) => {
            if (e.target.files.length) {
                this.handleStyleFileUpload(e.target.files[0]);
            }
        });

        // 文本输入统计
        this.elements.originalTextInput.addEventListener('input', () => this.updateCharAndParaCount());

        // 主按钮
        this.elements.startBtn.addEventListener('click', () => this.startWorkflow());
        this.elements.saveBtn.addEventListener('click', () => this.saveToStorage());
        this.elements.exportBtn.addEventListener('click', () => this.exportDocument());
        this.elements.resetBtn.addEventListener('click', () => this.reset());

        // 第①步
        this.elements.acceptAllBtn.addEventListener('click', () => this.acceptAllAnnotations());
        this.elements.rejectAllBtn.addEventListener('click', () => this.rejectAllAnnotations());
        this.elements.toStep2Btn.addEventListener('click', () => this.runStep2());

        // 第②③④⑤步
        this.elements.toStep3Btn.addEventListener('click', () => this.runStep3());
        this.elements.toStep4Btn.addEventListener('click', () => this.goToStep4());
        this.elements.toStep5Btn.addEventListener('click', () => this.runStep5());
        this.elements.finishBtn.addEventListener('click', () => this.exportDocument());

        // 模态框
        this.elements.modalCloseBtn.addEventListener('click', () => UIRenderer.hideModal(this.elements.annotationModal));
        this.elements.annotationModal.addEventListener('click', (e) => {
            if (e.target === this.elements.annotationModal) UIRenderer.hideModal(this.elements.annotationModal);
        });
        this.elements.modalAcceptBtn.addEventListener('click', () => {
            if (this.selectedAnnotationId) {
                this.annotations.accept(this.selectedAnnotationId);
                this.renderAnnotations();
                UIRenderer.hideModal(this.elements.annotationModal);
            }
        });
        this.elements.modalRejectBtn.addEventListener('click', () => {
            if (this.selectedAnnotationId) {
                this.annotations.reject(this.selectedAnnotationId);
                this.renderAnnotations();
                UIRenderer.hideModal(this.elements.annotationModal);
            }
        });

        // 快捷键
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveToStorage();
            }
        });
    }

    /**
     * 处理原文文件上传
     */
    async handleFileUpload(file) {
        try {
            UIRenderer.showNotification(`正在解析 ${file.name}...`, 'info');
            const fileData = await TextProcessor.parseFile(file);
            this.elements.originalTextInput.value = fileData.content;
            this.updateCharAndParaCount();
            UIRenderer.showNotification(`已加载 ${file.name}`, 'success');
        } catch (error) {
            console.error('File upload error:', error);
            UIRenderer.showNotification(error.message, 'error');
        }
    }

    /**
     * 处理风格范文上传
     */
    async handleStyleFileUpload(file) {
        try {
            UIRenderer.showNotification(`正在解析 ${file.name}...`, 'info');
            const fileData = await TextProcessor.parseFile(file);
            this.elements.styleTextInput.value = fileData.content;
            UIRenderer.showNotification(`已加载风格范文 ${file.name}`, 'success');
        } catch (error) {
            console.error('Style file upload error:', error);
            UIRenderer.showNotification(error.message, 'error');
        }
    }

    /**
     * 更新字数段数统计
     */
    updateCharAndParaCount() {
        const text = this.elements.originalTextInput.value;
        UIRenderer.updateCharCount(this.elements.charCount, text);
        UIRenderer.updateParaCount(this.elements.paraCount, text);
    }

    /**
     * 校验并初始化 API 客户端
     */
    prepareApi() {
        const apiKey = this.elements.apiKeyInput.value.trim();
        if (!apiKey) {
            UIRenderer.showNotification('请输入 DeepSeek API Key', 'error');
            return false;
        }

        this.api = new DeepSeekApiClient(apiKey, this.elements.modelSelect.value);
        if (!this.api.isValidApiKey()) {
            UIRenderer.showNotification('API Key 格式无效', 'error');
            return false;
        }

        if (this.elements.saveApiKeyCheckbox.checked) {
            saveToStorage('apiKey', apiKey);
        }

        return true;
    }

    /**
     * 开始创作流程（第①步）
     */
    async startWorkflow() {
        const text = this.elements.originalTextInput.value.trim();
        if (!text) {
            UIRenderer.showNotification('请先输入或上传初稿', 'error');
            return;
        }

        if (!this.prepareApi()) return;

        this.originalText = text;
        this.currentStep = 1;
        this.renderStep();

        await this.runStep1();
    }

    /**
     * 第①步：语病 / 句子 / 用词检查
     */
    async runStep1() {
        const styleRef = this.elements.styleTextInput.value.trim();

        UIRenderer.showLoading(true, '正在检查语病、句子通顺度和用词...');
        this.elements.step1Status.textContent = '分析中...';
        this.elements.toStep2Btn.disabled = true;

        try {
            const result = await this.api.runLineEdit(this.originalText, styleRef);

            this.annotations.clear();
            this.annotations.addBatch(result.annotations || []);

            this.renderAnnotations();
            this.elements.step1Status.textContent = `完成，共 ${result.annotations.length} 条建议`;
            this.elements.toStep2Btn.disabled = false;

            UIRenderer.showNotification(`语病检查完成，共 ${result.annotations.length} 条建议`, 'success');
        } catch (error) {
            console.error('Step1 error:', error);
            this.elements.step1Status.textContent = '出错了';
            UIRenderer.showNotification(`错误: ${error.message}`, 'error');
        } finally {
            UIRenderer.showLoading(false);
        }
    }

    /**
     * 渲染第①步批注
     */
    renderAnnotations() {
        const annotations = this.annotations.getAll();

        UIRenderer.renderAnnotationList(
            this.elements.annotationList,
            annotations,
            (action, id) => {
                if (action === 'accept') this.annotations.accept(id);
                else if (action === 'reject') this.annotations.reject(id);
                this.renderAnnotations();
            }
        );

        UIRenderer.renderEditorText(this.elements.editorContent, this.originalText, annotations);
    }

    /**
     * 显示批注模态框
     */
    showAnnotationModal(id) {
        const anno = this.annotations.get(id);
        if (!anno) return;
        this.selectedAnnotationId = id;
        UIRenderer.showAnnotationModal(this.elements.annotationModal, anno);
    }

    acceptAllAnnotations() {
        const count = this.annotations.acceptAll();
        this.renderAnnotations();
        UIRenderer.showNotification(`已接受 ${count} 项修改`, 'success');
    }

    rejectAllAnnotations() {
        const count = this.annotations.rejectAll();
        this.renderAnnotations();
        UIRenderer.showNotification(`已拒绝 ${count} 项修改`, 'info');
    }

    /**
     * 第②步：结构分析
     */
    async runStep2() {
        // 应用第①步已接受的修改
        const accepted = this.annotations.filterByStatus('accepted');
        this.lineEditedText = TextProcessor.applyAnnotations(this.originalText, accepted);

        this.currentStep = 2;
        this.renderStep();

        const authorStyle = this.elements.authorStyleInput.value.trim();

        UIRenderer.showLoading(true, '正在分析结构和行文脉络...');
        this.elements.toStep3Btn.disabled = true;

        try {
            this.structuralAnalysis = await this.api.analyzeStructure(this.lineEditedText, authorStyle);
            WizardRenderer.renderStructure(this.elements.structureContent, this.structuralAnalysis);
            this.elements.toStep3Btn.disabled = false;
            UIRenderer.showNotification('结构分析完成', 'success');
        } catch (error) {
            console.error('Step2 error:', error);
            UIRenderer.showNotification(`错误: ${error.message}`, 'error');
        } finally {
            UIRenderer.showLoading(false);
        }
    }

    /**
     * 第③步：生成分支版本
     */
    async runStep3() {
        this.currentStep = 3;
        this.renderStep();

        const authorStyle = this.elements.authorStyleInput.value.trim();

        UIRenderer.showLoading(true, '正在创作 3 个不同结局方向的版本，这可能需要 1-2 分钟...');
        this.elements.toStep4Btn.disabled = true;

        try {
            this.branches = await this.api.generateBranches(this.lineEditedText, this.structuralAnalysis, authorStyle, 3);
            WizardRenderer.renderBranches(this.elements.branchesContent, this.branches);
            this.elements.toStep4Btn.disabled = false;
            UIRenderer.showNotification(`已生成 ${this.branches.length} 个分支版本`, 'success');
        } catch (error) {
            console.error('Step3 error:', error);
            UIRenderer.showNotification(`错误: ${error.message}`, 'error');
        } finally {
            UIRenderer.showLoading(false);
        }
    }

    /**
     * 第④步：选择定稿
     */
    goToStep4() {
        this.currentStep = 4;
        this.renderStep();

        this.finalDraft = this.lineEditedText;
        this.elements.toStep5Btn.disabled = false;

        WizardRenderer.renderFinalizeOptions(
            this.elements.finalizeContent,
            this.lineEditedText,
            this.branches,
            0,
            (index, fullText) => {
                this.finalDraft = fullText;
            }
        );
    }

    /**
     * 第⑤步：5位读者反馈
     */
    async runStep5() {
        this.currentStep = 5;
        this.renderStep();

        UIRenderer.showLoading(true, '5位读者正在阅读你的终稿...');
        this.elements.finishBtn.disabled = true;

        try {
            const result = await this.api.getReaderFeedback(this.finalDraft);
            this.readerFeedback = result.readers;
            this.readerSynthesis = result.synthesis;
            WizardRenderer.renderReaders(this.elements.readersContent, this.readerFeedback, this.readerSynthesis);
            UIRenderer.showNotification('读者反馈已生成', 'success');
        } catch (error) {
            console.error('Step5 error:', error);
            UIRenderer.showNotification(`错误: ${error.message}`, 'error');
        } finally {
            UIRenderer.showLoading(false);
            this.elements.finishBtn.disabled = false;
        }
    }

    /**
     * 渲染当前步骤（切换面板显隐 + 步骤指示器状态）
     */
    renderStep() {
        this.elements.stepPanels.forEach(panel => {
            panel.classList.toggle('active', panel.id === `step${this.currentStep}Panel`);
        });

        this.elements.stepIndicator.querySelectorAll('.step-item').forEach(item => {
            const step = parseInt(item.dataset.step, 10);
            item.classList.toggle('active', step === this.currentStep);
            item.classList.toggle('done', step < this.currentStep);
        });
    }

    /**
     * 导出最终文档
     */
    exportDocument() {
        const content = this.finalDraft || this.lineEditedText || this.originalText;
        if (!content) {
            UIRenderer.showNotification('没有可导出的内容', 'error');
            return;
        }

        let exportText = content;
        if (this.readerFeedback && this.readerFeedback.length > 0) {
            exportText += '\n\n' + '='.repeat(20) + ' 5位读者反馈 ' + '='.repeat(20) + '\n\n';
            this.readerFeedback.forEach(r => {
                exportText += `【${r.persona}】\n阅读体验：${r.reading_experience}\n修改建议：${r.suggestions}\n\n`;
            });
            if (this.readerSynthesis) {
                const sy = this.readerSynthesis;
                exportText += `【汇总】\n多人共同提到：${sy.shared_problems}\n`;
                exportText += `单一视角的偏好：${sy.single_view_preferences}\n`;
                exportText += `对立意见（取舍点）：${sy.conflicts}\n`;
            }
        }

        exportAsText(exportText, '小说终稿.txt');
        UIRenderer.showNotification('已导出文档', 'success');
    }

    /**
     * 保存进度
     */
    saveToStorage() {
        const data = {
            originalText: this.elements.originalTextInput.value,
            styleText: this.elements.styleTextInput.value,
            authorStyle: this.elements.authorStyleInput.value,
            saveTime: new Date().toISOString()
        };
        saveToStorage('editorState', data);
        UIRenderer.showNotification('已保存进度', 'success');
    }

    /**
     * 加载进度
     */
    loadFromStorage() {
        const apiKey = getFromStorage('apiKey');
        if (apiKey && isValidApiKey(apiKey)) {
            this.elements.apiKeyInput.value = apiKey;
            this.elements.saveApiKeyCheckbox.checked = true;
        }

        const state = getFromStorage('editorState');
        if (state) {
            this.elements.originalTextInput.value = state.originalText || '';
            this.elements.styleTextInput.value = state.styleText || '';
            if (state.authorStyle) this.elements.authorStyleInput.value = state.authorStyle;
            this.updateCharAndParaCount();
        }
    }

    /**
     * 重新开始
     */
    reset() {
        if (!confirm('确定要清空所有内容，重新开始吗？')) return;

        this.elements.originalTextInput.value = '';
        this.elements.styleTextInput.value = '';
        this.annotations.clear();
        this.originalText = '';
        this.lineEditedText = '';
        this.structuralAnalysis = null;
        this.branches = [];
        this.finalDraft = '';
        this.readerFeedback = [];
        this.currentStep = 1;

        this.renderAnnotations();
        this.updateCharAndParaCount();
        this.renderStep();
        UIRenderer.showNotification('已重置', 'info');
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    window.editor = new NovelEditor();
});
