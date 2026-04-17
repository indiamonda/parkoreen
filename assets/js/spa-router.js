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
        `;
        document.head.appendChild(style);
    }

    function executeInlineScripts(doc) {
        const scripts = Array.from(doc.querySelectorAll('script')).filter(script => !script.src);
        scripts.forEach(script => {
            const injected = document.createElement('script');
            if (script.type) injected.type = script.type;
            injected.textContent = script.textContent;
            document.body.appendChild(injected);
            document.body.removeChild(injected);
        });
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
            currentContent.addEventListener('animationend', function onExit() {
                currentContent.removeEventListener('animationend', onExit);
                currentContent.replaceWith(newContent);
                newContent.classList.add('spa-enter');
                document.title = doc.title || document.title;
                document.body.className = doc.body.className || document.body.className;

                executeInlineScripts(doc);
                if (replaceState) {
                    history.replaceState({ spa: true, path: normalized }, '', normalized);
                } else {
                    history.pushState({ spa: true, path: normalized }, '', normalized);
                }

                newContent.addEventListener('animationend', function onEnter() {
                    newContent.removeEventListener('animationend', onEnter);
                    newContent.classList.remove('spa-enter');
                });
            });
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
        if (event.state && event.state.spa && event.state.path) {
            navigateSpa(event.state.path, true);
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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
