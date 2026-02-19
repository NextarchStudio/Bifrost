<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\TransportJobModel;

class TransportRepository
{
    public function __construct(private readonly TransportJobModel $jobs = new TransportJobModel())
    {
    }

    public function activeJobs(): array
    {
        return $this->jobs
            ->select('transport_jobs.*, fl.name AS from_name, tl.name AS to_name, users.name AS assigned_name, requester.name AS requester_name, equipment.name AS equipment_name')
            ->join('locations fl', 'fl.id = transport_jobs.from_location_id', 'inner')
            ->join('locations tl', 'tl.id = transport_jobs.to_location_id', 'inner')
            ->join('users', 'users.id = transport_jobs.assigned_user_id', 'left')
            ->join('users requester', 'requester.id = transport_jobs.requester_user_id', 'left')
            ->join('equipment', 'equipment.id = transport_jobs.equipment_id', 'left')
            ->whereIn('transport_jobs.status', ['open', 'assigned', 'in_progress'])
            ->orderBy('transport_jobs.created_at', 'DESC')
            ->findAll();
    }

    public function jobsForRequester(int $userId): array
    {
        return $this->jobs
            ->select('transport_jobs.*, fl.name AS from_name, tl.name AS to_name, users.name AS assigned_name, equipment.name AS equipment_name')
            ->join('locations fl', 'fl.id = transport_jobs.from_location_id', 'inner')
            ->join('locations tl', 'tl.id = transport_jobs.to_location_id', 'inner')
            ->join('users', 'users.id = transport_jobs.assigned_user_id', 'left')
            ->join('equipment', 'equipment.id = transport_jobs.equipment_id', 'left')
            ->where('transport_jobs.requester_user_id', $userId)
            ->orderBy('transport_jobs.created_at', 'DESC')
            ->findAll();
    }

    public function create(array $data): int
    {
        $this->jobs->insert($data);

        return (int) $this->jobs->getInsertID();
    }

    public function findById(int $id): ?object
    {
        return $this->jobs->find($id);
    }

    public function findByIdWithContext(int $id): ?object
    {
        return $this->jobs
            ->select('transport_jobs.*, fl.name AS from_name, fl.type AS from_type, tl.name AS to_name, tl.type AS to_type, users.name AS assigned_name, requester.name AS requester_name, equipment.name AS equipment_name, equipment.serial_number AS equipment_serial')
            ->join('locations fl', 'fl.id = transport_jobs.from_location_id', 'inner')
            ->join('locations tl', 'tl.id = transport_jobs.to_location_id', 'inner')
            ->join('users', 'users.id = transport_jobs.assigned_user_id', 'left')
            ->join('users requester', 'requester.id = transport_jobs.requester_user_id', 'left')
            ->join('equipment', 'equipment.id = transport_jobs.equipment_id', 'left')
            ->where('transport_jobs.id', $id)
            ->first();
    }

    public function updateById(int $id, array $data): bool
    {
        return $this->jobs->update($id, $data);
    }
}
