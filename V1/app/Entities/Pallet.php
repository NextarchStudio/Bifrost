<?php
declare(strict_types=1);

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class Pallet extends Entity
{
    protected $attributes = [
        'id'          => null,
        'location_id' => null,
        'name'        => null,
        'qr_code'     => null,
    ];
}

