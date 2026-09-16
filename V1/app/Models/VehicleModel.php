<?php
declare(strict_types=1);

namespace App\Models;

use App\Entities\Vehicle;
use CodeIgniter\Model;

class VehicleModel extends Model
{
    protected $table = 'vehicles';
    protected $primaryKey = 'id';
    protected $returnType = Vehicle::class;
    protected $allowedFields = ['name', 'registration_number', 'competency_requirement', 'competency_override_requirement', 'current_odometer', 'odometer_exempt', 'vegvesen_exempt', 'max_payload_kg', 'vegvesen_last_sync_at', 'status', 'notes', 'created_at', 'updated_at'];
    protected $useTimestamps = false;
}
