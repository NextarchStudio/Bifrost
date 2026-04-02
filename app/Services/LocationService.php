<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\WarehouseRepository;

class LocationService
{
    private const TRANSPORT_ARCHIVE_LOCATION = 'Slettet lokasjon (transportarkiv)';

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
        $rules = [
            'name' => 'required|max_length[120]',
            'type' => 'required|max_length[50]',
            'address' => 'permit_empty|max_length[255]',
        ];
        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException('Ugyldig lokasjon.');
        }

        $id = $this->warehouse->createLocation([
            'name' => mb_substr(strip_tags((string) $input['name']), 0, 120),
            'type' => mb_substr(strip_tags((string) $input['type']), 0, 50),
            'address' => ! empty($input['address']) ? mb_substr(strip_tags((string) $input['address']), 0, 255) : null,
        ]);
        $this->audit->log($actorUserId, 'create', 'location', $id, $input);

        return $id;
    }

    public function update(int $locationId, array $input, int $actorUserId): void
    {
        $location = $this->warehouse->findLocationById($locationId);
        if ($location === null) {
            throw new \InvalidArgumentException('Lokasjon finnes ikke.');
        }

        $rules = [
            'name' => 'required|max_length[120]',
            'type' => 'required|max_length[50]',
            'address' => 'permit_empty|max_length[255]',
        ];
        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException('Ugyldig lokasjon.');
        }

        $address = ! empty($input['address']) ? mb_substr(strip_tags((string) $input['address']), 0, 255) : null;
        $this->warehouse->updateLocationById($locationId, [
            'name' => mb_substr(strip_tags((string) $input['name']), 0, 120),
            'type' => mb_substr(strip_tags((string) $input['type']), 0, 50),
            'address' => $address,
            // Force re-geocoding if the address changes later.
            'latitude' => null,
            'longitude' => null,
        ]);

        $this->audit->log($actorUserId, 'update', 'location', $locationId, [
            'name' => (string) $input['name'],
            'type' => (string) $input['type'],
            'address' => $address,
        ]);
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

        $activeTransportJobCount = $this->warehouse->countActiveTransportJobsByLocation($locationId);
        if ($activeTransportJobCount > 0) {
            throw new \InvalidArgumentException('Lokasjon kan ikke slettes fordi den brukes i aktive transportoppdrag.');
        }

        $transportJobCount = $this->warehouse->countTransportJobsByLocation($locationId);
        if ($transportJobCount > 0) {
            $archiveLocationId = $this->archiveLocationId();
            if ($archiveLocationId === $locationId) {
                throw new \InvalidArgumentException('Arkivlokasjonen for transport kan ikke slettes.');
            }

            $this->warehouse->reassignInactiveTransportJobsLocation($locationId, $archiveLocationId);
        }

        $this->warehouse->deleteLocationById($locationId);
        $this->audit->log($actorUserId, 'delete', 'location', $locationId, ['name' => (string) $location->name]);
    }

    private function archiveLocationId(): int
    {
        $existing = $this->warehouse->findLocationByName(self::TRANSPORT_ARCHIVE_LOCATION);
        if ($existing !== null) {
            return (int) $existing->id;
        }

        return $this->warehouse->createLocation([
            'name' => self::TRANSPORT_ARCHIVE_LOCATION,
            'type' => 'Arkiv',
            'address' => null,
        ]);
    }
}

