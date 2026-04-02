<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\ShopCategoryModel;
use App\Models\ShopItemModel;
use App\Models\ShopMovementModel;

class ShopRepository
{
    public function __construct(
        private readonly ShopCategoryModel $categories = new ShopCategoryModel(),
        private readonly ShopItemModel $items = new ShopItemModel(),
        private readonly ShopMovementModel $movements = new ShopMovementModel()
    ) {
    }

    public function categories(): array
    {
        return $this->categories->orderBy('name', 'ASC')->findAll();
    }

    public function findCategoryById(int $id): ?array
    {
        return $this->categories->find($id);
    }

    public function findCategoryByName(string $name): ?array
    {
        return $this->categories->where('name', $name)->first();
    }

    public function createCategory(string $name): int
    {
        $now = date('Y-m-d H:i:s');
        $this->categories->insert([
            'name' => $name,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return (int) $this->categories->getInsertID();
    }

    public function itemsWithCategory(): array
    {
        return $this->items
            ->select('shop_items.*, shop_categories.name AS category_name')
            ->join('shop_categories', 'shop_categories.id = shop_items.category_id', 'inner')
            ->orderBy('shop_categories.name', 'ASC')
            ->orderBy('shop_items.name', 'ASC')
            ->orderBy('shop_items.size', 'ASC')
            ->findAll();
    }

    public function findItemById(int $id): ?object
    {
        return $this->items->find($id);
    }

    public function createItem(array $data): int
    {
        $this->items->insert($data);

        return (int) $this->items->getInsertID();
    }

    public function updateItemById(int $id, array $data): bool
    {
        return $this->items->update($id, $data);
    }

    public function countMovementsForItem(int $itemId): int
    {
        return (int) $this->movements
            ->where('shop_item_id', $itemId)
            ->countAllResults();
    }

    public function deleteMovementsForItem(int $itemId): bool
    {
        return $this->movements
            ->where('shop_item_id', $itemId)
            ->delete();
    }

    public function deleteItemById(int $id): bool
    {
        return $this->items->delete($id);
    }

    public function insertMovement(array $data): int
    {
        $this->movements->insert($data);

        return (int) $this->movements->getInsertID();
    }

    public function recentMovements(int $limit = 30): array
    {
        return $this->movements
            ->select('shop_movements.*, shop_items.name AS item_name, shop_items.size AS item_size, shop_categories.name AS category_name, users.name AS actor_name')
            ->join('shop_items', 'shop_items.id = shop_movements.shop_item_id', 'inner')
            ->join('shop_categories', 'shop_categories.id = shop_items.category_id', 'inner')
            ->join('users', 'users.id = shop_movements.actor_user_id', 'left')
            ->orderBy('shop_movements.created_at', 'DESC')
            ->findAll($limit);
    }

    public function countItemsInCategory(int $categoryId): int
    {
        return (int) $this->items
            ->where('category_id', $categoryId)
            ->countAllResults();
    }
}
