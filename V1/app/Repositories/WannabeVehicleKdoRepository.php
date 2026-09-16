<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\WannabeVehicleKdoModel;

class WannabeVehicleKdoRepository
{
    public function __construct(private readonly WannabeVehicleKdoModel $records = new WannabeVehicleKdoModel())
    {
    }

    public function hasRecord(int $wannabeId, int $vehicleId): bool
    {
        return $this->records
            ->where('wannabe_id', $wannabeId)
            ->where('vehicle_id', $vehicleId)
            ->first() !== null;
    }

    public function createIfMissing(int $wannabeId, int $vehicleId): void
    {
        if ($this->hasRecord($wannabeId, $vehicleId)) {
            return;
        }

        $now = date('Y-m-d H:i:s');
        $this->records->insert([
            'wannabe_id' => $wannabeId,
            'vehicle_id' => $vehicleId,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }
}
