/**
 * Online Command
 *
 * Show currently online/active users by querying sys_user_session table.
 * Shows users active in the last 5 minutes. Displays results in a new tab
 * using the unified Glass results page styling.
 *
 * Usage: online
 * Example: online
 */

(function() {
  const command = {
    name: 'online',
    aliases: ['who', 'active'],
    description: 'Show currently online/active users',
    usage: 'online',
    examples: [
      'online - Show all currently active user sessions'
    ],

    /**
     * Validate arguments
     */
    validate(args) {
      return true;
    },

    /**
     * Build the background script to find online users
     * @returns {string} - The GlideRecord script
     */
    buildOnlineUsersScript() {
      return `
function findOnlineUsers() {
  var encoded = "last_accessed>=javascript:gs.minutesAgoStart(5)";

  var gr = new GlideRecord('sys_user_session');
  gr.addEncodedQuery(encoded);
  gr.addNotNullQuery('name');
  gr.orderByDesc('last_accessed');
  gr.setLimit(500);
  gr.query();

  var seen = {};
  var results = [];

  while (gr.next()) {
    var userName = gr.name.toString();
    if (seen[userName]) {
      continue;
    }
    seen[userName] = true;

    results.push({
      user_name: userName,
      last_accessed: gr.last_accessed.getDisplayValue()
    });
  }

  gs.print('###RESULTS###');
  for (var i = 0; i < results.length; i++) {
    gs.print(JSON.stringify(results[i]));
  }
  gs.print('###END###');
}

findOnlineUsers();`;
    },

    /**
     * Execute the online command
     */
    async execute(args, ctx) {
      const { ui, context } = ctx;
      const resultsPage = window.GlassResultsPage;

      const instanceUrl = await context.getInstanceUrl();
      if (!instanceUrl) {
        ui.showError('Unable to detect instance.');
        return;
      }

      try {
        ui.showInfo('Checking active user sessions...');

        // Execute background script and parse results
        const script = this.buildOnlineUsersScript();
        const users = await window.GlassBackgroundScript.executeAndParse(
          script,
          '###RESULTS###',
          '###END###',
          { instanceUrl }
        );

        if (!users || users.length === 0) {
          ui.showError('No active users found in the last 5 minutes.');
          return;
        }

        // Build stats
        const statsHtml = resultsPage.buildStats([
          { value: users.length, label: 'Users Online' },
          { value: '5 min', label: 'Time Window' }
        ]);

        // Build user cards
        const userCards = users.map(user => ({
          title: user.user_name,
          subtitle: `Last active: ${user.last_accessed}`
        }));

        const content = statsHtml + resultsPage.buildSection('Active Users', 
          resultsPage.buildCardGrid(userCards)
        );

        const html = resultsPage.buildPage({
          title: `Active Users`,
          subtitle: `${users.length} users online in the last 5 minutes`,
          content: content
        });

        resultsPage.openPage(html);
        ui.hide();

      } catch (error) {
        ui.showError(`Failed to get online users: ${error.message}`);
      }
    }
  };

  // Register command
  if (window.GlassCommandRegistry) {
    window.GlassCommandRegistry.register(command);
  }
})();
