/**
 * HP plugin — map config UI only (injected into editor)
 */
(function () {
    'use strict';
    window.ParkoreenEditorPluginUI = window.ParkoreenEditorPluginUI || {};

    window.ParkoreenEditorPluginUI.hp = function (editor) {
        const mount = document.getElementById('plugin-config-inject');
        if (!mount || document.getElementById('config-section-hp')) return;

        const wrap = document.createElement('div');
        wrap.innerHTML = `
                <div class="config-section collapsible hidden" id="config-section-hp">
                    <div class="config-section-header">
                        <span class="config-section-title">❤️ HP Settings</span>
                        <span class="material-symbols-outlined config-section-arrow">expand_more</span>
                    </div>
                    <div class="config-section-content">
                        <div class="form-group">
                            <label class="form-label">Default HP</label>
                            <input type="number" class="form-input" id="config-hp-default" min="1" max="99" value="3">
                            <small style="color: #888; font-size: 11px;">Starting health points for players</small>
                        </div>
                    </div>
                </div>`;
        mount.appendChild(wrap.firstElementChild);

        document.getElementById('config-hp-default')?.addEventListener('change', (e) => {
            if (!editor.world.plugins.hp) editor.world.plugins.hp = { defaultHP: 3 };
            editor.world.plugins.hp.defaultHP = Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 3));
            e.target.value = editor.world.plugins.hp.defaultHP;
            editor.triggerMapChange();
        });
    };
})();
