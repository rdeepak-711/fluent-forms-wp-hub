import { useState } from "react";
import DOMPurify from "dompurify";
import type { Email } from "../types";

// Strip the "Your original message:" section from email HTML for display
// (The original message is already shown separately in the conversation view)
const stripOriginalMessageQuote = (html: string): string => {
    if (!html) return '';
    // Remove the "Your original message:" paragraph and the .original-message div
    return html
        .replace(/<p><strong>Your original message:<\/strong><\/p>/gi, '')
        .replace(/<div class="original-message">[\s\S]*?<\/div>/gi, '');
};

interface EmailThreadProps {
    emails: Email[];
}

const EmailItem = ({ email }: { email: Email }) => {
    // Default collapsed if failed, expanded otherwise
    const [isExpanded, setIsExpanded] = useState(email.status !== 'failed');

    // Toggle only relevant for failed emails (or if we wanted to collapse others too)
    const toggle = () => {
        if (email.status === 'failed') {
            setIsExpanded(!isExpanded);
        }
    };

    const isOutbound = email.direction === 'outbound';
    const isFailed = email.status === 'failed';

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Failed Collapsed View
    if (isFailed && !isExpanded) {
        return (
            <div className="flex justify-end">
                <div
                    onClick={toggle}
                    className="cursor-pointer px-3 py-1.5 rounded-full bg-red-50 border border-red-200 flex items-center space-x-2 transition-colors hover:bg-red-100"
                >
                    <div className="w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] font-bold">
                        !
                    </div>
                    <span className="text-xs font-semibold text-red-700">
                        Message Failed
                    </span>
                    <span className="text-[10px] text-red-400">
                        (#{email.id}) - Click to view
                    </span>
                </div>
            </div>
        );
    }

    // Expanded / Normal View
    return (
        <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-[80%] rounded-lg p-4 shadow-sm border transition-all ${isOutbound
                    ? 'bg-blue-50 border-blue-100'
                    : 'bg-white border-gray-200'
                    } ${isFailed ? 'border-red-300 ring-2 ring-red-100' : ''}`}
            >
                <div className="flex justify-between items-start mb-2 gap-4">
                    {/* Outbound: Show Label. Inbound: Hide Label (User Request) */}
                    {isOutbound ? (
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                            Staff Reply
                        </span>
                    ) : (
                        <span />
                    )}

                    <span className="text-xs text-gray-400 whitespace-nowrap">
                        {formatDate(email.created_at)}
                    </span>
                </div>

                {email.subject && (
                    <div className="text-xs font-medium text-gray-900 mb-1">
                        Subject: {email.subject}
                    </div>
                )}

                <div
                    className="text-sm text-gray-800 font-sans prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(stripOriginalMessageQuote(email.body || ''))
                    }}
                />

                <div className="mt-2 flex justify-end items-center space-x-2">
                    {isFailed && (
                        <span
                            onClick={toggle}
                            className="cursor-pointer text-[10px] text-gray-400 underline hover:text-gray-600"
                        >
                            Collapse
                        </span>
                    )}
                    {/* Only show status for Outbound or Failed */}
                    {(isOutbound || isFailed) && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${email.status === 'sent' ? 'bg-green-100 text-green-700' :
                                email.status === 'failed' ? 'bg-red-100 text-red-700 font-bold' :
                                    'bg-gray-100 text-gray-600'
                            }`}>
                            {email.status || 'sent'}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

const EmailThread = ({ emails }: EmailThreadProps) => {
    if (emails.length === 0) {
        return (
            <div className="py-8 text-center text-gray-500">
                <p className="text-sm">No email history yet.</p>
            </div>
        );
    }

    // Sort emails by created_at asc (oldest at top)
    const sortedEmails = [...emails].sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return (
        <div className="space-y-6">
            {sortedEmails.map((email) => (
                <EmailItem key={email.id} email={email} />
            ))}
        </div>
    );
};

export default EmailThread;
