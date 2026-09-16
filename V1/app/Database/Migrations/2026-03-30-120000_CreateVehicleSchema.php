<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateVehicleSchema extends Migration
{
    public function up(): void
    {
        if (! $this->db->tableExists('vehicles')) {
            $this->forge->addField([
                'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
                'name' => ['type' => 'VARCHAR', 'constraint' => 150],
                'registration_number' => ['type' => 'VARCHAR', 'constraint' => 20],
                'status' => ['type' => 'VARCHAR', 'constraint' => 20, 'default' => 'available'],
                'notes' => ['type' => 'TEXT', 'null' => true],
                'created_at' => ['type' => 'DATETIME'],
                'updated_at' => ['type' => 'DATETIME'],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addUniqueKey('registration_number');
            $this->forge->addKey('status');
            $this->forge->createTable('vehicles', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);
        }

        if (! $this->db->tableExists('vehicle_loans')) {
            $this->forge->addField([
                'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
                'vehicle_id' => ['type' => 'BIGINT', 'unsigned' => true],
                'wannabe_id' => ['type' => 'BIGINT', 'unsigned' => true],
                'issued_by_user_id' => ['type' => 'BIGINT', 'unsigned' => true],
                'issued_at' => ['type' => 'DATETIME'],
                'returned_at' => ['type' => 'DATETIME', 'null' => true],
                'status' => ['type' => 'VARCHAR', 'constraint' => 20],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addKey('status');
            $this->forge->addKey('wannabe_id');
            $this->forge->addForeignKey('vehicle_id', 'vehicles', 'id', 'CASCADE', 'CASCADE');
            $this->forge->addForeignKey('issued_by_user_id', 'users', 'id', 'RESTRICT', 'RESTRICT');
            $this->forge->createTable('vehicle_loans', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);
        }
    }

    public function down(): void
    {
        $this->forge->dropTable('vehicle_loans', true);
        $this->forge->dropTable('vehicles', true);
    }
}
