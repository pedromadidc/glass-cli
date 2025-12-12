/**
 * Login Command
 *
 * Navigate to the login page.
 *
 * Usage: login
 * Example: login
 */

(function() {
  const command = {
    name: 'login',
    aliases: ['signin', 'li'],
    description: 'Navigate to the login page',
    usage: 'login',
    examples: [
      'login - Go to the platform login page'
    ],

    /**
     * Validate arguments
     */
    validate(args) {
      // No arguments needed
      return true;
    },

    /**
     * Execute the login command
     */
    async execute(args, ctx) {
      const { ui, context } = ctx;

      const instanceUrl = await context.getInstanceUrl();
      if (!instanceUrl) {
        ui.showError('Unable to detect instance.');
        return;
      }

      const loginUrl = `${instanceUrl}/login.do`;

      ui.showSuccess('Going to login page...');
      ui.hide();

      window.location.href = loginUrl;
    }
  };

  // Register command
  if (window.GlassCommandRegistry) {
    window.GlassCommandRegistry.register(command);
  }
})();
