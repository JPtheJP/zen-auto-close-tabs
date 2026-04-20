const DEFAULTS = {
  enabled: true,
  inactivityDays: 7,
  protectAudible: true,
  protectDomains: [],
  scanIntervalMinutes: 60
};

const ALARM_NAME = "scanTabs";

async function getSettings() {
  const result = await browser.storage.local.get(DEFAULTS);
  return result;
}

async function setupAlarm() {
  const settings = await getSettings();
  await browser.alarms.clear(ALARM_NAME);
  browser.alarms.create(ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: settings.scanIntervalMinutes
  });
}

function isInternalUrl(url) {
  if (!url) return true;
  return url.startsWith("about:") ||
         url.startsWith("moz-extension:") ||
         url.startsWith("chrome:") ||
         url.startsWith("resource:");
}

function matchesProtectedDomain(url, protectedDomains) {
  if (!url || protectedDomains.length === 0) return false;
  try {
    const hostname = new URL(url).hostname;
    return protectedDomains.some(domain => {
      const d = domain.trim().toLowerCase();
      if (!d) return false;
      return hostname === d || hostname.endsWith("." + d);
    });
  } catch {
    return false;
  }
}

async function scanAndCloseTabs() {
  const settings = await getSettings();
  if (!settings.enabled) return;

  const { firstRunPending } = await browser.storage.local.get({ firstRunPending: false });
  if (firstRunPending) return;

  const tabs = await browser.tabs.query({});
  const cutoff = Date.now() - (settings.inactivityDays * 24 * 60 * 60 * 1000);

  const candidatesByWindow = new Map();

  for (const tab of tabs) {
    if (tab.pinned) continue;
    if (tab.active) continue;
    if (isInternalUrl(tab.url)) continue;
    if (settings.protectAudible && tab.audible) continue;
    if (matchesProtectedDomain(tab.url, settings.protectDomains)) continue;
    if (tab.lastAccessed >= cutoff) continue;

    if (!candidatesByWindow.has(tab.windowId)) {
      candidatesByWindow.set(tab.windowId, []);
    }
    candidatesByWindow.get(tab.windowId).push(tab.id);
  }

  const tabsToClose = [];

  for (const [windowId, candidates] of candidatesByWindow) {
    const allTabsInWindow = tabs.filter(t => t.windowId === windowId);
    const remainingCount = allTabsInWindow.length - candidates.length;

    if (remainingCount >= 1) {
      tabsToClose.push(...candidates);
    } else {
      tabsToClose.push(...candidates.slice(0, candidates.length - 1));
    }
  }

  if (tabsToClose.length > 0) {
    await browser.tabs.remove(tabsToClose);
  }
}

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    scanAndCloseTabs();
  }
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.scanIntervalMinutes) {
    setupAlarm();
  }
});

browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    browser.storage.local.set({ firstRunPending: true });
  }
  setupAlarm();
});

browser.runtime.onStartup.addListener(() => {
  setupAlarm();
});
