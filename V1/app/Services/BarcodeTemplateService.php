<?php
declare(strict_types=1);

namespace App\Services;

use RuntimeException;

class BarcodeTemplateService
{
    /**
     * @return list<string>
     */
    public function parseCodes(string $rawCodes): array
    {
        $lines = preg_split('/\r\n|\r|\n/', $rawCodes) ?: [];
        $codes = [];

        foreach ($lines as $line) {
            $code = trim($line);
            if ($code === '') {
                continue;
            }

            $codes[] = $code;
        }

        if ($codes === []) {
            throw new RuntimeException('Legg inn minst ett strekkodenummer.');
        }

        return $codes;
    }

    /**
     * @param array<string, mixed> $input
     * @return list<string>
     */
    public function collectCodes(array $input): array
    {
        $codes = [];
        $rawCodes = trim((string) ($input['codes'] ?? ''));
        $rangeStart = trim((string) ($input['range_start'] ?? ''));
        $rangeEnd = trim((string) ($input['range_end'] ?? ''));

        if ($rawCodes !== '') {
            $codes = [...$codes, ...$this->parseCodes($rawCodes)];
        }

        if ($rangeStart !== '' || $rangeEnd !== '') {
            if ($rangeStart === '' || $rangeEnd === '') {
                throw new RuntimeException('Fyll inn både fra-kode og til-kode for å lage en serie.');
            }

            $codes = [...$codes, ...$this->buildRange($rangeStart, $rangeEnd)];
        }

        $codes = array_values(array_unique($codes));
        if ($codes === []) {
            throw new RuntimeException('Legg inn minst ett strekkodenummer eller et intervall.');
        }

        return $codes;
    }

    /**
     * @param array<string, mixed> $input
     * @return array{filename:string, content:string, mime:string}
     */
    public function buildExport(array $input): array
    {
        $codes = $this->collectCodes($input);
        $filename = $this->buildExportFilename((string) ($input['filename'] ?? ''));

        return [
            'filename' => $filename . '.udl',
            'content' => $this->buildUdlExport($codes),
            'mime' => 'text/plain; charset=UTF-8',
        ];
    }

    /**
     * @param list<string> $codes
     */
    private function buildUdlExport(array $codes): string
    {
        return "\xEF\xBB\xBF" . implode("\r\n", $codes) . "\r\n";
    }

    private function buildExportFilename(string $requestedFilename): string
    {
        $requestedFilename = trim($requestedFilename);
        if ($requestedFilename === '') {
            return 'strekkoder-' . date('Ymd-His');
        }

        $sanitized = preg_replace('/[^A-Za-z0-9._-]+/', '-', $requestedFilename) ?? '';
        $sanitized = trim($sanitized, '-._');

        return $sanitized !== '' ? $sanitized : 'strekkoder-' . date('Ymd-His');
    }

    /**
     * @return list<string>
     */
    private function buildRange(string $startCode, string $endCode): array
    {
        $pattern = '/^(.*?)(\d+)([^0-9]*)$/';
        if (! preg_match($pattern, $startCode, $startMatches) || ! preg_match($pattern, $endCode, $endMatches)) {
            throw new RuntimeException('Intervall må slutte med tall, for eksempel TG26-0001 til TG26-0020.');
        }

        [, $startPrefix, $startNumberRaw, $startSuffix] = $startMatches;
        [, $endPrefix, $endNumberRaw, $endSuffix] = $endMatches;

        if ($startPrefix !== $endPrefix || $startSuffix !== $endSuffix) {
            throw new RuntimeException('Fra-kode og til-kode må ha samme tekst før og etter tallene.');
        }

        $startNumber = (int) $startNumberRaw;
        $endNumber = (int) $endNumberRaw;
        if ($endNumber < $startNumber) {
            throw new RuntimeException('Til-kode må være større enn eller lik fra-kode.');
        }

        $width = max(strlen($startNumberRaw), strlen($endNumberRaw));
        $codes = [];

        for ($number = $startNumber; $number <= $endNumber; $number++) {
            $codes[] = $startPrefix . str_pad((string) $number, $width, '0', STR_PAD_LEFT) . $startSuffix;
        }

        return $codes;
    }
}
