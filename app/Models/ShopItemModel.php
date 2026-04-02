<?php
declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;

class ShopItemModel extends Model
{
    protected $table = 'shop_items';
    protected $primaryKey = 'id';
    protected $returnType = 'object';
    protected $allowedFields = ['category_id', 'name', 'size', 'quantity', 'notes', 'created_at', 'updated_at'];
    protected $useTimestamps = false;
}
