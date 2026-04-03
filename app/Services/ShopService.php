<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\UserRepository;
use App\Repositories\ShopRepository;
use CodeIgniter\HTTP\Files\UploadedFile;

class ShopService
{
    private const SIZE_OPTIONS = [
        'XXS',
        'XS',
        'S',
        'M',
        'L',
        'XL',
        'XXL',
        'XXXL',
        'XXXXL',
        'XXXXXL',
        'XXXXXXL',
    ];

    public function __construct(
        private readonly ShopRepository $shop = new ShopRepository(),
        private readonly UserRepository $users = new UserRepository(),
        private readonly AuditService $audit = new AuditService()
    ) {
    }

    public function data(): array
    {
        $this->pruneOldDiscontinuedItems();

        return [
            'items' => $this->shop->itemsWithCategory(),
            'categories' => $this->shop->categories(),
            'movements' => $this->shop->recentMovements(),
            'sizeOptions' => self::SIZE_OPTIONS,
        ];
    }

    public function createCategory(array $input, int $actorUserId): int
    {
        $rules = ['name' => 'required|max_length[80]'];
        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException('Ugyldig kategori.');
        }

        $name = mb_substr(trim(strip_tags((string) $input['name'])), 0, 80);
        if ($name === '') {
            throw new \InvalidArgumentException('Kategori er paakrevd.');
        }

        $existing = $this->shop->findCategoryByName($name);
        if ($existing !== null) {
            return (int) $existing['id'];
        }

        $id = $this->shop->createCategory($name);
        $this->audit->log($actorUserId, 'create', 'shop_category', $id, ['name' => $name]);

