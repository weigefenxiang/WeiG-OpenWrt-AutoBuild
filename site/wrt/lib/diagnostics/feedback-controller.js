/* User-reviewed feedback. Never submits an Issue, uploads state or dispatches a build. */
'use strict';

function initFeedbackControls() {
  $('feedbackBtn').addEventListener('click', () => {
    openFeedbackModal().catch(error => showToast(error.message));
  });
}

async function openFeedbackModal() {
  const module = await import(releaseAssetUrl('./lib/feedback.js'));
  const source = selectedCatalogSource();
  const branch = selectedCatalogBranch(source);
  const resolved = state.source?.id === source?.id && state.version?.branch === branch?.branch;
  const environment = module.feedbackEnvironment({
    source: source?.id || state.source?.id, branch: branch?.branch || state.version?.branch,
    target: resolved ? state.device?.target : null, catalogState: catalogLoadMode,
    version: state.siteVersion, commit: state.buildMeta?.commit,
    catalogCode: MENU_INDEX?.provenance?.codeSha, catalogData: MENU_INDEX?.assetRef,
    sourceCommit: branch?.commit, language: state.lang,
    requestedLanguage: I18N.selectedLanguage, userAgent: navigator.userAgent, platform: navigator.platform,
    width: globalThis.visualViewport?.width || innerWidth, height: globalThis.visualViewport?.height || innerHeight,
  });
  openModal(t('feedback.title'));
  $('modal').querySelector('.modal').classList.add('modal-wide', 'feedback-dialog');
  const form = document.createElement('form');
  form.id = 'feedbackForm'; form.className = 'feedback-form';
  form.addEventListener('submit', event => event.preventDefault());
  const hint = document.createElement('p');
  hint.className = 'hint'; hint.textContent = t('feedback.privacy'); form.append(hint);
  const fields = new Map();
  for (const field of module.FEEDBACK_FIELDS) {
    const label = document.createElement('label');
    label.className = `feedback-field feedback-field-${field.type}`;
    const caption = document.createElement('span');
    caption.className = 'field-label'; caption.textContent = t(`feedback.${field.id}`);
    const input = document.createElement(field.options ? 'select' : field.type === 'textarea' ? 'textarea' : 'input');
    input.id = `feedback-${field.id}`; input.name = field.id; input.required = Boolean(field.required);
    if (field.options) {
      for (const value of field.options) {
        const option = document.createElement('option');
        option.value = value; option.textContent = t(`feedback.${field.id}.${value}`); input.append(option);
      }
      if (field.id === 'interface') input.value = /Android|iPhone|iPod/i.test(navigator.userAgent) ? 'mobile'
        : /iPad|Tablet/i.test(navigator.userAgent) ? 'tablet' : 'desktop';
    } else {
      if (field.type === 'input') input.type = 'url';
      input.maxLength = field.id === 'run' ? 500 : 4000;
      if (field.type === 'textarea') input.rows = field.id === 'description' ? 4 : 2;
      input.placeholder = t(`feedback.${field.id}.hint`);
    }
    label.append(caption, input); form.append(label); fields.set(field.id, input);
  }
  const details = document.createElement('details'); details.className = 'feedback-environment';
  const summary = document.createElement('summary'); summary.textContent = t('feedback.environment');
  const preview = document.createElement('textarea');
  preview.id = 'feedbackReport'; preview.readOnly = true; preview.rows = 8;
  preview.setAttribute('aria-label', t('feedback.environment'));
  details.append(summary, preview); form.append(details);
  const warning = document.createElement('p'); warning.className = 'hint'; warning.hidden = true;
  warning.textContent = t('feedback.longReport'); form.append(warning);
  const actions = document.createElement('div'); actions.className = 'modal-actions';
  const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'btn';
  copy.id = 'feedbackCopy'; copy.textContent = t('feedback.copy');
  const link = document.createElement('a'); link.className = 'btn btn-primary'; link.id = 'feedbackGithub';
  link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = t('feedback.github');
  const refresh = () => {
    const values = Object.fromEntries([...fields].map(([id, input]) => [id, input.value]));
    preview.value = module.feedbackReport(values, environment, t);
    const title = '[feedback] ' + Array.from(values.description.trim().split('\n')[0] || t('feedback.title')).slice(0, 100).join('');
    // Native templates require default-branch promotion. A prefilled normal
    // Issue works on dev without mutating main or guessing template availability.
    const url = BUILD_IDENTITY_MODULE.githubIssueUrl(PROJECT.repository, { title, body: preview.value });
    warning.hidden = url.length <= BUILD_IDENTITY_MODULE.ISSUE_URL_LIMIT;
    link.href = warning.hidden ? url : BUILD_IDENTITY_MODULE.githubIssueUrl(PROJECT.repository, { title });
  };
  form.addEventListener('input', refresh); form.addEventListener('change', refresh);
  link.addEventListener('click', event => { if (!form.reportValidity()) event.preventDefault(); });
  copy.onclick = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(preview.value); showToast(t('feedback.copied'));
    } catch {
      details.open = true; preview.focus(); preview.select(); showToast(t('feedback.copyManual'));
    }
  };
  actions.append(copy, link); form.append(actions);
  $('modalBody').replaceChildren(form); refresh(); fields.get('description').focus();
}
