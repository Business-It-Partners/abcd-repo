export async function assertStandardPageScroll(page, check, appName) {
  const pageRoot = page.locator('[data-sajilo-standard-page]').first();
  const viewportCount = await pageRoot.locator('[data-sajilo-standard-scroll-viewport]').count();
  check(`${appName} uses the shared Standard Window scroll viewport`, viewportCount === 1);

  const shellGeometry = await pageRoot.evaluate(root => {
    const shell = root.querySelector('[data-sajilo-standard-scroll-shell]');
    if (!shell) return null;
    const rootRect = root.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    return {
      leftInset: shellRect.left - rootRect.left,
      rightInset: rootRect.right - shellRect.right,
      rootWidth: rootRect.width,
      shellWidth: shellRect.width,
    };
  });
  check(`${appName} scroll shell fills the Standard Window page`,
    !!shellGeometry && shellGeometry.rootWidth > 0
      && Math.abs(shellGeometry.leftInset) < 0.5
      && Math.abs(shellGeometry.rightInset) < 0.5
      && Math.abs(shellGeometry.rootWidth - shellGeometry.shellWidth) < 0.5);

  const originalMinHeight = await pageRoot.evaluate(root => {
    const viewport = root.querySelector('[data-sajilo-standard-scroll-viewport]');
    const content = viewport?.firstElementChild;
    if (!viewport || !(content instanceof HTMLElement) || viewport.clientHeight < 1) return null;
    const original = content.style.minHeight;
    content.style.minHeight = `${viewport.clientHeight + 256}px`;
    return original;
  });
  if (originalMinHeight === null) throw new Error(`${appName} standard scroll viewport has no measurable height.`);

  const track = pageRoot.locator('[data-sajilo-standard-scroll-shell] > [role="scrollbar"]');
  try {
    await track.waitFor({ state: 'visible' });
    const metrics = await track.evaluate(element => {
      const shell = element.parentElement?.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      return shell ? { width: rect.width, rightInset: shell.right - rect.right } : null;
    });
    check(`${appName} uses the six-pixel overlay scrollbar four pixels from the page edge`,
      !!metrics && Math.abs(metrics.width - 6) < 0.5 && Math.abs(metrics.rightInset - 4) < 0.5);
  } finally {
    await pageRoot.evaluate((root, original) => {
      const viewport = root.querySelector('[data-sajilo-standard-scroll-viewport]');
      const content = viewport?.firstElementChild;
      if (content instanceof HTMLElement) content.style.minHeight = original;
    }, originalMinHeight);
    await page.waitForFunction(() => {
      const viewport = document.querySelector('[data-sajilo-standard-scroll-viewport]');
      const track = document.querySelector('[data-sajilo-standard-scroll-shell] > [role="scrollbar"]');
      return Boolean(viewport) && Boolean(track) === (viewport.scrollHeight > viewport.clientHeight);
    });
  }
}
