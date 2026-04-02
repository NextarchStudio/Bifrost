<?php
declare(strict_types=1);

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class VehicleLoan extends Entity
{
    protected $attributes = [
        'id' => null,
        'vehicle_id' => null,
        'wannabe_id' => null,
        'issued_by_user_id' => null,
        'issued_at' => null,
        'returned_at' => null,
        'status' => null,
    ];
}
