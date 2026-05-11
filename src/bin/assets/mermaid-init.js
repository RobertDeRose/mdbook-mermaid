// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

(() => {
    const darkThemes = ['ayu', 'navy', 'coal'];
    const mermaidModalId = 'mermaid-diagram-modal';
    const maximizeIcon = `
        <svg viewBox="0 0 448 512" aria-hidden="true" focusable="false">
            <path fill="currentColor" d="M168 32L24 32C10.7 32 0 42.7 0 56L0 200c0 9.7 5.8 18.5 14.8 22.2S34.1 223.8 41 217l40-40 79 79-79 79-40-40c-6.9-6.9-17.2-8.9-26.2-5.2S0 302.3 0 312L0 456c0 13.3 10.7 24 24 24l144 0c9.7 0 18.5-5.8 22.2-14.8s1.7-19.3-5.2-26.2l-40-40 79-79 79 79-40 40c-6.9 6.9-8.9 17.2-5.2 26.2S270.3 480 280 480l144 0c13.3 0 24-10.7 24-24l0-144c0-9.7-5.8-18.5-14.8-22.2s-19.3-1.7-26.2 5.2l-40 40-79-79 79-79 40 40c6.9 6.9 17.2 8.9 26.2 5.2S448 209.7 448 200l0-144c0-13.3-10.7-24-24-24L280 32c-9.7 0-18.5 5.8-22.2 14.8S256.2 66.1 263 73l40 40-79 79-79-79 40-40c6.9-6.9 8.9-17.2 5.2-26.2S177.7 32 168 32z"/>
        </svg>
    `;
    const closeIcon = `
        <svg viewBox="0 0 384 512" aria-hidden="true" focusable="false">
            <path fill="currentColor" d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/>
        </svg>
    `;

    // Determine whether the current theme is light or dark.
    // The HTML element carries the resolved theme name as a class (e.g. "navy", "light").
    // For the auto/default_theme case, mdbook resolves it to the actual theme name before
    // setting the class, so we only need to check against the known dark theme names.
    const classList = document.getElementsByTagName('html')[0].classList;

    let lastThemeWasLight = true;
    for (const cssClass of classList) {
        if (darkThemes.includes(cssClass)) {
            lastThemeWasLight = false;
            break;
        }
    }

    const theme = lastThemeWasLight ? 'default' : 'dark';
    mermaid.initialize({ startOnLoad: true, theme });

    // --- Expand / modal functionality ---

    let modal = null;

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

        content.innerHTML = '';
        const clone = sourceSvg.cloneNode(true);
        clone.style.width = '100%';
        clone.style.height = 'auto';
        clone.style.maxWidth = 'none';
        content.appendChild(clone);

        const heading = sourcePre.previousElementSibling;
        title.textContent = heading?.textContent?.trim() || 'Diagram';

        modal.hidden = false;
        document.body.classList.add('mermaid-modal-open');
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
                    <strong id="${mermaidModalId}-title" class="mermaid-modal__title">Diagram</strong>
                    <button type="button" class="mermaid-modal__close" aria-label="Close expanded diagram">${closeIcon}</button>
                </div>
                <div class="mermaid-modal__content"></div>
            </div>
        `;

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

        document.body.appendChild(el);
        return el;
    };

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeMermaidModal();
    });

    // Add expand buttons to rendered mermaid diagrams.
    // Mermaid renders asynchronously after startOnLoad, so we wait for SVGs to appear.
    const enhanceMermaidDiagrams = () => {
        for (const diagram of document.querySelectorAll('pre.mermaid')) {
            if (!diagram.querySelector('svg')) continue;
            if (diagram.querySelector('.mermaid-expand-button')) continue;

            const expandButton = document.createElement('button');
            expandButton.type = 'button';
            expandButton.className = 'mermaid-expand-button';
            expandButton.setAttribute('aria-label', 'Expand diagram');
            expandButton.innerHTML = maximizeIcon;
            expandButton.addEventListener('click', (event) => {
                event.stopPropagation();
                openMermaidModal(diagram);
            });

            diagram.appendChild(expandButton);
        }
    };

    // Add expand buttons once mermaid has rendered SVGs into pre.mermaid elements.
    // Use a MutationObserver to handle diagrams that render asynchronously.
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

    // Simplest way to make mermaid re-render the diagrams in the new theme is via refreshing the page.
    // Only reload when the theme actually changes between light and dark categories.
    // For the "Auto" button (id="mdbook-theme-default_theme"), we resolve via prefers-color-scheme.

    const isLightTheme = (themeId) => {
        if (themeId === 'default_theme') {
            return !window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return !darkThemes.includes(themeId);
    };

    const themeList = document.getElementById('mdbook-theme-list');
    if (themeList) {
        for (const button of themeList.querySelectorAll('button.theme')) {
            button.addEventListener('click', () => {
                const themeId = button.id.replace('mdbook-theme-', '');
                const newIsLight = isLightTheme(themeId);
                if (newIsLight !== lastThemeWasLight) {
                    window.location.reload();
                }
            });
        }
    }
})();
