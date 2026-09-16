<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateFeedbackNotifications extends Migration
{
    public function up(): void
    {
        if (! $this->db->tableExists('feedback_notifications')) {
            $this->forge->addField([
                'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
                'feedback_entry_id' => ['type' => 'BIGINT', 'unsigned' => true],
                'status' => ['type' => 'VARCHAR', 'constraint' => 20],
                'title' => ['type' => 'VARCHAR', 'constraint' => 180],
                'message' => ['type' => 'TEXT', 'null' => true],
                'created_at' => ['type' => 'DATETIME'],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addKey('feedback_entry_id');
            $this->forge->addForeignKey('feedback_entry_id', 'feedback_entries', 'id', 'CASCADE', 'CASCADE');
            $this->forge->createTable('feedback_notifications', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);
        }

        if (! $this->db->tableExists('feedback_notification_reads')) {
            $this->forge->addField([
                'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
                'notification_id' => ['type' => 'BIGINT', 'unsigned' => true],
                'user_id' => ['type' => 'BIGINT', 'unsigned' => true],
                'seen_at' => ['type' => 'DATETIME'],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addUniqueKey(['notification_id', 'user_id']);
            $this->forge->addForeignKey('notification_id', 'feedback_notifications', 'id', 'CASCADE', 'CASCADE');
            $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');
            $this->forge->createTable('feedback_notification_reads', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);
        }
    }

    public function down(): void
    {
        $this->forge->dropTable('feedback_notification_reads', true);
        $this->forge->dropTable('feedback_notifications', true);
    }
}
