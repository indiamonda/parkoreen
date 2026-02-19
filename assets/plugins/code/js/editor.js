/**
 * Code Plugin - Editor UI
 * Full-page code editor dashboard for managing triggers and actions
 */

(function() {
    'use strict';
    
    const pluginId = 'code';
    
    // Editor state
    let codeEditorOverlay = null;
    let currentView = 'dashboard'; // 'dashboard', 'editTrigger', 'editAction'
    let editingBlock = null;
    let hasUnsavedChanges = false;
    let keyCapturingElement = null; // For "Other" key capture
    
    // Get world reference safely
    const getWorld = () => typeof world !== 'undefined' ? world : null;
    
    // Get world's code data
    const getCodeData = () => {
        const w = getWorld();
        if (w) {
            if (!w.codeData) {
                w.codeData = { triggers: [], actions: [] };
            }
            return w.codeData;
        }
        return { triggers: [], actions: [] };
    };
    
    // Save code data to world and notify editor
    const saveCodeData = (data) => {
        const w = getWorld();
        if (w) {
            w.codeData = data;
            // Notify main editor of changes
            if (typeof editor !== 'undefined' && editor.triggerMapChange) {
                editor.triggerMapChange();
            }
        }
        hasUnsavedChanges = false;
    };
    
    // Mark as having unsaved changes
    const markUnsaved = () => {
        hasUnsavedChanges = true;
        if (typeof CODE_STATE !== 'undefined') {
            CODE_STATE.hasUnsavedChanges = true;
        }
    };
    
    // Generate unique ID
    const generateId = () => {
        return 'code_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
    };
    
    // Validate block name
    const isValidName = (name) => {
        if (!name || name.trim() === '') return false;
        const lowerName = name.toLowerCase().trim();
        return !CODE_RESERVED_NAMES.includes(lowerName);
    };
    
    // Get all zones from world
    const getZones = () => {
        const w = getWorld();
        if (w && w.objects) {
            return w.objects
                .filter(obj => obj.appearanceType === 'zone' && obj.zoneName)
                .map(obj => ({ id: obj.id, name: obj.zoneName }))
                .sort((a, b) => a.name.localeCompare(b.name));
        }
        return [];
    };
    
    // Show toast notification
    const showToast = (message, type = 'info') => {
        const existing = document.querySelector('.code-toast');
        if (existing) existing.remove();
        
        const toast = document.createElement('div');
        toast.className = `code-toast code-toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('visible'), 10);
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };
    
    // Show confirmation dialog
    const showConfirm = (title, message) => {
        return new Promise((resolve) => {
            const dialog = document.createElement('div');
            dialog.className = 'code-dialog-overlay';
            dialog.innerHTML = `
                <div class="code-dialog">
                    <h2>${escapeHtml(title)}</h2>
                    <p style="color: var(--text-muted); margin-bottom: 20px;">${escapeHtml(message)}</p>
                    <div class="code-dialog-actions">
                        <button class="btn btn-secondary" id="confirm-cancel">Cancel</button>
                        <button class="btn btn-danger" id="confirm-ok">Confirm</button>
                    </div>
                </div>
            `;
            document.body.appendChild(dialog);
            
            dialog.querySelector('#confirm-cancel').addEventListener('click', () => {
                dialog.remove();
                resolve(false);
            });
            
            dialog.querySelector('#confirm-ok').addEventListener('click', () => {
                dialog.remove();
                resolve(true);
            });
            
            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) {
                    dialog.remove();
                    resolve(false);
                }
            });
        });
    };
    
    // Create the Code Editor overlay
    const createCodeEditorOverlay = () => {
        if (codeEditorOverlay) return codeEditorOverlay;
        
        codeEditorOverlay = document.createElement('div');
        codeEditorOverlay.id = 'code-editor-overlay';
        codeEditorOverlay.className = 'code-editor-overlay';
        codeEditorOverlay.innerHTML = `
            <div class="code-editor-container">
                <div class="code-editor-header">
                    <button class="btn btn-icon btn-ghost code-back-btn" id="code-editor-back" title="Back (Escape)">
                        <span class="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h1 class="code-editor-title">
                        <span class="material-symbols-outlined">code</span>
                        Code Editor
                        <span class="code-beta-badge">BETA</span>
                    </h1>
                    <button class="btn btn-primary code-new-btn" id="code-new-block">
                        <span class="material-symbols-outlined">add</span>
                        New Code
                    </button>
                </div>
                <div class="code-editor-content" id="code-editor-content">
                    <!-- Content rendered dynamically -->
                </div>
            </div>
        `;
        
        // Add styles
        addCodeEditorStyles();
        
        document.body.appendChild(codeEditorOverlay);
        
        // Event listeners
        document.getElementById('code-editor-back').addEventListener('click', handleBackButton);
        document.getElementById('code-new-block').addEventListener('click', showNewBlockDialog);
        
        // Keyboard shortcuts
        codeEditorOverlay.addEventListener('keydown', handleKeyDown);
        
        return codeEditorOverlay;
    };
    
    // Handle back button
    const handleBackButton = async () => {
        if (currentView === 'dashboard') {
            if (hasUnsavedChanges) {
                const confirmed = await showConfirm('Unsaved Changes', 'You have unsaved changes. Are you sure you want to close?');
                if (!confirmed) return;
            }
            closeCodeEditor();
        } else {
            showDashboard();
        }
    };
    
    // Handle keyboard shortcuts
    const handleKeyDown = (e) => {
        // Escape to go back/close
        if (e.key === 'Escape') {
            e.preventDefault();
            handleBackButton();
        }
        
        // Ctrl/Cmd + S to save (when editing)
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (currentView === 'editTrigger') {
                saveTrigger();
            } else if (currentView === 'editAction') {
                // Save action when implemented
            }
        }
    };
    
    // Add CSS styles for the code editor
    const addCodeEditorStyles = () => {
        if (document.getElementById('code-editor-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'code-editor-styles';
        style.textContent = `
            .code-editor-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: var(--bg-dark, #0a0a0f);
                z-index: 10000;
                display: none;
                overflow: hidden;
            }
            
            .code-editor-overlay.active {
                display: flex;
            }
            
            .code-editor-container {
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                padding: 20px;
                box-sizing: border-box;
            }
            
            .code-editor-header {
                display: flex;
                align-items: center;
                gap: 16px;
                padding-bottom: 20px;
                border-bottom: 1px solid var(--surface-light, #2a2a3a);
                margin-bottom: 20px;
            }
            
            .code-editor-title {
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 24px;
                font-weight: 600;
                color: #fff;
                margin: 0;
                flex: 1;
            }
            
            .code-editor-title .material-symbols-outlined {
                font-size: 28px;
                color: #3b82f6;
            }
            
            .code-beta-badge {
                font-size: 10px;
                font-weight: 700;
                background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
                color: white;
                padding: 3px 8px;
                border-radius: 4px;
                letter-spacing: 0.5px;
            }
            
            .code-editor-content {
                flex: 1;
                overflow-y: auto;
                padding-right: 10px;
            }
            
            /* Scrollbar styling */
            .code-editor-content::-webkit-scrollbar {
                width: 8px;
            }
            .code-editor-content::-webkit-scrollbar-track {
                background: transparent;
            }
            .code-editor-content::-webkit-scrollbar-thumb {
                background: var(--surface-light, #2a2a3a);
                border-radius: 4px;
            }
            
            /* Block Cards */
            .code-blocks-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                gap: 16px;
            }
            
            .code-block-card {
                background: var(--bg-light, #1a1a2e);
                border-radius: 12px;
                padding: 16px;
                position: relative;
                transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
                border: 1px solid transparent;
            }
            
            .code-block-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(0,0,0,0.3);
                border-color: var(--surface-light, #2a2a3a);
            }
            
            .code-block-card.disabled {
                opacity: 0.5;
            }
            
            .code-block-card.has-error {
                border-color: #ef4444;
            }
            
            .code-block-header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 12px;
            }
            
            .code-block-icon {
                width: 44px;
                height: 44px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            
            .code-block-icon.trigger {
                background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
            }
            
            .code-block-icon.action {
                background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
            }
            
            .code-block-icon .material-symbols-outlined {
                font-size: 24px;
                color: white;
            }
            
            .code-block-name {
                flex: 1;
                min-width: 0;
            }
            
            .code-block-name input {
                background: transparent;
                border: none;
                border-bottom: 1px solid transparent;
                color: #fff;
                font-size: 16px;
                font-weight: 600;
                width: 100%;
                outline: none;
                padding: 4px 0;
                transition: border-color 0.2s;
            }
            
            .code-block-name input:hover {
                border-bottom-color: var(--surface-light, #2a2a3a);
            }
            
            .code-block-name input:focus {
                border-bottom-color: #3b82f6;
            }
            
            .code-block-type {
                font-size: 13px;
                color: var(--text-muted, #888);
                margin-bottom: 12px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .code-block-type.error {
                color: #ef4444;
            }
            
            .code-block-actions {
                display: flex;
                gap: 8px;
                padding-top: 12px;
                border-top: 1px solid var(--surface-light, #2a2a3a);
            }
            
            .code-block-actions .btn {
                flex: 1;
                font-size: 12px;
                padding: 8px 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
            }
            
            .code-block-actions .btn .material-symbols-outlined {
                font-size: 16px;
            }
            
            .code-block-actions .btn-icon-only {
                flex: 0 0 auto;
                padding: 8px;
            }
            
            /* Empty State */
            .code-empty-state {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 60vh;
                color: var(--text-muted, #888);
                text-align: center;
            }
            
            .code-empty-state .material-symbols-outlined {
                font-size: 72px;
                margin-bottom: 16px;
                opacity: 0.4;
            }
            
            .code-empty-state p {
                font-size: 16px;
                margin: 0 0 8px 0;
            }
            
            .code-empty-state small {
                font-size: 13px;
                opacity: 0.7;
            }
            
            /* Dialog */
            .code-dialog-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10001;
                animation: fadeIn 0.15s ease;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .code-dialog {
                background: var(--bg-light, #1a1a2e);
                border-radius: 16px;
                padding: 24px;
                width: 420px;
                max-width: 90vw;
                animation: slideUp 0.2s ease;
            }
            
            @keyframes slideUp {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            
            .code-dialog h2 {
                margin: 0 0 20px 0;
                font-size: 20px;
                color: #fff;
            }
            
            .code-dialog-types {
                display: flex;
                gap: 12px;
                margin-bottom: 20px;
            }
            
            .code-type-btn {
                flex: 1;
                padding: 20px 16px;
                border-radius: 12px;
                border: 2px solid var(--surface-light, #2a2a3a);
                background: transparent;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
            }
            
            .code-type-btn:hover {
                border-color: #3b82f6;
                background: rgba(59, 130, 246, 0.05);
            }
            
            .code-type-btn.selected {
                border-color: #3b82f6;
                background: rgba(59, 130, 246, 0.1);
            }
            
            .code-type-btn .material-symbols-outlined {
                font-size: 32px;
                color: #fff;
            }
            
            .code-type-btn span:last-child {
                font-size: 14px;
                color: #fff;
                font-weight: 500;
            }
            
            .code-dialog .form-group {
                margin-bottom: 16px;
            }
            
            .code-dialog .form-label {
                display: block;
                font-size: 13px;
                color: var(--text-muted, #888);
                margin-bottom: 6px;
            }
            
            .code-dialog .form-input {
                width: 100%;
                padding: 12px 14px;
                border-radius: 8px;
                border: 1px solid var(--surface-light, #2a2a3a);
                background: var(--bg-dark, #0a0a0f);
                color: #fff;
                font-size: 14px;
                outline: none;
                box-sizing: border-box;
                transition: border-color 0.2s;
            }
            
            .code-dialog .form-input:focus {
                border-color: #3b82f6;
            }
            
            .code-dialog .form-input.error {
                border-color: #ef4444;
            }
            
            .code-dialog-actions {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
                margin-top: 24px;
            }
            
            /* Trigger Editor */
            .trigger-editor {
                max-width: 640px;
                margin: 0 auto;
            }
            
            .trigger-form-group {
                margin-bottom: 24px;
            }
            
            .trigger-form-label {
                display: block;
                font-size: 14px;
                font-weight: 500;
                color: #fff;
                margin-bottom: 8px;
            }
            
            .trigger-form-sublabel {
                font-size: 12px;
                color: var(--text-muted, #888);
                font-weight: normal;
                margin-left: 8px;
            }
            
            .trigger-form-select,
            .trigger-form-input {
                width: 100%;
                padding: 12px 14px;
                border-radius: 8px;
                border: 1px solid var(--surface-light, #2a2a3a);
                background: var(--bg-light, #1a1a2e);
                color: #fff;
                font-size: 14px;
                outline: none;
                box-sizing: border-box;
                transition: border-color 0.2s;
            }
            
            .trigger-form-select:focus,
            .trigger-form-input:focus {
                border-color: #3b82f6;
            }
            
            .trigger-form-select option {
                background: var(--bg-light, #1a1a2e);
            }
            
            .trigger-keys-container {
                margin-top: 12px;
            }
            
            .trigger-keys-add {
                display: flex;
                gap: 8px;
                margin-bottom: 12px;
            }
            
            .trigger-keys-add select {
                flex: 1;
            }
            
            .trigger-keys-list {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                min-height: 40px;
                padding: 12px;
                background: var(--bg-dark, #0a0a0f);
                border-radius: 8px;
                border: 1px dashed var(--surface-light, #2a2a3a);
            }
            
            .trigger-keys-list:empty::before {
                content: 'No keys selected';
                color: var(--text-muted, #666);
                font-size: 13px;
            }
            
            .trigger-key-tag {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 6px 10px;
                background: rgba(59, 130, 246, 0.15);
                border: 1px solid rgba(59, 130, 246, 0.3);
                border-radius: 6px;
                font-size: 13px;
                color: #60a5fa;
            }
            
            .trigger-key-tag button {
                background: none;
                border: none;
                color: #60a5fa;
                cursor: pointer;
                padding: 0;
                display: flex;
                opacity: 0.7;
                transition: opacity 0.2s;
            }
            
            .trigger-key-tag button:hover {
                opacity: 1;
            }
            
            .trigger-save-btn {
                margin-top: 32px;
            }
            
            .trigger-description {
                font-size: 12px;
                color: var(--text-muted, #888);
                margin-top: 6px;
                line-height: 1.5;
            }
            
            .trigger-description.error {
                color: #ef4444;
            }
            
            /* Section dividers */
            .code-section {
                margin-bottom: 32px;
            }
            
            .code-section-title {
                font-size: 12px;
                font-weight: 600;
                color: var(--text-muted, #666);
                margin-bottom: 16px;
                text-transform: uppercase;
                letter-spacing: 1.5px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .code-section-title::after {
                content: '';
                flex: 1;
                height: 1px;
                background: var(--surface-light, #2a2a3a);
            }
            
            /* Toast notification */
            .code-toast {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%) translateY(-20px);
                padding: 12px 24px;
                border-radius: 8px;
                color: #fff;
                font-size: 14px;
                font-weight: 500;
                z-index: 10002;
                opacity: 0;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            
            .code-toast.visible {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
            
            .code-toast-info {
                background: #3b82f6;
            }
            
            .code-toast-success {
                background: #22c55e;
            }
            
            .code-toast-error {
                background: #ef4444;
            }
            
            .code-toast-warning {
                background: #f59e0b;
            }
            
            /* Key capture overlay */
            .key-capture-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10003;
            }
            
            .key-capture-dialog {
                background: var(--bg-light, #1a1a2e);
                padding: 32px;
                border-radius: 16px;
                text-align: center;
            }
            
            .key-capture-dialog h3 {
                margin: 0 0 8px 0;
                color: #fff;
                font-size: 18px;
            }
            
            .key-capture-dialog p {
                margin: 0;
                color: var(--text-muted, #888);
                font-size: 14px;
            }
        `;
        document.head.appendChild(style);
    };
    
    // Show dashboard view
    const showDashboard = () => {
        currentView = 'dashboard';
        editingBlock = null;
        
        const content = document.getElementById('code-editor-content');
        if (!content) return;
        
        const codeData = getCodeData();
        const triggers = codeData.triggers || [];
        const actions = codeData.actions || [];
        const allBlocks = [...triggers, ...actions];
        
        // Update header
        const backBtn = document.getElementById('code-editor-back');
        if (backBtn) {
            backBtn.querySelector('.material-symbols-outlined').textContent = 'close';
            backBtn.title = 'Close (Escape)';
        }
        
        const title = document.querySelector('.code-editor-title');
        if (title) {
            title.innerHTML = `
                <span class="material-symbols-outlined">code</span>
                Code Editor
                <span class="code-beta-badge">BETA</span>
            `;
        }
        
        const newBtn = document.getElementById('code-new-block');
        if (newBtn) newBtn.style.display = '';
        
        if (allBlocks.length === 0) {
            content.innerHTML = `
                <div class="code-empty-state">
                    <span class="material-symbols-outlined">code_off</span>
                    <p>No code blocks yet</p>
                    <small>Click "New Code" to create your first trigger or action</small>
                </div>
            `;
            return;
        }
        
        let html = '';
        
        if (triggers.length > 0) {
            html += `
                <div class="code-section">
                    <div class="code-section-title">Triggers (${triggers.length})</div>
                    <div class="code-blocks-grid">
                        ${triggers.map(t => renderBlockCard(t)).join('')}
                    </div>
                </div>
            `;
        }
        
        if (actions.length > 0) {
            html += `
                <div class="code-section">
                    <div class="code-section-title">Actions (${actions.length})</div>
                    <div class="code-blocks-grid">
                        ${actions.map(a => renderBlockCard(a)).join('')}
                    </div>
                </div>
            `;
        }
        
        content.innerHTML = html;
        attachBlockCardListeners();
    };
    
    // Check if trigger has configuration errors
    const getTriggerError = (trigger) => {
        if (!trigger || trigger.type !== CODE_BLOCK_TYPES.TRIGGER) return null;
        
        const config = trigger.config || {};
        const zones = getZones();
        
        switch (trigger.triggerType) {
            case CODE_TRIGGER_TYPES.PLAYER_ENTER_ZONE:
            case CODE_TRIGGER_TYPES.PLAYER_LEAVE_ZONE:
                if (!config.zoneName) return 'No zone selected';
                if (!zones.find(z => z.name === config.zoneName)) {
                    return `Zone "${config.zoneName}" not found`;
                }
                break;
            case CODE_TRIGGER_TYPES.PLAYER_KEY_INPUT:
                if (!config.keys || config.keys.length === 0) {
                    return 'No keys configured';
                }
                break;
        }
        return null;
    };
    
    // Render a single block card
    const renderBlockCard = (block) => {
        const isTrigger = block.type === CODE_BLOCK_TYPES.TRIGGER;
        const icon = isTrigger ? 'frame_inspect' : 'code_blocks';
        const iconClass = isTrigger ? 'trigger' : 'action';
        
        const error = isTrigger ? getTriggerError(block) : null;
        
        let typeDescription = '';
        if (isTrigger) {
            const triggerInfo = CODE_TRIGGER_TYPE_INFO.find(t => t.id === block.triggerType);
            
            switch (block.triggerType) {
                case CODE_TRIGGER_TYPES.GAME_STARTS:
                    typeDescription = 'When game starts';
                    break;
                case CODE_TRIGGER_TYPES.PLAYER_ENTER_ZONE:
                    typeDescription = error ? `⚠ ${error}` : `When player enters "${block.config?.zoneName}"`;
                    break;
                case CODE_TRIGGER_TYPES.PLAYER_LEAVE_ZONE:
                    typeDescription = error ? `⚠ ${error}` : `When player leaves "${block.config?.zoneName}"`;
                    break;
                case CODE_TRIGGER_TYPES.PLAYER_KEY_INPUT:
                    if (error) {
                        typeDescription = `⚠ ${error}`;
                    } else {
                        const keyLabels = (block.config?.keys || []).map(k => {
                            const keyObj = CODE_KEYBOARD_KEYS.find(kk => kk.id === k);
                            return keyObj?.label || k;
                        });
                        typeDescription = `Keys: ${keyLabels.join(' + ')}`;
                    }
                    break;
                case CODE_TRIGGER_TYPES.REPEAT:
                    const unit = block.config?.unit || 'seconds';
                    const interval = block.config?.interval || 1;
                    const unitInfo = CODE_TIME_UNITS.find(u => u.id === unit);
                    const unitLabel = interval === 1 ? unitInfo?.labelSingular : unitInfo?.label;
                    typeDescription = `Every ${interval} ${unitLabel || unit}`;
                    break;
                case CODE_TRIGGER_TYPES.PLAYER_ACTION_INPUT:
                    const actionObj = CODE_PLAYER_ACTIONS.find(a => a.id === block.config?.action);
                    typeDescription = actionObj ? `Player: ${actionObj.label}` : 'Player action';
                    break;
                case CODE_TRIGGER_TYPES.PLAYER_STATS:
                    const statObj = CODE_PLAYER_STATS.find(s => s.id === block.config?.stat);
                    typeDescription = statObj ? `${statObj.label} = "${block.config?.statValue || ''}"` : 'Player stat';
                    break;
                default:
                    typeDescription = triggerInfo?.label || 'Trigger';
            }
        } else {
            typeDescription = 'Action (coming soon)';
        }
        
        return `
            <div class="code-block-card ${block.enabled ? '' : 'disabled'} ${error ? 'has-error' : ''}" data-block-id="${block.id}">
                <div class="code-block-header">
                    <div class="code-block-icon ${iconClass}">
                        <span class="material-symbols-outlined">${icon}</span>
                    </div>
                    <div class="code-block-name">
                        <input type="text" value="${escapeHtml(block.name)}" data-block-id="${block.id}" class="block-name-input" spellcheck="false">
                    </div>
                </div>
                <div class="code-block-type ${error ? 'error' : ''}">${escapeHtml(typeDescription)}</div>
                <div class="code-block-actions">
                    <button class="btn btn-secondary btn-edit" data-block-id="${block.id}">
                        <span class="material-symbols-outlined">edit</span>
                        Edit
                    </button>
                    <button class="btn btn-secondary btn-toggle" data-block-id="${block.id}" title="${block.enabled ? 'Disable' : 'Enable'}">
                        <span class="material-symbols-outlined">${block.enabled ? 'visibility_off' : 'visibility'}</span>
                    </button>
                    <button class="btn btn-secondary btn-icon-only btn-duplicate" data-block-id="${block.id}" title="Duplicate">
                        <span class="material-symbols-outlined">content_copy</span>
                    </button>
                    <button class="btn btn-danger btn-icon-only btn-delete" data-block-id="${block.id}" title="Delete">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </div>
            </div>
        `;
    };
    
    // Attach event listeners to block cards
    const attachBlockCardListeners = () => {
        // Name input change
        document.querySelectorAll('.block-name-input').forEach(input => {
            input.addEventListener('blur', handleNameChange);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.target.blur();
                }
            });
        });
        
        // Edit button
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                editBlock(e.currentTarget.dataset.blockId);
            });
        });
        
        // Toggle button
        document.querySelectorAll('.btn-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                toggleBlock(e.currentTarget.dataset.blockId);
            });
        });
        
        // Duplicate button
        document.querySelectorAll('.btn-duplicate').forEach(btn => {
            btn.addEventListener('click', (e) => {
                duplicateBlock(e.currentTarget.dataset.blockId);
            });
        });
        
        // Delete button
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const blockId = e.currentTarget.dataset.blockId;
                const codeData = getCodeData();
                const block = [...codeData.triggers, ...codeData.actions].find(b => b.id === blockId);
                const confirmed = await showConfirm('Delete Block', `Are you sure you want to delete "${block?.name || 'this block'}"?`);
                if (confirmed) {
                    deleteBlock(blockId);
                }
            });
        });
    };
    
    // Handle name change
    const handleNameChange = (e) => {
        const blockId = e.target.dataset.blockId;
        const newName = e.target.value.trim();
        
        if (!isValidName(newName)) {
            showToast('Cannot use reserved names: ' + CODE_RESERVED_NAMES.join(', '), 'error');
            showDashboard();
            return;
        }
        
        if (!newName) {
            showDashboard();
            return;
        }
        
        const codeData = getCodeData();
        const block = [...codeData.triggers, ...codeData.actions].find(b => b.id === blockId);
        if (block && block.name !== newName) {
            block.name = newName;
            saveCodeData(codeData);
            showToast('Renamed successfully', 'success');
        }
    };
    
    // Edit a block
    const editBlock = (blockId) => {
        const codeData = getCodeData();
        const block = [...codeData.triggers, ...codeData.actions].find(b => b.id === blockId);
        
        if (!block) return;
        
        editingBlock = block;
        
        if (block.type === CODE_BLOCK_TYPES.TRIGGER) {
            showTriggerEditor(block);
        } else {
            showActionEditor(block);
        }
    };
    
    // Toggle block enabled/disabled
    const toggleBlock = (blockId) => {
        const codeData = getCodeData();
        const block = [...codeData.triggers, ...codeData.actions].find(b => b.id === blockId);
        
        if (block) {
            block.enabled = !block.enabled;
            saveCodeData(codeData);
            showToast(block.enabled ? 'Enabled' : 'Disabled', 'info');
            showDashboard();
        }
    };
    
    // Duplicate a block
    const duplicateBlock = (blockId) => {
        const codeData = getCodeData();
        const block = [...codeData.triggers, ...codeData.actions].find(b => b.id === blockId);
        
        if (!block) return;
        
        const newBlock = JSON.parse(JSON.stringify(block));
        newBlock.id = generateId();
        newBlock.name = block.name + ' (Copy)';
        
        if (block.type === CODE_BLOCK_TYPES.TRIGGER) {
            codeData.triggers.push(newBlock);
        } else {
            codeData.actions.push(newBlock);
        }
        
        saveCodeData(codeData);
        showToast('Duplicated', 'success');
        showDashboard();
    };
    
    // Delete a block
    const deleteBlock = (blockId) => {
        const codeData = getCodeData();
        
        codeData.triggers = codeData.triggers.filter(t => t.id !== blockId);
        codeData.actions = codeData.actions.filter(a => a.id !== blockId);
        
        saveCodeData(codeData);
        showToast('Deleted', 'info');
        showDashboard();
    };
    
    // Show new block dialog
    const showNewBlockDialog = () => {
        const dialog = document.createElement('div');
        dialog.className = 'code-dialog-overlay';
        dialog.innerHTML = `
            <div class="code-dialog">
                <h2>Create New Code Block</h2>
                <div class="code-dialog-types">
                    <button class="code-type-btn selected" data-type="trigger">
                        <span class="material-symbols-outlined">frame_inspect</span>
                        <span>Trigger</span>
                    </button>
                    <button class="code-type-btn" data-type="action">
                        <span class="material-symbols-outlined">code_blocks</span>
                        <span>Action</span>
                    </button>
                </div>
                <div class="form-group">
                    <label class="form-label">Name</label>
                    <input type="text" class="form-input" id="new-block-name" placeholder="Enter a name..." autocomplete="off" spellcheck="false">
                    <small style="color: var(--text-muted); font-size: 11px; margin-top: 4px; display: block;">
                        Cannot use: ${CODE_RESERVED_NAMES.join(', ')}
                    </small>
                </div>
                <div class="code-dialog-actions">
                    <button class="btn btn-secondary" id="new-block-cancel">Cancel</button>
                    <button class="btn btn-primary" id="new-block-create">Create</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        let selectedType = 'trigger';
        const nameInput = dialog.querySelector('#new-block-name');
        
        // Type selection
        dialog.querySelectorAll('.code-type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                dialog.querySelectorAll('.code-type-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                selectedType = btn.dataset.type;
            });
        });
        
        // Cancel
        dialog.querySelector('#new-block-cancel').addEventListener('click', () => {
            dialog.remove();
        });
        
        // Click outside to close
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
        
        // Escape to close
        dialog.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                dialog.remove();
            }
        });
        
        // Create
        const createBlock = () => {
            const name = nameInput.value.trim();
            
            if (name && !isValidName(name)) {
                nameInput.classList.add('error');
                showToast('Cannot use reserved names', 'error');
                return;
            }
            
            const codeData = getCodeData();
            
            if (selectedType === 'trigger') {
                const newTrigger = {
                    ...JSON.parse(JSON.stringify(CODE_DEFAULT_TRIGGER)),
                    id: generateId(),
                    name: name || 'New Trigger'
                };
                codeData.triggers.push(newTrigger);
                saveCodeData(codeData);
                dialog.remove();
                showTriggerEditor(newTrigger);
            } else {
                const newAction = {
                    ...JSON.parse(JSON.stringify(CODE_DEFAULT_ACTION)),
                    id: generateId(),
                    name: name || 'New Action'
                };
                codeData.actions.push(newAction);
                saveCodeData(codeData);
                dialog.remove();
                showActionEditor(newAction);
            }
        };
        
        dialog.querySelector('#new-block-create').addEventListener('click', createBlock);
        
        // Enter to create
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                createBlock();
            }
        });
        
        // Focus name input
        setTimeout(() => nameInput.focus(), 100);
    };
    
    // Show trigger editor
    const showTriggerEditor = (trigger) => {
        currentView = 'editTrigger';
        editingBlock = trigger;
        
        // Update header
        const backBtn = document.getElementById('code-editor-back');
        if (backBtn) {
            backBtn.querySelector('.material-symbols-outlined').textContent = 'arrow_back';
            backBtn.title = 'Back (Escape)';
        }
        
        const title = document.querySelector('.code-editor-title');
        if (title) {
            title.innerHTML = `
                <span class="material-symbols-outlined" style="color: #f59e0b;">frame_inspect</span>
                Edit Trigger
            `;
        }
        
        const newBtn = document.getElementById('code-new-block');
        if (newBtn) newBtn.style.display = 'none';
        
        const content = document.getElementById('code-editor-content');
        if (!content) return;
        
        // Sort trigger types alphabetically
        const sortedTriggerTypes = [...CODE_TRIGGER_TYPE_INFO].sort((a, b) => a.label.localeCompare(b.label));
        
        content.innerHTML = `
            <div class="trigger-editor">
                <div class="trigger-form-group">
                    <label class="trigger-form-label">Trigger Name</label>
                    <input type="text" class="trigger-form-input" id="trigger-name" value="${escapeHtml(trigger.name)}" spellcheck="false">
                </div>
                
                <div class="trigger-form-group">
                    <label class="trigger-form-label">
                        Trigger Type
                        <span class="trigger-form-sublabel">When should this trigger fire?</span>
                    </label>
                    <select class="trigger-form-select" id="trigger-type">
                        ${sortedTriggerTypes.map(t => `
                            <option value="${t.id}" ${trigger.triggerType === t.id ? 'selected' : ''}>${escapeHtml(t.label)}</option>
                        `).join('')}
                    </select>
                    <p class="trigger-description" id="trigger-type-description"></p>
                </div>
                
                <div id="trigger-config-area">
                    <!-- Dynamic config options will be rendered here -->
                </div>
                
                <button class="btn btn-primary trigger-save-btn" id="trigger-save" style="width: 100%;">
                    <span class="material-symbols-outlined">save</span>
                    Save Trigger
                    <span style="opacity: 0.7; margin-left: 8px; font-size: 12px;">Ctrl+S</span>
                </button>
            </div>
        `;
        
        // Update description
        updateTriggerTypeDescription(trigger.triggerType);
        
        // Render initial config
        renderTriggerConfig(trigger.triggerType, trigger.config);
        
        // Trigger type change
        document.getElementById('trigger-type').addEventListener('change', (e) => {
            updateTriggerTypeDescription(e.target.value);
            renderTriggerConfig(e.target.value, {});
            markUnsaved();
        });
        
        // Track changes
        document.getElementById('trigger-name').addEventListener('input', markUnsaved);
        
        // Save button
        document.getElementById('trigger-save').addEventListener('click', saveTrigger);
    };
    
    // Update trigger type description
    const updateTriggerTypeDescription = (triggerType) => {
        const descEl = document.getElementById('trigger-type-description');
        if (!descEl) return;
        
        const info = CODE_TRIGGER_TYPE_INFO.find(t => t.id === triggerType);
        descEl.textContent = info?.description || '';
    };
    
    // Render trigger-specific config options
    const renderTriggerConfig = (triggerType, config = {}) => {
        const area = document.getElementById('trigger-config-area');
        if (!area) return;
        
        const zones = getZones();
        
        let html = '';
        
        switch (triggerType) {
            case CODE_TRIGGER_TYPES.PLAYER_ENTER_ZONE:
            case CODE_TRIGGER_TYPES.PLAYER_LEAVE_ZONE:
                const hasZones = zones.length > 0;
                html = `
                    <div class="trigger-form-group">
                        <label class="trigger-form-label">Zone</label>
                        <select class="trigger-form-select" id="trigger-config-zone" ${!hasZones ? 'disabled' : ''}>
                            ${!hasZones ? '<option value="">No zones available</option>' : ''}
                            ${zones.map(z => `<option value="${escapeHtml(z.name)}" ${config.zoneName === z.name ? 'selected' : ''}>${escapeHtml(z.name)}</option>`).join('')}
                        </select>
                        ${!hasZones ? '<p class="trigger-description error">Create zones in the editor first (use Koreen → Zone)</p>' : ''}
                    </div>
                `;
                break;
                
            case CODE_TRIGGER_TYPES.PLAYER_KEY_INPUT:
                const keys = config.keys || [];
                html = `
                    <div class="trigger-form-group">
                        <label class="trigger-form-label">Keys <span class="trigger-form-sublabel">Must all be pressed simultaneously</span></label>
                        <div class="trigger-keys-container">
                            <div class="trigger-keys-add">
                                <select class="trigger-form-select" id="trigger-add-key">
                                    <option value="">Select a key to add...</option>
                                    ${CODE_KEYBOARD_KEYS.map(k => `<option value="${k.id}">${escapeHtml(k.label)}</option>`).join('')}
                                </select>
                                <button class="btn btn-secondary" id="trigger-add-key-btn">
                                    <span class="material-symbols-outlined">add</span>
                                </button>
                            </div>
                            <div class="trigger-keys-list" id="trigger-keys-list">
                                ${keys.map(k => {
                                    const keyObj = CODE_KEYBOARD_KEYS.find(kk => kk.id === k);
                                    return `
                                        <div class="trigger-key-tag" data-key="${escapeHtml(k)}">
                                            <span>${keyObj ? escapeHtml(keyObj.label) : escapeHtml(k)}</span>
                                            <button class="remove-key-btn" title="Remove"><span class="material-symbols-outlined" style="font-size: 14px;">close</span></button>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                `;
                break;
                
            case CODE_TRIGGER_TYPES.PLAYER_ACTION_INPUT:
                const sortedActions = [...CODE_PLAYER_ACTIONS].sort((a, b) => a.label.localeCompare(b.label));
                html = `
                    <div class="trigger-form-group">
                        <label class="trigger-form-label">Action</label>
                        <select class="trigger-form-select" id="trigger-config-action">
                            ${sortedActions.map(a => `<option value="${a.id}" ${config.action === a.id ? 'selected' : ''}>${escapeHtml(a.label)}</option>`).join('')}
                        </select>
                    </div>
                    <div id="trigger-action-value-area"></div>
                `;
                break;
                
            case CODE_TRIGGER_TYPES.PLAYER_STATS:
                const sortedStats = [...CODE_PLAYER_STATS].sort((a, b) => a.label.localeCompare(b.label));
                html = `
                    <div class="trigger-form-group">
                        <label class="trigger-form-label">Stat</label>
                        <select class="trigger-form-select" id="trigger-config-stat">
                            ${sortedStats.map(s => `<option value="${s.id}" ${config.stat === s.id ? 'selected' : ''}>${escapeHtml(s.label)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="trigger-form-group">
                        <label class="trigger-form-label">Value to Match</label>
                        <input type="text" class="trigger-form-input" id="trigger-config-stat-value" value="${escapeHtml(config.statValue || '')}" placeholder="Enter value..." spellcheck="false">
                    </div>
                `;
                break;
                
            case CODE_TRIGGER_TYPES.REPEAT:
                html = `
                    <div class="trigger-form-group">
                        <label class="trigger-form-label">Repeat Every</label>
                        <div style="display: flex; gap: 12px;">
                            <input type="number" class="trigger-form-input" id="trigger-config-interval" value="${config.interval || 1}" min="1" style="flex: 1;">
                            <select class="trigger-form-select" id="trigger-config-unit" style="flex: 1;">
                                ${CODE_TIME_UNITS.map(u => `<option value="${u.id}" ${config.unit === u.id ? 'selected' : ''}>${u.label}</option>`).join('')}
                            </select>
                        </div>
                        <p class="trigger-description">The trigger will fire repeatedly at this interval after the game starts.</p>
                    </div>
                `;
                break;
                
            case CODE_TRIGGER_TYPES.GAME_STARTS:
            default:
                html = `<p class="trigger-description">This trigger fires once when the game starts. No additional configuration needed.</p>`;
                break;
        }
        
        area.innerHTML = html;
        
        // Attach event listeners for dynamic elements
        attachTriggerConfigListeners(triggerType, config);
    };
    
    // Attach event listeners for trigger config
    const attachTriggerConfigListeners = (triggerType, config) => {
        // Key input handling
        if (triggerType === CODE_TRIGGER_TYPES.PLAYER_KEY_INPUT) {
            const addKeyBtn = document.getElementById('trigger-add-key-btn');
            const keySelect = document.getElementById('trigger-add-key');
            const keysList = document.getElementById('trigger-keys-list');
            
            const addKey = (keyId) => {
                if (!keyId || keysList.querySelector(`[data-key="${keyId}"]`)) return;
                
                const keyObj = CODE_KEYBOARD_KEYS.find(k => k.id === keyId);
                const tag = document.createElement('div');
                tag.className = 'trigger-key-tag';
                tag.dataset.key = keyId;
                tag.innerHTML = `
                    <span>${keyObj ? escapeHtml(keyObj.label) : escapeHtml(keyId)}</span>
                    <button class="remove-key-btn" title="Remove"><span class="material-symbols-outlined" style="font-size: 14px;">close</span></button>
                `;
                keysList.appendChild(tag);
                
                tag.querySelector('.remove-key-btn').addEventListener('click', () => {
                    tag.remove();
                    markUnsaved();
                });
                
                markUnsaved();
            };
            
            addKeyBtn?.addEventListener('click', () => {
                const keyId = keySelect.value;
                
                // Special handling for "Other" key
                if (keyId === 'other') {
                    showKeyCapture((capturedKey) => {
                        if (capturedKey) {
                            addKey(capturedKey);
                        }
                    });
                    keySelect.value = '';
                    return;
                }
                
                addKey(keyId);
                keySelect.value = '';
            });
            
            // Remove key buttons
            keysList?.querySelectorAll('.remove-key-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    btn.closest('.trigger-key-tag').remove();
                    markUnsaved();
                });
            });
        }
        
        // Player action value input
        if (triggerType === CODE_TRIGGER_TYPES.PLAYER_ACTION_INPUT) {
            const actionSelect = document.getElementById('trigger-config-action');
            const valueArea = document.getElementById('trigger-action-value-area');
            
            const updateActionValue = () => {
                const actionId = actionSelect?.value;
                const action = CODE_PLAYER_ACTIONS.find(a => a.id === actionId);
                
                if (action?.hasValue && valueArea) {
                    valueArea.innerHTML = `
                        <div class="trigger-form-group">
                            <label class="trigger-form-label">${escapeHtml(action.valuePlaceholder)}</label>
                            <input type="${action.valueType === 'number' ? 'number' : 'text'}" class="trigger-form-input" id="trigger-config-action-value" value="${escapeHtml(config.actionValue || '')}" placeholder="${escapeHtml(action.valuePlaceholder)}" spellcheck="false">
                        </div>
                    `;
                    document.getElementById('trigger-config-action-value')?.addEventListener('input', markUnsaved);
                } else if (valueArea) {
                    valueArea.innerHTML = '';
                }
            };
            
            actionSelect?.addEventListener('change', () => {
                updateActionValue();
                markUnsaved();
            });
            updateActionValue();
        }
        
        // Track changes for all inputs
        area.querySelectorAll('input, select').forEach(el => {
            el.addEventListener('change', markUnsaved);
            el.addEventListener('input', markUnsaved);
        });
    };
    
    // Show key capture dialog for "Other" key
    const showKeyCapture = (callback) => {
        const overlay = document.createElement('div');
        overlay.className = 'key-capture-overlay';
        overlay.innerHTML = `
            <div class="key-capture-dialog">
                <h3>Press any key...</h3>
                <p>Press the key you want to capture, or Escape to cancel.</p>
            </div>
        `;
        document.body.appendChild(overlay);
        
        const handleKeyDown = (e) => {
            e.preventDefault();
            overlay.remove();
            document.removeEventListener('keydown', handleKeyDown);
            
            if (e.key === 'Escape') {
                callback(null);
            } else {
                callback(e.code);
            }
        };
        
        document.addEventListener('keydown', handleKeyDown);
        
        overlay.addEventListener('click', () => {
            overlay.remove();
            document.removeEventListener('keydown', handleKeyDown);
            callback(null);
        });
    };
    
    // Save trigger
    const saveTrigger = () => {
        if (!editingBlock) return;
        
        const nameInput = document.getElementById('trigger-name');
        const name = nameInput?.value.trim();
        
        if (!isValidName(name)) {
            showToast('Invalid name. Cannot use reserved names.', 'error');
            nameInput?.focus();
            return;
        }
        
        if (!name) {
            showToast('Please enter a name', 'error');
            nameInput?.focus();
            return;
        }
        
        const triggerType = document.getElementById('trigger-type')?.value;
        const config = {};
        
        // Gather config based on type
        switch (triggerType) {
            case CODE_TRIGGER_TYPES.PLAYER_ENTER_ZONE:
            case CODE_TRIGGER_TYPES.PLAYER_LEAVE_ZONE:
                config.zoneName = document.getElementById('trigger-config-zone')?.value || '';
                break;
                
            case CODE_TRIGGER_TYPES.PLAYER_KEY_INPUT:
                const keysList = document.getElementById('trigger-keys-list');
                config.keys = Array.from(keysList?.querySelectorAll('.trigger-key-tag') || [])
                    .map(tag => tag.dataset.key);
                break;
                
            case CODE_TRIGGER_TYPES.PLAYER_ACTION_INPUT:
                config.action = document.getElementById('trigger-config-action')?.value || '';
                const actionValueEl = document.getElementById('trigger-config-action-value');
                if (actionValueEl) {
                    config.actionValue = actionValueEl.value;
                }
                break;
                
            case CODE_TRIGGER_TYPES.PLAYER_STATS:
                config.stat = document.getElementById('trigger-config-stat')?.value || '';
                config.statValue = document.getElementById('trigger-config-stat-value')?.value || '';
                break;
                
            case CODE_TRIGGER_TYPES.REPEAT:
                config.interval = Math.max(1, parseFloat(document.getElementById('trigger-config-interval')?.value) || 1);
                config.unit = document.getElementById('trigger-config-unit')?.value || 'seconds';
                break;
        }
        
        // Update trigger
        editingBlock.name = name;
        editingBlock.triggerType = triggerType;
        editingBlock.config = config;
        
        const codeData = getCodeData();
        saveCodeData(codeData);
        
        showToast('Trigger saved', 'success');
        showDashboard();
    };
    
    // Show action editor
    const showActionEditor = (action) => {
        currentView = 'editAction';
        editingBlock = action;
        
        // Update header
        const backBtn = document.getElementById('code-editor-back');
        if (backBtn) {
            backBtn.querySelector('.material-symbols-outlined').textContent = 'arrow_back';
            backBtn.title = 'Back (Escape)';
        }
        
        const title = document.querySelector('.code-editor-title');
        if (title) {
            title.innerHTML = `
                <span class="material-symbols-outlined" style="color: #3b82f6;">code_blocks</span>
                Edit Action
            `;
        }
        
        const newBtn = document.getElementById('code-new-block');
        if (newBtn) newBtn.style.display = 'none';
        
        const content = document.getElementById('code-editor-content');
        if (!content) return;
        
        content.innerHTML = `
            <div class="trigger-editor">
                <div class="trigger-form-group">
                    <label class="trigger-form-label">Action Name</label>
                    <input type="text" class="trigger-form-input" id="action-name" value="${escapeHtml(action.name)}" spellcheck="false">
                </div>
                
                <div class="code-empty-state" style="height: 40vh;">
                    <span class="material-symbols-outlined">construction</span>
                    <p>Action code editor coming soon!</p>
                    <small>Actions will allow you to write code that executes when triggers fire.</small>
                </div>
                
                <button class="btn btn-primary trigger-save-btn" id="action-save" style="width: 100%;">
                    <span class="material-symbols-outlined">save</span>
                    Save Action
                </button>
            </div>
        `;
        
        // Save button
        document.getElementById('action-save').addEventListener('click', () => {
            const name = document.getElementById('action-name')?.value.trim();
            
            if (!isValidName(name)) {
                showToast('Invalid name. Cannot use reserved names.', 'error');
                return;
            }
            
            if (!name) {
                showToast('Please enter a name', 'error');
                return;
            }
            
            editingBlock.name = name;
            
            const codeData = getCodeData();
            saveCodeData(codeData);
            
            showToast('Action saved', 'success');
            showDashboard();
        });
    };
    
    // Open code editor
    const openCodeEditor = () => {
        const overlay = createCodeEditorOverlay();
        overlay.classList.add('active');
        overlay.focus();
        showDashboard();
        
        if (typeof CODE_STATE !== 'undefined') {
            CODE_STATE.isEditorOpen = true;
        }
    };
    
    // Close code editor
    const closeCodeEditor = () => {
        if (codeEditorOverlay) {
            codeEditorOverlay.classList.remove('active');
        }
        hasUnsavedChanges = false;
        
        if (typeof CODE_STATE !== 'undefined') {
            CODE_STATE.isEditorOpen = false;
            CODE_STATE.hasUnsavedChanges = false;
        }
    };
    
    // Escape HTML helper
    const escapeHtml = (text) => {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    };
    
    // Export functions
    if (typeof window !== 'undefined') {
        window.CodeEditor = {
            open: openCodeEditor,
            close: closeCodeEditor,
            isOpen: () => typeof CODE_STATE !== 'undefined' ? CODE_STATE.isEditorOpen : false
        };
    }
})();
