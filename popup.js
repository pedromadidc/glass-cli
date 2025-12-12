// Glass Chrome Extension - Settings Popup

document.addEventListener('DOMContentLoaded', function() {
  const shortcutInput = document.getElementById('shortcut');
  const statusDiv = document.getElementById('status');

  let isRecording = false;
  let recordedKeys = new Set();

  // Load saved shortcut
  loadSavedShortcut();

  // Handle shortcut input recording
  shortcutInput.addEventListener('focus', function() {
    isRecording = true;
    recordedKeys.clear();
    shortcutInput.value = 'Recording...';
    shortcutInput.style.background = 'rgba(255, 255, 255, 0.15)';
  });

  shortcutInput.addEventListener('blur', function() {
    isRecording = false;
    shortcutInput.style.background = '';
    if (recordedKeys.size === 0) {
      loadSavedShortcut();
    }
  });

  shortcutInput.addEventListener('keydown', function(e) {
    if (!isRecording) return;

    e.preventDefault();

    // Clear previous recording on new keydown
    if (recordedKeys.size === 0) {
      recordedKeys.clear();
    }

    // Add modifier keys
    if (e.ctrlKey) recordedKeys.add('Ctrl');
    if (e.shiftKey) recordedKeys.add('Shift');
    if (e.altKey) recordedKeys.add('Alt');
    if (e.metaKey) recordedKeys.add('Cmd');

    // Add the main key (skip modifier keys)
    const key = e.key;
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
      recordedKeys.add(key.length === 1 ? key.toUpperCase() : key);
    }

    // Display the current combination
    const combo = Array.from(recordedKeys).join('+');
    shortcutInput.value = combo;
  });

  shortcutInput.addEventListener('keyup', function(e) {
    if (!isRecording) return;

    // Only save if we have a valid combination (at least one modifier + one key)
    const combo = Array.from(recordedKeys).join('+');
    if (recordedKeys.size >= 2) {
      saveShortcut(combo);
      showStatus('Shortcut saved!', 'success');
      setTimeout(() => {
        shortcutInput.blur();
      }, 300);
    } else if (recordedKeys.size > 0) {
      showStatus('Use at least one modifier (Ctrl, Shift, Alt, Cmd) + a key', 'error');
      setTimeout(() => {
        loadSavedShortcut();
        shortcutInput.blur();
      }, 2000);
    }
  });

  function loadSavedShortcut() {
    chrome.storage.sync.get(['cliShortcut'], function(result) {
      const savedShortcut = result.cliShortcut || 'Ctrl+Shift+G';
      shortcutInput.value = savedShortcut;
    });
  }

  function saveShortcut(shortcut) {
    chrome.storage.sync.set({cliShortcut: shortcut}, function() {
      if (chrome.runtime.lastError) {
        showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
      }
    });
  }

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';

    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 2500);
  }
});
