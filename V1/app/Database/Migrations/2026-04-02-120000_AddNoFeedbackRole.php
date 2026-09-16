<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddNoFeedbackRole extends Migration
{
    public function up(): void
    {
        $exists = $this->db->table('roles')
            ->where('name', 'ingen_tilbakemeldinger')
            ->get()
            ->getFirstRow();

        if ($exists === null) {
            $this->db->table('roles')->insert([
                'name' => 'ingen_tilbakemeldinger',
            ]);
        }
    }

    public function down(): void
    {
        $role = $this->db->table('roles')
            ->where('name', 'ingen_tilbakemeldinger')
            ->get()
            ->getFirstRow();

        if ($role === null) {
            return;
        }

        $this->db->table('role_user')->where('role_id', (int) $role->id)->delete();
        $this->db->table('roles')->where('id', (int) $role->id)->delete();
    }
}
