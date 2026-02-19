<?php
declare(strict_types=1);

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class Equipment extends Entity
{
    protected $attributes = [
        'id'            => null,
        'name'          => null,
        'category'      => null,
        'serial_number' => null,
        'quantity'      => 1,
        'status'        => null,
        'pallet_slot_id'=> null,
        'notes'         => null,
        'created_at'    => null,
        'updated_at'    => null,
    ];
}
