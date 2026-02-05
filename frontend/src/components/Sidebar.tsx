import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { getSites } from "../api/site";
import { getSubmissions } from "../api/submission";
import { syncSite, syncAllSites, syncGmailInbox } from "../api/sync";
import type { Site } from "../types";

const Sidebar = () => {
    const navigate = useNavigate();
    const [sites, setSites] = useState<Site[]>([]);
    const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncingSiteId, setSyncingSiteId] = useState<number | null>(null);
    const [isMailSyncing, setIsMailSyncing] = useState(false);

    const fetchData = async () => {
        try {
            const sitesData = await getSites();
            setSites(sitesData);

            // Fetch unread counts for each site
            // Note: Optimally this should be a single backend endpoint, but for now we fetch per site
            const counts: Record<number, number> = {};
            await Promise.all(sitesData.map(async (site) => {
                try {
                    // Fetch latest 100 submissions to calc unread count
                    // This is a temporary client-side calc until backend supports aggregation
                    const submissions = await getSubmissions(site.id);
                    const unread = submissions.filter(s => s.status === 'new').length;
                    counts[site.id] = unread;
                } catch (err) {
                    console.error(`Failed to fetch submissions for site ${site.id}`, err);
                    counts[site.id] = 0;
                }
            }));
            setUnreadCounts(counts);
        } catch (error) {
            console.error("Failed to fetch sites", error);
        }
    };

    useEffect(() => {
        fetchData();

        // Listen for sites-updated event from settings page
        const handleSitesUpdated = () => {
            fetchData();
        };
        window.addEventListener('sites-updated', handleSitesUpdated);
        window.addEventListener('submission-updated', handleSitesUpdated); // Re-use fetch logic

        return () => {
            window.removeEventListener('sites-updated', handleSitesUpdated);
            window.removeEventListener('submission-updated', handleSitesUpdated);
        };
    }, []);

    const handleSyncAll = async () => {
        setIsSyncing(true);
        try {
            await syncAllSites();
            await fetchData(); // Refresh data after sync
        } catch (error) {
            console.error("Sync all failed", error);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSyncSite = async (e: React.MouseEvent, siteId: number) => {
        e.preventDefault(); // Prevent navigation if clicked on/near link
        e.stopPropagation();
        setSyncingSiteId(siteId);
        try {
            await syncSite(siteId);
            await fetchData(); // Refresh data after sync
        } catch (error) {
            console.error(`Sync site ${siteId} failed`, error);
        } finally {
            setSyncingSiteId(null);
        }
    };

    const handleMailSync = async () => {
        setIsMailSyncing(true);
        try {
            const result = await syncGmailInbox();
            console.log(`Mail sync completed: ${result.new_emails} new emails`);
            await fetchData(); // Refresh data to show new emails
        } catch (error) {
            console.error("Mail sync failed", error);
        } finally {
            setIsMailSyncing(false);
        }
    };

    return (
        <div className="w-64 border-r border-gray-200 bg-white flex flex-col h-full">
            <div className="p-4 border-b border-gray-200">
                <h1 className="text-xl font-bold text-gray-800 cursor-pointer" onClick={() => navigate('/')}>
                    Fluent Forms Hub
                </h1>
            </div>

            <div className="p-4">
                <button
                    onClick={handleSyncAll}
                    disabled={isSyncing}
                    className={`w-full py-2 px-4 rounded-md text-white font-medium transition-colors ${isSyncing ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                >
                    {isSyncing ? 'Syncing...' : 'Sync All Sites'}
                </button>
            </div>

            {/* Fixed Navigation Section */}
            <div className="px-2 pt-2 pb-2">
                <nav className="space-y-1">
                    <NavLink
                        to="/inbox"
                        className={({ isActive }) =>
                            `flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`
                        }
                    >
                        All Inboxes
                    </NavLink>

                    <div className="pt-2 pb-1">
                        <div className="border-t border-gray-200"></div>
                    </div>

                    <div className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-2">
                        Sites
                    </div>
                </nav>
            </div>

            {/* Scrollable Sites Container */}
            <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
                <nav className="space-y-1">
                    {sites.map((site) => (
                        <NavLink
                            key={site.id}
                            to={`/site/${site.id}`}
                            className={({ isActive }) =>
                                `group flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'text-gray-700 hover:bg-gray-100'
                                }`
                            }
                        >
                            <span className="truncate" title={site.name}>{site.name}</span>

                            <div className="flex items-center space-x-2">
                                {/* Unread Badge */}
                                {unreadCounts[site.id] > 0 && (
                                    <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                                        {unreadCounts[site.id]}
                                    </span>
                                )}

                                {/* Sync Icon Button */}
                                <button
                                    onClick={(e) => handleSyncSite(e, site.id)}
                                    disabled={syncingSiteId === site.id}
                                    className={`p-1 rounded-full hover:bg-gray-200 focus:outline-none ${syncingSiteId === site.id ? 'animate-spin text-blue-600' : 'text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100'
                                        }`}
                                    title="Sync this site"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </button>
                            </div>
                        </NavLink>
                    ))}
                </nav>
            </div>

            {/* Bottom Section */}
            <div className="border-t border-gray-200 p-2 space-y-1">
                {/* Mail Sync Button */}
                <button
                    onClick={handleMailSync}
                    disabled={isMailSyncing}
                    className={`flex items-center w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isMailSyncing ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-2 ${isMailSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {isMailSyncing ? 'Syncing Mail...' : 'Sync Mail'}
                </button>

                <div className="border-t border-gray-200 my-1"></div>

                <NavLink
                    to="/trash"
                    className={({ isActive }) =>
                        `flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`
                    }
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Trash
                </NavLink>
                <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                        `flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`
                    }
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
                </NavLink>
            </div>
        </div>
    );
};

export default Sidebar;
