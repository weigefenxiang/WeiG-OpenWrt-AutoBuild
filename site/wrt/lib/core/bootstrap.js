/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Final application bootstrap after every feature module is ready.
 */
'use strict';

/* ============ 页面壳层 / Page shell ============ */
PAGE_SHELL_CONTROLLER = PAGE_SHELL_UI.installPageShellUi({
  get: $, t, safeSet, openModal, fitPluginNames,
});

init();
updateSubmitGate();
