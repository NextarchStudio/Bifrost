<?php
declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;

class UserRoleModel extends Model
{
    protected $table = 'user_roles';
    protected $primaryKey = 'user_id';
    protected $returnType = 'array';
    protected $allowedFields = ['user_id', 'role_id'];
    protected $useAutoIncrement = false;
    protected $useTimestamps = false;
}

