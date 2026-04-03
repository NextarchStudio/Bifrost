<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddStatusToShopItems extends Migration
{
    public function up(): void
    {
        if (! $this->db->tableExists('shop_items')) {
            return;
        }

        $fields = [];

        if (! $this->db->fieldExists('status', 'shop_items')) {
            $fields['status'] = [
                'type' => 'VARCHAR',
                'constraint' => 20,
                'default' => 'active',
                'after' => 'quantity',
            ];
        }

        if (! $this->db->fieldExists('discontinued_at', 'shop_items')) {
            $fields['discontinued_at'] = [
                'type' => 'DATETIME',
                'null' => true,
                'after' => 'status',
            ];
        }

        if ($fields !== []) {
            $this->forge->addColumn('shop_items', $fields);
        }

        $this->db->table('shop_items')
            ->where('quantity >', 0)
            ->set([
                'status' => 'active',
                'discontinued_at' => null,
            ])
            ->update();

        $this->db->table('shop_items')
            ->where('quantity', 0)
            ->set([
                'status' => 'discontinued',
                'discontinued_at' => date('Y-m-d H:i:s'),
            ])
            ->update();
    }

    public function down(): void
    {
        if (! $this->db->tableExists('shop_items')) {
            return;
        }

        $columns = [];
        if ($this->db->fieldExists('status', 'shop_items')) {
            $columns[] = 'status';
        }
        if ($this->db->fieldExists('discontinued_at', 'shop_items')) {
            $columns[] = 'discontinued_at';
        }

        if ($columns !== []) {
            $this->forge->dropColumn('shop_items', $columns);
        }
    }
}
