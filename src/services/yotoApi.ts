const isLocal = typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname);
export const YOTO_API_BASE = isLocal ? '/api' : 'https://api.yotoplay.com';
console.log('Yoto API Base:', YOTO_API_BASE);

export const yotoService = {
    async fetchDevices(accessToken: string) {
        const response = await fetch(`${YOTO_API_BASE}/device-v2/devices/mine`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });
        if (!response.ok) throw new Error('Failed to fetch devices');
        const data = await response.json();
        // The mine endpoint returns an array directly according to many v2 patterns
        return Array.isArray(data) ? data : (data.devices || []);
    },

    async fetchDeviceStatus(deviceId: string, accessToken: string) {
        const response = await fetch(`${YOTO_API_BASE}/device-v2/${deviceId}/status`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });
        if (!response.ok) throw new Error(`Failed to fetch status for device ${deviceId}`);
        return await response.json();
    }
};
