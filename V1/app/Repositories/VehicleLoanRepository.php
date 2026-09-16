<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\VehicleLoanModel;

class VehicleLoanRepository
{
    public function __construct(private readonly VehicleLoanModel $loans = new VehicleLoanModel())
    {
    }

    public function activeLoans(?string $search = null): array
    {
        $builder = $this->loans
            ->select('vehicle_loans.*, vehicles.name AS vehicle_name, vehicles.registration_number, users.name AS wannabe_name, users.first_name AS wannabe_first_name, users.last_name AS wannabe_last_name')
            ->join('vehicles', 'vehicles.id = vehicle_loans.vehicle_id', 'inner')
            ->join('users', 'users.wannabe_id = vehicle_loans.wannabe_id', 'left')
            ->where('vehicle_loans.status', 'active')
            ->orderBy('vehicle_loans.issued_at', 'DESC');

        $search = trim((string) $search);
        if ($search !== '') {
            $builder->groupStart()
                ->like('vehicle_loans.wannabe_id', $search)
                ->orLike('vehicles.name', $search)
                ->orLike('vehicles.registration_number', $search)
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

    public function findActiveByVehicleId(int $vehicleId): ?object
    {
        return $this->loans
            ->where('vehicle_id', $vehicleId)
            ->where('status', 'active')
            ->first();
    }

    public function loansByWannabeId(int $wannabeId): array
    {
        return $this->loans
            ->select('vehicle_loans.*, vehicles.name AS vehicle_name, vehicles.registration_number')
            ->join('vehicles', 'vehicles.id = vehicle_loans.vehicle_id', 'inner')
            ->where('vehicle_loans.wannabe_id', $wannabeId)
            ->orderBy('vehicle_loans.issued_at', 'DESC')
            ->findAll();
    }
}
