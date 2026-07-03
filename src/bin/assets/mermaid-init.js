// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

(() => {
    const mermaidModalId = 'mermaid-diagram-modal';
    const expandIcon = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
        </svg>
    `;
    const closeIcon = `
        <svg viewBox="0 0 384 512" aria-hidden="true" focusable="false">
            <path fill="currentColor" d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/>
        </svg>
    `;

    const clamp01 = (value) => Math.min(1, Math.max(0, value));

    const hexToRgb = (hex) => {
        const normalized = hex.length === 4
            ? hex.replace(/^#([\da-fA-F])([\da-fA-F])([\da-fA-F])/, '#$1$1$2$2$3$3')
            : hex;
        const parts = /^#([\da-fA-F]{6})$/.exec(normalized);
        if (!parts) return null;
        const v = parts[1];
        return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
    };

    const parseColor = (value) => {
        if (!value) return null;
        const trim = value.trim();
        const rgb = /^rgba?\(([^)]+)\)/.exec(trim);
        if (rgb) {
            const nums = rgb[1].split(',').map((n) => n.trim());
            if (nums.length >= 3 && nums.every((n) => n !== '')) {
                const channels = nums.slice(0, 3).map((channel) => {
                    const normalized = parseFloat(channel);
                    if (channel.includes('%')) {
                        return clamp01(normalized / 100);
                    }
                    return clamp01(normalized / 255);
                });
                if (channels.every((n) => Number.isFinite(n))) {
                    return channels;
                }
            }
        }
        return hexToRgb(trim)?.map((n) => n / 255) ?? null;
    };

    const isDarkColor = (value) => {
        const rgb = parseColor(value);
        if (!rgb) return null;
        const [r, g, b] = rgb;
        const luma = (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
        return luma < 0.5;
    };

    const hasClassThemeHint = (classes, token) => classes.some((value) => value === token);

    const getThemeToneFromClass = () => {
        const classes = Array.from(document.documentElement.classList || []);
        if (classes.some((value) => /(^|-)dark/.test(value) || hasClassThemeHint(classes, 'navy') || hasClassThemeHint(classes, 'coal') || hasClassThemeHint(classes, 'ayu'))) return false;
        if (classes.some((value) => /(^|-)light/.test(value) || hasClassThemeHint(classes, 'light') || hasClassThemeHint(classes, 'rust'))) return true;
        return null;
    };

    const isLightTheme = () => {
        const fromClass = getThemeToneFromClass();
        if (fromClass !== null) return fromClass;

        const rootStyle = getComputedStyle(document.documentElement);
        const bgColor =
            rootStyle.getPropertyValue('--bg').trim() ||
            rootStyle.backgroundColor ||
            getComputedStyle(document.body).backgroundColor;
        const darkByColor = isDarkColor(bgColor);
        if (darkByColor !== null) return !darkByColor;
        return !window.matchMedia('(prefers-color-scheme: dark)').matches;
    };

    const getCursorColor = () => {
        const themeRoot = getComputedStyle(document.documentElement);
        return (
            themeRoot.getPropertyValue('--fg').trim() ||
            getComputedStyle(document.body).color
        ).trim() || '#666';
    };

    const makeCursorSvg = (plus, color) => {
        const sign = plus
            ? `<line x1='20' y1='13' x2='20' y2='27' stroke-width='3'/><line x1='13' y1='20' x2='27' y2='20' stroke-width='3'/>`
            : `<line x1='13' y1='20' x2='27' y2='20' stroke-width='3'/>`;
        const encoded = encodeURIComponent(`
            <svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48' fill='none' stroke='${color}' stroke-linecap='round' stroke-linejoin='round'><circle cx='20' cy='20' r='13' stroke-width='3'/><line x1='30' y1='30' x2='42' y2='42' stroke-width='3'/>${sign}</svg>`
            .replace(/\n/g, '')
        );
        return `url("data:image/svg+xml,${encoded}") 20 20, auto`;
    };

    const zoomInCursor = () => makeCursorSvg(true, getCursorColor());
    const zoomOutCursor = () => makeCursorSvg(false, getCursorColor());
    const resetCursor = () => {
        const encoded = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48' fill='none' stroke='${getCursorColor()}' stroke-linecap='round' stroke-linejoin='round'><g transform='translate(6 6) scale(1.5)'><path d='M3 12a9 9 0 1 0 3-6.7L3 8' stroke-width='2'/><path d='M3 3v5h5' stroke-width='2'/></g></svg>`
            .replace(/\n/g, '')
        );
        return `url("data:image/svg+xml,${encoded}") 20 20, auto`;
    };

    let lastThemeWasLight = isLightTheme();
    mermaid.initialize({ startOnLoad: true, theme: lastThemeWasLight ? 'default' : 'dark' });

    // --- Expand / modal functionality ---

    let modal = null;
    let zoomLevel = 1;
    let baseWidth = 0;
    let baseHeight = 0;
    const ZOOM_STEP = 0.25;
    const ZOOM_MIN = 0.5;
    const ZOOM_MAX = 5;

    const resetZoom = () => {
        if (!modal) return;
        zoomLevel = 1;
        const content = modal.querySelector('.mermaid-modal__content');
        const wrapper = content?.querySelector('.mermaid-modal__svg-wrapper');
        if (!wrapper || !baseWidth) return;
        wrapper.style.width = baseWidth + 'px';
        wrapper.style.height = baseHeight + 'px';
        content.scrollLeft = 0;
        content.scrollTop = 0;
    };

    const diagramTitle = (sourcePre) => {
        const parent = sourcePre.parentElement;
        // Prefer the HTML5 figure caption pattern for titled diagrams:
        // <figure><pre class="mermaid">...</pre><figcaption>Title</figcaption></figure>
        const figureCaption = parent?.tagName === 'FIGURE'
            ? parent.querySelector(':scope > figcaption')
            : null;
        if (figureCaption?.textContent?.trim()) {
            return figureCaption.textContent.trim();
        }

        const previous = sourcePre.previousElementSibling;
        if (previous?.matches('figcaption, caption')) {
            return previous.textContent.trim();
        }

        if (previous?.matches('h1, h2, h3, h4, h5, h6')) {
            return previous.textContent.trim();
        }

        return '';
    };

    const closeMermaidModal = () => {
        if (!modal) return;
        modal.hidden = true;
        document.body.classList.remove('mermaid-modal-open');
    };

    const openMermaidModal = (sourcePre) => {
        if (!modal) modal = createMermaidModal();

        const content = modal.querySelector('.mermaid-modal__content');
        const title = modal.querySelector('.mermaid-modal__title');
        const sourceSvg = sourcePre.querySelector('svg');
        if (!sourceSvg) return;

        zoomLevel = 1;
        content.innerHTML = '';
        content.scrollTop = 0;
        content.scrollLeft = 0;

        const wrapper = document.createElement('div');
        wrapper.className = 'mermaid-modal__svg-wrapper';
        const clone = sourceSvg.cloneNode(true);
        clone.style.height = 'auto';
        clone.style.maxWidth = 'none';
        wrapper.appendChild(clone);
        content.appendChild(wrapper);

        content.style.cursor = zoomInCursor();

        title.textContent = diagramTitle(sourcePre);

        modal.hidden = false;
        document.body.classList.add('mermaid-modal-open');

        // Fit the original SVG into the actual scroll viewport so the initial
        // modal state is fully visible and zoom-out can shrink the diagram.
        requestAnimationFrame(() => {
            const sourceBox = sourceSvg.viewBox?.baseVal;
            const intrinsicWidth = sourceBox?.width || sourceSvg.getBoundingClientRect().width;
            const intrinsicHeight = sourceBox?.height || sourceSvg.getBoundingClientRect().height;
            const contentStyle = window.getComputedStyle(content);
            const horizontalPadding = parseFloat(contentStyle.paddingLeft) + parseFloat(contentStyle.paddingRight);
            const verticalPadding = parseFloat(contentStyle.paddingTop) + parseFloat(contentStyle.paddingBottom);
            const availableWidth = Math.max(1, content.clientWidth - horizontalPadding);
            const availableHeight = Math.max(1, content.clientHeight - verticalPadding);
            const fitScale = Math.min(availableWidth / intrinsicWidth, availableHeight / intrinsicHeight);

            baseWidth = intrinsicWidth * fitScale;
            baseHeight = intrinsicHeight * fitScale;
            wrapper.style.width = baseWidth + 'px';
            wrapper.style.height = baseHeight + 'px';
        });
    };

    const createMermaidModal = () => {
        const el = document.createElement('div');
        el.id = mermaidModalId;
        el.className = 'mermaid-modal';
        el.hidden = true;
        el.innerHTML = `
            <div class="mermaid-modal__backdrop"></div>
            <div class="mermaid-modal__panel" role="dialog" aria-modal="true" aria-labelledby="${mermaidModalId}-title">
                <div class="mermaid-modal__header">
                    <strong id="${mermaidModalId}-title" class="mermaid-modal__title"></strong>
                    <button type="button" class="mermaid-modal__close" aria-label="Close expanded diagram">${closeIcon}</button>
                </div>
                <div class="mermaid-modal__content"></div>
            </div>
            <aside class="mermaid-modal__help" aria-label="Diagram zoom controls">
                <strong>Zoom controls</strong>
                <span><kbd>Click</kbd>&nbsp; zoom in</span>
                <span><kbd>Shift</kbd> + <kbd>Click</kbd>&nbsp; zoom out</span>
                <span><kbd>Alt</kbd> + <kbd>Click</kbd>&nbsp; reset</span>
                <span><kbd>Esc</kbd>&nbsp; reset, then close</span>
            </aside>
        `;

        const title = el.querySelector('.mermaid-modal__title');
        const help = el.querySelector('.mermaid-modal__help');
        const helpTitle = help?.querySelector('strong');
        const helpRows = help ? Array.from(help.querySelectorAll('span')) : [];

        if (title) {
            title.style.setProperty('font-size', '30px', 'important');
            title.style.setProperty('font-weight', '700', 'important');
            title.style.setProperty('line-height', '1.2', 'important');
        }
        if (help) {
            help.style.setProperty('font-size', '21px', 'important');
            help.style.setProperty('line-height', '1.35', 'important');
            help.style.setProperty('font-weight', '600', 'important');
            help.style.setProperty('white-space', 'normal', 'important');
        }
        if (helpTitle) {
            helpTitle.style.setProperty('font-size', '24px', 'important');
            helpTitle.style.setProperty('font-weight', '700', 'important');
            helpTitle.style.setProperty('margin-bottom', '0.15em', 'important');
        }
        for (const row of helpRows) {
            row.style.setProperty('white-space', 'nowrap', 'important');
            row.style.setProperty('font-size', '19px', 'important');
        }

        el.addEventListener('click', (event) => {
            if (event.target.closest && event.target.closest('.mermaid-modal__close')) {
                closeMermaidModal();
                return;
            }
            const panel = el.querySelector('.mermaid-modal__panel');
            if (panel && !panel.contains(event.target)) {
                closeMermaidModal();
            }
        });

        const content = el.querySelector('.mermaid-modal__content');
        content.addEventListener('click', (event) => {
            const wrapper = content.querySelector('.mermaid-modal__svg-wrapper');
            if (!wrapper || !baseWidth) return;

            // Click position in viewport-relative coords
            const rect = content.getBoundingClientRect();
            const viewX = event.clientX - rect.left;
            const viewY = event.clientY - rect.top;

            // Click position in unscaled SVG coords
            const svgX = (content.scrollLeft + viewX) / zoomLevel;
            const svgY = (content.scrollTop + viewY) / zoomLevel;

            // Update zoom. Alt/Option+click avoids macOS Control-click context menus.
            if (event.altKey) {
                zoomLevel = 1;
            } else if (event.shiftKey) {
                zoomLevel = Math.max(ZOOM_MIN, zoomLevel - ZOOM_STEP);
            } else {
                zoomLevel = Math.min(ZOOM_MAX, zoomLevel + ZOOM_STEP);
            }

            // Apply zoom by resizing the wrapper. The SVG inside has
            // width:100% so it scales naturally — no CSS transform needed.
            wrapper.style.width = (baseWidth * zoomLevel) + 'px';
            wrapper.style.height = (baseHeight * zoomLevel) + 'px';

            // Force synchronous reflow so the scroll container knows its
            // new scrollable extents before we set scroll position.
            void content.scrollWidth;

            content.scrollLeft = svgX * zoomLevel - rect.width / 2;
            content.scrollTop = svgY * zoomLevel - rect.height / 2;
        });

        document.body.appendChild(el);
        return el;
    };

    document.addEventListener('keydown', (event) => {
        if (!modal || modal.hidden) return;
        if (event.key === 'Escape') {
            if (Math.abs(zoomLevel - 1) > 0.01) {
                resetZoom();
                event.preventDefault();
            } else {
                closeMermaidModal();
            }
            return;
        }
        if (event.key === 'Shift') {
            const content = modal.querySelector('.mermaid-modal__content');
            if (content) content.style.cursor = zoomOutCursor();
        } else if (event.key === 'Alt') {
            const content = modal.querySelector('.mermaid-modal__content');
            if (content) content.style.cursor = resetCursor();
        }
    });

    document.addEventListener('keyup', (event) => {
        if (!modal || modal.hidden) return;
        if (event.key === 'Shift') {
            const content = modal.querySelector('.mermaid-modal__content');
            if (content) content.style.cursor = zoomInCursor();
        } else if (event.key === 'Alt') {
            const content = modal.querySelector('.mermaid-modal__content');
            if (content) content.style.cursor = zoomInCursor();
        }
    });

    // Add expand buttons to rendered mermaid diagrams.
    const enhanceMermaidDiagrams = () => {
        for (const diagram of document.querySelectorAll('pre.mermaid')) {
            if (!diagram.querySelector('svg')) continue;
            if (diagram.querySelector('.mermaid-expand-button')) continue;

            const expandButton = document.createElement('button');
            expandButton.type = 'button';
            expandButton.className = 'mermaid-expand-button';
            expandButton.setAttribute('aria-label', 'Expand diagram');
            expandButton.innerHTML = expandIcon;
            expandButton.addEventListener('click', (event) => {
                event.stopPropagation();
                openMermaidModal(diagram);
            });

            diagram.appendChild(expandButton);
        }
    };

    const enhance = () => enhanceMermaidDiagrams();
    const observer = new MutationObserver(enhance);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            enhance();
            observer.observe(document.body, { childList: true, subtree: true });
        }, { once: true });
    } else {
        enhance();
        observer.observe(document.body, { childList: true, subtree: true });
    }

    const syncTheme = () => {
        const newIsLight = isLightTheme();
        if (newIsLight !== lastThemeWasLight) {
            window.location.reload();
        }
    };

    const themeList = document.getElementById('mdbook-theme-list');
    if (themeList) {
        for (const button of themeList.querySelectorAll('button.theme')) {
            button.addEventListener('click', () => {
                window.setTimeout(syncTheme, 0);
            });
        }
    }
    const themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
})();
