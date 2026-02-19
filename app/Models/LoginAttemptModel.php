<?php
declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;

class LoginAttemptModel extends Model
{
    protected $table = 'login_attempts';
    protected $primaryKey = 'id';
    protected $returnType = 'array';
    protected $allowedFields = ['email', 'ip_address', 'successful', 'created_at'];
    protected $useTimestamps = false;
}

