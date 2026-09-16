<?php
declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;

class ShopCategoryModel extends Model
{
    protected $table = 'shop_categories';
    protected $primaryKey = 'id';
    protected $returnType = 'array';
    protected $allowedFields = ['name', 'created_at', 'updated_at'];
    protected $useTimestamps = false;
}
