<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\TransportJobModel;

class TransportRepository
{
    private const TRANSPORT_ARCHIVE_LOCATION = 'Slettet lokasjon (transportarkiv)';

    public function __construct(private readonly TransportJobModel $jobs = new TransportJobModel())
    {
    }

    public function activeJobs(): array
    {
        return $this->jobs
            ->select($this->contextSelect())
            ->join('locations fl', 'fl.id = transport_jobs.from_location_id', 'inner')
            ->join('locations tl', 'tl.id = transport_jobs.to_location_id', 'inner')
            ->join('users', 'users.id = transport_jobs.assigned_user_id', 'left')
            ->join('users requester', 'requester.id = transport_jobs.requester_user_id', 'left')
            ->join('vehicles', 'vehicles.id = transport_jobs.assigned_vehicle_id', 'left')
            ->whereIn('transport_jobs.status', ['open', 'assigned', 'in_progress'])
            ->orderBy('transport_jobs.created_at', 'DESC')
            ->findAll();
    }

    public function jobsForRequester(int $userId): array
    {
        return $this->jobs
            ->select($this->contextSelect())
            ->join('locations fl', 'fl.id = transport_jobs.from_location_id', 'inner')
            ->join('locations tl', 'tl.id = transport_jobs.to_location_id', 'inner')
            ->join('users', 'users.id = transport_jobs.assigned_user_id', 'left')
            ->join('users requester', 'requester.id = transport_jobs.requester_user_id', 'left')
            ->join('vehicles', 'vehicles.id = transport_jobs.assigned_vehicle_id', 'left')
            ->where('transport_jobs.requester_user_id', $userId)
            ->orderBy('transport_jobs.created_at', 'DESC')
            ->findAll();
    }

    public function completedJobs(): array
    {
        return $this->jobs
            ->select($this->contextSelect())
            ->join('locations fl', 'fl.id = transport_jobs.from_location_id', 'inner')
            ->join('locations tl', 'tl.id = transport_jobs.to_location_id', 'inner')
            ->join('users', 'users.id = transport_jobs.assigned_user_id', 'left')
            ->join('users requester', 'requester.id = transport_jobs.requester_user_id', 'left')
            ->join('vehicles', 'vehicles.id = transport_jobs.assigned_vehicle_id', 'left')
            ->where('transport_jobs.status', 'completed')
            ->orderBy('transport_jobs.updated_at', 'DESC')
            ->findAll();
    }

    public function completedJobsForRequester(int $userId): array
    {
        return $this->jobs
            ->select($this->contextSelect())
            ->join('locations fl', 'fl.id = transport_jobs.from_location_id', 'inner')
            ->join('locations tl', 'tl.id = transport_jobs.to_location_id', 'inner')
            ->join('users', 'users.id = transport_jobs.assigned_user_id', 'left')
            ->join('users requester', 'requester.id = transport_jobs.requester_user_id', 'left')
            ->join('vehicles', 'vehicles.id = transport_jobs.assigned_vehicle_id', 'left')
            ->where('transport_jobs.requester_user_id', $userId)
            ->where('transport_jobs.status', 'completed')
            ->orderBy('transport_jobs.updated_at', 'DESC')
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
            ->select(
                $this->contextSelect()
                . ', fl.type AS from_type, fl.address AS from_address, tl.type AS to_type, tl.address AS to_address'
            )
            ->join('locations fl', 'fl.id = transport_jobs.from_location_id', 'inner')
            ->join('locations tl', 'tl.id = transport_jobs.to_location_id', 'inner')
            ->join('users', 'users.id = transport_jobs.assigned_user_id', 'left')
            ->join('users requester', 'requester.id = transport_jobs.requester_user_id', 'left')
            ->join('vehicles', 'vehicles.id = transport_jobs.assigned_vehicle_id', 'left')
            ->where('transport_jobs.id', $id)
            ->first();
    }

    public function updateById(int $id, array $data): bool
    {
        return $this->jobs->update($id, $data);
    }

    public function createStops(int $jobId, array $stops): void
    {
        if ($stops === [] || ! $this->jobs->db->tableExists('transport_job_stops')) {
            return;
        }

        $rows = [];
        foreach ($stops as $index => $stop) {
            $rows[] = [
                'transport_job_id' => $jobId,
                'stop_number' => $index + 1,
                'address' => $stop['address'],
                'latitude' => $stop['latitude'] ?? null,
                'longitude' => $stop['longitude'] ?? null,
                'notes' => $stop['notes'] !== '' ? $stop['notes'] : null,
                'created_at' => date('Y-m-d H:i:s'),
            ];
        }

        $this->jobs->db->table('transport_job_stops')->insertBatch($rows);
    }

    public function stopsForJob(int $jobId): array
    {
        if (! $this->jobs->db->tableExists('transport_job_stops')) {
            return [];
        }

        return $this->jobs->db
            ->table('transport_job_stops')
            ->where('transport_job_id', $jobId)
            ->orderBy('stop_number', 'ASC')
            ->get()
            ->getResult();
    }

    public function stopsByJobIds(array $jobIds): array
    {
        if ($jobIds === [] || ! $this->jobs->db->tableExists('transport_job_stops')) {
            return [];
        }

        $rows = $this->jobs->db
            ->table('transport_job_stops')
            ->whereIn('transport_job_id', array_values(array_unique(array_map('intval', $jobIds))))
            ->orderBy('transport_job_id', 'ASC')
            ->orderBy('stop_number', 'ASC')
            ->get()
            ->getResult();

        $grouped = [];
        foreach ($rows as $row) {
            $grouped[(int) $row->transport_job_id][] = $row;
        }

        return $grouped;
    }

    public function updateStopCoordinates(int $jobId, int $stopNumber, float $latitude, float $longitude): void
    {
        if (! $this->jobs->db->tableExists('transport_job_stops')) {
            return;
        }

        $this->jobs->db
            ->table('transport_job_stops')
            ->where('transport_job_id', $jobId)
            ->where('stop_number', $stopNumber)
            ->update([
                'latitude' => $latitude,
                'longitude' => $longitude,
            ]);
    }

    private function contextSelect(): string
    {
        $archive = self::TRANSPORT_ARCHIVE_LOCATION;

        return "transport_jobs.*, "
            . "CASE WHEN fl.name = '{$archive}' THEN NULL ELSE fl.name END AS from_name, "
            . "CASE WHEN tl.name = '{$archive}' THEN NULL ELSE tl.name END AS to_name, "
            . 'users.name AS assigned_name, '
            . 'requester.name AS requester_name, '
            . 'requester.wannabe_id AS requester_user_wannabe_id, '
            . 'vehicles.name AS vehicle_name, '
            . 'vehicles.registration_number AS vehicle_registration_number, '
            . 'vehicles.odometer_exempt AS vehicle_odometer_exempt, '
            . 'vehicles.current_odometer AS vehicle_current_odometer';
    }
}
