<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\AuditRepository;

class AuditService
{
    public function __construct(private readonly AuditRepository $auditRepository = new AuditRepository())
    {
    }

    public function log(int $actorUserId, string $action, string $entityType, int $entityId, array $diff = []): void
    {
        $this->auditRepository->insert([
            'actor_user_id' => $actorUserId,
            'action'        => $action,
            'entity_type'   => $entityType,
            'entity_id'     => $entityId,
            'diff_json'     => json_encode($diff, JSON_THROW_ON_ERROR),
            'created_at'    => date('Y-m-d H:i:s'),
        ]);
    }
}

