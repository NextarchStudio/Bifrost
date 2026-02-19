<?php
declare(strict_types=1);

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class SystemSetting extends Entity
{
    protected $attributes = [
        'id'                    => 1,
        'enable_local_login'    => 1,
        'enable_discord_login'  => 1,
        'enable_keycloak_login' => 1,
    ];
}

