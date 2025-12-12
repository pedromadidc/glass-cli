/**
 * Pop Command
 *
 * Switch to classic UI by inserting /now/nav/ui/classic/params/target/ in the URL.
 * Only modifies if not already in classic view.
 *
 * Usage: pop
 * Example: pop
 */

(function() {
  const command = {
    name: 'pop',
    aliases: ['classic', 'switch'],
    description: 'Switch to classic UI view',
    usage: 'pop',
    examples: [
      'pop - Switch current page to classic UI'
    ],

    /**
     * Validate arguments
     */
    validate(args) {
      // No arguments needed
      return true;
    },

    /**
     * Execute the pop command
     */
    async execute(args, ctx) {
      const { ui } = ctx;

      const currentUrl = window.location.href;

      // Check if already in classic UI
      if (currentUrl.includes('/now/nav/ui/classic/params/target/')) {
        ui.showInfo('Already in classic UI view.');
        return;
      }

      // Find .com and insert the classic path after it
      const comIndex = currentUrl.indexOf('.com');
      if (comIndex === -1) {
        ui.showError('Unable to find .com in current URL.');
        return;
      }

      // Insert /now/nav/ui/classic/params/target/ after .com
      const classicUrl = currentUrl.slice(0, comIndex + 4) +
                        '/now/nav/ui/classic/params/target' +
                        currentUrl.slice(comIndex + 4);

      ui.showSuccess('Switching to classic UI...');
      ui.hide();

      window.location.href = classicUrl;
    }
  };

  // Register command
  if (window.GlassCommandRegistry) {
    window.GlassCommandRegistry.register(command);
  }
})();
