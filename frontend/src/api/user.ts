import apiClient from "./client";
import type { User, EmailUpdateRequest, PasswordChangeRequest, MessageResponse } from "../types";

export const getCurrentUser = async (): Promise<User> => {
    const response = await apiClient.get<User>("/auth/me");
    return response.data;
};

export const updateEmail = async (data: EmailUpdateRequest): Promise<User> => {
    const response = await apiClient.put<User>("/auth/me/email", data);
    return response.data;
};

export const changePassword = async (data: PasswordChangeRequest): Promise<MessageResponse> => {
    const response = await apiClient.put<MessageResponse>("/auth/me/password", data);
    return response.data;
};
