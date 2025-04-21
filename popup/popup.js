/**
 * EraseTrail Popup Script
 */

// Browser API compatibility with fallback
const browser = window.browser || window.chrome || {};

// DOM elements
const currentSiteElement = document.getElementById('current-site');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const toggleButton = document.getElementById('toggle-protection');
const patternPreview = document.getElementById('pattern-preview');
const deletionCounter = document.getElementById('deletion-counter');
const optionsButton = document.getElementById('open-options');
const whitelistSection = document.getElementById('whitelist-section');
const whitelistButton = document.getElementById('whitelist-button');

// Current tab information
let currentTabId;
let currentHostname;
let currentPatterns = [];
let currentAdvancedPatterns = [];
let matchedPattern = null;
let isCurrentlyBlocked = false;

// Maximum number of connection attempts
const MAX_RETRY_ATTEMPTS = 3;
let retryCount = 0;

/**
 * Apply the appropriate theme based on the user preference or system setting
 */
async function applyTheme() {
  try {
    const { theme = 'system' } = await browser.storage.sync.get({ theme: 'system' });
    let effectiveTheme = theme;

    if (theme === 'system') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.documentElement.setAttribute('data-theme', effectiveTheme);
    return effectiveTheme;
  } catch (error) {
    console.error('Error applying theme:', error);
    document.documentElement.setAttribute('data-theme', 'light');
    return 'light';
  }
}

/**
 * Set up a listener for system theme changes
 */
function setupThemeListener() {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
}

/**
 * Send a message to the background script
 * @param {Object} message - Message to send to background script
 * @returns {Promise} - Response from background script or null if error
 */
async function sendMessage(message) {
  try {
    if (!browser.runtime || !browser.runtime.sendMessage) {
      console.error("Runtime API not available");
      handleAPIUnavailable();
      return null;
    }
    
    return await browser.runtime.sendMessage(message);
  } catch (error) {
    console.error("Error sending message to background:", error);
    
    // For specific connection errors, we can show a more helpful message
    if (error.message && error.message.includes("Receiving end does not exist")) {
      console.warn("Background script connection failed - the extension may need to be reloaded");
      // Update UI to indicate connection problem
      handleConnectionError();
    }
    
    return null;
  }
}

/**
 * Safely send a message to background script with retry and error handling
 * @param {Object} message - Message to send to background script
 * @returns {Promise} - Response from background script or null if error
 */
async function safelySendMessage(message) {
  if (retryCount >= MAX_RETRY_ATTEMPTS) {
    console.error("Maximum retry attempts reached");
    return null;
  }
  
  try {
    if (!browser.runtime || !browser.runtime.sendMessage) {
      console.error("Runtime API not available");
      handleAPIUnavailable();
      return null;
    }
    
    return await browser.runtime.sendMessage(message);
  } catch (error) {
    console.error("Error sending message to background:", error);
    
    if (error.message && error.message.includes("Receiving end does not exist")) {
      retryCount++;
      console.error(`Connection failed. Retry attempt ${retryCount}/${MAX_RETRY_ATTEMPTS}`);
      
      return new Promise(resolve => {
        setTimeout(async () => {
          const result = await safelySendMessage(message);
          resolve(result);
        }, 500 * retryCount);
      });
    }
    
    return null;
  }
}

/**
 * Handle case when required APIs are not available
 */
function handleAPIUnavailable() {
  currentSiteElement.textContent = 'API Unavailable';
  statusIndicator.className = 'status-indicator status-inactive';
  statusText.textContent = 'Extension Error';
  toggleButton.disabled = true;
  patternPreview.textContent = 'N/A';
  currentSiteElement.title = 'The browser API needed for this extension is not available. Check permissions in manifest.';
}

/**
 * Handle case when connection to background script fails
 */
function handleConnectionError() {
  statusIndicator.className = 'status-indicator status-inactive';
  statusText.textContent = 'Connection Error';
  toggleButton.disabled = true;
  currentSiteElement.title = 'Could not connect to background script. Try reloading the extension.';
  
  // Add a reload button to the UI
  const reloadButton = document.createElement('button');
  reloadButton.textContent = 'Reload Extension';
  reloadButton.classList.add('secondary-button');
  reloadButton.addEventListener('click', () => {
    browser.runtime.reload();
  });
  
  const actionsContainer = document.getElementById('actions');
  if (actionsContainer) {
    actionsContainer.appendChild(reloadButton);
  }
}

/**
 * Initialize the popup when it's opened
 */
