import apiClient from "./client"
import type { Submission, SubmissionUpdate } from "../types";

export const getSubmissions = async (siteId?: number, filters?: { is_active?: boolean }): Promise<Submission[]> => {
    const params: any = {};
    if (siteId) params.site_id = siteId;
    if (filters?.is_active !== undefined) params.is_active = filters.is_active;

    const response = await apiClient.get<Submission[]>("/submissions/", { params });
    return response.data;
}

export const getSubmission = async (id: number): Promise<Submission> => {
    const response = await apiClient.get<Submission>(`/submissions/${id}`);
    return response.data;
}

export const updateSubmission = async (id: number, data: SubmissionUpdate): Promise<Submission> => {
    const response = await apiClient.put<Submission>(`/submissions/${id}`, data);
    return response.data;
}
