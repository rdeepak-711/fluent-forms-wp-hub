import { useState, useEffect } from "react";
import { getCurrentUser } from "../api/user";
import type { User } from "../types";
import ProfileSettings from "../components/settings/ProfileSettings";
import SiteManagement from "../components/settings/SiteManagement";

type TabType = "profile" | "sites";

const SettingsPage = () => {
    const [activeTab, setActiveTab] = useState<TabType>("profile");
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const userData = await getCurrentUser();
                setUser(userData);
            } catch (err) {
                console.error("Failed to fetch user:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchUser();
    }, []);

    const isAdmin = user?.role === "admin";

    const tabs: { id: TabType; label: string; adminOnly?: boolean }[] = [
        { id: "profile", label: "Profile" },
        { id: "sites", label: "Sites", adminOnly: true },
    ];

    const visibleTabs = tabs.filter((tab) => !tab.adminOnly || isAdmin);

    if (isLoading) {
        return (
            <div className="p-6">
                <div className="flex items-center justify-center py-12">
                    <div className="text-gray-500">Loading...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 h-full flex flex-col max-w-6xl mx-auto w-full">
            <h1 className="text-2xl font-bold text-gray-900 mb-6 flex-shrink-0">Settings</h1>

            {/* Tab Navigation */}
            <div className="border-b border-gray-200 mb-6 flex-shrink-0">
                <nav className="-mb-px flex space-x-8">
                    {visibleTabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                                ? "border-blue-500 text-blue-600"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
                {activeTab === "profile" && (
                    <div className="overflow-auto h-full pr-2">
                        <ProfileSettings user={user} onUserUpdated={setUser} />
                    </div>
                )}
                {activeTab === "sites" && isAdmin && <SiteManagement />}
            </div>
        </div>
    );
};

export default SettingsPage;
