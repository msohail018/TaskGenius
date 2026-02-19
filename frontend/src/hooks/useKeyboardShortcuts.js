import { useEffect, useCallback } from 'react';

/**
 * useKeyboardShortcuts
 * Registers global keyboard shortcuts.
 * Automatically skips shortcuts when the user is focused inside
 * an input, textarea, or select field.
 *
 * @param {Array} shortcuts - Array of { key, ctrl, shift, action, description }
 */
const useKeyboardShortcuts = (shortcuts) => {
    const handleKeyDown = useCallback((e) => {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        const isTyping = ['input', 'textarea', 'select'].includes(activeTag);

        for (const shortcut of shortcuts) {
            const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
            const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : true;
            const shiftMatch = shortcut.shift ? e.shiftKey : true;

            // If ctrl is required, allow it even while typing
            // If ctrl is NOT required, skip while typing
            const skipWhenTyping = !shortcut.ctrl && isTyping;

            if (keyMatch && ctrlMatch && shiftMatch && !skipWhenTyping) {
                // Only prevent default for shortcuts that need it
                if (shortcut.preventDefault !== false) {
                    e.preventDefault();
                }
                shortcut.action(e);
                return;
            }
        }
    }, [shortcuts]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
};

export default useKeyboardShortcuts;
