export const DEFAULTS = {
  enabled: true,
  inactivityDays: 7,
  protectAudible: true,
  protectDomains: [],
  scanIntervalMinutes: 60
};

export function isInternalUrl(url) {
  if (!url) return true;
  return url.startsWith("about:") ||
         url.startsWith("moz-extension:") ||
         url.startsWith("chrome:") ||
         url.startsWith("resource:");
}

export function normalizeDomain(input) {
  let d = input.trim().toLowerCase();
  if (!d) return null;

  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//.test(d)) {
      d = new URL(d).hostname;
    }
  } catch {
    d = d.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  }

  d = d.replace(/\/.*$/, "");
  d = d.replace(/:\d+$/, "");
  d = d.replace(/^\*\./, "");
  d = d.replace(/^\./, "");

  if (!d) return null;
  if (d.length > 253) return null;
  if (!d.includes(".")) return null;
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(d)) return null;
  if (d.includes("..")) return null;

  return d;
}

export function matchesProtectedDomain(url, protectedDomains) {
  if (!url || protectedDomains.length === 0) return false;
  try {
    const hostname = new URL(url).hostname;
    return protectedDomains.some(raw => {
      const d = raw.trim().toLowerCase();
      return d && (hostname === d || hostname.endsWith("." + d));
    });
  } catch {
    return false;
  }
}
