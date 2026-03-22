/**
 * Code plugin script chain — lives only under assets/plugins/code/.
 * Call window.loadParkoreenCodePluginScripts() and await before loading editor.js.
 */
(function () {
    'use strict';

    function findCodeJsBase() {
        const scripts = document.getElementsByTagName('script');
        for (let i = scripts.length - 1; i >= 0; i--) {
            const src = scripts[i].src || '';
            if (src.indexOf('/code/js/loader.js') !== -1) {
                return src.replace(/loader\.js(\?.*)?$/, '');
            }
        }
        return 'assets/plugins/code/js/';
    }

    const files = [
        'skulpt.min.js',
        'skulpt-stdlib.js',
        'pythonCompiler.js',
        'globals.js',
        'inject.js',
        'editor.js'
    ];

    function loadOne(url) {
        return new Promise(function (resolve) {
            const s = document.createElement('script');
            s.src = url;
            s.onload = function () { resolve(); };
            s.onerror = function () {
                console.warn('[code/loader] failed', url);
                resolve();
            };
            document.head.appendChild(s);
        });
    }

    window.loadParkoreenCodePluginScripts = function () {
        if (window.__parkoreenCodePluginScriptsDone) {
            return Promise.resolve();
        }
        const base = findCodeJsBase();
        return files.reduce(function (chain, name) {
            return chain.then(function () { return loadOne(base + name); });
        }, Promise.resolve()).then(function () {
            window.__parkoreenCodePluginScriptsDone = true;
            window.dispatchEvent(new CustomEvent('parkoreen:code-plugin-loaded'));
        });
    };
})();
