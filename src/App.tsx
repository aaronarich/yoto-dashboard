import { useEffect, useState } from 'react';
import { useYotoAuth } from './hooks/useYotoAuth';
import { yotoService } from './services/yotoApi';
import type { PlayerStatus } from './services/storage';
import { storageService } from './services/storage';
import { History } from 'lucide-react';

export default function App() {
    const { isAuthenticated, loading, login, handleCallback, logout } = useYotoAuth();
    const [devices, setDevices] = useState<any[]>([]);
    const [notifPermission, setNotifPermission] = useState<NotificationPermission>(Notification.permission);
    const [debugInfo, setDebugInfo] = useState<string>('');

    console.log('App state:', { isAuthenticated, loading });

    useEffect(() => {
        // Force dark mode for now as requested for the new aesthetic
        document.documentElement.classList.add('dark');
    }, []);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (code) {
            handleCallback(code).then((tokens) => {
                window.history.replaceState({}, document.title, "/");
                if (tokens) refreshData(tokens);
            });
        }
    }, [handleCallback]);

    useEffect(() => {
        if (isAuthenticated) {
            refreshData();

            // Register periodic sync
            if ('serviceWorker' in navigator && 'periodicSync' in (navigator as any)) {
                (navigator.serviceWorker as any).ready.then(async (registration: any) => {
                    try {
                        await registration.periodicSync.register('yoto-update', {
                            minInterval: 60 * 60 * 1000, // 1 hour
                        });
                    } catch (err) {
                        console.error('Periodic sync registration failed', err);
                    }
                });
            }
        }
    }, [isAuthenticated]);

    const refreshData = async (providedTokens?: any) => {
        console.log('refreshData called');
        const tokens = providedTokens || await storageService.getTokens();
        console.log('Using tokens:', tokens ? 'Yes' : 'No');
        if (!tokens) return;

        try {
            console.log('Fetching devices...');
            const devs = await yotoService.fetchDevices(tokens.accessToken);
            console.log('Devices fetched:', devs);

            if (!Array.isArray(devs)) {
                console.error('Expected array of devices, got:', typeof devs);
                return;
            }

            const devicesWithStatus = await Promise.all(devs.map(async (d: any) => {
                const deviceId = d.id || d.deviceId;
                console.log(`Processing device:`, d);

                if (!deviceId) {
                    console.error('Device missing ID:', d);
                    return null;
                }

                try {
                    const status = await yotoService.fetchDeviceStatus(deviceId, tokens.accessToken);
                    console.log(`Status for ${deviceId}:`, status);

                    const playerStatus: PlayerStatus = {
                        deviceId: deviceId,
                        online: status.online !== undefined ? status.online : (d.online || false),
                        timestamp: new Date().toISOString(),
                        batteryLevel: status.batteryLevelPercentage,
                        lastSeen: status.updatedAt,
                        playbackStatus: status.playback,
                        activeCard: status.activeCard,
                        isCharging: status.isCharging,
                        wifiSsid: status.networkSsid
                    };
                    await storageService.saveStatus(playerStatus);
                    return { ...d, status: { ...status, ...playerStatus } };
                } catch (statusErr) {
                    console.error(`Failed to fetch status for ${d.id}:`, statusErr);
                    return { ...d, status: { online: d.online || false, lastSeen: null, batteryLevel: 0 } };
                }
            }));

            const validDevices = devicesWithStatus.filter(d => d !== null);
            console.log('Setting devices state:', validDevices);
            setDevices(validDevices);
        } catch (err) {
            console.error('Refresh data error:', err);
        }
    };



    const formatRelativeTime = (isoString: string) => {
        if (!isoString) return 'Never';
        const date = new Date(isoString);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return date.toLocaleDateString();
    };

    const requestNotificationPermission = async () => {
        const permission = await Notification.requestPermission();
        setNotifPermission(permission);
        if (permission === 'granted') {
            new Notification("Notifications Enabled!", {
                body: "You will now be notified when your Yoto battery is low.",
                icon: "/icons/icon-192x192.png"
            });
        }
    };

    const sendTestNotification = async () => {
        setDebugInfo('Triggering test...');
        if (!window.isSecureContext) {
            setDebugInfo('Error: Not in a secure context (HTTPS/localhost). Notifications will not work.');
            alert('Service Workers and Notifications require HTTPS or localhost.');
            return;
        }

        if ('serviceWorker' in navigator) {
            try {
                setDebugInfo('Waiting for Service Worker ready...');
                const registration = await navigator.serviceWorker.ready;
                setDebugInfo('Service Worker ready! Sending...');

                if (!registration.showNotification) {
                    setDebugInfo('Error: registration.showNotification is not available.');
                    return;
                }

                await registration.showNotification("Test Alert 🧪", {
                    body: "This is a test notification from your Yoto Tracker.",
                    icon: "/icons/icon-192x192.png",
                    tag: "test-notification",
                    badge: "/icons/icon-192x192.png"
                });
                setDebugInfo('Notification triggered successfully!');
            } catch (err: any) {
                console.error('Failed to show test notification:', err);
                setDebugInfo(`Error: ${err.message || 'Unknown error'}`);
            }
        } else {
            setDebugInfo('Error: Service worker not supported in this browser.');
        }
    };

    const getBatteryIconName = (level: number | null) => {
        if (level === null) return 'battery_unknown';
        if (level >= 95) return 'battery_full';
        if (level >= 85) return 'battery_6_bar';
        if (level >= 70) return 'battery_5_bar';
        if (level >= 55) return 'battery_4_bar';
        if (level >= 40) return 'battery_3_bar';
        if (level >= 25) return 'battery_2_bar';
        if (level >= 10) return 'battery_1_bar';
        return 'battery_0_bar';
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)] p-6">
                <div className="max-w-md w-full md-card p-12 text-center">
                    <div className="w-20 h-20 bg-[var(--brand-primary)] rounded-full mx-auto mb-8 flex items-center justify-center shadow-lg">
                        <span className="material-symbols-outlined text-white text-4xl">radio</span>
                    </div>
                    <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-2">Yoto Tracker</h1>
                    <p className="text-[var(--text-secondary)] mb-10">Monitor your players in real-time</p>
                    <button
                        onClick={login}
                        className="w-full bg-[var(--brand-primary)] hover:opacity-90 text-white md-button shadow-md flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined">login</span>
                        Connect Account
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] p-6 md:p-12 text-[var(--text-primary)]">
            <header className="flex justify-between items-center mb-12">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <span className="material-symbols-outlined text-[var(--brand-primary)] text-4xl">analytics</span>
                        Yoto Dashboard
                    </h1>
                    <p className="text-[var(--text-secondary)] text-sm ml-12">Live device monitoring</p>
                </div>
                <div className="flex gap-4">
                    {notifPermission !== 'granted' && (
                        <button
                            onClick={requestNotificationPermission}
                            className="md-button bg-[var(--brand-primary)] text-white flex items-center gap-2 hover:opacity-90"
                        >
                            <span className="material-symbols-outlined">notifications</span>
                            Enable Alerts
                        </button>
                    )}
                    {notifPermission === 'granted' && (
                        <button
                            onClick={sendTestNotification}
                            className="md-button bg-[var(--md-surface-2)] text-[var(--text-primary)] border border-indigo-200 flex items-center gap-2 hover:bg-indigo-50"
                        >
                            <span className="material-symbols-outlined">notifications_active</span>
                            Test Alert
                        </button>
                    )}
                    <button
                        onClick={() => refreshData()}
                        className="md-button bg-[var(--md-surface-2)] text-[var(--text-primary)] flex items-center gap-2 hover:bg-[var(--md-surface-1)]"
                    >
                        <History size={18} />
                        Refresh
                    </button>
                    <button
                        onClick={logout}
                        className="md-button border border-red-200 text-red-600 flex items-center gap-2 hover:bg-red-50"
                    >
                        Logout
                    </button>
                </div>
                {debugInfo && (
                    <div className="mt-4 p-2 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs rounded font-mono">
                        {debugInfo}
                    </div>
                )}
            </header>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {devices.map(device => (
                    <div key={device.id || device.deviceId} className="md-card p-6 flex flex-col justify-between border border-transparent hover:border-[var(--card-border)]">
                        <div>
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${device.status.online ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        <span className="material-symbols-outlined text-2xl">
                                            {device.status.online ? 'sensors' : 'sensors_off'}
                                        </span>
                                    </div>
                                    <h2 className="text-xl font-bold">
                                        {(device.name || 'Unknown Player').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}
                                    </h2>
                                </div>
                                <div className={device.status.online ? 'text-green-500' : 'text-red-500'}>
                                    <div className={`w-2 h-2 rounded-full ${device.status.online ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-[var(--bg-secondary)] rounded-xl p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-[var(--text-secondary)] text-sm">
                                        <span className="material-symbols-outlined text-lg">schedule</span>
                                        <span>Last Seen</span>
                                    </div>
                                    <span className="text-[var(--text-primary)] font-medium text-sm">
                                        {formatRelativeTime(device.status.lastSeen)}
                                    </span>
                                </div>

                                <div className="bg-[var(--bg-secondary)] rounded-xl p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-[var(--text-secondary)] text-sm">
                                        <span className="material-symbols-outlined text-lg">{device.status.isCharging ? 'battery_charging_full' : getBatteryIconName(device.status.batteryLevel)}</span>
                                        <span>Battery {device.status.isCharging && '(Charging)'}</span>
                                    </div>
                                    <span className={`font-bold text-lg ${device.status.batteryLevel != null && device.status.batteryLevel < 20 && !device.status.isCharging ? 'text-red-600' : 'text-[var(--text-primary)]'}`}>
                                        {device.status.batteryLevel != null ? `${device.status.batteryLevel}%` : '---'}
                                    </span>
                                </div>

                                {device.status.online && device.status.wifiSsid && (
                                    <div className="bg-[var(--bg-secondary)] rounded-xl p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-[var(--text-secondary)] text-sm">
                                            <span className="material-symbols-outlined text-lg">wifi</span>
                                            <span>Network</span>
                                        </div>
                                        <span className="text-[var(--text-primary)] font-bold text-xs truncate max-w-[120px]">
                                            {device.status.wifiSsid}
                                        </span>
                                    </div>
                                )}

                                {device.status.activeCard && device.status.activeCard !== 'none' && (
                                    <div className="bg-[var(--bg-secondary)] rounded-xl p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-[var(--text-secondary)] text-sm">
                                            <span className="material-symbols-outlined text-lg">style</span>
                                            <span>Inserted Card</span>
                                        </div>
                                        <span className="text-[var(--text-primary)] font-bold text-xs truncate max-w-[120px]">
                                            {device.status.activeCard}
                                        </span>
                                    </div>
                                )}

                                {device.status.playbackStatus && (
                                    <div className="mt-4 p-4 rounded-2xl bg-[var(--md-surface-1)] border border-indigo-100/50">
                                        <div className="flex items-center gap-2 text-indigo-600 text-[10px] font-bold uppercase tracking-wider mb-2">
                                            <span className="material-symbols-outlined text-sm">pumping_station</span>
                                            Currently Playing
                                        </div>
                                        <p className="text-[var(--text-primary)] font-medium text-sm leading-snug truncate">
                                            {device.status.playbackStatus.title || 'No Track Name'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
