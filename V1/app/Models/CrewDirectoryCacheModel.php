<?php
declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;

class CrewDirectoryCacheModel extends Model
{
    protected $table = 'crew_directory_cache';
    protected $primaryKey = 'id';
    protected $returnType = 'array';
    protected $allowedFields = [
        'wannabe_id',
        'scan_number',
        'name',
        'nickname',
        'crew_name',
        'crew_role_title',
        'crew_role_name',
        'created_at',
        'updated_at',
    ];
    protected $useTimestamps = false;
}
