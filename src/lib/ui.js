/**
 * Glass UI - Unified Interface
 * 
 * This module provides a consistent API for the Glass CLI,
 * delegating to the radial UI when available.
 */

class GlassUI {
  constructor() {
    this.commandHistory = [];
    this.historyIndex = -1;
    this.onExecute = null;
  }

  /**
   * Initialize the UI
   */
  init(options = {}) {
    this.onExecute = options.onExecute || null;
    
    // Connect to radial UI if available
    if (window.GlassRadialUI) {
      window.GlassRadialUI.setOnExecute((command) => {
        if (this.onExecute) {
          this.onExecute(command);
        }
      });
    }
  }

  /**
   * Show the CLI
   */
  show() {
    if (window.GlassRadialUI) {
      window.GlassRadialUI.activate();
    }
  }

  /**
   * Hide the CLI
   */
  hide() {
    if (window.GlassRadialUI) {
      window.GlassRadialUI.deactivate();
    }
  }

  /**
   * Toggle visibility
   */
  toggle() {
    if (window.GlassRadialUI) {
      window.GlassRadialUI.toggle();
    }
  }

  /**
   * Check if visible
   */
  isVisible() {
    if (window.GlassRadialUI) {
      return window.GlassRadialUI.isActive();
    }
    return false;
  }

  /**
   * Show feedback message
   */
  showFeedback(message, type = 'info', autoHide = 0) {
    if (window.GlassRadialUI) {
      window.GlassRadialUI.showFeedback(message, type, autoHide);
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    this.showFeedback(message, 'error');
  }

  /**
   * Show success message
   */
  showSuccess(message, autoHide = 2000) {
    this.showFeedback(message, 'success', autoHide);
  }

  /**
   * Show info message
   */
  showInfo(message) {
    this.showFeedback(message, 'info');
  }

  /**
   * Clear command history
   */
  clearHistory() {
    this.commandHistory = [];
    this.historyIndex = -1;
  }
}

// Export singleton instance
window.GlassUI = window.GlassUI || new GlassUI();
