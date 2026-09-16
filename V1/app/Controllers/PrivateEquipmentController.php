<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Services\PrivateEquipmentService;

class PrivateEquipmentController extends BaseController
{
    public function __construct(private readonly PrivateEquipmentService $privateEquipment = new PrivateEquipmentService())
    {
    }

    public function index()
    {
        requireRole(['developer', 'chief', 'co-chief', 'logistikk']);

        return view('private_equipment/index', $this->privateEquipment->pageData());
    }

    public function create()
    {
        try {
            requireRole(['developer', 'chief', 'co-chief', 'logistikk']);
            $this->privateEquipment->create((array) $this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/privat-utstyr')->with('message', 'Privat utstyr-regel lagt til.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function delete(int $id)
    {
        try {
            requireRole(['developer', 'chief', 'co-chief', 'logistikk']);
            $this->privateEquipment->delete($id, (int) $this->session->get('user_id'));

            return redirect()->to('/privat-utstyr')->with('message', 'Privat utstyr-regel slettet.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }
}
