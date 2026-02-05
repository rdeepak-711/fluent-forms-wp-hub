import apiClient from "./client"
import type { Email, EmailCreate } from "../types";

export const getEmails = async (submissionId: number): Promise<Email[]> => {
    const response = await apiClient.get<Email[]>("/emails/", {
        params: { submission_id: submissionId }
    });
    return response.data;
}

export const sendEmail = async (data: EmailCreate): Promise<Email> => {
    const response = await apiClient.post<Email>("/emails/", data);
    return response.data;
}