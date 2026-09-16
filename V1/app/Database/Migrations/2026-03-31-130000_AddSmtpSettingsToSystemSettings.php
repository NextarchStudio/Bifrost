<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddSmtpSettingsToSystemSettings extends Migration
{
    public function up(): void
    {
        $fields = [
            'smtp_from_email' => ['type' => 'VARCHAR', 'constraint' => 180, 'null' => true, 'after' => 'enable_keycloak_login'],
            'smtp_from_name' => ['type' => 'VARCHAR', 'constraint' => 180, 'null' => true, 'after' => 'smtp_from_email'],
            'smtp_host' => ['type' => 'VARCHAR', 'constraint' => 180, 'null' => true, 'after' => 'smtp_from_name'],
            'smtp_port' => ['type' => 'INT', 'constraint' => 5, 'null' => true, 'after' => 'smtp_host'],
            'smtp_user' => ['type' => 'VARCHAR', 'constraint' => 180, 'null' => true, 'after' => 'smtp_port'],
            'smtp_pass' => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true, 'after' => 'smtp_user'],
            'smtp_crypto' => ['type' => 'VARCHAR', 'constraint' => 10, 'null' => true, 'after' => 'smtp_pass'],
        ];

        $this->forge->addColumn('system_settings', $fields);
    }

    public function down(): void
    {
        $this->forge->dropColumn('system_settings', [
            'smtp_from_email',
            'smtp_from_name',
            'smtp_host',
            'smtp_port',
            'smtp_user',
            'smtp_pass',
            'smtp_crypto',
        ]);
    }
}
