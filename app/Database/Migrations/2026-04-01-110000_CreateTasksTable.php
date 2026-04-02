<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateTasksTable extends Migration
{
    public function up(): void
    {
        if ($this->db->tableExists('tasks')) {
            return;
        }

        $this->forge->addField([
            'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'title' => ['type' => 'VARCHAR', 'constraint' => 180],
            'type' => ['type' => 'VARCHAR', 'constraint' => 20],
            'transport_job_id' => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'status' => ['type' => 'VARCHAR', 'constraint' => 20, 'default' => 'not_started'],
            'priority' => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 2],
            'message' => ['type' => 'TEXT', 'null' => true],
            'description' => ['type' => 'TEXT'],
            'assigned_user_id' => ['type' => 'BIGINT', 'unsigned' => true],
            'created_by_user_id' => ['type' => 'BIGINT', 'unsigned' => true],
            'due_at' => ['type' => 'DATETIME'],
            'completed_at' => ['type' => 'DATETIME', 'null' => true],
            'created_at' => ['type' => 'DATETIME'],
            'updated_at' => ['type' => 'DATETIME'],
        ]);

        $this->forge->addKey('id', true);
        $this->forge->addKey('type');
        $this->forge->addKey('status');
        $this->forge->addKey('priority');
        $this->forge->addKey('assigned_user_id');
        $this->forge->addKey('created_by_user_id');
        $this->forge->addKey('transport_job_id');
        $this->forge->addForeignKey('assigned_user_id', 'users', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('created_by_user_id', 'users', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('transport_job_id', 'transport_jobs', 'id', 'SET NULL', 'CASCADE');
        $this->forge->createTable('tasks', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);
    }

    public function down(): void
    {
        $this->forge->dropTable('tasks', true);
    }
}
