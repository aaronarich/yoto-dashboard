import { useState, useCallback, useEffect } from 'react';
import { storageService } from '../services/storage';

const CLIENT_ID = 'VK3SmL1Gz7LdicJSmGuePRWl4HRJplBL';
const REDIRECT_URI = window.location.origin + '/callback';
const AUTH_ENDPOINT = 'https://login.yotoplay.com/authorize';
const TOKEN_ENDPOINT = 'https://login.yotoplay.com/oauth/token';

export function useYotoAuth() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    const generateCodeVerifier = () => {
        const array = new Uint8Array(32);
        window.crypto.getRandomValues(array);
        return btoa(String.fromCharCode(...array))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    };

    const generateCodeChallenge = async (verifier: string) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const digest = await window.crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode(...new Uint8Array(digest)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    };

    const login = async () => {
        try {
            console.log('Initiating Yoto login...');
            const verifier = generateCodeVerifier();
            localStorage.setItem('yoto_code_verifier', verifier);
            const challenge = await generateCodeChallenge(verifier);

            const url = new URL(AUTH_ENDPOINT);
            url.searchParams.set('client_id', CLIENT_ID);
            url.searchParams.set('redirect_uri', REDIRECT_URI);
            url.searchParams.set('response_type', 'code');
            url.searchParams.set('code_challenge', challenge);
            url.searchParams.set('code_challenge_method', 'S256');
            url.searchParams.set('scope', 'openid profile email devices:read offline_access');
            url.searchParams.set('audience', 'https://api.yotoplay.com');

            console.log('Redirecting to:', url.toString());
            window.location.href = url.toString();
        } catch (error) {
            console.error('Login initiation failed:', error);
            alert('Failed to start login flow. Please check the console for details.');
        }
    };

    const handleCallback = useCallback(async (code: string) => {
        const verifier = localStorage.getItem('yoto_code_verifier');
        if (!verifier) throw new Error('No code verifier found');

        console.log('Exchanging code for tokens...');
        const response = await fetch(TOKEN_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                grant_type: 'authorization_code',
                code,
                redirect_uri: REDIRECT_URI,
                code_verifier: verifier,
                audience: 'https://api.yotoplay.com' // Explicitly include audience
            })
        });

        const data = await response.json();
        console.log('Token response scope:', data.scope);
        const tokens = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + data.expires_in * 1000
        };
        await storageService.saveTokens(tokens);
        setIsAuthenticated(true);
        localStorage.removeItem('yoto_code_verifier');
        return tokens;
    }, []);

    useEffect(() => {
        console.log('useYotoAuth: Checking stored tokens...');
        storageService.getTokens().then(tokens => {
            if (tokens) {
                console.log('useYotoAuth: Tokens found, expires at:', new Date(tokens.expiresAt).toLocaleString());
                if (tokens.expiresAt > Date.now()) {
                    setIsAuthenticated(true);
                    console.log('useYotoAuth: Tokens valid, setting authenticated=true');
                } else {
                    console.warn('useYotoAuth: Tokens expired');
                }
            } else {
                console.log('useYotoAuth: No tokens found');
            }
            setLoading(false);
        });
    }, []);

    const logout = async () => {
        await storageService.saveTokens(null as any);
        window.location.reload();
    };

    return { isAuthenticated, loading, login, handleCallback, logout };
}
