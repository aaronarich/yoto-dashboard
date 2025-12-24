# Yoto Dashboard PWA 📻🔋

A polished, high-precision Progressive Web App (PWA) for tracking your kids' Yoto players in real-time. Features a dark-mode "Material Mono" aesthetic using **IBM Plex Mono** and **Material Symbols**.

![PWA Dashboard](file:///Users/aaronarich/.gemini/antigravity/brain/38c18464-d14e-431a-89af-61a576963e38/yoto_dashboard_final_check_1766551902450.png)

## ✨ Features

- **Live Device Monitoring**: Real-time status for all your Yoto players.
- **Battery & Charging Intelligence**: Dynamic battery icons with explicit "(Charging)" status indicators.
- **Low Battery Alerts**: Automated push notifications when any device drops below **20%**.
- **Active Card Detection**: See exactly which card is currently inserted (or if it's empty).
- **WiFi Network Insight**: View the connected SSID for all online devices.
- **Technical Aesthetic**: Flat, high-contrast design using IBM Plex Mono for a technical, precise feel.
- **PWA Ready**: Installable on iOS/Android Home Screens with background sync capabilities.

## 🛠️ Tech Stack

- **Framework**: React + Vite
- **Styling**: Tailwind CSS + Custom Material Design 3 tokens
- **Icons**: Material Symbols Outlined
- **Font**: IBM Plex Mono
- **Storage**: IndexedDB (via `idb-keyval`) for history and tokens
- **PWA**: `vite-plugin-pwa` with custom `injectManifest` service worker

## 🚀 Setup & Development

### Prerequisites
- Node.js & npm
- Yoto Developer Account (for OAuth Client ID)

### Installation
1. Clone the repository:
   ```bash
   git clone git@github.com:aaronarich/yoto-dashboard.git
   cd yoto-dashboard
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

### Building for Production
```bash
npm run build
```
The production-ready assets (including the Service Worker) will be in the `dist` directory.

## 📱 iOS PWA Notifications
To receive low-battery alerts on iPhone:
1. Open the dashboard in Safari.
2. Tap the **Share** button and select **"Add to Home Screen"**.
3. Open the installed app from your Home Screen.
4. Tap **"Enable Alerts"** in the header.
5. (Optional) Use the **"Test Alert"** button to verify the push delivery.

## 🔒 Security
This application uses the **OAuth2 PKCE** flow for secure authentication with Yoto's API. Tokens are stored locally in your browser's IndexedDB and are never sent to third-party servers.

---
*Created with ❤️ for Yoto parents.*
