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
    const tokens = await storageService.getTokens();
    if (!tokens) return;

    try {
        const devices = await yotoService.fetchDevices(tokens.accessToken);
        for (const device of devices) {
            const deviceId = device.id || device.deviceId;
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
            if (batteryLevel != null && batteryLevel <= 20 && !status.isCharging) {
                const notifyKey = `notified_low_battery_${deviceId}`;
                const lastNotified = await get(notifyKey);

                // Only notify once per charge cycle (if tracked level was above 20% or never tracked)
                if (lastNotified === undefined || lastNotified > 20) {
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
        console.error('Background sync failed', err);
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

console.log('Service Worker Loaded and Ready');
