<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\TransportRepository;
use App\Repositories\UserRepository;
use App\Repositories\WannabeCompetencyRepository;
use App\Repositories\WannabeVehicleKdoRepository;
use App\Repositories\VehicleRepository;
use App\Repositories\WarehouseRepository;

class TransportService
{
    public function __construct(
        private readonly TransportRepository $jobs = new TransportRepository(),
        private readonly WarehouseRepository $warehouse = new WarehouseRepository(),
        private readonly VehicleRepository $vehicles = new VehicleRepository(),
        private readonly UserRepository $users = new UserRepository(),
        private readonly WannabeCompetencyRepository $competencies = new WannabeCompetencyRepository(),
        private readonly WannabeVehicleKdoRepository $vehicleKdo = new WannabeVehicleKdoRepository(),
        private readonly RoutingService $routing = new RoutingService(),
        private readonly AuditService $audit = new AuditService()
    ) {
    }

    public function active(): array
    {
        return $this->attachStopsSummary($this->refreshMissingEstimates($this->jobs->activeJobs()));
    }

    public function mine(int $requesterUserId): array
    {
        return $this->attachStopsSummary($this->refreshMissingEstimates($this->jobs->jobsForRequester($requesterUserId)));
    }

    public function completed(): array
    {
        return $this->attachStopsSummary($this->jobs->completedJobs());
    }

    public function completedMine(int $requesterUserId): array
    {
        return $this->attachStopsSummary($this->jobs->completedJobsForRequester($requesterUserId));
    }

    public function availableVehicles(): array
    {
        return $this->vehicles->availableForTransport();
    }

    public function eligibleAssigneesByJob(array $jobs, array $users): array
    {
        $eligible = [];
        foreach ($jobs as $job) {
            $eligible[(int) $job->id] = $this->eligibleAssigneesForJob($job, $users);
        }

        return $eligible;
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

        $job->stops = $this->jobs->stopsForJob($jobId);
        $job->stops_summary = $this->buildStopsSummary($job->stops);
        if ($job->estimated_distance_km === null) {
            $job = $this->refreshMissingEstimateForJob($job);
        }

        return $job;
    }

    public function createEquipmentJob(array $input, int $actorUserId): int
    {
        $rules = [
            'description' => 'required|max_length[5000]',
            'from_location_id' => 'required|integer|greater_than[0]',
            'to_location_id' => 'required|integer|greater_than[0]',
            'vehicle_id' => 'required|integer|greater_than[0]',
            'job_kind' => 'required|in_list[equipment,innkjopsrunde,henterunde]',
            'requester_user_id' => 'permit_empty|integer|greater_than[0]',
            'requester_wannabe_id' => 'permit_empty|integer|greater_than[0]',
        ];
        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException('Ugyldig transportoppdrag.');
        }

        $jobKind = (string) $input['job_kind'];
        $fromId = (int) $input['from_location_id'];
        $toId = (int) $input['to_location_id'];
        if ($fromId === $toId && ! in_array($jobKind, ['innkjopsrunde', 'henterunde'], true)) {
            throw new \InvalidArgumentException('Start og slutt kan ikke vaere samme lokasjon.');
        }

        $fromLocation = $this->warehouse->findLocationById($fromId);
        $toLocation = $this->warehouse->findLocationById($toId);
        if ($fromLocation === null || $toLocation === null) {
            throw new \InvalidArgumentException('Valgt lokasjon finnes ikke.');
        }
        $this->validateLocationsForJobKind($jobKind, $fromLocation, $toLocation);

        $vehicleId = (int) $input['vehicle_id'];
        $vehicle = $this->vehicles->findById($vehicleId);
        if ($vehicle === null) {
            throw new \InvalidArgumentException('Valgt kjoeretoey finnes ikke.');
        }
        if (! in_array((string) $vehicle->status, ['available', 'loaned'], true)) {
            throw new \InvalidArgumentException('Valgt kjoeretoey kan ikke knyttes til nytt transportoppdrag akkurat naa.');
        }

