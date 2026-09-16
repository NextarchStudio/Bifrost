<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\CrewClothingCrewModel;
use App\Models\CrewClothingInventoryModel;
use App\Models\CrewClothingMemberModel;

class CrewClothingRepository
{
    public function __construct(
        private readonly CrewClothingCrewModel $crews = new CrewClothingCrewModel(),
        private readonly CrewClothingMemberModel $members = new CrewClothingMemberModel(),
        private readonly CrewClothingInventoryModel $inventory = new CrewClothingInventoryModel()
    ) {
    }

    public function crewsWithSummary(): array
    {
        $rows = $this->crews
            ->select(
                'crew_clothing_crews.*, ' .
                'COUNT(crew_clothing_members.id) AS members_total, ' .
                'COALESCE(SUM(CASE WHEN crew_clothing_members.tshirt_delivered = 1 THEN 1 ELSE 0 END), 0) AS tshirt_delivered_total, ' .
                'COALESCE(SUM(CASE WHEN crew_clothing_members.hoodie_delivered = 1 THEN 1 ELSE 0 END), 0) AS hoodie_delivered_total'
            )
            ->join('crew_clothing_members', 'crew_clothing_members.crew_id = crew_clothing_crews.id', 'left')
            ->groupBy('crew_clothing_crews.id')
            ->orderBy('crew_clothing_crews.name', 'ASC')
            ->findAll();

        return array_map(static function (array $row): array {
            $row['id'] = (int) ($row['id'] ?? 0);
            $row['tshirt_max'] = (int) ($row['tshirt_max'] ?? 0);
            $row['hoodie_max'] = (int) ($row['hoodie_max'] ?? 0);
            $row['members_total'] = (int) ($row['members_total'] ?? 0);
            $row['tshirt_delivered_total'] = (int) ($row['tshirt_delivered_total'] ?? 0);
            $row['hoodie_delivered_total'] = (int) ($row['hoodie_delivered_total'] ?? 0);

            return $row;
        }, $rows);
    }

    public function allCrews(): array
    {
        return $this->crews->orderBy('name', 'ASC')->findAll();
    }

    public function findCrewById(int $crewId): ?array
    {
        return $this->crews->find($crewId);
    }

    public function findCrewByName(string $name): ?array
    {
        return $this->crews->where('name', $name)->first();
    }

    public function createCrew(array $data): int
    {
        $this->crews->insert($data);

        return (int) $this->crews->getInsertID();
    }

    public function updateCrewById(int $crewId, array $data): bool
    {
        return $this->crews->update($crewId, $data);
    }

    public function members(int $limit = 200): array
    {
        return $this->members
            ->select('crew_clothing_members.*, crew_clothing_crews.name AS crew_name')
            ->join('crew_clothing_crews', 'crew_clothing_crews.id = crew_clothing_members.crew_id', 'left')
            ->orderBy('crew_clothing_members.updated_at', 'DESC')
            ->orderBy('crew_clothing_members.name', 'ASC')
            ->findAll($limit);
    }

    public function findMemberById(int $memberId): ?array
    {
        return $this->members
            ->select('crew_clothing_members.*, crew_clothing_crews.name AS crew_name')
            ->join('crew_clothing_crews', 'crew_clothing_crews.id = crew_clothing_members.crew_id', 'left')
            ->where('crew_clothing_members.id', $memberId)
            ->first();
    }

    public function findMemberByWannabeId(int $wannabeId): ?array
    {
        return $this->members
            ->select('crew_clothing_members.*, crew_clothing_crews.name AS crew_name')
            ->join('crew_clothing_crews', 'crew_clothing_crews.id = crew_clothing_members.crew_id', 'left')
            ->where('crew_clothing_members.wannabe_id', $wannabeId)
            ->first();
    }

    public function findMemberByBadgeScanNumber(string $scanNumber): ?array
    {
        return $this->members
            ->select('crew_clothing_members.*, crew_clothing_crews.name AS crew_name')
            ->join('crew_clothing_crews', 'crew_clothing_crews.id = crew_clothing_members.crew_id', 'left')
            ->where('crew_clothing_members.badge_scan_number', $scanNumber)
            ->first();
    }

    public function createMember(array $data): int
    {
        $this->members->insert($data);

        return (int) $this->members->getInsertID();
    }

    public function updateMemberById(int $memberId, array $data): bool
    {
        return $this->members->update($memberId, $data);
    }

    public function inventory(): array
    {
        return $this->inventory
            ->orderBy('item_type', 'ASC')
            ->orderBy('size', 'ASC')
            ->findAll();
    }

    public function findInventoryByTypeAndSize(string $itemType, string $size): ?array
    {
        return $this->inventory
            ->where('item_type', $itemType)
            ->where('size', $size)
            ->first();
    }

    public function findInventoryById(int $inventoryId): ?array
    {
        return $this->inventory->find($inventoryId);
    }

    public function createInventory(array $data): int
    {
        $this->inventory->insert($data);

        return (int) $this->inventory->getInsertID();
    }

    public function updateInventoryById(int $inventoryId, array $data): bool
    {
        return $this->inventory->update($inventoryId, $data);
    }

    public function deleteInventoryById(int $inventoryId): bool
    {
        return $this->inventory->delete($inventoryId);
    }
}
