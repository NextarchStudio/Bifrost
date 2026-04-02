<?php
declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;

class WannabeVehicleKdoModel extends Model
{
    protected $table = 'wannabe_vehicle_kdo';
    protected $primaryKey = 'id';
    protected $returnType = 'array';
    protected $allowedFields = ['wannabe_id', 'vehicle_id', 'created_at', 'updated_at'];
    protected $useTimestamps = false;
}
