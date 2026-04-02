<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\FeedbackNotificationModel;
use App\Models\FeedbackNotificationReadModel;

class FeedbackNotificationRepository
{
    public function __construct(
        private readonly FeedbackNotificationModel $notifications = new FeedbackNotificationModel(),
        private readonly FeedbackNotificationReadModel $reads = new FeedbackNotificationReadModel()
    ) {
    }

    public function create(array $data): int
    {
        $this->notifications->insert($data);

        return (int) $this->notifications->getInsertID();
    }

    public function recentForUser(int $userId, int $limit = 8): array
    {
        return $this->notifications
            ->select('feedback_notifications.*')
            ->select('feedback_notification_reads.id AS read_id, feedback_notification_reads.seen_at AS seen_at')
            ->join(
                'feedback_notification_reads',
                'feedback_notification_reads.notification_id = feedback_notifications.id AND feedback_notification_reads.user_id = ' . $userId,
                'left',
                false
            )
            ->whereIn('feedback_notifications.status', ['fixed', 'added'])
            ->orderBy('feedback_notifications.created_at', 'DESC')
            ->findAll($limit);
    }

    public function unreadCountForUser(int $userId): int
    {
        return (int) $this->notifications
            ->join(
                'feedback_notification_reads',
                'feedback_notification_reads.notification_id = feedback_notifications.id AND feedback_notification_reads.user_id = ' . $userId,
                'left',
                false
            )
            ->whereIn('feedback_notifications.status', ['fixed', 'added'])
            ->where('feedback_notification_reads.id', null)
            ->countAllResults();
    }

    public function markAllAsRead(int $userId): void
    {
        $rows = $this->notifications
            ->select('feedback_notifications.id')
            ->join(
                'feedback_notification_reads',
                'feedback_notification_reads.notification_id = feedback_notifications.id AND feedback_notification_reads.user_id = ' . $userId,
                'left',
                false
            )
            ->whereIn('feedback_notifications.status', ['fixed', 'added'])
            ->where('feedback_notification_reads.id', null)
            ->findAll();

        $now = date('Y-m-d H:i:s');
        foreach ($rows as $row) {
            $this->reads->insert([
                'notification_id' => (int) $row['id'],
                'user_id' => $userId,
                'seen_at' => $now,
            ]);
        }
    }
}
