/**
 * Impersonate Command
 * 
 * Impersonate a platform user by username or end impersonation.
 * Uses the platform UI impersonate API.
 * 
 * Usage: impersonate <username>
 *        impersonate end
 * Example: impersonate admin
 */

(function() {
  // Keywords that trigger end impersonation
  const END_KEYWORDS = ['end', 'exit', 'stop', 'quit', 'off', 'clear'];

  const command = {
    name: 'impersonate',
    aliases: ['imp', 'su'],
    description: 'Impersonate a user by username or end impersonation',
    usage: 'impersonate <username|end>',
    examples: [
      'impersonate admin       - Impersonate the admin user',
      'impersonate john.doe    - Impersonate user john.doe',
      'impersonate end         - End current impersonation'
    ],

    /**
     * Validate arguments
     * @param {Array<string>} args - Command arguments
     * @returns {true|string} - true if valid, error message if invalid
     */
    validate(args) {
      if (args.length === 0) {
        return 'Usage: impersonate <username|end>';
      }
      return true;
    },

    /**
     * Execute the impersonate command
     * @param {Array<string>} args - Command arguments
     * @param {Object} ctx - Execution context
     */
    async execute(args, ctx) {
      const target = args[0].toLowerCase();
      const { ui, api, context } = ctx;

      const instanceUrl = await context.getInstanceUrl();
      if (!instanceUrl) {
        ui.showError('Unable to detect instance. Please ensure you are on a platform page.');
        return;
      }

      // Check if user wants to end impersonation
      if (END_KEYWORDS.includes(target)) {
        ui.showSuccess('Ending impersonation...');
        ui.hide();

        try {
          
          await api.endImpersonate(instanceUrl);
          context.reload();
        } catch (error) {
          ui.show();
          ui.showError(`${error.message}`);
        }
        return;
      }

      // Normal impersonation flow
      const username = args[0];
      ui.showSuccess(`Impersonating user: ${username}...`);
      ui.hide();

      try {
        
        await api.impersonate(instanceUrl, username);
        context.reload();
      } catch (error) {
        ui.show();
        ui.showError(`Impersonation failed: ${error.message}`);
      }
    }
  };

  // Register command
  if (window.GlassCommandRegistry) {
    window.GlassCommandRegistry.register(command);
  }
})();

