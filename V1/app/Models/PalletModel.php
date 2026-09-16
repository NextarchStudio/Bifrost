<?php
declare(strict_types=1);

namespace App\Models;

use App\Entities\Pallet;
use CodeIgniter\Model;

class PalletModel extends Model
{
    protected $table = 'pallets';
    protected $primaryKey = 'id';
    protected $returnType = Pallet::class;
    protected $allowedFields = ['location_id', 'name', 'qr_code'];
    protected $useTimestamps = false;
}

