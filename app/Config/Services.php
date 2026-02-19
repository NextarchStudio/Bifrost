<?php
declare(strict_types=1);

namespace Config;

use App\Repositories\UserRepository;
use App\Services\AdminService;
use App\Services\AuthService;
use App\Services\DashboardService;
use App\Services\InventoryService;
use App\Services\LoanService;
use App\Services\SearchService;
use App\Services\TransportService;
use App\Services\WarehouseService;
use CodeIgniter\Config\BaseService;

/**
 * Services Configuration file.
 *
 * Services are simply other classes/libraries that the system uses
 * to do its job. This is used by CodeIgniter to allow the core of the
 * framework to be swapped out easily without affecting the usage within
 * the rest of your application.
 *
 * This file holds any application-specific services, or service overrides
 * that you might need. An example has been included with the general
 * method format you should use for your service methods. For more examples,
 * see the core Services file at system/Config/Services.php.
 */
class Services extends BaseService
{
    public static function userRepository(bool $getShared = true): UserRepository
    {
        if ($getShared) {
            return static::getSharedInstance('userRepository');
        }
        return new UserRepository();
    }

    public static function authService(bool $getShared = true): AuthService
    {
        if ($getShared) {
            return static::getSharedInstance('authService');
        }
        return new AuthService();
    }

    public static function dashboardService(bool $getShared = true): DashboardService
    {
        if ($getShared) {
            return static::getSharedInstance('dashboardService');
        }
        return new DashboardService();
    }

    public static function inventoryService(bool $getShared = true): InventoryService
    {
        if ($getShared) {
            return static::getSharedInstance('inventoryService');
        }
        return new InventoryService();
    }

    public static function warehouseService(bool $getShared = true): WarehouseService
    {
        if ($getShared) {
            return static::getSharedInstance('warehouseService');
        }
        return new WarehouseService();
    }

    public static function loanService(bool $getShared = true): LoanService
    {
        if ($getShared) {
            return static::getSharedInstance('loanService');
        }
        return new LoanService();
    }

    public static function transportService(bool $getShared = true): TransportService
    {
        if ($getShared) {
            return static::getSharedInstance('transportService');
        }
        return new TransportService();
    }

    public static function adminService(bool $getShared = true): AdminService
    {
        if ($getShared) {
            return static::getSharedInstance('adminService');
        }
        return new AdminService();
    }

    public static function searchService(bool $getShared = true): SearchService
    {
        if ($getShared) {
            return static::getSharedInstance('searchService');
        }
        return new SearchService();
    }
}