        [$requesterUserId, $requesterWannabeId] = $this->resolveTransportRequester($input);
        $stops = $this->normalizeStops($jobKind, $input['stops'] ?? []);
        [$fromLocation, $toLocation, $stops, $estimatedDistanceKm] = $this->prepareRouteEstimate($fromLocation, $toLocation, $stops);
        $description = mb_substr(strip_tags((string) $input['description']), 0, 5000);

        $id = $this->jobs->create([
            'description' => $description,
            'from_location_id' => $fromId,
            'to_location_id' => $toId,
            'transport_type' => 'equipment',
            'job_kind' => $jobKind,
            'people_count' => null,
            'pickup_at' => null,
            'equipment_id' => null,
            'requester_user_id' => $requesterUserId,
            'requester_wannabe_id' => $requesterWannabeId,
            'assigned_user_id' => null,
            'assigned_vehicle_id' => $vehicleId,
            'start_odometer' => null,
            'end_odometer' => null,
            'distance_km' => null,
            'estimated_distance_km' => $estimatedDistanceKm,
            'distance_deviation_km' => null,
            'status' => 'open',
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        $this->jobs->createStops($id, $stops);
        $this->vehicles->updateById($vehicleId, [
            'status' => 'reserved_transport',
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        $this->audit->log($actorUserId, 'create', 'transport_job', $id, [
            'job_kind' => $jobKind,
            'vehicle_id' => $vehicleId,
            'requester_user_id' => $requesterUserId,
            'requester_wannabe_id' => $requesterWannabeId,
            'description' => $description,
            'stops' => $stops,
            'estimated_distance_km' => $estimatedDistanceKm,
        ]);

        return $id;
    }

    public function requestPeopleTransport(array $input, int $requesterUserId): int
    {
        $rules = [
            'from_location_id' => 'required|integer',
            'to_location_id' => 'required|integer',
            'people_count' => 'required|integer|greater_than[0]|less_than_equal_to[500]',
            'pickup_at' => 'required',
            'description' => 'permit_empty|max_length[5000]',
        ];
        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException('Ugyldig transportforespoersel.');
        }

        $fromId = (int) $input['from_location_id'];
        $toId = (int) $input['to_location_id'];
        if ($fromId === $toId) {
            throw new \InvalidArgumentException('Fra- og til-lokasjon kan ikke vaere samme.');
        }
        $fromLocation = $this->warehouse->findLocationById($fromId);
        $toLocation = $this->warehouse->findLocationById($toId);
        if ($fromLocation === null || $toLocation === null) {
            throw new \InvalidArgumentException('Valgt lokasjon finnes ikke.');
        }
        if (mb_strtolower((string) $fromLocation->type) !== 'transport' || mb_strtolower((string) $toLocation->type) !== 'transport') {
            throw new \InvalidArgumentException('Persontransport maa bruke lokasjoner av type Transport.');
        }
        $pickupAtRaw = trim((string) ($input['pickup_at'] ?? ''));
        $pickupAt = \DateTime::createFromFormat('Y-m-d\TH:i', $pickupAtRaw);
        if ($pickupAt === false) {
            throw new \InvalidArgumentException('Ugyldig hentetid.');
        }

        $id = $this->jobs->create([
            'description' => ! empty($input['description']) ? mb_substr(strip_tags((string) $input['description']), 0, 5000) : 'Persontransport',
            'from_location_id' => $fromId,
            'to_location_id' => $toId,
            'transport_type' => 'people',
            'job_kind' => 'people',
            'people_count' => (int) $input['people_count'],
            'pickup_at' => $pickupAt->format('Y-m-d H:i:s'),
            'equipment_id' => null,
            'requester_user_id' => $requesterUserId,
            'requester_wannabe_id' => null,
            'assigned_user_id' => null,
            'assigned_vehicle_id' => null,
            'start_odometer' => null,
            'end_odometer' => null,
            'distance_km' => null,
            'estimated_distance_km' => null,
            'distance_deviation_km' => null,
            'status' => 'open',
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
        $this->audit->log($requesterUserId, 'create', 'transport_request_people', $id, $input);

        return $id;
    }

    public function assign(int $jobId, int $userId, int $actorUserId): void
    {
        $job = $this->jobs->findByIdWithContext($jobId);
        if ($job === null) {
            throw new \InvalidArgumentException('Oppdrag finnes ikke.');
        }
        $user = $this->users->findById($userId);
        if ($user === null) {
            throw new \InvalidArgumentException('Bruker finnes ikke.');
        }
        if (! $this->userCanHandleJob($job, $user)) {
            throw new \InvalidArgumentException('Valgt person mangler nødvendig førerkort eller kompetanse for oppdraget.');
        }

        $this->jobs->updateById($jobId, [
            'assigned_user_id' => $userId,
            'status' => 'assigned',
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
        $this->audit->log($actorUserId, 'assign', 'transport_job', $jobId, ['assigned_user_id' => $userId]);
    }

    public function updateStatus(int $jobId, array $input, int $actorUserId): void
    {
        $job = $this->jobs->findByIdWithContext($jobId);
        if ($job === null) {
            throw new \InvalidArgumentException('Oppdrag finnes ikke.');
        }

        $status = mb_substr(strip_tags(trim((string) ($input['status'] ?? ''))), 0, 20);
        if ($status === 'in_progress') {
            $this->startJob($job, $input, $actorUserId);
            return;
        }

        if ($status === 'completed') {
            $this->completeJob($job, $input, $actorUserId);
            return;
        }

        $this->jobs->updateById($jobId, [
            'status' => $status,
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
        $this->audit->log($actorUserId, 'status', 'transport_job', $jobId, ['status' => $status]);
    }

    public function findById(int $jobId): ?object
    {
        return $this->jobs->findById($jobId);
    }

    private function startJob(object $job, array $input, int $actorUserId): void
    {
        if ((string) $job->status !== 'assigned') {
            throw new \InvalidArgumentException('Oppdraget kan ikke startes fra naavaerende status.');
        }

        $rules = [];
        if (empty($job->assigned_vehicle_id)) {
            $rules['vehicle_id'] = 'required|integer|greater_than[0]';
        }

        $vehicleId = ! empty($job->assigned_vehicle_id)
            ? (int) $job->assigned_vehicle_id
            : (int) ($input['vehicle_id'] ?? 0);

        $vehicle = $this->vehicles->findById($vehicleId);
        if ($vehicle === null) {
            throw new \InvalidArgumentException('Valgt kjoeretoey finnes ikke.');
        }
        $allowedStatuses = ! empty($job->assigned_vehicle_id)
            ? ['available', 'reserved_transport']
            : ['available'];
        if (! in_array((string) $vehicle->status, $allowedStatuses, true)) {
            throw new \InvalidArgumentException('Valgt kjoeretoey er ikke tilgjengelig.');
        }
        $isOdometerExempt = (int) ($vehicle->odometer_exempt ?? 0) === 1;
        if (! $isOdometerExempt) {
            $rules['start_odometer'] = 'required|integer|greater_than_equal_to[0]';
        }
        if ($rules !== [] && ! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException(empty($job->assigned_vehicle_id)
                ? ($isOdometerExempt ? 'Velg kjoeretoey.' : 'Velg kjoeretoey og fyll inn naavaerende kilometerstand.')
                : 'Fyll inn naavaerende kilometerstand.');
        }

        $startOdometerInput = $input['start_odometer'] ?? null;
        $startOdometer = $isOdometerExempt
            ? null
            : max(0, (int) (($startOdometerInput === null || $startOdometerInput === '') ? ($vehicle->current_odometer ?? 0) : $startOdometerInput));
        if (! $isOdometerExempt && $startOdometer < max(0, (int) ($vehicle->current_odometer ?? 0))) {
            throw new \InvalidArgumentException('Start kilometerstand kan ikke vaere lavere enn kjoeretoeyets registrerte kilometerstand.');
        }

        $jobUpdate = [
            'assigned_vehicle_id' => $vehicleId,
            'start_odometer' => $isOdometerExempt ? null : $startOdometer,
            'end_odometer' => null,
            'distance_km' => null,
            'distance_deviation_km' => null,
            'status' => 'in_progress',
            'updated_at' => date('Y-m-d H:i:s'),
        ];
        $vehicleUpdate = [
            'status' => 'in_transport',
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        if (! $isOdometerExempt) {
            $vehicleUpdate['current_odometer'] = $startOdometer;
        }

        $this->jobs->updateById((int) $job->id, $jobUpdate);
        $this->vehicles->updateById($vehicleId, $vehicleUpdate);
        $this->audit->log($actorUserId, 'status', 'transport_job', (int) $job->id, [
            'status' => 'in_progress',
            'vehicle_id' => $vehicleId,
            'start_odometer' => $isOdometerExempt ? null : $startOdometer,
        ]);
    }

    private function completeJob(object $job, array $input, int $actorUserId): void
    {
        if ((string) $job->status !== 'in_progress') {
            throw new \InvalidArgumentException('Oppdraget kan ikke fullfoeres fra naavaerende status.');
        }
        if (empty($job->assigned_vehicle_id)) {
            throw new \InvalidArgumentException('Oppdraget maa ha kjoeretoey foer det kan fullfoeres.');
        }

        $vehicle = $this->vehicles->findById((int) $job->assigned_vehicle_id);
        if ($vehicle === null) {
            throw new \InvalidArgumentException('Valgt kjoeretoey finnes ikke.');
        }
        $isOdometerExempt = (int) ($vehicle->odometer_exempt ?? 0) === 1;

        $rules = $isOdometerExempt ? [] : ['end_odometer' => 'required|integer|greater_than_equal_to[0]'];
        if ($rules !== [] && ! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException($isOdometerExempt
                ? 'Oppdraget kunne ikke fullfoeres.'
                : 'Fyll inn kilometerstand ved parkering.');
        }

        $endOdometer = $isOdometerExempt ? null : max(0, (int) $input['end_odometer']);
        $startOdometer = $isOdometerExempt ? null : max(0, (int) $job->start_odometer);
        if (! $isOdometerExempt && $endOdometer < $startOdometer) {
            throw new \InvalidArgumentException('Kilometerstand ved parkering kan ikke vaere lavere enn kilometerstand ved start.');
        }

        $distanceKm = $isOdometerExempt ? null : ($endOdometer - $startOdometer);
        $deviationKm = null;
        if (! $isOdometerExempt && $distanceKm !== null && $job->estimated_distance_km !== null) {
            $deviationKm = $distanceKm - (int) $job->estimated_distance_km;
        }

        $jobUpdate = [
            'end_odometer' => $endOdometer,
            'distance_km' => $distanceKm,
            'distance_deviation_km' => $deviationKm,
            'status' => 'completed',
            'updated_at' => date('Y-m-d H:i:s'),
        ];
        $vehicleStatusAfterCompletion = $this->vehicles->hasActiveLoan((int) $job->assigned_vehicle_id)
            ? 'loaned'
            : 'available';
        $vehicleUpdate = [
            'status' => $vehicleStatusAfterCompletion,
            'updated_at' => date('Y-m-d H:i:s'),
        ];
        if (! $isOdometerExempt) {
            $vehicleUpdate['current_odometer'] = $endOdometer;
        }

        $this->jobs->updateById((int) $job->id, $jobUpdate);
        $this->vehicles->updateById((int) $job->assigned_vehicle_id, $vehicleUpdate);
        $this->audit->log($actorUserId, 'status', 'transport_job', (int) $job->id, [
            'status' => 'completed',
            'end_odometer' => $endOdometer,
            'distance_km' => $distanceKm,
            'distance_deviation_km' => $deviationKm,
        ]);
    }

    private function resolveTransportRequester(array $input): array
    {
        $requesterUserId = ! empty($input['requester_user_id']) ? (int) $input['requester_user_id'] : null;
        $requesterWannabeId = ! empty($input['requester_wannabe_id']) ? (int) $input['requester_wannabe_id'] : null;

        if (($requesterUserId ?? 0) <= 0 && ($requesterWannabeId ?? 0) <= 0) {
            throw new \InvalidArgumentException('Velg registrert bruker eller skriv inn en wannabe id.');
        }

        if (($requesterUserId ?? 0) > 0) {
            $user = $this->users->findById($requesterUserId);
            if ($user === null) {
                throw new \InvalidArgumentException('Valgt bruker finnes ikke.');
            }
            if (! empty($user->wannabe_id)) {
                $requesterWannabeId = (int) $user->wannabe_id;
            }
        }

        if (($requesterUserId ?? 0) <= 0 && ($requesterWannabeId ?? 0) > 0) {
            $user = $this->users->findByWannabeId((int) $requesterWannabeId);
            if ($user !== null) {
                $requesterUserId = (int) $user->id;
                if (! empty($user->wannabe_id)) {
                    $requesterWannabeId = (int) $user->wannabe_id;
                }
            }
        }

        return [
            ($requesterUserId ?? 0) > 0 ? (int) $requesterUserId : null,
            ($requesterWannabeId ?? 0) > 0 ? (int) $requesterWannabeId : null,
        ];
    }

    private function validateLocationsForJobKind(string $jobKind, object $fromLocation, object $toLocation): void
    {
        $fromType = mb_strtolower((string) ($fromLocation->type ?? ''));
        $toType = mb_strtolower((string) ($toLocation->type ?? ''));

        if ($jobKind === 'equipment' && ($fromType === 'transport' || $toType === 'transport')) {
            throw new \InvalidArgumentException('Utstyrstransport kan ikke bruke lokasjoner av type Transport.');
        }

        if ($jobKind === 'innkjopsrunde' || $jobKind === 'henterunde') {
            $allowed = ['transport', 'lager'];
            if (! in_array($fromType, $allowed, true) || ! in_array($toType, $allowed, true)) {
                throw new \InvalidArgumentException('Innkjopsrunde og henterunde maa bruke start/slutt-lokasjoner av type Transport eller Lager.');
            }
        }
    }

    private function normalizeStops(string $jobKind, mixed $rawStops): array
    {
        if (! in_array($jobKind, ['innkjopsrunde', 'henterunde'], true)) {
            return [];
        }

        $stops = [];
        foreach ((array) $rawStops as $stop) {
            $address = mb_substr(strip_tags(trim((string) ($stop['address'] ?? ''))), 0, 255);
            $notes = mb_substr(strip_tags(trim((string) ($stop['notes'] ?? ''))), 0, 4000);
            if ($address === '') {
                continue;
            }

            $stops[] = [
                'address' => $address,
                'notes' => $notes,
                'latitude' => null,
                'longitude' => null,
            ];
        }

        if ($stops === []) {
            throw new \InvalidArgumentException('Legg inn minst ett stopp med adresse for innkjopsrunde eller henterunde.');
        }

        return $stops;
    }

    private function attachStopsSummary(array $jobs): array
    {
        if ($jobs === []) {
            return $jobs;
        }

        $stopMap = $this->jobs->stopsByJobIds(array_map(static fn ($job): int => (int) $job->id, $jobs));
        foreach ($jobs as $job) {
            $job->stops = $stopMap[(int) $job->id] ?? [];
            $job->stops_summary = $this->buildStopsSummary($job->stops);
        }

        return $jobs;
    }

    private function refreshMissingEstimates(array $jobs): array
    {
        foreach ($jobs as $index => $job) {
            if ($job->estimated_distance_km !== null) {
                continue;
            }

            $jobs[$index] = $this->refreshMissingEstimateForJob($job);
        }

        return $jobs;
    }

    private function refreshMissingEstimateForJob(object $job): object
    {
        $jobKind = (string) ($job->job_kind ?? $job->transport_type ?? '');
        if (! in_array($jobKind, ['equipment', 'innkjopsrunde', 'henterunde'], true)) {
            return $job;
        }

        $fullJob = $this->jobs->findByIdWithContext((int) $job->id);
        if ($fullJob === null) {
            return $job;
        }

        $fromLocation = $this->warehouse->findLocationById((int) $fullJob->from_location_id);
        $toLocation = $this->warehouse->findLocationById((int) $fullJob->to_location_id);
        if ($fromLocation === null || $toLocation === null) {
            return $job;
        }

        $stopRows = $this->jobs->stopsForJob((int) $fullJob->id);
        $stops = [];
        foreach ($stopRows as $stopRow) {
            $stops[] = [
                'address' => (string) ($stopRow->address ?? ''),
                'notes' => (string) ($stopRow->notes ?? ''),
                'latitude' => $stopRow->latitude !== null ? (float) $stopRow->latitude : null,
                'longitude' => $stopRow->longitude !== null ? (float) $stopRow->longitude : null,
            ];
        }

        [, , $updatedStops, $estimatedDistanceKm] = $this->prepareRouteEstimate($fromLocation, $toLocation, $stops);
        if ($estimatedDistanceKm === null) {
            return $job;
        }

        $this->jobs->updateById((int) $fullJob->id, [
            'estimated_distance_km' => $estimatedDistanceKm,
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        foreach ($updatedStops as $index => $updatedStop) {
            if (($updatedStop['latitude'] ?? null) === null || ($updatedStop['longitude'] ?? null) === null) {
                continue;
            }

            $this->jobs->updateStopCoordinates(
                (int) $fullJob->id,
                $index + 1,
                (float) $updatedStop['latitude'],
                (float) $updatedStop['longitude']
            );
        }

        $job->estimated_distance_km = $estimatedDistanceKm;

        return $job;
    }

    private function eligibleAssigneesForJob(object $job, array $users): array
    {
        return array_values(array_filter($users, fn ($user): bool => $this->userCanHandleJob($job, $user)));
    }

    private function userCanHandleJob(object $job, object $user): bool
    {
        $vehicleId = (int) ($job->assigned_vehicle_id ?? 0);
        if ($vehicleId <= 0) {
            return true;
        }

        $vehicle = $this->vehicles->findById($vehicleId);
        if ($vehicle === null) {
            return false;
        }

        $requirement = strtolower(trim((string) ($vehicle->competency_requirement ?? 'none')));
        if ($requirement === '' || $requirement === 'none') {
            return true;
        }

        $wannabeId = (int) ($user->wannabe_id ?? 0);
        if ($wannabeId <= 0) {
            return false;
        }

        if ($requirement === 'kdo') {
            $override = strtolower(trim((string) ($vehicle->competency_override_requirement ?? '')));
            if ($override !== '' && $this->userHasCompetency($wannabeId, $override)) {
                return true;
            }

            return $this->vehicleKdo->hasRecord($wannabeId, $vehicleId);
        }

        return $this->userHasCompetency($wannabeId, $requirement);
    }

    private function userHasCompetency(int $wannabeId, string $competency): bool
    {
        $profile = $this->competencies->findByWannabeId($wannabeId);
        if ($profile === null) {
            return false;
        }

        return ! empty($profile[strtolower($competency)]);
    }

    private function buildStopsSummary(array $stops): string
    {
        if ($stops === []) {
            return '';
        }

        $parts = [];
        foreach ($stops as $stop) {
            $parts[] = 'Stopp ' . (string) ($stop->stop_number ?? '?') . ': ' . (string) ($stop->address ?? '');
        }

        return implode(' | ', $parts);
    }

    private function prepareRouteEstimate(object $fromLocation, object $toLocation, array $stops): array
    {
        $routePoints = [];

        $fromPoint = $this->resolveLocationPoint($fromLocation);
        $toPoint = $this->resolveLocationPoint($toLocation);
        if ($fromPoint !== null) {
            $routePoints[] = $fromPoint;
        }

        foreach ($stops as $index => $stop) {
            $point = $this->routing->geocode((string) $stop['address']);
            if ($point === null) {
                continue;
            }
            $stops[$index]['latitude'] = $point['lat'];
            $stops[$index]['longitude'] = $point['lon'];
            $routePoints[] = $point;
        }

        if ($toPoint !== null) {
            $routePoints[] = $toPoint;
        }

        $estimatedDistanceKm = count($routePoints) >= 2 ? $this->routing->routeDistanceKm($routePoints) : null;

        return [$fromLocation, $toLocation, $stops, $estimatedDistanceKm];
    }

    private function resolveLocationPoint(object $location): ?array
    {
        if ($location->latitude !== null && $location->longitude !== null) {
            return [
                'lat' => (float) $location->latitude,
                'lon' => (float) $location->longitude,
            ];
        }

        $address = trim((string) ($location->address ?? ''));
        if ($address === '') {
            return null;
        }

        $point = $this->routing->geocode($address);
        if ($point === null) {
            return null;
        }

        $this->warehouse->updateLocationById((int) $location->id, [
            'latitude' => $point['lat'],
            'longitude' => $point['lon'],
        ]);
        $location->latitude = $point['lat'];
        $location->longitude = $point['lon'];

        return $point;
    }
}
