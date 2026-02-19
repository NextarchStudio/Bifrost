<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Services\EquipmentCategoryService;

class EquipmentCategoriesController extends BaseController
{
    public function __construct(private readonly EquipmentCategoryService $categories = new EquipmentCategoryService())
    {
    }

    public function index()
    {
        return view('categories/index', [
            'categories' => $this->categories->list(),
        ]);
    }

    public function create()
    {
        try {
            $this->categories->create($this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/categories')->with('message', 'Kategori opprettet.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function delete(int $categoryId)
    {
        try {
            $this->categories->delete($categoryId, (int) $this->session->get('user_id'));

            return redirect()->to('/categories')->with('message', 'Kategori slettet.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }
}

