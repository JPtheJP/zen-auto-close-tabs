import { DEFAULTS, isInternalUrl, matchesProtectedDomain } from "./shared.js";

const ALARM_NAME = "scanTabs";
const FIRST_RUN_EXPIRY_MS = 24 * 60 * 60 * 1000;

async function getSettings() {
  return await browser.storage.local.get(DEFAULTS);
}

async function setupAlarm() {
  const settings = await getSettings();
  await browser.alarms.clear(ALARM_NAME);
  browser.alarms.create(ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: settings.scanIntervalMinutes
  });
}

async function isFirstRunBlocked() {
  const { firstRunInstalledAt, firstRunDismissed } = await browser.storage.local.get({
    firstRunInstalledAt: null,
    firstRunDismissed: false
  });
  if (!firstRunInstalledAt || firstRunDismissed) return false;
  if (Date.now() - firstRunInstalledAt > FIRST_RUN_EXPIRY_MS) {
    await browser.storage.local.remove("firstRunInstalledAt");
    return false;
  }
  return true;
}

async function scanAndCloseTabs() {
  const settings = await getSettings();
  if (!settings.enabled) return;
  if (await isFirstRunBlocked()) return;

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
    await browser.tabs.remove(tabsToClose).catch(e => console.warn("tab removal failed:", e));
  }
}

browser.runtime.onMessage.addListener((message) => {
  if (message.action === "scanNow") {
    scanAndCloseTabs();
  }
});

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
    browser.storage.local.set({ firstRunInstalledAt: Date.now() });
  }
  setupAlarm();
});

browser.runtime.onStartup.addListener(() => {
  setupAlarm();
});
