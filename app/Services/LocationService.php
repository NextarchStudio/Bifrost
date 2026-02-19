<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\WarehouseRepository;

class LocationService
{
    public function __construct(
        private readonly WarehouseRepository $warehouse = new WarehouseRepository(),
        private readonly AuditService $audit = new AuditService()
    ) {
    }

    public function list(): array
    {
        return $this->warehouse->locations();
    }

    public function create(array $input, int $actorUserId): int
    {
        $rules = ['name' => 'required|max_length[120]', 'type' => 'required|max_length[50]'];
        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException('Ugyldig lokasjon.');
        }

        $id = $this->warehouse->createLocation([
            'name' => mb_substr(strip_tags((string) $input['name']), 0, 120),
            'type' => mb_substr(strip_tags((string) $input['type']), 0, 50),
        ]);
        $this->audit->log($actorUserId, 'create', 'location', $id, $input);

        return $id;
    }

    public function delete(int $locationId, int $actorUserId): void
    {
        $location = $this->warehouse->findLocationById($locationId);
        if ($location === null) {
            throw new \InvalidArgumentException('Lokasjon finnes ikke.');
        }

        $palletCount = $this->warehouse->countPalletsByLocation($locationId);
        if ($palletCount > 0) {
            throw new \InvalidArgumentException('Lokasjon kan ikke slettes fordi den har paller.');
        }

        $this->warehouse->deleteLocationById($locationId);
        $this->audit->log($actorUserId, 'delete', 'location', $locationId, ['name' => (string) $location->name]);
    }
}

