<?php
declare(strict_types=1);

namespace App\Models;

use App\Entities\TransportJob;
use CodeIgniter\Model;

class TransportJobModel extends Model
{
    protected $table = 'transport_jobs';
    protected $primaryKey = 'id';
    protected $returnType = TransportJob::class;
    protected $allowedFields = ['description', 'from_location_id', 'to_location_id', 'transport_type', 'people_count', 'equipment_id', 'requester_user_id', 'assigned_user_id', 'status', 'created_at', 'updated_at'];
    protected $useTimestamps = false;
}
