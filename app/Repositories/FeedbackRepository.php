<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\FeedbackEntryModel;

class FeedbackRepository
{
    /**
     * @return list<string>
     */
    private function visibleStatuses(): array
    {
        return ['pending', 'on_hold', 'approved', 'in_progress'];
    }

    public function __construct(private readonly FeedbackEntryModel $entries = new FeedbackEntryModel())
    {
    }

    public function create(array $data): int
    {
        $this->entries->insert($data);

        return (int) $this->entries->getInsertID();
    }

    public function mine(int $userId): array
    {
        return $this->entries
            ->where('requester_user_id', $userId)
            ->whereIn('status', $this->visibleStatuses())
            ->orderBy('created_at', 'DESC')
            ->findAll();
    }

    public function all(): array
    {
        return $this->entries
            ->whereIn('status', $this->visibleStatuses())
            ->orderBy('created_at', 'DESC')
            ->findAll();
    }

    public function announcements(int $limit = 8): array
    {
        return $this->entries
            ->whereIn('status', ['approved', 'on_hold', 'fixed', 'added'])
            ->orderBy('updated_at', 'DESC')
            ->findAll($limit);
    }

    public function findById(int $id): ?array
    {
        return $this->entries->find($id);
    }

    public function updateById(int $id, array $data): bool
    {
        return $this->entries->update($id, $data);
    }

    public function deleteById(int $id): bool
    {
        return $this->entries->delete($id);
    }
}
