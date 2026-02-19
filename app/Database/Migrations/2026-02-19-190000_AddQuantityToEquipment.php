<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddQuantityToEquipment extends Migration
{
    public function up(): void
    {
        $fields = $this->db->getFieldNames('equipment');
        if (! in_array('quantity', $fields, true)) {
            $this->forge->addColumn('equipment', [
                'quantity' => ['type' => 'INT', 'unsigned' => true, 'default' => 1, 'after' => 'serial_number'],
            ]);
        }
    }

    public function down(): void
    {
        $fields = $this->db->getFieldNames('equipment');
        if (in_array('quantity', $fields, true)) {
            $this->forge->dropColumn('equipment', 'quantity');
        }
    }
}

