<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\PrivateEquipmentPrefixModel;

class PrivateEquipmentRepository
{
    public function __construct(private readonly PrivateEquipmentPrefixModel $prefixes = new PrivateEquipmentPrefixModel())
    {
    }

    public function all(): array
    {
        return $this->prefixes
            ->orderBy('barcode_prefix', 'ASC')
            ->findAll();
    }

    public function create(array $data): int
    {
        $this->prefixes->insert($data);

        return (int) $this->prefixes->getInsertID();
    }

    public function deleteById(int $id): bool
    {
        return $this->prefixes->delete($id);
    }

    public function findByPrefix(string $prefix): ?array
    {
        return $this->prefixes
            ->where('barcode_prefix', strtoupper(trim($prefix)))
            ->first();
    }
}
