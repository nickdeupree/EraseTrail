/**
 * EraseTrail Options Page Script
 */

// Browser API compatibility
const browser = window.browser || window.chrome;

// Default values
const DEFAULT_PATTERNS = ["*.twitter.com"];
const DEFAULT_DELETE_DELAY = 0;
const DEFAULT_USE_CONTAINERS = false;
const DEFAULT_DELETE_ON_TAB_CLOSE = false;
const DEFAULT_SESSION_ONLY_MODE = false;
const DEFAULT_SHOW_NOTIFICATIONS = true;
const DEFAULT_THEME = "system";

// DOM elements - Basic tab
const patternsList = document.getElementById('patterns-list');
const newPatternInput = document.getElementById('new-pattern');
const addPatternButton = document.getElementById('add-pattern');
const patternCountElement = document.getElementById('pattern-count');
const testUrlInput = document.getElementById('test-url');
const testButton = document.getElementById('test-button');
const testResultElement = document.getElementById('test-result');

// DOM elements - Advanced tab
const advancedPatternInput = document.getElementById('advanced-pattern');
const patternTypeSelect = document.getElementById('pattern-type');
const useTimeWindowCheckbox = document.getElementById('use-time-window');
const timeFromInput = document.getElementById('time-from');
const timeToInput = document.getElementById('time-to');
const addAdvancedPatternButton = document.getElementById('add-advanced-pattern');
const advancedPatternsList = document.getElementById('advanced-patterns-list');
const advancedTestUrlInput = document.getElementById('advanced-test-url');
const advancedTestButton = document.getElementById('advanced-test-button');
const advancedTestResult = document.getElementById('advanced-test-result');
const currentTimeDisplay = document.getElementById('current-time-display');

// DOM elements - Settings tab
const deleteDelayInput = document.getElementById('delete-delay');
const deleteOnTabCloseCheckbox = document.getElementById('delete-on-tab-close');
const useContainersCheckbox = document.getElementById('use-containers');
const sessionOnlyModeCheckbox = document.getElementById('session-only-mode');
const showNotificationsCheckbox = document.getElementById('show-notifications');
const themeSelect = document.getElementById('theme-select');
const wipeHistoryButton = document.getElementById('wipe-history-button');
const wipeStatusElement = document.getElementById('wipe-status');

// DOM elements - Import/Export
const exportButton = document.getElementById('export-button');
const importButton = document.getElementById('import-button');
const importFileInput = document.getElementById('import-file');
const importExportStatus = document.getElementById('import-export-status');
const resetButton = document.getElementById('reset-button');
const saveStatus = document.getElementById('save-status');

// DOM elements - Tabs
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

// DOM elements - Drawers
const togglePatternsDrawerBtn = document.getElementById('toggle-patterns-drawer');
const patternsDrawer = document.getElementById('patterns-drawer');
const toggleAdvancedPatternsDrawerBtn = document.getElementById('toggle-advanced-patterns-drawer');
const advancedPatternsDrawer = document.getElementById('advanced-patterns-drawer');
const advancedPatternCountElement = document.getElementById('advanced-pattern-count');

// Current settings
let currentSettings = {};

/**
 * Initialize the options page when loaded
 */
async function initOptions() {
  try {
    //console.log("Initializing options page");
    
    // Set up tab navigation
    setupTabs();
    
    // Set up drawer toggles
    setupDrawerToggles();
    
    // Load current settings
    currentSettings = await loadSettings();
    //console.log("Loaded settings:", currentSettings);
    
    // Display current patterns
    renderPatternsList(currentSettings.patterns);
    renderAdvancedPatternsList(currentSettings.advancedPatterns);
    
    // Set current values for other settings
    deleteDelayInput.value = currentSettings.deleteDelay;
    deleteOnTabCloseCheckbox.checked = currentSettings.deleteOnTabClose;
    useContainersCheckbox.checked = currentSettings.useContainers;
    sessionOnlyModeCheckbox.checked = currentSettings.sessionOnlyMode;
    showNotificationsCheckbox.checked = currentSettings.showNotifications;
    themeSelect.value = currentSettings.theme || DEFAULT_THEME;

    // Apply the theme
    await applyTheme();
    
    // Start time display update
    updateCurrentTimeDisplay();
    setInterval(updateCurrentTimeDisplay, 10000); // Update every 10 seconds
    
  } catch (error) {
    console.error("Error initializing options:", error);
    showTemporaryStatus('Error loading settings: ' + error.message, 'error');
  }
}

