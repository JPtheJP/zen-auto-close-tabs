const DEFAULTS = {
  enabled: true,
  inactivityDays: 7,
  protectAudible: true,
  protectDomains: [],
  scanIntervalMinutes: 60
};

const $ = (id) => document.getElementById(id);

async function loadSettings() {
  const settings = await browser.storage.local.get(DEFAULTS);
  $("enabled").checked = settings.enabled;
  $("inactivityDays").value = settings.inactivityDays;
  $("scanIntervalMinutes").value = settings.scanIntervalMinutes;
  $("protectAudible").checked = settings.protectAudible;
  $("protectDomains").value = settings.protectDomains.join("\n");
}

async function saveSettings() {
  const settings = {
    enabled: $("enabled").checked,
    inactivityDays: Math.max(1, parseInt($("inactivityDays").value, 10) || 7),
    scanIntervalMinutes: Math.max(1, parseInt($("scanIntervalMinutes").value, 10) || 60),
    protectAudible: $("protectAudible").checked,
    protectDomains: $("protectDomains").value
      .split("\n")
      .map(d => d.trim().toLowerCase())
      .filter(d => d.length > 0)
  };
  await browser.storage.local.set(settings);
  $("status").textContent = "Settings saved";
  setTimeout(() => { $("status").textContent = ""; }, 2000);
  updatePreview(settings);
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

async function updatePreview(settings) {
  if (!settings) {
    settings = await browser.storage.local.get(DEFAULTS);
  }

  const tabs = await browser.tabs.query({});
  const cutoff = Date.now() - (settings.inactivityDays * 24 * 60 * 60 * 1000);
  let count = 0;

  for (const tab of tabs) {
    if (tab.pinned) continue;
    if (tab.active) continue;
    if (isInternalUrl(tab.url)) continue;
    if (settings.protectAudible && tab.audible) continue;
    if (matchesProtectedDomain(tab.url, settings.protectDomains)) continue;
    if (tab.lastAccessed >= cutoff) continue;
    count++;
  }

  const total = tabs.filter(t => !t.pinned).length;

  if (!settings.enabled) {
    $("preview").textContent = `Disabled — ${count} of ${total} unpinned tabs would qualify`;
  } else if (count === 0) {
    $("preview").textContent = `No tabs to close (${total} unpinned tabs active)`;
  } else {
    $("preview").textContent = `${count} of ${total} unpinned tabs would be closed`;
  }
}

async function checkFirstRun() {
  const { firstRunPending } = await browser.storage.local.get({ firstRunPending: false });
  if (!firstRunPending) return;

  const settings = await browser.storage.local.get(DEFAULTS);
  const tabs = await browser.tabs.query({});
  const cutoff = Date.now() - (settings.inactivityDays * 24 * 60 * 60 * 1000);
  let count = 0;

  for (const tab of tabs) {
    if (tab.pinned || tab.active || isInternalUrl(tab.url)) continue;
    if (settings.protectAudible && tab.audible) continue;
    if (matchesProtectedDomain(tab.url, settings.protectDomains)) continue;
    if (tab.lastAccessed >= cutoff) continue;
    count++;
  }

  $("warningMessage").textContent = count > 0
    ? `${count} tab${count === 1 ? "" : "s"} would be closed right now with current settings (inactive for ${settings.inactivityDays}+ days). You can adjust settings first or proceed.`
    : "No tabs would be closed with current settings. You're good to go.";

  $("firstRunWarning").hidden = false;
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();
  await checkFirstRun();
  await updatePreview();
});

$("save").addEventListener("click", saveSettings);

$("skipFirstRun").addEventListener("click", async () => {
  await browser.storage.local.set({ firstRunPending: false });
  $("firstRunWarning").hidden = true;
});

$("proceedFirstRun").addEventListener("click", async () => {
  await browser.storage.local.set({ firstRunPending: false });
  $("firstRunWarning").hidden = true;
});
