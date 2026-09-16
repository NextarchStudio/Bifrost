<?php
declare(strict_types=1);

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

class RoleFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null): ?ResponseInterface
    {
        if (! session()->get('user_id')) {
            return redirect()->to('/auth/login');
        }

        if ($arguments === null || $arguments === []) {
            return null;
        }

        $roles = (array) session()->get('roles');
        $required = array_map(static fn (string $role): string => trim($role), (array) $arguments);

        if (count(array_intersect($required, $roles)) === 0) {
            return redirect()
                ->to('/dashboard')
                ->with('error', 'Du har ikke tilgang til denne siden.');
        }

        return null;
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null): void
    {
    }
}
