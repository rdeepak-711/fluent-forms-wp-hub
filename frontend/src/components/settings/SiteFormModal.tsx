import { useState, useEffect } from "react";
import { createSite, updateSite, testSiteConnection } from "../../api/site";
import { syncSite } from "../../api/sync";
import type { SiteAdmin, SiteCreate, SiteUpdate, Site } from "../../types";

interface SiteFormModalProps {
    isOpen: boolean;
    site: SiteAdmin | null; // null for create mode
    onClose: () => void;
    onSaved: () => void;
}

const SiteFormModal = ({ isOpen, site, onClose, onSaved }: SiteFormModalProps) => {
    const isEditMode = site !== null;

    const [name, setName] = useState("");
    const [url, setUrl] = useState("");
    const [username, setUsername] = useState("");
    const [applicationPassword, setApplicationPassword] = useState("");
    const [contactFormId, setContactFormId] = useState<string>("");

    const [isLoading, setIsLoading] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    useEffect(() => {
        if (site) {
            setName(site.name);
            setUrl(site.url);
            setUsername(site.username || "");
            setApplicationPassword(""); // Never pre-fill password
            setContactFormId(site.contact_form_id?.toString() || "");
        } else {
            setName("");
            setUrl("");
            setUsername("");
            setApplicationPassword("");
            setContactFormId("");
        }
        setError(null);
        setTestResult(null);
    }, [site, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!name.trim()) {
            setError("Site name is required");
            return;
        }
        if (!url.trim()) {
            setError("Site URL is required");
            return;
        }
        if (!isEditMode && !username.trim()) {
            setError("WordPress username is required");
            return;
        }
        if (!isEditMode && !applicationPassword.trim()) {
            setError("Application password is required");
            return;
        }

        setIsLoading(true);
        try {
            let newSite: Site | null = null;
            if (isEditMode && site) {
                const updateData: SiteUpdate = {
                    name: name.trim(),
                    url: url.trim(),
                };
                if (username.trim()) {
                    updateData.username = username.trim();
                }
                if (applicationPassword.trim()) {
                    updateData.application_password = applicationPassword.trim();
                }
                if (contactFormId.trim()) {
                    updateData.contact_form_id = parseInt(contactFormId, 10);
                }
                await updateSite(site.id, updateData);
            } else {
                const createData: SiteCreate = {
                    name: name.trim(),
                    url: url.trim(),
                    username: username.trim(),
                    application_password: applicationPassword.trim(),
                };
                if (contactFormId.trim()) {
                    createData.contact_form_id = parseInt(contactFormId, 10);
                }
                newSite = await createSite(createData);
            }

            // Run sync for newly created site
            if (newSite) {
                try {
                    await syncSite(newSite.id);
                } catch (syncErr) {
                    console.error("Initial sync failed:", syncErr);
                    // Don't fail the whole operation if sync fails
                }
            }

            // Notify sidebar to refresh
            window.dispatchEvent(new CustomEvent('sites-updated'));

            onSaved();
            onClose();
        } catch (err: any) {
            const message = err.response?.data?.detail || `Failed to ${isEditMode ? 'update' : 'create'} site`;
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTestConnection = async () => {
        if (!site) return;

        setIsTesting(true);
        setTestResult(null);
        try {
            const result = await testSiteConnection(site.id);
            setTestResult({
                success: result.status === 'success',
                message: result.message,
            });
        } catch (err: any) {
            setTestResult({
                success: false,
                message: err.response?.data?.detail || "Connection test failed",
            });
        } finally {
            setIsTesting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {isEditMode ? "Edit Site" : "Add New Site"}
                    </h2>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label htmlFor="siteName" className="block text-sm font-medium text-gray-700 mb-1">
                            Site Name *
                        </label>
                        <input
                            type="text"
                            id="siteName"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="My WordPress Site"
                        />
                    </div>

                    <div>
                        <label htmlFor="siteUrl" className="block text-sm font-medium text-gray-700 mb-1">
                            Site URL *
                        </label>
                        <input
                            type="url"
                            id="siteUrl"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="https://example.com"
                        />
                    </div>

                    <div>
                        <label htmlFor="wpUsername" className="block text-sm font-medium text-gray-700 mb-1">
                            WordPress Username {!isEditMode && "*"}
                        </label>
                        <input
                            type="text"
                            id="wpUsername"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={isEditMode ? "Leave empty to keep current" : "admin"}
                        />
                        {isEditMode && (
                            <p className="mt-1 text-xs text-gray-500">Leave empty to keep current username</p>
                        )}
                    </div>

                    <div>
                        <label htmlFor="appPassword" className="block text-sm font-medium text-gray-700 mb-1">
                            Application Password {!isEditMode && "*"}
                        </label>
                        <input
                            type="password"
                            id="appPassword"
                            value={applicationPassword}
                            onChange={(e) => setApplicationPassword(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={isEditMode ? "Leave empty to keep current" : "xxxx xxxx xxxx xxxx xxxx xxxx"}
                        />
                        {isEditMode && (
                            <p className="mt-1 text-xs text-gray-500">Leave empty to keep current password</p>
                        )}
                    </div>

                    <div>
                        <label htmlFor="contactFormId" className="block text-sm font-medium text-gray-700 mb-1">
                            Contact Form ID (optional)
                        </label>
                        <input
                            type="number"
                            id="contactFormId"
                            value={contactFormId}
                            onChange={(e) => setContactFormId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Leave empty for auto-detection"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Fluent Forms ID to sync. Leave empty to auto-detect by title.
                        </p>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    {testResult && (
                        <div className={`p-3 rounded-md border ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <p className={`text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                                {testResult.message}
                            </p>
                        </div>
                    )}

                    <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                        <div>
                            {isEditMode && (
                                <button
                                    type="button"
                                    onClick={handleTestConnection}
                                    disabled={isTesting}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
                                >
                                    {isTesting ? "Testing..." : "Test Connection"}
                                </button>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isLoading}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                                {isLoading ? "Saving..." : (isEditMode ? "Save Changes" : "Add Site")}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SiteFormModal;
