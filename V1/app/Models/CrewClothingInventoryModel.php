<?php
declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;

class CrewClothingInventoryModel extends Model
{
    protected $table = 'crew_clothing_inventory';
    protected $primaryKey = 'id';
    protected $returnType = 'array';
    protected $allowedFields = ['item_type', 'size', 'quantity', 'created_at', 'updated_at'];
    protected $useTimestamps = false;
}
