<?php

namespace Itsmng\Plugin\MassiveActionApi;

class FakeTimer {
    public function start()
    {
        return true;
    }

    public function getTime($decimals = 3, $raw = false)
    {
        return 0;
    }
}