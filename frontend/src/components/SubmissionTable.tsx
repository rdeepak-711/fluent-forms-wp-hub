import type { SubmissionTableProps } from "../types";
import StatusBadge from "./StatusBadge";

const SubmissionTable = ({ submissions, sites, isLoading, onRowClick, onDelete }: SubmissionTableProps) => {
    // Helper to get site name
    const getSiteName = (siteId: number) => {
        const site = sites.find(s => s.id === siteId);
        return site ? site.name : `Site #${siteId}`;
    };

    // Helper for relative date (simple version)
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
        return date.toLocaleDateString();
    };

    const handleDeleteClick = (e: React.MouseEvent, submissionId: number) => {
        e.stopPropagation();
        if (onDelete) {
            onDelete(submissionId);
        }
    };

    if (isLoading) {
        return (
            <div className="p-8 text-center text-gray-500 animate-pulse">
                Loading submissions...
            </div>
        );
    }

    if (submissions.length === 0) {
        return (
            <div className="p-12 text-center border-2 border-dashed border-gray-200 rounded-lg">
                <p className="text-gray-500 font-medium">No submissions found.</p>
            </div>
        );
    }

    return (
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full table-fixed">
                <tbody className="divide-y divide-gray-100">
                    {submissions.map((submission) => {
                        const isUnread = submission.status === 'new';
                        return (
                            <tr
                                key={submission.id}
                                onClick={() => onRowClick(submission.id)}
                                className={`cursor-pointer hover:shadow-md transition-all duration-200 group ${isUnread ? 'bg-white' : 'bg-gray-50/50'
                                    }`}
                            >
                                {/* Status / Indicator Column */}
                                <td className="w-12 pl-4 py-3 align-middle text-center">
                                    <div className="flex items-center justify-center">
                                        {isUnread ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 group-hover:text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M2.94 6.412A2 2 0 002 8.108V16a2 2 0 002 2h12a2 2 0 002-2V8.108a2 2 0 00-.94-1.696l-6-3.75a2 2 0 00-2.12 0l-6 3.75zm2.615 2.423a1 1 0 10-1.11 1.664l5.5 3.666a1 1 0 001.11 0l5.5-3.666a1 1 0 10-1.11-1.664L10 10.707l-4.445-2.87z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </div>
                                </td>

                                {/* Submitter Name (Fixed Width) */}
                                <td className={`w-48 px-2 py-3 align-middle truncate ${isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-900'
                                    }`}>
                                    {submission.submitter_name || submission.submitter_email || 'Unknown'}
                                </td>

                                {/* Subject (Truncated to 3 words) */}
                                <td className="px-2 py-3 align-middle">
                                    <div className="flex items-center">
                                        <span className={`truncate ${isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'
                                            }`}>
                                            {(() => {
                                                const subject = submission.subject || '(No Subject)';
                                                const words = subject.split(/\s+/);
                                                return words.length > 3 ? words.slice(0, 3).join(' ') + ' ...' : subject;
                                            })()}
                                        </span>
                                    </div>
                                </td>

                                {/* Status Badge */}
                                <td className="w-36 px-2 py-3 align-middle hidden md:table-cell">
                                    <StatusBadge status={submission.status} />
                                </td>

                                {/* Site Name */}
                                <td className="w-32 px-2 py-3 align-middle text-right text-xs text-gray-500 truncate hidden sm:table-cell">
                                    {getSiteName(submission.site_id)}
                                </td>

                                {/* Date */}
                                <td className={`w-24 pr-2 py-3 align-middle text-right text-xs whitespace-nowrap ${isUnread ? 'font-bold text-gray-900' : 'font-normal text-gray-500'
                                    }`}>
                                    {formatDate(submission.submitted_at)}
                                </td>

                                {/* Actions (Delete) */}
                                <td className="w-10 pr-4 py-3 align-middle text-right">
                                    <button
                                        onClick={(e) => handleDeleteClick(e, submission.id)}
                                        className="text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors"
                                        title="Delete"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default SubmissionTable;
