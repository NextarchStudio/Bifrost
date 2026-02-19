<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Services\SearchService;

class SearchController extends BaseController
{
    public function __construct(private readonly SearchService $search = new SearchService())
    {
    }

    public function index()
    {
        $term = (string) $this->request->getGet('q');
        return $this->response->setJSON($this->search->search($term));
    }
}

