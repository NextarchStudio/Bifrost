<?php
declare(strict_types=1);

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class SampleWarehouseSeeder extends Seeder
{
    public function run(): void
    {
        $main = $this->db->table('locations')->where('name', 'Main Warehouse')->get()->getFirstRow();
        if ($main === null) {
            $this->db->table('locations')->insert(['name' => 'Main Warehouse', 'type' => 'lager']);
            $mainId = (int) $this->db->insertID();
        } else {
            $mainId = (int) $main->id;
        }

        $pallet = $this->db->table('pallets')->where('name', 'Pallet-A')->get()->getFirstRow();
        if ($pallet === null) {
            $this->db->table('pallets')->insert(['location_id' => $mainId, 'name' => 'Pallet-A', 'qr_code' => 'PALLET-A']);
            $palletId = (int) $this->db->insertID();
        } else {
            $palletId = (int) $pallet->id;
        }

        $slot = $this->db->table('pallet_slots')->where('pallet_id', $palletId)->where('slot_number', 1)->get()->getFirstRow();
        if ($slot === null) {
            $this->db->table('pallet_slots')->insert(['pallet_id' => $palletId, 'slot_number' => 1, 'status' => 'available']);
            $slotId = (int) $this->db->insertID();
        } else {
            $slotId = (int) $slot->id;
        }

        $equipment = $this->db->table('equipment')->where('serial_number', 'SN-TG-0001')->get()->getFirstRow();
        if ($equipment === null) {
            $now = date('Y-m-d H:i:s');
            $this->db->table('equipment')->insert([
                'name'          => 'Stage Light 1',
                'category'      => 'Lighting',
                'serial_number' => 'SN-TG-0001',
                'status'        => 'available',
                'pallet_slot_id'=> $slotId,
                'notes'         => 'Seeded example item',
                'created_at'    => $now,
                'updated_at'    => $now,
            ]);
        }
    }
}

