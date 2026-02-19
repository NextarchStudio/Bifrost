<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\EquipmentCategoryModel;

class EquipmentCategoryRepository
{
    public function __construct(private readonly EquipmentCategoryModel $categories = new EquipmentCategoryModel())
    {
    }

    public function all(): array
    {
        return $this->categories->orderBy('name', 'ASC')->findAll();
    }

    public function create(string $name): int
    {
        $now = date('Y-m-d H:i:s');
        $this->categories->insert([
            'name'       => $name,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return (int) $this->categories->getInsertID();
    }

    public function deleteById(int $id): bool
    {
        return $this->categories->delete($id);
    }

    public function findByName(string $name): ?array
    {
        return $this->categories->where('name', $name)->first();
    }

    public function findById(int $id): ?array
    {
        return $this->categories->find($id);
    }
}

