<?php
declare(strict_types=1);

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class TransportJob extends Entity
{
    protected $attributes = [
        'id'               => null,
        'description'      => null,
        'from_location_id' => null,
        'to_location_id'   => null,
        'transport_type'   => 'equipment',
        'job_kind'         => null,
        'people_count'     => null,
        'pickup_at'        => null,
        'equipment_id'     => null,
        'requester_user_id'=> null,
        'requester_wannabe_id' => null,
        'assigned_user_id' => null,
        'assigned_vehicle_id' => null,
        'start_odometer'   => null,
        'end_odometer'     => null,
        'distance_km'      => null,
        'estimated_distance_km' => null,
        'distance_deviation_km' => null,
        'status'           => null,
        'created_at'       => null,
        'updated_at'       => null,
    ];
}
