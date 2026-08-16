/*
 * SPDX-FileCopyrightText: 2026 weigefenxiang <weigefenxiang@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Page-session-only state. This module deliberately has no storage dependency.
export function createUiSessionState() {
  let compatibilityAcknowledgement = null;

  const compatibility = Object.freeze({
    getAcknowledgement: () => compatibilityAcknowledgement,
    setAcknowledgement(value) { compatibilityAcknowledgement = value && typeof value === 'object' ? value : null; },
    clearAcknowledgement() { compatibilityAcknowledgement = null; },
  });

  return Object.freeze({ compatibility });
}
