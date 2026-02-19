<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\AuditLogModel;

class AuditRepository
{
    public function __construct(private readonly AuditLogModel $auditLogs = new AuditLogModel())
    {
    }

    public function insert(array $data): void
    {
        $this->auditLogs->insert($data);
    }
}

