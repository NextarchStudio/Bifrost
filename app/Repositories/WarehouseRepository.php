<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\LocationModel;
use App\Models\PalletModel;
use App\Models\PalletSlotModel;

class WarehouseRepository
{
    public function __construct(
        private readonly LocationModel $locations = new LocationModel(),
        private readonly PalletModel $pallets = new PalletModel(),
        private readonly PalletSlotModel $slots = new PalletSlotModel()
    ) {
    }

    public function locations(): array
    {
        return $this->locations->orderBy('name', 'ASC')->findAll();
    }

    public function palletEligibleLocations(): array
    {
        return $this->locations
            ->where('LOWER(type) !=', 'transport')
            ->orderBy('name', 'ASC')
            ->findAll();
    }

    public function transportLocations(): array
    {
        return $this->locations
            ->where('LOWER(type)', 'transport')
            ->orderBy('name', 'ASC')
            ->findAll();
    }

    public function nonTransportLocations(): array
    {
        return $this->locations
            ->where('LOWER(type) !=', 'transport')
            ->orderBy('name', 'ASC')
            ->findAll();
    }

    public function palletsWithLocation(): array
    {
        return $this->pallets
            ->select('pallets.*, locations.name AS location_name')
            ->join('locations', 'locations.id = pallets.location_id', 'inner')
            ->orderBy('pallets.name', 'ASC')
            ->findAll();
    }

    public function slotsWithPallet(): array
    {
        return $this->slots
            ->select('pallet_slots.*, pallets.name AS pallet_name')
            ->join('pallets', 'pallets.id = pallet_slots.pallet_id', 'inner')
            ->orderBy('pallet_slots.pallet_id', 'ASC')
            ->orderBy('pallet_slots.slot_number', 'ASC')
            ->findAll();
    }

    public function createLocation(array $data): int
    {
        $this->locations->insert($data);

        return (int) $this->locations->getInsertID();
    }

    public function createPallet(array $data): int
    {
        $this->pallets->insert($data);

        return (int) $this->pallets->getInsertID();
    }

    public function updatePalletById(int $palletId, array $data): bool
    {
        return $this->pallets->update($palletId, $data);
    }

    public function createSlot(array $data): int
    {
        $this->slots->insert($data);

        return (int) $this->slots->getInsertID();
    }

    public function findPalletByQrCode(string $qrCode): ?object
    {
        $qrCode = trim($qrCode);
        if ($qrCode === '') {
            return null;
        }

        return $this->pallets
            ->select('pallets.*, locations.name AS location_name')
            ->join('locations', 'locations.id = pallets.location_id', 'inner')
            ->where('pallets.qr_code', $qrCode)
            ->first();
    }

    public function findLocationById(int $locationId): ?object
    {
        return $this->locations->find($locationId);
    }

    public function countPalletsByLocation(int $locationId): int
    {
        return (int) $this->pallets->where('location_id', $locationId)->countAllResults();
    }

    public function findPalletById(int $palletId): ?object
    {
        return $this->pallets
            ->select('pallets.*, locations.name AS location_name')
            ->join('locations', 'locations.id = pallets.location_id', 'inner')
            ->where('pallets.id', $palletId)
            ->first();
    }

    public function palletSlotsWithEquipment(int $palletId): array
    {
        return $this->slots
            ->select('pallet_slots.id, pallet_slots.slot_number, pallet_slots.status AS slot_status, equipment.id AS equipment_id, equipment.name AS equipment_name, equipment.serial_number, equipment.quantity, equipment.status AS equipment_status')
            ->join('equipment', 'equipment.pallet_slot_id = pallet_slots.id', 'left')
            ->where('pallet_slots.pallet_id', $palletId)
            ->orderBy('pallet_slots.slot_number', 'ASC')
            ->findAll();
    }

    public function findSlotByPalletAndNumber(int $palletId, int $slotNumber): ?object
    {
        return $this->slots
            ->where('pallet_id', $palletId)
            ->where('slot_number', $slotNumber)
            ->first();
    }

    public function deletePalletById(int $palletId): bool
    {
        return $this->pallets->delete($palletId);
    }

    public function countEquipmentOnPallet(int $palletId): int
    {
        return (int) $this->slots->db
            ->table('equipment')
            ->join('pallet_slots', 'pallet_slots.id = equipment.pallet_slot_id', 'inner')
            ->where('pallet_slots.pallet_id', $palletId)
            ->countAllResults();
    }

    public function deleteLocationById(int $locationId): bool
    {
        return $this->locations->delete($locationId);
    }
}
