/**
 * EraseTrail - Background Service Worker
 * Handles history monitoring and deletion of matched URLs
 */

// Browser API compatibility
const browser = window.browser || window.chrome;

// Default patterns to block if user hasn't set any
const DEFAULT_PATTERNS = ["*.twitter.com"];

// In-memory storage for tab tracking and session-only mode
const trackedTabs = new Map(); // Map of tabId -> URL to delete on close
const sessionTrackingSet = new Set(); // URLs to delete when browser closes (session-only mode)

// Check if we're running in Firefox
const isFirefox = typeof browser !== 'undefined' && browser.runtime.getBrowserInfo !== undefined;

// Initialize extension on install
browser.runtime.onInstalled.addListener(async () => {
  // console.log("EraseTrail installed/updated");
  
  try {
    // Initialize simple patterns (backward compatibility)
    const { patterns } = await browser.storage.sync.get({ patterns: DEFAULT_PATTERNS });
    
    // Initialize advanced patterns if they don't exist
    const { advancedPatterns } = await browser.storage.sync.get({ advancedPatterns: [] });
    
    // Initialize settings
    await browser.storage.sync.set({
      patterns,
      advancedPatterns,
      deleteDelay: 0,
      deleteOnTabClose: false,
      useContainers: false,
      sessionOnlyMode: false,
      showNotifications: true,
      theme: "system"
    });
    
    // console.log("Patterns initialized:", patterns);
    // console.log("Advanced patterns initialized:", advancedPatterns);
    
    // Set initial badge (off state)
    updateBadgeState();
  } catch (error) {
    console.error("Error during initialization:", error);
  }
});

/**
 * Checks if a URL matches any pattern in the block list
 * @param {string} url - The URL to check
 * @param {Array<string>} patterns - Array of patterns to match against
 * @param {Array<Object>} advancedPatterns - Array of advanced pattern objects
 * @returns {boolean|Object} False if no match, pattern object if match found
 */
function urlMatches(url, patterns, advancedPatterns = []) {
  try {
    const hostname = new URL(url).hostname;
    
    // Check simple patterns first
    for (const pattern of patterns) {
      // Check if it's a regex pattern (starts with ^)
      if (pattern.startsWith('^')) {
        try {
          const regex = new RegExp(pattern, "i");
          if (regex.test(url)) {
            return { pattern }; // Return simple pattern match
          }
        } catch (e) {
          console.error("Invalid regex pattern:", pattern, e);
        }
      } else {
        // Convert wildcard pattern to regex
        // * becomes .* and escape dots
        const regexPattern = "^" + pattern
          .replace(/\./g, "\\.")
          .replace(/\*/g, ".*") + "$";
        
        if (new RegExp(regexPattern, "i").test(hostname)) {
          return { pattern };  // Return simple pattern match
        }
      }
    }
    
    // Check advanced patterns
    for (const advPattern of advancedPatterns) {
      // Skip if inactive
      if (!advPattern.active) continue;
      
      // Check for time window restrictions
      if (advPattern.useTimeWindow) {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes(); // Minutes since midnight
        
        const fromParts = advPattern.activeFrom.split(':');
        const toParts = advPattern.activeTo.split(':');
        
        const fromTime = parseInt(fromParts[0]) * 60 + parseInt(fromParts[1]);
        const toTime = parseInt(toParts[0]) * 60 + parseInt(toParts[1]);
        
        // Skip if outside time window
        if (currentTime < fromTime || currentTime > toTime) {
          continue;
        }
      }
      
      // Check if pattern matches based on pattern type
      let isMatch = false;
      
      if (advPattern.type === 'regex') {
        try {
          const regex = new RegExp(advPattern.pattern, "i");
          isMatch = regex.test(url);
        } catch (e) {
          console.error("Invalid regex pattern:", advPattern.pattern, e);
        }
      } else { // wildcard
        const regexPattern = "^" + advPattern.pattern
          .replace(/\./g, "\\.")
          .replace(/\*/g, ".*") + "$";
        
        isMatch = new RegExp(regexPattern, "i").test(hostname);
      }
      
      // If pattern matches, return the advanced pattern
      if (isMatch) {
        return advPattern;
      }
    }
    
    return false; // No match found
  } catch (e) {
    console.error("Error matching URL:", e);
    return false;
  }
}

