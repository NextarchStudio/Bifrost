<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddApprovalFieldsToEquipmentRequestItems extends Migration
{
    public function up(): void
    {
        $fields = $this->db->getFieldNames('equipment_request_items');

        if (! in_array('approved_quantity', $fields, true)) {
            $this->forge->addColumn('equipment_request_items', [
                'approved_quantity' => ['type' => 'SMALLINT', 'unsigned' => true, 'default' => 0],
            ]);
        }

        if (! in_array('item_status', $fields, true)) {
            $this->forge->addColumn('equipment_request_items', [
                'item_status' => ['type' => 'VARCHAR', 'constraint' => 20, 'default' => 'pending'],
            ]);
        }
    }

    public function down(): void
    {
        $fields = $this->db->getFieldNames('equipment_request_items');
        if (in_array('approved_quantity', $fields, true)) {
            $this->forge->dropColumn('equipment_request_items', 'approved_quantity');
        }
        if (in_array('item_status', $fields, true)) {
            $this->forge->dropColumn('equipment_request_items', 'item_status');
        }
    }
}

