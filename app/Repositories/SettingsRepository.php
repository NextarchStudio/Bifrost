<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\SystemSettingModel;

class SettingsRepository
{
    public function __construct(private readonly SystemSettingModel $settings = new SystemSettingModel())
    {
    }

    public function get(): object
    {
        $row = $this->settings->find(1);
        if ($row === null) {
            $this->settings->insert(['id' => 1, 'enable_local_login' => 1, 'enable_discord_login' => 1, 'enable_keycloak_login' => 1]);
            return $this->settings->find(1);
        }

        return $row;
    }

    public function update(array $data): bool
    {
        return $this->settings->update(1, $data);
    }
}

