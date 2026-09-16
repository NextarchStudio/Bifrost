<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\VehicleModel;

class VehicleRepository
{
    public function __construct(private readonly VehicleModel $vehicles = new VehicleModel())
    {
    }

    public function allWithActiveLoanContext(): array
    {
        return $this->vehicles
            ->select('vehicles.*')
            ->select('vehicle_loans.id AS active_loan_id, vehicle_loans.wannabe_id AS active_wannabe_id, vehicle_loans.issued_at AS active_issued_at')
            ->select('users.name AS wannabe_name, users.first_name AS wannabe_first_name, users.last_name AS wannabe_last_name')
            ->join('vehicle_loans', 'vehicle_loans.vehicle_id = vehicles.id AND vehicle_loans.status = \'active\'', 'left', false)
            ->join('users', 'users.wannabe_id = vehicle_loans.wannabe_id', 'left')
            ->orderBy('vehicles.name', 'ASC')
            ->findAll();
    }

    public function create(array $data): int
    {
        $this->vehicles->insert($data);

        return (int) $this->vehicles->getInsertID();
    }

    public function findById(int $id): ?object
    {
        return $this->vehicles->find($id);
    }

    public function updateById(int $id, array $data): bool
    {
        return $this->vehicles->update($id, $data);
    }

    public function deleteById(int $id): bool
    {
        return $this->vehicles->delete($id);
    }

    public function hasActiveLoan(int $vehicleId): bool
    {
        return (int) $this->vehicles->db
            ->table('vehicle_loans')
            ->where('vehicle_id', $vehicleId)
            ->where('status', 'active')
            ->countAllResults() > 0;
    }

    public function availableForTransport(): array
    {
        return $this->vehicles
            ->whereIn('status', ['available', 'loaned'])
            ->orderBy('name', 'ASC')
            ->findAll();
    }
}
