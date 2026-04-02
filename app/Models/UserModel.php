<?php
declare(strict_types=1);

namespace App\Models;

use App\Entities\User;
use CodeIgniter\Model;

class UserModel extends Model
{
    protected $table = 'users';
    protected $primaryKey = 'id';
    protected $returnType = User::class;
    protected $allowedFields = ['name', 'first_name', 'last_name', 'email', 'wannabe_id', 'badge_scan_number', 'password_hash', 'active', 'created_at', 'updated_at'];
    protected $useTimestamps = false;
}
