<?php

namespace App\Helpers;

class RateLimiter
{
    private static array $buckets = [];
    private int $maxRequests;
    private int $windowSeconds;

    public function __construct(int $maxRequests = 10, int $windowSeconds = 60)
    {
        $this->maxRequests = $maxRequests;
        $this->windowSeconds = $windowSeconds;
    }

    public function isAllowed(string $key): bool
    {
        $now = time();
        $windowKey = $key . '_' . floor($now / $this->windowSeconds);

        if (!isset(self::$buckets[$windowKey])) {
            // Cleanup old windows
            foreach (self::$buckets as $k => $v) {
                if (!str_starts_with($k, $key . '_') || $k !== $windowKey) {
                    unset(self::$buckets[$k]);
                }
            }
            self::$buckets[$windowKey] = 0;
        }

        self::$buckets[$windowKey]++;

        return self::$buckets[$windowKey] <= $this->maxRequests;
    }
}
