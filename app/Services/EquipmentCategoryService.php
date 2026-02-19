<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\EquipmentCategoryRepository;
use App\Repositories\EquipmentRepository;

class EquipmentCategoryService
{
    public function __construct(
        private readonly EquipmentCategoryRepository $categories = new EquipmentCategoryRepository(),
        private readonly EquipmentRepository $equipment = new EquipmentRepository(),
        private readonly AuditService $audit = new AuditService()
    ) {
    }

    public function list(): array
    {
        return $this->categories->all();
    }

    public function create(array $input, int $actorUserId): int
    {
        $rules = ['name' => 'required|max_length[80]'];
        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException('Ugyldig kategori.');
        }

        $name = mb_substr(trim(strip_tags((string) $input['name'])), 0, 80);
        if ($this->categories->findByName($name) !== null) {
            throw new \InvalidArgumentException('Kategori finnes allerede.');
        }

        $id = $this->categories->create($name);
        $this->audit->log($actorUserId, 'create', 'equipment_category', $id, ['name' => $name]);

        return $id;
    }

    public function delete(int $categoryId, int $actorUserId): void
    {
        $category = $this->categories->findById($categoryId);
        if ($category === null) {
            throw new \InvalidArgumentException('Kategori finnes ikke.');
        }

        $inUse = $this->equipment->countByCategoryName((string) $category['name']);
        if ($inUse > 0) {
            throw new \InvalidArgumentException('Kategori kan ikke slettes fordi den brukes av utstyr.');
        }

        $this->categories->deleteById($categoryId);
        $this->audit->log($actorUserId, 'delete', 'equipment_category', $categoryId, ['name' => $category['name']]);
    }
}

