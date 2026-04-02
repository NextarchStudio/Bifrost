<?php
declare(strict_types=1);

namespace App\Models;

use App\Entities\Location;
use CodeIgniter\Model;

class LocationModel extends Model
{
    protected $table = 'locations';
    protected $primaryKey = 'id';
    protected $returnType = Location::class;
    protected $allowedFields = ['name', 'type', 'address', 'latitude', 'longitude'];
    protected $useTimestamps = false;
}