/**
 * Load all settings from storage
 */
async function loadSettings() {
  try {
    const result = await browser.storage.sync.get({
      patterns: DEFAULT_PATTERNS,
      advancedPatterns: [],
      deleteDelay: DEFAULT_DELETE_DELAY,
      deleteOnTabClose: DEFAULT_DELETE_ON_TAB_CLOSE,
      useContainers: DEFAULT_USE_CONTAINERS,
      sessionOnlyMode: DEFAULT_SESSION_ONLY_MODE,
      showNotifications: DEFAULT_SHOW_NOTIFICATIONS,
      theme: DEFAULT_THEME
    });
    return result;
  } catch (error) {
    console.error("Error loading settings:", error);
    // Fallback to defaults if storage fails
    return {
      patterns: DEFAULT_PATTERNS,
      advancedPatterns: [],
      deleteDelay: DEFAULT_DELETE_DELAY,
      deleteOnTabClose: DEFAULT_DELETE_ON_TAB_CLOSE,
      useContainers: DEFAULT_USE_CONTAINERS,
      sessionOnlyMode: DEFAULT_SESSION_ONLY_MODE,
      showNotifications: DEFAULT_SHOW_NOTIFICATIONS,
      theme: DEFAULT_THEME
    };
  }
}

/**
 * Set up tab navigation
 */
function setupTabs() {
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons and content
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked button
      button.classList.add('active');
      
      // Find the target tab content and show it
      const targetTab = button.getAttribute('data-tab');
      document.getElementById(`${targetTab}-tab`).classList.add('active');
    });
  });
}

/**
 * Set up the collapsible drawer toggles
 */
function setupDrawerToggles() {
  // Basic patterns drawer toggle
  togglePatternsDrawerBtn.addEventListener('click', () => {
    const isOpen = patternsDrawer.classList.contains('open');
    
    // Toggle drawer state
    if (isOpen) {
      patternsDrawer.classList.remove('open');
      patternsDrawer.classList.add('closed');
      togglePatternsDrawerBtn.querySelector('.toggle-icon').textContent = '▼';
      togglePatternsDrawerBtn.querySelector('.toggle-text').textContent = 'Show patterns';
    } else {
      patternsDrawer.classList.add('open');
      patternsDrawer.classList.remove('closed');
      togglePatternsDrawerBtn.querySelector('.toggle-icon').textContent = '▲';
      togglePatternsDrawerBtn.querySelector('.toggle-text').textContent = 'Hide patterns';
    }
  });
  
  // Advanced patterns drawer toggle
  toggleAdvancedPatternsDrawerBtn.addEventListener('click', () => {
    const isOpen = advancedPatternsDrawer.classList.contains('open');
    
    // Toggle drawer state
    if (isOpen) {
      advancedPatternsDrawer.classList.remove('open');
      advancedPatternsDrawer.classList.add('closed');
      toggleAdvancedPatternsDrawerBtn.querySelector('.toggle-icon').textContent = '▼';
      toggleAdvancedPatternsDrawerBtn.querySelector('.toggle-text').textContent = 'Show patterns';
    } else {
      advancedPatternsDrawer.classList.add('open');
      advancedPatternsDrawer.classList.remove('closed');
      toggleAdvancedPatternsDrawerBtn.querySelector('.toggle-icon').textContent = '▲';
      toggleAdvancedPatternsDrawerBtn.querySelector('.toggle-text').textContent = 'Hide patterns';
    }
  });
}

/**
 * Render the patterns list from the array of patterns
 */
