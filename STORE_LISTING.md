# Chrome Web Store Listing Information

Use this information when submitting to the Chrome Web Store.

---

## Extension Name
Glass CLI

## Short Description (132 characters max)
A command-line interface for ServiceNow platform development. Navigate, search, impersonate users, check ACLs and more.

## Detailed Description

Glass CLI is a powerful command-line interface that appears as a beautiful glass sphere floating icon on ServiceNow pages. Click the sphere or press Ctrl+Shift+G to expand it into a CLI for quick platform navigation and development tasks.

**Key Features:**

- Beautiful glass sphere UI with smooth animations
- 30+ built-in commands for platform development
- Smart autocomplete for commands and table names
- Command history navigation
- Uses your existing browser session - no additional login required
- Customizable keyboard shortcut

**Available Commands:**

Navigation:
- list, do, filter - Navigate to table lists, forms, and filtered views
- home, login, logout - Quick navigation
- record - Open any record by sys_id

User Management:
- impersonate - Impersonate any user by username
- me - View current user information
- mirror - Copy roles/groups from one user to another

Development Tools:
- acl - Check ACL permissions for users on tables/records/fields
- background - Execute background scripts
- code - Search and navigate to script records
- explode - Show technical field names on forms
- postman - Export API definitions

Platform Administration:
- cache - Clear platform caches
- config - Open system configuration pages
- retrievesets - Retrieve update sets from remote instances
- stats - View platform statistics

Search:
- keyword - Search records using keywords
- random - Open a random record from any table

**Privacy:**
Glass CLI stores only your preferences locally. No data is collected or transmitted. See our privacy policy for details.

**Disclaimer:**
This is an independent, community-developed tool. Not affiliated with or endorsed by ServiceNow, Inc. Provided "as is" without warranty.

---

## Category
Developer Tools

## Language
English

---

## Required Assets

### Icons (PNG format required)
- icon16.png (16x16 pixels)
- icon48.png (48x48 pixels)
- icon128.png (128x128 pixels)

### Screenshots (1280x800 or 640x400 recommended)
You'll need 1-5 screenshots showing:
1. The glass sphere floating icon on a ServiceNow page
2. The expanded CLI with command input
3. Command autocomplete in action
4. A results page (e.g., ACL check results)
5. The settings popup

### Promotional Images (optional but recommended)
- Small promo tile: 440x280 pixels
- Large promo tile: 920x680 pixels
- Marquee promo tile: 1400x560 pixels

---

## URLs to Provide

### Privacy Policy URL
Host the PRIVACY_POLICY.md content at a public URL, for example:
- GitHub Pages: https://yourusername.github.io/glass/privacy-policy
- Or raw GitHub: https://github.com/yourusername/glass/blob/main/PRIVACY_POLICY.md

---

## Single Purpose Description
(Required by Chrome Web Store - explain the single purpose of your extension)

"Glass CLI provides a command-line interface for navigating and performing development tasks on ServiceNow platform pages."

---

## Permission Justifications
(May be requested during review)

### storage
"Required to save user preferences (keyboard shortcut, UI position) and cache table definitions locally for autocomplete functionality."

### activeTab
"Required to display the floating icon interface and execute commands on the current ServiceNow page when the user activates the extension."

### Host permissions (servicenow.com, service-now.com)
"The extension only functions on ServiceNow platform pages. These permissions allow the extension to inject the command interface and make API calls using the user's existing authenticated session."

