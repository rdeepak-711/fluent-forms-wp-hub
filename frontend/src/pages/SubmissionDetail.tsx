import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSubmission, updateSubmission } from "../api/submission";
import { getEmails } from "../api/email";
import type { Submission, Email, SubmissionStatus } from "../types";
import EmailThread from "../components/EmailThread";
import ComposePopup from "../components/ComposePopup";
import { statusConfig } from "../components/StatusBadge";

const SubmissionDetail = () => {
    const { submissionId } = useParams();
    const navigate = useNavigate();

    const [submission, setSubmission] = useState<Submission | null>(null);
    const [emails, setEmails] = useState<Email[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isReplyOpen, setIsReplyOpen] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            if (!submissionId) return;
            const id = Number(submissionId);
            setIsLoading(true);

            try {
                // Parallel fetch
                const [subData, emailsData] = await Promise.all([
                    getSubmission(id),
                    getEmails(id)
                ]);

                setSubmission(subData);
                setEmails(emailsData);

                // Mark as read by changing status from 'new' to 'waiting_internal'
                if (subData.status === 'new') {
                    // We don't await this because UI is priority
                    updateSubmission(id, { status: 'waiting_internal' })
                        .then((updated) => {
                            setSubmission(updated);
                            window.dispatchEvent(new Event('submission-updated'));
                        })
                        .catch(err =>
                            console.error("Failed to update status", err)
                        );
                }

            } catch (error) {
                console.error("Failed to load details", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [submissionId]);

    const handleEmailSent = async (newEmail: Email) => {
        setEmails((prev) => [...prev, newEmail]);
        // Refresh submission data to get updated gmail_thread_id after first email
        if (submissionId) {
            try {
                const updatedSubmission = await getSubmission(Number(submissionId));
                setSubmission(updatedSubmission);
            } catch (err) {
                console.error("Failed to refresh submission", err);
            }
        }
    };

    const handleStatusChange = async (newStatus: SubmissionStatus) => {
        if (!submission || !submissionId) return;
        try {
            const updated = await updateSubmission(Number(submissionId), { status: newStatus });
            setSubmission(updated);
            window.dispatchEvent(new Event('submission-updated'));
        } catch (err) {
            console.error("Failed to update status", err);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-full">
                <div className="text-gray-500 animate-pulse">Loading conversation...</div>
            </div>
        );
    }

    if (!submission) {
        return (
            <div className="p-8 text-center">
                <p className="text-red-500 font-medium">Submission not found</p>
                <button onClick={() => navigate(-1)} className="mt-4 text-blue-600 hover:underline">
                    Go Back
                </button>
            </div>
        );
    }

    // Parse form data safely
    let formData: Record<string, any> = {};
    try {
        formData = typeof submission.data === 'string' ? JSON.parse(submission.data) : submission.data;
    } catch {
        formData = { error: "Could not parse form data" };
    }

    return (
        <div className="flex h-full bg-gray-50">
            {/* LEFT COLUMN: Context & Form Data (30-35%) */}
            <div className="w-80 lg:w-96 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm z-10">
                {/* Header */}
                <div className="p-4 border-b border-gray-100">
                    <button
                        onClick={() => navigate(-1)}
                        className="text-gray-500 hover:text-gray-800 text-sm flex items-center mb-4 transition-colors"
                    >
                        <span className="mr-1">←</span> Back
                    </button>

                    <h2 className="text-lg font-bold text-gray-900 leading-tight mb-2">
                        {submission.subject || "(No Subject)"}
                    </h2>
                </div>

                {/* Meta Data List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    <div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                            Submitter Info
                        </h3>
                        <div className="space-y-2">
                            <div className="flex flex-col">
                                <span className="text-xs text-gray-500">Name</span>
                                <span className="text-sm font-medium text-gray-900">{submission.submitter_name || "N/A"}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs text-gray-500">Email</span>
                                <span className="text-sm font-medium text-blue-600 truncate">
                                    {submission.submitter_email}
                                </span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs text-gray-500">Date</span>
                                <span className="text-sm text-gray-700">
                                    {new Date(submission.submitted_at).toLocaleString()}
                                </span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs text-gray-500">Status</span>
                                <select
                                    value={submission.status}
                                    onChange={(e) => handleStatusChange(e.target.value as SubmissionStatus)}
                                    className="mt-1 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    {Object.entries(statusConfig).map(([key, { label }]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                            Form Data
                        </h3>
                        <div className="bg-gray-50 rounded border border-gray-100 text-sm">
                            {Object.entries(formData).map(([key, value]) => (
                                <div key={key} className="p-2 border-b last:border-0 border-gray-100">
                                    <dt className="text-xs font-semibold text-gray-600 mb-0.5 capitalize">
                                        {key === 'names' ? 'Name' : key.replace(/_/g, ' ')}
                                    </dt>
                                    <dd className="text-gray-800 break-words">
                                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                    </dd>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN: Conversation / Thread */}
            <div className="flex-1 flex flex-col h-full bg-slate-50 relative">
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* 1. Original Submission 'Card' (Context) */}
                    <div className="flex justify-start">
                        <div className="max-w-[85%] bg-gray-100 border-l-4 border-gray-400 rounded-r-lg p-5 shadow-sm">
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                Original Message
                            </div>

                            {submission.subject && (
                                <div className="text-sm font-bold text-gray-700 mb-2">
                                    {submission.subject}
                                </div>
                            )}

                            <div className="text-sm text-gray-600 whitespace-pre-wrap">
                                {submission.message || "(No message body)"}
                            </div>

                            <div className="mt-3 flex justify-between items-center text-[10px] text-gray-400">
                                <span>From: {submission.submitter_name || submission.submitter_email}</span>
                                <span>{new Date(submission.submitted_at).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* 2. Email Thread */}
                    <EmailThread emails={emails} />

                    {/* Spacer for bottom bar */}
                    <div className="h-20"></div>
                </div>

                {/* Bottom Action Bar */}
                <div className="absolute bottom-6 right-6 lg:right-10 z-20">
                    <button
                        onClick={() => setIsReplyOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 py-3 shadow-lg flex items-center space-x-2 transition-transform transform hover:scale-105"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        <span className="font-medium">Reply</span>
                    </button>
                </div>
            </div>

            {/* Popup Composer */}
            <ComposePopup
                isOpen={isReplyOpen}
                onClose={() => setIsReplyOpen(false)}
                submissionId={submission.id}
                toEmail={submission.submitter_email}
                onEmailSent={handleEmailSent}
                isFirstEmail={!submission.gmail_thread_id}
            />
        </div>
    );
};

export default SubmissionDetail;
