<?php
declare(strict_types=1);

namespace App\Models;

use App\Entities\PalletSlot;
use CodeIgniter\Model;

class PalletSlotModel extends Model
{
    protected $table = 'pallet_slots';
    protected $primaryKey = 'id';
    protected $returnType = PalletSlot::class;
    protected $allowedFields = ['pallet_id', 'slot_number', 'status'];
    protected $useTimestamps = false;
}