/**
 * Handle history items as they're added
 */
browser.history.onVisited.addListener(async (historyItem) => {
  // Get current settings and patterns
  const settings = await browser.storage.sync.get({
    patterns: DEFAULT_PATTERNS,
    advancedPatterns: [],
    deleteDelay: 0,
    deleteOnTabClose: false,
    useContainers: false,
    sessionOnlyMode: false,
    showNotifications: true
  });
  
  // Shorthand for easier access
  const { patterns, advancedPatterns, deleteDelay, deleteOnTabClose, sessionOnlyMode } = settings;
  
  // Check if URL matches any pattern
  const matchResult = urlMatches(historyItem.url, patterns, advancedPatterns);
  
  if (matchResult) {
    // console.log(`URL match: ${historyItem.url} matches pattern:`, matchResult);
    
    // If session-only mode, store URL in memory
    if (sessionOnlyMode) {
      sessionTrackingSet.add(historyItem.url);
      // console.log(`Added to session tracking: ${historyItem.url}`);
      return;
    }
    
    // Track deletion stats
    incrementDeleteCounter();
    
    // If delete on tab close is enabled, we'll find the tab and track it
    if (deleteOnTabClose) {
      // Find tab with this URL
      const tabs = await browser.tabs.query({ url: historyItem.url });
      
      if (tabs.length > 0) {
        // Store the URL to delete when tab closes
        tabs.forEach(tab => {
          trackedTabs.set(tab.id, historyItem.url);
          // console.log(`Tab ${tab.id} is tracked for deletion on close`);
        });
      } else {
        // No tab found, delete now
        performHistoryDeletion(historyItem.url, deleteDelay);
      }
    } else {
      // Delete history based on delay setting
      performHistoryDeletion(historyItem.url, deleteDelay);
    }
    
    // Show notification if enabled
    if (settings.showNotifications) {
      showProtectionNotification(historyItem.url);
    }
    
    // Update badge to reflect active protection
    updateBadgeState(true);
  }
});

/**
 * Perform history deletion with optional delay
 * @param {string} url - URL to delete
 * @param {number} delay - Delay in seconds
 */
function performHistoryDeletion(url, delay = 0) {
  if (delay > 0) {
    setTimeout(() => {
      browser.history.deleteUrl({ url });
      cleanFromRecentlyClosed(url);
      // console.log(`Delayed deletion of: ${url}`);
    }, delay * 1000);
  } else {
    browser.history.deleteUrl({ url });
    cleanFromRecentlyClosed(url);
    // console.log(`Immediate deletion of: ${url}`);
  }
}

/**
 * Clean URL from recently closed tabs/windows
 */
async function cleanFromRecentlyClosed(url) {
  try {
    // Get recently closed sessions
    const sessions = await browser.sessions.getRecentlyClosed();
    
    // Find any that match our URL
    for (const session of sessions) {
      if (
        (session.tab && session.tab.url === url) ||
        (session.window && session.window.tabs && 
         session.window.tabs.some(tab => tab.url === url))
      ) {
        // Forget this closed session
        await browser.sessions.forgetClosedTab(session.tab.windowId, session.tab.sessionId);
        // console.log("Removed from recently closed:", url);
      }
    }
  } catch (e) {
    console.error("Error cleaning recently closed:", e);
  }
}

/**
 * Track deletion statistics
 */
async function incrementDeleteCounter() {
  const { deletionCounter = 0 } = await browser.storage.local.get("deletionCounter");
  await browser.storage.local.set({ deletionCounter: deletionCounter + 1 });
}

