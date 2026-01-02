/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { storageService } from './services/storage';
import { yotoService } from './services/yotoApi';

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('periodicsync', (event: any) => {
    if (event.tag === 'yoto-update') {
        event.waitUntil(updateYotoStatus());
    }
});

import { get, set } from 'idb-keyval';

async function updateYotoStatus() {
    console.log('[SW] Starting background status update...');
    const tokens = await storageService.getTokens();
    if (!tokens) {
        console.warn('[SW] No tokens found, skipping update');
        return;
    }

    // Optional: Add check for token expiration and maybe refresh if possible
    // For now, just skip if likely expired (we'd need common logic for refresh)
    if (tokens.expiresAt < Date.now()) {
        console.warn('[SW] Tokens expired, skipping update');
        return;
    }

    try {
        console.log('[SW] Fetching devices...');
        const devices = await yotoService.fetchDevices(tokens.accessToken);
        console.log(`[SW] Found ${devices.length} devices`);

        for (const device of devices) {
            const deviceId = device.id || device.deviceId;
            console.log(`[SW] Fetching status for device: ${deviceId}`);
            const status = await yotoService.fetchDeviceStatus(deviceId, tokens.accessToken);

            // Save status to history
            await storageService.saveStatus({
                deviceId: deviceId,
                online: status.online,
                timestamp: new Date().toISOString(),
                batteryLevel: status.batteryLevelPercentage,
                playbackStatus: status.playback,
                activeCard: status.activeCard,
                isCharging: status.isCharging,
                wifiSsid: status.networkSsid
            });

            // Notification Logic
            const batteryLevel = status.batteryLevelPercentage;
            console.log(`[SW] Device ${deviceId} battery: ${batteryLevel}%, charging: ${status.isCharging}`);

            if (batteryLevel != null && batteryLevel <= 20 && !status.isCharging) {
                const notifyKey = `notified_low_battery_${deviceId}`;
                const lastNotified = await get(notifyKey);

                // Only notify once per charge cycle (if tracked level was above 20% or never tracked)
                if (lastNotified === undefined || lastNotified > 20) {
                    console.log(`[SW] Triggering low battery notification for ${deviceId}`);
                    await self.registration.showNotification(`Yoto Battery Low: ${device.name || 'Player'}`, {
                        body: `Battery is at ${batteryLevel}%. Please plug it in!`,
                        icon: '/icons/icon-192x192.png',
                        tag: `low-battery-${deviceId}`,
                        badge: '/icons/icon-192x192.png'
                    });
                }
                await set(notifyKey, batteryLevel);
            } else if (batteryLevel > 20) {
                // Reset notification tracking when battery is above 20%
                await set(`notified_low_battery_${deviceId}`, batteryLevel);
            }
        }
    } catch (err) {
        console.error('[SW] Background sync failed', err);
    }
}

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            if (clientList.length > 0) {
                return clientList[0].focus();
            }
            return self.clients.openWindow('/');
        })
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'update-status') {
        console.log('[SW] Manual update-status requested via message');
        event.waitUntil(updateYotoStatus());
    }
});

console.log('Service Worker Loaded and Ready (v1.0.1)');
