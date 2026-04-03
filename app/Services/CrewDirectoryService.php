<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\CrewDirectoryCacheRepository;
use App\Repositories\SettingsRepository;
use App\Repositories\UserRepository;
use CodeIgniter\HTTP\CURLRequest;
use Config\Services;

class CrewDirectoryService
{
    public function __construct(
        private readonly SettingsRepository $settings = new SettingsRepository(),
        private readonly CrewDirectoryCacheRepository $cache = new CrewDirectoryCacheRepository(),
        private readonly UserRepository $users = new UserRepository(),
        private readonly ?CURLRequest $client = null,
    ) {
    }

    public function isConfigured(): bool
    {
        $this->ensureFreshCacheYear();
        $settings = $this->settings->get();

        return trim((string) ($settings->crew_api_base_url ?? '')) !== ''
            && trim((string) ($settings->crew_api_profile_endpoint ?? '')) !== ''
            && trim((string) ($settings->crew_api_picture_endpoint ?? '')) !== ''
            && trim((string) ($settings->crew_api_bearer_token ?? '')) !== '';
    }

    public function profileByBadge(string $scanNumber): ?array
    {
        $this->ensureFreshCacheYear();
        $scanNumber = trim($scanNumber);
        if ($scanNumber === '') {
            return null;
        }

        $cached = $this->cache->toProfileArray($this->cache->findByScanNumber($scanNumber));
        if ($this->hasUsableProfile($cached)) {
            return $cached;
        }

        $fetched = $this->fetchProfile('sn', $scanNumber);
        if ($this->hasUsableProfile($fetched)) {
            return $fetched;
        }

        $user = $this->users->findByBadgeScanNumber($scanNumber);
        if ($user !== null) {
            $name = trim((string) ($user->name ?? (($user->first_name ?? '') . ' ' . ($user->last_name ?? ''))));
            if ($name !== '') {
                return [
                    'id' => (int) ($user->wannabe_id ?? 0),
                    'name' => $name,
                    'nickname' => '',
                    'crew_name' => '',
                    'crew_role' => [
                        'title' => '',
                        'name' => '',
                    ],
                ];
            }
        }

        return null;
    }

    public function profileByWannabeId(int $wannabeId): ?array
    {
        $this->ensureFreshCacheYear();
        if ($wannabeId < 1) {
            return null;
        }

        $cached = $this->cache->toProfileArray($this->cache->findByWannabeId($wannabeId));
        if ($this->hasUsableProfile($cached)) {
            return $cached;
        }

        return $this->fetchProfile('uid', (string) $wannabeId);
    }

    public function pictureUrlByBadge(string $scanNumber): ?string
    {
        $this->ensureFreshCacheYear();
        return $this->buildUrl((string) $this->settings->get()->crew_api_picture_endpoint, ['sn' => trim($scanNumber)]);
    }

    public function pictureUrlByWannabeId(int $wannabeId): ?string
    {
        $this->ensureFreshCacheYear();
        return $this->buildUrl((string) $this->settings->get()->crew_api_picture_endpoint, ['uid' => (string) $wannabeId]);
    }

    public function pictureByWannabeId(int $wannabeId): ?array
    {
        $this->ensureFreshCacheYear();
        if ($wannabeId < 1 || ! $this->isConfigured()) {
            return null;
        }

        return $this->fetchPicture(['uid' => (string) $wannabeId]);
    }

    public function pictureByBadge(string $scanNumber): ?array
    {
        $this->ensureFreshCacheYear();
        $scanNumber = trim($scanNumber);
        if ($scanNumber === '' || ! $this->isConfigured()) {
            return null;
        }

        return $this->fetchPicture(['sn' => $scanNumber]);
    }

    public function clearCacheForNewYear(): void
    {
        $this->cache->clear();
        $this->users->clearBadgeScanNumbers();
        $this->settings->update([
            'crew_cache_year' => (int) date('Y'),
        ]);
    }