/**
 * Show a notification that a page is being protected
 */
function showProtectionNotification(url) {
  try {
    // Create a temporary div for the notification
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      if (tabs.length > 0 && tabs[0].url && tabs[0].url.startsWith("http")) {
        // For Firefox compatibility, we'll use tabs.executeScript instead of scripting.executeScript
        // This works in both Firefox and Chrome
        try {
          const showNotificationCode = `
            // Create a floating notification
            const notification = document.createElement('div');
            notification.style.position = 'fixed';
            notification.style.bottom = '20px';
            notification.style.left = '20px';
            notification.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            notification.style.color = 'white';
            notification.style.padding = '10px 15px';
            notification.style.borderRadius = '4px';
            notification.style.display = 'flex';
            notification.style.alignItems = 'center';
            notification.style.zIndex = '9999';
            notification.style.fontFamily = '-apple-system, BlinkMacSystemFont, sans-serif';
            notification.style.fontSize = '14px';
            notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
            notification.style.transition = 'opacity 0.3s';
            
            // Create icon element
            const icon = document.createElement('div');
            icon.style.marginRight = '8px';
            icon.innerHTML = '🛡️';
            notification.appendChild(icon);
            
            // Create text element
            const text = document.createElement('div');
            text.textContent = 'Protected: This visit won\\'t be recorded.';
            notification.appendChild(text);
            
            // Add to page
            document.body.appendChild(notification);
            
            // Fade out and remove after 3 seconds
            setTimeout(() => {
              notification.style.opacity = '0';
              setTimeout(() => notification.remove(), 300);
            }, 3000);
          `;
          
          // Use tabs.executeScript which is available in both browsers
          browser.tabs.executeScript(tabs[0].id, {
            code: showNotificationCode
          }).catch(err => {
            // This will fail for non-http pages, which is fine
            // console.log("Could not show notification:", err);
          });
        } catch (error) {
          console.error("Error showing notification:", error);
        }
      }
    });
  } catch (error) {
    console.error("Error in showProtectionNotification:", error);
  }
}

/**
 * Update the badge state based on the current page
 */
async function updateBadgeState(activeProtection = false) {
  try {
    // Handle badge compatibility between Firefox and Chrome
    if (activeProtection) {
      if (typeof browser.browserAction !== 'undefined') {
        // Firefox
        browser.browserAction.setBadgeBackgroundColor({ color: "#4CAF50" }); // Green
        browser.browserAction.setBadgeText({ text: "✓" });
      } else if (typeof browser.action !== 'undefined') {
        // Chrome
        browser.action.setBadgeBackgroundColor({ color: "#4CAF50" }); // Green
        browser.action.setBadgeText({ text: "✓" });
      }
    } else {
      if (typeof browser.browserAction !== 'undefined') {
        // Firefox
        browser.browserAction.setBadgeText({ text: "" });
      } else if (typeof browser.action !== 'undefined') {
        // Chrome
        browser.action.setBadgeText({ text: "" });
      }
    }
  } catch (e) {
    console.error("Error updating badge state:", e);
  }
}

/**
 * Handle tab being closed - delete history entry if it was tracked
 */
browser.tabs.onRemoved.addListener((tabId) => {
  if (trackedTabs.has(tabId)) {
    const url = trackedTabs.get(tabId);
    // console.log(`Tab ${tabId} closed, deleting URL: ${url}`);
    browser.history.deleteUrl({ url });
    cleanFromRecentlyClosed(url);
    trackedTabs.delete(tabId);
  }
});

/**
 * Handle tab navigation to container tabs if needed
 */
