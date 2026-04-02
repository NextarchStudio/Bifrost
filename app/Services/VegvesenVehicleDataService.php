<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\SettingsRepository;
use CodeIgniter\HTTP\CURLRequest;
use Config\Services;

class VegvesenVehicleDataService
{
    private const API_URL = 'https://akfell-datautlevering.atlas.vegvesen.no/enkeltoppslag/kjoretoydata';

    private CURLRequest $http;

    public function __construct(
        private readonly SettingsRepository $settings = new SettingsRepository()
    ) {
        $this->http = Services::curlrequest([
            'timeout' => 15,
            'http_errors' => false,
            'headers' => [
                'Accept' => 'application/json',
                'User-Agent' => 'TG Logistics CMS/1.0',
            ],
        ]);
    }

    public function isConfigured(): bool
    {
        return $this->apiKey() !== null;
    }

    /**
     * @return array{success: bool, max_payload_kg: ?int}
     */
    public function fetchMaxPayloadKg(string $registrationNumber): array
    {
        $apiKey = $this->apiKey();
        $registrationNumber = mb_strtoupper(trim($registrationNumber));

        if ($apiKey === null || $registrationNumber === '') {
            return ['success' => false, 'max_payload_kg' => null];
        }

        try {
            $response = $this->http->get(self::API_URL, [
                'headers' => [
                    'SVV-Authorization' => 'Apikey ' . $apiKey,
                ],
                'query' => [
                    'kjennemerke' => $registrationNumber,
                ],
            ]);

            if ($response->getStatusCode() !== 200) {
                return ['success' => false, 'max_payload_kg' => null];
            }

            $payload = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            return ['success' => false, 'max_payload_kg' => null];
        }

        $maxPayload = $payload['kjoretoydataListe'][0]['godkjenning']['tekniskGodkjenning']['tekniskeData']['vekter']['nyttelast'] ?? null;

        return [
            'success' => true,
            'max_payload_kg' => is_numeric($maxPayload) ? (int) $maxPayload : null,
        ];
    }

    private function apiKey(): ?string
    {
        $settings = $this->settings->get();
        $apiKey = trim((string) ($settings->vegvesen_api_key ?? ''));

        return $apiKey !== '' ? $apiKey : null;
    }
}
