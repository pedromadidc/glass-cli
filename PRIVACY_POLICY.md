# Privacy Policy for Glass CLI Extension

**Last Updated:** December 12, 2024

## Overview

Glass CLI ("the Extension") is a browser extension that provides a command-line interface for platform development. This privacy policy explains how the Extension handles your data.

## Data Collection

### What We DO NOT Collect

- **No Personal Information:** We do not collect, store, or transmit any personal information.
- **No Analytics:** We do not use any analytics or tracking services.
- **No External Servers:** We do not send any data to external servers owned or operated by us.
- **No Account Required:** The Extension does not require you to create an account.

### What We Store Locally

The Extension stores the following data **locally on your device only** using Chrome's storage API:

1. **User Preferences:**
   - Keyboard shortcut configuration
   - UI position preferences (where you drag the floating icon)

2. **Cache Data:**
   - Table definitions (for autocomplete functionality)
   - Update source lists (for the retrievesets command)
   - This cache is temporary and can be cleared at any time

This data never leaves your browser and is not accessible to us or any third party.

## Permissions Explained

### Storage Permission
Used to save your preferences and cache data locally on your device.

### ActiveTab Permission
Required to interact with the current tab when you invoke the Extension. This allows the Extension to:
- Display the floating icon and command interface
- Execute commands on the current page

### Host Permissions (servicenow.com, service-now.com)
The Extension only activates on ServiceNow platform pages. This permission allows the Extension to:
- Inject the command-line interface
- Make API calls to the platform using your existing authenticated session
- Navigate between pages on the platform

## Data Security

- All data is stored locally using Chrome's secure storage API
- The Extension uses your existing browser session for authentication - no credentials are stored
- No data is transmitted to external servers

## Third-Party Services

The Extension does not integrate with any third-party analytics, advertising, or data collection services.

## Your Rights

Since all data is stored locally on your device:
- **Access:** You can view stored data through Chrome's developer tools
- **Delete:** Uninstalling the Extension removes all stored data
- **Clear Cache:** Use the `cache` command or clear browser data to remove cached information

## Children's Privacy

The Extension does not knowingly collect any information from children under 13 years of age.

## Changes to This Policy

We may update this privacy policy from time to time. Any changes will be reflected in the "Last Updated" date above.

## Contact

If you have questions about this privacy policy, please open an issue on our GitHub repository.

## Open Source

This Extension is open source. You can review the complete source code to verify our privacy practices.

---

**Summary:** Glass CLI stores only your preferences and cache data locally on your device. We do not collect, transmit, or have access to any of your data.

