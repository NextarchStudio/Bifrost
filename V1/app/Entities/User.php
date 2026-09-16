<?php
declare(strict_types=1);

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class User extends Entity
{
    protected $attributes = [
        'id'            => null,
        'name'          => null,
        'first_name'    => null,
        'last_name'     => null,
        'email'         => null,
        'wannabe_id'    => null,
        'password_hash' => null,
        'active'        => 1,
        'created_at'    => null,
        'updated_at'    => null,
    ];
}
