<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\FeedbackRepository;
use App\Repositories\FeedbackNotificationRepository;
use App\Repositories\UserRepository;
use CodeIgniter\HTTP\Files\UploadedFile;

class FeedbackService
{
    public function __construct(
        private readonly FeedbackRepository $feedback = new FeedbackRepository(),
        private readonly FeedbackNotificationRepository $notifications = new FeedbackNotificationRepository(),
        private readonly UserRepository $users = new UserRepository(),
        private readonly AuditService $audit = new AuditService()
    ) {
    }

    public function pageData(int $userId, bool $canViewAll, bool $canManageAll): array
    {
        return [
            'myEntries' => $this->feedback->mine($userId),
            'allEntries' => $canViewAll ? $this->feedback->all() : [],
            'canViewAll' => $canViewAll,
            'canManageAll' => $canManageAll,
        ];
    }

    public function create(array $input, int $userId, ?UploadedFile $attachment = null): int
    {
        $rules = [
            'type' => 'required|in_list[bug,feature]',
            'title' => 'required|min_length[3]|max_length[180]',
            'description' => 'required|min_length[10]|max_length[5000]',
        ];

        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException(implode(' ', service('validation')->getErrors()));
        }

        $user = $this->users->findById($userId);
        if ($user === null) {
            throw new \InvalidArgumentException('Bruker finnes ikke.');
        }

        $name = trim((string) (($user->first_name ?? '') . ' ' . ($user->last_name ?? '')));
        if ($name === '') {
            $name = (string) ($user->name ?? 'Ukjent bruker');
        }

