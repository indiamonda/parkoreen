(function() {
    const SPA_ROUTES = {
        '/parkoreen/dashboard/': true,
        '/parkoreen/mails/': true,
        '/parkoreen/settings/': true,
        '/parkoreen/admin/': true,
        '/parkoreen/howtoplay/': true,
    };

    function normalizePath(path) {
        const url = new URL(path, window.location.origin);
        return url.pathname.replace(/\/+$/, '/').replace(/\/{2,}/g, '/');
    }

    function isSpaRoute(path) {
        const normalized = normalizePath(path);
        return SPA_ROUTES.hasOwnProperty(normalized);
    }

    async function fetchSpaPage(path) {
        const url = new URL(normalizePath(path), window.location.origin);
        url.searchParams.set('spa', '1');
        const resp = await fetch(url.toString(), {
            headers: { 'X-Spa-Request': '1' }
        });
        if (!resp.ok) throw new Error('Failed to load page: ' + resp.status);
        return resp.text();
    }

    function injectSpaStyles() {
        if (document.getElementById('spa-router-style')) return;
        const style = document.createElement('style');
        style.id = 'spa-router-style';
        style.textContent = `
            #spa-content {
                transform-origin: center top;
            }
            .spa-enter {
                animation: spaBounceIn 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            .spa-exit {
                animation: spaBounceOut 0.25s ease-in-out forwards;
            }
            @keyframes spaBounceIn {
                0% { opacity: 0; transform: translateY(18px) scale(0.98); }
                60% { opacity: 1; transform: translateY(-8px) scale(1.02); }
                100% { transform: translateY(0) scale(1); }
            }
            @keyframes spaBounceOut {
                0% { opacity: 1; transform: translateY(0) scale(1); }
                100% { opacity: 0; transform: translateY(-10px) scale(0.98); }
            }
            @keyframes spaItemEnter {
                0% { opacity: 0; transform: translateY(12px); }
                100% { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }

    async function executeScripts(doc, basePath) {
        const baseUrl = new URL(basePath, window.location.origin);
        const scripts = Array.from(doc.querySelectorAll('script'));
        for (const script of scripts) {
            if (script.src) {
                const src = new URL(script.getAttribute('src'), baseUrl).toString();
                const alreadyLoaded = Array.from(document.scripts).some(existing => {
                    return existing.src && existing.src === src;
                });
                if (alreadyLoaded) continue;

                await new Promise(resolve => {
                    const injected = document.createElement('script');
                    if (script.type) injected.type = script.type;
                    if (script.async) injected.async = true;
                    if (script.defer) injected.defer = true;
                    injected.src = src;
                    injected.onload = resolve;
                    injected.onerror = function() {
                        console.warn('[SPA Router] failed loading script', src);
                        resolve();
                    };
                    document.body.appendChild(injected);
                });
            } else {
                const injected = document.createElement('script');
                if (script.type) injected.type = script.type;
                injected.textContent = script.textContent;
                document.body.appendChild(injected);
                document.body.removeChild(injected);
            }
        }
    }

    function waitForAnimationEnd(element, timeout = 400) {
        return new Promise(resolve => {
            let finished = false;
            function done() {
                if (finished) return;
                finished = true;
                element.removeEventListener('animationend', onAnimEnd);
                clearTimeout(timer);
                resolve();
            }
            function onAnimEnd(event) {
                if (event.target === element) done();
            }
            const timer = setTimeout(done, timeout);
            element.addEventListener('animationend', onAnimEnd);
        });
    }

    function applyStaggeredUiTransitions(container) {
        if (!container) return;
        const selector = 'header, footer, main, section, article, nav, div, button, input, select, textarea, label, table, ul, ol, .mail-card, .room-card, .map-card, .settings-card, .user-table, .tab-panel, .admin-tabs, .users-toolbar, .mail-card-header, .mail-card-body, .settings-section';
        const elements = Array.from(container.querySelectorAll(selector)).filter(el => {
            if (!(el instanceof HTMLElement)) return false;
            if (el.closest('script, style, link')) return false;
            return getComputedStyle(el).display !== 'none';
        });

        let delay = 0;
        const animated = [];
        elements.forEach(el => {
            el.style.opacity = '0';
            el.style.animation = `spaItemEnter 0.35s ease-out forwards ${delay.toFixed(2)}s`;
            animated.push(el);
            delay += 0.03;
        });

        setTimeout(() => {
            animated.forEach(el => {
                if (el.style.opacity === '0') {
                    el.style.opacity = '';
                }
                if (el.style.animation && el.style.animation.includes('spaItemEnter')) {
                    el.style.animation = '';
                }
            });
        }, 900);
    }

    function syncHeadStyles(doc) {
        Array.from(document.head.querySelectorAll('link[data-spa-managed], style[data-spa-managed]')).forEach(el => el.remove());

        Array.from(doc.head.querySelectorAll('link[rel="stylesheet"][href]')).forEach(link => {
            const clone = link.cloneNode(true);
            clone.setAttribute('data-spa-managed', '1');
            document.head.appendChild(clone);
        });

        Array.from(doc.head.querySelectorAll('style')).forEach(style => {
            const clone = document.createElement('style');
            clone.setAttribute('data-spa-managed', '1');
            clone.textContent = style.textContent;
            document.head.appendChild(clone);
        });
    }

    function syncPageFooter(doc) {
        const newFooter = doc.body.querySelector('.page-footer');
        const currentFooter = document.querySelector('.page-footer');
        if (newFooter) {
            const footerNode = newFooter.cloneNode(true);
            if (currentFooter) {
                currentFooter.replaceWith(footerNode);
            } else {
                document.body.appendChild(footerNode);
            }
        } else if (currentFooter) {
            currentFooter.remove();
        }
    }

    async function navigateSpa(path, replaceState = false) {
        try {
            injectSpaStyles();
            const normalized = normalizePath(path);
            if (!SPA_ROUTES[normalized]) {
                window.location.href = path;
                return;
            }

            if (normalized === normalizePath(window.location.pathname)) {
                return;
            }

            const html = await fetchSpaPage(normalized);
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const newContent = doc.querySelector('#spa-content');
            if (!newContent) {
                window.location.href = path;
                return;
            }

            const currentContent = document.querySelector('#spa-content');
            if (!currentContent) {
                window.location.href = path;
                return;
            }

            currentContent.classList.add('spa-exit');
            await waitForAnimationEnd(currentContent);
            currentContent.replaceWith(newContent);
            newContent.classList.add('spa-enter');
                newContent.style.opacity = '1';

            syncHeadStyles(doc);
            await executeScripts(doc, normalized);
            syncPageFooter(doc);
            applyStaggeredUiTransitions(newContent);
            if (replaceState) {
                history.replaceState({ spa: true, path: normalized }, '', normalized);
            } else {
                history.pushState({ spa: true, path: normalized }, '', normalized);
            }

            await waitForAnimationEnd(newContent);
            newContent.classList.remove('spa-enter');
        } catch (error) {
            console.error('[SPA Router] navigation failed', error);
            window.location.href = path;
        }
    }

    function linkHandler(event) {
        const anchor = event.target.closest('a');
        if (!anchor || !anchor.href || anchor.target === '_blank' || anchor.hasAttribute('download')) return;

        const url = new URL(anchor.href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        if (isSpaRoute(url.pathname)) {
            event.preventDefault();
            navigateSpa(url.pathname);
        }
    }

    function patchNavigation() {
        if (!window.Navigation) return;
        const original = { ...window.Navigation };

        function createNav(fallback, route) {
            return function() {
                if (isSpaRoute(route)) {
                    navigateSpa(route);
                } else if (fallback) {
                    fallback.apply(this, arguments);
                } else {
                    window.location.href = route;
                }
            };
        }

        window.Navigation.toDashboard = createNav(original.toDashboard, '/parkoreen/dashboard/');
        window.Navigation.toSettings = createNav(original.toSettings, '/parkoreen/settings/');
        window.Navigation.toMails = createNav(original.toMails, '/parkoreen/mails/');
        window.Navigation.toAdmin = createNav(original.toAdmin, '/parkoreen/admin/');
        window.Navigation.toHowToPlay = createNav(original.toHowToPlay, '/parkoreen/howtoplay/');
    }

    function onPopState(event) {
        const currentPath = normalizePath(window.location.pathname);
        if (event.state && event.state.spa && event.state.path) {
            navigateSpa(event.state.path, true);
            return;
        }
        if (isSpaRoute(currentPath)) {
            navigateSpa(currentPath, true);
        }
    }

    function init() {
        const currentPath = normalizePath(window.location.pathname);
        if (isSpaRoute(currentPath)) {
            history.replaceState({ spa: true, path: currentPath }, '', currentPath);
        }

        patchNavigation();
        document.body.addEventListener('click', linkHandler);
        window.addEventListener('popstate', onPopState);

        const currentContent = document.querySelector('#spa-content');
        if (currentContent) {
            applyStaggeredUiTransitions(currentContent);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