        return $id;
    }

    public function createItem(array $input, int $actorUserId): int
    {
        $data = $this->validateItem($input, $actorUserId, true);
        $itemId = $this->shop->createItem([
            ...$data,
            'status' => $data['quantity'] > 0 ? 'active' : 'discontinued',
            'discontinued_at' => $data['quantity'] > 0 ? null : date('Y-m-d H:i:s'),
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        if ($data['quantity'] > 0) {
            $this->shop->insertMovement([
                'shop_item_id' => $itemId,
                'actor_user_id' => $actorUserId,
                'movement_type' => 'checkin',
                'quantity' => (int) $data['quantity'],
                'notes' => 'Initial lagerbeholdning',
                'created_at' => date('Y-m-d H:i:s'),
            ]);
        }

        $this->audit->log($actorUserId, 'create', 'shop_item', $itemId, $data);

        return $itemId;
    }

    public function importExcel(?UploadedFile $file, int $actorUserId): array
    {
        if ($file === null || $file->getError() === UPLOAD_ERR_NO_FILE) {
            throw new \InvalidArgumentException('Velg en Excel-fil som skal importeres.');
        }

        if (! $file->isValid()) {
            throw new \InvalidArgumentException('Importfilen kunne ikke lastes opp.');
        }

        $extension = strtolower((string) $file->getClientExtension());
        if (! in_array($extension, ['xlsx', 'csv', 'xls'], true)) {
            throw new \InvalidArgumentException('Bare XLSX, XLS og CSV er tillatt for import.');
        }

        $rows = $this->parseImportFile($file);
        if ($rows === []) {
            throw new \InvalidArgumentException('Fant ingen varer i importfilen.');
        }

        $summary = [
            'created' => 0,
            'checked_in' => 0,
            'checked_out' => 0,
            'unchanged' => 0,
        ];
        $now = date('Y-m-d H:i:s');

        foreach ($rows as $row) {
            $importedId = max(0, (int) ($row['id'] ?? 0));
            $categoryId = $this->resolveImportCategoryId($row['category'] ?? 'Ukjent', $actorUserId);
            $name = mb_substr(trim($row['name'] ?? ''), 0, 150);
            $size = $this->normalizeImportedSize($row['size'] ?? null);
            $quantity = max(0, (int) ($row['quantity'] ?? 0));
            $notes = $this->normalizeImportNotes($row['notes'] ?? null);

            if ($name === '') {
                continue;
            }

            $existing = $importedId > 0 ? $this->shop->findItemById($importedId) : null;
            if ($existing === null) {
                $existing = $this->shop->findItemBySignature($categoryId, $name, $size);
            }

            if ($existing === null) {
                $itemId = $this->shop->createItem([
                    'category_id' => $categoryId,
                    'name' => $name,
                    'size' => $size,
                    'quantity' => $quantity,
                    'status' => $quantity > 0 ? 'active' : 'discontinued',
                    'discontinued_at' => $quantity > 0 ? null : $now,
                    'notes' => $notes,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                if ($quantity > 0) {
                    $this->shop->insertMovement([
                        'shop_item_id' => $itemId,
                        'actor_user_id' => $actorUserId,
                        'movement_type' => 'checkin',
                        'quantity' => $quantity,
                        'notes' => 'Excel-import: ny vare opprettet',
                        'created_at' => $now,
                    ]);
                    $summary['created']++;
                } else {
                    $summary['created']++;
                }

                $this->audit->log($actorUserId, 'import_create', 'shop_item', $itemId, [
                    'category_id' => $categoryId,
                    'name' => $name,
                    'size' => $size,
                    'quantity' => $quantity,
                ]);

                continue;
            }

            $currentQty = max(0, (int) ($existing->quantity ?? 0));
            if ($quantity === $currentQty) {
                $summary['unchanged']++;
                continue;
            }

            $this->shop->updateItemById((int) $existing->id, [
                'quantity' => $quantity,
                'status' => $quantity > 0 ? 'active' : 'discontinued',
                'discontinued_at' => $quantity > 0 ? null : $now,
                'notes' => $notes ?? $existing->notes,
                'updated_at' => $now,
            ]);

            if ($quantity > $currentQty) {
                $diff = $quantity - $currentQty;
                $this->shop->insertMovement([
                    'shop_item_id' => (int) $existing->id,
                    'actor_user_id' => $actorUserId,
                    'movement_type' => 'checkin',
                    'quantity' => $diff,
                    'notes' => 'Excel-import: justert opp fra varetelling',
                    'created_at' => $now,
                ]);
                $summary['checked_in']++;
            } else {
                $diff = $currentQty - $quantity;
                $this->shop->insertMovement([
                    'shop_item_id' => (int) $existing->id,
                    'actor_user_id' => $actorUserId,
                    'movement_type' => 'checkout',
                    'quantity' => $diff,
                    'notes' => 'Excel-import: justert ned fra varetelling',
                    'created_at' => $now,
                ]);
                $summary['checked_out']++;
            }

            $this->audit->log($actorUserId, 'import_adjust', 'shop_item', (int) $existing->id, [
                'from_quantity' => $currentQty,
                'to_quantity' => $quantity,
            ]);
        }

        return $summary;
    }

    public function checkOut(int $itemId, array $input, int $actorUserId): void
    {
        $movement = $this->validateMovement($input);
        $item = $this->shop->findItemById($itemId);
        if ($item === null) {
            throw new \InvalidArgumentException('Vare finnes ikke.');
        }

        $currentQty = max(0, (int) $item->quantity);
        if ($movement['quantity'] > $currentQty) {
            throw new \InvalidArgumentException('Kan ikke sjekke ut mer enn det som er paa lager.');
        }

        $newQty = $currentQty - $movement['quantity'];
        $this->shop->updateItemById($itemId, [
            'quantity' => $newQty,
            'status' => $newQty > 0 ? 'active' : 'discontinued',
            'discontinued_at' => $newQty > 0 ? null : date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        $movementId = $this->shop->insertMovement([
            'shop_item_id' => $itemId,
            'actor_user_id' => $actorUserId,
            'movement_type' => 'checkout',
            'quantity' => $movement['quantity'],
            'notes' => $this->checkoutLabelForUser($actorUserId),
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        $this->audit->log($actorUserId, 'checkout', 'shop_item', $itemId, [
            'movement_id' => $movementId,
            'quantity' => $movement['quantity'],
            'notes' => $this->checkoutLabelForUser($actorUserId),
            'remaining_quantity' => $newQty,
        ]);
    }

    public function checkIn(int $itemId, array $input, int $actorUserId): void
    {
        $movement = $this->validateMovement($input);
        $item = $this->shop->findItemById($itemId);
        if ($item === null) {
            throw new \InvalidArgumentException('Vare finnes ikke.');
        }

        $newQty = max(0, (int) $item->quantity) + $movement['quantity'];
        $this->shop->updateItemById($itemId, [
            'quantity' => $newQty,
            'status' => $newQty > 0 ? 'active' : 'discontinued',
            'discontinued_at' => $newQty > 0 ? null : ((string) ($item->discontinued_at ?? '') !== '' ? $item->discontinued_at : date('Y-m-d H:i:s')),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        $movementId = $this->shop->insertMovement([
            'shop_item_id' => $itemId,
            'actor_user_id' => $actorUserId,
            'movement_type' => 'checkin',
            'quantity' => $movement['quantity'],
            'notes' => $this->checkinLabelForUser($actorUserId),
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        $this->audit->log($actorUserId, 'checkin', 'shop_item', $itemId, [
            'movement_id' => $movementId,
            'quantity' => $movement['quantity'],
            'notes' => $this->checkinLabelForUser($actorUserId),
            'new_quantity' => $newQty,
        ]);
    }

    public function deleteItem(int $itemId, int $actorUserId): void
    {
        $item = $this->shop->findItemById($itemId);
        if ($item === null) {
            throw new \InvalidArgumentException('Vare finnes ikke.');
        }

        $movementCount = $this->shop->countMovementsForItem($itemId);
        if ($movementCount > 0) {
            $this->shop->deleteMovementsForItem($itemId);
        }

        $this->shop->deleteItemById($itemId);
        $this->audit->log($actorUserId, 'delete', 'shop_item', $itemId, [
            'name' => (string) $item->name,
            'size' => $item->size !== null ? (string) $item->size : null,
            'quantity' => (int) $item->quantity,
            'deleted_movements' => $movementCount,
        ]);
    }

    private function validateItem(array $input, int $actorUserId, bool $allowNewCategory): array
    {
        $rules = [
            'name' => 'required|min_length[2]|max_length[150]',
            'category_id' => 'permit_empty|integer',
            'new_category' => 'permit_empty|max_length[80]',
            'size' => 'permit_empty|max_length[20]',
            'quantity' => 'required|integer|greater_than_equal_to[0]',
            'notes' => 'permit_empty|max_length[4000]',
        ];

        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException(implode(' ', service('validation')->getErrors()));
        }

        $categoryId = $this->resolveCategoryId($input, $actorUserId, $allowNewCategory);
        $size = $this->normalizeSize((string) ($input['size'] ?? ''));

        return [
            'category_id' => $categoryId,
            'name' => mb_substr(trim(strip_tags((string) $input['name'])), 0, 150),
            'size' => $size,
            'quantity' => (int) $input['quantity'],
            'notes' => ! empty($input['notes']) ? mb_substr(trim(strip_tags((string) $input['notes'])), 0, 4000) : null,
        ];
    }

    private function resolveCategoryId(array $input, int $actorUserId, bool $allowNewCategory): int
    {
        $newCategory = mb_substr(trim(strip_tags((string) ($input['new_category'] ?? ''))), 0, 80);
        if ($allowNewCategory && $newCategory !== '') {
            $existing = $this->shop->findCategoryByName($newCategory);

            if ($existing !== null) {
                return (int) $existing['id'];
            }

            $id = $this->shop->createCategory($newCategory);
            $this->audit->log($actorUserId, 'create', 'shop_category', $id, ['name' => $newCategory]);

            return $id;
        }

        $categoryId = (int) ($input['category_id'] ?? 0);
        if ($categoryId < 1) {
            throw new \InvalidArgumentException('Velg en kategori eller opprett en ny.');
        }

        $category = $this->shop->findCategoryById($categoryId);
        if ($category === null) {
            throw new \InvalidArgumentException('Kategori finnes ikke.');
        }

        return $categoryId;
    }

    private function normalizeSize(string $size): ?string
    {
        $size = mb_strtoupper(trim(strip_tags($size)));
        if ($size === '') {
            return null;
        }

        if (! in_array($size, self::SIZE_OPTIONS, true)) {
            throw new \InvalidArgumentException('Ugyldig storrelse.');
        }

        return $size;
    }

    private function validateMovement(array $input): array
    {
        $rules = [
            'quantity' => 'required|integer|greater_than[0]',
            'notes' => 'permit_empty|max_length[255]',
        ];

        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException(implode(' ', service('validation')->getErrors()));
        }

        return [
            'quantity' => (int) $input['quantity'],
            'notes' => ! empty($input['notes']) ? mb_substr(trim(strip_tags((string) $input['notes'])), 0, 255) : null,
        ];
    }

    public function checkoutLabelForUser(int $actorUserId): string
    {
        $user = $this->users->findById($actorUserId);
        if ($user === null) {
            return 'Utsjekket av ukjent bruker';
        }

        $name = trim((string) (($user->first_name ?? '') . ' ' . ($user->last_name ?? '')));
        if ($name === '') {
            $name = trim((string) ($user->name ?? ''));
        }

        return $name !== '' ? 'Utsjekket av ' . $name : 'Utsjekket av bruker #' . $actorUserId;
    }

    public function checkinLabelForUser(int $actorUserId): string
    {
        $user = $this->users->findById($actorUserId);
        if ($user === null) {
            return 'Innsjekket av ukjent bruker';
        }

        $name = trim((string) (($user->first_name ?? '') . ' ' . ($user->last_name ?? '')));
        if ($name === '') {
            $name = trim((string) ($user->name ?? ''));
        }

        return $name !== '' ? 'Innsjekket av ' . $name : 'Innsjekket av bruker #' . $actorUserId;
    }

    private function parseImportFile(UploadedFile $file): array
    {
        $extension = strtolower((string) $file->getClientExtension());

        return match ($extension) {
            'xlsx' => $this->parseXlsxFile($file->getTempName()),
            'csv' => $this->parseCsvFile($file->getTempName()),
            'xls' => $this->parseHtmlTableFile($file->getTempName()),
            default => [],
        };
    }

    private function parseXlsxFile(string $path): array
    {
        if (! class_exists(\ZipArchive::class)) {
            throw new \RuntimeException('Serveren mangler ZipArchive og kan ikke lese XLSX-filer.');
        }

        $zip = new \ZipArchive();
        if ($zip->open($path) !== true) {
            throw new \InvalidArgumentException('Kunne ikke åpne XLSX-filen.');
        }

        $sharedStrings = [];
        $sharedStringsXml = $zip->getFromName('xl/sharedStrings.xml');
        if (is_string($sharedStringsXml) && $sharedStringsXml !== '') {
            $xml = simplexml_load_string($this->stripXmlNamespaces($sharedStringsXml));
            if ($xml !== false) {
                foreach ($xml->si as $item) {
                    $text = '';
                    if (isset($item->t)) {
                        $text = (string) $item->t;
                    } else {
                        foreach ($item->r as $run) {
                            $text .= (string) ($run->t ?? '');
                        }
                    }
                    $sharedStrings[] = $text;
                }
            }
        }

        $sheetXml = $zip->getFromName('xl/worksheets/sheet1.xml');
        $zip->close();

        if (! is_string($sheetXml) || $sheetXml === '') {
            throw new \InvalidArgumentException('Fant ikke første ark i XLSX-filen.');
        }

        $xml = simplexml_load_string($this->stripXmlNamespaces($sheetXml));
        if ($xml === false) {
            throw new \InvalidArgumentException('Kunne ikke lese innholdet i XLSX-filen.');
        }

        $rows = [];
        foreach ($xml->sheetData->row as $row) {
            $cells = [];
            foreach ($row->c as $cell) {
                $reference = (string) ($cell['r'] ?? '');
                $column = preg_replace('/\d+/', '', $reference) ?? '';
                $type = (string) ($cell['t'] ?? '');
                $value = '';

                if ($type === 'inlineStr') {
                    if (isset($cell->is->t)) {
                        $value = (string) $cell->is->t;
                    } else {
                        foreach (($cell->is->r ?? []) as $run) {
                            $value .= (string) ($run->t ?? '');
                        }
                    }
                } else {
                    $value = (string) ($cell->v ?? '');
                }

                if ($type === 's') {
                    $value = $sharedStrings[(int) $value] ?? '';
                }

                $cells[$column] = trim($value);
            }
            if ($cells !== []) {
                $rows[] = $cells;
            }
        }

        return $this->mapImportedRows($rows);
    }

    private function parseCsvFile(string $path): array
    {
        $handle = fopen($path, 'rb');
        if ($handle === false) {
            throw new \InvalidArgumentException('Kunne ikke lese CSV-filen.');
        }

        $rows = [];
        while (($row = fgetcsv($handle, 0, ';')) !== false) {
            if ($row === [null] || $row === false) {
                continue;
            }

            if (count($row) === 1) {
                $row = str_getcsv((string) $row[0], ',');
            }

            $mapped = [];
            foreach ($row as $index => $value) {
                $mapped[$this->columnLettersFromIndex($index)] = trim((string) $value);
            }
            $rows[] = $mapped;
        }

        fclose($handle);

        return $this->mapImportedRows($rows);
    }

    private function parseHtmlTableFile(string $path): array
    {
        $html = (string) file_get_contents($path);
        if (trim($html) === '') {
            return [];
        }

        $dom = new \DOMDocument();
        @$dom->loadHTML($html);
        $trs = $dom->getElementsByTagName('tr');
        $rows = [];

        foreach ($trs as $tr) {
            $mapped = [];
            $cells = [];
            foreach ($tr->childNodes as $child) {
                if (! in_array(strtolower($child->nodeName), ['td', 'th'], true)) {
                    continue;
                }
                $cells[] = trim($child->textContent ?? '');
            }

            foreach ($cells as $index => $value) {
                $mapped[$this->columnLettersFromIndex($index)] = $value;
            }

            if ($mapped !== []) {
                $rows[] = $mapped;
            }
        }

        return $this->mapImportedRows($rows);
    }

    private function mapImportedRows(array $rows): array
    {
        if ($rows === []) {
            return [];
        }

        $headerRow = array_shift($rows);
        $headers = [];
        foreach ($headerRow as $column => $value) {
            $headers[$column] = $this->normalizeHeader($value);
        }

        $mappedRows = [];
        foreach ($rows as $row) {
            $mapped = [
                'name' => '',
                'category' => '',
                'size' => '',
                'quantity' => 0,
                'notes' => null,
            ];

            foreach ($row as $column => $value) {
                $header = $headers[$column] ?? null;
                if ($header === null) {
                    continue;
                }

                if ($header === 'quantity') {
                    $mapped['quantity'] = (int) preg_replace('/[^\d-]/', '', (string) $value);
                    continue;
                }

                $mapped[$header] = trim((string) $value);
            }

            if (trim((string) $mapped['name']) === '') {
                continue;
            }

            $mappedRows[] = $mapped;
        }

        return $mappedRows;
    }

    private function normalizeHeader(string $header): ?string
    {
        $value = mb_strtolower(trim($header));
        $value = str_replace(['æ', 'ø', 'å'], ['ae', 'o', 'a'], $value);

        return match ($value) {
            'id' => 'id',
            'vare', 'varenavn', 'name', 'item', 'produkt' => 'name',
            'kategori', 'category' => 'category',
            'storrelse', 'størrelse', 'size' => 'size',
            'antall', 'quantity', 'count' => 'quantity',
            'notater', 'notat', 'notes' => 'notes',
            default => null,
        };
    }

    private function resolveImportCategoryId(string $categoryName, int $actorUserId): int
    {
        $categoryName = mb_substr(trim(strip_tags($categoryName)), 0, 80);
        if ($categoryName === '') {
            $categoryName = 'Ukjent';
        }

        $existing = $this->shop->findCategoryByName($categoryName);
        if ($existing !== null) {
            return (int) $existing['id'];
        }

        $id = $this->shop->createCategory($categoryName);
        $this->audit->log($actorUserId, 'create', 'shop_category', $id, ['name' => $categoryName]);

        return $id;
    }

    private function normalizeImportedSize(?string $size): ?string
    {
        $size = trim((string) $size);
        if ($size === '' || $size === '-') {
            return null;
        }

        $upper = mb_strtoupper($size);
        if (in_array($upper, self::SIZE_OPTIONS, true)) {
            return $upper;
        }

        return mb_substr($size, 0, 20);
    }

    private function normalizeImportNotes(?string $notes): ?string
    {
        $notes = trim((string) $notes);

        return $notes !== '' ? mb_substr(strip_tags($notes), 0, 4000) : null;
    }

    private function columnLettersFromIndex(int $index): string
    {
        $index += 1;
        $letters = '';

        while ($index > 0) {
            $index--;
            $letters = chr(65 + ($index % 26)) . $letters;
            $index = intdiv($index, 26);
        }

        return $letters;
    }

    private function stripXmlNamespaces(string $xml): string
    {
        return preg_replace('/\sxmlns(:\w+)?="[^"]*"/i', '', $xml) ?? $xml;
    }

    private function pruneOldDiscontinuedItems(): void
    {
        $cutoff = date('Y-m-d H:i:s', strtotime('-1 year'));
        $items = $this->shop->oldDiscontinuedItems($cutoff);

        foreach ($items as $item) {
            $itemId = (int) ($item->id ?? 0);
            if ($itemId < 1) {
                continue;
            }

            if ($this->shop->countMovementsForItem($itemId) > 0) {
                $this->shop->deleteMovementsForItem($itemId);
            }

            $this->shop->deleteItemById($itemId);
        }
    }
}
