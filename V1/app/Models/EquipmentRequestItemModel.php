<?php
declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;

class EquipmentRequestItemModel extends Model
{
    protected $table = 'equipment_request_items';
    protected $primaryKey = 'id';
    protected $returnType = 'array';
    protected $allowedFields = ['request_id', 'equipment_id', 'quantity', 'approved_quantity', 'item_status', 'note'];
    protected $useTimestamps = false;
}
