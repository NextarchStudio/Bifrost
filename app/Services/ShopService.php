<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\ShopRepository;

class ShopService
{
    private const SIZE_OPTIONS = [
        'XXS',
        'XS',
        'S',
        'M',
        'L',
        'XL',
        'XXL',
        'XXXL',
        'XXXXL',
        'XXXXXL',
        'XXXXXXL',
    ];

    public function __construct(
        private readonly ShopRepository $shop = new ShopRepository(),
        private readonly AuditService $audit = new AuditService()
    ) {
    }

    public function data(): array
    {
        return [
            'items' => $this->shop->itemsWithCategory(),
            'categories' => $this->shop->categories(),
            'movements' => $this->shop->recentMovements(),
            'sizeOptions' => self::SIZE_OPTIONS,
        ];
    }

    public function createCategory(array $input, int $actorUserId): int
    {
        $rules = ['name' => 'required|max_length[80]'];
        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException('Ugyldig kategori.');
        }

        $name = mb_substr(trim(strip_tags((string) $input['name'])), 0, 80);
        if ($name === '') {
            throw new \InvalidArgumentException('Kategori er paakrevd.');
        }

        $existing = $this->shop->findCategoryByName($name);
        if ($existing !== null) {
            return (int) $existing['id'];
        }

        $id = $this->shop->createCategory($name);
        $this->audit->log($actorUserId, 'create', 'shop_category', $id, ['name' => $name]);

