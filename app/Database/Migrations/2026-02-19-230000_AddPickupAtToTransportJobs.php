<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddPickupAtToTransportJobs extends Migration
{
    public function up(): void
    {
        $fields = $this->db->getFieldNames('transport_jobs');
        if (in_array('pickup_at', $fields, true)) {
            return;
        }

        $this->forge->addColumn('transport_jobs', [
            'pickup_at' => [
                'type' => 'DATETIME',
                'null' => true,
                'after' => 'people_count',
            ],
        ]);
    }

    public function down(): void
    {
        $fields = $this->db->getFieldNames('transport_jobs');
        if (! in_array('pickup_at', $fields, true)) {
            return;
        }

        $this->forge->dropColumn('transport_jobs', 'pickup_at');
    }
}
