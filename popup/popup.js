import { DEFAULTS, isInternalUrl, matchesProtectedDomain, normalizeDomain } from "../shared.js";

const MAX_DOMAINS = 100;
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
  const rawLines = $("protectDomains").value.split("\n");
  const warnings = [];

  const normalized = [];
  const rejected = [];
  for (const line of rawLines) {
    if (!line.trim()) continue;
    const d = normalizeDomain(line);
    if (d) {
      normalized.push(d);
    } else {
      rejected.push(line.trim());
    }
  }

  if (rejected.length > 0) {
    warnings.push(`${rejected.length} invalid entr${rejected.length === 1 ? "y" : "ies"} removed: ${rejected.join(", ")}`);
  }

  const capped = normalized.slice(0, MAX_DOMAINS);
  if (normalized.length > MAX_DOMAINS) {
    warnings.push(`Only the first ${MAX_DOMAINS} domains are saved (${normalized.length - MAX_DOMAINS} dropped)`);
  }

  const settings = {
    enabled: $("enabled").checked,
    inactivityDays: Math.min(365, Math.max(1, parseInt($("inactivityDays").value, 10) || 7)),
    scanIntervalMinutes: Math.min(1440, Math.max(1, parseInt($("scanIntervalMinutes").value, 10) || 60)),
    protectAudible: $("protectAudible").checked,
    protectDomains: capped
  };

  await browser.storage.local.set(settings);
  $("protectDomains").value = capped.join("\n");

  if (warnings.length > 0) {
    $("status").textContent = warnings.join(". ");
    $("status").style.color = "#e6a700";
    setTimeout(() => { $("status").textContent = ""; $("status").style.color = ""; }, 5000);
  } else {
    $("status").textContent = "Settings saved";
    $("status").style.color = "";
    setTimeout(() => { $("status").textContent = ""; }, 2000);
  }

  updatePreview(settings);
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
  const { firstRunInstalledAt, firstRunDismissed } = await browser.storage.local.get({
    firstRunInstalledAt: null,
    firstRunDismissed: false
  });
  if (!firstRunInstalledAt || firstRunDismissed) return;

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

async function dismissFirstRun() {
  await browser.storage.local.set({ firstRunDismissed: true });
  await browser.storage.local.remove("firstRunInstalledAt");
  $("firstRunWarning").hidden = true;
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();
  await checkFirstRun();
  await updatePreview();
});

$("save").addEventListener("click", saveSettings);
$("skipFirstRun").addEventListener("click", dismissFirstRun);

$("proceedFirstRun").addEventListener("click", async () => {
  await dismissFirstRun();
  await browser.runtime.sendMessage({ action: "scanNow" });
  await updatePreview();
});
