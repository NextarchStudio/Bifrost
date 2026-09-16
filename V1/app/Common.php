<?php

/**
 * The goal of this file is to allow developers a location
 * where they can overwrite core procedural functions and
 * replace them with their own. This file is loaded during
 * the bootstrap process and is called during the framework's
 * execution.
 *
 * This can be looked at as a `master helper` file that is
 * loaded early on, and may also contain additional functions
 * that you'd like to use throughout your entire application
 *
 * @see: https://codeigniter.com/user_guide/extending/common.html
 */

if (! function_exists('format_norwegian_datetime')) {
    function format_norwegian_datetime($value): string
    {
        if ($value === null || $value === '') {
            return '-';
        }

        $timezone = new DateTimeZone(config('App')->appTimezone ?: 'Europe/Oslo');

        if ($value instanceof DateTimeInterface) {
            return (new DateTimeImmutable($value->format('Y-m-d H:i:s'), $value->getTimezone()))
                ->setTimezone($timezone)
                ->format('H:i:s d/m/Y');
        }

        $timestamp = strtotime((string) $value);

        if ($timestamp === false) {
            return (string) $value;
        }

        return (new DateTimeImmutable('@' . $timestamp))
            ->setTimezone($timezone)
            ->format('H:i:s d/m/Y');
    }
}
