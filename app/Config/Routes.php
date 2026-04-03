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
    $routes->post('forgot-password', 'AuthController::sendPasswordReset');
    $routes->get('reset-password', 'AuthController::resetPasswordForm');
    $routes->post('reset-password', 'AuthController::resetPassword');
    $routes->get('logout', 'AuthController::logout', ['filter' => 'auth']);

    $routes->get('oidc', 'AuthController::oidcRedirect');
    $routes->get('oidc/callback', 'AuthController::oidcCallback');
    $routes->get('callback/keycloak', 'AuthController::oidcCallback');
  });

$routes->group('', ['filter' => 'auth'], static function (RouteCollection $routes): void {
    $routes->get('dashboard', 'DashboardController::index');

    $routes->group('shop', ['filter' => 'role:developer,chief,co-chief,logistikk,shop'], static function (RouteCollection $routes): void {
        $routes->get('/', 'ShopController::index');
        $routes->get('export/excel', 'ShopController::exportExcel');
        $routes->get('export/pdf', 'ShopController::exportPdf');
        $routes->post('import/excel', 'ShopController::importExcel');
        $routes->post('categories/create', 'ShopController::createCategory');
        $routes->post('items/create', 'ShopController::createItem');
        $routes->post('checkout/(:num)', 'ShopController::checkOut/$1');
        $routes->post('checkin/(:num)', 'ShopController::checkIn/$1');
        $routes->post('delete/(:num)', 'ShopController::deleteItem/$1');
    });

    $routes->get('search', 'SearchController::index', ['filter' => 'role:developer,chief,co-chief,logistikk']);
    $routes->get('profile', 'ProfileController::redirectToOwn');
    $routes->get('profile/picture/(:num)', 'ProfileController::picture/$1');
    $routes->get('profil/(:num)', 'ProfileController::index/$1');
    $routes->post('profile/password', 'ProfileController::changePassword');

    $routes->group('equipment', ['filter' => 'role:developer,chief,co-chief,logistikk'], static function (RouteCollection $routes): void {
        $routes->get('/', 'InventoryController::index');
        $routes->post('create', 'InventoryController::create');
        $routes->post('details/(:num)', 'InventoryController::updateDetails/$1');
        $routes->post('quantity/(:num)', 'InventoryController::updateQuantity/$1');
        $routes->post('move/(:num)', 'InventoryController::move/$1');
        $routes->post('status/(:num)', 'InventoryController::changeStatus/$1');
        $routes->post('delete/(:num)', 'InventoryController::delete/$1');
    });

    $routes->group('vehicles', ['filter' => 'role:developer,chief,co-chief,skiftleder,logistikk'], static function (RouteCollection $routes): void {
        $routes->get('/', 'VehiclesController::index');
        $routes->get('competencies/(:num)', 'VehiclesController::competencyProfile/$1');
        $routes->get('profile/(:num)', 'VehiclesController::profile/$1');
        $routes->get('profile-lookup', 'VehiclesController::profileLookup');
        $routes->post('create', 'VehiclesController::create');
        $routes->post('update/(:num)', 'VehiclesController::update/$1');
        $routes->post('issue', 'VehiclesController::issue');
        $routes->post('return/(:num)', 'VehiclesController::returnLoan/$1');
        $routes->post('delete/(:num)', 'VehiclesController::delete/$1');
    });

    $routes->group('categories', ['filter' => 'role:developer,chief,co-chief,logistikk'], static function (RouteCollection $routes): void {
        $routes->get('/', 'EquipmentCategoriesController::index');
        $routes->post('create', 'EquipmentCategoriesController::create');
        $routes->post('delete/(:num)', 'EquipmentCategoriesController::delete/$1');
    });

    $routes->group('locations', ['filter' => 'role:developer,chief,co-chief,logistikk'], static function (RouteCollection $routes): void {
        $routes->get('/', 'LocationsController::index');
        $routes->post('create', 'LocationsController::create');
        $routes->post('update/(:num)', 'LocationsController::update/$1');
        $routes->post('delete/(:num)', 'LocationsController::delete/$1');
    });

    $routes->group('warehouse', ['filter' => 'role:developer,chief,co-chief,logistikk'], static function (RouteCollection $routes): void {
        $routes->get('/', 'WarehouseController::index');
        $routes->get('pallet/inspect/(:num)', 'WarehouseController::inspectPallet/$1');
        $routes->post('pallet/create', 'WarehouseController::createPallet');
        $routes->post('pallet/add-equipment', 'WarehouseController::addEquipmentToPallet');
        $routes->post('pallet/move/(:num)', 'WarehouseController::movePallet/$1');
        $routes->post('pallet/delete/(:num)', 'WarehouseController::deletePallet/$1');
        $routes->post('slot/create', 'WarehouseController::createSlot');
    });

    $routes->group('loans', ['filter' => 'role:developer,chief,co-chief,logistikk'], static function (RouteCollection $routes): void {
        $routes->get('/', 'LoansController::index');
        $routes->get('profile/(:num)', 'LoansController::profile/$1');
        $routes->get('profile-lookup', 'LoansController::profileLookup');
        $routes->post('issue', 'LoansController::issue');
        $routes->post('return/(:num)', 'LoansController::returnLoan/$1');
    });

    $routes->group('strekkoder', ['filter' => 'role:developer,chief,co-chief,logistikk'], static function (RouteCollection $routes): void {
        $routes->get('/', 'BarcodesController::index');
        $routes->post('export', 'BarcodesController::export');
    });

    $routes->group('privat-utstyr', ['filter' => 'role:developer,chief,co-chief,logistikk'], static function (RouteCollection $routes): void {
        $routes->get('/', 'PrivateEquipmentController::index');
        $routes->post('create', 'PrivateEquipmentController::create');
        $routes->post('delete/(:num)', 'PrivateEquipmentController::delete/$1');
    });

    $routes->group('samband', ['filter' => 'role:developer,chief,co-chief,logistikk,sambandsansvarlig'], static function (RouteCollection $routes): void {
        $routes->get('/', 'CommsController::index');
        $routes->get('profile/(:num)', 'CommsController::profile/$1');
        $routes->get('profile-lookup', 'CommsController::profileLookup');
        $routes->post('item/create', 'CommsController::createItem');
        $routes->post('set/create', 'CommsController::createSet');
        $routes->post('set/update/(:num)', 'CommsController::updateSet/$1');
        $routes->post('set/delete/(:num)', 'CommsController::deleteSet/$1');
        $routes->post('issue', 'CommsController::issue');
        $routes->post('return/(:num)', 'CommsController::returnLoan/$1');
    });

    $routes->group('transport', ['filter' => 'role:developer,chief,co-chief,logistikk,innkjop'], static function (RouteCollection $routes): void {
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
        $routes->post('delete/(:num)', 'EquipmentRequestsController::delete/$1');
        $routes->post('status/(:num)', 'EquipmentRequestsController::updateStatus/$1', ['filter' => 'role:developer,chief,co-chief,logistikk']);
        $routes->post('approve/(:num)', 'EquipmentRequestsController::approve/$1', ['filter' => 'role:developer,chief,co-chief,logistikk']);
    });

    $routes->group('feedback', static function (RouteCollection $routes): void {
        $routes->get('/', 'FeedbackController::index');
        $routes->get('attachment/(:num)', 'FeedbackController::attachment/$1');
        $routes->get('notifications', 'FeedbackController::notifications');
        $routes->post('notifications/read', 'FeedbackController::markNotificationsRead');
        $routes->post('create', 'FeedbackController::create');
        $routes->post('status/(:num)', 'FeedbackController::updateStatus/$1', ['filter' => 'role:developer']);
        $routes->post('delete/(:num)', 'FeedbackController::delete/$1');
    });

    $routes->group('tasks', static function (RouteCollection $routes): void {
        $routes->get('/', 'TasksController::index');
        $routes->post('create', 'TasksController::create');
        $routes->post('status/(:num)', 'TasksController::updateStatus/$1');
    });

    $routes->group('admin', ['filter' => 'role:developer,chief,co-chief'], static function (RouteCollection $routes): void {
        $routes->get('/', 'AdminController::index');
        $routes->get('statistikk', 'AdminController::statistics');
        $routes->post('settings', 'AdminController::updateSettings', ['filter' => 'role:developer']);
        $routes->post('crew-cache/clear', 'AdminController::clearCrewCache', ['filter' => 'role:developer']);
        $routes->post('users/create', 'AdminController::createUser');
        $routes->get('users/inspect/(:num)', 'AdminController::inspectUser/$1');
        $routes->get('users/edit/(:num)', 'AdminController::editUser/$1');
        $routes->post('users/roles/(:num)', 'AdminController::syncUserRoles/$1');
        $routes->post('users/active/(:num)', 'AdminController::updateUserActive/$1');
        $routes->post('users/competencies/(:num)', 'AdminController::updateUserCompetencies/$1');
        $routes->post('users/delete/(:num)', 'AdminController::deleteUser/$1');
    });
});
