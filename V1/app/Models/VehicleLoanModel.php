<?php
declare(strict_types=1);

namespace App\Models;

use App\Entities\VehicleLoan;
use CodeIgniter\Model;

class VehicleLoanModel extends Model
{
    protected $table = 'vehicle_loans';
    protected $primaryKey = 'id';
    protected $returnType = VehicleLoan::class;
    protected $allowedFields = ['vehicle_id', 'wannabe_id', 'issued_by_user_id', 'issued_at', 'returned_at', 'status'];
    protected $useTimestamps = false;
}
