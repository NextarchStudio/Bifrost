<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateTransportJobStops extends Migration
{
    public function up(): void
    {
        if ($this->db->tableExists('transport_job_stops')) {
            return;
        }

        $this->forge->addField([
            'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'transport_job_id' => ['type' => 'BIGINT', 'unsigned' => true],
            'stop_number' => ['type' => 'INT', 'unsigned' => true],
            'address' => ['type' => 'VARCHAR', 'constraint' => 255],
            'notes' => ['type' => 'TEXT', 'null' => true],
            'created_at' => ['type' => 'DATETIME'],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('transport_job_id');
        $this->forge->addForeignKey('transport_job_id', 'transport_jobs', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('transport_job_stops', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);
    }

    public function down(): void
    {
        $this->forge->dropTable('transport_job_stops', true);
    }
}
