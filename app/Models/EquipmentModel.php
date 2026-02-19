<?php
declare(strict_types=1);

namespace App\Models;

use App\Entities\Equipment;
use CodeIgniter\Model;

class EquipmentModel extends Model
{
    protected $table = 'equipment';
    protected $primaryKey = 'id';
    protected $returnType = Equipment::class;
    protected $allowedFields = ['name', 'category', 'serial_number', 'quantity', 'status', 'pallet_slot_id', 'notes', 'created_at', 'updated_at'];
    protected $useTimestamps = false;
}
