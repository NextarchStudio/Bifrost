<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreatePrivateEquipmentPrefixesTable extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id' => [
                'type' => 'INT',
                'unsigned' => true,
                'auto_increment' => true,
            ],
            'owner_name' => [
                'type' => 'VARCHAR',
                'constraint' => 180,
            ],
            'barcode_prefix' => [
                'type' => 'VARCHAR',
                'constraint' => 120,
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);

        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey('barcode_prefix');
        $this->forge->createTable('private_equipment_prefixes');
    }

    public function down(): void
    {
        $this->forge->dropTable('private_equipment_prefixes', true);
    }
}