function renderPatternsList(patterns) {
  //console.log("Rendering patterns:", patterns);
  
  // Clear the list
  patternsList.innerHTML = '';
  
  // Update the pattern count
  patternCountElement.textContent = patterns.length;
  
  // If no patterns, show a message
  if (!patterns || patterns.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'pattern-item';
    emptyItem.textContent = 'No patterns added yet. Sites will not be hidden.';
    patternsList.appendChild(emptyItem);
    return;
  }
  
  // Add each pattern to the list
  patterns.forEach((pattern) => {
    const listItem = document.createElement('li');
    listItem.className = 'pattern-item';
    
    const patternText = document.createElement('span');
    patternText.className = 'pattern-text';
    patternText.textContent = pattern;
    
    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-btn';
    deleteButton.innerHTML = '&times;';
    deleteButton.title = 'Delete pattern';
    deleteButton.addEventListener('click', () => removePattern(pattern));
    
    listItem.appendChild(patternText);
    listItem.appendChild(deleteButton);
    patternsList.appendChild(listItem);
  });
}

/**
 * Render the advanced patterns list
 */
function renderAdvancedPatternsList(advancedPatterns) {
  //console.log("Rendering advanced patterns:", advancedPatterns);
  
  // Clear the list
  advancedPatternsList.innerHTML = '';
  
  // Update the pattern count
  advancedPatternCountElement.textContent = advancedPatterns?.length || 0;
  
  // If no patterns, show a message
  if (!advancedPatterns || advancedPatterns.length === 0) {
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = 4;
    emptyCell.textContent = 'No advanced patterns added yet.';
    emptyCell.style.textAlign = 'center';
    emptyCell.style.padding = '20px';
    emptyRow.appendChild(emptyCell);
    advancedPatternsList.appendChild(emptyRow);
    return;
  }
  
  // Add each pattern to the table
  advancedPatterns.forEach((pattern, index) => {
    const row = document.createElement('tr');
    
    // Pattern cell
    const patternCell = document.createElement('td');
    patternCell.textContent = pattern.pattern;
    patternCell.title = pattern.pattern; // For long patterns
    row.appendChild(patternCell);
    
    // Type cell
    const typeCell = document.createElement('td');
    typeCell.textContent = pattern.type === 'regex' ? 'Regex' : 'Wildcard';
    row.appendChild(typeCell);
    
    // Time window cell
    const timeCell = document.createElement('td');
    if (pattern.useTimeWindow) {
      timeCell.textContent = `${pattern.activeFrom} - ${pattern.activeTo}`;
    } else {
      timeCell.textContent = 'Always';
    }
    row.appendChild(timeCell);
    
    // Actions cell
    const actionsCell = document.createElement('td');
    
    // Delete button
    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-btn';
    deleteButton.innerHTML = '&times;';
    deleteButton.title = 'Delete pattern';
    deleteButton.addEventListener('click', () => removeAdvancedPattern(index));
    
    // Toggle button
    const toggleButton = document.createElement('button');
    toggleButton.className = 'btn';
    toggleButton.style.marginRight = '5px';
    toggleButton.style.padding = '2px 5px';
    toggleButton.textContent = pattern.active ? 'Disable' : 'Enable';
    toggleButton.title = pattern.active ? 'Disable this pattern' : 'Enable this pattern';
    toggleButton.addEventListener('click', () => toggleAdvancedPattern(index));
    
    actionsCell.appendChild(toggleButton);
    actionsCell.appendChild(deleteButton);
    row.appendChild(actionsCell);
    
    advancedPatternsList.appendChild(row);
  });
}

/**
 * Add a new pattern to the list
 */
async function addPattern() {
  try {
    const newPattern = newPatternInput.value.trim();
    
    //console.log("New pattern input:", newPattern);
    
    if (newPattern === '') {
      showTemporaryStatus('Please enter a valid pattern', 'error');
      return;
    }
    
    // Load current patterns
    const { patterns = [] } = await browser.storage.sync.get({ patterns: DEFAULT_PATTERNS });
    //console.log("Current patterns:", patterns);
    
    // Check if pattern already exists
    if (patterns.includes(newPattern)) {
      showTemporaryStatus('Pattern already exists', 'error');
      return;
    }
    
    // Add the new pattern
    const updatedPatterns = [...patterns, newPattern];
    //console.log("Updated patterns:", updatedPatterns);
    
    // Save updated patterns
    await browser.storage.sync.set({ patterns: updatedPatterns });
    //console.log("Patterns saved to storage");
    
    // Update UI
    renderPatternsList(updatedPatterns);
    newPatternInput.value = '';
    showTemporaryStatus('Pattern added successfully', 'success');
  } catch (error) {
    console.error("Error adding pattern:", error);
    showTemporaryStatus('Error adding pattern: ' + error.message, 'error');
  }
}

