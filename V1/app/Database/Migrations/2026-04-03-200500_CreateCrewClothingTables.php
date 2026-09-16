<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateCrewClothingTables extends Migration
{
    public function up(): void
    {
        if (! $this->db->tableExists('crew_clothing_crews')) {
            $this->forge->addField([
                'id' => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
                'name' => ['type' => 'VARCHAR', 'constraint' => 120],
                'tshirt_max' => ['type' => 'INT', 'unsigned' => true, 'default' => 1],
                'hoodie_max' => ['type' => 'INT', 'unsigned' => true, 'default' => 1],
                'created_at' => ['type' => 'DATETIME'],
                'updated_at' => ['type' => 'DATETIME'],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addUniqueKey('name');
            $this->forge->createTable('crew_clothing_crews', true, [
                'ENGINE' => 'InnoDB',
                'DEFAULT CHARSET' => 'utf8mb4',
                'COLLATE' => 'utf8mb4_unicode_ci',
            ]);
        }

        if (! $this->db->tableExists('crew_clothing_members')) {
            $this->forge->addField([
                'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
                'crew_id' => ['type' => 'INT', 'unsigned' => true, 'null' => true],
                'wannabe_id' => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
                'badge_scan_number' => ['type' => 'VARCHAR', 'constraint' => 120, 'null' => true],
                'name' => ['type' => 'VARCHAR', 'constraint' => 180],
                'nickname' => ['type' => 'VARCHAR', 'constraint' => 120, 'null' => true],
                'tshirt_size' => ['type' => 'VARCHAR', 'constraint' => 20, 'null' => true],
                'tshirt_delivered' => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
                'tshirt_delivered_at' => ['type' => 'DATETIME', 'null' => true],
                'tshirt_delivered_by_user_id' => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
                'hoodie_size' => ['type' => 'VARCHAR', 'constraint' => 20, 'null' => true],
                'hoodie_delivered' => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
                'hoodie_delivered_at' => ['type' => 'DATETIME', 'null' => true],
                'hoodie_delivered_by_user_id' => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
                'created_at' => ['type' => 'DATETIME'],
                'updated_at' => ['type' => 'DATETIME'],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addUniqueKey('wannabe_id');
            $this->forge->addUniqueKey('badge_scan_number');
            $this->forge->addKey('crew_id');
            $this->forge->addKey('name');
            $this->forge->addForeignKey('crew_id', 'crew_clothing_crews', 'id', 'SET NULL', 'SET NULL');
            $this->forge->addForeignKey('tshirt_delivered_by_user_id', 'users', 'id', 'SET NULL', 'SET NULL');
            $this->forge->addForeignKey('hoodie_delivered_by_user_id', 'users', 'id', 'SET NULL', 'SET NULL');
            $this->forge->createTable('crew_clothing_members', true, [
                'ENGINE' => 'InnoDB',
                'DEFAULT CHARSET' => 'utf8mb4',
                'COLLATE' => 'utf8mb4_unicode_ci',
            ]);
        }
    }

    public function down(): void
    {
        $this->forge->dropTable('crew_clothing_members', true);
        $this->forge->dropTable('crew_clothing_crews', true);
    }
}
