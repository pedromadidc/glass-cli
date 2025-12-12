/**
 * Me Command
 *
 * Navigate to the current user's sys_user record.
 *
 * Usage: me
 * Example: me
 */

(function() {
  const command = {
    name: 'me',
    aliases: ['myprofile', 'profile'],
    description: 'View your own user record',
    usage: 'me',
    examples: [
      'me - Open your user profile record'
    ],

    /**
     * Validate arguments
     */
    validate(args) {
      // No arguments needed
      return true;
    },

    /**
     * Execute the me command
     */
    async execute(args, ctx) {
      const { ui, api, context } = ctx;

      const instanceUrl = await context.getInstanceUrl();
      if (!instanceUrl) {
        ui.showError('Unable to detect instance.');
        return;
      }

      ui.showSuccess('Loading your profile...');
      ui.hide();

      try {
        // Get current user information
        const userInfo = await api.getCurrentUser(instanceUrl);

        if (!userInfo || !userInfo.sys_id) {
          ui.show();
          ui.showError('Unable to retrieve your user information.');
          return;
        }

        // Navigate to the user's sys_user record
        const userUrl = `${instanceUrl}/sys_user.do?sys_id=${userInfo.sys_id}`;
        window.location.href = userUrl;

      } catch (error) {
        ui.show();
        ui.showError('Failed to load user profile: ' + error.message);
      }
    }
  };

  // Register command
  if (window.GlassCommandRegistry) {
    window.GlassCommandRegistry.register(command);
  }
})();