async function initializePopup() {
  try {
    //console.log("Initializing popup");
    await applyTheme();
    
    if (!browser.tabs || !browser.tabs.query) {
      console.error("Required browser APIs are not available");
      handleAPIUnavailable();
      return;
    }
    
    const tabs = await browser.tabs.query({ active: true, currentWindow: true }).catch(err => {
      console.error("Error querying tabs:", err);
      return [];
    });
    
    if (tabs.length === 0) {
      //console.log("No active tab found");
      handleError();
      return;
    }
    
    currentTabId = tabs[0].id;
    //console.log("Active tab ID:", currentTabId);
    
    const currentUrl = tabs[0].url;
    let hostname = null;
    
    try {
      if (currentUrl) {
        const url = new URL(currentUrl);
        hostname = url.hostname;
      }
    } catch (err) {
      console.error("Error parsing URL:", err);
    }
    
    // First try to get tab info from background script
    let tabInfo = await sendMessage({
      action: "getTabInfo",
      tabId: currentTabId,
      fallbackHostname: hostname
    });
    
    //console.log("Tab info received:", tabInfo);
    
    // If background script failed to provide tab info, check storage directly
    if (!tabInfo && hostname) {
      console.error("Background script didn't return tab info, checking patterns directly");
      try {
        const { patterns = [] } = await browser.storage.sync.get({ patterns: [] });
        const { advancedPatterns = [] } = await browser.storage.sync.get({ advancedPatterns: [] });
        
        // Check if current hostname matches any pattern
        const isBlocked = patterns.some(pattern => {
          // Convert wildcard pattern to regex
          const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
          const regex = new RegExp(`^${regexPattern}$`);
          return regex.test(hostname);
        }) || advancedPatterns.some(ap => {
          if (ap.type === 'domain') {
            const regexPattern = ap.pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
            const regex = new RegExp(`^${regexPattern}$`);
            return regex.test(hostname);
          }
          return false;
        });
        
        tabInfo = {
          hostname: hostname,
          url: currentUrl,
          isBlocked: isBlocked,
          patterns: patterns,
          advancedPatterns: advancedPatterns
        };
      } catch (storageError) {
        console.error("Error accessing storage:", storageError);
      }
    }
    
    try {
      if (browser.storage && browser.storage.local && browser.storage.local.get) {
        const { deletionCounter: count = 0 } = await browser.storage.local.get('deletionCounter');
        deletionCounter.textContent = count;
        //console.log("Deletion counter:", count);
      } else {
        console.warn("Storage API not available");
        deletionCounter.textContent = "0";
      }
    } catch (error) {
      console.error("Error fetching deletion counter:", error);
      deletionCounter.textContent = "0";
    }
    
    if (tabInfo) {
      updatePopupUI(tabInfo);
    } else if (hostname) {
      //console.log("Using fallback hostname:", hostname);
      updatePopupUI({
        hostname: hostname,
        url: currentUrl,
        isBlocked: false,
        patterns: [],
        advancedPatterns: []
      });
    } else {
      console.error("No valid tab info received");
      handleError();
    }
  } catch (error) {
    console.error("Error initializing popup:", error);
    handleError();
  }
}

/**
 * Update the popup UI based on tab information
 */
function updatePopupUI(tabInfo) {
  currentHostname = tabInfo.hostname;
  currentPatterns = tabInfo.patterns || [];
  currentAdvancedPatterns = tabInfo.advancedPatterns || [];
  isCurrentlyBlocked = tabInfo.isBlocked || false;
  matchedPattern = tabInfo.matchedPattern;


  if (currentPatterns.includes(`*.${currentHostname}`)) {
    isCurrentlyBlocked = true;
  }
  
  if (currentHostname) {
    currentSiteElement.textContent = currentHostname;
    const suggestedPattern = `*.${currentHostname}`;
    patternPreview.textContent = suggestedPattern;
    
    if (isCurrentlyBlocked) {
      statusIndicator.className = 'status-indicator status-active';
      statusText.textContent = 'Protected';
      toggleButton.textContent = 'Disable Protection';
      toggleButton.style.backgroundColor = '#f44336'; // Red color
      whitelistSection.style.display = 'none';    // make block if want to see
    } else {
      statusIndicator.className = 'status-indicator status-inactive';
      statusText.textContent = 'Not Protected';
      toggleButton.textContent = 'Enable Protection';
      toggleButton.style.backgroundColor = '#4CAF50'; // Green color
      whitelistSection.style.display = 'none';
    }
    
    toggleButton.disabled = false;
  } else if (tabInfo.url) {
    handleNonWebPage(tabInfo.url);
  } else {
    handleError();
  }
}

/**
 * Handle non-web pages (like about: pages or extension pages)
 */
