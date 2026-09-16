<?php
declare(strict_types=1);

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class EquipmentLoan extends Entity
{
    protected $attributes = [
        'id'               => null,
        'equipment_id'     => null,
        'wannabe_id'       => null,
        'quantity'         => 1,
        'request_id'       => null,
        'issued_by_user_id'=> null,
        'issued_at'        => null,
        'returned_at'      => null,
        'status'           => null,
    ];
}
