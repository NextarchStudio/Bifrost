<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\WannabeCompetencyModel;

class WannabeCompetencyRepository
{
    public function __construct(private readonly WannabeCompetencyModel $competencies = new WannabeCompetencyModel())
    {
    }

    public function findByWannabeId(int $wannabeId): ?array
    {
        return $this->competencies->where('wannabe_id', $wannabeId)->first();
    }

    public function saveProfile(int $wannabeId, array $competencies): void
    {
        $existing = $this->findByWannabeId($wannabeId);
        $payload = [
            'wannabe_id' => $wannabeId,
            't1' => ! empty($competencies['t1']) ? 1 : 0,
            't2' => ! empty($competencies['t2']) ? 1 : 0,
            't3' => ! empty($competencies['t3']) ? 1 : 0,
            't4' => ! empty($competencies['t4']) ? 1 : 0,
            'b' => ! empty($competencies['b']) ? 1 : 0,
            'be' => ! empty($competencies['be']) ? 1 : 0,
            'c1' => ! empty($competencies['c1']) ? 1 : 0,
            'c1e' => ! empty($competencies['c1e']) ? 1 : 0,
            'c' => ! empty($competencies['c']) ? 1 : 0,
            'ce' => ! empty($competencies['ce']) ? 1 : 0,
            'kdo' => ! empty($competencies['kdo']) ? 1 : 0,
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        if ($existing === null) {
            $payload['created_at'] = $payload['updated_at'];
            $this->competencies->insert($payload);
            return;
        }

        $this->competencies->update((int) $existing['id'], $payload);
    }
}
