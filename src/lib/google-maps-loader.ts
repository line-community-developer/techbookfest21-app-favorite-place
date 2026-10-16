"use client";

let googleMapsPromise: Promise<void> | null = null;

// Google Maps JavaScript API を <script> タグで動的読み込みする。
// LIFFのページはSPA的に何度も表示されうるため、二重ロードを防ぐためPromiseをキャッシュする。
export function loadGoogleMapsScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (window.google?.maps) {
    return Promise.resolve();
  }
  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      reject(new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY が未設定です。"));
      return;
    }

    const params = new URLSearchParams({ key: apiKey });
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps の読み込みに失敗しました。"));
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}
