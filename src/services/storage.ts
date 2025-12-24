import { get, set, update } from 'idb-keyval';

export interface PlayerStatus {
    deviceId: string;
    online: boolean;
    timestamp: string;
    batteryLevel?: number;
    lastSeen?: string;
    playbackStatus?: any;
    activeCard?: string;
    isCharging?: boolean;
    wifiSsid?: string;
}

const STORAGE_KEY = 'yoto_status_history';

export const storageService = {
    async saveStatus(status: PlayerStatus) {
        await update(STORAGE_KEY, (val: PlayerStatus[] | undefined) => {
            const history = val || [];
            return [...history, status].slice(-200); // Keep last 200 entries
        });
    },

    async getHistory(): Promise<PlayerStatus[]> {
        return (await get(STORAGE_KEY)) || [];
    },

    async saveTokens(tokens: { accessToken: string; refreshToken: string; expiresAt: number }) {
        await set('yoto_tokens', tokens);
    },

    async getTokens() {
        return await get('yoto_tokens');
    }
};
