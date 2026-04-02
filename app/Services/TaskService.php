<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\TaskRepository;
use App\Repositories\TransportRepository;
use App\Repositories\UserRepository;

class TaskService
{
    public function __construct(
        private readonly TaskRepository $tasks = new TaskRepository(),
        private readonly UserRepository $users = new UserRepository(),
        private readonly TransportRepository $transport = new TransportRepository(),
        private readonly AuditService $audit = new AuditService()
    ) {
    }

    public function pageData(int $userId, bool $canManageAll): array
    {
        return [
            'myTasks' => $this->tasks->mine($userId),
            'allTasks' => $canManageAll ? $this->tasks->all() : [],
            'users' => $canManageAll ? $this->users->all() : [],
            'transportJobs' => $canManageAll ? $this->transport->activeJobs() : [],
            'canManageAll' => $canManageAll,
            'currentUserId' => $userId,
        ];
    }

    public function create(array $input, int $actorUserId): int
    {
        $rules = [
            'title' => 'required|min_length[3]|max_length[180]',
            'type' => 'required|in_list[transport,work]',
            'status' => 'required|in_list[not_started,in_progress,blocked,completed]',
            'priority' => 'required|in_list[1,2,3]',
            'message' => 'permit_empty|max_length[5000]',
            'description' => 'required|min_length[5]|max_length[5000]',
            'assigned_user_id' => 'required|integer|greater_than[0]',
            'due_at' => 'required',
            'transport_job_id' => 'permit_empty|integer|greater_than[0]',
        ];

        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException(implode(' ', service('validation')->getErrors()));
        }

        $assignedUserId = (int) $input['assigned_user_id'];
        if ($this->users->findById($assignedUserId) === null) {
            throw new \InvalidArgumentException('Valgt bruker finnes ikke.');
        }

        $type = (string) $input['type'];
        $transportJobId = ! empty($input['transport_job_id']) ? (int) $input['transport_job_id'] : null;
        if ($type === 'transport' && $transportJobId !== null && $this->transport->findById($transportJobId) === null) {
            throw new \InvalidArgumentException('Valgt transportoppdrag finnes ikke.');
        }
        if ($type !== 'transport') {
            $transportJobId = null;
        }

        $dueAt = \DateTime::createFromFormat('Y-m-d\TH:i', trim((string) $input['due_at']));
        if ($dueAt === false) {
            throw new \InvalidArgumentException('Ugyldig dato og klokkeslett.');
        }

        $status = (string) $input['status'];
        $now = date('Y-m-d H:i:s');
        $taskId = $this->tasks->create([
            'title' => mb_substr(strip_tags(trim((string) $input['title'])), 0, 180),
            'type' => $type,
            'transport_job_id' => $transportJobId,
            'status' => $status,
            'priority' => (int) $input['priority'],
            'message' => ($message = trim((string) ($input['message'] ?? ''))) !== '' ? mb_substr($message, 0, 5000) : null,
            'description' => mb_substr(trim((string) $input['description']), 0, 5000),
            'assigned_user_id' => $assignedUserId,
            'created_by_user_id' => $actorUserId,
            'due_at' => $dueAt->format('Y-m-d H:i:s'),
            'completed_at' => $status === 'completed' ? $now : null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $this->audit->log($actorUserId, 'create', 'task', $taskId, [
            'type' => $type,
            'status' => $status,
            'priority' => (int) $input['priority'],
            'assigned_user_id' => $assignedUserId,
            'transport_job_id' => $transportJobId,
        ]);

        return $taskId;
    }

    public function updateStatus(int $taskId, array $input, int $actorUserId, bool $canManageAll): void
    {
        $task = $this->tasks->findById($taskId);
        if ($task === null) {
            throw new \InvalidArgumentException('Oppgaven finnes ikke.');
        }

        if (! $canManageAll && (int) ($task['assigned_user_id'] ?? 0) !== $actorUserId) {
            throw new \RuntimeException('Forbidden');
        }

        $status = trim((string) ($input['status'] ?? ''));
        if (! in_array($status, ['not_started', 'in_progress', 'blocked', 'completed'], true)) {
            throw new \InvalidArgumentException('Ugyldig status.');
        }

        $now = date('Y-m-d H:i:s');
        $this->tasks->updateById($taskId, [
            'status' => $status,
            'completed_at' => $status === 'completed' ? $now : null,
            'updated_at' => $now,
        ]);

        $this->audit->log($actorUserId, 'status', 'task', $taskId, ['status' => $status]);
    }

    public function statusLabel(string $status): string
    {
        return match ($status) {
            'not_started' => 'Ikke startet',
            'in_progress' => 'Pågår',
            'blocked' => 'Blokkert',
            'completed' => 'Ferdig',
            default => $status,
        };
    }

    public function priorityLabel(int $priority): string
    {
        return match ($priority) {
            1 => '1 (Lav)',
            2 => '2 (Middels)',
            3 => '3 (Høy)',
            default => (string) $priority,
        };
    }

    public function typeLabel(string $type): string
    {
        return match ($type) {
            'transport' => 'Transportoppdrag',
            'work' => 'Arbeidsoppgave',
            default => $type,
        };
    }
}
