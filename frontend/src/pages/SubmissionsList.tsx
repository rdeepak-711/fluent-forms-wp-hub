import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { getSubmissions, updateSubmission } from "../api/submission";
import { getSites } from "../api/site";
import SubmissionTable from "../components/SubmissionTable";
import type { Site, Submission } from "../types";

const SubmissionsList = () => {
    const { siteId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [title, setTitle] = useState("All Inboxes");

    // Fetch sites first to display site names in table
    const fetchSites = async () => {
        try {
            const data = await getSites();
            setSites(data);
            return data;
        } catch (error) {
            console.error("Failed to fetch sites", error);
            return [];
        }
    };

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const sitesData = await fetchSites();

            let allSubmissions: Submission[] = [];

            // Determine if we are in "Trash" mode
            const isTrashMode = location.pathname.includes('/trash');
            if (isTrashMode) {
                setTitle("Trash");
            } else if (siteId) {
                // ... logic for setting title based on site ...
                // We'll set it below
            } else {
                setTitle("All Inboxes");
            }

            if (siteId) {
                // Single Site Mode
                const id = Number(siteId);
                const currentSite = sitesData.find(s => s.id === id);
                if (!isTrashMode) {
                    setTitle(currentSite ? currentSite.name : "Site Inbox");
                }

                allSubmissions = await getSubmissions(id, { is_active: !isTrashMode });
            } else {
                // All Sites Mode (Inbox or Trash)
                if (!isTrashMode) {
                    setTitle("All Inboxes");
                }

                // Parallel fetch for all sites (MVP approach)
                const promises = sitesData.map(site => getSubmissions(site.id, { is_active: !isTrashMode }));
                const results = await Promise.all(promises);
                // Flatten array
                allSubmissions = results.flat();
            }

            // Sort by submitted_at desc
            const sorted = allSubmissions.sort((a, b) =>
                new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
            );

            setSubmissions(sorted);
        } catch (error) {
            console.error("Failed to fetch submissions", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [siteId, location.pathname]); // Re-fetch when URL changes

    const handleRowClick = (submissionId: number) => {
        // Status update happens in SubmissionDetail when the submission is viewed
        navigate(`/submission/${submissionId}`);
    };

    const handleDelete = async (submissionId: number) => {
        if (!confirm("Are you sure you want to delete this submission?")) return;

        // Optimistic update
        setSubmissions(prev => prev.filter(s => s.id !== submissionId));

        try {
            await updateSubmission(submissionId, { is_active: false });
        } catch (error) {
            console.error("Failed to delete submission", error);
            // Revert on error (could reload or add back, but for now just logging)
            // Ideally we'd rollback state, but simplest is to alert user or refetch
            alert("Failed to delete submission. Please refresh.");
        }
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <header className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {submissions.length} submission{submissions.length !== 1 && 's'}
                    </p>
                </div>
                {/* Future: Add Filter Toggle here */}
            </header>

            <div className="flex-1 overflow-auto">
                <SubmissionTable
                    submissions={submissions}
                    sites={sites}
                    isLoading={isLoading}
                    onRowClick={handleRowClick}
                    onDelete={handleDelete}
                />
            </div>
        </div>
    );
};

export default SubmissionsList;