browser.webNavigation.onBeforeNavigate.addListener(async details => {
  // Only process main frame (top-level) navigations
  if (details.frameId !== 0) return;
  
  // Get settings to check if container tabs are enabled
  const { useContainers, patterns, advancedPatterns } = await browser.storage.sync.get({
    useContainers: false,
    patterns: DEFAULT_PATTERNS,
    advancedPatterns: []
  });
  
  // Skip if containers aren't enabled
  if (!useContainers) return;
  
  // Check if URL matches a pattern
  const matchResult = urlMatches(details.url, patterns, advancedPatterns);
  if (!matchResult) return;
  
  try {
    // Create a new container tab
    const tab = await browser.tabs.get(details.tabId);
    
    // Skip if already in a container
    if (tab.cookieStoreId !== 'firefox-default') return;
    
    // Create new temporary container
    const contextualIdentity = await browser.contextualIdentities.create({
      name: `EraseTrail-${Date.now()}`,
      color: 'green',
      icon: 'fingerprint'
    });
    
    // Open URL in new container tab
    await browser.tabs.create({
      url: details.url,
      cookieStoreId: contextualIdentity.cookieStoreId,
      active: true
    });
    
    // Close the original tab
    await browser.tabs.remove(details.tabId);
    
    // console.log(`Moved ${details.url} to temporary container ${contextualIdentity.cookieStoreId}`);
  } catch (error) {
    console.error('Error setting up container tab:', error);
  }
});

// Handle browser shutdown for session-only mode
// This is only supported in Chrome, so we need to check before using
if (typeof browser.runtime.onSuspend !== 'undefined') {
  browser.runtime.onSuspend.addListener(async () => {
    // Check if session-only mode is enabled
    const { sessionOnlyMode } = await browser.storage.sync.get({ sessionOnlyMode: false });
    
    if (sessionOnlyMode && sessionTrackingSet.size > 0) {
      // console.log(`Deleting ${sessionTrackingSet.size} URLs from history (session-only mode)`);
      
      // Delete all tracked URLs
      for (const url of sessionTrackingSet) {
        await browser.history.deleteUrl({ url });
      }
      
      // Clear the set
      sessionTrackingSet.clear();
    }
  });
}

// For Firefox, we can use the onUnload event instead
if (typeof window !== 'undefined') {
  window.addEventListener('unload', async () => {
    // Only process if we're running in Firefox
    if (!isFirefox) return;
    
    // Check if session-only mode is enabled
    const { sessionOnlyMode } = await browser.storage.sync.get({ sessionOnlyMode: false });
    
    if (sessionOnlyMode && sessionTrackingSet.size > 0) {
      // Delete all tracked URLs
      for (const url of sessionTrackingSet) {
        await browser.history.deleteUrl({ url });
      }
      
      // Clear the set
      sessionTrackingSet.clear();
    }
  });
}

/**
 * Check if current tab's URL is in the block list
 */
async function updateIconForTab(tabId) {
  try {
    // Get the tab's URL
    const tab = await browser.tabs.get(tabId);
    if (!tab.url || !tab.url.startsWith("http")) return;
    
    // Get current patterns and settings
    const { patterns, advancedPatterns } = await browser.storage.sync.get({
      patterns: DEFAULT_PATTERNS,
      advancedPatterns: []
    });
    
    // Check if this URL matches any patterns
    const isBlocked = urlMatches(tab.url, patterns, advancedPatterns);
    
    // Update badge - handle both Firefox and Chrome APIs
    const color = isBlocked ? "#4CAF50" : "#757575"; // Green or gray
    const text = isBlocked ? "✓" : "";
    
    try {
      if (typeof browser.browserAction !== 'undefined') {
        // Firefox
        browser.browserAction.setBadgeBackgroundColor({ color, tabId });
        browser.browserAction.setBadgeText({ text, tabId });
      } else if (typeof browser.action !== 'undefined') {
        // Chrome
        browser.action.setBadgeBackgroundColor({ color, tabId });
        browser.action.setBadgeText({ text, tabId });
      }
    } catch (e) {
      console.error("Error setting badge for tab:", e);
    }
  } catch (e) {
    console.error("Error updating icon for tab:", e);
  }
}