        return $id;
    }

    public function createItem(array $input, int $actorUserId): int
    {
        $data = $this->validateItem($input, $actorUserId, true);
        $itemId = $this->shop->createItem([
            ...$data,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        if ($data['quantity'] > 0) {
            $this->shop->insertMovement([
                'shop_item_id' => $itemId,
                'actor_user_id' => $actorUserId,
                'movement_type' => 'checkin',
                'quantity' => (int) $data['quantity'],
                'notes' => 'Initial lagerbeholdning',
                'created_at' => date('Y-m-d H:i:s'),
            ]);
        }

        $this->audit->log($actorUserId, 'create', 'shop_item', $itemId, $data);

        return $itemId;
    }

    public function checkOut(int $itemId, array $input, int $actorUserId): void
    {
        $movement = $this->validateMovement($input);
        $item = $this->shop->findItemById($itemId);
        if ($item === null) {
            throw new \InvalidArgumentException('Vare finnes ikke.');
        }

        $currentQty = max(0, (int) $item->quantity);
        if ($movement['quantity'] > $currentQty) {
            throw new \InvalidArgumentException('Kan ikke sjekke ut mer enn det som er paa lager.');
        }

        $newQty = $currentQty - $movement['quantity'];
        $this->shop->updateItemById($itemId, [
            'quantity' => $newQty,
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        $movementId = $this->shop->insertMovement([
            'shop_item_id' => $itemId,
            'actor_user_id' => $actorUserId,
            'movement_type' => 'checkout',
            'quantity' => $movement['quantity'],
            'notes' => $movement['notes'],
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        $this->audit->log($actorUserId, 'checkout', 'shop_item', $itemId, [
            'movement_id' => $movementId,
            'quantity' => $movement['quantity'],
            'notes' => $movement['notes'],
            'remaining_quantity' => $newQty,
        ]);
    }

    public function checkIn(int $itemId, array $input, int $actorUserId): void
    {
        $movement = $this->validateMovement($input);
        $item = $this->shop->findItemById($itemId);
        if ($item === null) {
            throw new \InvalidArgumentException('Vare finnes ikke.');
        }

        $newQty = max(0, (int) $item->quantity) + $movement['quantity'];
        $this->shop->updateItemById($itemId, [
            'quantity' => $newQty,
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        $movementId = $this->shop->insertMovement([
            'shop_item_id' => $itemId,
            'actor_user_id' => $actorUserId,
            'movement_type' => 'checkin',
            'quantity' => $movement['quantity'],
            'notes' => $movement['notes'],
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        $this->audit->log($actorUserId, 'checkin', 'shop_item', $itemId, [
            'movement_id' => $movementId,
            'quantity' => $movement['quantity'],
            'notes' => $movement['notes'],
            'new_quantity' => $newQty,
        ]);
    }

    public function deleteItem(int $itemId, int $actorUserId): void
    {
        $item = $this->shop->findItemById($itemId);
        if ($item === null) {
            throw new \InvalidArgumentException('Vare finnes ikke.');
        }

        $movementCount = $this->shop->countMovementsForItem($itemId);
        if ($movementCount > 0) {
            $this->shop->deleteMovementsForItem($itemId);
        }

        $this->shop->deleteItemById($itemId);
        $this->audit->log($actorUserId, 'delete', 'shop_item', $itemId, [
            'name' => (string) $item->name,
            'size' => $item->size !== null ? (string) $item->size : null,
            'quantity' => (int) $item->quantity,
            'deleted_movements' => $movementCount,
        ]);
    }

    private function validateItem(array $input, int $actorUserId, bool $allowNewCategory): array
    {
        $rules = [
            'name' => 'required|min_length[2]|max_length[150]',
            'category_id' => 'permit_empty|integer',
            'new_category' => 'permit_empty|max_length[80]',
            'size' => 'permit_empty|max_length[20]',
            'quantity' => 'required|integer|greater_than_equal_to[0]',
            'notes' => 'permit_empty|max_length[4000]',
        ];

        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException(implode(' ', service('validation')->getErrors()));
        }

        $categoryId = $this->resolveCategoryId($input, $actorUserId, $allowNewCategory);
        $size = $this->normalizeSize((string) ($input['size'] ?? ''));

        return [
            'category_id' => $categoryId,
            'name' => mb_substr(trim(strip_tags((string) $input['name'])), 0, 150),
            'size' => $size,
            'quantity' => (int) $input['quantity'],
            'notes' => ! empty($input['notes']) ? mb_substr(trim(strip_tags((string) $input['notes'])), 0, 4000) : null,
        ];
    }

    private function resolveCategoryId(array $input, int $actorUserId, bool $allowNewCategory): int
    {
        $newCategory = mb_substr(trim(strip_tags((string) ($input['new_category'] ?? ''))), 0, 80);
        if ($allowNewCategory && $newCategory !== '') {
            $existing = $this->shop->findCategoryByName($newCategory);

            if ($existing !== null) {
                return (int) $existing['id'];
            }

            $id = $this->shop->createCategory($newCategory);
            $this->audit->log($actorUserId, 'create', 'shop_category', $id, ['name' => $newCategory]);

            return $id;
        }

        $categoryId = (int) ($input['category_id'] ?? 0);
        if ($categoryId < 1) {
            throw new \InvalidArgumentException('Velg en kategori eller opprett en ny.');
        }

        $category = $this->shop->findCategoryById($categoryId);
        if ($category === null) {
            throw new \InvalidArgumentException('Kategori finnes ikke.');
        }

        return $categoryId;
    }

    private function normalizeSize(string $size): ?string
    {
        $size = mb_strtoupper(trim(strip_tags($size)));
        if ($size === '') {
            return null;
        }

        if (! in_array($size, self::SIZE_OPTIONS, true)) {
            throw new \InvalidArgumentException('Ugyldig storrelse.');
        }

        return $size;
    }

    private function validateMovement(array $input): array
    {
        $rules = [
            'quantity' => 'required|integer|greater_than[0]',
            'notes' => 'permit_empty|max_length[255]',
        ];

        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException(implode(' ', service('validation')->getErrors()));
        }

        return [
            'quantity' => (int) $input['quantity'],
            'notes' => ! empty($input['notes']) ? mb_substr(trim(strip_tags((string) $input['notes'])), 0, 255) : null,
        ];
    }
}
