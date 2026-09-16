<?php
declare(strict_types=1);

if (! function_exists('hasRole')) {
    function hasRole(string|array $roles): bool
    {
        $session = service('session');
        $userRoles = (array) $session->get('roles');
        $required = is_array($roles) ? $roles : [$roles];

        return count(array_intersect($required, $userRoles)) > 0;
    }
}

if (! function_exists('requireRole')) {
    function requireRole(string|array $roles): void
    {
        if (! hasRole($roles)) {
            throw new \RuntimeException('Forbidden');
        }
    }
}
