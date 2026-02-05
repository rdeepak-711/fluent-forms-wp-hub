import apiClient from "./client";
import type { TokenResponse, LoginCredentials } from "../types";

export const login = async (credentials: LoginCredentials): Promise<TokenResponse> => {
    // Backend expects query params for this specific endpoint implementation
    // or application/x-www-form-urlencoded. 
    // Based on the plan and backend code `Depends()`, we pass as params.
    const params = new URLSearchParams();
    params.append('username', credentials.username);
    params.append('password', credentials.password);

    // Note: If backend expects JSON body, use the second argument. 
    // But `Depends(LoginRequest)` usually implies query params in FastAPI unless `Body()` is used.
    const response = await apiClient.post<TokenResponse>("/auth/login/access-token", null, {
        params: credentials
    });
    return response.data;
};