<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\TaskModel;

class TaskRepository
{
    public function __construct(private readonly TaskModel $tasks = new TaskModel())
    {
    }

    public function create(array $data): int
    {
        $this->tasks->insert($data);

        return (int) $this->tasks->getInsertID();
    }

    public function findById(int $taskId): ?array
    {
        return $this->tasks->find($taskId);
    }

    public function updateById(int $taskId, array $data): bool
    {
        return $this->tasks->update($taskId, $data);
    }

    public function mine(int $userId): array
    {
        return $this->baseQuery()
            ->where('tasks.assigned_user_id', $userId)
            ->orderBy('tasks.status = "completed"', 'ASC', false)
            ->orderBy('tasks.priority', 'DESC')
            ->orderBy('tasks.due_at', 'ASC')
            ->findAll();
    }

    public function all(): array
    {
        return $this->baseQuery()
            ->orderBy('tasks.status = "completed"', 'ASC', false)
            ->orderBy('tasks.priority', 'DESC')
            ->orderBy('tasks.due_at', 'ASC')
            ->findAll();
    }

    private function baseQuery(): TaskModel
    {
        return $this->tasks
            ->select(
                'tasks.*, '
                . 'assigned.name AS assigned_name, '
                . 'assigned.wannabe_id AS assigned_wannabe_id, '
                . 'creator.name AS created_by_name, '
                . 'transport_jobs.description AS transport_description, '
                . 'transport_jobs.status AS transport_status'
            )
            ->join('users assigned', 'assigned.id = tasks.assigned_user_id', 'inner')
            ->join('users creator', 'creator.id = tasks.created_by_user_id', 'inner')
            ->join('transport_jobs', 'transport_jobs.id = tasks.transport_job_id', 'left');
    }
}
