<?php
declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;

class CrewClothingCrewModel extends Model
{
    protected $table = 'crew_clothing_crews';
    protected $primaryKey = 'id';
    protected $returnType = 'array';
    protected $allowedFields = ['name', 'tshirt_max', 'hoodie_max', 'created_at', 'updated_at'];
    protected $useTimestamps = false;
}
