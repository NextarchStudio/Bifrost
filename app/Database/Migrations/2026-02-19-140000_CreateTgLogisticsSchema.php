<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateTgLogisticsSchema extends Migration
{
    public function up(): void
    {
        $this->db->query('SET FOREIGN_KEY_CHECKS=0');

        $this->forge->addField([
            'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'name' => ['type' => 'VARCHAR', 'constraint' => 120],
            'first_name' => ['type' => 'VARCHAR', 'constraint' => 80],
            'last_name' => ['type' => 'VARCHAR', 'constraint' => 80],
            'email' => ['type' => 'VARCHAR', 'constraint' => 180],
            'wannabe_id' => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'password_hash' => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'active' => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 1],
            'created_at' => ['type' => 'DATETIME'],
            'updated_at' => ['type' => 'DATETIME'],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey('email');
        $this->forge->addUniqueKey('wannabe_id');
        $this->forge->createTable('users', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);

        $this->forge->addField([
            'id' => ['type' => 'SMALLINT', 'unsigned' => true, 'auto_increment' => true],
            'name' => ['type' => 'VARCHAR', 'constraint' => 50],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey('name');
        $this->forge->createTable('roles', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);

        $this->forge->addField([
            'user_id' => ['type' => 'BIGINT', 'unsigned' => true],
            'role_id' => ['type' => 'SMALLINT', 'unsigned' => true],
        ]);
        $this->forge->addKey(['user_id', 'role_id'], true);
        $this->forge->addForeignKey('user_id', 'users', 'id', 'RESTRICT', 'CASCADE');
        $this->forge->addForeignKey('role_id', 'roles', 'id', 'RESTRICT', 'CASCADE');
        $this->forge->createTable('user_roles', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);

        $this->forge->addField([
            'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'user_id' => ['type' => 'BIGINT', 'unsigned' => true],
            'provider' => ['type' => 'VARCHAR', 'constraint' => 30],
            'provider_id' => ['type' => 'VARCHAR', 'constraint' => 191],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey(['provider', 'provider_id']);
        $this->forge->addForeignKey('user_id', 'users', 'id', 'RESTRICT', 'CASCADE');
        $this->forge->createTable('auth_accounts', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);

        $this->forge->addField([
            'id' => ['type' => 'TINYINT', 'unsigned' => true],
            'enable_local_login' => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 1],
            'enable_keycloak_login' => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 1],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->createTable('system_settings', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);

        $this->forge->addField([
            'id' => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'name' => ['type' => 'VARCHAR', 'constraint' => 120],
            'type' => ['type' => 'VARCHAR', 'constraint' => 50],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('name');
        $this->forge->createTable('locations', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);

        $this->forge->addField([
            'id' => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'location_id' => ['type' => 'INT', 'unsigned' => true],
            'name' => ['type' => 'VARCHAR', 'constraint' => 80],
            'qr_code' => ['type' => 'VARCHAR', 'constraint' => 120, 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('location_id');
        $this->forge->addForeignKey('location_id', 'locations', 'id', 'RESTRICT', 'CASCADE');
        $this->forge->createTable('pallets', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);

        $this->forge->addField([
            'id' => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'pallet_id' => ['type' => 'INT', 'unsigned' => true],
            'slot_number' => ['type' => 'SMALLINT', 'unsigned' => true],
            'status' => ['type' => 'VARCHAR', 'constraint' => 20],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey(['pallet_id', 'slot_number']);
        $this->forge->addForeignKey('pallet_id', 'pallets', 'id', 'RESTRICT', 'CASCADE');
        $this->forge->createTable('pallet_slots', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);

        $this->forge->addField([
            'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'name' => ['type' => 'VARCHAR', 'constraint' => 150],
            'category' => ['type' => 'VARCHAR', 'constraint' => 80],
            'serial_number' => ['type' => 'VARCHAR', 'constraint' => 150],
            'quantity' => ['type' => 'INT', 'unsigned' => true, 'default' => 1],
            'status' => ['type' => 'VARCHAR', 'constraint' => 30],
            'pallet_slot_id' => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'notes' => ['type' => 'TEXT', 'null' => true],
            'created_at' => ['type' => 'DATETIME'],
            'updated_at' => ['type' => 'DATETIME'],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey('serial_number');
        $this->forge->addKey('name');
        $this->forge->addKey('status');
        $this->forge->addForeignKey('pallet_slot_id', 'pallet_slots', 'id', 'SET NULL', 'SET NULL');
        $this->forge->createTable('equipment', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);

        $this->forge->addField([
            'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'equipment_id' => ['type' => 'BIGINT', 'unsigned' => true],
            'wannabe_id' => ['type' => 'BIGINT', 'unsigned' => true],
            'quantity' => ['type' => 'INT', 'unsigned' => true, 'default' => 1],
            'request_id' => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'issued_by_user_id' => ['type' => 'BIGINT', 'unsigned' => true],
            'issued_at' => ['type' => 'DATETIME'],
            'returned_at' => ['type' => 'DATETIME', 'null' => true],
            'status' => ['type' => 'VARCHAR', 'constraint' => 20],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('status');
        $this->forge->addKey('wannabe_id');
        $this->forge->addKey('request_id');
        $this->forge->addForeignKey('equipment_id', 'equipment', 'id', 'RESTRICT', 'CASCADE');
        $this->forge->addForeignKey('issued_by_user_id', 'users', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->createTable('equipment_loans', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);

        $this->forge->addField([
            'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'description' => ['type' => 'TEXT'],
            'from_location_id' => ['type' => 'INT', 'unsigned' => true],
            'to_location_id' => ['type' => 'INT', 'unsigned' => true],
            'transport_type' => ['type' => 'VARCHAR', 'constraint' => 20, 'default' => 'equipment'],
            'people_count' => ['type' => 'SMALLINT', 'unsigned' => true, 'null' => true],
            'equipment_id' => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'requester_user_id' => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'assigned_user_id' => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'status' => ['type' => 'VARCHAR', 'constraint' => 20],
            'created_at' => ['type' => 'DATETIME'],
            'updated_at' => ['type' => 'DATETIME'],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('status');
        $this->forge->addKey('transport_type');
        $this->forge->addKey('requester_user_id');
        $this->forge->addForeignKey('from_location_id', 'locations', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->addForeignKey('to_location_id', 'locations', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->addForeignKey('equipment_id', 'equipment', 'id', 'SET NULL', 'SET NULL');
        $this->forge->addForeignKey('requester_user_id', 'users', 'id', 'SET NULL', 'SET NULL');
        $this->forge->addForeignKey('assigned_user_id', 'users', 'id', 'SET NULL', 'SET NULL');
        $this->forge->createTable('transport_jobs', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);

        $this->forge->addField([
            'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'actor_user_id' => ['type' => 'BIGINT', 'unsigned' => true],
            'action' => ['type' => 'VARCHAR', 'constraint' => 120],
            'entity_type' => ['type' => 'VARCHAR', 'constraint' => 60],
            'entity_id' => ['type' => 'BIGINT', 'unsigned' => true],
            'diff_json' => ['type' => 'JSON', 'null' => true],
            'created_at' => ['type' => 'DATETIME'],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey(['entity_type', 'entity_id']);
        $this->forge->addForeignKey('actor_user_id', 'users', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->createTable('audit_logs', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);

        $this->forge->addField([
            'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'email' => ['type' => 'VARCHAR', 'constraint' => 180],
            'ip_address' => ['type' => 'VARCHAR', 'constraint' => 45],
            'successful' => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
            'created_at' => ['type' => 'DATETIME'],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey(['email', 'ip_address', 'created_at']);
        $this->forge->createTable('login_attempts', true, ['ENGINE' => 'InnoDB', 'DEFAULT CHARSET' => 'utf8mb4', 'COLLATE' => 'utf8mb4_unicode_ci']);

        $this->db->query('SET FOREIGN_KEY_CHECKS=1');
    }

    public function down(): void
    {
        $this->db->query('SET FOREIGN_KEY_CHECKS=0');
        $this->forge->dropTable('login_attempts', true);
        $this->forge->dropTable('audit_logs', true);
        $this->forge->dropTable('transport_jobs', true);
        $this->forge->dropTable('equipment_loans', true);
        $this->forge->dropTable('equipment', true);
        $this->forge->dropTable('pallet_slots', true);
        $this->forge->dropTable('pallets', true);
        $this->forge->dropTable('locations', true);
        $this->forge->dropTable('system_settings', true);
        $this->forge->dropTable('auth_accounts', true);
        $this->forge->dropTable('user_roles', true);
        $this->forge->dropTable('roles', true);
        $this->forge->dropTable('users', true);
        $this->db->query('SET FOREIGN_KEY_CHECKS=1');
    }
}
