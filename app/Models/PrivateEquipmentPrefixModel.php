<?php
declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;

class PrivateEquipmentPrefixModel extends Model
{
    protected $table = 'private_equipment_prefixes';
    protected $primaryKey = 'id';
    protected $returnType = 'array';
    protected $allowedFields = ['owner_name', 'barcode_prefix', 'created_at', 'updated_at'];
    protected $useTimestamps = false;
}
