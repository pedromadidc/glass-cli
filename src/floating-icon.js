/**
 * Glass Pill UI
 *
 * A floating command interface with autocomplete
 * Green-tinted glass aesthetic with carousel command selector
 */

(function() {
  'use strict';

  let container = null;
  let mainCircle = null;
  let letterSpan = null;
  let inputField = null;
  let autocompleteField = null;
  let commandCarousel = null;
  let carouselInner = null;
  let feedbackDiv = null;
  
  let isDragging = false;
  let hasMoved = false;
  let dragOffset = { x: 0, y: 0 };
  let isActive = false;
  let currentShortcutText = 'Ctrl+Shift+G';
  
  // Command state
  let visibleCommands = [];
  let selectedIndex = 0;
  let commandHistory = [];
  let historyIndex = -1;
  let onExecuteCallback = null;

  const CIRCLE_SIZE = 58;
  const CIRCLE_WIDTH_ACTIVE = 340;
  const CAROUSEL_HEIGHT = 28;

  // Glass colors - frosted glass aesthetic
  const GLASS_PRIMARY = 'rgba(255, 255, 255, 0.12)';
  const GLASS_SECONDARY = 'rgba(255, 255, 255, 0.08)';
  const GLASS_BORDER = 'rgba(255, 255, 255, 0.3)';
  const GLASS_SHADOW = 'rgba(0, 0, 0, 0.15)';
  const GLASS_TEXT = 'rgba(0, 0, 0, 0.8)';
  const GLASS_TEXT_DIM = 'rgba(0, 0, 0, 0.35)';
  const GLASS_ACCENT = '#000';

  function getAllCommands() {
    const registry = window.GlassCommandRegistry;
    if (!registry) return [];
    return registry.getAll().map(cmd => ({
      name: cmd.name,
      description: cmd.description,
      aliases: cmd.aliases || []
    }));
  }

  function filterCommands(input) {
    const allCommands = getAllCommands();
    if (!input) return allCommands;
    
    const lower = input.toLowerCase();
    return allCommands.filter(cmd => 
      cmd.name.toLowerCase().startsWith(lower) ||
      cmd.aliases.some(a => a.toLowerCase().startsWith(lower))
    );
  }

  function isInArgumentMode() {
    return inputField.value.includes(' ');
  }

  function getCommandPart() {
    const value = inputField.value;
    const spaceIdx = value.indexOf(' ');
    return spaceIdx > 0 ? value.substring(0, spaceIdx) : value;
  }

  function getArgumentPart() {
    const value = inputField.value;
    const spaceIdx = value.indexOf(' ');
    return spaceIdx > 0 ? value.substring(spaceIdx + 1) : '';
  }

  function getAutocompleteSuggestion() {
    const value = inputField.value;
    if (!value) return '';

    if (isInArgumentMode()) {
      const cmdPart = getCommandPart().toLowerCase();
      const argPart = getArgumentPart();
      
      const tableCommands = ['list', 'ls', 'l', 'do', 'new', 'create', 'filter', 'f', 'config', 'upload', 'random', 'rand', 'r'];
      const sourceCommands = ['retrievesets', 'retrieve', 'rs'];
      
      if (tableCommands.includes(cmdPart) && argPart.length >= 1 && window.GlassFindMatchingTables) {
        const matches = window.GlassFindMatchingTables(argPart);
        if (matches.length > 0) {
          const match = matches[0];
          const lowerArg = argPart.toLowerCase();
          
          if (match.name.toLowerCase().startsWith(lowerArg)) {
            return match.name.slice(argPart.length);
          }
          if (match.table.toLowerCase().startsWith(lowerArg)) {
            return match.table.slice(argPart.length);
          }
        }
      }
      
      // Autocomplete for update sources
      if (sourceCommands.includes(cmdPart) && argPart.length >= 1 && window.GlassFindMatchingSources) {
        const matches = window.GlassFindMatchingSources(argPart);
        if (matches.length > 0) {
          const match = matches[0];
          const lowerArg = argPart.toLowerCase();
          
          if (match.name.toLowerCase().startsWith(lowerArg)) {
            return match.name.slice(argPart.length);
          }
        }
      }
      return '';
    } else {
      const filtered = filterCommands(value);
      if (filtered.length > 0 && filtered[0].name.toLowerCase() !== value.toLowerCase()) {
        const match = filtered[0].name;
        if (match.toLowerCase().startsWith(value.toLowerCase())) {
          return match.slice(value.length);
        }
      }
      return '';
    }
  }

  function updateAutocomplete() {
    const suggestion = getAutocompleteSuggestion();
    autocompleteField.value = inputField.value + suggestion;
  }

  function acceptAutocomplete() {
    const suggestion = getAutocompleteSuggestion();
    if (suggestion) {
      inputField.value += suggestion;
      updateAutocomplete();
      updateCommandCarousel();
      return true;
    }
    return false;
  }

  function loadPosition(callback) {
    try {
      chrome.storage.sync.get(['glassIconPosition'], function(result) {
        if (chrome.runtime.lastError) {
          callback({ right: 20, top: 100 });
        } else {
          callback(result.glassIconPosition || { right: 20, top: 100 });
        }
      });
    } catch (e) {
      callback({ right: 20, top: 100 });
    }
  }

  function savePosition(position) {
    try {
      chrome.storage.sync.set({ glassIconPosition: position }, function() {
        if (chrome.runtime.lastError) {
          // Extension context may be invalidated, silently ignore
        }
      });
    } catch (e) {
      // Extension context invalidated, silently ignore
    }
  }

  function loadShortcut() {
    try {
      chrome.storage.sync.get(['cliShortcut'], function(result) {
        if (chrome.runtime.lastError) {
          currentShortcutText = 'Ctrl+Shift+G';
        } else {
          currentShortcutText = result.cliShortcut || 'Ctrl+Shift+G';
        }
      });
    } catch (e) {
      currentShortcutText = 'Ctrl+Shift+G';
    }
  }

  function createUI() {
    if (container) container.remove();
    if (document.getElementById('glass-ui-styles')) {
      document.getElementById('glass-ui-styles').remove();
    }

    container = document.createElement('div');
    container.id = 'glass-ui';

    mainCircle = document.createElement('div');
    mainCircle.className = 'glass-main';
    
    // Add shimmer light effect element
    const shimmerLight = document.createElement('div');
    shimmerLight.className = 'glass-shimmer';
    mainCircle.appendChild(shimmerLight);
    
    letterSpan = document.createElement('span');
    letterSpan.className = 'glass-letter';
    letterSpan.textContent = '';
    
    const inputContainer = document.createElement('div');
    inputContainer.className = 'glass-input-wrap';
    
    autocompleteField = document.createElement('input');
    autocompleteField.type = 'text';
    autocompleteField.className = 'glass-autocomplete';
    autocompleteField.disabled = true;
    autocompleteField.tabIndex = -1;
    
    inputField = document.createElement('input');
    inputField.type = 'text';
    inputField.className = 'glass-input';
    inputField.placeholder = 'command...';
    
    inputContainer.appendChild(autocompleteField);
    inputContainer.appendChild(inputField);
    
    mainCircle.appendChild(letterSpan);
    mainCircle.appendChild(inputContainer);

    // Command carousel - single pill with scrolling text
    commandCarousel = document.createElement('div');
    commandCarousel.className = 'glass-carousel';
    
    carouselInner = document.createElement('div');
    carouselInner.className = 'glass-carousel-inner';
    
    commandCarousel.appendChild(carouselInner);

    feedbackDiv = document.createElement('div');
    feedbackDiv.className = 'glass-feedback';

    container.appendChild(mainCircle);
    container.appendChild(commandCarousel);
    container.appendChild(feedbackDiv);

    loadPosition((pos) => {
      if (pos.right !== undefined) {
        container.style.right = pos.right + 'px';
        container.style.left = 'auto';
      }
      if (pos.left !== undefined) {
        container.style.left = pos.left + 'px';
        container.style.right = 'auto';
      }
      container.style.top = pos.top + 'px';
    });

    setupDragEvents();
    setupInputEvents();
    setupCarouselEvents();
    injectStyles();

    document.body.appendChild(container);
  }

  function setupDragEvents() {
    mainCircle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (isActive && e.target === inputField) return;
      
      // Skip normal drag if in play mode (let play.js handle it)
      if (window.GlassPlayMode && window.GlassPlayMode.isActive()) {
        return;
      }
      
      isDragging = true;
      hasMoved = false;
      const rect = container.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left - CIRCLE_SIZE / 2;
      dragOffset.y = e.clientY - rect.top - CIRCLE_SIZE / 2;
      
      mainCircle.setPointerCapture(e.pointerId);
      container.classList.add('dragging');
      e.preventDefault();
    });

    mainCircle.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      if (window.GlassPlayMode && window.GlassPlayMode.isActive()) return;
      hasMoved = true;
      
      const x = e.clientX - dragOffset.x - CIRCLE_SIZE / 2;
      const y = e.clientY - dragOffset.y - CIRCLE_SIZE / 2;
      
      const maxX = window.innerWidth - CIRCLE_SIZE;
      const maxY = window.innerHeight - CIRCLE_SIZE;
      
      container.style.left = Math.max(10, Math.min(x, maxX - 10)) + 'px';
      container.style.right = 'auto';
      container.style.top = Math.max(10, Math.min(y, maxY - 10)) + 'px';
    });

    mainCircle.addEventListener('pointerup', (e) => {
      if (!isDragging) return;
      mainCircle.releasePointerCapture(e.pointerId);
      endDrag();
    });

    mainCircle.addEventListener('lostpointercapture', () => {
      if (isDragging) endDrag();
    });
  }

  function endDrag() {
    const wasDragging = hasMoved;
    isDragging = false;
    container.classList.remove('dragging');
    
    const rect = container.getBoundingClientRect();
    const rightEdge = window.innerWidth - rect.right;
    
    if (rect.left < rightEdge) {
      savePosition({ left: rect.left, top: rect.top });
    } else {
      savePosition({ right: rightEdge, top: rect.top });
      container.style.right = rightEdge + 'px';
      container.style.left = 'auto';
    }

    if (!wasDragging) {
      toggleActive();
    }
  }

  function setupInputEvents() {
    inputField.addEventListener('input', () => {
      selectedIndex = 0;
      updateAutocomplete();
      updateCommandCarousel();
    });

    inputField.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'Enter':
          executeCommand();
          break;
        case 'Escape':
          deactivate();
          break;
        case 'Tab':
          e.preventDefault();
          if (!acceptAutocomplete() && !isInArgumentMode()) {
            selectCurrentCommand();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (!isInArgumentMode() && visibleCommands.length > 0) {
            scrollCommand(-1);
          } else {
            navigateHistory(-1);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (!isInArgumentMode() && visibleCommands.length > 0) {
            scrollCommand(1);
          } else {
            navigateHistory(1);
          }
          break;
        case 'ArrowRight':
          if (inputField.selectionStart === inputField.value.length && getAutocompleteSuggestion()) {
            e.preventDefault();
            acceptAutocomplete();
          }
          break;
      }
    });

    inputField.addEventListener('blur', () => {
      setTimeout(() => {
        if (isActive && !container.contains(document.activeElement)) {
          deactivate();
        }
      }, 150);
    });
  }

  function setupCarouselEvents() {
    commandCarousel.addEventListener('wheel', (e) => {
      if (!isActive || isInArgumentMode()) return;
      e.preventDefault();
      scrollCommand(e.deltaY > 0 ? -1 : 1);
    }, { passive: false });

    carouselInner.addEventListener('click', () => {
      if (visibleCommands.length > 0) {
        selectCurrentCommand();
      }
    });
  }

  function toggleActive() {
    isActive ? deactivate() : activate();
  }

  function activate() {
    isActive = true;
    container.classList.add('active');
    feedbackDiv.style.opacity = '0';
    
    selectedIndex = 0;
    inputField.value = '';
    autocompleteField.value = '';
    
    setTimeout(() => {
      inputField.focus();
      updateCommandCarousel();
    }, 100);
  }

  function deactivate() {
    isActive = false;
    container.classList.remove('active');
    inputField.value = '';
    autocompleteField.value = '';
    carouselInner.innerHTML = '';
    visibleCommands = [];
    selectedIndex = 0;
  }

  function updateCommandCarousel() {
    // Hide carousel when in argument mode
    if (!isActive || isInArgumentMode()) {
      commandCarousel.classList.add('hidden');
      return;
    }
    
    commandCarousel.classList.remove('hidden');
    
    const input = getCommandPart();
    visibleCommands = filterCommands(input);
    
    if (visibleCommands.length === 0) {
      carouselInner.innerHTML = '<span class="glass-carousel-empty">no matches</span>';
      return;
    }
    
    // Clamp index
    selectedIndex = Math.max(0, Math.min(selectedIndex, visibleCommands.length - 1));
    
    const cmd = visibleCommands[selectedIndex];
    const total = visibleCommands.length;
    
    carouselInner.innerHTML = `
      <span class="glass-carousel-cmd">${cmd.name}</span>
      <span class="glass-carousel-count">${selectedIndex + 1}/${total}</span>
    `;
  }

  function scrollCommand(dir) {
    if (visibleCommands.length === 0 || isInArgumentMode()) return;
    
    selectedIndex += dir;
    if (selectedIndex < 0) selectedIndex = visibleCommands.length - 1;
    if (selectedIndex >= visibleCommands.length) selectedIndex = 0;
    
    updateCommandCarousel();
  }

  function selectCurrentCommand() {
    if (visibleCommands.length === 0 || isInArgumentMode()) return;
    
    const cmd = visibleCommands[selectedIndex];
    const argPart = getArgumentPart();
    inputField.value = cmd.name + ' ' + argPart;
    inputField.focus();
    inputField.selectionStart = inputField.selectionEnd = inputField.value.length;
    updateAutocomplete();
    updateCommandCarousel();
  }

  function navigateHistory(dir) {
    if (commandHistory.length === 0) return;
    
    historyIndex += dir;
    if (historyIndex < 0) {
      historyIndex = -1;
      inputField.value = '';
    } else if (historyIndex >= commandHistory.length) {
      historyIndex = commandHistory.length;
      inputField.value = '';
    } else {
      inputField.value = commandHistory[historyIndex];
    }
    updateAutocomplete();
    updateCommandCarousel();
  }

  function executeCommand() {
    if (getAutocompleteSuggestion()) {
      acceptAutocomplete();
    }
    
    const cmd = inputField.value.trim();
    if (!cmd) return;
    
    commandHistory.push(cmd);
    historyIndex = commandHistory.length;
    
    if (onExecuteCallback) {
      onExecuteCallback(cmd);
    }
    
    inputField.value = '';
    autocompleteField.value = '';
    updateCommandCarousel();
  }

  function showFeedback(message, type = 'info', autoHide = 0) {
    feedbackDiv.textContent = message;
    feedbackDiv.className = 'glass-feedback ' + type;
    feedbackDiv.style.opacity = '1';
    
    if (autoHide > 0) {
      setTimeout(() => {
        feedbackDiv.style.opacity = '0';
      }, autoHide);
    }
  }

  function injectStyles() {
    const style = document.createElement('style');
    style.id = 'glass-ui-styles';
    style.textContent = `
      #glass-ui {
        position: fixed;
        top: 100px;
        right: 20px;
        z-index: 2147483647;
        user-select: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        touch-action: none;
      }

      .glass-main {
        width: ${CIRCLE_SIZE}px;
        height: ${CIRCLE_SIZE}px;
        border-radius: 9999px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        /* Glass sphere gradient - creates 3D spherical look */
        background:
          radial-gradient(ellipse 60% 40% at 50% 15%, rgba(255, 255, 255, 0.7) 0%, transparent 50%),
          radial-gradient(ellipse 80% 50% at 50% 95%, rgba(0, 0, 0, 0.1) 0%, transparent 50%),
          radial-gradient(ellipse 100% 100% at 50% 50%, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 40%, rgba(200, 200, 200, 0.05) 100%);
        /* Border visible on both light and dark backgrounds */
        border: 1px solid rgba(128, 128, 128, 0.3);
        /* Multi-layered shadow for 3D depth - visible on white backgrounds */
        box-shadow: 
          0 2px 4px rgba(0, 0, 0, 0.15),
          0 8px 16px rgba(0, 0, 0, 0.2),
          0 16px 32px rgba(0, 0, 0, 0.15),
          inset 0 -12px 20px rgba(0, 0, 0, 0.15),
          inset 0 6px 12px rgba(255, 255, 255, 0.25);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        color: #111;
        /* No transition for shrinking - instant snap back to sphere */
        transition: none;
        position: relative;
        z-index: 10;
        overflow: hidden;
      }

      /* Glass sphere highlight reflection */
      .glass-main::before {
        content: '';
        position: absolute;
        top: 4px;
        left: 12px;
        right: 12px;
        height: 18px;
        background: radial-gradient(ellipse 100% 100% at 50% 0%, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.2) 40%, transparent 70%);
        border-radius: 50%;
        pointer-events: none;
        transition: none;
      }

      /* Bottom reflection for sphere */
      .glass-main::after {
        content: '';
        position: absolute;
        bottom: 3px;
        left: 20%;
        right: 20%;
        height: 8px;
        background: radial-gradient(ellipse 100% 100% at 50% 100%, rgba(255, 255, 255, 0.2) 0%, transparent 70%);
        border-radius: 50%;
        pointer-events: none;
        transition: none;
      }

      #glass-ui.active .glass-main {
        width: ${CIRCLE_WIDTH_ACTIVE}px;
        border-radius: 9999px;
        /* Smooth transition for expanding */
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        /* Flatter gradient when expanded */
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.1) 20%, transparent 50%),
          radial-gradient(ellipse 100% 200% at 50% 100%, rgba(0, 0, 0, 0.1) 0%, transparent 50%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.15) 0%, rgba(240, 240, 240, 0.1) 100%);
      }

      #glass-ui.active .glass-main::before {
        left: 16px;
        right: 16px;
        height: 14px;
        top: 3px;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      }

      #glass-ui.active .glass-main::after {
        opacity: 0.5;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      }

      #glass-ui.dragging .glass-main {
        cursor: grabbing;
        transform: scale(1.05);
        box-shadow: 
          0 4px 8px rgba(0, 0, 0, 0.15),
          0 12px 24px rgba(0, 0, 0, 0.2),
          0 20px 40px rgba(0, 0, 0, 0.15),
          inset 0 -8px 16px rgba(0, 0, 0, 0.1),
          inset 0 4px 8px rgba(255, 255, 255, 0.3);
      }

      .glass-letter {
        font-size: 26px;
        font-weight: 700;
        color: ${GLASS_TEXT};
        transition: opacity 0.15s, transform 0.2s;
        opacity: 0;
        position: absolute;
        pointer-events: none;
      }

      #glass-ui.active .glass-letter {
        opacity: 0;
        transform: scale(0.5);
        position: absolute;
        pointer-events: none;
      }

      /* Inner depth layer for glass effect */
      .glass-shimmer {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        border-radius: 50%;
        overflow: hidden;
        pointer-events: none;
        /* Inner shadow for depth - visible on white backgrounds */
        box-shadow:
          inset 0 0 20px rgba(0, 0, 0, 0.15),
          inset 0 -10px 20px rgba(0, 0, 0, 0.1),
          inset 0 10px 15px rgba(255, 255, 255, 0.1);
        /* Subtle dark edge gradient */
        background: radial-gradient(
          ellipse 80% 80% at 50% 50%,
          transparent 50%,
          rgba(0, 0, 0, 0.08) 80%,
          rgba(0, 0, 0, 0.15) 100%
        );
      }

      /* Hide inner layer when active/expanded */
      #glass-ui.active .glass-shimmer {
        opacity: 0;
      }

      #glass-ui.dragging .glass-shimmer {
        opacity: 0;
      }

      .glass-input-wrap {
        position: absolute;
        left: 16px;
        right: 16px;
        height: 22px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.15s;
      }

      #glass-ui.active .glass-input-wrap {
        opacity: 1;
        pointer-events: auto;
      }

      .glass-autocomplete,
      .glass-input {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        border: none;
        outline: none;
        font-size: 15px;
        font-family: 'SF Mono', Monaco, Consolas, monospace;
        text-align: left;
        padding: 0;
        margin: 0;
      }

      .glass-autocomplete {
        color: ${GLASS_TEXT_DIM};
        z-index: 1;
      }

      .glass-input {
        color: ${GLASS_TEXT};
        z-index: 2;
        caret-color: ${GLASS_ACCENT};
      }

      .glass-input::placeholder {
        color: ${GLASS_TEXT_DIM};
      }

      /* Command carousel */
      .glass-carousel {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        margin-top: 8px;
        height: ${CAROUSEL_HEIGHT}px;
        padding: 0 4px;
        background: rgba(255, 255, 255, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: ${CAROUSEL_HEIGHT}px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        color: #111;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s, transform 0.2s;
        transform: translateY(-4px) scale(0.95);
      }

      #glass-ui.active .glass-carousel {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0) scale(1);
      }

      .glass-carousel.hidden {
        opacity: 0 !important;
        pointer-events: none !important;
        transform: translateY(-4px) scale(0.95) !important;
      }

      .glass-carousel-inner {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        cursor: pointer;
        padding: 0 8px;
        min-width: 100px;
      }

      .glass-carousel-cmd {
        font-size: 13px;
        font-weight: 600;
        color: ${GLASS_TEXT};
        font-family: 'SF Mono', Monaco, Consolas, monospace;
      }

      .glass-carousel-count {
        font-size: 10px;
        color: ${GLASS_TEXT_DIM};
        font-weight: 500;
      }

      .glass-carousel-empty {
        font-size: 11px;
        color: ${GLASS_TEXT_DIM};
        font-style: italic;
      }

      .glass-feedback {
        position: absolute;
        top: calc(100% + ${CAROUSEL_HEIGHT + 18}px);
        left: 50%;
        transform: translateX(-50%);
        padding: 6px 14px;
        border-radius: 16px;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
        background: rgba(255, 255, 255, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.3);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        color: #111;
        opacity: 0;
        transition: opacity 0.3s;
        pointer-events: none;
      }

      #glass-ui:not(.active) .glass-feedback {
        top: calc(0% - 40px);
      }

      .glass-feedback.success { background: #4caf50; color: white; }
      .glass-feedback.error { background: #e57373; color: white; }
      .glass-feedback.info { background: ${GLASS_ACCENT}; color: white; }

    `;
    document.head.appendChild(style);
  }

  function init() {
    loadShortcut();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createUI);
    } else {
      createUI();
    }

    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(createUI, 100);
      }
    });
    observer.observe(document, { subtree: true, childList: true });

    window.GlassFloatingIcon = {
      show: () => { if (container) container.style.opacity = '1'; },
      hide: () => { if (container) container.style.opacity = '0'; }
    };

    window.GlassRadialUI = {
      activate,
      deactivate,
      toggle: toggleActive,
      isActive: () => isActive,
      setOnExecute: (cb) => { onExecuteCallback = cb; },
      showFeedback
    };
  }

  init();
})();
