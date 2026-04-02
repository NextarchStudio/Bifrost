<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Services\BarcodeTemplateService;

class BarcodesController extends BaseController
{
    public function __construct(private readonly BarcodeTemplateService $barcodes = new BarcodeTemplateService())
    {
    }

    public function index()
    {
        requireRole(['developer', 'chief', 'co-chief', 'logistikk']);

        return view('barcodes/index');
    }

    public function export()
    {
        try {
            requireRole(['developer', 'chief', 'co-chief', 'logistikk']);

            $export = $this->barcodes->buildExport($this->request->getPost());

            return $this->response
                ->setHeader('Content-Type', $export['mime'])
                ->download($export['filename'], $export['content']);
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }
}