/**
 * Add a new advanced pattern
 */
async function addAdvancedPattern() {
  try {
    const pattern = advancedPatternInput.value.trim();
    
    if (pattern === '') {
      showTemporaryStatus('Please enter a valid pattern', 'error');
      return;
    }
    
    const type = patternTypeSelect.value;
    const useTimeWindow = useTimeWindowCheckbox.checked;
    const activeFrom = timeFromInput.value || '09:00';
    const activeTo = timeToInput.value || '17:00';
    
    // Validate regex if that's the type
    if (type === 'regex') {
      try {
        new RegExp(pattern);
      } catch (e) {
        showTemporaryStatus('Invalid regex pattern: ' + e.message, 'error');
        return;
      }
    }
    
    // Create pattern object
    const newPattern = {
      pattern,
      type,
      useTimeWindow,
      activeFrom,
      activeTo,
      active: true
    };
    
    // Get current advanced patterns
    const { advancedPatterns = [] } = await browser.storage.sync.get({ advancedPatterns: [] });
    
    // Check if similar pattern already exists
    const patternExists = advancedPatterns.some(p => 
      p.pattern === pattern && p.type === type
    );
    
    if (patternExists) {
      showTemporaryStatus('Similar pattern already exists', 'error');
      return;
    }
    
    // Add new pattern
    const updatedPatterns = [...advancedPatterns, newPattern];
    
    // Save updated patterns
    await browser.storage.sync.set({ advancedPatterns: updatedPatterns });
    
    // Update UI
    renderAdvancedPatternsList(updatedPatterns);
    currentSettings.advancedPatterns = updatedPatterns;
    
    // Reset form
    advancedPatternInput.value = '';
    patternTypeSelect.value = 'wildcard';
    useTimeWindowCheckbox.checked = false;
    timeFromInput.disabled = true;
    timeToInput.disabled = true;
    
    showTemporaryStatus('Advanced pattern added successfully', 'success');
  } catch (error) {
    console.error("Error adding advanced pattern:", error);
    showTemporaryStatus('Error adding pattern: ' + error.message, 'error');
  }
}

/**
 * Remove a pattern from the list
 */
async function removePattern(patternToRemove) {
  try {
    // Load current patterns
    const { patterns } = await browser.storage.sync.get({ patterns: DEFAULT_PATTERNS });
    
    // Remove the pattern
    const updatedPatterns = patterns.filter(pattern => pattern !== patternToRemove);
    
    // Save updated patterns
    await browser.storage.sync.set({ patterns: updatedPatterns });
    
    // Update UI
    renderPatternsList(updatedPatterns);
    showTemporaryStatus('Pattern removed', 'success');
  } catch (error) {
    console.error("Error removing pattern:", error);
    showTemporaryStatus('Error removing pattern: ' + error.message, 'error');
  }
}

/**
 * Remove an advanced pattern
 */
async function removeAdvancedPattern(index) {
  try {
    // Get current advanced patterns
    const { advancedPatterns = [] } = await browser.storage.sync.get({ advancedPatterns: [] });
    
    // Remove the pattern at the specified index
    if (index < 0 || index >= advancedPatterns.length) {
      showTemporaryStatus('Invalid pattern index', 'error');
      return;
    }
    
    // Remove the pattern
    const updatedPatterns = advancedPatterns.filter((_, i) => i !== index);
    
    // Save updated patterns
    await browser.storage.sync.set({ advancedPatterns: updatedPatterns });
    
    // Update UI and state
    renderAdvancedPatternsList(updatedPatterns);
    currentSettings.advancedPatterns = updatedPatterns;
    
    showTemporaryStatus('Advanced pattern removed', 'success');
  } catch (error) {
    console.error("Error removing advanced pattern:", error);
    showTemporaryStatus('Error removing pattern: ' + error.message, 'error');
  }
}

