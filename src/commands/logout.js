/**
 * Logout Command
 *
 * Navigate to the logout page.
 *
 * Usage: logout
 * Example: logout
 */

(function() {
  const command = {
    name: 'logout',
    aliases: ['signout', 'lo', 'bye'],
    description: 'Navigate to the logout page',
    usage: 'logout',
    examples: [
      'logout - Sign out'
    ],

    /**
     * Validate arguments
     */
    validate(args) {
      // No arguments needed
      return true;
    },

    /**
     * Execute the logout command
     */
    async execute(args, ctx) {
      const { ui, context } = ctx;

      const instanceUrl = await context.getInstanceUrl();
      if (!instanceUrl) {
        ui.showError('Unable to detect instance.');
        return;
      }

      const logoutUrl = `${instanceUrl}/logout.do`;

      ui.showSuccess('Signing out...');
      ui.hide();

      window.location.href = logoutUrl;
    }
  };

  // Register command
  if (window.GlassCommandRegistry) {
    window.GlassCommandRegistry.register(command);
  }
})();
