/**
 * Glass API Bridge
 * 
 * Runs in the page context to make authenticated API calls.
 * Based on standard patterns approach - uses page's session for authentication.
 */

(function() {
  'use strict';

  // Prevent multiple injections
  if (window.snEzApiBridge) {
    return;
  }

  window.snEzApiBridge = true;

  // Listen for API requests from the content script
  window.addEventListener('message', function(event) {
    const { type, messageId } = event.data;
    
    if (!type || !messageId) return;

    switch (type) {
      case 'snEzApiRequest':
        handleApiRequest(event.data);
        break;
      case 'snEzImpersonateRequest':
        handleImpersonateRequest(event.data);
        break;
      case 'snEzEndImpersonateRequest':
        handleEndImpersonateRequest(event.data);
        break;
      case 'snEzCurrentUserRequest':
        handleCurrentUserRequest(event.data);
        break;
      case 'glassApiRequest':
        handleGenericApiRequest(event.data);
        break;
      case 'glassBackgroundScriptRequest':
        handleBackgroundScriptRequest(event.data);
        break;
      case 'glassRetrieveUpdateSetsRequest':
        handleRetrieveUpdateSetsRequest(event.data);
        break;
    }
  });

  function handleApiRequest(data) {
    var username = data.username;
    var instanceUrl = data.instanceUrl;
    var messageId = data.messageId;

    // Build API URL - instanceUrl should already include https://
    var apiUrl = instanceUrl + '/api/now/table/sys_user?sysparm_query=user_name=' + encodeURIComponent(username) + '&sysparm_limit=1';

    // Use the page's XMLHttpRequest for proper authentication inheritance
    var xhr = new XMLHttpRequest();

    // Check if we're in a platform page and can access session info
    var g_ck = window.g_ck || '';
    var sessionToken = getSessionToken();

    xhr.open('GET', apiUrl, true);

    // Set standard headers
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

    // Add authentication headers if available (like standard patterns does)
    if (g_ck) {
      xhr.setRequestHeader('X-UserToken', g_ck);
    }

    // Use credentials to send cookies - this is key for platform authentication
    xhr.withCredentials = true;

    xhr.onload = function() {

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          var responseData = JSON.parse(xhr.responseText);

          window.postMessage({
            type: 'snEzApiResponse',
            messageId: messageId,
            result: responseData.result
          }, '*');
        } catch (parseError) {
          window.postMessage({
            type: 'snEzApiResponse',
            messageId: messageId,
            error: 'Invalid JSON response'
          }, '*');
        }
      } else if (xhr.status === 401 || xhr.status === 403) {
        window.postMessage({
          type: 'snEzApiResponse',
          messageId: messageId,
          error: 'Authentication failed. Please ensure you are logged in.'
        }, '*');
      } else {
        window.postMessage({
          type: 'snEzApiResponse',
          messageId: messageId,
          error: 'API call failed: ' + xhr.status + ' ' + xhr.statusText
        }, '*');
      }
    };

    xhr.onerror = function() {
      window.postMessage({
        type: 'snEzApiResponse',
        messageId: messageId,
        error: 'Network error - check your connection'
      }, '*');
    };

    xhr.timeout = 15000; // Increased timeout
    xhr.ontimeout = function() {
      window.postMessage({
        type: 'snEzApiResponse',
        messageId: messageId,
        error: 'Request timed out - Server may be slow to respond'
      }, '*');
    };
    xhr.send();
  }

  // Extract session token from page (similar to standard patterns approach)
  function getSessionToken() {
    try {
      // Try to get g_ck from window (platform global context token)
      if (window.g_ck) {
        return window.g_ck;
      }

      // Try to extract from scripts (like standard patterns does)
      var scripts = document.getElementsByTagName('script');
      for (var i = 0; i < scripts.length; i++) {
        var content = scripts[i].textContent || '';
        var match = content.match(/g_ck\s*=\s*['"]([^'"]+)['"]/);
        if (match) {
          return match[1];
        }
      }

      // Try cookies for session info
      var cookies = document.cookie.split(';');
      for (var j = 0; j < cookies.length; j++) {
        var cookie = cookies[j].trim().split('=');
        if (cookie[0] === 'glide_user_session' || cookie[0] === 'JSESSIONID') {
          return cookie[1];
        }
      }
    } catch (e) {
    }

    return null;
  }

  // Handle impersonation requests (following standard patterns pattern)
  function handleImpersonateRequest(data) {
    var instanceUrl = data.instanceUrl;
    var username = data.username;
    var messageId = data.messageId;

    // Use username directly in the URL path (like standard patterns does)
    var impersonateUrl = instanceUrl + '/api/now/ui/impersonate/' + encodeURIComponent(username);

    // Use fetch like standard patterns does
    fetch(impersonateUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-UserToken': window.g_ck || '',
        'X-Requested-With': 'XMLHttpRequest'
      },
      credentials: 'same-origin'
    })
    .then(response => {
      if (response.ok) {
        window.postMessage({
          type: 'snEzImpersonateResponse',
          messageId: messageId,
          success: true
        }, '*');
      } else {
        return response.text().then(text => {
          window.postMessage({
            type: 'snEzImpersonateResponse',
            messageId: messageId,
            success: false,
            error: 'API returned: ' + response.status + ' ' + response.statusText
          }, '*');
        });
      }
    })
    .catch(error => {
      window.postMessage({
        type: 'snEzImpersonateResponse',
        messageId: messageId,
        success: false,
        error: 'Network error: ' + error.message
      }, '*');
    });
  }

  /**
   * Get the original user's username when impersonating
   * Extracts from the platform's embedded user.impersonation data in page scripts
   * @returns {string} - Original username or empty string if not impersonating
   */
  function getImpersonatingUser() {
    var impersonatingUser = '';
    
    // Try to find the user.impersonation value in script tags
    try {
      var scripts = Array.from(document.querySelectorAll('script[type="text/javascript"]')).filter(
        function(script) {
          return script.innerText.includes('user.impersonation');
        }
      );
      
      if (scripts.length) {
        var match = scripts[0].innerHTML.match(/('user\.impersonation', ')([^']*)'\)/);
        if (match && match[2]) {
          impersonatingUser = match[2];
        }
      }
    } catch (e) {
    }
    
    // Fallback: try fetching a non-existent page to get the impersonation info
    if (!impersonatingUser) {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', window.location.origin + '/notfoundthispage.do', false); // sync request
        xhr.send();
        var match = xhr.response.match(/('user\.impersonation', ')([^']*)'\)/);
        if (match && match[2]) {
          impersonatingUser = match[2];
        }
      } catch (e) {
      }
    }
    
    return impersonatingUser;
  }

  // Handle end impersonation requests
  // The platform requires impersonating back to the original user via POST
  function handleEndImpersonateRequest(data) {
    var instanceUrl = data.instanceUrl;
    var messageId = data.messageId;

    // Get the original user from the page
    var originalUser = getImpersonatingUser();
    
    if (!originalUser) {
      window.postMessage({
        type: 'snEzEndImpersonateResponse',
        messageId: messageId,
        success: false,
        error: 'You are not impersonating anyone'
      }, '*');
      return;
    }

    // Impersonate back to the original user using their username
    var impersonateUrl = instanceUrl + '/api/now/ui/impersonate/' + encodeURIComponent(originalUser);

    fetch(impersonateUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-UserToken': window.g_ck || '',
        'X-Requested-With': 'XMLHttpRequest'
      },
      credentials: 'same-origin'
    })
    .then(response => {
      if (response.ok) {
        window.postMessage({
          type: 'snEzEndImpersonateResponse',
          messageId: messageId,
          success: true
        }, '*');
      } else {
        return response.text().then(text => {
          window.postMessage({
            type: 'snEzEndImpersonateResponse',
            messageId: messageId,
            success: false,
            error: 'API returned: ' + response.status + ' ' + response.statusText
          }, '*');
        });
      }
    })
    .catch(error => {
      window.postMessage({
        type: 'snEzEndImpersonateResponse',
        messageId: messageId,
        success: false,
        error: error.message
      }, '*');
    });
  }

  // Handle current user requests
  function handleCurrentUserRequest(data) {
    var instanceUrl = data.instanceUrl;
    var messageId = data.messageId;

    // Try multiple approaches to get current user info
    getCurrentUserInfo(instanceUrl, messageId);
  }

  function getCurrentUserInfo(instanceUrl, messageId) {
    // First, try to get user info from the page context
    try {
      var userInfo = null;

      // Try the platform's global user object
      if (window.NOW && window.NOW.user) {
        userInfo = {
          sys_id: window.NOW.user.sys_id || window.NOW.user.userID,
          user_name: window.NOW.user.user_name || window.NOW.user.name
        };
      }

      // If we got user info from page context, use it
      if (userInfo && userInfo.sys_id) {
        window.postMessage({
          type: 'snEzCurrentUserResponse',
          messageId: messageId,
          user: userInfo
        }, '*');
        return;
      }
    } catch (e) {
    }

    // Fallback: Try to get current user via API call
    // This might not work if we're already impersonating, but let's try
    var userApiUrl = instanceUrl + '/api/now/ui/session';

    var xhr = new XMLHttpRequest();
    xhr.open('GET', userApiUrl, true);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

    var g_ck = window.g_ck || '';
    if (g_ck) {
      xhr.setRequestHeader('X-UserToken', g_ck);
    }

    xhr.withCredentials = true;

    xhr.onload = function() {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          var sessionData = JSON.parse(xhr.responseText);

          if (sessionData.result && sessionData.result.user) {
            var user = sessionData.result.user;
            window.postMessage({
              type: 'snEzCurrentUserResponse',
              messageId: messageId,
              user: {
                sys_id: user.sys_id || user.userID,
                user_name: user.user_name || user.name
              }
            }, '*');
          } else {
            window.postMessage({
              type: 'snEzCurrentUserResponse',
              messageId: messageId,
              error: 'Unable to determine current user from session'
            }, '*');
          }
        } catch (parseError) {
          window.postMessage({
            type: 'snEzCurrentUserResponse',
            messageId: messageId,
            error: 'Invalid session response'
          }, '*');
        }
      } else {
        window.postMessage({
          type: 'snEzCurrentUserResponse',
          messageId: messageId,
          error: 'Session API not available'
        }, '*');
      }
    };

    xhr.onerror = function() {
      window.postMessage({
        type: 'snEzCurrentUserResponse',
        messageId: messageId,
        error: 'Network error getting session info'
      }, '*');
    };

    xhr.timeout = 5000;
    xhr.ontimeout = function() {
      window.postMessage({
        type: 'snEzCurrentUserResponse',
        messageId: messageId,
        error: 'Session API timeout'
      }, '*');
    };

    xhr.send();
  }


  /**
   * Handle generic API requests
   * Provides a flexible way to make any Platform API call
   */
  function handleGenericApiRequest(data) {
    var messageId = data.messageId;
    var url = data.url;
    var method = data.method || 'GET';
    var body = data.body;
    var customHeaders = data.headers || {};

    var xhr = new XMLHttpRequest();
    xhr.open(method, url, true);

    // Set standard headers
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

    // Add authentication token if available
    var g_ck = window.g_ck || getSessionToken();
    if (g_ck) {
      xhr.setRequestHeader('X-UserToken', g_ck);
    }

    // Add any custom headers
    Object.keys(customHeaders).forEach(function(key) {
      xhr.setRequestHeader(key, customHeaders[key]);
    });

    // Use credentials for authentication
    xhr.withCredentials = true;

    xhr.onload = function() {
      if (xhr.status >= 200 && xhr.status < 300) {
        var responseText = (xhr.responseText || '').trim();
        if (!responseText) {
          // No body (e.g., DELETE 204)
          window.postMessage({
            type: 'glassApiResponse',
            messageId: messageId,
            result: {}
          }, '*');
          return;
        }

        try {
          var responseData = JSON.parse(responseText);
          window.postMessage({
            type: 'glassApiResponse',
            messageId: messageId,
            result: responseData.result || responseData
          }, '*');
        } catch (parseError) {
          window.postMessage({
            type: 'glassApiResponse',
            messageId: messageId,
            error: 'Invalid JSON response'
          }, '*');
        }
      } else {
        window.postMessage({
          type: 'glassApiResponse',
          messageId: messageId,
          error: 'API call failed: ' + xhr.status + ' ' + xhr.statusText
        }, '*');
      }
    };

    xhr.onerror = function() {
      window.postMessage({
        type: 'glassApiResponse',
        messageId: messageId,
        error: 'Network error'
      }, '*');
    };

    xhr.timeout = 15000;
    xhr.ontimeout = function() {
      window.postMessage({
        type: 'glassApiResponse',
        messageId: messageId,
        error: 'Request timed out'
      }, '*');
    };

    if (body) {
      xhr.send(JSON.stringify(body));
    } else {
      xhr.send();
    }
  }

  /**
   * Handle background script execution requests
   * Executes server-side scripts via sys.scripts.do
   */
  function handleBackgroundScriptRequest(data) {
    var messageId = data.messageId;
    var script = data.script;
    var scope = data.scope || '';

    var g_ck = window.g_ck || getSessionToken() || '';

    if (!g_ck) {
      window.postMessage({
        type: 'glassBackgroundScriptResponse',
        messageId: messageId,
        error: 'No authentication token available'
      }, '*');
      return;
    }

    var body = new URLSearchParams();
    body.append('script', script);
    body.append('runscript', 'Run script');
    body.append('sysparm_ck', g_ck);
    body.append('quota_managed_transaction', 'on');

    if (scope) {
      body.append('sys_scope', scope);
    }

    fetch(window.location.origin + '/sys.scripts.do', {
      method: 'POST',
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString(),
      credentials: 'same-origin'
    })
    .then(function(response) {
      if (!response.ok) {
        throw new Error('HTTP ' + response.status + ': ' + response.statusText);
      }
      return response.text();
    })
    .then(function(html) {
      window.postMessage({
        type: 'glassBackgroundScriptResponse',
        messageId: messageId,
        html: html
      }, '*');
    })
    .catch(function(error) {
      window.postMessage({
        type: 'glassBackgroundScriptResponse',
        messageId: messageId,
        error: error.message || 'Background script execution failed'
      }, '*');
    });
  }

  /**
   * Handle retrieve update sets request
   * Calls UpdateSetAjax processor to retrieve update sets from a remote source
   */
  function handleRetrieveUpdateSetsRequest(data) {
    var messageId = data.messageId;
    var sourceSysId = data.sourceSysId;

    var g_ck = window.g_ck || '';
    if (!g_ck) {
      window.postMessage({
        type: 'glassRetrieveUpdateSetsResponse',
        messageId: messageId,
        error: 'Session token (g_ck) not found. Please refresh the page.'
      }, '*');
      return;
    }

    var params = new URLSearchParams();
    params.set('sysparm_processor', 'UpdateSetAjax');
    params.set('sysparm_type', 'retrieveUpdateSets');
    params.set('sysparm_id', sourceSysId);

    fetch(window.location.origin + '/xmlhttp.do', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-UserToken': g_ck
      },
      body: params.toString()
    })
    .then(function(response) {
      if (!response.ok) {
        throw new Error('HTTP ' + response.status + ': ' + response.statusText);
      }
      return response.text();
    })
    .then(function(text) {
      
      // Response is XML. The tracker id is in <answer>...</answer>
      var match = text.match(/<answer[^>]*>([\s\S]*?)<\/answer>/i);
      var trackerId = match ? match[1].trim() : null;

      window.postMessage({
        type: 'glassRetrieveUpdateSetsResponse',
        messageId: messageId,
        trackerId: trackerId,
        rawXml: text
      }, '*');
    })
    .catch(function(error) {
      window.postMessage({
        type: 'glassRetrieveUpdateSetsResponse',
        messageId: messageId,
        error: error.message || 'Failed to retrieve update sets'
      }, '*');
    });
  }

  // Signal that the bridge is ready
  window.postMessage({ type: 'glassBridgeReady' }, '*');
})();