/**
 * Toggle an advanced pattern active state
 */
async function toggleAdvancedPattern(index) {
  try {
    // Get current advanced patterns
    const { advancedPatterns = [] } = await browser.storage.sync.get({ advancedPatterns: [] });
    
    // Validate index
    if (index < 0 || index >= advancedPatterns.length) {
      showTemporaryStatus('Invalid pattern index', 'error');
      return;
    }
    
    // Toggle active state
    const updatedPatterns = [...advancedPatterns];
    updatedPatterns[index].active = !updatedPatterns[index].active;
    
    // Save updated patterns
    await browser.storage.sync.set({ advancedPatterns: updatedPatterns });
    
    // Update UI and state
    renderAdvancedPatternsList(updatedPatterns);
    currentSettings.advancedPatterns = updatedPatterns;
    
    const status = updatedPatterns[index].active ? 'enabled' : 'disabled';
    showTemporaryStatus(`Pattern ${status}`, 'success');
  } catch (error) {
    console.error("Error toggling advanced pattern:", error);
    showTemporaryStatus('Error toggling pattern: ' + error.message, 'error');
  }
}

/**
 * Test if a URL matches any pattern
 */
async function testPatternMatch() {
  const testUrl = testUrlInput.value.trim();
  
  if (testUrl === '') {
    testResultElement.textContent = 'Please enter a valid URL';
    testResultElement.className = 'test-result';
    return;
  }
  
  try {
    // Add protocol if missing
    let urlToTest = testUrl;
    if (!urlToTest.startsWith('http://') && !urlToTest.startsWith('https://')) {
      urlToTest = 'https://' + urlToTest;
    }
    
    // Try to parse the URL to ensure it's valid
    const urlObj = new URL(urlToTest);
    
    // Load current patterns
    const { patterns = [] } = await browser.storage.sync.get({ patterns: DEFAULT_PATTERNS });
    
    // Test if URL matches any pattern
    const hostname = urlObj.hostname;
    const matches = patterns.some(pattern => {
      if (pattern.startsWith('^')) {
        try {
          const regex = new RegExp(pattern, "i");
          return regex.test(urlToTest);
        } catch (e) {
          console.error("Invalid regex pattern:", pattern, e);
          return false;
        }
      } else {
        const regexPattern = "^" + pattern
          .replace(/\./g, "\\.")
          .replace(/\*/g, ".*") + "$";
        const regex = new RegExp(regexPattern, "i");
        return regex.test(hostname);
      }
    });
    
    // Show result
    if (matches) {
      testResultElement.textContent = `URL "${hostname}" MATCHES your patterns. It will be removed from history.`;
      testResultElement.className = 'test-result test-match';
    } else {
      testResultElement.textContent = `URL "${hostname}" does NOT match any pattern. It will stay in your history.`;
      testResultElement.className = 'test-result test-no-match';
    }
  } catch (e) {
    console.error("Error testing URL:", e);
    testResultElement.textContent = 'Invalid URL. Please enter a valid URL like https://example.com';
    testResultElement.className = 'test-result error';
  }
}

/**
 * Test URL against all patterns including advanced patterns
 */
