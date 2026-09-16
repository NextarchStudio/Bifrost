<?php
declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;

class AuditLogModel extends Model
{
    protected $table = 'audit_logs';
    protected $primaryKey = 'id';
    protected $returnType = 'array';
    protected $allowedFields = ['actor_user_id', 'action', 'entity_type', 'entity_id', 'diff_json', 'created_at'];
    protected $useTimestamps = false;
}

