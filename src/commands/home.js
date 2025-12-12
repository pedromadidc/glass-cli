/**
 * Home Command
 *
 * Navigate to the platform instance home page.
 *
 * Usage: home
 * Example: home
 */

(function() {
  const command = {
    name: 'home',
    aliases: [],
    description: 'Navigate to the instance home page',
    usage: 'home',
    examples: [
      'home - Go to the platform home page'
    ],

    /**
     * Validate arguments
     */
    validate(args) {
      // No arguments needed
      return true;
    },

    /**
     * Execute the home command
     */
    async execute(args, ctx) {
      const { ui, context } = ctx;

      const instanceUrl = await context.getInstanceUrl();
      if (!instanceUrl) {
        ui.showError('Unable to detect instance.');
        return;
      }

      ui.showSuccess('Going home...');
      ui.hide();

      // Navigate to the base instance URL (no path or arguments)
      window.location.href = instanceUrl;
    }
  };

  // Register command
  if (window.GlassCommandRegistry) {
    window.GlassCommandRegistry.register(command);
  }
})();
