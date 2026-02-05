import { useState, useEffect } from "react";
import { getAllSites, deleteSite, restoreSite } from "../../api/site";
import { syncSite } from "../../api/sync";
import type { SiteAdmin } from "../../types";
import SiteFormModal from "./SiteFormModal";
import ConfirmModal from "../common/ConfirmModal";

const SiteManagement = () => {
    const [sites, setSites] = useState<SiteAdmin[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [syncingSiteId, setSyncingSiteId] = useState<number | null>(null);

    // Modal states
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingSite, setEditingSite] = useState<SiteAdmin | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<SiteAdmin | null>(null);
    const [restoreConfirm, setRestoreConfirm] = useState<SiteAdmin | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);

    const fetchSites = async () => {
        try {
            setError(null);
            const data = await getAllSites();
            setSites(data);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to fetch sites");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSites();

        const handleSitesUpdated = () => fetchSites();
        window.addEventListener('sites-updated', handleSitesUpdated);
        return () => window.removeEventListener('sites-updated', handleSitesUpdated);
    }, []);

    const handleAddSite = () => {
        setEditingSite(null);
        setIsFormModalOpen(true);
    };

    const handleEditSite = (site: SiteAdmin) => {
        setEditingSite(site);
        setIsFormModalOpen(true);
    };

    const handleDeleteSite = async () => {
        if (!deleteConfirm) return;

        setIsDeleting(true);
        try {
            await deleteSite(deleteConfirm.id);
            await fetchSites();
            setDeleteConfirm(null);
            // Notify sidebar to refresh
            window.dispatchEvent(new CustomEvent('sites-updated'));
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to delete site");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleRestoreSite = async () => {
        if (!restoreConfirm) return;

        setIsRestoring(true);
        try {
            await restoreSite(restoreConfirm.id);
            await fetchSites();
            setRestoreConfirm(null);
            // Notify sidebar to refresh
            window.dispatchEvent(new CustomEvent('sites-updated'));
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to restore site");
        } finally {
            setIsRestoring(false);
        }
    };

    const handleSyncSite = async (siteId: number) => {
        setSyncingSiteId(siteId);
        try {
            await syncSite(siteId);
            await fetchSites(); // Refresh to update last_synced_at
            window.dispatchEvent(new CustomEvent('sites-updated'));
        } catch (err) {
            setError("Sync failed");
        } finally {
            setSyncingSiteId(null);
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "Never";
        return new Date(dateStr).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-gray-500">Loading sites...</div>
            </div>
        );
    }

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex justify-between items-center flex-shrink-0">
                <h3 className="text-lg font-semibold text-gray-900">WordPress Sites</h3>
                <button
                    onClick={handleAddSite}
                    className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    Add Site
                </button>
            </div>

            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            )}

            {sites.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">No sites configured yet.</p>
                    <button
                        onClick={handleAddSite}
                        className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                    >
                        Add your first site
                    </button>
                </div>
            ) : (
                <div className="bg-white border border-gray-200 rounded-lg flex-1 min-h-0 overflow-hidden flex flex-col">
                    <div className="overflow-auto flex-1">
                        <table className="min-w-full divide-y divide-gray-200 relative">
                            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                                        Site
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                                        Last Synced
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {sites.map((site) => (
                                    <tr
                                        key={site.id}
                                        className={site.is_active ? "" : "bg-gray-50 opacity-60"}
                                    >
                                        <td className="px-6 py-4">
                                            <div className={site.is_active ? "" : "line-through"}>
                                                <div className="text-sm font-medium text-gray-900">
                                                    {site.name}
                                                </div>
                                                <div className="text-sm text-gray-500">{site.url}</div>
                                                <div className="text-xs text-gray-400">
                                                    User: {site.username}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${site.is_active
                                                    ? "bg-green-100 text-green-800"
                                                    : "bg-red-100 text-red-800"
                                                    }`}
                                            >
                                                {site.is_active ? "Active" : "Deleted"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {formatDate(site.last_synced_at)}
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm font-medium space-x-2">
                                            {site.is_active ? (
                                                <>
                                                    <button
                                                        onClick={() => handleSyncSite(site.id)}
                                                        disabled={syncingSiteId === site.id}
                                                        className={`p-1 rounded-md hover:bg-gray-100 ${syncingSiteId === site.id ? 'text-blue-600 cursor-not-allowed' : 'text-gray-600 hover:text-blue-600'}`}
                                                        title="Sync site"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${syncingSiteId === site.id ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() => handleEditSite(site)}
                                                        className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded cursor-pointer transition-colors"
                                                        title="Edit Site"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteConfirm(site)}
                                                        className="p-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded cursor-pointer transition-colors"
                                                        title="Delete Site"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => setRestoreConfirm(site)}
                                                    className="text-green-600 hover:text-green-900"
                                                >
                                                    Restore
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Site Form Modal */}
            <SiteFormModal
                isOpen={isFormModalOpen}
                site={editingSite}
                onClose={() => setIsFormModalOpen(false)}
                onSaved={fetchSites}
            />

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={deleteConfirm !== null}
                title="Delete Site"
                message={`Are you sure you want to delete "${deleteConfirm?.name}"? The site will be soft-deleted and can be restored later.`}
                confirmLabel="Delete"
                confirmVariant="danger"
                onConfirm={handleDeleteSite}
                onCancel={() => setDeleteConfirm(null)}
                isLoading={isDeleting}
            />

            {/* Restore Confirmation */}
            <ConfirmModal
                isOpen={restoreConfirm !== null}
                title="Restore Site"
                message={`Are you sure you want to restore "${restoreConfirm?.name}"?`}
                confirmLabel="Restore"
                confirmVariant="primary"
                onConfirm={handleRestoreSite}
                onCancel={() => setRestoreConfirm(null)}
                isLoading={isRestoring}
            />
        </div>
    );
};

export default SiteManagement;
