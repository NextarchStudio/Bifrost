<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Services\ShopService;

class ShopController extends BaseController
{
    public function __construct(private readonly ShopService $shop = new ShopService())
    {
    }

    public function index()
    {
        $data = $this->shop->data();
        $data['checkoutNote'] = $this->shop->checkoutLabelForUser((int) $this->session->get('user_id'));
        $data['checkinNote'] = $this->shop->checkinLabelForUser((int) $this->session->get('user_id'));

        return view('shop/index', $data);
    }

    public function exportExcel()
    {
        $items = $this->shop->data()['items'] ?? [];
        $filename = 'varelager-' . date('Y-m-d-His') . '.csv';
        $lines = [
            $this->csvLine(['ID', 'Vare', 'Kategori', 'Storrelse', 'Antall', 'Notater']),
        ];

        foreach ($items as $item) {
            $lines[] = $this->csvLine([
                (string) $item->id,
                (string) $item->name,
                (string) $item->category_name,
                (string) ($item->size ?: '-'),
                (string) $item->quantity,
                (string) ($item->notes ?: '-'),
            ]);
        }

        $csv = implode("\r\n", $lines) . "\r\n";

        return $this->response
            ->setHeader('Content-Type', 'text/csv; charset=UTF-8')
            ->setHeader('Content-Disposition', 'attachment; filename="' . $filename . '"')
            ->setBody("\xEF\xBB\xBF" . $csv);
    }

    public function exportPdf()
    {
        $items = $this->shop->data()['items'] ?? [];
        $filename = 'varelager-' . date('Y-m-d-His') . '.pdf';
        $lines = ['Varelager', ''];
        $lines[] = sprintf('%-6s %-28s %-18s %-12s %-8s %s', 'ID', 'Vare', 'Kategori', 'Storrelse', 'Antall', 'Notater');
        $lines[] = str_repeat('-', 110);

        foreach ($items as $item) {
            $lines[] = sprintf(
                '%-6s %-28s %-18s %-12s %-8s %s',
                $this->pdfText((string) $item->id, 6),
                $this->pdfText((string) $item->name, 28),
                $this->pdfText((string) $item->category_name, 18),
                $this->pdfText((string) ($item->size ?: '-'), 12),
                $this->pdfText((string) $item->quantity, 8),
                $this->pdfText((string) ($item->notes ?: '-'), 40)
            );
        }

        $pdf = $this->buildSimplePdf($lines);

        return $this->response
            ->setHeader('Content-Type', 'application/pdf')
            ->setHeader('Content-Disposition', 'attachment; filename="' . $filename . '"')
            ->setBody($pdf);
    }

    public function createCategory()
    {
        try {
            $this->shop->createCategory($this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/shop')->with('message', 'Kategori opprettet.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function createItem()
    {
        try {
            $this->shop->createItem($this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/shop')->with('message', 'Vare opprettet.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function importExcel()
    {
        try {
            $summary = $this->shop->importExcel(
                $this->request->getFile('inventory_file'),
                (int) $this->session->get('user_id')
            );

            return redirect()->to('/shop')->with('message', sprintf(
                'Import fullført. %d nye varer, %d innsjekker, %d utsjekker, %d uendrede.',
                $summary['created'],
                $summary['checked_in'],
                $summary['checked_out'],
                $summary['unchanged']
            ));
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function checkOut(int $itemId)
    {
        try {
            $this->shop->checkOut($itemId, $this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/shop')->with('message', 'Vare sjekket ut.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function checkIn(int $itemId)
    {
        try {
            $this->shop->checkIn($itemId, $this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/shop')->with('message', 'Vare sjekket inn.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function deleteItem(int $itemId)
    {
        try {
            $this->shop->deleteItem($itemId, (int) $this->session->get('user_id'));

            return redirect()->to('/shop')->with('message', 'Vare slettet.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    private function pdfText(string $value, int $limit): string
    {
        $value = trim(preg_replace('/\s+/', ' ', $value) ?? '');
        if ($value === '') {
            return '-';
        }

        return mb_strlen($value) > $limit
            ? mb_substr($value, 0, max(1, $limit - 1)) . '...'
            : $value;
    }

    private function csvLine(array $values): string
    {
        $escaped = array_map(static function (string $value): string {
            $value = str_replace('"', '""', $value);

            return '"' . $value . '"';
        }, $values);

        return implode(';', $escaped);
    }

    private function buildSimplePdf(array $lines): string
    {
        $pageHeight = 842;
        $marginTop = 40;
        $lineHeight = 14;
        $linesPerPage = 50;
        $chunks = array_chunk($lines, $linesPerPage);
        $objects = [];

        $objects[] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>';

        $pageIds = [];
        $contentIds = [];

        foreach ($chunks as $chunk) {
            $content = "BT\n/F1 10 Tf\n";
            $y = $pageHeight - $marginTop;

            foreach ($chunk as $line) {
                $escaped = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $this->toPdfEncoding($line));
                $content .= sprintf("1 0 0 1 40 %d Tm\n(%s) Tj\n", $y, $escaped);
                $y -= $lineHeight;
            }

            $content .= "ET";
            $stream = "<< /Length " . strlen($content) . " >>\nstream\n" . $content . "\nendstream";
            $objects[] = $stream;
            $contentIds[] = count($objects);

            $objects[] = '';
            $pageIds[] = count($objects);
        }

        $pagesId = count($objects) + 1;

        foreach ($pageIds as $index => $pageId) {
            $contentId = $contentIds[$index];
            $objects[$pageId - 1] = "<< /Type /Page /Parent {$pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 1 0 R >> >> /Contents {$contentId} 0 R >>";
        }

        $kids = implode(' ', array_map(static fn (int $id): string => $id . ' 0 R', $pageIds));
        $objects[] = "<< /Type /Pages /Kids [{$kids}] /Count " . count($pageIds) . " >>";
        $catalogId = count($objects) + 1;
        $objects[] = "<< /Type /Catalog /Pages {$pagesId} 0 R >>";

        $pdf = "%PDF-1.4\n";
        $offsets = [0];

        foreach ($objects as $index => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($index + 1) . " 0 obj\n" . $object . "\nendobj\n";
        }

        $xrefOffset = strlen($pdf);
        $pdf .= "xref\n0 " . (count($objects) + 1) . "\n";
        $pdf .= "0000000000 65535 f \n";

        for ($i = 1; $i <= count($objects); $i++) {
            $pdf .= sprintf("%010d 00000 n \n", $offsets[$i]);
        }

        $pdf .= "trailer\n<< /Size " . (count($objects) + 1) . " /Root {$catalogId} 0 R >>\n";
        $pdf .= "startxref\n{$xrefOffset}\n%%EOF";

        return $pdf;
    }

    private function toPdfEncoding(string $text): string
    {
        $converted = @iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $text);

        return $converted !== false ? $converted : preg_replace('/[^\x20-\x7E]/', '?', $text);
    }
}
