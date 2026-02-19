<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\EquipmentRepository;
use App\Repositories\TransportRepository;
use App\Repositories\WarehouseRepository;

class TransportService
{
    public function __construct(
        private readonly TransportRepository $jobs = new TransportRepository(),
        private readonly WarehouseRepository $warehouse = new WarehouseRepository(),
        private readonly EquipmentRepository $equipment = new EquipmentRepository(),
        private readonly AuditService $audit = new AuditService()
    ) {
    }

    public function active(): array
    {
        return $this->jobs->activeJobs();
    }

    public function mine(int $requesterUserId): array
    {
        return $this->jobs->jobsForRequester($requesterUserId);
    }

    public function inspect(int $jobId, bool $isLogistics, int $requesterUserId): object
    {
        $job = $this->jobs->findByIdWithContext($jobId);
        if ($job === null) {
            throw new \InvalidArgumentException('Oppdrag finnes ikke.');
        }

        if (! $isLogistics && (int) ($job->requester_user_id ?? 0) !== $requesterUserId) {
            throw new \RuntimeException('Ingen tilgang til oppdraget.');
        }

        return $job;
    }

    public function createEquipmentJob(array $input, int $actorUserId): int
    {
        $rules = [
            'description'      => 'required|max_length[5000]',
            'from_location_id' => 'required|integer',
            'to_location_id'   => 'required|integer',
            'equipment_id'     => 'permit_empty|integer',
        ];
        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException('Ugyldig transportoppdrag.');
        }
        $fromId = (int) $input['from_location_id'];
        $toId = (int) $input['to_location_id'];
        if ($fromId === $toId) {
            throw new \InvalidArgumentException('Fra- og til-lokasjon kan ikke være samme.');
        }
        $fromLocation = $this->warehouse->findLocationById($fromId);
        $toLocation = $this->warehouse->findLocationById($toId);
        if ($fromLocation === null || $toLocation === null) {
            throw new \InvalidArgumentException('Valgt lokasjon finnes ikke.');
        }
        if (mb_strtolower((string) $fromLocation->type) === 'transport' || mb_strtolower((string) $toLocation->type) === 'transport') {
            throw new \InvalidArgumentException('Utstyrstransport kan ikke bruke lokasjoner av type Transport.');
        }
        $equipmentId = ! empty($input['equipment_id']) ? (int) $input['equipment_id'] : null;
        if ($equipmentId !== null && $equipmentId > 0 && ! $this->equipment->belongsToLocation($equipmentId, $fromId)) {
            throw new \InvalidArgumentException('Valgt utstyr finnes ikke på valgt fra-lokasjon.');
        }

        $id = $this->jobs->create([
            'description'      => mb_substr(strip_tags((string) $input['description']), 0, 5000),
            'from_location_id' => $fromId,
            'to_location_id'   => $toId,
            'transport_type'   => 'equipment',
            'people_count'     => null,
            'pickup_at'        => null,
            'equipment_id'     => $equipmentId,
            'requester_user_id'=> $actorUserId,
            'assigned_user_id' => null,
            'status'           => 'open',
            'created_at'       => date('Y-m-d H:i:s'),
            'updated_at'       => date('Y-m-d H:i:s'),
        ]);
        $this->audit->log($actorUserId, 'create', 'transport_job', $id, $input);

        return $id;
    }

    public function requestPeopleTransport(array $input, int $requesterUserId): int
    {
        $rules = [
            'from_location_id' => 'required|integer',
            'to_location_id'   => 'required|integer',
            'people_count'     => 'required|integer|greater_than[0]|less_than_equal_to[500]',
            'pickup_at'        => 'required',
            'description'      => 'permit_empty|max_length[5000]',
        ];
        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException('Ugyldig transportforespørsel.');
        }

        $fromId = (int) $input['from_location_id'];
        $toId = (int) $input['to_location_id'];
        if ($fromId === $toId) {
            throw new \InvalidArgumentException('Fra- og til-lokasjon kan ikke være samme.');
        }
        $fromLocation = $this->warehouse->findLocationById($fromId);
        $toLocation = $this->warehouse->findLocationById($toId);
        if ($fromLocation === null || $toLocation === null) {
            throw new \InvalidArgumentException('Valgt lokasjon finnes ikke.');
        }
        if (mb_strtolower((string) $fromLocation->type) !== 'transport' || mb_strtolower((string) $toLocation->type) !== 'transport') {
            throw new \InvalidArgumentException('Persontransport må bruke lokasjoner av type Transport.');
        }
        $pickupAtRaw = trim((string) ($input['pickup_at'] ?? ''));
        $pickupAt = \DateTime::createFromFormat('Y-m-d\TH:i', $pickupAtRaw);
        if ($pickupAt === false) {
            throw new \InvalidArgumentException('Ugyldig hentetid.');
        }

        $id = $this->jobs->create([
            'description'       => ! empty($input['description']) ? mb_substr(strip_tags((string) $input['description']), 0, 5000) : 'Persontransport',
            'from_location_id'  => $fromId,
            'to_location_id'    => $toId,
            'transport_type'    => 'people',
            'people_count'      => (int) $input['people_count'],
            'pickup_at'         => $pickupAt->format('Y-m-d H:i:s'),
            'equipment_id'      => null,
            'requester_user_id' => $requesterUserId,
            'assigned_user_id'  => null,
            'status'            => 'open',
            'created_at'        => date('Y-m-d H:i:s'),
            'updated_at'        => date('Y-m-d H:i:s'),
        ]);
        $this->audit->log($requesterUserId, 'create', 'transport_request_people', $id, $input);

        return $id;
    }

    public function assign(int $jobId, int $userId, int $actorUserId): void
    {
        $this->jobs->updateById($jobId, [
            'assigned_user_id' => $userId,
            'status'           => 'assigned',
            'updated_at'       => date('Y-m-d H:i:s'),
        ]);
        $this->audit->log($actorUserId, 'assign', 'transport_job', $jobId, ['assigned_user_id' => $userId]);
    }

    public function updateStatus(int $jobId, string $status, int $actorUserId): void
    {
        $status = mb_substr(strip_tags(trim($status)), 0, 20);
        $this->jobs->updateById($jobId, [
            'status'     => $status,
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
        $this->audit->log($actorUserId, 'status', 'transport_job', $jobId, ['status' => $status]);
    }

    public function findById(int $jobId): ?object
    {
        return $this->jobs->findById($jobId);
    }
}
