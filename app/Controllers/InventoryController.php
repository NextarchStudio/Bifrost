<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Services\InventoryService;
use App\Services\EquipmentCategoryService;

class InventoryController extends BaseController
{
    public function __construct(
        private readonly InventoryService $inventory = new InventoryService(),
        private readonly EquipmentCategoryService $categories = new EquipmentCategoryService()
    ) {
    }

    public function index()
    {
        return view('inventory/index', [
            'equipment' => $this->inventory->list(),
            'categories'=> $this->categories->list(),
        ]);
    }

    public function create()
    {
        try {
            $this->inventory->create($this->request->getPost(), (int) $this->session->get('user_id'));
            return redirect()->to('/equipment')->with('message', 'Utstyr opprettet.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function move(int $equipmentId)
    {
        try {
            $this->inventory->move($equipmentId, $this->request->getPost(), (int) $this->session->get('user_id'));
            return redirect()->to('/equipment')->with('message', 'Utstyr flyttet.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function changeStatus(int $equipmentId)
    {
        try {
            $this->inventory->changeStatus($equipmentId, (string) $this->request->getPost('status'), (int) $this->session->get('user_id'));
            return redirect()->to('/equipment')->with('message', 'Status oppdatert.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function delete(int $equipmentId)
    {
        try {
            $this->inventory->delete($equipmentId, (int) $this->session->get('user_id'));
            return redirect()->to('/equipment')->with('message', 'Utstyr slettet.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }
}
