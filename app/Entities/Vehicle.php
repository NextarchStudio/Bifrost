<?php
declare(strict_types=1);

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class Vehicle extends Entity
{
    protected $attributes = [
        'id' => null,
        'name' => null,
        'registration_number' => null,
        'competency_requirement' => 'none',
        'competency_override_requirement' => null,
        'current_odometer' => 0,
        'odometer_exempt' => 0,
        'vegvesen_exempt' => 0,
        'max_payload_kg' => null,
        'vegvesen_last_sync_at' => null,
        'status' => null,
        'notes' => null,
        'created_at' => null,
        'updated_at' => null,
    ];
}
