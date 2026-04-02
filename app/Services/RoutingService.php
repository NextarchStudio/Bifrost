<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\SettingsRepository;
use CodeIgniter\HTTP\CURLRequest;
use Config\Services;

class RoutingService
{
    private CURLRequest $http;

    public function __construct(
        private readonly SettingsRepository $settings = new SettingsRepository()
    ) {
        $this->http = Services::curlrequest([
            'timeout' => 15,
            'headers' => [
                'User-Agent' => 'TG Logistics CMS/1.0',
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
            ],
        ]);
    }

    public function geocode(string $address): ?array
    {
        $address = trim($address);
        if ($address === '') {
            return null;
        }

        foreach ($this->geocodeQueries($address) as $query) {
            try {
                $response = $this->http->get('https://nominatim.openstreetmap.org/search', [
                    'query' => [
                        'q' => $query,
                        'format' => 'jsonv2',
                        'limit' => 1,
                        'countrycodes' => 'no',
                    ],
                ]);
                $payload = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);
            } catch (\Throwable) {
                continue;
            }

            if (! is_array($payload) || empty($payload[0]['lat']) || empty($payload[0]['lon'])) {
                continue;
            }

            return [
                'lat' => round((float) $payload[0]['lat'], 7),
                'lon' => round((float) $payload[0]['lon'], 7),
            ];
        }

        return null;
    }

    public function routeDistanceKm(array $points): ?int
    {
        $baseUrl = $this->osrmBaseUrl();
        if (count($points) < 2 || $baseUrl === null) {
            return null;
        }

        $coordinates = [];
        $lastCoordinate = null;
        foreach ($points as $point) {
            if (! isset($point['lat'], $point['lon'])) {
                return null;
            }
            $coordinate = $point['lon'] . ',' . $point['lat'];
            if ($coordinate === $lastCoordinate) {
                continue;
            }
            $coordinates[] = $coordinate;
            $lastCoordinate = $coordinate;
        }

        if (count($coordinates) < 2) {
            return null;
        }

        try {
            $response = $this->http->get(rtrim($baseUrl, '/') . '/route/v1/driving/' . implode(';', $coordinates), [
                'query' => [
                    'overview' => 'false',
                    'steps' => 'false',
                ],
            ]);
            $payload = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            return null;
        }

        if (! is_array($payload) || ($payload['code'] ?? '') !== 'Ok' || empty($payload['routes'][0]['distance'])) {
            return null;
        }

        return (int) round(((float) $payload['routes'][0]['distance']) / 1000);
    }

    private function osrmBaseUrl(): ?string
    {
        $settings = $this->settings->get();
        $baseUrl = trim((string) ($settings->osrm_base_url ?? 'http://localhost:5000'));

        return $baseUrl !== '' ? $baseUrl : null;
    }

    private function geocodeQueries(string $address): array
    {
        $queries = [$address];

        if (! str_contains(mb_strtolower($address), 'norway') && ! str_contains(mb_strtolower($address), 'norge')) {
            $queries[] = $address . ', Norway';
        }

        $variants = [
            'veien' => 'vegen',
            'Veien' => 'Vegen',
            'VEIEN' => 'VEGEN',
            'gata' => 'gate',
            'Gata' => 'Gate',
            'GATA' => 'GATE',
            ' allé' => ' alle',
            ' Allé' => ' Alle',
            ' ALLE' => ' ALLE',
        ];

        foreach ($variants as $from => $to) {
            if (str_contains($address, $from)) {
                $queries[] = str_replace($from, $to, $address);
                if (! str_contains(mb_strtolower(end($queries)), 'norway')) {
                    $queries[] = end($queries) . ', Norway';
                }
            }
        }

        return array_values(array_unique($queries));
    }
}
