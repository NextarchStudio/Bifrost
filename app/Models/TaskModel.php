<?php
declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;

class TaskModel extends Model
{
    protected $table = 'tasks';
    protected $primaryKey = 'id';
    protected $returnType = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = [
        'title',
        'type',
        'transport_job_id',
        'status',
        'priority',
        'message',
        'description',
        'assigned_user_id',
        'created_by_user_id',
        'due_at',
        'completed_at',
        'created_at',
        'updated_at',
    ];
}
