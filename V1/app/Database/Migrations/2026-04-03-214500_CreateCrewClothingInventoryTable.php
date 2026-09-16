<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateCrewClothingInventoryTable extends Migration
{
    public function up(): void
    {
        if ($this->db->tableExists('crew_clothing_inventory')) {
            return;
        }

        $this->forge->addField([
            'id' => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'item_type' => ['type' => 'VARCHAR', 'constraint' => 20],
            'size' => ['type' => 'VARCHAR', 'constraint' => 20],
            'quantity' => ['type' => 'INT', 'unsigned' => true, 'default' => 0],
            'created_at' => ['type' => 'DATETIME'],
            'updated_at' => ['type' => 'DATETIME'],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey(['item_type', 'size']);
        $this->forge->createTable('crew_clothing_inventory', true, [
            'ENGINE' => 'InnoDB',
            'DEFAULT CHARSET' => 'utf8mb4',
            'COLLATE' => 'utf8mb4_unicode_ci',
        ]);
    }

    public function down(): void
    {
        $this->forge->dropTable('crew_clothing_inventory', true);
    }
}
