<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddRequesterWannabeAndJobKindToTransportJobs extends Migration
{
    public function up()
    {
        if (! $this->db->tableExists('transport_jobs')) {
            return;
        }

        $fields = [];

        if (! $this->db->fieldExists('job_kind', 'transport_jobs')) {
            $fields['job_kind'] = [
                'type' => 'VARCHAR',
                'constraint' => 50,
                'null' => true,
                'after' => 'transport_type',
            ];
        }

        if (! $this->db->fieldExists('requester_wannabe_id', 'transport_jobs')) {
            $fields['requester_wannabe_id'] = [
                'type' => 'BIGINT',
                'unsigned' => true,
                'null' => true,
                'after' => 'requester_user_id',
            ];
        }

        if ($fields !== []) {
            $this->forge->addColumn('transport_jobs', $fields);
        }

        $fieldNames = $this->db->getFieldNames('transport_jobs');
        if (in_array('requester_wannabe_id', $fieldNames, true)) {
            $this->db->query(
                'UPDATE transport_jobs tj
                 LEFT JOIN users u ON u.id = tj.requester_user_id
                 SET tj.requester_wannabe_id = u.wannabe_id
                 WHERE tj.requester_wannabe_id IS NULL
                   AND tj.requester_user_id IS NOT NULL'
            );
        }

        if (in_array('job_kind', $fieldNames, true)) {
            $this->db->query(
                "UPDATE transport_jobs
                 SET job_kind = CASE
                     WHEN transport_type = 'people' THEN 'people'
                     ELSE 'equipment'
                 END
                 WHERE job_kind IS NULL"
            );
        }
    }

    public function down()
    {
        if (! $this->db->tableExists('transport_jobs')) {
            return;
        }

        $fieldNames = $this->db->getFieldNames('transport_jobs');
        $drop = [];

        if (in_array('requester_wannabe_id', $fieldNames, true)) {
            $drop[] = 'requester_wannabe_id';
        }

        if (in_array('job_kind', $fieldNames, true)) {
            $drop[] = 'job_kind';
        }

        if ($drop !== []) {
            $this->forge->dropColumn('transport_jobs', $drop);
        }
    }
}
