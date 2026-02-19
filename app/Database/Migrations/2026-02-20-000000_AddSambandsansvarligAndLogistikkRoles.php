<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddSambandsansvarligAndLogistikkRoles extends Migration
{
    public function up(): void
    {
        if (! $this->db->tableExists('roles')) {
            return;
        }

        foreach (['sambandsansvarlig', 'logistikk'] as $roleName) {
            $exists = $this->db->table('roles')->where('name', $roleName)->get()->getFirstRow();
            if ($exists === null) {
                $this->db->table('roles')->insert(['name' => $roleName]);
            }
        }
    }

    public function down(): void
    {
        if (! $this->db->tableExists('roles')) {
            return;
        }

        $this->db->table('roles')->whereIn('name', ['sambandsansvarlig', 'logistikk'])->delete();
    }
}
