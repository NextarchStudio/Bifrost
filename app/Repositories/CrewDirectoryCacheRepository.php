<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\CrewDirectoryCacheModel;

class CrewDirectoryCacheRepository
{
    public function __construct(
        private readonly CrewDirectoryCacheModel $cache = new CrewDirectoryCacheModel()
    ) {
    }

    public function findByWannabeId(int $wannabeId): ?array
    {
        if ($wannabeId < 1) {
            return null;
        }

        return $this->cache->where('wannabe_id', $wannabeId)->first();
    }

    public function findByScanNumber(string $scanNumber): ?array
    {
        $scanNumber = trim($scanNumber);
        if ($scanNumber === '') {
            return null;
        }

        return $this->cache->where('scan_number', $scanNumber)->first();
    }

    public function saveProfile(array $profile, ?string $scanNumber = null): ?array
    {
        $wannabeId = (int) ($profile['id'] ?? 0);
        if ($wannabeId < 1) {
            return null;
        }

        $scanNumber = $scanNumber !== null ? trim($scanNumber) : null;
        $existing = $this->findByWannabeId($wannabeId);
        if ($existing === null && $scanNumber !== null && $scanNumber !== '') {
            $existing = $this->findByScanNumber($scanNumber);
        }

        $data = [
            'wannabe_id' => $wannabeId,
            'scan_number' => $scanNumber !== '' ? $scanNumber : ($existing['scan_number'] ?? null),
            'name' => trim((string) ($profile['name'] ?? '')),
            'nickname' => trim((string) ($profile['nickname'] ?? $profile['nick'] ?? '')),
            'crew_name' => trim((string) ($profile['crew_name'] ?? $profile['crew'] ?? '')),
            'crew_role_title' => trim((string) (($profile['crew_role']['title'] ?? null) ?? ($profile['role'] ?? $profile['rolle'] ?? ''))),
            'crew_role_name' => trim((string) (($profile['crew_role']['name'] ?? null) ?? '')),
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        if ($existing !== null) {
            $this->cache->update((int) $existing['id'], $data);

            return $this->cache->find((int) $existing['id']);
        }

        $data['created_at'] = $data['updated_at'];
        $this->cache->insert($data);

        return $this->cache->find((int) $this->cache->getInsertID());
    }

    public function toProfileArray(?array $row): ?array
    {
        if (! is_array($row)) {
            return null;
        }

        return [
            'id' => (int) ($row['wannabe_id'] ?? 0),
            'name' => (string) ($row['name'] ?? ''),
            'nickname' => (string) ($row['nickname'] ?? ''),
            'crew_name' => (string) ($row['crew_name'] ?? ''),
            'crew_role' => [
                'title' => (string) ($row['crew_role_title'] ?? ''),
                'name' => (string) ($row['crew_role_name'] ?? ''),
            ],
        ];
    }

    public function clear(): void
    {
        $this->cache->builder()->emptyTable();
    }
}