async function testAdvancedPatternMatch() {
  const testUrl = advancedTestUrlInput.value.trim();
  
  if (testUrl === '') {
    advancedTestResult.textContent = 'Please enter a valid URL';
    advancedTestResult.className = 'test-result';
    return;
  }
  
  try {
    // Add protocol if missing
    let urlToTest = testUrl;
    if (!urlToTest.startsWith('http://') && !urlToTest.startsWith('https://')) {
      urlToTest = 'https://' + urlToTest;
    }
    
    // Try to parse the URL to ensure it's valid
    const urlObj = new URL(urlToTest);
    
    // Load current patterns
    const { patterns = [], advancedPatterns = [] } = await browser.storage.sync.get({ 
      patterns: DEFAULT_PATTERNS,
      advancedPatterns: []
    });
    
    // Check URL against background script's matching function
    const matchResult = await testUrlMatchInBackground(urlToTest, patterns, advancedPatterns);
    
    // Show result
    if (matchResult) {
      let matchInfo = '';
      
      if (matchResult.pattern) {
        // Simple pattern match
        matchInfo = `matched pattern: ${matchResult.pattern}`;
      } else if (matchResult.type) {
        // Advanced pattern match
        matchInfo = `matched ${matchResult.type} pattern: ${matchResult.pattern}`;
        if (matchResult.useTimeWindow) {
          matchInfo += ` (active ${matchResult.activeFrom} - ${matchResult.activeTo})`;
        }
      }
      
      advancedTestResult.textContent = `URL "${urlObj.hostname}" MATCHES - ${matchInfo}`;
      advancedTestResult.className = 'test-result test-match';
    } else {
      advancedTestResult.textContent = `URL "${urlObj.hostname}" does NOT match any pattern.`;
      advancedTestResult.className = 'test-result test-no-match';
    }
  } catch (e) {
    console.error("Error testing URL:", e);
    advancedTestResult.textContent = 'Invalid URL. Please enter a valid URL like https://example.com';
    advancedTestResult.className = 'test-result error';
  }
}

/**
 * Test URL matching using the background script's function
 */
async function testUrlMatchInBackground(url, patterns, advancedPatterns) {
  try {
    const result = await browser.runtime.sendMessage({
      action: 'testUrlMatch',
      url,
      patterns,
      advancedPatterns
    });
    return result;
  } catch (error) {
    console.error("Error testing URL match in background:", error);
    // Fallback to a simple match if background call fails
    return urlMatches(url, patterns, advancedPatterns);
  }
}

/**
 * Check if a URL matches patterns (fallback function)
 */
function urlMatches(url, patterns, advancedPatterns = []) {
  try {
    const hostname = new URL(url).hostname;
    
    // Check simple patterns first
    for (const pattern of patterns) {
      if (pattern.startsWith('^')) {
        try {
          const regex = new RegExp(pattern, "i");
          if (regex.test(url)) {
            return { pattern };
          }
        } catch (e) {
          console.error("Invalid regex pattern:", pattern, e);
        }
      } else {
        const regexPattern = "^" + pattern
          .replace(/\./g, "\\.")
          .replace(/\*/g, ".*") + "$";
        
        if (new RegExp(regexPattern, "i").test(hostname)) {
          return { pattern };
        }
      }
    }
    
    // Check advanced patterns
    for (const advPattern of advancedPatterns) {
      if (!advPattern.active) continue;
      
      if (advPattern.useTimeWindow) {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        const fromParts = advPattern.activeFrom.split(':');
        const toParts = advPattern.activeTo.split(':');
        
        const fromTime = parseInt(fromParts[0]) * 60 + parseInt(fromParts[1]);
        const toTime = parseInt(toParts[0]) * 60 + parseInt(toParts[1]);
        
        if (currentTime < fromTime || currentTime > toTime) {
          continue;
        }
      }
      
      let isMatch = false;
      
      if (advPattern.type === 'regex') {
        try {
          const regex = new RegExp(advPattern.pattern, "i");
          isMatch = regex.test(url);
        } catch (e) {
          console.error("Invalid regex pattern:", advPattern.pattern, e);
        }
      } else {
        const regexPattern = "^" + advPattern.pattern
          .replace(/\./g, "\\.")
          .replace(/\*/g, ".*") + "$";
        
        isMatch = new RegExp(regexPattern, "i").test(hostname);
      }
      
      if (isMatch) {
        return advPattern;
      }
    }
    
    return false;
  } catch (e) {
    console.error("Error matching URL:", e);
    return false;
  }
}

/**
 * Update the displayed current time
 */
function updateCurrentTimeDisplay() {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  currentTimeDisplay.textContent = `${hours}:${minutes}`;
}

/**
 * Save the deletion delay setting
 */
async function saveDeleteDelay() {
  const delay = parseInt(deleteDelayInput.value, 10);
  
  // Validate input
  if (isNaN(delay) || delay < 0 || delay > 60) {
    showTemporaryStatus('Please enter a valid delay between 0 and 60 seconds', 'error');
    return;
  }
  
  // Save the setting
  await browser.storage.sync.set({ deleteDelay: delay });
  showTemporaryStatus('Deletion delay saved', 'success');
}

