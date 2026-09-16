<?php
declare(strict_types=1);

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class PalletSlot extends Entity
{
    protected $attributes = [
        'id'          => null,
        'pallet_id'   => null,
        'slot_number' => null,
        'status'      => null,
    ];
}

