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
    protected $allowedFields = ['description', 'from_location_id', 'to_location_id', 'transport_type', 'job_kind', 'people_count', 'pickup_at', 'equipment_id', 'requester_user_id', 'requester_wannabe_id', 'assigned_user_id', 'assigned_vehicle_id', 'start_odometer', 'end_odometer', 'distance_km', 'estimated_distance_km', 'distance_deviation_km', 'status', 'created_at', 'updated_at'];
    protected $useTimestamps = false;
}
