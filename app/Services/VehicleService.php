<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\WannabeCompetencyRepository;
use App\Repositories\WannabeVehicleKdoRepository;
use App\Repositories\VehicleLoanRepository;
use App\Repositories\VehicleRepository;

class VehicleService
{
    private const COMPETENCY_FIELDS = ['t1', 't2', 't3', 't4', 'b', 'be', 'c1', 'c1e', 'c', 'ce'];
    private const REQUIREMENT_LABELS = [
        'none' => 'Ingen krav',
        'kdo' => 'KDO',
        't1' => 'T1',
        't2' => 'T2',
        't3' => 'T3',
        't4' => 'T4',
        'b' => 'B',
        'be' => 'BE',
        'c1' => 'C1',
        'c1e' => 'C1E',
        'c' => 'C',
        'ce' => 'CE',
    ];

    public function __construct(
        private readonly VehicleRepository $vehicles = new VehicleRepository(),
        private readonly VehicleLoanRepository $loans = new VehicleLoanRepository(),
        private readonly WannabeCompetencyRepository $competencies = new WannabeCompetencyRepository(),
        private readonly WannabeVehicleKdoRepository $vehicleKdo = new WannabeVehicleKdoRepository(),
        private readonly CrewDirectoryService $crewDirectory = new CrewDirectoryService(),
        private readonly AuditService $audit = new AuditService(),
        private readonly VegvesenVehicleDataService $vegvesen = new VegvesenVehicleDataService()
    ) {
    }

    public function list(): array
    {
        $vehicles = $this->vehicles->allWithActiveLoanContext();

        foreach ($vehicles as $vehicle) {
            $this->syncVegvesenPayload($vehicle);
        }

        return $this->enrichVehicleLoanNames($vehicles);
    }

    public function activeLoans(?string $search = null): array
    {
        return $this->loans->activeLoans($search);
    }

    public function competencyRequirementOptions(): array
    {
        return self::REQUIREMENT_LABELS;
    }

    public function competencyOverrideOptions(): array
    {
        return [
            '' => 'Ingen overstyring',
            't1' => 'T1',
            't2' => 'T2',
            't3' => 'T3',
            't4' => 'T4',
            'b' => 'B',
            'be' => 'BE',
            'c1' => 'C1',
            'c1e' => 'C1E',
            'c' => 'C',
            'ce' => 'CE',
        ];
    }

    public function competencyOptions(): array
    {
        return [
            'kompetansebevis' => [
                't1' => 'T1',
                't2' => 'T2',
                't3' => 'T3',
                't4' => 'T4',
            ],
            'forerkort' => [
                'b' => 'B',
                'be' => 'BE',
                'c1' => 'C1',
                'c1e' => 'C1E',
                'c' => 'C',
                'ce' => 'CE',
            ],
            'opplaering' => [
                'kdo' => 'KDO',
            ],
        ];
    }

    public function competencyProfile(int $wannabeId, ?int $vehicleId = null): array
    {
        $profile = $this->competencies->findByWannabeId($wannabeId) ?? [];

        return [
            'wannabe_id' => $wannabeId,
            'competencies' => $this->extractCompetencies($profile),
            'kdo_for_vehicle' => $vehicleId !== null ? $this->vehicleKdo->hasRecord($wannabeId, $vehicleId) : false,
        ];
    }

