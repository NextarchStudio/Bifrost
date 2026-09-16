<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddBadgeScanNumberToUsers extends Migration
{
    public function up()
    {
        if (! $this->db->fieldExists('badge_scan_number', 'users')) {
            $this->forge->addColumn('users', [
                'badge_scan_number' => [
                    'type' => 'VARCHAR',
                    'constraint' => 64,
                    'null' => true,
                    'after' => 'wannabe_id',
                ],
            ]);
            $this->db->query('ALTER TABLE users ADD UNIQUE KEY users_badge_scan_number_unique (badge_scan_number)');
        }
    }

    public function down()
    {
        if ($this->db->fieldExists('badge_scan_number', 'users')) {
            $this->forge->dropColumn('users', 'badge_scan_number');
        }
    }
}
