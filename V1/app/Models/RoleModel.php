<?php
declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;

class RoleModel extends Model
{
    protected $table = 'roles';
    protected $primaryKey = 'id';
    protected $returnType = 'array';
    protected $allowedFields = ['name', 'wannabe_role_name', 'display_name'];
    protected $useTimestamps = false;
}

