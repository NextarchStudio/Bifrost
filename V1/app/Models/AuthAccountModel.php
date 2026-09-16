<?php
declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;

class AuthAccountModel extends Model
{
    protected $table = 'auth_accounts';
    protected $primaryKey = 'id';
    protected $returnType = 'array';
    protected $allowedFields = ['user_id', 'provider', 'provider_id'];
    protected $useTimestamps = false;
}

