<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateFeedbackEntries extends Migration
{
    public function up(): void
    {
        if ($this->db->tableExists('feedback_entries')) {
            return;
        }

        $this->forge->addField([
            'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'requester_user_id' => ['type' => 'BIGINT', 'unsigned' => true],
            'wannabe_id' => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'requester_name' => ['type' => 'VARCHAR', 'constraint' => 180],
            'type' => ['type' => 'VARCHAR', 'constraint' => 20],
            'title' => ['type' => 'VARCHAR', 'constraint' => 180],
            'description' => ['type' => 'TEXT'],
            'needs_database_fix' => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
            'status' => ['type' => 'VARCHAR', 'constraint' => 20, 'default' => 'pending'],
            'developer_note' => ['type' => 'TEXT', 'null' => true],
            'resolved_at' => ['type' => 'DATETIME', 'null' => true],
            'added_at' => ['type' => 'DATETIME', 'null' => true],
            'created_at' => ['type' => 'DATETIME'],
            'updated_at' => ['type' => 'DATETIME'],
        ]);

        $this->forge->addKey('id', true);
        $this->forge->addKey('requester_user_id');
        $this->forge->addKey('status');
        $this->forge->addKey('type');
        $this->forge->addForeignKey('requester_user_id', 'users', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('feedback_entries', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);
    }

    public function down(): void
    {
        $this->forge->dropTable('feedback_entries', true);
    }
}
