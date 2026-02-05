import { useState } from "react";
import { sendEmail } from "../api/email";
import type { Email, EmailCreate, ComposePopupProps } from "../types";

const ComposePopup = ({ isOpen, onClose, submissionId, toEmail, onEmailSent, isFirstEmail }: ComposePopupProps) => {
    const [body, setBody] = useState("");
    const [subject, setSubject] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSend = async () => {
        if (!body.trim()) return;
        if (!toEmail) {
            setError("No recipient email found.");
            return;
        }
        if (isFirstEmail && !subject.trim()) {
            setError("Subject is required for the first email.");
            return;
        }

        setIsSending(true);
        setError(null);

        try {
            const emailData: EmailCreate = {
                submission_id: submissionId,
                body: body,
                direction: 'outbound',
                subject: subject || undefined
            };

            const newEmail = await sendEmail(emailData);
            onEmailSent(newEmail);
            setBody("");
            setSubject("");
            onClose();
        } catch (err) {
            console.error("Failed to send email", err);
            setError("Failed to send email. Please try again.");
        } finally {
            setIsSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-0 right-6 w-[480px] bg-white shadow-xl border border-gray-200 rounded-t-lg flex flex-col z-50">
            {/* Header */}
            <div className="bg-gray-900 text-white px-4 py-2 rounded-t-lg flex justify-between items-center cursor-pointer" onClick={onClose}>
                <span className="font-medium">New Message</span>
                <div className="flex space-x-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        className="hover:bg-gray-700 rounded px-1.5 text-lg leading-none"
                    >
                        ×
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="p-4 flex-1 flex flex-col bg-white">
                <div className="mb-2 text-sm text-gray-500">
                    To: <span className="font-medium text-gray-900">{toEmail || "No email available"}</span>
                </div>

                <input
                    type="text"
                    placeholder={isFirstEmail ? "Subject (required)" : "Subject (auto-generated)"}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={!isFirstEmail}
                    className={`w-full mb-3 px-2 py-1 border-b focus:outline-none text-sm ${
                        isFirstEmail
                            ? 'border-gray-200 focus:border-blue-500'
                            : 'border-gray-100 bg-gray-50 text-gray-500 cursor-not-allowed'
                    }`}
                />

                <textarea
                    className="w-full flex-1 resize-none focus:outline-none p-2 text-gray-900 text-sm border border-gray-100 rounded mb-4"
                    placeholder="Write your reply..."
                    rows={8}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                />

                {error && (
                    <div className="mb-3 text-xs text-red-600 bg-red-50 p-2 rounded">
                        {error}
                    </div>
                )}

                <div className="flex justify-between items-center">
                    <button
                        onClick={handleSend}
                        disabled={isSending || !toEmail}
                        className={`px-4 py-2 rounded-md text-sm font-medium text-white transition-colors ${isSending || !toEmail
                            ? 'bg-blue-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                    >
                        {isSending ? 'Sending...' : 'Send Reply'}
                    </button>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 text-sm"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ComposePopup;
