<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddDistanceEstimationFields extends Migration
{
    public function up(): void
    {
        if ($this->db->tableExists('locations')) {
            $fields = [];
            if (! $this->db->fieldExists('latitude', 'locations')) {
                $fields['latitude'] = [
                    'type' => 'DECIMAL',
                    'constraint' => '10,7',
                    'null' => true,
                    'after' => 'address',
                ];
            }
            if (! $this->db->fieldExists('longitude', 'locations')) {
                $fields['longitude'] = [
                    'type' => 'DECIMAL',
                    'constraint' => '10,7',
                    'null' => true,
                    'after' => 'latitude',
                ];
            }
            if ($fields !== []) {
                $this->forge->addColumn('locations', $fields);
            }
        }

        if ($this->db->tableExists('transport_jobs')) {
            $fields = [];
            if (! $this->db->fieldExists('estimated_distance_km', 'transport_jobs')) {
                $fields['estimated_distance_km'] = [
                    'type' => 'INT',
                    'unsigned' => true,
                    'null' => true,
                    'after' => 'distance_km',
                ];
            }
            if (! $this->db->fieldExists('distance_deviation_km', 'transport_jobs')) {
                $fields['distance_deviation_km'] = [
                    'type' => 'INT',
                    'null' => true,
                    'after' => 'estimated_distance_km',
                ];
            }
            if ($fields !== []) {
                $this->forge->addColumn('transport_jobs', $fields);
            }
        }

        if ($this->db->tableExists('transport_job_stops')) {
            $fields = [];
            if (! $this->db->fieldExists('latitude', 'transport_job_stops')) {
                $fields['latitude'] = [
                    'type' => 'DECIMAL',
                    'constraint' => '10,7',
                    'null' => true,
                    'after' => 'address',
                ];
            }
            if (! $this->db->fieldExists('longitude', 'transport_job_stops')) {
                $fields['longitude'] = [
                    'type' => 'DECIMAL',
                    'constraint' => '10,7',
                    'null' => true,
                    'after' => 'latitude',
                ];
            }
            if ($fields !== []) {
                $this->forge->addColumn('transport_job_stops', $fields);
            }
        }
    }

    public function down(): void
    {
        if ($this->db->tableExists('transport_job_stops')) {
            $drop = [];
            if ($this->db->fieldExists('latitude', 'transport_job_stops')) {
                $drop[] = 'latitude';
            }
            if ($this->db->fieldExists('longitude', 'transport_job_stops')) {
                $drop[] = 'longitude';
            }
            if ($drop !== []) {
                $this->forge->dropColumn('transport_job_stops', $drop);
            }
        }

        if ($this->db->tableExists('transport_jobs')) {
            $drop = [];
            if ($this->db->fieldExists('estimated_distance_km', 'transport_jobs')) {
                $drop[] = 'estimated_distance_km';
            }
            if ($this->db->fieldExists('distance_deviation_km', 'transport_jobs')) {
                $drop[] = 'distance_deviation_km';
            }
            if ($drop !== []) {
                $this->forge->dropColumn('transport_jobs', $drop);
            }
        }

        if ($this->db->tableExists('locations')) {
            $drop = [];
            if ($this->db->fieldExists('latitude', 'locations')) {
                $drop[] = 'latitude';
            }
            if ($this->db->fieldExists('longitude', 'locations')) {
                $drop[] = 'longitude';
            }
            if ($drop !== []) {
                $this->forge->dropColumn('locations', $drop);
            }
        }
    }
}
