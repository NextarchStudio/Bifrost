<?php
declare(strict_types=1);

namespace App\Models;

use App\Entities\EquipmentLoan;
use CodeIgniter\Model;

class EquipmentLoanModel extends Model
{
    protected $table = 'equipment_loans';
    protected $primaryKey = 'id';
    protected $returnType = EquipmentLoan::class;
    protected $allowedFields = ['equipment_id', 'wannabe_id', 'quantity', 'request_id', 'issued_by_user_id', 'issued_at', 'returned_at', 'status'];
    protected $useTimestamps = false;
}