    public function create(array $input, int $actorUserId): int
    {
        $data = $this->validateCreate($input);
        $id = $this->vehicles->create([
            ...$data,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
        $createdVehicle = $this->vehicles->findById($id);
        if ($createdVehicle !== null) {
            $this->syncVegvesenPayload($createdVehicle, true);
        }
        $this->audit->log($actorUserId, 'create', 'vehicle', $id, $data);

        return $id;
    }

    public function update(int $vehicleId, array $input, int $actorUserId): void
    {
        $vehicle = $this->vehicles->findById($vehicleId);
        if ($vehicle === null) {
            throw new \InvalidArgumentException('Kjøretøy finnes ikke.');
        }

        $data = $this->validateUpdate($input, $vehicle);
        $this->vehicles->updateById($vehicleId, [
            ...$data,
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
        $updatedVehicle = $this->vehicles->findById($vehicleId);
        if ($updatedVehicle !== null) {
            $this->syncVegvesenPayload($updatedVehicle, true);
        }
        $this->audit->log($actorUserId, 'update', 'vehicle', $vehicleId, $data);
    }

    public function issue(array $input, int $actorUserId): int
    {
        $rules = [
            'vehicle_id' => 'required|integer|greater_than[0]',
            'wannabe_id' => 'required|integer|greater_than[0]',
        ];
        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException('Ugyldig kjøretøylån.');
        }

        $vehicleId = (int) $input['vehicle_id'];
        $vehicle = $this->vehicles->findById($vehicleId);
        if ($vehicle === null) {
            throw new \InvalidArgumentException('Kjøretøy finnes ikke.');
        }
        if ((string) $vehicle->status !== 'available' || $this->loans->findActiveByVehicleId($vehicleId) !== null) {
            throw new \InvalidArgumentException('Kjøretøyet er allerede utlånt eller utilgjengelig.');
        }

        $wannabeId = (int) $input['wannabe_id'];
        $requirement = $this->normalizeRequirement((string) ($vehicle->competency_requirement ?? 'none'));
        if ($requirement !== 'none') {
            $overrideRequirement = $this->normalizeOverrideRequirement((string) ($vehicle->competency_override_requirement ?? ''));
            if ($requirement === 'kdo') {
                $storedProfile = $this->competencies->findByWannabeId($wannabeId) ?? [];
                $storedCompetencies = $this->extractCompetencies($storedProfile);

                if ($overrideRequirement !== '' && $this->hasRequirement($storedCompetencies, $overrideRequirement)) {
                    // Alternativ kompetanse overstyrer KDO for dette kjøretøyet.
                } elseif (! $this->vehicleKdo->hasRecord($wannabeId, $vehicleId)) {
                    if ((int) ($input['competency_confirmed'] ?? 0) !== 1 || ! in_array('kdo', (array) ($input['competencies'] ?? []), true)) {
                        throw new \InvalidArgumentException('Dokumentert opplæring må bekreftes før utlån.');
                    }

                    $this->vehicleKdo->createIfMissing($wannabeId, $vehicleId);
                }
            } else {
                $storedProfile = $this->competencies->findByWannabeId($wannabeId) ?? [];
                $storedCompetencies = $this->extractCompetencies($storedProfile);

                if (! $this->hasRequirement($storedCompetencies, $requirement)) {
                    $submittedCompetencies = $this->extractCompetencies(['competencies' => $input['competencies'] ?? []]);
                    if ((int) ($input['competency_confirmed'] ?? 0) !== 1) {
                        throw new \InvalidArgumentException('Førerkort eller kompetansebevis må bekreftes før utlån.');
                    }
                    if (! $this->hasRequirement($submittedCompetencies, $requirement)) {
                        throw new \InvalidArgumentException('Det påkrevde sertifikatet eller beviset er ikke bekreftet.');
                    }

                    $this->competencies->saveProfile($wannabeId, $this->mergeCompetencies($storedCompetencies, $submittedCompetencies));
                }
            }
        }

        $loanId = $this->loans->create([
            'vehicle_id' => $vehicleId,
            'wannabe_id' => $wannabeId,
            'issued_by_user_id' => $actorUserId,
            'issued_at' => date('Y-m-d H:i:s'),
            'returned_at' => null,
            'status' => 'active',
        ]);

        $this->vehicles->updateById($vehicleId, [
            'status' => 'loaned',
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
        $this->audit->log($actorUserId, 'issue', 'vehicle_loan', $loanId, [
            'vehicle_id' => $vehicleId,
            'wannabe_id' => $wannabeId,
        ]);

        return $loanId;
    }

    public function returnLoan(int $loanId, int $actorUserId): void
    {
        $loan = $this->loans->findById($loanId);
        if ($loan === null || (string) $loan->status !== 'active') {
            throw new \InvalidArgumentException('Aktivt kjøretøylån ble ikke funnet.');
        }

        $this->loans->updateById($loanId, [
            'status' => 'returned',
            'returned_at' => date('Y-m-d H:i:s'),
        ]);

        $this->vehicles->updateById((int) $loan->vehicle_id, [
            'status' => 'available',
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        $this->audit->log($actorUserId, 'return', 'vehicle_loan', $loanId);
    }

    public function delete(int $vehicleId, int $actorUserId): void
    {
        $vehicle = $this->vehicles->findById($vehicleId);
        if ($vehicle === null) {
            throw new \InvalidArgumentException('Kjøretøy finnes ikke.');
        }
        if ($this->vehicles->hasActiveLoan($vehicleId)) {
            throw new \InvalidArgumentException('Kjøretøy kan ikke slettes mens det er utlånt.');
        }

        $this->vehicles->deleteById($vehicleId);
        $this->audit->log($actorUserId, 'delete', 'vehicle', $vehicleId, ['name' => (string) $vehicle->name]);
    }

    private function validateCreate(array $input): array
    {
        $rules = [
            'name' => 'required|min_length[2]|max_length[150]',
            'registration_number' => 'required|min_length[2]|max_length[20]',
            'competency_requirement' => 'required|in_list[none,kdo,t1,t2,t3,t4,b,be,c1,c1e,c,ce]',
            'competency_override_requirement' => 'permit_empty|in_list[t1,t2,t3,t4,b,be,c1,c1e,c,ce]',
            'odometer_mode' => 'required|in_list[tracked,exempt]',
            'current_odometer' => 'permit_empty|integer|greater_than_equal_to[0]',
            'notes' => 'permit_empty|max_length[4000]',
        ];

        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException(implode(' ', service('validation')->getErrors()));
        }

        $odometerMode = (string) $input['odometer_mode'];
        $currentOdometer = null;
        $odometerExempt = $odometerMode === 'exempt' ? 1 : 0;

        if ($odometerExempt === 0) {
            if (($input['current_odometer'] ?? '') === '') {
                throw new \InvalidArgumentException('Fyll inn kilometerstand eller velg unntatt.');
            }

            $currentOdometer = max(0, (int) $input['current_odometer']);
        }

        return [
            'name' => mb_substr(strip_tags(trim((string) $input['name'])), 0, 150),
            'registration_number' => mb_strtoupper(mb_substr(strip_tags(trim((string) $input['registration_number'])), 0, 20)),
            'competency_requirement' => $this->normalizeRequirement((string) ($input['competency_requirement'] ?? 'none')),
            'competency_override_requirement' => $this->normalizeOverrideForRequirement(
                $this->normalizeRequirement((string) ($input['competency_requirement'] ?? 'none')),
                (string) ($input['competency_override_requirement'] ?? '')
            ),
            'current_odometer' => $currentOdometer,
            'odometer_exempt' => $odometerExempt,
            'vegvesen_exempt' => ! empty($input['vegvesen_exempt']) ? 1 : 0,
            'max_payload_kg' => null,
            'vegvesen_last_sync_at' => null,
            'status' => 'available',
            'notes' => ! empty($input['notes']) ? mb_substr(strip_tags((string) $input['notes']), 0, 4000) : null,
        ];
    }

    private function validateUpdate(array $input, object $existingVehicle): array
    {
        $rules = [
            'name' => 'required|min_length[2]|max_length[150]',
            'registration_number' => 'required|min_length[2]|max_length[20]',
            'competency_requirement' => 'required|in_list[none,kdo,t1,t2,t3,t4,b,be,c1,c1e,c,ce]',
            'competency_override_requirement' => 'permit_empty|in_list[t1,t2,t3,t4,b,be,c1,c1e,c,ce]',
            'vegvesen_exempt' => 'permit_empty|in_list[1]',
        ];

        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException(implode(' ', service('validation')->getErrors()));
        }

        $requirement = $this->normalizeRequirement((string) ($input['competency_requirement'] ?? ($existingVehicle->competency_requirement ?? 'none')));

        return [
            'name' => mb_substr(strip_tags(trim((string) $input['name'])), 0, 150),
            'registration_number' => mb_strtoupper(mb_substr(strip_tags(trim((string) $input['registration_number'])), 0, 20)),
            'competency_requirement' => $requirement,
            'competency_override_requirement' => $this->normalizeOverrideForRequirement(
                $requirement,
                (string) ($input['competency_override_requirement'] ?? ($existingVehicle->competency_override_requirement ?? ''))
            ),
            'vegvesen_exempt' => ! empty($input['vegvesen_exempt']) ? 1 : 0,
            'current_odometer' => $existingVehicle->current_odometer,
            'odometer_exempt' => $existingVehicle->odometer_exempt,
            'max_payload_kg' => ! empty($input['vegvesen_exempt']) ? null : $existingVehicle->max_payload_kg,
            'vegvesen_last_sync_at' => ! empty($input['vegvesen_exempt']) ? null : $existingVehicle->vegvesen_last_sync_at,
            'status' => (string) $existingVehicle->status,
            'notes' => $existingVehicle->notes,
        ];
    }

    private function syncVegvesenPayload(object $vehicle, bool $force = false): void
    {
        if ((int) ($vehicle->vegvesen_exempt ?? 0) === 1) {
            if (($vehicle->max_payload_kg ?? null) !== null || ($vehicle->vegvesen_last_sync_at ?? null) !== null) {
                $this->vehicles->updateById((int) $vehicle->id, [
                    'max_payload_kg' => null,
                    'vegvesen_last_sync_at' => null,
                ]);
                $vehicle->max_payload_kg = null;
                $vehicle->vegvesen_last_sync_at = null;
            }

            return;
        }

        if (! $force && ($vehicle->max_payload_kg ?? null) !== null) {
            return;
        }

        if (! $this->vegvesen->isConfigured()) {
            return;
        }

        $result = $this->vegvesen->fetchMaxPayloadKg((string) ($vehicle->registration_number ?? ''));
        if (! $result['success']) {
            return;
        }

        $syncedAt = date('Y-m-d H:i:s');
        $this->vehicles->updateById((int) $vehicle->id, [
            'max_payload_kg' => $result['max_payload_kg'],
            'vegvesen_last_sync_at' => $syncedAt,
        ]);

        $vehicle->max_payload_kg = $result['max_payload_kg'];
        $vehicle->vegvesen_last_sync_at = $syncedAt;
    }

    private function normalizeRequirement(string $value): string
    {
        $value = strtolower(trim($value));

        return array_key_exists($value, self::REQUIREMENT_LABELS) ? $value : 'none';
    }

    private function normalizeOverrideRequirement(string $value): string
    {
        $value = strtolower(trim($value));

        return in_array($value, self::COMPETENCY_FIELDS, true) ? $value : '';
    }

    private function normalizeOverrideForRequirement(string $requirement, string $override): ?string
    {
        if ($requirement !== 'kdo') {
            return null;
        }

        $normalized = $this->normalizeOverrideRequirement($override);

        return $normalized !== '' ? $normalized : null;
    }

    private function extractCompetencies(array $profile): array
    {
        $selected = [];

        if (isset($profile['competencies']) && is_array($profile['competencies'])) {
            foreach ($profile['competencies'] as $code) {
                $code = strtolower(trim((string) $code));
                if (in_array($code, self::COMPETENCY_FIELDS, true)) {
                    $selected[$code] = 1;
                }
            }
        }

        foreach (self::COMPETENCY_FIELDS as $field) {
            if (! empty($profile[$field])) {
                $selected[$field] = 1;
            } elseif (! array_key_exists($field, $selected)) {
                $selected[$field] = 0;
            }
        }

        return $selected;
    }

    private function hasRequirement(array $competencies, string $requirement): bool
    {
        return ! empty($competencies[$requirement]);
    }

    private function mergeCompetencies(array $existing, array $submitted): array
    {
        $merged = $existing;
        foreach (self::COMPETENCY_FIELDS as $field) {
            $merged[$field] = ! empty($existing[$field]) || ! empty($submitted[$field]) ? 1 : 0;
        }

        return $merged;
    }

    private function enrichVehicleLoanNames(array $vehicles): array
    {
        if ($vehicles === [] || ! $this->crewDirectory->isConfigured()) {
            return $vehicles;
        }

        $cache = [];

        foreach ($vehicles as $vehicle) {
            if (empty($vehicle->active_loan_id)) {
                continue;
            }

            $existingName = trim((string) (($vehicle->wannabe_name ?? '') !== '' ? $vehicle->wannabe_name : (($vehicle->wannabe_first_name ?? '') . ' ' . ($vehicle->wannabe_last_name ?? ''))));
            $wannabeId = (int) ($vehicle->active_wannabe_id ?? 0);
            if ($existingName !== '' || $wannabeId < 1) {
                continue;
            }

            if (! array_key_exists($wannabeId, $cache)) {
                $profile = $this->crewDirectory->profileByWannabeId($wannabeId);
                $cache[$wannabeId] = is_array($profile) ? trim((string) ($profile['name'] ?? '')) : '';
            }

            if ($cache[$wannabeId] !== '') {
                $vehicle->wannabe_name = $cache[$wannabeId];
            }
        }

        return $vehicles;
    }
}
