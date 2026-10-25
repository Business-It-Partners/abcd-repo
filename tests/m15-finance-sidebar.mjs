import { fixtureArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const env = { ...process.env };
for (const key of ['ELECTRON_RUN_AS_NODE', 'DEBUG', 'PWDEBUG']) delete env[key];

let app;
try {
  app = await electron.launch({ args: [root, ...fixtureArgs], env, timeout: 30000 });
  const shell = await app.firstWindow();
  shell.setDefaultTimeout(15000);
  const errors = [];
  shell.on('pageerror', error => errors.push(error.message));
  const check = (name, value) => { assert.ok(value, name); console.log('PASS', name); };

  await shell.locator('[data-dock-app="finance"]').click();
  const frame = shell.getByTestId('finance-window');
  await frame.waitFor({ state: 'visible' });
  const sidebar = frame.getByRole('navigation', { name: 'Finance modules' });
  await sidebar.waitFor({ state: 'visible' });

  const style = await sidebar.evaluate(nav => {
    const heading = nav.querySelector('.window-module-sidebar-heading');
    const regular = nav.querySelector('.window-module-sidebar-item:not(.is-active)');
    const active = nav.querySelector('.window-module-sidebar-item.is-active');
    if (!heading || !regular || !active) return null;
    const panelStyle = getComputedStyle(nav), headingStyle = getComputedStyle(heading);
    const regularStyle = getComputedStyle(regular), activeStyle = getComputedStyle(active);
    return {
      width: panelStyle.width, background: panelStyle.backgroundColor, border: panelStyle.borderRightColor, font: panelStyle.fontFamily,
      headingSize: headingStyle.fontSize, headingColor: headingStyle.color, headingWeight: headingStyle.fontWeight,
      regularSize: regularStyle.fontSize, regularColor: regularStyle.color, regularWeight: regularStyle.fontWeight,
      activeSize: activeStyle.fontSize, activeColor: activeStyle.color, activeBackground: activeStyle.backgroundColor,
      activeBorder: activeStyle.borderTopColor, activeWeight: activeStyle.fontWeight, iconSize: active.querySelector('svg')?.getAttribute('width'),
    };
  });
  check('Finance OS sidebar matches Patient Record width, font, and neutral colors', style?.width === '190px' && style.background === 'rgb(245, 245, 245)' && style.border === 'rgb(222, 222, 222)' && style.font.includes('Inter'));
  check('Finance OS sidebar matches Patient Record heading and item typography', style?.headingSize === '12px' && style.headingColor === 'rgb(85, 85, 85)' && style.headingWeight === '650' && style.regularSize === '14px' && style.regularColor === 'rgb(48, 48, 48)' && style.regularWeight === '400' && style.activeSize === '14px' && style.activeWeight === '600');
  check('Finance selected module uses the same gray row and icon size as Patient Record', style?.activeBackground === 'rgb(222, 222, 222)' && style.activeBorder === 'rgb(210, 210, 210)' && style.activeColor === 'rgb(25, 25, 25)' && style.iconSize === '17');

  await sidebar.getByRole('button', { name: 'Patient payments', exact: true }).click();
  await frame.getByRole('heading', { name: 'Patient payments', exact: true }).waitFor();
  await shell.waitForFunction(() => document.querySelector('[data-window-id="finance"] .window-module-sidebar-item.is-active span')?.textContent === 'Patient payments');
  check('OS sidebar selection still switches the Finance package module', await sidebar.getByRole('button', { name: 'Patient payments', exact: true }).getAttribute('aria-current') === 'page');
  check('Finance package and shell reported no renderer errors', errors.length === 0);
} finally {
  if (app) await app.close();
}
