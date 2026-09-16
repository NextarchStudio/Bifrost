<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\EquipmentLoanModel;

class LoanRepository
{
    public function __construct(private readonly EquipmentLoanModel $loans = new EquipmentLoanModel())
    {
    }

    public function activeLoans(?string $search = null): array
    {
        $builder = $this->loans
            ->select('equipment_loans.*, equipment.name AS equipment_name, equipment.serial_number, users.name AS wannabe_name, users.first_name AS wannabe_first_name, users.last_name AS wannabe_last_name')
            ->join('equipment', 'equipment.id = equipment_loans.equipment_id', 'inner')
            ->join('users', 'users.wannabe_id = equipment_loans.wannabe_id', 'left')
            ->where('equipment_loans.status', 'active')
            ->orderBy('equipment_loans.issued_at', 'DESC');

        $search = trim((string) $search);
        if ($search !== '') {
            $builder->groupStart()
                ->like('equipment_loans.wannabe_id', $search)
                ->orLike('equipment.serial_number', $search)
                ->orLike('users.name', $search)
                ->orLike('users.first_name', $search)
                ->orLike('users.last_name', $search)
                ->groupEnd();
        }

        return $builder->findAll();
    }

    public function create(array $data): int
    {
        $this->loans->insert($data);

        return (int) $this->loans->getInsertID();
    }

    public function findById(int $id): ?object
    {
        return $this->loans->find($id);
    }

    public function updateById(int $id, array $data): bool
    {
        return $this->loans->update($id, $data);
    }

    public function findActiveByEquipmentAndWannabe(int $equipmentId, int $wannabeId): ?object
    {
        return $this->loans
            ->where('equipment_id', $equipmentId)
            ->where('wannabe_id', $wannabeId)
            ->where('status', 'active')
            ->first();
    }

    public function findActiveByRequestEquipmentAndWannabe(int $requestId, int $equipmentId, int $wannabeId): ?object
    {
        return $this->loans
            ->where('request_id', $requestId)
            ->where('equipment_id', $equipmentId)
            ->where('wannabe_id', $wannabeId)
            ->where('status', 'active')
            ->first();
    }

    public function addRequestQuantity(int $requestId, int $equipmentId, int $wannabeId, int $issuedByUserId, int $quantity): int
    {
        $quantity = max(1, $quantity);
        $existing = $this->findActiveByRequestEquipmentAndWannabe($requestId, $equipmentId, $wannabeId);
        if ($existing !== null) {
            $newQuantity = max(1, (int) $existing->quantity) + $quantity;
            $this->updateById((int) $existing->id, ['quantity' => $newQuantity]);

            return (int) $existing->id;
        }

        return $this->create([
            'equipment_id'      => $equipmentId,
            'wannabe_id'        => $wannabeId,
            'quantity'          => $quantity,
            'request_id'        => $requestId,
            'issued_by_user_id' => $issuedByUserId,
            'issued_at'         => date('Y-m-d H:i:s'),
            'returned_at'       => null,
            'status'            => 'active',
        ]);
    }

    public function activeCountByRequestId(int $requestId): int
    {
        return (int) $this->loans
            ->where('request_id', $requestId)
            ->where('status', 'active')
            ->countAllResults();
    }

    public function totalCountByRequestId(int $requestId): int
    {
        return (int) $this->loans
            ->where('request_id', $requestId)
            ->countAllResults();
    }

    public function loansByWannabeId(int $wannabeId): array
    {
        return $this->loans
            ->select('equipment_loans.*, equipment.name AS equipment_name, equipment.serial_number')
            ->join('equipment', 'equipment.id = equipment_loans.equipment_id', 'inner')
            ->where('equipment_loans.wannabe_id', $wannabeId)
            ->orderBy('equipment_loans.issued_at', 'DESC')
            ->findAll();
    }
}
