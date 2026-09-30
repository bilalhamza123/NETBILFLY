const API_KEY = import.meta.env.VITE_AMPLITUDE_API_KEY as string | undefined;
const ENDPOINT = "https://api2.amplitude.com/2/httpapi";

const getDeviceId = () => {
  const key = "__amplitude_device_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = globalThis.crypto?.randomUUID?.() ?? `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, id);
  }
  return id;
};

export type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

export async function track(
  eventType: string,
  eventProperties: AnalyticsProperties = {},
  userId?: string,
) {
  if (!API_KEY || typeof window === "undefined") return;

  const cleanProperties = Object.fromEntries(
    Object.entries(eventProperties).filter(([, value]) => value !== undefined),
  );

  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        api_key: API_KEY,
        events: [{
          user_id: userId || undefined,
          device_id: getDeviceId(),
          event_type: eventType,
          event_properties: {
            app_name: "NETBILFLY",
            app_version: import.meta.env.VITE_APP_VERSION || "unknown",
            path: window.location.pathname,
            ...cleanProperties,
          },
          time: Date.now(),
        }],
      }),
    });
  } catch {
    // Analytics must never break the application.
  }
}

export function identify(userId: string, userProperties: AnalyticsProperties = {}) {
  return track("User Identified", { ...userProperties }, userId);
}

export function trackPageView() {
  return track("Page Viewed", {
    page_path: window.location.pathname,
    page_title: document.title,
  });
}
