<?php
declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;

class ShopMovementModel extends Model
{
    protected $table = 'shop_movements';
    protected $primaryKey = 'id';
    protected $returnType = 'object';
    protected $allowedFields = ['shop_item_id', 'actor_user_id', 'movement_type', 'quantity', 'notes', 'created_at'];
    protected $useTimestamps = false;
}
