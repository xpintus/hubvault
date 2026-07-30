# HubVault PWA Installation Guide

HubVault is now a Progressive Web App (PWA). This means you can install it on your device and use it like a native application, including some offline capabilities.

## How to Install

### Android (Chrome)
1. Open Chrome on your Android device and navigate to HubVault.
2. You may see a banner at the bottom of the screen prompting you to "Add HubVault to Home screen". Tap this banner.
3. If the banner doesn't appear, tap the three-dot menu icon in the top right corner.
4. Select "Install app" or "Add to Home screen" from the menu.
5. Follow the on-screen instructions to confirm the installation.

### iOS (Safari)
1. Open Safari on your iPhone or iPad and navigate to HubVault.
2. Tap the "Share" icon at the bottom of the screen (the square with an arrow pointing up).
3. Scroll down the share sheet and tap "Add to Home Screen".
4. Tap "Add" in the top right corner to confirm.

### Windows & macOS (Chrome or Edge)
1. Open Google Chrome or Microsoft Edge on your computer and navigate to HubVault.
2. Look for the "Install" icon (a monitor with a downward arrow) on the right side of the address bar.
3. Click the icon and then click "Install" when prompted.
4. Alternatively, click the three-dot menu in the top right corner and select "Install HubVault...".

## Summary of PWA Changes
*   **Web Manifest**: Added `manifest.webmanifest` defining the app name, colors, and icons.
*   **Icons**: Generated app icons ranging from 72x72 to 512x512 pixels, including maskable icons for Android.
*   **Service Worker**: Created `service-worker.js` to cache static assets (HTML, CSS, JS, Images, Fonts) allowing faster loads and offline capabilities.
*   **Offline Mode**: Added `offline.html` to display a user-friendly page when network is unavailable, instead of a default browser error.
*   **API Requests**: Ensured that sensitive data (like Supabase API calls) are fetched from the network and never cached.
*   **Meta Tags**: Updated `index.html` with Apple specific meta tags to support smooth iOS experience.
