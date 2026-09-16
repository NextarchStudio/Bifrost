<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Repositories\UserRepository;
use App\Services\ProfileService;
use CodeIgniter\Controller;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\Session\Session;
use Psr\Log\LoggerInterface;

/**
 * BaseController provides a convenient place for loading components
 * and performing functions that are needed by all your controllers.
 *
 * Extend this class in any new controllers:
 * ```
 *     class Home extends BaseController
 * ```
 *
 * For security, be sure to declare any new methods as protected or private.
 */
abstract class BaseController extends Controller
{
    protected $helpers = ['form', 'url', 'rbac'];
    protected Session $session;

    public function initController(RequestInterface $request, ResponseInterface $response, LoggerInterface $logger)
    {
        parent::initController($request, $response, $logger);
        $this->session = service('session');

        $userId = (int) $this->session->get('user_id');
        if ($userId > 0) {
            $users = new UserRepository();
            $profiles = new ProfileService();
            $user = $users->findById($userId);

            if ($user !== null) {
                $this->session->set([
                    'roles' => $users->rolesForUser($userId),
                    'name' => (string) ($user->name ?? $this->session->get('name')),
                    'first_name' => (string) ($user->first_name ?? $this->session->get('first_name')),
                    'wannabe_id' => $user->wannabe_id !== null ? (int) $user->wannabe_id : null,
                    'can_show_profile_picture' => $profiles->canShowPictureForUser($userId),
                ]);
            }
        }
    }
}
