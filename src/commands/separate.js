/**
 * Separate Command
 *
 * Locks a user out by setting active=false, locked_out=true and removes all
 * their roles and group memberships via the Table API.
 *
 * Usage: separate <username>
 */

(function () {
  const command = {
    name: 'separate',
    aliases: ['lockout', 'terminate'],
    description: 'Lock out a user and strip their roles/groups',
    usage: 'separate <username>',
    examples: ['separate john.doe', 'lockout alice'],

    validate(args) {
      if (args.length !== 1) {
        return 'Usage: separate <username>';
      }
      return true;
    },

    async execute(args, ctx) {
      const username = args[0];
      const { ui, api, context } = ctx;

      const instanceUrl = await context.getInstanceUrl();
      if (!instanceUrl) {
        ui.showError('Unable to detect instance.');
        return;
      }

      try {
        await api.ensureBridgeReady();
      } catch (err) {
        ui.showError('Failed to prepare Platform API bridge.');
        return;
      }

      const logMessages = [];
      const log = (msg) => {
        logMessages.push(msg);
        ui.showInfo(logMessages.join('\n'));
      };

      log(`Separating user: ${username}`);

      const tableGet = async (table, params) => {
        const options = {
          displayValue: false
        };
        if (params?.sysparm_query) options.query = params.sysparm_query;
        if (params?.sysparm_fields) options.fields = params.sysparm_fields.split(',');
        if (params?.sysparm_limit) options.limit = parseInt(params.sysparm_limit, 10);

        const result = await api.tableGet(instanceUrl, table, options);
        log(`GET ${table} → ${result?.length || 0} records`);
        return result;
      };

      const tableDelete = async (table, sysId) => {
        await api.request(instanceUrl, `/api/now/table/${table}/${sysId}`, {
          method: 'DELETE'
        });
        log(`DELETE ${table}/${sysId}`);
      };

      const tablePatch = async (table, sysId, payload) => {
        await api.request(instanceUrl, `/api/now/table/${table}/${sysId}`, {
          method: 'PATCH',
          body: payload
        });
        log(`PATCH ${table}/${sysId} → ${JSON.stringify(payload)}`);
      };

      try {
        const users = await tableGet('sys_user', {
          sysparm_query: `user_name=${username}`,
          sysparm_fields: 'sys_id,user_name',
          sysparm_limit: 1
        });
        const user = users[0];
        if (!user) {
          throw new Error(`User not found: ${username}`);
        }

        const userId = user.sys_id;

        await tablePatch('sys_user', userId, { active: false, locked_out: true });

        // 1. Delete group memberships first (removes inherited roles)
        const groups = await tableGet('sys_user_grmember', {
          sysparm_query: `user=${userId}`,
          sysparm_fields: 'sys_id',
          sysparm_limit: 1000
        });
        for (const g of groups) {
          await tableDelete('sys_user_grmember', g.sys_id);
        }

        // 2. Delete non-inherited roles
        const nonInheritedRoles = await tableGet('sys_user_has_role', {
          sysparm_query: `user=${userId}^inherited=false`,
          sysparm_fields: 'sys_id,role',
          sysparm_limit: 1000
        });
        for (const r of nonInheritedRoles) {
          await tableDelete('sys_user_has_role', r.sys_id);
        }

        // 3. Try to delete any remaining roles (might be deletable now after group removal)
        const remainingRoles = await tableGet('sys_user_has_role', {
          sysparm_query: `user=${userId}`,
          sysparm_fields: 'sys_id,role,inherited',
          sysparm_limit: 1000
        });
        for (const r of remainingRoles) {
          try {
            await tableDelete('sys_user_has_role', r.sys_id);
          } catch (deleteErr) {
            // Log but don't fail - some inherited roles might still be protected
            log(`SKIP ${r.role} (inherited=${r.inherited}) - ${deleteErr.message || 'protected'}`);
          }
        }

        ui.showSuccess(`User ${username} is now separated.`);
      } catch (err) {
        ui.showError(`Separate failed: ${err.message || err}`);
      }
    }
  };

  if (window.GlassCommandRegistry) {
    window.GlassCommandRegistry.register(command);
  }
})();