        $attachmentData = $this->storeAttachment((string) $input['type'], $attachment);
        $now = date('Y-m-d H:i:s');
        $id = $this->feedback->create([
            'requester_user_id' => $userId,
            'wannabe_id' => $user->wannabe_id !== null ? (int) $user->wannabe_id : null,
            'requester_name' => mb_substr($name, 0, 180),
            'type' => (string) $input['type'],
            'title' => mb_substr(strip_tags(trim((string) $input['title'])), 0, 180),
            'description' => mb_substr(trim((string) $input['description']), 0, 5000),
            'needs_database_fix' => ! empty($input['needs_database_fix']) ? 1 : 0,
            'attachment_path' => $attachmentData['attachment_path'],
            'attachment_original_name' => $attachmentData['attachment_original_name'],
            'attachment_mime' => $attachmentData['attachment_mime'],
            'status' => 'pending',
            'developer_note' => null,
            'resolved_at' => null,
            'added_at' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $this->audit->log($userId, 'create', 'feedback_entry', $id, [
            'type' => (string) $input['type'],
            'title' => (string) $input['title'],
            'needs_database_fix' => ! empty($input['needs_database_fix']) ? 1 : 0,
        ]);

        return $id;
    }

    public function attachmentForUser(int $entryId, int $userId, bool $canViewAll): ?array
    {
        $entry = $this->feedback->findById($entryId);
        if ($entry === null) {
            return null;
        }

        if ((int) ($entry['requester_user_id'] ?? 0) !== $userId && ! $canViewAll) {
            throw new \InvalidArgumentException('Du har ikke tilgang til dette vedlegget.');
        }

        $relativePath = trim((string) ($entry['attachment_path'] ?? ''));
        if ($relativePath === '') {
            return null;
        }

        $path = WRITEPATH . $relativePath;
        if (! is_file($path)) {
            return null;
        }

        return [
            'path' => $path,
            'mime' => (string) ($entry['attachment_mime'] ?? mime_content_type($path) ?: 'application/octet-stream'),
            'name' => (string) ($entry['attachment_original_name'] ?? basename($path)),
        ];
    }

    public function updateStatus(int $entryId, array $input, int $actorUserId): void
    {
        $entry = $this->feedback->findById($entryId);
        if ($entry === null) {
            throw new \InvalidArgumentException('Tilbakemelding finnes ikke.');
        }

        $status = trim((string) ($input['status'] ?? ''));
        $type = (string) ($entry['type'] ?? 'feature');
        $allowed = $type === 'bug'
            ? ['in_progress', 'fixed', 'rejected']
            : ['on_hold', 'in_progress', 'approved', 'added', 'rejected'];
        if (! in_array($status, $allowed, true)) {
            throw new \InvalidArgumentException('Ugyldig status.');
        }

        $now = date('Y-m-d H:i:s');
        $data = [
            'status' => $status,
            'developer_note' => null,
            'updated_at' => $now,
            'resolved_at' => in_array($status, ['fixed', 'added', 'rejected'], true) ? $now : null,
            'added_at' => $status === 'added' ? $now : null,
        ];

        $this->feedback->updateById($entryId, $data);
        if (in_array($status, ['fixed', 'added'], true)) {
            $this->notifications->create([
                'feedback_entry_id' => $entryId,
                'status' => $status,
                'title' => (string) ($entry['title'] ?? 'Oppdatering'),
                'message' => (string) ($entry['description'] ?? ''),
                'created_at' => $now,
            ]);
        }
        $this->audit->log($actorUserId, 'status', 'feedback_entry', $entryId, [
            'status' => $status,
        ]);
    }

    public function notificationPayload(int $userId): array
    {
        $items = array_map(function (array $item): array {
            return [
                'id' => (int) $item['id'],
                'status' => (string) $item['status'],
                'status_label' => $this->statusLabel((string) $item['status']),
                'title' => (string) $item['title'],
                'message' => (string) ($item['message'] ?? ''),
                'created_at' => (string) $item['created_at'],
                'created_at_label' => format_norwegian_datetime($item['created_at'] ?? null),
                'is_read' => ! empty($item['read_id']),
            ];
        }, $this->notifications->recentForUser($userId, 3));

        return [
            'items' => $items,
            'unreadCount' => $this->notifications->unreadCountForUser($userId),
        ];
    }

    public function markNotificationsAsRead(int $userId): void
    {
        $this->notifications->markAllAsRead($userId);
    }

    public function deleteOwn(int $entryId, int $actorUserId): void
    {
        $entry = $this->feedback->findById($entryId);
        if ($entry === null) {
            throw new \InvalidArgumentException('Tilbakemelding finnes ikke.');
        }

        if ((int) ($entry['requester_user_id'] ?? 0) !== $actorUserId) {
            throw new \InvalidArgumentException('Du kan bare slette egne tilbakemeldinger.');
        }

        if ((string) ($entry['status'] ?? 'pending') !== 'pending') {
            throw new \InvalidArgumentException('Bare ventende tilbakemeldinger kan slettes.');
        }

        $this->feedback->deleteById($entryId);
        $this->audit->log($actorUserId, 'delete', 'feedback_entry', $entryId);
    }

    public function statusLabel(string $status): string
    {
        return match ($status) {
            'pending' => 'Innmeldt',
            'in_progress' => 'Påbegynt',
            'approved' => 'Godkjent',
            'on_hold' => 'Lagt på vent',
            'fixed' => 'Bug fikset',
            'added' => 'Implementert',
            'rejected' => 'Avslått',
            default => $status,
        };
    }

    private function storeAttachment(string $type, ?UploadedFile $attachment): array
    {
        if ($attachment === null || $attachment->getError() === UPLOAD_ERR_NO_FILE) {
            return [
                'attachment_path' => null,
                'attachment_original_name' => null,
                'attachment_mime' => null,
            ];
        }

        if ($type !== 'bug') {
            throw new \InvalidArgumentException('Bildevedlegg er bare tilgjengelig for bugs.');
        }

        if (! $attachment->isValid()) {
            throw new \InvalidArgumentException('Opplasting av bilde feilet.');
        }

        if ($attachment->getSize() > (5 * 1024 * 1024)) {
            throw new \InvalidArgumentException('Bildet kan maks være 5 MB.');
        }

        $extension = strtolower((string) $attachment->getExtension());
        if (! in_array($extension, ['jpg', 'jpeg', 'png', 'webp', 'gif'], true)) {
            throw new \InvalidArgumentException('Bare JPG, PNG, WEBP og GIF er tillatt.');
        }

        $mime = strtolower((string) $attachment->getMimeType());
        if (! in_array($mime, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], true)) {
            throw new \InvalidArgumentException('Ugyldig bildefil.');
        }

        $targetDirectory = WRITEPATH . 'uploads/feedback';
        if (! is_dir($targetDirectory) && ! mkdir($targetDirectory, 0775, true) && ! is_dir($targetDirectory)) {
            throw new \RuntimeException('Kunne ikke opprette mappe for vedlegg.');
        }

        $newName = $attachment->getRandomName();
        $attachment->move($targetDirectory, $newName);

        return [
            'attachment_path' => 'uploads/feedback/' . $newName,
            'attachment_original_name' => (string) $attachment->getClientName(),
            'attachment_mime' => $mime,
        ];
    }
}