/**
 * Save delete on tab close setting
 */
async function saveDeleteOnTabClose() {
  const deleteOnTabClose = deleteOnTabCloseCheckbox.checked;
  await browser.storage.sync.set({ deleteOnTabClose });
  showTemporaryStatus('Tab close preference saved', 'success');
}

/**
 * Save the use containers setting
 */
async function saveUseContainers() {
  const useContainers = useContainersCheckbox.checked;
  
  // Save the setting
  await browser.storage.sync.set({ useContainers });
  showTemporaryStatus('Container preference saved', 'success');
}

/**
 * Save session-only mode setting
 */
async function saveSessionOnlyMode() {
  const sessionOnlyMode = sessionOnlyModeCheckbox.checked;
  await browser.storage.sync.set({ sessionOnlyMode });
  showTemporaryStatus('Session-only mode preference saved', 'success');
}

/**
 * Save show notifications setting
 */
async function saveShowNotifications() {
  const showNotifications = showNotificationsCheckbox.checked;
  await browser.storage.sync.set({ showNotifications });
  showTemporaryStatus('Notification preference saved', 'success');
}

/**
 * Save the theme setting
 */
async function saveTheme() {
  const theme = themeSelect.value;
  
  // Save the setting
  await browser.storage.sync.set({ theme });
  showTemporaryStatus('Theme preference saved', 'success');
  
  // Apply the theme
  await applyTheme();
}

/**
 * Handle the retroactive history wipe
 */
async function retroactiveHistoryWipe() {
  try {
    // Confirm action
    if (!confirm('This will search your browser history and delete all past visits that match your current patterns. Continue?')) {
      return;
    }
    
    // Show working status
    wipeStatusElement.textContent = 'Searching and removing history entries...';
    wipeStatusElement.className = 'status-message';
    wipeHistoryButton.disabled = true;
    
    // Send message to background script
    const result = await browser.runtime.sendMessage({
      action: 'wipeMatchingHistory'
    });
    
    // Show result
    if (result.success) {
      wipeStatusElement.textContent = `Successfully removed ${result.count} history entries.`;
      wipeStatusElement.className = 'status-message success';
    } else {
      wipeStatusElement.textContent = `Error: ${result.error}`;
      wipeStatusElement.className = 'status-message error';
    }
  } catch (error) {
    console.error('Error wiping history:', error);
    wipeStatusElement.textContent = `Error: ${error.message}`;
    wipeStatusElement.className = 'status-message error';
  } finally {
    wipeHistoryButton.disabled = false;
    
    // Clear status after a delay
    setTimeout(() => {
      wipeStatusElement.textContent = '';
      wipeStatusElement.className = 'status-message';
    }, 5000);
  }
}

/**
 * Apply the appropriate theme based on the user preference or system setting
 */
async function applyTheme() {
  try {
    // Get theme preference from storage
    const { theme = DEFAULT_THEME } = await browser.storage.sync.get({ theme: DEFAULT_THEME });
    
    let effectiveTheme = theme;
    
    // If system theme, detect the preferred color scheme
    if (theme === 'system') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    // Apply the theme
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    
    return effectiveTheme;
  } catch (error) {
    console.error('Error applying theme:', error);
    // Fall back to light theme
    document.documentElement.setAttribute('data-theme', 'light');
    return 'light';
  }
}

/**
 * Set up a listener for system theme changes
 */
function setupThemeListener() {
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
}

/**
 * Export settings to a JSON file
 */
function exportSettings() {
  // Load all settings
  browser.storage.sync.get().then((settings) => {
    // Convert to JSON string
    const jsonString = JSON.stringify(settings, null, 2);
    
    // Create a blob and download link
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = 'erasetrail-settings.json';
    a.click();
    
    // Cleanup
    URL.revokeObjectURL(url);
    importExportStatus.textContent = 'Settings exported successfully';
    importExportStatus.className = 'status-message success';
  }).catch(error => {
    importExportStatus.textContent = `Export failed: ${error.message}`;
    importExportStatus.className = 'status-message error';
  });
}

