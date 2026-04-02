<?php
declare(strict_types=1);

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class Location extends Entity
{
    protected $attributes = [
        'id' => null,
        'name' => null,
        'type' => null,
        'address' => null,
        'latitude' => null,
        'longitude' => null,
    ];
}

