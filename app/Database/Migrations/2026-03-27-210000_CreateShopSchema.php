<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateShopSchema extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id' => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'name' => ['type' => 'VARCHAR', 'constraint' => 80],
            'created_at' => ['type' => 'DATETIME'],
            'updated_at' => ['type' => 'DATETIME'],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey('name');
        $this->forge->createTable('shop_categories', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);

        $this->forge->addField([
            'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'category_id' => ['type' => 'INT', 'unsigned' => true],
            'name' => ['type' => 'VARCHAR', 'constraint' => 150],
            'size' => ['type' => 'VARCHAR', 'constraint' => 20, 'null' => true],
            'quantity' => ['type' => 'INT', 'unsigned' => true, 'default' => 0],
            'notes' => ['type' => 'TEXT', 'null' => true],
            'created_at' => ['type' => 'DATETIME'],
            'updated_at' => ['type' => 'DATETIME'],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('category_id');
        $this->forge->addKey(['name', 'size']);
        $this->forge->addForeignKey('category_id', 'shop_categories', 'id', 'RESTRICT', 'CASCADE');
        $this->forge->createTable('shop_items', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);

        $this->forge->addField([
            'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'shop_item_id' => ['type' => 'BIGINT', 'unsigned' => true],
            'actor_user_id' => ['type' => 'BIGINT', 'unsigned' => true],
            'movement_type' => ['type' => 'VARCHAR', 'constraint' => 20],
            'quantity' => ['type' => 'INT', 'unsigned' => true],
            'notes' => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'created_at' => ['type' => 'DATETIME'],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey(['shop_item_id', 'created_at']);
        $this->forge->addForeignKey('shop_item_id', 'shop_items', 'id', 'RESTRICT', 'CASCADE');
        $this->forge->addForeignKey('actor_user_id', 'users', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->createTable('shop_movements', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);
    }

    public function down(): void
    {
        $this->forge->dropTable('shop_movements', true);
        $this->forge->dropTable('shop_items', true);
        $this->forge->dropTable('shop_categories', true);
    }
}
