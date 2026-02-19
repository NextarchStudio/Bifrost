<?php
declare(strict_types=1);

use CodeIgniter\Router\RouteCollection;

/**
 * @var RouteCollection $routes
 */
$routes->get('/', 'DashboardController::index', ['filter' => 'auth']);

$routes->group('auth', static function (RouteCollection $routes): void {
    $routes->get('login', 'AuthController::loginForm');
    $routes->post('login', 'AuthController::localLogin');
    $routes->get('forgot-password', 'AuthController::forgotPassword');
    $routes->get('logout', 'AuthController::logout', ['filter' => 'auth']);

    $routes->get('oidc', 'AuthController::oidcRedirect');
    $routes->get('oidc/callback', 'AuthController::oidcCallback');
    $routes->get('discord', 'AuthController::discordRedirect');
    $routes->get('discord/callback', 'AuthController::discordCallback');
});

$routes->group('', ['filter' => 'auth'], static function (RouteCollection $routes): void {
    $routes->get('dashboard', 'DashboardController::index');
    $routes->get('search', 'SearchController::index');
    $routes->get('profile', 'ProfileController::redirectToOwn');
    $routes->get('profil/(:num)', 'ProfileController::index/$1');
    $routes->post('profile/password', 'ProfileController::changePassword');

    $routes->group('equipment', ['filter' => 'role:developer,chief,co-chief,transport_ansvarlig,skiftleder,logistikk'], static function (RouteCollection $routes): void {
        $routes->get('/', 'InventoryController::index');
        $routes->post('create', 'InventoryController::create');
        $routes->post('move/(:num)', 'InventoryController::move/$1');
        $routes->post('status/(:num)', 'InventoryController::changeStatus/$1');
        $routes->post('delete/(:num)', 'InventoryController::delete/$1');
    });

    $routes->group('categories', ['filter' => 'role:developer,chief,co-chief,transport_ansvarlig,skiftleder,logistikk'], static function (RouteCollection $routes): void {
        $routes->get('/', 'EquipmentCategoriesController::index');
        $routes->post('create', 'EquipmentCategoriesController::create');
        $routes->post('delete/(:num)', 'EquipmentCategoriesController::delete/$1');
    });

    $routes->group('locations', ['filter' => 'role:developer,chief,co-chief,transport_ansvarlig,skiftleder,logistikk'], static function (RouteCollection $routes): void {
        $routes->get('/', 'LocationsController::index');
        $routes->post('create', 'LocationsController::create');
        $routes->post('delete/(:num)', 'LocationsController::delete/$1');
    });

    $routes->group('warehouse', ['filter' => 'role:developer,chief,co-chief,transport_ansvarlig,logistikk'], static function (RouteCollection $routes): void {
        $routes->get('/', 'WarehouseController::index');
        $routes->get('pallet/inspect/(:num)', 'WarehouseController::inspectPallet/$1');
        $routes->post('pallet/create', 'WarehouseController::createPallet');
        $routes->post('pallet/add-equipment', 'WarehouseController::addEquipmentToPallet');
        $routes->post('pallet/move/(:num)', 'WarehouseController::movePallet/$1');
        $routes->post('pallet/delete/(:num)', 'WarehouseController::deletePallet/$1');
        $routes->post('slot/create', 'WarehouseController::createSlot');
    });

    $routes->group('loans', ['filter' => 'role:developer,chief,co-chief,skiftleder,logistikk'], static function (RouteCollection $routes): void {
        $routes->get('/', 'LoansController::index');
        $routes->post('issue', 'LoansController::issue');
        $routes->post('return/(:num)', 'LoansController::returnLoan/$1');
    });

    $routes->group('samband', ['filter' => 'role:developer,chief,sambandsansvarlig'], static function (RouteCollection $routes): void {
        $routes->get('/', 'CommsController::index');
        $routes->post('item/create', 'CommsController::createItem');
        $routes->post('set/create', 'CommsController::createSet');
        $routes->post('issue', 'CommsController::issue');
        $routes->post('return/(:num)', 'CommsController::returnLoan/$1');
    });

    $routes->group('transport', static function (RouteCollection $routes): void {
        $routes->get('/', 'TransportController::index');
        $routes->get('inspect/(:num)', 'TransportController::inspect/$1');
        $routes->post('request-people', 'TransportController::requestPeople');
        $routes->post('create', 'TransportController::create');
        $routes->post('assign/(:num)', 'TransportController::assign/$1');
        $routes->post('status/(:num)', 'TransportController::status/$1');
    });

    $routes->group('requests', static function (RouteCollection $routes): void {
        $routes->get('/', 'EquipmentRequestsController::index');
        $routes->post('create', 'EquipmentRequestsController::create');
        $routes->post('status/(:num)', 'EquipmentRequestsController::updateStatus/$1', ['filter' => 'role:developer,chief,co-chief,skiftleder,transport_ansvarlig']);
        $routes->post('approve/(:num)', 'EquipmentRequestsController::approve/$1', ['filter' => 'role:developer,chief,co-chief,skiftleder,transport_ansvarlig']);
    });

    $routes->group('admin', ['filter' => 'role:developer,chief'], static function (RouteCollection $routes): void {
        $routes->get('/', 'AdminController::index');
        $routes->post('settings', 'AdminController::updateSettings');
        $routes->post('users/create', 'AdminController::createUser');
        $routes->get('users/inspect/(:num)', 'AdminController::inspectUser/$1');
        $routes->get('users/edit/(:num)', 'AdminController::editUser/$1');
        $routes->post('users/roles/(:num)', 'AdminController::syncUserRoles/$1');
        $routes->post('users/active/(:num)', 'AdminController::updateUserActive/$1');
    });
});