/**
 * Import settings from a JSON file
 */
function importSettings() {
  importFileInput.click();
}

/**
 * Handle file selection for import
 */
function handleFileSelect() {
  const file = importFileInput.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  
  reader.onload = (event) => {
    try {
      // Parse the JSON
      const settings = JSON.parse(event.target.result);
      
      // Validate at least one required property
      if (!settings.patterns && !settings.advancedPatterns) {
        throw new Error('Invalid settings file');
      }
      
      // Save the settings
      browser.storage.sync.set(settings).then(() => {
        // Reload the UI
        initOptions();
        importExportStatus.textContent = 'Settings imported successfully';
        importExportStatus.className = 'status-message success';
      });
    } catch (error) {
      importExportStatus.textContent = `Import failed: ${error.message}`;
      importExportStatus.className = 'status-message error';
    }
  };
  
  reader.readAsText(file);
}

/**
 * Reset all settings to defaults
 */
function resetSettings() {
  if (confirm('Are you sure you want to reset all settings to defaults?')) {
    const defaults = {
      patterns: DEFAULT_PATTERNS,
      advancedPatterns: [],
      deleteDelay: DEFAULT_DELETE_DELAY,
      deleteOnTabClose: DEFAULT_DELETE_ON_TAB_CLOSE,
      useContainers: DEFAULT_USE_CONTAINERS,
      sessionOnlyMode: DEFAULT_SESSION_ONLY_MODE,
      showNotifications: DEFAULT_SHOW_NOTIFICATIONS,
      theme: DEFAULT_THEME
    };
    
    browser.storage.sync.set(defaults).then(() => {
      // Reload the UI
      initOptions();
      showTemporaryStatus('All settings reset to defaults', 'success');
    });
  }
}

/**
 * Show a temporary status message
 */
function showTemporaryStatus(message, type = 'info') {
  saveStatus.textContent = message;
  saveStatus.className = `status-message ${type}`;
  
  // Clear after a few seconds
  setTimeout(() => {
    saveStatus.textContent = '';
    saveStatus.className = 'status-message';
  }, 3000);
}

/**
 * Toggle time inputs based on checkbox state
 */
function toggleTimeInputs() {
  const isEnabled = useTimeWindowCheckbox.checked;
  timeFromInput.disabled = !isEnabled;
  timeToInput.disabled = !isEnabled;
  
  // Set default values if enabled and empty
  if (isEnabled) {
    if (!timeFromInput.value) timeFromInput.value = '09:00';
    if (!timeToInput.value) timeToInput.value = '17:00';
  }
}

// Set up event listeners
document.addEventListener('DOMContentLoaded', () => {
  //console.log("DOM loaded, initializing options");
  initOptions();
  setupThemeListener();
});

// Basic tab listeners
addPatternButton.addEventListener('click', addPattern);
newPatternInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addPattern();
});
testButton.addEventListener('click', testPatternMatch);
testUrlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') testPatternMatch();
});

// Advanced tab listeners
useTimeWindowCheckbox.addEventListener('change', toggleTimeInputs);
addAdvancedPatternButton.addEventListener('click', addAdvancedPattern);
advancedTestButton.addEventListener('click', testAdvancedPatternMatch);
advancedTestUrlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') testAdvancedPatternMatch();
});

// Settings tab listeners
deleteDelayInput.addEventListener('change', saveDeleteDelay);
deleteOnTabCloseCheckbox.addEventListener('change', saveDeleteOnTabClose);
useContainersCheckbox.addEventListener('change', saveUseContainers);
sessionOnlyModeCheckbox.addEventListener('change', saveSessionOnlyMode);
showNotificationsCheckbox.addEventListener('change', saveShowNotifications);
themeSelect.addEventListener('change', saveTheme);
wipeHistoryButton.addEventListener('click', retroactiveHistoryWipe);

// Import/Export listeners
exportButton.addEventListener('click', exportSettings);
importButton.addEventListener('click', importSettings);
importFileInput.addEventListener('change', handleFileSelect);
resetButton.addEventListener('click', resetSettings);