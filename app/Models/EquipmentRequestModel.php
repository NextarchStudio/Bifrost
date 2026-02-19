<?php
declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;

class EquipmentRequestModel extends Model
{
    protected $table = 'equipment_requests';
    protected $primaryKey = 'id';
    protected $returnType = 'array';
    protected $allowedFields = ['requester_user_id', 'wannabe_id', 'title', 'notes', 'status', 'created_at', 'updated_at'];
    protected $useTimestamps = false;
}