    private function fetchProfile(string $queryKey, string $queryValue): ?array
    {
        if (! $this->isConfigured() || trim($queryValue) === '') {
            return null;
        }

        $settings = $this->settings->get();
        $url = $this->buildUrl((string) $settings->crew_api_profile_endpoint, [
            $queryKey => trim($queryValue),
        ]);
        if ($url === null) {
            return null;
        }

        try {
            $response = $this->httpClient()->get($url, [
                'headers' => [
                    'Authorization' => 'Bearer ' . trim((string) $settings->crew_api_bearer_token),
                    'Accept' => 'application/json',
                ],
                'http_errors' => false,
                'timeout' => 10,
            ]);
        } catch (\Throwable) {
            return null;
        }

        if ($response->getStatusCode() !== 200) {
            return null;
        }

        $decoded = json_decode((string) $response->getBody(), true);
        if (! is_array($decoded)) {
            return null;
        }

        $scanNumber = $queryKey === 'sn' ? $queryValue : null;
        $saved = $this->cache->saveProfile($decoded, $scanNumber);
        $this->syncUserBadgeScanNumber($decoded, $scanNumber);

        return $this->cache->toProfileArray($saved) ?? $decoded;
    }

    /**
     * @param array<string, string> $query
     */
    private function buildUrl(string $endpoint, array $query): ?string
    {
        if (! $this->isConfigured() && $endpoint !== (string) ($this->settings->get()->crew_api_picture_endpoint ?? '')) {
            return null;
        }

        $settings = $this->settings->get();
        $baseUrl = rtrim((string) ($settings->crew_api_base_url ?? ''), '/');
        if ($baseUrl === '') {
            return null;
        }

        return $baseUrl . '/' . trim($endpoint, '/') . '/?' . http_build_query($query);
    }

    private function httpClient(): CURLRequest
    {
        return $this->client ?? Services::curlrequest();
    }

    /**
     * @param array<string, string> $query
     * @return array{contentType:string, body:string}|null
     */
    private function fetchPicture(array $query): ?array
    {
        $settings = $this->settings->get();
        $url = $this->buildUrl((string) $settings->crew_api_picture_endpoint, $query);
        if ($url === null) {
            return null;
        }

        try {
            $response = $this->httpClient()->get($url, [
                'headers' => [
                    'Authorization' => 'Bearer ' . trim((string) $settings->crew_api_bearer_token),
                    'Accept' => 'image/png,image/*;q=0.9,*/*;q=0.8',
                ],
                'http_errors' => false,
                'timeout' => 10,
            ]);
        } catch (\Throwable) {
            return null;
        }

        if ($response->getStatusCode() !== 200) {
            return null;
        }

        $body = (string) $response->getBody();
        if ($body === '') {
            return null;
        }

        $contentType = trim($response->getHeaderLine('Content-Type'));
        if ($contentType === '') {
            $contentType = 'image/png';
        }

        return [
            'contentType' => $contentType,
            'body' => $body,
        ];
    }

    private function hasUsableProfile(?array $profile): bool
    {
        return is_array($profile)
            && (int) ($profile['id'] ?? 0) > 0
            && trim((string) ($profile['name'] ?? '')) !== '';
    }

    private function syncUserBadgeScanNumber(array $profile, ?string $scanNumber): void
    {
        $scanNumber = $scanNumber !== null ? trim($scanNumber) : '';
        $wannabeId = (int) ($profile['id'] ?? 0);
        if ($scanNumber === '' || $wannabeId < 1) {
            return;
        }

        $user = $this->users->findByWannabeId($wannabeId);
        if ($user === null) {
            return;
        }

        $existing = trim((string) ($user->badge_scan_number ?? ''));
        if ($existing === $scanNumber) {
            return;
        }

        $this->users->updateById((int) $user->id, [
            'badge_scan_number' => $scanNumber,
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
    }

    private function ensureFreshCacheYear(): void
    {
        $settings = $this->settings->get();
        $currentYear = (int) date('Y');
        $cachedYear = (int) ($settings->crew_cache_year ?? 0);

        if ($cachedYear === $currentYear) {
            return;
        }

        $this->cache->clear();
        $this->users->clearBadgeScanNumbers();
        $this->settings->update([
            'crew_cache_year' => $currentYear,
        ]);
    }
}
