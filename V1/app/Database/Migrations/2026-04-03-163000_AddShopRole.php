<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddShopRole extends Migration
{
    public function up(): void
    {
        if (! $this->db->tableExists('roles')) {
            return;
        }

        $exists = $this->db->table('roles')->where('name', 'shop')->get()->getFirstRow();
        if ($exists === null) {
            $this->db->table('roles')->insert(['name' => 'shop']);
        }
    }

    public function down(): void
    {
        if (! $this->db->tableExists('roles')) {
            return;
        }

        $this->db->table('roles')->where('name', 'shop')->delete();
    }
}
