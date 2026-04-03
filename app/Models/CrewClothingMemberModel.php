<?php
declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;

class CrewClothingMemberModel extends Model
{
    protected $table = 'crew_clothing_members';
    protected $primaryKey = 'id';
    protected $returnType = 'array';
    protected $allowedFields = [
        'crew_id',
        'wannabe_id',
        'badge_scan_number',
        'name',
        'nickname',
        'tshirt_size',
        'tshirt_delivered',
        'tshirt_delivered_at',
        'tshirt_delivered_by_user_id',
        'hoodie_size',
        'hoodie_delivered',
        'hoodie_delivered_at',
        'hoodie_delivered_by_user_id',
        'created_at',
        'updated_at',
    ];
    protected $useTimestamps = false;
}
