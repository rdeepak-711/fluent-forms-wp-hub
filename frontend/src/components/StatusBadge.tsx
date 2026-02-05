import type { SubmissionStatus } from "../types";

interface StatusConfig {
    label: string;
    color: string;
}

const statusConfig: Record<SubmissionStatus, StatusConfig> = {
    new: { label: 'New', color: 'bg-blue-100 text-blue-800' },
    waiting_internal: { label: 'Waiting on Internal', color: 'bg-yellow-100 text-yellow-800' },
    waiting_customer: { label: 'Waiting on Customer', color: 'bg-purple-100 text-purple-800' },
    in_progress: { label: 'In Progress', color: 'bg-orange-100 text-orange-800' },
    closed: { label: 'Closed', color: 'bg-gray-100 text-gray-600' },
};

interface StatusBadgeProps {
    status: string;
    size?: 'sm' | 'md';
}

const StatusBadge = ({ status, size = 'sm' }: StatusBadgeProps) => {
    const config = statusConfig[status as SubmissionStatus] || {
        label: status,
        color: 'bg-gray-100 text-gray-600'
    };

    const sizeClasses = size === 'sm'
        ? 'px-2 py-0.5 text-xs'
        : 'px-3 py-1 text-sm';

    return (
        <span className={`inline-flex items-center rounded-full font-medium ${config.color} ${sizeClasses}`}>
            {config.label}
        </span>
    );
};

export default StatusBadge;
export { statusConfig };
