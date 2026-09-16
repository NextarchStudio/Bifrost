<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateEquipmentRequests extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'                => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'requester_user_id' => ['type' => 'BIGINT', 'unsigned' => true],
            'wannabe_id'        => ['type' => 'BIGINT', 'unsigned' => true],
            'title'             => ['type' => 'VARCHAR', 'constraint' => 150],
            'notes'             => ['type' => 'TEXT', 'null' => true],
            'status'            => ['type' => 'VARCHAR', 'constraint' => 20, 'default' => 'pending'],
            'created_at'        => ['type' => 'DATETIME'],
            'updated_at'        => ['type' => 'DATETIME'],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('requester_user_id');
        $this->forge->addKey('wannabe_id');
        $this->forge->addKey('status');
        $this->forge->addForeignKey('requester_user_id', 'users', 'id', 'RESTRICT', 'CASCADE');
        $this->forge->createTable('equipment_requests', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);

        $this->forge->addField([
            'id'           => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'request_id'   => ['type' => 'BIGINT', 'unsigned' => true],
            'equipment_id' => ['type' => 'BIGINT', 'unsigned' => true],
            'quantity'     => ['type' => 'SMALLINT', 'unsigned' => true, 'default' => 1],
            'note'         => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('request_id');
        $this->forge->addKey('equipment_id');
        $this->forge->addForeignKey('request_id', 'equipment_requests', 'id', 'RESTRICT', 'CASCADE');
        $this->forge->addForeignKey('equipment_id', 'equipment', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->createTable('equipment_request_items', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);
    }

    public function down(): void
    {
        $this->forge->dropTable('equipment_request_items', true);
        $this->forge->dropTable('equipment_requests', true);
    }
}
