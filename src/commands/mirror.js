/**
 * Mirror Access Command (Table API only)
 *
 * Mirror roles and groups from one platform user to another.
 *
 * Uses only the platform Table API:
 * - sys_user
 * - sys_user_has_role
 * - sys_user_grmember
 *
 * Usage: mirror <source_username> <target_username>
 */

(function () {
    const command = {
      name: 'mirror',
      aliases: ['mirroraccess', 'cloneaccess'],
      description: 'Mirror roles and groups from one user to another (Table API only)',
      usage: 'mirror <source_username> <target_username>',
      examples: [
        'mirror alice bob           - Wipe bob and copy alice\'s roles/groups',
        'mirror john.doe jane.doe   - Mirror john.doe → jane.doe'
      ],
  
      validate(args) {
        if (args.length < 2) {
          return 'Usage: mirror <source_username> <target_username>';
        }
        if (args[0] === args[1]) {
          return 'Source and target usernames must be different';
        }
        return true;
      },
  
      async execute(args, ctx) {
        const [sourceUsername, targetUsername] = args;
        const { ui, api, context } = ctx;

        const instanceUrl = await context.getInstanceUrl();
        if (!instanceUrl) {
          ui.showError('Unable to detect instance. Please ensure you are on a platform page.');
          return;
        }

        // Ensure API bridge is loaded
        try {
          await api.ensureBridgeReady();
        } catch (error) {
          ui.showError('Failed to initialize extension components');
          return;
        }
  
        const logMessages = [];
        const log = (msg) => {
          logMessages.push(msg);
          ui.showInfo(logMessages.join('\n'));
        };

        log(`Mirroring access: ${sourceUsername} → ${targetUsername}...`);
  
        // Use the API service for authenticated requests
        async function tableGet(table, params) {
          const options = {
            displayValue: false
          };

          if (params) {
            // Handle sysparm_query (the actual query filter)
            if (params.sysparm_query) {
              options.query = params.sysparm_query;
            }

            // Handle sysparm_fields (which fields to return)
            if (params.sysparm_fields) {
              options.fields = params.sysparm_fields.split(',');
            }

            // Handle sysparm_limit
            if (params.sysparm_limit) {
              options.limit = parseInt(params.sysparm_limit);
            }
          }

          const result = await api.tableGet(instanceUrl, table, options);
          log(`GET ${table} → ${result ? result.length : 0} items`);
          return result;
        }

        async function tablePost(table, body) {
          const res = await api.request(instanceUrl, `/api/now/table/${table}`, {
            method: 'POST',
            body: body
          });
          log(`POST ${table} → ${JSON.stringify(body)}`);
          return res;
        }

        async function tableDelete(table, sysId) {
          await api.request(instanceUrl, `/api/now/table/${table}/${sysId}`, {
            method: 'DELETE'
          });
          log(`DELETE ${table}/${sysId}`);
        }
  
        async function getUserByUserName(userName) {
          const users = await tableGet('sys_user', {
            sysparm_query: `user_name=${userName}`,
            sysparm_fields: 'sys_id,user_name',
            sysparm_limit: 1
          });
          return users[0] || null;
        }
  
        async function getRoleName(roleSysId) {
          const roles = await tableGet('sys_user_role', {
            sysparm_query: `sys_id=${roleSysId}`,
            sysparm_fields: 'name',
            sysparm_limit: 1
          });
          return roles[0]?.name || null;
        }

        function isSecurityAdminRole(name) {
          return name === 'security_admin';
        }

        try {
  
          // 1) Resolve users
          const sourceUser = await getUserByUserName(sourceUsername);
          const targetUser = await getUserByUserName(targetUsername);
  
          if (!sourceUser) {
            throw new Error(`Source user not found: ${sourceUsername}`);
          }
          if (!targetUser) {
            throw new Error(`Target user not found: ${targetUsername}`);
          }
  
          const sourceId = sourceUser.sys_id;
          const targetId = targetUser.sys_id;
  
          // 2) Get source roles (non-inherited only)
          const sourceRoles = await tableGet('sys_user_has_role', {
            sysparm_query: `user=${sourceId}^inherited=false`,
            sysparm_fields: 'sys_id,role,inherited',
            sysparm_limit: 1000
          });
  
          // 3) Get source groups
          const sourceGroups = await tableGet('sys_user_grmember', {
            sysparm_query: `user=${sourceId}`,
            sysparm_fields: 'sys_id,group',
            sysparm_limit: 1000
          });
  
          // 4) Get target roles (non-inherited only) and delete them
          const targetRoles = await tableGet('sys_user_has_role', {
            sysparm_query: `user=${targetId}^inherited=false`,
            sysparm_fields: 'sys_id,role,inherited',
            sysparm_limit: 1000
          });
  
          let rolesDeleted = 0;
          for (const r of targetRoles) {
            const roleSysId = r.role?.value || r.role;
            const roleName = await getRoleName(roleSysId);
            if (roleName && isSecurityAdminRole(roleName)) {
              log(`Skipping deletion of ${roleName} (security_admin cannot be removed)`);
              continue;
            }
            await tableDelete('sys_user_has_role', r.sys_id);
            rolesDeleted++;
          }
  
          // 5) Get target groups and delete them
          const targetGroups = await tableGet('sys_user_grmember', {
            sysparm_query: `user=${targetId}`,
            sysparm_fields: 'sys_id,group',
            sysparm_limit: 1000
          });
  
          let groupsDeleted = 0;
          for (const g of targetGroups) {
            await tableDelete('sys_user_grmember', g.sys_id);
            groupsDeleted++;
          }
  
          // 6) Add source roles to target (non-inherited)
          let rolesCopied = 0;
          for (const r of sourceRoles) {
            const roleSysId = r.role?.value || r.role;
            const roleName = await getRoleName(roleSysId);
            if (roleName && isSecurityAdminRole(roleName)) {
              log('Skipping addition of security_admin role via REST');
              continue;
            }

            await tablePost('sys_user_has_role', {
              user: targetId,
              role: roleSysId,
              inherited: false
            });
            rolesCopied++;
          }
  
          // 7) Add source groups to target
          let groupsCopied = 0;
          for (const g of sourceGroups) {
            // Handle reference field for group assignment
            const groupSysId = g.group?.value || g.group;

            await tablePost('sys_user_grmember', {
              user: targetId,
              group: groupSysId
            });
            groupsCopied++;
          }
  
          ui.show();
          ui.showSuccess(
            [
              `Mirrored access from ${sourceUsername} → ${targetUsername}.`,
              `Roles deleted: ${rolesDeleted}, groups deleted: ${groupsDeleted}.`,
              `Roles copied: ${rolesCopied}, groups copied: ${groupsCopied}.`
            ].join('\n')
          );
        } catch (error) {
          ui.show();
          ui.showError(`Mirror failed: ${error.message || error}`);
        }
      }
    };
  
    if (window.GlassCommandRegistry) {
      window.GlassCommandRegistry.register(command);
    }
  })();  