function handleNonWebPage(url) {
  let displayText = 'Not a web page';
  
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol === 'chrome:' || urlObj.protocol === 'chrome-extension:' || urlObj.protocol === 'moz-extension:' || urlObj.protocol === 'about:') {
      displayText = 'Browser page';
    } else if (urlObj.protocol === 'file:') {
      displayText = 'Local file';
    } else {
      displayText = urlObj.protocol.replace(':', '');
    }
  } catch (e) {
    console.error('Could not parse URL:', e);
  }
  
  currentSiteElement.textContent = displayText;
  statusIndicator.className = 'status-indicator status-inactive';
  statusText.textContent = 'Not Applicable';
  toggleButton.disabled = true;
  patternPreview.textContent = 'N/A';
  whitelistSection.style.display = 'none';
  currentSiteElement.title = `Protection not available for ${url}`;
}

/**
 * Handle errors when getting tab info
 */
function handleError() {
  currentSiteElement.textContent = 'Cannot access page';
  currentSiteElement.title = 'EraseTrail cannot access information for this page';
  statusIndicator.className = 'status-indicator status-inactive';
  statusText.textContent = 'Unknown';
  toggleButton.disabled = true;
  whitelistSection.style.display = 'none';
}

/**
 * Toggle protection for the current site
 */
async function toggleProtection() {
  if (!currentHostname) return;
  
  const pattern = `*.${currentHostname}`;
  
  try {
    // Replace safelySendMessage with sendMessage for more reliable communication
    const result = await sendMessage({
      action: 'togglePattern',
      pattern: pattern,
      add: !isCurrentlyBlocked
    });
    
    if (result && result.success) {
      isCurrentlyBlocked = !isCurrentlyBlocked;
      currentPatterns = result.patterns;
      
      // Save the current state to local storage as a backup
      try {
        await browser.storage.local.set({
          [`blockState_${currentHostname}`]: isCurrentlyBlocked
        });
      } catch (storageError) {
        console.warn("Could not save block state to local storage:", storageError);
      }
      
      if (isCurrentlyBlocked) {
        statusIndicator.className = 'status-indicator status-active';
        statusText.textContent = 'Protected';
        toggleButton.textContent = 'Disable Protection';
        toggleButton.style.backgroundColor = '#f44336'; // Red color for disable action
        whitelistSection.style.display = 'none'; // make block if want to see
      } else {
        statusIndicator.className = 'status-indicator status-inactive';
        statusText.textContent = 'Not Protected';
        toggleButton.textContent = 'Enable Protection';
        toggleButton.style.backgroundColor = '#4CAF50'; // Green color for enable action
        whitelistSection.style.display = 'none';
      }
      
      // Ensure the background script updates the icon and applies the blocking rules
      await sendMessage({
        action: "refreshIconForTab",
        tabId: currentTabId
      });
    } else {
      console.warn("Toggle protection failed or returned no success value");
      // Show error to user
      statusText.textContent = 'Update Failed';
    }
  } catch (error) {
    console.error('Error toggling protection:', error);
    statusText.textContent = 'Error';
  }
}

/**
 * Remove the current site from blocking patterns
 */
async function whitelistCurrentSite() {
  if (!currentHostname || !isCurrentlyBlocked) return; 
  
  try {
    let success = false;
    
    if (matchedPattern && matchedPattern.pattern && typeof matchedPattern.pattern === 'string') {
      const { patterns } = await browser.storage.sync.get({ patterns: [] });
      const updatedPatterns = patterns.filter(p => p !== matchedPattern.pattern);
      await browser.storage.sync.set({ patterns: updatedPatterns });
      success = true;
    } else if (matchedPattern && matchedPattern.type) {
      const { advancedPatterns = [] } = await browser.storage.sync.get({ advancedPatterns: [] });
      const index = advancedPatterns.findIndex(p => 
        p.pattern === matchedPattern.pattern && 
        p.type === matchedPattern.type
      );
      if (index >= 0) {
        const updatedPatterns = [...advancedPatterns];
        updatedPatterns.splice(index, 1);
        await browser.storage.sync.set({ advancedPatterns: updatedPatterns });
        success = true;
      }
    }
    
    if (success) {
      isCurrentlyBlocked = false;
      statusIndicator.className = 'status-indicator status-inactive';
      statusText.textContent = 'Not Protected';
      toggleButton.textContent = 'Enable Protection';
      whitelistSection.style.display = 'none';
      await browser.runtime.sendMessage({
        action: "refreshIconForTab",
        tabId: currentTabId
      });
    }
  } catch (error) {
    console.error('Error whitelisting site:', error);
  }
}

/**
 * Open the options page
 */
function openOptions() {
  browser.runtime.openOptionsPage();
}

// Set up event listeners
document.addEventListener('DOMContentLoaded', () => {
  //console.log("DOM loaded, initializing popup");
  initializePopup();
  setupThemeListener();
});
toggleButton.addEventListener('click', toggleProtection);
whitelistButton.addEventListener('click', whitelistCurrentSite);
optionsButton.addEventListener('click', openOptions);