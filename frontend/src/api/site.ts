import apiClient from "./client";
import type { Site, SiteAdmin, SiteCreate, SiteUpdate, SyncResult } from "../types";

export const getSites = async (): Promise<Site[]> => {
    const response = await apiClient.get<Site[]>("/sites/");
    return response.data;
};

export const getAllSites = async (): Promise<SiteAdmin[]> => {
    const response = await apiClient.get<SiteAdmin[]>("/sites/all");
    return response.data;
};

export const getSite = async (id: number): Promise<Site> => {
    const response = await apiClient.get<Site>(`/sites/${id}`);
    return response.data;
};

export const createSite = async (data: SiteCreate): Promise<Site> => {
    const response = await apiClient.post<Site>("/sites/", data);
    return response.data;
};

export const updateSite = async (id: number, data: SiteUpdate): Promise<Site> => {
    const response = await apiClient.put<Site>(`/sites/${id}`, data);
    return response.data;
};

export const deleteSite = async (id: number): Promise<Site> => {
    const response = await apiClient.delete<Site>(`/sites/${id}`);
    return response.data;
};

export const restoreSite = async (id: number): Promise<Site> => {
    const response = await apiClient.post<Site>(`/sites/${id}/restore`);
    return response.data;
};

export const testSiteConnection = async (id: number): Promise<SyncResult> => {
    const response = await apiClient.post<SyncResult>(`/sites/${id}/test-connection`);
    return response.data;
};