<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateCommsSchema extends Migration
{
    public function up(): void
    {
        if (! $this->db->tableExists('comms_items')) {
            $this->forge->addField([
                'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
                'name' => ['type' => 'VARCHAR', 'constraint' => 140],
                'type' => ['type' => 'VARCHAR', 'constraint' => 30],
                'serial_number' => ['type' => 'VARCHAR', 'constraint' => 150, 'null' => true],
                'quantity' => ['type' => 'INT', 'unsigned' => true, 'default' => 1],
                'status' => ['type' => 'VARCHAR', 'constraint' => 20, 'default' => 'available'],
                'notes' => ['type' => 'TEXT', 'null' => true],
                'created_at' => ['type' => 'DATETIME'],
                'updated_at' => ['type' => 'DATETIME'],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addKey('type');
            $this->forge->addKey('status');
            $this->forge->createTable('comms_items', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);
        }

        if (! $this->db->tableExists('comms_sets')) {
            $this->forge->addField([
                'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
                'name' => ['type' => 'VARCHAR', 'constraint' => 120],
                'notes' => ['type' => 'TEXT', 'null' => true],
                'created_at' => ['type' => 'DATETIME'],
                'updated_at' => ['type' => 'DATETIME'],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->createTable('comms_sets', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);
        }

        if (! $this->db->tableExists('comms_set_items')) {
            $this->forge->addField([
                'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
                'set_id' => ['type' => 'BIGINT', 'unsigned' => true],
                'item_id' => ['type' => 'BIGINT', 'unsigned' => true],
                'quantity' => ['type' => 'INT', 'unsigned' => true, 'default' => 1],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addUniqueKey(['set_id', 'item_id']);
            $this->forge->addForeignKey('set_id', 'comms_sets', 'id', 'CASCADE', 'CASCADE');
            $this->forge->addForeignKey('item_id', 'comms_items', 'id', 'RESTRICT', 'CASCADE');
            $this->forge->createTable('comms_set_items', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);
        }

        if (! $this->db->tableExists('comms_loans')) {
            $this->forge->addField([
                'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
                'wannabe_id' => ['type' => 'BIGINT', 'unsigned' => true],
                'issued_by_user_id' => ['type' => 'BIGINT', 'unsigned' => true],
                'set_id' => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
                'issued_at' => ['type' => 'DATETIME'],
                'returned_at' => ['type' => 'DATETIME', 'null' => true],
                'status' => ['type' => 'VARCHAR', 'constraint' => 20, 'default' => 'active'],
                'notes' => ['type' => 'TEXT', 'null' => true],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addKey('wannabe_id');
            $this->forge->addKey('status');
            $this->forge->addForeignKey('issued_by_user_id', 'users', 'id', 'RESTRICT', 'RESTRICT');
            $this->forge->addForeignKey('set_id', 'comms_sets', 'id', 'SET NULL', 'SET NULL');
            $this->forge->createTable('comms_loans', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);
        }

        if (! $this->db->tableExists('comms_loan_items')) {
            $this->forge->addField([
                'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
                'loan_id' => ['type' => 'BIGINT', 'unsigned' => true],
                'item_id' => ['type' => 'BIGINT', 'unsigned' => true],
                'quantity' => ['type' => 'INT', 'unsigned' => true, 'default' => 1],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addKey('loan_id');
            $this->forge->addForeignKey('loan_id', 'comms_loans', 'id', 'CASCADE', 'CASCADE');
            $this->forge->addForeignKey('item_id', 'comms_items', 'id', 'RESTRICT', 'CASCADE');
            $this->forge->createTable('comms_loan_items', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);
        }
    }

    public function down(): void
    {
        $this->forge->dropTable('comms_loan_items', true);
        $this->forge->dropTable('comms_loans', true);
        $this->forge->dropTable('comms_set_items', true);
        $this->forge->dropTable('comms_sets', true);
        $this->forge->dropTable('comms_items', true);
    }
}
