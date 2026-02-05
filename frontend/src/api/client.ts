import axios from "axios";

// Use /api/v1 as default if env var is not set, matching the proxy config checks
const baseURL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

const apiClient = axios.create({
    baseURL,
});

apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

apiClient.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        // Auth redirect disabled for now - re-enable when login is implemented
        return Promise.reject(error);
    }
)

export default apiClient;