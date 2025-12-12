/**
 * Glass - Platform CLI Extension
 * 
 * Main entry point that initializes all components and sets up the extension.
 */

(function() {
  'use strict';

  // Keyboard shortcut configuration
  let currentShortcut = null;
  let shortcutListenerBound = false;

  /**
   * Parse shortcut string into key requirements
   * @param {string} shortcutString - e.g., "Ctrl+Shift+G"
   * @returns {Object} - Parsed shortcut object
   */
  function parseShortcut(shortcutString) {
    const keys = shortcutString.split('+').map(key => key.trim());
    return {
      ctrl: keys.includes('Ctrl'),
      shift: keys.includes('Shift'),
      alt: keys.includes('Alt'),
      meta: keys.includes('Meta'),
      key: keys.find(key => !['Ctrl', 'Shift', 'Alt', 'Meta'].includes(key))
    };
  }

  /**
   * Check if keyboard event matches shortcut
   * @param {KeyboardEvent} event 
   * @param {Object} shortcut 
   * @returns {boolean}
   */
  function matchesShortcut(event, shortcut) {
    if (!shortcut || !shortcut.key) return false;
    
    return event.ctrlKey === shortcut.ctrl &&
           event.shiftKey === shortcut.shift &&
           event.altKey === shortcut.alt &&
           event.metaKey === shortcut.meta &&
           event.key.toLowerCase() === shortcut.key.toLowerCase();
  }

  /**
   * Load shortcut from storage
   */
  function loadShortcut() {
    chrome.storage.sync.get(['cliShortcut'], function(result) {
      currentShortcut = parseShortcut(result.cliShortcut || 'Ctrl+Shift+G');
    });
  }

  /**
   * Handle global keyboard events
   * @param {KeyboardEvent} event
   */
  function handleKeyDown(event) {
    if (!currentShortcut) return;

    // Toggle CLI on shortcut
    if (matchesShortcut(event, currentShortcut)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (window.GlassUI) {
        window.GlassUI.toggle();
      }
      return false;
    }

    // ESC key closes CLI from anywhere
    if (event.key === 'Escape' && window.GlassUI && window.GlassUI.isVisible()) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      window.GlassUI.hide();
      return false;
    }
  }

  /**
   * Add keyboard listener to an element
   */
  function addKeyboardListener(target) {
    if (!target) return;
    
    try {
      target.addEventListener('keydown', handleKeyDown, true);
    } catch (e) {
      // Ignore cross-origin errors
    }
  }

  /**
   * Add listeners to all iframes on the page
   */
  function addIframeListeners() {
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      try {
        if (iframe.contentWindow) {
          addKeyboardListener(iframe.contentWindow);
          addKeyboardListener(iframe.contentDocument);
        }
      } catch (e) {
        // Cross-origin iframe, can't add listeners
      }
    });
  }

  /**
   * Execute a command
   * @param {string} commandLine - Full command string
   */
  async function executeCommand(commandLine) {
    const ui = window.GlassUI;
    const api = window.GlassAPI;
    const context = window.GlassContext;
    const registry = window.GlassCommandRegistry;

    try {
      await registry.execute(commandLine, {
        ui,
        api,
        context
      });
    } catch (error) {
      ui.showError(error.message);
    }
  }

  /**
   * Setup all keyboard listeners
   */
  function setupKeyboardListeners() {
    if (shortcutListenerBound) return;
    shortcutListenerBound = true;

    // Primary listeners with capture phase
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keydown', handleKeyDown, true);

    // Also listen on body
    if (document.body) {
      document.body.addEventListener('keydown', handleKeyDown, true);
    }

    // Add to iframes
    addIframeListeners();

    // Watch for new iframes
    const iframeObserver = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.tagName === 'IFRAME') {
            setTimeout(() => {
              try {
                if (node.contentWindow) {
                  addKeyboardListener(node.contentWindow);
                  addKeyboardListener(node.contentDocument);
                }
              } catch (e) {
                // Cross-origin
              }
            }, 100);
          }
        });
      });
    });
    iframeObserver.observe(document.body || document, { childList: true, subtree: true });

    // Periodically re-add listeners (platform removes them sometimes)
    setInterval(() => {
      addKeyboardListener(document);
      addKeyboardListener(window);
      if (document.body) {
        addKeyboardListener(document.body);
      }
      addIframeListeners();
    }, 2000);
  }

  /**
   * Initialize the extension
   */
  function initialize() {

    // Initialize UI
    window.GlassUI.init({
      onExecute: executeCommand
    });

    // Load keyboard shortcut
    loadShortcut();

    // Setup keyboard listeners
    setupKeyboardListeners();

    // Re-setup on navigation (for SPAs)
    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(setupKeyboardListeners, 500);
      }
    });
    urlObserver.observe(document, { subtree: true, childList: true });

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      if (request.action === 'showCli') {
        window.GlassUI.show();
      } else if (request.action === 'hideCli') {
        window.GlassUI.hide();
      } else if (request.action === 'updateShortcut') {
        currentShortcut = parseShortcut(request.shortcut);
      }
    });

    // Listen for shortcut changes from storage
    chrome.storage.onChanged.addListener(function(changes, namespace) {
      if (changes.cliShortcut) {
        currentShortcut = parseShortcut(changes.cliShortcut.newValue || 'Ctrl+Shift+G');
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
