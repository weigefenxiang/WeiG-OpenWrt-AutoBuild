/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * OpenWrt customizer application orchestrator.
 */
'use strict';

(async function startApplication() {
  const release = globalThis.__WEIG_RELEASE__ || null;
  const releaseUrl = globalThis.__WEIG_RELEASE_URL__;
  if (!/^[a-f0-9]{64}$/.test(String(release?.siteSha256 || '')) || typeof releaseUrl !== 'function') {
    throw new Error('Missing validated site release bootstrap');
  }
  const modules = [
    'lib/core/runtime.js',
    'lib/i18n/i18n.js',
    'lib/core/data-loader.js',
    'lib/ui/ui-runtime.js',
    'lib/core/application-controller.js',
    'lib/catalog/catalog-controller.js',
    'lib/menuconfig/menuconfig-state.js',
    'lib/menuconfig/compatibility-controller.js',
    'lib/menuconfig/menuconfig-renderer.js',
    'lib/plugins/workspace-controller.js',
    'lib/plugins/plugin-controller.js',
    'lib/config/config-state.js',
    'lib/config/config-generator.js',
    'lib/config/config-importer.js',
    'lib/build/build-controller.js',
    'lib/diagnostics/package-probe-controller.js',
    'lib/diagnostics/self-test.js',
    'lib/core/bootstrap.js',
  ];
  for (const path of modules) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = releaseUrl(path);
      script.async = false;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load application module: ${path}`));
      document.body.appendChild(script);
    });
  }
})().catch((error) => {
  console.error('Application bootstrap failed', error);
});
