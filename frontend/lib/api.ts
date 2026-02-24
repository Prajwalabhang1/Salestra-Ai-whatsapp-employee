// API Configuration
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// API Client
export async function apiCall(endpoint: string, options: RequestInit = {}) {
    const url = `${API_URL}${endpoint}`;

    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
}

// Dashboard API
export const dashboardAPI = {
    getMetrics: () => apiCall('/api/dashboard'),
};

// Conversations API
export const conversationsAPI = {
    getAll: (page = 1, limit = 20) =>
        apiCall(`/api/conversations?page=${page}&limit=${limit}`),
    getById: (id: string) =>
        apiCall(`/api/conversations/${id}`),
    takeover: (id: string) =>
        apiCall(`/api/conversations/${id}/takeover`, { method: 'POST' }),
};

// Auth API
export const authAPI = {
    register: (data: any) =>
        apiCall('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    login: (data: any) =>
        apiCall('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
};
