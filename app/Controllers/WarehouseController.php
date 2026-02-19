<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Services\WarehouseService;

class WarehouseController extends BaseController
{
    public function __construct(private readonly WarehouseService $warehouse = new WarehouseService())
    {
    }

    public function index()
    {
        $data = $this->warehouse->data();
        $data['inspection'] = null;

        return view('warehouse/index', $data);
    }

    public function inspectPallet(int $palletId)
    {
        try {
            $data = $this->warehouse->data();
            $data['inspection'] = $this->warehouse->inspectPallet($palletId);

            return view('warehouse/index', $data);
        } catch (\Throwable $e) {
            return redirect()->to('/warehouse')->with('error', $e->getMessage());
        }
    }

    public function createPallet()
    {
        try {
            $this->warehouse->createPallet($this->request->getPost(), (int) $this->session->get('user_id'));
            return redirect()->to('/warehouse')->with('message', 'Palle opprettet.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function createSlot()
    {
        try {
            $this->warehouse->createSlot($this->request->getPost(), (int) $this->session->get('user_id'));
            return redirect()->to('/warehouse')->with('message', 'Slot opprettet.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function addEquipmentToPallet()
    {
        try {
            $this->warehouse->addEquipmentToPallet($this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/warehouse')->with('message', 'Utstyr lagt til på palle.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function deletePallet(int $palletId)
    {
        try {
            $this->warehouse->deletePallet($palletId, (int) $this->session->get('user_id'));

            return redirect()->to('/warehouse')->with('message', 'Palle slettet.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function movePallet(int $palletId)
    {
        try {
            $this->warehouse->movePallet($palletId, (int) $this->request->getPost('location_id'), (int) $this->session->get('user_id'));

            return redirect()->to('/warehouse')->with('message', 'Palle flyttet.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }
}
