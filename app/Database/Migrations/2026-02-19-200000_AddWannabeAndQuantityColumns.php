<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddWannabeAndQuantityColumns extends Migration
{
    public function up(): void
    {
        $requestFields = $this->db->getFieldNames('equipment_requests');
        if (! in_array('wannabe_id', $requestFields, true)) {
            $this->forge->addColumn('equipment_requests', [
                'wannabe_id' => ['type' => 'BIGINT', 'unsigned' => true, 'default' => 0, 'after' => 'requester_user_id'],
            ]);
            $this->forge->addKey('wannabe_id');
        }

        $loanFields = $this->db->getFieldNames('equipment_loans');
        if (! in_array('quantity', $loanFields, true)) {
            $this->forge->addColumn('equipment_loans', [
                'quantity' => ['type' => 'INT', 'unsigned' => true, 'default' => 1, 'after' => 'wannabe_id'],
            ]);
        }
    }

    public function down(): void
    {
        $requestFields = $this->db->getFieldNames('equipment_requests');
        if (in_array('wannabe_id', $requestFields, true)) {
            $this->forge->dropColumn('equipment_requests', 'wannabe_id');
        }

        $loanFields = $this->db->getFieldNames('equipment_loans');
        if (in_array('quantity', $loanFields, true)) {
            $this->forge->dropColumn('equipment_loans', 'quantity');
        }
    }
}