// Update icon when tab changes
browser.tabs.onActivated.addListener(activeInfo => {
  updateIconForTab(activeInfo.tabId);
});

// Update icon when URL changes
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    updateIconForTab(tabId);
  }
});

// Listen for messages from popup or options page
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getTabInfo") {
    // Return info about the current tab
    return getTabInfo(message.tabId);
  }
  else if (message.action === "togglePattern") {
    // Add or remove a pattern for the current site
    return toggleSitePattern(message.pattern, message.add);
  }
  else if (message.action === "wipeMatchingHistory") {
    // Retroactively wipe history entries matching patterns
    return wipeMatchingHistory();
  }
  else if (message.action === "testUrlMatch") {
    // Test if a URL matches patterns (used by options page)
    return urlMatches(message.url, message.patterns, message.advancedPatterns);
  }
  else if (message.action === "refreshIconForTab") {
    // Refresh the icon state for a tab
    updateIconForTab(message.tabId);
    return Promise.resolve({ success: true });
  }
});

/**
 * Get information about a tab, including whether its URL is blocked
 */
async function getTabInfo(tabId) {
  try {
    const tab = await browser.tabs.get(tabId);
    const { patterns, advancedPatterns } = await browser.storage.sync.get({
      patterns: DEFAULT_PATTERNS,
      advancedPatterns: []
    });
    
    if (!tab.url || !tab.url.startsWith("http")) {
      return { 
        url: tab.url, 
        hostname: null, 
        isBlocked: false, 
        patterns, 
        advancedPatterns 
      };
    }
    
    const hostname = new URL(tab.url).hostname;
    const matchResult = urlMatches(tab.url, patterns, advancedPatterns);
    const isBlocked = Boolean(matchResult);
    
    return { 
      url: tab.url, 
      hostname, 
      isBlocked, 
      patterns, 
      advancedPatterns,
      matchedPattern: matchResult
    };
  } catch (e) {
    console.error("Error getting tab info:", e);
    return null;
  }
}

/**
 * Add or remove a pattern from the block list
 */
async function toggleSitePattern(pattern, add) {
  try {
    // Get current patterns
    const { patterns } = await browser.storage.sync.get("patterns");
    let newPatterns;
    
    if (add) {
      // Add if not already in the list
      newPatterns = patterns.includes(pattern) 
        ? patterns 
        : [...patterns, pattern];
    } else {
      // Remove the pattern
      newPatterns = patterns.filter(p => p !== pattern);
    }
    
    // Save updated patterns
    await browser.storage.sync.set({ patterns: newPatterns });
    
    // Update the badge for current tab
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      updateIconForTab(tabs[0].id);
    }
    
    return { success: true, patterns: newPatterns };
  } catch (e) {
    console.error("Error toggling pattern:", e);
    return { success: false, error: e.message };
  }
}

/**
 * Retroactively wipe history entries that match current patterns
 */
async function wipeMatchingHistory() {
  try {
    // Get all patterns
    const { patterns, advancedPatterns } = await browser.storage.sync.get({
      patterns: DEFAULT_PATTERNS,
      advancedPatterns: []
    });
    
    // Get history entries from the last 90 days (max allowed)
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - 90);
    
    const historyItems = await browser.history.search({
      text: '',             // Search all history
      startTime: startTime.getTime(),
      maxResults: 10000     // Get as many as possible
    });
    
    //// console.log(`Found ${historyItems.length} history items to check`);
    
    // Track matched items
    let matchedCount = 0;
    
    // Check each history entry against our patterns
    for (const item of historyItems) {
      if (urlMatches(item.url, patterns, advancedPatterns)) {
        await browser.history.deleteUrl({ url: item.url });
        matchedCount++;
      }
    }
    
    // console.log(`Deleted ${matchedCount} matching history entries`);
    
    return { success: true, count: matchedCount };
  } catch (error) {
    console.error('Error wiping matching history:', error);
    return { success: false, error: error.message };
  }
}