/* Direct, user-initiated GitHub navigation; never submits an Issue or a build. */
'use strict';

function initFeedbackControls() {
  let modulePromise;
  let templateAvailable;
  $('feedbackBtn').addEventListener('click', async () => {
    const button = $('feedbackBtn');
    button.disabled = true;
    try {
      modulePromise ||= import(releaseAssetUrl('./lib/feedback.js'));
      const module = await modulePromise;
      templateAvailable ||= module.createFeedbackTemplateResolver({ issueUrl: BUILD_IDENTITY_MODULE.githubIssueUrl });
      const source = selectedCatalogSource();
      const branch = selectedCatalogBranch(source);
      const resolved = catalogLoadMode === 'idle' && state.source?.id === source?.id && state.version?.branch === branch?.branch;
      const environment = module.feedbackEnvironment({
        source: source?.id || state.source?.id, branch: branch?.branch || state.version?.branch,
        target: resolved ? state.device?.target : null, catalogState: catalogLoadMode,
        version: state.siteVersion, commit: state.buildMeta?.commit,
        catalogCode: MENU_INDEX?.provenance?.codeSha, catalogData: MENU_INDEX?.assetRef,
        sourceCommit: branch?.commit, language: state.lang, requestedLanguage: I18N.selectedLanguage,
        userAgent: navigator.userAgent, platform: navigator.platform,
        width: globalThis.visualViewport?.width || innerWidth, height: globalThis.visualViewport?.height || innerHeight,
      });
      const language = module.feedbackLanguage(state.lang);
      await ensureI18nLanguage(language);
      const result = module.feedbackIssueLink({ repository: PROJECT.repository, environment, language, identity: BUILD_IDENTITY_MODULE,
        interfaceType: module.feedbackInterface(navigator.userAgent, navigator.platform, navigator.maxTouchPoints),
        nativeTemplate: await templateAvailable(PROJECT.repository, language),
        translate: key => I18N.strings[key]?.[language] || key });
      if (result.overflow) {
        downloadBlob(result.report, 'text/markdown;charset=utf-8', 'feedback-environment.md');
        showToast(t('feedback.longReport'));
      }
      const target = window.open(result.url, '_blank');
      if (target) target.opener = null;
      else window.location.assign(result.url);
    } catch (error) { showToast(error.message); }
    finally { button.disabled = false; }
  });
}
